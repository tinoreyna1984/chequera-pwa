import { describe, expect, it } from "vitest";
import { ReadingProgress } from "./reading-progress";

describe("ReadingProgress", () => {
  it("marca, desmarca y calcula estadísticas", () => {
    const progress = new ReadingProgress();
    progress.markRead("01-01", "2026-01-01T08:00:00.000Z");
    progress.markRead("01-02", "2026-01-02T08:00:00.000Z");
    expect(progress.isRead("01-01")).toBe(true);
    expect(progress.stats(2026, 365, "01-02")).toEqual({ read: 2, total: 365, percentage: 1, streak: 2 });
    progress.unmarkRead("01-01");
    expect(progress.isRead("01-01")).toBe(false);
  });
});
