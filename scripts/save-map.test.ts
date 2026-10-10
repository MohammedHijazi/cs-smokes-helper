// @vitest-environment node
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MapFile } from "../src/data/schema";
import { makeExecute, makeLineup, makeMapFile } from "../src/test/fixtures";
import { formatMapFile } from "./format-map";
import { RENAME_DELAYS_MS, nodeFs, saveMapFile, type SaveFs, type SaveRequest } from "./save-map";
import { makeDataDir } from "./temp-data-dir";

const WINDOW = makeLineup();
const CT = makeLineup({ id: "mirage-ct-from-t-ramp", name: "CT", from: "T Ramp", area: "A" });
const JUNGLE = makeLineup({ id: "mirage-jungle-from-t-ramp", name: "Jungle", from: "T Ramp" });
const MIRAGE: MapFile = makeMapFile("mirage", [WINDOW, CT, JUNGLE], [makeExecute()]);

let data: Awaited<ReturnType<typeof makeDataDir>>;
const sleep = vi.fn(async (_ms: number) => {});

beforeEach(async () => {
  data = await makeDataDir({ mirage: MIRAGE });
  sleep.mockClear();
});
afterEach(() => data.cleanup());

const renamed = (name: string): MapFile => ({
  ...MIRAGE,
  lineups: MIRAGE.lineups.map((lineup, i) => (i === 0 ? { ...lineup, name } : lineup)),
});
const save = (file: unknown, overrides: Partial<SaveRequest> = {}) =>
  saveMapFile({ dataDir: data.dir, mapId: "mirage", base: MIRAGE, file, sleep, ...overrides });
const onDisk = () => readFileSync(data.path("mirage"), "utf8");
const tempFiles = () => readdirSync(data.dir).filter((name) => name.endsWith(".tmp"));
const errno = (code: string) =>
  Object.assign(new Error(`${code}: operation not permitted`), { code });

describe("saveMapFile", () => {
  it("writes the canonical text and returns the file as written", async () => {
    const next = renamed("Window box");
    const text = await formatMapFile(next);
    expect(await save(next)).toEqual({ status: 200, file: next, text });
    expect(onDisk()).toBe(text);
    expect(tempFiles()).toEqual([]);
  });

  it("accepts a base whose keys are in another order", async () => {
    const reordered = { executes: MIRAGE.executes, lineups: MIRAGE.lineups, map: "mirage" };
    expect((await save(renamed("Window box"), { base: reordered })).status).toBe(200);
  });

  it("refuses an invalid file with each problem's JSON path, writing nothing", async () => {
    const before = onDisk();
    expect(await save(renamed("x".repeat(41)))).toEqual({
      status: 400,
      errors: [{ path: "lineups[0].name", message: "must be at most 40 characters" }],
    });
    expect(onDisk()).toBe(before);
  });

  it("refuses an id that is already used", async () => {
    const clash = { ...MIRAGE, executes: [makeExecute({ id: "mirage-ct-from-t-ramp" })] };
    expect(await save(clash)).toEqual({
      status: 400,
      errors: [
        {
          path: "executes[0].id",
          message: 'duplicate id "mirage-ct-from-t-ramp" (also at mirage.json → lineups[1])',
        },
      ],
    });
  });

  it("refuses a file whose map field doesn't match the URL", async () => {
    expect(await save({ ...MIRAGE, map: "nuke" })).toEqual({
      status: 400,
      errors: [{ path: "map", message: 'must be "mirage" to match the file name' }],
    });
  });

  it("reports a stale base as changed, writing nothing", async () => {
    writeFileSync(data.path("mirage"), await formatMapFile(renamed("Edited by hand")));
    expect(await save(renamed("Window box"))).toEqual({ status: 409, error: "changed" });
    expect(onDisk()).toContain("Edited by hand");
  });

  it("reports a file on disk that isn't valid JSON", async () => {
    writeFileSync(data.path("mirage"), "{ broken");
    expect(await save(MIRAGE)).toEqual({ status: 409, error: "invalid-on-disk" });
  });

  it("answers 404 for an unknown map", async () => {
    expect(await save(MIRAGE, { mapId: "overpass" })).toEqual({
      status: 404,
      error: "unknown-map",
    });
  });

  describe("when the rename fails", () => {
    const failingRename = (failures: number, code = "EPERM"): SaveFs => {
      let calls = 0;
      return {
        ...nodeFs,
        rename: async (from, to) => {
          calls += 1;
          if (calls <= failures) throw errno(code);
          return nodeFs.rename(from, to);
        },
      };
    };

    it("retries EPERM and saves", async () => {
      expect((await save(renamed("Window box"), { fs: failingRename(2) })).status).toBe(200);
      expect(sleep.mock.calls).toEqual([[50], [100]]);
    });

    it("gives up after five attempts, keeping the original and removing the temp file", async () => {
      const fs = failingRename(99);
      const rename = vi.spyOn(fs, "rename");
      const before = onDisk();
      expect(await save(renamed("Window box"), { fs })).toEqual({
        status: 500,
        error: "write-failed",
        message: "EPERM: operation not permitted",
      });
      expect(rename).toHaveBeenCalledTimes(RENAME_DELAYS_MS.length + 1);
      expect(sleep.mock.calls).toEqual([[50], [100], [250], [500]]);
      expect(onDisk()).toBe(before);
      expect(tempFiles()).toEqual([]);
    });

    it("doesn't retry other errors", async () => {
      const result = await save(renamed("Window box"), { fs: failingRename(1, "EACCES") });
      expect(result).toMatchObject({ status: 500, error: "write-failed" });
      expect(sleep).not.toHaveBeenCalled();
    });
  });
});
