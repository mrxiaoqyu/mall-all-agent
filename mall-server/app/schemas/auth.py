from pydantic import BaseModel, Field


class RegisterIn(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=6, max_length=64)
    nickname: str | None = None


class LoginIn(BaseModel):
    username: str
    password: str


class TokenOut(BaseModel):
    token: str
    role: str
    user_id: int
    username: str
    nickname: str | None = None
    shop_id: int | None = None
    shop_status: str | None = None


class ProfileUpdateIn(BaseModel):
    nickname: str | None = None
    avatar: str | None = None


class PasswordUpdateIn(BaseModel):
    old_password: str
    new_password: str = Field(min_length=6, max_length=64)


class UserOut(BaseModel):
    id: int
    username: str
    email: str | None
    nickname: str | None
    avatar: str | None
    is_active: bool

    model_config = {"from_attributes": True}
