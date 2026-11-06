"use client";

import { useEffect, useState } from "react";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

export function InstallPrompt() {
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const handler = (event: Event) => { event.preventDefault(); setInstallEvent(event as InstallEvent); setVisible(true); };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);
  if (!visible || !installEvent) return null;
  return <aside className="fixed bottom-4 left-4 right-4 z-20 rounded-lg bg-[#1e2a4a] p-4 text-white shadow-lg">
    <p className="text-sm">Instala Chequera para leerla sin conexión.</p>
    <div className="mt-3 flex gap-3"><button type="button" className="rounded bg-white px-3 py-1 text-sm text-[#1e2a4a]" onClick={async () => { await installEvent.prompt(); setVisible(false); }}>Instalar</button><button type="button" className="text-sm" onClick={() => setVisible(false)}>Ahora no</button></div>
  </aside>;
}
