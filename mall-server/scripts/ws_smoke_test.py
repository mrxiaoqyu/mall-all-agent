"""WebSocket 客服冒烟测试：用户 -> 平台客服 -> 商家店铺客服"""
import asyncio
import json

import httpx
import websockets

BASE = "http://127.0.0.1:8000/api/v1"
WS = "ws://127.0.0.1:8000/ws/cs?token="


async def main():
    async with httpx.AsyncClient(base_url=BASE, timeout=15) as c:
        ut = (await c.post("/auth/login", json={"username": "user1", "password": "123456"})).json()["data"]["token"]
        at = (await c.post("/admin/auth/login", json={"username": "admin", "password": "admin123"})).json()["data"]["token"]
        mt = (await c.post("/merchant/auth/login", json={"username": "merchant1", "password": "123456"})).json()["data"]["token"]
        uh = {"Authorization": f"Bearer {ut}"}

        sid_platform = (await c.post("/cs/sessions", json={"target_type": "platform"}, headers=uh)).json()["data"]["id"]
        sid_shop = (await c.post("/cs/sessions", json={"target_type": "shop", "shop_id": 1}, headers=uh)).json()["data"]["id"]

    async with websockets.connect(WS + ut) as user_ws, \
               websockets.connect(WS + at) as admin_ws, \
               websockets.connect(WS + mt) as merchant_ws:

        async def recv_msg(ws, timeout=5):
            raw = await asyncio.wait_for(ws.recv(), timeout)
            data = json.loads(raw)
            assert data["type"] == "message", data
            return data["data"]

        async def recv_until(ws, content, sender_role=None, timeout=5):
            """接收消息直到匹配（跳过自身回显）"""
            while True:
                m = await recv_msg(ws, timeout)
                if m["content"] == content and (sender_role is None or m["sender_role"] == sender_role):
                    return m

        # 用户 -> 平台客服
        await user_ws.send(json.dumps({"session_id": sid_platform, "content": "你好，平台客服"}))
        m2 = await recv_until(admin_ws, "你好，平台客服")  # 管理员收到
        print("用户->平台客服 OK")

        # 平台客服 -> 用户
        await admin_ws.send(json.dumps({"session_id": sid_platform, "content": "您好，请问有什么可以帮您"}))
        m3 = await recv_until(user_ws, "您好，请问有什么可以帮您", sender_role="cs")
        print("平台客服->用户 OK")

        # 用户 -> 店铺客服
        await user_ws.send(json.dumps({"session_id": sid_shop, "content": "这款手机有现货吗"}))
        m4 = await recv_until(merchant_ws, "这款手机有现货吗")
        print("用户->店铺客服 OK")

        # 店铺客服 -> 用户
        await merchant_ws.send(json.dumps({"session_id": sid_shop, "content": "有的，今天下单明天发"}))
        m5 = await recv_until(user_ws, "有的，今天下单明天发", sender_role="cs")
        print("店铺客服->用户 OK")

        # 商家不应收到平台会话消息（隔离校验）
        await user_ws.send(json.dumps({"session_id": sid_platform, "content": "第二条平台消息"}))
        await recv_msg(admin_ws)
        try:
            await asyncio.wait_for(merchant_ws.recv(), 2)
            print("!! 隔离失败：商家收到平台会话消息")
        except asyncio.TimeoutError:
            print("会话隔离 OK（商家收不到平台会话）")

    # 历史消息持久化校验
    async with httpx.AsyncClient(base_url=BASE, timeout=15) as c:
        r = await c.get(f"/cs/sessions/{sid_platform}/messages", headers={"Authorization": f"Bearer {ut}"})
        msgs = r.json()["data"]["list"]
        print("平台会话历史消息数:", len(msgs))
        assert len(msgs) >= 3

    print("\n=== WebSocket 冒烟测试通过 ===")


asyncio.run(main())
