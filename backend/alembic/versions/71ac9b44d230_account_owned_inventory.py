"""Add account ownership to inventory records."""
from alembic import op
import sqlalchemy as sa

revision = "71ac9b44d230"
down_revision = "358d9a4f78d5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Nullable during the transition so existing deployments can backfill their showcase data.
    for table in ("warehouses", "product_categories", "products", "stock_operations"):
        with op.batch_alter_table(table) as batch:
            batch.add_column(sa.Column("owner_id", sa.Uuid(), nullable=True))
            batch.create_index(f"ix_{table}_owner_id", ["owner_id"])
            batch.create_foreign_key(f"fk_{table}_owner_id_users", "users", ["owner_id"], ["id"], ondelete="CASCADE")

    # Keep all existing demo inventory with the manager account that owns the original showcase.
    op.execute("UPDATE warehouses SET owner_id = (SELECT id FROM users WHERE email = 'manager@stocksense.com' LIMIT 1) WHERE owner_id IS NULL")
    op.execute("UPDATE product_categories SET owner_id = (SELECT id FROM users WHERE email = 'manager@stocksense.com' LIMIT 1) WHERE owner_id IS NULL")
    op.execute("UPDATE products SET owner_id = (SELECT id FROM users WHERE email = 'manager@stocksense.com' LIMIT 1) WHERE owner_id IS NULL")
    op.execute("UPDATE stock_operations SET owner_id = (SELECT id FROM users WHERE email = 'manager@stocksense.com' LIMIT 1) WHERE owner_id IS NULL")

    # Remove global uniqueness so independent workspaces can use the same codes/SKUs.
    with op.batch_alter_table("product_categories") as batch:
        batch.drop_index("ix_product_categories_name")
        batch.create_unique_constraint("uq_category_owner_name", ["owner_id", "name"])
    with op.batch_alter_table("warehouses") as batch:
        batch.drop_index("ix_warehouses_code")
        batch.create_index("ix_warehouses_code", ["code"])
        batch.create_unique_constraint("uq_warehouse_owner_code", ["owner_id", "code"])
    with op.batch_alter_table("products", naming_convention={"uq": "uq_%(table_name)s_%(column_0_name)s"}) as batch:
        batch.drop_constraint("uq_products_sku", type_="unique")
        batch.create_unique_constraint("uq_product_owner_sku", ["owner_id", "sku"])
    with op.batch_alter_table("stock_operations") as batch:
        batch.drop_index("ix_stock_operations_reference")
        batch.create_index("ix_stock_operations_reference", ["reference"])
        batch.create_unique_constraint("uq_operation_owner_reference", ["owner_id", "reference"])


def downgrade() -> None:
    raise RuntimeError("Account-owned inventory migration is not safely reversible.")
