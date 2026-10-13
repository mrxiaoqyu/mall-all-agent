"""长期记忆 CRUD + LLM 滚动摘要 + 会话记忆提取"""
import logging

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage
from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.cs_memory import CsUserMemory

logger = logging.getLogger(__name__)

MAX_SCORE = 2.0
MIN_SCORE = 0.3


# ── 长期记忆查询 ──


async def get_user_memories(
    db: AsyncSession, user_id: int, limit: int = 10
) -> list[CsUserMemory]:
    """获取用户长期记忆，按相关性排序（过滤低分记忆）"""
    rows = (await db.scalars(
        select(CsUserMemory)
        .where(CsUserMemory.user_id == user_id, CsUserMemory.relevance_score >= MIN_SCORE)
        .order_by(CsUserMemory.relevance_score.desc(), CsUserMemory.updated_at.desc())
        .limit(limit)
    )).all()
    return list(rows)


async def boost_memory_scores(db: AsyncSession, memory_ids: list[int]):
    """记忆被注入使用后提升相关性（上限 MAX_SCORE）"""
    if not memory_ids:
        return
    await db.execute(
        update(CsUserMemory)
        .where(CsUserMemory.id.in_(memory_ids), CsUserMemory.relevance_score < MAX_SCORE)
        .values(relevance_score=CsUserMemory.relevance_score + 0.1)
    )
    await db.commit()


async def decay_memory_scores(db: AsyncSession, user_id: int):
    """自然遗忘衰减，低分记忆清理"""
    await db.execute(
        update(CsUserMemory)
        .where(CsUserMemory.user_id == user_id)
        .values(relevance_score=CsUserMemory.relevance_score * 0.95)
    )
    await db.execute(
        delete(CsUserMemory).where(
            CsUserMemory.user_id == user_id,
            CsUserMemory.relevance_score < MIN_SCORE,
        )
    )
    await db.commit()


async def save_memory(
    db: AsyncSession, user_id: int, memory_type: str,
    content: str, source_session_id: int | None = None,
):
    memory = CsUserMemory(
        user_id=user_id, memory_type=memory_type,
        content=content, source_session_id=source_session_id,
    )
    db.add(memory)
    await db.commit()


# ── 滚动摘要 ──

SUMMARY_PROMPT = """你是一个对话摘要助手。请将以下对话历史压缩为简洁的摘要，保留：
1. 用户的核心需求和意图
2. 已完成的操作及其结果（如已下单、已申请退款等）
3. 用户表达的偏好或限制（如价格范围、材质要求等）
4. 尚未解决的问题

忽略：寒暄、重复的追问、无关紧要的细节。
用中文，不超过200字。直接输出摘要内容，不要前缀。

已有摘要（如有）：
{existing_summary}

新增对话：
{old_messages}"""


def _format_messages_for_summary(messages: list[BaseMessage]) -> str:
    """将消息列表格式化为摘要输入文本（工具消息折叠为一行标记）"""
    lines = []
    for m in messages:
        if isinstance(m, HumanMessage):
            role = "用户"
        elif isinstance(m, AIMessage):
            role = "客服"
        else:
            role = "系统"
        if m.type == "tool":
            lines.append("系统：[工具调用结果]")
            continue
        content = m.content if isinstance(m.content, str) else str(m.content)
        if not content.strip():
            # 带 tool_calls 但无文本内容的 AIMessage
            if getattr(m, "tool_calls", None):
                lines.append("客服：[调用了工具]")
            continue
        if len(content) > 200:
            content = content[:200] + "…"
        lines.append(f"{role}：{content}")
    return "\n".join(lines)


async def generate_summary(llm, old_messages: list[BaseMessage], existing_summary: str | None) -> str:
    """调用 LLM 生成滚动摘要"""
    formatted = _format_messages_for_summary(old_messages)
    prompt = SUMMARY_PROMPT.format(
        existing_summary=existing_summary or "（无）",
        old_messages=formatted,
    )
    response = await llm.ainvoke([SystemMessage(content=prompt)])
    return response.content.strip()


# ── 长期记忆提取 ──

EXTRACT_PROMPT = """请从以下客服对话中提取值得长期记住的用户信息：
1. 用户偏好（如喜欢的品类、价格区间、风格）
2. 用户限制（如过敏材质、尺寸信息）
3. 用户历史问题（如经常遇到的问题类型）

忽略一次性信息（如具体某次订单号、临时地址）。
每条记忆一行，格式：类型|内容
类型：preference/fact
如果没有值得记住的内容，输出"无"。

对话内容：
{conversation}"""


async def extract_memories_from_session(
    llm, db: AsyncSession, user_id: int, session_id: int,
    messages: list[BaseMessage],
):
    """会话结束后从对话中提取长期记忆"""
    formatted = _format_messages_for_summary(messages)
    if not formatted.strip():
        return
    prompt = EXTRACT_PROMPT.format(conversation=formatted)
    response = await llm.ainvoke([SystemMessage(content=prompt)])
    text = response.content.strip()
    if text == "无" or not text:
        return
    for line in text.split("\n"):
        line = line.strip()
        if "|" not in line:
            continue
        mem_type, content = line.split("|", 1)
        mem_type = mem_type.strip()
        content = content.strip()
        if mem_type in ("preference", "fact") and content:
            await save_memory(db, user_id, mem_type, content, session_id)
            logger.info("extracted memory: user=%s type=%s content=%s", user_id, mem_type, content[:50])
