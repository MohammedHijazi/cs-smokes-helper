import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const ROOT = join(import.meta.dirname, "..");
const SOURCE = join(ROOT, "tmp", "radars-src");
const OUTPUT = join(ROOT, "public", "radars");
const NAMES = ["ancient", "anubis", "cache", "dust2", "inferno", "mirage", "nuke", "nuke-lower"];

const missing = NAMES.filter((name) => !existsSync(join(SOURCE, `${name}.png`)));
if (missing.length > 0) {
  console.error(`Missing in tmp/radars-src: ${missing.map((name) => `${name}.png`).join(", ")}`);
  process.exit(1);
}

mkdirSync(OUTPUT, { recursive: true });
for (const name of NAMES) {
  await sharp(join(SOURCE, `${name}.png`))
    .resize(1024, 1024, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 85 })
    .toFile(join(OUTPUT, `${name}.webp`));
  console.log(`public/radars/${name}.webp`);
}
