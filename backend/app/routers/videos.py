import os
import tempfile
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, Query, UploadFile

from ..config import settings
from ..db import db
from ..schemas import YouTubeIn
from ..security import get_current_user
from ..services import ingest, rag
from ..services.pipeline import run_pipeline
from ..utils import get_owned_video, now, ser

router = APIRouter(prefix="/api/videos", tags=["videos"])

ALLOWED_EXT = {".mp4", ".mov", ".mkv", ".webm", ".avi", ".m4v", ".mp3", ".wav", ".m4a", ".ogg", ".flac"}


@router.post("/youtube", status_code=202)
def add_youtube(body: YouTubeIn, tasks: BackgroundTasks, user: dict = Depends(get_current_user)):
    url = body.url.strip()
    yt_id = ingest.extract_youtube_id(url)
    if not yt_id:
        raise HTTPException(400, "That does not look like a YouTube video link")
    uid = str(user["_id"])

    existing = db.videos.find_one({"user_id": uid, "youtube_id": yt_id, "status": {"$ne": "failed"}})
    if existing:
        return ser(existing)

    try:
        info = ingest.probe_youtube(f"https://www.youtube.com/watch?v={yt_id}")
    except Exception as e:
        raise HTTPException(400, f"Could not read this video: {str(e)[:200]}")
    if info["duration"] and info["duration"] > settings.max_video_minutes * 60:
        raise HTTPException(400, f"Video is longer than {settings.max_video_minutes} minutes")

    doc = {"user_id": uid, "source": "youtube", "youtube_id": yt_id,
           "url": f"https://www.youtube.com/watch?v={yt_id}", **info,
           "status": "queued", "stage_message": "Queued", "created_at": now(), "updated_at": now()}
    doc["_id"] = db.videos.insert_one(doc).inserted_id
    from ..db import save_state
    save_state()
    tasks.add_task(run_pipeline, str(doc["_id"]), youtube_url=doc["url"])
    return ser(doc)


@router.post("/upload", status_code=202)
def upload_video(tasks: BackgroundTasks, file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_EXT:
        raise HTTPException(400, "Unsupported file type. Upload a video or audio file (mp4, mov, mkv, webm, mp3, wav, m4a...).")

    tmpdir = tempfile.mkdtemp(prefix="dd_up_")
    path = os.path.join(tmpdir, f"upload{ext}")
    limit, size = settings.max_upload_mb * 1024 * 1024, 0
    try:
        with open(path, "wb") as out:
            while chunk := file.file.read(1024 * 1024):
                size += len(chunk)
                if size > limit:
                    raise HTTPException(413, f"File is larger than {settings.max_upload_mb} MB")
                out.write(chunk)
        duration = ingest.media_duration(path)
        if duration and duration > settings.max_video_minutes * 60:
            raise HTTPException(400, f"Video is longer than {settings.max_video_minutes} minutes")
    except Exception:
        import shutil
        shutil.rmtree(tmpdir, ignore_errors=True)
        raise

    doc = {"user_id": str(user["_id"]), "source": "upload", "title": Path(file.filename).stem,
           "duration": duration, "thumbnail": None, "channel": None,
           "status": "queued", "stage_message": "Queued", "created_at": now(), "updated_at": now()}
    doc["_id"] = db.videos.insert_one(doc).inserted_id
    from ..db import save_state
    save_state()
    tasks.add_task(run_pipeline, str(doc["_id"]), upload_path=path)
    return ser(doc)


@router.get("")
def list_videos(user: dict = Depends(get_current_user)):
    cur = db.videos.find({"user_id": str(user["_id"])}).sort("created_at", -1)
    return ser(list(cur))


@router.get("/{video_id}")
def get_video(video_id: str, user: dict = Depends(get_current_user)):
    video = get_owned_video(video_id, user)
    outputs = db.outputs.find_one({"video_id": video_id}, {"_id": 0, "video_id": 0, "user_id": 0})
    return {"video": ser(video), "outputs": ser(outputs) if outputs else None}


@router.get("/{video_id}/transcript")
def get_transcript(video_id: str, user: dict = Depends(get_current_user)):
    get_owned_video(video_id, user)
    t = db.transcripts.find_one({"video_id": video_id}, {"_id": 0, "segments": 1})
    return {"segments": t["segments"] if t else []}


@router.get("/{video_id}/search")
def search_video(video_id: str, q: str = Query(min_length=2, max_length=300),
                 user: dict = Depends(get_current_user)):
    video = get_owned_video(video_id, user)
    if video["status"] != "ready":
        raise HTTPException(400, "Video is still processing")
    return {"results": rag.search(video_id, q, k=6)}


@router.delete("/{video_id}", status_code=204)
def delete_video(video_id: str, user: dict = Depends(get_current_user)):
    video = get_owned_video(video_id, user)
    for col in (db.transcripts, db.chunks, db.outputs, db.chat_history):
        col.delete_many({"video_id": video_id})
    rag.delete_video(video_id)
    db.videos.delete_one({"_id": video["_id"]})
    from ..db import save_state
    save_state()
