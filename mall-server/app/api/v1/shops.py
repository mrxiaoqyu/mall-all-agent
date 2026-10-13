from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.product import Product
from app.models.shop import Shop
from app.schemas.common import ok

router = APIRouter(prefix="/shops", tags=["店铺"])


@router.get("/recommend")
async def recommend_shops(db: AsyncSession = Depends(get_db)):
    rows = (await db.scalars(
        select(Shop).where(Shop.status == "approved").order_by(Shop.created_at.desc()).limit(8)
    )).all()
    return ok([
        {"id": s.id, "name": s.name, "logo": s.logo, "description": s.description}
        for s in rows
    ])


@router.get("/{shop_id}")
async def shop_detail(shop_id: int, db: AsyncSession = Depends(get_db)):
    shop = await db.get(Shop, shop_id)
    if shop is None or shop.status != "approved":
        raise HTTPException(status_code=404, detail="店铺不存在")
    product_count = await db.scalar(
        select(func.count()).select_from(Product).where(Product.shop_id == shop_id, Product.status == "on")
    )
    return ok(
        {
            "id": shop.id, "name": shop.name, "logo": shop.logo,
            "description": shop.description, "product_count": product_count or 0,
        }
    )
