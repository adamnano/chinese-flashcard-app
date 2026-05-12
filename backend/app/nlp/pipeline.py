"""Orchestrate the full text-to-flashcards pipeline for a source."""
from __future__ import annotations
import asyncio
from sqlalchemy.orm import Session
from app.config import settings
from app.models.source import Source, Chapter
from app.models.word import Word, WordOccurrence
from app.models.flashcard import Flashcard
from app.nlp import extractor, normalizer, tokenizer, classifier, disambiguator


async def process_source(
    source_id: int,
    db: Session,
    *,
    input_type: str,
    input_data: str,
    selected_chapter_indices: list[int] | None = None,
    filter_config: dict | None = None,
) -> None:
    """Full pipeline: extract → normalize → tokenize → classify → LLM → flashcards."""
    source = db.get(Source, source_id)
    if not source:
        return

    source.status = "processing"
    db.commit()

    try:
        await _run_pipeline(
            source, db,
            input_type=input_type,
            input_data=input_data,
            selected_chapter_indices=selected_chapter_indices,
            filter_config=filter_config or {},
        )
        db.commit()
    except Exception as exc:
        source.status = "error"
        source.error_msg = str(exc)
        db.commit()
        raise


async def _run_pipeline(
    source: Source,
    db: Session,
    *,
    input_type: str,
    input_data: str,
    selected_chapter_indices: list[int] | None = None,
    filter_config: dict,
) -> None:
    # 1. Extract chapters (optionally filtered by user-selected indices)
    chapters_raw = _extract(input_type, input_data, selected_indices=selected_chapter_indices)

    # Ensure lookups are loaded
    if not classifier.is_loaded():
        classifier.load_lookups(db)

    all_llm_candidates: list[dict] = []
    chapter_word_map: dict[int, list[dict]] = {}  # chapter.id → token dicts

    # 2-5. Normalize, tokenize, classify, upsert for each chapter
    for seq, (title, raw_text) in enumerate(chapters_raw):
        normalized = normalizer.normalize(raw_text)
        tokens = tokenizer.tokenize_with_context(normalized)

        chapter = Chapter(
            source_id=source.id,
            title=title,
            sequence=seq,
            raw_text=raw_text,
            word_count=len(tokens),
        )
        db.add(chapter)
        db.flush()  # get chapter.id

        classifications = classifier.classify_batch([t["word"] for t in tokens])

        for token_dict in tokens:
            word_str = token_dict["word"]
            cls = classifications[word_str]

            # Upsert Word
            word_row = db.query(Word).filter_by(traditional=word_str).first()
            if not word_row:
                word_row = Word(
                    traditional=word_str,
                    hsk_level=cls["hsk_level"],
                    tocfl_level=cls["tocfl_level"],
                    tocfl_category=cls["tocfl_category"],
                )
                db.add(word_row)
                db.flush()
            else:
                if word_row.hsk_level is None:
                    word_row.hsk_level = cls["hsk_level"]
                if word_row.tocfl_level is None:
                    word_row.tocfl_level = cls["tocfl_level"]

            # Upsert WordOccurrence
            occ = (
                db.query(WordOccurrence)
                .filter_by(word_id=word_row.id, chapter_id=chapter.id)
                .first()
            )
            if occ:
                occ.count += token_dict["count"]
            else:
                db.add(WordOccurrence(
                    word_id=word_row.id,
                    chapter_id=chapter.id,
                    source_id=source.id,
                    count=token_dict["count"],
                    context_snippet=token_dict.get("context_snippet", ""),
                ))

            token_dict["word_id"] = word_row.id
            token_dict["hsk_level"] = cls["hsk_level"]
            token_dict["tocfl_level"] = cls["tocfl_level"]
            token_dict["tocfl_category"] = cls["tocfl_category"]
            token_dict["base_meaning"] = cls["base_meaning"]

        chapter_word_map[chapter.id] = tokens
        db.commit()

    # 6. Collect LLM candidates (words needing flashcards in this source)
    seen_words: set[str] = set()
    for tokens in chapter_word_map.values():
        for t in tokens:
            if t["word"] not in seen_words:
                seen_words.add(t["word"])
                all_llm_candidates.append(t)

    # 7. Batch LLM disambiguation
    llm_results: dict[str, dict] = {}
    if settings.openai_api_key and all_llm_candidates:
        llm_results = await disambiguator.disambiguate_all(
            all_llm_candidates,
            api_key=settings.openai_api_key,
        )

    # 8. Create flashcards
    total_cards = 0
    for token_dict in all_llm_candidates:
        word_str = token_dict["word"]
        word_row = db.query(Word).filter_by(traditional=word_str).first()
        if not word_row:
            continue

        # One card per (word, source)
        existing = (
            db.query(Flashcard)
            .filter_by(word_id=word_row.id, source_id=source.id)
            .first()
        )
        if existing:
            continue

        llm = llm_results.get(word_str, {})
        # Uncertain single chars need explicit LLM approval; confirmed words
        # are included unless the LLM explicitly rejects them.
        is_uncertain = token_dict.get("uncertain", False)
        create_flashcard = llm.get("create_flashcard", not is_uncertain)
        if not create_flashcard:
            continue

        # Apply vocabulary level filter
        if not _passes_level_filter(token_dict, filter_config):
            continue

        # base_meaning  → short direct translation ("patience", "tea farmer")
        # contextual_meaning → "Refers to..." sentence shown on demand
        short_meaning = llm.get("meaning") or token_dict.get("base_meaning") or ""
        context_note = llm.get("context_note") or ""
        fallback_meaning = token_dict.get("base_meaning") or token_dict.get("context_snippet", "")
        example = llm.get("example") or token_dict.get("context_snippet", "")

        pinyin = word_row.pinyin or llm.get("pinyin") or None
        # Also backfill the words table so future sources benefit
        if not word_row.pinyin and pinyin:
            word_row.pinyin = pinyin

        card = Flashcard(
            word_id=word_row.id,
            source_id=source.id,
            traditional=word_str,
            simplified=word_row.simplified,
            pinyin=pinyin,
            base_meaning=short_meaning or fallback_meaning,
            contextual_meaning=context_note or fallback_meaning,
            example_sentence=example,
            hsk_level=token_dict["hsk_level"],
            tocfl_level=token_dict["tocfl_level"],
            tocfl_category=token_dict["tocfl_category"],
        )
        db.add(card)
        total_cards += 1

    source.word_count = len(seen_words)
    source.status = "done"
    db.commit()


def _extract(
    input_type: str,
    input_data: str,
    selected_indices: list[int] | None = None,
) -> list[tuple[str, str]]:
    match input_type:
        case "text":
            return extractor.extract_text(input_data)
        case "pdf":
            return extractor.extract_pdf(input_data, selected_indices=selected_indices)
        case "epub":
            return extractor.extract_epub(input_data, selected_indices=selected_indices)
        case "youtube":
            return extractor.extract_youtube(input_data)
        case _:
            raise ValueError(f"Unknown input type: {input_type}")


def _passes_level_filter(token_dict: dict, filter_config: dict) -> bool:
    """Return True if this word should have a flashcard created given the level filter."""
    if not filter_config:
        return True

    min_hsk = filter_config.get("min_hsk_level")
    min_tocfl = filter_config.get("min_tocfl_level")
    include_unclassified = filter_config.get("include_unclassified", True)

    hsk = token_dict.get("hsk_level")
    tocfl = token_dict.get("tocfl_level")

    # Unclassified: both levels are None
    if hsk is None and tocfl is None:
        return include_unclassified

    # Check each framework independently; a word passes if it meets all
    # filters that are applicable to it.
    if hsk is not None and min_hsk is not None and hsk < min_hsk:
        return False
    if tocfl is not None and min_tocfl is not None and tocfl < min_tocfl:
        return False
    return True
