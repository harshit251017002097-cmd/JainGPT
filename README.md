# JainGPT 🪷

> *"Jainism ko samjho, apni language mein."*

An AI-powered educational chatbot about Jainism. Ask anything about Jain philosophy, history, traditions, festivals, rituals, and modern life — in English, Hindi, or Hinglish.

---

## Project Structure

```
jaingpt/
├── frontend/           HTML + CSS + JS chat UI
├── backend/
│   ├── app.py          Flask routes (/api/chat, /api/health)
│   ├── gemini.py       Gemini API client with retry logic
│   ├── prompts.py      JainGPT system prompt
│   ├── language.py     Language detection (EN / HI / Hinglish)
│   ├── retrieval.py    Knowledge base lookup
│   ├── requirements.txt
│   └── knowledge/      11 Jainism domain JSON files
├── tests/              pytest unit tests
├── .env.example        Environment variable template
├── .env                Your local config (gitignored)
└── .gitignore
```

---

## Setup

### 1. Prerequisites

- Python 3.10+
- A Google Gemini API key ([get one free at Google AI Studio](https://aistudio.google.com/))

### 2. Configure Environment

```bash
# From the jaingpt/ directory:
copy .env.example .env
```

Edit `.env` and replace `your_gemini_api_key_here` with your actual API key:

```
GEMINI_API_KEY=AIza...your-key-here
GEMINI_MODEL=gemini-2.0-flash
```

### 3. Install Backend Dependencies

```bash
cd backend
pip install -r requirements.txt
```

Or with a virtual environment (recommended):

```bash
python -m venv venv
venv\Scripts\activate      # Windows
# source venv/bin/activate  # macOS/Linux
pip install -r backend\requirements.txt
```

### 4. Run the Backend

```bash
# From the jaingpt/ directory:
python backend\app.py
```

You should see:
```
Starting JainGPT backend on port 5000 (debug=True)
```

### 5. Open the Frontend

Open `frontend/index.html` in your browser directly, **or** serve it with a simple HTTP server:

```bash
# Python built-in server (from the frontend/ directory):
python -m http.server 8080
# Then open: http://localhost:8080
```

---

## Running Tests

```bash
pip install pytest
python -m pytest tests/ -v
```

---

## Architecture

| Layer | Tech |
|---|---|
| Frontend | HTML5 + CSS3 + Vanilla JS |
| Backend  | Python Flask |
| AI       | Google Gemini API (server-side only) |
| Knowledge Base | JSON files per Jainism domain |

**Security:** The Gemini API key is never exposed to the browser. All AI calls go through the Flask backend.

---

## Knowledge Domains

The knowledge base covers 11 Jainism domains:

1. **Basics** — what is Jainism, soul, karma, moksha
2. **Tirthankaras** — all 24 Tirthankaras
3. **Mahavira** — life, teachings, nirvana
4. **Philosophy** — Ahimsa, Anekantavada, Syadvada, Aparigraha
5. **Traditions** — Digambara, Śvētāmbara, sub-traditions
6. **Scriptures** — Agamas, Tattvartha Sutra, Kalpasutra
7. **Festivals** — Paryushana, Mahavir Jayanti, Jain Diwali
8. **Rituals** — Samayika, Pratikramana, Puja, Sallekhana
9. **Food & Lifestyle** — vegetarianism, onion/garlic, fasting
10. **Ethics** — Kshama, Satya, Brahmacharya, animal welfare
11. **Modern Life** — Jain principles applied to contemporary dilemmas

---

## API Reference

### `POST /api/chat`

**Request:**
```json
{
  "conversation_id": "sess_abc123",
  "message": "Ahimsa kya hai?"
}
```

**Response:**
```json
{
  "conversation_id": "sess_abc123",
  "response": "Ahimsa ka matlab hai...",
  "detected_language": "hi-en",
  "sources": [],
  "quick_actions": ["simple", "example", "traditions"]
}
```

### `GET /api/health`

```json
{ "status": "ok", "service": "JainGPT" }
```

---

## License

This project is for educational purposes. Jain content is presented respectfully and neutrally. The AI is not a substitute for Jain scholars, monks, or acharyas.
