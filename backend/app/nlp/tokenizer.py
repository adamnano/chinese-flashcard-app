"""Segment Chinese text with jieba, filter noise and stopwords.

Tokenization quality is improved through three layers:
1. Userdict: both HSK and TOCFL words are loaded into jieba so it recognises
   Traditional Chinese compounds before segmentation.
2. Re-merge pass: after jieba.cut(), any run of single-character CJK tokens
   is checked against the known-word set; if consecutive chars form a known
   word they are merged back (e.g. 臺+灣 → 臺灣).
3. Single-char filter: a lone CJK character is only kept as a flashcard
   candidate if it appears as a standalone word in HSK or TOCFL.
"""
import re
import unicodedata
import jieba
from pathlib import Path

CJK_RE = re.compile(r"[一-鿿㐀-䶿豈-﫿]")

# Grammatical particles and function words that are never useful as flashcards
GRAMMAR_PARTICLES = {
    "的", "了", "嗎", "吧", "啊", "呢", "哦", "喔", "哈", "呀", "嗯",
    "是", "不", "也", "都", "很", "就", "在", "有", "和", "或", "與",
    "但", "而", "把", "被", "讓", "給", "對", "從", "到", "於", "以",
    "及", "等", "各", "其", "此", "那", "這", "哪", "什麼", "怎麼",
    "為什麼", "因為", "所以", "如果", "雖然", "但是", "然而", "而且",
    "並且", "不但", "不僅", "既然", "只要", "除非", "無論", "不管",
    "一", "二", "三", "四", "五", "六", "七", "八", "九", "十",
    "個", "件", "本", "些", "種", "位", "張", "條", "隻", "頭",
}

_stopwords: set[str] = set()
_known_words: set[str] = set()       # all HSK + TOCFL words (for re-merge & single-char filter)
_known_single_chars: set[str] = set() # subset: single-char entries in HSK/TOCFL
_initialized = False


def _load_stopwords() -> None:
    sw_path = Path(__file__).parent / "stopwords_zh.txt"
    if sw_path.exists():
        _stopwords.update(sw_path.read_text(encoding="utf-8").splitlines())
    _stopwords.update(GRAMMAR_PARTICLES)


def _init_jieba(userdict_words: list[str] | None = None) -> None:
    jieba.setLogLevel(20)
    if userdict_words:
        import tempfile, os
        with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", suffix=".txt", delete=False) as f:
            for w in userdict_words:
                if w.strip():
                    f.write(f"{w.strip()}\n")
            tmp = f.name
        jieba.load_userdict(tmp)
        os.unlink(tmp)


def initialize(
    userdict_words: list[str] | None = None,
    known_words: set[str] | None = None,
) -> None:
    """
    userdict_words: passed directly to jieba (HSK + TOCFL combined)
    known_words: full set of HSK + TOCFL headwords used for re-merge and
                 single-char validation
    """
    global _initialized
    _load_stopwords()
    _init_jieba(userdict_words)
    if known_words:
        _known_words.update(known_words)
        _known_single_chars.update(w for w in known_words if len(w) == 1)
    _initialized = True


# Structural particles that jieba sometimes attaches to the preceding character,
# producing tokens like "灣的" that block compound re-merging.
_STRUCTURAL_PARTICLES = {"的", "地", "得"}


# ---------------------------------------------------------------------------
# Particle-split pass (runs before re-merge)
# ---------------------------------------------------------------------------

def _split_trailing_particles(tokens: list[str]) -> list[str]:
    """Split tokens where a CJK prefix is followed by a structural particle.

    jieba occasionally produces '灣的' as one token. Splitting it to
    ['灣', '的'] lets the re-merge pass assemble 臺+灣 → 臺灣 normally.
    Only 的/地/得 are split (the most common cases); 了 and other finals
    are left intact to avoid breaking multi-char words that end in those chars.
    """
    result: list[str] = []
    for tok in tokens:
        if len(tok) >= 2 and tok[-1] in _STRUCTURAL_PARTICLES and _has_cjk(tok[-2]):
            result.append(tok[:-1])
            result.append(tok[-1])
        else:
            result.append(tok)
    return result


# ---------------------------------------------------------------------------
# Re-merge pass
# ---------------------------------------------------------------------------

def _remerge_single_char_runs(raw_tokens: list[str]) -> list[str]:
    """
    After jieba.cut(), scan for consecutive single-character CJK tokens.
    When 2, 3, or 4 consecutive single chars concatenate to form a word
    in the known-word set, replace them with that compound word.

    Only single-char tokens are candidates for merging: correctly identified
    multi-character tokens (e.g. '烏龍') are left intact.

    Longest match is preferred (4-gram > 3-gram > 2-gram).
    """
    if not _known_words:
        return raw_tokens

    result: list[str] = []
    i = 0
    while i < len(raw_tokens):
        tok = raw_tokens[i]
        # Only attempt merge when the current token is a single CJK char
        if len(tok) == 1 and _has_cjk(tok):
            merged = False
            for n in (4, 3, 2):
                end = i + n
                if end > len(raw_tokens):
                    continue
                window = raw_tokens[i:end]
                # All components must be single CJK chars
                if not all(len(c) == 1 and _has_cjk(c) for c in window):
                    continue
                candidate = "".join(window)
                if candidate in _known_words:
                    result.append(candidate)
                    i = end
                    merged = True
                    break
            if not merged:
                result.append(tok)
                i += 1
        else:
            result.append(tok)
            i += 1
    return result


# ---------------------------------------------------------------------------
# Token validation
# ---------------------------------------------------------------------------

def _has_cjk(token: str) -> bool:
    return bool(CJK_RE.search(token))


def _is_valid_token(token: str) -> bool:
    if not _has_cjk(token):
        return False
    if token in _stopwords:
        return False

    if len(token) == 1:
        # Punctuation-category single chars are always dropped
        if unicodedata.category(token[0]) in ("Po", "Ps", "Pe", "Pi", "Pf", "Pd"):
            return False
        # CJK single chars are only kept if they are standalone vocabulary
        # in HSK or TOCFL. Characters like 臺, 灣, 勁 that only appear in
        # compounds are excluded because _known_single_chars won't contain them.
        if _known_single_chars:
            return token in _known_single_chars
        # If known_words haven't been loaded yet (e.g. in tests), allow through
        return True

    return True


# ---------------------------------------------------------------------------
# Context extraction
# ---------------------------------------------------------------------------

def _extract_context(text: str, token: str, window: int = 80) -> str:
    """Return a ~window-char sentence snippet around the first occurrence of token."""
    idx = text.find(token)
    if idx == -1:
        return ""
    start = max(0, idx - window // 2)
    end = min(len(text), idx + len(token) + window // 2)
    snippet = text[start:end].strip()
    for sep in ("。", "！", "？", "；", "\n"):
        left = snippet.rfind(sep, 0, idx - start)
        if left != -1:
            snippet = snippet[left + 1:]
            break
    for sep in ("。", "！", "？", "；", "\n"):
        right = snippet.find(sep)
        if right != -1:
            snippet = snippet[: right + 1]
            break
    return snippet.strip()


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def tokenize_with_context(text: str) -> list[dict]:
    """
    Returns list of {word, count, context_snippet, uncertain} dicts.
    Deduplicates tokens; count = total occurrences in text.

    uncertain=True marks single CJK chars that are not in the known-word
    lists.  They are passed to the LLM for a final keep/drop decision
    instead of being dropped here — this allows characters like 臺 to
    survive when context clearly shows standalone use (e.g. "platform").
    """
    if not _initialized:
        initialize()

    raw = list(jieba.cut(text, cut_all=False))
    raw = _split_trailing_particles(raw)
    raw = _remerge_single_char_runs(raw)

    seen: dict[str, dict] = {}
    for token in raw:
        token = token.strip()
        if not token or not _has_cjk(token):
            continue
        if token in _stopwords:
            continue
        if len(token) == 1:
            if unicodedata.category(token[0]) in ("Po", "Ps", "Pe", "Pi", "Pf", "Pd"):
                continue
        # Multi-char tokens and known single chars are confirmed.
        # Unknown single chars are kept but flagged as uncertain so the
        # LLM can decide whether they deserve a standalone flashcard.
        uncertain = (
            len(token) == 1
            and bool(_known_single_chars)
            and token not in _known_single_chars
        )
        if token in seen:
            seen[token]["count"] += 1
        else:
            seen[token] = {
                "word": token,
                "count": 1,
                "context_snippet": _extract_context(text, token),
                "uncertain": uncertain,
            }
    return list(seen.values())


def tokenize(text: str) -> list[str]:
    return [t["word"] for t in tokenize_with_context(text)]
