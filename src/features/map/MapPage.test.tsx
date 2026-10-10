import { act, fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { replaceMapFile } from "../../data";
import { restoreFixtureData } from "../../test/fixtureData";
import { makeLineup, makeMapFile } from "../../test/fixtures";
import { renderAt } from "../../test/render";

vi.mock("../../data", async () => (await import("../../test/fixtureData")).mockDataModule());
vi.mock("../smoke/VideoPlayer", () => ({
  VideoPlayer: ({ title }: { title: string }) => <div data-testid="video">{title}</div>,
}));

afterEach(() => restoreFixtureData());

const smokeRows = () => within(screen.getByRole("list", { name: "Smokes" })).getAllByRole("link");
const currentLocation = () => screen.getByTestId("location").textContent;
// The smoke card draws its own mini radar, so the page's radar is the first one in the DOM.
const mainRadar = () => within(screen.getAllByTestId("radar")[0]);
const selectedMarkers = () =>
  mainRadar()
    .getAllByTestId("landing-marker")
    .filter((marker) => marker.getAttribute("data-selected") === "true");
const circleOf = (element: HTMLElement) => element.querySelector("circle");

function mockRadarSize(size: number) {
  vi.spyOn(screen.getByTestId("radar"), "getBoundingClientRect").mockReturnValue({
    left: 0,
    top: 0,
    width: size,
    height: size,
  } as DOMRect);
}

describe("MapPage", () => {
  it("re-renders with a map file that edit mode saved", () => {
    renderAt("/maps/ancient");
    expect(screen.getByText("No smokes on this map yet.")).toBeInTheDocument();
    act(() =>
      replaceMapFile(
        "ancient",
        makeMapFile("ancient", [makeLineup({ id: "ancient-cave-from-t-spawn", name: "Cave" })]),
      ),
    );
    expect(smokeRows()).toHaveLength(1);
    expect(smokeRows()[0]).toHaveTextContent("Cave");
  });

  it("shows every smoke on the radar and in the list", () => {
    renderAt("/maps/mirage");
    expect(screen.getByRole("heading", { name: "Mirage", level: 1 })).toBeInTheDocument();
    expect(smokeRows()).toHaveLength(5);
    expect(screen.getAllByTestId("landing-marker")).toHaveLength(5);
  });

  it("filters by side through the URL", async () => {
    renderAt("/maps/mirage");
    const sides = within(screen.getByRole("group", { name: "Side" }));
    await userEvent.click(sides.getByRole("button", { name: "CT" }));
    expect(currentLocation()).toBe("/maps/mirage?side=CT");
    expect(sides.getByRole("button", { name: "CT" })).toHaveAttribute("aria-pressed", "true");
    expect(smokeRows()).toHaveLength(1);
    expect(smokeRows()[0]).toHaveTextContent("Top Mid");
    expect(screen.getAllByTestId("landing-marker")).toHaveLength(1);
  });

  it("opens a smoke's card and keeps the filters in every link", async () => {
    renderAt("/maps/mirage?area=A");
    await userEvent.click(screen.getByRole("link", { name: /^CT from T Ramp/ }));
    expect(currentLocation()).toBe("/maps/mirage/smokes/mirage-ct-from-t-ramp?area=A");
    expect(screen.getByRole("heading", { name: "CT", level: 2 })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Previous smoke" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByRole("link", { name: "Next smoke" })).toHaveAttribute(
      "href",
      "/maps/mirage/smokes/mirage-jungle-from-t-ramp?area=A",
    );
    expect(screen.getByRole("link", { name: "Back to the list" })).toHaveAttribute(
      "href",
      "/maps/mirage?area=A",
    );
    expect(mainRadar().getAllByTestId("stand-dot")).toHaveLength(1);
  });

  it("highlights the selected smoke and draws its stand dot and line on the radar", () => {
    renderAt("/maps/mirage/smokes/mirage-ct-from-t-ramp");
    expect(mainRadar().getAllByTestId("landing-marker")).toHaveLength(5);
    // CT lands at (0.3, 0.2) and is thrown from (0.7, 0.3), in 0-1000 overlay units.
    const [selected, ...others] = selectedMarkers();
    expect(others).toHaveLength(0);
    expect(circleOf(selected)).toHaveAttribute("cx", "300");
    expect(circleOf(selected)).toHaveAttribute("cy", "200");
    expect(mainRadar().getAllByTestId("stand-dot")).toHaveLength(1);
    expect(mainRadar().getByTestId("stand-dot")).toHaveAttribute("cx", "700");
    expect(mainRadar().getByTestId("stand-dot")).toHaveAttribute("cy", "300");
    expect(mainRadar().getAllByTestId("stand-line")).toHaveLength(1);
    expect(mainRadar().getByTestId("stand-line")).toHaveAttribute("x1", "700");
    expect(mainRadar().getByTestId("stand-line")).toHaveAttribute("y1", "300");
    expect(mainRadar().getByTestId("stand-line")).toHaveAttribute("x2", "300");
    expect(mainRadar().getByTestId("stand-line")).toHaveAttribute("y2", "200");
  });

  it("highlights nothing and draws no stand marks on the list view", () => {
    renderAt("/maps/mirage");
    expect(selectedMarkers()).toHaveLength(0);
    expect(mainRadar().queryByTestId("stand-dot")).toBeNull();
    expect(mainRadar().queryByTestId("stand-line")).toBeNull();
  });

  it("keeps a filtered-out smoke on the radar, highlighted, next to the filtered ones", () => {
    renderAt("/maps/mirage/smokes/mirage-window-from-t-spawn?side=CT");
    // Top Mid (the only CT smoke) plus the excluded Window that was deep-linked.
    expect(mainRadar().getAllByTestId("landing-marker")).toHaveLength(2);
    const [selected, ...others] = selectedMarkers();
    expect(others).toHaveLength(0);
    // Window lands at (0.45, 0.45).
    expect(circleOf(selected)).toHaveAttribute("cx", "450");
    expect(circleOf(selected)).toHaveAttribute("cy", "450");
    expect(mainRadar().getAllByTestId("stand-dot")).toHaveLength(1);
    expect(mainRadar().getAllByTestId("stand-line")).toHaveLength(1);
  });

  it("draws neither stand dot nor line when the stand is on the other level", () => {
    // Ramp is thrown from the upper level and lands on the lower one.
    renderAt("/maps/nuke/smokes/nuke-ramp-from-lobby?level=lower");
    expect(mainRadar().getAllByTestId("landing-marker")).toHaveLength(1);
    expect(selectedMarkers()).toHaveLength(1);
    expect(mainRadar().queryByTestId("stand-dot")).toBeNull();
    expect(mainRadar().queryByTestId("stand-line")).toBeNull();
  });

  it("draws the stand dot but no line or landing marker when only the stand is on the level shown", () => {
    renderAt("/maps/nuke/smokes/nuke-ramp-from-lobby?level=upper");
    // Only Outside (which lands upstairs) is on the radar; Ramp lands downstairs.
    expect(mainRadar().getAllByTestId("landing-marker")).toHaveLength(1);
    expect(selectedMarkers()).toHaveLength(0);
    expect(mainRadar().getAllByTestId("stand-dot")).toHaveLength(1);
    expect(mainRadar().getByTestId("stand-dot")).toHaveAttribute("cx", "300");
    expect(mainRadar().getByTestId("stand-dot")).toHaveAttribute("cy", "600");
    expect(mainRadar().queryByTestId("stand-line")).toBeNull();
  });

  it("still opens a smoke that the filters exclude, with ‹ › disabled", () => {
    renderAt("/maps/mirage/smokes/mirage-window-from-t-spawn?side=CT");
    expect(screen.getByRole("heading", { name: "Window", level: 2 })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Previous smoke" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByRole("link", { name: "Next smoke" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("selects the nearest smoke when the radar is tapped", () => {
    renderAt("/maps/mirage");
    mockRadarSize(500);
    // The CT smoke lands at (0.3, 0.2), which is (150, 100) on a 500 px radar.
    fireEvent.click(screen.getByTestId("radar"), { clientX: 152, clientY: 101 });
    expect(currentLocation()).toBe("/maps/mirage/smokes/mirage-ct-from-t-ramp");
  });

  it("ignores taps far from every smoke", () => {
    renderAt("/maps/mirage");
    mockRadarSize(500);
    fireEvent.click(screen.getByTestId("radar"), { clientX: 5, clientY: 5 });
    expect(currentLocation()).toBe("/maps/mirage");
  });

  it("shows Nuke's upper level by default and switches to the lower one", async () => {
    renderAt("/maps/nuke");
    expect(smokeRows()).toHaveLength(1);
    expect(smokeRows()[0]).toHaveTextContent("Outside");
    const levels = within(screen.getByRole("group", { name: "Level" }));
    await userEvent.click(levels.getByRole("button", { name: "Lower" }));
    expect(currentLocation()).toBe("/maps/nuke?level=lower");
    expect(smokeRows()[0]).toHaveTextContent("Ramp");
  });

  it("has no level switch on single-level maps", () => {
    renderAt("/maps/mirage");
    expect(screen.queryByRole("group", { name: "Level" })).toBeNull();
  });

  it("says when a map has no smokes yet", () => {
    renderAt("/maps/ancient");
    expect(screen.getByText("No smokes on this map yet.")).toBeInTheDocument();
  });

  it("says when the filters match nothing", () => {
    renderAt("/maps/mirage?side=CT&area=B");
    expect(screen.getByText("No smokes match these filters.")).toBeInTheDocument();
  });

  it("shows Not found for an unknown map", () => {
    renderAt("/maps/overpass");
    expect(screen.getByRole("heading", { name: "Not found" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to maps" })).toHaveAttribute("href", "/");
  });

  it("shows Not found for an unknown smoke, linking back to the map", () => {
    renderAt("/maps/mirage/smokes/mirage-nope?side=T");
    expect(screen.getByRole("heading", { name: "Not found" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to Mirage" })).toHaveAttribute(
      "href",
      "/maps/mirage?side=T",
    );
  });
});
