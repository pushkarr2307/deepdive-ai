import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { api, fmtTime, parseTime } from "../api.js";

const Empty = ({ children }) => <p className="py-10 text-center text-sm text-muted">{children}</p>;

function TimeBtn({ sec, onSeek, children }) {
  return (
    <button
      onClick={() => onSeek(sec)}
      className="rounded-md bg-ink/5 px-1.5 py-0.5 font-mono text-xs font-medium text-ink hover:bg-accent hover:text-white"
      title="Jump to this moment"
    >
      {children ?? fmtTime(sec)}
    </button>
  );
}

// turns "[3:25]" or "[0:44, 7:24]" in text into clickable timestamps
function Linkified({ text, onSeek }) {
  if (!text) return null;
  // Match single or comma-separated timestamps within brackets, e.g. [3:25] or [0:44, 7:24]
  const bracketParts = text.split(/(\[[0-9:,\s]+\])/g);
  return (
    <>
      {bracketParts.map((part, i) => {
        const bracketMatch = part.match(/^\[([0-9:,\s]+)\]$/);
        if (bracketMatch) {
          const rawTimes = bracketMatch[1].split(",");
          return (
            <span key={i} className="inline-flex flex-wrap items-center gap-1 mx-1">
              [
              {rawTimes.map((tStr, j) => {
                const trimmed = tStr.trim();
                const sec = parseTime(trimmed);
                return !isNaN(sec) ? (
                  <span key={j}>
                    {j > 0 && ", "}
                    <TimeBtn sec={sec} onSeek={onSeek}>
                      {trimmed}
                    </TimeBtn>
                  </span>
                ) : (
                  <span key={j}>
                    {j > 0 && ", "}
                    {trimmed}
                  </span>
                );
              })}
              ]
            </span>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

/* ---------------------------------------------------------------- Notes */
export function NotesPanel({ outputs }) {
  if (!outputs?.notes_markdown) return <Empty>No notes were generated.</Empty>;
  return (
    <article className="prose prose-sm max-w-none prose-headings:font-display prose-headings:font-medium prose-a:text-accent">
      <ReactMarkdown>{outputs.notes_markdown}</ReactMarkdown>
    </article>
  );
}

/* ---------------------------------------------------------------- Timestamps */
export function TimestampsPanel({ outputs, onSeek, canSeek }) {
  const items = outputs?.key_timestamps || [];
  if (!items.length) return <Empty>No key moments found.</Empty>;
  return (
    <ol className="space-y-3">
      {items.map((k, i) => (
        <li key={i} className="flex gap-4 rounded-xl border border-line bg-paper/60 p-3.5">
          {canSeek ? <TimeBtn sec={k.time_seconds} onSeek={onSeek} /> : <span className="font-mono text-xs">{fmtTime(k.time_seconds)}</span>}
          <div>
            <p className="text-sm font-medium">{k.title}</p>
            {k.description && <p className="mt-0.5 text-sm text-muted">{k.description}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}

/* ---------------------------------------------------------------- Action items */
export function ActionsPanel({ outputs, onSeek, canSeek, videoId }) {
  const items = outputs?.action_items || [];
  const key = `dd_actions_${videoId}`;
  const [done, setDone] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(key) || "[]");
    } catch {
      return [];
    }
  });
  const toggle = (i) => {
    const next = done.includes(i) ? done.filter((x) => x !== i) : [...done, i];
    setDone(next);
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {}
  };
  if (!items.length) return <Empty>This video has no action items.</Empty>;
  return (
    <ul className="space-y-2.5">
      {items.map((a, i) => (
        <li key={i} className="flex items-start gap-3 rounded-xl border border-line bg-paper/60 p-3.5">
          <input type="checkbox" checked={done.includes(i)} onChange={() => toggle(i)} className="mt-1 h-4 w-4 accent-accent" />
          <p className={`flex-1 text-sm ${done.includes(i) ? "text-muted line-through" : ""}`}>{a.task}</p>
          {a.time_seconds != null && canSeek && <TimeBtn sec={a.time_seconds} onSeek={onSeek} />}
        </li>
      ))}
    </ul>
  );
}

/* ---------------------------------------------------------------- Flashcards */
export function FlashcardsPanel({ outputs }) {
  const original = outputs?.flashcards || [];
  const [cards, setCards] = useState(original);
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  useEffect(() => setCards(original), [outputs]); // eslint-disable-line

  if (!cards.length) return <Empty>No flashcards were generated.</Empty>;
  const go = (d) => {
    setFlipped(false);
    setI((i + d + cards.length) % cards.length);
  };
  const shuffle = () => {
    setFlipped(false);
    setI(0);
    setCards([...cards].sort(() => Math.random() - 0.5));
  };
  const c = cards[i];
  return (
    <div>
      <button
        onClick={() => setFlipped(!flipped)}
        className={`flex min-h-[220px] w-full items-center justify-center rounded-2xl border p-8 text-center transition ${
          flipped ? "border-moss/40 bg-moss/5" : "border-line bg-paper/60"
        }`}
      >
        <div>
          <p className="mb-3 text-xs font-medium uppercase tracking-widest text-muted">{flipped ? "Answer" : "Question"}</p>
          <p className={`font-display text-xl leading-snug ${flipped ? "text-moss" : ""}`}>{flipped ? c.answer : c.question}</p>
          {!flipped && <p className="mt-5 text-xs text-muted">Click to reveal</p>}
        </div>
      </button>
      <div className="mt-4 flex items-center justify-between">
        <button className="btn-ghost" onClick={() => go(-1)}>← Prev</button>
        <div className="text-center text-sm text-muted">
          {i + 1} / {cards.length}
          <button onClick={shuffle} className="ml-3 underline underline-offset-4 hover:text-ink">Shuffle</button>
        </div>
        <button className="btn-ghost" onClick={() => go(1)}>Next →</button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- Quiz */
export function QuizPanel({ outputs }) {
  const quiz = outputs?.quiz || [];
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  if (!quiz.length) return <Empty>No quiz was generated.</Empty>;

  const score = quiz.filter((q, i) => answers[i] === q.answer_index).length;
  const reset = () => {
    setAnswers({});
    setSubmitted(false);
  };
  return (
    <div className="space-y-6">
      {submitted && (
        <div className="rounded-xl border border-moss/30 bg-moss/10 p-4 text-sm">
          You scored <b>{score}</b> out of <b>{quiz.length}</b>.{" "}
          <button onClick={reset} className="font-medium underline underline-offset-4">Try again</button>
        </div>
      )}
      {quiz.map((q, qi) => (
        <div key={qi}>
          <p className="text-sm font-medium">
            {qi + 1}. {q.question}
          </p>
          <div className="mt-2.5 space-y-2">
            {q.options.map((o, oi) => {
              const picked = answers[qi] === oi;
              const correct = submitted && oi === q.answer_index;
              const wrong = submitted && picked && oi !== q.answer_index;
              return (
                <button
                  key={oi}
                  disabled={submitted}
                  onClick={() => setAnswers({ ...answers, [qi]: oi })}
                  className={`block w-full rounded-lg border px-3.5 py-2.5 text-left text-sm transition ${
                    correct
                      ? "border-moss bg-moss/10"
                      : wrong
                      ? "border-accent bg-accent/10"
                      : picked
                      ? "border-ink bg-ink/5"
                      : "border-line bg-paper/60 hover:border-ink/40"
                  }`}
                >
                  {o}
                </button>
              );
            })}
          </div>
          {submitted && q.explanation && <p className="mt-2 text-sm text-muted">{q.explanation}</p>}
        </div>
      ))}
      {!submitted && (
        <button className="btn-primary" disabled={Object.keys(answers).length < quiz.length} onClick={() => setSubmitted(true)}>
          Check answers
        </button>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- Chat */
export function ChatPanel({ videoId, onSeek, canSeek }) {
  const [msgs, setMsgs] = useState([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef(null);

  useEffect(() => {
    api.chatHistory(videoId).then(setMsgs).catch(() => {});
  }, [videoId]);
  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), [msgs, busy]);

  async function send(e) {
    e.preventDefault();
    const question = q.trim();
    if (!question || busy) return;
    setQ("");
    setError("");
    setMsgs((m) => [...m, { role: "user", content: question }]);
    setBusy(true);
    try {
      const res = await api.chat(videoId, question);
      setMsgs((m) => [...m, { role: "assistant", content: res.answer, sources: res.sources }]);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function clear() {
    await api.clearChat(videoId);
    setMsgs([]);
  }

  return (
    <div className="flex h-[560px] flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto pr-1">
        {msgs.length === 0 && !busy && (
          <Empty>Ask anything about this video — “What are the main takeaways?”, “Explain the part about…”</Empty>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : ""}>
            <div
              className={`max-w-[88%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                m.role === "user" ? "bg-ink text-paper" : "border border-line bg-paper/70"
              }`}
            >
              {m.role === "assistant" && canSeek ? <Linkified text={m.content} onSeek={onSeek} /> : m.content}
              {m.role === "assistant" && m.sources?.length > 0 && (
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-line pt-2 text-xs text-muted">
                  Sources:
                  {m.sources.slice(0, 4).map((s, j) =>
                    canSeek ? (
                      <TimeBtn key={j} sec={s.start} onSeek={onSeek} />
                    ) : (
                      <span key={j} className="font-mono">{fmtTime(s.start)}</span>
                    )
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        {busy && <p className="text-sm text-muted">Thinking…</p>}
        <div ref={endRef} />
      </div>
      {error && <p className="mt-2 text-sm text-accent">{error}</p>}
      <form onSubmit={send} className="mt-3 flex gap-2">
        <input className="input" placeholder="Ask about this video…" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn-primary" disabled={busy || !q.trim()}>Send</button>
        {msgs.length > 0 && (
          <button type="button" className="btn-ghost" onClick={clear} title="Clear conversation">Clear</button>
        )}
      </form>
    </div>
  );
}

/* ---------------------------------------------------------------- Semantic search */
export function SearchPanel({ videoId, onSeek, canSeek }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function run(e) {
    e.preventDefault();
    if (q.trim().length < 2) return;
    setBusy(true);
    setError("");
    try {
      setResults((await api.search(videoId, q.trim())).results);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <form onSubmit={run} className="flex gap-2">
        <input className="input" placeholder="Search by meaning, e.g. “how does backpropagation work”" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn-primary" disabled={busy}>{busy ? "…" : "Search"}</button>
      </form>
      {error && <p className="mt-3 text-sm text-accent">{error}</p>}
      {results && results.length === 0 && <Empty>No matches.</Empty>}
      <ul className="mt-4 space-y-3">
        {results?.map((r, i) => (
          <li key={i} className="rounded-xl border border-line bg-paper/60 p-3.5">
            <div className="mb-1.5 flex items-center gap-3">
              {canSeek ? <TimeBtn sec={r.start} onSeek={onSeek} /> : <span className="font-mono text-xs">{fmtTime(r.start)}</span>}
              <span className="text-xs text-muted">match {Math.round(r.score * 100)}%</span>
            </div>
            <p className="text-sm leading-relaxed">{r.text}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------------------------------------------------------------- Transcript */
export function TranscriptPanel({ videoId, onSeek, canSeek }) {
  const [segs, setSegs] = useState(null);
  useEffect(() => {
    api.getTranscript(videoId).then((r) => setSegs(r.segments)).catch(() => setSegs([]));
  }, [videoId]);
  if (segs === null) return <Empty>Loading transcript…</Empty>;
  if (!segs.length) return <Empty>No transcript available.</Empty>;
  return (
    <div className="max-h-[560px] space-y-2 overflow-y-auto pr-1">
      {segs.map((s, i) => (
        <div key={i} className="flex gap-3 text-sm">
          <span className="w-14 shrink-0 pt-0.5">
            {canSeek ? <TimeBtn sec={s.start} onSeek={onSeek} /> : <span className="font-mono text-xs">{fmtTime(s.start)}</span>}
          </span>
          <p className="leading-relaxed">{s.text}</p>
        </div>
      ))}
    </div>
  );
}
