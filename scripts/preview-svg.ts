export interface PreviewMarker {
  n: number;
  side: "T" | "CT";
  stand: { x: number; y: number };
  land: { x: number; y: number };
}

const COLORS = { T: "#f2a93b", CT: "#5b9dff" } as const;

/** An SVG overlay: a labelled 0.1 grid plus numbered markers (stand square → landing circle). */
export function buildPreviewSvg(size: number, markers: readonly PreviewMarker[]): string {
  const px = (fraction: number) => Math.round(fraction * size);
  const parts: string[] = [];

  for (let i = 1; i < 10; i++) {
    const p = px(i / 10);
    const label = (i / 10).toFixed(1);
    parts.push(
      `<line x1="${p}" y1="0" x2="${p}" y2="${size}" stroke="#ffffff" stroke-opacity="0.35" stroke-width="1"/>`,
      `<line x1="0" y1="${p}" x2="${size}" y2="${p}" stroke="#ffffff" stroke-opacity="0.35" stroke-width="1"/>`,
      `<text x="${p + 3}" y="14" font-size="13" fill="#ffffff">${label}</text>`,
      `<text x="3" y="${p - 3}" font-size="13" fill="#ffffff">${label}</text>`,
    );
  }

  for (const marker of markers) {
    const color = COLORS[marker.side];
    const [sx, sy] = [px(marker.stand.x), px(marker.stand.y)];
    const [lx, ly] = [px(marker.land.x), px(marker.land.y)];
    parts.push(
      `<line x1="${sx}" y1="${sy}" x2="${lx}" y2="${ly}" stroke="${color}" stroke-width="2" stroke-dasharray="6 4"/>`,
      `<rect x="${sx - 8}" y="${sy - 8}" width="16" height="16" fill="${color}" stroke="#000000" stroke-width="1"/>`,
      `<circle cx="${lx}" cy="${ly}" r="18" fill="${color}" fill-opacity="0.45" stroke="${color}" stroke-width="2"/>`,
      `<text x="${lx}" y="${ly + 5}" font-size="15" font-weight="bold" text-anchor="middle" fill="#ffffff">${marker.n}</text>`,
    );
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${parts.join("")}</svg>`;
}
