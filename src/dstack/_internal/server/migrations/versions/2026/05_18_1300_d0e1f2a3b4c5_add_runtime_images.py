"""Add RuntimeImageModel

Revision ID: d0e1f2a3b4c5
Revises: b7a4c8d91f02
Create Date: 2026-05-18 13:00:00.000000+00:00

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy_utils import UUIDType

from dstack._internal.server.models import NaiveDateTime

# revision identifiers, used by Alembic.
revision = "d0e1f2a3b4c5"
down_revision = "b7a4c8d91f02"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "runtime_images",
        sa.Column("id", UUIDType(binary=False), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("image", sa.String(length=500), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("created_at", NaiveDateTime(), nullable=False),
        sa.Column("updated_at", NaiveDateTime(), nullable=False),
        sa.Column("updated_by_id", UUIDType(binary=False), nullable=True),
        sa.ForeignKeyConstraint(
            ["updated_by_id"],
            ["users.id"],
            name=op.f("fk_runtime_images_updated_by_id_users"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_runtime_images")),
        sa.UniqueConstraint("name", name=op.f("uq_runtime_images_name")),
    )
    op.create_index(
        op.f("ix_runtime_images_position"),
        "runtime_images",
        ["position"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_runtime_images_position"), table_name="runtime_images")
    op.drop_table("runtime_images")
