import type { DeckModel, ShoppingItem } from "../api/types";

/** Strip a "130/167" collector number down to the printed number "130". */
const collector = (setNumber: string) => (setNumber || "").split("/")[0].trim();

const tail = (set: string, number: string) =>
  [set, collector(number)].filter((p) => p && p !== "—").join(" ");

/** Drop user-added art/illustrator qualifiers like "[Ghetsis]" or "(Full Art)" — the set + number
 *  already identifies the printing, and the bare card name is what TCGplayer / RK9 match against. */
const cleanName = (name: string) => name.replace(/\s*[([][^)\]]*[)\]]/g, "").replace(/\s+/g, " ").trim();

/**
 * TCGplayer Mass Entry format — one card per line: `<qty> <Name> <SET> <Number>`.
 * e.g. `1 Charizard ex SSP 199`. Dropping the number tells Mass Entry any art of that set is fine;
 * we keep it for an exact match. See help.tcgplayer.com "Getting Started With Mass Entry".
 */
export function tcgplayerMassEntry(items: ShoppingItem[]): string {
  return items
    .filter((i) => i.to_buy > 0)
    .map((i) => {
      const t = tail(i.card_set, i.set_number);
      return `${i.to_buy} ${cleanName(i.card_name)}${t ? " " + t : ""}`;
    })
    .join("\n");
}

// SVE basic-energy collector numbers, as PTCGL exports them (e.g. "Basic Fire Energy SVE 2").
const SVE: Record<string, number> = {
  Grass: 1, Fire: 2, Water: 3, Lightning: 4, Psychic: 5, Fighting: 6, Darkness: 7, Metal: 8,
};

type Section = "pokemon" | "trainer" | "energy";

/**
 * Official Play! Pokémon / PTCGL decklist format:
 *
 *   Pokémon: 12
 *   3 Dragapult ex TWM 130
 *   ...
 *
 *   Trainer: 34
 *   4 Iono PAL 185
 *   ...
 *
 *   Energy: 14
 *   5 Basic Fire Energy SVE 2
 *   ...
 *
 *   Total Cards: 60
 *
 * Built from the deck's NEEDED composition: each printing contributes its allocated copies, and any
 * remaining needed copies fall back to the card's primary printing — so the list always sums to the
 * deck target with a real set + number on every line.
 */
export function officialDecklist(model: Pick<DeckModel, "slots" | "cards">): string {
  const { slots, cards } = model;

  const groups = new Map<string, number[]>();
  slots.forEach((s, i) => {
    const key = cards[s.card_id].name_key;
    groups.set(key, [...(groups.get(key) ?? []), i]);
  });

  const sectionOf = (cid: string): Section => {
    const c = cards[cid];
    if (c.basic_energy || c.type === "energy") return "energy";
    if (c.type === "pokemon") return "pokemon";
    return "trainer";
  };
  const lineText = (cid: string, count: number) => {
    const c = cards[cid];
    if (c.basic_energy) {
      const type = c.name.replace(/^Basic\s+/i, "").replace(/\s+Energy$/i, "").trim();
      const n = SVE[type];
      return `${count} Basic ${type} Energy${n ? ` SVE ${n}` : ""}`;
    }
    const t = tail(c.set, c.number);
    return `${count} ${cleanName(c.name)}${t ? " " + t : ""}`;
  };

  const entries: { count: number; text: string; section: Section; sort: string }[] = [];
  for (const idxs of groups.values()) {
    const leadCid = slots[idxs[0]].card_id;
    const needed = idxs.reduce((a, j) => a + slots[j].needed, 0);
    if (needed <= 0) continue;

    const perPrinting = idxs
      .map((j) => ({ cid: slots[j].card_id, count: slots[j].allocated }))
      .filter((e) => e.count > 0);
    let total = perPrinting.reduce((a, e) => a + e.count, 0);

    if (total < needed) {
      const lead = perPrinting.find((e) => e.cid === leadCid);
      if (lead) lead.count += needed - total;
      else perPrinting.unshift({ cid: leadCid, count: needed - total });
    } else if (total > needed) {
      let trim = total - needed;
      for (const e of perPrinting) {
        const take = Math.min(e.count, trim);
        e.count -= take;
        trim -= take;
        if (trim === 0) break;
      }
    }
    for (const e of perPrinting) {
      if (e.count > 0) {
        entries.push({ count: e.count, text: lineText(e.cid, e.count), section: sectionOf(e.cid), sort: cards[e.cid].name });
      }
    }
  }

  const out: string[] = [];
  let grand = 0;
  for (const [key, label] of [["pokemon", "Pokémon"], ["trainer", "Trainer"], ["energy", "Energy"]] as const) {
    const secLines = entries.filter((e) => e.section === key).sort((a, b) => a.sort.localeCompare(b.sort) || a.text.localeCompare(b.text));
    if (secLines.length === 0) continue;
    const count = secLines.reduce((a, l) => a + l.count, 0);
    grand += count;
    out.push(`${label}: ${count}`);
    secLines.forEach((l) => out.push(l.text));
    out.push("");
  }
  out.push(`Total Cards: ${grand}`);
  return out.join("\n");
}
