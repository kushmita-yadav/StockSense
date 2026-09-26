import asyncio
from typing import List
import uuid
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy import select
from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.core.security import decode_access_token
from app.models.user import User

router = APIRouter(tags=["WebSocket Alerts"])

class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[uuid.UUID, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, owner_id: uuid.UUID):
        await websocket.accept()
        self.active_connections.setdefault(owner_id, []).append(websocket)

    def disconnect(self, websocket: WebSocket, owner_id: uuid.UUID):
        connections = self.active_connections.get(owner_id, [])
        if websocket in connections:
            connections.remove(websocket)
        if not connections:
            self.active_connections.pop(owner_id, None)

    async def broadcast(self, message: dict):
        owner_id = uuid.UUID(message["owner_id"]) if message.get("owner_id") else None
        if owner_id is None:
            return
        for connection in list(self.active_connections.get(owner_id, [])):
            try:
                await connection.send_json(message)
            except Exception:
                self.disconnect(connection, owner_id)

ws_manager = ConnectionManager()

@router.websocket("/ws/alerts")
async def websocket_alerts_endpoint(websocket: WebSocket):
    token = websocket.cookies.get(settings.COOKIE_NAME)
    payload = decode_access_token(token) if token else None
    try:
        user_id = uuid.UUID(payload.get("sub", "")) if payload else None
    except (ValueError, AttributeError):
        user_id = None

    if user_id is None:
        await websocket.close(code=4401, reason="Authentication required")
        return

    async with AsyncSessionLocal() as db:
        user = await db.scalar(select(User).where(User.id == user_id, User.is_active.is_(True)))
    if user is None:
        await websocket.close(code=4401, reason="Authentication required")
        return

    await ws_manager.connect(websocket, user.inventory_owner_id)
    try:
        # Send initial connection acknowledgment
        await websocket.send_json({"type": "CONNECTED", "message": "Connected to StockSense live event stream."})
        while True:
            # Keep connection open and receive optional client pings
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, user.inventory_owner_id)
    except Exception:
        ws_manager.disconnect(websocket, user.inventory_owner_id)
