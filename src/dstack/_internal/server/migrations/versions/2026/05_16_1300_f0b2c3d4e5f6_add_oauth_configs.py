"""Add OAuthConfigModel

Revision ID: f0b2c3d4e5f6
Revises: 60a0d1fb54d2
Create Date: 2026-05-16 13:00:00.000000+00:00

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy_utils import UUIDType

from dstack._internal.server.models import NaiveDateTime

# revision identifiers, used by Alembic.
revision = "f0b2c3d4e5f6"
down_revision = "60a0d1fb54d2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "oauth_configs",
        sa.Column("id", UUIDType(binary=False), nullable=False),
        sa.Column("provider", sa.String(length=50), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False),
        sa.Column("app_id", sa.String(length=200), nullable=True),
        sa.Column("app_secret", sa.String(length=2000), nullable=True),
        sa.Column("scope", sa.String(length=1000), nullable=True),
        sa.Column("created_at", NaiveDateTime(), nullable=False),
        sa.Column("updated_at", NaiveDateTime(), nullable=False),
        sa.Column("updated_by_id", UUIDType(binary=False), nullable=True),
        sa.ForeignKeyConstraint(
            ["updated_by_id"],
            ["users.id"],
            name=op.f("fk_oauth_configs_updated_by_id_users"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_oauth_configs")),
        sa.UniqueConstraint("provider", name=op.f("uq_oauth_configs_provider")),
    )


def downgrade() -> None:
    op.drop_table("oauth_configs")
