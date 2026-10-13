from collections import defaultdict

from fastapi import WebSocket


class ConnectionManager:
    """内存连接管理：identity -> websockets；session_id -> identity 集合由路由逻辑维护。

    identity 格式: "user:{id}" / "admin:{id}" / "merchant:{id}"
    """

    def __init__(self) -> None:
        self._conns: dict[str, set[WebSocket]] = defaultdict(set)

    def connect(self, identity: str, ws: WebSocket):
        self._conns[identity].add(ws)

    def disconnect(self, identity: str, ws: WebSocket):
        self._conns[identity].discard(ws)
        if not self._conns[identity]:
            self._conns.pop(identity, None)

    async def send_to(self, identity: str, message: dict):
        for ws in list(self._conns.get(identity, ())):
            try:
                await ws.send_json(message)
            except Exception:
                self.disconnect(identity, ws)

    async def send_to_many(self, identities: list[str], message: dict):
        for identity in identities:
            await self.send_to(identity, message)


manager = ConnectionManager()
