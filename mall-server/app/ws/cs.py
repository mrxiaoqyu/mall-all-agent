import json
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.core.security import decode_token
from app.db.session import async_session
from app.services import cs_service
from app.ws.manager import manager

logger = logging.getLogger(__name__)

router = APIRouter()


@router.websocket("/ws/cs")
async def cs_ws(websocket: WebSocket, token: str = ""):
    payload = decode_token(token)
    if payload is None:
        await websocket.close(code=4001)
        return
    role = payload.get("role", "")
    user_id = int(payload["sub"])
    shop_id = payload.get("shop_id")
    identity = f"{role}:{user_id}"

    await websocket.accept()
    manager.connect(identity, websocket)
    try:
        while True:
            raw = await websocket.receive_text()
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                continue
            if data.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
                continue

            session_id = data.get("session_id")
            content = (data.get("content") or "").strip()
            if not session_id or not content:
                continue

            async with async_session() as db:
                try:
                    session = await cs_service.get_session_or_404(db, int(session_id))
                    if role == "user":
                        await cs_service.check_user_participant(session, user_id)
                        sender_role = "user"
                    elif role in ("admin", "merchant"):
                        await cs_service.check_cs_participant(session, role, shop_id)
                        sender_role = "cs"
                    else:
                        continue
                    message = await cs_service.save_message(db, session, sender_role, user_id, content)
                    targets = await cs_service.recipient_identities(db, session, sender_role, user_id)
                except Exception as e:
                    logger.warning("ws message rejected: %s", e)
                    await websocket.send_json({"type": "error", "message": str(getattr(e, "detail", e))})
                    continue

            payload_out = {"type": "message", "data": cs_service.message_to_dict(message)}
            await manager.send_to_many(targets, payload_out)
    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(identity, websocket)
