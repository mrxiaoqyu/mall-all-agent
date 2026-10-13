"""Agent 工具集：白名单 7 个工具，user_id 一律从 state 注入（防越权）

工具返回约定（JSON 字符串，服务端解析后推送卡片事件）：
- 商品卡片: {"type": "product_cards", "items": [...]}
- 结果卡片: {"type": "result", "ok": bool, "message": str, "data": {...}}
- 订单列表: {"type": "orders", "items": [...]}（由 LLM 文本总结展示）
- 其他/错误: 纯文本
"""
import json
from typing import Annotated, Any

from fastapi import HTTPException
from langchain_core.tools import tool
from langgraph.prebuilt import InjectedState
from langgraph.types import interrupt
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.db.session import async_session
from app.models.address import Address
from app.models.order import Order
from app.models.product import Product, ProductSku
from app.models.shop import Shop
from app.schemas.order import CheckoutItemIn
from app.services import order_service

MAX_BUY_QUANTITY = 10
LIST_LIMIT = 6

ORDER_STATUS_CN = {
    "pending_pay": "待付款", "paid": "待发货", "shipped": "已发货",
    "completed": "已完成", "cancelled": "已取消", "refunding": "退款中", "refunded": "已退款",
}


def _product_card(p: Product, shop_name: str | None) -> dict:
    return {
        "product_id": p.id, "title": p.title, "price": float(p.price),
        "image": p.main_image, "shop_name": shop_name, "sales": p.sales,
    }


def _shop_scope(state: dict) -> int | None:
    """店铺会话强制限定本店商品"""
    return state.get("shop_id") if state.get("target_type") == "shop" else None


async def _shop_names(db, shop_ids: set[int]) -> dict[int, str]:
    if not shop_ids:
        return {}
    rows = (await db.execute(select(Shop.id, Shop.name).where(Shop.id.in_(shop_ids)))).all()
    return {r[0]: r[1] for r in rows}


@tool
async def search_products(
    keyword: str, max_price: float | None = None, state: Annotated[Any, InjectedState] = None
) -> str:
    """按关键词搜索在售商品，可指定价格上限。用于商品咨询/找商品。"""
    async with async_session() as db:
        query = select(Product).where(Product.status == "on")
        scope = _shop_scope(state)
        if scope:
            query = query.where(Product.shop_id == scope)
        kw = f"%{keyword.strip()}%"
        query = query.where((Product.title.like(kw)) | (Product.sub_title.like(kw)))
        if max_price is not None:
            query = query.where(Product.price <= max_price)
        products = (await db.scalars(query.order_by(Product.sales.desc()).limit(LIST_LIMIT))).all()
        names = await _shop_names(db, {p.shop_id for p in products})
    if not products:
        return "未找到相关商品，可换个关键词试试"
    return json.dumps(
        {"type": "product_cards", "items": [_product_card(p, names.get(p.shop_id)) for p in products]},
        ensure_ascii=False,
    )


@tool
async def recommend_products(scene: str | None = None, state: Annotated[Any, InjectedState] = None) -> str:
    """购物推荐：返回热销商品。scene 为用户需求描述（如"送人""家用"），仅作参考。"""
    async with async_session() as db:
        query = select(Product).where(Product.status == "on")
        scope = _shop_scope(state)
        if scope:
            query = query.where(Product.shop_id == scope)
        products = (await db.scalars(
            query.order_by(Product.sales.desc(), Product.created_at.desc()).limit(LIST_LIMIT)
        )).all()
        names = await _shop_names(db, {p.shop_id for p in products})
    if not products:
        return "暂时没有在架商品可推荐"
    return json.dumps(
        {"type": "product_cards", "items": [_product_card(p, names.get(p.shop_id)) for p in products]},
        ensure_ascii=False,
    )


@tool
async def get_product_detail(product_id: int, state: Annotated[Any, InjectedState] = None) -> str:
    """查询商品详情：价格、规格、库存、描述。"""
    async with async_session() as db:
        product = await db.get(Product, product_id)
        if product is None or product.status != "on":
            return "商品不存在或已下架"
        scope = _shop_scope(state)
        if scope and product.shop_id != scope:
            return "该商品不属于当前店铺"
        skus = (await db.scalars(select(ProductSku).where(ProductSku.product_id == product.id))).all()
        names = await _shop_names(db, {product.shop_id})
    item = _product_card(product, names.get(product.shop_id))
    return json.dumps({
        "type": "product_cards",
        "items": [item],
        "skus": [
            {"sku_id": s.id, "spec_name": s.spec_name, "price": float(s.price), "stock": s.stock}
            for s in skus
        ],
        "detail": (product.sub_title or "") + " " + (product.detail or ""),
    }, ensure_ascii=False)


@tool
async def query_my_orders(status: str | None = None, state: Annotated[Any, InjectedState] = None) -> str:
    """查询当前用户的订单列表，可按状态筛选（pending_pay/paid/shipped/completed/cancelled/refunding/refunded）。"""
    user_id = state["user_id"]
    async with async_session() as db:
        query = (
            select(Order).options(selectinload(Order.items))
            .where(Order.user_id == user_id).order_by(Order.id.desc()).limit(5)
        )
        if status:
            query = query.where(Order.status == status)
        orders = (await db.scalars(query)).all()
        names = await _shop_names(db, {o.shop_id for o in orders})
    if not orders:
        return "您暂无相关订单"
    items = [{
        "order_no": o.order_no, "status": o.status, "status_text": ORDER_STATUS_CN.get(o.status, o.status),
        "pay_amount": float(o.pay_amount), "shop_name": names.get(o.shop_id),
        "created_at": o.created_at.isoformat() if o.created_at else None,
        "items": [{"title": i.title, "quantity": i.quantity} for i in o.items],
    } for o in orders]
    return json.dumps({"type": "orders", "items": items}, ensure_ascii=False)


@tool
async def get_my_order_detail(order_no: str, state: Annotated[Any, InjectedState] = None) -> str:
    """按订单号查询当前用户的订单详情（含商品明细、收货地址、金额）。"""
    user_id = state["user_id"]
    async with async_session() as db:
        order = await db.scalar(
            select(Order).options(selectinload(Order.items))
            .where(Order.order_no == order_no, Order.user_id == user_id)
        )
        if order is None:
            return "未找到该订单（请确认订单号是否正确）"
        names = await _shop_names(db, {order.shop_id})
    detail = order_service.order_to_dict(order, names.get(order.shop_id))
    detail["status_text"] = ORDER_STATUS_CN.get(order.status, order.status)
    return json.dumps({"type": "order_detail", "item": detail}, ensure_ascii=False)


@tool
async def buy_product(
    sku_id: int, quantity: int = 1, address_id: int | None = None,
    state: Annotated[Any, InjectedState] = None,
) -> str:
    """购买商品：生成订单草稿并向用户发起二次确认，确认后下单（待付款状态）。
    用户未明确数量时默认 1 件；address_id 缺省时使用默认地址。"""
    user_id = state["user_id"]
    if quantity < 1 or quantity > MAX_BUY_QUANTITY:
        return f"购买数量需在 1~{MAX_BUY_QUANTITY} 之间"
    async with async_session() as db:
        sku = await db.get(ProductSku, sku_id)
        if sku is None:
            return "商品规格不存在"
        product = await db.get(Product, sku.product_id)
        if product is None or product.status != "on":
            return "商品已下架"
        scope = _shop_scope(state)
        if scope and product.shop_id != scope:
            return "该商品不属于当前店铺，无法购买"
        shop = await db.get(Shop, product.shop_id)
        if shop is None or shop.status != "approved":
            return "店铺不可用"
        if sku.stock < quantity:
            return f"库存不足，当前仅剩 {sku.stock} 件"
        if address_id:
            address = await db.get(Address, address_id)
            if address is None or address.user_id != user_id:
                return "收货地址无效"
        else:
            address = await db.scalar(
                select(Address).where(Address.user_id == user_id)
                .order_by(Address.is_default.desc(), Address.id.desc()).limit(1)
            )
        if address is None:
            return "您还没有收货地址，请先在个人中心添加地址后再购买"
        draft = {
            "sku_id": sku.id, "product_id": product.id, "title": product.title,
            "spec_name": sku.spec_name, "price": float(sku.price), "quantity": quantity,
            "total": round(float(sku.price) * quantity, 2), "image": product.main_image,
            "shop_name": shop.name, "address_id": address.id,
            "address_text": f"{address.receiver} {address.phone} {address.province}{address.city}{address.district}{address.detail}",
        }

    # 二次确认：interrupt 挂起，等待用户点击确认/取消（Command(resume=...)）
    decision = interrupt({"action": "buy", "draft": draft})
    if decision != "confirm":
        return json.dumps({"type": "result", "ok": False, "message": "已取消购买"}, ensure_ascii=False)

    async with async_session() as db:
        try:
            result = await order_service.create_orders(
                db, user_id, draft["address_id"],
                [CheckoutItemIn(sku_id=draft["sku_id"], quantity=draft["quantity"])],
                use_cart=False, user_coupon_id=None,
            )
        except HTTPException as e:
            return json.dumps({"type": "result", "ok": False, "message": f"下单失败：{e.detail}"}, ensure_ascii=False)
    return json.dumps({
        "type": "result", "ok": True,
        "message": f"下单成功，共需支付 ¥{result['pay_amount']:.2f}，请到「我的订单」完成支付",
        "data": result,
    }, ensure_ascii=False)


@tool
async def apply_after_sale(
    order_no: str, reason: str | None = None, state: Annotated[Any, InjectedState] = None
) -> str:
    """售后/退款申请：校验订单后向用户发起二次确认，确认后提交退款申请（仅待发货订单支持）。"""
    user_id = state["user_id"]
    async with async_session() as db:
        order = await db.scalar(
            select(Order).options(selectinload(Order.items))
            .where(Order.order_no == order_no, Order.user_id == user_id)
        )
        if order is None:
            return "未找到该订单（售后仅限本人订单）"
        if order.status != "paid":
            return f"该订单当前状态为「{ORDER_STATUS_CN.get(order.status, order.status)}」，仅待发货订单可申请退款，其他情况请联系人工客服"
        draft = {
            "order_no": order.order_no, "pay_amount": float(order.pay_amount),
            "reason": reason or "不想要了",
            "items": [{"title": i.title, "quantity": i.quantity} for i in order.items],
        }

    decision = interrupt({"action": "after_sale", "draft": draft})
    if decision != "confirm":
        return json.dumps({"type": "result", "ok": False, "message": "已取消售后申请"}, ensure_ascii=False)

    async with async_session() as db:
        order = await db.scalar(
            select(Order).where(Order.order_no == draft["order_no"], Order.user_id == user_id)
        )
        if order is None:
            return json.dumps({"type": "result", "ok": False, "message": "订单不存在"}, ensure_ascii=False)
        try:
            await order_service.request_refund(db, order)
        except HTTPException as e:
            return json.dumps({"type": "result", "ok": False, "message": f"申请失败：{e.detail}"}, ensure_ascii=False)
    return json.dumps({
        "type": "result", "ok": True,
        "message": f"退款申请已提交（订单 {draft['order_no']}），商家审核通过后原路退回",
        "data": {"order_no": draft["order_no"]},
    }, ensure_ascii=False)


TOOLS = [
    search_products, recommend_products, get_product_detail,
    query_my_orders, get_my_order_detail, buy_product, apply_after_sale,
]
