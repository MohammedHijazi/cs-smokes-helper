import type { MapFile } from "../src/data/schema";
import { loadDataFiles } from "./load-data";
import { checkVideos, formatReport } from "./videos";

// Run `npm run validate` first: this script assumes the data has the right shape.
const lineups = loadDataFiles().flatMap(
  (file) => (file.content as MapFile | undefined)?.lineups ?? [],
);
const checks = await checkVideos(lineups, (url) => fetch(url));
console.log(formatReport(checks));
if (checks.some((check) => !check.ok)) process.exit(1);
