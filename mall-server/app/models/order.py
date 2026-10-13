from sqlalchemy import JSON, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

# 订单状态: pending_pay / paid / shipped / completed / cancelled / refunding / refunded


class Order(Base, TimestampMixin):
    __tablename__ = "orders"

    order_no: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    batch_no: Mapped[str] = mapped_column(String(32), index=True)  # 同批拆单共享
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    shop_id: Mapped[int] = mapped_column(ForeignKey("shops.id"), index=True)
    total_amount: Mapped[float] = mapped_column(Numeric(10, 2))
    discount_amount: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    pay_amount: Mapped[float] = mapped_column(Numeric(10, 2))
    status: Mapped[str] = mapped_column(String(20), default="pending_pay", index=True)
    address_snapshot: Mapped[dict] = mapped_column(JSON)
    coupon_id: Mapped[int | None] = mapped_column(ForeignKey("coupons.id"), nullable=True)

    items: Mapped[list["OrderItem"]] = relationship(
        "OrderItem", back_populates="order", cascade="all, delete-orphan"
    )


class OrderItem(Base, TimestampMixin):
    __tablename__ = "order_items"

    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id"), index=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"))
    sku_id: Mapped[int] = mapped_column(ForeignKey("product_skus.id"))
    title: Mapped[str] = mapped_column(String(200))
    spec_name: Mapped[str] = mapped_column(String(100))
    price: Mapped[float] = mapped_column(Numeric(10, 2))
    quantity: Mapped[int] = mapped_column(Integer)
    image: Mapped[str | None] = mapped_column(String(500), nullable=True)

    order: Mapped[Order] = relationship("Order", back_populates="items")
