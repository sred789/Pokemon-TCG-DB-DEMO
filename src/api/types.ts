export interface Totals {
  total_owned: number;
  in_possession: number;
  incoming: number;
  available_to_allocate: number;
}

export interface InventoryRow {
  card_id: string;
  card_name: string;
  card_set: string;
  set_number: string;
  total_owned: number;
  in_possession: number;
  incoming: number;
  allocated: number;
  available_to_allocate: number;
  supertype: string;
  is_basic_energy: boolean;
  pooled: boolean;
}

export interface Card {
  card_id: string;
  card_name: string;
  card_set: string;
  set_number: string;
  supertype: string;
  subtypes: string;
  image_url: string | null;
  is_basic_energy: boolean;
  is_ace_spec: boolean;
}

export interface CardDTO {
  card_id: string;
  card_name: string;
  card_set: string;
  set_number: string;
  image_url: string | null;
  supertype?: string;
}

export interface CardDetail {
  card: Card;
  inv: InventoryRow | null;
  order_items: { order_number: string; quantity: number }[];
  deck_cards: { deck_id: number; quantity_needed: number; quantity_allocated: number }[];
}

export interface OrderItem {
  order_item_id: number;
  order_number: string;
  card_id: string;
  quantity: number;
  card: Card;
}

export interface Order {
  order_number: string;
  order_date: string;
  seller: string;
  shipping_status: string;
  delivered: boolean;
  items: OrderItem[];
}

export interface ManualEntry {
  induction_id: number;
  card_id: string;
  quantity: number;
  source: string;
  date_added: string;
  card: Card;
}

export interface DeckSummary {
  deck_id: number;
  deck_name: string;
  creation_date: string;
  total: number;
  is_legal: boolean;
  is_complete: boolean;
}

export interface ShoppingItem {
  card_id: string;
  card_name: string;
  card_set: string;
  set_number: string;
  needed: number;
  owned: number;
  to_buy: number;
}

export type CardType = "pokemon" | "trainer" | "energy" | "other";

export interface EditorCard {
  name: string;
  name_key: string;
  set: string;
  number: string;
  type: CardType;
  basic_energy: boolean;
  ace_spec: boolean;
  owned: number;
  alloc_others: number;
}

export interface Slot {
  card_id: string;
  needed: number;
  allocated: number;
}

export interface DeckModel {
  deck: { id: number; name: string };
  slots: Slot[];
  cards: Record<string, EditorCard>;
  printings: Record<string, string[]>;
}

export interface ParsedLine {
  raw: string;
  quantity: number | null;
  name: string | null;
  set_code: string | null;
  number: string | null;
  status: "unparseable" | "unmatched" | "matched" | "ambiguous";
  reason: string | null;
  candidates: CardDTO[];
}

export interface BulkRow {
  card_id: string;
  card_name: string;
  card_set: string;
  set_number: string;
  quantity: number;
  source: string;
  is_basic_energy: boolean;
}
