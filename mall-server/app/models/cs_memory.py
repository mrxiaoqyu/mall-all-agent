from sqlalchemy import Float, ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class CsUserMemory(Base, TimestampMixin):
    __tablename__ = "cs_user_memories"
    __table_args__ = (
        Index("ix_cs_user_memories_user_type", "user_id", "memory_type"),
    )

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    memory_type: Mapped[str] = mapped_column(String(20))  # preference / fact / summary
    content: Mapped[str] = mapped_column(Text)
    source_session_id: Mapped[int | None] = mapped_column(
        ForeignKey("cs_sessions.id"), nullable=True
    )
    relevance_score: Mapped[float] = mapped_column(Float, default=1.0)
