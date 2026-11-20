"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { originServerSnapshot, originSnapshot, subscribeOrigin } from "@/adapters/origin";
import { buildShareText, devotionalDayUrl, shareUrls, type ShareableDevotional } from "@/core/share";

const NOTICE_DURATION_MS = 2500;

type Destination = { key: keyof ReturnType<typeof shareUrls> | "instagram" | "copy"; label: string };

const DESTINATIONS: Destination[] = [
  { key: "whatsapp", label: "WhatsApp" },
  { key: "facebook", label: "Facebook" },
  { key: "x", label: "X" },
  { key: "telegram", label: "Telegram" },
  { key: "instagram", label: "Instagram" },
  { key: "copy", label: "Copiar" },
];

const subscribeNoop = () => () => {};
const nativeShareSnapshot = () => typeof navigator !== "undefined" && typeof navigator.share === "function";

export function ShareDevotional({ entry }: { entry: ShareableDevotional }) {
  // Detección en cliente sin setState en effect: el prerender del servidor
  // (snapshot de servidor: false) coincide con la primera hidratación.
  const nativeShare = useSyncExternalStore(subscribeNoop, nativeShareSnapshot, () => false);
  // Origen como snapshot: prerender con "" y actualización a origen real
  // tras la hidratación, sin mismatch en los href de la fila.
  const origin = useSyncExternalStore(subscribeOrigin, originSnapshot, originServerSnapshot);
  const [rowOpen, setRowOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
  }, []);

  function showNotice(message: string) {
    setNotice(message);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(""), NOTICE_DURATION_MS);
  }

  const text = buildShareText(entry, origin);
  const url = devotionalDayUrl(entry, origin);
  const urls = shareUrls(entry, origin);

  async function openNativeSheet() {
    try {
      await navigator.share({ title: "Chequera del Banco de la Fe", text, url });
    } catch (error) {
      // el usuario canceló la hoja: no es un error
      if (error instanceof DOMException && error.name === "AbortError") return;
      showNotice("No se pudo abrir el menú de compartir.");
    }
  }

  async function copyToClipboard(message = "Copiado ✓") {
    try {
      if (!navigator.clipboard) throw new Error("portapapeles no disponible");
      await navigator.clipboard.writeText(text);
      showNotice(message);
      return true;
    } catch {
      showNotice("No se pudo copiar.");
      return false;
    }
  }

  async function openInstagram() {
    if (!(await copyToClipboard("Copiado ✓ Pega el versículo en Instagram."))) return;
    window.open("https://www.instagram.com/", "_blank", "noopener,noreferrer");
  }

  function handleRowToggle() {
    setRowOpen((open) => !open);
    setNotice("");
  }

  return (
    <div className="mt-6">
      <button
        type="button"
        onClick={() => (nativeShare ? void openNativeSheet() : handleRowToggle())}
        aria-expanded={nativeShare ? undefined : rowOpen}
        aria-controls={nativeShare ? undefined : "share-destinations"}
        className="rounded border border-accent-solid px-4 py-2 text-sm font-semibold text-accent"
      >
        Compartir versículo
      </button>

      {!nativeShare && rowOpen && (
        <div id="share-destinations" className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Destinos para compartir">
          {DESTINATIONS.map((destination) => {
            if (destination.key === "copy") {
              return (
                <button
                  key={destination.key}
                  type="button"
                  onClick={() => void copyToClipboard()}
                  className="rounded border border-line-strong bg-raised px-3 py-1.5 text-sm hover:border-accent-solid"
                >
                  {destination.label}
                </button>
              );
            }
            if (destination.key === "instagram") {
              return (
                <button
                  key={destination.key}
                  type="button"
                  onClick={() => void openInstagram()}
                  className="rounded border border-line-strong bg-raised px-3 py-1.5 text-sm hover:border-accent-solid"
                >
                  {destination.label}
                </button>
              );
            }
            return (
              <a
                key={destination.key}
                href={urls[destination.key]}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded border border-line-strong bg-raised px-3 py-1.5 text-sm hover:border-accent-solid"
              >
                {destination.label}
              </a>
            );
          })}
        </div>
      )}

      {notice && (
        <p className="mt-2 text-sm text-accent" role="status">
          {notice}
        </p>
      )}
    </div>
  );
}
