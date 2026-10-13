from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.models.product import Category, Product
from app.models.shop import Shop
from app.schemas.common import ok

router = APIRouter(prefix="/products", tags=["商品"])


@router.get("/categories")
async def category_tree(db: AsyncSession = Depends(get_db)):
    rows = (await db.scalars(select(Category).where(Category.is_enabled.is_(True)).order_by(Category.sort))).all()
    nodes = {
        c.id: {"id": c.id, "name": c.name, "parent_id": c.parent_id, "sort": c.sort, "children": []}
        for c in rows
    }
    tree = []
    for node in nodes.values():
        if node["parent_id"] and node["parent_id"] in nodes:
            nodes[node["parent_id"]]["children"].append(node)
        else:
            tree.append(node)
    return ok(tree)


@router.get("")
async def product_list(
    keyword: str | None = None,
    category_id: int | None = None,
    shop_id: int | None = None,
    sort: str = Query(default="default", pattern="^(default|sales|price_asc|price_desc|new)$"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=12, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(Product)
        .join(Shop, Product.shop_id == Shop.id)
        .where(Product.status == "on", Shop.status == "approved")
    )
    count_query = select(func.count()).select_from(query.subquery())
    if keyword:
        query = query.where(Product.title.ilike(f"%{keyword}%"))
    if shop_id:
        query = query.where(Product.shop_id == shop_id)
    if category_id:
        child_ids = await db.scalars(select(Category.id).where(Category.parent_id == category_id))
        ids = [category_id, *child_ids.all()]
        query = query.where(Product.category_id.in_(ids))
    if sort == "sales":
        query = query.order_by(Product.sales.desc())
    elif sort == "price_asc":
        query = query.order_by(Product.price.asc())
    elif sort == "price_desc":
        query = query.order_by(Product.price.desc())
    else:
        query = query.order_by(Product.created_at.desc())

    total = await db.scalar(count_query) or 0
    rows = (await db.scalars(query.offset((page - 1) * page_size).limit(page_size))).all()
    shop_ids = {p.shop_id for p in rows}
    shops = (await db.scalars(select(Shop).where(Shop.id.in_(shop_ids)))).all() if shop_ids else []
    shop_map = {s.id: s.name for s in shops}
    items = [
        {
            "id": p.id, "shop_id": p.shop_id, "shop_name": shop_map.get(p.shop_id),
            "category_id": p.category_id, "title": p.title, "sub_title": p.sub_title,
            "main_image": p.main_image, "price": float(p.price), "sales": p.sales, "status": p.status,
        }
        for p in rows
    ]
    return ok({"list": items, "total": total, "page": page, "page_size": page_size})


@router.get("/{product_id}")
async def product_detail(product_id: int, db: AsyncSession = Depends(get_db)):
    product = await db.scalar(
        select(Product).options(selectinload(Product.skus)).where(Product.id == product_id)
    )
    if product is None or product.status != "on":
        raise HTTPException(status_code=404, detail="商品不存在或已下架")
    shop = await db.get(Shop, product.shop_id)
    if shop is None or shop.status != "approved":
        raise HTTPException(status_code=404, detail="店铺不可用")
    return ok(
        {
            "id": product.id, "shop_id": product.shop_id, "shop_name": shop.name,
            "category_id": product.category_id, "title": product.title,
            "sub_title": product.sub_title, "main_image": product.main_image,
            "images": product.images, "detail": product.detail,
            "price": float(product.price), "sales": product.sales, "status": product.status,
            "skus": [
                {
                    "id": s.id, "product_id": s.product_id, "spec_name": s.spec_name,
                    "price": float(s.price), "stock": s.stock, "sku_code": s.sku_code,
                }
                for s in product.skus
            ],
        }
    )
