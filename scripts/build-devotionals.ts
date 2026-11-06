/**
 * Genera `public/data/devotionals.json` a partir del PDF original.
 *
 * Uso: npm run data:build
 *
 * Requiere `pdftotext` (poppler-utils) instalado. El JSON resultante se
 * versiona, así que el build de Vercel no necesita poppler.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export interface Devotional {
  id: string;
  month: number;
  day: number;
  verse: string;
  reference: string;
  translationNote?: string;
  content: string[];
  pdfPage: number;
}

export type DevotionalOverride = Partial<Omit<Devotional, "id">>;

export interface ParseIssue {
  id: string;
  message: string;
}

export function validateEntries(entries: Devotional[]): ParseIssue[] {
  const issues: ParseIssue[] = [];
  const ids = new Set<string>();
  if (entries.length !== 366) issues.push({ id: "*", message: `Se esperaban 366 entradas; se obtuvieron ${entries.length}` });
  for (const entry of entries) {
    const id = entry.id || "*";
    if (ids.has(id)) issues.push({ id, message: "id duplicado" });
    ids.add(id);
    if (!/^\d{2}-\d{2}$/.test(entry.id) || !isValidDate(entry.month, entry.day)) issues.push({ id, message: "fecha inválida" });
    if (!entry.verse.trim()) issues.push({ id, message: "verse vacío" });
    if (!entry.reference.trim()) issues.push({ id, message: "reference vacío" });
    if (entry.content.length < 1 || entry.content.some((paragraph) => !paragraph.trim())) issues.push({ id, message: "content sin párrafos válidos" });
    if (/CHEQUERA DEL BANCO DE LA FE|Allan Román/.test(`${entry.verse} ${entry.reference} ${entry.content.join(" ")}`)) issues.push({ id, message: "contiene encabezado o colofón" });
  }
  if (!ids.has("02-29")) issues.push({ id: "02-29", message: "falta el día bisiesto" });
  return issues;
}

const MONTHS: Record<string, number> = {
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
};

const MONTH_NAMES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

const PAGE_HEADER_RE = /CHEQUERA DEL BANCO DE LA FE/;
const HEADING_RE = /^\s*(\d{1,2})\s+de\s+([A-Za-zÀ-ÿ]+)\.?\s*(.*)$/;
const PAGE_NUMBER_RE = /^\s*\d{1,3}\s*$/;
const DOXOLOGY_RE = /^\s*GLORIA SEA DADA A [ÉE]L/;
const PAGE_COLOPHON_RE = /La Chequera del Banco de la Fe\. Traducción de Allan Román/;
const REFERENCE_RE =
  /(^|[\s”"'’‘])((?:[1-3]\s+)?[A-ZÁÉÍÓÚÀ-ÜÑ][A-Za-zÀ-ÿáéíóúüñ]+)\s*:?\s*(\d+)\s*:/;
const QUOTE_CHARS = "“”\"'‘’";

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function isValidDate(month: number, day: number): boolean {
  if (!Number.isInteger(month) || month < 1 || month > 12) return false;
  if (!Number.isInteger(day) || day < 1) return false;
  return day <= daysInMonth(2024, month); // 2024 es bisiesto: admite 02-29
}

export function devotionalId(month: number, day: number): string {
  return `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function rankOf(month: number, day: number): number {
  return month * 100 + day;
}

function findReference(text: string): { index: number; length: number } | null {
  let last: { index: number; length: number } | null = null;
  const re = new RegExp(REFERENCE_RE.source, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const lead = m[1] ?? "";
    last = { index: m.index + lead.length, length: m[0].length - lead.length };
  }
  return last;
}

function referencePrefixEnd(text: string, start: number): number {
  const m = /^((?:[1-3]\s+)?[A-ZÁÉÍÓÚÀ-ÜÑ][A-Za-zÀ-ÿáéíóúüñ]+)\s*:?\s*(\d+)\s*:/.exec(
    text.slice(start),
  );
  return m ? m[0].length : 0;
}

export function hasReference(text: string): boolean {
  return findReference(text) !== null;
}

export function isReferenceComplete(text: string): boolean {
  const found = findReference(text);
  if (!found) return false;
  const start = found.index + referencePrefixEnd(text, found.index);
  return /^\s*\d+/.test(text.slice(start));
}

function hasUnbalancedOpenParen(text: string): boolean {
  const opens = (text.match(/\(/g) ?? []).length;
  const closes = (text.match(/\)/g) ?? []).length;
  return opens > closes;
}

function looksLikeRefContinuation(line: string): boolean {
  return line.length < 45;
}

function stripOuterQuotes(text: string): string {
  let out = text.trim();
  while (out.length > 0 && QUOTE_CHARS.includes(out[0])) out = out.slice(1);
  while (out.length > 0 && QUOTE_CHARS.includes(out[out.length - 1])) {
    out = out.slice(0, -1);
  }
  return out.trim();
}

export function normalizeReference(raw: string): string {
  return raw
    .replace(/\s+/g, " ")
    .replace(
      /^((?:[1-3]\s+)?[A-Za-zÀ-ÿáéíóúüñ]+)\s*:\s*(\d+)\s*:/,
      "$1 $2:",
    )
    .replace(/\s*[:：]\s*/g, ":")
    .replace(/\s*\.\s*$/, "")
    .replace(/\s+\.$/, "")
    .trim();
}

interface RawEntry {
  month: number;
  day: number;
  pdfPage: number;
  phase: "header" | "body" | "done";
  headerLines: string[];
  bodyLines: string[];
  /** Geometría visual de cada línea de `bodyLines` (null si no se pudo medir). */
  bodyGeom: (LineGeometry | null)[];
}

export function splitHeader(headerLines: string[]): {
  verse: string;
  reference: string;
  translationNote?: string;
  bodyTail: string[];
} {
  const joined = headerLines.join(" ").replace(/\s+/g, " ").trim();
  const found = findReference(joined);
  if (!found) {
    return { verse: stripOuterQuotes(joined), reference: "", bodyTail: [] };
  }
  const before = joined.slice(0, found.index).trim();
  let rest = joined.slice(found.index).trim();

  let translationNote: string | undefined;
  const note = /\(([^()]*)\)\s*$/.exec(rest);
  if (note) {
    translationNote = note[1].replace(/\s+/g, " ").trim();
    rest = rest.slice(0, note.index).trim();
  }

  return {
    verse: stripOuterQuotes(before),
    reference: normalizeReference(rest),
    translationNote,
    bodyTail: [],
  };
}

/** Limpia una página: quita encabezado, colofón y número de pie. */
function cleanPageLines(pageText: string): string[] {
  const lines = pageText
    .split("\n")
    .filter((line) => !PAGE_HEADER_RE.test(line))
    .filter((line) => !PAGE_COLOPHON_RE.test(line))
    .map((line) => line.replace(/\s+$/, ""));

  // El número de página del pie: última línea no vacía de la página.
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].trim() !== "") {
      if (PAGE_NUMBER_RE.test(lines[i])) lines[i] = "";
      break;
    }
  }
  return lines;
}

const FINAL_PUNCTUATION_RE = /[.!?;:][”"'’‘)\]]?\s*$/;

/**
 * ¿La línea termina en puntuación final?
 * Se usa como primera condición para cortar un párrafo.
 */
export function endsWithFinalPunctuation(line: string): boolean {
  return FINAL_PUNCTUATION_RE.test(line);
}

/**
 * Tolerancia en puntos para considerar que una línea llegó al margen derecho.
 * Las líneas de continuidad justificadas terminan a menos de 1pt del margen
 * (medido: 5732 de ellas); los finales de párrafo se quedan a 3pt o más.
 */
const MARGIN_TOLERANCE = 3;

/**
 * ¿La línea `previous` cierra un párrafo?
 *
 * En el PDF justificado toda línea de continuidad se estira hasta el margen
 * derecho; solo la última línea de un párrafo queda corta (irregular). Por
 * eso, con geometría basta con medir si la línea llegó al margen — es la
 * medición directa de "la primera palabra de la siguiente no cabía", que con
 * caracteres solo se puede aproximar.
 *
 * Sin geometría (líneas que no se pudieron alinear entre pasadas) se recurre
 * al conteo de caracteres como aproximación.
 */
function endsParagraph(
  lines: string[],
  geometry: (LineGeometry | null)[] | undefined,
  previous: number,
  next: number,
  width: number,
): boolean {
  const previousGeometry = geometry?.[previous];
  if (previousGeometry) {
    return previousGeometry.right - previousGeometry.xMax > MARGIN_TOLERANCE;
  }
  const token = /^\s*\S+/.exec(lines[next])?.[0] ?? "";
  return lines[previous].length + 1 + token.length <= width;
}

/**
 * Reconstruye los párrafos del cuerpo de una entrada.
 *
 * La fuente (pdftotext -layout) no conserva saltos de párrafo: solo la
 * posición de corte de cada línea. Un corte de párrafo real cumple dos
 * condiciones: la línea termina en puntuación final y la línea no llegó al
 * margen derecho (es decir, no se cortó por ancho de columna, sino porque el
 * párrafo terminó). Las líneas en blanco son artefactos de página y se
 * ignoran.
 *
 * @param lines líneas crudas del cuerpo (sin limpiar).
 * @param width ancho de la columna en caracteres (respaldo sin geometría).
 * @param geometry geometría visual alineada por índice con `lines`.
 */
export function rebuildParagraphs(
  lines: string[],
  width: number,
  geometry?: (LineGeometry | null)[],
): string[] {
  const paragraphs: string[] = [];
  let current = "";
  let previous = -1;

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (line.trim() === "") continue;
    const text = line.replace(/\s+/g, " ").trim();
    if (
      previous >= 0 &&
      endsWithFinalPunctuation(lines[previous]) &&
      endsParagraph(lines, geometry, previous, index, width)
    ) {
      paragraphs.push(current);
      current = text;
      previous = index;
      continue;
    }
    current = current === "" ? text : `${current} ${text}`;
    previous = index;
  }

  if (current !== "") paragraphs.push(current);

  // Descarta residuos de puntuación suelta del PDF (p. ej. un "." que la
  // maquetación dejó en su propia línea); nunca son un párrafo real.
  return paragraphs.filter((paragraph) => /\p{L}/u.test(paragraph));
}

/** Ancho de columna del documento: la línea más larga tras limpiar. */
function measureWidth(pages: string[]): number {
  let width = 0;
  for (const pageText of pages) {
    for (const line of cleanPageLines(pageText)) {
      if (line.length > width) width = line.length;
    }
  }
  return width;
}

export function parseDevotionals(
  text: string,
  geometry?: GeometryPage[],
): {
  entries: Devotional[];
  issues: ParseIssue[];
} {
  const pages = text.split("\f");
  const width = measureWidth(pages);
  const raw: RawEntry[] = [];
  const issues: ParseIssue[] = [];
  let current: RawEntry | null = null;
  let lastRank = 0;

  const finish = (): void => {
    if (current) {
      raw.push(current);
      current = null;
    }
  };

  pages.forEach((pageText, pageIndex) => {
    const lines = cleanPageLines(pageText);
    const page = pageIndex + 1;
    const pageGeometry = geometry?.[pageIndex];
    const geomFor = (line: string): LineGeometry | null =>
      pageGeometry?.get(line.replace(/\s+/g, " ").trim()) ?? null;

    for (const line of lines) {
      const heading = HEADING_RE.exec(line);
      if (heading) {
        const month = MONTHS[heading[2].toLowerCase()];
        const day = Number(heading[1]);
        if (month && isValidDate(month, day)) {
          const rank = rankOf(month, day);
          const inOrder =
            lastRank === 0 ? month === 1 && day === 1 : rank > lastRank;
          if (inOrder) {
            finish();
            current = {
              month,
              day,
              pdfPage: page,
              phase: "header",
              headerLines: [],
              bodyLines: [],
              bodyGeom: [],
            };
            lastRank = rank;
            if (heading[3].trim()) current.headerLines.push(heading[3]);
            continue;
          }
        }
      }

      if (!current) continue;
      if (current.phase === "done") continue;
      if (DOXOLOGY_RE.test(line)) {
        current.phase = "done";
        continue;
      }

      if (current.phase === "header") {
        const trimmed = line.trim();
        if (trimmed === "") {
          // Algunos días tienen una línea en blanco después del encabezado.
          if (current.headerLines.length === 0) continue;
          current.phase = "body";
          continue;
        }
        const joined = [...current.headerLines, trimmed].join(" ");
        if (!hasReference(joined)) {
          current.headerLines.push(trimmed);
          continue;
        }
        const refBefore = hasReference(current.headerLines.join(" "));
        if (refBefore) {
          const existing = current.headerLines.join(" ");
          if (hasUnbalancedOpenParen(existing)) {
            current.headerLines.push(trimmed);
            continue;
          }
          if (!isReferenceComplete(existing)) {
            // La referencia todavía no tiene número de versículo: puede venir
            // en esta línea, al inicio de ella, o faltar por completo.
            const splitAtNumber = /^\s*(\d+\s*\.?)\s*([\s\S]*)$/.exec(trimmed);
            if (splitAtNumber) {
              current.headerLines.push(splitAtNumber[1].trim());
              const remainder = splitAtNumber[2].trim();
              if (remainder && !looksLikeRefContinuation(remainder)) {
                current.phase = "body";
                current.bodyLines.push(remainder);
                current.bodyGeom.push(geomFor(line));
              } else if (remainder) {
                current.headerLines.push(remainder);
              }
              continue;
            }
            if (looksLikeRefContinuation(trimmed)) {
              current.headerLines.push(trimmed);
              continue;
            }
            current.phase = "body";
            current.bodyLines.push(line);
            current.bodyGeom.push(geomFor(line));
            continue;
          }
          if (looksLikeRefContinuation(trimmed)) {
            current.headerLines.push(trimmed);
            continue;
          }
          current.phase = "body";
          current.bodyLines.push(line);
          current.bodyGeom.push(geomFor(line));
          continue;
        }
        current.headerLines.push(trimmed);
        continue;
      }

      current.bodyLines.push(line);
      current.bodyGeom.push(geomFor(line));
    }
  });

  finish();

  const entries: Devotional[] = [];
  const seen = new Set<string>();

  for (const item of raw) {
    const id = devotionalId(item.month, item.day);
    const split = splitHeader(item.headerLines);
    if (seen.has(id)) {
      issues.push({ id, message: "fecha duplicada en el PDF" });
      continue;
    }
    seen.add(id);
    entries.push({
      id,
      month: item.month,
      day: item.day,
      verse: split.verse,
      reference: split.reference,
      translationNote: split.translationNote,
      content: rebuildParagraphs(item.bodyLines, width, item.bodyGeom),
      pdfPage: item.pdfPage,
    });
  }

  return { entries, issues };
}

/** Aplica correcciones manuales y falla si se referencia una fecha inexistente. */
export function applyOverrides(
  entries: Devotional[],
  overrides: Record<string, DevotionalOverride>,
): Devotional[] {
  const known = new Set(entries.map((entry) => entry.id));
  const unknown = Object.keys(overrides).filter((id) => !known.has(id));
  if (unknown.length > 0) {
    throw new Error(`Overrides con id desconocido: ${unknown.join(", ")}`);
  }

  return entries.map((entry) => {
    const override = overrides[entry.id];
    return override ? { ...entry, ...override, id: entry.id } : entry;
  });
}

function runPdftotext(args: string[], pdfPath: string): string {
  if (!existsSync(pdfPath)) {
    throw new Error(`No se encuentra el PDF: ${pdfPath}`);
  }
  try {
    return execFileSync("pdftotext", [...args, pdfPath, "-"], {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (error) {
    throw new Error(
      `No se pudo ejecutar pdftotext (poppler-utils). Instálalo y reintenta. (${String(error)})`,
    );
  }
}

export function extractLayout(pdfPath: string): string {
  return runPdftotext(["-layout"], pdfPath);
}

/**
 * Geometría de una línea visual: en qué punto termina, en puntos. El PDF está
 * justificado, así que el ancho real solo sale de las coordenadas de las
 * palabras (`pdftotext -bbox`).
 */
export interface LineGeometry {
  /** Punto final (x) de la línea. */
  xMax: number;
  /** Margen derecho de la página a la que pertenece. */
  right: number;
}

/** Texto normalizado de línea -> geometría, por página. */
export type GeometryPage = Map<string, LineGeometry>;

interface BBoxLine {
  text: string;
  xMax: number;
}

function decodeEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
      String.fromCodePoint(parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

const WORD_RE = /<word\b([^>]*)>([^<]*)<\/word>/g;
const ATTR_RE = /(\w+)="([^"]*)"/g;

/** Agrupa las palabras de una página en líneas visuales por su coordenada y. */
function parseBBoxLines(pageHtml: string): BBoxLine[] {
  const words: { x: number; y: number; x2: number; t: string }[] = [];
  WORD_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = WORD_RE.exec(pageHtml)) !== null) {
    const attrs = new Map<string, string>();
    ATTR_RE.lastIndex = 0;
    let attr: RegExpExecArray | null;
    while ((attr = ATTR_RE.exec(match[1])) !== null) {
      attrs.set(attr[1], attr[2]);
    }
    const x = Number(attrs.get("xMin"));
    const y = Number(attrs.get("yMin"));
    const x2 = Number(attrs.get("xMax"));
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(x2)) {
      throw new Error(
        "Salida inesperada de pdftotext -bbox: falta la coordenada de una palabra.",
      );
    }
    words.push({ x, y, x2, t: decodeEntities(match[2]) });
  }

  const lines: { y: number; x2: number; words: typeof words }[] = [];
  for (const word of words) {
    const last = lines[lines.length - 1];
    if (last && Math.abs(word.y - last.y) < 3) {
      last.words.push(word);
      last.x2 = Math.max(last.x2, word.x2);
    } else {
      lines.push({ y: word.y, x2: word.x2, words: [word] });
    }
  }

  return lines.map((line) => {
    let text = "";
    let previousX2: number | null = null;
    for (const word of line.words) {
      if (previousX2 !== null && word.x - previousX2 > 1.2) text += " ";
      text += word.t;
      previousX2 = word.x2;
    }
    return { text, xMax: line.x2 };
  });
}

/** Segunda pasada: geometría de cada página para medir cortes de párrafo. */
export function extractGeometry(pdfPath: string): GeometryPage[] {
  const html = runPdftotext(["-bbox"], pdfPath);
  return html.split(/<page\b/).slice(1).map((pageHtml) => {
    const lines = parseBBoxLines(pageHtml).filter(
      (line) =>
        !PAGE_HEADER_RE.test(line.text) && !PAGE_COLOPHON_RE.test(line.text),
    );
    let right = 0;
    for (const line of lines) {
      if (line.xMax > right) right = line.xMax;
    }
    const page: GeometryPage = new Map();
    for (const line of lines) {
      const key = line.text.replace(/\s+/g, " ").trim();
      if (key !== "" && !page.has(key)) {
        page.set(key, { xMax: line.xMax, right });
      }
    }
    return page;
  });
}

/** Ambas pasadas: el texto para la estructura y la geometría para los cortes. */
export function extract(pdfPath: string): {
  text: string;
  geometry: GeometryPage[];
} {
  return { text: extractLayout(pdfPath), geometry: extractGeometry(pdfPath) };
}

function main(): void {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const pdfPath = path.join(root, "data", "raw", "chequera-spurgeon.pdf");
  const outPath = path.join(root, "public", "data", "devotionals.json");
  const { text, geometry } = extract(pdfPath);
  const parsed = parseDevotionals(text, geometry);
  const overridesPath = path.join(root, "data", "overrides.json");
  const overrides = JSON.parse(readFileSync(overridesPath, "utf8")) as Record<
    string,
    DevotionalOverride
  >;
  const entries = applyOverrides(parsed.entries, overrides);
  const issues = [...parsed.issues, ...validateEntries(entries)];

  console.log(`Entradas detectadas: ${entries.length}`);
  for (const issue of issues) {
    console.warn(`  [${issue.id}] ${issue.message}`);
  }
  if (issues.length > 0) throw new Error(`La validación de datos falló con ${issues.length} problema(s)`);

  mkdirSync(path.dirname(outPath), { recursive: true });
  const payload = {
    version: 1,
    source: "chequera-spurgeon.pdf",
    generatedAt: new Date().toISOString(),
    devotionals: entries,
  };
  writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(`Escrito: ${path.relative(root, outPath)}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

export { MONTH_NAMES };
