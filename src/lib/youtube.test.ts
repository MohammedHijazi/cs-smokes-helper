import { describe, expect, it } from "vitest";
import { effectiveStart, parseTimeParam, parseYouTubeUrl, watchUrl } from "./youtube";

const ID = "dQw4w9WgXcQ";

describe("parseYouTubeUrl", () => {
  it.each([
    [`https://www.youtube.com/watch?v=${ID}`, { id: ID }],
    [`https://youtube.com/watch?v=${ID}&t=95`, { id: ID, t: 95 }],
    [`https://m.youtube.com/watch?v=${ID}&t=1m35s`, { id: ID, t: 95 }],
    [`https://youtu.be/${ID}?t=95s`, { id: ID, t: 95 }],
    [`https://youtu.be/${ID}?si=AbCdEfGh12345`, { id: ID }],
    [
      `https://www.youtube.com/watch?v=${ID}&list=PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPboYG&index=3&t=95s`,
      { id: ID, t: 95 },
    ],
    [`https://www.youtube.com/shorts/${ID}`, { id: ID }],
    [`https://www.youtube.com/embed/${ID}?start=30`, { id: ID, t: 30 }],
    [`https://www.youtube.com/watch?v=${ID}&t=1h2m3s`, { id: ID, t: 3723 }],
  ])("parses %s", (url, expected) => {
    expect(parseYouTubeUrl(url)).toEqual(expected);
  });

  it.each([
    "https://csnades.gg/mirage/smokes/window",
    "not a url",
    "https://www.youtube.com/watch",
    "https://www.youtube.com/watch?v=short",
    "https://www.youtube.com/channel/UC1234567890",
    `https://evil.example/watch?v=${ID}`,
  ])("rejects %s", (url) => {
    expect(parseYouTubeUrl(url)).toBeNull();
  });

  it("ignores an unreadable t value", () => {
    expect(parseYouTubeUrl(`https://youtu.be/${ID}?t=abc`)).toEqual({ id: ID });
  });
});

describe("parseTimeParam", () => {
  it.each([
    ["95", 95],
    ["95s", 95],
    ["1m35s", 95],
    ["2m", 120],
    ["1h2m3s", 3723],
    ["", null],
    ["abc", null],
    ["-5", null],
  ])("%s → %s", (value, expected) => {
    expect(parseTimeParam(value)).toBe(expected);
  });
});

describe("effectiveStart", () => {
  it("prefers video.start", () => {
    expect(effectiveStart({ url: `https://youtu.be/${ID}?t=50`, start: 10 })).toBe(10);
  });
  it("falls back to the URL's t", () => {
    expect(effectiveStart({ url: `https://youtu.be/${ID}?t=50` })).toBe(50);
  });
  it("falls back to 0", () => {
    expect(effectiveStart({ url: `https://youtu.be/${ID}` })).toBe(0);
  });
  it("is 0 for other sites", () => {
    expect(effectiveStart({ url: "https://csnades.gg/mirage/smokes/window" })).toBe(0);
  });
});

describe("watchUrl", () => {
  it("adds the start time only when there is one", () => {
    expect(watchUrl(ID, 95)).toBe(`https://www.youtube.com/watch?v=${ID}&t=95s`);
    expect(watchUrl(ID)).toBe(`https://www.youtube.com/watch?v=${ID}`);
    expect(watchUrl(ID, 0)).toBe(`https://www.youtube.com/watch?v=${ID}`);
  });
});
