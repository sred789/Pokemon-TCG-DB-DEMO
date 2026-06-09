// Card-name normalization — port of app/services/names.py.
//
// TCGPlayer order exports strip accents ("Poke Pad") while deck lists and the API use the
// accented spelling ("Poké Pad"). We match accent-, case-, whitespace-, and qualifier-
// insensitively, while keeping the accented spelling as canonical for display.

const COMBINING_MARKS = /[̀-ͯ]/g;
// Trailing illustrator/variant qualifier, e.g. "Boss's Orders [Corbeau]" / "(Ghetsis)".
const QUALIFIER_RE = /\s*[([][^)\]]*[)\]]\s*$/;

/** Drop diacritics: "Poké Pad" -> "Poke Pad". */
export function foldAccents(name: string): string {
  return name.normalize("NFKD").replace(COMBINING_MARKS, "");
}

/** Accent-, case-, whitespace-, and qualifier-insensitive key for matching card names. */
export function normalizeName(name: string): string {
  let s = foldAccents(name).toLowerCase();
  for (;;) {
    const stripped = s.replace(QUALIFIER_RE, "");
    if (stripped === s) break;
    s = stripped;
  }
  return s.replace(/\s+/g, " ").trim();
}

export function hasAccents(name: string): boolean {
  return foldAccents(name) !== name;
}
