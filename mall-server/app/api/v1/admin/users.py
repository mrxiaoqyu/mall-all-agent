from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_admin
from app.db.session import get_db
from app.models.user import AdminUser, User
from app.schemas.admin import UserStatusIn
from app.schemas.common import ok

router = APIRouter(prefix="/users", tags=["平台-用户管理"])


@router.get("")
async def list_users(
    keyword: str | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    conditions = []
    if keyword:
        conditions.append(User.username.ilike(f"%{keyword}%"))
    total = await db.scalar(select(func.count()).select_from(User).where(*conditions)) or 0
    rows = (await db.scalars(
        select(User).where(*conditions).order_by(User.id.desc()).offset((page - 1) * page_size).limit(page_size)
    )).all()
    return ok({
        "list": [
            {
                "id": u.id, "username": u.username, "email": u.email,
                "nickname": u.nickname, "avatar": u.avatar, "is_active": u.is_active,
                "created_at": u.created_at.isoformat() if u.created_at else None,
            }
            for u in rows
        ],
        "total": total, "page": page, "page_size": page_size,
    })


@router.put("/{user_id}/status")
async def change_status(
    user_id: int, data: UserStatusIn,
    admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db),
):
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="用户不存在")
    user.is_active = data.is_active
    await db.commit()
    return ok(None, "操作成功")
