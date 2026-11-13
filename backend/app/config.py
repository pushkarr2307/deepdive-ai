import os
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

_ENV_PATH = Path(__file__).resolve().parent.parent / ".env"

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=str(_ENV_PATH), env_file_encoding="utf-8", extra="ignore")

    openai_api_key: str = ""
    openai_chat_model: str = "gpt-4o-mini"
    openai_transcribe_model: str = "whisper-1"
    openai_embed_model: str = "text-embedding-3-small"

    gemini_api_key: str = ""
    gemini_model: str = "models/gemini-2.5-flash"

    mongodb_uri: str = "mongodb://localhost:27017"
    mongodb_db: str = "deepdive_ai"

    jwt_secret: str = "change-me"
    jwt_expire_minutes: int = 60 * 24 * 7

    chroma_path: str = "./chroma_data"
    cors_origins: str = "http://localhost:5173"

    max_upload_mb: int = 500
    max_video_minutes: int = 180

    ffmpeg_path: str = ""
    ffprobe_path: str = ""

    @property
    def cors_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
