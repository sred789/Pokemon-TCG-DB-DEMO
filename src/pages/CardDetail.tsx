import { Link, useParams } from "react-router-dom";

import { useCardDetail } from "../api/hooks";
import { Badge, ErrorBox, PageTitle, Spinner, StatCard } from "../components/ui";

export default function CardDetail() {
  const { cardId = "" } = useParams();
  const { data, isLoading, error } = useCardDetail(cardId);
  if (isLoading) return <Spinner />;
  if (error) return <ErrorBox error={error} />;
  const { card, inv, order_items, deck_cards } = data!;

  return (
    <div>
      <PageTitle actions={<Badge tone="out">{card.card_set} · {card.set_number}</Badge>}>
        {card.card_name}
      </PageTitle>
      <div className="flex flex-col gap-5 sm:flex-row">
        <div className="w-full max-w-[240px] shrink-0 sm:w-56">
          <div className="aspect-[5/7] overflow-hidden rounded-xl border border-edge bg-sunken shadow-card">
            {card.image_url ? (
              <img src={card.image_url} alt={card.card_name} className="h-full w-full object-contain" />
            ) : (
              <div className="flex h-full items-center justify-center p-3 text-center text-sm text-muted">
                No image available
              </div>
            )}
          </div>
        </div>

        <div className="flex-1">
          <div className="mb-3 flex flex-wrap gap-2">
            {card.is_basic_energy ? (
              <Badge tone="in">Basic Energy</Badge>
            ) : (
              card.supertype && <Badge tone="out">{card.supertype}</Badge>
            )}
            {card.subtypes && <Badge tone="neutral">{card.subtypes}</Badge>}
            {card.is_ace_spec && <Badge tone="bad">ACE SPEC</Badge>}
          </div>
          <p className="mb-4 text-sm text-muted">Card ID: {card.card_id}</p>

          {inv ? (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard label="Total Owned" value={inv.total_owned} />
              <StatCard label="In Possession" value={inv.in_possession} />
              <StatCard label="Incoming" value={inv.incoming} />
              <StatCard label="Available" value={inv.available_to_allocate} tone={inv.available_to_allocate < 0 ? "neg" : undefined} />
            </div>
          ) : (
            <p className="text-sm text-muted">
              {card.is_basic_energy ? "Basic energy — unlimited supply, not tracked as inventory." : "Not yet in your inventory."}
            </p>
          )}
        </div>
      </div>

      <h2 className="mb-2 mt-6 text-lg font-bold">In Orders</h2>
      {order_items.length === 0 ? (
        <p className="text-muted">Not in any order.</p>
      ) : (
        <ul className="card divide-y divide-edge/40">
          {order_items.map((oi) => (
            <li key={oi.order_number} className="flex justify-between px-3 py-2">
              <Link className="text-brand" to={`/orders/${encodeURIComponent(oi.order_number)}`}>{oi.order_number}</Link>
              <span className="tabular-nums">×{oi.quantity}</span>
            </li>
          ))}
        </ul>
      )}

      <h2 className="mb-2 mt-6 text-lg font-bold">In Decks</h2>
      {deck_cards.length === 0 ? (
        <p className="text-muted">Not used in any deck.</p>
      ) : (
        <ul className="card divide-y divide-edge/40">
          {deck_cards.map((dc) => (
            <li key={dc.deck_id} className="flex justify-between px-3 py-2">
              <Link className="text-brand" to={`/decks/${dc.deck_id}`}>Deck #{dc.deck_id}</Link>
              <span className="text-muted">needed {dc.quantity_needed} · allocated {dc.quantity_allocated}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-6"><Link className="text-brand" to="/cards">← Back to catalog</Link></p>
    </div>
  );
}
