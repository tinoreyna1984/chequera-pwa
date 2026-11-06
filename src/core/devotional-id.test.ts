import { describe, expect, it } from "vitest";
import { isValidDevotionalId, nextDevotionalId, previousDevotionalId } from "./devotional-id";

describe("DevotionalId", () => {
  it("salta el 29 de febrero en año no bisiesto", () => {
    expect(nextDevotionalId("02-28", 2025)).toBe("03-01");
    expect(previousDevotionalId("03-01", 2025)).toBe("02-28");
  });
  it("conserva el 29 de febrero en año bisiesto", () => {
    expect(nextDevotionalId("02-28", 2024)).toBe("02-29");
    expect(previousDevotionalId("03-01", 2024)).toBe("02-29");
  });
  it("respeta los límites del año", () => {
    expect(previousDevotionalId("01-01", 2025)).toBeNull();
    expect(nextDevotionalId("12-31", 2025)).toBeNull();
    expect(isValidDevotionalId("02-29", 2025)).toBe(false);
  });
});
