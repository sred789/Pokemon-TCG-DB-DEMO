// In-browser request router — the demo's stand-in for the FastAPI backend.
//
// Maps the same method+path the React Query hooks call (see src/api/hooks.ts) to handlers that
// read/write the localStorage-backed store and return the same JSON shapes (src/api/types.ts).
// Service errors become ApiError(400); missing resources ApiError(404), mirroring the backend.

import { ApiError } from "../api/errors";
import type { CardDetail, ManualEntry, Order, OrderItem } from "../api/types";
import {
  addManual,
  getCard,
  listCards,
  upsert,
} from "./cards";
import { getCatalogCard, searchCatalog } from "./catalog";
import { getDb, saveDb, type DemoDb, type ManualRow, type OrderRow } from "./db";
import {
  createDeck,
  deckEditorModel,
  deleteDeck,
  getDeck,
  listDecks,
  replaceDeckCards,
  setNeeded,
  shoppingList,
} from "./decks";
import { importRows, parseRows } from "./bulkImport";
import { parseAndResolve } from "./deckImport";
import { cardInventoryFor, cardInventoryRows, inventoryTotals } from "./inventory";

const COMMON_SOURCES = ["Booster Pack", "Trade", "Local Store", "Gift", "Pre-release", "Other"];
const SHIPPING_STATUSES = ["ordered", "shipped", "delivered"];

// --- serializers ---------------------------------------------------------------------------

function serializeOrder(db: DemoDb, order: OrderRow): Order {
  const items: OrderItem[] = db.orderItems
    .filter((oi) => oi.order_number === order.order_number)
    .map((oi) => ({
      order_item_id: oi.order_item_id,
      order_number: oi.order_number,
      card_id: oi.card_id,
      quantity: oi.quantity,
      card: getCard(db, oi.card_id)!,
    }));
  return { ...order, items };
}

function serializeManual(db: DemoDb, entry: ManualRow): ManualEntry {
  return { ...entry, card: getCard(db, entry.card_id)! };
}

function normalizeStatus(status: string | undefined, delivered: boolean | undefined): string {
  const s = (status ?? "").trim().toLowerCase();
  if (SHIPPING_STATUSES.includes(s)) return s;
  return delivered ? "delivered" : "ordered";
}

/** Resolve a card to the store catalog, pulling from the static catalog on a miss. */
function ensureCard(db: DemoDb, cardId: string) {
  let card = getCard(db, cardId);
  if (!card) {
    const fromCatalog = getCatalogCard(cardId);
    if (fromCatalog) card = upsert(db, fromCatalog);
  }
  if (!card) throw new ApiError(`Card '${cardId}' was not found in your catalog.`, 400);
  return card;
}

// --- routes --------------------------------------------------------------------------------

interface Ctx {
  db: DemoDb;
  params: Record<string, string>;
  query: URLSearchParams;
  body: unknown;
}
type Handler = (ctx: Ctx) => unknown;
interface Route {
  method: string;
  segs: string[];
  handler: Handler;
}

function r(method: string, path: string, handler: Handler): Route {
  return { method, segs: path.split("/").filter(Boolean), handler };
}

function found<T>(value: T | undefined, message: string): T {
  if (value === undefined) throw new ApiError(message, 404);
  return value;
}

// Order matters: literal-segment routes must precede same-length param routes.
const ROUTES: Route[] = [
  // dashboard + shopping list
  r("GET", "/dashboard", ({ db }) => ({
    totals: inventoryTotals(db),
    rows: cardInventoryRows(db),
  })),
  r("GET", "/shopping-list", ({ db }) => shoppingList(db)),

  // cards
  r("GET", "/cards/search", ({ query }) => ({
    results: searchCatalog(query.get("name") ?? "", query.get("set") ?? ""),
    error: null,
  })),
  r("POST", "/cards", ({ db, query }) => {
    const cardId = (query.get("card_id") ?? "").trim();
    const card = getCatalogCard(cardId);
    if (!card) throw new ApiError(`No card found with id ${cardId}.`, 404);
    return upsert(db, card);
  }),
  r("GET", "/cards/:card_id", ({ db, params }): CardDetail => {
    const card = found(getCard(db, params.card_id), `Card ${params.card_id} is not in your catalog.`);
    return {
      card,
      inv: cardInventoryFor(db, params.card_id),
      order_items: db.orderItems
        .filter((oi) => oi.card_id === params.card_id)
        .map((oi) => ({ order_number: oi.order_number, quantity: oi.quantity })),
      deck_cards: db.deckCards
        .filter((dc) => dc.card_id === params.card_id)
        .map((dc) => ({
          deck_id: dc.deck_id,
          quantity_needed: dc.quantity_needed,
          quantity_allocated: dc.quantity_allocated,
        })),
    };
  }),
  r("GET", "/cards", ({ db, query }) =>
    listCards(db, query.get("exclude_basic") !== "true"),
  ),

  // orders
  r("GET", "/orders", ({ db }) =>
    [...db.orders]
      .sort((a, b) => b.order_date.localeCompare(a.order_date) || a.order_number.localeCompare(b.order_number))
      .map((o) => serializeOrder(db, o)),
  ),
  r("GET", "/orders/:n", ({ db, params }) => {
    const order = found(
      db.orders.find((o) => o.order_number === params.n),
      `Order ${params.n} not found.`,
    );
    return serializeOrder(db, order);
  }),
  r("POST", "/orders", ({ db, body }) => {
    const b = body as Partial<OrderRow>;
    const orderNumber = (b.order_number ?? "").trim();
    if (!orderNumber) throw new ApiError("Order number is required.", 400);
    if (db.orders.some((o) => o.order_number === orderNumber)) {
      throw new ApiError(`Order ${orderNumber} already exists.`, 400);
    }
    const status = normalizeStatus(b.shipping_status, b.delivered);
    const order: OrderRow = {
      order_number: orderNumber,
      order_date: b.order_date ?? "",
      seller: (b.seller ?? "").trim(),
      shipping_status: status,
      delivered: status === "delivered",
    };
    db.orders.push(order);
    return serializeOrder(db, order);
  }),
  r("PATCH", "/orders/:n", ({ db, params, body }) => {
    const order = found(
      db.orders.find((o) => o.order_number === params.n),
      `Order ${params.n} not found.`,
    );
    const b = body as Partial<OrderRow>;
    const status = normalizeStatus(b.shipping_status, b.delivered);
    order.order_date = b.order_date ?? order.order_date;
    order.seller = (b.seller ?? "").trim();
    order.shipping_status = status;
    order.delivered = status === "delivered";
    return serializeOrder(db, order);
  }),
  r("DELETE", "/orders/:n", ({ db, params }) => {
    found(db.orders.find((o) => o.order_number === params.n), `Order ${params.n} not found.`);
    db.orders = db.orders.filter((o) => o.order_number !== params.n);
    db.orderItems = db.orderItems.filter((oi) => oi.order_number !== params.n); // cascade
    return null;
  }),
  r("POST", "/orders/:n/items", ({ db, params, body }) => {
    const order = found(
      db.orders.find((o) => o.order_number === params.n),
      `Order ${params.n} not found.`,
    );
    const b = body as { card_id: string; quantity: number };
    if (b.quantity < 1) throw new ApiError("Quantity must be at least 1.", 400);
    const card = ensureCard(db, b.card_id.trim());
    const existing = db.orderItems.find(
      (oi) => oi.order_number === order.order_number && oi.card_id === card.card_id,
    );
    if (existing) existing.quantity += b.quantity;
    else
      db.orderItems.push({
        order_item_id: db.seq.orderItemId++,
        order_number: order.order_number,
        card_id: card.card_id,
        quantity: b.quantity,
      });
    return serializeOrder(db, order);
  }),
  r("DELETE", "/orders/:n/items/:item_id", ({ db, params }) => {
    const order = found(
      db.orders.find((o) => o.order_number === params.n),
      `Order ${params.n} not found.`,
    );
    const itemId = Number(params.item_id);
    const item = db.orderItems.find(
      (oi) => oi.order_number === order.order_number && oi.order_item_id === itemId,
    );
    if (!item) throw new ApiError("Item not found.", 404);
    db.orderItems = db.orderItems.filter((oi) => oi.order_item_id !== itemId);
    return null;
  }),

  // inventory
  r("GET", "/inventory/sources", () => COMMON_SOURCES),
  r("POST", "/inventory/import", ({ db, body }) => {
    const { rows, errors } = parseRows((body as { text: string }).text);
    const { catalogued, inventoryAdded } = rows.length
      ? importRows(db, rows)
      : { catalogued: 0, inventoryAdded: 0 };
    return { rows, errors, catalogued, inventory_added: inventoryAdded };
  }),
  r("GET", "/inventory", ({ db }) =>
    [...db.manualInventory]
      .sort((a, b) => b.date_added.localeCompare(a.date_added))
      .map((m) => serializeManual(db, m)),
  ),
  r("POST", "/inventory", ({ db, body }) => {
    const b = body as {
      card_id?: string;
      quantity: number;
      source?: string;
      date_added: string;
      manual?: {
        card_name: string;
        card_set?: string;
        set_number?: string;
        supertype?: string;
        is_ace_spec?: boolean;
      };
    };
    let cardId = (b.card_id ?? "").trim();
    if (b.manual) {
      cardId = addManual(db, b.manual).card_id;
    }
    const card = ensureCard(db, cardId);
    if (b.quantity < 1) throw new ApiError("Quantity must be at least 1.", 400);
    const entry: ManualRow = {
      induction_id: db.seq.inductionId++,
      card_id: card.card_id,
      quantity: b.quantity,
      source: (b.source ?? "").trim() || "Other",
      date_added: b.date_added,
    };
    db.manualInventory.push(entry);
    return serializeManual(db, entry);
  }),
  r("DELETE", "/inventory/:induction_id", ({ db, params }) => {
    const id = Number(params.induction_id);
    if (!db.manualInventory.some((m) => m.induction_id === id)) {
      throw new ApiError("Inventory entry not found.", 404);
    }
    db.manualInventory = db.manualInventory.filter((m) => m.induction_id !== id);
    return null;
  }),

  // decks
  r("GET", "/decks", ({ db }) => listDecks(db)),
  r("POST", "/decks", ({ db, body }) => {
    const deck = createDeck(db, (body as { deck_name: string }).deck_name);
    return { deck_id: deck.deck_id, deck_name: deck.deck_name };
  }),
  r("GET", "/decks/:id", ({ db, params }) => {
    const deck = found(getDeck(db, Number(params.id)), "Deck not found.");
    return deckEditorModel(db, deck);
  }),
  r("DELETE", "/decks/:id", ({ db, params }) => {
    found(getDeck(db, Number(params.id)), "Deck not found.");
    deleteDeck(db, Number(params.id));
    return null;
  }),
  r("POST", "/decks/:id/save", ({ db, params, body }) => {
    const deck = found(getDeck(db, Number(params.id)), "Deck not found.");
    replaceDeckCards(db, deck, (body as { slots: never[] }).slots);
    return { ok: true };
  }),
  r("POST", "/decks/:id/import", ({ db, params, body }) => {
    found(getDeck(db, Number(params.id)), "Deck not found.");
    const lines = parseAndResolve((body as { text: string }).text);
    for (const line of lines) {
      if (line.status === "matched" && line.candidates.length) {
        const full = getCatalogCard(line.candidates[0].card_id);
        if (full) upsert(db, full);
      }
    }
    return { lines };
  }),
  r("POST", "/decks/:id/import/confirm", ({ db, params, body }) => {
    const deck = found(getDeck(db, Number(params.id)), "Deck not found.");
    const b = body as { selections: { card_id: string; quantity: number }[]; mode: string };
    let imported = 0;
    const errors: string[] = [];
    for (const sel of b.selections) {
      if (!sel.card_id.trim()) continue;
      try {
        setNeeded(db, deck, sel.card_id, sel.quantity, b.mode === "add");
        imported++;
      } catch (e) {
        errors.push(`${sel.card_id}: ${(e as Error).message}`);
      }
    }
    return { imported, errors };
  }),
];

function matchSegs(pattern: string[], actual: string[]): Record<string, string> | null {
  if (pattern.length !== actual.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < pattern.length; i++) {
    const p = pattern[i];
    if (p.startsWith(":")) params[p.slice(1)] = decodeURIComponent(actual[i]);
    else if (p !== actual[i]) return null;
  }
  return params;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Handle one request. Resolves to the response body (null for 204); rejects with ApiError. */
export async function handle(method: string, path: string, body?: unknown): Promise<unknown> {
  await delay(50); // keep React Query's loading states visible
  const [rawPath, qs = ""] = path.split("?");
  const segs = rawPath.split("/").filter(Boolean);
  const query = new URLSearchParams(qs);
  const db = getDb();

  for (const route of ROUTES) {
    if (route.method !== method) continue;
    const params = matchSegs(route.segs, segs);
    if (!params) continue;
    let result: unknown;
    try {
      result = route.handler({ db, params, query, body });
    } catch (e) {
      if (e instanceof ApiError) throw e;
      throw new ApiError((e as Error).message || "Request failed", 400);
    }
    if (method !== "GET") saveDb();
    return result ?? null;
  }
  throw new ApiError(`No route for ${method} ${rawPath}`, 404);
}
