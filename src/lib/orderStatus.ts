// The three canonical order statuses, in lifecycle order. Mirrors app/services/orders.py.
export const ORDER_STATUSES = ["ordered", "shipped", "delivered"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const STATUS_LABEL: Record<OrderStatus, string> = {
  ordered: "Ordered",
  shipped: "Shipped",
  delivered: "Delivered",
};

// Badge tones: ordered = neutral (placed, nothing in hand yet), shipped = accent (in transit),
// delivered = green (cards now in possession).
export const STATUS_TONE: Record<OrderStatus, "neutral" | "out" | "in"> = {
  ordered: "neutral",
  shipped: "out",
  delivered: "in",
};

/** Map any stored value (incl. legacy free-text) to a known status for display. */
export function asStatus(value: string | null | undefined, delivered = false): OrderStatus {
  const v = (value ?? "").toLowerCase();
  if ((ORDER_STATUSES as readonly string[]).includes(v)) return v as OrderStatus;
  return delivered ? "delivered" : "ordered";
}
