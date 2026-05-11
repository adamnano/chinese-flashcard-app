import asyncio
import tempfile
import os
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.source import Source
from app.schemas.source import IngestTextRequest, IngestYoutubeRequest, IngestStatusOut, SourceOut
from app.nlp import pipeline

router = APIRouter(prefix="/ingest", tags=["ingest"])


def _create_source(db: Session, title: str, source_type: str, origin: str | None = None) -> Source:
    source = Source(title=title, source_type=source_type, origin=origin, status="pending")
    db.add(source)
    db.commit()
    db.refresh(source)
    return source


@router.post("/text", response_model=SourceOut)
async def ingest_text(req: IngestTextRequest, db: Session = Depends(get_db)):
    source = _create_source(db, req.title, "text")
    asyncio.create_task(
        pipeline.process_source(source.id, db, input_type="text", input_data=req.text)
    )
    return source


@router.post("/youtube", response_model=SourceOut)
async def ingest_youtube(req: IngestYoutubeRequest, db: Session = Depends(get_db)):
    source = _create_source(db, req.title, "youtube", origin=req.url)
    asyncio.create_task(
        pipeline.process_source(source.id, db, input_type="youtube", input_data=req.url)
    )
    return source


@router.post("/pdf", response_model=SourceOut)
async def ingest_pdf(
    title: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "File must be a PDF")
    content = await file.read()
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f:
        f.write(content)
        tmp_path = f.name
    source = _create_source(db, title, "pdf", origin=file.filename)

    async def _run():
        try:
            await pipeline.process_source(source.id, db, input_type="pdf", input_data=tmp_path)
        finally:
            os.unlink(tmp_path)

    asyncio.create_task(_run())
    return source


@router.post("/epub", response_model=SourceOut)
async def ingest_epub(
    title: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    if not file.filename or not file.filename.lower().endswith(".epub"):
        raise HTTPException(400, "File must be an EPUB")
    content = await file.read()
    with tempfile.NamedTemporaryFile(suffix=".epub", delete=False) as f:
        f.write(content)
        tmp_path = f.name
    source = _create_source(db, title, "epub", origin=file.filename)

    async def _run():
        try:
            await pipeline.process_source(source.id, db, input_type="epub", input_data=tmp_path)
        finally:
            os.unlink(tmp_path)

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
