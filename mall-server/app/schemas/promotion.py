from datetime import datetime

from pydantic import BaseModel


class CouponOut(BaseModel):
    id: int
    title: str
    threshold_amount: float
    minus_amount: float
    total_count: int
    received_count: int
    start_at: datetime
    end_at: datetime
    status: str

    model_config = {"from_attributes": True}


class UserCouponOut(BaseModel):
    id: int
    coupon_id: int
    status: str
    title: str
    threshold_amount: float
    minus_amount: float
    start_at: datetime
    end_at: datetime


class BannerOut(BaseModel):
    id: int
    title: str
    image: str
    link_url: str | None
    sort: int

    model_config = {"from_attributes": True}
