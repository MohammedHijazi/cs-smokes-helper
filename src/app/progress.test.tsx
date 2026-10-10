import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { STORAGE_KEY } from "../lib/storage";
import { failingStorage, memoryStorage } from "../test/memoryStorage";
import { ProgressProvider, useProgress } from "./progress";

const fixedNow = () => new Date(2026, 9, 10, 9, 0);

function Probe() {
  const { progress, status, cannotSave, today, answer } = useProgress();
  return (
    <div>
      <output data-testid="cards">{JSON.stringify(progress.cards)}</output>
      <output data-testid="flags">{`${status}|${cannotSave}|${today}`}</output>
      <button type="button" onClick={() => answer("mirage-a", "got")}>
        Answer
      </button>
    </div>
  );
}

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
