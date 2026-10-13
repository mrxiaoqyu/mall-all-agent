"""后端接口冒烟测试"""
import asyncio

import httpx

BASE = "http://127.0.0.1:8000/api/v1"


async def main():
    async with httpx.AsyncClient(base_url=BASE, timeout=15) as c:
        # health
        r = await c.get("/health")
        print("health:", r.status_code, r.json()["message"])

        # 用户登录
        r = await c.post("/auth/login", json={"username": "user1", "password": "123456"})
        assert r.status_code == 200, r.text
        token = r.json()["data"]["token"]
        uh = {"Authorization": f"Bearer {token}"}
        print("user login OK")

        # 商品列表
        r = await c.get("/products", params={"page": 1, "page_size": 5})
        data = r.json()["data"]
        print("products:", data["total"], "items")
        pid = data["list"][0]["id"]

        # 商品详情
        r = await c.get(f"/products/{pid}")
        detail = r.json()["data"]
        sku = detail["skus"][0]
        print("product detail OK, sku:", sku["spec_name"], "stock:", sku["stock"])

        # 加购
        r = await c.post("/cart", json={"sku_id": sku["id"], "quantity": 1}, headers=uh)
        print("cart add:", r.json()["message"])

        # 地址
        r = await c.post("/addresses", json={
            "receiver": "张三", "phone": "13800000000", "province": "浙江省",
            "city": "杭州市", "district": "西湖区", "detail": "文三路100号", "is_default": True,
        }, headers=uh)
        addr_id = r.json()["data"]["id"]
        print("address OK:", addr_id)

        # 领券
        r = await c.get("/coupons")
        coupons = r.json()["data"]
        if coupons:
            r = await c.post(f"/coupons/{coupons[0]['id']}/receive", headers=uh)
            print("coupon receive:", r.json()["message"])

        # 下单（用购物车）
        r = await c.post("/orders", json={"address_id": addr_id, "items": [], "use_cart": True}, headers=uh)
        assert r.status_code == 200, r.text
        order_data = r.json()["data"]
        print("order created, batch:", order_data["batch_no"], "orders:", len(order_data["order_ids"]), "pay:", order_data["pay_amount"])

        # 模拟支付
        r = await c.post("/orders/pay_batch", json={"batch_no": order_data["batch_no"]}, headers=uh)
        print("pay:", r.json()["message"])

        # 订单列表
        r = await c.get("/orders", headers=uh)
        print("orders:", r.json()["data"]["total"], "status:", r.json()["data"]["list"][0]["status"])

        # 商家登录 + 发货
        r = await c.post("/merchant/auth/login", json={"username": "merchant1", "password": "123456"})
        mtoken = r.json()["data"]["token"]
        mh = {"Authorization": f"Bearer {mtoken}"}
        print("merchant login OK")
        r = await c.get("/merchant/orders", headers=mh)
        morders = r.json()["data"]
        print("merchant orders:", morders["total"])
        if morders["total"]:
            oid = morders["list"][0]["id"]
            r = await c.post(f"/merchant/orders/{oid}/ship", headers=mh)
            print("ship:", r.json()["message"])

        # 管理员登录 + 看板
        r = await c.post("/admin/auth/login", json={"username": "admin", "password": "admin123"})
        atoken = r.json()["data"]["token"]
        ah = {"Authorization": f"Bearer {atoken}"}
        print("admin login OK")
        r = await c.get("/admin/dashboard", headers=ah)
        d = r.json()["data"]
        print("dashboard: sales=", d["total_sales"], "orders=", d["total_orders"], "shops=", d["total_shops"])

        # 客服会话
        r = await c.post("/cs/sessions", json={"target_type": "platform"}, headers=uh)
        print("cs session:", r.json()["data"])
        r = await c.post("/cs/sessions", json={"target_type": "shop", "shop_id": 1}, headers=uh)
        print("cs shop session:", r.json()["data"])

        print("\n=== 全部冒烟测试通过 ===")


asyncio.run(main())
