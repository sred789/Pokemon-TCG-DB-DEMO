import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { useCreateOrder } from "../api/hooks";
import { useToast } from "../components/Toast";
import { PageTitle } from "../components/ui";
import { ORDER_STATUSES, STATUS_LABEL } from "../lib/orderStatus";

const today = new Date().toISOString().slice(0, 10);

export default function OrderNew() {
  const [form, setForm] = useState({
    order_number: "",
    order_date: today,
    seller: "",
    shipping_status: "ordered",
    delivered: false,
  });
  const create = useCreateOrder();
  const toast = useToast();
  const navigate = useNavigate();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    create.mutate(form, {
      onSuccess: () => {
        toast(`Order ${form.order_number} created.`, "success");
        navigate(`/orders/${encodeURIComponent(form.order_number)}`);
      },
      onError: (err) => toast(err instanceof Error ? err.message : "Failed", "error"),
    });
  };

  return (
    <div className="max-w-md">
      <PageTitle>New Order</PageTitle>
      <form className="card flex flex-col gap-3 p-4" onSubmit={submit}>
        <div>
          <label className="label">Order number</label>
          <input className="input" required value={form.order_number} onChange={(e) => setForm({ ...form, order_number: e.target.value })} />
        </div>
        <div>
          <label className="label">Order date</label>
          <input className="input" type="date" required value={form.order_date} onChange={(e) => setForm({ ...form, order_date: e.target.value })} />
        </div>
        <div>
          <label className="label">Seller</label>
          <input className="input" required value={form.seller} onChange={(e) => setForm({ ...form, seller: e.target.value })} />
        </div>
        <div>
          <label className="label">Status</label>
          <select
            className="input"
            value={form.shipping_status}
            onChange={(e) => setForm({ ...form, shipping_status: e.target.value, delivered: e.target.value === "delivered" })}
          >
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>{STATUS_LABEL[s]}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <button className="btn-primary" type="submit" disabled={create.isPending}>Create order</button>
          <button className="btn-secondary" type="button" onClick={() => navigate("/orders")}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
