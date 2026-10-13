"""智能客服 Agent 接口：SSE 流式对话 / 二次确认 / 转人工 / 线程状态"""
import json

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.agent import service as agent_service
from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.cs import CsSession
from app.models.user import User
from app.schemas.common import ok
from app.services import cs_service

router = APIRouter(prefix="/ai", tags=["智能客服"])


class ChatStreamIn(BaseModel):
    session_id: int
    content: str = ""
    last_seq: int = 0


class ConfirmIn(BaseModel):
    session_id: int
    decision: str = Field(pattern="^(confirm|cancel)$")


class TransferIn(BaseModel):
    session_id: int


async def _agent_session(db: AsyncSession, session_id: int, user_id: int) -> CsSession:
    session = await cs_service.get_session_or_404(db, session_id)
    await cs_service.check_user_participant(session, user_id)
    if session.handler != "agent":
        raise HTTPException(status_code=400, detail="当前为人工客服模式")
    return session


def _sse_response(session_id: int, last_seq: int) -> StreamingResponse:
    async def gen():
        async for ev in agent_service.event_stream(session_id, last_seq):
            yield f"event: {ev['event']}\n"
            yield f"data: {json.dumps({'seq': ev['seq'], **ev['data']}, ensure_ascii=False)}\n\n"

    return StreamingResponse(
        gen(), media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/chat/stream")
async def chat_stream(
    data: ChatStreamIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """发送消息（SSE 流式响应）；仅带 last_seq 时为断线重连续传"""
    session = await _agent_session(db, data.session_id, user.id)
    if data.content.strip():
        try:
            await agent_service.start_chat_run(session, user.id, data.content.strip())
        except RuntimeError as e:
            raise HTTPException(status_code=409, detail=str(e))
    elif data.last_seq <= 0:
        raise HTTPException(status_code=400, detail="消息不能为空")
    return _sse_response(data.session_id, data.last_seq)


@router.post("/confirm")
async def confirm(
    data: ConfirmIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """确认卡片决策（SSE 流式响应恢复执行）"""
    session = await _agent_session(db, data.session_id, user.id)
    state = await agent_service.get_thread_state(session.id)
    if not state["interrupted"]:
        raise HTTPException(status_code=400, detail="当前没有待确认的操作")
    try:
        await agent_service.start_confirm_run(session, user.id, data.decision)
    except RuntimeError as e:
        raise HTTPException(status_code=409, detail=str(e))
    return _sse_response(data.session_id, 0)


@router.post("/transfer")
async def transfer(
    data: TransferIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """用户主动转人工"""
    session = await cs_service.get_session_or_404(db, data.session_id)
    await cs_service.check_user_participant(session, user.id)
    await agent_service.transfer_to_human(session.id, "已为您转接人工客服，请稍候")
    return ok(None)


@router.get("/thread/{session_id}/state")
async def thread_state(
    session_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """线程状态：刷新页面后恢复待确认卡片 / 判断是否有进行中的回复"""
    session = await cs_service.get_session_or_404(db, session_id)
    await cs_service.check_user_participant(session, user.id)
    return ok(await agent_service.get_thread_state(session_id))
