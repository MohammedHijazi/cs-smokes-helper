import { validateDataFiles } from "../src/data/validate";
import { loadDataFiles } from "./load-data";

const files = loadDataFiles();
const errors = validateDataFiles(files);

if (errors.length > 0) {
  for (const { file, path, message } of errors) {
    console.error(`${file} → ${path || "(file)"} → ${message}`);
  }
  console.error(`\n${errors.length} problem(s) found.`);
  process.exit(1);
}

const smokes = files.reduce(
  (total, file) => total + (file.content as { lineups: unknown[] }).lineups.length,
  0,
);
console.log(`Data OK: ${files.length} map files, ${smokes} smokes.`);
