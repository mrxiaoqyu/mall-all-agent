from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_merchant
from app.db.session import get_db
from app.models.shop import Shop
from app.models.user import MerchantUser
from app.schemas.admin import ShopUpdateIn
from app.schemas.common import ok

router = APIRouter(prefix="/shop", tags=["商家-店铺"])


@router.get("")
async def my_shop(merchant: MerchantUser = Depends(get_current_merchant), db: AsyncSession = Depends(get_db)):
    shop = await db.get(Shop, merchant.shop_id)
    return ok({
        "id": shop.id, "name": shop.name, "logo": shop.logo,
        "description": shop.description, "status": shop.status,
        "reject_reason": shop.reject_reason, "ai_enabled": shop.ai_enabled,
    })


@router.put("")
async def update_shop(
    data: ShopUpdateIn,
    merchant: MerchantUser = Depends(get_current_merchant),
    db: AsyncSession = Depends(get_db),
):
    shop = await db.get(Shop, merchant.shop_id)
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(shop, k, v)
    await db.commit()
    return ok(None, "店铺信息已更新")
