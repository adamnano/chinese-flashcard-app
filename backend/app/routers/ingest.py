import asyncio
import json
import tempfile
import os
from io import BytesIO
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from app.database import get_db, SessionLocal
from app.models.source import Source
from app.schemas.source import (
    IngestTextRequest, IngestYoutubeRequest,
    IngestStatusOut, SourceOut, ChapterPreview,
)
from app.nlp import pipeline, extractor

router = APIRouter(prefix="/ingest", tags=["ingest"])


def _create_source(db: Session, title: str, source_type: str, origin: str | None = None) -> Source:
    source = Source(title=title, source_type=source_type, origin=origin, status="pending")
    db.add(source)
    db.commit()
    db.refresh(source)
    return source


def _filter_config(
    min_hsk_level: int | None,
    min_tocfl_level: int | None,
    include_unclassified: bool,
) -> dict:
    return {
        "min_hsk_level": min_hsk_level,
        "min_tocfl_level": min_tocfl_level,
        "include_unclassified": include_unclassified,
    }


# ── Preview endpoints (no source created) ─────────────────────────────────────

@router.post("/epub/chapters", response_model=list[ChapterPreview])
async def preview_epub_chapters(file: UploadFile = File(...)):
    """Extract chapter list from an EPUB without starting the pipeline."""
    content = await file.read()
    if not content:
        raise HTTPException(400, "Uploaded file is empty. Make sure the .epub is a single zip file, not an extracted folder.")
    with tempfile.NamedTemporaryFile(suffix=".epub", delete=False) as f:
        f.write(content)
        tmp_path = f.name
    try:
        chapters = extractor.extract_epub(tmp_path)
    except Exception as exc:
        raise HTTPException(400, f"Could not read EPUB: {exc}. Make sure the file is a valid .epub (zip archive), not an extracted folder.")
    finally:
        os.unlink(tmp_path)
    return [
        ChapterPreview(index=i, title=title, char_count=len(text))
        for i, (title, text) in enumerate(chapters)
    ]


@router.post("/pdf/chapters", response_model=list[ChapterPreview])
async def preview_pdf_chapters(file: UploadFile = File(...)):
    """Extract chapter/section list from a PDF without starting the pipeline."""
    content = await file.read()
    if not content:
        raise HTTPException(400, "Uploaded file is empty.")
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f:
        f.write(content)
        tmp_path = f.name
    try:
        chapters = extractor.extract_pdf(tmp_path)
    except Exception as exc:
        raise HTTPException(400, f"Could not read PDF: {exc}")
    finally:
        os.unlink(tmp_path)
    return [
        ChapterPreview(index=i, title=title, char_count=len(text))
        for i, (title, text) in enumerate(chapters)
    ]


# ── Ingest endpoints ───────────────────────────────────────────────────────────

@router.post("/text", response_model=SourceOut)
async def ingest_text(req: IngestTextRequest, db: Session = Depends(get_db)):
    source = _create_source(db, req.title, "text")
    fc = _filter_config(req.min_hsk_level, req.min_tocfl_level, req.include_unclassified)

    async def _task():
        db2 = SessionLocal()
        try:
            await pipeline.process_source(
                source.id, db2, input_type="text", input_data=req.text, filter_config=fc,
            )
        finally:
            db2.close()

    asyncio.create_task(_task())
    return source


@router.post("/youtube", response_model=SourceOut)
async def ingest_youtube(req: IngestYoutubeRequest, db: Session = Depends(get_db)):
    source = _create_source(db, req.title, "youtube", origin=req.url)
    fc = _filter_config(req.min_hsk_level, req.min_tocfl_level, req.include_unclassified)

    async def _task():
        db2 = SessionLocal()
        try:
            await pipeline.process_source(
                source.id, db2, input_type="youtube", input_data=req.url, filter_config=fc,
            )
        finally:
            db2.close()

    asyncio.create_task(_task())
    return source


@router.post("/pdf", response_model=SourceOut)
async def ingest_pdf(
    title: str = Form(...),
    file: UploadFile = File(...),
    selected_chapter_indices: str | None = Form(None),  # JSON-encoded list e.g. "[0,2,5]"
    min_hsk_level: int | None = Form(None),
    min_tocfl_level: int | None = Form(None),
    include_unclassified: bool = Form(True),
    db: Session = Depends(get_db),
):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "File must be a PDF")
    content = await file.read()
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f:
        f.write(content)
        tmp_path = f.name

    indices = json.loads(selected_chapter_indices) if selected_chapter_indices else None
    fc = _filter_config(min_hsk_level, min_tocfl_level, include_unclassified)
    source = _create_source(db, title, "pdf", origin=file.filename)

    async def _run():
        db2 = SessionLocal()
        try:
            await pipeline.process_source(
                source.id, db2,
                input_type="pdf", input_data=tmp_path,
                selected_chapter_indices=indices,
                filter_config=fc,
            )
        finally:
            db2.close()
            os.unlink(tmp_path)

    asyncio.create_task(_run())
    return source


@router.post("/epub", response_model=SourceOut)
async def ingest_epub(
    title: str = Form(...),
    file: UploadFile = File(...),
    selected_chapter_indices: str | None = Form(None),
    min_hsk_level: int | None = Form(None),
    min_tocfl_level: int | None = Form(None),
    include_unclassified: bool = Form(True),
    db: Session = Depends(get_db),
):
    if not file.filename or not file.filename.lower().endswith(".epub"):
        raise HTTPException(400, "File must be an EPUB")
    content = await file.read()
    with tempfile.NamedTemporaryFile(suffix=".epub", delete=False) as f:
        f.write(content)
        tmp_path = f.name

    indices = json.loads(selected_chapter_indices) if selected_chapter_indices else None
    fc = _filter_config(min_hsk_level, min_tocfl_level, include_unclassified)
    source = _create_source(db, title, "epub", origin=file.filename)

    async def _run():
        db2 = SessionLocal()
        try:
            await pipeline.process_source(
                source.id, db2,
                input_type="epub", input_data=tmp_path,
                selected_chapter_indices=indices,
                filter_config=fc,
            )
        finally:
            db2.close()
            os.unlink(tmp_path)

    asyncio.create_task(_run())
    return source


@router.post("/audio", response_model=SourceOut)
async def ingest_audio(
    title: str = Form(...),
    file: UploadFile = File(...),
    min_hsk_level: int | None = Form(None),
    min_tocfl_level: int | None = Form(None),
    include_unclassified: bool = Form(True),
    db: Session = Depends(get_db),
):
    """Accept an audio file, transcribe with Whisper, then process as Chinese text."""
    content = await file.read()
    if not content:
        raise HTTPException(400, "Uploaded audio file is empty.")

    from openai import AsyncOpenAI
    from app.config import settings as cfg

    oai = AsyncOpenAI(api_key=cfg.openai_api_key)
    audio_io = BytesIO(content)
    audio_io.name = file.filename or "recording.m4a"
    try:
        transcription = await oai.audio.transcriptions.create(
            model="whisper-1",
            file=audio_io,
            language="zh",
        )
    except Exception as exc:
        raise HTTPException(500, f"Whisper transcription failed: {exc}")

    transcript = transcription.text.strip()
    if not transcript:
        raise HTTPException(400, "Transcription produced empty text. Make sure the recording contains audible speech.")

    fc = _filter_config(min_hsk_level, min_tocfl_level, include_unclassified)
    source = _create_source(db, title, "audio")

    async def _run():
        db2 = SessionLocal()
        try:
            await pipeline.process_source(
                source.id, db2, input_type="text", input_data=transcript, filter_config=fc,
            )
        finally:
            db2.close()

    asyncio.create_task(_run())
    return source


@router.get("/{source_id}/status", response_model=IngestStatusOut)
def get_status(source_id: int, db: Session = Depends(get_db)):
    source = db.get(Source, source_id)
    if not source:
        raise HTTPException(404, "Source not found")
    return IngestStatusOut(
        source_id=source.id,
        status=source.status,
        word_count=source.word_count,
        error_msg=source.error_msg,
    )
