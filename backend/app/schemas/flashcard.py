from datetime import datetime, date
from pydantic import BaseModel


class FlashcardOut(BaseModel):
    id: int
    word_id: int
    source_id: int | None
    traditional: str
    simplified: str | None
    pinyin: str | None
    contextual_meaning: str
    base_meaning: str | None
    example_sentence: str | None
    hsk_level: int | None
    tocfl_level: int | None
    tocfl_category: str | None
    created_at: datetime
    repetitions: int
    easiness: float
    interval: int
    next_review: date
    is_suspended: bool

    model_config = {"from_attributes": True}


class FlashcardUpdate(BaseModel):
    is_suspended: bool | None = None
    contextual_meaning: str | None = None


class WordOccurrenceOut(BaseModel):
    word_id: int
    traditional: str
    simplified: str | None
    pinyin: str | None
    hsk_level: int | None
    tocfl_level: int | None
    tocfl_category: str | None
    count: int
    context_snippet: str | None

    model_config = {"from_attributes": True}
