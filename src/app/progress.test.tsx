import { StrictMode } from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BACKUP_PREFIX, STORAGE_KEY, defaultProgress, recordAnswer } from "../lib/storage";
import { failingStorage, memoryStorage } from "../test/memoryStorage";
import { ProgressProvider, useProgress } from "./progress";

const fixedNow = () => new Date(2026, 9, 10, 9, 0);
const saved = (storage: ReturnType<typeof memoryStorage>) =>
  JSON.parse(storage.data.get(STORAGE_KEY) ?? "null");

function Probe({ lineupId = "mirage-a" }: { lineupId?: string }) {
  const { progress, status, cannotSave, today, answer } = useProgress();
  return (
    <div>
      <output data-testid="cards">{JSON.stringify(progress.cards)}</output>
      <output data-testid="flags">{`${status}|${cannotSave}|${today}`}</output>
      <button type="button" onClick={() => answer(lineupId, "got")}>
        Answer
      </button>
    </div>
  );
}

/** What the browser does in the other tabs when one tab changes localStorage. */
function storageEventFromAnotherTab() {
  fireEvent(window, new StorageEvent("storage", { key: STORAGE_KEY }));
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("ProgressProvider", () => {
  it("saves answers to storage", async () => {
    const storage = memoryStorage();
    render(
      <ProgressProvider storage={storage} now={fixedNow}>
        <Probe />
      </ProgressProvider>,
    );
    expect(screen.getByTestId("flags")).toHaveTextContent("empty|false|2026-10-10");
    await userEvent.click(screen.getByRole("button", { name: "Answer" }));
    const saved = JSON.parse(storage.data.get(STORAGE_KEY)!);
    expect(saved.cards["mirage-a"]).toEqual({
      box: 2,
      due: "2026-10-12",
      lastReviewed: "2026-10-10",
    });
    expect(saved.newToday).toEqual({ date: "2026-10-10", count: 1 });
  });

  it("keeps working in memory, and says so, when the browser refuses to store", async () => {
    render(
      <ProgressProvider storage={failingStorage()} now={fixedNow}>
        <Probe />
      </ProgressProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Answer" }));
    expect(screen.getByTestId("flags")).toHaveTextContent("empty|true");
    expect(screen.getByTestId("cards")).toHaveTextContent("mirage-a");
  });

  it("treats missing storage as unavailable", () => {
    render(
      <ProgressProvider storage={null} now={fixedNow}>
        <Probe />
      </ProgressProvider>,
    );
    expect(screen.getByTestId("flags")).toHaveTextContent("unavailable|true");
  });
});

describe("ProgressProvider's date", () => {
  it.each([
    ["the page becomes visible again", () => fireEvent(document, new Event("visibilitychange"))],
    ["the window gets focus", () => fireEvent(window, new Event("focus"))],
    ["the page is shown again", () => fireEvent(window, new Event("pageshow"))],
  ])("moves to the new day when %s", (_, event) => {
    let clock = new Date(2026, 9, 10, 22, 0);
    render(
      <ProgressProvider storage={memoryStorage()} now={() => clock}>
        <Probe />
      </ProgressProvider>,
    );
    expect(screen.getByTestId("flags")).toHaveTextContent("2026-10-10");
    // The next morning; a phone kept the page in memory overnight.
    clock = new Date(2026, 9, 11, 8, 0);
    event();
    expect(screen.getByTestId("flags")).toHaveTextContent("2026-10-11");
  });

  it("moves to the new day at local midnight while the page stays open", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    let clock = new Date(2026, 9, 10, 23, 59, 30);
    render(
      <ProgressProvider storage={memoryStorage()} now={() => clock}>
        <Probe />
      </ProgressProvider>,
    );
    act(() => vi.advanceTimersByTime(29_000));
    expect(screen.getByTestId("flags")).toHaveTextContent("2026-10-10");
    clock = new Date(2026, 9, 11, 0, 0, 0);
    act(() => vi.advanceTimersByTime(1_000));
    expect(screen.getByTestId("flags")).toHaveTextContent("2026-10-11");
    // And again the night after.
    clock = new Date(2026, 9, 12, 0, 0, 0);
    act(() => vi.advanceTimersByTime(24 * 60 * 60 * 1000));
    expect(screen.getByTestId("flags")).toHaveTextContent("2026-10-12");
  });
});

describe("ProgressProvider with other tabs", () => {
  it("keeps answers another tab saved instead of overwriting them", async () => {
    const storage = memoryStorage();
    const older = render(
      <ProgressProvider storage={storage} now={fixedNow}>
        <Probe lineupId="mirage-a" />
      </ProgressProvider>,
    );
    const newer = render(
      <ProgressProvider storage={storage} now={fixedNow}>
        <Probe lineupId="mirage-b" />
      </ProgressProvider>,
    );
    await userEvent.click(within(newer.container).getByRole("button", { name: "Answer" }));
    await waitFor(() => expect(saved(storage)?.cards["mirage-b"]).toBeDefined());
    storageEventFromAnotherTab();
    expect(within(older.container).getByTestId("cards")).toHaveTextContent("mirage-b");

    await userEvent.click(within(older.container).getByRole("button", { name: "Answer" }));
    await waitFor(() => expect(saved(storage)?.cards["mirage-a"]).toBeDefined());
    expect(Object.keys(saved(storage).cards)).toEqual(["mirage-b", "mirage-a"]);
  });

  it("applies another tab's change without saving it back", async () => {
    const storage = memoryStorage();
    const setItem = vi.spyOn(storage, "setItem");
    render(
      <ProgressProvider storage={storage} now={fixedNow}>
        <Probe />
      </ProgressProvider>,
    );
    const other = JSON.stringify(recordAnswer(defaultProgress(), "mirage-b", "got", "2026-10-10"));
    storage.data.set(STORAGE_KEY, other);
    storageEventFromAnotherTab();
    expect(screen.getByTestId("cards")).toHaveTextContent("mirage-b");
    // Effects have run; nothing was written, so no event bounces back to the other tab.
    await act(async () => undefined);
    expect(setItem).not.toHaveBeenCalled();
    expect(storage.data.get(STORAGE_KEY)).toBe(other);
    expect(screen.getByTestId("flags")).toHaveTextContent("empty|false");

    // A later answer here is saved on top of it.
    await userEvent.click(screen.getByRole("button", { name: "Answer" }));
    await waitFor(() => expect(setItem).toHaveBeenCalledTimes(1));
    expect(Object.keys(saved(storage).cards)).toEqual(["mirage-b", "mirage-a"]);
  });

  it("re-reads storage when the page becomes visible again", async () => {
    const storage = memoryStorage();
    const setItem = vi.spyOn(storage, "setItem");
    render(
      <ProgressProvider storage={storage} now={fixedNow}>
        <Probe />
      </ProgressProvider>,
    );
    // Another tab saved while this one was hidden, and its storage event was missed.
    storage.data.set(
      STORAGE_KEY,
      JSON.stringify(recordAnswer(defaultProgress(), "mirage-b", "got", "2026-10-10")),
    );
    fireEvent(document, new Event("visibilitychange"));
    expect(screen.getByTestId("cards")).toHaveTextContent("mirage-b");
    await act(async () => undefined);
    expect(setItem).not.toHaveBeenCalled();
  });

  it("ignores stored values it can't read, or that were removed", async () => {
    const storage = memoryStorage();
    render(
      <ProgressProvider storage={storage} now={fixedNow}>
        <Probe />
      </ProgressProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Answer" }));
    await waitFor(() => expect(saved(storage)?.cards["mirage-a"]).toBeDefined());
    const setItem = vi.spyOn(storage, "setItem");

    storage.data.set(STORAGE_KEY, "{not json");
    storageEventFromAnotherTab();
    storage.data.delete(STORAGE_KEY);
    storageEventFromAnotherTab();
    fireEvent(window, new StorageEvent("storage", { key: null }));
    await act(async () => undefined);

    expect(screen.getByTestId("cards")).toHaveTextContent("mirage-a");
    expect(setItem).not.toHaveBeenCalled();
    expect([...storage.data.keys()].some((key) => key.startsWith(BACKUP_PREFIX))).toBe(false);
  });

  it("listens once, and cleans up when it unmounts, even in StrictMode", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const listeners = (target: Window | Document) => {
      const add = vi.spyOn(target, "addEventListener");
      const remove = vi.spyOn(target, "removeEventListener");
      const count = (spy: typeof add, type: string) =>
        spy.mock.calls.filter(([name]) => name === type).length;
      return (type: string) => count(add, type) - count(remove, type);
    };
    const onWindow = listeners(window);
    const onDocument = listeners(document);
    const active = () => [
      onWindow("storage"),
      onWindow("focus"),
      onWindow("pageshow"),
      onDocument("visibilitychange"),
      vi.getTimerCount(),
    ];

    const { unmount } = render(
      <StrictMode>
        <ProgressProvider storage={memoryStorage()} now={fixedNow}>
          <Probe />
        </ProgressProvider>
      </StrictMode>,
    );
    expect(active()).toEqual([1, 1, 1, 1, 1]);
    unmount();
    expect(active()).toEqual([0, 0, 0, 0, 0]);
  });
});
