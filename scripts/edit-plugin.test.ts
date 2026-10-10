// @vitest-environment node
import { readFileSync } from "node:fs";
import { createServer, request as httpRequest, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import { normalizePath } from "vite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MapFile } from "../src/data/schema";
import { makeLineup, makeMapFile } from "../src/test/fixtures";
import { createEditMiddleware, createWriteTracker, requestProblem } from "./edit-plugin";
import { makeDataDir } from "./temp-data-dir";

describe("requestProblem", () => {
  const ok = {
    remoteAddress: "127.0.0.1",
    origin: undefined,
    host: "localhost:5173",
    contentType: "application/json",
  };

  it("accepts a JSON request from this machine without an Origin", () => {
    expect(requestProblem(ok)).toBeNull();
  });

  it.each(["::1", "::ffff:127.0.0.1"])("accepts loopback address %s", (remoteAddress) => {
    expect(requestProblem({ ...ok, remoteAddress })).toBeNull();
  });

  it("refuses other addresses", () => {
    expect(requestProblem({ ...ok, remoteAddress: "192.168.1.20" })).toEqual({
      status: 403,
      error: "not-local",
    });
    expect(requestProblem({ ...ok, remoteAddress: undefined })).toEqual({
      status: 403,
      error: "not-local",
    });
  });

  it("accepts the dev site's own origin and refuses others", () => {
    expect(requestProblem({ ...ok, origin: "http://localhost:5173" })).toBeNull();
    expect(requestProblem({ ...ok, origin: "https://example.com" })).toEqual({
      status: 403,
      error: "foreign-origin",
    });
    expect(requestProblem({ ...ok, origin: "not a url" })).toEqual({
      status: 403,
      error: "foreign-origin",
    });
  });

  it("accepts JSON with a charset and refuses other bodies", () => {
    expect(requestProblem({ ...ok, contentType: "application/json; charset=utf-8" })).toBeNull();
    expect(requestProblem({ ...ok, contentType: "text/plain" })).toEqual({
      status: 415,
      error: "json-only",
    });
    expect(requestProblem({ ...ok, contentType: undefined })).toEqual({
      status: 415,
      error: "json-only",
    });
  });
});

describe("createWriteTracker", () => {
  const path = join(process.cwd(), "data", "maps", "mirage.json");

  it("recognises its own write under Vite's forward-slash path", async () => {
    const tracker = createWriteTracker();
    tracker.remember(path, "written text");
    expect(await tracker.isOwnWrite(normalizePath(path), () => "written text")).toBe(true);
  });

  it("lets other changes through", async () => {
    const tracker = createWriteTracker();
    tracker.remember(path, "written text");
    expect(await tracker.isOwnWrite(path, () => "edited by hand")).toBe(false);
    expect(
      await tracker.isOwnWrite(join(process.cwd(), "data", "maps", "nuke.json"), () => "x"),
    ).toBe(false);
  });
});

describe("edit middleware", () => {
  const MIRAGE: MapFile = makeMapFile("mirage", [makeLineup()]);
  const RENAMED: MapFile = { ...MIRAGE, lineups: [{ ...MIRAGE.lineups[0], name: "Window box" }] };
  const JSON_HEADERS = { "Content-Type": "application/json" };
  const onWritten = vi.fn();
  const passedOn = vi.fn();
  let data: Awaited<ReturnType<typeof makeDataDir>>;
  let server: Server;
  let origin: string;

  beforeEach(async () => {
    data = await makeDataDir({ mirage: MIRAGE });
    onWritten.mockClear();
    passedOn.mockClear();
    const middleware = createEditMiddleware({ dataDir: data.dir, onWritten });
    server = createServer((req, res) =>
      middleware(req, res, () => {
        passedOn();
        res.statusCode = 404;
        res.end();
      }),
    );
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterEach(async () => {
    await new Promise((resolve) => server.close(resolve));
    data.cleanup();
  });

  function send(
    method: string,
    path: string,
    body = "",
    headers: Record<string, string> = JSON_HEADERS,
  ) {
    return new Promise<{ status: number; body: unknown }>((resolve, reject) => {
      const req = httpRequest(`${origin}${path}`, { method, headers }, (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          resolve({ status: res.statusCode ?? 0, body: text ? JSON.parse(text) : undefined });
        });
      });
      req.on("error", reject);
      req.end(body);
    });
  }
  const put = (body: unknown, headers?: Record<string, string>, map = "mirage") =>
    send("PUT", `/__edit/maps/${map}`, JSON.stringify(body), headers);

  it("saves a map and answers with the file as written", async () => {
    expect(await put({ base: MIRAGE, file: RENAMED })).toEqual({
      status: 200,
      body: { file: RENAMED },
    });
    const text = readFileSync(data.path("mirage"), "utf8");
    expect(text).toContain('"name": "Window box"');
    expect(onWritten).toHaveBeenCalledWith(data.path("mirage"), text);
  });

  it("passes the save's refusals through", async () => {
    expect(await put({ base: RENAMED, file: RENAMED })).toEqual({
      status: 409,
      body: { error: "changed" },
    });
    expect(await put({ base: MIRAGE, file: MIRAGE }, JSON_HEADERS, "overpass")).toEqual({
      status: 404,
      body: { error: "unknown-map" },
    });
    expect(onWritten).not.toHaveBeenCalled();
  });

  it("refuses a body that isn't JSON or lacks base and file", async () => {
    expect(await send("PUT", "/__edit/maps/mirage", "{ nope")).toEqual({
      status: 400,
      body: { errors: [{ path: "", message: "the request body is not valid JSON" }] },
    });
    expect(await put({ file: RENAMED })).toEqual({
      status: 400,
      body: { errors: [{ path: "", message: "the request body must be { base, file }" }] },
    });
  });

  it("refuses another website and non-JSON bodies", async () => {
    const foreign = { ...JSON_HEADERS, Origin: "https://example.com" };
    expect(await put({ base: MIRAGE, file: RENAMED }, foreign)).toEqual({
      status: 403,
      body: { error: "foreign-origin" },
    });
    expect(await put({ base: MIRAGE, file: RENAMED }, { "Content-Type": "text/plain" })).toEqual({
      status: 415,
      body: { error: "json-only" },
    });
    expect(readFileSync(data.path("mirage"), "utf8")).not.toContain("Window box");
  });

  it("leaves other requests to Vite", async () => {
    expect((await send("GET", "/__edit/maps/mirage")).status).toBe(404);
    expect((await send("PUT", "/__edit/other", "{}")).status).toBe(404);
    expect(passedOn).toHaveBeenCalledTimes(2);
  });
});
