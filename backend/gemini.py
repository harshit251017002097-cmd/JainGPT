"""
Gemini API client for JainGPT.

Uses the new google-genai SDK (google.genai).

Handles:
  - Prompt construction (system prompt + retrieved context + conversation history)
  - API calls with retry/backoff logic
"""

import sys
import os
import time
import logging
from google import genai
from google.genai import types

from prompts import JAINGPT_SYSTEM_PROMPT

# Ensure UTF-8 output streams on Windows
if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

MAX_RETRIES = 1
RETRY_DELAY_SECONDS = 2.0


def _get_client() -> genai.Client:
    api_key = os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        raise RuntimeError(
            "GEMINI_API_KEY environment variable is not set. "
            "Copy .env.example to .env and fill in your key."
        )
    return genai.Client(api_key=api_key)


def _get_model_name() -> str:
    return os.environ.get("GEMINI_MODEL", "gemini-3.6-flash")


# ---------------------------------------------------------------------------
# Conversation history helpers
# ---------------------------------------------------------------------------

def build_genai_contents(conversation_history: list[dict]) -> list[types.Content]:
    """
    Convert internal history format to google.genai Content objects.

    Internal format: [{"role": "user"|"assistant", "content": "..."}]
    genai format:    [Content(role="user"|"model", parts=[Part(text="...")])]
    """
    contents = []
    for turn in conversation_history:
        role = "model" if turn["role"] == "assistant" else "user"
        contents.append(
            types.Content(
                role=role,
                parts=[types.Part(text=turn["content"])]
            )
        )
    return contents


# ---------------------------------------------------------------------------
# Core generation function
# ---------------------------------------------------------------------------

def generate_response(
    conversation_history: list[dict],
    retrieved_context: str,
    user_message: str,
) -> str:
    """
    Call Gemini and return the text response.

    Args:
        conversation_history: List of prior turns (not including current message).
        retrieved_context:    Relevant Jain knowledge base context, if any.
        user_message:         The current user message.

    Returns:
        The model's text response.

    Raises:
        RuntimeError: If all retries are exhausted.
    """
    client = _get_client()
    model_name = _get_model_name()

    # Build the message to send (context injected before user message)
    parts_to_send = []
    if retrieved_context:
        parts_to_send.append(
            f"[Relevant reference context — use this to ground your answer, "
            f"but do not quote it verbatim or mention it as a 'context block']\n\n"
            f"{retrieved_context}"
        )
    parts_to_send.append(user_message)
    full_user_message = "\n\n".join(parts_to_send)

    # Build conversation history contents (all turns EXCEPT the current one)
    history_contents = build_genai_contents(conversation_history)

    # Add the current user message
    all_contents = history_contents + [
        types.Content(
            role="user",
            parts=[types.Part(text=full_user_message)]
        )
    ]

    config = types.GenerateContentConfig(
        system_instruction=JAINGPT_SYSTEM_PROMPT,
        temperature=0.7,
        max_output_tokens=4096,
    )

    attempts = 0
    last_error = None

    while attempts <= MAX_RETRIES:
        try:
            response = client.models.generate_content(
                model=model_name,
                contents=all_contents,
                config=config,
            )
            if response and response.text:
                return response.text
            logger.warning("Gemini response.text was empty")
            return "Kshama kijiye, is sawaal ka response generate nahi ho pa raha. Kripya thodi der baad try karein. 🪷"

        except Exception as e:
            err_str = str(e).lower()
            # Non-retryable: bad request / invalid argument (4xx)
            if "invalid" in err_str or "bad request" in err_str or "400" in err_str:
                logger.error("Gemini bad request (no retry): %s", e)
                raise RuntimeError(f"Bad request to Gemini API: {e}") from e

            logger.warning("Gemini error (attempt %d): %s", attempts + 1, e)
            last_error = e
            if attempts < MAX_RETRIES:
                time.sleep(RETRY_DELAY_SECONDS * (2 ** attempts))
            attempts += 1

    raise RuntimeError(
        f"Gemini API unavailable after {MAX_RETRIES + 1} attempt(s). "
        f"Last error: {last_error}"
    )
