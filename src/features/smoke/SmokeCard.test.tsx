import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { getMapInfo } from "../../data/maps";
import { makeLineup } from "../../test/fixtures";
import { SmokeCard, type SmokeCardProps } from "./SmokeCard";

vi.mock("./VideoPlayer", () => ({
  VideoPlayer: ({ title }: { title: string }) => <div data-testid="video">{title}</div>,
}));

const mirage = getMapInfo("mirage")!;
const nuke = getMapInfo("nuke")!;

function renderCard(props: Partial<SmokeCardProps> = {}) {
  return render(
    <MemoryRouter>
      <SmokeCard map={mirage} lineup={makeLineup()} {...props} />
    </MemoryRouter>,
  );
}

describe("SmokeCard", () => {
  it("shows the name, throw spot, technique, notes, status and video", () => {
    renderCard();
    expect(screen.getByRole("heading", { name: "Window" })).toBeInTheDocument();
    expect(screen.getByText("from T Spawn")).toBeInTheDocument();
    expect(screen.getByText("Jump throw · left click")).toBeInTheDocument();
    expect(screen.getByText("Aim at the top-left corner of the antenna")).toBeInTheDocument();
    expect(screen.getByText("Unreviewed")).toBeInTheDocument();
    expect(screen.getByText("Last checked 2026-10-10")).toBeInTheDocument();
    expect(screen.getByTestId("video")).toHaveTextContent("Window from T Spawn");
  });

  it("links to YouTube at the clip start", () => {
    renderCard();
    expect(screen.getByRole("link", { name: "Open on YouTube ↗" })).toHaveAttribute(
      "href",
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=95s",
    );
  });

  it("has no YouTube link for videos on other sites", () => {
    renderCard({
      lineup: makeLineup({ video: { url: "https://csnades.gg/mirage/smokes/window" } }),
    });
    expect(screen.queryByRole("link", { name: "Open on YouTube ↗" })).toBeNull();
  });

  it("links to the previous smoke, the list, and disables a missing next smoke", () => {
    renderCard({ prevHref: "/maps/mirage/smokes/mirage-a", closeHref: "/maps/mirage" });
    expect(screen.getByRole("link", { name: "Previous smoke" })).toHaveAttribute(
      "href",
      "/maps/mirage/smokes/mirage-a",
    );
    expect(screen.getByRole("link", { name: "Next smoke" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByRole("link", { name: "Back to the list" })).toHaveAttribute(
      "href",
      "/maps/mirage",
    );
  });

  it("draws the stand spot, the line and the landing spot on the mini radar", () => {
    renderCard();
    expect(screen.getByTestId("landing-marker")).toBeInTheDocument();
    expect(screen.getByTestId("stand-dot")).toBeInTheDocument();
    expect(screen.getByTestId("stand-line")).toBeInTheDocument();
  });

  it("uses the landing level's radar and leaves out a stand spot on the other level", () => {
    renderCard({
      map: nuke,
      lineup: makeLineup({
        id: "nuke-ramp-from-lobby",
        stand: { x: 0.3, y: 0.6, level: "upper" },
        land: { x: 0.4, y: 0.7, level: "lower" },
      }),
    });
    expect(screen.getByRole("img", { name: /radar/ }).getAttribute("src")).toContain("nuke-lower");
    expect(screen.queryByTestId("stand-dot")).toBeNull();
    expect(screen.queryByTestId("stand-line")).toBeNull();
  });

  it("has no header or navigation in the embedded variant", () => {
    renderCard({ variant: "embedded" });
    expect(screen.queryByRole("heading")).toBeNull();
    expect(screen.queryByRole("link", { name: "Previous smoke" })).toBeNull();
  });
});
