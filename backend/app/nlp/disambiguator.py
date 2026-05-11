"""Batch GPT-4.1-mini calls for context-aware meaning disambiguation."""
from __future__ import annotations
import asyncio
import json
import re
from openai import AsyncOpenAI

BATCH_SIZE = 30
MAX_CONCURRENT = 3

SYSTEM_PROMPT = (
    "You are a Traditional Chinese language expert. "
    "For each word provided with its context snippet from a real text, produce:\n"
    "1. A concise contextual meaning in English (1-2 sentences) specific to how the word is used "
    "in THIS text—not a generic dictionary definition.\n"
    "2. A natural example sentence in Traditional Chinese using the word in a similar context.\n\n"
    "Respond ONLY with a valid JSON object. Keys are the Chinese words. "
    'Values are objects with keys "meaning" (string) and "example" (string).'
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
    return {w: data.get(w, {"meaning": "", "example": ""}) for w in expected_words}


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

    # Fallback for words that didn't get a GPT result
    for item in words_with_context:
        w = item["word"]
        if w not in merged or not merged[w].get("meaning"):
            merged[w] = {
                "meaning": item.get("base_meaning") or item.get("context_snippet", ""),
                "example": "",
            }

    return merged
