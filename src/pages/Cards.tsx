import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { useCards } from "../api/hooks";
import type { Card } from "../api/types";
import { Empty, ErrorBox, PageTitle, Spinner } from "../components/ui";

type SortKey = "name" | "set" | "number" | "type";
type Dir = "asc" | "desc";

const typeLabel = (c: Card) => (c.is_basic_energy ? "Basic Energy" : c.supertype || "—");
const numVal = (s: string) => {
  const m = s.match(/\d+/);
  return m ? parseInt(m[0], 10) : Number.POSITIVE_INFINITY;
};

export default function Cards() {
  const { data, isLoading, error } = useCards();
  const [q, setQ] = useState("");
  const [type, setType] = useState("all");
  const [set, setSet] = useState("all");
  const [sort, setSort] = useState<SortKey>("name");
  const [dir, setDir] = useState<Dir>("asc");
  const [view, setView] = useState<"table" | "grid">(() => (localStorage.getItem("cardsView") as "table" | "grid") || "table");
  const setViewMode = (v: "table" | "grid") => {
    setView(v);
    try {
      localStorage.setItem("cardsView", v);
    } catch {
      /* ignore */
    }
  };

  const sets = useMemo(
    () => Array.from(new Set((data ?? []).map((c) => c.card_set))).sort((a, b) => a.localeCompare(b)),
    [data],
  );

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let r = (data ?? []).filter((c) => c.card_name.toLowerCase().includes(needle));
    if (set !== "all") r = r.filter((c) => c.card_set === set);
    if (type !== "all") {
      r = r.filter((c) => {
        if (type === "energy") return c.is_basic_energy || c.supertype === "Energy";
        if (type === "pokemon") return c.supertype.startsWith("Pok");
        if (type === "trainer") return c.supertype === "Trainer";
        return true;
      });
    }
    const mul = dir === "asc" ? 1 : -1;
    return [...r].sort((a, b) => {
      let cmp = 0;
      if (sort === "name") cmp = a.card_name.localeCompare(b.card_name);
      else if (sort === "set") cmp = a.card_set.localeCompare(b.card_set) || numVal(a.set_number) - numVal(b.set_number);
      else if (sort === "number") cmp = numVal(a.set_number) - numVal(b.set_number);
      else if (sort === "type") cmp = typeLabel(a).localeCompare(typeLabel(b));
      return cmp * mul || a.card_name.localeCompare(b.card_name);
    });
  }, [data, q, type, set, sort, dir]);

  if (isLoading) return <Spinner />;
  if (error) return <ErrorBox error={error} />;

  const toggle = (key: SortKey) => {
    if (sort === key) setDir(dir === "asc" ? "desc" : "asc");
    else {
      setSort(key);
      setDir("asc");
    }
  };
  const Th = ({ k, label, align = "left" }: { k: SortKey; label: string; align?: "left" | "right" }) => (
    <th className={`px-3 py-2 text-${align}`}>
      <button type="button" className="inline-flex items-center gap-1 transition hover:text-ink" onClick={() => toggle(k)}>
        {label}
        <span className="text-[10px] opacity-70">{sort === k ? (dir === "asc" ? "▲" : "▼") : "↕"}</span>
      </button>
    </th>
  );

  return (
    <div>
      <PageTitle actions={<Link className="btn-primary" to="/cards/search">+ Look up a card</Link>}>Card Catalog</PageTitle>
      <p className="mb-3 text-sm text-muted">
        Only cards you've referenced appear here — the catalog never imports whole sets.
      </p>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input className="input max-w-xs" placeholder="Filter by name…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input w-auto" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="all">All types</option>
          <option value="pokemon">Pokémon</option>
          <option value="trainer">Trainer</option>
          <option value="energy">Energy</option>
        </select>
        <select className="input w-auto" value={set} onChange={(e) => setSet(e.target.value)}>
          <option value="all">All sets</option>
          {sets.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        {(q || type !== "all" || set !== "all") && (
          <button
            type="button"
            className="btn-secondary btn-sm"
            onClick={() => {
              setQ("");
              setType("all");
              setSet("all");
            }}
          >
            Clear
          </button>
        )}
        <span className="ml-auto text-sm text-muted">
          {rows.length} card{rows.length === 1 ? "" : "s"}
        </span>
        <div className="flex overflow-hidden rounded-lg border border-edge">
          <button
            type="button"
            className={`px-3 py-1.5 text-sm font-semibold transition ${view === "table" ? "bg-accent text-accentInk" : "text-muted hover:text-ink"}`}
            onClick={() => setViewMode("table")}
            title="Table view"
          >
            ☰ Table
          </button>
          <button
            type="button"
            className={`px-3 py-1.5 text-sm font-semibold transition ${view === "grid" ? "bg-accent text-accentInk" : "text-muted hover:text-ink"}`}
            onClick={() => setViewMode("grid")}
            title="Grid view with card images"
          >
            ▦ Grid
          </button>
        </div>
      </div>
      {rows.length === 0 ? (
        <Empty>
          No cards match. <Link className="text-brand" to="/cards/search">Look one up</Link>.
        </Empty>
      ) : view === "grid" ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {rows.map((c) => (
            <Link
              key={c.card_id}
              to={`/cards/${encodeURIComponent(c.card_id)}`}
              className="card group flex flex-col overflow-hidden p-2 transition hover:border-brand/50"
            >
              <div className="aspect-[5/7] overflow-hidden rounded-md bg-sunken">
                {c.image_url ? (
                  <img
                    src={c.image_url}
                    alt={c.card_name}
                    loading="lazy"
                    className="h-full w-full object-contain transition group-hover:scale-[1.03]"
                  />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-1 p-2 text-center">
                    <span className="text-xs font-semibold text-ink">{c.card_name}</span>
                    <span className="text-[11px] text-muted">no image</span>
                  </div>
                )}
              </div>
              <div className="mt-1.5 truncate text-xs font-semibold text-brand" title={c.card_name}>
                {c.card_name}
                {c.is_ace_spec && <span className="ml-1 text-accent">★</span>}
              </div>
              <div className="text-[11px] text-muted">
                {c.card_set} {c.set_number}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wide text-muted">
              <tr className="border-b border-edge/60">
                <Th k="name" label="Card" />
                <Th k="set" label="Set" />
                <Th k="number" label="No." />
                <Th k="type" label="Type" />
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.card_id} className="border-b border-edge/40 hover:bg-hover/40">
                  <td className="px-3 py-2">
                    <Link className="text-brand" to={`/cards/${encodeURIComponent(c.card_id)}`}>
                      {c.card_name}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-muted">{c.card_set}</td>
                  <td className="px-3 py-2 text-muted">{c.set_number}</td>
                  <td className="px-3 py-2 text-muted">
                    {typeLabel(c)}
                    {c.is_ace_spec && <span className="ml-1 text-accent" title="ACE SPEC">★</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
