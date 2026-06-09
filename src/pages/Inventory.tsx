import { Link } from "react-router-dom";

import { useDeleteInventory, useInventory } from "../api/hooks";
import { useToast } from "../components/Toast";
import { Empty, ErrorBox, PageTitle, Spinner } from "../components/ui";

export default function Inventory() {
  const { data, isLoading, error } = useInventory();
  const del = useDeleteInventory();
  const toast = useToast();
  if (isLoading) return <Spinner />;
  if (error) return <ErrorBox error={error} />;

  return (
    <div>
      <PageTitle
        actions={
          <>
            <Link className="btn-secondary" to="/inventory/import">Import spreadsheet</Link>
            <Link className="btn-primary" to="/inventory/new">+ Add inventory</Link>
          </>
        }
      >
        Manual Inventory
      </PageTitle>
      {data!.length === 0 ? (
        <Empty>No entries yet. <Link className="text-brand" to="/inventory/new">Add one</Link>.</Empty>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wide text-muted">
              <tr className="border-b border-edge/60">
                <th className="px-3 py-2 text-left">Card</th>
                <th className="px-3 py-2 text-left">Source</th>
                <th className="px-3 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-right">Qty</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data!.map((e) => (
                <tr key={e.induction_id} className="border-b border-edge/40">
                  <td className="px-3 py-2">
                    <Link className="text-brand" to={`/cards/${encodeURIComponent(e.card_id)}`}>{e.card.card_name}</Link>{" "}
                    <span className="text-muted">{e.card.card_set} {e.card.set_number}</span>
                  </td>
                  <td className="px-3 py-2">{e.source}</td>
                  <td className="px-3 py-2 text-muted">{e.date_added}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{e.quantity}</td>
                  <td className="px-3 py-2 text-right">
                    <button className="btn-danger btn-sm" onClick={() => del.mutate(e.induction_id, { onSuccess: () => toast("Removed.", "success") })}>Remove</button>
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
