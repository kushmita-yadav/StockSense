import pytest
from decimal import Decimal
import uuid
from sqlalchemy import select
from app.ledger.engine import LedgerEngine
from app.ledger.exceptions import (
    InsufficientStockException,
    InvalidMovementException,
    UnauthorizedOverrideException
)
from app.models.stock import StockQuant, StockLedger, StockOperation

@pytest.mark.asyncio
async def test_ledger_receipt_and_transfer(test_db, seed_data):
    manager = seed_data["manager"]
    prod = seed_data["product"]
    loc_vendor = seed_data["loc_vendor"]
    loc_stock = seed_data["loc_stock"]
    loc_rack_a = seed_data["loc_rack_a"]

    # Create dummy operation
    op = StockOperation(
        reference="WH1/IN/TEST-01",
        operation_type="RECEIPT",
        source_location_id=loc_vendor.id,
        destination_location_id=loc_stock.id,
        status="DRAFT",
        created_by=manager.id
    )
    test_db.add(op)
    await test_db.flush()

    # 1. Receive 50 units (Vendor -> Stock)
    await LedgerEngine.record_movement(
        db=test_db,
        product_id=prod.id,
        from_location_id=loc_vendor.id,
        to_location_id=loc_stock.id,
        quantity=Decimal("50.00"),
        operation_id=op.id,
        user_id=manager.id,
        is_manager=True
    )

    # Check quant at Stock
    q_stock = (await test_db.execute(
        select(StockQuant).where(StockQuant.product_id == prod.id, StockQuant.location_id == loc_stock.id)
    )).scalar_one()
    assert q_stock.on_hand == Decimal("50.00")

    # 2. Transfer 20 units (Stock -> Rack A)
    op_trans = StockOperation(
        reference="WH1/INT/TEST-01",
        operation_type="INTERNAL",
        source_location_id=loc_stock.id,
        destination_location_id=loc_rack_a.id,
        status="DRAFT",
        created_by=manager.id
    )
    test_db.add(op_trans)
    await test_db.flush()

    await LedgerEngine.record_movement(
        db=test_db,
        product_id=prod.id,
        from_location_id=loc_stock.id,
        to_location_id=loc_rack_a.id,
        quantity=Decimal("20.00"),
        operation_id=op_trans.id,
        user_id=manager.id,
        is_manager=True
    )

    await test_db.refresh(q_stock)
    assert q_stock.on_hand == Decimal("30.00")

    q_rack_a = (await test_db.execute(
        select(StockQuant).where(StockQuant.product_id == prod.id, StockQuant.location_id == loc_rack_a.id)
    )).scalar_one()
    assert q_rack_a.on_hand == Decimal("20.00")

@pytest.mark.asyncio
async def test_ledger_insufficient_stock_and_override(test_db, seed_data):
    manager = seed_data["manager"]
    staff = seed_data["staff"]
    prod = seed_data["product"]
    loc_stock = seed_data["loc_stock"]
    loc_customer = seed_data["loc_customer"]

    op = StockOperation(
        reference="WH1/OUT/TEST-01",
        operation_type="DELIVERY",
        source_location_id=loc_stock.id,
        destination_location_id=loc_customer.id,
        status="DRAFT",
        created_by=staff.id
    )
    test_db.add(op)
    await test_db.flush()

    # 1. Attempting delivery with 0 stock raises InsufficientStockException
    with pytest.raises(InsufficientStockException):
        await LedgerEngine.record_movement(
            db=test_db,
            product_id=prod.id,
            from_location_id=loc_stock.id,
            to_location_id=loc_customer.id,
            quantity=Decimal("15.00"),
            operation_id=op.id,
            user_id=staff.id,
            allow_negative_stock=False,
            is_manager=False
        )

    # 2. Staff attempting to force allow_negative_stock raises UnauthorizedOverrideException
    with pytest.raises(UnauthorizedOverrideException):
        await LedgerEngine.record_movement(
            db=test_db,
            product_id=prod.id,
            from_location_id=loc_stock.id,
            to_location_id=loc_customer.id,
            quantity=Decimal("15.00"),
            operation_id=op.id,
            user_id=staff.id,
            allow_negative_stock=True,
            is_manager=False
        )

    # 3. Manager can explicitly override negative stock
    await LedgerEngine.record_movement(
        db=test_db,
        product_id=prod.id,
        from_location_id=loc_stock.id,
        to_location_id=loc_customer.id,
        quantity=Decimal("5.00"),
        operation_id=op.id,
        user_id=manager.id,
        allow_negative_stock=True,
        is_manager=True
    )

    q_stock = (await test_db.execute(
        select(StockQuant).where(StockQuant.product_id == prod.id, StockQuant.location_id == loc_stock.id)
    )).scalar_one()
    assert q_stock.on_hand == Decimal("-5.00")

@pytest.mark.asyncio
async def test_rebuild_quants_from_ledger(test_db, seed_data):
    manager = seed_data["manager"]
    prod = seed_data["product"]
    loc_vendor = seed_data["loc_vendor"]
    loc_stock = seed_data["loc_stock"]

    op = StockOperation(
        reference="WH1/IN/REBUILD-01",
        operation_type="RECEIPT",
        source_location_id=loc_vendor.id,
        destination_location_id=loc_stock.id,
        status="DRAFT",
        created_by=manager.id
    )
    test_db.add(op)
    await test_db.flush()

    await LedgerEngine.record_movement(
        db=test_db,
        product_id=prod.id,
        from_location_id=loc_vendor.id,
        to_location_id=loc_stock.id,
        quantity=Decimal("45.00"),
        operation_id=op.id,
        user_id=manager.id,
        is_manager=True
    )

    # Manually tamper with quant table to simulate corruption/drift
    q_stock = (await test_db.execute(
        select(StockQuant).where(StockQuant.product_id == prod.id, StockQuant.location_id == loc_stock.id)
    )).scalar_one()
    q_stock.on_hand = Decimal("9999.00")
    await test_db.commit()

    # Rebuild from ledger
    result = await LedgerEngine.rebuild_quants_from_ledger(test_db, product_id=prod.id)
    assert result["status"] == "success"

    # Verify balance was accurately restored to exactly 45.00 from the immutable ledger
    await test_db.refresh(q_stock)
    assert q_stock.on_hand == Decimal("45.00")
