import contextlib
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select, func, delete
from app.core.config import settings
from app.core.database import AsyncSessionLocal, engine, Base
from app.core.security import hash_password
from app.models.user import User
from app.models.warehouse import Warehouse, Location
from app.models.product import ProductCategory, Product
from app.models.stock import StockQuant, StockOperation, StockOperationLine, StockLedger
from app.api.v1 import api_v1_router

async def seed_initial_data():
    """Seeds initial warehouse, locations, and default users if database is empty."""
    async with AsyncSessionLocal() as session:
        # Check if users exist
        user_res = await session.execute(select(User).limit(1))
        if not user_res.scalar_one_or_none():
            # Seed default users
            manager = User(
                name="Alex Vance (Manager)",
                email="manager@stocksense.com",
                password_hash=hash_password("Manager@12345"),
                role="INVENTORY_MANAGER",
                is_active=True
            )
            staff = User(
                name="Sam Porter (Staff)",
                email="staff@stocksense.com",
                password_hash=hash_password("Staff@12345"),
                role="WAREHOUSE_STAFF",
                is_active=True
            )
            session.add_all([manager, staff])
            await session.flush()

            # Seed default warehouse & locations
            wh = Warehouse(
                owner_id=manager.id,
                code="WH1",
                name="Central Fulfillment Hub",
                address="100 Logistics Blvd, Industrial Zone"
            )
            session.add(wh)
            await session.flush()

            stock_loc = Location(warehouse_id=wh.id, name="Stock", type="INTERNAL")
            rack_a = Location(warehouse_id=wh.id, name="Rack A", type="INTERNAL")
            rack_b = Location(warehouse_id=wh.id, name="Rack B", type="INTERNAL")
            vendor_loc = Location(warehouse_id=wh.id, name="Vendors", type="VENDOR_VIRTUAL")
            cust_loc = Location(warehouse_id=wh.id, name="Customers", type="CUSTOMER_VIRTUAL")
            loss_loc = Location(warehouse_id=wh.id, name="Inventory Loss", type="LOSS_VIRTUAL")

            session.add_all([stock_loc, rack_a, rack_b, vendor_loc, cust_loc, loss_loc])
            await session.flush()

            # Seed default categories
            cat_metal = ProductCategory(owner_id=manager.id, name="Raw Materials & Metals")
            cat_parts = ProductCategory(owner_id=manager.id, name="Mechanical Components")
            session.add_all([cat_metal, cat_parts])
            await session.flush()

            # Seed initial product (Steel Rods for reference test scenario)
            steel_rods = Product(
                owner_id=manager.id,
                sku="ROD-STL-001",
                name="Industrial Steel Rods (10mm)",
                category_id=cat_metal.id,
                uom="units",
                min_stock_level=10.0,
                max_stock_level=100.0
            )
            fasteners = Product(
                owner_id=manager.id,
                sku="FST-BOLT-002",
                name="Hex Bolts M8 x 40mm",
                category_id=cat_parts.id,
                uom="box",
                min_stock_level=5.0,
                max_stock_level=50.0
            )
            session.add_all([steel_rods, fasteners])
            await session.flush()

            # Independent staff showroom with its own warehouse, products and stock.
            staff_wh = Warehouse(owner_id=staff.id, code="STF1", name="Eastside Retail Depot", address="24 Market Street")
            session.add(staff_wh)
            await session.flush()
            staff_stock = Location(warehouse_id=staff_wh.id, name="Shop Floor", type="INTERNAL")
            staff_rack = Location(warehouse_id=staff_wh.id, name="Backroom", type="INTERNAL")
            staff_vendor = Location(warehouse_id=staff_wh.id, name="Suppliers", type="VENDOR_VIRTUAL")
            staff_customer = Location(warehouse_id=staff_wh.id, name="Customers", type="CUSTOMER_VIRTUAL")
            staff_loss = Location(warehouse_id=staff_wh.id, name="Write-offs", type="LOSS_VIRTUAL")
            staff_category = ProductCategory(owner_id=staff.id, name="Retail Goods")
            session.add_all([staff_stock, staff_rack, staff_vendor, staff_customer, staff_loss, staff_category])
            await session.flush()
            staff_product = Product(owner_id=staff.id, sku="SNACK-100", name="Trail Mix Gift Pack", category_id=staff_category.id, uom="pack", min_stock_level=8, max_stock_level=80)
            session.add(staff_product)
            await session.flush()
            session.add(StockQuant(product_id=staff_product.id, location_id=staff_stock.id, on_hand=24, reserved=0))

            await session.commit()

        # Upgrade existing local/demo databases with an independent staff showcase dataset too.
        staff = await session.scalar(select(User).where(User.email == "staff@stocksense.com"))
        if staff:
            staff_wh = await session.scalar(select(Warehouse).where(Warehouse.owner_id == staff.id).limit(1))
            if not staff_wh:
                staff_wh = Warehouse(owner_id=staff.id, code="STF1", name="Eastside Retail Depot", address="24 Market Street")
                session.add(staff_wh)
                await session.flush()
                staff_stock = Location(warehouse_id=staff_wh.id, name="Shop Floor", type="INTERNAL")
                staff_rack = Location(warehouse_id=staff_wh.id, name="Backroom", type="INTERNAL")
                staff_vendor = Location(warehouse_id=staff_wh.id, name="Suppliers", type="VENDOR_VIRTUAL")
                staff_customer = Location(warehouse_id=staff_wh.id, name="Customers", type="CUSTOMER_VIRTUAL")
                staff_loss = Location(warehouse_id=staff_wh.id, name="Write-offs", type="LOSS_VIRTUAL")
                staff_category = ProductCategory(owner_id=staff.id, name="Retail Goods")
                session.add_all([staff_stock, staff_rack, staff_vendor, staff_customer, staff_loss, staff_category])
                await session.flush()
                staff_product = Product(owner_id=staff.id, sku="SNACK-100", name="Trail Mix Gift Pack", category_id=staff_category.id, uom="pack", min_stock_level=8, max_stock_level=80)
                session.add(staff_product)
                await session.flush()
                session.add(StockQuant(product_id=staff_product.id, location_id=staff_stock.id, on_hand=24, reserved=0))
                await session.commit()

        # Fill the two showcase workspaces with realistic but deliberately different catalogs,
        # on-hand balances, completed movements, pending work, and audit history.
        manager = await session.scalar(select(User).where(User.email == "manager@stocksense.com"))
        staff = await session.scalar(select(User).where(User.email == "staff@stocksense.com"))
        if manager and staff:
            showcase_users = (manager, staff)
            manager_category = await session.scalar(select(ProductCategory).where(ProductCategory.owner_id == manager.id, ProductCategory.name == "Mechanical Components"))
            staff_category = await session.scalar(select(ProductCategory).where(ProductCategory.owner_id == staff.id, ProductCategory.name == "Retail Goods"))
            catalog_additions = []
            if manager_category and not await session.scalar(select(Product.id).where(Product.owner_id == manager.id, Product.sku == "BRG-6305-2RS")):
                catalog_additions.append(Product(owner_id=manager.id, sku="BRG-6305-2RS", name="Sealed Ball Bearing 6305", category_id=manager_category.id, uom="unit", min_stock_level=10, max_stock_level=80))
            if staff_category:
                existing_staff_skus = set((await session.scalars(select(Product.sku).where(Product.owner_id == staff.id))).all())
                for sku, name, uom, min_level, max_level in [
                    ("COFFEE-250", "House Blend Coffee 250g", "bag", 10, 90),
                    ("MUG-CERAMIC-01", "Stoneware Coffee Mug", "unit", 8, 60),
                ]:
                    if sku not in existing_staff_skus:
                        catalog_additions.append(Product(owner_id=staff.id, sku=sku, name=name, category_id=staff_category.id, uom=uom, min_stock_level=min_level, max_stock_level=max_level))
            if catalog_additions:
                session.add_all(catalog_additions)
                await session.commit()

            for showcase_user in showcase_users:
                owner_id = showcase_user.inventory_owner_id
                already_seeded = await session.scalar(
                    select(StockOperation.id).where(StockOperation.owner_id == owner_id, StockOperation.reference.like("%/SHOW-%")).limit(1)
                )
                if already_seeded:
                    continue
                has_ledger = await session.scalar(
                    select(StockLedger.id).join(StockOperation).where(StockOperation.owner_id == owner_id).limit(1)
                )
                warehouse = await session.scalar(select(Warehouse).where(Warehouse.owner_id == owner_id).order_by(Warehouse.code).limit(1))
                products = list((await session.scalars(select(Product).where(Product.owner_id == owner_id).order_by(Product.sku))).all())
                if not warehouse or not products:
                    continue
                locations = list((await session.scalars(select(Location).where(Location.warehouse_id == warehouse.id).order_by(Location.name))).all())
                internal = [location for location in locations if location.type == "INTERNAL"]
                vendor = next((location for location in locations if location.type == "VENDOR_VIRTUAL"), None)
                customer = next((location for location in locations if location.type == "CUSTOMER_VIRTUAL"), None)
                if not internal or not vendor or not customer:
                    continue

                product_ids = [product.id for product in products]
                if not has_ledger:
                    # Fresh demo catalogs only had a placeholder quant, so derive them from these sample movements.
                    await session.execute(delete(StockQuant).where(StockQuant.product_id.in_(product_ids)))
                balances = {}
                for index, product in enumerate(products):
                    received = 6 if product.min_stock_level >= 8 and index == len(products) - 1 else 60 + index * 19
                    movements = [("RECEIPT", vendor, internal[0], received)]
                    if len(internal) > 1:
                        transferred = max(1, received // 3)
                        movements.append(("INTERNAL", internal[0], internal[1], transferred))
                        delivered = max(1, transferred // 3)
                        movements.append(("DELIVERY", internal[1], customer, delivered))
                    else:
                        transferred = 0
                        delivered = 0
                    for sequence, (operation_type, source, destination, quantity) in enumerate(movements, start=1):
                        type_code = {"RECEIPT": "IN", "INTERNAL": "INT", "DELIVERY": "OUT"}[operation_type]
                        operation = StockOperation(
                            owner_id=owner_id,
                            reference=f"{warehouse.code}/{type_code}/SHOW-{product.sku}-{sequence:02d}",
                            operation_type=operation_type,
                            source_location_id=source.id,
                            destination_location_id=destination.id,
                            contact_name="Showcase sample movement",
                            status="DONE",
                            created_by=showcase_user.id,
                        )
                        session.add(operation)
                        await session.flush()
                        session.add(StockOperationLine(operation_id=operation.id, product_id=product.id, quantity_demanded=quantity, quantity_done=quantity))
                        session.add(StockLedger(operation_id=operation.id, product_id=product.id, from_location_id=source.id, to_location_id=destination.id, quantity=quantity, user_id=showcase_user.id))
                        if source.type == "INTERNAL":
                            balances[(product.id, source.id)] = balances.get((product.id, source.id), 0) - quantity
                        if destination.type == "INTERNAL":
                            balances[(product.id, destination.id)] = balances.get((product.id, destination.id), 0) + quantity

                for (product_id, location_id), on_hand in balances.items():
                    if on_hand > 0:
                        quant = await session.scalar(select(StockQuant).where(StockQuant.product_id == product_id, StockQuant.location_id == location_id))
                        if quant:
                            quant.on_hand += on_hand
                        else:
                            session.add(StockQuant(product_id=product_id, location_id=location_id, on_hand=on_hand, reserved=0))

                # A couple of open work items make the operation pipeline visible in demos.
                sample_product = products[0]
                receipt = StockOperation(owner_id=owner_id, reference=f"{warehouse.code}/IN/PENDING-SHOW", operation_type="RECEIPT", source_location_id=vendor.id, destination_location_id=internal[0].id, contact_name="Northstar Supply Co.", status="DRAFT", created_by=showcase_user.id)
                session.add(receipt)
                await session.flush()
                session.add(StockOperationLine(operation_id=receipt.id, product_id=sample_product.id, quantity_demanded=18, quantity_done=0))
                if len(internal) > 1:
                    transfer = StockOperation(owner_id=owner_id, reference=f"{warehouse.code}/INT/PENDING-SHOW", operation_type="INTERNAL", source_location_id=internal[0].id, destination_location_id=internal[1].id, contact_name="Showcase shelf restock", status="DRAFT", created_by=showcase_user.id)
                    session.add(transfer)
                    await session.flush()
                    session.add(StockOperationLine(operation_id=transfer.id, product_id=sample_product.id, quantity_demanded=5, quantity_done=0))
                await session.commit()

@contextlib.asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.APP_ENV != "production":
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        await seed_initial_data()
    yield
    await engine.dispose()

app = FastAPI(
    title=settings.PROJECT_NAME,
    version="1.0.0",
    description="Modular, web-based Inventory Management System with append-only ledger and row-level concurrency control.",
    lifespan=lifespan
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API v1 router
app.include_router(api_v1_router, prefix=settings.API_V1_STR)

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "StockSense API",
        "timestamp": True
    }

@app.get("/")
async def root():
    return {
        "message": "StockSense Inventory Management System API is running.",
        "docs_url": "/docs",
        "api_v1": settings.API_V1_STR
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
