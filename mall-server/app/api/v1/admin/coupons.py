from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_admin
from app.db.session import get_db
from app.models.coupon import Coupon
from app.models.user import AdminUser
from app.schemas.admin import CouponIn
from app.schemas.common import ok

router = APIRouter(prefix="/coupons", tags=["平台-优惠券管理"])


def _to_dict(c: Coupon) -> dict:
    return {
        "id": c.id, "title": c.title, "threshold_amount": float(c.threshold_amount),
        "minus_amount": float(c.minus_amount), "total_count": c.total_count,
        "received_count": c.received_count, "start_at": c.start_at.isoformat(),
        "end_at": c.end_at.isoformat(), "status": c.status,
    }


@router.get("")
async def list_coupons(admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    rows = (await db.scalars(select(Coupon).order_by(Coupon.id.desc()))).all()
    return ok([_to_dict(c) for c in rows])


@router.post("")
async def create_coupon(data: CouponIn, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    coupon = Coupon(**data.model_dump())
    db.add(coupon)
    await db.commit()
    await db.refresh(coupon)
    return ok(_to_dict(coupon), "优惠券已创建")


@router.put("/{coupon_id}")
async def update_coupon(coupon_id: int, data: CouponIn, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    coupon = await db.get(Coupon, coupon_id)
    if coupon is None:
        raise HTTPException(status_code=404, detail="优惠券不存在")
    for k, v in data.model_dump().items():
        setattr(coupon, k, v)
    await db.commit()
    return ok(None, "已更新")


@router.post("/{coupon_id}/toggle")
async def toggle_coupon(coupon_id: int, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    coupon = await db.get(Coupon, coupon_id)
    if coupon is None:
        raise HTTPException(status_code=404, detail="优惠券不存在")
    coupon.status = "off" if coupon.status == "on" else "on"
    await db.commit()
    return ok(None, "已停用" if coupon.status == "off" else "已启用")
