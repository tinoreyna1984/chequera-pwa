import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import {
  endsWithFinalPunctuation,
  extract,
  applyOverrides,
  normalizeReference,
  parseDevotionals,
  rebuildParagraphs,
  type Devotional,
  type DevotionalOverride,
  type LineGeometry,
} from "./build-devotionals";

const PDF_PATH = fileURLToPath(
  new URL("../data/raw/chequera-spurgeon.pdf", import.meta.url),
);

/** pdftotext (poppler) es requisito de la extracción; sin él la integración se omite. */
const hasPdftotext = (() => {
  try {
    execFileSync("pdftotext", ["-v"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();

/** Geometría de apoyo para pruebas unitarias de `rebuildParagraphs`. */
function ragged(xMax: number, right = 539): LineGeometry {
  return { xMax, right };
}

describe("endsWithFinalPunctuation", () => {
  it("detecta punto, signo de interrogación, exclamación, punto y coma y dos puntos", () => {
    expect(endsWithFinalPunctuation("Termina con un punto.")).toBe(true);
    expect(endsWithFinalPunctuation("¿Esto es una pregunta?")).toBe(true);
    expect(endsWithFinalPunctuation("¡Esto es una exclamación!")).toBe(true);
    expect(endsWithFinalPunctuation("Lista de cosas;")).toBe(true);
    expect(endsWithFinalPunctuation("Referencia incompleta:")).toBe(true);
  });

  it("admite comilla de cierre y paréntesis después de la puntuación", () => {
    expect(endsWithFinalPunctuation('Y él te dirá “sí.”')).toBe(true);
    expect(endsWithFinalPunctuation("como dice el texto (ver 3:15).")).toBe(true);
    expect(endsWithFinalPunctuation("Dijo: “bien hecho.”")).toBe(true);
  });

  it("rechaza líneas que terminan en letra o en medio de la frase", () => {
    expect(endsWithFinalPunctuation("Esta línea no termina con puntuación")).toBe(
      false,
    );
    expect(endsWithFinalPunctuation("Termina con una coma,")).toBe(false);
    expect(endsWithFinalPunctuation("Termina con comilla “")).toBe(false);
  });
});

describe("rebuildParagraphs", () => {
  it("corta cuando la línea termina en puntuación y no llegó al margen", () => {
    const lines = [
      "Primera línea del párrafo que termina en punto.",
      "Segunda línea que inicia otro párrafo.",
    ];
    const geometry = [ragged(300), ragged(539)];
    expect(rebuildParagraphs(lines, 89, geometry)).toEqual([
      "Primera línea del párrafo que termina en punto.",
      "Segunda línea que inicia otro párrafo.",
    ]);
  });

  it("no corta si la línea llegó al margen aunque termine en puntuación", () => {
    const lines = [
      "Línea justificada que llega al margen derecho.",
      "Continuación del mismo párrafo.",
    ];
    // xMax a 0.5pt del margen: dentro de la tolerancia de 3pt.
    const geometry = [ragged(538.5), ragged(539)];
    expect(rebuildParagraphs(lines, 89, geometry)).toEqual([
      "Línea justificada que llega al margen derecho. Continuación del mismo párrafo.",
    ]);
  });

  it("no corta si la línea no termina en puntuación aunque esté irregular", () => {
    const lines = [
      "Línea irregular pero sin puntuación final",
      "que continúa en el mismo párrafo.",
    ];
    const geometry = [ragged(300), ragged(539)];
    expect(rebuildParagraphs(lines, 89, geometry)).toEqual([
      "Línea irregular pero sin puntuación final que continúa en el mismo párrafo.",
    ]);
  });

  it("ignora las líneas en blanco (artefactos de página)", () => {
    const lines = [
      "Primera línea con punto final.",
      "",
      "   ",
      "Segunda línea del siguiente párrafo.",
    ];
    const geometry = [ragged(300), null, null, ragged(539)];
    expect(rebuildParagraphs(lines, 89, geometry)).toEqual([
      "Primera línea con punto final.",
      "Segunda línea del siguiente párrafo.",
    ]);
  });

  it("descarta los residuos de puntuación suelta (p. ej. un punto solo)", () => {
    const lines = ["Texto con letras y punto final.", "."];
    const geometry = [ragged(300), ragged(103)];
    expect(rebuildParagraphs(lines, 89, geometry)).toEqual([
      "Texto con letras y punto final.",
    ]);
  });

  it("une líneas separadas por espacios múltiples en un solo párrafo", () => {
    const lines = ["Primera  línea   justificada.", "Segunda línea."];
    const geometry = [ragged(539), ragged(539)];
    expect(rebuildParagraphs(lines, 89, geometry)).toEqual([
      "Primera línea justificada. Segunda línea.",
    ]);
  });

  it("usa el conteo de caracteres cuando falta la geometría de una línea", () => {
    // Sin geometría: corta si la primera palabra de la siguiente cabe en el ancho.
    const shortLine = "Corta y con punto."; // 18 + 1 + 8 <= 89
    const longLine =
      "Una línea muy larga casi al ancho de la columna que termina en punto."; // 69 + 1 + 12 <= 89
    expect(rebuildParagraphs([shortLine, "Siguiente."], 89)).toEqual([
      shortLine,
      "Siguiente.",
    ]);
    expect(rebuildParagraphs([longLine, "Siguiente palabra."], 89)).toEqual([
      longLine,
      "Siguiente palabra.",
    ]);
  });

  it("cae al conteo de caracteres cuando la geometría de la línea es null", () => {
    const lines = ["Corta y con punto.", "Siguiente."];
    const geometry: (LineGeometry | null)[] = [null, ragged(539)];
    expect(rebuildParagraphs(lines, 89, geometry)).toEqual([
      "Corta y con punto.",
      "Siguiente.",
    ]);
  });
});

describe("normalizeReference", () => {
  it("quita el espacio alrededor de los dos puntos y el punto final", () => {
    expect(normalizeReference("Génesis 3: 15.")).toBe("Génesis 3:15");
    expect(normalizeReference("Santiago 4: 6.")).toBe("Santiago 4:6");
  });

  it("corrige la referencia con el libro antes de los dos puntos", () => {
    expect(normalizeReference("1 Samuel: 17: 37")).toBe("1 Samuel 17:37");
    expect(normalizeReference("2 Reyes: 4: 33")).toBe("2 Reyes 4:33");
  });

  it("conserva las referencias ya normalizadas e incompletas", () => {
    expect(normalizeReference("Isaías 44:21")).toBe("Isaías 44:21");
    expect(normalizeReference("Salmo 37:")).toBe("Salmo 37:");
  });
});

describe("applyOverrides", () => {
  const base: Devotional = {
    id: "01-01",
    month: 1,
    day: 1,
    verse: "Verso",
    reference: "Génesis 1:1",
    content: ["Contenido"],
    pdfPage: 1,
  };

  it("aplica un override parcial conservando el id", () => {
    expect(applyOverrides([base], { "01-01": { reference: "Génesis 1:2" } })).toEqual([
      { ...base, reference: "Génesis 1:2" },
    ]);
  });

  it("falla cuando el override menciona un id desconocido", () => {
    expect(() => applyOverrides([base], { "99-99": { reference: "No existe" } })).toThrow(
      "Overrides con id desconocido: 99-99",
    );
  });
});

describe.skipIf(!hasPdftotext)("extracción integral del PDF", () => {
  let entries: Devotional[];

  beforeAll(() => {
    const { text, geometry } = extract(PDF_PATH);
    const parsed = parseDevotionals(text, geometry);
    // Los overrides se leen del mismo archivo que usa `npm run data:build`
    // para que la comparación con el JSON versionado sea exacta.
    const overrides = JSON.parse(
      readFileSync(
        fileURLToPath(new URL("../data/overrides.json", import.meta.url)),
        "utf8",
      ),
    ) as Record<string, DevotionalOverride>;
    entries = applyOverrides(parsed.entries, overrides);
  }, 60_000);

  function entry(id: string): Devotional {
    const found = entries.find((candidate) => candidate.id === id);
    expect(found, `entrada ${id} no encontrada`).toBeDefined();
    return found!;
  }

  it("reconstruye los párrafos de los casos de referencia", () => {
    // 1 párrafo: cuerpo de una sola línea justificada sin cortes internos.
    expect(entry("01-01").content).toHaveLength(1);
    expect(entry("01-01").reference).toBe("Génesis 3:15");

    // 2 párrafos: corte tras "gracia." (línea irregular con puntuación).
    expect(entry("03-22").content).toHaveLength(2);
    expect(entry("03-22").reference).toBe("Santiago 4:6");

    // 2 párrafos + nota de versión entre paréntesis en la cabecera.
    expect(entry("04-05").content).toHaveLength(2);
    expect(entry("04-05").reference).toBe("Isaías 44:21");
    expect(entry("04-05").translationNote).toBe("La Biblia de las Américas");

    // 3 párrafos.
    expect(entry("08-18").content).toHaveLength(3);
    expect(entry("08-18").reference).toBe("1 Crónicas 28:9");

    // 2 párrafos: el verso va numerado en su propia línea.
    expect(entry("09-08").content).toHaveLength(2);
    expect(entry("09-08").reference).toBe("Isaías 42:3");

    // 2 párrafos: la referencia llega incompleta al PDF ("Salmo 37:");
    // la corrección a "Salmo 37:4" la aplica el override de la tarea 2.3.
    expect(entry("11-06").reference).toBe("Salmo 37:4");
    expect(entry("11-06").content).toHaveLength(2);

    // 5 párrafos + nota de versión; la nota "(Biblia de Jerusalén)" no es
    // párrafo del cuerpo.
    expect(entry("12-24").content).toHaveLength(5);
    expect(entry("12-24").reference).toBe("Deuteronomio 33:29");
    expect(entry("12-24").translationNote).toBe("Biblia de Jerusalén");
  }, 60_000);

  it("todas las entradas tienen verse, reference y al menos un párrafo", () => {
    expect(entries).toHaveLength(366);
    for (const candidate of entries) {
      expect(candidate.verse.length, candidate.id).toBeGreaterThan(0);
      expect(candidate.reference.length, candidate.id).toBeGreaterThan(0);
      expect(candidate.content.length, candidate.id).toBeGreaterThanOrEqual(1);
      for (const paragraph of candidate.content) {
        expect(paragraph.trim(), `${candidate.id}`).not.toBe("");
        expect(/\p{L}/u.test(paragraph), `${candidate.id}: ${paragraph}`).toBe(
          true,
        );
      }
    }
  }, 60_000);

  it("el archivo versionado coincide con la extracción actual", () => {
    // Defensa de regresión: si el PDF o el parser cambian, este test obliga a
    // regenerar public/data/devotionals.json (tarea 2.5).
    const raw = readFileSync(
      fileURLToPath(new URL("../public/data/devotionals.json", import.meta.url)),
      "utf8",
    );
    const saved = JSON.parse(raw) as { devotionals: Devotional[] };
    expect(saved.devotionals).toEqual(JSON.parse(JSON.stringify(entries)));
  });
});
