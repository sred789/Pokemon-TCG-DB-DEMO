import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";

import Layout from "./components/Layout";
import { ToastProvider } from "./components/Toast";
import "./index.css";
import Cards from "./pages/Cards";
import CardDetail from "./pages/CardDetail";
import CardSearch from "./pages/CardSearch";
import Dashboard from "./pages/Dashboard";
import DeckEditor from "./pages/DeckEditor";
import DeckImport from "./pages/DeckImport";
import Decks from "./pages/Decks";
import Inventory from "./pages/Inventory";
import InventoryImport from "./pages/InventoryImport";
import InventoryNew from "./pages/InventoryNew";
import NotFound from "./pages/NotFound";
import OrderDetail from "./pages/OrderDetail";
import OrderNew from "./pages/OrderNew";
import Orders from "./pages/Orders";
import ShoppingList from "./pages/ShoppingList";

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: "/", element: <Dashboard /> },
      { path: "/cards", element: <Cards /> },
      { path: "/cards/search", element: <CardSearch /> },
      { path: "/cards/:cardId", element: <CardDetail /> },
      { path: "/orders", element: <Orders /> },
      { path: "/orders/new", element: <OrderNew /> },
      { path: "/orders/:orderNumber", element: <OrderDetail /> },
      { path: "/inventory", element: <Inventory /> },
      { path: "/inventory/new", element: <InventoryNew /> },
      { path: "/inventory/import", element: <InventoryImport /> },
      { path: "/decks", element: <Decks /> },
      { path: "/decks/:deckId", element: <DeckEditor /> },
      { path: "/decks/:deckId/import", element: <DeckImport /> },
      { path: "/shopping", element: <ShoppingList /> },
      { path: "*", element: <NotFound /> },
    ],
  },
]);

const qc = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } });

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={qc}>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
