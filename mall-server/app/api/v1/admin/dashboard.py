from datetime import datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_admin
from app.db.session import get_db
from app.models.order import Order
from app.models.product import Product
from app.models.shop import Shop
from app.models.user import AdminUser, User
from app.schemas.common import ok

router = APIRouter(prefix="/dashboard", tags=["平台-看板"])

_VALID_STATUSES = ("paid", "shipped", "completed", "refunding")


@router.get("")
async def admin_dashboard(admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    total_sales = await db.scalar(
        select(func.coalesce(func.sum(Order.pay_amount), 0)).where(Order.status.in_(_VALID_STATUSES))
    )
    total_orders = await db.scalar(select(func.count()).select_from(Order).where(Order.status.in_(_VALID_STATUSES)))
    total_users = await db.scalar(select(func.count()).select_from(User))
    total_shops = await db.scalar(select(func.count()).select_from(Shop).where(Shop.status == "approved"))
    total_products = await db.scalar(select(func.count()).select_from(Product))
    pending_shops = await db.scalar(select(func.count()).select_from(Shop).where(Shop.status == "pending"))
    pending_refund = await db.scalar(select(func.count()).select_from(Order).where(Order.status == "refunding"))

    trend = []
    today = datetime.now().date()
    for i in range(6, -1, -1):
        day = today - timedelta(days=i)
        day_start = datetime.combine(day, datetime.min.time())
        day_end = day_start + timedelta(days=1)
        sales = await db.scalar(
            select(func.coalesce(func.sum(Order.pay_amount), 0)).where(
                Order.status.in_(_VALID_STATUSES), Order.created_at >= day_start, Order.created_at < day_end
            )
        )
        count = await db.scalar(
            select(func.count()).select_from(Order).where(
                Order.status.in_(_VALID_STATUSES), Order.created_at >= day_start, Order.created_at < day_end
            )
        )
        trend.append({"date": day.isoformat(), "sales": float(sales or 0), "orders": count or 0})

    return ok({
        "total_sales": float(total_sales or 0),
        "total_orders": total_orders or 0,
        "total_users": total_users or 0,
        "total_shops": total_shops or 0,
        "total_products": total_products or 0,
        "pending_shops": pending_shops or 0,
        "pending_refund_orders": pending_refund or 0,
        "trend": trend,
    })
