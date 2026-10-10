import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { getMapInfo } from "../../data/maps";
import { Radar } from "./Radar";
import { LandingMarker, StandDot, StandLine, TapMark } from "./markers";

const mirage = getMapInfo("mirage")!;
const nuke = getMapInfo("nuke")!;

describe("Radar", () => {
  it("shows the radar image for the requested level", () => {
    const { rerender } = render(<Radar map={nuke} label="Nuke radar" />);
    expect(screen.getByRole("img", { name: "Nuke radar" }).getAttribute("src")).toContain(
      "radars/nuke.webp",
    );
    rerender(<Radar map={nuke} level="lower" label="Nuke radar" />);
    expect(screen.getByRole("img", { name: "Nuke radar" }).getAttribute("src")).toContain(
      "radars/nuke-lower.webp",
    );
  });

  it("reports taps as fractions of the radar, together with its width", () => {
    const onTap = vi.fn();
    render(<Radar map={mirage} label="Mirage radar" onTap={onTap} />);
    const radar = screen.getByTestId("radar");
    vi.spyOn(radar, "getBoundingClientRect").mockReturnValue({
      left: 100,
      top: 50,
      width: 400,
      height: 400,
    } as DOMRect);
    fireEvent.click(radar, { clientX: 300, clientY: 150 });
    expect(onTap).toHaveBeenCalledWith({ x: 0.5, y: 0.25 }, 400);
  });

  it("draws markers in a 0–1000 overlay", () => {
    render(
      <Radar map={mirage} label="Mirage radar">
        <LandingMarker at={{ x: 0.25, y: 0.5 }} side="CT" selected label="2" />
        <StandDot at={{ x: 0.75, y: 0.5 }} side="CT" />
        <StandLine from={{ x: 0.75, y: 0.5 }} to={{ x: 0.25, y: 0.5 }} />
        <TapMark at={{ x: 0.7, y: 0.5 }} correct={false} />
      </Radar>,
    );
    const landing = screen.getByTestId("landing-marker");
    expect(landing).toHaveAttribute("data-side", "CT");
    expect(landing).toHaveAttribute("data-selected", "true");
    expect(landing.querySelector("circle")).toHaveAttribute("cx", "250");
    expect(landing).toHaveTextContent("2");
    expect(screen.getByTestId("stand-dot")).toHaveAttribute("cx", "750");
    expect(screen.getByTestId("stand-line")).toHaveAttribute("x2", "250");
    expect(screen.getByTestId("tap-mark")).toHaveAttribute("data-correct", "false");
  });
});
