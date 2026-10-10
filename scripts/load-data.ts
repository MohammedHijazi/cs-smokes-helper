import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { DataFile } from "../src/data/validate";

export const DATA_DIR = join(import.meta.dirname, "..", "data", "maps");

/** Reads every .json file in data/maps, keeping parse errors instead of throwing. */
export function loadDataFiles(dir: string = DATA_DIR): DataFile[] {
  return readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .sort()
    .map((fileName) => {
      const text = readFileSync(join(dir, fileName), "utf8");
      try {
        return { fileName, content: JSON.parse(text) as unknown };
      } catch (error) {
        return { fileName, content: undefined, parseError: (error as Error).message };
      }
    });
}
