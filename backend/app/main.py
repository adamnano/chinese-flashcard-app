from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import init_db, SessionLocal
from app.nlp import classifier, tokenizer
from app.routers import ingest, sources, flashcards, review, stats


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize DB tables
    init_db()
    # Load HSK/TOCFL lookups into memory
    db = SessionLocal()
    try:
        classifier.load_lookups(db)
    finally:
        db.close()
    # Build known_words from classifier lookups — these already include Traditional
    # alt forms (e.g. 臺灣 from 台灣's text_alt) so they are correct for both the
    # re-merge pass and the jieba userdict (which needs the Traditional forms to
    # recognise compounds like 臺灣 before segmentation).
    known_words = set(classifier._hsk_lookup.keys()) | set(classifier._tocfl_lookup.keys())
    tokenizer.initialize(
        userdict_words=list(known_words) if known_words else None,
        known_words=known_words if known_words else None,
    )
    yield


app = FastAPI(title="Chinese Flashcard API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ingest.router, prefix="/api")
app.include_router(sources.router, prefix="/api")
app.include_router(flashcards.router, prefix="/api")
app.include_router(review.router, prefix="/api")
app.include_router(stats.router, prefix="/api")


@app.get("/api/health")
def health():
    return {"status": "ok"}
