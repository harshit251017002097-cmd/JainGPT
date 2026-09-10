"""
Tests for JainGPT language detection module.
Run: python -m pytest tests/ -v
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from language import detect_language


class TestEnglishDetection:
    def test_plain_english(self):
        assert detect_language("What is Jainism?") == "en"

    def test_english_complex(self):
        assert detect_language("Explain Anekantavada and Syadvada.") == "en"

    def test_english_ahimsa(self):
        assert detect_language("Why do Jains believe in non-violence?") == "en"

    def test_english_philosophy(self):
        assert detect_language("How does karma work in Jain philosophy?") == "en"


class TestHindiDetection:
    def test_devanagari_question(self):
        assert detect_language("मोक्ष क्या है?") == "hi"

    def test_devanagari_ahimsa(self):
        assert detect_language("अहिंसा क्या होती है?") == "hi"

    def test_mixed_devanagari(self):
        # Contains Devanagari → should be hi
        assert detect_language("Jainism और अहिंसा के बारे में बताओ") == "hi"


class TestHinglishDetection:
    def test_hinglish_basic(self):
        assert detect_language("Jainism kya hai?") == "hi-en"

    def test_hinglish_mahavira(self):
        assert detect_language("Mahavir Swami kaun the?") == "hi-en"

    def test_hinglish_explain(self):
        assert detect_language("Ahimsa ko simple mein samjha do.") == "hi-en"

    def test_hinglish_paryushan(self):
        assert detect_language("Paryushan kyun manaya jata hai?") == "hi-en"

    def test_hinglish_karma(self):
        assert detect_language("Karma kya hota hai simple mein?") == "hi-en"


class TestEdgeCases:
    def test_empty_string(self):
        result = detect_language("")
        assert result in ("en", "hi", "hi-en")  # Should not crash

    def test_whitespace_only(self):
        result = detect_language("   ")
        assert result in ("en", "hi", "hi-en")  # Should not crash

    def test_numbers_only(self):
        assert detect_language("24 100 3000") == "en"
