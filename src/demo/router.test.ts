// Smoke tests for the in-browser demo backend: drive the router against the bundled seed data
// and assert the ported inventory/deck logic behaves like the original FastAPI service.

import { beforeEach, describe, expect, it } from "vitest";

import { ApiError } from "../api/errors";
import type { Card, DeckModel, DeckSummary, InventoryRow, Order, ShoppingItem, Totals } from "../api/types";
import { resetDb } from "./db";
import { handle } from "./router";

// Minimal localStorage shim for the node test environment.
class MemoryStorage {
  private store = new Map<string, string>();
  getItem(k: string) {
    return this.store.has(k) ? this.store.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.store.set(k, String(v));
  }
  removeItem(k: string) {
    this.store.delete(k);
  }
  clear() {
    this.store.clear();
  }
}
(globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();

const get = <T>(path: string) => handle("GET", path) as Promise<T>;
const send = <T>(method: "POST" | "PATCH" | "DELETE", path: string, body?: unknown) =>
  handle(method, path, body) as Promise<T>;

beforeEach(() => resetDb());

describe("demo router", () => {
  it("serves a populated dashboard with consistent totals", async () => {
    const { totals, rows } = await get<{ totals: Totals; rows: InventoryRow[] }>("/dashboard");
    expect(rows.length).toBeGreaterThan(50);
    expect(totals.total_owned).toBeGreaterThan(0);
    // available = owned − allocated across the collection
    const allocated = rows.reduce((s, r) => s + r.allocated, 0);
    expect(totals.available_to_allocate).toBe(totals.total_owned - allocated);
  });

  it("lists cards with locally-hosted images and excludes basic energy on request", async () => {
    const all = await get<Card[]>("/cards");
    expect(all.length).toBeGreaterThanOrEqual(136);
    expect(all.some((c) => c.image_url?.startsWith("/cards/"))).toBe(true);
    expect(all.some((c) => c.is_basic_energy)).toBe(true);

    const noBasic = await get<Card[]>("/cards?exclude_basic=true");
    expect(noBasic.some((c) => c.is_basic_energy)).toBe(false);
  });

  it("lists decks with legality and serves the editor model", async () => {
    const decks = await get<DeckSummary[]>("/decks");
    expect(decks.length).toBe(5);
    const model = await get<DeckModel>(`/decks/${decks[0].deck_id}`);
    expect(model.deck.id).toBe(decks[0].deck_id);
    expect(Object.keys(model.cards).length).toBeGreaterThan(0);
  });

  it("computes a shopping list with positive to-buy quantities", async () => {
    const items = await get<ShoppingItem[]>("/shopping-list");
    for (const it of items) expect(it.to_buy).toBeGreaterThan(0);
    // sorted by to_buy desc
    for (let i = 1; i < items.length; i++) {
      expect(items[i - 1].to_buy).toBeGreaterThanOrEqual(items[i].to_buy);
    }
  });

  it("searches the local catalog with no network", async () => {
    const res = await get<{ results: Card[]; error: null }>("/cards/search?name=char&set=");
    expect(res.error).toBeNull();
    expect(Array.isArray(res.results)).toBe(true);
  });

  it("rejects over-allocation on save with a 400 ApiError", async () => {
    const decks = await get<DeckSummary[]>("/decks");
    const model = await get<DeckModel>(`/decks/${decks[0].deck_id}`);
    // Find a non-basic card and try to allocate an absurd amount.
    const cardId = Object.keys(model.cards).find((id) => !model.cards[id].basic_energy)!;
    await expect(
      send("POST", `/decks/${decks[0].deck_id}/save`, {
        slots: [{ card_id: cardId, needed: 1, allocated: 999 }],
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("adds an order item and reflects it in the dashboard", async () => {
    const before = await get<{ totals: Totals }>("/dashboard");
    const card = (await get<Card[]>("/cards?exclude_basic=true"))[0];
    const orders = await get<Order[]>("/orders");
    const updated = await send<Order>("POST", `/orders/${encodeURIComponent(orders[0].order_number)}/items`, {
      card_id: card.card_id,
      quantity: 3,
    });
    expect(updated.items.some((i) => i.card_id === card.card_id)).toBe(true);
    const after = await get<{ totals: Totals }>("/dashboard");
    expect(after.totals.total_owned).toBe(before.totals.total_owned + 3);
  });

  it("persists edits and restores them on reset", async () => {
    await send("POST", "/decks", { deck_name: "Smoke Test Deck" });
    let decks = await get<DeckSummary[]>("/decks");
    expect(decks.some((d) => d.deck_name === "Smoke Test Deck")).toBe(true);
    resetDb();
    decks = await get<DeckSummary[]>("/decks");
    expect(decks.some((d) => d.deck_name === "Smoke Test Deck")).toBe(false);
  });

  it("throws a 404 ApiError for unknown routes/resources", async () => {
    await expect(get("/cards/does-not-exist")).rejects.toBeInstanceOf(ApiError);
    await expect(get("/cards/does-not-exist")).rejects.toMatchObject({ status: 404 });
  });
});
