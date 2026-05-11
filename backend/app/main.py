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
    # Initialize jieba with TOCFL userdict
    from app.models.vocabulary import TocflWord
    db = SessionLocal()
    try:
        tocfl_words = [row.text for row in db.query(TocflWord).all()]
    finally:
        db.close()
    tokenizer.initialize(userdict_words=tocfl_words if tocfl_words else None)
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
