from datetime import datetime

from pydantic import BaseModel


class CategoryOut(BaseModel):
    id: int
    name: str
    parent_id: int | None
    sort: int
    is_enabled: bool

    model_config = {"from_attributes": True}


class CategoryTreeOut(CategoryOut):
    children: list["CategoryTreeOut"] = []


class SkuOut(BaseModel):
    id: int
    product_id: int
    spec_name: str
    price: float
    stock: int
    sku_code: str | None

    model_config = {"from_attributes": True}


class ProductListOut(BaseModel):
    id: int
    shop_id: int
    shop_name: str | None = None
    category_id: int
    title: str
    sub_title: str | None
    main_image: str | None
    price: float
    sales: int
    status: str

    model_config = {"from_attributes": True}


class ProductDetailOut(ProductListOut):
    images: list
    detail: str | None
    skus: list[SkuOut] = []


class ShopOut(BaseModel):
    id: int
    name: str
    logo: str | None
    description: str | None
    status: str
    created_at: datetime | None = None

    model_config = {"from_attributes": True}
