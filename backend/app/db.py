import logging
import os
import pickle
from pathlib import Path
from pymongo import MongoClient
import mongomock

from .config import settings

logger = logging.getLogger("deepdive.db")

COLLECTIONS = ["users", "videos", "transcripts", "chunks", "outputs", "chat_history"]
DATA_DIR = Path(__file__).resolve().parent.parent / "data"
DUMP_FILE = DATA_DIR / "local_db.pkl"

_is_mock = False

try:
    client = MongoClient(settings.mongodb_uri, serverSelectionTimeoutMS=2000)
    client.admin.command("ping")
    db = client[settings.mongodb_db]
    logger.info("Connected to MongoDB at %s", settings.mongodb_uri)
except Exception as e:
    logger.warning("Could not connect to MongoDB (%s). Using persistent local fallback.", e)
    _is_mock = True
    client = mongomock.MongoClient()
    db = client[settings.mongodb_db]
    # Restore saved state if file exists
    if DUMP_FILE.exists():
        try:
            with open(DUMP_FILE, "rb") as f:
                saved_state = pickle.load(f)
            for cname in COLLECTIONS:
                docs = saved_state.get(cname, [])
                if docs:
                    db[cname].insert_many(docs)
            logger.info("Restored local database state from %s", DUMP_FILE)
        except Exception as load_err:
            logger.error("Failed to restore local database state: %s", load_err)


def save_state() -> None:
    if not _is_mock:
        return
    try:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        state = {}
        for cname in COLLECTIONS:
            state[cname] = list(db[cname].find())
        tmp_file = DATA_DIR / "local_db.tmp"
        with open(tmp_file, "wb") as f:
            pickle.dump(state, f)
        os.replace(tmp_file, DUMP_FILE)
    except Exception as e:
        logger.error("Failed to persist local db state: %s", e)


def init_indexes() -> None:
    db.users.create_index("email", unique=True)
    db.videos.create_index([("user_id", 1), ("created_at", -1)])
    db.transcripts.create_index("video_id", unique=True)
    db.chunks.create_index("video_id")
    db.outputs.create_index("video_id", unique=True)
    db.chat_history.create_index([("video_id", 1), ("user_id", 1)])
