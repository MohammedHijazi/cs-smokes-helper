import { act, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { replaceMapFile } from "../../data";
import { restoreFixtureData } from "../../test/fixtureData";
import { makeLineup, makeMapFile } from "../../test/fixtures";
import { renderAt } from "../../test/render";

vi.mock("../../data", async () => (await import("../../test/fixtureData")).mockDataModule());

afterEach(() => restoreFixtureData());

describe("HomePage", () => {
  it("updates a map's count when edit mode saves the map", () => {
    renderAt("/");
    expect(screen.getByRole("link", { name: /Ancient/ })).toHaveTextContent("0/0 known");
    act(() =>
      replaceMapFile(
        "ancient",
        makeMapFile("ancient", [makeLineup({ id: "ancient-cave-from-t-spawn" })]),
      ),
    );
    expect(screen.getByRole("link", { name: /Ancient/ })).toHaveTextContent("0/1 known");
  });
});
