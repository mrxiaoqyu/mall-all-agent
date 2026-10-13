from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.order import Order
from app.models.shop import Shop
from app.models.user import User
from app.schemas.common import ok
from app.schemas.order import CreateOrderIn, PayBatchIn
from app.services import order_service

router = APIRouter(prefix="/orders", tags=["订单"])


async def _get_own_order(db: AsyncSession, order_id: int, user_id: int) -> Order:
    order = await db.scalar(
        select(Order).options(selectinload(Order.items)).where(Order.id == order_id)
    )
    if order is None or order.user_id != user_id:
        raise HTTPException(status_code=404, detail="订单不存在")
    return order


@router.post("")
async def create_order(
    data: CreateOrderIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await order_service.create_orders(
        db, user.id, data.address_id, data.items, data.use_cart, data.user_coupon_id
    )
    return ok(result, "下单成功")


@router.post("/pay_batch")
async def pay_batch(data: PayBatchIn, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    paid = await order_service.pay_batch(db, user.id, data.batch_no)
    if paid == 0:
        raise HTTPException(status_code=400, detail="没有待支付的订单")
    return ok({"paid": paid}, "支付成功")


@router.get("")
async def order_list(
    status: str | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(Order, Shop.name)
        .join(Shop, Order.shop_id == Shop.id)
        .options(selectinload(Order.items))
        .where(Order.user_id == user.id)
    )
    if status:
        query = query.where(Order.status == status)
    total = await db.scalar(
        select(func.count()).select_from(Order).where(
            Order.user_id == user.id, *( [Order.status == status] if status else [] )
        )
    ) or 0
    rows = (await db.execute(
        query.order_by(Order.id.desc()).offset((page - 1) * page_size).limit(page_size)
    )).all()
    return ok({
        "list": [order_service.order_to_dict(o, shop_name) for o, shop_name in rows],
        "total": total, "page": page, "page_size": page_size,
    })


@router.get("/{order_id}")
async def order_detail(order_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    order = await _get_own_order(db, order_id, user.id)
    shop = await db.get(Shop, order.shop_id)
    return ok(order_service.order_to_dict(order, shop.name if shop else None))


@router.post("/{order_id}/cancel")
async def cancel(order_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    order = await _get_own_order(db, order_id, user.id)
    await order_service.cancel_order(db, order)
    return ok(None, "订单已取消")


@router.post("/{order_id}/confirm")
async def confirm(order_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    order = await _get_own_order(db, order_id, user.id)
    await order_service.confirm_order(db, order)
    return ok(None, "已确认收货")


@router.post("/{order_id}/refund")
async def refund(order_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    order = await _get_own_order(db, order_id, user.id)
    await order_service.request_refund(db, order)
    return ok(None, "退款申请已提交")
