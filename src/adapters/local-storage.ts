import type { ReadingRecord } from "../core/reading-progress";

const key = (year: number) => `chequera-read-${year}`;

export function loadReadingRecords(year: number): ReadingRecord[] {
  if (typeof window === "undefined") return [];
  try {
    return (JSON.parse(localStorage.getItem(key(year)) ?? "[]") as string[]).map((id) => ({ id, readAt: "" }));
  } catch { return []; }
}

export function saveReadingRecords(year: number, records: ReadingRecord[]): void {
  localStorage.setItem(key(year), JSON.stringify(records.map((record) => record.id)));
}
