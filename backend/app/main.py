from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .db import client, init_indexes
from .routers import auth, chat, videos
from .services.ingest import get_ffmpeg_binary, get_ffprobe_binary


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_indexes()
    yield


app = FastAPI(title="DeepDive AI API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(videos.router)
app.include_router(chat.router)


@app.get("/api/health")
def health():
    try:
        client.admin.command("ping")
        db_ok = True
    except Exception:
        db_ok = False

    ffmpeg_path = None
    ffmpeg_ok = False
    try:
        ffmpeg_path = get_ffmpeg_binary()
        ffmpeg_ok = True
    except Exception:
        pass

    ffprobe_path = get_ffprobe_binary()

    return {
        "status": "ok",
        "database": db_ok,
        "videos_count": client[settings.mongodb_db].videos.count_documents({}),
        "users_count": client[settings.mongodb_db].users.count_documents({}),
        "openai_key_set": bool(settings.openai_api_key),
        "ffmpeg": {
            "available": ffmpeg_ok,
            "path": ffmpeg_path,
        },
        "ffprobe": {
            "available": bool(ffprobe_path),
            "path": ffprobe_path,
        }
    }
