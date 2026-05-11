"""Normalize Chinese text to Traditional Chinese using OpenCC."""
import opencc

# s2t: Simplified → Traditional. Idempotent on already-Traditional input.
_converter = opencc.OpenCC("s2t")


def normalize(text: str) -> str:
    return _converter.convert(text)
