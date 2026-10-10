import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { replaceMapFile } from "../../data";
import { mockEditServer } from "../../test/editHelpers";
import { FIXTURE_DATA, restoreFixtureData } from "../../test/fixtureData";
import { makeLineup, makeMapFile } from "../../test/fixtures";
import { renderAt } from "../../test/render";

vi.mock("../../data", async () => (await import("../../test/fixtureData")).mockDataModule());
vi.mock("../smoke/VideoPlayer", () => ({
  VideoPlayer: ({ title }: { title: string }) => <div data-testid="video">{title}</div>,
}));

afterEach(async () => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  await restoreFixtureData();
});

const currentLocation = () => screen.getByTestId("location").textContent;
const group = (name: string) => within(screen.getByRole("group", { name }));
const rows = () =>
  within(screen.getByRole("list", { name: "Smokes in throw order" })).queryAllByRole("listitem");
const addSmoke = () => screen.getByRole("combobox", { name: "Add smoke" });

async function openForm(path: string) {
  renderAt(path);
  await screen.findByRole("form", {}, { timeout: 5000 });
}

describe("Add execute", () => {
  it("builds an execute from the map's smokes, in the order chosen", async () => {
    const server = mockEditServer();
    const user = userEvent.setup();
    await openForm("/maps/mirage/executes/new");
    await user.type(screen.getByLabelText("Name"), "B split");
    expect(group("Side").getByRole("button", { name: "T" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(within(addSmoke()).queryByRole("option", { name: "Top Mid · CT Spawn" })).toBeNull();

    await user.selectOptions(addSmoke(), "mirage-window-from-t-spawn");
    await user.selectOptions(addSmoke(), "mirage-market-window-from-b-apps");
    await user.click(screen.getByRole("button", { name: "Move Market Window up" }));
    expect(rows().map((row) => row.textContent)).toEqual([
      expect.stringContaining("1. Market Window"),
      expect.stringContaining("2. Window"),
    ]);
    expect(screen.getAllByTestId("landing-marker")).toHaveLength(2);
    expect(screen.getByText("mirage-b-split")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(currentLocation()).toBe("/maps/mirage/executes/mirage-b-split"));
    expect(server.sent().file.executes.at(-1)).toEqual({
      id: "mirage-b-split",
      name: "B split",
      side: "T",
      lineupIds: ["mirage-market-window-from-b-apps", "mirage-window-from-t-spawn"],
    });
    expect(screen.getByRole("heading", { name: "B split", level: 2 })).toBeInTheDocument();
  });

  it("needs at least 2 smokes", async () => {
    const server = mockEditServer();
    const user = userEvent.setup();
    await openForm("/maps/mirage/executes/new");
    await user.type(screen.getByLabelText("Name"), "Solo");
    await user.selectOptions(addSmoke(), "mirage-window-from-t-spawn");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("needs at least 2 smokes")).toBeInTheDocument();
    expect(server.fetch).not.toHaveBeenCalled();
  });

  it("stops offering smokes at 8", async () => {
    replaceMapFile(
      "ancient",
      makeMapFile(
        "ancient",
        Array.from({ length: 9 }, (_, i) =>
          makeLineup({ id: `ancient-smoke-${i + 1}`, name: `Smoke ${i + 1}` }),
        ),
      ),
    );
    const user = userEvent.setup();
    await openForm("/maps/ancient/executes/new");
    for (let i = 1; i <= 8; i += 1) await user.selectOptions(addSmoke(), `ancient-smoke-${i}`);
    expect(rows()).toHaveLength(8);
    expect(addSmoke()).toBeDisabled();
  });

  it("is offered on the Executes tab, keeping the filters", () => {
    renderAt("/maps/mirage?tab=executes&side=T");
    expect(screen.getByRole("link", { name: "+ Add execute" })).toHaveAttribute(
      "href",
      "/maps/mirage/executes/new?side=T",
    );
  });
});

describe("Edit execute", () => {
  it("edits the smokes, keeping the id", async () => {
    const server = mockEditServer();
    const user = userEvent.setup();
    await openForm("/maps/mirage/executes/mirage-a-execute/edit");
    await user.click(screen.getByRole("button", { name: "Remove Jungle" }));
    await user.selectOptions(addSmoke(), "mirage-window-from-t-spawn");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(currentLocation()).toBe("/maps/mirage/executes/mirage-a-execute"));
    expect(server.sent().file.executes[0]).toEqual({
      id: "mirage-a-execute",
      name: "A execute",
      side: "T",
      lineupIds: ["mirage-ct-from-t-ramp", "mirage-window-from-t-spawn"],
    });
  });

  it("refuses to save over a hand edit to the same execute", async () => {
    const server = mockEditServer();
    const user = userEvent.setup();
    await openForm("/maps/mirage/executes/mirage-a-execute/edit");
    await user.type(screen.getByLabelText("Name"), "!");
    act(() =>
      replaceMapFile("mirage", {
        ...FIXTURE_DATA.mirage,
        executes: FIXTURE_DATA.mirage.executes.map((execute) => ({
          ...execute,
          notes: "Edited by hand.",
        })),
      }),
    );
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This map changed outside this page (another tab, a hand edit or git). Reload to get the latest version.",
    );
    expect(screen.getByRole("button", { name: "Reload" })).toBeInTheDocument();
    expect(server.fetch).not.toHaveBeenCalled();
  });

  it("asks before a side change removes smokes", async () => {
    const confirm = vi
      .spyOn(window, "confirm")
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);
    const user = userEvent.setup();
    await openForm("/maps/mirage/executes/mirage-a-execute/edit");
    await user.click(group("Side").getByRole("button", { name: "CT" }));
    expect(confirm).toHaveBeenCalledWith("Changing the side removes 2 smokes from the other side.");
    expect(rows()).toHaveLength(2);
    await user.click(group("Side").getByRole("button", { name: "CT" }));
    expect(rows()).toHaveLength(0);
    expect(group("Side").getByRole("button", { name: "CT" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("shows Not found for an unknown execute", async () => {
    renderAt("/maps/mirage/executes/mirage-nope/edit");
    expect(
      await screen.findByRole("heading", { name: "Not found" }, { timeout: 5000 }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to Mirage" })).toHaveAttribute(
      "href",
      "/maps/mirage?tab=executes",
    );
  });
});
