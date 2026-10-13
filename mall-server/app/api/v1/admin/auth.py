from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, verify_password
from app.db.session import get_db
from app.models.user import AdminUser
from app.schemas.auth import LoginIn, TokenOut
from app.schemas.common import ok

router = APIRouter(prefix="/auth", tags=["平台认证"])


@router.post("/login")
async def admin_login(data: LoginIn, db: AsyncSession = Depends(get_db)):
    admin = await db.scalar(select(AdminUser).where(AdminUser.username == data.username))
    if admin is None or not verify_password(data.password, admin.password_hash):
        raise HTTPException(status_code=400, detail="用户名或密码错误")
    if not admin.is_active:
        raise HTTPException(status_code=403, detail="账号已被禁用")
    token = create_access_token(admin.id, "admin")
    return ok(
        TokenOut(
            token=token, role="admin", user_id=admin.id, username=admin.username, nickname=admin.username,
        ).model_dump()
    )
