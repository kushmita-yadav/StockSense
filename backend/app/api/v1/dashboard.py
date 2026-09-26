import uuid
from decimal import Decimal
from typing import Optional, List
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from sqlalchemy.orm import selectinload
from app.core.database import get_db
from app.models.stock import StockQuant, StockOperation, StockLedger
from app.models.product import Product, ProductCategory
from app.models.warehouse import Location, Warehouse
from app.schemas.dashboard import DashboardKPIsResponse, ReorderAlert
from app.schemas.ledger import StockLedgerResponse
from app.api.deps import get_current_user

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

@router.get("/kpis", response_model=DashboardKPIsResponse)
async def get_dashboard_kpis(
    warehouse_id: Optional[uuid.UUID] = None,
    category_id: Optional[uuid.UUID] = None,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    # 1. Base Product query
    prod_query = select(Product).where(Product.owner_id == current_user.inventory_owner_id)
    if category_id:
        prod_query = prod_query.where(Product.category_id == category_id)

    prod_res = await db.execute(prod_query)
    all_products = prod_res.scalars().all()
    total_products = len(all_products)

    # 2. Compute stock balances per product
    total_in_stock = 0
    low_stock_items = 0
    out_of_stock_items = 0
    reorder_alerts: List[ReorderAlert] = []

    for p in all_products:
        q_stmt = (
            select(func.coalesce(func.sum(StockQuant.on_hand), Decimal("0.00")))
            .join(Location, StockQuant.location_id == Location.id)
            .join(Warehouse, Location.warehouse_id == Warehouse.id)
            .where(
                StockQuant.product_id == p.id,
                Location.type == "INTERNAL", Warehouse.owner_id == current_user.inventory_owner_id
            )
        )
        if warehouse_id:
            q_stmt = q_stmt.where(Location.warehouse_id == warehouse_id)

        on_hand = (await db.execute(q_stmt)).scalar_one()

        if on_hand > Decimal("0.00"):
            total_in_stock += 1
            if on_hand <= p.min_stock_level:
                low_stock_items += 1
                suggested = (p.max_stock_level - on_hand) if p.max_stock_level else (p.min_stock_level - on_hand)
                reorder_alerts.append(ReorderAlert(
                    product_id=p.id,
                    sku=p.sku,
                    name=p.name,
                    uom=p.uom,
                    current_stock=on_hand,
                    min_stock_level=p.min_stock_level,
                    suggested_order_qty=max(Decimal("1.00"), suggested)
                ))
        else:
            out_of_stock_items += 1
            if p.min_stock_level > Decimal("0.00"):
                suggested = p.max_stock_level if p.max_stock_level else p.min_stock_level
                reorder_alerts.append(ReorderAlert(
                    product_id=p.id,
                    sku=p.sku,
                    name=p.name,
                    uom=p.uom,
                    current_stock=Decimal("0.00"),
                    min_stock_level=p.min_stock_level,
                    suggested_order_qty=suggested
                ))

    # 3. Operations counts
    # Receipts pending (DRAFT, WAITING, READY)
    rec_stmt = select(func.count(StockOperation.id)).where(
        StockOperation.owner_id == current_user.inventory_owner_id,
        StockOperation.operation_type == "RECEIPT",
        StockOperation.status.in_(["DRAFT", "WAITING", "READY"])
    )
    if warehouse_id:
        rec_stmt = rec_stmt.join(
            Location, StockOperation.destination_location_id == Location.id
        ).where(Location.warehouse_id == warehouse_id)
    pending_receipts = (await db.execute(rec_stmt)).scalar_one()

    # Deliveries pending (WAITING, READY)
    del_stmt = select(func.count(StockOperation.id)).where(
        StockOperation.owner_id == current_user.inventory_owner_id,
        StockOperation.operation_type == "DELIVERY",
        StockOperation.status.in_(["WAITING", "READY"])
    )
    if warehouse_id:
        del_stmt = del_stmt.join(
            Location, StockOperation.source_location_id == Location.id
        ).where(Location.warehouse_id == warehouse_id)
    pending_deliveries = (await db.execute(del_stmt)).scalar_one()

    # Transfers pending (DRAFT, WAITING, READY)
    trans_stmt = select(func.count(StockOperation.id)).where(
        StockOperation.owner_id == current_user.inventory_owner_id,
        StockOperation.operation_type == "INTERNAL",
        StockOperation.status.in_(["DRAFT", "WAITING", "READY"])
    )
    if warehouse_id:
        trans_stmt = trans_stmt.join(
            Location,
            (StockOperation.source_location_id == Location.id) |
            (StockOperation.destination_location_id == Location.id)
        ).where(Location.warehouse_id == warehouse_id)
    scheduled_transfers = (await db.execute(trans_stmt)).scalar_one()

    # 4. Recent activities (latest 8 ledger entries)
    act_stmt = (
        select(StockLedger)
        .join(StockOperation, StockLedger.operation_id == StockOperation.id)
        .where(StockOperation.owner_id == current_user.inventory_owner_id)
        .options(
            selectinload(StockLedger.operation),
            selectinload(StockLedger.product),
            selectinload(StockLedger.from_location),
            selectinload(StockLedger.to_location),
            selectinload(StockLedger.user)
        )
        .order_by(StockLedger.timestamp.desc())
        .limit(8)
    )
    act_res = await db.execute(act_stmt)
    activities_rows = act_res.scalars().all()

    activities = []
    for r in activities_rows:
        activities.append(StockLedgerResponse(
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

    return DashboardKPIsResponse(
        total_products=total_products,
        total_products_in_stock=total_in_stock,
        low_stock_items=low_stock_items,
        out_of_stock_items=out_of_stock_items,
        pending_receipts=pending_receipts,
        pending_deliveries=pending_deliveries,
        scheduled_transfers=scheduled_transfers,
        recent_activities=activities,
        reorder_alerts=reorder_alerts
    )
