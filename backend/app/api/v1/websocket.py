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
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in list(self.active_connections):
            try:
                await connection.send_json(message)
            except Exception:
                self.disconnect(connection)

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

    await ws_manager.connect(websocket)
    try:
        # Send initial connection acknowledgment
        await websocket.send_json({"type": "CONNECTED", "message": "Connected to StockSense live event stream."})
        while True:
            # Keep connection open and receive optional client pings
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception:
        ws_manager.disconnect(websocket)
