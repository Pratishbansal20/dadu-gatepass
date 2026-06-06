"""Initial schema — all tables

Revision ID: 0001
Revises:
Create Date: 2024-01-01 00:00:00

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column(
            "role",
            sa.Enum(
                "STUDENT", "FACULTY", "HOSTEL_SUPERINTENDENT",
                "CONFERENCE_SUPERVISOR", "GATE_SECURITY", "SUPER_ADMIN",
                name="userrole",
            ),
            nullable=False,
        ),
        sa.Column("full_name", sa.String(255), nullable=False),
        sa.Column("phone", sa.String(20), nullable=False),
        sa.Column("campus_id", sa.String(50), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_users"),
        sa.UniqueConstraint("email", name="uq_users_email"),
        sa.UniqueConstraint("campus_id", name="uq_users_campus_id"),
    )
    op.create_index("ix_users_email", "users", ["email"])

    op.create_table(
        "passes",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column(
            "pass_type",
            sa.Enum(
                "PERMANENT_RESIDENT", "VISITOR_DAY", "CONFERENCE_PARTICIPANT",
                "VEHICLE_RFID", "HOSTEL_SUB",
                name="passtype",
            ),
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.Enum(
                "PENDING", "APPROVED", "REJECTED", "ACTIVE", "USED", "EXPIRED",
                name="passstatus",
            ),
            nullable=False,
        ),
        sa.Column("applicant_id", sa.Integer(), nullable=False),
        sa.Column("approved_by_id", sa.Integer(), nullable=True),
        sa.Column("parent_pass_id", sa.Integer(), nullable=True),
        sa.Column("visitor_name", sa.String(255), nullable=True),
        sa.Column("visitor_phone", sa.String(20), nullable=True),
        sa.Column("visitor_email", sa.String(255), nullable=True),
        sa.Column("purpose", sa.Text(), nullable=True),
        sa.Column("conference_name", sa.String(255), nullable=True),
        sa.Column("visit_date", sa.Date(), nullable=True),
        sa.Column("valid_from", sa.Date(), nullable=True),
        sa.Column("valid_until", sa.Date(), nullable=True),
        sa.Column("entry_time", sa.Time(), nullable=True),
        sa.Column("exit_time", sa.Time(), nullable=True),
        sa.Column("rejection_reason", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["applicant_id"], ["users.id"], name="fk_passes_applicant_id_users"),
        sa.ForeignKeyConstraint(["approved_by_id"], ["users.id"], name="fk_passes_approved_by_id_users"),
        sa.ForeignKeyConstraint(["parent_pass_id"], ["passes.id"], name="fk_passes_parent_pass_id_passes"),
        sa.PrimaryKeyConstraint("id", name="pk_passes"),
    )
    op.create_index("ix_passes_pass_type", "passes", ["pass_type"])
    op.create_index("ix_passes_status", "passes", ["status"])

    op.create_table(
        "rfid_tags",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("tag_number", sa.String(100), nullable=False),
        sa.Column("vehicle_number", sa.String(50), nullable=False),
        sa.Column("vehicle_model", sa.String(100), nullable=False),
        sa.Column("faculty_id", sa.Integer(), nullable=False),
        sa.Column(
            "status",
            sa.Enum("PENDING", "ACTIVE", "REVOKED", name="rfidstatus"),
            nullable=False,
        ),
        sa.Column("activated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["faculty_id"], ["users.id"], name="fk_rfid_tags_faculty_id_users"),
        sa.PrimaryKeyConstraint("id", name="pk_rfid_tags"),
        sa.UniqueConstraint("tag_number", name="uq_rfid_tags_tag_number"),
    )
    op.create_index("ix_rfid_tags_tag_number", "rfid_tags", ["tag_number"])

    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("actor_id", sa.Integer(), nullable=True),
        sa.Column("action", sa.String(100), nullable=False),
        sa.Column("entity_type", sa.String(50), nullable=False),
        sa.Column("entity_id", sa.Integer(), nullable=True),
        sa.Column("metadata_json", sa.Text(), nullable=True),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["actor_id"], ["users.id"], name="fk_audit_logs_actor_id_users"),
        sa.PrimaryKeyConstraint("id", name="pk_audit_logs"),
    )
    op.create_index("ix_audit_logs_action", "audit_logs", ["action"])
    op.create_index("ix_audit_logs_entity_type", "audit_logs", ["entity_type"])
    op.create_index("ix_audit_logs_timestamp", "audit_logs", ["timestamp"])


def downgrade() -> None:
    op.drop_table("audit_logs")
    op.drop_table("rfid_tags")
    op.drop_table("passes")
    op.drop_table("users")
    op.execute("DROP TYPE IF EXISTS userrole")
    op.execute("DROP TYPE IF EXISTS passtype")
    op.execute("DROP TYPE IF EXISTS passstatus")
    op.execute("DROP TYPE IF EXISTS rfidstatus")
