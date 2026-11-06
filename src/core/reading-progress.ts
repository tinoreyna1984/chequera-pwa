export interface ReadingRecord {
  id: string;
  readAt: string;
}

export interface ReadingStats {
  read: number;
  total: number;
  percentage: number;
  streak: number;
}

export class ReadingProgress {
  private readonly records = new Map<string, ReadingRecord>();

  constructor(records: ReadingRecord[] = []) {
    for (const record of records) this.records.set(record.id, record);
  }

  markRead(id: string, readAt = new Date().toISOString()): void {
    this.records.set(id, { id, readAt });
  }

  unmarkRead(id: string): void {
    this.records.delete(id);
  }

  isRead(id: string): boolean {
    return this.records.has(id);
  }

  toJSON(): ReadingRecord[] {
    return [...this.records.values()];
  }

  stats(year: number, total: number, todayId?: string): ReadingStats {
    const ids = [...this.records.keys()].filter((id) => id.startsWith(`${year}-`) || id.length === 5);
    const read = ids.length;
    const ordered = [...this.records.values()]
      .map((record) => record.id)
      .filter((id) => id.length === 5)
      .sort();
    let streak = 0;
    let cursor = todayId;
    while (cursor && ordered.includes(cursor)) {
      streak += 1;
      const [month, day] = cursor.split("-").map(Number);
      const previous = new Date(Date.UTC(year, month - 1, day - 1));
      cursor = `${String(previous.getUTCMonth() + 1).padStart(2, "0")}-${String(previous.getUTCDate()).padStart(2, "0")}`;
    }
    return { read, total, percentage: total ? Math.round((read / total) * 100) : 0, streak };
  }
}
