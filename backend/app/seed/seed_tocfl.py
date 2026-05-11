"""Download TOCFL word list from PSeitz/tocfl and seed the database."""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../../.."))

import json
import httpx
from pathlib import Path
from app.config import settings
from app.database import SessionLocal, init_db
from app.models.vocabulary import TocflWord
from app.models.word import Word

TOCFL_URL = "https://raw.githubusercontent.com/PSeitz/tocfl/main/tocfl_words.json"
TOCFL_DIR = settings.data_dir / "tocfl"
TOCFL_FILE = TOCFL_DIR / "tocfl_words.json"


def download_tocfl() -> Path:
    if TOCFL_FILE.exists():
        print(f"  Cached: {TOCFL_FILE.name}")
        return TOCFL_FILE
    print("  Downloading TOCFL word list...")
    response = httpx.get(TOCFL_URL, follow_redirects=True, timeout=30)
    response.raise_for_status()
    TOCFL_FILE.write_bytes(response.content)
    print(f"  Saved: {TOCFL_FILE.name} ({len(response.content)} bytes)")
    return TOCFL_FILE


def seed_tocfl():
    TOCFL_DIR.mkdir(parents=True, exist_ok=True)
    download_tocfl()
    init_db()
    db = SessionLocal()
    total = 0
    try:
        content = TOCFL_FILE.read_text(encoding="utf-8")
        # Support both NDJSON and JSON array formats
        try:
            data = json.loads(content)
            if isinstance(data, list):
                entries = data
            else:
                entries = [data]
        except json.JSONDecodeError:
            entries = [json.loads(line) for line in content.splitlines() if line.strip()]

        batch = []
        for entry in entries:
            tocfl_id = entry.get("id") or entry.get("tocfl_id")
            text = entry.get("text") or entry.get("word", "")
            if not text:
                continue
            text_alt = entry.get("text_alt")
            if isinstance(text_alt, list):
                text_alt = json.dumps(text_alt, ensure_ascii=False)
            row = {
                "tocfl_id": int(tocfl_id) if tocfl_id is not None else total,
                "text": text,
                "text_alt": text_alt,
                "category": entry.get("category"),
                "tocfl_level": int(entry.get("tocfl_level", entry.get("level", 1))),
                "situation": entry.get("situation"),
                "zhuyin": entry.get("zhuyin"),
                "pinyin": entry.get("pinyin"),
            }
            batch.append(row)
            total += 1

        print(f"  Parsed {total} TOCFL entries. Upserting...")
        for i in range(0, len(batch), 500):
            chunk = batch[i:i + 500]
            for row in chunk:
                existing = db.query(TocflWord).filter_by(tocfl_id=row["tocfl_id"]).first()
                if existing:
                    for k, v in row.items():
                        setattr(existing, k, v)
                else:
                    db.add(TocflWord(**row))
            db.commit()
            print(f"  ...upserted {min(i + 500, len(batch))}/{len(batch)}")

        # Cross-populate words table
        print("Cross-populating words table from TOCFL...")
        tocfl_words = db.query(TocflWord).all()
        updated = 0
        for tw in tocfl_words:
            existing = db.query(Word).filter_by(traditional=tw.text).first()
            if existing:
                if existing.tocfl_level is None:
                    existing.tocfl_level = tw.tocfl_level
                    existing.tocfl_category = tw.situation
                    updated += 1
            else:
                db.add(Word(
                    traditional=tw.text,
                    pinyin=tw.pinyin,
                    tocfl_level=tw.tocfl_level,
                    tocfl_category=tw.situation,
                ))
                updated += 1
        db.commit()
        print(f"Words table updated: {updated} TOCFL entries merged. Total: {total}")
    finally:
        db.close()


if __name__ == "__main__":
    seed_tocfl()
