import { mkdirSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { getMapInfo, hasLevels, radarPath } from "../src/data/maps";
import type { Level, MapFile } from "../src/data/schema";
import { loadDataFiles } from "./load-data";
import { buildPreviewSvg, type PreviewMarker } from "./preview-svg";

const SIZE = 1000;
const ROOT = join(import.meta.dirname, "..");
const map = getMapInfo(process.argv[2] ?? "");
if (!map) {
  console.error(
    "Usage: npm run preview-markers -- <ancient|anubis|cache|dust2|inferno|mirage|nuke>",
  );
  process.exit(1);
}

const file = loadDataFiles().find((f) => f.fileName === `${map.id}.json`);
const lineups = (file?.content as MapFile | undefined)?.lineups ?? [];
mkdirSync(join(ROOT, "tmp"), { recursive: true });

const levels: Level[] = hasLevels(map) ? ["upper", "lower"] : ["upper"];
for (const level of levels) {
  const markers: PreviewMarker[] = lineups.flatMap((lineup, index) =>
    !hasLevels(map) || (lineup.land.level ?? "upper") === level
      ? [{ n: index + 1, side: lineup.side, stand: lineup.stand, land: lineup.land }]
      : [],
  );
  const out = join(ROOT, "tmp", `preview-${map.id}${level === "lower" ? "-lower" : ""}.png`);
  await sharp(join(ROOT, "public", radarPath(map, level)))
    .resize(SIZE, SIZE)
    // Radars are transparent; the app shows them on black, so the white grid stays readable here too.
    .flatten({ background: "#000000" })
    .composite([{ input: Buffer.from(buildPreviewSvg(SIZE, markers)), top: 0, left: 0 }])
    .png()
    .toFile(out);
  console.log(`Wrote ${out}`);
}

lineups.forEach((lineup, index) => {
  const level = lineup.land.level ? ` (${lineup.land.level})` : "";
  console.log(
    `${String(index + 1).padStart(2)}  ${lineup.id}  stand ${lineup.stand.x},${lineup.stand.y} → land ${lineup.land.x},${lineup.land.y}${level}`,
  );
});
