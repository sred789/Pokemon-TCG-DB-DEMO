// Static card catalog for LOCAL search / add-card / deck-import resolution.
//
// Replaces the external Pokémon TCG API: search and import resolve against this bundled
// superset (the collection's cards plus a handful of popular extras) instead of the network.

import type { Card, CardDTO } from "../api/types";
import { foldAccents } from "./names";
import catalogData from "./data/catalog.json";

const CATALOG = catalogData as Card[];

const fold = (s: string): string => foldAccents(s).toLowerCase().trim();

function toDTO(c: Card): CardDTO {
  return {
    card_id: c.card_id,
    card_name: c.card_name,
    card_set: c.card_set,
    set_number: c.set_number,
    image_url: c.image_url,
    supertype: c.supertype,
  };
}

function bySetThenNumber(a: Card, b: Card): number {
  return a.card_set.localeCompare(b.card_set) || a.set_number.localeCompare(b.set_number);
}

export function getCatalogCard(cardId: string): Card | undefined {
  return CATALOG.find((c) => c.card_id === cardId);
}

/** Name (prefix) and/or set filter, mirroring TCGClient.search_by. Blank inputs -> []. */
export function searchCatalog(name: string, setCode: string): CardDTO[] {
  const n = fold(name);
  const s = setCode.trim().toLowerCase();
  if (!n && !s) return [];
  return CATALOG.filter((c) => {
    if (n && !fold(c.card_name).startsWith(n)) return false;
    if (s && c.card_set.toLowerCase() !== s) return false;
    return true;
  })
    .sort(bySetThenNumber)
    .map(toDTO);
}

/** Free-text name search (prefix, accent-insensitive), mirroring TCGClient.search. */
export function searchByName(name: string): CardDTO[] {
  const n = fold(name);
  if (!n) return [];
  return CATALOG.filter((c) => fold(c.card_name).startsWith(n)).sort(bySetThenNumber).map(toDTO);
}

function numberMatches(setNumber: string, number: string): boolean {
  const lead = setNumber.split("/")[0].toLowerCase();
  const num = number.toLowerCase();
  return lead === num || setNumber.toLowerCase() === num;
}

/** Exact-ish lookup by set code + number, mirroring TCGClient.find_by_set_and_number. */
export function findBySetAndNumber(setCode: string, number: string): CardDTO[] {
  const s = setCode.trim().toLowerCase();
  return CATALOG.filter((c) => c.card_set.toLowerCase() === s && numberMatches(c.set_number, number))
    .sort(bySetThenNumber)
    .map(toDTO);
}
