import { Link, Outlet } from "react-router-dom";
import { useAuth } from "../auth.jsx";

export function Logo({ className = "" }) {
  return (
    <span className={`font-display text-xl font-semibold tracking-tight ${className}`}>
      DeepDive<span className="text-accent">·</span>AI
    </span>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-line bg-paper/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link to="/">
            <Logo />
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-muted sm:inline">{user?.name}</span>
            <button onClick={logout} className="btn-ghost !py-1.5">
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
