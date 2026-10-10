import { describe, expect, it } from "vitest";
import { makeExecute, makeLineup, makeMapFile } from "../test/fixtures";
import { createDataApi } from "./api";
import { MAP_IDS, type MapFile, type MapId } from "./schema";

const data = Object.fromEntries(MAP_IDS.map((map) => [map, makeMapFile(map)])) as Record<
  MapId,
  MapFile
>;
data.mirage = makeMapFile(
  "mirage",
  [makeLineup({ id: "mirage-a" }), makeLineup({ id: "mirage-b" })],
  [makeExecute({ id: "mirage-exec", lineupIds: ["mirage-a", "mirage-b"] })],
);
data.ancient = makeMapFile("ancient", [makeLineup({ id: "ancient-a" })]);

describe("createDataApi", () => {
  const api = createDataApi(data);

  it("finds lineups and executes by map and id", () => {
    expect(api.findLineup("mirage", "mirage-b")?.id).toBe("mirage-b");
    expect(api.findLineup("mirage", "ancient-a")).toBeUndefined();
    expect(api.findExecute("mirage", "mirage-exec")?.lineupIds).toEqual(["mirage-a", "mirage-b"]);
    expect(api.findExecute("mirage", "nope")).toBeUndefined();
  });

  it("lists all lineups in map order, then file order", () => {
    expect(api.allLineups().map(({ map, lineup }) => `${map}/${lineup.id}`)).toEqual([
      "ancient/ancient-a",
      "mirage/mirage-a",
      "mirage/mirage-b",
    ]);
  });
});
