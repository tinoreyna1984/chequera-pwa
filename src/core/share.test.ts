import { describe, expect, it } from "vitest";
import { buildShareMessage, buildShareText, shareUrls } from "./share";

const conNota = {
  id: "03-15",
  verse: "El Señor es mi pastor; nada me faltará.",
  reference: "Salmos 23:1",
  translationNote: "RVR1960",
};

const sinNota = {
  id: "12-25",
  verse: "Porque tanto amó Dios al mundo.",
  reference: "Juan 3:16",
};

describe("buildShareText", () => {
  it("incluye versículo y referencia con nota de traducción sin enlace", () => {
    const text = buildShareText(conNota, "https://ejemplo.test");
    expect(text).toContain("“El Señor es mi pastor; nada me faltará.”");
    expect(text).toContain("— Salmos 23:1 · RVR1960");
    expect(text).not.toContain("https://ejemplo.test/?dia=03-15");
  });

  it("omite la nota de traducción cuando la entrada no la tiene", () => {
    const text = buildShareText(sinNota, "https://ejemplo.test");
    expect(text).toContain("— Juan 3:16");
    expect(text).not.toContain("·");
  });
});

describe("buildShareMessage", () => {
  it("agrega el enlace una sola vez al texto completo", () => {
    const message = buildShareMessage(conNota, "https://ejemplo.test");
    expect(message.match(/https:\/\/ejemplo\.test\/\?dia=03-15/g)).toHaveLength(1);
  });
});

describe("shareUrls", () => {
  it("arma los destinos con el contenido en el canal apropiado", () => {
    const urls = shareUrls(conNota, "https://ejemplo.test");
    const dayUrl = "https://ejemplo.test/?dia=03-15";
    const baseText = buildShareText(conNota, "https://ejemplo.test");
    const message = buildShareMessage(conNota, "https://ejemplo.test");

    expect(urls.whatsapp).toBe(`https://wa.me/?text=${encodeURIComponent(message)}`);
    expect(urls.x).toBe(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(baseText)}&url=${encodeURIComponent(dayUrl)}`,
    );
    expect(urls.facebook).toBe(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(dayUrl)}`,
    );
    expect(urls.telegram).toBe(
      `https://t.me/share?url=${encodeURIComponent(dayUrl)}&text=${encodeURIComponent(baseText)}`,
    );
  });

  it("no duplica el enlace en los destinos con URL separada", () => {
    const urls = shareUrls(conNota, "https://ejemplo.test");
    const dayUrl = "https://ejemplo.test/?dia=03-15";
    expect(decodeURIComponent(urls.x).split(dayUrl)).toHaveLength(2);
    expect(decodeURIComponent(urls.telegram).split(dayUrl)).toHaveLength(2);
  });

  it("Facebook recibe solo la URL, sin el texto del versículo", () => {
    const urls = shareUrls(conNota, "https://ejemplo.test");
    expect(urls.facebook).not.toContain(encodeURIComponent("Salmos"));
    expect(urls.facebook).toContain(encodeURIComponent("https://ejemplo.test/?dia=03-15"));
  });
});
