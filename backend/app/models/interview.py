from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    DateTime, ForeignKey,
    Integer, String, Text, func
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Interview(Base):
    __tablename__ = "interviews"

    id: Mapped[int] = mapped_column(
        Integer, primary_key=True
    )

    application_id: Mapped[int] = mapped_column(
        ForeignKey("applications.id"), index=True
    )

    round_name: Mapped[str] = mapped_column(
        String(100), nullable=False
    )

    scheduled_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )

    meeting_link: Mapped[str | None] = mapped_column(
        Text, nullable=True
    )

    status: Mapped[str] = mapped_column(
        String(30), default="scheduled"
    )

    notes: Mapped[str | None] = mapped_column(
        Text, nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now()
    )

    application: Mapped["Application"] = relationship(
        back_populates="interviews"
    )


