import { describe, expect, it } from "vitest";
import { buildShareText, shareUrls } from "./share";

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
  it("incluye versículo, referencia con nota de traducción y enlace al día", () => {
    const text = buildShareText(conNota, "https://ejemplo.test");
    expect(text).toContain("“El Señor es mi pastor; nada me faltará.”");
    expect(text).toContain("— Salmos 23:1 · RVR1960");
    expect(text).toContain("https://ejemplo.test/?dia=03-15");
  });

  it("omite la nota de traducción cuando la entrada no la tiene", () => {
    const text = buildShareText(sinNota, "https://ejemplo.test");
    expect(text).toContain("— Juan 3:16");
    expect(text).not.toContain("·");
  });

  it("no hardcodea el dominio de despliegue", () => {
    const text = buildShareText(conNota, "https://otro-dominio.test");
    expect(text).not.toContain("chequera-pwa.vercel.app");
    expect(text).toContain("https://otro-dominio.test/?dia=03-15");
  });
});

describe("shareUrls", () => {
  it("arma los destinos con el mensaje o la URL codificados", () => {
    const urls = shareUrls(conNota, "https://ejemplo.test");
    const dayUrl = "https://ejemplo.test/?dia=03-15";
    const text = buildShareText(conNota, "https://ejemplo.test");

    expect(urls.whatsapp).toBe(`https://wa.me/?text=${encodeURIComponent(text)}`);
    expect(urls.x).toBe(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`);
    expect(urls.facebook).toBe(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(dayUrl)}`,
    );
    expect(urls.telegram).toBe(
      `https://t.me/share?url=${encodeURIComponent(dayUrl)}&text=${encodeURIComponent(text)}`,
    );
  });

  it("Facebook recibe solo la URL, sin el texto del versículo", () => {
    const urls = shareUrls(conNota, "https://ejemplo.test");
    expect(urls.facebook).not.toContain(encodeURIComponent("Salmos"));
    expect(urls.facebook).toContain(encodeURIComponent("https://ejemplo.test/?dia=03-15"));
  });
});
