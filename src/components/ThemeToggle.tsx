import { useState } from "react";

type Theme = "dark" | "light" | "pink";

const ORDER: Theme[] = ["dark", "light", "pink"];
const META: Record<Theme, { label: string; cls: string }> = {
  dark: { label: "🌙 Dark", cls: "" },
  light: { label: "☀️ Light", cls: "theme-light" },
  pink: { label: "🌸 Pink", cls: "theme-pink" },
};

function currentTheme(): Theme {
  if (typeof document === "undefined") return "dark";
  const el = document.documentElement;
  if (el.classList.contains("theme-pink")) return "pink";
  if (el.classList.contains("theme-light")) return "light";
  return "dark";
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(currentTheme);

  const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length];
  const cycle = () => {
    const el = document.documentElement;
    el.classList.remove("theme-light", "theme-pink");
    if (META[next].cls) el.classList.add(META[next].cls);
    setTheme(next);
    try {
      localStorage.setItem("theme", next);
    } catch {
      /* ignore */
    }
  };

  return (
    <button
      className="btn-secondary btn-sm"
      onClick={cycle}
      title={`Theme: ${META[theme].label} — click for ${META[next].label}`}
      aria-label="Switch theme"
    >
      {META[theme].label}
    </button>
  );
}
