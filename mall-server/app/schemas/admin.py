from datetime import datetime

from pydantic import BaseModel, Field


# ── 商家入驻/店铺 ──


class MerchantRegisterIn(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=6, max_length=64)
    shop_name: str = Field(min_length=2, max_length=100)
    shop_logo: str | None = None
    shop_description: str | None = None


class ShopUpdateIn(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=100)
    logo: str | None = None
    description: str | None = None
    ai_enabled: bool | None = None


class ShopAuditIn(BaseModel):
    action: str = Field(pattern="^(approve|reject)$")
    reject_reason: str | None = None


class ShopStatusIn(BaseModel):
    action: str = Field(pattern="^(enable|disable)$")


class ShopAdminOut(BaseModel):
    id: int
    name: str
    logo: str | None
    description: str | None
    status: str
    reject_reason: str | None
    created_at: datetime
    merchant_username: str | None = None
    product_count: int = 0

    model_config = {"from_attributes": True}


# ── 分类 ──


class CategoryIn(BaseModel):
    name: str = Field(min_length=1, max_length=50)
    parent_id: int | None = None
    sort: int = 0
    is_enabled: bool = True


# ── 商品（商家维护） ──


class SkuIn(BaseModel):
    id: int | None = None
    spec_name: str = Field(min_length=1, max_length=100)
    price: float = Field(gt=0)
    stock: int = Field(ge=0)
    sku_code: str | None = None


class ProductIn(BaseModel):
    category_id: int
    title: str = Field(min_length=1, max_length=200)
    sub_title: str | None = None
    main_image: str | None = None
    images: list[str] = []
    detail: str | None = None
    skus: list[SkuIn] = Field(min_length=1)


class ProductStatusIn(BaseModel):
    status: str = Field(pattern="^(on|off)$")


# ── 订单（管理侧操作） ──


class ShipIn(BaseModel):
    pass


class RefundAuditIn(BaseModel):
    action: str = Field(pattern="^(approve|reject)$")


# ── 用户管理 ──


class UserStatusIn(BaseModel):
    is_active: bool


# ── 轮播 ──


class BannerIn(BaseModel):
    title: str = Field(min_length=1, max_length=100)
    image: str
    link_url: str | None = None
    sort: int = 0
    is_enabled: bool = True


# ── 优惠券 ──


class CouponIn(BaseModel):
    title: str = Field(min_length=1, max_length=100)
    threshold_amount: float = Field(ge=0)
    minus_amount: float = Field(gt=0)
    total_count: int = Field(ge=1)
    start_at: datetime
    end_at: datetime
    status: str = Field(default="on", pattern="^(on|off)$")


# ── 看板 ──


class DashboardOut(BaseModel):
    total_sales: float
    total_orders: int
    total_users: int | None = None
    total_shops: int | None = None
    total_products: int | None = None
    pending_refund_orders: int = 0
    trend: list[dict] = []  # [{date, sales, orders}]
