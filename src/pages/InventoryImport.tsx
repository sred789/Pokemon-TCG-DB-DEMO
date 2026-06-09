import { useState } from "react";
import { Link } from "react-router-dom";

import { useBulkImport } from "../api/hooks";
import { PageTitle } from "../components/ui";

const PLACEHOLDER = `name\tset\tnumber\tquantity\tsource
Dragapult ex\tTWM\t130\t2\tTrade
Iron Hands ex\tPAR\t70\t1\tBooster Pack`;

export default function InventoryImport() {
  const [text, setText] = useState("");
  const imp = useBulkImport();
  const result = imp.data;

  return (
    <div>
      <PageTitle>Import Cards from a Spreadsheet</PageTitle>
      <p className="mb-2 text-sm text-muted">
        Paste rows from Excel/Google Sheets (tab-separated) or CSV. Cards are added as-is, with no API lookup.
        Columns: <code>name</code> (required), <code>set</code>, <code>number</code>, <code>id</code>, <code>quantity</code>, <code>source</code>.
      </p>

      {result ? (
        <div>
          <div className="card mb-3 p-4">
            <div className="text-lg font-bold">
              {result.catalogued} card(s) catalogued, {result.inventory_added} inventory entr{result.inventory_added === 1 ? "y" : "ies"} added
            </div>
          </div>
          {result.errors.length > 0 && (
            <ul className="card mb-3 list-disc p-4 pl-8 text-sm text-danger">
              {result.errors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          )}
          <div className="flex gap-2">
            <Link className="btn-primary" to="/inventory">View inventory</Link>
            <button className="btn-secondary" onClick={() => imp.reset()}>Import more</button>
          </div>
        </div>
      ) : (
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            imp.mutate(text);
          }}
        >
          <textarea
            className="input min-h-[220px] font-mono text-sm"
            placeholder={PLACEHOLDER}
            value={text}
            onChange={(e) => setText(e.target.value)}
            required
          />
          <div className="flex gap-2">
            <button className="btn-primary" type="submit" disabled={imp.isPending}>{imp.isPending ? "Importing…" : "Import"}</button>
            <Link className="btn-secondary" to="/inventory">Cancel</Link>
          </div>
        </form>
      )}
    </div>
  );
}
