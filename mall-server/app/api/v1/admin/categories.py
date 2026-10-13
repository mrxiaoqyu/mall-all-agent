from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_admin
from app.db.session import get_db
from app.models.product import Category, Product
from app.models.user import AdminUser
from app.schemas.admin import CategoryIn
from app.schemas.common import ok

router = APIRouter(prefix="/categories", tags=["平台-分类管理"])


@router.get("")
async def list_categories(admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    rows = (await db.scalars(select(Category).order_by(Category.sort, Category.id))).all()
    nodes = {
        c.id: {"id": c.id, "name": c.name, "parent_id": c.parent_id, "sort": c.sort,
               "is_enabled": c.is_enabled, "children": []}
        for c in rows
    }
    tree = []
    for node in nodes.values():
        if node["parent_id"] and node["parent_id"] in nodes:
            nodes[node["parent_id"]]["children"].append(node)
        else:
            tree.append(node)
    return ok(tree)


@router.post("")
async def create_category(data: CategoryIn, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    if data.parent_id:
        parent = await db.get(Category, data.parent_id)
        if parent is None:
            raise HTTPException(status_code=400, detail="父分类不存在")
        if parent.parent_id:
            raise HTTPException(status_code=400, detail="最多支持两级分类")
    category = Category(**data.model_dump())
    db.add(category)
    await db.commit()
    await db.refresh(category)
    return ok({"id": category.id}, "分类已创建")


@router.put("/{category_id}")
async def update_category(
    category_id: int, data: CategoryIn,
    admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db),
):
    category = await db.get(Category, category_id)
    if category is None:
        raise HTTPException(status_code=404, detail="分类不存在")
    category.name = data.name
    category.sort = data.sort
    category.is_enabled = data.is_enabled
    await db.commit()
    return ok(None, "分类已更新")


@router.delete("/{category_id}")
async def delete_category(category_id: int, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    category = await db.get(Category, category_id)
    if category is None:
        raise HTTPException(status_code=404, detail="分类不存在")
    has_child = await db.scalar(select(Category).where(Category.parent_id == category_id).limit(1))
    if has_child:
        raise HTTPException(status_code=400, detail="请先删除子分类")
    has_product = await db.scalar(select(Product).where(Product.category_id == category_id).limit(1))
    if has_product:
        raise HTTPException(status_code=400, detail="该分类下存在商品，不可删除")
    await db.delete(category)
    await db.commit()
    return ok(None, "分类已删除")
