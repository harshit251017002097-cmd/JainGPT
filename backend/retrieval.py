"""
Knowledge base retrieval for JainGPT (MVP: keyword-based).

Scans JSON knowledge files under backend/knowledge/ and returns
the most relevant context snippet for a given user message.

Designed so that Phase 2 can swap in vector-based RAG by replacing
only this module — the interface remains the same.
"""

import os
import json
import re
from pathlib import Path

# Base directory for knowledge files
KNOWLEDGE_DIR = Path(__file__).parent / "knowledge"


def _load_all_entries() -> list[dict]:
    """Load all JSON knowledge entries from all domain folders."""
    entries = []
    if not KNOWLEDGE_DIR.exists():
        return entries

    for json_file in KNOWLEDGE_DIR.rglob("*.json"):
        try:
            with open(json_file, encoding="utf-8") as f:
                data = json.load(f)
                # Each file is either a list of entries or a dict with 'entries' key
                if isinstance(data, list):
                    entries.extend(data)
                elif isinstance(data, dict) and "entries" in data:
                    entries.extend(data["entries"])
                elif isinstance(data, dict):
                    entries.append(data)
        except (json.JSONDecodeError, OSError):
            continue

    return entries


def _score_entry(entry: dict, query_words: set[str]) -> int:
    """Score an entry by how many query words match its keywords or summary."""
    score = 0
    keywords = {k.lower() for k in entry.get("keywords", [])}
    summary_words = set(re.findall(r'\w+', entry.get("summary", "").lower(), flags=re.UNICODE))
    tradition_words = set(re.findall(r'\w+', entry.get("tradition_notes", "").lower(), flags=re.UNICODE))

    for word in query_words:
        if word in keywords:
            score += 3          # exact keyword match — highest weight
        elif word in summary_words:
            score += 1
        elif word in tradition_words:
            score += 1

    return score


def retrieve_context(user_message: str, top_k: int = 3) -> str:
    """
    Return a context string (up to top_k best-matching entries)
    to inject into the Gemini prompt.

    Returns an empty string if no relevant entries found.
    """
    if not user_message.strip():
        return ""

    # Tokenize query (works for EN/Hinglish/Devanagari)
    query_words = set(re.findall(r'\w+', user_message.lower(), flags=re.UNICODE))
    stop_words = {'kya', 'hai', 'ki', 'ka', 'ko', 'ke', 'aur', 'the',
                  'a', 'an', 'is', 'in', 'of', 'to', 'and', 'what',
                  'how', 'why', 'who', 'do', 'does', 'can', 'me', 'mein',
                  'i', 'you', 'my', 'your', 'it', 'that', 'this', 'are',
                  'was', 'with', 'for', 'on', 'at', 'from', 'by'}
    query_words -= stop_words

    if not query_words:
        return ""

    entries = _load_all_entries()
    if not entries:
        return ""

    # Score and sort
    scored = [(entry, _score_entry(entry, query_words)) for entry in entries]
    scored = [(e, s) for e, s in scored if s > 0]
    scored.sort(key=lambda x: x[1], reverse=True)

    top_entries = scored[:top_k]
    if not top_entries:
        return ""

    # Build context string
    parts = []
    for entry, score in top_entries:
        topic = entry.get("topic", "Jainism")
        summary = entry.get("summary", "")
        tradition_notes = entry.get("tradition_notes", "")
        source = entry.get("source", "")

        part = f"**{topic}**\n{summary}"
        if tradition_notes:
            part += f"\n\nTradition notes: {tradition_notes}"
        if source:
            part += f"\n\nSource: {source}"
        parts.append(part)

    return "\n\n---\n\n".join(parts)
