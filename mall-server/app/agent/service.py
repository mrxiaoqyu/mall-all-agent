"""Agent 服务：驱动 LangGraph 流式执行、消息落库、WS 广播、转人工、断连缓冲续传"""
import asyncio
import json
import logging
import time

from langchain_core.messages import AIMessageChunk, HumanMessage, ToolMessage
from langgraph.types import Command

from app.agent import safety
from app.agent.graph import TRANSFER_MARK, build_graph
from app.agent.llm import breaker
from app.core.config import settings
from app.db.session import async_session
from app.models.cs import CsSession
from app.services import cs_service
from app.ws.manager import manager

logger = logging.getLogger(__name__)

AGENT_SENDER_ID = 0  # agent 消息在 cs_messages.sender_id 中的占位
BUFFER_TTL = 600  # 已完成运行缓冲保留时长（秒），供断线补发

_graph = None


def init_graph(checkpointer):
    global _graph
    _graph = build_graph(checkpointer)


def thread_config(session_id: int) -> dict:
    return {"configurable": {"thread_id": f"cs_{session_id}"}}


class RunBuffer:
    """单会话一次运行的事件缓冲：SSE 断连后按 last_seq 补发"""

    def __init__(self):
        self.events: list[dict] = []  # {"seq","event","data"}
        self.done = False
        self.finished_at: float | None = None
        self.cond = asyncio.Condition()

    async def push(self, event: str, data: dict):
        async with self.cond:
            self.events.append({"seq": len(self.events) + 1, "event": event, "data": data})
            self.cond.notify_all()

    async def finish(self):
        async with self.cond:
            self.done = True
            self.finished_at = time.time()
            self.cond.notify_all()


_active_runs: dict[int, RunBuffer] = {}
_run_locks: dict[int, asyncio.Lock] = {}


def _prune_buffers():
    now = time.time()
    for sid in [sid for sid, b in _active_runs.items() if b.done and b.finished_at and now - b.finished_at > BUFFER_TTL]:
        _active_runs.pop(sid, None)


# ── 消息落库 + WS 广播 ──


async def _save_and_broadcast(session_id: int, sender_role: str, content: str,
                              msg_type: str = "text", extra: dict | None = None):
    async with async_session() as db:
        session = await db.get(CsSession, session_id)
        if session is None:
            return None
        message = await cs_service.save_message(db, session, sender_role, AGENT_SENDER_ID, content, msg_type, extra)
        targets = await cs_service.recipient_identities(db, session, sender_role, AGENT_SENDER_ID)
        payload = {"type": "message", "data": cs_service.message_to_dict(message)}
    await manager.send_to_many(targets, payload)
    return message


async def _extract_memories_task(session_id: int):
    """后台任务：从会话图中提取长期记忆"""
    from app.agent.memory import extract_memories_from_session
    from app.agent.llm import get_llm
    from app.models.cs import CsSession

    config = thread_config(session_id)
    try:
        state = await _graph.aget_state(config)
        messages = state.values.get("messages", [])
        if not messages:
            return
        async with async_session() as db:
            session = await db.get(CsSession, session_id)
            if session is None:
                return
            await extract_memories_from_session(
                get_llm(), db, session.user_id, session_id, messages,
            )
    except Exception:
        logger.exception("extract memories failed for session %s", session_id)


async def transfer_to_human(session_id: int, reason: str = "已为您转接人工客服，请稍候"):
    """兜底策略核心：会话转人工，系统提示 + WS 通知（幂等）"""
    async with async_session() as db:
        session = await db.get(CsSession, session_id)
        if session is None or session.handler == "human":
            return
        session.handler = "human"
        await db.commit()
        message = await cs_service.save_message(db, session, "cs", AGENT_SENDER_ID, reason, "system", None)
        targets = await cs_service.recipient_identities(db, session, "cs", AGENT_SENDER_ID)
        msg_payload = {"type": "message", "data": cs_service.message_to_dict(message)}
        handler_payload = {"type": "handler_changed", "data": {"session_id": session_id, "handler": "human"}}

    # 异步提取长期记忆（不阻塞 WS 广播）
    if settings.AI_MEMORY_EXTRACT_ENABLED:
        asyncio.create_task(_extract_memories_task(session_id))

    await manager.send_to_many(targets, msg_payload)
    await manager.send_to_many(targets, handler_payload)


# ── 运行驱动 ──


def _parse_tool_output(content: str) -> tuple[str, dict] | None:
    """解析工具 JSON 输出 → (事件名, 事件数据)；非卡片类输出返回 None"""
    try:
        data = json.loads(content)
    except (json.JSONDecodeError, TypeError):
        return None
    if not isinstance(data, dict):
        return None
    if data.get("type") == "product_cards" and data.get("items"):
        return ("card", {"items": data["items"]})
    if data.get("type") == "result":
        return ("result", data)
    return None


async def _run_graph(buf: RunBuffer, session_id: int, user_id: int,
                     content: str | None, resume: str | None):
    """后台执行 LangGraph，事件写入缓冲，结果落库"""
    config = thread_config(session_id)
    shop_name = None
    try:
        async with async_session() as db:
            session = await db.get(CsSession, session_id)
            if session is None:
                await buf.push("error", {"message": "会话不存在"})
                await buf.finish()
                return
            if session.target_type == "shop" and session.shop_id:
                from app.models.shop import Shop
                shop = await db.get(Shop, session.shop_id)
                shop_name = shop.name if shop else None

        if resume is not None:
            stream_input = Command(resume=resume)
        else:
            stream_input = {
                "messages": [HumanMessage(content=content)],
                "user_id": user_id, "session_id": session_id,
                "target_type": session.target_type, "shop_id": session.shop_id,
                "shop_name": shop_name,
            }

        text_parts: list[str] = []
        async for mode, payload in _graph.astream(stream_input, config, stream_mode=["messages", "updates"]):
            if mode == "messages":
                chunk, meta = payload
                if (isinstance(chunk, AIMessageChunk) and isinstance(chunk.content, str)
                        and chunk.content and meta.get("langgraph_node") == "agent"):
                    text_parts.append(chunk.content)
                    await buf.push("chunk", {"text": chunk.content})
            else:  # updates：工具节点输出 → 卡片事件 + 落库
                for node, update in payload.items():
                    if node != "tools" or not isinstance(update, dict):
                        continue
                    for m in update.get("messages", []):
                        if not isinstance(m, ToolMessage):
                            continue
                        parsed = _parse_tool_output(m.content if isinstance(m.content, str) else "")
                        if parsed is None:
                            continue
                        event, data = parsed
                        await buf.push(event, data)
                        if event == "card":
                            await _save_and_broadcast(session_id, "agent", "为您找到以下商品", "product_card", data)
                        elif event == "result":
                            await _save_and_broadcast(session_id, "agent", data.get("message", ""), "result_card", data)
        breaker.record_success()
    except Exception as e:
        breaker.record_failure()
        logger.exception("agent run failed (session=%s): %s", session_id, e)
        await transfer_to_human(session_id, "AI 客服暂时不可用，已为您转接人工客服")
        await buf.push("transferred", {"message": "AI 客服暂时不可用，已为您转接人工客服"})
        await buf.finish()
        return

    # 运行结束：检查是否处于 interrupt 待确认状态
    try:
        state = await _graph.aget_state(config)
        interrupts = [i for t in state.tasks for i in t.interrupts]
    except Exception as e:
        logger.exception("get state failed (session=%s): %s", session_id, e)
        interrupts = []

    if interrupts:
        confirm_payload = interrupts[0].value
        await buf.push("confirm_card", confirm_payload)
        action_text = "购买订单" if confirm_payload.get("action") == "buy" else "售后申请"
        await _save_and_broadcast(session_id, "agent", f"请您确认以下{action_text}", "confirm_card", confirm_payload)
        await buf.push("done", {"pending_confirm": True})
        await buf.finish()
        return

    full_text = safety.filter_output("".join(text_parts).strip())
    transferred = TRANSFER_MARK in full_text
    final_text = full_text.replace(TRANSFER_MARK, "").strip()
    if final_text:
        await _save_and_broadcast(session_id, "agent", final_text)
    if transferred:
        await transfer_to_human(session_id)
        await buf.push("transferred", {"message": "已为您转接人工客服，请稍候"})
    await buf.push("done", {"final_text": final_text or None, "transferred": transferred})
    await buf.finish()


# ── 对外入口 ──


async def start_chat_run(session: CsSession, user_id: int, content: str) -> RunBuffer:
    """发起一轮 AI 对话：输入安全过滤 → 保存用户消息 → 后台跑图"""
    _prune_buffers()
    lock = _run_locks.setdefault(session.id, asyncio.Lock())
    async with lock:
        existing = _active_runs.get(session.id)
        if existing and not existing.done:
            raise RuntimeError("上一条回复进行中，请稍候")
        buf = RunBuffer()
        _active_runs[session.id] = buf

    rejected = safety.check_input(content, user_id)
    if rejected:
        await _save_and_broadcast(session.id, "agent", rejected)
        await buf.push("message", {"text": rejected})
        await buf.push("done", {"final_text": rejected})
        await buf.finish()
        return buf

    if breaker.is_open():
        fallback = "智能客服服务繁忙，请稍后再试，或点击「转人工」由人工客服为您服务"
        await _save_and_broadcast(session.id, "agent", fallback)
        await buf.push("message", {"text": fallback})
        await buf.push("done", {"final_text": fallback})
        await buf.finish()
        return buf

    # 用户消息落库 + 广播到工作台
    async with async_session() as db:
        db_session = await db.get(CsSession, session.id)
        message = await cs_service.save_message(db, db_session, "user", user_id, content)
        targets = await cs_service.recipient_identities(db, db_session, "user", user_id)
        payload = {"type": "message", "data": cs_service.message_to_dict(message)}
    await manager.send_to_many(targets, payload)

    asyncio.create_task(_run_graph(buf, session.id, user_id, content, None))
    return buf


async def start_confirm_run(session: CsSession, user_id: int, decision: str) -> RunBuffer:
    """用户对确认卡片的决策：resume 中断继续执行"""
    _prune_buffers()
    lock = _run_locks.setdefault(session.id, asyncio.Lock())
    async with lock:
        existing = _active_runs.get(session.id)
        if existing and not existing.done:
            raise RuntimeError("上一条回复进行中，请稍候")
        buf = RunBuffer()
        _active_runs[session.id] = buf
    asyncio.create_task(_run_graph(buf, session.id, user_id, None, decision))
    return buf


async def event_stream(session_id: int, last_seq: int):
    """SSE 事件流：从缓冲按 last_seq 续读（断线重连续传）"""
    buf = _active_runs.get(session_id)
    if buf is None:
        yield {"event": "error", "data": {"message": "没有可续传的回复，请查看历史消息"}}
        return
    idx = max(0, last_seq)
    while True:
        async with buf.cond:
            while idx >= len(buf.events) and not buf.done:
                await buf.cond.wait()
            if idx >= len(buf.events) and buf.done:
                return
            ev = buf.events[idx]
            idx += 1
        yield ev


async def get_thread_state(session_id: int) -> dict:
    """会话线程状态：供刷新页面后恢复待确认卡片"""
    state = await _graph.aget_state(thread_config(session_id))
    interrupts = [i for t in state.tasks for i in t.interrupts]
    running = session_id in _active_runs and not _active_runs[session_id].done
    return {
        "interrupted": bool(interrupts),
        "pending_confirm": interrupts[0].value if interrupts else None,
        "running": running,
    }
