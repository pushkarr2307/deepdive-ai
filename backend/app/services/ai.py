"""OpenAI calls: speech-to-text, study-material generation, grounded Q&A."""
import json

from openai import OpenAI

from ..config import settings

_client: OpenAI | None = None
_enc = None


def get_client() -> OpenAI:
    global _client
    if _client is None:
        if not settings.openai_api_key:
            raise RuntimeError("OPENAI_API_KEY is not set in backend/.env")
        _client = OpenAI(api_key=settings.openai_api_key)
    return _client


def count_tokens(text: str) -> int:
    global _enc
    try:
        if _enc is None:
            import tiktoken
            _enc = tiktoken.get_encoding("cl100k_base")
        return len(_enc.encode(text))
    except Exception:
        return len(text) // 4  # rough fallback if the encoding can't be loaded


def fmt_time(sec: float) -> str:
    sec = int(max(sec, 0))
    h, rem = divmod(sec, 3600)
    m, s = divmod(rem, 60)
    return f"{h}:{m:02d}:{s:02d}" if h else f"{m}:{s:02d}"


# ---------------------------------------------------------------- transcription
_local_whisper = None


def get_local_whisper():
    global _local_whisper
    if _local_whisper is None:
        from faster_whisper import WhisperModel
        _local_whisper = WhisperModel("tiny", device="cpu", compute_type="int8")
    return _local_whisper


def transcribe(parts: list[tuple[str, int]]) -> list[dict]:
    # 1. First attempt: OpenAI Whisper API if key is present
    if settings.openai_api_key:
        try:
            client = get_client()
            segments: list[dict] = []
            for path, offset in parts:
                with open(path, "rb") as f:
                    resp = client.audio.transcriptions.create(
                        model=settings.openai_transcribe_model,
                        file=f,
                        response_format="verbose_json",
                        timestamp_granularities=["segment"],
                    )
                for s in getattr(resp, "segments", None) or []:
                    text = (s.text or "").strip()
                    if text:
                        segments.append({"start": round(s.start + offset, 2),
                                         "end": round(s.end + offset, 2), "text": text})
            if segments:
                return segments
        except Exception as e:
            # If OpenAI throws 429 quota error, fall through to local Whisper
            pass

    # 2. Resilient Fallback: Local Whisper Model (zero API quota, runs 100% offline)
    local_model = get_local_whisper()
    segments: list[dict] = []
    for path, offset in parts:
        segs, _ = local_model.transcribe(path, word_timestamps=False)
        for s in segs:
            t = (s.text or "").strip()
            if t:
                segments.append({"start": round(s.start + offset, 2),
                                 "end": round(s.end + offset, 2), "text": t})
    return segments


def transcript_text(segments: list[dict]) -> str:
    return "\n".join(f"[{fmt_time(s['start'])}] {s['text']}" for s in segments)


# ---------------------------------------------------------------- study material
STUDY_SYSTEM = """You are an expert teaching assistant. You turn a timestamped video transcript \
into study material. Use ONLY information from the transcript. Return a single JSON object with \
exactly these keys:

{
  "summary": "4-6 sentence overview",
  "notes_markdown": "well structured Markdown notes: ## headings per topic, bullet points, **bold** key terms",
  "key_timestamps": [{"time_seconds": int, "title": "short chapter title", "description": "one sentence"}],
  "action_items": [{"task": "concrete thing the viewer should do or remember", "time_seconds": int or null}],
  "flashcards": [{"question": "...", "answer": "..."}],
  "quiz": [{"question": "...", "options": ["A","B","C","D"], "answer_index": 0-3, "explanation": "..."}]
}

Aim for 6-12 key_timestamps in chronological order, up to 8 action_items (empty list if the video \
has none), 10 flashcards and 8 quiz questions. time_seconds must be taken from the [mm:ss] markers."""


def _condense(text: str) -> str:
    """Map step for very long transcripts: shrink each window, keeping timestamps."""
    client = get_client()
    lines, windows, cur, cur_tokens = text.split("\n"), [], [], 0
    for line in lines:
        t = count_tokens(line)
        if cur and cur_tokens + t > 10000:
            windows.append("\n".join(cur))
            cur, cur_tokens = [], 0
        cur.append(line)
        cur_tokens += t
    if cur:
        windows.append("\n".join(cur))

    condensed = []
    for w in windows:
        r = client.chat.completions.create(
            model=settings.openai_chat_model,
            temperature=0.2,
            messages=[
                {"role": "system", "content": "Condense this transcript part into detailed factual bullet "
                 "points. Start every bullet with the [mm:ss] timestamp it comes from. Keep definitions, "
                 "numbers, examples and any instructions or tasks."},
                {"role": "user", "content": w},
            ],
        )
        condensed.append(r.choices[0].message.content or "")
    return "\n".join(condensed)


def generate_study_material(title: str, segments: list[dict], duration: float) -> dict:
    text = transcript_text(segments)
    
    # 1. Try Google Gemini if configured
    if settings.gemini_api_key:
        try:
            import google.generativeai as genai
            genai.configure(api_key=settings.gemini_api_key)
            model = genai.GenerativeModel(
                settings.gemini_model or "models/gemini-2.5-flash",
                generation_config={"response_mime_type": "application/json"}
            )
            prompt = f"{STUDY_SYSTEM}\n\nVideo title: {title}\n\nTranscript:\n{text[:60000]}"
            res = model.generate_content(prompt)
            data = json.loads(res.text or "{}")
            return _normalize(data, duration or (segments[-1]["end"] if segments else 0))
        except Exception as e:
            if not settings.openai_api_key:
                raise

    # 2. Fall back to OpenAI
    client = get_client()
    if count_tokens(text) > 28000:
        text = _condense(text)
    r = client.chat.completions.create(
        model=settings.openai_chat_model,
        temperature=0.3,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": STUDY_SYSTEM},
            {"role": "user", "content": f"Video title: {title}\n\nTranscript:\n{text}"},
        ],
    )
    data = json.loads(r.choices[0].message.content or "{}")
    return _normalize(data, duration or (segments[-1]["end"] if segments else 0))


def _clamp(v, hi):
    try:
        return max(0, min(int(v), int(hi) if hi else int(v)))
    except (TypeError, ValueError):
        return None


def _normalize(d: dict, duration: float) -> dict:
    out = {
        "summary": str(d.get("summary", "")).strip(),
        "notes_markdown": str(d.get("notes_markdown", "")).strip(),
        "key_timestamps": [], "action_items": [], "flashcards": [], "quiz": [],
    }
    for k in d.get("key_timestamps") or []:
        t = _clamp(k.get("time_seconds"), duration)
        if t is not None and k.get("title"):
            out["key_timestamps"].append({"time_seconds": t, "title": str(k["title"]),
                                          "description": str(k.get("description", ""))})
    out["key_timestamps"].sort(key=lambda x: x["time_seconds"])
    for a in d.get("action_items") or []:
        if a.get("task"):
            out["action_items"].append({"task": str(a["task"]),
                                        "time_seconds": _clamp(a.get("time_seconds"), duration)})
    for c in d.get("flashcards") or []:
        if c.get("question") and c.get("answer"):
            out["flashcards"].append({"question": str(c["question"]), "answer": str(c["answer"])})
    for q in d.get("quiz") or []:
        opts = [str(o) for o in (q.get("options") or [])]
        idx = q.get("answer_index")
        if q.get("question") and len(opts) >= 2 and isinstance(idx, int) and 0 <= idx < len(opts):
            out["quiz"].append({"question": str(q["question"]), "options": opts, "answer_index": idx,
                                "explanation": str(q.get("explanation", ""))})
    return out


# ---------------------------------------------------------------- chat (RAG answer step)
def answer_question(question: str, hits: list[dict], history: list[dict], title: str) -> str:
    if hits:
        context = "\n\n".join(f"[{fmt_time(h['start'])}-{fmt_time(h['end'])}] {h['text']}" for h in hits)
    else:
        context = "(no relevant excerpts found)"
    system = (
        f"You answer questions about the video \"{title}\". Use ONLY the transcript excerpts provided. "
        "Cite the moments you rely on with their start time in square brackets, like [3:25]. "
        "If the excerpts do not contain the answer, say you could not find it in this video. "
        "Be clear and concise."
    )

    # 1. Try Google Gemini
    if settings.gemini_api_key:
        try:
            import google.generativeai as genai
            genai.configure(api_key=settings.gemini_api_key)
            model = genai.GenerativeModel(settings.gemini_model or "models/gemini-2.5-flash")
            hist_prompt = "\n".join(f"{m['role']}: {m['content']}" for m in history[-6:])
            full_prompt = f"{system}\n\nHistory:\n{hist_prompt}\n\nTranscript excerpts:\n{context}\n\nQuestion: {question}"
            res = model.generate_content(full_prompt)
            return (res.text or "").strip()
        except Exception:
            if not settings.openai_api_key:
                raise

    # 2. Fall back to OpenAI
    client = get_client()
    messages = [{"role": "system", "content": system}]
    for m in history:
        messages.append({"role": m["role"], "content": m["content"]})
    messages.append({"role": "user", "content": f"Transcript excerpts:\n{context}\n\nQuestion: {question}"})
    r = client.chat.completions.create(model=settings.openai_chat_model, temperature=0.2, messages=messages)
    return (r.choices[0].message.content or "").strip()
