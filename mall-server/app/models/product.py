from sqlalchemy import JSON, Boolean, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class Category(Base, TimestampMixin):
    __tablename__ = "categories"

    name: Mapped[str] = mapped_column(String(50), index=True)
    parent_id: Mapped[int | None] = mapped_column(ForeignKey("categories.id"), nullable=True, index=True)
    sort: Mapped[int] = mapped_column(Integer, default=0)
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True)

    children: Mapped[list["Category"]] = relationship(
        "Category", back_populates="parent", cascade="all, delete-orphan"
    )
    parent: Mapped["Category | None"] = relationship("Category", back_populates="children", remote_side="Category.id")


class Product(Base, TimestampMixin):
    __tablename__ = "products"

    shop_id: Mapped[int] = mapped_column(ForeignKey("shops.id"), index=True)
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id"), index=True)
    title: Mapped[str] = mapped_column(String(200), index=True)
    sub_title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    main_image: Mapped[str | None] = mapped_column(String(500), nullable=True)
    images: Mapped[list] = mapped_column(JSON, default=list)
    detail: Mapped[str | None] = mapped_column(Text, nullable=True)
    price: Mapped[float] = mapped_column(Numeric(10, 2))  # 展示价（取 SKU 最低价）
    sales: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(10), default="on", index=True)  # on / off

    skus: Mapped[list["ProductSku"]] = relationship(
        "ProductSku", back_populates="product", cascade="all, delete-orphan"
    )


class ProductSku(Base, TimestampMixin):
    __tablename__ = "product_skus"

    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), index=True)
    spec_name: Mapped[str] = mapped_column(String(100))
    price: Mapped[float] = mapped_column(Numeric(10, 2))
    stock: Mapped[int] = mapped_column(Integer, default=0)
    sku_code: Mapped[str | None] = mapped_column(String(64), nullable=True)

    product: Mapped[Product] = relationship("Product", back_populates="skus")
