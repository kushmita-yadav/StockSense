import uuid
from decimal import Decimal
from datetime import datetime, timezone
from sqlalchemy import String, Numeric, DateTime, CheckConstraint, ForeignKey, UniqueConstraint, Index, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base

class StockQuant(Base):
    __tablename__ = "stock_quant"
    __table_args__ = (
        UniqueConstraint("product_id", "location_id", name="uq_stock_quant_product_location"),
        Index("idx_stock_quant_lookup", "product_id", "location_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    product_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("products.id", ondelete="CASCADE"), nullable=False
    )
    location_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("locations.id", ondelete="CASCADE"), nullable=False
    )
    on_hand: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    reserved: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)

    product = relationship("Product", back_populates="quants")
    location = relationship("Location", back_populates="quants")

class StockOperation(Base):
    __tablename__ = "stock_operations"
    __table_args__ = (
        CheckConstraint(
            "operation_type IN ('RECEIPT', 'DELIVERY', 'INTERNAL', 'ADJUSTMENT')",
            name="check_operation_type"
        ),
        CheckConstraint(
            "status IN ('DRAFT', 'WAITING', 'READY', 'DONE', 'CANCELED')",
            name="check_operation_status"
        ),
        Index("idx_operations_ref_status", "reference", "status"),
        UniqueConstraint("owner_id", "reference", name="uq_operation_owner_reference"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    owner_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    reference: Mapped[str] = mapped_column(String, index=True, nullable=False)
    operation_type: Mapped[str] = mapped_column(String, nullable=False)
    source_location_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("locations.id", ondelete="SET NULL"), nullable=True
    )
    destination_location_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("locations.id", ondelete="SET NULL"), nullable=True
    )
    contact_name: Mapped[str | None] = mapped_column(String, nullable=True)
    reason_code: Mapped[str | None] = mapped_column(String, nullable=True)
    status: Mapped[str] = mapped_column(String, default="DRAFT", nullable=False)
    scheduled_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_by: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )

    creator = relationship("User", back_populates="operations_created", foreign_keys=[created_by])
    source_location = relationship("Location", foreign_keys=[source_location_id])
    destination_location = relationship("Location", foreign_keys=[destination_location_id])
    lines = relationship("StockOperationLine", back_populates="operation", cascade="all, delete-orphan")
    ledger_entries = relationship("StockLedger", back_populates="operation")

class StockOperationLine(Base):
    __tablename__ = "stock_operation_lines"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    operation_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("stock_operations.id", ondelete="CASCADE"), nullable=False
    )
    product_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("products.id", ondelete="RESTRICT"), nullable=False
    )
    quantity_demanded: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    quantity_done: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)

    operation = relationship("StockOperation", back_populates="lines")
    product = relationship("Product", back_populates="operation_lines")

class StockLedger(Base):
    __tablename__ = "stock_ledger"
    __table_args__ = (
        Index("idx_ledger_product_time", "product_id", "timestamp"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    operation_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("stock_operations.id", ondelete="RESTRICT"), nullable=False
    )
    product_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("products.id", ondelete="RESTRICT"), nullable=False
    )
    from_location_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("locations.id", ondelete="SET NULL"), nullable=True
    )
    to_location_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("locations.id", ondelete="SET NULL"), nullable=True
    )
    quantity: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )

    operation = relationship("StockOperation", back_populates="ledger_entries")
    product = relationship("Product", back_populates="ledger_entries")
    from_location = relationship("Location", foreign_keys=[from_location_id])
    to_location = relationship("Location", foreign_keys=[to_location_id])
    user = relationship("User", back_populates="ledger_entries")
