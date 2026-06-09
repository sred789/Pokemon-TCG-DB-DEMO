import type { EditorCard, Slot } from "../api/types";

export const MAX_DECK = 60;
export const MAX_NAME = 4;
export const MAX_ACE = 1;

export interface Legality {
  total: number;
  violations: string[];
  legal: boolean;
}

/** Mirror of the backend deck_rules: 60 max, 4-by-name (basic energy exempt), 1 ACE SPEC. */
export function computeLegality(slots: Slot[], cards: Record<string, EditorCard>): Legality {
  let total = 0;
  let ace = 0;
  const byName: Record<string, number> = {};
  const display: Record<string, string> = {};
  for (const s of slots) {
    const c = cards[s.card_id];
    if (!c) continue;
    total += s.needed;
    if (!c.basic_energy) {
      byName[c.name_key] = (byName[c.name_key] ?? 0) + s.needed;
      display[c.name_key] = c.name;
    }
    if (c.ace_spec) ace += s.needed;
  }
  const violations: string[] = [];
  if (total > MAX_DECK) violations.push(`${total} cards (max ${MAX_DECK}).`);
  for (const key of Object.keys(byName).sort()) {
    if (byName[key] > MAX_NAME) violations.push(`${byName[key]}× '${display[key]}' (max ${MAX_NAME} by name).`);
  }
  if (ace > MAX_ACE) violations.push(`${ace} ACE SPEC (max ${MAX_ACE}).`);
  return { total, violations, legal: violations.length === 0 };
}
