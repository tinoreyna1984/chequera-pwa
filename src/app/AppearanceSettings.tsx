"use client";

import { useEffect, useState } from "react";

type Theme = "system" | "light" | "dark";
const sizes = ["small", "medium", "large", "xlarge"] as const;

export function AppearanceSettings() {
  const [theme, setTheme] = useState<Theme>("system");
  const [size, setSize] = useState<(typeof sizes)[number]>("medium");

  useEffect(() => {
    queueMicrotask(() => {
      try {
        const saved = JSON.parse(localStorage.getItem("chequera-appearance") ?? "{}") as { theme?: Theme; size?: typeof size };
        if (saved.theme) setTheme(saved.theme);
        if (saved.size) setSize(saved.size);
      } catch { /* preferencia corrupta: usar valores por defecto */ }
    });
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.readerSize = size;
    localStorage.setItem("chequera-appearance", JSON.stringify({ theme, size }));
  }, [theme, size]);

  return <details className="mt-6 rounded border border-stone-200 bg-white p-4 text-sm">
    <summary className="cursor-pointer font-semibold text-amber-800">Apariencia de lectura</summary>
    <div className="mt-4 flex flex-wrap gap-4">
      <label> Tema <select value={theme} onChange={(e) => setTheme(e.target.value as Theme)} className="ml-2 rounded border px-2 py-1"><option value="system">Sistema</option><option value="light">Claro</option><option value="dark">Oscuro</option></select></label>
      <label> Texto <select value={size} onChange={(e) => setSize(e.target.value as typeof size)} className="ml-2 rounded border px-2 py-1">{sizes.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
    </div>
  </details>;
}
