from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_admin
from app.db.session import get_db
from app.models.banner import Banner
from app.models.user import AdminUser
from app.schemas.admin import BannerIn
from app.schemas.common import ok

router = APIRouter(prefix="/banners", tags=["平台-轮播管理"])


def _to_dict(b: Banner) -> dict:
    return {"id": b.id, "title": b.title, "image": b.image, "link_url": b.link_url,
            "sort": b.sort, "is_enabled": b.is_enabled}


@router.get("")
async def list_banners(admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    rows = (await db.scalars(select(Banner).order_by(Banner.sort, Banner.id))).all()
    return ok([_to_dict(b) for b in rows])


@router.post("")
async def create_banner(data: BannerIn, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    banner = Banner(**data.model_dump())
    db.add(banner)
    await db.commit()
    await db.refresh(banner)
    return ok(_to_dict(banner), "已创建")


@router.put("/{banner_id}")
async def update_banner(banner_id: int, data: BannerIn, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    banner = await db.get(Banner, banner_id)
    if banner is None:
        raise HTTPException(status_code=404, detail="轮播图不存在")
    for k, v in data.model_dump().items():
        setattr(banner, k, v)
    await db.commit()
    return ok(None, "已更新")


@router.delete("/{banner_id}")
async def delete_banner(banner_id: int, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    banner = await db.get(Banner, banner_id)
    if banner is None:
        raise HTTPException(status_code=404, detail="轮播图不存在")
    await db.delete(banner)
    await db.commit()
    return ok(None, "已删除")
