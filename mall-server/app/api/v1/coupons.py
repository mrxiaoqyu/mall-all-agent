from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.coupon import Coupon, UserCoupon
from app.models.user import User
from app.schemas.common import ok

router = APIRouter(prefix="/coupons", tags=["优惠券"])


@router.get("")
async def available_coupons(db: AsyncSession = Depends(get_db)):
    now = datetime.now()
    rows = (await db.scalars(
        select(Coupon).where(
            Coupon.status == "on", Coupon.start_at <= now, Coupon.end_at >= now,
            Coupon.received_count < Coupon.total_count,
        )
    )).all()
    return ok([
        {
            "id": c.id, "title": c.title, "threshold_amount": float(c.threshold_amount),
            "minus_amount": float(c.minus_amount), "total_count": c.total_count,
            "received_count": c.received_count,
            "start_at": c.start_at.isoformat(), "end_at": c.end_at.isoformat(),
        }
        for c in rows
    ])


@router.get("/mine")
async def my_coupons(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(
        select(UserCoupon, Coupon)
        .join(Coupon, UserCoupon.coupon_id == Coupon.id)
        .where(UserCoupon.user_id == user.id)
        .order_by(UserCoupon.id.desc())
    )).all()
    return ok([
        {
            "id": uc.id, "coupon_id": c.id, "status": uc.status, "title": c.title,
            "threshold_amount": float(c.threshold_amount), "minus_amount": float(c.minus_amount),
            "start_at": c.start_at.isoformat(), "end_at": c.end_at.isoformat(),
        }
        for uc, c in rows
    ])


@router.post("/{coupon_id}/receive")
async def receive_coupon(coupon_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    coupon = await db.get(Coupon, coupon_id)
    now = datetime.now()
    if coupon is None or coupon.status != "on" or coupon.start_at > now or coupon.end_at < now:
        raise HTTPException(status_code=400, detail="优惠券不可领取")
    if coupon.received_count >= coupon.total_count:
        raise HTTPException(status_code=400, detail="优惠券已领完")
    existing = await db.scalar(
        select(UserCoupon).where(UserCoupon.user_id == user.id, UserCoupon.coupon_id == coupon_id)
    )
    if existing:
        raise HTTPException(status_code=400, detail="已领取过该优惠券")
    coupon.received_count += 1
    db.add(UserCoupon(user_id=user.id, coupon_id=coupon_id))
    await db.commit()
    return ok(None, "领取成功")
