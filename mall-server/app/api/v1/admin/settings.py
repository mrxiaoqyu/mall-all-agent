"""平台级设置：智能客服总开关"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_admin
from app.db.session import get_db
from app.models.config import PlatformConfig
from app.models.user import AdminUser
from app.schemas.common import ok

router = APIRouter(prefix="/settings", tags=["平台-设置"])


class AiSettingIn(BaseModel):
    ai_enabled: bool


@router.get("/ai")
async def get_ai_setting(
    admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)
):
    cfg = await db.get(PlatformConfig, "ai_enabled")
    return ok({"ai_enabled": bool(cfg and cfg.value == "1")})


@router.put("/ai")
async def put_ai_setting(
    data: AiSettingIn,
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    cfg = await db.get(PlatformConfig, "ai_enabled")
    if cfg is None:
        cfg = PlatformConfig(key="ai_enabled", value="")
        db.add(cfg)
    cfg.value = "1" if data.ai_enabled else "0"
    await db.commit()
    return ok({"ai_enabled": data.ai_enabled}, "设置已更新")
