// In-browser data store for the static demo.
//
// Mirrors the six backend tables as plain arrays, seeded from the exported JSON and persisted
// to localStorage so a visitor's edits survive a refresh. There is no backend: every demo
// "API" handler reads and mutates this singleton. `resetDb()` restores the original seed.

import type { Card } from "../api/types";
import { ensureBasicEnergy } from "./cards";

import cardsSeed from "./data/cards.json";
import decksSeed from "./data/decks.json";
import deckCardsSeed from "./data/deck_cards.json";
import ordersSeed from "./data/orders.json";
import orderItemsSeed from "./data/order_items.json";
import manualSeed from "./data/manual_inventory.json";

export interface OrderRow {
  order_number: string;
  order_date: string;
  seller: string;
  shipping_status: string;
  delivered: boolean;
}

export interface OrderItemRow {
  order_item_id: number;
  order_number: string;
  card_id: string;
  quantity: number;
}

export interface ManualRow {
  induction_id: number;
  card_id: string;
  quantity: number;
  source: string;
  date_added: string;
}

export interface DeckRow {
  deck_id: number;
  deck_name: string;
  creation_date: string;
}

export interface DeckCardRow {
  deck_card_id: number;
  deck_id: number;
  card_id: string;
  quantity_needed: number;
  quantity_allocated: number;
}

export interface DemoDb {
  cards: Card[];
  orders: OrderRow[];
  orderItems: OrderItemRow[];
  manualInventory: ManualRow[];
  decks: DeckRow[];
  deckCards: DeckCardRow[];
  seq: { orderItemId: number; inductionId: number; deckId: number; deckCardId: number };
}

// Bump the version suffix when the bundled seed data changes, so returning visitors re-seed
// instead of keeping a stale snapshot (v4: renamed the Dragapult deck to "Pult Position").
const STORAGE_KEY = "ptcg-demo:v4";

function maxId<T>(rows: T[], key: keyof T): number {
  return rows.reduce((m, r) => Math.max(m, Number(r[key]) || 0), 0);
}

/** A fresh store from the bundled seed JSON (deep-copied so edits never touch the imports). */
function buildSeed(): DemoDb {
  const db: DemoDb = {
    cards: (cardsSeed as Card[]).map((c) => ({ ...c })),
    orders: (ordersSeed as OrderRow[]).map((o) => ({ ...o })),
    orderItems: (orderItemsSeed as OrderItemRow[]).map((o) => ({ ...o })),
    manualInventory: (manualSeed as ManualRow[]).map((m) => ({ ...m })),
    decks: (decksSeed as DeckRow[]).map((d) => ({ ...d })),
    deckCards: (deckCardsSeed as DeckCardRow[]).map((dc) => ({ ...dc })),
    seq: { orderItemId: 0, inductionId: 0, deckId: 0, deckCardId: 0 },
  };
  ensureBasicEnergy(db);
  db.seq.orderItemId = maxId(db.orderItems, "order_item_id") + 1;
  db.seq.inductionId = maxId(db.manualInventory, "induction_id") + 1;
  db.seq.deckId = maxId(db.decks, "deck_id") + 1;
  db.seq.deckCardId = maxId(db.deckCards, "deck_card_id") + 1;
  return db;
}

let store: DemoDb | null = null;

const STORAGE_PREFIX = "ptcg-demo:";

/** Drop snapshots from older data versions so stale seed data can't linger. */
function purgeLegacy(): void {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORAGE_PREFIX) && key !== STORAGE_KEY) {
        localStorage.removeItem(key);
      }
    }
  } catch {
    // storage unavailable — nothing to purge
  }
}

function read(): DemoDb {
  purgeLegacy();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as DemoDb;
  } catch {
    // ignore corrupt/full storage — fall through to a fresh seed
  }
  const fresh = buildSeed();
  persist(fresh);
  return fresh;
}

function persist(db: DemoDb): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    // storage may be unavailable/full; the demo still works in-memory this session
  }
}

/** The live store, loaded from localStorage on first access. */
export function getDb(): DemoDb {
  if (store === null) store = read();
  return store;
}

/** Persist the current store. Call after any mutation. */
export function saveDb(): void {
  if (store !== null) persist(store);
}

/** Restore the original seed data, discarding all visitor edits. */
export function resetDb(): void {
  store = buildSeed();
  persist(store);
}
