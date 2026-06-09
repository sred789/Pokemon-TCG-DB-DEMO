import { describe, expect, it } from "vitest";

import type { EditorCard, Slot } from "../api/types";
import { computeLegality } from "./deck";

function card(name: string, type: EditorCard["type"], over: Partial<EditorCard> = {}): EditorCard {
  return {
    name,
    name_key: name.toLowerCase(),
    set: "x",
    number: "1",
    type,
    basic_energy: false,
    ace_spec: false,
    owned: 4,
    alloc_others: 0,
    ...over,
  };
}

describe("computeLegality", () => {
  const cards: Record<string, EditorCard> = {
    a: card("Dragapult ex", "pokemon"),
    b: card("Dragapult ex", "pokemon"), // same name, different printing
    e: card("Basic Fire Energy", "energy", { basic_energy: true }),
    ace: card("Maximum Belt", "trainer", { ace_spec: true }),
    ace2: card("Hero's Cape", "trainer", { ace_spec: true }),
  };
  const s = (card_id: string, needed: number): Slot => ({ card_id, needed, allocated: 0 });

  it("counts total and is legal under 60", () => {
    const r = computeLegality([s("a", 3), s("e", 10)], cards);
    expect(r.total).toBe(13);
    expect(r.legal).toBe(true);
  });

  it("flags over-60", () => {
    expect(computeLegality([s("e", 61)], cards).legal).toBe(false);
  });

  it("4-by-name across printings (basic energy exempt)", () => {
    const bad = computeLegality([s("a", 3), s("b", 2)], cards); // 5 Dragapult by name
    expect(bad.legal).toBe(false);
    expect(computeLegality([s("e", 20)], cards).legal).toBe(true); // 20 basic energy ok
  });

  it("max 1 ACE SPEC", () => {
    expect(computeLegality([s("ace", 1), s("ace2", 1)], cards).legal).toBe(false);
    expect(computeLegality([s("ace", 1)], cards).legal).toBe(true);
  });
});
