import uuid
from decimal import Decimal
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict

class CategoryBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)

class CategoryCreate(CategoryBase):
    pass

class CategoryResponse(CategoryBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID

class ProductBase(BaseModel):
    sku: str = Field(..., min_length=1, max_length=50)
    name: str = Field(..., min_length=1, max_length=200)
    category_id: Optional[uuid.UUID] = None
    uom: str = Field(default="units", min_length=1, max_length=20)
    min_stock_level: Decimal = Field(default=Decimal("0.00"), ge=Decimal("0.00"))
    max_stock_level: Optional[Decimal] = Field(default=None, ge=Decimal("0.00"))

class ProductCreate(ProductBase):
    pass

class ProductUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    category_id: Optional[uuid.UUID] = None
    uom: Optional[str] = Field(default=None, min_length=1, max_length=20)
    min_stock_level: Optional[Decimal] = Field(default=None, ge=Decimal("0.00"))
    max_stock_level: Optional[Decimal] = Field(default=None, ge=Decimal("0.00"))

class StockPerLocationResponse(BaseModel):
    location_id: uuid.UUID
    location_name: str
    warehouse_name: str
    on_hand: Decimal
    reserved: Decimal
    available: Decimal

class ProductResponse(ProductBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    created_at: datetime
    category_name: Optional[str] = None
    total_on_hand: Decimal = Decimal("0.00")
    total_reserved: Decimal = Decimal("0.00")
    total_available: Decimal = Decimal("0.00")
    stock_by_location: List[StockPerLocationResponse] = []
