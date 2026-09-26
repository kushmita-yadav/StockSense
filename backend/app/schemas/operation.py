import uuid
from decimal import Decimal
from datetime import datetime
from typing import Optional, List, Literal
from pydantic import BaseModel, Field, ConfigDict, model_validator

class OperationLineCreate(BaseModel):
    product_id: uuid.UUID
    quantity_demanded: Decimal = Field(..., gt=Decimal("0.00"))

class OperationLineResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    operation_id: uuid.UUID
    product_id: uuid.UUID
    product_name: Optional[str] = None
    product_sku: Optional[str] = None
    uom: Optional[str] = None
    quantity_demanded: Decimal
    quantity_done: Decimal

class StockOperationCreate(BaseModel):
    reference: Optional[str] = None  # Auto-generated if omitted (e.g. WH1/IN/0001, WH1/OUT/0001)
    operation_type: Literal["RECEIPT", "DELIVERY", "INTERNAL", "ADJUSTMENT"]
    source_location_id: Optional[uuid.UUID] = None
    destination_location_id: Optional[uuid.UUID] = None
    contact_name: Optional[str] = None
    reason_code: Optional[Literal["DAMAGED", "MISCOUNT", "THEFT", "OTHER"]] = None
    scheduled_date: Optional[datetime] = None
    lines: List[OperationLineCreate] = Field(..., min_length=1)

    @model_validator(mode="after")
    def product_lines_must_be_unique(self):
        product_ids = [line.product_id for line in self.lines]
        if len(product_ids) != len(set(product_ids)):
            raise ValueError("An operation can contain each product only once.")
        return self

class StockOperationUpdate(BaseModel):
    contact_name: Optional[str] = None
    reason_code: Optional[Literal["DAMAGED", "MISCOUNT", "THEFT", "OTHER"]] = None
    scheduled_date: Optional[datetime] = None
    status: Optional[Literal["DRAFT", "WAITING", "READY", "DONE", "CANCELED"]] = None

class StockOperationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    reference: str
    operation_type: Literal["RECEIPT", "DELIVERY", "INTERNAL", "ADJUSTMENT"]
    source_location_id: Optional[uuid.UUID] = None
    source_location_name: Optional[str] = None
    destination_location_id: Optional[uuid.UUID] = None
    destination_location_name: Optional[str] = None
    contact_name: Optional[str] = None
    reason_code: Optional[str] = None
    status: Literal["DRAFT", "WAITING", "READY", "DONE", "CANCELED"]
    scheduled_date: Optional[datetime] = None
    created_by: uuid.UUID
    creator_name: Optional[str] = None
    created_at: datetime
    lines: List[OperationLineResponse] = []

class LineDoneInput(BaseModel):
    product_id: uuid.UUID
    quantity_done: Decimal = Field(..., ge=Decimal("0.00"))

class ValidateOperationRequest(BaseModel):
    lines: Optional[List[LineDoneInput]] = None
    allow_negative_stock: bool = False

class AdjustmentCreateRequest(BaseModel):
    product_id: uuid.UUID
    location_id: uuid.UUID
    counted_quantity: Decimal = Field(..., ge=Decimal("0.00"))
    reason_code: Literal["DAMAGED", "MISCOUNT", "THEFT", "OTHER"]

class TransferCreateRequest(BaseModel):
    product_id: uuid.UUID
    from_location_id: uuid.UUID
    to_location_id: uuid.UUID
    quantity: Decimal = Field(..., gt=Decimal("0.00"))
