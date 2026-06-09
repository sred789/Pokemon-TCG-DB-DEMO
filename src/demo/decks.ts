// Decks: listing, the editor model, batch save (with the possession guard), set-needed, and the
// global shopping list. Port of app/services/decks.py.

import type { Card, CardType, DeckModel, DeckSummary, EditorCard, ShoppingItem, Slot } from "../api/types";
import type { DemoDb, DeckCardRow, DeckRow } from "./db";
import { getCard, listCards, upsert } from "./cards";
import { getCatalogCard as catalogLookup } from "./catalog";
import { evaluate, type DeckEntry } from "./deckRules";
import {
  availabilityPools,
  isPoolable,
  ownedByCard,
  typeCategory,
} from "./inventory";
import { normalizeName } from "./names";

export class DeckError extends Error {}

export function getDeck(db: DemoDb, deckId: number): DeckRow | undefined {
  return db.decks.find((d) => d.deck_id === deckId);
}

function cardMap(db: DemoDb): Map<string, Card> {
  return new Map(db.cards.map((c) => [c.card_id, c]));
}

function deckCardsOf(db: DemoDb, deckId: number): DeckCardRow[] {
  return db.deckCards.filter((dc) => dc.deck_id === deckId);
}

/** Resolve a card to the catalog, pulling from the static catalog on a miss. */
function ensureCard(db: DemoDb, cardId: string): Card {
  let card = getCard(db, cardId);
  if (!card) {
    const fromCatalog = catalogLookup(cardId);
    if (fromCatalog) card = upsert(db, fromCatalog);
  }
  if (!card) throw new DeckError(`Card '${cardId}' was not found in your catalog.`);
  return card;
}

interface Override {
  card_id: string;
  card_name: string;
  quantity: number;
  is_basic_energy: boolean;
  is_ace_spec: boolean;
}

function deckEntries(db: DemoDb, deckId: number, override?: Override): DeckEntry[] {
  const cards = cardMap(db);
  const entries: DeckEntry[] = [];
  for (const dc of deckCardsOf(db, deckId)) {
    if (override && dc.card_id === override.card_id) continue;
    const c = cards.get(dc.card_id);
    if (!c) continue;
    entries.push({
      card_name: c.card_name,
      quantity: dc.quantity_needed,
      is_basic_energy: c.is_basic_energy,
      is_ace_spec: c.is_ace_spec,
    });
  }
  if (override && override.quantity > 0) {
    entries.push({
      card_name: override.card_name,
      quantity: override.quantity,
      is_basic_energy: override.is_basic_energy,
      is_ace_spec: override.is_ace_spec,
    });
  }
  return entries;
}

export function deckLegality(db: DemoDb, deckId: number) {
  return evaluate(deckEntries(db, deckId));
}

export function listDecks(db: DemoDb): DeckSummary[] {
  return [...db.decks]
    .sort((a, b) => a.deck_name.localeCompare(b.deck_name))
    .map((d) => {
      const legality = deckLegality(db, d.deck_id);
      return {
        deck_id: d.deck_id,
        deck_name: d.deck_name,
        creation_date: d.creation_date,
        total: legality.total,
        is_legal: legality.is_legal,
        is_complete: legality.is_complete,
      };
    });
}

export function createDeck(db: DemoDb, deckName: string): DeckRow {
  const name = deckName.trim();
  if (!name) throw new DeckError("Deck name is required.");
  if (db.decks.some((d) => d.deck_name === name)) {
    throw new DeckError(`A deck named '${name}' already exists.`);
  }
  const deck: DeckRow = {
    deck_id: db.seq.deckId++,
    deck_name: name,
    creation_date: new Date().toISOString().slice(0, 10),
  };
  db.decks.push(deck);
  return deck;
}

export function deleteDeck(db: DemoDb, deckId: number): void {
  db.decks = db.decks.filter((d) => d.deck_id !== deckId);
  db.deckCards = db.deckCards.filter((dc) => dc.deck_id !== deckId); // cascade
}

/** card_id -> copies allocated to decks OTHER than this one. */
function allocInOtherDecks(db: DemoDb, deckId: number): Map<string, number> {
  const m = new Map<string, number>();
  for (const dc of db.deckCards) {
    if (dc.deck_id === deckId) continue;
    m.set(dc.card_id, (m.get(dc.card_id) ?? 0) + dc.quantity_allocated);
  }
  return m;
}

export function deckEditorModel(db: DemoDb, deck: DeckRow): DeckModel {
  const owned = ownedByCard(db);
  const others = allocInOtherDecks(db, deck.deck_id);

  const cards: Record<string, EditorCard> = {};
  const printings: Record<string, string[]> = {};
  for (const c of listCards(db, true)) {
    const key = normalizeName(c.card_name);
    const ownedQty = c.is_basic_energy ? 0 : owned.get(c.card_id) ?? 0;
    cards[c.card_id] = {
      name: c.card_name,
      name_key: key,
      set: c.card_set,
      number: c.set_number,
      type: typeCategory(c.supertype, c.is_basic_energy) as CardType,
      basic_energy: c.is_basic_energy,
      ace_spec: c.is_ace_spec,
      owned: ownedQty,
      alloc_others: others.get(c.card_id) ?? 0,
    };
    if (!c.is_basic_energy && ownedQty > 0) (printings[key] ??= []).push(c.card_id);
  }
  for (const ids of Object.values(printings)) {
    ids.sort((a, b) => cards[b].owned - cards[a].owned || cards[a].set.localeCompare(cards[b].set));
  }

  const slots: Slot[] = deckCardsOf(db, deck.deck_id).map((dc) => ({
    card_id: dc.card_id,
    needed: dc.quantity_needed,
    allocated: dc.quantity_allocated,
  }));
  slots.sort((a, b) =>
    (cards[a.card_id]?.name ?? "").localeCompare(cards[b.card_id]?.name ?? ""),
  );

  return { deck: { id: deck.deck_id, name: deck.deck_name }, slots, cards, printings };
}

export function replaceDeckCards(db: DemoDb, deck: DeckRow, slots: Slot[]): void {
  // 1. Merge slots by card_id; validate; resolve cards.
  const merged = new Map<string, { card: Card; needed: number; allocated: number }>();
  for (const s of slots) {
    const cid = String(s.card_id ?? "").trim();
    const needed = Number(s.needed) || 0;
    const allocated = Number(s.allocated) || 0;
    if (needed < 0 || allocated < 0) throw new DeckError("Quantities cannot be negative.");
    if (needed === 0 && allocated === 0) continue;
    const existing = merged.get(cid);
    if (existing) {
      existing.needed += needed;
      existing.allocated += allocated;
    } else {
      const card = getCard(db, cid);
      if (!card) throw new DeckError(`Card '${cid}' is not in your catalog.`);
      merged.set(cid, { card, needed, allocated });
    }
  }
  const clean = [...merged.values()];

  // 2. Deck-construction rules.
  const legality = evaluate(
    clean.map(({ card, needed }) => ({
      card_name: card.card_name,
      quantity: needed,
      is_basic_energy: card.is_basic_energy,
      is_ace_spec: card.is_ace_spec,
    })),
  );
  if (legality.violations.length) throw new DeckError(legality.violations.join(" "));

  // 3. Per-card possession guard.
  const others = allocInOtherDecks(db, deck.deck_id);
  const owned = ownedByCard(db);
  for (const { card, allocated } of clean) {
    if (card.is_basic_energy) continue;
    const free = (owned.get(card.card_id) ?? 0) - (others.get(card.card_id) ?? 0);
    if (allocated > free) {
      throw new DeckError(
        `${card.card_name} (${card.card_set}): only ${free} free to allocate to this deck.`,
      );
    }
  }

  // 4. Replace the deck's cards.
  db.deckCards = db.deckCards.filter((dc) => dc.deck_id !== deck.deck_id);
  for (const { card, needed, allocated } of clean) {
    db.deckCards.push({
      deck_card_id: db.seq.deckCardId++,
      deck_id: deck.deck_id,
      card_id: card.card_id,
      quantity_needed: needed,
      quantity_allocated: card.is_basic_energy ? needed : allocated,
    });
  }
}

export function setNeeded(
  db: DemoDb,
  deck: DeckRow,
  cardId: string,
  quantityNeeded: number,
  add: boolean,
): void {
  if (quantityNeeded < 0) throw new DeckError("Needed quantity cannot be negative.");
  const cid = cardId.trim();
  const card = ensureCard(db, cid);
  const dc = db.deckCards.find((x) => x.deck_id === deck.deck_id && x.card_id === cid);

  const current = dc ? dc.quantity_needed : 0;
  const newNeeded = add ? current + quantityNeeded : quantityNeeded;

  const legality = evaluate(
    deckEntries(db, deck.deck_id, {
      card_id: cid,
      card_name: card.card_name,
      quantity: newNeeded,
      is_basic_energy: card.is_basic_energy,
      is_ace_spec: card.is_ace_spec,
    }),
  );
  if (legality.violations.length) throw new DeckError(legality.violations.join(" "));

  if (!dc) {
    db.deckCards.push({
      deck_card_id: db.seq.deckCardId++,
      deck_id: deck.deck_id,
      card_id: cid,
      quantity_needed: newNeeded,
      quantity_allocated: card.is_basic_energy ? newNeeded : 0,
    });
  } else {
    dc.quantity_needed = newNeeded;
    if (card.is_basic_energy) dc.quantity_allocated = newNeeded;
  }
}

export function shoppingList(db: DemoDb): ShoppingItem[] {
  const cards = cardMap(db);
  const pools = availabilityPools(db);
  const owned = ownedByCard(db);

  interface Pooled {
    card_id: string;
    card_name: string;
    sets: Set<string>;
    needed: number;
    owned: number;
  }
  const pooled = new Map<string, Pooled>();
  const perCard = new Map<string, ShoppingItem>();

  for (const dc of db.deckCards) {
    const c = cards.get(dc.card_id);
    if (!c || c.is_basic_energy) continue;
    if (isPoolable(c.supertype, c.is_basic_energy)) {
      const key = normalizeName(c.card_name);
      const g =
        pooled.get(key) ??
        {
          card_id: c.card_id,
          card_name: c.card_name,
          sets: new Set<string>(),
          needed: 0,
          owned: pools.get(key)?.total_owned ?? 0,
        };
      g.needed += dc.quantity_needed;
      g.sets.add(c.card_set);
      pooled.set(key, g);
    } else {
      const g =
        perCard.get(c.card_id) ??
        {
          card_id: c.card_id,
          card_name: c.card_name,
          card_set: c.card_set,
          set_number: c.set_number,
          needed: 0,
          owned: owned.get(c.card_id) ?? 0,
          to_buy: 0,
        };
      g.needed += dc.quantity_needed;
      perCard.set(c.card_id, g);
    }
  }

  const out: ShoppingItem[] = [];
  for (const g of pooled.values()) {
    const toBuy = Math.max(g.needed - g.owned, 0);
    if (toBuy) {
      out.push({
        card_id: g.card_id,
        card_name: g.card_name,
        card_set: g.sets.size > 1 ? "various" : [...g.sets][0],
        set_number: "",
        needed: g.needed,
        owned: g.owned,
        to_buy: toBuy,
      });
    }
  }
  for (const g of perCard.values()) {
    const toBuy = Math.max(g.needed - g.owned, 0);
    if (toBuy) out.push({ ...g, to_buy: toBuy });
  }
  out.sort((a, b) => b.to_buy - a.to_buy || a.card_name.localeCompare(b.card_name));
  return out;
}
