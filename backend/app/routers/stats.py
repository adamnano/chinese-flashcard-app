from datetime import date, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.database import get_db
from app.models.flashcard import Flashcard, ReviewLog
from app.models.source import Source

router = APIRouter(prefix="/stats", tags=["stats"])


class LevelCount(BaseModel):
    level: int | None
    count: int


class DailyReview(BaseModel):
    day: str  # YYYY-MM-DD
    count: int


class StatsOut(BaseModel):
    total_cards: int
    due_today: int
    mastered_cards: int  # interval >= 21
    streak_days: int
    hsk_distribution: list[LevelCount]
    tocfl_distribution: list[LevelCount]
    daily_reviews: list[DailyReview]  # last 60 days


class SourceStatsOut(BaseModel):
    source_id: int
    title: str
    total_cards: int
    mastered_cards: int
    due_today: int


@router.get("", response_model=StatsOut)
def get_stats(db: Session = Depends(get_db)):
    today = date.today()
    total = db.query(Flashcard).count()
    due = db.query(Flashcard).filter(Flashcard.next_review <= today, Flashcard.is_suspended == False).count()
    mastered = db.query(Flashcard).filter(Flashcard.interval >= 21).count()

    # HSK distribution
    hsk_dist = (
        db.query(Flashcard.hsk_level, func.count(Flashcard.id))
        .group_by(Flashcard.hsk_level)
        .all()
    )
    tocfl_dist = (
        db.query(Flashcard.tocfl_level, func.count(Flashcard.id))
        .group_by(Flashcard.tocfl_level)
        .all()
    )

    # Daily reviews last 60 days
    sixty_days_ago = today - timedelta(days=60)
    daily = (
        db.query(func.date(ReviewLog.reviewed_at), func.count(ReviewLog.id))
        .filter(ReviewLog.reviewed_at >= sixty_days_ago)
        .group_by(func.date(ReviewLog.reviewed_at))
        .all()
    )

    # Streak calculation
    streak = _compute_streak(db, today)

    return StatsOut(
        total_cards=total,
        due_today=due,
        mastered_cards=mastered,
        streak_days=streak,
        hsk_distribution=[LevelCount(level=r[0], count=r[1]) for r in hsk_dist],
        tocfl_distribution=[LevelCount(level=r[0], count=r[1]) for r in tocfl_dist],
        daily_reviews=[DailyReview(day=str(r[0]), count=r[1]) for r in daily],
    )


@router.get("/sources", response_model=list[SourceStatsOut])
def source_stats(db: Session = Depends(get_db)):
    today = date.today()
    sources = db.query(Source).filter(Source.status == "done").all()
    result = []
    for src in sources:
        total = db.query(Flashcard).filter_by(source_id=src.id).count()
        mastered = db.query(Flashcard).filter(
            Flashcard.source_id == src.id, Flashcard.interval >= 21
        ).count()
        due = db.query(Flashcard).filter(
            Flashcard.source_id == src.id,
            Flashcard.next_review <= today,
            Flashcard.is_suspended == False,
        ).count()
        result.append(SourceStatsOut(
            source_id=src.id,
            title=src.title,
            total_cards=total,
            mastered_cards=mastered,
            due_today=due,
        ))
    return result


def _compute_streak(db: Session, today: date) -> int:
    """Count consecutive days ending today with at least 1 review."""
    streak = 0
    day = today
    while True:
        count = (
            db.query(ReviewLog)
            .filter(func.date(ReviewLog.reviewed_at) == day)
            .count()
        )
        if count == 0:
            break
        streak += 1
        day -= timedelta(days=1)
    return streak
