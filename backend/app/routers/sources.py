from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.source import Source, Chapter
from app.models.word import Word, WordOccurrence
from app.schemas.source import SourceOut, SourceDetail, ChapterOut
from app.schemas.flashcard import WordOccurrenceOut

router = APIRouter(prefix="/sources", tags=["sources"])


@router.get("", response_model=list[SourceOut])
def list_sources(db: Session = Depends(get_db)):
    return db.query(Source).order_by(Source.created_at.desc()).all()


@router.get("/{source_id}", response_model=SourceDetail)
def get_source(source_id: int, db: Session = Depends(get_db)):
    source = db.get(Source, source_id)
    if not source:
        raise HTTPException(404, "Source not found")
    return source


@router.delete("/{source_id}", status_code=204)
def delete_source(source_id: int, db: Session = Depends(get_db)):
    source = db.get(Source, source_id)
    if not source:
        raise HTTPException(404, "Source not found")
    db.delete(source)
    db.commit()


@router.get("/{source_id}/chapters", response_model=list[ChapterOut])
def list_chapters(source_id: int, db: Session = Depends(get_db)):
    return (
        db.query(Chapter)
        .filter_by(source_id=source_id)
        .order_by(Chapter.sequence)
        .all()
    )


@router.get("/{source_id}/chapters/{chapter_id}/words", response_model=list[WordOccurrenceOut])
def list_chapter_words(
    source_id: int,
    chapter_id: int,
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db),
):
    rows = (
        db.query(WordOccurrence, Word)
        .join(Word, WordOccurrence.word_id == Word.id)
        .filter(WordOccurrence.chapter_id == chapter_id, WordOccurrence.source_id == source_id)
        .order_by(WordOccurrence.count.desc())
        .limit(limit)
        .offset(offset)
        .all()
    )
    result = []
    for occ, word in rows:
        result.append(WordOccurrenceOut(
            word_id=word.id,
            traditional=word.traditional,
            simplified=word.simplified,
            pinyin=word.pinyin,
            hsk_level=word.hsk_level,
            tocfl_level=word.tocfl_level,
            tocfl_category=word.tocfl_category,
            count=occ.count,
            context_snippet=occ.context_snippet,
        ))
    return result
