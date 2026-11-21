"""Allow standalone interviews and detach them on application deletion.

Revision ID: 4de28a1c9f72
Revises: 5997ce9e674b
Create Date: 2026-11-21
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "4de28a1c9f72"
down_revision: Union[str, Sequence[str], None] = "5997ce9e674b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


OLD_FK_NAME = "interviews_application_id_fkey"
NEW_FK_NAME = "fk_interviews_application_id_applications"


def upgrade() -> None:
    op.add_column("interviews", sa.Column("user_id", sa.Integer(), nullable=True))
    op.execute(
        "UPDATE interviews SET user_id = "
        "(SELECT user_id FROM applications WHERE applications.id = interviews.application_id)"
    )
    op.alter_column("interviews", "user_id", existing_type=sa.Integer(), nullable=False)
    op.alter_column(
        "interviews", "application_id", existing_type=sa.Integer(), nullable=True
    )
    op.drop_constraint(OLD_FK_NAME, "interviews", type_="foreignkey")
    op.create_foreign_key(
        NEW_FK_NAME,
        "interviews",
        "applications",
        ["application_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_interviews_user_id", "interviews", ["user_id"])


def downgrade() -> None:
    op.execute("DELETE FROM interviews WHERE application_id IS NULL")
    op.drop_index("ix_interviews_user_id", table_name="interviews")
    op.alter_column(
        "interviews", "application_id", existing_type=sa.Integer(), nullable=False
    )
    op.drop_constraint(NEW_FK_NAME, "interviews", type_="foreignkey")
    op.create_foreign_key(
        OLD_FK_NAME, "interviews", "applications", ["application_id"], ["id"]
    )
    op.drop_column("interviews", "user_id")
