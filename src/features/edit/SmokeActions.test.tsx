import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockEditServer } from "../../test/editHelpers";
import { restoreFixtureData } from "../../test/fixtureData";
import { renderAt } from "../../test/render";

vi.mock("../../data", async () => (await import("../../test/fixtureData")).mockDataModule());
vi.mock("../smoke/VideoPlayer", () => ({
  VideoPlayer: ({ title }: { title: string }) => <div data-testid="video">{title}</div>,
}));

const NOW = () => new Date(2026, 9, 12, 12);

afterEach(async () => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  await restoreFixtureData();
});

const currentLocation = () => screen.getByTestId("location").textContent;
/** Waits for a lazily loaded edit button. */
const button = (name: string) => screen.findByRole("button", { name }, { timeout: 5000 });
const CHANGED =
  "This map changed outside this page (another tab, a hand edit or git). Reload to get the latest version.";

// Fixture Mirage order: Window (unreviewed, Mid), CT (unreviewed, A), Jungle (unreviewed, A),
// Top Mid (ok, CT side), Market Window (broken, B). "A execute" = CT + Jungle.

describe("Mark reviewed", () => {
  it("marks the smoke ok today and opens the next unreviewed one", async () => {
    const server = mockEditServer();
    renderAt("/maps/mirage/smokes/mirage-window-from-t-spawn", { now: NOW });
    await userEvent.click(await button("Mark reviewed"));
    await waitFor(() =>
      expect(currentLocation()).toBe("/maps/mirage/smokes/mirage-ct-from-t-ramp"),
    );
    expect(server.sent().file.lineups[0]).toMatchObject({
      id: "mirage-window-from-t-spawn",
      status: "ok",
      checkedOn: "2026-10-12",
    });
    expect(screen.getByRole("heading", { name: "CT", level: 2 })).toBeInTheDocument();
  });

  it("wraps round within the filtered list", async () => {
    mockEditServer();
    renderAt("/maps/mirage/smokes/mirage-jungle-from-t-ramp?area=A", { now: NOW });
    await userEvent.click(await button("Mark reviewed"));
    await waitFor(() =>
      expect(currentLocation()).toBe("/maps/mirage/smokes/mirage-ct-from-t-ramp?area=A"),
    );
  });

  it("starts from the top of the list for a smoke the filters exclude", async () => {
    mockEditServer();
    renderAt("/maps/mirage/smokes/mirage-window-from-t-spawn?area=A", { now: NOW });
    await userEvent.click(await button("Mark reviewed"));
    await waitFor(() =>
      expect(currentLocation()).toBe("/maps/mirage/smokes/mirage-ct-from-t-ramp?area=A"),
    );
  });

  it("says when no unreviewed smokes are left, and stays", async () => {
    const server = mockEditServer();
    renderAt("/maps/mirage/smokes/mirage-top-mid-from-ct-spawn?side=CT", { now: NOW });
    await userEvent.click(await button("Mark reviewed"));
    expect(await screen.findByText("No unreviewed smokes left in this list.")).toBeInTheDocument();
    expect(currentLocation()).toBe("/maps/mirage/smokes/mirage-top-mid-from-ct-spawn?side=CT");
    expect(server.sent().file.lineups[3]).toMatchObject({ status: "ok", checkedOn: "2026-10-12" });
  });

  it("shows a save problem and stays", async () => {
    mockEditServer(() => ({ status: 409, json: { error: "changed" } }));
    renderAt("/maps/mirage/smokes/mirage-window-from-t-spawn", { now: NOW });
    await userEvent.click(await button("Mark reviewed"));
    expect(await screen.findByText(CHANGED)).toBeInTheDocument();
    expect(currentLocation()).toBe("/maps/mirage/smokes/mirage-window-from-t-spawn");
  });
});

describe("Edit and Delete", () => {
  it("links to the edit form, keeping the filters", async () => {
    renderAt("/maps/mirage/smokes/mirage-window-from-t-spawn?side=T");
    await button("Mark reviewed");
    expect(screen.getByRole("link", { name: "Edit" })).toHaveAttribute(
      "href",
      "/maps/mirage/smokes/mirage-window-from-t-spawn/edit?side=T",
    );
  });

  it("deletes a smoke after confirmation, cleaning up executes", async () => {
    const server = mockEditServer();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    renderAt("/maps/mirage/smokes/mirage-ct-from-t-ramp?area=A");
    await userEvent.click(await button("Delete"));
    expect(confirm).toHaveBeenCalledWith(
      "Delete 'CT from T Ramp'? 'A execute' is deleted too, because it would have fewer than 2 smokes.",
    );
    await waitFor(() => expect(currentLocation()).toBe("/maps/mirage?area=A"));
    const file = server.sent().file;
    expect(file.lineups.map((lineup) => lineup.id)).not.toContain("mirage-ct-from-t-ramp");
    expect(file.executes).toEqual([]);
  });

  it("does nothing when the delete is cancelled", async () => {
    const server = mockEditServer();
    vi.spyOn(window, "confirm").mockReturnValue(false);
    renderAt("/maps/mirage/smokes/mirage-ct-from-t-ramp");
    await userEvent.click(await button("Delete"));
    expect(server.fetch).not.toHaveBeenCalled();
    expect(currentLocation()).toBe("/maps/mirage/smokes/mirage-ct-from-t-ramp");
  });
});

describe("outside dev", () => {
  it("has no edit buttons on the card", () => {
    vi.stubEnv("DEV", false);
    renderAt("/maps/mirage/smokes/mirage-window-from-t-spawn");
    expect(screen.queryByRole("button", { name: "Mark reviewed" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Edit" })).toBeNull();
  });
});
