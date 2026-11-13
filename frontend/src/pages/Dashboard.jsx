import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, fmtTime } from "../api.js";
import StatusPill, { inProgress } from "../components/StatusPill.jsx";

export default function Dashboard() {
  const nav = useNavigate();
  const fileRef = useRef(null);
  const [videos, setVideos] = useState(null);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(() => api.listVideos().then(setVideos).catch((e) => setError(e.message)), []);

  useEffect(() => {
    load();
  }, [load]);

  // keep polling while anything is still processing
  useEffect(() => {
    if (!videos?.some((v) => inProgress(v.status))) return;
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [videos, load]);

  async function addUrl(e) {
    e.preventDefault();
    if (!url.trim()) return;
    setBusy(true);
    setError("");
    try {
      const v = await api.addYoutube(url.trim());
      setUrl("");
      nav(`/video/${v.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function onFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const v = await api.upload(file);
      nav(`/video/${v.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(e, id) {
    e.preventDefault();
    if (!confirm("Delete this video and everything generated from it?")) return;
    await api.deleteVideo(id);
    load();
  }

  return (
    <div>
      <section className="card p-6 sm:p-8">
        <h1 className="font-display text-3xl font-medium">What are we diving into?</h1>
        <p className="mt-1.5 text-sm text-muted">Paste a YouTube link or upload a recording. Longer videos take a few minutes.</p>

        <form onSubmit={addUrl} className="mt-5 flex flex-col gap-3 sm:flex-row">
          <input
            className="input flex-1"
            placeholder="https://www.youtube.com/watch?v=…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <button className="btn-accent sm:w-36" disabled={busy || !url.trim()}>
            {busy ? "Working…" : "Dive in"}
          </button>
          <button type="button" className="btn-ghost" disabled={busy} onClick={() => fileRef.current?.click()}>
            Upload file
          </button>
          <input ref={fileRef} type="file" accept="video/*,audio/*" className="hidden" onChange={onFile} />
        </form>
        {error && <p className="mt-3 text-sm text-accent">{error}</p>}
      </section>

      <h2 className="mb-4 mt-10 font-display text-xl font-medium">Your library</h2>

      {videos === null ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : videos.length === 0 ? (
        <div className="card border-dashed p-10 text-center text-sm text-muted">
          Nothing here yet. Add your first video above.
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {videos.map((v) => (
            <Link key={v.id} to={`/video/${v.id}`} className="card group overflow-hidden transition hover:border-ink/40">
              <div className="relative aspect-video bg-ink/90">
                {v.thumbnail ? (
                  <img src={v.thumbnail} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center font-display text-4xl text-paper/30">▶</div>
                )}
                {v.duration > 0 && (
                  <span className="absolute bottom-2 right-2 rounded bg-ink/80 px-1.5 py-0.5 text-xs text-paper">
                    {fmtTime(v.duration)}
                  </span>
                )}
              </div>
              <div className="p-4">
                <h3 className="line-clamp-2 min-h-[2.5rem] text-sm font-medium leading-snug">{v.title}</h3>
                <div className="mt-3 flex items-center justify-between">
                  <StatusPill status={v.status} />
                  <button onClick={(e) => remove(e, v.id)} className="text-xs text-muted hover:text-accent">
                    Delete
                  </button>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
