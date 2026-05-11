from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.flashcard import Flashcard
from app.schemas.flashcard import FlashcardOut, FlashcardUpdate

router = APIRouter(prefix="/flashcards", tags=["flashcards"])


@router.get("", response_model=list[FlashcardOut])
def list_flashcards(
    source_id: int | None = Query(None),
    hsk_level: int | None = Query(None),
    tocfl_level: int | None = Query(None),
    tocfl_category: str | None = Query(None),
    suspended: bool | None = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    db: Session = Depends(get_db),
):
    q = db.query(Flashcard)
    if source_id is not None:
        q = q.filter(Flashcard.source_id == source_id)
    if hsk_level is not None:
        q = q.filter(Flashcard.hsk_level == hsk_level)
    if tocfl_level is not None:
        q = q.filter(Flashcard.tocfl_level == tocfl_level)
    if tocfl_category is not None:
        q = q.filter(Flashcard.tocfl_category == tocfl_category)
    if suspended is not None:
        q = q.filter(Flashcard.is_suspended == suspended)
    return q.order_by(Flashcard.created_at.desc()).limit(limit).offset(offset).all()


@router.get("/{card_id}", response_model=FlashcardOut)
def get_flashcard(card_id: int, db: Session = Depends(get_db)):
    card = db.get(Flashcard, card_id)
    if not card:
        raise HTTPException(404, "Flashcard not found")
    return card


@router.patch("/{card_id}", response_model=FlashcardOut)
def update_flashcard(card_id: int, body: FlashcardUpdate, db: Session = Depends(get_db)):
    card = db.get(Flashcard, card_id)
    if not card:
        raise HTTPException(404, "Flashcard not found")
    if body.is_suspended is not None:
        card.is_suspended = body.is_suspended
    if body.contextual_meaning is not None:
        card.contextual_meaning = body.contextual_meaning
    db.commit()
    db.refresh(card)
    return card
