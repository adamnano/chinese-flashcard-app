"""Extract (chapter_title, raw_text) tuples from PDF, EPUB, YouTube, or plain text."""
from __future__ import annotations
import re


def extract_text(raw: str) -> list[tuple[str, str]]:
    """Split plain text into sections of ~50 paragraphs each."""
    paragraphs = [p.strip() for p in re.split(r"\n{2,}", raw) if p.strip()]
    if not paragraphs:
        return [("Section 1", raw)]
    size = 50
    chapters = []
    for i in range(0, len(paragraphs), size):
        chunk = "\n\n".join(paragraphs[i:i + size])
        n = i // size + 1
        chapters.append((f"Section {n}", chunk))
    return chapters


def extract_pdf(file_path: str) -> list[tuple[str, str]]:
    import fitz  # pymupdf
    doc = fitz.open(file_path)
    chapter_re = re.compile(r"^(第[一二三四五六七八九十百千\d]+[章節回篇]|Chapter\s+\d+)", re.IGNORECASE)

    chapters: list[tuple[str, str]] = []
    current_title = "Chapter 1"
    current_pages: list[str] = []
    chapter_num = 1

    for page in doc:
        text = page.get_text("text")
        # Detect chapter headings in first 100 chars of page
        first_line = text.strip().splitlines()[0] if text.strip() else ""
        if chapter_re.match(first_line) and current_pages:
            chapters.append((current_title, "\n".join(current_pages)))
            current_title = first_line.strip()
            current_pages = []
            chapter_num += 1
        current_pages.append(text)

        # Also split on every 20 pages as fallback if no chapter headings detected
        if len(current_pages) >= 20 and not any(
            chapter_re.match(p.strip().splitlines()[0]) if p.strip() else False
            for p in current_pages
        ):
            chapters.append((f"Pages {page.number - 18}–{page.number + 1}", "\n".join(current_pages)))
            current_pages = []

    if current_pages:
        chapters.append((current_title, "\n".join(current_pages)))

    doc.close()
    return chapters if chapters else [("Full Document", "")]


def extract_epub(file_path: str) -> list[tuple[str, str]]:
    import ebooklib
    from ebooklib import epub
    from bs4 import BeautifulSoup

    book = epub.read_epub(file_path)
    chapters = []
    for item in book.get_items_of_type(ebooklib.ITEM_DOCUMENT):
        soup = BeautifulSoup(item.get_content(), "html.parser")
        title_tag = soup.find(["h1", "h2", "h3", "title"])
        title = title_tag.get_text(strip=True) if title_tag else item.get_name()
        text = soup.get_text(separator="\n", strip=True)
        if text.strip():
            chapters.append((title, text))
    return chapters if chapters else [("Full Book", "")]


def extract_youtube(url: str) -> list[tuple[str, str]]:
    from youtube_transcript_api import YouTubeTranscriptApi, NoTranscriptFound, TranscriptsDisabled

    video_id_match = re.search(
        r"(?:v=|youtu\.be/|embed/|shorts/)([A-Za-z0-9_-]{11})", url
    )
    if not video_id_match:
        raise ValueError(f"Could not extract video ID from URL: {url}")
    video_id = video_id_match.group(1)

    transcript = None
    for lang in ["zh-TW", "zh-Hant", "zh", "zh-Hans"]:
        try:
            transcript = YouTubeTranscriptApi.get_transcript(video_id, languages=[lang])
            break
        except (NoTranscriptFound, Exception):
            continue

    if transcript is None:
        # Try auto-generated
        try:
            transcript_list = YouTubeTranscriptApi.list_transcripts(video_id)
            for t in transcript_list:
                if "zh" in t.language_code:
                    transcript = t.fetch()
                    break
        except (TranscriptsDisabled, Exception):
            pass

    if not transcript:
        raise ValueError("No Chinese transcript available for this video.")

    # Group entries into ~5-minute chapters
    chapter_duration = 300  # seconds
    chapters = []
    current_entries: list[str] = []
    current_start = 0.0

    for entry in transcript:
        start = entry.get("start", 0)
        text = entry.get("text", "").strip()
        if not text:
            continue
        if start - current_start >= chapter_duration and current_entries:
            mm_start = int(current_start) // 60
            ss_start = int(current_start) % 60
            mm_end = int(start) // 60
            ss_end = int(start) % 60
            label = f"{mm_start:02d}:{ss_start:02d} – {mm_end:02d}:{ss_end:02d}"
            chapters.append((label, " ".join(current_entries)))
            current_entries = []
            current_start = start
        current_entries.append(text)

    if current_entries:
        mm = int(current_start) // 60
        ss = int(current_start) % 60
        chapters.append((f"{mm:02d}:{ss:02d} – end", " ".join(current_entries)))

    return chapters if chapters else [("Full Video", "")]
