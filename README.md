# DeepDive AI — Intelligent Video Note Taker & AI Assistant

> **Turn any lecture, webinar, or tutorial into structured study notes, chapter markers, flashcards, interactive quizzes, and a grounded AI study assistant with clickable video citations.**

---

## 🌟 Features

- **Multi-Source Video Ingestion**: Paste any public YouTube link or upload local lecture videos (`.mp4`, `.mov`, `.mkv`, `.webm`, `.mp3`, `.wav`).
- **Precision Audio & Speech Transcription**: High-accuracy transcription powered by OpenAI Whisper and local offline fallback models (`faster-whisper`), with preserved timestamps.
- **AI Smart Study Notes**: Comprehensive Markdown lecture notes with definitions, key takeaways, code blocks, and formulas.
- **Auto-Generated Flashcards & Quizzes**: Meaningful multiple-choice questions with answer keys and explanations to test understanding.
- **Interactive Video Chapters & Timestamps**: Jump directly to key moments in the video with timestamped chapter buttons.
- **Grounded "Ask AI" Chat**: Chat with a lecture-aware AI assistant powered by **ChromaDB vector search** and **GPT / Gemini** that answers questions strictly from the transcript and provides clickable jump citations (e.g., `[3:25]`).

---

## 🛠️ Technology Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | React 18, Vite 5, Tailwind CSS, React Markdown, React Router v6 |
| **Backend** | Python 3.11+, FastAPI, Uvicorn, Pydantic v2 |
| **Audio Processing** | FFmpeg (Windows x64 / Linux / macOS), yt-dlp, faster-whisper |
| **AI Intelligence** | OpenAI GPT-4o-mini & Whisper API, Google Gemini 2.5 Flash |
| **Vector Database** | ChromaDB (Cosine similarity vector space) |
| **Primary Database**| MongoDB (with zero-configuration persistent local fallback) |
| **Security** | JWT (JSON Web Tokens) with HS256 encryption & bcrypt password hashing |

---

## 🚀 Quick Start Guide

### Prerequisites
1. **Node.js** (v18 or higher)
2. **Python** (v3.11 or higher)
3. **FFmpeg** installed on your system (or placed in `backend/bin/ffmpeg.exe`)

---

### 1. Backend Setup (FastAPI)

```bash
# Navigate to the backend directory
cd backend

# Create and activate Python virtual environment
python -m venv .venv
# On Windows:
.\.venv\Scripts\activate
# On macOS/Linux:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure your environment variables
cp .env.example .env
# Edit .env and supply your OPENAI_API_KEY or GEMINI_API_KEY

# Start the backend server (Port 8000)
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

---

### 2. Frontend Setup (React + Vite)

```bash
# In a new terminal, navigate to the frontend directory
cd frontend

# Install dependencies
npm install

# Start the Vite development server (Port 5173)
npm run dev
```

Open your browser at **`http://localhost:5173`** to access DeepDive AI.

---

## 📖 Complete Technical Documentation

For the comprehensive, in-depth architectural breakdown, video processing pipeline flow, database schemas, full API reference, and troubleshooting guide, see:

👉 **[EXPLAIN.md](./EXPLAIN.md)**

---

## 📄 License

This project is licensed under the MIT License.
