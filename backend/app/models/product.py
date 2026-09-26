import uuid
from decimal import Decimal
from datetime import datetime, timezone
from sqlalchemy import String, Numeric, DateTime, ForeignKey, Index, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base

class ProductCategory(Base):
    __tablename__ = "product_categories"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)

    products = relationship("Product", back_populates="category")

class Product(Base):
    __tablename__ = "products"
    __table_args__ = (
        Index("idx_products_sku", "sku"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    sku: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    category_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("product_categories.id", ondelete="SET NULL"), nullable=True
    )
    uom: Mapped[str] = mapped_column(String, nullable=False)
    min_stock_level: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    max_stock_level: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )

    category = relationship("ProductCategory", back_populates="products")
    quants = relationship("StockQuant", back_populates="product", cascade="all, delete-orphan")
    operation_lines = relationship("StockOperationLine", back_populates="product")
    ledger_entries = relationship("StockLedger", back_populates="product")
