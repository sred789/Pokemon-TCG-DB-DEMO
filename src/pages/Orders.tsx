import { Link } from "react-router-dom";

import { useOrders } from "../api/hooks";
import { Badge, Empty, ErrorBox, PageTitle, Spinner } from "../components/ui";
import { asStatus, STATUS_LABEL, STATUS_TONE } from "../lib/orderStatus";

export default function Orders() {
  const { data, isLoading, error } = useOrders();
  if (isLoading) return <Spinner />;
  if (error) return <ErrorBox error={error} />;

  return (
    <div>
      <PageTitle actions={<Link className="btn-primary" to="/orders/new">+ New order</Link>}>Orders</PageTitle>
      {data!.length === 0 ? (
        <Empty>No orders yet. <Link className="text-brand" to="/orders/new">Record your first order</Link>.</Empty>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wide text-muted">
              <tr className="border-b border-edge/60">
                <th className="px-3 py-2 text-left">Order #</th>
                <th className="px-3 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-left">Seller</th>
                <th className="px-3 py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {data!.map((o) => (
                <tr key={o.order_number} className="border-b border-edge/40">
                  <td className="px-3 py-2">
                    <Link className="text-brand" to={`/orders/${encodeURIComponent(o.order_number)}`}>{o.order_number}</Link>
                  </td>
                  <td className="px-3 py-2 text-muted">{o.order_date}</td>
                  <td className="px-3 py-2">{o.seller}</td>
                  <td className="px-3 py-2">
                    {(() => {
                      const s = asStatus(o.shipping_status, o.delivered);
                      return <Badge tone={STATUS_TONE[s]}>{STATUS_LABEL[s]}</Badge>;
                    })()}
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
