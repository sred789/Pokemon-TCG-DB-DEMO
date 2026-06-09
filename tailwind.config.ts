import type { Config } from "tailwindcss";

// Colors resolve to CSS variables (space-separated RGB channels) so themes can be swapped at
// runtime by toggling a class on <html>, while Tailwind opacity modifiers (bg-bg/80) still work.
const v = (name: string) => `rgb(var(${name}) / <alpha-value>)`;

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: v("--bg"),
        glow: v("--glow"),
        sunken: v("--sunken"),
        panel: v("--panel"),
        panel2: v("--panel2"),
        edge: v("--edge"),
        hover: v("--hover"),
        muted: v("--muted"),
        ink: v("--ink"),
        accent: v("--accent"),
        accentInk: v("--accent-ink"),
        brand: v("--brand"),
        danger: v("--danger"),
        ok: v("--ok"),
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(0,0,0,.3), 0 6px 20px rgba(0,0,0,.22)",
      },
    },
  },
  plugins: [],
} satisfies Config;
