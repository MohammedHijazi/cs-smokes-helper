import { describe, expect, it } from "vitest";
import { MAPS, getMapInfo, hasLevels, radarPath } from "./maps";
import { MAP_IDS } from "./schema";

describe("map registry", () => {
  it("lists the seven maps in id order with their display names", () => {
    expect(MAPS.map((m) => m.id)).toEqual([...MAP_IDS]);
    expect(MAPS.map((m) => m.name)).toEqual([
      "Ancient",
      "Anubis",
      "Cache",
      "Dust II",
      "Inferno",
      "Mirage",
      "Nuke",
    ]);
  });

  it("gives only Nuke two levels", () => {
    expect(MAPS.filter(hasLevels).map((m) => m.id)).toEqual(["nuke"]);
  });

  it("picks the lower radar only where one exists", () => {
    const nuke = getMapInfo("nuke")!;
    const mirage = getMapInfo("mirage")!;
    expect(radarPath(nuke, "lower")).toBe("radars/nuke-lower.webp");
    expect(radarPath(nuke)).toBe("radars/nuke.webp");
    expect(radarPath(mirage, "lower")).toBe("radars/mirage.webp");
  });

  it("returns undefined for maps outside the pool", () => {
    expect(getMapInfo("overpass")).toBeUndefined();
  });
});
