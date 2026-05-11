from __future__ import annotations
from typing import TYPE_CHECKING
from datetime import datetime
from sqlalchemy import Integer, String, DateTime, ForeignKey, Text, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base

if TYPE_CHECKING:
    from app.models.word import WordOccurrence
    from app.models.flashcard import Flashcard


class Source(Base):
    __tablename__ = "sources"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String, nullable=False)
    source_type: Mapped[str] = mapped_column(String, nullable=False)
    origin: Mapped[str | None] = mapped_column(String)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    word_count: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String, default="pending")
    error_msg: Mapped[str | None] = mapped_column(Text)

    chapters: Mapped[list[Chapter]] = relationship(
        "Chapter", back_populates="source", cascade="all, delete-orphan", order_by="Chapter.sequence"
    )
    flashcards: Mapped[list[Flashcard]] = relationship("Flashcard", back_populates="source")


class Chapter(Base):
    __tablename__ = "chapters"
    __table_args__ = (Index("ix_chapters_source_id", "source_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    source_id: Mapped[int] = mapped_column(Integer, ForeignKey("sources.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(String, nullable=False)
    sequence: Mapped[int] = mapped_column(Integer, nullable=False)
    raw_text: Mapped[str | None] = mapped_column(Text)
    word_count: Mapped[int] = mapped_column(Integer, default=0)

    source: Mapped[Source] = relationship("Source", back_populates="chapters")
    occurrences: Mapped[list[WordOccurrence]] = relationship(
        "WordOccurrence", back_populates="chapter", cascade="all, delete-orphan"
    )
