from datetime import datetime

from pydantic import BaseModel, Field


class OrderItemOut(BaseModel):
    id: int
    product_id: int
    sku_id: int
    title: str
    spec_name: str
    price: float
    quantity: int
    image: str | None

    model_config = {"from_attributes": True}


class OrderOut(BaseModel):
    id: int
    order_no: str
    batch_no: str
    user_id: int
    shop_id: int
    shop_name: str | None = None
    total_amount: float
    discount_amount: float
    pay_amount: float
    status: str
    address_snapshot: dict
    coupon_id: int | None
    created_at: datetime
    items: list[OrderItemOut] = []

    model_config = {"from_attributes": True}


class CheckoutItemIn(BaseModel):
    sku_id: int
    quantity: int = Field(ge=1)


class CreateOrderIn(BaseModel):
    address_id: int
    items: list[CheckoutItemIn]  # 为空则取购物车全部
    use_cart: bool = True
    user_coupon_id: int | None = None


class PayBatchIn(BaseModel):
    batch_no: str
