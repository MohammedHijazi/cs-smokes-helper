import { join } from "node:path";
import { format, resolveConfig } from "prettier";
import { DATA_DIR } from "./load-data";

/**
 * The one canonical text of a map file (Phase 2 spec §4.1). The input is compact JSON, so no
 * object starts out expanded: Prettier breaks an object only when it exceeds the print width.
 */
export async function formatMapFile(file: unknown): Promise<string> {
  // Resolved against the real data folder, so saves to a temp folder (tests) use the repo config.
  const config = (await resolveConfig(join(DATA_DIR, "mirage.json"))) ?? {};
  return format(JSON.stringify(file), { ...config, parser: "json" });
}
