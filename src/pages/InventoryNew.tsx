import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useAddInventory, useCards, useSources } from "../api/hooks";
import { useToast } from "../components/Toast";
import { PageTitle } from "../components/ui";

const today = new Date().toISOString().slice(0, 10);
const CARD_TYPES = ["Pokémon", "Trainer", "Energy"];

/** Quantity stepper that may be emptied while editing (so you can clear "1" and type "2").
 *  The underlying <input> is `required min={1}`, so an empty value blocks form submission. */
function QtyStepper({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const n = parseInt(value, 10);
  const dec = () => onChange(String(Math.max(1, (Number.isNaN(n) ? 1 : n) - 1)));
  const inc = () => onChange(String((Number.isNaN(n) ? 0 : n) + 1));
  const btn =
    "w-11 text-xl font-semibold text-muted transition hover:bg-hover hover:text-ink active:bg-accent active:text-accentInk";
  return (
    <div className="inline-flex h-11 select-none items-stretch overflow-hidden rounded-lg border border-edge bg-sunken">
      <button type="button" className={btn} onClick={dec} aria-label="decrease quantity">
        −
      </button>
      <input
        type="number"
        min={1}
        required
        inputMode="numeric"
        className="w-16 border-x border-edge bg-transparent text-center text-base tabular-nums outline-none"
        value={value}
        placeholder="—"
        onChange={(e) => onChange(e.target.value)}
      />
      <button type="button" className={btn} onClick={inc} aria-label="increase quantity">
        +
      </button>
    </div>
  );
}

export default function InventoryNew() {
  const { data: catalog = [] } = useCards(true);
  const { data: sources = [] } = useSources();
  const add = useAddInventory();
  const toast = useToast();
  const navigate = useNavigate();

  const [mode, setMode] = useState<"catalog" | "manual">("catalog");
  const [form, setForm] = useState({ card_id: "", quantity: "1", source: "Booster Pack", date_added: today });
  const [manual, setManual] = useState({ card_name: "", card_set: "", set_number: "", supertype: "Pokémon", is_ace_spec: false });

  const qty = parseInt(form.quantity, 10);
  const qtyValid = !Number.isNaN(qty) && qty >= 1;
  const cardValid = mode === "catalog" ? !!form.card_id : !!manual.card_name.trim();
  const canSubmit = qtyValid && cardValid && !add.isPending;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    const body: Record<string, unknown> = { quantity: qty, source: form.source, date_added: form.date_added };
    if (mode === "manual") {
      body.manual = {
        card_name: manual.card_name.trim(),
        card_set: manual.card_set.trim(),
        set_number: manual.set_number.trim(),
        supertype: manual.supertype,
        is_ace_spec: manual.is_ace_spec,
      };
    } else {
      body.card_id = form.card_id;
    }
    add.mutate(body, {
      onSuccess: () => {
        toast("Inventory added.", "success");
        navigate("/inventory");
      },
      onError: (err) => toast(err instanceof Error ? err.message : "Failed", "error"),
    });
  };

  const tab = (m: typeof mode, label: string) => (
    <button
      type="button"
      onClick={() => setMode(m)}
      className={`flex-1 rounded-md px-3 py-1.5 text-sm font-semibold transition ${
        mode === m ? "bg-accent text-accentInk shadow" : "text-muted hover:text-ink"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="max-w-md">
      <PageTitle>Add Manual Inventory</PageTitle>
      <p className="mb-3 text-sm text-muted">
        Cards from booster packs, trades, or local stores — anything not tracked as an online order.
      </p>
      <form className="card flex flex-col gap-4 p-4" onSubmit={submit}>
        <div className="flex gap-1 rounded-lg border border-edge bg-sunken p-1">
          {tab("catalog", "Pick from catalog")}
          {tab("manual", "Type it manually")}
        </div>

        {mode === "catalog" ? (
          <div>
            <label className="label">Card</label>
            <select
              className="input"
              required
              value={form.card_id}
              onChange={(e) => setForm({ ...form, card_id: e.target.value })}
            >
              <option value="" disabled>
                Choose a catalog card…
              </option>
              {catalog.map((c) => (
                <option key={c.card_id} value={c.card_id}>
                  {c.card_name} — {c.card_set} {c.set_number}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-muted">
              Not listed? <Link className="text-brand" to="/cards/search">look it up</Link>, or switch to “Type it manually”.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div>
              <label className="label">Card name</label>
              <input
                className="input"
                required
                placeholder="e.g. Dragapult ex"
                value={manual.card_name}
                onChange={(e) => setManual({ ...manual, card_name: e.target.value })}
              />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="label">Set code</label>
                <input
                  className="input"
                  placeholder="e.g. TWM"
                  value={manual.card_set}
                  onChange={(e) => setManual({ ...manual, card_set: e.target.value })}
                />
              </div>
              <div className="flex-1">
                <label className="label">Number</label>
                <input
                  className="input"
                  placeholder="e.g. 130/167"
                  value={manual.set_number}
                  onChange={(e) => setManual({ ...manual, set_number: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="label">Type</label>
              <select
                className="input"
                value={manual.supertype}
                onChange={(e) => setManual({ ...manual, supertype: e.target.value })}
              >
                {CARD_TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 accent-accent"
                checked={manual.is_ace_spec}
                onChange={(e) => setManual({ ...manual, is_ace_spec: e.target.checked })}
              />
              ACE SPEC card
            </label>
          </div>
        )}

        <div>
          <label className="label">Quantity</label>
          <div>
            <QtyStepper value={form.quantity} onChange={(v) => setForm({ ...form, quantity: v })} />
          </div>
        </div>

        <div>
          <label className="label">Source</label>
          <select className="input" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
            {sources.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Date added</label>
          <input
            className="input"
            type="date"
            value={form.date_added}
            onChange={(e) => setForm({ ...form, date_added: e.target.value })}
          />
        </div>

        <div className="flex gap-2">
          <button className="btn-primary" type="submit" disabled={!canSubmit}>
            Add to inventory
          </button>
          <button className="btn-secondary" type="button" onClick={() => navigate("/inventory")}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
