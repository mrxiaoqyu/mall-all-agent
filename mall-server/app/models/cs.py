from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class CsSession(Base, TimestampMixin):
    __tablename__ = "cs_sessions"
    __table_args__ = (UniqueConstraint("user_id", "target_type", "shop_id", name="uq_cs_session"),)

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    target_type: Mapped[str] = mapped_column(String(10))  # platform / shop
    shop_id: Mapped[int | None] = mapped_column(ForeignKey("shops.id"), nullable=True, index=True)
    status: Mapped[str] = mapped_column(String(10), default="open")  # open / closed
    handler: Mapped[str] = mapped_column(String(10), default="human")  # agent / human
    last_message_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class CsMessage(Base, TimestampMixin):
    __tablename__ = "cs_messages"

    session_id: Mapped[int] = mapped_column(ForeignKey("cs_sessions.id"), index=True)
    sender_role: Mapped[str] = mapped_column(String(10))  # user / cs / agent
    sender_id: Mapped[int] = mapped_column()
    content: Mapped[str] = mapped_column(Text)
    msg_type: Mapped[str] = mapped_column(String(20), default="text")  # text / product_card / confirm_card / result_card / system
    extra: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
