import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/** The edit endpoint's path. It must never appear in the published build (spec §3.4). */
export const EDIT_MARKER = "/__edit/";

/** Files under `dir` (relative, forward slashes, sorted) whose text contains the edit endpoint. */
export function findEditCode(dir: string): string[] {
  return readdirSync(dir, { recursive: true, encoding: "utf8" })
    .filter((name) => statSync(join(dir, name)).isFile())
    .filter((name) => readFileSync(join(dir, name), "utf8").includes(EDIT_MARKER))
    .map((name) => name.split("\\").join("/"))
    .sort();
}
