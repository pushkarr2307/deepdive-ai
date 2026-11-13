from fastapi import APIRouter, Depends, HTTPException

from ..db import db
from ..schemas import ChatIn
from ..security import get_current_user
from ..services import ai, rag
from ..utils import get_owned_video, now, ser

router = APIRouter(prefix="/api/videos", tags=["chat"])


@router.post("/{video_id}/chat")
def chat(video_id: str, body: ChatIn, user: dict = Depends(get_current_user)):
    video = get_owned_video(video_id, user)
    if video["status"] != "ready":
        raise HTTPException(400, "Video is still processing")
    uid = str(user["_id"])
    question = body.question.strip()

    try:
        hits = rag.search(video_id, question, k=6)
        recent = list(db.chat_history.find({"video_id": video_id, "user_id": uid}).sort("_id", -1).limit(6))[::-1]
        answer = ai.answer_question(question, hits, recent, video["title"])
    except Exception as e:
        raise HTTPException(502, f"AI service error: {str(e)[:200]}")

    db.chat_history.insert_many([
        {"video_id": video_id, "user_id": uid, "role": "user", "content": question, "created_at": now()},
        {"video_id": video_id, "user_id": uid, "role": "assistant", "content": answer,
         "sources": hits, "created_at": now()},
    ])
    from ..db import save_state
    save_state()
    return {"answer": answer, "sources": hits}


@router.get("/{video_id}/chat")
def history(video_id: str, user: dict = Depends(get_current_user)):
    get_owned_video(video_id, user)
    cur = db.chat_history.find({"video_id": video_id, "user_id": str(user["_id"])}).sort("_id", 1)
    return ser(list(cur))


@router.delete("/{video_id}/chat", status_code=204)
def clear_history(video_id: str, user: dict = Depends(get_current_user)):
    get_owned_video(video_id, user)
    db.chat_history.delete_many({"video_id": video_id, "user_id": str(user["_id"])})
