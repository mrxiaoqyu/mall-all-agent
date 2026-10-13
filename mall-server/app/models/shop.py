from sqlalchemy import Boolean, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class Shop(Base, TimestampMixin):
    __tablename__ = "shops"

    name: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    logo: Mapped[str | None] = mapped_column(String(500), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    # pending / approved / rejected / disabled
    status: Mapped[str] = mapped_column(String(20), default="pending", index=True)
    reject_reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
    ai_enabled: Mapped[bool] = mapped_column(Boolean, default=False, server_default="0")
