import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addDays, toLocalDate } from "./dates";

// Clock changes only matter in a time zone that has them, and a CI runner is usually on UTC,
// so every test runs in each of these zones. Node applies a change to process.env.TZ at once.
const ZONES = [
  // [time zone, getTimezoneOffset() in January, in minutes]
  ["Europe/Berlin", -60],
  ["America/New_York", 300],
  ["Africa/Cairo", -120],
] as const;

describe.each(ZONES)("in %s", (zone, januaryOffset) => {
  const previous = process.env.TZ;
  beforeAll(() => {
    process.env.TZ = zone;
  });
  afterAll(() => {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  });

  it("really runs in that time zone", () => {
    expect(new Date(2026, 0, 15, 12).getTimezoneOffset()).toBe(januaryOffset);
  });

  describe("toLocalDate", () => {
    it("uses the device's calendar day, even just after midnight", () => {
      expect(toLocalDate(new Date(2026, 0, 1, 0, 30))).toBe("2026-01-01");
      expect(toLocalDate(new Date(2025, 11, 31, 23, 59))).toBe("2025-12-31");
    });

    it("keeps the day when midnight is skipped (Egypt's clocks go forward at 00:00 on 2026-04-24)", () => {
      expect(toLocalDate(new Date(2026, 3, 24, 0, 30))).toBe("2026-04-24");
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
      ["2026-10-31", 2, "2026-11-02"], // US clocks go back on 2026-11-01
      ["2026-04-23", 1, "2026-04-24"], // Egypt's clocks go forward at 00:00 on 2026-04-24
      ["2026-10-29", 1, "2026-10-30"], // Egypt's clocks go back at the end of 2026-10-29
      ["2026-10-10", 16, "2026-10-26"],
    ])("%s + %i days → %s", (day, days, expected) => {
      expect(addDays(day, days)).toBe(expected);
    });
  });
});
