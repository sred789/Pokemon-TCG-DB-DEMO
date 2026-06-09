import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  // Fully static demo — no backend, so no dev proxy. All data is served in-browser (see src/demo/).
  server: { port: 5173 },
  build: { outDir: "dist", emptyOutDir: true },
});
