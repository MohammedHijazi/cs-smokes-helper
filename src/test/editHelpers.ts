import { vi } from "vitest";
import type { MapFile } from "../data/schema";

export interface SaveBody {
  base: MapFile;
  file: MapFile;
}

export interface ServerReply {
  status: number;
  json: unknown;
}

/**
 * Stubs fetch as the dev server's save endpoint. By default every save succeeds and echoes the
 * file. Call vi.unstubAllGlobals() in afterEach.
 */
export function mockEditServer(
  reply: (body: SaveBody) => ServerReply | Promise<ServerReply> = (body) => ({
    status: 200,
    json: { file: body.file },
  }),
) {
  const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
    const { status, json } = await reply(JSON.parse(String(init?.body)) as SaveBody);
    return new Response(JSON.stringify(json), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  });
  vi.stubGlobal("fetch", fetchMock);
  return {
    fetch: fetchMock,
    /** The body of the nth save (0-based). */
    sent: (n = 0): SaveBody => JSON.parse(String(fetchMock.mock.calls[n][1]?.body)) as SaveBody,
  };
}

/** Stubs fetch as if the dev server were not running. */
export function mockServerDown() {
  const fetchMock = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}
