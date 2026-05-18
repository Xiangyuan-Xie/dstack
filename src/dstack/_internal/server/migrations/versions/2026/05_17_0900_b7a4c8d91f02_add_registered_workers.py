"""Add registered workers.

Revision ID: b7a4c8d91f02
Revises: f0b2c3d4e5f6
Create Date: 2026-05-17 09:00:00.000000+00:00

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy_utils import UUIDType

# revision identifiers, used by Alembic.
revision = "b7a4c8d91f02"
down_revision = "f0b2c3d4e5f6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("projects", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column(
                "auto_approval_enabled",
                sa.Boolean(),
                server_default=sa.false(),
                nullable=False,
            )
        )
        batch_op.add_column(
            sa.Column("auto_approval_max_cpu", sa.Integer(), server_default="4", nullable=False)
        )
        batch_op.add_column(
            sa.Column(
                "auto_approval_max_memory_gib",
                sa.Integer(),
                server_default="16",
                nullable=False,
            )
        )
        batch_op.add_column(
            sa.Column(
                "auto_approval_max_duration_hours",
                sa.Integer(),
                server_default="8",
                nullable=False,
            )
        )

    op.create_table(
        "worker_registration_tokens",
        sa.Column("id", UUIDType(binary=False), nullable=False),
        sa.Column("created_by_id", UUIDType(binary=False), nullable=True),
        sa.Column("fleet_name", sa.String(length=100), nullable=False),
        sa.Column("token_hash", sa.String(length=2000), nullable=False),
        sa.Column("enabled", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(
            ["created_by_id"],
            ["users.id"],
            name=op.f("fk_worker_registration_tokens_created_by_id_users"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_worker_registration_tokens")),
        sa.UniqueConstraint("token_hash", name=op.f("uq_worker_registration_tokens_token_hash")),
    )
    with op.batch_alter_table("worker_registration_tokens", schema=None) as batch_op:
        batch_op.create_index(
            "ix_worker_registration_tokens_fleet",
            ["fleet_name"],
            unique=False,
        )

    op.create_table(
        "registered_workers",
        sa.Column("id", UUIDType(binary=False), nullable=False),
        sa.Column("registration_token_id", UUIDType(binary=False), nullable=False),
        sa.Column("fleet_id", UUIDType(binary=False), nullable=False),
        sa.Column("instance_id", UUIDType(binary=False), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("hostname", sa.String(length=255), nullable=True),
        sa.Column("labels", sa.Text(), nullable=True),
        sa.Column("last_heartbeat_at", sa.DateTime(), nullable=False),
        sa.Column("heartbeat_interval_seconds", sa.Integer(), nullable=True),
        sa.Column("latest_usage", sa.Text(), nullable=True),
        sa.Column("gpus", sa.Text(), server_default="[]", nullable=False),
        sa.Column("version", sa.String(length=100), nullable=True),
        sa.ForeignKeyConstraint(
            ["fleet_id"],
            ["fleets.id"],
            name=op.f("fk_registered_workers_fleet_id_fleets"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["instance_id"],
            ["instances.id"],
            name=op.f("fk_registered_workers_instance_id_instances"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["registration_token_id"],
            ["worker_registration_tokens.id"],
            name=op.f("fk_registered_workers_registration_token_id_worker_registration_tokens"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_registered_workers")),
        sa.UniqueConstraint(
            "registration_token_id",
            "name",
            name="uq_registered_workers_token_id_name",
        ),
    )
    with op.batch_alter_table("registered_workers", schema=None) as batch_op:
        batch_op.create_index(
            batch_op.f("ix_registered_workers_instance_id"),
            ["instance_id"],
            unique=True,
        )
        batch_op.create_index(
            batch_op.f("ix_registered_workers_registration_token_id"),
            ["registration_token_id"],
        )

    op.create_table(
        "registered_worker_gpu_allocations",
        sa.Column("id", UUIDType(binary=False), nullable=False),
        sa.Column("worker_id", UUIDType(binary=False), nullable=False),
        sa.Column("instance_id", UUIDType(binary=False), nullable=False),
        sa.Column("job_id", UUIDType(binary=False), nullable=False),
        sa.Column("gpu_uuid", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("released_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(
            ["instance_id"],
            ["instances.id"],
            name=op.f("fk_registered_worker_gpu_allocations_instance_id_instances"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["job_id"],
            ["jobs.id"],
            name=op.f("fk_registered_worker_gpu_allocations_job_id_jobs"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["worker_id"],
            ["registered_workers.id"],
            name=op.f("fk_registered_worker_gpu_allocations_worker_id_registered_workers"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_registered_worker_gpu_allocations")),
    )
    with op.batch_alter_table("registered_worker_gpu_allocations", schema=None) as batch_op:
        batch_op.create_index(
            batch_op.f("ix_registered_worker_gpu_allocations_gpu_uuid"),
            ["gpu_uuid"],
        )
        batch_op.create_index(
            batch_op.f("ix_registered_worker_gpu_allocations_job_id"),
            ["job_id"],
        )
        batch_op.create_index(
            batch_op.f("ix_registered_worker_gpu_allocations_worker_id"),
            ["worker_id"],
        )
        batch_op.create_index(
            "ix_registered_worker_gpu_allocations_active_gpu",
            ["worker_id", "gpu_uuid"],
            unique=True,
            sqlite_where=sa.text("released_at IS NULL"),
            postgresql_where=sa.text("released_at IS NULL"),
        )

    op.create_table(
        "project_resource_pool_assignments",
        sa.Column("id", UUIDType(binary=False), nullable=False),
        sa.Column("project_id", UUIDType(binary=False), nullable=False),
        sa.Column("fleet_id", UUIDType(binary=False), nullable=False),
        sa.Column("whole_pool", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(
            ["fleet_id"],
            ["fleets.id"],
            name=op.f("fk_project_resource_pool_assignments_fleet_id_fleets"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["project_id"],
            ["projects.id"],
            name=op.f("fk_project_resource_pool_assignments_project_id_projects"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_project_resource_pool_assignments")),
        sa.UniqueConstraint(
            "project_id",
            "fleet_id",
            name="uq_project_resource_pool_assignments_project_fleet",
        ),
    )
    with op.batch_alter_table("project_resource_pool_assignments", schema=None) as batch_op:
        batch_op.create_index(
            batch_op.f("ix_project_resource_pool_assignments_project_id"),
            ["project_id"],
        )

    op.create_table(
        "project_resource_instance_assignments",
        sa.Column("id", UUIDType(binary=False), nullable=False),
        sa.Column("project_id", UUIDType(binary=False), nullable=False),
        sa.Column("fleet_id", UUIDType(binary=False), nullable=False),
        sa.Column("instance_id", UUIDType(binary=False), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(
            ["fleet_id"],
            ["fleets.id"],
            name=op.f("fk_project_resource_instance_assignments_fleet_id_fleets"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["instance_id"],
            ["instances.id"],
            name=op.f("fk_project_resource_instance_assignments_instance_id_instances"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["project_id"],
            ["projects.id"],
            name=op.f("fk_project_resource_instance_assignments_project_id_projects"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_project_resource_instance_assignments")),
        sa.UniqueConstraint(
            "project_id",
            "instance_id",
            name="uq_project_resource_instance_assignments_project_instance",
        ),
    )
    with op.batch_alter_table("project_resource_instance_assignments", schema=None) as batch_op:
        batch_op.create_index(
            batch_op.f("ix_project_resource_instance_assignments_instance_id"),
            ["instance_id"],
        )
        batch_op.create_index(
            batch_op.f("ix_project_resource_instance_assignments_project_id"),
            ["project_id"],
        )


def downgrade() -> None:
    with op.batch_alter_table("projects", schema=None) as batch_op:
        batch_op.drop_column("auto_approval_max_duration_hours")
        batch_op.drop_column("auto_approval_max_memory_gib")
        batch_op.drop_column("auto_approval_max_cpu")
        batch_op.drop_column("auto_approval_enabled")

    with op.batch_alter_table("project_resource_instance_assignments", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_project_resource_instance_assignments_project_id"))
        batch_op.drop_index(batch_op.f("ix_project_resource_instance_assignments_instance_id"))
    op.drop_table("project_resource_instance_assignments")

    with op.batch_alter_table("project_resource_pool_assignments", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_project_resource_pool_assignments_project_id"))
    op.drop_table("project_resource_pool_assignments")

    with op.batch_alter_table("registered_workers", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_registered_workers_registration_token_id"))
        batch_op.drop_index(batch_op.f("ix_registered_workers_instance_id"))
    with op.batch_alter_table("registered_worker_gpu_allocations", schema=None) as batch_op:
        batch_op.drop_index("ix_registered_worker_gpu_allocations_active_gpu")
        batch_op.drop_index(batch_op.f("ix_registered_worker_gpu_allocations_worker_id"))
        batch_op.drop_index(batch_op.f("ix_registered_worker_gpu_allocations_job_id"))
        batch_op.drop_index(batch_op.f("ix_registered_worker_gpu_allocations_gpu_uuid"))
    op.drop_table("registered_worker_gpu_allocations")
    op.drop_table("registered_workers")

    with op.batch_alter_table("worker_registration_tokens", schema=None) as batch_op:
        batch_op.drop_index("ix_worker_registration_tokens_fleet")
    op.drop_table("worker_registration_tokens")
