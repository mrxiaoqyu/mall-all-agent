from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agent import service as agent_service
from app.core.deps import CurrentPrincipal, get_current_user, get_principal
from app.db.session import get_db
from app.models.cs import CsMessage, CsSession
from app.models.shop import Shop
from app.models.user import AdminUser, MerchantUser, User
from app.schemas.common import ok
from app.schemas.cs import CsSessionCreateIn
from app.services import cs_service
from app.ws.manager import manager

router = APIRouter(prefix="/cs", tags=["客服"])


class HandlerUpdateIn(BaseModel):
    handler: str = Field(pattern="^(agent|human)$")


# ── 用户侧 ──


@router.post("/sessions")
async def create_session(
    data: CsSessionCreateIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    session = await cs_service.get_or_create_session(db, user.id, data.target_type, data.shop_id)
    return ok({
        "id": session.id, "target_type": session.target_type,
        "shop_id": session.shop_id, "handler": session.handler,
    })


@router.get("/sessions")
async def my_sessions(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    sessions = (await db.scalars(
        select(CsSession).where(CsSession.user_id == user.id).order_by(CsSession.last_message_at.desc().nullslast())
    )).all()
    shop_ids = {s.shop_id for s in sessions if s.shop_id}
    shops = (await db.scalars(select(Shop).where(Shop.id.in_(shop_ids)))).all() if shop_ids else []
    shop_map = {s.id: s for s in shops}
    result = []
    for s in sessions:
        shop = shop_map.get(s.shop_id)
        result.append({
            "id": s.id, "target_type": s.target_type, "shop_id": s.shop_id,
            "title": shop.name if shop else "平台客服",
            "shop_logo": shop.logo if shop else None,
            "status": s.status, "handler": s.handler,
            "last_message_at": s.last_message_at.isoformat() if s.last_message_at else None,
            "unread_count": await cs_service.unread_count(db, s.id, "user"),
            "last_message": await cs_service.last_message_content(db, s.id),
        })
    return ok(result)


@router.get("/unread")
async def my_unread(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    sessions = (await db.scalars(select(CsSession).where(CsSession.user_id == user.id))).all()
    total = 0
    for s in sessions:
        total += await cs_service.unread_count(db, s.id, "user")
    return ok({"unread": total})


# ── 通用（按身份鉴权）──


@router.get("/sessions/{session_id}/messages")
async def session_messages(
    session_id: int,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=30, ge=1, le=100),
    principal: CurrentPrincipal = Depends(get_principal),
    db: AsyncSession = Depends(get_db),
):
    session = await cs_service.get_session_or_404(db, session_id)
    await _authorize(session, principal)
    rows = (await db.scalars(
        select(CsMessage).where(CsMessage.session_id == session_id)
        .order_by(CsMessage.id.desc()).offset((page - 1) * page_size).limit(page_size)
    )).all()
    return ok({"list": [cs_service.message_to_dict(m) for m in reversed(rows)]})


@router.post("/sessions/{session_id}/read")
async def read_session(
    session_id: int,
    principal: CurrentPrincipal = Depends(get_principal),
    db: AsyncSession = Depends(get_db),
):
    session = await cs_service.get_session_or_404(db, session_id)
    await _authorize(session, principal)
    await cs_service.mark_read(db, session_id, "user" if principal.role == "user" else "cs")
    return ok(None)


# ── 客服工作台 ──


@router.get("/workbench/sessions")
async def workbench_sessions(
    principal: CurrentPrincipal = Depends(get_principal),
    db: AsyncSession = Depends(get_db),
):
    if principal.role == "admin":
        admin = await db.get(AdminUser, principal.id)
        if admin is None or not admin.is_active:
            return ok([])
        query = select(CsSession).where(CsSession.target_type == "platform")
    elif principal.role == "merchant":
        merchant = await db.get(MerchantUser, principal.id)
        if merchant is None or not merchant.is_active:
            return ok([])
        query = select(CsSession).where(
            CsSession.target_type == "shop", CsSession.shop_id == merchant.shop_id
        )
    else:
        return ok([])
    sessions = (await db.scalars(query.order_by(CsSession.last_message_at.desc().nullslast()))).all()
    nick_map = await cs_service.user_nickname_map(db, {s.user_id for s in sessions})
    shop_ids = {s.shop_id for s in sessions if s.shop_id}
    shops = (await db.scalars(select(Shop).where(Shop.id.in_(shop_ids)))).all() if shop_ids else []
    shop_map = {s.id: s for s in shops}
    result = []
    for s in sessions:
        shop = shop_map.get(s.shop_id)
        result.append({
            "id": s.id, "user_id": s.user_id, "target_type": s.target_type,
            "shop_id": s.shop_id, "status": s.status, "handler": s.handler,
            "user_nickname": nick_map.get(s.user_id, f"用户{s.user_id}"),
            "title": shop.name if shop else "平台客服",
            "last_message_at": s.last_message_at.isoformat() if s.last_message_at else None,
            "unread_count": await cs_service.unread_count(db, s.id, "cs"),
            "last_message": await cs_service.last_message_content(db, s.id),
        })
    return ok(result)


async def _authorize(session: CsSession, principal: CurrentPrincipal):
    if principal.role == "user":
        await cs_service.check_user_participant(session, principal.id)
    else:
        await cs_service.check_cs_participant(session, principal.role, principal.shop_id)


# ── 会话模式（AI/人工）切换 ──


@router.patch("/sessions/{session_id}/handler")
async def update_session_handler(
    session_id: int,
    data: HandlerUpdateIn,
    principal: CurrentPrincipal = Depends(get_principal),
    db: AsyncSession = Depends(get_db),
):
    """客服工作台：人工接管 AI 会话 / 转回智能客服"""
    if principal.role not in ("admin", "merchant"):
        raise HTTPException(status_code=403, detail="无权操作")
    session = await cs_service.get_session_or_404(db, session_id)
    await cs_service.check_cs_participant(session, principal.role, principal.shop_id)
    if data.handler == session.handler:
        return ok({"handler": session.handler})
    if data.handler == "agent" and not await cs_service.resolve_ai_enabled(db, session.target_type, session.shop_id):
        raise HTTPException(status_code=400, detail="该渠道未开启智能客服")
    session.handler = data.handler
    await db.commit()
    text = "人工客服已接管会话" if data.handler == "human" else "已为您转回智能客服"
    message = await cs_service.save_message(db, session, "cs", principal.id, text, "system")
    targets = await cs_service.recipient_identities(db, session, "cs", principal.id)
    await manager.send_to_many(targets, {"type": "message", "data": cs_service.message_to_dict(message)})
    await manager.send_to_many(targets, {
        "type": "handler_changed", "data": {"session_id": session.id, "handler": session.handler},
    })
    return ok({"handler": session.handler})


@router.post("/sessions/{session_id}/transfer")
async def user_transfer(
    session_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """用户主动转人工（AI 会话 → 人工）"""
    session = await cs_service.get_session_or_404(db, session_id)
    await cs_service.check_user_participant(session, user.id)
    await agent_service.transfer_to_human(session.id, "已为您转接人工客服，请稍候")
    return ok(None)
