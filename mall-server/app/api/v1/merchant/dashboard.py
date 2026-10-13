from datetime import datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_merchant
from app.db.session import get_db
from app.models.order import Order
from app.models.product import Product
from app.models.user import MerchantUser
from app.schemas.common import ok

router = APIRouter(prefix="/dashboard", tags=["商家-看板"])

_VALID_STATUSES = ("paid", "shipped", "completed", "refunding")


@router.get("")
async def shop_dashboard(merchant: MerchantUser = Depends(get_current_merchant), db: AsyncSession = Depends(get_db)):
    shop_id = merchant.shop_id
    total_sales = await db.scalar(
        select(func.coalesce(func.sum(Order.pay_amount), 0)).where(
            Order.shop_id == shop_id, Order.status.in_(_VALID_STATUSES)
        )
    )
    total_orders = await db.scalar(
        select(func.count()).select_from(Order).where(Order.shop_id == shop_id, Order.status.in_(_VALID_STATUSES))
    )
    total_products = await db.scalar(select(func.count()).select_from(Product).where(Product.shop_id == shop_id))
    pending_ship = await db.scalar(
        select(func.count()).select_from(Order).where(Order.shop_id == shop_id, Order.status == "paid")
    )
    pending_refund = await db.scalar(
        select(func.count()).select_from(Order).where(Order.shop_id == shop_id, Order.status == "refunding")
    )

    trend = []
    today = datetime.now().date()
    for i in range(6, -1, -1):
        day = today - timedelta(days=i)
        day_start = datetime.combine(day, datetime.min.time())
        day_end = day_start + timedelta(days=1)
        sales = await db.scalar(
            select(func.coalesce(func.sum(Order.pay_amount), 0)).where(
                Order.shop_id == shop_id, Order.status.in_(_VALID_STATUSES),
                Order.created_at >= day_start, Order.created_at < day_end,
            )
        )
        count = await db.scalar(
            select(func.count()).select_from(Order).where(
                Order.shop_id == shop_id, Order.status.in_(_VALID_STATUSES),
                Order.created_at >= day_start, Order.created_at < day_end,
            )
        )
        trend.append({"date": day.isoformat(), "sales": float(sales or 0), "orders": count or 0})

    return ok({
        "total_sales": float(total_sales or 0),
        "total_orders": total_orders or 0,
        "total_products": total_products or 0,
        "pending_ship_orders": pending_ship or 0,
        "pending_refund_orders": pending_refund or 0,
        "trend": trend,
    })
