from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_admin
from app.db.session import get_db
from app.models.product import Product
from app.models.shop import Shop
from app.models.user import AdminUser, MerchantUser
from app.schemas.admin import ShopAuditIn, ShopStatusIn
from app.schemas.common import ok

router = APIRouter(prefix="/shops", tags=["平台-店铺管理"])


@router.get("")
async def list_shops(
    status: str | None = None,
    keyword: str | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    conditions = []
    if status:
        conditions.append(Shop.status == status)
    if keyword:
        conditions.append(Shop.name.ilike(f"%{keyword}%"))
    total = await db.scalar(select(func.count()).select_from(Shop).where(*conditions)) or 0
    shops = (await db.scalars(
        select(Shop).where(*conditions).order_by(Shop.id.desc()).offset((page - 1) * page_size).limit(page_size)
    )).all()
    result = []
    for shop in shops:
        merchant = await db.scalar(select(MerchantUser).where(MerchantUser.shop_id == shop.id).limit(1))
        product_count = await db.scalar(select(func.count()).select_from(Product).where(Product.shop_id == shop.id))
        result.append({
            "id": shop.id, "name": shop.name, "logo": shop.logo, "description": shop.description,
            "status": shop.status, "reject_reason": shop.reject_reason,
            "created_at": shop.created_at.isoformat() if shop.created_at else None,
            "merchant_username": merchant.username if merchant else None,
            "product_count": product_count or 0,
        })
    return ok({"list": result, "total": total, "page": page, "page_size": page_size})


@router.post("/{shop_id}/audit")
async def audit_shop(
    shop_id: int, data: ShopAuditIn,
    admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db),
):
    shop = await db.get(Shop, shop_id)
    if shop is None:
        raise HTTPException(status_code=404, detail="店铺不存在")
    if shop.status != "pending":
        raise HTTPException(status_code=400, detail="店铺不在待审核状态")
    if data.action == "approve":
        shop.status = "approved"
        shop.reject_reason = None
    else:
        shop.status = "rejected"
        shop.reject_reason = data.reject_reason
    await db.commit()
    return ok(None, "审核完成")


@router.post("/{shop_id}/status")
async def change_shop_status(
    shop_id: int, data: ShopStatusIn,
    admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db),
):
    shop = await db.get(Shop, shop_id)
    if shop is None:
        raise HTTPException(status_code=404, detail="店铺不存在")
    if data.action == "disable":
        if shop.status != "approved":
            raise HTTPException(status_code=400, detail="仅正常店铺可停用")
        shop.status = "disabled"
    else:
        if shop.status != "disabled":
            raise HTTPException(status_code=400, detail="仅已停用店铺可启用")
        shop.status = "approved"
    await db.commit()
    return ok(None, "操作成功")
