export type DevotionalId = `${number}${number}-${number}${number}`;

export function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

export function createDevotionalId(month: number, day: number): string {
  return `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function isValidDevotionalId(id: string, year = new Date().getFullYear()): boolean {
  const match = /^(\d{2})-(\d{2})$/.exec(id);
  if (!match) return false;
  const month = Number(match[1]);
  const day = Number(match[2]);
  if (month < 1 || month > 12 || day < 1) return false;
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day <= days;
}

export function nextDevotionalId(id: string, year = new Date().getFullYear()): string | null {
  if (!isValidDevotionalId(id, year)) return null;
  const [month, day] = id.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + 1));
  if (date.getUTCFullYear() !== year) return null;
  return createDevotionalId(date.getUTCMonth() + 1, date.getUTCDate());
}

export function previousDevotionalId(id: string, year = new Date().getFullYear()): string | null {
  if (!isValidDevotionalId(id, year)) return null;
  const [month, day] = id.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day - 1));
  if (date.getUTCFullYear() !== year) return null;
  return createDevotionalId(date.getUTCMonth() + 1, date.getUTCDate());
}
