"""Add UserModel.external_id

Revision ID: 60a0d1fb54d2
Revises: a34b4b74a5fd
Create Date: 2026-05-16 12:00:00.000000+00:00

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "60a0d1fb54d2"
down_revision = "a34b4b74a5fd"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.add_column(sa.Column("external_id", sa.String(length=200), nullable=True))
        batch_op.create_unique_constraint(batch_op.f("uq_users_external_id"), ["external_id"])


def downgrade() -> None:
    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.drop_constraint(batch_op.f("uq_users_external_id"), type_="unique")
        batch_op.drop_column("external_id")
