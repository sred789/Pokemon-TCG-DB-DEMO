// Deck-construction rules — port of app/services/deck_rules.py.
//
// Server-side legality used by the deck list, batch save, and import-confirm. Its violation
// wording differs from the editor's lib/deck.ts (those strings surface as save/import error
// toasts), so it is kept distinct — only the numeric limits are shared.

import { MAX_ACE, MAX_DECK, MAX_NAME } from "../lib/deck";
import { normalizeName } from "./names";

export interface DeckEntry {
  card_name: string;
  quantity: number;
  is_basic_energy: boolean;
  is_ace_spec: boolean;
}

export interface Legality {
  total: number;
  violations: string[];
  is_legal: boolean;
  is_complete: boolean;
}

export function evaluate(entries: DeckEntry[]): Legality {
  const total = entries.reduce((s, e) => s + e.quantity, 0);
  const violations: string[] = [];

  if (total > MAX_DECK) violations.push(`Deck has ${total} cards (max ${MAX_DECK}).`);

  // Group by normalized name so accent/case variants share one 4-of limit.
  const byName: Record<string, number> = {};
  const display: Record<string, string> = {};
  for (const e of entries) {
    if (e.is_basic_energy) continue;
    const key = normalizeName(e.card_name);
    byName[key] = (byName[key] ?? 0) + e.quantity;
    if (!(key in display)) display[key] = e.card_name;
  }
  for (const key of Object.keys(byName).sort()) {
    if (byName[key] > MAX_NAME) {
      violations.push(
        `${byName[key]}× '${display[key]}' (max ${MAX_NAME} by name, across all versions).`,
      );
    }
  }

  const aceSpecTotal = entries.reduce((s, e) => s + (e.is_ace_spec ? e.quantity : 0), 0);
  if (aceSpecTotal > MAX_ACE) {
    violations.push(`${aceSpecTotal} ACE SPEC cards (max ${MAX_ACE} per deck).`);
  }

  const isLegal = violations.length === 0;
  return { total, violations, is_legal: isLegal, is_complete: isLegal && total === MAX_DECK };
}
