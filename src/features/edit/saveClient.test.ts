import { afterEach, describe, expect, it, vi } from "vitest";
import { getMapData } from "../../data";
import type { MapFile } from "../../data/schema";
import { mockEditServer, mockServerDown } from "../../test/editHelpers";
import { FIXTURE_DATA, restoreFixtureData } from "../../test/fixtureData";
import { describeProblem, saveMap } from "./saveClient";

vi.mock("../../data", async () => (await import("../../test/fixtureData")).mockDataModule());

afterEach(async () => {
  vi.unstubAllGlobals();
  await restoreFixtureData();
});

/** The current Mirage file with its first smoke renamed. */
const renamed = (name: string): MapFile => {
  const current = getMapData("mirage");
  return {
    ...current,
    lineups: current.lineups.map((lineup, i) => (i === 0 ? { ...lineup, name } : lineup)),
  };
};

describe("saveMap", () => {
  it("checks locally first and sends nothing when the file is invalid", async () => {
    const server = mockEditServer();
    expect(await saveMap("mirage", renamed("x".repeat(41)))).toEqual({
      ok: false,
      kind: "invalid",
      errors: [{ path: "lineups[0].name", message: "must be at most 40 characters" }],
    });
    expect(server.fetch).not.toHaveBeenCalled();
  });

  it("puts the file with its base, then swaps in the saved file", async () => {
    const server = mockEditServer();
    const next = renamed("Window box");
    expect(await saveMap("mirage", next)).toEqual({ ok: true, file: next });
    expect(server.fetch).toHaveBeenCalledWith(
      "/__edit/maps/mirage",
      expect.objectContaining({ method: "PUT", headers: { "Content-Type": "application/json" } }),
    );
    expect(server.sent()).toEqual({ base: FIXTURE_DATA.mirage, file: next });
    expect(getMapData("mirage")).toEqual(next);
  });

  it("uses the last saved file as the base of the next save", async () => {
    const server = mockEditServer();
    const first = renamed("Window box");
    await saveMap("mirage", first);
    await saveMap("mirage", renamed("Window boxed"));
    expect(server.sent(1).base).toEqual(first);
  });

  it("returns the server's field errors", async () => {
    const errors = [{ path: "lineups[0].notes", message: "must be at most 280 characters" }];
    mockEditServer(() => ({ status: 400, json: { errors } }));
    expect(await saveMap("mirage", renamed("Window box"))).toEqual({
      ok: false,
      kind: "invalid",
      errors,
    });
  });

  it("explains a map that changed on disk, keeping the page's data", async () => {
    mockEditServer(() => ({ status: 409, json: { error: "changed" } }));
    expect(await saveMap("mirage", renamed("Window box"))).toEqual({
      ok: false,
      kind: "changed",
      message:
        "This map changed outside this page (another tab, a hand edit or git). Reload to get the latest version.",
    });
    expect(getMapData("mirage")).toBe(FIXTURE_DATA.mirage);
  });

  it("explains a broken file on disk", async () => {
    mockEditServer(() => ({ status: 409, json: { error: "invalid-on-disk" } }));
    expect(await saveMap("mirage", renamed("Window box"))).toEqual({
      ok: false,
      kind: "invalid-on-disk",
      message: "data/maps/mirage.json isn't valid JSON — fix or restore it first.",
    });
  });

  it("explains a failed write", async () => {
    mockEditServer(() => ({
      status: 500,
      json: { error: "write-failed", message: "EPERM: operation not permitted" },
    }));
    expect(await saveMap("mirage", renamed("Window box"))).toEqual({
      ok: false,
      kind: "write-failed",
      message: "Couldn't write data/maps/mirage.json: EPERM: operation not permitted",
    });
  });

  it("explains a dev server that isn't running", async () => {
    mockServerDown();
    expect(await saveMap("mirage", renamed("Window box"))).toEqual({
      ok: false,
      kind: "unreachable",
      message: "Can't reach the dev server — is npm run dev running?",
    });
  });
});

describe("describeProblem", () => {
  it("joins field errors into one line and passes messages through", () => {
    expect(
      describeProblem({
        ok: false,
        kind: "invalid",
        errors: [
          { path: "executes[0].lineupIds", message: "needs at least 2 smokes" },
          { path: "", message: "file is missing" },
        ],
      }),
    ).toBe("executes[0].lineupIds: needs at least 2 smokes file is missing");
    expect(describeProblem({ ok: false, kind: "changed", message: "Changed." })).toBe("Changed.");
  });
});
