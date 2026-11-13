from datetime import datetime, timezone

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import HTTPException

from .db import db


def now() -> datetime:
    return datetime.now(timezone.utc)


def ser(obj):
    """Make Mongo documents JSON friendly (_id -> id, ObjectId -> str, datetime -> ISO)."""
    if isinstance(obj, ObjectId):
        return str(obj)
    if isinstance(obj, dict):
        return {("id" if k == "_id" else k): ser(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [ser(i) for i in obj]
    if isinstance(obj, datetime):
        return obj.isoformat() + ("Z" if obj.tzinfo is None else "")
    return obj


def get_owned_video(video_id: str, user: dict) -> dict:
    try:
        oid = ObjectId(video_id)
    except (InvalidId, TypeError):
        raise HTTPException(404, "Video not found")
    video = db.videos.find_one({"_id": oid, "user_id": str(user["_id"])})
    if not video:
        raise HTTPException(404, "Video not found")
    return video
