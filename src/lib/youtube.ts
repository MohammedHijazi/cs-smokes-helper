import type { Video } from "../data/schema";

export interface YouTubeRef {
  id: string;
  /** Start time from the URL's `t` or `start` parameter, in seconds. */
  t?: number;
}

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "youtu.be",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
]);

/** Parses "95", "95s", "1m35s" or "1h2m3s" into seconds. */
export function parseTimeParam(value: string): number | null {
  const text = value.trim();
  if (/^\d+s?$/.test(text)) return Number.parseInt(text, 10);
  const match = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(text);
  if (!match || text === "") return null;
  const [, hours = "0", minutes = "0", seconds = "0"] = match;
  return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
}

export function parseYouTubeUrl(url: string): YouTubeRef | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const host = parsed.hostname.toLowerCase();
  if (!HOSTS.has(host)) return null;

  const segments = parsed.pathname.split("/").filter(Boolean);
  let id: string | null | undefined;
  if (host === "youtu.be") id = segments[0];
  else if (segments[0] === "watch") id = parsed.searchParams.get("v");
  else if (segments[0] === "shorts" || segments[0] === "embed") id = segments[1];
  if (!id || !VIDEO_ID.test(id)) return null;

  const rawTime = parsed.searchParams.get("t") ?? parsed.searchParams.get("start");
  const t = rawTime === null ? null : parseTimeParam(rawTime);
  return t === null ? { id } : { id, t };
}

/** The clip start: `video.start`, else the URL's `t`, else 0. */
export function effectiveStart(video: Pick<Video, "url" | "start">): number {
  if (video.start !== undefined) return video.start;
  return parseYouTubeUrl(video.url)?.t ?? 0;
}

export function watchUrl(id: string, start?: number): string {
  const base = `https://www.youtube.com/watch?v=${id}`;
  return start ? `${base}&t=${start}s` : base;
}
