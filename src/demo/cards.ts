// Catalog persistence — port of app/services/cards.py.
//
// The store's `cards` array IS the catalog. Every path that needs a card present (orders,
// inventory, decks, imports) funnels through `upsert`/`getCard` here.

import type { Card } from "../api/types";
import type { DemoDb } from "./db";
import { hasAccents, normalizeName } from "./names";

export const BASIC_ENERGY_SET = "ENG";
export const BASIC_ENERGY_TYPES = [
  "Grass", "Fire", "Water", "Lightning", "Psychic", "Fighting", "Darkness", "Metal",
];

export function basicEnergyId(energyType: string): string {
  return `${BASIC_ENERGY_SET}-${energyType.toLowerCase()}`;
}

export function getCard(db: DemoDb, cardId: string): Card | undefined {
  return db.cards.find((c) => c.card_id === cardId);
}

export function listCards(db: DemoDb, includeBasicEnergy = true): Card[] {
  const cards = includeBasicEnergy ? db.cards : db.cards.filter((c) => !c.is_basic_energy);
  return [...cards].sort(
    (a, b) =>
      a.card_set.localeCompare(b.card_set) ||
      a.card_name.localeCompare(b.card_name) ||
      a.set_number.localeCompare(b.set_number),
  );
}

/** Insert or replace a catalog card by id. Returns the stored card. */
export function upsert(db: DemoDb, card: Card): Card {
  const idx = db.cards.findIndex((c) => c.card_id === card.card_id);
  if (idx >= 0) {
    db.cards[idx] = { ...card };
    return db.cards[idx];
  }
  const stored = { ...card };
  db.cards.push(stored);
  return stored;
}

const SLUG_RE = /[^a-z0-9]+/g;

function slug(s: string): string {
  return s.toLowerCase().replace(SLUG_RE, "-").replace(/^-+|-+$/g, "");
}

export interface ManualCardInput {
  card_name: string;
  card_set?: string;
  set_number?: string;
  supertype?: string;
  is_ace_spec?: boolean;
  is_basic_energy?: boolean;
}

/** Create (or refresh) a hand-typed card with a `man-` id that can't collide with an API id. */
export function addManual(db: DemoDb, input: ManualCardInput): Card {
  const cardName = input.card_name.trim();
  const cardSet = (input.card_set ?? "").trim();
  const setNumber = (input.set_number ?? "").trim();
  if (!cardName) throw new Error("Card name is required.");
  const parts = [slug(cardName), slug(cardSet), slug(setNumber)].filter(Boolean);
  const cardId = "man-" + parts.join("-");
  return upsert(db, {
    card_id: cardId,
    card_name: cardName,
    card_set: cardSet || "—",
    set_number: setNumber || "—",
    supertype: (input.supertype ?? "").trim(),
    subtypes: input.is_ace_spec ? "ACE SPEC" : "",
    image_url: null,
    is_basic_energy: input.is_basic_energy ?? false,
    is_ace_spec: input.is_ace_spec ?? false,
  });
}

/** normalized name -> the catalog's preferred spelling (accented spelling wins, then commonest). */
export function canonicalNameMap(db: DemoDb): Record<string, string> {
  const byNorm: Record<string, string[]> = {};
  for (const c of db.cards) {
    (byNorm[normalizeName(c.card_name)] ??= []).push(c.card_name);
  }
  const result: Record<string, string> = {};
  for (const [key, spellings] of Object.entries(byNorm)) {
    const accented = spellings.filter(hasAccents);
    const pool = accented.length ? accented : spellings;
    const counts = new Map<string, number>();
    for (const s of pool) counts.set(s, (counts.get(s) ?? 0) + 1);
    let best = pool[0];
    let bestN = 0;
    for (const [s, n] of counts) {
      if (n > bestN) {
        best = s;
        bestN = n;
      }
    }
    result[key] = best;
  }
  return result;
}

/** Map a deck-list name to a seeded basic-energy id, or null if it isn't basic energy. */
export function resolveBasicEnergyId(name: string): string | null {
  const cleaned = name.trim();
  if (!cleaned.toLowerCase().endsWith("energy")) return null;
  let core = cleaned.slice(0, cleaned.length - "energy".length).trim();
  if (core.toLowerCase().startsWith("basic ")) core = core.slice("basic ".length).trim();
  for (const t of BASIC_ENERGY_TYPES) {
    if (core.toLowerCase() === t.toLowerCase()) return basicEnergyId(t);
  }
  return null;
}

/** Idempotently seed the 8 basic-energy catalog entries (infinite supply, image-less). */
export function ensureBasicEnergy(db: DemoDb): void {
  for (const t of BASIC_ENERGY_TYPES) {
    const cid = basicEnergyId(t);
    if (db.cards.some((c) => c.card_id === cid)) continue;
    db.cards.push({
      card_id: cid,
      card_name: `Basic ${t} Energy`,
      card_set: BASIC_ENERGY_SET,
      set_number: "—",
      supertype: "Energy",
      subtypes: "Basic",
      image_url: null,
      is_basic_energy: true,
      is_ace_spec: false,
    });
  }
}
