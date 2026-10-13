from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import get_current_admin
from app.db.session import get_db
from app.models.product import Product
from app.models.shop import Shop
from app.models.user import AdminUser
from app.schemas.admin import ProductStatusIn
from app.schemas.common import ok

router = APIRouter(prefix="/products", tags=["平台-商品监管"])


@router.get("")
async def list_products(
    keyword: str | None = None,
    shop_id: int | None = None,
    status: str | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    conditions = []
    if keyword:
        conditions.append(Product.title.ilike(f"%{keyword}%"))
    if shop_id:
        conditions.append(Product.shop_id == shop_id)
    if status:
        conditions.append(Product.status == status)
    total = await db.scalar(select(func.count()).select_from(Product).where(*conditions)) or 0
    rows = (await db.scalars(
        select(Product).options(selectinload(Product.skus)).where(*conditions)
        .order_by(Product.id.desc()).offset((page - 1) * page_size).limit(page_size)
    )).all()
    shop_ids = {p.shop_id for p in rows}
    shops = (await db.scalars(select(Shop).where(Shop.id.in_(shop_ids)))).all() if shop_ids else []
    shop_map = {s.id: s.name for s in shops}
    return ok({
        "list": [
            {
                "id": p.id, "shop_id": p.shop_id, "shop_name": shop_map.get(p.shop_id),
                "category_id": p.category_id, "title": p.title, "sub_title": p.sub_title,
                "main_image": p.main_image, "price": float(p.price), "sales": p.sales,
                "status": p.status,
                "total_stock": sum(s.stock for s in p.skus),
            }
            for p in rows
        ],
        "total": total, "page": page, "page_size": page_size,
    })


@router.put("/{product_id}/status")
async def force_status(
    product_id: int, data: ProductStatusIn,
    admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db),
):
    product = await db.get(Product, product_id)
    if product is None:
        raise HTTPException(status_code=404, detail="商品不存在")
    product.status = data.status
    await db.commit()
    return ok(None, "操作成功")
