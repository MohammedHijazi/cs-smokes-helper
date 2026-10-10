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

afterEach(async () => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  await restoreFixtureData();
});

const currentLocation = () => screen.getByTestId("location").textContent;
const deleteButton = () => screen.findByRole("button", { name: "Delete" }, { timeout: 5000 });

describe("ExecuteActions", () => {
  it("links to the edit form", async () => {
    renderAt("/maps/mirage/executes/mirage-a-execute?side=T");
    await deleteButton();
    expect(screen.getByRole("link", { name: "Edit" })).toHaveAttribute(
      "href",
      "/maps/mirage/executes/mirage-a-execute/edit?side=T",
    );
  });

  it("deletes the execute after confirmation and keeps its smokes", async () => {
    const server = mockEditServer();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    renderAt("/maps/mirage/executes/mirage-a-execute");
    await userEvent.click(await deleteButton());
    expect(confirm).toHaveBeenCalledWith("Delete the execute 'A execute'? Its smokes are kept.");
    await waitFor(() => expect(currentLocation()).toBe("/maps/mirage?tab=executes"));
    expect(server.sent().file.executes).toEqual([]);
    expect(server.sent().file.lineups).toHaveLength(5);
  });

  it("does nothing when the delete is cancelled", async () => {
    const server = mockEditServer();
    vi.spyOn(window, "confirm").mockReturnValue(false);
    renderAt("/maps/mirage/executes/mirage-a-execute");
    await userEvent.click(await deleteButton());
    expect(server.fetch).not.toHaveBeenCalled();
  });

  it("shows a Reload button when the map changed on disk, and stays", async () => {
    mockEditServer(() => ({ status: 409, json: { error: "changed" } }));
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderAt("/maps/mirage/executes/mirage-a-execute");
    await userEvent.click(await deleteButton());
    expect(
      await screen.findByText(
        "This map changed outside this page (another tab, a hand edit or git). Reload to get the latest version.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reload" })).toBeInTheDocument();
    expect(currentLocation()).toBe("/maps/mirage/executes/mirage-a-execute");
  });

  it("has no execute edit controls outside dev", async () => {
    // Warm the lazy edit component up with DEV on, so a missing guard would render it at once.
    const dev = renderAt("/maps/mirage/executes/mirage-a-execute");
    await deleteButton();
    dev.unmount();
    vi.stubEnv("DEV", false);
    const view = renderAt("/maps/mirage?tab=executes");
    expect(screen.queryByRole("link", { name: "+ Add execute" })).toBeNull();
    view.unmount();
    renderAt("/maps/mirage/executes/mirage-a-execute");
    expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();
  });
});
