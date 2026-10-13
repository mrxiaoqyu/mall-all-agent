from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, hash_password, verify_password
from app.db.session import get_db
from app.models.shop import Shop
from app.models.user import MerchantUser
from app.schemas.admin import MerchantRegisterIn
from app.schemas.auth import LoginIn, TokenOut
from app.schemas.common import ok

router = APIRouter(prefix="/auth", tags=["商家认证"])


@router.post("/register")
async def merchant_register(data: MerchantRegisterIn, db: AsyncSession = Depends(get_db)):
    if await db.scalar(select(MerchantUser).where(MerchantUser.username == data.username)):
        raise HTTPException(status_code=400, detail="用户名已存在")
    if await db.scalar(select(Shop).where(Shop.name == data.shop_name)):
        raise HTTPException(status_code=400, detail="店铺名称已被使用")
    shop = Shop(
        name=data.shop_name, logo=data.shop_logo,
        description=data.shop_description, status="pending",
    )
    db.add(shop)
    await db.flush()
    merchant = MerchantUser(
        username=data.username, password_hash=hash_password(data.password),
        shop_id=shop.id, is_owner=True,
    )
    db.add(merchant)
    await db.commit()
    return ok(None, "入驻申请已提交，请等待平台审核")


@router.post("/login")
async def merchant_login(data: LoginIn, db: AsyncSession = Depends(get_db)):
    merchant = await db.scalar(select(MerchantUser).where(MerchantUser.username == data.username))
    if merchant is None or not verify_password(data.password, merchant.password_hash):
        raise HTTPException(status_code=400, detail="用户名或密码错误")
    if not merchant.is_active:
        raise HTTPException(status_code=403, detail="账号已被禁用")
    shop = await db.get(Shop, merchant.shop_id)
    if shop is None:
        raise HTTPException(status_code=403, detail="店铺不存在")
    if shop.status != "approved":
        reason = f"，原因：{shop.reject_reason}" if shop.status == "rejected" and shop.reject_reason else ""
        status_text = {"pending": "店铺审核中，请耐心等待", "rejected": f"入驻申请被拒绝{reason}", "disabled": "店铺已被停用"}
        raise HTTPException(status_code=403, detail=status_text.get(shop.status, "店铺不可用"))
    token = create_access_token(merchant.id, "merchant", shop_id=merchant.shop_id)
    return ok(
        TokenOut(
            token=token, role="merchant", user_id=merchant.id,
            username=merchant.username, nickname=shop.name,
            shop_id=shop.id, shop_status=shop.status,
        ).model_dump()
    )
