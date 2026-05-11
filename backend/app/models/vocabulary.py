from sqlalchemy import Integer, String, UniqueConstraint, Index
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class HskWord(Base):
    __tablename__ = "hsk_words"
    __table_args__ = (
        UniqueConstraint("traditional", name="uq_hsk_traditional"),
        Index("ix_hsk_traditional", "traditional"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    traditional: Mapped[str] = mapped_column(String, nullable=False)
    simplified: Mapped[str] = mapped_column(String, nullable=False)
    pinyin: Mapped[str] = mapped_column(String, nullable=False)
    meaning: Mapped[str] = mapped_column(String, nullable=False)
    hsk_level: Mapped[int] = mapped_column(Integer, nullable=False)


class TocflWord(Base):
    __tablename__ = "tocfl_words"
    __table_args__ = (
        UniqueConstraint("tocfl_id", name="uq_tocfl_id"),
        Index("ix_tocfl_text", "text"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    tocfl_id: Mapped[int] = mapped_column(Integer, nullable=False)
    text: Mapped[str] = mapped_column(String, nullable=False)
    text_alt: Mapped[str | None] = mapped_column(String)
    category: Mapped[str | None] = mapped_column(String)
    tocfl_level: Mapped[int] = mapped_column(Integer, nullable=False)
    situation: Mapped[str | None] = mapped_column(String)
    zhuyin: Mapped[str | None] = mapped_column(String)
    pinyin: Mapped[str | None] = mapped_column(String)
