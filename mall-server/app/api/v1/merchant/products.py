from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import get_current_merchant
from app.db.session import get_db
from app.models.product import Product, ProductSku
from app.models.user import MerchantUser
from app.schemas.admin import ProductIn, ProductStatusIn
from app.schemas.common import ok

router = APIRouter(prefix="/products", tags=["商家-商品"])


def _product_to_dict(p: Product) -> dict:
    return {
        "id": p.id, "shop_id": p.shop_id, "category_id": p.category_id,
        "title": p.title, "sub_title": p.sub_title, "main_image": p.main_image,
        "images": p.images, "detail": p.detail, "price": float(p.price),
        "sales": p.sales, "status": p.status,
        "skus": [
            {"id": s.id, "spec_name": s.spec_name, "price": float(s.price),
             "stock": s.stock, "sku_code": s.sku_code}
            for s in p.skus
        ],
    }


async def _get_own_product(db: AsyncSession, product_id: int, shop_id: int) -> Product:
    product = await db.scalar(
        select(Product).options(selectinload(Product.skus)).where(Product.id == product_id)
    )
    if product is None or product.shop_id != shop_id:
        raise HTTPException(status_code=404, detail="商品不存在")
    return product


@router.get("")
async def list_products(
    keyword: str | None = None,
    status: str | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
    merchant: MerchantUser = Depends(get_current_merchant),
    db: AsyncSession = Depends(get_db),
):
    query = select(Product).options(selectinload(Product.skus)).where(Product.shop_id == merchant.shop_id)
    if keyword:
        query = query.where(Product.title.ilike(f"%{keyword}%"))
    if status:
        query = query.where(Product.status == status)
    total = await db.scalar(
        select(func.count()).select_from(Product).where(
            Product.shop_id == merchant.shop_id,
            *([Product.title.ilike(f"%{keyword}%")] if keyword else []),
            *([Product.status == status] if status else []),
        )
    ) or 0
    rows = (await db.scalars(
        query.order_by(Product.id.desc()).offset((page - 1) * page_size).limit(page_size)
    )).all()
    return ok({"list": [_product_to_dict(p) for p in rows], "total": total, "page": page, "page_size": page_size})


@router.get("/{product_id}")
async def get_product(product_id: int, merchant: MerchantUser = Depends(get_current_merchant), db: AsyncSession = Depends(get_db)):
    product = await _get_own_product(db, product_id, merchant.shop_id)
    return ok(_product_to_dict(product))


@router.post("")
async def create_product(data: ProductIn, merchant: MerchantUser = Depends(get_current_merchant), db: AsyncSession = Depends(get_db)):
    product = Product(
        shop_id=merchant.shop_id, category_id=data.category_id, title=data.title,
        sub_title=data.sub_title, main_image=data.main_image, images=data.images,
        detail=data.detail, price=min(s.price for s in data.skus), status="on",
    )
    for s in data.skus:
        product.skus.append(ProductSku(spec_name=s.spec_name, price=s.price, stock=s.stock, sku_code=s.sku_code))
    db.add(product)
    await db.commit()
    await db.refresh(product)
    return ok({"id": product.id}, "商品创建成功")


@router.put("/{product_id}")
async def update_product(
    product_id: int, data: ProductIn,
    merchant: MerchantUser = Depends(get_current_merchant), db: AsyncSession = Depends(get_db),
):
    product = await _get_own_product(db, product_id, merchant.shop_id)
    product.category_id = data.category_id
    product.title = data.title
    product.sub_title = data.sub_title
    product.main_image = data.main_image
    product.images = data.images
    product.detail = data.detail
    product.price = min(s.price for s in data.skus)

    existing = {s.id: s for s in product.skus}
    keep_ids: set[int] = set()
    for s in data.skus:
        if s.id and s.id in existing:
            sku = existing[s.id]
            sku.spec_name = s.spec_name
            sku.price = s.price
            sku.stock = s.stock
            sku.sku_code = s.sku_code
            keep_ids.add(s.id)
        else:
            product.skus.append(ProductSku(spec_name=s.spec_name, price=s.price, stock=s.stock, sku_code=s.sku_code))
    for sku_id, sku in existing.items():
        if sku_id not in keep_ids:
            await db.delete(sku)
    await db.commit()
    return ok(None, "商品已更新")


@router.put("/{product_id}/status")
async def update_status(
    product_id: int, data: ProductStatusIn,
    merchant: MerchantUser = Depends(get_current_merchant), db: AsyncSession = Depends(get_db),
):
    product = await _get_own_product(db, product_id, merchant.shop_id)
    product.status = data.status
    await db.commit()
    return ok(None, "已上架" if data.status == "on" else "已下架")


@router.delete("/{product_id}")
async def delete_product(product_id: int, merchant: MerchantUser = Depends(get_current_merchant), db: AsyncSession = Depends(get_db)):
    product = await _get_own_product(db, product_id, merchant.shop_id)
    await db.delete(product)
    await db.commit()
    return ok(None, "商品已删除")
