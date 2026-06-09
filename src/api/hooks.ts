import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiGet, apiSend } from "./client";
import type {
  BulkRow,
  Card,
  CardDetail,
  CardDTO,
  DeckModel,
  DeckSummary,
  ManualEntry,
  Order,
  ParsedLine,
  ShoppingItem,
  Slot,
  Totals,
  InventoryRow,
} from "./types";

// --- queries ---
export const useDashboard = () =>
  useQuery({ queryKey: ["dashboard"], queryFn: () => apiGet<{ totals: Totals; rows: InventoryRow[] }>("/dashboard") });

export const useShoppingList = () =>
  useQuery({ queryKey: ["shopping"], queryFn: () => apiGet<ShoppingItem[]>("/shopping-list") });

export const useCards = (excludeBasic = false) =>
  useQuery({
    queryKey: ["cards", excludeBasic],
    queryFn: () => apiGet<Card[]>(`/cards${excludeBasic ? "?exclude_basic=true" : ""}`),
  });

export const useCardDetail = (cardId: string) =>
  useQuery({ queryKey: ["card", cardId], queryFn: () => apiGet<CardDetail>(`/cards/${encodeURIComponent(cardId)}`) });

export const useCardSearch = (name: string, set: string, enabled: boolean) =>
  useQuery({
    queryKey: ["card-search", name, set],
    enabled,
    queryFn: () =>
      apiGet<{ results: CardDTO[]; error: string | null }>(
        `/cards/search?name=${encodeURIComponent(name)}&set=${encodeURIComponent(set)}`,
      ),
  });

export const useOrders = () => useQuery({ queryKey: ["orders"], queryFn: () => apiGet<Order[]>("/orders") });
export const useOrder = (n: string) =>
  useQuery({ queryKey: ["order", n], queryFn: () => apiGet<Order>(`/orders/${encodeURIComponent(n)}`) });

export const useInventory = () =>
  useQuery({ queryKey: ["inventory"], queryFn: () => apiGet<ManualEntry[]>("/inventory") });
export const useSources = () =>
  useQuery({ queryKey: ["sources"], queryFn: () => apiGet<string[]>("/inventory/sources") });

export const useDecks = () => useQuery({ queryKey: ["decks"], queryFn: () => apiGet<DeckSummary[]>("/decks") });
export const useDeckModel = (id: number) =>
  useQuery({ queryKey: ["deck", id], queryFn: () => apiGet<DeckModel>(`/decks/${id}`) });

// --- mutations ---
function useInvalidate() {
  const qc = useQueryClient();
  return (...keys: string[]) => keys.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
}

export const useAddCard = () => {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: (card_id: string) => apiSend<Card>(`/cards?card_id=${encodeURIComponent(card_id)}`, "POST"),
    onSuccess: () => inv("cards"),
  });
};

export const useCreateOrder = () => {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: (b: object) => apiSend<Order>("/orders", "POST", b),
    onSuccess: () => inv("orders", "dashboard"),
  });
};
export const useUpdateOrder = (n: string) => {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: (b: object) => apiSend<Order>(`/orders/${encodeURIComponent(n)}`, "PATCH", b),
    onSuccess: () => inv("orders", "order", "dashboard"),
  });
};
export const useDeleteOrder = () => {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: (n: string) => apiSend(`/orders/${encodeURIComponent(n)}`, "DELETE"),
    onSuccess: () => inv("orders", "dashboard"),
  });
};
export const useAddOrderItem = (n: string) => {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: (b: { card_id: string; quantity: number }) =>
      apiSend<Order>(`/orders/${encodeURIComponent(n)}/items`, "POST", b),
    onSuccess: () => inv("order", "orders", "dashboard"),
  });
};
export const useDeleteOrderItem = (n: string) => {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: (itemId: number) => apiSend(`/orders/${encodeURIComponent(n)}/items/${itemId}`, "DELETE"),
    onSuccess: () => inv("order", "orders", "dashboard"),
  });
};

export const useAddInventory = () => {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: (b: object) => apiSend<ManualEntry>("/inventory", "POST", b),
    onSuccess: () => inv("inventory", "dashboard", "cards"),
  });
};
export const useDeleteInventory = () => {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: (id: number) => apiSend(`/inventory/${id}`, "DELETE"),
    onSuccess: () => inv("inventory", "dashboard"),
  });
};
export const useBulkImport = () => {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: (text: string) =>
      apiSend<{ rows: BulkRow[]; errors: string[]; catalogued: number; inventory_added: number }>(
        "/inventory/import",
        "POST",
        { text },
      ),
    onSuccess: () => inv("inventory", "cards", "dashboard"),
  });
};

export const useCreateDeck = () => {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: (deck_name: string) => apiSend<{ deck_id: number }>("/decks", "POST", { deck_name }),
    onSuccess: () => inv("decks"),
  });
};
export const useDeleteDeck = () => {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: (id: number) => apiSend(`/decks/${id}`, "DELETE"),
    onSuccess: () => inv("decks", "dashboard"),
  });
};
export const useSaveDeck = (id: number) => {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: (slots: Slot[]) => apiSend<{ ok: boolean }>(`/decks/${id}/save`, "POST", { slots }),
    onSuccess: () => inv("deck", "decks", "dashboard"),
  });
};
export const useDeckImport = (id: number) =>
  useMutation({
    mutationFn: (text: string) => apiSend<{ lines: ParsedLine[] }>(`/decks/${id}/import`, "POST", { text }),
  });
export const useDeckImportConfirm = (id: number) => {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: (b: { selections: { card_id: string; quantity: number }[]; mode: string }) =>
      apiSend<{ imported: number; errors: string[] }>(`/decks/${id}/import/confirm`, "POST", b),
    onSuccess: () => inv("deck", "decks"),
  });
};
