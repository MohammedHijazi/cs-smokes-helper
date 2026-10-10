import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { QueueItem } from "../../lib/scheduler";
import { STORAGE_KEY, defaultProgress, type Progress } from "../../lib/storage";
import { makeLineup } from "../../test/fixtures";
import { failingStorage, memoryStorage } from "../../test/memoryStorage";
import { renderAt } from "../../test/render";
import { StudyCard } from "./StudyCard";

vi.mock("../../data", async () => (await import("../../test/fixtureData")).mockDataModule());
vi.mock("../smoke/VideoPlayer", () => ({
  VideoPlayer: ({ title }: { title: string }) => <div data-testid="video">{title}</div>,
}));

const now = () => new Date(2026, 9, 10, 9, 0);
const stored = (progress: Progress) => memoryStorage({ [STORAGE_KEY]: JSON.stringify(progress) });

async function answerCard(rating: "Forgot" | "Got it") {
  await userEvent.click(screen.getByRole("button", { name: "Skip" }));
  const choices = within(screen.getByRole("group", { name: "Technique" })).getAllByRole("button");
  await userEvent.click(choices[0]);
  await userEvent.click(screen.getByRole("button", { name: rating }));
}

describe("StudyPage", () => {
  it("counts due and new smokes, leaving out broken ones", () => {
    renderAt("/study", { now });
    expect(screen.getByText("0 due · 6 new")).toBeInTheDocument();
  });

  it("is linked from home and from the header", async () => {
    renderAt("/", { now });
    expect(screen.getByRole("link", { name: "Study · 6 due" })).toHaveAttribute("href", "/study");
    await userEvent.click(screen.getByRole("link", { name: "Study" }));
    expect(screen.getByRole("heading", { name: "Study", level: 1 })).toBeInTheDocument();
  });

  it("walks through a card: stand spot, technique, clip, rating", async () => {
    const storage = memoryStorage();
    renderAt("/study", { storage, now });
    await userEvent.click(screen.getByRole("button", { name: "Start" }));
    expect(screen.getByRole("heading", { name: "Window — from T Spawn" })).toBeInTheDocument();

    const radar = screen.getByTestId("radar");
    vi.spyOn(radar, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      width: 500,
      height: 500,
    } as DOMRect);
    fireEvent.click(radar, { clientX: 400, clientY: 300 }); // the stand spot is (0.8, 0.6)
    expect(screen.getByTestId("tap-mark")).toHaveAttribute("data-correct", "true");
    expect(screen.getByText("✓ Right spot")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Jump throw · left click" }));
    expect(screen.getByText("✓ Right")).toBeInTheDocument();
    expect(screen.getByTestId("video")).toHaveTextContent("Window from T Spawn");

    await userEvent.click(screen.getByRole("button", { name: "Got it" }));
    const saved = JSON.parse(storage.data.get(STORAGE_KEY)!);
    expect(saved.cards["mirage-window-from-t-spawn"]).toEqual({
      box: 2,
      due: "2026-10-12",
      lastReviewed: "2026-10-10",
    });
    expect(screen.getByRole("heading", { name: "Outside — from T Roof" })).toBeInTheDocument();
  });

  it("marks a tap far from the stand spot as wrong", async () => {
    renderAt("/study", { now });
    await userEvent.click(screen.getByRole("button", { name: "Start" }));
    const radar = screen.getByTestId("radar");
    vi.spyOn(radar, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      width: 500,
      height: 500,
    } as DOMRect);
    fireEvent.click(radar, { clientX: 50, clientY: 50 });
    expect(screen.getByTestId("tap-mark")).toHaveAttribute("data-correct", "false");
    expect(screen.getByTestId("stand-dot")).toBeInTheDocument();
  });

  it("shows a forgotten smoke once more at the end, without changing its schedule twice", async () => {
    const progress = {
      ...defaultProgress(),
      settings: { ...defaultProgress().settings, maps: ["mirage"], sides: ["CT"] },
    } as Progress;
    const storage = stored(progress);
    renderAt("/study", { storage, now });
    expect(screen.getByText("0 due · 1 new")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Start" }));
    expect(screen.getByText("Card 1 of 1")).toBeInTheDocument();
    await answerCard("Forgot");
    expect(screen.getByText("Card 2 of 2 · repeat")).toBeInTheDocument();
    await answerCard("Got it");
    expect(screen.getByRole("heading", { name: "Session done" })).toBeInTheDocument();
    expect(screen.getByText("Got it: 0 · Forgot: 1")).toBeInTheDocument();
    expect(screen.getByText("Next review: 2026-10-11")).toBeInTheDocument();
    expect(
      JSON.parse(storage.data.get(STORAGE_KEY)!).cards["mirage-top-mid-from-ct-spawn"],
    ).toEqual({
      box: 1,
      due: "2026-10-11",
      lastReviewed: "2026-10-10",
    });
  });

  it("says when nothing is due and when the next review is", () => {
    const ids = [
      "mirage-window-from-t-spawn",
      "mirage-ct-from-t-ramp",
      "mirage-jungle-from-t-ramp",
      "mirage-top-mid-from-ct-spawn",
      "nuke-outside-from-t-roof",
      "nuke-ramp-from-lobby",
    ];
    const cards = Object.fromEntries(
      ids.map((id) => [id, { box: 2, due: "2026-10-12", lastReviewed: "2026-10-10" }]),
    );
    renderAt("/study", { storage: stored({ ...defaultProgress(), cards } as Progress), now });
    expect(screen.getByText("0 due · 0 new")).toBeInTheDocument();
    expect(
      screen.getByText("Nothing to study right now. Next review: 2026-10-12."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start" })).toBeDisabled();
  });

  it("says when no smokes match the chosen maps and sides", async () => {
    renderAt("/study", { now });
    await userEvent.click(screen.getByRole("checkbox", { name: "T" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "CT" }));
    expect(screen.getByText("No smokes match these choices.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start" })).toBeDisabled();
  });

  describe("Nuke levels", () => {
    const nukeOnly = () =>
      stored({
        ...defaultProgress(),
        settings: { ...defaultProgress().settings, maps: ["nuke"] },
      } as Progress);
    const studyCard = () => screen.getByRole("article", { name: /Study:/ });
    const radarImage = () => within(studyCard()).getByRole("img", { name: "Nuke radar" });

    it("opens on the stand spot's level, with a level switch that changes the radar and markers", async () => {
      renderAt("/study", { storage: nukeOnly(), now });
      await userEvent.click(screen.getByRole("button", { name: "Start" }));
      expect(screen.getByRole("heading", { name: "Outside — from T Roof" })).toBeInTheDocument();

      const card = within(studyCard());
      const level = within(card.getByRole("group", { name: "Level" }));
      expect(level.getByRole("button", { name: "Upper" })).toHaveAttribute("aria-pressed", "true");
      expect(level.getByRole("button", { name: "Lower" })).toHaveAttribute("aria-pressed", "false");
      expect(radarImage().getAttribute("src")).toContain("radars/nuke.webp");
      expect(card.getByTestId("landing-marker")).toBeInTheDocument();

      await userEvent.click(level.getByRole("button", { name: "Lower" }));
      expect(level.getByRole("button", { name: "Lower" })).toHaveAttribute("aria-pressed", "true");
      expect(radarImage().getAttribute("src")).toContain("radars/nuke-lower.webp");
      expect(card.queryByTestId("landing-marker")).not.toBeInTheDocument();

      await userEvent.click(level.getByRole("button", { name: "Upper" }));
      expect(radarImage().getAttribute("src")).toContain("radars/nuke.webp");
      expect(card.getByTestId("landing-marker")).toBeInTheDocument();
    });

    it("opens a smoke whose stand spot is on the lower level on the lower radar", async () => {
      // No fixture stands on the lower level, so render the card directly with one that does.
      const item: QueueItem = {
        map: "nuke",
        isNew: true,
        lineup: makeLineup({
          id: "nuke-lower-from-test",
          name: "Lower",
          from: "Test",
          stand: { x: 0.3, y: 0.6, level: "lower" },
          land: { x: 0.4, y: 0.7, level: "lower" },
        }),
      };
      render(<StudyCard item={item} sameMapTechniques={[]} onRate={() => undefined} />);

      const level = within(screen.getByRole("group", { name: "Level" }));
      expect(level.getByRole("button", { name: "Lower" })).toHaveAttribute("aria-pressed", "true");
      expect(level.getByRole("button", { name: "Upper" })).toHaveAttribute("aria-pressed", "false");
      expect(screen.getByRole("img", { name: "Nuke radar" }).getAttribute("src")).toContain(
        "radars/nuke-lower.webp",
      );
      expect(screen.getByTestId("landing-marker")).toBeInTheDocument();

      await userEvent.click(screen.getByRole("button", { name: "Skip" }));
      expect(screen.getByTestId("stand-dot")).toBeInTheDocument();
      expect(screen.getByTestId("stand-line")).toBeInTheDocument();
    });

    it("shows a smoke that lands on another level only on that level", async () => {
      renderAt("/study", { storage: nukeOnly(), now });
      await userEvent.click(screen.getByRole("button", { name: "Start" }));
      await answerCard("Got it");
      expect(screen.getByRole("heading", { name: "Ramp — from Lobby" })).toBeInTheDocument();

      const card = within(studyCard());
      const level = within(card.getByRole("group", { name: "Level" }));
      // It opens on the stand spot's level (upper), where the smoke doesn't land.
      expect(level.getByRole("button", { name: "Upper" })).toHaveAttribute("aria-pressed", "true");
      expect(radarImage().getAttribute("src")).toContain("radars/nuke.webp");
      expect(card.queryByTestId("landing-marker")).not.toBeInTheDocument();

      await userEvent.click(level.getByRole("button", { name: "Lower" }));
      expect(radarImage().getAttribute("src")).toContain("radars/nuke-lower.webp");
      expect(card.getByTestId("landing-marker")).toBeInTheDocument();

      // After revealing the stand spot, it shows on its own level only, with no line across levels.
      await userEvent.click(card.getByRole("button", { name: "Skip" }));
      expect(card.queryByTestId("stand-dot")).not.toBeInTheDocument();
      expect(card.queryByTestId("stand-line")).not.toBeInTheDocument();
      expect(card.getByTestId("landing-marker")).toBeInTheDocument();

      await userEvent.click(level.getByRole("button", { name: "Upper" }));
      expect(radarImage().getAttribute("src")).toContain("radars/nuke.webp");
      expect(card.getByTestId("stand-dot")).toBeInTheDocument();
      expect(card.queryByTestId("landing-marker")).not.toBeInTheDocument();
      expect(card.queryByTestId("stand-line")).not.toBeInTheDocument();
    });
  });

  it("keeps studying when the browser can't save, and says so", async () => {
    renderAt("/study", { storage: failingStorage(), now });
    await userEvent.click(screen.getByRole("button", { name: "Start" }));
    await answerCard("Got it");
    expect(screen.getByText("Progress can't be saved in this browser.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Outside — from T Roof" })).toBeInTheDocument();
  });
});
