from fastapi import APIRouter
from app.api.v1.auth import router as auth_router
from app.api.v1.warehouses import router as warehouses_router
from app.api.v1.products import router as products_router
from app.api.v1.operations import router as operations_router
from app.api.v1.ledger import router as ledger_router
from app.api.v1.dashboard import router as dashboard_router
from app.api.v1.assistant import router as assistant_router
from app.api.v1.websocket import router as ws_router

api_v1_router = APIRouter()
api_v1_router.include_router(auth_router)
api_v1_router.include_router(warehouses_router)
api_v1_router.include_router(products_router)
api_v1_router.include_router(operations_router)
api_v1_router.include_router(ledger_router)
api_v1_router.include_router(dashboard_router)
api_v1_router.include_router(assistant_router)
api_v1_router.include_router(ws_router)
