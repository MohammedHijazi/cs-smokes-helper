import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { formatMapFile } from "./format-map";
import { DATA_DIR, loadDataFiles } from "./load-data";

// Rewrites every data file in the canonical layout (Phase 2 spec §4.1). Layout only: no data changes.
const formatted: string[] = [];
for (const { fileName, content, parseError } of loadDataFiles()) {
  if (parseError !== undefined) {
    console.error(`${fileName} → not valid JSON: ${parseError}`);
    process.exitCode = 1;
    continue;
  }
  const path = join(DATA_DIR, fileName);
  const text = await formatMapFile(content);
  if (text !== readFileSync(path, "utf8")) {
    writeFileSync(path, text);
    formatted.push(fileName);
  }
}
console.log(
  formatted.length === 0
    ? "All data files already use the canonical layout."
    : `Formatted ${formatted.join(", ")}.`,
);
