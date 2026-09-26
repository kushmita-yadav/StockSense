import asyncio
import os
import pytest
import pytest_asyncio
import uuid
from typing import AsyncGenerator
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.pool import StaticPool
from app.core.database import Base, get_db
from app.core.security import hash_password, create_access_token
from app.models.user import User
from app.models.warehouse import Warehouse, Location
from app.models.product import ProductCategory, Product
from main import app

# Keep test data isolated from the application database. Set TEST_DATABASE_URL
# to a dedicated PostgreSQL database when exercising the PostgreSQL dialect.
TEST_DB_URL = os.getenv("TEST_DATABASE_URL", "sqlite+aiosqlite:///:memory:")
test_engine_options = {"echo": False}
if TEST_DB_URL.startswith("sqlite"):
    test_engine_options["connect_args"] = {"check_same_thread": False}
    if ":memory:" in TEST_DB_URL:
        test_engine_options["poolclass"] = StaticPool

test_engine = create_async_engine(TEST_DB_URL, **test_engine_options)

TestSessionLocal = async_sessionmaker(
    bind=test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False
)

@pytest_asyncio.fixture(scope="function")
async def test_db() -> AsyncGenerator[AsyncSession, None]:
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with TestSessionLocal() as session:
        yield session

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

@pytest_asyncio.fixture(scope="function")
async def client(test_db: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    async def override_get_db():
        yield test_db

    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
        yield ac

    app.dependency_overrides.clear()

@pytest_asyncio.fixture(scope="function")
async def seed_data(test_db: AsyncSession):
    # Manager
    manager = User(
        name="Test Manager",
        email="manager@test.com",
        password_hash=hash_password("Manager123!"),
        role="INVENTORY_MANAGER",
        is_active=True
    )
    # Staff
    staff = User(
        name="Test Staff",
        email="staff@test.com",
        password_hash=hash_password("Staff123!"),
        role="WAREHOUSE_STAFF",
        is_active=True
    )
    test_db.add_all([manager, staff])
    await test_db.flush()

    # Warehouse & Locations
    wh = Warehouse(code="WH1", name="Primary Distribution Hub", address="Sector 7")
    test_db.add(wh)
    await test_db.flush()

    loc_stock = Location(warehouse_id=wh.id, name="Stock", type="INTERNAL")
    loc_rack_a = Location(warehouse_id=wh.id, name="Rack A", type="INTERNAL")
    loc_vendor = Location(warehouse_id=wh.id, name="Vendors", type="VENDOR_VIRTUAL")
    loc_customer = Location(warehouse_id=wh.id, name="Customers", type="CUSTOMER_VIRTUAL")
    loc_loss = Location(warehouse_id=wh.id, name="Inventory Loss", type="LOSS_VIRTUAL")
    test_db.add_all([loc_stock, loc_rack_a, loc_vendor, loc_customer, loc_loss])
    await test_db.flush()

    # Category & Product
    cat = ProductCategory(name="Metals")
    test_db.add(cat)
    await test_db.flush()

    prod = Product(
        sku="STEEL-ROD-01",
        name="Steel Rods",
        category_id=cat.id,
        uom="units",
        min_stock_level=10.0,
        max_stock_level=100.0
    )
    test_db.add(prod)
    await test_db.commit()

    return {
        "manager": manager,
        "staff": staff,
        "warehouse": wh,
        "loc_stock": loc_stock,
        "loc_rack_a": loc_rack_a,
        "loc_vendor": loc_vendor,
        "loc_customer": loc_customer,
        "loc_loss": loc_loss,
        "category": cat,
        "product": prod
    }

@pytest_asyncio.fixture(scope="function")
def manager_token(seed_data):
    user = seed_data["manager"]
    return create_access_token({"sub": str(user.id), "role": user.role, "email": user.email})

@pytest_asyncio.fixture(scope="function")
def staff_token(seed_data):
    user = seed_data["staff"]
    return create_access_token({"sub": str(user.id), "role": user.role, "email": user.email})
