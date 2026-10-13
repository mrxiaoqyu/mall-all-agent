from dataclasses import dataclass

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_token
from app.db.session import get_db
from app.models.shop import Shop
from app.models.user import AdminUser, MerchantUser, User

bearer = HTTPBearer(auto_error=False)


@dataclass
class CurrentPrincipal:
    id: int
    role: str  # user / merchant / admin
    shop_id: int | None = None


async def get_principal(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
) -> CurrentPrincipal:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="未登录")
    payload = decode_token(credentials.credentials)
    if payload is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="登录已失效")
    return CurrentPrincipal(
        id=int(payload["sub"]),
        role=payload.get("role", ""),
        shop_id=payload.get("shop_id"),
    )


async def get_current_user(
    principal: CurrentPrincipal = Depends(get_principal),
    db: AsyncSession = Depends(get_db),
) -> User:
    if principal.role != "user":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="需要用户身份")
    user = await db.get(User, principal.id)
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="用户不可用")
    return user


async def get_current_admin(
    principal: CurrentPrincipal = Depends(get_principal),
    db: AsyncSession = Depends(get_db),
) -> AdminUser:
    if principal.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="需要平台管理员身份")
    admin = await db.get(AdminUser, principal.id)
    if admin is None or not admin.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="管理员不可用")
    return admin


async def get_current_merchant(
    principal: CurrentPrincipal = Depends(get_principal),
    db: AsyncSession = Depends(get_db),
) -> MerchantUser:
    if principal.role != "merchant":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="需要商家身份")
    merchant = await db.get(MerchantUser, principal.id)
    if merchant is None or not merchant.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="商家不可用")
    shop = await db.get(Shop, merchant.shop_id)
    if shop is None or shop.status != "approved":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="店铺未通过审核或已停用")
    return merchant
