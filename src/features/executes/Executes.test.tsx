import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderAt } from "../../test/render";

vi.mock("../../data", async () => (await import("../../test/fixtureData")).mockDataModule());
vi.mock("../smoke/VideoPlayer", () => ({
  VideoPlayer: ({ title }: { title: string }) => <div data-testid="video">{title}</div>,
}));

const currentLocation = () => screen.getByTestId("location").textContent;

describe("executes", () => {
  it("lists the map's executes on the Executes tab", async () => {
    renderAt("/maps/mirage");
    await userEvent.click(screen.getByRole("tab", { name: /Executes/ }));
    expect(currentLocation()).toBe("/maps/mirage?tab=executes");
    const rows = within(screen.getByRole("list", { name: "Executes" })).getAllByRole("link");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent("A execute");
    expect(rows[0]).toHaveTextContent("CT · Jungle");
    expect(rows[0]).toHaveAttribute("href", "/maps/mirage/executes/mirage-a-execute");
  });

  it("keeps the tab when the filters change", async () => {
    renderAt("/maps/mirage?tab=executes");
    const sides = within(screen.getByRole("group", { name: "Side" }));
    await userEvent.click(sides.getByRole("button", { name: "CT" }));
    expect(currentLocation()).toBe("/maps/mirage?side=CT&tab=executes");
    expect(screen.getByText("No executes match these filters.")).toBeInTheDocument();
  });

  it("says when a map has no executes yet", () => {
    renderAt("/maps/nuke?tab=executes");
    expect(screen.getByText("No executes on this map yet.")).toBeInTheDocument();
  });

  it("shows an execute's smokes numbered on the radar, in throw order", () => {
    renderAt("/maps/mirage/executes/mirage-a-execute");
    expect(screen.getByRole("heading", { name: "A execute", level: 2 })).toBeInTheDocument();
    expect(screen.getAllByTestId("landing-marker").map((marker) => marker.textContent)).toEqual([
      "1",
      "2",
    ]);
    expect(screen.getByRole("button", { name: /^1\s*CT from T Ramp/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^2\s*Jungle from T Ramp/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to the list" })).toHaveAttribute(
      "href",
      "/maps/mirage?tab=executes",
    );
  });

  it("expands one smoke at a time", async () => {
    renderAt("/maps/mirage/executes/mirage-a-execute");
    await userEvent.click(screen.getByRole("button", { name: /CT from T Ramp/ }));
    expect(screen.getByText("Run + jump throw · left click")).toBeInTheDocument();
    expect(screen.getAllByTestId("video")).toHaveLength(1);
    await userEvent.click(screen.getByRole("button", { name: /Jungle from T Ramp/ }));
    expect(screen.getAllByTestId("video")).toHaveLength(1);
    expect(screen.getByTestId("video")).toHaveTextContent("Jungle from T Ramp");
  });

  it("shows Not found for an unknown execute", () => {
    renderAt("/maps/mirage/executes/mirage-nope");
    expect(screen.getByRole("heading", { name: "Not found" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to Mirage" })).toHaveAttribute(
      "href",
      "/maps/mirage?tab=executes",
    );
  });
});
