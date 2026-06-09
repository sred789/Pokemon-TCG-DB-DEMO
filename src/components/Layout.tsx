import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";

import { resetDb } from "../demo/db";
import ThemeToggle from "./ThemeToggle";

function resetDemo() {
  if (window.confirm("Reset the demo to its original data? This discards your changes.")) {
    resetDb();
    window.location.reload();
  }
}

const LINKS = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/cards", label: "Cards" },
  { to: "/orders", label: "Orders" },
  { to: "/inventory", label: "Inventory" },
  { to: "/decks", label: "Decks" },
  { to: "/shopping", label: "Shopping List" },
];

export default function Layout() {
  const [open, setOpen] = useState(false);
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `rounded-lg px-3 py-2 text-sm font-semibold transition ${
      isActive ? "bg-hover text-ink" : "text-muted hover:bg-hover hover:text-ink"
    }`;

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-30 border-b border-edge bg-bg/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5">
          <NavLink to="/" className="flex items-center gap-2 font-extrabold text-accent">
            <span className="text-lg">◉</span>
            <span className="hidden sm:inline">Pokédex DB</span>
          </NavLink>
          <nav className="ml-4 hidden flex-wrap gap-1 md:flex">
            {LINKS.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end} className={linkClass}>
                {l.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <button className="btn-secondary btn-sm" onClick={resetDemo}>
              Reset demo
            </button>
            <ThemeToggle />
            <button
              className="btn-secondary btn-sm md:hidden"
              onClick={() => setOpen((o) => !o)}
              aria-label="Toggle menu"
            >
              ☰
            </button>
          </div>
        </div>
        <div className="border-t border-edge bg-hover/40 px-4 py-1 text-center text-xs text-muted">
          Demo — sample data runs entirely in your browser; edits are saved locally and never
          leave your device.
        </div>
        {open && (
          <nav className="flex flex-col gap-1 border-t border-edge px-4 py-2 md:hidden">
            {LINKS.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                className={linkClass}
                onClick={() => setOpen(false)}
              >
                {l.label}
              </NavLink>
            ))}
          </nav>
        )}
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 pb-20">
        <Outlet />
      </main>
    </div>
  );
}
