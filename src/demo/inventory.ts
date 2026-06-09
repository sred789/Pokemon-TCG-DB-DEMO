// Inventory math — port of the `card_inventory` SQL view + app/services/inventory.py.
//
// Per-card ownership is computed from manual inventory + orders − deck allocations. On top of
// that, *availability* is pooled by normalized name for Trainers and non-basic Energy (every
// printing of "Boss's Orders" draws from one pile). Availability counts in-transit copies, so a
// deck can be built before an order arrives: available = total_owned − allocated.
//
// Basic energy is infinite and is excluded entirely (as the view's WHERE clause does).

import type { InventoryRow, Totals } from "../api/types";
import type { DemoDb } from "./db";
import { normalizeName } from "./names";

interface RawRow {
  card_id: string;
  card_name: string;
  card_set: string;
  set_number: string;
  supertype: string;
  is_basic_energy: boolean;
  manual_qty: number;
  total_owned: number;
  in_possession: number;
  incoming: number;
  allocated: number;
}

interface Pool {
  in_possession: number;
  total_owned: number;
  allocated: number;
  available: number;
}

export function isPoolable(supertype: string, isBasicEnergy: boolean): boolean {
  return !isBasicEnergy && (supertype === "Trainer" || supertype === "Energy");
}

/** Coarse type bucket for the deck-page filter: pokemon | trainer | energy | other. */
export function typeCategory(supertype: string, isBasicEnergy: boolean): string {
  const st = supertype || "";
  if (isBasicEnergy || st === "Energy") return "energy";
  if (st === "Trainer") return "trainer";
  if (st.startsWith("Pok")) return "pokemon";
  return "other";
}

function sumBy<T>(rows: T[], key: (r: T) => string, value: (r: T) => number): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) m.set(key(r), (m.get(key(r)) ?? 0) + value(r));
  return m;
}

/** card_inventory rows (one per non-basic-energy card), ordered by set, name, number. */
function rawRows(db: DemoDb): RawRow[] {
  const manualByCard = sumBy(db.manualInventory, (r) => r.card_id, (r) => r.quantity);
  const allocByCard = sumBy(db.deckCards, (r) => r.card_id, (r) => r.quantity_allocated);
  const deliveredByOrder = new Map(db.orders.map((o) => [o.order_number, o.delivered]));
  const orderTotalByCard = new Map<string, number>();
  const orderDeliveredByCard = new Map<string, number>();
  for (const oi of db.orderItems) {
    orderTotalByCard.set(oi.card_id, (orderTotalByCard.get(oi.card_id) ?? 0) + oi.quantity);
    if (deliveredByOrder.get(oi.order_number)) {
      orderDeliveredByCard.set(
        oi.card_id,
        (orderDeliveredByCard.get(oi.card_id) ?? 0) + oi.quantity,
      );
    }
  }

  const rows: RawRow[] = [];
  for (const c of db.cards) {
    if (c.is_basic_energy) continue;
    const manual = manualByCard.get(c.card_id) ?? 0;
    const orderTotal = orderTotalByCard.get(c.card_id) ?? 0;
    const orderDelivered = orderDeliveredByCard.get(c.card_id) ?? 0;
    rows.push({
      card_id: c.card_id,
      card_name: c.card_name,
      card_set: c.card_set,
      set_number: c.set_number,
      supertype: c.supertype,
      is_basic_energy: c.is_basic_energy,
      manual_qty: manual,
      total_owned: manual + orderTotal,
      in_possession: manual + orderDelivered,
      incoming: orderTotal - orderDelivered,
      allocated: allocByCard.get(c.card_id) ?? 0,
    });
  }
  rows.sort(
    (a, b) =>
      a.card_set.localeCompare(b.card_set) ||
      a.card_name.localeCompare(b.card_name) ||
      a.set_number.localeCompare(b.set_number),
  );
  return rows;
}

/** normalized name -> pooled availability across poolable printings. */
export function availabilityPools(db: DemoDb): Map<string, Pool> {
  const pools = new Map<string, Pool>();
  for (const r of rawRows(db)) {
    if (!isPoolable(r.supertype, r.is_basic_energy)) continue;
    const key = normalizeName(r.card_name);
    const agg = pools.get(key) ?? { in_possession: 0, total_owned: 0, allocated: 0, available: 0 };
    agg.in_possession += r.in_possession;
    agg.total_owned += r.total_owned;
    agg.allocated += r.allocated;
    pools.set(key, agg);
  }
  for (const agg of pools.values()) agg.available = agg.total_owned - agg.allocated;
  return pools;
}

function applyPool(r: RawRow, pools: Map<string, Pool>): InventoryRow {
  let available: number;
  let pooled = false;
  if (isPoolable(r.supertype, r.is_basic_energy)) {
    const pool = pools.get(normalizeName(r.card_name));
    if (pool !== undefined) {
      available = pool.available;
      pooled = true;
    } else {
      available = r.total_owned - r.allocated;
    }
  } else {
    available = r.total_owned - r.allocated;
  }
  return {
    card_id: r.card_id,
    card_name: r.card_name,
    card_set: r.card_set,
    set_number: r.set_number,
    total_owned: r.total_owned,
    in_possession: r.in_possession,
    incoming: r.incoming,
    allocated: r.allocated,
    available_to_allocate: available,
    supertype: r.supertype,
    is_basic_energy: r.is_basic_energy,
    pooled,
  };
}

export function cardInventoryRows(db: DemoDb): InventoryRow[] {
  const pools = availabilityPools(db);
  return rawRows(db).map((r) => applyPool(r, pools));
}

export function cardInventoryFor(db: DemoDb, cardId: string): InventoryRow | null {
  const row = rawRows(db).find((r) => r.card_id === cardId);
  if (!row) return null;
  return applyPool(row, availabilityPools(db));
}

export function inventoryTotals(db: DemoDb): Totals {
  const rows = rawRows(db);
  let totalOwned = 0;
  let inPossession = 0;
  let incoming = 0;
  let allocated = 0;
  for (const r of rows) {
    totalOwned += r.total_owned;
    inPossession += r.in_possession;
    incoming += r.incoming;
    allocated += r.allocated;
  }
  return {
    total_owned: totalOwned,
    in_possession: inPossession,
    incoming,
    available_to_allocate: totalOwned - allocated,
  };
}

/** Owned (incl. in-transit) minus allocated for one card, pooled by name for Trainers/Energy. */
export function availableToAllocate(db: DemoDb, cardId: string): number {
  const row = rawRows(db).find((r) => r.card_id === cardId);
  if (!row) return 0;
  if (isPoolable(row.supertype, row.is_basic_energy)) {
    const pool = availabilityPools(db).get(normalizeName(row.card_name));
    if (pool !== undefined) return pool.available;
  }
  return row.total_owned - row.allocated;
}

/** card_id -> total_owned (from card_inventory; excludes basic energy). */
export function ownedByCard(db: DemoDb): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rawRows(db)) m.set(r.card_id, r.total_owned);
  return m;
}
