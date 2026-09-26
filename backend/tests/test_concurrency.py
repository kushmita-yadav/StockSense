import pytest
import asyncio
from decimal import Decimal
from sqlalchemy import select
from app.ledger.engine import LedgerEngine
from app.ledger.exceptions import InsufficientStockException
from app.models.stock import StockQuant, StockOperation
from tests.conftest import TestSessionLocal

@pytest.mark.asyncio
async def test_simultaneous_deliveries_concurrency_lock(test_db, seed_data):
    """
    Concurrency test:
    Initial stock: 10 units.
    Two simultaneous deliveries request 7 units each (total 14).
    The lock MUST serialize transactions and prevent overselling.
    Exactly one delivery must succeed, and one must fail with InsufficientStockException.
    Final balance must be exactly 3 units, never negative.
    """
    manager = seed_data["manager"]
    staff = seed_data["staff"]
    prod = seed_data["product"]
    loc_vendor = seed_data["loc_vendor"]
    loc_stock = seed_data["loc_stock"]
    loc_customer = seed_data["loc_customer"]

    # 1. Seed initial stock of exactly 10 units
    op_init = StockOperation(
        reference="WH1/IN/CONCURRENCY-INIT",
        operation_type="RECEIPT",
        source_location_id=loc_vendor.id,
        destination_location_id=loc_stock.id,
        status="DONE",
        created_by=manager.id
    )
    test_db.add(op_init)
    await test_db.flush()

    await LedgerEngine.record_movement(
        db=test_db,
        product_id=prod.id,
        from_location_id=loc_vendor.id,
        to_location_id=loc_stock.id,
        quantity=Decimal("10.00"),
        operation_id=op_init.id,
        user_id=manager.id,
        is_manager=True
    )

    # Verify initial stock is 10.00
    q = (await test_db.execute(
        select(StockQuant).where(StockQuant.product_id == prod.id, StockQuant.location_id == loc_stock.id)
    )).scalar_one()
    assert q.on_hand == Decimal("10.00")

    # Create operations for both deliveries
    op1 = StockOperation(
        reference="WH1/OUT/CONCUR-01",
        operation_type="DELIVERY",
        source_location_id=loc_stock.id,
        destination_location_id=loc_customer.id,
        status="READY",
        created_by=staff.id
    )
    op2 = StockOperation(
        reference="WH1/OUT/CONCUR-02",
        operation_type="DELIVERY",
        source_location_id=loc_stock.id,
        destination_location_id=loc_customer.id,
        status="READY",
        created_by=staff.id
    )
    test_db.add_all([op1, op2])
    await test_db.commit()

    async def run_delivery(op_id):
        # Use separate DB session per concurrent coroutine to simulate separate requests
        async with TestSessionLocal() as session:
            try:
                await LedgerEngine.record_movement(
                    db=session,
                    product_id=prod.id,
                    from_location_id=loc_stock.id,
                    to_location_id=loc_customer.id,
                    quantity=Decimal("7.00"),
                    operation_id=op_id,
                    user_id=staff.id,
                    allow_negative_stock=False,
                    is_manager=False
                )
                return "SUCCESS"
            except InsufficientStockException:
                return "INSUFFICIENT_STOCK"

    # Run both simultaneously
    results = await asyncio.gather(
        run_delivery(op1.id),
        run_delivery(op2.id)
    )

    # Exactly one succeeded and one was prevented from over-selling
    assert results.count("SUCCESS") == 1
    assert results.count("INSUFFICIENT_STOCK") == 1

    # Final on_hand balance must be exactly 3.00 (10 - 7)
    async with TestSessionLocal() as final_session:
        final_q = (await final_session.execute(
            select(StockQuant).where(StockQuant.product_id == prod.id, StockQuant.location_id == loc_stock.id)
        )).scalar_one()
        assert final_q.on_hand == Decimal("3.00")
