from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.cart import CartItem
from app.models.product import Product, ProductSku
from app.models.shop import Shop
from app.models.user import User
from app.schemas.cart import CartAddIn, CartUpdateIn
from app.schemas.common import ok

router = APIRouter(prefix="/cart", tags=["购物车"])


async def _build_cart(db: AsyncSession, user_id: int) -> list[dict]:
    rows = (await db.execute(
        select(CartItem, ProductSku, Product, Shop)
        .join(ProductSku, CartItem.sku_id == ProductSku.id)
        .join(Product, ProductSku.product_id == Product.id)
        .join(Shop, Product.shop_id == Shop.id)
        .where(CartItem.user_id == user_id)
        .order_by(Shop.id, CartItem.id.desc())
    )).all()
    groups: dict[int, dict] = {}
    for item, sku, product, shop in rows:
        group = groups.setdefault(shop.id, {"shop_id": shop.id, "shop_name": shop.name, "items": []})
        group["items"].append(
            {
                "id": item.id, "sku_id": sku.id, "quantity": item.quantity,
                "spec_name": sku.spec_name, "price": float(sku.price), "stock": sku.stock,
                "product_id": product.id, "title": product.title,
                "main_image": product.main_image, "shop_id": shop.id,
                "shop_name": shop.name, "product_status": product.status,
            }
        )
    return list(groups.values())


@router.get("")
async def cart_list(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return ok(await _build_cart(db, user.id))


@router.post("")
async def cart_add(data: CartAddIn, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    sku = await db.get(ProductSku, data.sku_id)
    if sku is None:
        raise HTTPException(status_code=404, detail="商品规格不存在")
    product = await db.get(Product, sku.product_id)
    if product is None or product.status != "on":
        raise HTTPException(status_code=400, detail="商品已下架")
    existing = await db.scalar(
        select(CartItem).where(CartItem.user_id == user.id, CartItem.sku_id == data.sku_id)
    )
    new_qty = data.quantity + (existing.quantity if existing else 0)
    if new_qty > sku.stock:
        raise HTTPException(status_code=400, detail="库存不足")
    if existing:
        existing.quantity = new_qty
    else:
        db.add(CartItem(user_id=user.id, sku_id=data.sku_id, quantity=data.quantity))
    await db.commit()
    return ok(None, "已加入购物车")


@router.put("/{item_id}")
async def cart_update(
    item_id: int, data: CartUpdateIn,
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db),
):
    item = await db.get(CartItem, item_id)
    if item is None or item.user_id != user.id:
        raise HTTPException(status_code=404, detail="购物车条目不存在")
    sku = await db.get(ProductSku, item.sku_id)
    if sku and data.quantity > sku.stock:
        raise HTTPException(status_code=400, detail="库存不足")
    item.quantity = data.quantity
    await db.commit()
    return ok(None, "已更新")


@router.delete("/{item_id}")
async def cart_delete(item_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    item = await db.get(CartItem, item_id)
    if item is None or item.user_id != user.id:
        raise HTTPException(status_code=404, detail="购物车条目不存在")
    await db.delete(item)
    await db.commit()
    return ok(None, "已删除")
