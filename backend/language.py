"""
Language detection for JainGPT.

Classifies user input as:
  'hi'    — Hindi (Devanagari script detected)
  'hi-en' — Hinglish (Romanized Hindi + English code-mix)
  'en'    — English

No external dependencies required for MVP — uses heuristics only.
"""

import re
import unicodedata

# Devanagari Unicode block: U+0900–U+097F
_DEVANAGARI_RANGE = re.compile(r'[\u0900-\u097F]')

# Common Hinglish / Romanized-Hindi indicator words that are NOT English
_HINGLISH_MARKERS = {
    'kya', 'hai', 'hain', 'mein', 'ko', 'ka', 'ki', 'ke', 'aur',
    'nahi', 'nhi', 'kaise', 'kyun', 'kyunki', 'toh', 'acha', 'yeh',
    'woh', 'isko', 'iska', 'uski', 'batao', 'samjhao', 'bolna', 'kaun',
    'kahan', 'kab', 'kuch', 'kitna', 'matlab', 'bhi', 'bohot', 'bahut',
    'accha', 'theek', 'hoga', 'tha', 'the', 'thi', 'raha', 'rahi',
    'chahiye', 'milega', 'liye', 'unka', 'unki', 'apna', 'apni',
    'jaisa', 'wala', 'wali', 'poochho', 'pooch', 'sikhna', 'puri',
    'seedha', 'simple', 'easy', 'thoda', 'thodi', 'zyada',
}


def detect_language(text: str) -> str:
    """
    Detect the language/register of the user's message.

    Returns one of: 'hi', 'hi-en', 'en'
    """
    if not text or not text.strip():
        return 'en'

    text_stripped = text.strip()

    # 1. Devanagari characters → Hindi
    if _DEVANAGARI_RANGE.search(text_stripped):
        return 'hi'

    # 2. Check for Hinglish marker words (case-insensitive)
    words = re.findall(r"[a-zA-Z']+", text_stripped.lower())
    if not words:
        return 'en'

    hinglish_count = sum(1 for w in words if w in _HINGLISH_MARKERS)
    hinglish_ratio = hinglish_count / len(words) if words else 0

    # If more than ~15% of words are Hinglish markers, classify as Hinglish
    if hinglish_ratio >= 0.15 or hinglish_count >= 2:
        return 'hi-en'

    return 'en'


def language_label(code: str) -> str:
    """Human-readable label for a language code."""
    return {'hi': 'Hindi', 'hi-en': 'Hinglish', 'en': 'English'}.get(code, 'English')
