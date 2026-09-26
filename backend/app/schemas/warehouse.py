import uuid
from typing import Literal, Optional, List
from pydantic import BaseModel, Field, ConfigDict

class LocationBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    type: Literal["INTERNAL", "VENDOR_VIRTUAL", "CUSTOMER_VIRTUAL", "LOSS_VIRTUAL"]

class LocationCreate(LocationBase):
    warehouse_id: uuid.UUID

class LocationResponse(LocationBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    warehouse_id: uuid.UUID

class WarehouseBase(BaseModel):
    code: str = Field(..., min_length=1, max_length=20)
    name: str = Field(..., min_length=1, max_length=100)
    address: Optional[str] = None

class WarehouseCreate(WarehouseBase):
    pass

class WarehouseResponse(WarehouseBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    locations: List[LocationResponse] = []
