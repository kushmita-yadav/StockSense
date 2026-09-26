import uuid
from decimal import Decimal
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from app.core.database import get_db
from app.models.product import Product, ProductCategory
from app.models.stock import StockQuant, StockOperation, StockOperationLine
from app.models.warehouse import Location, Warehouse
from app.schemas.product import (
    CategoryCreate,
    CategoryResponse,
    ProductCreate,
    ProductUpdate,
    ProductResponse,
    StockPerLocationResponse
)
from app.api.deps import get_current_user, require_role

router = APIRouter(prefix="/products", tags=["Products & Categories"])

# ----------------- Categories -----------------

@router.get("/categories", response_model=List[CategoryResponse])
async def list_categories(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    res = await db.execute(select(ProductCategory).where(ProductCategory.owner_id == current_user.inventory_owner_id).order_by(ProductCategory.name.asc()))
    return res.scalars().all()

@router.post("/categories", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
async def create_category(
    cat_in: CategoryCreate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_role(["INVENTORY_MANAGER"]))
):
    existing = await db.execute(
        select(ProductCategory).where(ProductCategory.owner_id == current_user.inventory_owner_id, ProductCategory.name == cat_in.name.strip())
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Category '{cat_in.name}' already exists."
        )

    cat = ProductCategory(owner_id=current_user.inventory_owner_id, name=cat_in.name.strip())
    db.add(cat)
    await db.commit()
    await db.refresh(cat)
    return cat

# ----------------- Products -----------------

async def _build_product_response(product: Product, db: AsyncSession) -> ProductResponse:
    # Query all quants for this product in internal locations
    stmt = (
        select(StockQuant, Location, Warehouse)
        .join(Location, StockQuant.location_id == Location.id)
        .join(Warehouse, Location.warehouse_id == Warehouse.id)
        .where(
            StockQuant.product_id == product.id,
            Warehouse.owner_id == product.owner_id,
            Location.type == "INTERNAL"
        )
    )
    res = await db.execute(stmt)
    records = res.all()

    stock_by_loc = []
    total_on_hand = Decimal("0.00")
    total_reserved = Decimal("0.00")

    for quant, loc, wh in records:
        avail = quant.on_hand - quant.reserved
        stock_by_loc.append(StockPerLocationResponse(
            location_id=loc.id,
            location_name=loc.name,
            warehouse_name=wh.name,
            on_hand=quant.on_hand,
            reserved=quant.reserved,
            available=avail
        ))
        total_on_hand += quant.on_hand
        total_reserved += quant.reserved

    total_avail = total_on_hand - total_reserved
    cat_name = product.category.name if product.category else None

    return ProductResponse(
        id=product.id,
        sku=product.sku,
        name=product.name,
        category_id=product.category_id,
        category_name=cat_name,
        uom=product.uom,
        min_stock_level=product.min_stock_level,
        max_stock_level=product.max_stock_level,
        created_at=product.created_at,
        total_on_hand=total_on_hand,
        total_reserved=total_reserved,
        total_available=total_avail,
        stock_by_location=stock_by_loc
    )

@router.get("", response_model=List[ProductResponse])
async def list_products(
    search: Optional[str] = None,
    category_id: Optional[uuid.UUID] = None,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    query = select(Product).options(selectinload(Product.category)).where(Product.owner_id == current_user.inventory_owner_id)
    if category_id:
        query = query.where(Product.category_id == category_id)
    if search:
        search_filter = f"%{search.strip()}%"
        query = query.where(
            (Product.name.ilike(search_filter)) | (Product.sku.ilike(search_filter))
        )
    res = await db.execute(query.order_by(Product.name.asc()))
    products = res.scalars().all()

    response_list = []
    for p in products:
        p_resp = await _build_product_response(p, db)
        response_list.append(p_resp)

    return response_list

@router.post("", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
async def create_product(
    prod_in: ProductCreate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_role(["INVENTORY_MANAGER"]))
):
    existing = await db.execute(
        select(Product).where(Product.owner_id == current_user.inventory_owner_id, Product.sku == prod_in.sku.upper().strip())
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Product with SKU '{prod_in.sku}' already exists."
        )

    if prod_in.category_id:
        cat = await db.scalar(select(ProductCategory).where(ProductCategory.id == prod_in.category_id, ProductCategory.owner_id == current_user.inventory_owner_id))
        if not cat:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Category with ID {prod_in.category_id} not found."
            )

    product = Product(
        owner_id=current_user.inventory_owner_id,
        sku=prod_in.sku.upper().strip(),
        name=prod_in.name.strip(),
        category_id=prod_in.category_id,
        uom=prod_in.uom.strip(),
        min_stock_level=prod_in.min_stock_level,
        max_stock_level=prod_in.max_stock_level
    )
    db.add(product)
    await db.commit()
    await db.refresh(product)

    res = await db.execute(
        select(Product).options(selectinload(Product.category)).where(Product.id == product.id, Product.owner_id == current_user.inventory_owner_id)
    )
    prod = res.scalar_one()
    return await _build_product_response(prod, db)

@router.get("/{product_id}", response_model=ProductResponse)
async def get_product(
    product_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    res = await db.execute(
        select(Product).options(selectinload(Product.category)).where(Product.id == product_id, Product.owner_id == current_user.inventory_owner_id)
    )
    product = res.scalar_one_or_none()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product {product_id} not found."
        )
    return await _build_product_response(product, db)

@router.put("/{product_id}", response_model=ProductResponse)
async def update_product(
    product_id: uuid.UUID,
    prod_update: ProductUpdate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_role(["INVENTORY_MANAGER"]))
):
    product = await db.scalar(select(Product).where(Product.id == product_id, Product.owner_id == current_user.inventory_owner_id))
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product {product_id} not found."
        )

    if prod_update.name is not None:
        product.name = prod_update.name.strip()
    if prod_update.category_id is not None:
        category = await db.scalar(select(ProductCategory).where(
            ProductCategory.id == prod_update.category_id,
            ProductCategory.owner_id == current_user.inventory_owner_id
        ))
        if category is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Category not found in this workspace.")
        product.category_id = category.id
    if prod_update.uom is not None:
        product.uom = prod_update.uom.strip()
    if prod_update.min_stock_level is not None:
        product.min_stock_level = prod_update.min_stock_level
    if prod_update.max_stock_level is not None:
        product.max_stock_level = prod_update.max_stock_level

    await db.commit()
    await db.refresh(product)

    res = await db.execute(
        select(Product).options(selectinload(Product.category)).where(Product.id == product_id, Product.owner_id == current_user.inventory_owner_id)
    )
    prod = res.scalar_one()
    return await _build_product_response(prod, db)

# ----------------- Reordering Rules Check -----------------

@router.get("/rules/reorder-check")
async def check_reorder_rules(
    auto_create_drafts: bool = Query(default=False),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Checks all products where on_hand < min_stock_level.
    If auto_create_drafts is True (and user is manager), creates draft Receipts.
    """
    products = (await db.execute(select(Product).where(Product.owner_id == current_user.inventory_owner_id))).scalars().all()
    alerts = []
    created_receipts = []

    for p in products:
        # compute total on_hand
        q_res = await db.execute(
            select(func.coalesce(func.sum(StockQuant.on_hand), Decimal("0.00")))
            .join(Location, StockQuant.location_id == Location.id)
            .join(Warehouse, Location.warehouse_id == Warehouse.id)
            .where(StockQuant.product_id == p.id, Location.type == "INTERNAL", Warehouse.owner_id == current_user.inventory_owner_id)
        )
        total_on_hand = q_res.scalar_one()

        if total_on_hand < p.min_stock_level:
            deficit = p.min_stock_level - total_on_hand
            # Suggested order quantity: up to max_stock_level if set, else deficit or min_stock_level
            suggested = (p.max_stock_level - total_on_hand) if p.max_stock_level else deficit

            alert = {
                "product_id": p.id,
                "sku": p.sku,
                "name": p.name,
                "uom": p.uom,
                "current_stock": float(total_on_hand),
                "min_stock_level": float(p.min_stock_level),
                "suggested_order_qty": float(suggested)
            }
            alerts.append(alert)

            if auto_create_drafts and current_user.role == "INVENTORY_MANAGER":
                # Find default warehouse and internal stock location
                wh_res = await db.execute(select(Warehouse).where(Warehouse.owner_id == current_user.inventory_owner_id).limit(1))
                wh = wh_res.scalar_one_or_none()
                if wh:
                    dest_loc_res = await db.execute(
                        select(Location).where(Location.warehouse_id == wh.id, Location.type == "INTERNAL").limit(1)
                    )
                    dest_loc = dest_loc_res.scalar_one_or_none()
                    vendor_loc_res = await db.execute(
                        select(Location).where(Location.warehouse_id == wh.id, Location.type == "VENDOR_VIRTUAL").limit(1)
                    )
                    vendor_loc = vendor_loc_res.scalar_one_or_none()

                    if dest_loc and vendor_loc:
                        ref = f"{wh.code}/IN/REORDER-{p.sku}-{uuid.uuid4().hex[:6].upper()}"
                        op = StockOperation(
                            owner_id=current_user.inventory_owner_id,
                            reference=ref,
                            operation_type="RECEIPT",
                            source_location_id=vendor_loc.id,
                            destination_location_id=dest_loc.id,
                            contact_name="Automated Reorder Rule",
                            status="DRAFT",
                            created_by=current_user.id
                        )
                        db.add(op)
                        await db.flush()

                        line = StockOperationLine(
                            operation_id=op.id,
                            product_id=p.id,
                            quantity_demanded=suggested,
                            quantity_done=Decimal("0.00")
                        )
                        db.add(line)
                        created_receipts.append(ref)

    if created_receipts:
        await db.commit()

    return {
        "low_stock_products_count": len(alerts),
        "alerts": alerts,
        "auto_created_draft_receipts": created_receipts
    }
