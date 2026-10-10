import { join } from "node:path";
import sharp from "sharp";

const ICONS = join(import.meta.dirname, "..", "public", "icons");
const SIZES = [
  ["icon-192.png", 192],
  ["icon-512.png", 512],
  ["apple-touch-icon.png", 180],
] as const;

for (const [name, size] of SIZES) {
  await sharp(join(ICONS, "icon.svg"), { density: 300 })
    .resize(size, size)
    .png()
    .toFile(join(ICONS, name));
  console.log(`public/icons/${name}`);
}
