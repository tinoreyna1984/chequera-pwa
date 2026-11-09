"use client";

import { useEffect, useState } from "react";

type Theme = "system" | "light" | "dark";
const sizes = ["small", "medium", "large", "xlarge"] as const;

export function AppearanceSettings() {
  const [theme, setTheme] = useState<Theme>("system");
  const [size, setSize] = useState<(typeof sizes)[number]>("medium");
  const [loaded, setLoaded] = useState(false);

  // Lectura inicial: siempre ANTES de la primera escritura para no
  // sobrescribir la preferencia guardada con los valores por defecto.
  useEffect(() => {
    queueMicrotask(() => {
      try {
        const saved = JSON.parse(localStorage.getItem("chequera-appearance") ?? "{}") as { theme?: Theme; size?: typeof size };
        if (saved.theme) setTheme(saved.theme);
        if (saved.size) setSize(saved.size);
      } catch { /* preferencia corrupta: usar valores por defecto */ }
      setLoaded(true);
    });
  }, []);

  // Escritura protegida hasta que la lectura inicial terminó.
  useEffect(() => {
    if (!loaded) return;
    const dark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", dark);
    document.documentElement.dataset.readerSize = size;
    localStorage.setItem("chequera-appearance", JSON.stringify({ theme, size }));
  }, [theme, size, loaded]);

  return <details className="mt-6 rounded border border-line bg-raised p-4 text-sm">
    <summary className="cursor-pointer font-semibold text-accent">Apariencia de lectura</summary>
    <div className="mt-4 flex flex-wrap gap-4">
      <label> Tema <select value={theme} onChange={(e) => setTheme(e.target.value as Theme)} className="ml-2 rounded border px-2 py-1"><option value="system">Sistema</option><option value="light">Claro</option><option value="dark">Oscuro</option></select></label>
      <label> Texto <select value={size} onChange={(e) => setSize(e.target.value as (typeof sizes)[number])} className="ml-2 rounded border px-2 py-1">{sizes.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
    </div>
  </details>;
}
