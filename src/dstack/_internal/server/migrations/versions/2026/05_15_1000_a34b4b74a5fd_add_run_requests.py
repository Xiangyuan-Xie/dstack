"""Add run requests

Revision ID: a34b4b74a5fd
Revises: 201cb7ccd0d3
Create Date: 2026-05-15 10:00:00.000000+00:00

"""

import sqlalchemy as sa
import sqlalchemy_utils
from alembic import op

import dstack._internal.server.models

# revision identifiers, used by Alembic.
revision = "a34b4b74a5fd"
down_revision = "201cb7ccd0d3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "run_requests",
        sa.Column("id", sqlalchemy_utils.types.uuid.UUIDType(binary=False), nullable=False),
        sa.Column(
            "project_id", sqlalchemy_utils.types.uuid.UUIDType(binary=False), nullable=False
        ),
        sa.Column(
            "applicant_id", sqlalchemy_utils.types.uuid.UUIDType(binary=False), nullable=False
        ),
        sa.Column(
            "reviewer_id", sqlalchemy_utils.types.uuid.UUIDType(binary=False), nullable=True
        ),
        sa.Column("run_id", sqlalchemy_utils.types.uuid.UUIDType(binary=False), nullable=True),
        sa.Column("created_at", dstack._internal.server.models.NaiveDateTime(), nullable=False),
        sa.Column("reviewed_at", dstack._internal.server.models.NaiveDateTime(), nullable=True),
        sa.Column("status", sa.String(length=100), nullable=False),
        sa.Column("request", sa.Text(), nullable=False),
        sa.Column("review_message", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(
            ["applicant_id"],
            ["users.id"],
            name=op.f("fk_run_requests_applicant_id_users"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["project_id"],
            ["projects.id"],
            name=op.f("fk_run_requests_project_id_projects"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["reviewer_id"],
            ["users.id"],
            name=op.f("fk_run_requests_reviewer_id_users"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["run_id"],
            ["runs.id"],
            name=op.f("fk_run_requests_run_id_runs"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_run_requests")),
    )
    with op.batch_alter_table("run_requests", schema=None) as batch_op:
        batch_op.create_index(batch_op.f("ix_run_requests_applicant_id"), ["applicant_id"])
        batch_op.create_index(batch_op.f("ix_run_requests_project_id"), ["project_id"])
        batch_op.create_index(
            "ix_run_requests_project_created_at_id",
            ["project_id", sa.literal_column("created_at DESC"), "id"],
            unique=False,
        )
        batch_op.create_index(batch_op.f("ix_run_requests_run_id"), ["run_id"])
        batch_op.create_index(batch_op.f("ix_run_requests_status"), ["status"])


def downgrade() -> None:
    with op.batch_alter_table("run_requests", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_run_requests_status"))
        batch_op.drop_index(batch_op.f("ix_run_requests_run_id"))
        batch_op.drop_index("ix_run_requests_project_created_at_id")
        batch_op.drop_index(batch_op.f("ix_run_requests_project_id"))
        batch_op.drop_index(batch_op.f("ix_run_requests_applicant_id"))
    op.drop_table("run_requests")
