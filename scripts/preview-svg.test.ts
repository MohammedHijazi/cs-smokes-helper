import { describe, expect, it } from "vitest";
import { buildPreviewSvg } from "./preview-svg";

describe("buildPreviewSvg", () => {
  it("draws a 10×10 grid labelled in tenths", () => {
    const svg = buildPreviewSvg(1000, []);
    expect(svg.match(/<line /g)).toHaveLength(18);
    for (const label of ["0.1", "0.5", "0.9"]) expect(svg).toContain(`>${label}<`);
  });

  it("draws each smoke as a stand square, a dashed line and a numbered landing circle", () => {
    const svg = buildPreviewSvg(1000, [
      { n: 3, side: "T", stand: { x: 0.8, y: 0.6 }, land: { x: 0.4, y: 0.5 } },
    ]);
    expect(svg).toContain('<rect x="792" y="592"');
    expect(svg).toContain('x1="800" y1="600" x2="400" y2="500"');
    expect(svg).toContain('<circle cx="400" cy="500"');
    expect(svg).toContain(">3<");
    expect(svg.match(/<line /g)).toHaveLength(19);
  });
});
