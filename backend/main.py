import contextlib
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select
from app.core.config import settings
from app.core.database import AsyncSessionLocal, engine, Base
from app.core.security import hash_password
from app.models.user import User
from app.models.warehouse import Warehouse, Location
from app.models.product import ProductCategory, Product
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
            cat_metal = ProductCategory(name="Raw Materials & Metals")
            cat_parts = ProductCategory(name="Mechanical Components")
            session.add_all([cat_metal, cat_parts])
            await session.flush()

            # Seed initial product (Steel Rods for reference test scenario)
            steel_rods = Product(
                sku="ROD-STL-001",
                name="Industrial Steel Rods (10mm)",
                category_id=cat_metal.id,
                uom="units",
                min_stock_level=10.0,
                max_stock_level=100.0
            )
            fasteners = Product(
                sku="FST-BOLT-002",
                name="Hex Bolts M8 x 40mm",
                category_id=cat_parts.id,
                uom="box",
                min_stock_level=5.0,
                max_stock_level=50.0
            )
            session.add_all([steel_rods, fasteners])

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
