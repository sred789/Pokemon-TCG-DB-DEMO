// Bulk import from a pasted spreadsheet (CSV or tab-separated) — port of app/services/bulk_import.py.
// No external validation: cards are upserted as-is and, when a quantity is given, added to
// manual inventory.

import type { BulkRow } from "../api/types";
import type { DemoDb } from "./db";
import {
  BASIC_ENERGY_SET,
  canonicalNameMap,
  resolveBasicEnergyId,
  upsert,
} from "./cards";
import { normalizeName } from "./names";

const DEFAULT_SOURCE = "Spreadsheet Import";

const ALIASES: Record<string, string> = {
  name: "name", card_name: "name", card: "name", title: "name",
  set: "set", card_set: "set", set_code: "set", expansion: "set",
  number: "number", set_number: "number", no: "number", num: "number", "#": "number",
  id: "id", card_id: "id",
  quantity: "quantity", qty: "quantity", count: "quantity", amount: "quantity",
  source: "source",
};
const POSITIONAL = ["name", "set", "number", "quantity", "source"];

function slug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "card";
}

function makeCardId(cardId: string, cardSet: string, number: string, name: string): string {
  if (cardId) return cardId;
  if (cardSet && number) return `${cardSet.toLowerCase()}-${number}`;
  return `manual-${slug(name)}`;
}

function looksLikeHeader(cells: string[]): boolean {
  return cells.some((c) => c.trim().toLowerCase() in ALIASES);
}

function dialectDelimiter(text: string): string {
  const first = text.split("\n").find((ln) => ln.trim()) ?? "";
  const tabs = (first.match(/\t/g) ?? []).length;
  const commas = (first.match(/,/g) ?? []).length;
  return tabs >= commas && first.includes("\t") ? "\t" : ",";
}

/** Quote-aware delimited parse, equivalent to Python's csv.reader for our inputs. */
function parseDelimited(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = "";
    } else if (ch === "\r") {
      // skip
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  row.push(field);
  rows.push(row);
  return rows;
}

function rowToRecord(cells: string[], header: (string | null)[] | null): Record<string, string> {
  const record: Record<string, string> = {};
  if (header) {
    header.forEach((col, i) => {
      if (col && i < cells.length) record[col] = cells[i];
    });
    return record;
  }
  POSITIONAL.forEach((field, i) => {
    if (i < cells.length) record[field] = cells[i];
  });
  return record;
}

export function parseRows(text: string): { rows: BulkRow[]; errors: string[] } {
  const rows: BulkRow[] = [];
  const errors: string[] = [];
  if (!text.trim()) return { rows, errors: ["No data provided."] };

  const delimiter = dialectDelimiter(text);
  const reader = parseDelimited(text, delimiter).filter((r) => r.some((c) => c.trim()));
  if (!reader.length) return { rows, errors: ["No data provided."] };

  let header: (string | null)[] | null = null;
  let start = 0;
  if (looksLikeHeader(reader[0])) {
    header = reader[0].map((c) => ALIASES[c.trim().toLowerCase()] ?? null);
    start = 1;
  }

  for (let i = start; i < reader.length; i++) {
    const rowNum = i + 1;
    const record = rowToRecord(reader[i], header);
    const name = (record.name ?? "").trim();
    if (!name) {
      errors.push(`Row ${rowNum}: missing card name — skipped.`);
      continue;
    }
    const qtyRaw = (record.quantity ?? "").trim();
    let quantity = 0;
    if (qtyRaw) {
      if (/^[+-]?\d+$/.test(qtyRaw)) {
        quantity = parseInt(qtyRaw, 10);
      } else {
        errors.push(`Row ${rowNum}: quantity '${qtyRaw}' is not a number — treated as 0.`);
      }
    }
    if (quantity < 0) {
      errors.push(`Row ${rowNum}: negative quantity — treated as 0.`);
      quantity = 0;
    }

    const cardSet = (record.set ?? "").trim();
    const number = (record.number ?? "").trim();
    const source = (record.source ?? "").trim() || DEFAULT_SOURCE;

    const energyId = resolveBasicEnergyId(name);
    if (energyId) {
      const etype = energyId.split("-")[1];
      const cap = etype.charAt(0).toUpperCase() + etype.slice(1);
      rows.push({
        card_id: energyId,
        card_name: `Basic ${cap} Energy`,
        card_set: BASIC_ENERGY_SET,
        set_number: "—",
        quantity,
        source,
        is_basic_energy: true,
      });
      continue;
    }

    rows.push({
      card_id: makeCardId((record.id ?? "").trim(), cardSet, number, name),
      card_name: name,
      card_set: cardSet || "—",
      set_number: number || "—",
      quantity,
      source,
      is_basic_energy: false,
    });
  }
  return { rows, errors };
}

export function importRows(db: DemoDb, rows: BulkRow[]): { catalogued: number; inventoryAdded: number } {
  let catalogued = 0;
  let inventoryAdded = 0;
  const canonical = canonicalNameMap(db);
  const today = new Date().toISOString().slice(0, 10);
  for (const r of rows) {
    const name = canonical[normalizeName(r.card_name)] ?? r.card_name;
    upsert(db, {
      card_id: r.card_id,
      card_name: name,
      card_set: r.card_set,
      set_number: r.set_number,
      supertype: r.is_basic_energy ? "Energy" : "",
      subtypes: r.is_basic_energy ? "Basic" : "",
      image_url: null,
      is_basic_energy: r.is_basic_energy,
      is_ace_spec: false,
    });
    catalogued++;
    if (r.quantity > 0 && !r.is_basic_energy) {
      db.manualInventory.push({
        induction_id: db.seq.inductionId++,
        card_id: r.card_id,
        quantity: r.quantity,
        source: r.source,
        date_added: today,
      });
      inventoryAdded++;
    }
  }
  return { catalogued, inventoryAdded };
}
