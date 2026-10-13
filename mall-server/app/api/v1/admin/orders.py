from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import get_current_admin
from app.db.session import get_db
from app.models.order import Order
from app.models.shop import Shop
from app.models.user import AdminUser
from app.schemas.common import ok
from app.services import order_service

router = APIRouter(prefix="/orders", tags=["平台-订单监管"])


@router.get("")
async def list_orders(
    status: str | None = None,
    keyword: str | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    conditions = []
    if status:
        conditions.append(Order.status == status)
    if keyword:
        conditions.append(Order.order_no.ilike(f"%{keyword}%"))
    total = await db.scalar(select(func.count()).select_from(Order).where(*conditions)) or 0
    rows = (await db.execute(
        select(Order, Shop.name).join(Shop, Order.shop_id == Shop.id)
        .options(selectinload(Order.items)).where(*conditions)
        .order_by(Order.id.desc()).offset((page - 1) * page_size).limit(page_size)
    )).all()
    return ok({
        "list": [order_service.order_to_dict(o, name) for o, name in rows],
        "total": total, "page": page, "page_size": page_size,
    })


@router.get("/{order_id}")
async def order_detail(order_id: int, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    order = await db.scalar(select(Order).options(selectinload(Order.items)).where(Order.id == order_id))
    if order is None:
        raise HTTPException(status_code=404, detail="订单不存在")
    shop = await db.get(Shop, order.shop_id)
    return ok(order_service.order_to_dict(order, shop.name if shop else None))
