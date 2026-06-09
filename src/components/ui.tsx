import type { ReactNode } from "react";

export function PageTitle({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <h1 className="text-2xl font-extrabold tracking-tight">{children}</h1>
      {actions && <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({ label, value, tone }: { label: string; value: ReactNode; tone?: "neg" }) {
  return (
    <div className="card bg-gradient-to-b from-panel2 to-panel p-4">
      <div className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</div>
      <div className={`mt-0.5 text-3xl font-extrabold tabular-nums ${tone === "neg" ? "text-danger" : ""}`}>
        {value}
      </div>
    </div>
  );
}

export function Badge({ children, tone = "in" }: { children: ReactNode; tone?: "in" | "out" | "bad" | "neutral" }) {
  const cls =
    tone === "in"
      ? "border-ok/30 bg-ok/10 text-ok"
      : tone === "bad"
        ? "border-danger/30 bg-danger/10 text-danger"
        : tone === "neutral"
          ? "border-edge bg-hover text-muted"
          : "border-accent/30 bg-accent/10 text-accent";
  return <span className={`badge ${cls}`}>{children}</span>;
}

export function Spinner({ label = "Loading…" }: { label?: string }) {
  return <div className="py-10 text-center text-muted">{label}</div>;
}

export function ErrorBox({ error }: { error: unknown }) {
  const msg = error instanceof Error ? error.message : "Something went wrong.";
  return <div className="card border-danger/40 p-4 text-danger">{msg}</div>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="card p-6 text-muted">{children}</div>;
}

export function Section({ title, action, children }: { title: ReactNode; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center gap-3">
        <h2 className="text-lg font-bold">{title}</h2>
        {action && <div className="ml-auto text-sm">{action}</div>}
      </div>
      {children}
    </section>
  );
}

export function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const color = value > max ? "bg-danger" : value >= max ? "bg-ok" : "bg-accent";
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-sunken">
      <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function NumberStepper({
  value,
  onChange,
  min = 0,
  max,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  const clamp = (v: number) => {
    let n = Math.max(min, v);
    if (max !== undefined) n = Math.min(max, n);
    return n;
  };
  return (
    <div className="inline-flex h-9 select-none items-stretch overflow-hidden rounded-lg border border-edge bg-sunken">
      <button
        type="button"
        className="w-9 text-lg font-semibold text-muted transition hover:bg-hover hover:text-ink active:bg-accent active:text-accentInk"
        onClick={() => onChange(clamp(value - 1))}
        aria-label="decrease"
      >
        −
      </button>
      <input
        type="number"
        className="w-12 border-x border-edge bg-transparent text-center tabular-nums outline-none"
        value={value}
        min={min}
        onChange={(e) => onChange(clamp(parseInt(e.target.value, 10) || 0))}
      />
      <button
        type="button"
        className="w-9 text-lg font-semibold text-muted transition hover:bg-hover hover:text-ink active:bg-accent active:text-accentInk"
        onClick={() => onChange(clamp(value + 1))}
        aria-label="increase"
      >
        +
      </button>
    </div>
  );
}
