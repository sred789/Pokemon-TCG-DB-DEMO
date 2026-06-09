# Pokémon TCG Collection Database — Demo

A front-end demo of a Pokémon TCG collection tracker: record online orders and booster-pack
pulls, build decks from pasted deck lists, and see live inventory counts and a shopping list of
what you still need.

This is a **fully static, front-end-only** build — **no backend and no external API**. It runs
entirely in the browser: sample data and card art are bundled in, and a visitor's edits (card
counts, decks, orders, inventory) are saved in their browser via `localStorage` and never leave
their device. A **Reset demo** button restores the original sample data at any time.

Built with **React + TypeScript + Vite + Tailwind**.

## Run it

```bash
npm install        # first time only
npm run dev        # dev server at http://localhost:5173
```

Build and preview the production static site:

```bash
npm run build      # outputs a static site to dist/
npm run preview    # serve the built site locally
```

`dist/` is self-contained and can be deployed to any static host (GitHub Pages, Netlify, Vercel,
S3, …). For host-side routing, serve `index.html` as the fallback for unknown paths so deep links
like `/decks/8` resolve (React Router handles routing on the client).

## What it shows

- **Live inventory math** (recomputed in the browser, never hardcoded):
  - **Total Owned** = manual inventory + all order items.
  - **Incoming** = order items on undelivered orders (in transit).
  - **In Possession** = manual inventory + delivered order items (physically in hand).
  - **Available to Allocate** = owned − allocated to decks.
- **Orders** with a **Delivered** toggle that shifts cards from Incoming to In Possession.
- **Manual inventory** for booster pulls, trades, and local-store buys.
- **Decks** with two quantities per card: a **needed** target (wishlist, may exceed what you own)
  and an **allocated** count (physical copies assigned, capped at possession by an
  over-allocation guard).
- **Deck-construction rules** shown as a legality panel: max **60 cards**; max **4 copies by name**
  (different art versions share one limit); max **1 ACE SPEC**; **special energy** counts as a
  normal card; **basic energy** is unlimited (exempt from the 4-of limit, never tracked in
  inventory) but still counts toward 60.
- **Deck-list import**: paste a Pokémon TCG Live/Online export or simple `qty name` lines; cards
  resolve against the bundled catalog and matches preview before saving.
- **Shopping list**: cards your decks need across the board, beyond what you own — with
  name-pooling so different printings of the same Trainer/Energy share availability.

## How it works

The app was originally a full-stack project (FastAPI + PostgreSQL). For this demo the backend is
replaced in the browser:

- **Data** — the collection was exported from the database to JSON in
  [`src/demo/data/`](src/demo/data), and all card art was downloaded to
  [`public/cards/`](public/cards). (The database and export tooling have been removed; the bundled
  data is the single source of truth for the demo.)
- **In-browser backend** — every request the UI makes is served by a small router
  ([`src/demo/router.ts`](src/demo/router.ts)) over a `localStorage`-backed store
  ([`src/demo/db.ts`](src/demo/db.ts)). The inventory/pooling, deck-legality, save guard, and
  shopping-list shortfall logic are ported to TypeScript in [`src/demo/`](src/demo). The page and
  data-hook layers (`src/pages/`, `src/api/`) are unchanged — they call the same interface, now
  answered locally instead of over the network.

## Project layout

```
index.html
src/
  api/             # client + TanStack Query hooks (now backed by the in-browser router)
  pages/           # route pages (Dashboard, Cards, Orders, Inventory, Decks, ...)
  components/      # Layout, ThemeToggle, Toast, shared UI
  lib/             # deck math / export helpers
  demo/            # the in-browser backend: store, router, ported logic, and bundled data
    data/          # exported collection JSON + catalog
public/
  cards/           # bundled card images (referenced as /cards/<id>.png)
```

## Tests

```bash
npm run typecheck    # TypeScript check
npm test             # unit tests: deck legality + demo router smoke tests
npm run build        # type-check + production build
```
