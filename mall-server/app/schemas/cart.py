from pydantic import BaseModel, Field


class AddressIn(BaseModel):
    receiver: str = Field(min_length=1, max_length=50)
    phone: str = Field(min_length=5, max_length=20)
    province: str
    city: str
    district: str
    detail: str
    is_default: bool = False


class AddressOut(AddressIn):
    id: int
    user_id: int

    model_config = {"from_attributes": True}


class CartAddIn(BaseModel):
    sku_id: int
    quantity: int = Field(default=1, ge=1)


class CartUpdateIn(BaseModel):
    quantity: int = Field(ge=1)


class CartItemOut(BaseModel):
    id: int
    sku_id: int
    quantity: int
    spec_name: str
    price: float
    stock: int
    product_id: int
    title: str
    main_image: str | None
    shop_id: int
    shop_name: str
    product_status: str


class CartShopGroup(BaseModel):
    shop_id: int
    shop_name: str
    items: list[CartItemOut]
