import uuid
from decimal import Decimal
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from sqlalchemy.orm import selectinload
from app.core.database import get_db
from app.models.stock import StockOperation, StockOperationLine, StockQuant, StockLedger
from app.models.warehouse import Location, Warehouse
from app.models.product import Product
from app.schemas.operation import (
    StockOperationCreate,
    StockOperationUpdate,
    StockOperationResponse,
    OperationLineResponse,
    ValidateOperationRequest,
    AdjustmentCreateRequest,
    TransferCreateRequest
)
from app.ledger.engine import LedgerEngine
from app.ledger.exceptions import InsufficientStockException, InvalidMovementException, UnauthorizedOverrideException
from app.api.deps import get_current_user

router = APIRouter(prefix="/operations", tags=["Stock Operations"])

async def _build_operation_response(op: StockOperation, db: AsyncSession) -> StockOperationResponse:
    lines_resp = []
    for line in op.lines:
        p = await db.get(Product, line.product_id)
        lines_resp.append(OperationLineResponse(
            id=line.id,
            operation_id=line.operation_id,
            product_id=line.product_id,
            product_name=p.name if p else None,
            product_sku=p.sku if p else None,
            uom=p.uom if p else None,
            quantity_demanded=line.quantity_demanded,
            quantity_done=line.quantity_done
        ))

    src_name = op.source_location.name if op.source_location else None
    dest_name = op.destination_location.name if op.destination_location else None
    creator_name = op.creator.name if op.creator else None

    return StockOperationResponse(
        id=op.id,
        reference=op.reference,
        operation_type=op.operation_type,
        source_location_id=op.source_location_id,
        source_location_name=src_name,
        destination_location_id=op.destination_location_id,
        destination_location_name=dest_name,
        contact_name=op.contact_name,
        reason_code=op.reason_code,
        status=op.status,
        scheduled_date=op.scheduled_date,
        created_by=op.created_by,
        creator_name=creator_name,
        created_at=op.created_at,
        lines=lines_resp
    )

async def _generate_reference(db: AsyncSession, op_type: str, owner_id: uuid.UUID, wh_code: str = "WH1") -> str:
    type_code = {
        "RECEIPT": "IN",
        "DELIVERY": "OUT",
        "INTERNAL": "INT",
        "ADJUSTMENT": "ADJ"
    }.get(op_type, "OP")

    count_res = await db.execute(
        select(func.count(StockOperation.id)).where(StockOperation.owner_id == owner_id, StockOperation.operation_type == op_type)
    )
    next_num = count_res.scalar_one() + 1
    return f"{wh_code}/{type_code}/{next_num:04d}"

@router.get("", response_model=List[StockOperationResponse])
async def list_operations(
    operation_type: Optional[str] = None,
    status: Optional[str] = None,
    warehouse_id: Optional[uuid.UUID] = None,
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    query = (
        select(StockOperation)
        .where(StockOperation.owner_id == current_user.inventory_owner_id)
        .options(
            selectinload(StockOperation.lines),
            selectinload(StockOperation.source_location),
            selectinload(StockOperation.destination_location),
            selectinload(StockOperation.creator)
        )
    )

    query = query.where(StockOperation.owner_id == current_user.inventory_owner_id)
    if operation_type:
        query = query.where(StockOperation.operation_type == operation_type.upper())
    if status:
        query = query.where(StockOperation.status == status.upper())
    if warehouse_id:
        # Match either source or destination location's warehouse
        query = query.join(
            Location,
            (StockOperation.source_location_id == Location.id) |
            (StockOperation.destination_location_id == Location.id)
        ).where(Location.warehouse_id == warehouse_id)

    if search:
        search_term = f"%{search.strip()}%"
        query = query.where(
            (StockOperation.reference.ilike(search_term)) |
            (StockOperation.contact_name.ilike(search_term))
        )

    res = await db.execute(query.order_by(StockOperation.created_at.desc()))
    operations = res.scalars().all()

    responses = []
    for op in operations:
        responses.append(await _build_operation_response(op, db))
    return responses

@router.post("", response_model=StockOperationResponse, status_code=status.HTTP_201_CREATED)
async def create_operation(
    op_in: StockOperationCreate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    ref = op_in.reference
    if not ref:
        ref = await _generate_reference(db, op_in.operation_type, current_user.inventory_owner_id)

    existing = await db.execute(select(StockOperation).where(StockOperation.owner_id == current_user.inventory_owner_id, StockOperation.reference == ref))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Operation with reference '{ref}' already exists."
        )

    if op_in.operation_type == "ADJUSTMENT" and not op_in.reason_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reason code is required for ADJUSTMENT operations (DAMAGED, MISCOUNT, THEFT, OTHER)."
        )

    location_ids = {value for value in (op_in.source_location_id, op_in.destination_location_id) if value}
    if location_ids:
        owned_locations = set((await db.scalars(
            select(Location.id).join(Warehouse).where(Location.id.in_(location_ids), Warehouse.owner_id == current_user.inventory_owner_id)
        )).all())
        if owned_locations != location_ids:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="One or more locations were not found in your workspace.")
    product_ids = {line.product_id for line in op_in.lines}
    owned_products = set((await db.scalars(select(Product.id).where(Product.id.in_(product_ids), Product.owner_id == current_user.inventory_owner_id))).all())
    if owned_products != product_ids:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="One or more products were not found in your workspace.")

    op = StockOperation(
        owner_id=current_user.inventory_owner_id,
        reference=ref,
        operation_type=op_in.operation_type,
        source_location_id=op_in.source_location_id,
        destination_location_id=op_in.destination_location_id,
        contact_name=op_in.contact_name,
        reason_code=op_in.reason_code,
        status="DRAFT",
        scheduled_date=op_in.scheduled_date,
        created_by=current_user.id
    )
    db.add(op)
    await db.flush()

    for line_in in op_in.lines:
        line = StockOperationLine(
            operation_id=op.id,
            product_id=line_in.product_id,
            quantity_demanded=line_in.quantity_demanded,
            quantity_done=Decimal("0.00")
        )
        db.add(line)

    await db.commit()
    await db.refresh(op)

    # Re-fetch with relationships
    res = await db.execute(
        select(StockOperation)
        .where(StockOperation.owner_id == current_user.inventory_owner_id)
        .options(
            selectinload(StockOperation.lines),
            selectinload(StockOperation.source_location),
            selectinload(StockOperation.destination_location),
            selectinload(StockOperation.creator)
        )
        .where(StockOperation.id == op.id, StockOperation.owner_id == current_user.inventory_owner_id)
    )
    return await _build_operation_response(res.scalar_one(), db)

@router.get("/{op_id}", response_model=StockOperationResponse)
async def get_operation(
    op_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    res = await db.execute(
        select(StockOperation)
        .where(StockOperation.owner_id == current_user.inventory_owner_id)
        .options(
            selectinload(StockOperation.lines),
            selectinload(StockOperation.source_location),
            selectinload(StockOperation.destination_location),
            selectinload(StockOperation.creator)
        )
        .where(StockOperation.id == op_id)
    )
    op = res.scalar_one_or_none()
    if not op:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Operation not found.")
    return await _build_operation_response(op, db)

@router.put("/{op_id}/advance-status", response_model=StockOperationResponse)
async def advance_status(
    op_id: uuid.UUID,
    target_status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Handles Delivery lifecycle: DRAFT -> WAITING -> READY.
    When moving to WAITING or READY, reserves stock.
    """
    res = await db.execute(
        select(StockOperation)
        .where(StockOperation.owner_id == current_user.inventory_owner_id)
        .options(
            selectinload(StockOperation.lines),
            selectinload(StockOperation.source_location),
            selectinload(StockOperation.destination_location),
            selectinload(StockOperation.creator)
        )
        .where(StockOperation.id == op_id)
    )
    op = res.scalar_one_or_none()
    if not op:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Operation not found.")

    target = target_status.upper() if target_status else {
        "DRAFT": "WAITING",
        "WAITING": "READY",
    }.get(op.status)
    if not target:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"No next status is available for an operation in {op.status}."
        )
    allowed_targets = {
        "DRAFT": {"WAITING", "READY", "CANCELED"},
        "WAITING": {"READY", "CANCELED"},
        "READY": {"CANCELED"},
        "DONE": set(),
        "CANCELED": set(),
    }
    if target not in allowed_targets.get(op.status, set()):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot move an operation from {op.status} to {target}."
        )
    if op.status == "DONE":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Operation is already completed.")

    if target == "WAITING" and op.status == "DRAFT":
        # Check stock and reserve
        if op.operation_type == "DELIVERY" and op.source_location_id:
            for line in op.lines:
                q_res = await db.execute(
                    select(StockQuant).where(
                        StockQuant.product_id == line.product_id,
                        StockQuant.location_id == op.source_location_id
                    ).with_for_update()
                )
                quant = q_res.scalar_one_or_none()
                available = (quant.on_hand - quant.reserved) if quant else Decimal("0.00")
                if available < line.quantity_demanded:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Insufficient available stock to reserve delivery. Available: {available}, Requested: {line.quantity_demanded}"
                    )
                if quant:
                    quant.reserved += line.quantity_demanded
                else:
                    quant = StockQuant(
                        product_id=line.product_id,
                        location_id=op.source_location_id,
                        on_hand=Decimal("0.00"),
                        reserved=line.quantity_demanded
                    )
                    db.add(quant)
        op.status = "WAITING"

    elif target == "READY" and op.status in ["DRAFT", "WAITING"]:
        # If transitioning straight from DRAFT to READY, reserve if not already
        if op.status == "DRAFT" and op.operation_type == "DELIVERY" and op.source_location_id:
            for line in op.lines:
                q_res = await db.execute(
                    select(StockQuant).where(
                        StockQuant.product_id == line.product_id,
                        StockQuant.location_id == op.source_location_id
                    ).with_for_update()
                )
                quant = q_res.scalar_one_or_none()
                available = (quant.on_hand - quant.reserved) if quant else Decimal("0.00")
                if available < line.quantity_demanded:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Insufficient available stock to reserve delivery. Available: {available}, Requested: {line.quantity_demanded}"
                    )
                if quant:
                    quant.reserved += line.quantity_demanded
                else:
                    quant = StockQuant(
                        product_id=line.product_id,
                        location_id=op.source_location_id,
                        on_hand=Decimal("0.00"),
                        reserved=line.quantity_demanded
                    )
                    db.add(quant)
        op.status = "READY"

    elif target == "CANCELED":
        # If stock was reserved for delivery, release reservation
        if op.status in ["WAITING", "READY"] and op.operation_type == "DELIVERY" and op.source_location_id:
            for line in op.lines:
                q_res = await db.execute(
                    select(StockQuant).where(
                        StockQuant.product_id == line.product_id,
                        StockQuant.location_id == op.source_location_id
                    )
                )
                quant = q_res.scalar_one_or_none()
                if quant:
                    quant.reserved = max(Decimal("0.00"), quant.reserved - line.quantity_demanded)
        op.status = "CANCELED"

    await db.commit()
    await db.refresh(op)
    return await _build_operation_response(op, db)

@router.post("/{op_id}/validate", response_model=StockOperationResponse)
async def validate_operation(
    op_id: uuid.UUID,
    val_in: ValidateOperationRequest = ValidateOperationRequest(),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Validates the operation and executes stock movements strictly via the Ledger Engine.
    """
    res = await db.execute(
        select(StockOperation)
        .where(StockOperation.owner_id == current_user.inventory_owner_id)
        .options(
            selectinload(StockOperation.lines),
            selectinload(StockOperation.source_location),
            selectinload(StockOperation.destination_location),
            selectinload(StockOperation.creator)
        )
        .where(StockOperation.id == op_id)
    )
    op = res.scalar_one_or_none()
    if not op:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Operation not found.")

    if op.status == "DONE":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Operation is already completed.")

    if op.status == "CANCELED":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot validate a canceled operation.")

    if not op.lines:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot validate an operation with no lines.")

    is_manager = (current_user.role == "INVENTORY_MANAGER")

    # Determine quantities to execute
    done_quantities = {}
    if val_in.lines:
        input_product_ids = [item.product_id for item in val_in.lines]
        if len(input_product_ids) != len(set(input_product_ids)):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Validation can include each product only once.")
        for item in val_in.lines:
            if item.product_id not in {line.product_id for line in op.lines}:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Validation includes a product that is not on this operation.")
            done_quantities[item.product_id] = item.quantity_done
    else:
        for line in op.lines:
            done_quantities[line.product_id] = line.quantity_demanded

    for line in op.lines:
        quantity_done = done_quantities.get(line.product_id, line.quantity_demanded)
        if quantity_done > line.quantity_demanded:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Quantity done cannot exceed quantity demanded.")
    if not any(quantity > Decimal("0.00") for quantity in done_quantities.values()):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="At least one operation line must have a positive completed quantity.")

    try:
        # If this is a DELIVERY and items were reserved, release reservations before executing movement
        if op.operation_type == "DELIVERY" and op.status in ["WAITING", "READY"] and op.source_location_id:
            for line in op.lines:
                q_res = await db.execute(
                    select(StockQuant).where(
                        StockQuant.product_id == line.product_id,
                        StockQuant.location_id == op.source_location_id
                    )
                )
                quant = q_res.scalar_one_or_none()
                if quant:
                    quant.reserved = max(Decimal("0.00"), quant.reserved - line.quantity_demanded)

        # Execute movements via LedgerEngine
        ledger_entries = []
        for line in op.lines:
            qty = done_quantities.get(line.product_id, line.quantity_demanded)
            if qty <= Decimal("0.00"):
                continue

            ledger_entry = await LedgerEngine.record_movement(
                db=db,
                product_id=line.product_id,
                from_location_id=op.source_location_id,
                to_location_id=op.destination_location_id,
                quantity=qty,
                operation_id=op.id,
                user_id=current_user.id,
                workspace_owner_id=current_user.inventory_owner_id,
                allow_negative_stock=val_in.allow_negative_stock,
                is_manager=is_manager,
                commit=False
            )
            ledger_entries.append(ledger_entry)

        op.status = "DONE"
        await db.commit()
        await db.refresh(op)
        for ledger_entry in ledger_entries:
            await LedgerEngine.broadcast_movement(db, ledger_entry)

    except InsufficientStockException as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except (InvalidMovementException, UnauthorizedOverrideException) as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to validate operation: {str(e)}"
        )

    return await _build_operation_response(op, db)

# ----------------- Quick Shortcuts: Adjustment & Transfer -----------------

@router.post("/adjustments/quick", response_model=StockOperationResponse, status_code=status.HTTP_201_CREATED)
async def create_quick_adjustment(
    adj_in: AdjustmentCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Submits a physical inventory count adjustment.
    Computes delta = counted - recorded.
    If delta > 0: LOSS_VIRTUAL -> location.
    If delta < 0: location -> LOSS_VIRTUAL.
    """
    loc = await db.scalar(select(Location).join(Warehouse).where(Location.id == adj_in.location_id, Warehouse.owner_id == current_user.inventory_owner_id))
    if not loc or loc.type != "INTERNAL":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Adjustment location must be an INTERNAL warehouse location.")

    product = await db.scalar(select(Product).where(Product.id == adj_in.product_id, Product.owner_id == current_user.inventory_owner_id))
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found.")

    # Find the warehouse's LOSS_VIRTUAL location
    loss_loc_res = await db.execute(
        select(Location).where(
            Location.warehouse_id == loc.warehouse_id,
            Location.type == "LOSS_VIRTUAL"
        )
    )
    loss_loc = loss_loc_res.scalar_one_or_none()
    if not loss_loc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Warehouse loss virtual location not found.")

    # Get current on_hand
    q_res = await db.execute(
        select(StockQuant).where(
            StockQuant.product_id == adj_in.product_id,
            StockQuant.location_id == adj_in.location_id
        )
    )
    quant = q_res.scalar_one_or_none()
    recorded_qty = quant.on_hand if quant else Decimal("0.00")
    delta = adj_in.counted_quantity - recorded_qty

    if delta == Decimal("0.00"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Counted quantity matches recorded balance. No adjustment needed.")

    ref = await _generate_reference(db, "ADJUSTMENT", current_user.inventory_owner_id)

    # If delta > 0 (gain): from loss_loc to loc
    # If delta < 0 (loss): from loc to loss_loc
    if delta > 0:
        source_loc_id = loss_loc.id
        dest_loc_id = loc.id
        qty_to_move = delta
    else:
        source_loc_id = loc.id
        dest_loc_id = loss_loc.id
        qty_to_move = abs(delta)

    op = StockOperation(
        owner_id=current_user.inventory_owner_id,
        reference=ref,
        operation_type="ADJUSTMENT",
        source_location_id=source_loc_id,
        destination_location_id=dest_loc_id,
        contact_name="Physical Count Adjustment",
        reason_code=adj_in.reason_code,
        status="DRAFT",
        created_by=current_user.id
    )
    db.add(op)
    await db.flush()

    line = StockOperationLine(
        operation_id=op.id,
        product_id=adj_in.product_id,
        quantity_demanded=qty_to_move,
        quantity_done=Decimal("0.00")
    )
    db.add(line)
    await db.flush()

    # Move stock atomically through LedgerEngine
    is_manager = (current_user.role == "INVENTORY_MANAGER")
    ledger_entry = await LedgerEngine.record_movement(
        db=db,
        product_id=adj_in.product_id,
        from_location_id=source_loc_id,
        to_location_id=dest_loc_id,
        quantity=qty_to_move,
        operation_id=op.id,
        user_id=current_user.id,
        workspace_owner_id=current_user.inventory_owner_id,
        allow_negative_stock=False,
        is_manager=is_manager,
        commit=False
    )

    op.status = "DONE"
    await db.commit()
    await db.refresh(op)
    await LedgerEngine.broadcast_movement(db, ledger_entry)

    res = await db.execute(
        select(StockOperation)
        .where(StockOperation.owner_id == current_user.inventory_owner_id)
        .options(
            selectinload(StockOperation.lines),
            selectinload(StockOperation.source_location),
            selectinload(StockOperation.destination_location),
            selectinload(StockOperation.creator)
        )
        .where(StockOperation.id == op.id, StockOperation.owner_id == current_user.inventory_owner_id)
    )
    return await _build_operation_response(res.scalar_one(), db)

@router.post("/transfers/quick", response_model=StockOperationResponse, status_code=status.HTTP_201_CREATED)
async def create_quick_transfer(
    trans_in: TransferCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Submits an internal warehouse transfer (Rack A -> Rack B).
    Total company stock remains unchanged.
    """
    if trans_in.from_location_id == trans_in.to_location_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Source and destination locations cannot be identical.")

    from_loc = await db.scalar(select(Location).join(Warehouse).where(Location.id == trans_in.from_location_id, Warehouse.owner_id == current_user.inventory_owner_id))
    to_loc = await db.scalar(select(Location).join(Warehouse).where(Location.id == trans_in.to_location_id, Warehouse.owner_id == current_user.inventory_owner_id))
    if not from_loc or not to_loc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="One or both locations not found.")

    product = await db.scalar(select(Product).where(Product.id == trans_in.product_id, Product.owner_id == current_user.inventory_owner_id))
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found.")

    ref = await _generate_reference(db, "INTERNAL", current_user.inventory_owner_id)
    op = StockOperation(
        owner_id=current_user.inventory_owner_id,
        reference=ref,
        operation_type="INTERNAL",
        source_location_id=trans_in.from_location_id,
        destination_location_id=trans_in.to_location_id,
        contact_name="Internal Location Transfer",
        status="DRAFT",
        created_by=current_user.id
    )
    db.add(op)
    await db.flush()

    line = StockOperationLine(
        operation_id=op.id,
        product_id=trans_in.product_id,
        quantity_demanded=trans_in.quantity,
        quantity_done=Decimal("0.00")
    )
    db.add(line)
    await db.flush()

    # Move stock atomically through LedgerEngine
    is_manager = (current_user.role == "INVENTORY_MANAGER")
    ledger_entry = await LedgerEngine.record_movement(
        db=db,
        product_id=trans_in.product_id,
        from_location_id=trans_in.from_location_id,
        to_location_id=trans_in.to_location_id,
        quantity=trans_in.quantity,
        operation_id=op.id,
        user_id=current_user.id,
        workspace_owner_id=current_user.inventory_owner_id,
        allow_negative_stock=False,
        is_manager=is_manager,
        commit=False
    )

    op.status = "DONE"
    await db.commit()
    await db.refresh(op)
    await LedgerEngine.broadcast_movement(db, ledger_entry)

    res = await db.execute(
        select(StockOperation)
        .where(StockOperation.owner_id == current_user.inventory_owner_id)
        .options(
            selectinload(StockOperation.lines),
            selectinload(StockOperation.source_location),
            selectinload(StockOperation.destination_location),
            selectinload(StockOperation.creator)
        )
        .where(StockOperation.id == op.id, StockOperation.owner_id == current_user.inventory_owner_id)
    )
    return await _build_operation_response(res.scalar_one(), db)
