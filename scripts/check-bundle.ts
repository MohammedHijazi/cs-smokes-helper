import { existsSync } from "node:fs";
import { join } from "node:path";
import { EDIT_MARKER, findEditCode } from "./bundle";

const dist = join(import.meta.dirname, "..", "dist");
if (!existsSync(dist)) {
  console.error("dist/ not found — run npm run build first.");
  process.exit(1);
}
const offenders = findEditCode(dist);
if (offenders.length > 0) {
  console.error(`Edit-mode code found in the build (files containing "${EDIT_MARKER}"):`);
  for (const file of offenders) console.error(`  dist/${file}`);
  process.exit(1);
}
console.log("Bundle OK: no edit-mode code in dist/.");
