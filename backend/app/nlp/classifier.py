"""Classify Chinese tokens by HSK 3.0 and TOCFL difficulty levels."""
from __future__ import annotations
from sqlalchemy.orm import Session
from app.models.vocabulary import HskWord, TocflWord

_hsk_lookup: dict[str, int] = {}
_tocfl_lookup: dict[str, dict] = {}
_loaded = False


def load_lookups(db: Session) -> None:
    global _loaded
    _hsk_lookup.clear()
    for row in db.query(HskWord).all():
        _hsk_lookup[row.traditional] = row.hsk_level

    _tocfl_lookup.clear()
    for row in db.query(TocflWord).all():
        _tocfl_lookup[row.text] = {
            "tocfl_level": row.tocfl_level,
            "tocfl_category": row.situation,
            "base_meaning": None,
        }
        # Also index simplified forms if text_alt contains them
        if row.text_alt:
            try:
                import json
                alts = json.loads(row.text_alt) if row.text_alt.startswith("[") else [row.text_alt]
                for alt in alts:
                    if alt and alt not in _tocfl_lookup:
                        _tocfl_lookup[alt] = _tocfl_lookup[row.text]
            except Exception:
                pass

    # Merge HSK base meanings into tocfl lookup for cross-reference
    for row in db.query(HskWord).all():
        if row.traditional in _tocfl_lookup:
            _tocfl_lookup[row.traditional]["base_meaning"] = row.meaning
        if row.traditional not in _tocfl_lookup:
            _tocfl_lookup[row.traditional] = {
                "tocfl_level": None,
                "tocfl_category": None,
                "base_meaning": row.meaning,
            }

    _loaded = True


def classify(token: str) -> dict:
    hsk = _hsk_lookup.get(token)
    tocfl = _tocfl_lookup.get(token, {})
    return {
        "hsk_level": hsk,
        "tocfl_level": tocfl.get("tocfl_level"),
        "tocfl_category": tocfl.get("tocfl_category"),
        "base_meaning": tocfl.get("base_meaning"),
    }


def classify_batch(tokens: list[str]) -> dict[str, dict]:
    return {t: classify(t) for t in tokens}


def is_loaded() -> bool:
    return _loaded
