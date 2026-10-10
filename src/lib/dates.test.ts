import { describe, expect, it } from "vitest";
import { addDays, toLocalDate } from "./dates";

describe("toLocalDate", () => {
  it("uses the device's calendar day, even just after midnight", () => {
    expect(toLocalDate(new Date(2026, 0, 1, 0, 30))).toBe("2026-01-01");
    expect(toLocalDate(new Date(2025, 11, 31, 23, 59))).toBe("2025-12-31");
  });
});

describe("addDays", () => {
  it.each([
    ["2026-10-10", 1, "2026-10-11"],
    ["2026-10-31", 1, "2026-11-01"],
    ["2026-12-31", 1, "2027-01-01"],
    ["2028-02-28", 1, "2028-02-29"],
    ["2026-03-28", 2, "2026-03-30"], // EU clocks go forward on 2026-03-29
    ["2026-10-24", 2, "2026-10-26"], // EU clocks go back on 2026-10-25
    ["2026-03-07", 2, "2026-03-09"], // US clocks go forward on 2026-03-08
    ["2026-10-10", 16, "2026-10-26"],
  ])("%s + %i days → %s", (day, days, expected) => {
    expect(addDays(day, days)).toBe(expected);
  });
});
