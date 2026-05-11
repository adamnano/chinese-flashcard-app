import json
from datetime import datetime, date, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.flashcard import Flashcard, ReviewSession, ReviewLog
from app.schemas.review import (
    StartSessionRequest, SessionOut, AnswerRequest, AnswerOut,
    SessionSummary, DueCountOut,
)
from app.schemas.flashcard import FlashcardOut
from app.srs.sm2 import SM2State, compute_next

router = APIRouter(prefix="/review", tags=["review"])

# In-memory session state: session_id → list of remaining card IDs
_session_queues: dict[int, list[int]] = {}


def _due_query(db: Session, filter_cfg, suspended: bool = False):
    today = date.today()
    q = (
        db.query(Flashcard)
        .filter(Flashcard.next_review <= today, Flashcard.is_suspended == suspended)
    )
    if filter_cfg.source_ids:
        q = q.filter(Flashcard.source_id.in_(filter_cfg.source_ids))
    if filter_cfg.hsk_levels:
        q = q.filter(Flashcard.hsk_level.in_(filter_cfg.hsk_levels))
    if filter_cfg.tocfl_levels:
        q = q.filter(Flashcard.tocfl_level.in_(filter_cfg.tocfl_levels))
    return q


@router.get("/due-count", response_model=DueCountOut)
def due_count(
    source_id: int | None = Query(None),
    hsk_level: int | None = Query(None),
    db: Session = Depends(get_db),
):
    from app.schemas.review import ReviewFilterConfig
    cfg = ReviewFilterConfig(
        source_ids=[source_id] if source_id else None,
        hsk_levels=[hsk_level] if hsk_level else None,
    )
    today = date.today()
    week = today + timedelta(days=7)
    due_today = _due_query(db, cfg).count()
    due_week = (
        db.query(Flashcard)
        .filter(Flashcard.next_review <= week, Flashcard.is_suspended == False)
        .count()
    )
    return DueCountOut(due_today=due_today, due_this_week=due_week)


@router.post("/session", response_model=SessionOut)
def start_session(req: StartSessionRequest, db: Session = Depends(get_db)):
    cards = _due_query(db, req.filter).limit(req.filter.limit).all()
    session = ReviewSession(filter_config=json.dumps(req.filter.model_dump()))
    db.add(session)
    db.commit()
    db.refresh(session)

    card_ids = [c.id for c in cards]
    _session_queues[session.id] = card_ids[1:]  # first card returned immediately

    first_card = cards[0] if cards else None
    return SessionOut(
        session_id=session.id,
        total_due=len(cards),
        card=FlashcardOut.model_validate(first_card) if first_card else None,
    )


@router.post("/answer", response_model=AnswerOut)
def submit_answer(req: AnswerRequest, db: Session = Depends(get_db)):
    if not 0 <= req.quality <= 5:
        raise HTTPException(400, "Quality must be 0-5")

    session = db.get(ReviewSession, req.session_id)
    if not session:
        raise HTTPException(404, "Session not found")

    card = db.get(Flashcard, req.flashcard_id)
    if not card:
        raise HTTPException(404, "Flashcard not found")

    state = SM2State(
        repetitions=card.repetitions,
        easiness=card.easiness,
        interval=card.interval,
    )
    new_state, next_review = compute_next(state, req.quality)

    # Log the review
    db.add(ReviewLog(
        session_id=session.id,
        flashcard_id=card.id,
        quality=req.quality,
        prev_interval=card.interval,
        new_interval=new_state.interval,
        prev_easiness=card.easiness,
        new_easiness=new_state.easiness,
    ))

    # Update card SM-2 state
    prev_interval = card.interval
    card.repetitions = new_state.repetitions
    card.easiness = new_state.easiness
    card.interval = new_state.interval
    card.next_review = next_review

    # Update session stats
    session.cards_reviewed += 1
    if req.quality >= 3:
        session.cards_correct += 1

    db.commit()

    # Get next card
    queue = _session_queues.get(req.session_id, [])
    next_card = None
    while queue:
        next_id = queue.pop(0)
        next_card = db.get(Flashcard, next_id)
        if next_card and not next_card.is_suspended:
            break
        next_card = None

    _session_queues[req.session_id] = queue
    cards_remaining = len(queue)

    summary = None
    if not next_card:
        # Session complete
        session.ended_at = datetime.utcnow()
        db.commit()
        _session_queues.pop(req.session_id, None)
        accuracy = (session.cards_correct / session.cards_reviewed * 100) if session.cards_reviewed else 0.0
        summary = SessionSummary(
            session_id=session.id,
            cards_reviewed=session.cards_reviewed,
            cards_correct=session.cards_correct,
            accuracy_pct=round(accuracy, 1),
            ended_at=session.ended_at,
        )

    return AnswerOut(
        next_card=FlashcardOut.model_validate(next_card) if next_card else None,
        cards_remaining=cards_remaining,
        session_summary=summary,
    )
