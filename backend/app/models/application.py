from __future__ import annotations
from datetime import date, datetime

from sqlalchemy import (
    Date, DateTime, ForeignKey,
    Integer, String, Text, func
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Application(Base):
    __tablename__ = "applications"

    id: Mapped[int] = mapped_column(
        Integer, primary_key=True
    )

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"), index=True
    )

    company_name: Mapped[str] = mapped_column(
        String(150), nullable=False
    )

    job_title: Mapped[str] = mapped_column(
        String(150), nullable=False
    )

    job_type: Mapped[str] = mapped_column(
        String(30), default="remote"
    )

    application_status: Mapped[str] = mapped_column(
        String(30), default="applied"
    )

    applied_at: Mapped[date | None] = mapped_column(
        Date, nullable=True
    )

    notes: Mapped[str | None] = mapped_column(
        Text, nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now()
    )

    user: Mapped["User"] = relationship(
        back_populates="applications"
    )

    interviews: Mapped[list["Interview"]] = relationship(
        back_populates="application"
    )


