import { afterEach, describe, expect, it, vi } from "vitest";

const SCRIPT = 'script[src="https://www.youtube.com/iframe_api"]';

async function freshModule() {
  vi.resetModules();
  return import("./youtubeApi");
}

afterEach(() => {
  delete window.YT;
  delete window.onYouTubeIframeAPIReady;
  document.head.querySelectorAll(SCRIPT).forEach((script) => script.remove());
});

describe("loadYouTubeApi", () => {
  it("uses an API that is already loaded", async () => {
    const yt = { Player: vi.fn(), PlayerState: { ENDED: 0 } };
    window.YT = yt as unknown as Window["YT"];
    const { loadYouTubeApi } = await freshModule();
    await expect(loadYouTubeApi()).resolves.toBe(yt);
    expect(document.head.querySelector(SCRIPT)).toBeNull();
  });

  it("adds the script once and resolves when the API is ready", async () => {
    const { loadYouTubeApi } = await freshModule();
    const first = loadYouTubeApi();
    const second = loadYouTubeApi();
    expect(document.head.querySelectorAll(SCRIPT)).toHaveLength(1);
    const yt = { Player: vi.fn(), PlayerState: { ENDED: 0 } };
    window.YT = yt as unknown as Window["YT"];
    window.onYouTubeIframeAPIReady?.();
    await expect(first).resolves.toBe(yt);
    await expect(second).resolves.toBe(yt);
  });

  it("rejects when the script fails to load, and can try again", async () => {
    const { loadYouTubeApi } = await freshModule();
    const attempt = loadYouTubeApi();
    document.head.querySelector<HTMLScriptElement>(SCRIPT)!.dispatchEvent(new Event("error"));
    await expect(attempt).rejects.toThrow("YouTube API failed to load");
    loadYouTubeApi().catch(() => undefined);
    expect(document.head.querySelectorAll(SCRIPT)).toHaveLength(2);
  });
});
