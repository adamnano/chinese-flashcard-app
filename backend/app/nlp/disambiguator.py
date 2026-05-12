"""Batch GPT-4.1-mini calls for context-aware meaning disambiguation."""
from __future__ import annotations
import asyncio
import json
import re
from openai import AsyncOpenAI

BATCH_SIZE = 30
MAX_CONCURRENT = 3

SYSTEM_PROMPT = (
    "You are a Traditional Chinese language expert helping build spaced-repetition flashcards.\n\n"
    "For each word provided with its context snippet from a real text, produce:\n"
    "1. meaning: a SHORT direct English translation of the word as used here — ideally 1–5 words, "
    "like a dictionary entry. Examples: 'patience', 'tea farmer', 'to export', 'mountain peak'. "
    "No 'Refers to' prefix. No full sentences. Just the core translation.\n"
    "2. context_note: one sentence explaining how this specific word is used in this text. "
    "Write naturally — do not always start with 'Refers to'. Vary the phrasing: describe the "
    "situation, what the word modifies, or why it matters in this context. "
    "This is shown on demand, not by default.\n"
    "3. pinyin: Mandarin pinyin with tone marks for the word (e.g. 'xiǎng yù'). "
    "Always provide this — it is used as a fallback when our dictionary has no pinyin.\n"
    "4. example: a natural example sentence in Traditional Chinese using the word in a similar context.\n"
    "5. create_flashcard (boolean): true if this word is a meaningful, learnable vocabulary item "
    "in this specific context; false if it is noise, a fragment, a proper noun that needs no study, "
    "or should not be studied in isolation.\n\n"
    "For words marked uncertain=true (not found in HSK/TOCFL reference lists):\n"
    "- Single character: set create_flashcard=true ONLY if it clearly carries distinct standalone "
    "meaning here. If it appears to be a fragment of a compound word, set false.\n"
    "- Multiple characters: this may be a grammatical co-occurrence — two common words that the "
    "tokeniser incorrectly joined (e.g. 裡有 is just 裡 + 有, not a compound). Set "
    "create_flashcard=false unless it is a genuine recognised Chinese compound or set phrase with "
    "meaning distinct from its individual parts.\n\n"
    "IMPORTANT — context notes: base context_note STRICTLY on what the provided context snippet "
    "shows. Do NOT infer the genre, source, author, or theme of the text beyond what is explicitly "
    "visible in the snippet. Never add details about Zen, Buddhism, classical literature, or any "
    "other topic that you are inferring from the word itself rather than from the actual snippet.\n\n"
    "Respond ONLY with a valid JSON object. Keys are the Chinese words. "
    'Values are objects with keys "meaning" (string), "context_note" (string), '
    '"pinyin" (string), "example" (string), and "create_flashcard" (boolean).'
)


def _build_user_prompt(batch: list[dict]) -> str:
    items = json.dumps(batch, ensure_ascii=False, indent=2)
    return (
        "Analyze each of these Traditional Chinese words using its context snippet.\n\n"
        f"Words to analyze:\n{items}\n\n"
        "Respond with JSON only—no markdown, no extra text."
    )


def _parse_response(content: str, expected_words: list[str]) -> dict[str, dict]:
    # Strip markdown code fences if present
    match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", content, re.DOTALL)
    if match:
        content = match.group(1)
    try:
        data = json.loads(content)
    except json.JSONDecodeError:
        return {}
    result = {}
    for w in expected_words:
        entry = data.get(w, {})
        result[w] = {
            "meaning": entry.get("meaning", ""),
            "context_note": entry.get("context_note", ""),
            "pinyin": entry.get("pinyin", ""),
            "example": entry.get("example", ""),
            "create_flashcard": bool(entry.get("create_flashcard", True)),
        }
    return result


async def _call_gpt(
    client: AsyncOpenAI,
    batch: list[dict],
    semaphore: asyncio.Semaphore,
    model: str = "gpt-4.1-mini",
) -> dict[str, dict]:
    expected = [item["word"] for item in batch]
    async with semaphore:
        response = await client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": _build_user_prompt(batch)},
            ],
            temperature=0.3,
            response_format={"type": "json_object"},
        )
    content = response.choices[0].message.content or "{}"
    return _parse_response(content, expected)


async def disambiguate_all(
    words_with_context: list[dict],
    api_key: str,
    model: str = "gpt-4.1-mini",
) -> dict[str, dict]:
    """
    words_with_context: list of {word, context_snippet, base_meaning}
    Returns: {word: {meaning, example}}
    """
    if not words_with_context:
        return {}

    client = AsyncOpenAI(api_key=api_key)
    semaphore = asyncio.Semaphore(MAX_CONCURRENT)

    # Build batches with only the fields GPT needs
    batches = []
    for i in range(0, len(words_with_context), BATCH_SIZE):
        chunk = words_with_context[i:i + BATCH_SIZE]
        batch = [
            {
                "word": item["word"],
                "context": item.get("context_snippet", ""),
                "base_meaning": item.get("base_meaning") or "",
                **({"uncertain": True} if item.get("uncertain") else {}),
            }
            for item in chunk
        ]
        batches.append(batch)

    tasks = [_call_gpt(client, batch, semaphore, model) for batch in batches]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    merged: dict[str, dict] = {}
    for result in results:
        if isinstance(result, Exception):
            continue
        merged.update(result)

    # Fallback for words that didn't get a GPT result.
    # Uncertain single chars fall back to create_flashcard=False (skip);
    # confirmed vocabulary words fall back to create_flashcard=True (keep).
    for item in words_with_context:
        w = item["word"]
        is_uncertain = bool(item.get("uncertain"))
        if w not in merged or not merged[w].get("meaning"):
            merged[w] = {
                "meaning": item.get("base_meaning") or item.get("context_snippet", ""),
                "example": "",
                "create_flashcard": not is_uncertain,
            }
        else:
            if "context_note" not in merged[w]:
                merged[w]["context_note"] = ""
            if "create_flashcard" not in merged[w]:
                merged[w]["create_flashcard"] = not is_uncertain

    return merged
