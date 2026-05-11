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
    "1. A concise contextual meaning in English (1–2 sentences) specific to how the word is used "
    "in THIS text—not a generic dictionary definition.\n"
    "2. A natural example sentence in Traditional Chinese using the word in a similar context.\n"
    "3. create_flashcard (boolean): true if this word is a meaningful, learnable vocabulary item "
    "in this specific context and deserves its own flashcard; false if it is noise, a fragment, "
    "a proper noun already known to the learner, or should not be studied in isolation.\n\n"
    "For words marked uncertain=true (single characters not found as standalone entries in "
    "HSK/TOCFL reference lists): set create_flashcard=true ONLY when the character clearly "
    "carries distinct standalone meaning here (e.g. 臺 meaning 'platform/stage', 灣 meaning "
    "'bay', 勁 meaning 'strength'). If the character is simply a fragment of a compound that "
    "happened to appear alone in this sentence, set create_flashcard=false.\n\n"
    "Respond ONLY with a valid JSON object. Keys are the Chinese words. "
    'Values are objects with keys "meaning" (string), "example" (string), '
    'and "create_flashcard" (boolean).'
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
        elif "create_flashcard" not in merged[w]:
            merged[w]["create_flashcard"] = not is_uncertain

    return merged
