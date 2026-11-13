import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, fmtTime } from "../api.js";
import StatusPill, { STAGES, inProgress } from "../components/StatusPill.jsx";
import {
  ActionsPanel,
  ChatPanel,
  FlashcardsPanel,
  NotesPanel,
  QuizPanel,
  SearchPanel,
  TimestampsPanel,
  TranscriptPanel,
} from "../components/panels.jsx";

const TABS = [
  ["notes", "Notes"],
  ["moments", "Key moments"],
  ["actions", "Action items"],
  ["flashcards", "Flashcards"],
  ["quiz", "Quiz"],
  ["chat", "Ask AI"],
  ["search", "Search"],
  ["transcript", "Transcript"],
];

function Progress({ video }) {
  const idx = Math.max(0, STAGES.findIndex((s) => s.key === video.status));
  return (
    <div className="card mx-auto mt-6 max-w-xl p-8 text-center">
      <h2 className="font-display text-2xl font-medium">Diving in…</h2>
      <p className="mt-1.5 text-sm text-muted">{video.stage_message}. You can leave this page — it keeps working.</p>
      <div className="mt-7 flex items-center justify-between">
        {STAGES.slice(0, 5).map((s, i) => (
          <div key={s.key} className="flex flex-1 flex-col items-center gap-2">
            <span
              className={`h-3 w-3 rounded-full ${i < idx ? "bg-moss" : i === idx ? "animate-pulse bg-accent" : "bg-line"}`}
            />
            <span className={`text-[11px] ${i === idx ? "font-medium text-ink" : "text-muted"}`}>{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function VideoPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("notes");
  const [startAt, setStartAt] = useState(0);

  const load = useCallback(() => api.getVideo(id).then(setData).catch((e) => setError(e.message)), [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!data || !inProgress(data.video.status)) return;
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [data, load]);

  if (error) return <p className="text-accent">{error}</p>;
  if (!data) return <p className="text-muted">Loading…</p>;

  const { video, outputs } = data;
  const isYT = video.source === "youtube";
  const seek = (sec) => setStartAt(Math.floor(sec));
  const ready = video.status === "ready";

  return (
    <div>
      <Link to="/" className="text-sm text-muted hover:text-ink">← Library</Link>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-medium leading-snug sm:text-3xl">{video.title}</h1>
          <p className="mt-1 text-sm text-muted">
            {[video.channel, video.duration ? fmtTime(video.duration) : null].filter(Boolean).join(" · ")}
          </p>
        </div>
        <StatusPill status={video.status} />
      </div>

      {inProgress(video.status) && <Progress video={video} />}

      {video.status === "failed" && (
        <div className="card mx-auto mt-6 max-w-xl border-accent/40 p-6">
          <h2 className="font-medium text-accent">Processing failed</h2>
          <p className="mt-2 break-words text-sm">{video.error}</p>
          <p className="mt-3 text-sm text-muted">Fix the issue, delete this entry from your library and add the video again.</p>
        </div>
      )}

      {ready && outputs && (
        <div className="mt-6 grid gap-6 lg:grid-cols-5">
          <aside className="space-y-5 lg:col-span-2">
            {isYT ? (
              <div className="card overflow-hidden">
                <div className="aspect-video bg-ink">
                  <iframe
                    key={startAt}
                    className="h-full w-full"
                    src={`https://www.youtube.com/embed/${video.youtube_id}?start=${startAt}&autoplay=${startAt ? 1 : 0}&rel=0`}
                    title={video.title}
                    allow="autoplay; encrypted-media; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              </div>
            ) : (
              <div className="card p-4 text-sm text-muted">
                Uploaded files are processed and then discarded, so there is no player here. Timestamps refer to your original file.
              </div>
            )}
            <div className="card p-5">
              <h2 className="font-display text-lg font-medium">Summary</h2>
              <p className="mt-2 text-sm leading-relaxed">{outputs.summary}</p>
            </div>
          </aside>

          <section className="card p-5 lg:col-span-3">
            <div className="-mx-1 mb-5 flex gap-1 overflow-x-auto border-b border-line pb-3">
              {TABS.map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                    tab === key ? "bg-ink text-paper" : "text-muted hover:bg-ink/5 hover:text-ink"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {tab === "notes" && <NotesPanel outputs={outputs} />}
            {tab === "moments" && <TimestampsPanel outputs={outputs} onSeek={seek} canSeek={isYT} />}
            {tab === "actions" && <ActionsPanel outputs={outputs} onSeek={seek} canSeek={isYT} videoId={id} />}
            {tab === "flashcards" && <FlashcardsPanel outputs={outputs} />}
            {tab === "quiz" && <QuizPanel outputs={outputs} />}
            {tab === "chat" && <ChatPanel videoId={id} onSeek={seek} canSeek={isYT} />}
            {tab === "search" && <SearchPanel videoId={id} onSeek={seek} canSeek={isYT} />}
            {tab === "transcript" && <TranscriptPanel videoId={id} onSeek={seek} canSeek={isYT} />}
          </section>
        </div>
      )}
    </div>
  );
}
