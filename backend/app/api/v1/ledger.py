import uuid
from decimal import Decimal
from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from sqlalchemy.orm import selectinload
from app.core.database import get_db
from app.models.stock import StockLedger, StockQuant, StockOperation
from app.models.product import Product
from app.models.warehouse import Location, Warehouse
from app.models.user import User
from app.schemas.ledger import StockLedgerResponse, PaginatedLedgerResponse, StockQuantResponse
from app.ledger.engine import LedgerEngine
from app.api.deps import get_current_user, require_role

router = APIRouter(prefix="/ledger", tags=["Stock Ledger & History"])

@router.get("", response_model=PaginatedLedgerResponse)
async def get_move_history(
    product_id: Optional[uuid.UUID] = None,
    operation_id: Optional[uuid.UUID] = None,
    location_id: Optional[uuid.UUID] = None,
    operation_type: Optional[str] = None,
    search: Optional[str] = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    query = (
        select(StockLedger)
        .options(
            selectinload(StockLedger.operation),
            selectinload(StockLedger.product),
            selectinload(StockLedger.from_location),
            selectinload(StockLedger.to_location),
            selectinload(StockLedger.user)
        )
    )

    query = query.join(StockOperation, StockLedger.operation_id == StockOperation.id).where(StockOperation.owner_id == current_user.inventory_owner_id)
    if product_id:
        query = query.where(StockLedger.product_id == product_id)
    if operation_id:
        query = query.where(StockLedger.operation_id == operation_id)
    if location_id:
        query = query.where(
            or_(
                StockLedger.from_location_id == location_id,
                StockLedger.to_location_id == location_id
            )
        )
    if operation_type:
        query = query.where(StockOperation.operation_type == operation_type.upper())
    if search:
        search_filter = f"%{search.strip()}%"
        query = query.join(Product, StockLedger.product_id == Product.id).where(
            or_(
                Product.name.ilike(search_filter),
                Product.sku.ilike(search_filter)
            )
        )

    # Total count
    count_stmt = select(func.count()).select_from(query.subquery())
    total_count = (await db.execute(count_stmt)).scalar_one()

    # Pagination
    offset = (page - 1) * page_size
    paged_query = query.order_by(StockLedger.timestamp.desc()).offset(offset).limit(page_size)
    res = await db.execute(paged_query)
    rows = res.scalars().all()

    entries = []
    for r in rows:
        entries.append(StockLedgerResponse(
            id=r.id,
            operation_id=r.operation_id,
            operation_reference=r.operation.reference if r.operation else None,
            operation_type=r.operation.operation_type if r.operation else None,
            product_id=r.product_id,
            product_name=r.product.name if r.product else None,
            product_sku=r.product.sku if r.product else None,
            uom=r.product.uom if r.product else None,
            from_location_id=r.from_location_id,
            from_location_name=r.from_location.name if r.from_location else "N/A",
            to_location_id=r.to_location_id,
            to_location_name=r.to_location.name if r.to_location else "N/A",
            quantity=r.quantity,
            user_id=r.user_id,
            user_name=r.user.name if r.user else None,
            timestamp=r.timestamp
        ))

    return PaginatedLedgerResponse(
        total=total_count,
        page=page,
        page_size=page_size,
        entries=entries
    )

@router.get("/quants", response_model=List[StockQuantResponse])
async def get_current_stock_quants(
    product_id: Optional[uuid.UUID] = None,
    warehouse_id: Optional[uuid.UUID] = None,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    stmt = (
        select(StockQuant, Product, Location, Warehouse)
        .join(Product, StockQuant.product_id == Product.id)
        .join(Location, StockQuant.location_id == Location.id)
        .join(Warehouse, Location.warehouse_id == Warehouse.id)
        .where(Location.type == "INTERNAL", Product.owner_id == current_user.inventory_owner_id, Warehouse.owner_id == current_user.inventory_owner_id)
    )
    if product_id:
        stmt = stmt.where(StockQuant.product_id == product_id)
    if warehouse_id:
        stmt = stmt.where(Location.warehouse_id == warehouse_id)

    res = await db.execute(stmt.order_by(Product.name.asc(), Location.name.asc()))
    records = res.all()

    output = []
    for quant, prod, loc, wh in records:
        output.append(StockQuantResponse(
            id=quant.id,
            product_id=prod.id,
            product_name=prod.name,
            product_sku=prod.sku,
            uom=prod.uom,
            location_id=loc.id,
            location_name=loc.name,
            warehouse_name=wh.name,
            on_hand=quant.on_hand,
            reserved=quant.reserved,
            available=quant.on_hand - quant.reserved
        ))
    return output

@router.post("/rebuild")
async def rebuild_ledger_quants(
    product_id: Optional[uuid.UUID] = None,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_role(["INVENTORY_MANAGER"]))
):
    """
    Manager endpoint to rebuild stock_quant materialized view directly from the append-only ledger history.
    """
    result = await LedgerEngine.rebuild_quants_from_ledger(db, product_id, current_user.inventory_owner_id)
    return result
