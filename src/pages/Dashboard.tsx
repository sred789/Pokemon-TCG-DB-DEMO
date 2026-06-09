import { Link } from "react-router-dom";

import { useDashboard, useDecks, useOrders, useShoppingList } from "../api/hooks";
import { Badge, Empty, ErrorBox, PageTitle, ProgressBar, Section, Spinner, StatCard } from "../components/ui";
import { asStatus, STATUS_LABEL, STATUS_TONE } from "../lib/orderStatus";

function deckBadge(d: { total: number; is_legal: boolean; is_complete: boolean }) {
  if (d.is_complete) return <Badge tone="in">legal</Badge>;
  if (d.total > 60) return <Badge tone="bad">over 60</Badge>;
  if (d.is_legal) return <Badge tone="out">{60 - d.total} to go</Badge>;
  return <Badge tone="bad">illegal</Badge>;
}

export default function Dashboard() {
  const dash = useDashboard();
  const decks = useDecks();
  const shopping = useShoppingList();
  const orders = useOrders();

  if (dash.isLoading) return <Spinner />;
  if (dash.error) return <ErrorBox error={dash.error} />;
  const { totals, rows } = dash.data!;

  const deckList = decks.data ?? [];
  const shopList = (shopping.data ?? []).filter((i) => i.to_buy > 0);
  const orderList = [...(orders.data ?? [])].sort((a, b) => b.order_date.localeCompare(a.order_date));
  const toBuyTotal = shopList.reduce((s, i) => s + i.to_buy, 0);
  const topOwned = [...rows].sort((a, b) => b.total_owned - a.total_owned);

  return (
    <div>
      <PageTitle actions={<Link className="btn-secondary" to="/inventory/new">+ Add inventory</Link>}>
        Collection Dashboard
      </PageTitle>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total Owned" value={totals.total_owned} />
        <StatCard label="In Possession" value={totals.in_possession} />
        <StatCard label="Incoming" value={totals.incoming} />
        <StatCard label="Available" value={totals.available_to_allocate} />
      </div>

      {/* Decks */}
      <Section
        title={`Decks${deckList.length ? ` (${deckList.length})` : ""}`}
        action={
          <span className="flex gap-3">
            <Link className="text-brand" to="/decks">View all</Link>
            <Link className="text-brand" to="/decks">+ New</Link>
          </span>
        }
      >
        {deckList.length === 0 ? (
          <Empty>
            No decks yet. <Link className="text-brand" to="/decks">Create one</Link> and paste a deck list to fill it.
          </Empty>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {deckList.slice(0, 6).map((d) => (
              <Link
                key={d.deck_id}
                to={`/decks/${d.deck_id}`}
                className="card flex flex-col gap-2 p-4 transition hover:border-brand/50"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="font-bold leading-tight">{d.deck_name}</div>
                  {deckBadge(d)}
                </div>
                <ProgressBar value={d.total} max={60} />
                <div className="text-xs text-muted tabular-nums">{d.total}/60 cards</div>
              </Link>
            ))}
          </div>
        )}
      </Section>

      {/* Shopping list + Recent orders, side by side on wide screens */}
      <div className="grid grid-cols-1 gap-x-6 lg:grid-cols-2">
        <Section
          title="Shopping List"
          action={<Link className="text-brand" to="/shopping">View all</Link>}
        >
          {shopList.length === 0 ? (
            <Empty>Nothing to buy — every deck slot is covered. 🎉</Empty>
          ) : (
            <div className="card divide-y divide-edge/40">
              {shopList.slice(0, 5).map((i) => (
                <div key={i.card_id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <div className="truncate">{i.card_name}</div>
                    <div className="text-xs text-muted">{i.card_set} {i.set_number}</div>
                  </div>
                  <span className="shrink-0 font-semibold text-accent tabular-nums">buy {i.to_buy}</span>
                </div>
              ))}
              <div className="px-3 py-2 text-xs text-muted">
                {toBuyTotal} card{toBuyTotal === 1 ? "" : "s"} to buy across {shopList.length} listing{shopList.length === 1 ? "" : "s"}.
              </div>
            </div>
          )}
        </Section>

        <Section title="Recent Orders" action={<Link className="text-brand" to="/orders">View all</Link>}>
          {orderList.length === 0 ? (
            <Empty>
              No orders yet. <Link className="text-brand" to="/orders">Record one</Link>.
            </Empty>
          ) : (
            <div className="card divide-y divide-edge/40">
              {orderList.slice(0, 5).map((o) => (
                <Link
                  key={o.order_number}
                  to={`/orders/${encodeURIComponent(o.order_number)}`}
                  className="flex items-center justify-between gap-3 px-3 py-2 text-sm transition hover:bg-hover/40"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium">{o.seller || o.order_number}</div>
                    <div className="text-xs text-muted">
                      {o.order_date} · {o.items.length} item{o.items.length === 1 ? "" : "s"}
                    </div>
                  </div>
                  {(() => {
                    const s = asStatus(o.shipping_status, o.delivered);
                    return <Badge tone={STATUS_TONE[s]}>{STATUS_LABEL[s]}</Badge>;
                  })()}
                </Link>
              ))}
            </div>
          )}
        </Section>
      </div>

      {/* Per-card inventory */}
      <Section title="Per-Card Inventory">
        {rows.length === 0 ? (
          <Empty>
            No cards yet. Look up cards from the <Link className="text-brand" to="/cards/search">Cards</Link> page,
            record an <Link className="text-brand" to="/orders">order</Link>, or{" "}
            <Link className="text-brand" to="/inventory/new">add inventory</Link>.
          </Empty>
        ) : (
          <>
            <div className="card max-h-[28rem] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-panel text-xs uppercase tracking-wide text-muted">
                  <tr className="border-b border-edge/60">
                    <th className="px-3 py-2 text-left">Card</th>
                    <th className="px-3 py-2 text-left">Set</th>
                    <th className="px-3 py-2 text-right">Owned</th>
                    <th className="px-3 py-2 text-right">In Poss.</th>
                    <th className="px-3 py-2 text-right">Incoming</th>
                    <th className="px-3 py-2 text-right">Alloc.</th>
                    <th className="px-3 py-2 text-right">Avail.</th>
                  </tr>
                </thead>
                <tbody>
                  {topOwned.map((r) => (
                    <tr key={r.card_id} className="border-b border-edge/40 hover:bg-hover/40">
                      <td className="px-3 py-2">
                        <Link className="text-brand" to={`/cards/${encodeURIComponent(r.card_id)}`}>
                          {r.card_name}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-muted">{r.card_set} {r.set_number}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{r.total_owned}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{r.in_possession}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{r.incoming}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{r.allocated}</td>
                      <td className={`px-3 py-2 text-right tabular-nums ${r.available_to_allocate < 0 ? "text-danger" : ""}`}>
                        {r.available_to_allocate}
                        {r.pooled && <span className="text-muted" title="Pooled across printings"> *</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-muted">* Available is pooled across printings for Trainers &amp; Energy.</p>
          </>
        )}
      </Section>
    </div>
  );
}
