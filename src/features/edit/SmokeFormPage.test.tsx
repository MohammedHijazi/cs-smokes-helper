import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { replaceMapFile } from "../../data";
import {
  clickRadar,
  mockEditServer,
  mockPlacementRadar,
  mockServerDown,
} from "../../test/editHelpers";
import { fakeYouTube, type FakeYouTube } from "../../test/fakeYouTube";
import { FIXTURE_DATA, restoreFixtureData } from "../../test/fixtureData";
import { renderAt } from "../../test/render";

vi.mock("../../data", async () => (await import("../../test/fixtureData")).mockDataModule());
vi.mock("../smoke/VideoPlayer", () => ({
  VideoPlayer: ({ title }: { title: string }) => <div data-testid="video">{title}</div>,
}));
const api = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock("../smoke/youtubeApi", () => ({ loadYouTubeApi: api.load }));

const NOW = () => new Date(2026, 9, 12, 12);
let yt: FakeYouTube;

beforeEach(() => {
  yt = fakeYouTube();
  api.load.mockResolvedValue(yt.YT);
});
afterEach(async () => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  await restoreFixtureData();
});

const currentLocation = () => screen.getByTestId("location").textContent;
const group = (name: string) => within(screen.getByRole("group", { name }));
const saveButton = () => screen.getByRole("button", { name: "Save" });

/** Renders a form route and waits for the lazily loaded page. */
async function openForm(path: string) {
  renderAt(path, { now: NOW });
  await screen.findByRole("form", {}, { timeout: 5000 });
  mockPlacementRadar(500);
}

async function renameWindow(user: ReturnType<typeof userEvent.setup>, name = "Window box") {
  await openForm("/maps/mirage/smokes/mirage-window-from-t-spawn/edit");
  await user.clear(screen.getByLabelText("Name"));
  await user.type(screen.getByLabelText("Name"), name);
}

describe("Add smoke", () => {
  it("adds a smoke from a YouTube link and opens its card", async () => {
    const server = mockEditServer();
    const user = userEvent.setup();
    await openForm("/maps/mirage/smokes/new?side=T");

    await user.click(screen.getByLabelText("Video link"));
    await user.paste("https://youtu.be/dQw4w9WgXcQ?t=95");
    expect(screen.getByLabelText("Start (s)")).toHaveValue(95);
    const player = await yt.ready();
    player.getCurrentTime.mockReturnValue(111.2);
    await user.click(screen.getByRole("button", { name: "Set end" }));
    expect(screen.getByLabelText("End (s)")).toHaveValue(112);

    await user.type(screen.getByLabelText("Name"), "Stairs");
    await user.type(screen.getByLabelText("From"), "T Ramp");
    expect(screen.getByText("mirage-stairs-from-t-ramp")).toBeInTheDocument();
    expect(group("Side").getByRole("button", { name: "T" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await user.click(group("Area").getByRole("button", { name: "A" }));
    await user.click(group("Movement").getByRole("button", { name: "Run" }));
    await user.click(screen.getByLabelText("Jump"));
    expect(screen.getByText("Run + jump throw · left click")).toBeInTheDocument();

    clickRadar(150, 100);
    expect(group("Placing").getByRole("button", { name: "Stand" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    clickRadar(350, 150);
    expect(screen.getByText("Land 0.300, 0.200 · Stand 0.700, 0.300")).toBeInTheDocument();

    await user.click(saveButton());
    await waitFor(() =>
      expect(currentLocation()).toBe("/maps/mirage/smokes/mirage-stairs-from-t-ramp?side=T"),
    );
    expect(server.sent().file.lineups.at(-1)).toEqual({
      id: "mirage-stairs-from-t-ramp",
      name: "Stairs",
      from: "T Ramp",
      side: "T",
      area: "A",
      throw: { movement: "run", jump: true, click: "left" },
      stand: { x: 0.7, y: 0.3 },
      land: { x: 0.3, y: 0.2 },
      video: { url: "https://youtu.be/dQw4w9WgXcQ?t=95", start: 95, end: 112 },
      status: "unreviewed",
      checkedOn: "2026-10-12",
    });
    expect(screen.getByRole("heading", { name: "Stairs", level: 2 })).toBeInTheDocument();
  });

  it("has no clip times for a link that isn't YouTube", async () => {
    const user = userEvent.setup();
    await openForm("/maps/mirage/smokes/new");
    await user.click(screen.getByLabelText("Video link"));
    await user.paste("https://csnades.gg/mirage/smokes/stairs");
    expect(screen.queryByLabelText("Start (s)")).toBeNull();
    expect(screen.getByRole("link", { name: "Open video ↗" })).toHaveAttribute(
      "href",
      "https://csnades.gg/mirage/smokes/stairs",
    );
  });

  it("lists what is missing and sends nothing", async () => {
    const server = mockEditServer();
    await openForm("/maps/mirage/smokes/new");
    await userEvent.click(saveButton());
    for (const text of [
      "Paste a video link",
      "Enter the spot the smoke covers",
      "Enter where it is thrown from",
      "Choose a side",
      "Choose an area",
      "Place the land spot on the radar Place the stand spot on the radar",
    ]) {
      expect(screen.getByText(text)).toBeInTheDocument();
    }
    expect(server.fetch).not.toHaveBeenCalled();
  });

  it("places a Nuke spot on the level shown", async () => {
    await openForm("/maps/nuke/smokes/new");
    await userEvent.click(group("Level").getByRole("button", { name: "Lower" }));
    clickRadar(200, 250);
    expect(screen.getByText(/^Land 0\.400, 0\.500 \(lower\)/)).toBeInTheDocument();
  });

  it("is offered on the map view, keeping the filters", () => {
    renderAt("/maps/mirage?side=CT");
    expect(screen.getByRole("link", { name: "+ Add smoke" })).toHaveAttribute(
      "href",
      "/maps/mirage/smokes/new?side=CT",
    );
  });
});

describe("Edit smoke", () => {
  it("keeps the id after a rename and dates a status change", async () => {
    const server = mockEditServer();
    const user = userEvent.setup();
    await renameWindow(user);
    await user.click(group("Status").getByRole("button", { name: "OK" }));
    expect(screen.getByText("Last checked 2026-10-12")).toBeInTheDocument();
    await user.click(saveButton());
    await waitFor(() =>
      expect(currentLocation()).toBe("/maps/mirage/smokes/mirage-window-from-t-spawn"),
    );
    expect(server.sent().file.lineups[0]).toEqual({
      ...FIXTURE_DATA.mirage.lineups[0],
      name: "Window box",
      status: "ok",
      checkedOn: "2026-10-12",
    });
  });

  it("keeps the last-checked date when the status stays the same", async () => {
    const server = mockEditServer();
    const user = userEvent.setup();
    await renameWindow(user);
    await user.click(saveButton());
    await waitFor(() => expect(server.fetch).toHaveBeenCalled());
    expect(server.sent().file.lineups[0].checkedOn).toBe("2026-10-10");
  });

  it("opens a Nuke smoke on its landing level and keeps both levels when saved", async () => {
    const server = mockEditServer();
    const user = userEvent.setup();
    await openForm("/maps/nuke/smokes/nuke-ramp-from-lobby/edit");
    expect(group("Level").getByRole("button", { name: "Lower" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await user.type(screen.getByLabelText("Notes"), " Tight.");
    await user.click(saveButton());
    await waitFor(() => expect(server.fetch).toHaveBeenCalled());
    const saved = server.sent().file.lineups[1];
    expect(saved.stand).toEqual({ x: 0.3, y: 0.6, level: "upper" });
    expect(saved.land).toEqual({ x: 0.4, y: 0.7, level: "lower" });
  });

  it("blocks a side change that an execute doesn't allow", async () => {
    const server = mockEditServer();
    await openForm("/maps/mirage/smokes/mirage-ct-from-t-ramp/edit");
    await userEvent.click(group("Side").getByRole("button", { name: "CT" }));
    await userEvent.click(saveButton());
    expect(await screen.findByRole("alert")).toHaveTextContent(
      `Execute 'A execute': "mirage-ct-from-t-ramp" is a CT smoke but the execute is T`,
    );
    expect(server.fetch).not.toHaveBeenCalled();
  });

  it("shows Not found for an unknown smoke", async () => {
    renderAt("/maps/mirage/smokes/mirage-nope/edit?side=T");
    expect(
      await screen.findByRole("heading", { name: "Not found" }, { timeout: 5000 }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to Mirage" })).toHaveAttribute(
      "href",
      "/maps/mirage?side=T",
    );
  });
});

describe("saving", () => {
  it("shows the server's field errors and keeps the form", async () => {
    mockEditServer(() => ({
      status: 400,
      json: { errors: [{ path: "lineups[0].notes", message: "must be at most 280 characters" }] },
    }));
    const user = userEvent.setup();
    await openForm("/maps/mirage/smokes/mirage-window-from-t-spawn/edit");
    await user.type(screen.getByLabelText("Notes"), "!");
    await user.click(saveButton());
    expect(await screen.findByText("must be at most 280 characters")).toBeInTheDocument();
    expect(screen.getByLabelText("Notes")).toHaveValue(
      "Aim at the top-left corner of the antenna!",
    );
  });

  it("offers a reload when the map changed on disk", async () => {
    mockEditServer(() => ({ status: 409, json: { error: "changed" } }));
    const user = userEvent.setup();
    await renameWindow(user);
    await user.click(saveButton());
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This map changed outside this page (another tab, a hand edit or git). Reload to get the latest version.",
    );
    expect(screen.getByRole("button", { name: "Reload" })).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toHaveValue("Window box");
  });

  it("refuses to save over a hand edit to the same smoke", async () => {
    const server = mockEditServer();
    const user = userEvent.setup();
    await renameWindow(user);
    act(() =>
      replaceMapFile("mirage", {
        ...FIXTURE_DATA.mirage,
        lineups: FIXTURE_DATA.mirage.lineups.map((lineup, i) =>
          i === 0 ? { ...lineup, notes: "Edited by hand." } : lineup,
        ),
      }),
    );
    await user.click(saveButton());
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This map changed outside this page (another tab, a hand edit or git). Reload to get the latest version.",
    );
    expect(screen.getByRole("button", { name: "Reload" })).toBeInTheDocument();
    expect(server.fetch).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Name")).toHaveValue("Window box");
  });

  it("keeps a hand edit to a different smoke", async () => {
    const server = mockEditServer();
    const user = userEvent.setup();
    await renameWindow(user);
    act(() =>
      replaceMapFile("mirage", {
        ...FIXTURE_DATA.mirage,
        lineups: FIXTURE_DATA.mirage.lineups.map((lineup, i) =>
          i === 1 ? { ...lineup, notes: "Edited by hand." } : lineup,
        ),
      }),
    );
    await user.click(saveButton());
    await waitFor(() =>
      expect(currentLocation()).toBe("/maps/mirage/smokes/mirage-window-from-t-spawn"),
    );
    const sent = server.sent().file.lineups;
    expect(sent[0].name).toBe("Window box");
    expect(sent[1].notes).toBe("Edited by hand.");
  });

  it("says when the dev server isn't running", async () => {
    mockServerDown();
    const user = userEvent.setup();
    await renameWindow(user);
    await user.click(saveButton());
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Can't reach the dev server — is npm run dev running?",
    );
  });

  it("sends one save for a double-click", async () => {
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = () => resolve();
    });
    const server = mockEditServer(async (body) => {
      await gate;
      return { status: 200, json: { file: body.file } };
    });
    const user = userEvent.setup();
    await renameWindow(user);
    await user.dblClick(saveButton());
    expect(server.fetch).toHaveBeenCalledTimes(1);
    expect(saveButton()).toBeDisabled();
    release();
    await waitFor(() =>
      expect(currentLocation()).toBe("/maps/mirage/smokes/mirage-window-from-t-spawn"),
    );
  });
});

describe("leaving the form", () => {
  it("goes back to the card without asking when nothing changed", async () => {
    const confirm = vi.spyOn(window, "confirm");
    await openForm("/maps/mirage/smokes/mirage-window-from-t-spawn/edit?area=Mid");
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(confirm).not.toHaveBeenCalled();
    expect(currentLocation()).toBe("/maps/mirage/smokes/mirage-window-from-t-spawn?area=Mid");
  });

  it("asks before discarding changes", async () => {
    const confirm = vi
      .spyOn(window, "confirm")
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);
    const user = userEvent.setup();
    await openForm("/maps/mirage/smokes/new");
    await user.type(screen.getByLabelText("Name"), "Stairs");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(confirm).toHaveBeenCalledWith("Discard changes?");
    expect(currentLocation()).toBe("/maps/mirage/smokes/new");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(currentLocation()).toBe("/maps/mirage");
  });

  it("warns before the tab closes with unsaved changes", async () => {
    await openForm("/maps/mirage/smokes/new");
    const clean = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(clean);
    expect(clean.defaultPrevented).toBe(false);
    await userEvent.type(screen.getByLabelText("Name"), "S");
    const dirty = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(dirty);
    expect(dirty.defaultPrevented).toBe(true);
  });
});

describe("outside dev", () => {
  it("has no add link and no form route", () => {
    vi.stubEnv("DEV", false);
    const view = renderAt("/maps/mirage");
    expect(screen.queryByRole("link", { name: "+ Add smoke" })).toBeNull();
    view.unmount();
    renderAt("/maps/mirage/smokes/new");
    expect(screen.getByRole("heading", { name: "Not found" })).toBeInTheDocument();
  });
});
