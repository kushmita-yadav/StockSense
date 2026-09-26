import asyncio
import uuid
from decimal import Decimal
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, func
from app.models.stock import StockQuant, StockLedger, StockOperation, StockOperationLine
from app.models.warehouse import Location, Warehouse
from app.models.product import Product
from app.models.user import User
from app.api.v1.websocket import ws_manager
from app.ledger.exceptions import (
    InsufficientStockException,
    InvalidMovementException,
    UnauthorizedOverrideException
)

# Concurrency lock registry for fine-grained per-product/location serialization in async runtime
_quant_locks: Dict[str, asyncio.Lock] = {}
_global_lock = asyncio.Lock()

def _get_lock_key(product_id: uuid.UUID, location_id: Optional[uuid.UUID]) -> str:
    return f"{product_id}:{location_id or 'none'}"

async def _acquire_locks(product_id: uuid.UUID, from_loc_id: Optional[uuid.UUID], to_loc_id: Optional[uuid.UUID]):
    keys = sorted(set(filter(None, [
        _get_lock_key(product_id, from_loc_id),
        _get_lock_key(product_id, to_loc_id)
    ])))
    async with _global_lock:
        locks = []
        for k in keys:
            if k not in _quant_locks:
                _quant_locks[k] = asyncio.Lock()
            locks.append(_quant_locks[k])

    # Acquire in deterministic sorted order to prevent deadlocks
    for lock in locks:
        await lock.acquire()
    return locks

def _release_locks(locks: List[asyncio.Lock]):
    for lock in reversed(locks):
        lock.release()

class LedgerEngine:
    """
    Authoritative, isolated Ledger Engine for StockSense.

    Every physical movement in the system MUST go through record_movement.
    Direct modification of stock_quant is prohibited.
    """

    @staticmethod
    async def record_movement(
        db: AsyncSession,
        *,
        product_id: uuid.UUID,
        from_location_id: Optional[uuid.UUID],
        to_location_id: Optional[uuid.UUID],
        quantity: Decimal,
        operation_id: uuid.UUID,
        user_id: uuid.UUID,
        workspace_owner_id: Optional[uuid.UUID] = None,
        allow_negative_stock: bool = False,
        is_manager: bool = False,
        commit: bool = True
    ) -> StockLedger:
        """
        Atomically records a stock movement, row-locks affected stock_quant rows,
        verifies available on-hand balance, writes the stock_ledger entry,
        and updates stock_quant as a materialized view.
        """
        # 1. Validation
        if quantity <= Decimal("0"):
            raise InvalidMovementException(f"Quantity must be strictly positive. Received: {quantity}")

        if from_location_id is not None and to_location_id is not None and from_location_id == to_location_id:
            raise InvalidMovementException("Source and destination locations cannot be identical.")

        if from_location_id is None and to_location_id is None:
            raise InvalidMovementException("Movement must specify at least a source or a destination location.")

        if allow_negative_stock and not is_manager:
            raise UnauthorizedOverrideException("Only users with INVENTORY_MANAGER role can allow negative stock overrides.")

        locks = await _acquire_locks(product_id, from_location_id, to_location_id)
        try:
            # Every movement must remain inside the authenticated user's workspace.
            if workspace_owner_id is None:
                actor = await db.get(User, user_id)
                workspace_owner_id = actor.inventory_owner_id if actor else user_id
            product = await db.scalar(select(Product).where(Product.id == product_id, Product.owner_id == workspace_owner_id))
            operation = await db.scalar(select(StockOperation).where(StockOperation.id == operation_id, StockOperation.owner_id == workspace_owner_id))
            if product is None or operation is None:
                raise InvalidMovementException("Product or operation was not found in this workspace.")

            # 2. Check Locations
            from_loc = None
            to_loc = None
            if from_location_id:
                from_loc = await db.get(Location, from_location_id)
                if not from_loc or await db.scalar(select(Location.id).join(Warehouse).where(Location.id == from_location_id, Warehouse.owner_id == workspace_owner_id)) is None:
                    raise InvalidMovementException(f"Source location {from_location_id} not found in this workspace.")

            if to_location_id:
                to_loc = await db.get(Location, to_location_id)
                if not to_loc or await db.scalar(select(Location.id).join(Warehouse).where(Location.id == to_location_id, Warehouse.owner_id == workspace_owner_id)) is None:
                    raise InvalidMovementException(f"Destination location {to_location_id} not found in this workspace.")

            # 3. Handle Deducting from Source (if INTERNAL location)
            if from_loc and from_loc.type == "INTERNAL":
                stmt = (
                    select(StockQuant)
                    .where(
                        StockQuant.product_id == product_id,
                        StockQuant.location_id == from_location_id
                    )
                    .with_for_update()
                )
                res = await db.execute(stmt)
                quant_from = res.scalar_one_or_none()

                current_on_hand = quant_from.on_hand if quant_from else Decimal("0.00")
                available_stock = current_on_hand - (quant_from.reserved if quant_from else Decimal("0.00"))

                if available_stock < quantity:
                    if not (allow_negative_stock and is_manager):
                        raise InsufficientStockException(
                            f"Insufficient stock for product at location '{from_loc.name}'. "
                            f"Available: {available_stock}, Requested: {quantity}",
                            product_id=product_id,
                            location_id=from_location_id,
                            available=available_stock,
                            requested=quantity
                        )

                if quant_from is None:
                    quant_from = StockQuant(
                        product_id=product_id,
                        location_id=from_location_id,
                        on_hand=Decimal("0.00") - quantity,
                        reserved=Decimal("0.00")
                    )
                    db.add(quant_from)
                else:
                    quant_from.on_hand = quant_from.on_hand - quantity

            # 4. Handle Adding to Destination (if INTERNAL location)
            if to_loc and to_loc.type == "INTERNAL":
                stmt = (
                    select(StockQuant)
                    .where(
                        StockQuant.product_id == product_id,
                        StockQuant.location_id == to_location_id
                    )
                    .with_for_update()
                )
                res = await db.execute(stmt)
                quant_to = res.scalar_one_or_none()

                if quant_to is None:
                    quant_to = StockQuant(
                        product_id=product_id,
                        location_id=to_location_id,
                        on_hand=quantity,
                        reserved=Decimal("0.00")
                    )
                    db.add(quant_to)
                else:
                    quant_to.on_hand = quant_to.on_hand + quantity

            # 5. Write to append-only StockLedger
            ledger_entry = StockLedger(
                operation_id=operation_id,
                product_id=product_id,
                from_location_id=from_location_id,
                to_location_id=to_location_id,
                quantity=quantity,
                user_id=user_id,
                timestamp=datetime.now(timezone.utc)
            )
            db.add(ledger_entry)

            # 6. Update quantity_done on stock_operation_line if present
            line_stmt = select(StockOperationLine).where(
                StockOperationLine.operation_id == operation_id,
                StockOperationLine.product_id == product_id
            )
            line_res = await db.execute(line_stmt)
            line = line_res.scalar_one_or_none()
            if line:
                line.quantity_done = (line.quantity_done or Decimal("0.00")) + quantity

            if commit:
                await db.commit()
                await db.refresh(ledger_entry)
                await LedgerEngine.broadcast_movement(db, ledger_entry)

            return ledger_entry

        finally:
            _release_locks(locks)

    @staticmethod
    async def broadcast_movement(db: AsyncSession, ledger_entry: StockLedger) -> None:
        operation = await db.get(StockOperation, ledger_entry.operation_id)
        await ws_manager.broadcast({
            "type": "STOCK_MOVEMENT",
            "owner_id": str(operation.owner_id) if operation and operation.owner_id else None,
            "operation_type": operation.operation_type if operation else None,
            "operation_id": str(ledger_entry.operation_id),
            "product_id": str(ledger_entry.product_id),
            "from_location_id": str(ledger_entry.from_location_id) if ledger_entry.from_location_id else None,
            "to_location_id": str(ledger_entry.to_location_id) if ledger_entry.to_location_id else None,
            "quantity": str(ledger_entry.quantity),
            "timestamp": ledger_entry.timestamp.isoformat(),
        })

    @staticmethod
    async def rebuild_quants_from_ledger(
        db: AsyncSession,
        product_id: Optional[uuid.UUID] = None,
        owner_id: Optional[uuid.UUID] = None
    ) -> Dict[str, Any]:
        """
        Recomputes all stock_quant rows from the append-only stock_ledger.
        Guarantees that stock_quant is strictly a derivable materialized view.
        """
        async with _global_lock:
            # Get internal locations
            loc_stmt = select(Location.id).join(Warehouse).where(Location.type == "INTERNAL")
            if owner_id:
                loc_stmt = loc_stmt.where(Warehouse.owner_id == owner_id)
            loc_res = await db.execute(loc_stmt)
            internal_loc_ids = set(loc_res.scalars().all())

            # Query ledger
            query = select(StockLedger)
            if product_id:
                query = query.where(StockLedger.product_id == product_id)
            if owner_id:
                query = query.join(StockOperation, StockLedger.operation_id == StockOperation.id).where(StockOperation.owner_id == owner_id)

            res = await db.execute(query.order_by(StockLedger.timestamp.asc()))
            ledger_entries = res.scalars().all()

            # Balances map: (product_id, location_id) -> Decimal
            balances: Dict[tuple, Decimal] = {}

            for entry in ledger_entries:
                pid = entry.product_id
                if entry.from_location_id and entry.from_location_id in internal_loc_ids:
                    key = (pid, entry.from_location_id)
                    balances[key] = balances.get(key, Decimal("0.00")) - entry.quantity
                if entry.to_location_id and entry.to_location_id in internal_loc_ids:
                    key = (pid, entry.to_location_id)
                    balances[key] = balances.get(key, Decimal("0.00")) + entry.quantity

            # Update or create stock_quant rows
            updated_count = 0
            for (pid, lid), computed_on_hand in balances.items():
                stmt = select(StockQuant).where(
                    StockQuant.product_id == pid,
                    StockQuant.location_id == lid
                )
                q_res = await db.execute(stmt)
                quant = q_res.scalar_one_or_none()
                if quant:
                    quant.on_hand = computed_on_hand
                else:
                    quant = StockQuant(
                        product_id=pid,
                        location_id=lid,
                        on_hand=computed_on_hand,
                        reserved=Decimal("0.00")
                    )
                    db.add(quant)
                updated_count += 1

            await db.commit()
            return {"status": "success", "quants_recalculated": updated_count}
