from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.address import Address
from app.models.user import User
from app.schemas.cart import AddressIn, AddressOut
from app.schemas.common import ok

router = APIRouter(prefix="/addresses", tags=["收货地址"])


@router.get("")
async def list_addresses(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    rows = (await db.scalars(
        select(Address).where(Address.user_id == user.id).order_by(Address.is_default.desc(), Address.id.desc())
    )).all()
    return ok([AddressOut.model_validate(a).model_dump() for a in rows])


@router.post("")
async def create_address(data: AddressIn, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if data.is_default:
        await _clear_default(db, user.id)
    address = Address(user_id=user.id, **data.model_dump())
    db.add(address)
    await db.commit()
    await db.refresh(address)
    return ok(AddressOut.model_validate(address).model_dump(), "添加成功")


@router.put("/{address_id}")
async def update_address(
    address_id: int, data: AddressIn,
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db),
):
    address = await _get_own(db, address_id, user.id)
    if data.is_default:
        await _clear_default(db, user.id)
    for k, v in data.model_dump().items():
        setattr(address, k, v)
    await db.commit()
    return ok(None, "更新成功")


@router.delete("/{address_id}")
async def delete_address(address_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    address = await _get_own(db, address_id, user.id)
    await db.delete(address)
    await db.commit()
    return ok(None, "删除成功")


async def _get_own(db: AsyncSession, address_id: int, user_id: int) -> Address:
    address = await db.get(Address, address_id)
    if address is None or address.user_id != user_id:
        raise HTTPException(status_code=404, detail="地址不存在")
    return address


async def _clear_default(db: AsyncSession, user_id: int):
    rows = (await db.scalars(select(Address).where(Address.user_id == user_id, Address.is_default.is_(True)))).all()
    for a in rows:
        a.is_default = False
