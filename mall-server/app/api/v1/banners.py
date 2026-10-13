from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.banner import Banner
from app.schemas.common import ok

router = APIRouter(prefix="/banners", tags=["轮播图"])


@router.get("")
async def banner_list(db: AsyncSession = Depends(get_db)):
    rows = (await db.scalars(
        select(Banner).where(Banner.is_enabled.is_(True)).order_by(Banner.sort)
    )).all()
    return ok([
        {"id": b.id, "title": b.title, "image": b.image, "link_url": b.link_url, "sort": b.sort}
        for b in rows
    ])
