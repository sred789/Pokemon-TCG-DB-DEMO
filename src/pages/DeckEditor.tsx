import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { useDeckModel, useDeleteDeck, useSaveDeck } from "../api/hooks";
import type { DeckModel, Slot } from "../api/types";
import ExportDialog from "../components/ExportDialog";
import { useToast } from "../components/Toast";
import { Badge, ErrorBox, NumberStepper, PageTitle, Spinner } from "../components/ui";
import { computeLegality, MAX_ACE, MAX_NAME } from "../lib/deck";
import { officialDecklist } from "../lib/export";

export default function DeckEditor() {
  const { deckId = "" } = useParams();
  const id = Number(deckId);
  const { data, isLoading, error } = useDeckModel(id);
  if (isLoading) return <Spinner />;
  if (error) return <ErrorBox error={error} />;
  return <Editor key={id} model={data!} id={id} />;
}

function Editor({ model, id }: { model: DeckModel; id: number }) {
  const { cards, printings } = model;
  const [slots, setSlots] = useState<Slot[]>(model.slots.map((s) => ({ ...s })));
  const [dirty, setDirty] = useState(false);
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [exportOpen, setExportOpen] = useState(false);
  const save = useSaveDeck(id);
  const del = useDeleteDeck();
  const toast = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) { e.preventDefault(); e.returnValue = ""; }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const mutate = (next: Slot[]) => { setSlots(next); setDirty(true); };
  const keyOf = (cid: string) => cards[cid].name_key;
  const allocCap = (cid: string) => (cards[cid].basic_energy ? Infinity : Math.max(0, cards[cid].owned - cards[cid].alloc_others));
  const freeFor = (s: Slot) => (cards[s.card_id].basic_energy ? Infinity : cards[s.card_id].owned - cards[s.card_id].alloc_others - s.allocated);
  // Deck-rule copy limit per card: basic energy is unlimited, ACE SPEC is 1, everything else 4 (by name).
  const copyCap = (cid: string) => (cards[cid].basic_energy ? Infinity : cards[cid].ace_spec ? MAX_ACE : MAX_NAME);
  const groupAllocByKey = (key: string, exclude = -1) =>
    slots.reduce((a, s, j) => (j !== exclude && keyOf(s.card_id) === key ? a + s.allocated : a), 0);
  // Per-printing allocation ceiling: bounded by what you own AND the remaining room under the by-name cap.
  const allocMax = (cid: string, i = -1) =>
    cards[cid].basic_energy ? Infinity : Math.max(0, Math.min(allocCap(cid), copyCap(cid) - groupAllocByKey(cards[cid].name_key, i)));
  const nameOf = (key: string) => {
    for (const cid in cards) if (cards[cid].name_key === key) return cards[cid].name;
    return key;
  };

  const legality = useMemo(() => computeLegality(slots, cards), [slots, cards]);

  const groups = useMemo(() => {
    const map = new Map<string, number[]>();
    slots.forEach((s, i) => {
      const k = keyOf(s.card_id);
      (map.get(k) ?? map.set(k, []).get(k)!).push(i);
    });
    return [...map.entries()]
      .map(([key, idxs]) => ({ key, idxs, type: cards[slots[idxs[0]].card_id].type, name: nameOf(key) }))
      .filter((g) => (!search || g.name.toLowerCase().includes(search.toLowerCase())) && (!type || g.type === type))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [slots, cards, search, type]);

  // Needed is a per-card (by-name) target, held on the group's first slot.
  const groupNeeded = (idxs: number[]) => idxs.reduce((a, j) => a + slots[j].needed, 0);
  const groupAlloc = (idxs: number[]) => idxs.reduce((a, j) => a + slots[j].allocated, 0);
  const setGroupNeeded = (idxs: number[], n: number) => {
    const v = Math.min(n, copyCap(slots[idxs[0]].card_id));
    mutate(slots.map((s, j) => (idxs.includes(j) ? { ...s, needed: j === idxs[0] ? v : 0 } : s)));
  };

  const setAllocated = (i: number, v: number) =>
    mutate(slots.map((s, j) => (j === i ? { ...s, allocated: Math.min(v, allocMax(s.card_id, i)) } : s)));

  // Fill each card's allocation from the copies you own (incl. incoming), greedily across its
  // printings up to the deck's needed count. Basic energy is infinite, so it's skipped.
  const autoAllocate = () => {
    const byKey = new Map<string, number[]>();
    slots.forEach((s, i) => byKey.set(keyOf(s.card_id), [...(byKey.get(keyOf(s.card_id)) ?? []), i]));
    const next = slots.map((s) => ({ ...s }));
    let filled = 0;
    let short = 0;
    for (const idxs of byKey.values()) {
      if (cards[slots[idxs[0]].card_id].basic_energy) continue;
      let remaining = idxs.reduce((a, j) => a + slots[j].needed, 0);
      for (const j of idxs) {
        const give = Math.max(0, Math.min(remaining, allocCap(next[j].card_id)));
        next[j].allocated = give;
        remaining -= give;
        filled += give;
      }
      short += remaining;
    }
    mutate(next);
    toast(short > 0 ? `Allocated ${filled} owned copies — ${short} still short.` : `Allocated ${filled} copies — deck fully covered.`, short > 0 ? "info" : "success");
  };
  const indexOfCard = (cid: string) => slots.findIndex((s) => s.card_id === cid);

  const addPrinting = (cid: string, allocated: number) => {
    const i = indexOfCard(cid);
    if (i >= 0) mutate(slots.map((s, j) => (j === i ? { ...s, allocated: Math.min(s.allocated + allocated, allocMax(cid, i)) } : s)));
    else mutate([...slots, { card_id: cid, needed: 0, allocated: Math.min(allocated, allocMax(cid)) }]);
  };
  const addCard = (cid: string) => {
    if (indexOfCard(cid) >= 0) return;
    mutate([...slots, { card_id: cid, needed: 1, allocated: 0 }]);
  };

  const removeSlot = (i: number) => {
    const removed = slots[i];
    let rest = slots.filter((_, j) => j !== i);
    if (removed.needed > 0) {
      const idx = rest.findIndex((s) => keyOf(s.card_id) === keyOf(removed.card_id));
      if (idx >= 0) rest = rest.map((s, j) => (j === idx ? { ...s, needed: s.needed + removed.needed } : s));
    }
    mutate(rest);
  };

  const switchPrinting = (i: number, newCid: string) => {
    if (newCid === slots[i].card_id) return;
    const cap = Math.min(allocCap(newCid), copyCap(newCid));
    const j = indexOfCard(newCid);
    if (j >= 0 && j !== i) {
      const merged = slots
        .map((s, k) => (k === j ? { ...s, needed: s.needed + slots[i].needed, allocated: Math.min(s.allocated + slots[i].allocated, cap) } : s))
        .filter((_, k) => k !== i);
      mutate(merged);
    } else {
      mutate(slots.map((s, k) => (k === i ? { ...s, card_id: newCid, allocated: Math.min(s.allocated, cap) } : s)));
    }
  };

  const switchOptions = (cid: string) => {
    const list = [...(printings[cards[cid].name_key] ?? [])];
    if (!list.includes(cid)) list.push(cid);
    return list;
  };
  const addablePrintings = (key: string) => {
    const inDeck = new Set(slots.map((s) => s.card_id));
    return (printings[key] ?? []).filter((cid) => !inDeck.has(cid));
  };
  const optLabel = (cid: string) => `${cards[cid].set} ${cards[cid].number} · ${cards[cid].owned} owned`;

  const doSave = () =>
    save.mutate(slots, {
      onSuccess: () => { setDirty(false); toast(`'${model.deck.name}' saved.`, "success"); },
      onError: (e) => toast(e instanceof Error ? e.message : "Save failed", "error"),
    });

  const allCardIds = useMemo(() => Object.keys(cards).sort((a, b) => cards[a].name.localeCompare(cards[b].name)), [cards]);

  const PrintingSelect = ({ i }: { i: number }) => (
    <select className="input w-auto max-w-[230px] py-1 text-xs" value={slots[i].card_id} onChange={(e) => switchPrinting(i, e.target.value)}>
      {switchOptions(slots[i].card_id).map((cid) => <option key={cid} value={cid}>{optLabel(cid)}</option>)}
    </select>
  );

  // Split the deck into decklist-style sections by card type.
  const SECTION_DEFS = [
    { key: "pokemon", label: "Pokémon" },
    { key: "trainer", label: "Trainer" },
    { key: "energy", label: "Energy" },
    { key: "other", label: "Other" },
  ];
  const sections = SECTION_DEFS.map((sec) => {
    const gs = groups.filter((g) => g.type === sec.key);
    return { ...sec, groups: gs, count: gs.reduce((a, g) => a + groupNeeded(g.idxs), 0) };
  }).filter((s) => s.groups.length > 0);

  return (
    <div className="pb-24">
      <p className="mb-1"><Link className="text-brand" to="/decks">← Back to decks</Link></p>
      <PageTitle
        actions={
          <>
            <button className="btn-secondary btn-sm" onClick={() => setExportOpen(true)}>Export decklist</button>
            <Link className="btn-secondary btn-sm" to={`/decks/${id}/import`}>Paste deck list</Link>
            <button className="btn-danger btn-sm" onClick={() => { if (confirm("Delete this deck?")) del.mutate(id, { onSuccess: () => navigate("/decks") }); }}>Delete</button>
          </>
        }
      >
        {model.deck.name}
      </PageTitle>

      {exportOpen && (
        <ExportDialog
          title={`${model.deck.name} — Decklist`}
          subtitle="Official Play! Pokémon / PTCGL format. Reflects unsaved edits. Paste into RK9 or Limitless."
          text={officialDecklist({ slots, cards })}
          filename={`${model.deck.name.replace(/[^\w]+/g, "_").replace(/^_+|_+$/g, "") || "deck"}.txt`}
          onClose={() => setExportOpen(false)}
        />
      )}

      <div className="card mb-4 p-4">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted">Deck legality</div>
        <div className="text-2xl font-extrabold tabular-nums">
          {legality.total}/60{" "}
          {legality.legal ? (legality.total === 60 ? <Badge tone="in">legal</Badge> : <Badge tone="out">{60 - legality.total} to go</Badge>) : <Badge tone="bad">illegal</Badge>}
        </div>
        {legality.violations.length > 0 && (
          <ul className="mt-2 list-disc pl-5 text-sm text-muted">{legality.violations.map((v, i) => <li key={i}>{v}</li>)}</ul>
        )}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input className="input max-w-[220px]" placeholder="Search cards…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="input w-auto" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">All types</option>
          <option value="pokemon">Pokémon</option>
          <option value="trainer">Trainer</option>
          <option value="energy">Energy</option>
        </select>
        <button
          type="button"
          className="btn-secondary btn-sm ml-auto"
          onClick={autoAllocate}
          title="Allocate the copies you own to each card, up to its needed count"
        >
          ⚡ Auto-allocate
        </button>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="text-xs uppercase tracking-wide text-muted">
            <tr className="border-b border-edge/60">
              <th className="px-3 py-2 text-left">Card / printing</th>
              <th className="px-3 py-2 text-left">Needed</th>
              <th className="px-3 py-2 text-left">Allocated</th>
              <th className="px-3 py-2 text-right">Short.</th>
              <th className="px-3 py-2 text-right">Free</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sections.map((sec) => (
              <SectionRows key={sec.key} label={sec.label} count={sec.count}>
                {sec.groups.map((g) => {
              const lead = slots[g.idxs[0]];
              const leadCard = cards[lead.card_id];
              const need = groupNeeded(g.idxs);
              const alloc = groupAlloc(g.idxs);

              if (leadCard.basic_energy) {
                return (
                  <tr key={g.key} className="border-b border-edge/40">
                    <td className="px-3 py-2"><Link className="font-semibold text-brand" to={`/cards/${encodeURIComponent(lead.card_id)}`}>{leadCard.name}</Link> <Badge tone="in">basic energy</Badge></td>
                    <td className="px-3 py-2"><NumberStepper value={need} onChange={(v) => setGroupNeeded(g.idxs, v)} /></td>
                    <td className="px-3 py-2 text-muted">∞</td>
                    <td className="px-3 py-2 text-right text-muted">0</td>
                    <td className="px-3 py-2 text-right text-muted">∞</td>
                    <td className="px-3 py-2 text-right"><button className="btn-danger btn-sm" onClick={() => removeSlot(g.idxs[0])}>Remove</button></td>
                  </tr>
                );
              }

              if (g.idxs.length === 1) {
                const i = g.idxs[0];
                const s = slots[i];
                return (
                  <RowGroup key={g.key}>
                    <tr className="border-b border-edge/40">
                      <td className="px-3 py-2">
                        <div className="mb-1">
                          <Link className="font-semibold text-brand" to={`/cards/${encodeURIComponent(s.card_id)}`}>{cards[s.card_id].name}</Link>
                          {cards[s.card_id].ace_spec && <span className="ml-1"><Badge tone="out">ACE SPEC</Badge></span>}
                        </div>
                        <PrintingSelect i={i} />
                      </td>
                      <td className="px-3 py-2"><NumberStepper value={s.needed} onChange={(v) => setGroupNeeded(g.idxs, v)} max={copyCap(s.card_id)} /></td>
                      <td className="px-3 py-2"><NumberStepper value={s.allocated} onChange={(v) => setAllocated(i, v)} max={allocMax(s.card_id, i)} /></td>
                      <td className={`px-3 py-2 text-right tabular-nums ${s.needed - s.allocated > 0 ? "text-danger" : ""}`}>{s.needed - s.allocated}</td>
                      <td className={`px-3 py-2 text-right tabular-nums ${freeFor(s) < 0 ? "text-danger" : ""}`}>{freeFor(s)}</td>
                      <td className="px-3 py-2 text-right"><button className="btn-danger btn-sm" onClick={() => removeSlot(i)}>Remove</button></td>
                    </tr>
                    <AddPrintingRow group={g} options={addablePrintings(g.key)} label={optLabel} onAdd={addPrinting} max={Math.max(0, copyCap(lead.card_id) - groupAlloc(g.idxs))} />
                  </RowGroup>
                );
              }

              // multi-printing group: one Needed for the card, per-printing Allocated rows
              return (
                <RowGroup key={g.key}>
                  <tr className="border-b border-edge/20">
                    <td className="px-3 py-2">
                      <Link className="font-semibold text-brand" to={`/cards/${encodeURIComponent(lead.card_id)}`}>{leadCard.name}</Link>
                      {leadCard.ace_spec && <span className="ml-1"><Badge tone="out">ACE SPEC</Badge></span>}
                      <span className="ml-1 text-muted">· {g.idxs.length} printings</span>
                    </td>
                    <td className="px-3 py-2"><NumberStepper value={need} onChange={(v) => setGroupNeeded(g.idxs, v)} max={copyCap(lead.card_id)} /></td>
                    <td className="px-3 py-2 text-muted tabular-nums">Σ {alloc}</td>
                    <td className={`px-3 py-2 text-right tabular-nums ${need - alloc > 0 ? "text-danger" : ""}`}>{need - alloc}</td>
                    <td></td>
                    <td></td>
                  </tr>
                  {g.idxs.map((i) => {
                    const s = slots[i];
                    return (
                      <tr key={i} className="border-b border-edge/20">
                        <td className="px-3 py-2"><span className="mr-1 pl-4 text-muted">↳</span><PrintingSelect i={i} /></td>
                        <td></td>
                        <td className="px-3 py-2"><NumberStepper value={s.allocated} onChange={(v) => setAllocated(i, v)} max={allocMax(s.card_id, i)} /></td>
                        <td></td>
                        <td className={`px-3 py-2 text-right tabular-nums ${freeFor(s) < 0 ? "text-danger" : ""}`}>{freeFor(s)}</td>
                        <td className="px-3 py-2 text-right"><button className="btn-danger btn-sm" onClick={() => removeSlot(i)}>Remove</button></td>
                      </tr>
                    );
                  })}
                  <AddPrintingRow group={g} options={addablePrintings(g.key)} label={optLabel} onAdd={addPrinting} max={Math.max(0, copyCap(lead.card_id) - groupAlloc(g.idxs))} />
                </RowGroup>
              );
                })}
              </SectionRows>
            ))}
            {slots.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-muted">No cards yet. Add one below, or paste a deck list.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted">
        <strong>Needed</strong> is the deck's target for the card (shared across its printings).{" "}
        <strong>Allocated</strong> is per printing — copies of that exact printing you've sleeved.{" "}
        <strong>Free</strong> = copies you own (incl. in transit) not allocated to other decks.
      </p>

      <h3 className="mb-2 mt-5 text-sm font-bold uppercase tracking-wide text-muted">Add a card</h3>
      <AddCard ids={allCardIds} label={(cid) => `${cards[cid].name} — ${cards[cid].set} ${cards[cid].number}`} onAdd={addCard} />

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-edge bg-bg/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5">
          <button className="btn-primary" onClick={doSave} disabled={save.isPending}>{save.isPending ? "Saving…" : "Save deck"}</button>
          <Link className="btn-secondary" to="/decks">Back to decks</Link>
          <span className="text-sm text-muted">{dirty ? "Unsaved changes" : ""}</span>
        </div>
      </div>
    </div>
  );
}

function RowGroup({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function SectionRows({ label, count, children }: { label: string; count: number; children: React.ReactNode }) {
  return (
    <>
      <tr className="bg-panel2/40">
        <td colSpan={6} className="px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-muted">
          {label} <span className="text-ink">({count})</span>
        </td>
      </tr>
      {children}
    </>
  );
}

function AddPrintingRow({
  group,
  options,
  label,
  onAdd,
  max,
}: {
  group: { key: string; name: string };
  options: string[];
  label: (cid: string) => string;
  onAdd: (cid: string, allocated: number) => void;
  max: number;
}) {
  const [open, setOpen] = useState(false);
  const [cid, setCid] = useState(options[0] ?? "");
  const [qty, setQty] = useState(1);
  if (options.length === 0) return null;
  const clampQty = (n: number) => Math.max(0, Math.min(max, n));
  return (
    <tr className="border-b border-edge/40">
      <td colSpan={6} className="px-3 py-2 pl-8">
        {!open ? (
          <button className="text-sm text-muted hover:text-ink" onClick={() => { setCid(options[0] ?? ""); setQty(Math.min(1, max)); setOpen(true); }}>
            + use another printing of {group.name}
          </button>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted">Allocate</span>
            <input className="input w-16 py-1" type="number" min={0} max={max} value={qty} onChange={(e) => setQty(clampQty(parseInt(e.target.value, 10) || 0))} />
            <span className="text-sm text-muted">from</span>
            <select className="input w-auto py-1 text-sm" value={cid} onChange={(e) => setCid(e.target.value)}>
              {options.map((o) => <option key={o} value={o}>{label(o)}</option>)}
            </select>
            <button className="btn-secondary btn-sm" disabled={qty < 1 || max < 1} onClick={() => { if (cid && qty > 0) onAdd(cid, qty); setOpen(false); }}>Add</button>
            <button className="btn-secondary btn-sm" onClick={() => setOpen(false)}>Cancel</button>
            {max < 1 && <span className="text-xs text-danger">at 4-copy limit</span>}
          </div>
        )}
      </td>
    </tr>
  );
}

function AddCard({ ids, label, onAdd }: { ids: string[]; label: (cid: string) => string; onAdd: (cid: string) => void }) {
  const [cid, setCid] = useState("");
  return (
    <div className="flex flex-wrap gap-2">
      <select className="input max-w-md" value={cid} onChange={(e) => setCid(e.target.value)}>
        <option value="">Choose a catalog card…</option>
        {ids.map((id) => <option key={id} value={id}>{label(id)}</option>)}
      </select>
      <button className="btn-primary" disabled={!cid} onClick={() => onAdd(cid)}>Add</button>
    </div>
  );
}
