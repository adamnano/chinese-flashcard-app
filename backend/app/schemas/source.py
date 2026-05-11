from datetime import datetime
from pydantic import BaseModel


class SourceOut(BaseModel):
    id: int
    title: str
    source_type: str
    origin: str | None
    created_at: datetime
    word_count: int
    status: str
    error_msg: str | None

    model_config = {"from_attributes": True}


class ChapterOut(BaseModel):
    id: int
    source_id: int
    title: str
    sequence: int
    word_count: int

    model_config = {"from_attributes": True}


class SourceDetail(SourceOut):
    chapters: list[ChapterOut] = []


class IngestTextRequest(BaseModel):
    title: str
    text: str


class IngestYoutubeRequest(BaseModel):
    title: str
    url: str


class IngestStatusOut(BaseModel):
    source_id: int
    status: str
    word_count: int
    error_msg: str | None
