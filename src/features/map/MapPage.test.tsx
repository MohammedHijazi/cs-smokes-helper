import { fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderAt } from "../../test/render";

vi.mock("../../data", async () => (await import("../../test/fixtureData")).mockDataModule());
vi.mock("../smoke/VideoPlayer", () => ({
  VideoPlayer: ({ title }: { title: string }) => <div data-testid="video">{title}</div>,
}));

const smokeRows = () => within(screen.getByRole("list", { name: "Smokes" })).getAllByRole("link");
const currentLocation = () => screen.getByTestId("location").textContent;

function mockRadarSize(size: number) {
  vi.spyOn(screen.getByTestId("radar"), "getBoundingClientRect").mockReturnValue({
    left: 0,
    top: 0,
    width: size,
    height: size,
  } as DOMRect);
}

describe("MapPage", () => {
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
    expect(screen.getAllByTestId("stand-dot").length).toBeGreaterThan(0);
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
