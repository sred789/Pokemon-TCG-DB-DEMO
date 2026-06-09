import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { useAddOrderItem, useCards, useDeleteOrder, useDeleteOrderItem, useOrder, useUpdateOrder } from "../api/hooks";
import { useToast } from "../components/Toast";
import { Badge, ErrorBox, PageTitle, Spinner } from "../components/ui";
import { asStatus, ORDER_STATUSES, STATUS_LABEL, STATUS_TONE } from "../lib/orderStatus";

export default function OrderDetail() {
  const { orderNumber = "" } = useParams();
  const { data: order, isLoading, error } = useOrder(orderNumber);
  const { data: catalog = [] } = useCards(true);
  const update = useUpdateOrder(orderNumber);
  const del = useDeleteOrder();
  const addItem = useAddOrderItem(orderNumber);
  const delItem = useDeleteOrderItem(orderNumber);
  const toast = useToast();
  const navigate = useNavigate();

  const [form, setForm] = useState({ order_date: "", seller: "", shipping_status: "", delivered: false });
  const [newItem, setNewItem] = useState({ card_id: "", quantity: 1 });

  useEffect(() => {
    if (order)
      setForm({
        order_date: order.order_date,
        seller: order.seller,
        shipping_status: order.shipping_status,
        delivered: order.delivered,
      });
  }, [order]);

  if (isLoading) return <Spinner />;
  if (error) return <ErrorBox error={error} />;

  const ok = (m: string) => toast(m, "success");
  const fail = (e: unknown) => toast(e instanceof Error ? e.message : "Failed", "error");

  const status = asStatus(form.shipping_status, form.delivered);
  // Status changes save immediately so the Orders list stays in sync.
  const setStatus = (next: string) => {
    const body = { ...form, shipping_status: next, delivered: next === "delivered" };
    setForm(body);
    update.mutate(body, { onSuccess: () => ok(`Marked ${STATUS_LABEL[asStatus(next)]}.`), onError: fail });
  };

  return (
    <div>
      <p className="mb-1"><Link className="text-brand" to="/orders">← Back to orders</Link></p>
      <PageTitle
        actions={
          <button
            className="btn-danger btn-sm"
            onClick={() => {
              if (confirm("Delete this order and its items?"))
                del.mutate(orderNumber, { onSuccess: () => { ok("Order deleted."); navigate("/orders"); }, onError: fail });
            }}
          >
            Delete order
          </button>
        }
      >
        Order {order!.order_number}
      </PageTitle>

      <form
        className="card flex max-w-md flex-col gap-3 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          update.mutate({ ...form, shipping_status: status, delivered: status === "delivered" }, { onSuccess: () => ok("Order updated."), onError: fail });
        }}
      >
        <div>
          <label className="label">Status</label>
          <div className="flex items-center gap-3">
            <select className="input w-auto" value={status} onChange={(e) => setStatus(e.target.value)}>
              {ORDER_STATUSES.map((s) => (
                <option key={s} value={s}>{STATUS_LABEL[s]}</option>
              ))}
            </select>
            <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>
          </div>
          <p className="mt-1 text-xs text-muted">
            Saved instantly. “Delivered” moves the order’s cards from Incoming to In Possession.
          </p>
        </div>
        <div><label className="label">Order date</label><input className="input" type="date" value={form.order_date} onChange={(e) => setForm({ ...form, order_date: e.target.value })} /></div>
        <div><label className="label">Seller</label><input className="input" value={form.seller} onChange={(e) => setForm({ ...form, seller: e.target.value })} /></div>
        <button className="btn-primary w-fit" type="submit">Save changes</button>
      </form>

      <h2 className="mb-2 mt-6 text-lg font-bold">Items</h2>
      {order!.items.length === 0 ? (
        <p className="text-muted">No items yet.</p>
      ) : (
        <div className="card divide-y divide-edge/40">
          {order!.items.map((it) => (
            <div key={it.order_item_id} className="flex items-center gap-3 px-3 py-2">
              <Link className="flex-1 text-brand" to={`/cards/${encodeURIComponent(it.card_id)}`}>{it.card.card_name}</Link>
              <span className="tabular-nums">×{it.quantity}</span>
              <button className="btn-danger btn-sm" onClick={() => delItem.mutate(it.order_item_id, { onSuccess: () => ok("Item removed."), onError: fail })}>Remove</button>
            </div>
          ))}
        </div>
      )}

      <h3 className="mb-2 mt-5 text-sm font-bold uppercase tracking-wide text-muted">Add an item</h3>
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!newItem.card_id) return;
          addItem.mutate(newItem, { onSuccess: () => { ok("Item added."); setNewItem({ card_id: "", quantity: 1 }); }, onError: fail });
        }}
      >
        <select className="input w-72" value={newItem.card_id} onChange={(e) => setNewItem({ ...newItem, card_id: e.target.value })} required>
          <option value="" disabled>Choose a catalog card…</option>
          {catalog.map((c) => (
            <option key={c.card_id} value={c.card_id}>{c.card_name} — {c.card_set} {c.set_number}</option>
          ))}
        </select>
        <input className="input w-20" type="number" min={1} value={newItem.quantity} onChange={(e) => setNewItem({ ...newItem, quantity: parseInt(e.target.value, 10) || 1 })} />
        <button className="btn-primary" type="submit">Add item</button>
      </form>
      <p className="mt-2 text-xs text-muted">Card not listed? <Link className="text-brand" to="/cards/search">Look it up</Link> first.</p>
    </div>
  );
}
