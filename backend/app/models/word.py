from __future__ import annotations
from typing import TYPE_CHECKING
from sqlalchemy import Integer, String, Text, ForeignKey, UniqueConstraint, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base

if TYPE_CHECKING:
    from app.models.source import Chapter
    from app.models.flashcard import Flashcard


class Word(Base):
    __tablename__ = "words"
    __table_args__ = (
        UniqueConstraint("traditional", name="uq_word_traditional"),
        Index("ix_word_traditional", "traditional"),
        Index("ix_word_hsk_level", "hsk_level"),
        Index("ix_word_tocfl_level", "tocfl_level"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    traditional: Mapped[str] = mapped_column(String, nullable=False)
    simplified: Mapped[str | None] = mapped_column(String)
    pinyin: Mapped[str | None] = mapped_column(String)
    hsk_level: Mapped[int | None] = mapped_column(Integer)
    tocfl_level: Mapped[int | None] = mapped_column(Integer)
    tocfl_category: Mapped[str | None] = mapped_column(String)
    frequency_rank: Mapped[int | None] = mapped_column(Integer)

    occurrences: Mapped[list[WordOccurrence]] = relationship(
        "WordOccurrence", back_populates="word", cascade="all, delete-orphan"
    )
    flashcards: Mapped[list[Flashcard]] = relationship("Flashcard", back_populates="word")


class WordOccurrence(Base):
    __tablename__ = "word_occurrences"
    __table_args__ = (
        UniqueConstraint("word_id", "chapter_id", name="uq_word_chapter"),
        Index("ix_occurrence_source_id", "source_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    word_id: Mapped[int] = mapped_column(Integer, ForeignKey("words.id"), nullable=False)
    chapter_id: Mapped[int] = mapped_column(Integer, ForeignKey("chapters.id", ondelete="CASCADE"), nullable=False)
    source_id: Mapped[int] = mapped_column(Integer, ForeignKey("sources.id", ondelete="CASCADE"), nullable=False)
    count: Mapped[int] = mapped_column(Integer, default=1)
    context_snippet: Mapped[str | None] = mapped_column(Text)

    word: Mapped[Word] = relationship("Word", back_populates="occurrences")
    chapter: Mapped[Chapter] = relationship("Chapter", back_populates="occurrences")
