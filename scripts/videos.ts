import { parseYouTubeUrl } from "../src/lib/youtube";

export interface VideoCheck {
  lineupId: string;
  url: string;
  ok: boolean;
  detail: string;
}

export interface FetchResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

export type FetchLike = (url: string) => Promise<FetchResponse>;

export function oembedUrl(videoId: string): string {
  const watch = `https://www.youtube.com/watch?v=${videoId}`;
  return `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(watch)}`;
}

async function lookup(videoId: string, fetchImpl: FetchLike) {
  try {
    const response = await fetchImpl(oembedUrl(videoId));
    if (!response.ok) return { ok: false, detail: `oEmbed returned HTTP ${response.status}` };
    const body = (await response.json()) as { title?: string; author_name?: string };
    return {
      ok: true,
      detail: `${body.title ?? "(no title)"} — ${body.author_name ?? "(no channel)"}`,
    };
  } catch (error) {
    return { ok: false, detail: `request failed: ${(error as Error).message}` };
  }
}

export async function checkVideos(
  lineups: ReadonlyArray<{ id: string; video: { url: string } }>,
  fetchImpl: FetchLike,
): Promise<VideoCheck[]> {
  const byVideo = new Map<string, Promise<{ ok: boolean; detail: string }>>();
  const checks: VideoCheck[] = [];
  for (const lineup of lineups) {
    const { url } = lineup.video;
    const ref = parseYouTubeUrl(url);
    if (!ref) {
      checks.push({ lineupId: lineup.id, url, ok: true, detail: "not a YouTube link (skipped)" });
      continue;
    }
    let pending = byVideo.get(ref.id);
    if (!pending) {
      pending = lookup(ref.id, fetchImpl);
      byVideo.set(ref.id, pending);
    }
    checks.push({ lineupId: lineup.id, url, ...(await pending) });
  }
  return checks;
}

export function formatReport(checks: readonly VideoCheck[]): string {
  const lines = checks.map((c) =>
    c.ok ? `OK    ${c.lineupId}  ${c.detail}` : `FAIL  ${c.lineupId}  ${c.detail}  ${c.url}`,
  );
  const failed = checks.filter((c) => !c.ok).length;
  lines.push(
    "",
    failed === 0
      ? `All ${checks.length} videos OK.`
      : `${failed} of ${checks.length} videos failed.`,
  );
  return lines.join("\n");
}
