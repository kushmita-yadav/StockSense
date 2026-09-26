import uuid
from sqlalchemy import String, CheckConstraint, ForeignKey, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base

class Warehouse(Base):
    __tablename__ = "warehouses"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    code: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    address: Mapped[str | None] = mapped_column(String, nullable=True)

    locations = relationship("Location", back_populates="warehouse", cascade="all, delete-orphan")

class Location(Base):
    __tablename__ = "locations"
    __table_args__ = (
        CheckConstraint(
            "type IN ('INTERNAL', 'VENDOR_VIRTUAL', 'CUSTOMER_VIRTUAL', 'LOSS_VIRTUAL')",
            name="check_location_type"
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    warehouse_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("warehouses.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String, nullable=False)
    type: Mapped[str] = mapped_column(String, nullable=False)

    warehouse = relationship("Warehouse", back_populates="locations")
    quants = relationship("StockQuant", back_populates="location", cascade="all, delete-orphan")
