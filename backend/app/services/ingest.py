"""Getting audio out of YouTube links and uploaded files."""
import os
import re
import shutil
import subprocess
from pathlib import Path

import yt_dlp
from ..config import settings


def get_ffmpeg_binary() -> str:
    """Returns absolute path to ffmpeg executable or raises helpful error."""
    # 1. Configured via env
    if settings.ffmpeg_path and Path(settings.ffmpeg_path).is_file():
        return str(Path(settings.ffmpeg_path).resolve())

    # 2. Project local bin folder
    local_bin = Path(__file__).resolve().parent.parent.parent / "bin" / "ffmpeg.exe"
    if local_bin.is_file():
        return str(local_bin)

    # 3. Server node_modules ffmpeg-installer
    node_bin = Path(__file__).resolve().parent.parent.parent.parent.parent / ".gemini" / "antigravity" / "scratch" / "deepdive-ai" / "server" / "node_modules" / "@ffmpeg-installer" / "win32-x64" / "ffmpeg.exe"
    if node_bin.is_file():
        return str(node_bin)

    # 4. System PATH
    found = shutil.which("ffmpeg")
    if found:
        return found

    raise RuntimeError(
        "FFmpeg is not installed or not found on PATH.\n"
        "To install on Windows:\n"
        "1. Download FFmpeg essentials from https://www.gyan.dev/ffmpeg/builds/\n"
        "2. Extract to C:\\ffmpeg and add C:\\ffmpeg\\bin to your system PATH, or\n"
        "3. Set FFMPEG_PATH=C:/path/to/ffmpeg.exe in backend/.env"
    )


def get_ffprobe_binary() -> str | None:
    if settings.ffprobe_path and Path(settings.ffprobe_path).is_file():
        return str(Path(settings.ffprobe_path).resolve())
    return shutil.which("ffprobe")


YT_RE = re.compile(
    r"(?:youtu\.be/|youtube\.com/(?:watch\?(?:.*&)?v=|embed/|shorts/|live/))([A-Za-z0-9_-]{11})"
)


def extract_youtube_id(url: str) -> str | None:
    m = YT_RE.search(url)
    return m.group(1) if m else None


def probe_youtube(url: str) -> dict:
    opts = {"quiet": True, "no_warnings": True, "skip_download": True, "noplaylist": True}
    with yt_dlp.YoutubeDL(opts) as ydl:
        info = ydl.extract_info(url, download=False)
    return {
        "title": info.get("title") or "Untitled video",
        "duration": float(info.get("duration") or 0),
        "thumbnail": info.get("thumbnail"),
        "channel": info.get("uploader"),
    }


def download_youtube_audio(url: str, outdir: str) -> str:
    opts = {
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,
        "format": "bestaudio/best",
        "outtmpl": str(Path(outdir) / "source.%(ext)s"),
    }
    with yt_dlp.YoutubeDL(opts) as ydl:
        ydl.download([url])
    files = list(Path(outdir).glob("source.*"))
    if not files:
        raise RuntimeError("Could not download audio from YouTube")
    return str(files[0])


def media_duration(path: str) -> float:
    # 1. Try ffprobe if available
    ffprobe_bin = get_ffprobe_binary()
    if ffprobe_bin:
        try:
            out = subprocess.run(
                [ffprobe_bin, "-v", "error", "-show_entries", "format=duration",
                 "-of", "default=nw=1:nk=1", path],
                capture_output=True, text=True, timeout=60,
            )
            val = float(out.stdout.strip() or 0)
            if val > 0:
                return val
        except Exception:
            pass

    # 2. Reliable fallback: parse duration from ffmpeg stderr
    try:
        ffmpeg_bin = get_ffmpeg_binary()
        proc = subprocess.run([ffmpeg_bin, "-i", path], capture_output=True, text=True, errors="ignore")
        match = re.search(r"Duration:\s*(\d+):(\d+):(\d+\.?\d*)", proc.stderr)
        if match:
            h, m, s = match.groups()
            return int(h) * 3600 + int(m) * 60 + float(s)
    except Exception:
        pass

    return 0.0


def split_audio(src: str, outdir: str, seg_seconds: int = 600) -> list[tuple[str, int]]:
    """Re-encode to small mono MP3 parts (Whisper API accepts files up to 25 MB)."""
    ffmpeg_bin = get_ffmpeg_binary()
    pattern = str(Path(outdir) / "part_%03d.mp3")
    cmd = [
        ffmpeg_bin, "-y", "-i", src, "-vn", "-ac", "1", "-ar", "16000", "-b:a", "32k",
        "-f", "segment", "-segment_time", str(seg_seconds), "-reset_timestamps", "1", pattern,
    ]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True)
    except FileNotFoundError:
        raise RuntimeError("ffmpeg is not installed. Install it and make sure it is on your PATH.")
    if r.returncode != 0:
        raise RuntimeError("ffmpeg failed: " + r.stderr[-300:])
    parts = sorted(Path(outdir).glob("part_*.mp3"))
    if not parts:
        raise RuntimeError("No audio track found in this video")
    return [(str(p), i * seg_seconds) for i, p in enumerate(parts)]
