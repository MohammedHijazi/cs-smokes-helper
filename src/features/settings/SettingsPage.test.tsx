import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { STORAGE_KEY, defaultProgress } from "../../lib/storage";
import { memoryStorage } from "../../test/memoryStorage";
import { renderAt } from "../../test/render";

vi.mock("../../data", async () => (await import("../../test/fixtureData")).mockDataModule());

const now = () => new Date(2026, 9, 10, 9, 0);
const saved = (storage: ReturnType<typeof memoryStorage>) =>
  JSON.parse(storage.data.get(STORAGE_KEY) ?? "null");

// jsdom 26 has no Blob.prototype.text() (browsers do), so add it for the import tests.
beforeAll(() => {
  if (typeof Blob.prototype.text === "function") return;
  Blob.prototype.text = function text(this: Blob) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsText(this);
    });
  };
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("SettingsPage", () => {
  it("is linked from the header", async () => {
    renderAt("/", { now });
    await userEvent.click(screen.getByRole("link", { name: "Settings" }));
    expect(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument();
  });

  it("saves the number of new smokes per day", async () => {
    const storage = memoryStorage();
    renderAt("/settings", { storage, now });
    const input = screen.getByLabelText("New smokes per day");
    await userEvent.clear(input);
    await userEvent.type(input, "15");
    expect(saved(storage).settings.newPerDay).toBe(15);
  });

  it("does not save numbers outside 1–30", async () => {
    const storage = memoryStorage();
    renderAt("/settings", { storage, now });
    const input = screen.getByLabelText("New smokes per day");
    await userEvent.clear(input);
    await userEvent.type(input, "45");
    expect(saved(storage).settings.newPerDay).toBe(4);
    expect(screen.getByText("Enter a whole number from 1 to 30.")).toBeInTheDocument();
  });

  it("exports progress as a dated JSON file", async () => {
    const createObjectURL = vi.fn(() => "blob:progress");
    Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
    renderAt("/settings", { now });
    await userEvent.click(screen.getByRole("button", { name: "Export progress" }));
    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect((click.mock.instances[0] as unknown as HTMLAnchorElement).download).toBe(
      "cs-smokes-progress-2026-10-10.json",
    );
  });

  it("imports a valid file after confirmation", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const storage = memoryStorage();
    renderAt("/settings", { storage, now });
    const imported = {
      ...defaultProgress(),
      settings: { ...defaultProgress().settings, newPerDay: 7 },
    };
    const file = new File([JSON.stringify(imported)], "progress.json", {
      type: "application/json",
    });
    await userEvent.upload(screen.getByLabelText("Import progress"), file);
    expect(await screen.findByText("Progress imported.")).toBeInTheDocument();
    expect(screen.getByLabelText("New smokes per day")).toHaveValue(7);
    expect(saved(storage).settings.newPerDay).toBe(7);
  });

  it("rejects a file that isn't a progress export and keeps the current progress", async () => {
    const storage = memoryStorage();
    renderAt("/settings", { storage, now });
    const file = new File(["nope"], "progress.json", { type: "application/json" });
    await userEvent.upload(screen.getByLabelText("Import progress"), file);
    expect(
      await screen.findByText("That file isn't a CS Smokes progress export."),
    ).toBeInTheDocument();
    expect(saved(storage)).toBeNull();
  });

  it("resets progress after confirmation, and not without it", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const storage = memoryStorage({
      [STORAGE_KEY]: JSON.stringify({
        ...defaultProgress(),
        settings: { ...defaultProgress().settings, newPerDay: 20 },
      }),
    });
    renderAt("/settings", { storage, now });
    await userEvent.click(screen.getByRole("button", { name: "Reset progress" }));
    expect(screen.getByLabelText("New smokes per day")).toHaveValue(20);
    confirm.mockReturnValue(true);
    await userEvent.click(screen.getByRole("button", { name: "Reset progress" }));
    expect(screen.getByText("Progress reset.")).toBeInTheDocument();
    expect(saved(storage)).toEqual(defaultProgress());
  });
});
