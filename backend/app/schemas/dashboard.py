import uuid
from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel
from app.schemas.ledger import StockLedgerResponse

class ReorderAlert(BaseModel):
    product_id: uuid.UUID
    sku: str
    name: str
    uom: str
    current_stock: Decimal
    min_stock_level: Decimal
    suggested_order_qty: Decimal

class DashboardKPIsResponse(BaseModel):
    total_products: int
    total_products_in_stock: int
    low_stock_items: int
    out_of_stock_items: int
    pending_receipts: int
    pending_deliveries: int
    scheduled_transfers: int
    recent_activities: List[StockLedgerResponse] = []
    reorder_alerts: List[ReorderAlert] = []
