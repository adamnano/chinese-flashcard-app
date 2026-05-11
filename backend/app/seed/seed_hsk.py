"""Download HSK 3.0 TSV files from krmanik/HSK-3.0 and seed the database."""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../../.."))

import httpx
from pathlib import Path
from app.config import settings
from app.database import SessionLocal, init_db
from app.models.vocabulary import HskWord
from app.models.word import Word

HSK_TSV_URLS: dict[int, str] = {
    1: "https://raw.githubusercontent.com/krmanik/HSK-3.0/main/Scripts%20and%20data/tsv/HSK%201.tsv",
    2: "https://raw.githubusercontent.com/krmanik/HSK-3.0/main/Scripts%20and%20data/tsv/HSK%202.tsv",
    3: "https://raw.githubusercontent.com/krmanik/HSK-3.0/main/Scripts%20and%20data/tsv/HSK%203.tsv",
    4: "https://raw.githubusercontent.com/krmanik/HSK-3.0/main/Scripts%20and%20data/tsv/HSK%204.tsv",
    5: "https://raw.githubusercontent.com/krmanik/HSK-3.0/main/Scripts%20and%20data/tsv/HSK%205.tsv",
    6: "https://raw.githubusercontent.com/krmanik/HSK-3.0/main/Scripts%20and%20data/tsv/HSK%206.tsv",
    7: "https://raw.githubusercontent.com/krmanik/HSK-3.0/main/Scripts%20and%20data/tsv/HSK%207-9.tsv",
}

HSK_DIR = settings.data_dir / "hsk"


def download_tsv(level: int, url: str) -> Path:
    filename = HSK_DIR / f"hsk_{level}.tsv"
    if filename.exists():
        print(f"  Cached: {filename.name}")
        return filename
    print(f"  Downloading HSK {level}...")
    response = httpx.get(url, follow_redirects=True, timeout=30)
    response.raise_for_status()
    filename.write_bytes(response.content)
    print(f"  Saved: {filename.name} ({len(response.content)} bytes)")
    return filename


def parse_tsv(path: Path, level: int) -> list[dict]:
    rows = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        parts = line.split("\t")
        if len(parts) < 4:
            continue
        traditional, simplified, pinyin, meaning = parts[0], parts[1], parts[2], parts[3]
        rows.append({
            "traditional": traditional.strip(),
            "simplified": simplified.strip(),
            "pinyin": pinyin.strip(),
            "meaning": meaning.strip(),
            "hsk_level": level,
        })
    return rows


def seed_hsk():
    HSK_DIR.mkdir(parents=True, exist_ok=True)
    init_db()
    db = SessionLocal()
    total = 0
    try:
        for level, url in HSK_TSV_URLS.items():
            path = download_tsv(level, url)
            rows = parse_tsv(path, level)
            for row in rows:
                existing = db.query(HskWord).filter_by(traditional=row["traditional"]).first()
                if existing:
                    for k, v in row.items():
                        setattr(existing, k, v)
                else:
                    db.add(HskWord(**row))
            db.commit()
            print(f"  HSK {level}: {len(rows)} words seeded")
            total += len(rows)

        # Cross-populate words table
        print("Cross-populating words table from HSK...")
        hsk_words = db.query(HskWord).all()
        for hw in hsk_words:
            existing = db.query(Word).filter_by(traditional=hw.traditional).first()
            if existing:
                existing.simplified = existing.simplified or hw.simplified
                existing.pinyin = existing.pinyin or hw.pinyin
                existing.hsk_level = hw.hsk_level
            else:
                db.add(Word(
                    traditional=hw.traditional,
                    simplified=hw.simplified,
                    pinyin=hw.pinyin,
                    hsk_level=hw.hsk_level,
                ))
        db.commit()
        print(f"Words table updated. Total HSK entries: {total}")
    finally:
        db.close()


if __name__ == "__main__":
    seed_hsk()
