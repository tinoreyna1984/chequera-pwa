export interface ShareableDevotional {
  id: string;
  verse: string;
  reference: string;
  translationNote?: string;
}

/**
 * El origen de la URL llega como parámetro desde la capa que sí puede
 * tocar el navegador (ver src/adapters/origin.ts): el núcleo permanece puro.
 */
export function devotionalDayUrl(entry: ShareableDevotional, origin: string): string {
  return `${origin}/?dia=${entry.id}`;
}

/** Mensaje canónico: versículo, referencia (+ nota) y enlace al día. */
export function buildShareText(entry: ShareableDevotional, origin: string): string {
  const reference = entry.translationNote ? `${entry.reference} · ${entry.translationNote}` : entry.reference;
  return `“${entry.verse}”\n— ${reference}\n\n${devotionalDayUrl(entry, origin)}`;
}

export interface ShareUrls {
  whatsapp: string;
  facebook: string;
  x: string;
  telegram: string;
}

/**
 * URLs de intención por destino. Facebook solo acepta la URL (ignora el
 * texto): la vista previa depende de los metadatos Open Graph.
 */
export function shareUrls(entry: ShareableDevotional, origin: string): ShareUrls {
  const text = buildShareText(entry, origin);
  const url = devotionalDayUrl(entry, origin);
  return {
    whatsapp: `https://wa.me/?text=${encodeURIComponent(text)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
    x: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`,
    telegram: `https://t.me/share?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
  };
}
