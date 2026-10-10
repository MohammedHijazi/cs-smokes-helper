import { screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderAt } from "../test/render";

vi.mock("../data", async () => (await import("../test/fixtureData")).mockDataModule());

describe("app shell", () => {
  it("lists the seven maps in order, with their smoke counts", () => {
    renderAt("/");
    const tiles = within(screen.getByRole("list", { name: "Maps" })).getAllByRole("link");
    expect(tiles.map((tile) => tile.getAttribute("href"))).toEqual([
      "/maps/ancient",
      "/maps/anubis",
      "/maps/cache",
      "/maps/dust2",
      "/maps/inferno",
      "/maps/mirage",
      "/maps/nuke",
    ]);
    expect(tiles[5]).toHaveTextContent("Mirage");
    expect(tiles[5]).toHaveTextContent("0/4 known");
    expect(tiles[0]).toHaveTextContent("0/0 known");
  });

  it("shows the credits in the footer", () => {
    renderAt("/");
    expect(screen.getByRole("contentinfo")).toHaveTextContent(
      "Counter-Strike 2, map names and radar images © Valve Corporation. Videos © their creators. Not affiliated with Valve.",
    );
  });

  it("shows Not found for unknown routes, with a way home", () => {
    renderAt("/nowhere");
    expect(screen.getByRole("heading", { name: "Not found" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to maps" })).toHaveAttribute("href", "/");
  });
});
