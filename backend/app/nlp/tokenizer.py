"""Segment Chinese text with jieba, filter noise and stopwords."""
import re
import unicodedata
import jieba
import jieba.posseg as pseg
from pathlib import Path

CJK_RE = re.compile(r"[一-鿿㐀-䶿豈-﫿]")

# Grammatical particles/function words with no standalone flashcard value
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
_initialized = False


def _load_stopwords() -> None:
    sw_path = Path(__file__).parent / "stopwords_zh.txt"
    if sw_path.exists():
        _stopwords.update(sw_path.read_text(encoding="utf-8").splitlines())
    _stopwords.update(GRAMMAR_PARTICLES)


def _init_jieba(userdict_words: list[str] | None = None) -> None:
    global _initialized
    jieba.setLogLevel(20)  # WARNING level — suppress INFO logs
    if userdict_words:
        # Write TOCFL headwords to a temp userdict so jieba recognizes Traditional compounds
        import tempfile, os
        with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", suffix=".txt", delete=False) as f:
            for w in userdict_words:
                f.write(f"{w}\n")
            tmp = f.name
        jieba.load_userdict(tmp)
        os.unlink(tmp)
    _initialized = True


def initialize(userdict_words: list[str] | None = None) -> None:
    _load_stopwords()
    _init_jieba(userdict_words)


def _has_cjk(token: str) -> bool:
    return bool(CJK_RE.search(token))


def _is_valid_token(token: str) -> bool:
    if not _has_cjk(token):
        return False
    if token in _stopwords:
        return False
    # Skip single-char tokens that are common particles (not covered by stopwords)
    if len(token) == 1 and unicodedata.category(token[0]) in ("Po", "Ps", "Pe", "Pi", "Pf", "Pd"):
        return False
    return True


def _extract_context(text: str, token: str, window: int = 80) -> str:
    """Return a ~window-char sentence snippet around the first occurrence of token."""
    idx = text.find(token)
    if idx == -1:
        return ""
    start = max(0, idx - window // 2)
    end = min(len(text), idx + len(token) + window // 2)
    snippet = text[start:end].strip()
    # Trim to sentence boundaries if possible
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


def tokenize_with_context(text: str) -> list[dict]:
    """
    Returns list of {word, count, context_snippet} dicts.
    Deduplicates tokens; count = number of occurrences in text.
    """
    if not _initialized:
        initialize()

    seen: dict[str, dict] = {}
    for token in jieba.cut(text, cut_all=False):
        token = token.strip()
        if not _is_valid_token(token):
            continue
        if token in seen:
            seen[token]["count"] += 1
        else:
            seen[token] = {
                "word": token,
                "count": 1,
                "context_snippet": _extract_context(text, token),
            }
    return list(seen.values())


def tokenize(text: str) -> list[str]:
    return [t["word"] for t in tokenize_with_context(text)]
