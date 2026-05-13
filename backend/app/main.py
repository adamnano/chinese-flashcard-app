from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import init_db, SessionLocal
from app.nlp import classifier, tokenizer
from app.routers import ingest, sources, flashcards, review, stats


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("startup: begin", flush=True)
    try:
        init_db()
        print("startup: init_db done", flush=True)
    except Exception as e:
        print(f"startup: init_db FAILED: {e}", flush=True)
    try:
        db = SessionLocal()
        try:
            classifier.load_lookups(db)
        finally:
            db.close()
        print("startup: classifier done", flush=True)
    except Exception as e:
        print(f"startup: classifier FAILED: {e}", flush=True)
    try:
        known_words = set(classifier._hsk_lookup.keys()) | set(classifier._tocfl_lookup.keys())
        tokenizer.initialize(
            userdict_words=list(known_words) if known_words else None,
            known_words=known_words if known_words else None,
        )
        print(f"startup: tokenizer done ({len(known_words)} words)", flush=True)
    except Exception as e:
        print(f"startup: tokenizer FAILED: {e}", flush=True)
    print("startup: complete", flush=True)
    yield


app = FastAPI(title="Chinese Flashcard API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
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
