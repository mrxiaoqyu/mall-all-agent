import random
import uuid
from datetime import datetime

from fastapi import HTTPException
from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.address import Address
from app.models.cart import CartItem
from app.models.coupon import Coupon, UserCoupon
from app.models.order import Order, OrderItem
from app.models.product import Product, ProductSku
from app.models.shop import Shop
from app.schemas.order import CheckoutItemIn


def gen_batch_no() -> str:
    return "B" + datetime.now().strftime("%Y%m%d%H%M%S") + f"{random.randint(1000, 9999)}"


def gen_order_no() -> str:
    return datetime.now().strftime("%Y%m%d%H%M%S") + uuid.uuid4().hex[:8].upper()


async def _deduct_stock(db: AsyncSession, sku_id: int, quantity: int):
    """条件更新防超卖，失败抛错"""
    result = await db.execute(
        update(ProductSku)
        .where(ProductSku.id == sku_id, ProductSku.stock >= quantity)
        .values(stock=ProductSku.stock - quantity)
    )
    if result.rowcount == 0:
        raise HTTPException(status_code=400, detail="部分商品库存不足，请调整数量")


async def _restore_stock(db: AsyncSession, order: Order):
    for item in order.items:
        await db.execute(
            update(ProductSku).where(ProductSku.id == item.sku_id).values(stock=ProductSku.stock + item.quantity)
        )


async def _restore_coupon(db: AsyncSession, order: Order):
    if order.coupon_id is None:
        return
    uc = await db.scalar(
        select(UserCoupon).where(
            UserCoupon.user_id == order.user_id,
            UserCoupon.coupon_id == order.coupon_id,
            UserCoupon.used_order_id == order.id,
        )
    )
    if uc:
        uc.status = "unused"
        uc.used_order_id = None


async def create_orders(
    db: AsyncSession,
    user_id: int,
    address_id: int,
    items_in: list[CheckoutItemIn],
    use_cart: bool,
    user_coupon_id: int | None,
) -> dict:
    address = await db.get(Address, address_id)
    if address is None or address.user_id != user_id:
        raise HTTPException(status_code=400, detail="收货地址无效")

    # 1. 收集待下单 (sku, quantity, cart_item_id)
    pending: list[tuple[ProductSku, int, int | None]] = []
    if use_cart:
        cart_rows = (await db.scalars(select(CartItem).where(CartItem.user_id == user_id))).all()
        if not cart_rows:
            raise HTTPException(status_code=400, detail="购物车为空")
        for ci in cart_rows:
            sku = await db.get(ProductSku, ci.sku_id)
            if sku:
                pending.append((sku, ci.quantity, ci.id))
    else:
        if not items_in:
            raise HTTPException(status_code=400, detail="请选择商品")
        for it in items_in:
            sku = await db.get(ProductSku, it.sku_id)
            if sku is None:
                raise HTTPException(status_code=400, detail="商品规格不存在")
            pending.append((sku, it.quantity, None))

    # 2. 校验商品/店铺并按店铺分组
    groups: dict[int, dict] = {}
    for sku, qty, cart_id in pending:
        product = await db.get(Product, sku.product_id)
        if product is None or product.status != "on":
            raise HTTPException(status_code=400, detail=f"商品已下架")
        shop = await db.get(Shop, product.shop_id)
        if shop is None or shop.status != "approved":
            raise HTTPException(status_code=400, detail=f"店铺不可用")
        group = groups.setdefault(shop.id, {"shop": shop, "lines": []})
        group["lines"].append({"sku": sku, "product": product, "qty": qty, "cart_id": cart_id})

    # 3. 校验优惠券
    user_coupon: UserCoupon | None = None
    coupon: Coupon | None = None
    if user_coupon_id:
        user_coupon = await db.get(UserCoupon, user_coupon_id)
        if user_coupon is None or user_coupon.user_id != user_id or user_coupon.status != "unused":
            raise HTTPException(status_code=400, detail="优惠券不可用")
        coupon = await db.get(Coupon, user_coupon.coupon_id)
        now = datetime.now()
        if coupon is None or coupon.status != "on" or coupon.start_at > now or coupon.end_at < now:
            raise HTTPException(status_code=400, detail="优惠券已失效")

    # 4. 计算各店金额，优惠券抵扣应付最高的订单
    shop_totals = {
        sid: sum(float(line["sku"].price) * line["qty"] for line in g["lines"])
        for sid, g in groups.items()
    }
    coupon_shop_id: int | None = None
    if coupon:
        eligible = {sid: t for sid, t in shop_totals.items() if t >= float(coupon.threshold_amount)}
        if not eligible:
            raise HTTPException(status_code=400, detail="未达到优惠券使用门槛")
        coupon_shop_id = max(eligible, key=lambda sid: eligible[sid])

    # 5. 逐店：扣库存 + 建单
    batch_no = gen_batch_no()
    address_snapshot = {
        "receiver": address.receiver, "phone": address.phone,
        "province": address.province, "city": address.city,
        "district": address.district, "detail": address.detail,
    }
    orders: list[Order] = []
    for shop_id, group in groups.items():
        total = shop_totals[shop_id]
        discount = float(coupon.minus_amount) if shop_id == coupon_shop_id else 0.0
        discount = min(discount, total)
        order = Order(
            order_no=gen_order_no(), batch_no=batch_no, user_id=user_id, shop_id=shop_id,
            total_amount=total, discount_amount=discount, pay_amount=total - discount,
            status="pending_pay", address_snapshot=address_snapshot,
            coupon_id=coupon.id if shop_id == coupon_shop_id else None,
        )
        for line in group["lines"]:
            await _deduct_stock(db, line["sku"].id, line["qty"])
            order.items.append(
                OrderItem(
                    product_id=line["product"].id, sku_id=line["sku"].id,
                    title=line["product"].title, spec_name=line["sku"].spec_name,
                    price=float(line["sku"].price), quantity=line["qty"],
                    image=line["product"].main_image,
                )
            )
        db.add(order)
        orders.append(order)
        # 清除已下单购物车条目
        for line in group["lines"]:
            if line["cart_id"]:
                await db.execute(delete(CartItem).where(CartItem.id == line["cart_id"]))

    # 6. 核销优惠券
    if user_coupon and coupon and coupon_shop_id:
        target = next(o for o in orders if o.shop_id == coupon_shop_id)
        user_coupon.status = "used"
        user_coupon.used_order_id = target.id

    await db.commit()
    for o in orders:
        await db.refresh(o)
    return {
        "batch_no": batch_no,
        "order_ids": [o.id for o in orders],
        "order_nos": [o.order_no for o in orders],
        "pay_amount": float(sum(float(o.pay_amount) for o in orders)),
    }


async def pay_batch(db: AsyncSession, user_id: int, batch_no: str) -> int:
    orders = (await db.scalars(
        select(Order).options(selectinload(Order.items))
        .where(Order.batch_no == batch_no, Order.user_id == user_id)
    )).all()
    if not orders:
        raise HTTPException(status_code=404, detail="订单不存在")
    paid = 0
    for order in orders:
        if order.status != "pending_pay":
            continue
        order.status = "paid"
        paid += 1
        for item in order.items:
            await db.execute(
                update(Product).where(Product.id == item.product_id).values(sales=Product.sales + item.quantity)
            )
    await db.commit()
    return paid


async def cancel_order(db: AsyncSession, order: Order):
    if order.status != "pending_pay":
        raise HTTPException(status_code=400, detail="当前状态不可取消")
    order.status = "cancelled"
    await _restore_stock(db, order)
    await _restore_coupon(db, order)
    await db.commit()


async def confirm_order(db: AsyncSession, order: Order):
    if order.status != "shipped":
        raise HTTPException(status_code=400, detail="订单未发货")
    order.status = "completed"
    await db.commit()


async def request_refund(db: AsyncSession, order: Order):
    if order.status != "paid":
        raise HTTPException(status_code=400, detail="仅待发货订单可申请退款，已发货请联系客服")
    order.status = "refunding"
    await db.commit()


async def audit_refund(db: AsyncSession, order: Order, approve: bool):
    if order.status != "refunding":
        raise HTTPException(status_code=400, detail="订单不在退款流程中")
    if approve:
        order.status = "refunded"
        await _restore_stock(db, order)
        await _restore_coupon(db, order)
    else:
        order.status = "paid"
    await db.commit()


def order_to_dict(order: Order, shop_name: str | None = None) -> dict:
    return {
        "id": order.id, "order_no": order.order_no, "batch_no": order.batch_no,
        "user_id": order.user_id, "shop_id": order.shop_id, "shop_name": shop_name,
        "total_amount": float(order.total_amount), "discount_amount": float(order.discount_amount),
        "pay_amount": float(order.pay_amount), "status": order.status,
        "address_snapshot": order.address_snapshot, "coupon_id": order.coupon_id,
        "created_at": order.created_at.isoformat() if order.created_at else None,
        "items": [
            {
                "id": i.id, "product_id": i.product_id, "sku_id": i.sku_id,
                "title": i.title, "spec_name": i.spec_name, "price": float(i.price),
                "quantity": i.quantity, "image": i.image,
            }
            for i in order.items
        ],
    }
