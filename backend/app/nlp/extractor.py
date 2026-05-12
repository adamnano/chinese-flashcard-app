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


def extract_pdf(file_path: str, selected_indices: list[int] | None = None) -> list[tuple[str, str]]:
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
    result = chapters if chapters else [("Full Document", "")]
    if selected_indices is not None:
        result = [result[i] for i in selected_indices if i < len(result)]
    return result


def _extract_flat_epub(file_path: str) -> list[tuple[str, str]] | None:
    """Fallback parser for flat EPUBs where all files are at zip root (no META-INF/).
    Reads the OPF spine directly and extracts text from XHTML files without ebooklib."""
    import zipfile, xml.etree.ElementTree as ET
    from bs4 import BeautifulSoup

    try:
        with zipfile.ZipFile(file_path) as zf:
            names = set(zf.namelist())

            # Find OPF: try common names
            opf_name = next((n for n in ('content.opf', 'package.opf', 'book.opf') if n in names), None)
            if not opf_name:
                opf_name = next((n for n in names if n.endswith('.opf')), None)
            if not opf_name:
                return None

            opf = ET.fromstring(zf.read(opf_name).decode('utf-8', errors='replace'))
            ns = {'opf': 'http://www.idpf.org/2007/opf'}

            # Build id→href map from manifest, resolving to the basename that's in the zip
            manifest: dict[str, str] = {}
            for item in opf.findall('.//opf:item', ns):
                item_id = item.get('id', '')
                href = item.get('href', '')
                basename = href.split('/')[-1]
                if basename in names:
                    manifest[item_id] = basename

            # Spine order
            spine_el = opf.find('.//opf:spine', ns)
            if spine_el is None:
                return None
            spine_ids = [ref.get('idref', '') for ref in spine_el]

            # NCX / nav TOC → title map
            toc_titles: dict[str, str] = {}
            ncx_id = spine_el.get('toc', '')
            ncx_file = manifest.get(ncx_id, '')
            if ncx_file and ncx_file in names:
                try:
                    ncx = ET.fromstring(zf.read(ncx_file).decode('utf-8', errors='replace'))
                    ncx_ns = {'ncx': 'http://www.daisy.org/z3986/2005/ncx/'}
                    for nav in ncx.findall('.//ncx:navPoint', ncx_ns):
                        label = nav.find('.//ncx:text', ncx_ns)
                        content = nav.find('ncx:content', ncx_ns)
                        if label is not None and content is not None:
                            src = content.get('src', '').split('#')[0].split('/')[-1]
                            toc_titles[src] = (label.text or '').strip()
                except Exception:
                    pass

            skip_re = re.compile(
                r'(cover|copyright|colophon|toc|contents|nav|ncx|'
                r'dedication|epigraph|halftitle|titlepage|'
                r'acknowledgment|foreword|preface|'
                r'appendix|afterword|index|bibliography)',
                re.IGNORECASE,
            )

            def cjk_count(t: str) -> int:
                return sum(1 for c in t if '一' <= c <= '鿿')

            raw: list[tuple[str, str]] = []
            for item_id in spine_ids:
                fname = manifest.get(item_id)
                if not fname or skip_re.search(fname):
                    continue
                try:
                    html = zf.read(fname).decode('utf-8', errors='replace')
                except KeyError:
                    continue
                soup = BeautifulSoup(html, 'html.parser')
                text = soup.get_text(separator='\n', strip=True)
                if cjk_count(text) < 50:
                    continue
                title = toc_titles.get(fname)
                if not title:
                    h = soup.find(['h1', 'h2', 'h3'])
                    title = h.get_text(strip=True) if h else re.sub(r'\.[^.]+$', '', fname)
                raw.append((title, text))

            # Merge short chapters
            merged: list[tuple[str, str]] = []
            pending_title: str | None = None
            pending_text = ''
            for title, text in raw:
                if pending_title is None:
                    pending_title, pending_text = title, text
                elif cjk_count(pending_text) < 200:
                    pending_text += '\n\n' + text
                else:
                    merged.append((pending_title, pending_text))
                    pending_title, pending_text = title, text
            if pending_title:
                merged.append((pending_title, pending_text))

            return merged if merged else None
    except Exception:
        return None


def extract_epub(file_path: str, selected_indices: list[int] | None = None) -> list[tuple[str, str]]:
    import ebooklib
    from ebooklib import epub
    from bs4 import BeautifulSoup

    # Filenames that indicate non-content pages → skip
    _SKIP_RE = re.compile(
        r"(cover|copyright|colophon|toc|contents|nav|ncx|"
        r"dedication|epigraph|halftitle|titlepage|"
        r"acknowledgment|foreword|preface|introduction|"
        r"appendix|afterword|index|bibliography|"
        r"about.the.author|back.matter|front.matter)",
        re.IGNORECASE,
    )

    def _cjk_count(text: str) -> int:
        return sum(1 for c in text if "一" <= c <= "鿿")

    def _build_toc_map(toc) -> dict[str, str]:
        """Flatten nested TOC into {href_basename: title}.

        Section titles take priority over anchor-level child links that point
        to the same file — e.g. a chapter section '第一章' whose sub-links all
        use anchors within the same xhtml file should keep the chapter title.
        """
        result: dict[str, str] = {}
        for entry in toc:
            if isinstance(entry, epub.Link):
                href_file = entry.href.split("#")[0]
                # Only set if not already claimed by a higher-level section entry
                if href_file not in result and entry.title:
                    result[href_file] = entry.title
            elif isinstance(entry, tuple) and len(entry) == 2:
                section, children = entry
                if hasattr(section, "href") and section.href and section.title:
                    # Section-level entry: write first so children don't overwrite it
                    href_file = section.href.split("#")[0]
                    result[href_file] = section.title
                result.update({k: v for k, v in _build_toc_map(children).items() if k not in result})
        return result

    fixed_path = None
    try:
        book = epub.read_epub(file_path)
    except KeyError:
        # Flat EPUB (no META-INF directory, or mismatched manifest paths)
        # Parse directly without ebooklib
        flat_result = _extract_flat_epub(file_path)
        if flat_result is not None:
            if selected_indices is not None:
                flat_result = [flat_result[i] for i in selected_indices if i < len(flat_result)]
            return flat_result
        raise

    toc_map = _build_toc_map(book.toc)
    # Normalise keys: strip leading path component so "Text/ch01.xhtml" → "ch01.xhtml"
    toc_map = {k.split("/")[-1]: v for k, v in toc_map.items()} | toc_map

    # Collect items in spine order (the intended reading sequence)
    spine_ids = [item_id for item_id, _linear in book.spine]
    id_to_item = {item.get_id(): item for item in book.get_items_of_type(ebooklib.ITEM_DOCUMENT)}

    raw_chapters: list[tuple[str, str]] = []
    for item_id in spine_ids:
        item = id_to_item.get(item_id)
        if item is None:
            continue

        name = item.get_name()
        basename = name.split("/")[-1]

        # Skip known non-content filenames
        if _SKIP_RE.search(basename) or _SKIP_RE.search(name):
            continue

        soup = BeautifulSoup(item.get_content(), "html.parser")
        text = soup.get_text(separator="\n", strip=True)

        # Skip pages that are mostly non-Chinese (< 50 CJK chars)
        if _cjk_count(text) < 50:
            continue

        # Resolve title: TOC map → heading tag → clean basename
        title = (
            toc_map.get(basename)
            or toc_map.get(name)
        )
        if not title:
            heading = soup.find(["h1", "h2", "h3"])
            title = heading.get_text(strip=True) if heading else re.sub(r"\.[^.]+$", "", basename)

        raw_chapters.append((title, text))

    # Merge very short chapters (< 200 CJK chars) into the following chapter
    merged: list[tuple[str, str]] = []
    pending_title: str | None = None
    pending_text: str = ""
    for title, text in raw_chapters:
        if pending_title is None:
            pending_title, pending_text = title, text
        elif _cjk_count(pending_text) < 200:
            # current pending is too short — append to it and keep waiting
            pending_text += "\n\n" + text
        else:
            merged.append((pending_title, pending_text))
            pending_title, pending_text = title, text
    if pending_title is not None:
        merged.append((pending_title, pending_text))

    result = merged if merged else [("Full Book", "")]
    if selected_indices is not None:
        result = [result[i] for i in selected_indices if i < len(result)]
    return result


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
