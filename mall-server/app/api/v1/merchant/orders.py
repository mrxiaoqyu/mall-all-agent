from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import get_current_merchant
from app.db.session import get_db
from app.models.order import Order
from app.models.user import MerchantUser
from app.schemas.admin import RefundAuditIn
from app.schemas.common import ok
from app.services import order_service

router = APIRouter(prefix="/orders", tags=["商家-订单"])


async def _get_shop_order(db: AsyncSession, order_id: int, shop_id: int) -> Order:
    order = await db.scalar(
        select(Order).options(selectinload(Order.items)).where(Order.id == order_id)
    )
    if order is None or order.shop_id != shop_id:
        raise HTTPException(status_code=404, detail="订单不存在")
    return order


@router.get("")
async def list_orders(
    status: str | None = None,
    keyword: str | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
    merchant: MerchantUser = Depends(get_current_merchant),
    db: AsyncSession = Depends(get_db),
):
    conditions = [Order.shop_id == merchant.shop_id]
    if status:
        conditions.append(Order.status == status)
    if keyword:
        conditions.append(Order.order_no.ilike(f"%{keyword}%"))
    total = await db.scalar(select(func.count()).select_from(Order).where(*conditions)) or 0
    rows = (await db.scalars(
        select(Order).options(selectinload(Order.items)).where(*conditions)
        .order_by(Order.id.desc()).offset((page - 1) * page_size).limit(page_size)
    )).all()
    return ok({
        "list": [order_service.order_to_dict(o) for o in rows],
        "total": total, "page": page, "page_size": page_size,
    })


@router.get("/{order_id}")
async def order_detail(order_id: int, merchant: MerchantUser = Depends(get_current_merchant), db: AsyncSession = Depends(get_db)):
    order = await _get_shop_order(db, order_id, merchant.shop_id)
    return ok(order_service.order_to_dict(order))


@router.post("/{order_id}/ship")
async def ship_order(order_id: int, merchant: MerchantUser = Depends(get_current_merchant), db: AsyncSession = Depends(get_db)):
    order = await _get_shop_order(db, order_id, merchant.shop_id)
    if order.status != "paid":
        raise HTTPException(status_code=400, detail="仅已支付订单可发货")
    order.status = "shipped"
    await db.commit()
    return ok(None, "已发货")


@router.post("/{order_id}/refund_audit")
async def refund_audit(
    order_id: int, data: RefundAuditIn,
    merchant: MerchantUser = Depends(get_current_merchant), db: AsyncSession = Depends(get_db),
):
    order = await _get_shop_order(db, order_id, merchant.shop_id)
    await order_service.audit_refund(db, order, approve=data.action == "approve")
    return ok(None, "退款已同意" if data.action == "approve" else "退款已拒绝")
