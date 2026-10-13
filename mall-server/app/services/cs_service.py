from datetime import datetime

from fastapi import HTTPException
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.config import PlatformConfig
from app.models.cs import CsMessage, CsSession
from app.models.shop import Shop
from app.models.user import AdminUser, MerchantUser, User

CS_SIDE_ROLES = ("cs", "agent")  # 客服侧消息角色（用户视角的未读来源）


async def resolve_ai_enabled(db: AsyncSession, target_type: str, shop_id: int | None) -> bool:
    """渠道智能客服开关：平台看 platform_config，店铺看 shops.ai_enabled"""
    if target_type == "shop":
        if not shop_id:
            return False
        shop = await db.get(Shop, shop_id)
        return bool(shop and shop.ai_enabled)
    cfg = await db.get(PlatformConfig, "ai_enabled")
    return bool(cfg and cfg.value == "1")


async def get_or_create_session(
    db: AsyncSession, user_id: int, target_type: str, shop_id: int | None
) -> CsSession:
    if target_type == "shop":
        if not shop_id:
            raise HTTPException(status_code=400, detail="缺少店铺ID")
        shop = await db.get(Shop, shop_id)
        if shop is None or shop.status != "approved":
            raise HTTPException(status_code=400, detail="店铺不可用")
    else:
        shop_id = None
    session = await db.scalar(
        select(CsSession).where(
            CsSession.user_id == user_id,
            CsSession.target_type == target_type,
            CsSession.shop_id.is_(None) if shop_id is None else CsSession.shop_id == shop_id,
        )
    )
    if session is None:
        handler = "agent" if await resolve_ai_enabled(db, target_type, shop_id) else "human"
        session = CsSession(user_id=user_id, target_type=target_type, shop_id=shop_id, handler=handler)
        db.add(session)
        await db.commit()
        await db.refresh(session)
    return session


async def cs_channel_identities(db: AsyncSession, session: CsSession) -> list[str]:
    """会话客服侧所有成员 identity"""
    if session.target_type == "platform":
        ids = (await db.scalars(select(AdminUser.id).where(AdminUser.is_active.is_(True)))).all()
        return [f"admin:{i}" for i in ids]
    ids = (await db.scalars(
        select(MerchantUser.id).where(MerchantUser.shop_id == session.shop_id, MerchantUser.is_active.is_(True))
    )).all()
    return [f"merchant:{i}" for i in ids]


async def recipient_identities(
    db: AsyncSession, session: CsSession, sender_role: str, sender_id: int
) -> list[str]:
    """消息接收方（含发送者本人的其他连接，用于多端回显）"""
    if sender_role == "user":
        targets = await cs_channel_identities(db, session)
        return [f"user:{sender_id}", *targets]
    # 客服发送 → 用户 + 同渠道其他客服
    others = [i for i in await cs_channel_identities(db, session) if not i.endswith(f":{sender_id}")]
    return [f"user:{session.user_id}", *others]


async def save_message(
    db: AsyncSession, session: CsSession, sender_role: str, sender_id: int, content: str,
    msg_type: str = "text", extra: dict | None = None,
) -> CsMessage:
    message = CsMessage(session_id=session.id, sender_role=sender_role, sender_id=sender_id,
                        content=content, msg_type=msg_type, extra=extra)
    session.last_message_at = datetime.now()
    db.add(message)
    await db.commit()
    await db.refresh(message)
    return message


def message_to_dict(m: CsMessage) -> dict:
    return {
        "id": m.id, "session_id": m.session_id, "sender_role": m.sender_role,
        "sender_id": m.sender_id, "content": m.content, "msg_type": m.msg_type,
        "extra": m.extra,
        "is_read": m.is_read, "created_at": m.created_at.isoformat() if m.created_at else None,
    }


async def mark_read(db: AsyncSession, session_id: int, reader_role: str):
    """将发给 reader 的消息标记已读：用户读客服消息 / 客服读用户消息"""
    stmt = update(CsMessage).where(CsMessage.session_id == session_id, CsMessage.is_read.is_(False))
    if reader_role == "user":
        stmt = stmt.where(CsMessage.sender_role.in_(CS_SIDE_ROLES))
    else:
        stmt = stmt.where(CsMessage.sender_role == "user")
    await db.execute(stmt.values(is_read=True))
    await db.commit()


async def unread_count(db: AsyncSession, session_id: int, reader_role: str) -> int:
    query = select(func.count()).select_from(CsMessage).where(
        CsMessage.session_id == session_id, CsMessage.is_read.is_(False),
    )
    if reader_role == "user":
        query = query.where(CsMessage.sender_role.in_(CS_SIDE_ROLES))
    else:
        query = query.where(CsMessage.sender_role == "user")
    return await db.scalar(query) or 0


async def check_user_participant(session: CsSession, user_id: int):
    if session.user_id != user_id:
        raise HTTPException(status_code=403, detail="无权访问该会话")


async def check_cs_participant(session: CsSession, role: str, shop_id: int | None):
    """admin 仅平台会话；merchant 仅本店会话"""
    if role == "admin":
        if session.target_type != "platform":
            raise HTTPException(status_code=403, detail="平台客服仅处理平台会话")
    elif role == "merchant":
        if session.target_type != "shop" or session.shop_id != shop_id:
            raise HTTPException(status_code=403, detail="仅可处理本店会话")
    else:
        raise HTTPException(status_code=403, detail="无权访问")


async def get_session_or_404(db: AsyncSession, session_id: int) -> CsSession:
    session = await db.get(CsSession, session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="会话不存在")
    return session


async def last_message_content(db: AsyncSession, session_id: int) -> str | None:
    return await db.scalar(
        select(CsMessage.content).where(CsMessage.session_id == session_id).order_by(CsMessage.id.desc()).limit(1)
    )


async def user_nickname_map(db: AsyncSession, user_ids: set[int]) -> dict[int, str]:
    if not user_ids:
        return {}
    rows = (await db.execute(select(User.id, User.nickname, User.username).where(User.id.in_(user_ids)))).all()
    return {r[0]: (r[1] or r[2]) for r in rows}
