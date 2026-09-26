"""Add shared workspace membership and invite codes."""
from alembic import op
import sqlalchemy as sa

revision = "834fc01149ad"
down_revision = "71ac9b44d230"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("users") as batch:
        batch.add_column(sa.Column("workspace_id", sa.Uuid(), nullable=True))
        batch.add_column(sa.Column("workspace_invite_code", sa.String(), nullable=True))
        batch.create_index("ix_users_workspace_id", ["workspace_id"])
        batch.create_foreign_key("fk_users_workspace_id_users", "users", ["workspace_id"], ["id"], ondelete="SET NULL")
        batch.create_unique_constraint("uq_users_workspace_invite_code", ["workspace_invite_code"])
    op.execute("UPDATE users SET workspace_id = id WHERE workspace_id IS NULL")


def downgrade() -> None:
    raise RuntimeError("Shared workspace membership migration is not safely reversible.")
