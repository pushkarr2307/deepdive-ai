"""Background job: video -> audio -> transcript -> notes/quiz/flashcards -> vector index."""
import os
import shutil
import tempfile

from bson import ObjectId

from ..db import db
from ..utils import now
from . import ai, ingest, rag


def run_pipeline(video_id: str, *, youtube_url: str | None = None, upload_path: str | None = None) -> None:
    oid = ObjectId(video_id)

    def status(state: str, msg: str, **extra) -> None:
        db.videos.update_one({"_id": oid}, {"$set": {"status": state, "stage_message": msg,
                                                      "updated_at": now(), **extra}})

    try:
        with tempfile.TemporaryDirectory(prefix="dd_") as tmp:
            segments = []

            # 1. First attempt: fetch native captions for YouTube (fast, accurate, no OpenAI Whisper quota needed)
            if youtube_url:
                yt_id = ingest.extract_youtube_id(youtube_url)
                if yt_id:
                    status("transcribing", "Fetching video transcript")
                    try:
                        from youtube_transcript_api import YouTubeTranscriptApi
                        yta = YouTubeTranscriptApi()
                        raw_transcript = yta.fetch(yt_id)
                        for item in raw_transcript:
                            segments.append({
                                "start": round(getattr(item, "start", 0.0), 2),
                                "end": round(getattr(item, "start", 0.0) + getattr(item, "duration", 0.0), 2),
                                "text": getattr(item, "text", "").strip()
                            })
                    except Exception:
                        segments = []

            # 2. Second attempt: download & transcribe audio via Whisper
            if not segments:
                if youtube_url:
                    status("downloading", "Fetching audio from YouTube")
                    src = ingest.download_youtube_audio(youtube_url, tmp)
                else:
                    src = upload_path

                status("transcribing", "Converting speech to text")
                parts = ingest.split_audio(src, tmp)
                segments = ai.transcribe(parts)

            if not segments:
                raise RuntimeError("No speech was detected in this video")
            db.transcripts.replace_one(
                {"video_id": video_id},
                {"video_id": video_id, "segments": segments,
                 "text": " ".join(s["text"] for s in segments), "created_at": now()},
                upsert=True,
            )

            video = db.videos.find_one({"_id": oid})
            status("generating", "Writing notes, quiz and flashcards")
            material = ai.generate_study_material(video["title"], segments, video.get("duration") or 0)
            db.outputs.replace_one(
                {"video_id": video_id},
                {"video_id": video_id, "user_id": video["user_id"], **material, "created_at": now()},
                upsert=True,
            )

            status("indexing", "Building the semantic search index")
            chunks = rag.chunk_segments(segments)
            db.chunks.delete_many({"video_id": video_id})
            if chunks:
                db.chunks.insert_many([{"video_id": video_id, **c} for c in chunks])
            rag.index_chunks(video_id, chunks)

            status("ready", "Ready")
            from ..db import save_state
            save_state()
    except Exception as e:  # surfaced in the UI
        err_msg = str(e)
        if "429" in err_msg or "insufficient_quota" in err_msg or "credits" in err_msg.lower():
            err_msg = (
                "OpenAI Account Quota Exceeded (Error 429). Your OpenAI API key has no remaining credits. "
                "Please add credit balance at https://platform.openai.com/settings/organization/billing "
                "or update OPENAI_API_KEY with an active key in backend/.env."
            )
        status("failed", "Processing failed", error=err_msg[:400])
    finally:
        if upload_path:
            shutil.rmtree(os.path.dirname(upload_path), ignore_errors=True)
