// @vitest-environment node
import { check } from "prettier";
import { describe, expect, it } from "vitest";
import { makeExecute, makeLineup, makeMapFile } from "../src/test/fixtures";
import { formatMapFile } from "./format-map";

const LONG_URL =
  "https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLabcdefghijklmnopqrstuvwxyz0123";

const WINDOW_FILE = `{
  "map": "mirage",
  "lineups": [
    {
      "id": "mirage-window-from-t-spawn",
      "name": "Window",
      "from": "T Spawn",
      "side": "T",
      "area": "Mid",
      "throw": { "movement": "stand", "jump": true, "click": "left" },
      "stand": { "x": 0.81, "y": 0.62 },
      "land": { "x": 0.44, "y": 0.47 },
      "video": { "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ", "start": 95, "end": 112 },
      "notes": "Aim at the top-left corner of the antenna",
      "status": "unreviewed",
      "checkedOn": "2026-10-10"
    }
  ],
  "executes": [
    {
      "id": "mirage-a-execute",
      "name": "A execute",
      "side": "T",
      "lineupIds": ["mirage-ct-from-t-ramp", "mirage-jungle-from-t-ramp"]
    }
  ]
}
`;

describe("formatMapFile", () => {
  it("writes objects that fit in 100 characters on one line", async () => {
    const file = makeMapFile("mirage", [makeLineup()], [makeExecute()]);
    expect(await formatMapFile(file)).toBe(WINDOW_FILE);
  });

  it("breaks an object that does not fit in 100 characters", async () => {
    const lineup = makeLineup({ video: { url: LONG_URL, start: 95, end: 112 } });
    const text = await formatMapFile(makeMapFile("mirage", [lineup]));
    expect(text).toContain(
      `      "video": {\n        "url": "${LONG_URL}",\n        "start": 95,\n        "end": 112\n      },\n`,
    );
  });

  it("passes prettier --check with the repo's config", async () => {
    const text = await formatMapFile(makeMapFile("mirage", [makeLineup()], [makeExecute()]));
    expect(await check(text, { parser: "json", printWidth: 100 })).toBe(true);
  });
});
