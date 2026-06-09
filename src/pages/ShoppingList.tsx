import { useState } from "react";
import { Link } from "react-router-dom";

import { useShoppingList } from "../api/hooks";
import ExportDialog from "../components/ExportDialog";
import { Empty, ErrorBox, PageTitle, Spinner } from "../components/ui";
import { tcgplayerMassEntry } from "../lib/export";

export default function ShoppingList() {
  const { data, isLoading, error } = useShoppingList();
  const [exporting, setExporting] = useState(false);
  if (isLoading) return <Spinner />;
  if (error) return <ErrorBox error={error} />;

  const buyable = (data ?? []).filter((i) => i.to_buy > 0);

  return (
    <div>
      <PageTitle
        actions={
          buyable.length > 0 ? (
            <button className="btn-primary" onClick={() => setExporting(true)}>
              Export for TCGplayer
            </button>
          ) : undefined
        }
      >
        Shopping List
      </PageTitle>
      {exporting && (
        <ExportDialog
          title="TCGplayer Mass Entry"
          subtitle="Paste into TCGplayer → Mass Entry to price and buy in one go."
          text={tcgplayerMassEntry(buyable)}
          filename="shopping-list-tcgplayer.txt"
          onClose={() => setExporting(false)}
        />
      )}
      <p className="mb-3 text-sm text-muted">
        Cards your decks need beyond what you own. Cards already on the way count as owned.
      </p>
      {data!.length === 0 ? (
        <Empty>Nothing to buy — every card your decks need is owned or on the way.</Empty>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wide text-muted">
              <tr className="border-b border-edge/60">
                <th className="px-3 py-2 text-left">Card</th>
                <th className="px-3 py-2 text-left">Set</th>
                <th className="px-3 py-2 text-right">Needed</th>
                <th className="px-3 py-2 text-right">Owned</th>
                <th className="px-3 py-2 text-right">To Buy</th>
              </tr>
            </thead>
            <tbody>
              {data!.map((it) => (
                <tr key={it.card_id} className="border-b border-edge/40">
                  <td className="px-3 py-2">
                    <Link className="text-brand" to={`/cards/${encodeURIComponent(it.card_id)}`}>
                      {it.card_name}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-muted">{it.card_set} {it.set_number}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{it.needed}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{it.owned}</td>
                  <td className="px-3 py-2 text-right font-semibold text-danger tabular-nums">{it.to_buy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
