import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { useDeckImport, useDeckImportConfirm } from "../api/hooks";
import type { ParsedLine } from "../api/types";
import { useToast } from "../components/Toast";
import { Badge, PageTitle } from "../components/ui";

const SAMPLE = `Pokémon: 6
2 Dragapult ex TWM 130
3× Riolu (MEG 76)

Trainer: 4
4 Arven

Energy: 12
12 Basic Fire Energy`;

export default function DeckImport() {
  const { deckId = "" } = useParams();
  const id = Number(deckId);
  const navigate = useNavigate();
  const toast = useToast();
  const preview = useDeckImport(id);
  const confirm = useDeckImportConfirm(id);

  const [text, setText] = useState("");
  const [mode, setMode] = useState("replace");
  // chosen card_id per line index (for ambiguous rows)
  const [chosen, setChosen] = useState<Record<number, string>>({});

  const lines = preview.data?.lines;

  const cardIdFor = (line: ParsedLine, i: number): string => {
    if (line.status === "matched") return line.candidates[0]?.card_id ?? "";
    if (line.status === "ambiguous") return chosen[i] ?? "";
    return "";
  };

  const doConfirm = () => {
    if (!lines) return;
    const selections = lines
      .map((l, i) => ({ card_id: cardIdFor(l, i), quantity: l.quantity ?? 0 }))
      .filter((s) => s.card_id);
    confirm.mutate(
      { selections, mode },
      {
        onSuccess: (r) => {
          toast(`Imported ${r.imported} card(s).`, "success");
          navigate(`/decks/${id}`);
        },
        onError: (e) => toast(e instanceof Error ? e.message : "Failed", "error"),
      },
    );
  };

  return (
    <div>
      <p className="mb-1"><Link className="text-brand" to={`/decks/${id}`}>← Back to deck</Link></p>
      <PageTitle>Paste a deck list</PageTitle>

      {!lines ? (
        <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); preview.mutate(text); }}>
          <p className="text-sm text-muted">PTCGL/PTCGO export, Limitless export, or simple “qty name” lines. You'll preview before saving.</p>
          <textarea className="input min-h-[240px] font-mono text-sm" placeholder={SAMPLE} value={text} onChange={(e) => setText(e.target.value)} required />
          <div className="flex gap-2">
            <button className="btn-primary" type="submit" disabled={preview.isPending}>{preview.isPending ? "Parsing…" : "Preview import"}</button>
            <Link className="btn-secondary" to={`/decks/${id}`}>Cancel</Link>
          </div>
        </form>
      ) : (
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-4 text-sm">
            <label className="flex items-center gap-1.5"><input type="radio" name="mode" checked={mode === "replace"} onChange={() => setMode("replace")} /> Set targets to these</label>
            <label className="flex items-center gap-1.5"><input type="radio" name="mode" checked={mode === "add"} onChange={() => setMode("add")} /> Add to existing</label>
          </div>
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted">
                <tr className="border-b border-edge/60"><th className="px-3 py-2 text-left">Line</th><th className="px-3 py-2 text-right">Qty</th><th className="px-3 py-2 text-left">Card</th><th className="px-3 py-2 text-left">Status</th></tr>
              </thead>
              <tbody>
                {lines.map((l, i) => (
                  <tr key={i} className="border-b border-edge/40">
                    <td className="px-3 py-2 text-muted">{l.raw}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{l.quantity ?? "—"}</td>
                    <td className="px-3 py-2">
                      {l.status === "matched" && <>{l.candidates[0].card_name} <span className="text-muted">{l.candidates[0].card_set} {l.candidates[0].set_number}</span></>}
                      {l.status === "ambiguous" && (
                        <select className="input" value={chosen[i] ?? ""} onChange={(e) => setChosen({ ...chosen, [i]: e.target.value })}>
                          <option value="">— skip —</option>
                          {l.candidates.map((c) => <option key={c.card_id} value={c.card_id}>{c.card_name} — {c.card_set} {c.set_number}</option>)}
                        </select>
                      )}
                      {(l.status === "unmatched" || l.status === "unparseable") && <span className="text-muted">{l.name ?? "—"}</span>}
                    </td>
                    <td className="px-3 py-2">
                      {l.status === "matched" && <Badge tone="in">matched</Badge>}
                      {l.status === "ambiguous" && <Badge tone="out">choose</Badge>}
                      {l.status === "unmatched" && <Badge tone="bad">not found</Badge>}
                      {l.status === "unparseable" && <Badge tone="bad">unparseable</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex gap-2">
            <button className="btn-primary" onClick={doConfirm} disabled={confirm.isPending}>Import matched &amp; chosen</button>
            <button className="btn-secondary" onClick={() => preview.reset()}>Start over</button>
          </div>
        </div>
      )}
    </div>
  );
}
