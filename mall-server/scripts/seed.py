"""初始化种子数据：管理员、演示商家/店铺、分类、商品、优惠券、轮播图、演示用户。

用法: python scripts/seed.py
"""
import asyncio
import sys
from datetime import datetime, timedelta
from pathlib import Path
from urllib.parse import quote

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select

from app.core.security import hash_password
from app.db.session import async_session
from app.models import (
    AdminUser, Banner, Category, Coupon, MerchantUser, Product, ProductSku, Shop, User,
)


def img(prompt: str, size: str = "square") -> str:
    return f"https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt={quote(prompt)}&image_size={size}"


async def seed():
    async with async_session() as db:
        # 幂等：已有管理员则跳过
        if await db.scalar(select(AdminUser).where(AdminUser.username == "admin")):
            print("种子数据已存在，跳过")
            return

        # ── 平台管理员 ──
        db.add(AdminUser(username="admin", password_hash=hash_password("admin123"), role="super"))

        # ── 演示用户 ──
        db.add(User(username="user1", password_hash=hash_password("123456"), nickname="演示用户"))

        # ── 分类 ──
        cat_digital = Category(name="数码电子", sort=1)
        cat_cloth = Category(name="服饰鞋包", sort=2)
        cat_home = Category(name="家居生活", sort=3)
        db.add_all([cat_digital, cat_cloth, cat_home])
        await db.flush()
        cat_phone = Category(name="手机", parent_id=cat_digital.id, sort=1)
        cat_laptop = Category(name="笔记本电脑", parent_id=cat_digital.id, sort=2)
        cat_headphone = Category(name="耳机", parent_id=cat_digital.id, sort=3)
        cat_men = Category(name="男装", parent_id=cat_cloth.id, sort=1)
        cat_women = Category(name="女装", parent_id=cat_cloth.id, sort=2)
        cat_kitchen = Category(name="厨房用品", parent_id=cat_home.id, sort=1)
        cat_bedding = Category(name="床上用品", parent_id=cat_home.id, sort=2)
        db.add_all([cat_phone, cat_laptop, cat_headphone, cat_men, cat_women, cat_kitchen, cat_bedding])
        await db.flush()

        # ── 店铺与商家 ──
        shop1 = Shop(name="数码优选旗舰店", logo=img("modern electronics store logo, minimal, blue"),
                     description="专注数码好物，正品保障", status="approved")
        shop2 = Shop(name="潮流服饰馆", logo=img("fashion clothing brand logo, minimal, orange"),
                     description="潮流穿搭，每日上新", status="approved")
        shop3 = Shop(name="品质家居馆", logo=img("home lifestyle store logo, minimal, green"),
                     description="品质家居，美好生活", status="approved")
        db.add_all([shop1, shop2, shop3])
        await db.flush()
        db.add_all([
            MerchantUser(username="merchant1", password_hash=hash_password("123456"), shop_id=shop1.id),
            MerchantUser(username="merchant2", password_hash=hash_password("123456"), shop_id=shop2.id),
            MerchantUser(username="merchant3", password_hash=hash_password("123456"), shop_id=shop3.id),
        ])

        # ── 商品（每店 2 个，各 2 个 SKU）──
        def product(shop_id, category_id, title, sub_title, prompt, skus):
            p = Product(
                shop_id=shop_id, category_id=category_id, title=title, sub_title=sub_title,
                main_image=img(f"{prompt}, product photography, white background"),
                images=[
                    img(f"{prompt}, product photography, white background"),
                    img(f"{prompt}, detail close-up, studio lighting"),
                ],
                detail=f"<p>{title} —— {sub_title}</p><p>品质保障，支持七天无理由退换。</p>",
                price=min(s[1] for s in skus), sales=0, status="on",
            )
            for name, price, stock in skus:
                p.skus.append(ProductSku(spec_name=name, price=price, stock=stock))
            return p

        db.add_all([
            product(shop1.id, cat_phone.id, "星云 X50 智能手机", "旗舰芯片 · 1亿像素", "sleek modern smartphone",
                    [("曜石黑/8+128G", 2999, 50), ("星空蓝/12+256G", 3499, 30)]),
            product(shop1.id, cat_headphone.id, "声阔 Pro 降噪耳机", "主动降噪 · 40小时续航", "premium wireless headphones",
                    [("经典黑", 899, 100), ("珍珠白", 899, 80)]),
            product(shop2.id, cat_men.id, "简约纯棉男士T恤", "新疆长绒棉 · 亲肤透气", "plain cotton men t-shirt",
                    [("白色/L", 129, 200), ("黑色/XL", 129, 150)]),
            product(shop2.id, cat_women.id, "法式复古连衣裙", "收腰显瘦 · 优雅气质", "elegant vintage women dress",
                    [("杏色/M", 269, 60), ("藏青/L", 269, 45)]),
            product(shop3.id, cat_kitchen.id, "不粘锅三件套", "麦饭石涂层 · 少油烟", "modern non-stick cookware set",
                    [("28cm煎锅", 199, 80), ("32cm炒锅", 259, 60)]),
            product(shop3.id, cat_bedding.id, "全棉四件套", "100支长绒棉 · 裸睡级亲肤", "luxury cotton bedding set",
                    [("1.5m床/浅灰", 399, 40), ("1.8m床/奶白", 459, 35)]),
        ])

        # ── 优惠券 ──
        now = datetime.now()
        db.add_all([
            Coupon(title="新人见面礼 满100减10", threshold_amount=100, minus_amount=10,
                   total_count=1000, start_at=now - timedelta(days=1), end_at=now + timedelta(days=90)),
            Coupon(title="品质生活 满300减50", threshold_amount=300, minus_amount=50,
                   total_count=500, start_at=now - timedelta(days=1), end_at=now + timedelta(days=90)),
        ])

        # ── 轮播图 ──
        db.add_all([
            Banner(title="数码狂欢节", image=img("electronics sale banner, vibrant, wide", "landscape_16_9"),
                   link_url="/products?keyword=手机", sort=1),
            Banner(title="夏日新装上市", image=img("summer fashion banner, fresh, wide", "landscape_16_9"),
                   link_url="/products?category=服饰", sort=2),
            Banner(title="品质家居节", image=img("cozy home interior banner, warm, wide", "landscape_16_9"),
                   link_url="/products", sort=3),
        ])

        await db.commit()
        print("种子数据初始化完成")
        print("  平台管理员: admin / admin123")
        print("  商家账号:   merchant1/merchant2/merchant3，密码 123456")
        print("  演示用户:   user1 / 123456")


if __name__ == "__main__":
    asyncio.run(seed())
