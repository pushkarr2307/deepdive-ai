import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import { Logo } from "../components/Layout.jsx";

const POINTS = [
  "Structured notes and a concise summary",
  "Key timestamps you can jump to",
  "Flashcards and quizzes for revision",
  "Ask questions, get answers grounded in the video",
];

export default function AuthPage() {
  const { user, login, register } = useAuth();
  const nav = useNavigate();
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "login") await login(form.email, form.password);
      else await register(form.name, form.email, form.password);
      nav("/");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <section className="hidden flex-col justify-between bg-ink p-12 text-paper lg:flex">
        <Logo className="text-paper" />
        <div>
          <h1 className="font-display text-5xl font-medium leading-tight">
            Stop scrubbing.
            <br />
            Start <span className="text-accent">understanding</span>.
          </h1>
          <p className="mt-5 max-w-md text-paper/70">
            Drop in a lecture, webinar or tutorial. DeepDive turns it into notes, timestamps, quizzes and a
            study assistant that has actually watched it.
          </p>
          <ul className="mt-8 space-y-2.5 text-sm text-paper/80">
            {POINTS.map((p) => (
              <li key={p} className="flex gap-3">
                <span className="text-accent">▸</span>
                {p}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-paper/40">M.Sc.IT (AI &amp; ML) · Ganpat University</p>
      </section>

      <section className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-sm">
          <Logo className="mb-8 block lg:hidden" />
          <h2 className="font-display text-3xl font-medium">{mode === "login" ? "Welcome back" : "Create your account"}</h2>
          <p className="mt-1.5 text-sm text-muted">
            {mode === "login" ? "Sign in to your library." : "It takes a few seconds."}
          </p>

          <div className="mt-7 space-y-4">
            {mode === "register" && (
              <div>
                <label className="mb-1.5 block text-sm font-medium">Name</label>
                <input className="input" value={form.name} onChange={set("name")} required />
              </div>
            )}
            <div>
              <label className="mb-1.5 block text-sm font-medium">Email</label>
              <input className="input" type="email" value={form.email} onChange={set("email")} required />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Password</label>
              <input className="input" type="password" minLength={6} value={form.password} onChange={set("password")} required />
            </div>
          </div>

          {error && <p className="mt-4 rounded-lg bg-accent/10 px-3 py-2 text-sm text-accent">{error}</p>}

          <button className="btn-primary mt-6 w-full" disabled={busy}>
            {busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
          </button>

          <p className="mt-5 text-center text-sm text-muted">
            {mode === "login" ? "New here?" : "Already have an account?"}{" "}
            <button
              type="button"
              className="font-medium text-ink underline underline-offset-4"
              onClick={() => {
                setMode(mode === "login" ? "register" : "login");
                setError("");
              }}
            >
              {mode === "login" ? "Create an account" : "Sign in"}
            </button>
          </p>
        </form>
      </section>
    </div>
  );
}
