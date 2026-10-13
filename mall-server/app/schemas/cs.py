from datetime import datetime

from pydantic import BaseModel, Field


class CsSessionCreateIn(BaseModel):
    target_type: str = Field(pattern="^(platform|shop)$")
    shop_id: int | None = None


class CsMessageOut(BaseModel):
    id: int
    session_id: int
    sender_role: str
    sender_id: int
    content: str
    msg_type: str
    is_read: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class CsSessionOut(BaseModel):
    id: int
    user_id: int
    target_type: str
    shop_id: int | None
    status: str
    last_message_at: datetime | None
    created_at: datetime
    # 扩展展示字段
    title: str | None = None        # 店铺名或"平台客服"
    shop_logo: str | None = None
    user_nickname: str | None = None  # 客服侧展示
    unread_count: int = 0
    last_message: str | None = None

    model_config = {"from_attributes": True}
