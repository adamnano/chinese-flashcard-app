from datetime import datetime, date
from sqlalchemy import Integer, String, Text, Float, Boolean, DateTime, Date, ForeignKey, UniqueConstraint, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class Flashcard(Base):
    __tablename__ = "flashcards"
    __table_args__ = (
        UniqueConstraint("word_id", "source_id", name="uq_flashcard_word_source"),
        Index("ix_flashcard_next_review", "next_review"),
        Index("ix_flashcard_hsk_level", "hsk_level"),
        Index("ix_flashcard_tocfl_level", "tocfl_level"),
        Index("ix_flashcard_source_id", "source_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    word_id: Mapped[int] = mapped_column(Integer, ForeignKey("words.id"), nullable=False)
    source_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("sources.id", ondelete="SET NULL"))

    # Denormalized for fast reads
    traditional: Mapped[str] = mapped_column(String, nullable=False)
    simplified: Mapped[str | None] = mapped_column(String)
    pinyin: Mapped[str | None] = mapped_column(String)

    contextual_meaning: Mapped[str] = mapped_column(Text, nullable=False)
    base_meaning: Mapped[str | None] = mapped_column(Text)
    example_sentence: Mapped[str | None] = mapped_column(Text)

    hsk_level: Mapped[int | None] = mapped_column(Integer)
    tocfl_level: Mapped[int | None] = mapped_column(Integer)
    tocfl_category: Mapped[str | None] = mapped_column(String)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # SM-2 fields
    repetitions: Mapped[int] = mapped_column(Integer, default=0)
    easiness: Mapped[float] = mapped_column(Float, default=2.5)
    interval: Mapped[int] = mapped_column(Integer, default=1)
    next_review: Mapped[date] = mapped_column(Date, default=date.today)
    is_suspended: Mapped[bool] = mapped_column(Boolean, default=False)

    word: Mapped = relationship("Word", back_populates="flashcards")
    source: Mapped = relationship("Source", back_populates="flashcards")
    review_logs: Mapped[list["ReviewLog"]] = relationship(
        "ReviewLog", back_populates="flashcard", cascade="all, delete-orphan"
    )


class ReviewSession(Base):
    __tablename__ = "review_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    started_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime)
    cards_reviewed: Mapped[int] = mapped_column(Integer, default=0)
    cards_correct: Mapped[int] = mapped_column(Integer, default=0)
    filter_config: Mapped[str | None] = mapped_column(Text)  # JSON

    logs: Mapped[list["ReviewLog"]] = relationship(
        "ReviewLog", back_populates="session", cascade="all, delete-orphan"
    )


class ReviewLog(Base):
    __tablename__ = "review_logs"
    __table_args__ = (
        Index("ix_review_log_flashcard_id", "flashcard_id"),
        Index("ix_review_log_reviewed_at", "reviewed_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    session_id: Mapped[int] = mapped_column(Integer, ForeignKey("review_sessions.id", ondelete="CASCADE"), nullable=False)
    flashcard_id: Mapped[int] = mapped_column(Integer, ForeignKey("flashcards.id"), nullable=False)
    reviewed_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    quality: Mapped[int] = mapped_column(Integer, nullable=False)
    prev_interval: Mapped[int | None] = mapped_column(Integer)
    new_interval: Mapped[int | None] = mapped_column(Integer)
    prev_easiness: Mapped[float | None] = mapped_column(Float)
    new_easiness: Mapped[float | None] = mapped_column(Float)

    session: Mapped["ReviewSession"] = relationship("ReviewSession", back_populates="logs")
    flashcard: Mapped["Flashcard"] = relationship("Flashcard", back_populates="review_logs")
