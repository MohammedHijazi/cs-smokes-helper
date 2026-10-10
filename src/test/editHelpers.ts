import { fireEvent, screen } from "@testing-library/react";
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

/** Gives the placement radar a size, since jsdom has no layout. */
export function mockPlacementRadar(size = 500) {
  vi.spyOn(screen.getByTestId("placement-radar"), "getBoundingClientRect").mockReturnValue({
    left: 0,
    top: 0,
    width: size,
    height: size,
  } as DOMRect);
}

/** A click on the placement radar at client coordinates. */
export function clickRadar(clientX: number, clientY: number) {
  const radar = screen.getByTestId("placement-radar");
  fireEvent.pointerDown(radar, { clientX, clientY, pointerId: 1 });
  fireEvent.pointerUp(radar, { clientX, clientY, pointerId: 1 });
}

/** A press at `from`, a move to `to`, and a release there. */
export function dragRadar(from: [number, number], to: [number, number]) {
  const radar = screen.getByTestId("placement-radar");
  fireEvent.pointerDown(radar, { clientX: from[0], clientY: from[1], pointerId: 1 });
  fireEvent.pointerMove(radar, { clientX: to[0], clientY: to[1], pointerId: 1 });
  fireEvent.pointerUp(radar, { clientX: to[0], clientY: to[1], pointerId: 1 });
}
