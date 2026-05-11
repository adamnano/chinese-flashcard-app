# 漢字卡 — Chinese Flashcard App

A local-first Traditional Chinese vocabulary learning app. Import PDFs, EPUBs, YouTube videos, or plain text — the app extracts vocabulary, classifies it by HSK/TOCFL difficulty, generates context-aware translations using GPT-4.1-mini, and turns everything into spaced-repetition flashcards.

## Quickstart

### Prerequisites
- Python 3.11+
- Node.js 20+
- Docker (for PostgreSQL)

### 1. Configure environment
```bash
cp .env.example backend/.env
# Edit backend/.env and add your OPENAI_API_KEY
```

### 2. Set up everything
```bash
make setup
```

This starts PostgreSQL, installs all dependencies, and downloads + seeds the HSK 3.0 (~11K words) and TOCFL (~14K words) vocabulary databases.

### 3. Start the app
```bash
make dev
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API docs: http://localhost:8000/docs

## Features

- **Import**: PDF, EPUB, YouTube (captions), plain text paste
- **NLP pipeline**: jieba tokenization → OpenCC Traditional Chinese normalization → HSK/TOCFL classification
- **Context-aware flashcards**: GPT-4.1-mini generates meanings specific to your text, not generic dictionary definitions
- **Spaced repetition**: SM-2 algorithm — review cards at optimally spaced intervals
- **Organize**: by source, chapter, HSK level, TOCFL level, or category
- **Progress tracking**: review streaks, heatmap, mastery stats

## Architecture

```
frontend/   Next.js 14 + TypeScript + Tailwind
backend/    Python FastAPI + SQLAlchemy
database    PostgreSQL (via Docker)
```

See the **About** page in the app for a detailed explanation of the text processing pipeline, meaning disambiguation, and spaced repetition algorithm.

## Development

```bash
make test    # run Python unit tests
make seed    # re-seed HSK/TOCFL data
make stop    # stop PostgreSQL
```
