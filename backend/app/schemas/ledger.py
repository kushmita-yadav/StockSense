import uuid
from decimal import Decimal
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict

class StockLedgerResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    operation_id: uuid.UUID
    operation_reference: Optional[str] = None
    operation_type: Optional[str] = None
    product_id: uuid.UUID
    product_name: Optional[str] = None
    product_sku: Optional[str] = None
    uom: Optional[str] = None
    from_location_id: Optional[uuid.UUID] = None
    from_location_name: Optional[str] = None
    to_location_id: Optional[uuid.UUID] = None
    to_location_name: Optional[str] = None
    quantity: Decimal
    user_id: uuid.UUID
    user_name: Optional[str] = None
    timestamp: datetime

class PaginatedLedgerResponse(BaseModel):
    total: int
    page: int
    page_size: int
    entries: List[StockLedgerResponse]

class StockQuantResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    product_id: uuid.UUID
    product_name: str
    product_sku: str
    uom: str
    location_id: uuid.UUID
    location_name: str
    warehouse_name: str
    on_hand: Decimal
    reserved: Decimal
    available: Decimal
