import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { getMapInfo } from "../../data/maps";
import { clickRadar, dragRadar, mockPlacementRadar } from "../../test/editHelpers";
import { makeLineup } from "../../test/fixtures";
import { PlacementRadar, type PlacementRadarProps } from "./PlacementRadar";

const mirage = getMapInfo("mirage")!;
const nuke = getMapInfo("nuke")!;

function renderRadar(props: Partial<PlacementRadarProps> = {}) {
  const onPlace = vi.fn();
  const onRelease = vi.fn();
  render(
    <PlacementRadar
      map={mirage}
      level="upper"
      side="T"
      stand={null}
      land={null}
      active="land"
      context={[]}
      onPlace={onPlace}
      onRelease={onRelease}
      {...props}
    />,
  );
  mockPlacementRadar(500);
  return { onPlace, onRelease };
}

const markers = () => screen.queryAllByTestId("landing-marker");
const selected = () => markers().filter((m) => m.getAttribute("data-selected") === "true");

describe("PlacementRadar", () => {
  it("places the active spot where the radar is clicked, rounded to 3 decimals", () => {
    const { onPlace, onRelease } = renderRadar();
    clickRadar(150.4, 100.2);
    expect(onPlace).toHaveBeenCalledWith("land", { x: 0.301, y: 0.2 });
    expect(onRelease).toHaveBeenCalledWith("land");
  });

  it("places the stand spot when Stand is active", () => {
    const { onPlace } = renderRadar({ active: "stand" });
    clickRadar(350, 150);
    expect(onPlace).toHaveBeenCalledWith("stand", { x: 0.7, y: 0.3 });
  });

  it("gives a Nuke spot the level being shown", () => {
    const { onPlace } = renderRadar({ map: nuke, level: "lower" });
    clickRadar(200, 250);
    expect(onPlace).toHaveBeenCalledWith("land", { x: 0.4, y: 0.5, level: "lower" });
  });

  it("drags a placed spot instead of placing the active one", () => {
    const { onPlace, onRelease } = renderRadar({ land: { x: 0.3, y: 0.2 }, active: "stand" });
    // The land spot is at (150, 100); the press is 6 px away, inside the 20 px hit radius.
    dragRadar([155, 104], [200, 120]);
    expect(onPlace.mock.calls).toEqual([["land", { x: 0.4, y: 0.24 }]]);
    expect(onRelease).toHaveBeenCalledWith("land");
  });

  it("draws the draft's spots and line, with other smokes faded behind", () => {
    renderRadar({
      land: { x: 0.3, y: 0.2 },
      stand: { x: 0.7, y: 0.3 },
      context: [makeLineup({ id: "mirage-other", land: { x: 0.5, y: 0.5 } })],
    });
    expect(markers()).toHaveLength(2);
    expect(selected()).toHaveLength(1);
    expect(screen.getByTestId("stand-dot")).toBeInTheDocument();
    expect(screen.getByTestId("stand-line")).toBeInTheDocument();
  });

  it("neither draws nor grabs a spot on the other level", () => {
    const { onPlace } = renderRadar({
      map: nuke,
      level: "upper",
      land: { x: 0.3, y: 0.2, level: "lower" },
    });
    expect(markers()).toHaveLength(0);
    clickRadar(150, 100);
    expect(onPlace).toHaveBeenCalledWith("land", { x: 0.3, y: 0.2, level: "upper" });
  });
});
