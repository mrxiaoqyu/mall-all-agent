from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class Coupon(Base, TimestampMixin):
    __tablename__ = "coupons"

    title: Mapped[str] = mapped_column(String(100))
    threshold_amount: Mapped[float] = mapped_column(Numeric(10, 2), default=0)  # 满X
    minus_amount: Mapped[float] = mapped_column(Numeric(10, 2))  # 减Y
    total_count: Mapped[int] = mapped_column(Integer, default=0)
    received_count: Mapped[int] = mapped_column(Integer, default=0)
    start_at: Mapped[datetime] = mapped_column(DateTime)
    end_at: Mapped[datetime] = mapped_column(DateTime)
    status: Mapped[str] = mapped_column(String(10), default="on")  # on / off


class UserCoupon(Base, TimestampMixin):
    __tablename__ = "user_coupons"

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    coupon_id: Mapped[int] = mapped_column(ForeignKey("coupons.id"), index=True)
    status: Mapped[str] = mapped_column(String(10), default="unused")  # unused / used / expired
    used_order_id: Mapped[int | None] = mapped_column(ForeignKey("orders.id"), nullable=True)
