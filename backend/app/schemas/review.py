from datetime import datetime
from pydantic import BaseModel
from app.schemas.flashcard import FlashcardOut


class ReviewFilterConfig(BaseModel):
    source_ids: list[int] | None = None
    hsk_levels: list[int] | None = None
    tocfl_levels: list[int] | None = None
    limit: int = 20  # max cards per session


class StartSessionRequest(BaseModel):
    filter: ReviewFilterConfig = ReviewFilterConfig()


class SessionOut(BaseModel):
    session_id: int
    total_due: int
    card: FlashcardOut | None


class AnswerRequest(BaseModel):
    session_id: int
    flashcard_id: int
    quality: int  # 0-5


class SessionSummary(BaseModel):
    session_id: int
    cards_reviewed: int
    cards_correct: int
    accuracy_pct: float
    ended_at: datetime


class AnswerOut(BaseModel):
    next_card: FlashcardOut | None
    cards_remaining: int
    session_summary: SessionSummary | None  # set when session is complete


class DueCountOut(BaseModel):
    due_today: int
    due_this_week: int
