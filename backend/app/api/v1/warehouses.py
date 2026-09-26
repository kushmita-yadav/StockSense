import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.core.database import get_db
from app.models.warehouse import Warehouse, Location
from app.schemas.warehouse import (
    WarehouseCreate,
    WarehouseResponse,
    LocationCreate,
    LocationResponse
)
from app.api.deps import get_current_user, require_role

router = APIRouter(prefix="/warehouses", tags=["Warehouses & Locations"])

@router.get("", response_model=List[WarehouseResponse])
async def list_warehouses(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    stmt = select(Warehouse).options(selectinload(Warehouse.locations)).where(Warehouse.owner_id == current_user.inventory_owner_id).order_by(Warehouse.code.asc())
    res = await db.execute(stmt)
    return res.scalars().all()

@router.post("", response_model=WarehouseResponse, status_code=status.HTTP_201_CREATED)
async def create_warehouse(
    wh_in: WarehouseCreate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_role(["INVENTORY_MANAGER"]))
):
    existing = await db.execute(select(Warehouse).where(Warehouse.owner_id == current_user.inventory_owner_id, Warehouse.code == wh_in.code.upper().strip()))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Warehouse with code '{wh_in.code}' already exists."
        )

    wh = Warehouse(
        owner_id=current_user.inventory_owner_id,
        code=wh_in.code.upper().strip(),
        name=wh_in.name.strip(),
        address=wh_in.address.strip() if wh_in.address else None
    )
    db.add(wh)
    await db.flush()

    # Automatically provision default internal stock location and virtual locations for this warehouse
    default_internal = Location(
        warehouse_id=wh.id,
        name="Stock",
        type="INTERNAL"
    )
    vendor_virt = Location(
        warehouse_id=wh.id,
        name="Vendors",
        type="VENDOR_VIRTUAL"
    )
    cust_virt = Location(
        warehouse_id=wh.id,
        name="Customers",
        type="CUSTOMER_VIRTUAL"
    )
    loss_virt = Location(
        warehouse_id=wh.id,
        name="Inventory Loss",
        type="LOSS_VIRTUAL"
    )
    db.add_all([default_internal, vendor_virt, cust_virt, loss_virt])
    await db.commit()
    await db.refresh(wh)

    # Re-fetch with locations
    res = await db.execute(
        select(Warehouse).options(selectinload(Warehouse.locations)).where(Warehouse.id == wh.id)
    )
    return res.scalar_one()

@router.get("/locations", response_model=List[LocationResponse])
async def list_locations(
    warehouse_id: uuid.UUID | None = None,
    location_type: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    query = select(Location).join(Warehouse, Location.warehouse_id == Warehouse.id).where(Warehouse.owner_id == current_user.inventory_owner_id)
    if warehouse_id:
        query = query.where(Location.warehouse_id == warehouse_id)
    if location_type:
        query = query.where(Location.type == location_type.upper())
    res = await db.execute(query.order_by(Location.name.asc()))
    return res.scalars().all()

@router.post("/locations", response_model=LocationResponse, status_code=status.HTTP_201_CREATED)
async def create_location(
    loc_in: LocationCreate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_role(["INVENTORY_MANAGER"]))
):
    wh = await db.scalar(select(Warehouse).where(Warehouse.id == loc_in.warehouse_id, Warehouse.owner_id == current_user.inventory_owner_id))
    if not wh:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Warehouse with ID {loc_in.warehouse_id} not found."
        )

    loc = Location(
        warehouse_id=loc_in.warehouse_id,
        name=loc_in.name.strip(),
        type=loc_in.type
    )
    db.add(loc)
    await db.commit()
    await db.refresh(loc)
    return loc
