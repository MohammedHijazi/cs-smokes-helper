import { describe, expect, it, vi } from "vitest";
import { checkVideos, formatReport, oembedUrl } from "./videos";

const ID = "dQw4w9WgXcQ";
const okResponse = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
const failResponse = (status: number) => ({ ok: false, status, json: async () => ({}) });

describe("checkVideos", () => {
  it("reports title and channel, asking oEmbed once per video", async () => {
    const fetchImpl = vi.fn(async () =>
      okResponse({ title: "Mirage smokes", author_name: "NadeGuy" }),
    );
    const checks = await checkVideos(
      [
        { id: "mirage-a", video: { url: `https://youtu.be/${ID}?t=5` } },
        { id: "mirage-b", video: { url: `https://www.youtube.com/watch?v=${ID}&t=60` } },
      ],
      fetchImpl,
    );
    expect(checks.map((c) => [c.lineupId, c.ok, c.detail])).toEqual([
      ["mirage-a", true, "Mirage smokes — NadeGuy"],
      ["mirage-b", true, "Mirage smokes — NadeGuy"],
    ]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith(oembedUrl(ID));
  });

  it("fails videos that oEmbed rejects", async () => {
    const checks = await checkVideos(
      [{ id: "mirage-a", video: { url: `https://youtu.be/${ID}` } }],
      async () => failResponse(401),
    );
    expect(checks[0]).toMatchObject({ ok: false, detail: "oEmbed returned HTTP 401" });
  });

  it("fails when the request itself fails", async () => {
    const checks = await checkVideos(
      [{ id: "mirage-a", video: { url: `https://youtu.be/${ID}` } }],
      async () => {
        throw new Error("offline");
      },
    );
    expect(checks[0]).toMatchObject({ ok: false, detail: "request failed: offline" });
  });

  it("skips links to other sites", async () => {
    const fetchImpl = vi.fn();
    const checks = await checkVideos(
      [{ id: "mirage-a", video: { url: "https://csnades.gg/mirage/smokes/window" } }],
      fetchImpl,
    );
    expect(checks[0]).toMatchObject({ ok: true, detail: "not a YouTube link (skipped)" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("formatReport", () => {
  it("lists every check and ends with a summary", () => {
    const report = formatReport([
      { lineupId: "mirage-a", url: "https://youtu.be/x", ok: true, detail: "Title — Channel" },
      {
        lineupId: "mirage-b",
        url: "https://youtu.be/y",
        ok: false,
        detail: "oEmbed returned HTTP 404",
      },
    ]);
    expect(report.split("\n")).toEqual([
      "OK    mirage-a  Title — Channel",
      "FAIL  mirage-b  oEmbed returned HTTP 404  https://youtu.be/y",
      "",
      "1 of 2 videos failed.",
    ]);
    expect(formatReport([])).toBe("\nAll 0 videos OK.");
  });
});
