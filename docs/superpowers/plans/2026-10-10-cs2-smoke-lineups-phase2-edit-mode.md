# CS2 Smoke Lineups — Phase 2 (Edit Mode) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a local, dev-only editing UI (add, edit, delete, mark reviewed, executes editor) that writes `data/maps/<mapId>.json` through a validated Vite dev-server endpoint, while the published site stays read-only and contains no edit code.

**Architecture:** A Vite plugin (`apply: "serve"`) mounts `PUT /__edit/maps/:mapId`, which checks the request, rejects stale saves, validates with the shared `validateDataFiles`, formats with one canonical Prettier layout, and writes atomically. The client validates locally, sends `{ base, file }`, then swaps the saved file into the in-memory data (`replaceMapFile`), so screens re-render without a reload; the plugin suppresses Vite's reload for its own writes. All edit UI lives in `src/features/edit/`, loaded through `Edit` in `src/app/editMode.tsx`, which is `null` in builds; CI's `npm run check-bundle` proves it.

**Tech Stack:** Node ≥ 22 (this PC: Node 25), TypeScript 5.9 (strict), React 19, React Router 7 (declarative, `HashRouter`), Zod 4, Vite 7, Vitest 4 + React Testing Library 16 + jsdom 26, Prettier 3 (Node API), ESLint 9, tsx 4.

**Spec:** `docs/superpowers/specs/2026-10-10-cs2-smoke-lineups-phase2-edit-mode-design.md` (this phase). The data model it relies on is §6 of `docs/superpowers/specs/2026-10-10-cs2-smoke-lineups-design.md`. Read both before starting any task.

## Global Constraints

- **Dev only.** Every edit route, button and link renders only when `import.meta.env.DEV` is true, checked where it renders. Edit components load only through `Edit` in `src/app/editMode.tsx`, which is `null` when `import.meta.env.DEV` is false. The Vite plugin has `apply: "serve"`. `npm run check-bundle` fails if any file in `dist/` contains `/__edit/`.
- **Endpoint:** `PUT /__edit/maps/:mapId`, JSON body `{ "base": MapFile, "file": MapFile }`. Responses: 200 `{ file }`; 400 `{ errors: [{ path, message }] }`; 403 `{ error: "not-local" | "foreign-origin" }`; 404 `{ error: "unknown-map" }`; 409 `{ error: "changed" | "invalid-on-disk" }`; 415 `{ error: "json-only" }`; 500 `{ error: "write-failed", message }`.
- **Loopback addresses:** `127.0.0.1`, `::1`, `::ffff:127.0.0.1`. An `Origin` header, when present, must have the same host as the `Host` header.
- **Writing data files:** only through `formatMapFile` (Prettier `json` parser, the repo's `.prettierrc.json` → `printWidth: 100`, compact `JSON.stringify` input), via `data/maps/.<mapId>.json.tmp` then rename. Rename retried on `EPERM`/`EBUSY`: 5 attempts, waits 50, 100, 250, 500 ms.
- **Ids:** smoke `<mapId>-<slug(name)>-from-<slug(from)>`; execute `<mapId>-<slug(name)>`; `-2`, `-3`, … when the id exists anywhere (lineups and executes of all maps share one id space). Slug: NFKD, combining marks removed, lowercase, each run of characters other than `a–z0–9` → one `-`, leading/trailing `-` removed, empty → `smoke`. Ids never change after creation.
- **Ordering:** new smokes and executes are appended to their arrays.
- **Key order when building objects** (keeps diffs small, matches the seeded files): lineup `id, name, from, side, area, throw, stand, land, video, notes, status, checkedOn`; throw `movement, jump, click`; position `x, y, level`; video `url, start, end`; execute `id, name, side, lineupIds, notes`. Empty notes are left out.
- **Positions** placed on the radar are rounded to 3 decimals. On Nuke they carry the level being shown; on other maps they never have a level.
- **Status dates:** Add → `unreviewed`, `checkedOn` today. Edit → `checkedOn` becomes today only if the status changed. Mark reviewed → `ok`, today. "Today" is `useProgress().today` (the device's local date).
- **User-facing text, exactly:**
  - `Can't reach the dev server — is npm run dev running?`
  - `This map changed outside this page (another tab, a hand edit or git). Reload to get the latest version.`
  - `data/maps/<mapId>.json isn't valid JSON — fix or restore it first.`
  - `Couldn't write data/maps/<mapId>.json: <message>`
  - `No unreviewed smokes left in this list.`
  - `Discard changes?`
  - Delete confirm: `Delete '<name> from <from>'?` + ` It is also removed from '<A>', '<B>'.` (if any) + ` '<X>' is deleted too, because it would have fewer than 2 smokes.` (plural: `'<X>', '<Y>' are deleted too, because they would have fewer than 2 smokes.`)
  - Execute delete confirm: `Delete the execute '<name>'? Its smokes are kept.`
- **Styling:** CSS Modules and the existing CSS variables in `src/styles/global.css`; dark theme only. Editing is desktop-only; no phone-specific edit layout.
- **Out of scope (spec §11):** no oEmbed check on paste, no status filter, no duplicate smoke, no reordering smokes, no committing/pushing from the UI, no moving smokes between maps, no in-app navigation blocker, no draft persistence.
- **Pinned majors:** `vite@^7`, `vitest@^4`, `react@^19`, `react-router@^7`, `zod@^4`, `prettier@^3`, `typescript@~5.9`. No new runtime or dev dependencies.
- **Production behaviour must not change.** Existing tests keep passing. `src/features/smoke/VideoPlayer.test.tsx` must pass **without edits**.
- **Git:** work on a feature branch, commit after each task, never push or merge without the user's go-ahead (a push to `main` deploys).
- **Formatting:** before each lint run, `npm run format` (Prettier `--write .`; it is stable on the canonical data files).

## Review Focus

1. **Typing a YouTube link one character at a time** (instead of pasting) must leave Start at the link's whole `t` (`95`), not its first digit (`9`). Test lives in Task 7.
2. **Two saves in a row from the same open page** (Mark reviewed on one smoke, then the next) must not be refused as stale: the second save's `base` must be the file the first save wrote. Test lives in Task 8.
3. **Double-clicking Save** must send one request, not two (the second would be refused as stale or append a duplicate). Test lives in Task 11.
4. **Editing a Nuke smoke without touching its spots** must open the radar on its landing level and save both levels unchanged. Test lives in Task 11.
5. **Mark reviewed on a deep-linked smoke that the filters exclude** must move to the first unreviewed smoke of the filtered list, never stay on or return to the current one. Tests live in Task 6 and Task 12.

---

## File Map

| Path | Responsibility | Task |
|---|---|---|
| `scripts/format-map.ts` | `formatMapFile`: the one canonical text of a map file | 1 |
| `scripts/format-data.ts` | `npm run format-data` | 1 |
| `data/maps/*.json` | Normalised once to the canonical layout | 1 |
| `src/features/smoke/useYouTubePlayer.ts` | YouTube player setup shared by the clip player and the clip timer | 2 |
| `src/features/smoke/VideoPlayer.tsx` | Uses `useYouTubePlayer` (behaviour unchanged) | 2 |
| `src/features/map/MapFrame.tsx` | Map screens' frame: heading, controls, radar, panel | 2 |
| `src/features/executes/ExecuteMarkers.tsx` | An execute's numbered smokes on a radar | 2 |
| `src/features/map/MapPage.tsx` | Uses `MapFrame`/`ExecuteMarkers` (2); `useDataVersion` (5); add links and edit actions (11–13) | 2, 5, 11–13 |
| `scripts/save-map.ts` | Server save: stale check, validation, format, atomic write | 3 |
| `scripts/temp-data-dir.ts` | Test helper: temp folder with seven map files | 3 |
| `scripts/edit-plugin.ts` | Vite plugin: middleware, request checks, own-write reload suppression | 4 |
| `scripts/bundle.ts`, `scripts/check-bundle.ts` | `npm run check-bundle` | 4 |
| `vite.config.ts`, `.github/workflows/deploy.yml`, `package.json` | Wiring, CI step, scripts | 1, 4 |
| `src/data/api.ts`, `src/data/index.ts` | `replaceMapFile`, `useDataVersion` | 5 |
| `src/features/home/HomePage.tsx`, `src/features/study/StudyPage.tsx` | Call `useDataVersion` | 5 |
| `src/test/fixtureData.ts` | `restoreFixtureData` | 5 |
| `src/features/edit/mapEdits.ts` | Ids, add/replace/delete, mark reviewed, next unreviewed | 6 |
| `src/features/edit/smokeDraft.ts` | Smoke form state ↔ lineup, error mapping, clock text | 7 |
| `src/features/edit/saveClient.ts` | `saveMap`: local check, PUT, swap in saved file | 8 |
| `src/test/editHelpers.ts` | Test helpers: fake save endpoint (8), radar pointer helpers (9) | 8, 9 |
| `src/test/setup.ts` | jsdom pointer-event polyfill | 9 |
| `src/features/edit/PlacementRadar.tsx` | Click to place, drag to adjust | 9 |
| `src/features/edit/Edit.module.css` | Edit styles | 9–13 |
| `src/test/fakeYouTube.ts` | Test helper: fake YouTube IFrame API | 10 |
| `src/features/edit/ClipTimer.tsx` | Set start / Set end / Play clip | 10 |
| `src/app/editMode.tsx` | `Edit` lazy registry, `EditBoundary` | 11–13 |
| `src/app/AppRoutes.tsx` | Dev-only edit routes | 11, 13 |
| `src/features/map/FiltersBar.tsx` | Exports `Segmented`, which accepts `null` | 11 |
| `src/features/map/MapPage.module.css` | `.addLink` | 11 |
| `src/features/edit/formParts.tsx` | `FieldErrors`, `FormNotice`, `useLeaveWarning` | 11 |
| `src/features/edit/SmokeFields.tsx`, `src/features/edit/SmokeFormPage.tsx` | Smoke form | 11 |
| `src/features/smoke/SmokeCard.tsx` | `actions` slot | 12 |
| `src/features/edit/SmokeActions.tsx` | Mark reviewed, Edit, Delete | 12 |
| `src/lib/filters.ts` | `searchWithTab` | 13 |
| `src/features/executes/ExecuteView.tsx` | `actions` slot | 13 |
| `src/features/edit/executeDraft.ts`, `ExecuteFormPage.tsx`, `ExecuteActions.tsx` | Execute editor and actions | 13 |
| `README.md`, parent spec §11 | Docs | 14 |

Tests sit next to the code they test (`foo.ts` → `foo.test.ts`). Tests of Node-only code (`scripts/`) start with `// @vitest-environment node`.

---

### Task 1: One canonical layout for data files

Spec §4.1. Four seeded files (`ancient`, `cache`, `mirage`, `nuke`) have objects expanded over several lines that Prettier would keep, so a save would otherwise rewrite 45–60 unrelated lines each. This task adds the formatter every save will use, normalises the files once in their own commit, and adds a guard test.

**Files:**
- Create: `scripts/format-map.ts`
- Create: `scripts/format-data.ts`
- Create: `scripts/format-map.test.ts`
- Modify: `package.json` (scripts)
- Modify: `data/maps/ancient.json`, `cache.json`, `mirage.json`, `nuke.json` (layout only, via the script)

**Interfaces:**
- Consumes: `DATA_DIR`, `loadDataFiles()` from `scripts/load-data.ts`; `makeLineup`, `makeExecute`, `makeMapFile` from `src/test/fixtures.ts`.
- Produces: `formatMapFile(file: unknown): Promise<string>` in `scripts/format-map.ts` (Tasks 3, 4 use it); `npm run format-data`.

- [ ] **Step 1: Write the failing test**

Create `scripts/format-map.test.ts`:

```ts
// @vitest-environment node
import { check } from "prettier";
import { describe, expect, it } from "vitest";
import { makeExecute, makeLineup, makeMapFile } from "../src/test/fixtures";
import { formatMapFile } from "./format-map";

const LONG_URL = "https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLabcdefghijklmnopqrstuvwxyz0123";

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
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx vitest run scripts/format-map.test.ts`
Expected: FAIL — `Failed to resolve import "./format-map"`.

- [ ] **Step 3: Implement `formatMapFile`**

Create `scripts/format-map.ts`:

```ts
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
```

- [ ] **Step 4: Run the test to make sure it passes**

Run: `npx vitest run scripts/format-map.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Add `npm run format-data`**

Create `scripts/format-data.ts`:

```ts
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
```

In `package.json` `scripts`, add after `"validate"`:

```json
    "format-data": "tsx scripts/format-data.ts",
```

- [ ] **Step 6: Lint and commit the formatter**

Run: `npm run format && npm run lint && npx vitest run scripts/format-map.test.ts`
Expected: lint clean, 3 tests pass.

```bash
git add scripts/format-map.ts scripts/format-map.test.ts scripts/format-data.ts package.json
git commit -m "feat: add the canonical data-file layout and npm run format-data"
```

- [ ] **Step 7: Write the failing guard test**

Append to `scripts/format-map.test.ts` (merge the new imports into the import block at the top):

```ts
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { DATA_DIR } from "./load-data";

describe("data files", () => {
  const names = readdirSync(DATA_DIR).filter((name) => name.endsWith(".json"));

  it.each(names)("%s uses the canonical layout", async (name) => {
    const text = readFileSync(join(DATA_DIR, name), "utf8");
    expect(text, `${name} isn't in the canonical layout — run npm run format-data`).toBe(
      await formatMapFile(JSON.parse(text)),
    );
  });
});
```

Run: `npx vitest run scripts/format-map.test.ts`
Expected: FAIL for `ancient.json`, `cache.json`, `mirage.json` and `nuke.json` with "isn't in the canonical layout"; the other three pass.

- [ ] **Step 8: Normalise the data files**

Run: `npm run format-data`
Expected: `Formatted ancient.json, cache.json, mirage.json, nuke.json.`

Check that only the layout changed. Save this as `tmp/same-data.mjs` (`tmp/` is git-ignored):

```js
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

for (const map of ["ancient", "cache", "mirage", "nuke"]) {
  const before = JSON.parse(execFileSync("git", ["show", `HEAD:data/maps/${map}.json`], { encoding: "utf8" }));
  const after = JSON.parse(readFileSync(`data/maps/${map}.json`, "utf8"));
  console.log(map, JSON.stringify(before) === JSON.stringify(after) ? "same data" : "DATA CHANGED");
}
```

Run: `node tmp/same-data.mjs`
Expected: `same data` four times.

Then: `npx vitest run scripts/format-map.test.ts && npm run validate && npm run lint`
Expected: 10 tests pass; `Data OK: 7 map files, 80 smokes.`; lint clean.

- [ ] **Step 9: Commit the normalisation on its own**

```bash
git add data/maps scripts/format-map.test.ts
git commit -m "data: rewrite map files in the canonical layout (no data changes)"
```

---

### Task 2: Behaviour-preserving extractions

Spec §3.1: `useYouTubePlayer` (the clip timer in Task 10 shares the player setup), `MapFrame` (edit pages reuse the map layout without growing `MapPage`), and `ExecuteMarkers` (the execute editor in Task 13 draws the same numbered markers). No behaviour changes; the existing tests are the safety net.

**Files:**
- Create: `src/features/smoke/useYouTubePlayer.ts`
- Modify: `src/features/smoke/VideoPlayer.tsx` (the `YouTubeClip` component)
- Create: `src/features/map/MapFrame.tsx`
- Create: `src/features/executes/ExecuteMarkers.tsx`
- Modify: `src/features/map/MapPage.tsx`

**Interfaces:**
- Consumes: `loadYouTubeApi`, `YTPlayer` from `src/features/smoke/youtubeApi.ts`; `LandingMarker`, `StandDot`, `StandLine` from `src/features/map/markers.tsx`.
- Produces:
  - `useYouTubePlayer(host: RefObject<HTMLDivElement | null>, options: YouTubePlayerOptions): { status: PlayerStatus; player: RefObject<YTPlayer | null> }` with `type PlayerStatus = "loading" | "ready" | "error"` and `interface YouTubePlayerOptions { videoId: string; playerVars: Record<string, string | number>; onReady?: (player: YTPlayer) => void; onEnded?: (player: YTPlayer) => void }`.
  - `MapFrame({ map: MapInfo; open?: boolean; controls?: ReactNode; radar: ReactNode; panel: ReactNode })`.
  - `ExecuteMarkers({ lineups: readonly Lineup[]; isShown: (position: Position) => boolean })`.

- [ ] **Step 1: Record the baseline**

Run: `npx vitest run src/features`
Expected: all pass. Note the count; it must be the same at Step 7.

- [ ] **Step 2: Create `useYouTubePlayer`**

Create `src/features/smoke/useYouTubePlayer.ts`:

```ts
import { useEffect, useRef, useState, type RefObject } from "react";
import { loadYouTubeApi, type YTPlayer } from "./youtubeApi";

export type PlayerStatus = "loading" | "ready" | "error";

export interface YouTubePlayerOptions {
  videoId: string;
  /** Read when the player is created; later changes don't recreate it. */
  playerVars: Record<string, string | number>;
  onReady?: (player: YTPlayer) => void;
  onEnded?: (player: YTPlayer) => void;
}

/**
 * Creates a YouTube player inside `host` (privacy-enhanced host) and destroys it on unmount or
 * error. A different `videoId` creates a new player.
 */
export function useYouTubePlayer(
  host: RefObject<HTMLDivElement | null>,
  { videoId, playerVars, onReady, onEnded }: YouTubePlayerOptions,
): { status: PlayerStatus; player: RefObject<YTPlayer | null> } {
  const player = useRef<YTPlayer | null>(null);
  const [status, setStatus] = useState<PlayerStatus>("loading");
  // The latest callbacks, read by the player's events without recreating the player.
  const callbacks = useRef({ onReady, onEnded });
  callbacks.current = { onReady, onEnded };
  const vars = JSON.stringify(playerVars);

  useEffect(() => {
    let cancelled = false;
    let instance: YTPlayer | null = null;

    // Safe to call more than once: it clears what it releases, so the unmount
    // cleanup does not destroy the player again after an error did.
    const teardown = () => {
      instance?.destroy();
      instance = null;
      player.current = null;
    };

    loadYouTubeApi()
      .then((YT) => {
        if (cancelled || !host.current) return;
        // The API replaces this element with its iframe, so React never owns it.
        const mount = document.createElement("div");
        host.current.appendChild(mount);
        instance = new YT.Player(mount, {
          host: "https://www.youtube-nocookie.com",
          videoId,
          width: "100%",
          height: "100%",
          playerVars: JSON.parse(vars) as Record<string, string | number>,
          events: {
            onReady: ({ target }) => {
              if (cancelled) return;
              player.current = target;
              callbacks.current.onReady?.(target);
              setStatus("ready");
            },
            onStateChange: ({ data, target }) => {
              if (data === YT.PlayerState.ENDED) callbacks.current.onEnded?.(target);
            },
            onError: () => {
              if (cancelled) return;
              teardown();
              setStatus("error");
            },
          },
        });
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
      teardown();
    };
  }, [host, videoId, vars]);

  return { status, player };
}
```

- [ ] **Step 3: Use it in `VideoPlayer`**

In `src/features/smoke/VideoPlayer.tsx`, change the imports to:

```ts
import { useEffect, useRef, useState } from "react";
import type { Video } from "../../data/schema";
import { effectiveStart, parseYouTubeUrl } from "../../lib/youtube";
import { useYouTubePlayer } from "./useYouTubePlayer";
import styles from "./VideoPlayer.module.css";
```

Replace the body of `YouTubeClip`, from its first line down to the line before `if (status === "error") {`, with:

```tsx
function YouTubeClip({ videoId, start, end, url, title, autoplay }: ClipProps) {
  const host = useRef<HTMLDivElement>(null);
  const [speed, setSpeed] = useState<number>(1);
  const { status, player } = useYouTubePlayer(host, {
    videoId,
    playerVars: { start, playsinline: 1, rel: 0, mute: 1, autoplay: autoplay ? 1 : 0 },
    onReady: (target) => {
      target.mute();
      if (autoplay) target.playVideo();
    },
    onEnded: (target) => {
      target.seekTo(start, true);
      target.playVideo();
    },
  });

  // The clip loop: once playback passes the end, jump back to the start.
  useEffect(() => {
    if (status !== "ready" || end === undefined) return;
    const timer = window.setInterval(() => {
      const target = player.current;
      if (target && target.getCurrentTime() >= end) target.seekTo(start, true);
    }, LOOP_CHECK_MS);
    return () => window.clearInterval(timer);
  }, [status, player, start, end]);

```

Leave the rest of the component (the error panel and the returned JSX) unchanged. `loadYouTubeApi` and `YTPlayer` are no longer imported here.

- [ ] **Step 4: Run the player tests, unchanged**

Run: `npx vitest run src/features/smoke/VideoPlayer.test.tsx`
Expected: PASS (12 tests). `git diff --stat src/features/smoke/VideoPlayer.test.tsx` prints nothing.

- [ ] **Step 5: Create `MapFrame` and `ExecuteMarkers`**

Create `src/features/map/MapFrame.tsx`:

```tsx
import type { ReactNode } from "react";
import { Link } from "react-router";
import type { MapInfo } from "../../data/maps";
import styles from "./MapPage.module.css";

/** The map screens' frame: heading, controls and radar on the left; the panel on the right. */
export function MapFrame({
  map,
  open = false,
  controls,
  radar,
  panel,
}: {
  map: MapInfo;
  /** On phones, hides the radar column while a card fills the screen. */
  open?: boolean;
  controls?: ReactNode;
  radar: ReactNode;
  panel: ReactNode;
}) {
  return (
    <div className={styles.page} data-open={open ? "true" : "false"}>
      <section className={styles.radarCol}>
        <div className={styles.heading}>
          <Link to="/" className={styles.back}>
            ← Maps
          </Link>
          <h1>{map.name}</h1>
        </div>
        {controls}
        {radar}
      </section>
      <section className={styles.panel}>{panel}</section>
    </div>
  );
}
```

Create `src/features/executes/ExecuteMarkers.tsx`:

```tsx
import type { Lineup, Position } from "../../data/schema";
import { LandingMarker, StandDot, StandLine } from "../map/markers";

/** An execute's smokes on a radar, numbered in throw order. */
export function ExecuteMarkers({
  lineups,
  isShown,
}: {
  lineups: readonly Lineup[];
  /** Whether a spot is on the level being shown. */
  isShown: (position: Position) => boolean;
}) {
  return (
    <>
      {lineups.map((lineup, index) => (
        <g key={lineup.id}>
          {isShown(lineup.stand) && isShown(lineup.land) && (
            <StandLine from={lineup.stand} to={lineup.land} />
          )}
          {isShown(lineup.land) && (
            <LandingMarker at={lineup.land} side={lineup.side} label={String(index + 1)} />
          )}
          {isShown(lineup.stand) && <StandDot at={lineup.stand} side={lineup.side} />}
        </g>
      ))}
    </>
  );
}
```

- [ ] **Step 6: Use them in `MapPage`**

Replace `src/features/map/MapPage.tsx` with:

```tsx
import type { ReactNode } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { NotFound } from "../../app/NotFound";
import { findExecute, findLineup, getMapData } from "../../data";
import { getMapInfo, hasLevels } from "../../data/maps";
import type { Level, Lineup, Position } from "../../data/schema";
import {
  applyFilters,
  filtersToSearch,
  neighbours,
  parseFilters,
  type Filters,
} from "../../lib/filters";
import { HIT_RADIUS_PX, nearestWithin, type Point } from "../../lib/radar";
import { ExecuteList } from "../executes/ExecuteList";
import { ExecuteMarkers } from "../executes/ExecuteMarkers";
import { ExecuteView } from "../executes/ExecuteView";
import { SmokeCard } from "../smoke/SmokeCard";
import { FiltersBar, LevelSwitch } from "./FiltersBar";
import { LineupList } from "./LineupList";
import { MapFrame } from "./MapFrame";
import { Radar } from "./Radar";
import { LandingMarker, StandDot, StandLine } from "./markers";
import styles from "./MapPage.module.css";

type Tab = "smokes" | "executes";

const isOn = (position: Position, level: Level, withLevels: boolean) =>
  !withLevels || (position.level ?? "upper") === level;

/** Filters plus the list tab, as a query string. */
function searchFor(filters: Filters, tab: Tab): string {
  const base = filtersToSearch(filters);
  if (tab === "smokes") return base;
  return base ? `${base}&tab=executes` : "?tab=executes";
}

export function MapPage() {
  const { mapId = "", lineupId, executeId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const map = getMapInfo(mapId);
  if (!map) return <NotFound />;

  const data = getMapData(map.id);
  const withLevels = hasLevels(map);
  const filters = parseFilters(params);
  const tab: Tab = params.get("tab") === "executes" ? "executes" : "smokes";
  const search = filtersToSearch(filters);
  const backToMap = (toTab: Tab) => `/maps/${map.id}${searchFor(filters, toTab)}`;

  const selected = lineupId ? findLineup(map.id, lineupId) : undefined;
  if (lineupId && !selected) {
    return <NotFound backTo={{ href: backToMap("smokes"), label: `Back to ${map.name}` }} />;
  }
  const execute = executeId ? findExecute(map.id, executeId) : undefined;
  if (executeId && !execute) {
    return <NotFound backTo={{ href: backToMap("executes"), label: `Back to ${map.name}` }} />;
  }

  const visible = applyFilters(data.lineups, filters, withLevels);
  const visibleExecutes = data.executes.filter(
    (e) => filters.side === "all" || e.side === filters.side,
  );
  const executeLineups = execute
    ? execute.lineupIds
        .map((id) => findLineup(map.id, id))
        .filter((lineup): lineup is Lineup => lineup !== undefined)
    : [];

  const replaceSearch = (nextSearch: string) => navigate({ search: nextSearch }, { replace: true });
  const smokeHref = (lineup: Lineup) => `/maps/${map.id}/smokes/${lineup.id}${search}`;
  const on = (position: Position) => isOn(position, filters.level, withLevels);

  // A deep-linked smoke stays on the radar even when the filters exclude it.
  const markers =
    selected && !visible.includes(selected) && on(selected.land) ? [...visible, selected] : visible;

  function handleTap(point: Point, widthPx: number) {
    const hit = nearestWithin(markers, (lineup) => lineup.land, point, HIT_RADIUS_PX / widthPx);
    if (hit) navigate(smokeHref(hit));
  }

  let radarContent: ReactNode;
  if (execute) {
    radarContent = <ExecuteMarkers lineups={executeLineups} isShown={on} />;
  } else {
    radarContent = (
      <>
        {markers.map((lineup) => (
          <LandingMarker
            key={lineup.id}
            at={lineup.land}
            side={lineup.side}
            selected={lineup.id === selected?.id}
          />
        ))}
        {selected && on(selected.stand) && on(selected.land) && (
          <StandLine from={selected.stand} to={selected.land} />
        )}
        {selected && on(selected.stand) && <StandDot at={selected.stand} side={selected.side} />}
      </>
    );
  }

  let panel: ReactNode;
  if (execute) {
    panel = (
      <ExecuteView
        map={map}
        execute={execute}
        lineups={executeLineups}
        closeHref={backToMap("executes")}
      />
    );
  } else if (selected) {
    const { prev, next } = neighbours(visible, selected.id);
    panel = (
      <SmokeCard
        map={map}
        lineup={selected}
        closeHref={backToMap("smokes")}
        prevHref={prev && smokeHref(prev)}
        nextHref={next && smokeHref(next)}
      />
    );
  } else {
    panel = (
      <>
        <div role="tablist" aria-label="List" className={styles.tabs}>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "smokes"}
            onClick={() => replaceSearch(searchFor(filters, "smokes"))}
          >
            Smokes ({visible.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "executes"}
            onClick={() => replaceSearch(searchFor(filters, "executes"))}
          >
            Executes ({visibleExecutes.length})
          </button>
        </div>
        {tab === "smokes" ? (
          <LineupList
            mapId={map.id}
            lineups={visible}
            search={search}
            emptyText={
              data.lineups.length === 0
                ? "No smokes on this map yet."
                : "No smokes match these filters."
            }
          />
        ) : (
          <ExecuteList
            mapId={map.id}
            executes={visibleExecutes}
            lineups={data.lineups}
            search={search}
            emptyText={
              data.executes.length === 0
                ? "No executes on this map yet."
                : "No executes match these filters."
            }
          />
        )}
      </>
    );
  }

  return (
    <MapFrame
      map={map}
      open={selected !== undefined}
      controls={
        execute ? (
          withLevels && (
            <LevelSwitch
              value={filters.level}
              onSelect={(level) => replaceSearch(searchFor({ ...filters, level }, tab))}
            />
          )
        ) : (
          <FiltersBar
            map={map}
            filters={filters}
            onChange={(next) => replaceSearch(searchFor(next, tab))}
          />
        )
      }
      radar={
        <Radar
          map={map}
          level={filters.level}
          label={`${map.name} radar`}
          onTap={execute ? undefined : handleTap}
        >
          {radarContent}
        </Radar>
      }
      panel={panel}
    />
  );
}
```

- [ ] **Step 7: Run all tests, type-check and lint**

Run: `npx vitest run && npx tsc --noEmit && npm run format && npm run lint`
Expected: the same number of passing tests as Step 1 (plus the Task 1 tests), no type errors, lint clean.

- [ ] **Step 8: Commit**

```bash
git add src/features/smoke/useYouTubePlayer.ts src/features/smoke/VideoPlayer.tsx src/features/map/MapFrame.tsx src/features/executes/ExecuteMarkers.tsx src/features/map/MapPage.tsx
git commit -m "refactor: extract useYouTubePlayer, MapFrame and ExecuteMarkers"
```

---

### Task 3: Server-side save (`saveMapFile`)

Spec §4, steps 2–8: map id, stale check, validation, canonical layout, atomic write with retries. A plain async function, so tests drive it against a temp folder.

**Files:**
- Create: `scripts/save-map.ts`
- Create: `scripts/temp-data-dir.ts`
- Create: `scripts/save-map.test.ts`

**Interfaces:**
- Consumes: `formatMapFile` (Task 1); `loadDataFiles(dir)` from `scripts/load-data.ts`; `validateDataFiles` from `src/data/validate.ts`; `MAP_IDS`, `MapFile`, `MapId` from `src/data/schema.ts`.
- Produces (Task 4 uses them):
  - `saveMapFile(request: SaveRequest): Promise<SaveResult>` where `SaveRequest = { dataDir: string; mapId: string; base: unknown; file: unknown; fs?: SaveFs; sleep?: (ms: number) => Promise<void> }`.
  - `type SaveResult = { status: 200; file: MapFile; text: string } | { status: 400; errors: FieldError[] } | { status: 404; error: "unknown-map" } | { status: 409; error: "changed" | "invalid-on-disk" } | { status: 500; error: "write-failed"; message: string }`.
  - `interface FieldError { path: string; message: string }`, `interface SaveFs { readText; writeText; rename; remove }`, `nodeFs: SaveFs`, `RENAME_DELAYS_MS = [50, 100, 250, 500]`.
  - Test helper `makeDataDir(files?: Partial<Record<MapId, MapFile>>): Promise<{ dir: string; path(id: MapId): string; cleanup(): void }>`.

- [ ] **Step 1: Write the temp-folder helper**

Create `scripts/temp-data-dir.ts`:

```ts
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MAP_IDS, type MapFile, type MapId } from "../src/data/schema";
import { formatMapFile } from "./format-map";

/** Test helper: a temp data folder with all seven map files (empty unless given). */
export async function makeDataDir(files: Partial<Record<MapId, MapFile>> = {}) {
  const dir = mkdtempSync(join(tmpdir(), "cs-smokes-data-"));
  for (const id of MAP_IDS) {
    const file = files[id] ?? { map: id, lineups: [], executes: [] };
    writeFileSync(join(dir, `${id}.json`), await formatMapFile(file));
  }
  return {
    dir,
    path: (id: MapId) => join(dir, `${id}.json`),
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}
```

- [ ] **Step 2: Write the failing tests**

Create `scripts/save-map.test.ts`:

```ts
// @vitest-environment node
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MapFile } from "../src/data/schema";
import { makeExecute, makeLineup, makeMapFile } from "../src/test/fixtures";
import { formatMapFile } from "./format-map";
import { RENAME_DELAYS_MS, nodeFs, saveMapFile, type SaveFs, type SaveRequest } from "./save-map";
import { makeDataDir } from "./temp-data-dir";

const WINDOW = makeLineup();
const CT = makeLineup({ id: "mirage-ct-from-t-ramp", name: "CT", from: "T Ramp", area: "A" });
const JUNGLE = makeLineup({ id: "mirage-jungle-from-t-ramp", name: "Jungle", from: "T Ramp" });
const MIRAGE: MapFile = makeMapFile("mirage", [WINDOW, CT, JUNGLE], [makeExecute()]);

let data: Awaited<ReturnType<typeof makeDataDir>>;
const sleep = vi.fn(async (_ms: number) => {});

beforeEach(async () => {
  data = await makeDataDir({ mirage: MIRAGE });
  sleep.mockClear();
});
afterEach(() => data.cleanup());

const renamed = (name: string): MapFile => ({
  ...MIRAGE,
  lineups: MIRAGE.lineups.map((lineup, i) => (i === 0 ? { ...lineup, name } : lineup)),
});
const save = (file: unknown, overrides: Partial<SaveRequest> = {}) =>
  saveMapFile({ dataDir: data.dir, mapId: "mirage", base: MIRAGE, file, sleep, ...overrides });
const onDisk = () => readFileSync(data.path("mirage"), "utf8");
const tempFiles = () => readdirSync(data.dir).filter((name) => name.endsWith(".tmp"));
const errno = (code: string) =>
  Object.assign(new Error(`${code}: operation not permitted`), { code });

describe("saveMapFile", () => {
  it("writes the canonical text and returns the file as written", async () => {
    const next = renamed("Window box");
    const text = await formatMapFile(next);
    expect(await save(next)).toEqual({ status: 200, file: next, text });
    expect(onDisk()).toBe(text);
    expect(tempFiles()).toEqual([]);
  });

  it("accepts a base whose keys are in another order", async () => {
    const reordered = { executes: MIRAGE.executes, lineups: MIRAGE.lineups, map: "mirage" };
    expect((await save(renamed("Window box"), { base: reordered })).status).toBe(200);
  });

  it("refuses an invalid file with each problem's JSON path, writing nothing", async () => {
    const before = onDisk();
    expect(await save(renamed("x".repeat(41)))).toEqual({
      status: 400,
      errors: [{ path: "lineups[0].name", message: "must be at most 40 characters" }],
    });
    expect(onDisk()).toBe(before);
  });

  it("refuses an id that is already used", async () => {
    const clash = { ...MIRAGE, executes: [makeExecute({ id: "mirage-ct-from-t-ramp" })] };
    expect(await save(clash)).toEqual({
      status: 400,
      errors: [
        {
          path: "executes[0].id",
          message: 'duplicate id "mirage-ct-from-t-ramp" (also at mirage.json → lineups[1])',
        },
      ],
    });
  });

  it("refuses a file whose map field doesn't match the URL", async () => {
    expect(await save({ ...MIRAGE, map: "nuke" })).toEqual({
      status: 400,
      errors: [{ path: "map", message: 'must be "mirage" to match the file name' }],
    });
  });

  it("reports a stale base as changed, writing nothing", async () => {
    writeFileSync(data.path("mirage"), await formatMapFile(renamed("Edited by hand")));
    expect(await save(renamed("Window box"))).toEqual({ status: 409, error: "changed" });
    expect(onDisk()).toContain("Edited by hand");
  });

  it("reports a file on disk that isn't valid JSON", async () => {
    writeFileSync(data.path("mirage"), "{ broken");
    expect(await save(MIRAGE)).toEqual({ status: 409, error: "invalid-on-disk" });
  });

  it("answers 404 for an unknown map", async () => {
    expect(await save(MIRAGE, { mapId: "overpass" })).toEqual({ status: 404, error: "unknown-map" });
  });

  describe("when the rename fails", () => {
    const failingRename = (failures: number, code = "EPERM"): SaveFs => {
      let calls = 0;
      return {
        ...nodeFs,
        rename: async (from, to) => {
          calls += 1;
          if (calls <= failures) throw errno(code);
          return nodeFs.rename(from, to);
        },
      };
    };

    it("retries EPERM and saves", async () => {
      expect((await save(renamed("Window box"), { fs: failingRename(2) })).status).toBe(200);
      expect(sleep.mock.calls).toEqual([[50], [100]]);
    });

    it("gives up after five attempts, keeping the original and removing the temp file", async () => {
      const fs = failingRename(99);
      const rename = vi.spyOn(fs, "rename");
      const before = onDisk();
      expect(await save(renamed("Window box"), { fs })).toEqual({
        status: 500,
        error: "write-failed",
        message: "EPERM: operation not permitted",
      });
      expect(rename).toHaveBeenCalledTimes(RENAME_DELAYS_MS.length + 1);
      expect(sleep.mock.calls).toEqual([[50], [100], [250], [500]]);
      expect(onDisk()).toBe(before);
      expect(tempFiles()).toEqual([]);
    });

    it("doesn't retry other errors", async () => {
      const result = await save(renamed("Window box"), { fs: failingRename(1, "EACCES") });
      expect(result).toMatchObject({ status: 500, error: "write-failed" });
      expect(sleep).not.toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 3: Run them to make sure they fail**

Run: `npx vitest run scripts/save-map.test.ts`
Expected: FAIL — `Failed to resolve import "./save-map"`.

- [ ] **Step 4: Implement `saveMapFile`**

Create `scripts/save-map.ts`:

```ts
import { readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { MAP_IDS, type MapFile, type MapId } from "../src/data/schema";
import { validateDataFiles } from "../src/data/validate";
import { formatMapFile } from "./format-map";
import { loadDataFiles } from "./load-data";

export interface FieldError {
  path: string;
  message: string;
}

export type SaveResult =
  | { status: 200; file: MapFile; text: string }
  | { status: 400; errors: FieldError[] }
  | { status: 404; error: "unknown-map" }
  | { status: 409; error: "changed" | "invalid-on-disk" }
  | { status: 500; error: "write-failed"; message: string };

/** The file operations a save needs; tests swap in failing ones. */
export interface SaveFs {
  readText(path: string): Promise<string>;
  writeText(path: string, text: string): Promise<void>;
  rename(from: string, to: string): Promise<void>;
  remove(path: string): Promise<void>;
}

export const nodeFs: SaveFs = {
  readText: (path) => readFile(path, "utf8"),
  writeText: (path, text) => writeFile(path, text, "utf8"),
  rename: (from, to) => rename(from, to),
  remove: (path) => rm(path, { force: true }),
};

/** Waits between rename attempts: Windows briefly refuses while an editor or antivirus holds the file. */
export const RENAME_DELAYS_MS = [50, 100, 250, 500];
const RETRYABLE = new Set(["EPERM", "EBUSY"]);

export interface SaveRequest {
  dataDir: string;
  mapId: string;
  /** The map file as the page had it before this edit. */
  base: unknown;
  file: unknown;
  fs?: SaveFs;
  sleep?: (ms: number) => Promise<void>;
}

const isMapId = (value: string): value is MapId => (MAP_IDS as readonly string[]).includes(value);
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Phase 2 spec §4, steps 2–8: stale check, validation, canonical layout, atomic write. */
export async function saveMapFile({
  dataDir,
  mapId,
  base,
  file,
  fs = nodeFs,
  sleep = wait,
}: SaveRequest): Promise<SaveResult> {
  if (!isMapId(mapId)) return { status: 404, error: "unknown-map" };
  const fileName = `${mapId}.json`;
  const path = join(dataDir, fileName);

  let current: unknown;
  try {
    current = JSON.parse(await fs.readText(path));
  } catch {
    return { status: 409, error: "invalid-on-disk" };
  }
  if (!isDeepStrictEqual(current, base)) return { status: 409, error: "changed" };

  const files = loadDataFiles(dataDir).map((entry) =>
    entry.fileName === fileName ? { fileName, content: file } : entry,
  );
  const errors = validateDataFiles(files)
    .filter((error) => error.file === fileName)
    .map(({ path: errorPath, message }) => ({ path: errorPath, message }));
  if (errors.length > 0) return { status: 400, errors };

  const text = await formatMapFile(file);
  const temp = join(dataDir, `.${fileName}.tmp`);
  try {
    await fs.writeText(temp, text);
    await renameWithRetry(fs, temp, path, sleep);
  } catch (error) {
    await fs.remove(temp).catch(() => undefined);
    return { status: 500, error: "write-failed", message: (error as Error).message };
  }
  return { status: 200, file: JSON.parse(text) as MapFile, text };
}

async function renameWithRetry(
  fs: SaveFs,
  from: string,
  to: string,
  sleep: (ms: number) => Promise<void>,
): Promise<void> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      await fs.rename(from, to);
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code ?? "";
      if (attempt >= RENAME_DELAYS_MS.length || !RETRYABLE.has(code)) throw error;
      await sleep(RENAME_DELAYS_MS[attempt]);
    }
  }
}
```

- [ ] **Step 5: Run the tests to make sure they pass**

Run: `npx vitest run scripts/save-map.test.ts`
Expected: PASS (11 tests).

- [ ] **Step 6: Lint and commit**

Run: `npm run format && npm run lint && npx tsc --noEmit`

```bash
git add scripts/save-map.ts scripts/save-map.test.ts scripts/temp-data-dir.ts
git commit -m "feat: add the edit-mode save with stale check, validation and atomic write"
```

---

### Task 4: The Vite edit plugin and the bundle check

Spec §3.1, §3.3, §3.4 and §4 step 1. The plugin mounts the endpoint and skips Vite's reload for its own writes. `npm run check-bundle` runs in CI after the build.

**Files:**
- Create: `scripts/edit-plugin.ts`
- Create: `scripts/edit-plugin.test.ts`
- Create: `scripts/bundle.ts`
- Create: `scripts/bundle.test.ts`
- Create: `scripts/check-bundle.ts`
- Modify: `vite.config.ts`
- Modify: `package.json` (scripts)
- Modify: `.github/workflows/deploy.yml`

**Interfaces:**
- Consumes: `saveMapFile` (Task 3), `makeDataDir` (Task 3), `DATA_DIR` from `scripts/load-data.ts`.
- Produces:
  - `editPlugin(dataDir?: string): Plugin` (wired in `vite.config.ts`).
  - `createEditMiddleware({ dataDir, onWritten }: { dataDir: string; onWritten: (path: string, text: string) => void }): (req: IncomingMessage, res: ServerResponse, next: (error?: unknown) => void) => void`.
  - `createWriteTracker(): { remember(path: string, text: string): void; isOwnWrite(path: string, read: () => string | Promise<string>): Promise<boolean> }`.
  - `requestProblem(info: { remoteAddress?: string; origin?: string; host?: string; contentType?: string }): { status: 403 | 415; error: string } | null`.
  - `findEditCode(dir: string): string[]`, `EDIT_MARKER = "/__edit/"`; `npm run check-bundle`.

- [ ] **Step 1: Write the failing plugin tests**

Create `scripts/edit-plugin.test.ts`:

```ts
// @vitest-environment node
import { readFileSync } from "node:fs";
import { createServer, request as httpRequest, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import { normalizePath } from "vite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MapFile } from "../src/data/schema";
import { makeLineup, makeMapFile } from "../src/test/fixtures";
import { createEditMiddleware, createWriteTracker, requestProblem } from "./edit-plugin";
import { makeDataDir } from "./temp-data-dir";

describe("requestProblem", () => {
  const ok = {
    remoteAddress: "127.0.0.1",
    origin: undefined,
    host: "localhost:5173",
    contentType: "application/json",
  };

  it("accepts a JSON request from this machine without an Origin", () => {
    expect(requestProblem(ok)).toBeNull();
  });

  it.each(["::1", "::ffff:127.0.0.1"])("accepts loopback address %s", (remoteAddress) => {
    expect(requestProblem({ ...ok, remoteAddress })).toBeNull();
  });

  it("refuses other addresses", () => {
    expect(requestProblem({ ...ok, remoteAddress: "192.168.1.20" })).toEqual({
      status: 403,
      error: "not-local",
    });
    expect(requestProblem({ ...ok, remoteAddress: undefined })).toEqual({
      status: 403,
      error: "not-local",
    });
  });

  it("accepts the dev site's own origin and refuses others", () => {
    expect(requestProblem({ ...ok, origin: "http://localhost:5173" })).toBeNull();
    expect(requestProblem({ ...ok, origin: "https://example.com" })).toEqual({
      status: 403,
      error: "foreign-origin",
    });
    expect(requestProblem({ ...ok, origin: "not a url" })).toEqual({
      status: 403,
      error: "foreign-origin",
    });
  });

  it("accepts JSON with a charset and refuses other bodies", () => {
    expect(requestProblem({ ...ok, contentType: "application/json; charset=utf-8" })).toBeNull();
    expect(requestProblem({ ...ok, contentType: "text/plain" })).toEqual({
      status: 415,
      error: "json-only",
    });
    expect(requestProblem({ ...ok, contentType: undefined })).toEqual({
      status: 415,
      error: "json-only",
    });
  });
});

describe("createWriteTracker", () => {
  const path = join(process.cwd(), "data", "maps", "mirage.json");

  it("recognises its own write under Vite's forward-slash path", async () => {
    const tracker = createWriteTracker();
    tracker.remember(path, "written text");
    expect(await tracker.isOwnWrite(normalizePath(path), () => "written text")).toBe(true);
  });

  it("lets other changes through", async () => {
    const tracker = createWriteTracker();
    tracker.remember(path, "written text");
    expect(await tracker.isOwnWrite(path, () => "edited by hand")).toBe(false);
    expect(await tracker.isOwnWrite(join(process.cwd(), "data", "maps", "nuke.json"), () => "x")).toBe(
      false,
    );
  });
});

describe("edit middleware", () => {
  const MIRAGE: MapFile = makeMapFile("mirage", [makeLineup()]);
  const RENAMED: MapFile = { ...MIRAGE, lineups: [{ ...MIRAGE.lineups[0], name: "Window box" }] };
  const JSON_HEADERS = { "Content-Type": "application/json" };
  const onWritten = vi.fn();
  const passedOn = vi.fn();
  let data: Awaited<ReturnType<typeof makeDataDir>>;
  let server: Server;
  let origin: string;

  beforeEach(async () => {
    data = await makeDataDir({ mirage: MIRAGE });
    onWritten.mockClear();
    passedOn.mockClear();
    const middleware = createEditMiddleware({ dataDir: data.dir, onWritten });
    server = createServer((req, res) =>
      middleware(req, res, () => {
        passedOn();
        res.statusCode = 404;
        res.end();
      }),
    );
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterEach(async () => {
    await new Promise((resolve) => server.close(resolve));
    data.cleanup();
  });

  function send(method: string, path: string, body = "", headers: Record<string, string> = JSON_HEADERS) {
    return new Promise<{ status: number; body: unknown }>((resolve, reject) => {
      const req = httpRequest(`${origin}${path}`, { method, headers }, (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          resolve({ status: res.statusCode ?? 0, body: text ? JSON.parse(text) : undefined });
        });
      });
      req.on("error", reject);
      req.end(body);
    });
  }
  const put = (body: unknown, headers?: Record<string, string>, map = "mirage") =>
    send("PUT", `/__edit/maps/${map}`, JSON.stringify(body), headers);

  it("saves a map and answers with the file as written", async () => {
    expect(await put({ base: MIRAGE, file: RENAMED })).toEqual({ status: 200, body: { file: RENAMED } });
    const text = readFileSync(data.path("mirage"), "utf8");
    expect(text).toContain('"name": "Window box"');
    expect(onWritten).toHaveBeenCalledWith(data.path("mirage"), text);
  });

  it("passes the save's refusals through", async () => {
    expect(await put({ base: RENAMED, file: RENAMED })).toEqual({
      status: 409,
      body: { error: "changed" },
    });
    expect(await put({ base: MIRAGE, file: MIRAGE }, JSON_HEADERS, "overpass")).toEqual({
      status: 404,
      body: { error: "unknown-map" },
    });
    expect(onWritten).not.toHaveBeenCalled();
  });

  it("refuses a body that isn't JSON or lacks base and file", async () => {
    expect(await send("PUT", "/__edit/maps/mirage", "{ nope")).toEqual({
      status: 400,
      body: { errors: [{ path: "", message: "the request body is not valid JSON" }] },
    });
    expect(await put({ file: RENAMED })).toEqual({
      status: 400,
      body: { errors: [{ path: "", message: "the request body must be { base, file }" }] },
    });
  });

  it("refuses another website and non-JSON bodies", async () => {
    const foreign = { ...JSON_HEADERS, Origin: "https://example.com" };
    expect(await put({ base: MIRAGE, file: RENAMED }, foreign)).toEqual({
      status: 403,
      body: { error: "foreign-origin" },
    });
    expect(await put({ base: MIRAGE, file: RENAMED }, { "Content-Type": "text/plain" })).toEqual({
      status: 415,
      body: { error: "json-only" },
    });
    expect(readFileSync(data.path("mirage"), "utf8")).not.toContain("Window box");
  });

  it("leaves other requests to Vite", async () => {
    expect((await send("GET", "/__edit/maps/mirage")).status).toBe(404);
    expect((await send("PUT", "/__edit/other", "{}")).status).toBe(404);
    expect(passedOn).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run them to make sure they fail**

Run: `npx vitest run scripts/edit-plugin.test.ts`
Expected: FAIL — `Failed to resolve import "./edit-plugin"`.

- [ ] **Step 3: Implement the plugin**

Create `scripts/edit-plugin.ts`:

```ts
import type { IncomingMessage, ServerResponse } from "node:http";
import { join, resolve } from "node:path";
import { normalizePath, type Plugin } from "vite";
import { DATA_DIR } from "./load-data";
import { saveMapFile } from "./save-map";

const ROUTE = /^\/__edit\/maps\/([a-z0-9]+)$/;
const LOOPBACK = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

export interface RequestInfo {
  remoteAddress?: string;
  origin?: string;
  host?: string;
  contentType?: string;
}

/** Spec §4 step 1: only this machine, only the dev site's own pages, only JSON. */
export function requestProblem({
  remoteAddress,
  origin,
  host,
  contentType,
}: RequestInfo): { status: 403 | 415; error: string } | null {
  if (remoteAddress === undefined || !LOOPBACK.has(remoteAddress)) {
    return { status: 403, error: "not-local" };
  }
  if (origin !== undefined && !sameHost(origin, host)) return { status: 403, error: "foreign-origin" };
  if (!contentType?.toLowerCase().startsWith("application/json")) {
    return { status: 415, error: "json-only" };
  }
  return null;
}

function sameHost(origin: string, host: string | undefined): boolean {
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/** Remembers what the editor wrote, so its own writes don't reload the page (spec §3.3). */
export function createWriteTracker() {
  const written = new Map<string, string>();
  const key = (path: string) => normalizePath(resolve(path));
  return {
    remember(path: string, text: string): void {
      written.set(key(path), text);
    },
    async isOwnWrite(path: string, read: () => string | Promise<string>): Promise<boolean> {
      const text = written.get(key(path));
      return text !== undefined && (await read()) === text;
    },
  };
}

type Next = (error?: unknown) => void;

export function createEditMiddleware({
  dataDir,
  onWritten,
}: {
  dataDir: string;
  onWritten: (path: string, text: string) => void;
}) {
  return (req: IncomingMessage, res: ServerResponse, next: Next): void => {
    const match = ROUTE.exec((req.url ?? "").split("?")[0]);
    if (req.method !== "PUT" || !match) return next();
    handleSave(req, res, match[1], dataDir, onWritten).catch(next);
  };
}

async function handleSave(
  req: IncomingMessage,
  res: ServerResponse,
  mapId: string,
  dataDir: string,
  onWritten: (path: string, text: string) => void,
): Promise<void> {
  const problem = requestProblem({
    remoteAddress: req.socket.remoteAddress,
    origin: req.headers.origin,
    host: req.headers.host,
    contentType: req.headers["content-type"],
  });
  if (problem) return send(res, problem.status, { error: problem.error });

  let body: unknown;
  try {
    body = JSON.parse(await readBody(req));
  } catch {
    return send(res, 400, { errors: [{ path: "", message: "the request body is not valid JSON" }] });
  }
  if (typeof body !== "object" || body === null || !("base" in body) || !("file" in body)) {
    return send(res, 400, {
      errors: [{ path: "", message: "the request body must be { base, file }" }],
    });
  }

  const result = await saveMapFile({ dataDir, mapId, base: body.base, file: body.file });
  if (result.status === 200) {
    onWritten(join(dataDir, `${mapId}.json`), result.text);
    return send(res, 200, { file: result.file });
  }
  const { status, ...rest } = result;
  return send(res, status, rest);
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function send(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

/** Edit mode's dev-server side (spec §3–4). `apply: "serve"`: `vite build` never loads it. */
export function editPlugin(dataDir: string = DATA_DIR): Plugin {
  const tracker = createWriteTracker();
  return {
    name: "cs-smokes-edit",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(createEditMiddleware({ dataDir, onWritten: tracker.remember }));
    },
    async handleHotUpdate({ file, read }) {
      // No modules to update: Vite neither reloads nor hot-updates for the editor's own write.
      if (await tracker.isOwnWrite(file, read)) return [];
    },
  };
}
```

- [ ] **Step 4: Run the plugin tests to make sure they pass**

Run: `npx vitest run scripts/edit-plugin.test.ts`
Expected: PASS (13 tests).

- [ ] **Step 5: Write the failing bundle-check test**

Create `scripts/bundle.test.ts`:

```ts
// @vitest-environment node
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { findEditCode } from "./bundle";

let dir: string;
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("findEditCode", () => {
  it("lists the files that contain the edit endpoint, with forward slashes", () => {
    dir = mkdtempSync(join(tmpdir(), "cs-smokes-dist-"));
    mkdirSync(join(dir, "assets"));
    writeFileSync(join(dir, "index.html"), "<script src=assets/index.js></script>");
    writeFileSync(join(dir, "assets", "index.js"), 'console.log("site")');
    writeFileSync(join(dir, "assets", "edit.js"), 'fetch("/__edit/maps/mirage")');
    expect(findEditCode(dir)).toEqual(["assets/edit.js"]);
  });

  it("returns nothing for a clean build", () => {
    dir = mkdtempSync(join(tmpdir(), "cs-smokes-dist-"));
    writeFileSync(join(dir, "index.html"), "<p>site</p>");
    expect(findEditCode(dir)).toEqual([]);
  });
});
```

Run: `npx vitest run scripts/bundle.test.ts`
Expected: FAIL — `Failed to resolve import "./bundle"`.

- [ ] **Step 6: Implement the bundle check**

Create `scripts/bundle.ts`:

```ts
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
```

Create `scripts/check-bundle.ts`:

```ts
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
```

In `package.json` `scripts`, add after `"check-videos"`:

```json
    "check-bundle": "tsx scripts/check-bundle.ts",
```

Run: `npx vitest run scripts/bundle.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 7: Wire the plugin and the CI step**

Replace `vite.config.ts` with:

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { editPlugin } from "./scripts/edit-plugin";

export default defineConfig({
  base: "./",
  plugins: [react(), editPlugin()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.ts"],
  },
});
```

In `.github/workflows/deploy.yml`, after `- run: npm run build`, add:

```yaml
      - run: npm run check-bundle
```

- [ ] **Step 8: Check the endpoint on the real dev server**

Start the dev server in the background: `npm run dev -- --port 5199 --strictPort` (run it detached; it keeps running).

Save this as `tmp/put-unchanged.mjs`:

```js
import { readFileSync } from "node:fs";
import { request } from "node:http";

const text = readFileSync("data/maps/mirage.json", "utf8");
const body = `{"base":${text},"file":${text}}`;

// node:http, not fetch, so the Origin header is sent exactly as written.
function put(headers) {
  return new Promise((resolve, reject) => {
    const url = "http://localhost:5199/__edit/maps/mirage";
    const req = request(url, { method: "PUT", headers }, (res) => {
      res.resume();
      res.on("end", () => resolve(res.statusCode));
    });
    req.on("error", reject);
    req.end(body);
  });
}

console.log("same file:", await put({ "Content-Type": "application/json" }));
console.log(
  "foreign origin:",
  await put({ "Content-Type": "application/json", Origin: "https://example.com" }),
);
```

Run: `node tmp/put-unchanged.mjs`
Expected: `same file: 200` and `foreign origin: 403`. Then `git status --short data/maps` prints nothing (the canonical text was rewritten unchanged). Stop the dev server.

- [ ] **Step 9: Run everything and commit**

Run: `npm run format && npm run lint && npx vitest run && npm run build && npm run check-bundle`
Expected: lint clean; all tests pass; build succeeds; `Bundle OK: no edit-mode code in dist/.`

```bash
git add scripts/edit-plugin.ts scripts/edit-plugin.test.ts scripts/bundle.ts scripts/bundle.test.ts scripts/check-bundle.ts vite.config.ts package.json .github/workflows/deploy.yml
git commit -m "feat: add the edit-mode Vite plugin and npm run check-bundle"
```

---

### Task 5: Data store — `replaceMapFile` and `useDataVersion`

Spec §3.3, steps 4–5. A save swaps the map's entry in the bundled data and notifies the three screens that read data, so they re-render without a reload.

**Files:**
- Modify: `src/data/api.ts`
- Modify: `src/data/api.test.ts`
- Modify: `src/data/index.ts`
- Modify: `src/features/home/HomePage.tsx`
- Modify: `src/features/map/MapPage.tsx`
- Modify: `src/features/study/StudyPage.tsx`
- Modify: `src/test/fixtureData.ts`
- Create: `src/features/home/HomePage.test.tsx`
- Modify: `src/features/map/MapPage.test.tsx`

**Interfaces:**
- Consumes: `createDataApi` (existing).
- Produces (Tasks 8–13 use them):
  - From `src/data` (`index.ts`): `replaceMapFile(id: MapId, file: MapFile): void` and `useDataVersion(): number`, alongside the existing `getMapData`, `findLineup`, `findExecute`, `allLineups`.
  - `createDataApi(initial)` copies `initial`, so replacing a map never changes the caller's object.
  - `restoreFixtureData(): Promise<void>` in `src/test/fixtureData.ts`: puts `FIXTURE_DATA` back into the mocked data module (call it in `afterEach` in tests that save).

- [ ] **Step 1: Write the failing API tests**

In `src/data/api.test.ts`, add `import { act, renderHook } from "@testing-library/react";` at the top and append:

```ts
describe("replaceMapFile", () => {
  it("serves the new file everywhere, leaving the original data untouched", () => {
    const api = createDataApi(data);
    const next = makeMapFile("mirage", [makeLineup({ id: "mirage-c" })]);
    api.replaceMapFile("mirage", next);
    expect(api.getMapData("mirage")).toBe(next);
    expect(api.findLineup("mirage", "mirage-c")?.id).toBe("mirage-c");
    expect(api.findLineup("mirage", "mirage-a")).toBeUndefined();
    expect(api.allLineups().map(({ lineup }) => lineup.id)).toEqual(["ancient-a", "mirage-c"]);
    expect(data.mirage.lineups.map((lineup) => lineup.id)).toEqual(["mirage-a", "mirage-b"]);
  });

  it("re-renders components that use useDataVersion", () => {
    const api = createDataApi(data);
    const { result } = renderHook(() => api.useDataVersion());
    expect(result.current).toBe(0);
    act(() => api.replaceMapFile("ancient", makeMapFile("ancient")));
    expect(result.current).toBe(1);
  });
});
```

Run: `npx vitest run src/data/api.test.ts`
Expected: FAIL — `api.replaceMapFile is not a function`.

- [ ] **Step 2: Implement the store**

Replace `src/data/api.ts` with:

```ts
import { useSyncExternalStore } from "react";
import { MAP_IDS, type Execute, type Lineup, type MapFile, type MapId } from "./schema";

export interface LocatedLineup {
  map: MapId;
  lineup: Lineup;
}

export function createDataApi(initial: Record<MapId, MapFile>) {
  // A copy: replacing a map never changes the caller's object (page tests share fixture data).
  const data = { ...initial };
  let version = 0;
  const listeners = new Set<() => void>();
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };
  const getVersion = () => version;

  return {
    getMapData: (id: MapId): MapFile => data[id],
    findLineup: (map: MapId, id: string): Lineup | undefined =>
      data[map].lineups.find((lineup) => lineup.id === id),
    findExecute: (map: MapId, id: string): Execute | undefined =>
      data[map].executes.find((execute) => execute.id === id),
    allLineups: (): LocatedLineup[] =>
      MAP_IDS.flatMap((map) => data[map].lineups.map((lineup) => ({ map, lineup }))),
    /** Edit mode: swaps in a saved map file and re-renders the screens that read data. */
    replaceMapFile(id: MapId, file: MapFile): void {
      data[id] = file;
      version += 1;
      listeners.forEach((listener) => listener());
    },
    /** Re-renders the calling component after every replaceMapFile. */
    useDataVersion: (): number => useSyncExternalStore(subscribe, getVersion),
  };
}
```

In `src/data/index.ts`, replace the doc comment and the last line:

```ts
/**
 * The bundled data as built. It is validated in CI (npm run validate), so it is trusted here.
 * Edit mode (dev only) may swap maps later with replaceMapFile; always read through getMapData.
 */
```

```ts
export const {
  getMapData,
  findLineup,
  findExecute,
  allLineups,
  replaceMapFile,
  useDataVersion,
} = createDataApi(MAP_DATA);
```

Run: `npx vitest run src/data`
Expected: PASS.

- [ ] **Step 3: Write the failing screen tests**

In `src/test/fixtureData.ts`, change the schema import to `import { MAP_IDS, type MapFile, type MapId } from "../data/schema";` and append:

```ts
/** Undoes edit-mode saves between tests: puts the fixture files back into the mocked data module. */
export async function restoreFixtureData(): Promise<void> {
  const { replaceMapFile } = await import("../data");
  for (const id of MAP_IDS) replaceMapFile(id, FIXTURE_DATA[id]);
}
```

Create `src/features/home/HomePage.test.tsx`:

```tsx
import { act, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { replaceMapFile } from "../../data";
import { restoreFixtureData } from "../../test/fixtureData";
import { makeLineup, makeMapFile } from "../../test/fixtures";
import { renderAt } from "../../test/render";

vi.mock("../../data", async () => (await import("../../test/fixtureData")).mockDataModule());

afterEach(() => restoreFixtureData());

describe("HomePage", () => {
  it("updates a map's count when edit mode saves the map", () => {
    renderAt("/");
    expect(screen.getByRole("link", { name: /Ancient/ })).toHaveTextContent("0/0 known");
    act(() =>
      replaceMapFile(
        "ancient",
        makeMapFile("ancient", [makeLineup({ id: "ancient-cave-from-t-spawn" })]),
      ),
    );
    expect(screen.getByRole("link", { name: /Ancient/ })).toHaveTextContent("0/1 known");
  });
});
```

In `src/features/map/MapPage.test.tsx`, change the first import line to `import { act, fireEvent, screen, within } from "@testing-library/react";`, change the vitest import to `import { afterEach, describe, expect, it, vi } from "vitest";`, add these imports:

```tsx
import { replaceMapFile } from "../../data";
import { restoreFixtureData } from "../../test/fixtureData";
import { makeLineup, makeMapFile } from "../../test/fixtures";
```

add `afterEach(() => restoreFixtureData());` after the `vi.mock` lines, and add this test inside `describe("MapPage", …)`:

```tsx
  it("re-renders with a map file that edit mode saved", () => {
    renderAt("/maps/ancient");
    expect(screen.getByText("No smokes on this map yet.")).toBeInTheDocument();
    act(() =>
      replaceMapFile(
        "ancient",
        makeMapFile("ancient", [makeLineup({ id: "ancient-cave-from-t-spawn", name: "Cave" })]),
      ),
    );
    expect(smokeRows()).toHaveLength(1);
    expect(smokeRows()[0]).toHaveTextContent("Cave");
  });
```

Run: `npx vitest run src/features/home src/features/map/MapPage.test.tsx`
Expected: FAIL — both new tests still show the old data (no re-render).

- [ ] **Step 4: Subscribe the three screens**

- `src/features/home/HomePage.tsx`: import `useDataVersion` alongside `allLineups, getMapData` from `"../../data"`, and make `useDataVersion();` the first line of `HomePage`.
- `src/features/study/StudyPage.tsx`: same — import `useDataVersion` and make `useDataVersion();` the first line of `StudyPage`.
- `src/features/map/MapPage.tsx`: import `useDataVersion` alongside `findExecute, findLineup, getMapData`, and add `useDataVersion();` right after `const navigate = useNavigate();` (before the early `return`, so the hook order never changes).

Run: `npx vitest run`
Expected: PASS (all tests, including the two new ones).

- [ ] **Step 5: Lint and commit**

Run: `npm run format && npm run lint && npx tsc --noEmit`

```bash
git add src/data/api.ts src/data/api.test.ts src/data/index.ts src/features/home/HomePage.tsx src/features/home/HomePage.test.tsx src/features/map/MapPage.tsx src/features/map/MapPage.test.tsx src/features/study/StudyPage.tsx src/test/fixtureData.ts
git commit -m "feat: let edit mode swap a saved map into the page's data"
```

---

### Task 6: Edit operations on map files (`mapEdits.ts`)

Spec §5 (ids), §6 (Mark reviewed, Delete) and §7 (execute side). Pure functions, no React; every edit returns a new `MapFile` and never mutates its input.

**Files:**
- Create: `src/features/edit/mapEdits.ts`
- Create: `src/features/edit/mapEdits.test.ts`

**Interfaces:**
- Consumes: `Execute`, `Lineup`, `MapFile`, `MapId`, `Side` from `src/data/schema.ts`.
- Produces (Tasks 11–13 use them):
  - `slug(text: string): string`
  - `takenIds(files: readonly MapFile[]): Set<string>`
  - `uniqueId(base: string, taken: ReadonlySet<string>): string`
  - `newLineupId(map: MapId, name: string, from: string, taken: ReadonlySet<string>): string`
  - `newExecuteId(map: MapId, name: string, taken: ReadonlySet<string>): string`
  - `upsertLineup(file: MapFile, lineup: Lineup): MapFile`, `upsertExecute(file: MapFile, execute: Execute): MapFile`, `deleteExecute(file: MapFile, id: string): MapFile`
  - `interface LineupDeletion { file: MapFile; shortened: Execute[]; removed: Execute[] }`, `deleteLineup(file: MapFile, id: string): LineupDeletion`, `deleteConfirmText(lineup: Lineup, deletion: LineupDeletion): string`
  - `markReviewed(lineup: Lineup, today: string): Lineup`
  - `nextUnreviewed(list: readonly Lineup[], currentId: string): Lineup | undefined`
  - `idsOnSide(ids: readonly string[], side: Side, lineups: readonly Lineup[]): string[]`

- [ ] **Step 1: Write the failing tests**

Create `src/features/edit/mapEdits.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { makeExecute, makeLineup, makeMapFile } from "../../test/fixtures";
import {
  deleteConfirmText,
  deleteExecute,
  deleteLineup,
  idsOnSide,
  markReviewed,
  newExecuteId,
  newLineupId,
  nextUnreviewed,
  slug,
  takenIds,
  uniqueId,
  upsertExecute,
  upsertLineup,
} from "./mapEdits";

const WINDOW = makeLineup({ id: "mirage-window-from-t-spawn" });
const CT = makeLineup({ id: "mirage-ct-from-t-ramp", name: "CT", from: "T Ramp", status: "ok" });
const JUNGLE = makeLineup({ id: "mirage-jungle-from-t-ramp", name: "Jungle", from: "T Ramp" });
const TOP_MID = makeLineup({
  id: "mirage-top-mid-from-ct-spawn",
  name: "Top Mid",
  from: "CT Spawn",
  side: "CT",
  status: "broken",
});
const A_EXEC = makeExecute({
  id: "mirage-a-execute",
  name: "A execute",
  lineupIds: [WINDOW.id, CT.id, JUNGLE.id],
});
const B_SPLIT = makeExecute({ id: "mirage-b-split", name: "B split", lineupIds: [CT.id, JUNGLE.id] });
const MIRAGE = makeMapFile("mirage", [WINDOW, CT, JUNGLE, TOP_MID], [A_EXEC, B_SPLIT]);
const ids = (list: readonly { id: string }[]) => list.map((item) => item.id);

describe("slug", () => {
  it.each([
    ["Window", "window"],
    ["T Spawn", "t-spawn"],
    ["Café / Window", "cafe-window"],
    ["  A-site   (default) ", "a-site-default"],
    ["Ölçek", "olcek"],
    ["???", "smoke"],
    ["", "smoke"],
  ])("%j → %j", (text, expected) => {
    expect(slug(text)).toBe(expected);
  });
});

describe("ids", () => {
  const nuke = makeMapFile("nuke", [makeLineup({ id: "nuke-outside-from-t-roof" })]);
  const taken = takenIds([MIRAGE, nuke]);

  it("collects every lineup and execute id from every file", () => {
    expect(taken).toEqual(
      new Set([...ids(MIRAGE.lineups), ...ids(MIRAGE.executes), "nuke-outside-from-t-roof"]),
    );
  });

  it("builds a smoke id from map, name and from", () => {
    expect(newLineupId("mirage", "Stairs", "T Ramp", taken)).toBe("mirage-stairs-from-t-ramp");
  });

  it("adds -2, -3 … when the id is taken", () => {
    expect(newLineupId("mirage", "Window", "T Spawn", taken)).toBe("mirage-window-from-t-spawn-2");
    expect(uniqueId("mirage-a", new Set(["mirage-a", "mirage-a-2"]))).toBe("mirage-a-3");
  });

  it("builds an execute id from map and name", () => {
    expect(newExecuteId("mirage", "B execute", taken)).toBe("mirage-b-execute");
    expect(newExecuteId("mirage", "A execute", taken)).toBe("mirage-a-execute-2");
  });
});

describe("upsertLineup", () => {
  it("appends a new smoke", () => {
    const next = upsertLineup(MIRAGE, makeLineup({ id: "mirage-new" }));
    expect(ids(next.lineups)).toEqual([...ids(MIRAGE.lineups), "mirage-new"]);
  });

  it("replaces a smoke in place without touching the original file", () => {
    const edited = { ...CT, name: "CT box" };
    const next = upsertLineup(MIRAGE, edited);
    expect(next.lineups[1]).toBe(edited);
    expect(next.lineups).toHaveLength(4);
    expect(MIRAGE.lineups[1]).toBe(CT);
  });
});

describe("upsertExecute and deleteExecute", () => {
  it("appends a new execute and replaces an existing one in place", () => {
    const added = upsertExecute(MIRAGE, makeExecute({ id: "mirage-c-execute" }));
    expect(ids(added.executes)).toEqual([A_EXEC.id, B_SPLIT.id, "mirage-c-execute"]);
    const renamed = upsertExecute(MIRAGE, { ...A_EXEC, name: "A split" });
    expect(renamed.executes.map((e) => e.name)).toEqual(["A split", "B split"]);
  });

  it("deletes an execute and keeps its smokes", () => {
    const next = deleteExecute(MIRAGE, A_EXEC.id);
    expect(ids(next.executes)).toEqual([B_SPLIT.id]);
    expect(next.lineups).toBe(MIRAGE.lineups);
  });
});

describe("deleteLineup", () => {
  it("removes the smoke, shortens executes and deletes those left with fewer than 2", () => {
    const deletion = deleteLineup(MIRAGE, CT.id);
    expect(ids(deletion.file.lineups)).toEqual([WINDOW.id, JUNGLE.id, TOP_MID.id]);
    expect(deletion.file.executes).toEqual([{ ...A_EXEC, lineupIds: [WINDOW.id, JUNGLE.id] }]);
    expect(deletion.shortened).toEqual([A_EXEC]);
    expect(deletion.removed).toEqual([B_SPLIT]);
  });

  it("leaves executes alone when the smoke isn't in any", () => {
    const deletion = deleteLineup(MIRAGE, TOP_MID.id);
    expect(deletion.file.executes).toEqual(MIRAGE.executes);
    expect(deletion.shortened).toEqual([]);
    expect(deletion.removed).toEqual([]);
  });
});

describe("deleteConfirmText", () => {
  it("names the executes that change", () => {
    expect(deleteConfirmText(CT, deleteLineup(MIRAGE, CT.id))).toBe(
      "Delete 'CT from T Ramp'? It is also removed from 'A execute'. 'B split' is deleted too, because it would have fewer than 2 smokes.",
    );
  });

  it("is short when no execute changes", () => {
    expect(deleteConfirmText(TOP_MID, deleteLineup(MIRAGE, TOP_MID.id))).toBe(
      "Delete 'Top Mid from CT Spawn'?",
    );
  });

  it("uses the plural for several deleted executes", () => {
    const file = makeMapFile(
      "mirage",
      [WINDOW, CT],
      [
        makeExecute({ id: "mirage-x", name: "X", lineupIds: [WINDOW.id, CT.id] }),
        makeExecute({ id: "mirage-y", name: "Y", lineupIds: [CT.id, WINDOW.id] }),
      ],
    );
    expect(deleteConfirmText(WINDOW, deleteLineup(file, WINDOW.id))).toBe(
      "Delete 'Window from T Spawn'? 'X', 'Y' are deleted too, because they would have fewer than 2 smokes.",
    );
  });
});

describe("markReviewed", () => {
  it("sets ok and today", () => {
    expect(markReviewed(WINDOW, "2026-10-12")).toEqual({
      ...WINDOW,
      status: "ok",
      checkedOn: "2026-10-12",
    });
  });
});

describe("nextUnreviewed", () => {
  // WINDOW unreviewed, CT ok, JUNGLE unreviewed, TOP_MID broken
  const list = MIRAGE.lineups;

  it("finds the next unreviewed smoke after the current one", () => {
    expect(nextUnreviewed(list, WINDOW.id)).toBe(JUNGLE);
  });

  it("wraps round to the start", () => {
    expect(nextUnreviewed(list, JUNGLE.id)).toBe(WINDOW);
  });

  it("never returns the current smoke", () => {
    expect(nextUnreviewed([WINDOW, CT], WINDOW.id)).toBeUndefined();
  });

  it("starts from the top when the current smoke isn't in the list", () => {
    expect(nextUnreviewed([CT, JUNGLE, WINDOW], "mirage-not-listed")).toBe(JUNGLE);
  });

  it("returns undefined for an empty list", () => {
    expect(nextUnreviewed([], WINDOW.id)).toBeUndefined();
  });
});

describe("idsOnSide", () => {
  it("keeps only the smokes on that side, in order", () => {
    expect(idsOnSide([WINDOW.id, TOP_MID.id, CT.id], "T", MIRAGE.lineups)).toEqual([
      WINDOW.id,
      CT.id,
    ]);
    expect(idsOnSide([WINDOW.id, TOP_MID.id], "CT", MIRAGE.lineups)).toEqual([TOP_MID.id]);
  });
});
```

- [ ] **Step 2: Run them to make sure they fail**

Run: `npx vitest run src/features/edit/mapEdits.test.ts`
Expected: FAIL — `Failed to resolve import "./mapEdits"`.

- [ ] **Step 3: Implement `mapEdits.ts`**

Create `src/features/edit/mapEdits.ts`:

```ts
import type { Execute, Lineup, MapFile, MapId, Side } from "../../data/schema";

/** Lowercase, accents dropped, every run of other characters → "-"; "smoke" if nothing is left. */
export function slug(text: string): string {
  const result = text
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return result || "smoke";
}

/** Every lineup and execute id in these files: they share one id space. */
export function takenIds(files: readonly MapFile[]): Set<string> {
  return new Set(
    files.flatMap((file) => [
      ...file.lineups.map((lineup) => lineup.id),
      ...file.executes.map((execute) => execute.id),
    ]),
  );
}

/** `base`, or `base-2`, `base-3`, … — the first one not taken. */
export function uniqueId(base: string, taken: ReadonlySet<string>): string {
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

export function newLineupId(
  map: MapId,
  name: string,
  from: string,
  taken: ReadonlySet<string>,
): string {
  return uniqueId(`${map}-${slug(name)}-from-${slug(from)}`, taken);
}

export function newExecuteId(map: MapId, name: string, taken: ReadonlySet<string>): string {
  return uniqueId(`${map}-${slug(name)}`, taken);
}

function upsert<T extends { id: string }>(list: readonly T[], item: T): T[] {
  const index = list.findIndex((entry) => entry.id === item.id);
  return index === -1 ? [...list, item] : list.map((entry, i) => (i === index ? item : entry));
}

/** Replaces the smoke with the same id, or appends it. */
export function upsertLineup(file: MapFile, lineup: Lineup): MapFile {
  return { ...file, lineups: upsert(file.lineups, lineup) };
}

/** Replaces the execute with the same id, or appends it. */
export function upsertExecute(file: MapFile, execute: Execute): MapFile {
  return { ...file, executes: upsert(file.executes, execute) };
}

/** Deletes an execute; its smokes stay. */
export function deleteExecute(file: MapFile, id: string): MapFile {
  return { ...file, executes: file.executes.filter((execute) => execute.id !== id) };
}

export interface LineupDeletion {
  file: MapFile;
  /** Executes that keep going without the smoke. */
  shortened: Execute[];
  /** Executes deleted because fewer than 2 smokes would be left. */
  removed: Execute[];
}

export function deleteLineup(file: MapFile, id: string): LineupDeletion {
  const shortened: Execute[] = [];
  const removed: Execute[] = [];
  const executes: Execute[] = [];
  for (const execute of file.executes) {
    if (!execute.lineupIds.includes(id)) {
      executes.push(execute);
      continue;
    }
    const lineupIds = execute.lineupIds.filter((lineupId) => lineupId !== id);
    if (lineupIds.length < 2) {
      removed.push(execute);
    } else {
      shortened.push(execute);
      executes.push({ ...execute, lineupIds });
    }
  }
  const lineups = file.lineups.filter((lineup) => lineup.id !== id);
  return { file: { ...file, lineups, executes }, shortened, removed };
}

/** The confirmation shown before deleting a smoke (spec §6). */
export function deleteConfirmText(lineup: Lineup, { shortened, removed }: LineupDeletion): string {
  const names = (list: Execute[]) => list.map((execute) => `'${execute.name}'`).join(", ");
  let text = `Delete '${lineup.name} from ${lineup.from}'?`;
  if (shortened.length > 0) text += ` It is also removed from ${names(shortened)}.`;
  if (removed.length === 1) {
    text += ` ${names(removed)} is deleted too, because it would have fewer than 2 smokes.`;
  } else if (removed.length > 1) {
    text += ` ${names(removed)} are deleted too, because they would have fewer than 2 smokes.`;
  }
  return text;
}

export function markReviewed(lineup: Lineup, today: string): Lineup {
  return { ...lineup, status: "ok", checkedOn: today };
}

/** The next unreviewed smoke after `currentId` in `list`, wrapping round; never the current one. */
export function nextUnreviewed(list: readonly Lineup[], currentId: string): Lineup | undefined {
  const start = list.findIndex((lineup) => lineup.id === currentId);
  for (let step = 1; step <= list.length; step += 1) {
    const lineup = list[(start + step) % list.length];
    if (lineup.id !== currentId && lineup.status === "unreviewed") return lineup;
  }
  return undefined;
}

/** The ids whose smokes are on `side`, in the same order. */
export function idsOnSide(ids: readonly string[], side: Side, lineups: readonly Lineup[]): string[] {
  return ids.filter((id) => lineups.find((lineup) => lineup.id === id)?.side === side);
}
```

- [ ] **Step 4: Run the tests to make sure they pass**

Run: `npx vitest run src/features/edit/mapEdits.test.ts`
Expected: PASS (all tests in the file).

- [ ] **Step 5: Lint and commit**

Run: `npm run format && npm run lint && npx tsc --noEmit`

```bash
git add src/features/edit/mapEdits.ts src/features/edit/mapEdits.test.ts
git commit -m "feat: add edit operations for smokes and executes"
```

---

### Task 7: Smoke form state (`smokeDraft.ts`)

Spec §5. The form's state, conversion to and from a lineup, the `t=` rule, the status-date rule, and mapping validation errors onto form fields. Pure functions.

**Files:**
- Create: `src/features/edit/smokeDraft.ts`
- Create: `src/features/edit/smokeDraft.test.ts`

**Interfaces:**
- Consumes: `parseYouTubeUrl` from `src/lib/youtube.ts`; schema types.
- Produces (Task 11 uses them):
  - `interface SmokeDraft { url: string; start: string; end: string; name: string; from: string; side: Side | null; area: Area | null; movement: Throw["movement"]; jump: boolean; click: Throw["click"]; stand: Position | null; land: Position | null; notes: string; status: Status }`
  - `type DraftField = "url" | "start" | "end" | "name" | "from" | "side" | "area" | "stand" | "land" | "notes" | "status"`; `type DraftErrors = Partial<Record<DraftField | "form", string[]>>`
  - `emptyDraft(preset?: { side?: Side; area?: Area }): SmokeDraft`
  - `draftFromLineup(lineup: Lineup): SmokeDraft`
  - `withUrl(draft: SmokeDraft, url: string): SmokeDraft`
  - `seconds(text: string): number | undefined`, `clock(total: number): string`
  - `lineupFromDraft(draft: SmokeDraft, context: { id: string; original?: Lineup; today: string }): { ok: true; lineup: Lineup } | { ok: false; errors: DraftErrors }`
  - `errorsForDraft(errors: readonly { path: string; message: string }[], index: number, file: MapFile): DraftErrors`

- [ ] **Step 1: Write the failing tests**

Create `src/features/edit/smokeDraft.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { makeExecute, makeLineup, makeMapFile } from "../../test/fixtures";
import {
  clock,
  draftFromLineup,
  emptyDraft,
  errorsForDraft,
  lineupFromDraft,
  seconds,
  withUrl,
  type SmokeDraft,
} from "./smokeDraft";

const TODAY = "2026-10-12";
const LINK = "https://youtu.be/dQw4w9WgXcQ?t=95";
const NEW_ID = { id: "mirage-stairs-from-t-ramp", today: TODAY };

const filled = (overrides: Partial<SmokeDraft> = {}): SmokeDraft => ({
  ...emptyDraft({ side: "T", area: "A" }),
  url: LINK,
  start: "95",
  end: "112",
  name: "Stairs",
  from: "T Ramp",
  stand: { x: 0.7, y: 0.3 },
  land: { x: 0.3, y: 0.2 },
  ...overrides,
});

describe("emptyDraft", () => {
  it("starts with nothing chosen except the throw defaults", () => {
    expect(emptyDraft()).toEqual({
      url: "",
      start: "",
      end: "",
      name: "",
      from: "",
      side: null,
      area: null,
      movement: "stand",
      jump: false,
      click: "left",
      stand: null,
      land: null,
      notes: "",
      status: "unreviewed",
    });
  });

  it("takes the side and area preset from the map filters", () => {
    expect(emptyDraft({ side: "CT", area: "B" })).toMatchObject({ side: "CT", area: "B" });
  });
});

describe("draftFromLineup", () => {
  it("round-trips a smoke through the form unchanged", () => {
    const lineup = makeLineup();
    expect(lineupFromDraft(draftFromLineup(lineup), { id: lineup.id, original: lineup, today: TODAY })).toEqual({
      ok: true,
      lineup,
    });
  });

  it("keeps Nuke levels", () => {
    const lineup = makeLineup({
      id: "nuke-ramp-from-lobby",
      stand: { x: 0.3, y: 0.6, level: "upper" },
      land: { x: 0.4, y: 0.7, level: "lower" },
    });
    expect(lineupFromDraft(draftFromLineup(lineup), { id: lineup.id, original: lineup, today: TODAY })).toEqual({
      ok: true,
      lineup,
    });
  });
});

describe("withUrl", () => {
  it("fills an empty Start from the link's t", () => {
    expect(withUrl(emptyDraft(), "https://youtu.be/dQw4w9WgXcQ?t=1m35s").start).toBe("95");
  });

  it("keeps a Start typed by hand", () => {
    expect(withUrl({ ...emptyDraft(), start: "40" }, LINK).start).toBe("40");
  });

  it("ends with the whole t when the link is typed one character at a time", () => {
    let draft = emptyDraft();
    for (let i = 1; i <= LINK.length; i += 1) draft = withUrl(draft, LINK.slice(0, i));
    expect(draft.start).toBe("95");
  });

  it("clears a Start that came from the link when the t goes away", () => {
    const draft = withUrl(emptyDraft(), LINK);
    expect(withUrl(draft, "https://youtu.be/dQw4w9WgXcQ").start).toBe("");
  });
});

describe("seconds and clock", () => {
  it("reads whole seconds only", () => {
    expect(seconds(" 95 ")).toBe(95);
    expect(seconds("9.5")).toBeUndefined();
    expect(seconds("")).toBeUndefined();
  });

  it("writes m:ss or h:mm:ss", () => {
    expect(clock(5)).toBe("0:05");
    expect(clock(95)).toBe("1:35");
    expect(clock(3723)).toBe("1:02:03");
  });
});

describe("lineupFromDraft", () => {
  it("builds a new smoke: unreviewed, checked today, fields in file order", () => {
    const result = lineupFromDraft(
      filled({ movement: "run", jump: true, notes: "  Aim at the antenna  " }),
      NEW_ID,
    );
    expect(result).toEqual({
      ok: true,
      lineup: {
        id: "mirage-stairs-from-t-ramp",
        name: "Stairs",
        from: "T Ramp",
        side: "T",
        area: "A",
        throw: { movement: "run", jump: true, click: "left" },
        stand: { x: 0.7, y: 0.3 },
        land: { x: 0.3, y: 0.2 },
        video: { url: LINK, start: 95, end: 112 },
        notes: "Aim at the antenna",
        status: "unreviewed",
        checkedOn: TODAY,
      },
    });
    expect(result.ok && Object.keys(result.lineup)).toEqual([
      "id",
      "name",
      "from",
      "side",
      "area",
      "throw",
      "stand",
      "land",
      "video",
      "notes",
      "status",
      "checkedOn",
    ]);
  });

  it("trims the link, name and from", () => {
    const result = lineupFromDraft(filled({ url: `  ${LINK} `, name: " Stairs ", from: "T Ramp " }), NEW_ID);
    expect(result.ok && [result.lineup.video.url, result.lineup.name, result.lineup.from]).toEqual([
      LINK,
      "Stairs",
      "T Ramp",
    ]);
  });

  it("leaves out empty notes and empty clip times", () => {
    const result = lineupFromDraft(filled({ start: "", end: "", notes: "   " }), NEW_ID);
    expect(result.ok && result.lineup.video).toEqual({ url: LINK });
    expect(result.ok && "notes" in result.lineup).toBe(false);
  });

  it("drops clip times for links that aren't YouTube", () => {
    const url = "https://csnades.gg/mirage/smokes/stairs";
    const result = lineupFromDraft(filled({ url }), NEW_ID);
    expect(result.ok && result.lineup.video).toEqual({ url });
  });

  it("refuses clip times that aren't whole seconds", () => {
    expect(lineupFromDraft(filled({ start: "95.5", end: "1:52" }), NEW_ID)).toEqual({
      ok: false,
      errors: { start: ["must be whole seconds"], end: ["must be whole seconds"] },
    });
  });

  it("lists everything missing", () => {
    expect(lineupFromDraft(emptyDraft(), NEW_ID)).toEqual({
      ok: false,
      errors: {
        url: ["Paste a video link"],
        name: ["Enter the spot the smoke covers"],
        from: ["Enter where it is thrown from"],
        side: ["Choose a side"],
        area: ["Choose an area"],
        land: ["Place the land spot on the radar"],
        stand: ["Place the stand spot on the radar"],
      },
    });
  });

  it("keeps checkedOn when an edit leaves the status alone, and sets today when it changes", () => {
    const original = makeLineup({ checkedOn: "2026-10-10" });
    const context = { id: original.id, original, today: TODAY };
    const same = lineupFromDraft({ ...draftFromLineup(original), name: "Window box" }, context);
    expect(same.ok && same.lineup.checkedOn).toBe("2026-10-10");
    const changed = lineupFromDraft({ ...draftFromLineup(original), status: "ok" }, context);
    expect(changed.ok && changed.lineup.checkedOn).toBe(TODAY);
  });
});

describe("errorsForDraft", () => {
  const file = makeMapFile(
    "mirage",
    [makeLineup(), makeLineup({ id: "mirage-ct-from-t-ramp" })],
    [makeExecute({ name: "A execute" })],
  );

  it("puts each error about this smoke on its field", () => {
    expect(
      errorsForDraft(
        [
          { path: "lineups[1].name", message: "must be at most 40 characters" },
          { path: "lineups[1].video.end", message: "must be greater than the start (95s)" },
          { path: "lineups[1].video", message: "start and end are only allowed on YouTube URLs" },
          { path: "lineups[1].stand.level", message: "is required on Nuke" },
        ],
        1,
        file,
      ),
    ).toEqual({
      name: ["must be at most 40 characters"],
      end: ["must be greater than the start (95s)"],
      url: ["start and end are only allowed on YouTube URLs"],
      stand: ["is required on Nuke"],
    });
  });

  it("names the execute for errors in executes, and puts other errors at the top", () => {
    expect(
      errorsForDraft(
        [
          {
            path: "executes[0].lineupIds[1]",
            message: '"mirage-ct-from-t-ramp" is a CT smoke but the execute is T',
          },
          { path: "lineups[0].id", message: "duplicate id" },
          { path: "", message: "file is missing" },
        ],
        1,
        file,
      ),
    ).toEqual({
      form: [
        `Execute 'A execute': "mirage-ct-from-t-ramp" is a CT smoke but the execute is T`,
        "lineups[0].id: duplicate id",
        "file is missing",
      ],
    });
  });
});
```

- [ ] **Step 2: Run them to make sure they fail**

Run: `npx vitest run src/features/edit/smokeDraft.test.ts`
Expected: FAIL — `Failed to resolve import "./smokeDraft"`.

- [ ] **Step 3: Implement `smokeDraft.ts`**

Create `src/features/edit/smokeDraft.ts`:

```ts
import type {
  Area,
  Lineup,
  MapFile,
  Position,
  Side,
  Status,
  Throw,
  Video,
} from "../../data/schema";
import { parseYouTubeUrl } from "../../lib/youtube";

/** The smoke form's state. Clip times stay text while typed; "" means not set. */
export interface SmokeDraft {
  url: string;
  start: string;
  end: string;
  name: string;
  from: string;
  side: Side | null;
  area: Area | null;
  movement: Throw["movement"];
  jump: boolean;
  click: Throw["click"];
  stand: Position | null;
  land: Position | null;
  notes: string;
  status: Status;
}

export type DraftField =
  | "url"
  | "start"
  | "end"
  | "name"
  | "from"
  | "side"
  | "area"
  | "stand"
  | "land"
  | "notes"
  | "status";

/** Messages by field; "form" holds the ones that belong to no single field. */
export type DraftErrors = Partial<Record<DraftField | "form", string[]>>;

export function emptyDraft(preset: { side?: Side; area?: Area } = {}): SmokeDraft {
  return {
    url: "",
    start: "",
    end: "",
    name: "",
    from: "",
    side: preset.side ?? null,
    area: preset.area ?? null,
    movement: "stand",
    jump: false,
    click: "left",
    stand: null,
    land: null,
    notes: "",
    status: "unreviewed",
  };
}

export function draftFromLineup(lineup: Lineup): SmokeDraft {
  return {
    url: lineup.video.url,
    start: lineup.video.start === undefined ? "" : String(lineup.video.start),
    end: lineup.video.end === undefined ? "" : String(lineup.video.end),
    name: lineup.name,
    from: lineup.from,
    side: lineup.side,
    area: lineup.area,
    movement: lineup.throw.movement,
    jump: lineup.throw.jump,
    click: lineup.throw.click,
    stand: lineup.stand,
    land: lineup.land,
    notes: lineup.notes ?? "",
    status: lineup.status,
  };
}

/**
 * The draft with a new link. Start follows the link's `t` while Start is empty or still equal to
 * the previous link's `t`, so typing a link character by character ends with the whole value.
 */
export function withUrl(draft: SmokeDraft, url: string): SmokeDraft {
  const before = parseYouTubeUrl(draft.url.trim())?.t;
  const after = parseYouTubeUrl(url.trim())?.t;
  const followsLink = draft.start === "" || (before !== undefined && draft.start === String(before));
  if (!followsLink) return { ...draft, url };
  return { ...draft, url, start: after === undefined ? "" : String(after) };
}

const WHOLE_SECONDS = /^\d+$/;

/** Whole seconds from a clip field; undefined when empty or not a whole number. */
export function seconds(text: string): number | undefined {
  const trimmed = text.trim();
  return WHOLE_SECONDS.test(trimmed) ? Number(trimmed) : undefined;
}

/** 95 → "1:35", 3723 → "1:02:03". */
export function clock(total: number): string {
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = String(total % 60).padStart(2, "0");
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, "0")}:${secs}` : `${minutes}:${secs}`;
}

export interface BuildContext {
  id: string;
  /** The smoke being edited; undefined when adding. */
  original?: Lineup;
  today: string;
}

export type BuildResult = { ok: true; lineup: Lineup } | { ok: false; errors: DraftErrors };

/** The form as a lineup, or what must be fixed before the shared validation can run. */
export function lineupFromDraft(draft: SmokeDraft, { id, original, today }: BuildContext): BuildResult {
  const errors: DraftErrors = {};
  const add = (field: DraftField, message: string) => (errors[field] ??= []).push(message);
  const url = draft.url.trim();
  const youtube = parseYouTubeUrl(url) !== null;
  const start = draft.start.trim();
  const end = draft.end.trim();

  if (url === "") add("url", "Paste a video link");
  if (youtube && start !== "" && seconds(start) === undefined) add("start", "must be whole seconds");
  if (youtube && end !== "" && seconds(end) === undefined) add("end", "must be whole seconds");
  if (draft.name.trim() === "") add("name", "Enter the spot the smoke covers");
  if (draft.from.trim() === "") add("from", "Enter where it is thrown from");
  if (draft.side === null) add("side", "Choose a side");
  if (draft.area === null) add("area", "Choose an area");
  if (draft.land === null) add("land", "Place the land spot on the radar");
  if (draft.stand === null) add("stand", "Place the stand spot on the radar");

  const { side, area, land, stand } = draft;
  if (side === null || area === null || land === null || stand === null) return { ok: false, errors };
  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const video: Video = { url };
  if (youtube && start !== "") video.start = Number(start);
  if (youtube && end !== "") video.end = Number(end);
  const notes = draft.notes.trim();

  return {
    ok: true,
    lineup: {
      id,
      name: draft.name.trim(),
      from: draft.from.trim(),
      side,
      area,
      throw: { movement: draft.movement, jump: draft.jump, click: draft.click },
      stand,
      land,
      video,
      ...(notes === "" ? {} : { notes }),
      status: draft.status,
      checkedOn:
        original !== undefined && original.status === draft.status ? original.checkedOn : today,
    },
  };
}

const NESTED_FIELDS: Record<string, DraftField> = {
  // "video" alone: start or end on a link that isn't YouTube.
  video: "url",
  "video.url": "url",
  "video.start": "start",
  "video.end": "end",
};
const TOP_FIELDS: readonly DraftField[] = [
  "name",
  "from",
  "side",
  "area",
  "stand",
  "land",
  "notes",
  "status",
];

function fieldFor(rest: string): DraftField | undefined {
  if (Object.hasOwn(NESTED_FIELDS, rest)) return NESTED_FIELDS[rest];
  const head = rest.split(/[.[]/)[0];
  return TOP_FIELDS.find((field) => field === head);
}

/** Sorts validation errors for `file` onto the form; `index` is the smoke's place in `lineups`. */
export function errorsForDraft(
  errors: readonly { path: string; message: string }[],
  index: number,
  file: MapFile,
): DraftErrors {
  const result: DraftErrors = {};
  const prefix = `lineups[${index}].`;
  for (const { path, message } of errors) {
    const field = path.startsWith(prefix) ? fieldFor(path.slice(prefix.length)) : undefined;
    if (field) (result[field] ??= []).push(message);
    else (result.form ??= []).push(describeElsewhere(path, message, file));
  }
  return result;
}

function describeElsewhere(path: string, message: string, file: MapFile): string {
  const match = /^executes\[(\d+)\]/.exec(path);
  const execute = match ? file.executes[Number(match[1])] : undefined;
  if (execute) return `Execute '${execute.name}': ${message}`;
  return path === "" ? message : `${path}: ${message}`;
}
```

- [ ] **Step 4: Run the tests to make sure they pass**

Run: `npx vitest run src/features/edit/smokeDraft.test.ts`
Expected: PASS (all tests in the file).

- [ ] **Step 5: Lint and commit**

Run: `npm run format && npm run lint && npx tsc --noEmit`

```bash
git add src/features/edit/smokeDraft.ts src/features/edit/smokeDraft.test.ts
git commit -m "feat: add the smoke form state and its conversion to a lineup"
```

---

### Task 8: Client save (`saveClient.ts`)

Spec §4 (client): validate locally against all seven bundled files, PUT `{ base, file }`, swap the saved file in with `replaceMapFile`, and turn every failure into the exact message from Global Constraints.

**Files:**
- Create: `src/features/edit/saveClient.ts`
- Create: `src/features/edit/saveClient.test.ts`
- Create: `src/test/editHelpers.ts`

**Interfaces:**
- Consumes: `getMapData`, `replaceMapFile` from `src/data` (Task 5); `validateDataFiles` from `src/data/validate.ts`; `restoreFixtureData`, `FIXTURE_DATA` from `src/test/fixtureData.ts`.
- Produces (Tasks 11–13 use them):
  - `saveMap(map: MapId, next: MapFile): Promise<SaveOutcome>`
  - `type SaveOutcome = { ok: true; file: MapFile } | { ok: false; kind: "invalid"; errors: FieldError[] } | { ok: false; kind: "changed" | "invalid-on-disk" | "unreachable" | "write-failed" | "unexpected"; message: string }`; `interface FieldError { path: string; message: string }`
  - `checkLocally(map: MapId, next: MapFile): FieldError[]`
  - `describeProblem(outcome: Extract<SaveOutcome, { ok: false }>): string` — one line for places without form fields.
  - Test helpers in `src/test/editHelpers.ts`: `mockEditServer(reply?: (body: SaveBody) => ServerReply | Promise<ServerReply>): { fetch; sent(n?: number): SaveBody }`, `mockServerDown()`, `interface SaveBody { base: MapFile; file: MapFile }`, `interface ServerReply { status: number; json: unknown }`.

- [ ] **Step 1: Write the test helper**

Create `src/test/editHelpers.ts`:

```ts
import { vi } from "vitest";
import type { MapFile } from "../data/schema";

export interface SaveBody {
  base: MapFile;
  file: MapFile;
}

export interface ServerReply {
  status: number;
  json: unknown;
}

/**
 * Stubs fetch as the dev server's save endpoint. By default every save succeeds and echoes the
 * file. Call vi.unstubAllGlobals() in afterEach.
 */
export function mockEditServer(
  reply: (body: SaveBody) => ServerReply | Promise<ServerReply> = (body) => ({
    status: 200,
    json: { file: body.file },
  }),
) {
  const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
    const { status, json } = await reply(JSON.parse(String(init?.body)) as SaveBody);
    return new Response(JSON.stringify(json), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  });
  vi.stubGlobal("fetch", fetchMock);
  return {
    fetch: fetchMock,
    /** The body of the nth save (0-based). */
    sent: (n = 0): SaveBody => JSON.parse(String(fetchMock.mock.calls[n][1]?.body)) as SaveBody,
  };
}

/** Stubs fetch as if the dev server were not running. */
export function mockServerDown() {
  const fetchMock = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}
```

- [ ] **Step 2: Write the failing tests**

Create `src/features/edit/saveClient.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { getMapData } from "../../data";
import type { MapFile } from "../../data/schema";
import { mockEditServer, mockServerDown } from "../../test/editHelpers";
import { FIXTURE_DATA, restoreFixtureData } from "../../test/fixtureData";
import { describeProblem, saveMap } from "./saveClient";

vi.mock("../../data", async () => (await import("../../test/fixtureData")).mockDataModule());

afterEach(async () => {
  vi.unstubAllGlobals();
  await restoreFixtureData();
});

/** The current Mirage file with its first smoke renamed. */
const renamed = (name: string): MapFile => {
  const current = getMapData("mirage");
  return {
    ...current,
    lineups: current.lineups.map((lineup, i) => (i === 0 ? { ...lineup, name } : lineup)),
  };
};

describe("saveMap", () => {
  it("checks locally first and sends nothing when the file is invalid", async () => {
    const server = mockEditServer();
    expect(await saveMap("mirage", renamed("x".repeat(41)))).toEqual({
      ok: false,
      kind: "invalid",
      errors: [{ path: "lineups[0].name", message: "must be at most 40 characters" }],
    });
    expect(server.fetch).not.toHaveBeenCalled();
  });

  it("puts the file with its base, then swaps in the saved file", async () => {
    const server = mockEditServer();
    const next = renamed("Window box");
    expect(await saveMap("mirage", next)).toEqual({ ok: true, file: next });
    expect(server.fetch).toHaveBeenCalledWith(
      "/__edit/maps/mirage",
      expect.objectContaining({ method: "PUT", headers: { "Content-Type": "application/json" } }),
    );
    expect(server.sent()).toEqual({ base: FIXTURE_DATA.mirage, file: next });
    expect(getMapData("mirage")).toEqual(next);
  });

  it("uses the last saved file as the base of the next save", async () => {
    const server = mockEditServer();
    const first = renamed("Window box");
    await saveMap("mirage", first);
    await saveMap("mirage", renamed("Window boxed"));
    expect(server.sent(1).base).toEqual(first);
  });

  it("returns the server's field errors", async () => {
    const errors = [{ path: "lineups[0].notes", message: "must be at most 280 characters" }];
    mockEditServer(() => ({ status: 400, json: { errors } }));
    expect(await saveMap("mirage", renamed("Window box"))).toEqual({
      ok: false,
      kind: "invalid",
      errors,
    });
  });

  it("explains a map that changed on disk, keeping the page's data", async () => {
    mockEditServer(() => ({ status: 409, json: { error: "changed" } }));
    expect(await saveMap("mirage", renamed("Window box"))).toEqual({
      ok: false,
      kind: "changed",
      message:
        "This map changed outside this page (another tab, a hand edit or git). Reload to get the latest version.",
    });
    expect(getMapData("mirage")).toBe(FIXTURE_DATA.mirage);
  });

  it("explains a broken file on disk", async () => {
    mockEditServer(() => ({ status: 409, json: { error: "invalid-on-disk" } }));
    expect(await saveMap("mirage", renamed("Window box"))).toEqual({
      ok: false,
      kind: "invalid-on-disk",
      message: "data/maps/mirage.json isn't valid JSON — fix or restore it first.",
    });
  });

  it("explains a failed write", async () => {
    mockEditServer(() => ({
      status: 500,
      json: { error: "write-failed", message: "EPERM: operation not permitted" },
    }));
    expect(await saveMap("mirage", renamed("Window box"))).toEqual({
      ok: false,
      kind: "write-failed",
      message: "Couldn't write data/maps/mirage.json: EPERM: operation not permitted",
    });
  });

  it("explains a dev server that isn't running", async () => {
    mockServerDown();
    expect(await saveMap("mirage", renamed("Window box"))).toEqual({
      ok: false,
      kind: "unreachable",
      message: "Can't reach the dev server — is npm run dev running?",
    });
  });
});

describe("describeProblem", () => {
  it("joins field errors into one line and passes messages through", () => {
    expect(
      describeProblem({
        ok: false,
        kind: "invalid",
        errors: [
          { path: "executes[0].lineupIds", message: "needs at least 2 smokes" },
          { path: "", message: "file is missing" },
        ],
      }),
    ).toBe("executes[0].lineupIds: needs at least 2 smokes file is missing");
    expect(describeProblem({ ok: false, kind: "changed", message: "Changed." })).toBe("Changed.");
  });
});
```

- [ ] **Step 3: Run them to make sure they fail**

Run: `npx vitest run src/features/edit/saveClient.test.ts`
Expected: FAIL — `Failed to resolve import "./saveClient"`.

- [ ] **Step 4: Implement `saveClient.ts`**

Create `src/features/edit/saveClient.ts`:

```ts
import { getMapData, replaceMapFile } from "../../data";
import { MAP_IDS, type MapFile, type MapId } from "../../data/schema";
import { validateDataFiles } from "../../data/validate";

export interface FieldError {
  path: string;
  message: string;
}

export type SaveOutcome =
  | { ok: true; file: MapFile }
  | { ok: false; kind: "invalid"; errors: FieldError[] }
  | {
      ok: false;
      kind: "changed" | "invalid-on-disk" | "unreachable" | "write-failed" | "unexpected";
      message: string;
    };

interface ServerBody {
  file?: MapFile;
  errors?: FieldError[];
  error?: string;
  message?: string;
}

/** Problems in `next` by the checks behind npm run validate, with the other maps as they are now. */
export function checkLocally(map: MapId, next: MapFile): FieldError[] {
  const fileName = `${map}.json`;
  const files = MAP_IDS.map((id) => ({
    fileName: `${id}.json`,
    content: id === map ? next : getMapData(id),
  }));
  return validateDataFiles(files)
    .filter((error) => error.file === fileName)
    .map(({ path, message }) => ({ path, message }));
}

/** Spec §4 (client): check locally, PUT the file, then swap the saved file into the page's data. */
export async function saveMap(map: MapId, next: MapFile): Promise<SaveOutcome> {
  const local = checkLocally(map, next);
  if (local.length > 0) return { ok: false, kind: "invalid", errors: local };

  let response: Response;
  try {
    response = await fetch(`/__edit/maps/${map}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ base: getMapData(map), file: next }),
    });
  } catch {
    return {
      ok: false,
      kind: "unreachable",
      message: "Can't reach the dev server — is npm run dev running?",
    };
  }
  const body = (await response.json().catch(() => ({}))) as ServerBody;
  const path = `data/maps/${map}.json`;

  if (response.status === 200 && body.file) {
    replaceMapFile(map, body.file);
    return { ok: true, file: body.file };
  }
  if (response.status === 400) return { ok: false, kind: "invalid", errors: body.errors ?? [] };
  if (response.status === 409 && body.error === "invalid-on-disk") {
    return {
      ok: false,
      kind: "invalid-on-disk",
      message: `${path} isn't valid JSON — fix or restore it first.`,
    };
  }
  if (response.status === 409) {
    return {
      ok: false,
      kind: "changed",
      message:
        "This map changed outside this page (another tab, a hand edit or git). Reload to get the latest version.",
    };
  }
  if (response.status === 500) {
    return {
      ok: false,
      kind: "write-failed",
      message: `Couldn't write ${path}: ${body.message ?? "unknown error"}`,
    };
  }
  return {
    ok: false,
    kind: "unexpected",
    message: `The dev server answered with status ${response.status}.`,
  };
}

/** A failed save as one line, for places without form fields (card and execute buttons). */
export function describeProblem(outcome: Extract<SaveOutcome, { ok: false }>): string {
  if (outcome.kind !== "invalid") return outcome.message;
  return outcome.errors
    .map(({ path, message }) => (path === "" ? message : `${path}: ${message}`))
    .join(" ");
}
```

- [ ] **Step 5: Run the tests to make sure they pass**

Run: `npx vitest run src/features/edit/saveClient.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 6: Check the edit code stays out of the build, lint and commit**

`saveClient.ts` is the first file containing `/__edit/`. Nothing in the app imports it yet, so the build must still be clean.

Run: `npm run format && npm run lint && npx tsc --noEmit && npm run build && npm run check-bundle`
Expected: lint clean; `Bundle OK: no edit-mode code in dist/.`

```bash
git add src/features/edit/saveClient.ts src/features/edit/saveClient.test.ts src/test/editHelpers.ts
git commit -m "feat: add the edit-mode save client"
```

---

### Task 9: Placement radar

Spec §5, item 6: clicking the radar sets the active spot; either spot can be dragged; the map's other smokes are drawn faded; on Nuke a spot takes the level shown, and spots on the other level are neither drawn nor grabbable.

**Files:**
- Modify: `src/test/setup.ts` (pointer-event polyfill)
- Modify: `src/test/editHelpers.ts` (radar pointer helpers)
- Create: `src/features/edit/Edit.module.css`
- Create: `src/features/edit/PlacementRadar.tsx`
- Create: `src/features/edit/PlacementRadar.test.tsx`

**Interfaces:**
- Consumes: `Radar` (`src/features/map/Radar.tsx`); `LandingMarker`, `StandDot`, `StandLine` (`markers.tsx`); `pointerToFraction`, `nearestWithin`, `HIT_RADIUS_PX` from `src/lib/radar.ts`; `hasLevels` from `src/data/maps.ts`.
- Produces (Task 11 uses them):
  - `type Spot = "land" | "stand"`
  - `PlacementRadar(props: PlacementRadarProps)` with `interface PlacementRadarProps { map: MapInfo; level: Level; side: Side; stand: Position | null; land: Position | null; active: Spot; context: readonly Lineup[]; onPlace: (spot: Spot, position: Position) => void; onRelease?: (spot: Spot) => void }`. The wrapper element has `data-testid="placement-radar"`.
  - Test helpers: `mockPlacementRadar(size?: number)`, `clickRadar(clientX: number, clientY: number)`, `dragRadar(from: [number, number], to: [number, number])`.

- [ ] **Step 1: Polyfill pointer events for jsdom**

jsdom 26 has neither `PointerEvent` nor `setPointerCapture`. Append to `src/test/setup.ts`:

```ts
// jsdom has no pointer events. A MouseEvent with a pointerId is enough for the radar's drag code.
// Guarded: Node-environment test files (scripts/) have no window.
if (typeof window !== "undefined") {
  if (typeof window.PointerEvent === "undefined") {
    class PointerEventPolyfill extends MouseEvent {
      readonly pointerId: number;
      constructor(type: string, init: PointerEventInit = {}) {
        super(type, init);
        this.pointerId = init.pointerId ?? 1;
      }
    }
    window.PointerEvent = PointerEventPolyfill as unknown as typeof PointerEvent;
  }
  Element.prototype.setPointerCapture ??= () => {};
  Element.prototype.releasePointerCapture ??= () => {};
}
```

- [ ] **Step 2: Add the radar pointer helpers**

In `src/test/editHelpers.ts`, add `import { fireEvent, screen } from "@testing-library/react";` at the top and append:

```ts
/** Gives the placement radar a size, since jsdom has no layout. */
export function mockPlacementRadar(size = 500) {
  vi.spyOn(screen.getByTestId("placement-radar"), "getBoundingClientRect").mockReturnValue({
    left: 0,
    top: 0,
    width: size,
    height: size,
  } as DOMRect);
}

/** A click on the placement radar at client coordinates. */
export function clickRadar(clientX: number, clientY: number) {
  const radar = screen.getByTestId("placement-radar");
  fireEvent.pointerDown(radar, { clientX, clientY, pointerId: 1 });
  fireEvent.pointerUp(radar, { clientX, clientY, pointerId: 1 });
}

/** A press at `from`, a move to `to`, and a release there. */
export function dragRadar(from: [number, number], to: [number, number]) {
  const radar = screen.getByTestId("placement-radar");
  fireEvent.pointerDown(radar, { clientX: from[0], clientY: from[1], pointerId: 1 });
  fireEvent.pointerMove(radar, { clientX: to[0], clientY: to[1], pointerId: 1 });
  fireEvent.pointerUp(radar, { clientX: to[0], clientY: to[1], pointerId: 1 });
}
```

- [ ] **Step 3: Write the failing tests**

Create `src/features/edit/PlacementRadar.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { getMapInfo } from "../../data/maps";
import { clickRadar, dragRadar, mockPlacementRadar } from "../../test/editHelpers";
import { makeLineup } from "../../test/fixtures";
import { PlacementRadar, type PlacementRadarProps } from "./PlacementRadar";

const mirage = getMapInfo("mirage")!;
const nuke = getMapInfo("nuke")!;

function renderRadar(props: Partial<PlacementRadarProps> = {}) {
  const onPlace = vi.fn();
  const onRelease = vi.fn();
  render(
    <PlacementRadar
      map={mirage}
      level="upper"
      side="T"
      stand={null}
      land={null}
      active="land"
      context={[]}
      onPlace={onPlace}
      onRelease={onRelease}
      {...props}
    />,
  );
  mockPlacementRadar(500);
  return { onPlace, onRelease };
}

const markers = () => screen.queryAllByTestId("landing-marker");
const selected = () => markers().filter((m) => m.getAttribute("data-selected") === "true");

describe("PlacementRadar", () => {
  it("places the active spot where the radar is clicked, rounded to 3 decimals", () => {
    const { onPlace, onRelease } = renderRadar();
    clickRadar(150.4, 100.2);
    expect(onPlace).toHaveBeenCalledWith("land", { x: 0.301, y: 0.2 });
    expect(onRelease).toHaveBeenCalledWith("land");
  });

  it("places the stand spot when Stand is active", () => {
    const { onPlace } = renderRadar({ active: "stand" });
    clickRadar(350, 150);
    expect(onPlace).toHaveBeenCalledWith("stand", { x: 0.7, y: 0.3 });
  });

  it("gives a Nuke spot the level being shown", () => {
    const { onPlace } = renderRadar({ map: nuke, level: "lower" });
    clickRadar(200, 250);
    expect(onPlace).toHaveBeenCalledWith("land", { x: 0.4, y: 0.5, level: "lower" });
  });

  it("drags a placed spot instead of placing the active one", () => {
    const { onPlace, onRelease } = renderRadar({ land: { x: 0.3, y: 0.2 }, active: "stand" });
    // The land spot is at (150, 100); the press is 6 px away, inside the 20 px hit radius.
    dragRadar([155, 104], [200, 120]);
    expect(onPlace.mock.calls).toEqual([["land", { x: 0.4, y: 0.24 }]]);
    expect(onRelease).toHaveBeenCalledWith("land");
  });

  it("draws the draft's spots and line, with other smokes faded behind", () => {
    renderRadar({
      land: { x: 0.3, y: 0.2 },
      stand: { x: 0.7, y: 0.3 },
      context: [makeLineup({ id: "mirage-other", land: { x: 0.5, y: 0.5 } })],
    });
    expect(markers()).toHaveLength(2);
    expect(selected()).toHaveLength(1);
    expect(screen.getByTestId("stand-dot")).toBeInTheDocument();
    expect(screen.getByTestId("stand-line")).toBeInTheDocument();
  });

  it("neither draws nor grabs a spot on the other level", () => {
    const { onPlace } = renderRadar({
      map: nuke,
      level: "upper",
      land: { x: 0.3, y: 0.2, level: "lower" },
    });
    expect(markers()).toHaveLength(0);
    clickRadar(150, 100);
    expect(onPlace).toHaveBeenCalledWith("land", { x: 0.3, y: 0.2, level: "upper" });
  });
});
```

- [ ] **Step 4: Run them to make sure they fail**

Run: `npx vitest run src/features/edit/PlacementRadar.test.tsx`
Expected: FAIL — `Failed to resolve import "./PlacementRadar"`.

- [ ] **Step 5: Implement the radar**

Create `src/features/edit/Edit.module.css`:

```css
.placement {
  cursor: crosshair;
  touch-action: none;
}

.context {
  opacity: 0.35;
}
```

Create `src/features/edit/PlacementRadar.tsx`:

```tsx
import { useRef, useState, type PointerEvent } from "react";
import { hasLevels, type MapInfo } from "../../data/maps";
import type { Level, Lineup, Position, Side } from "../../data/schema";
import { HIT_RADIUS_PX, nearestWithin, pointerToFraction } from "../../lib/radar";
import { Radar } from "../map/Radar";
import { LandingMarker, StandDot, StandLine } from "../map/markers";
import styles from "./Edit.module.css";

export type Spot = "land" | "stand";

export interface PlacementRadarProps {
  map: MapInfo;
  level: Level;
  /** The draft's markers use this side's colour. */
  side: Side;
  stand: Position | null;
  land: Position | null;
  /** The spot a click on empty radar sets. */
  active: Spot;
  /** Other smokes on the map, drawn faded for context. They can't be clicked. */
  context: readonly Lineup[];
  onPlace: (spot: Spot, position: Position) => void;
  /** A press that placed or grabbed a spot has ended. */
  onRelease?: (spot: Spot) => void;
}

const SPOTS = ["land", "stand"] as const;
const round3 = (value: number) => Math.round(value * 1000) / 1000;

/** The edit forms' radar: click to place the active spot, drag either spot to adjust it. */
export function PlacementRadar({
  map,
  level,
  side,
  stand,
  land,
  active,
  context,
  onPlace,
  onRelease,
}: PlacementRadarProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<Spot | null>(null);
  const withLevels = hasLevels(map);
  const spots = { land, stand };
  const onLevel = (position: Position | null): position is Position =>
    position !== null && (!withLevels || (position.level ?? "upper") === level);

  function locate(event: PointerEvent<HTMLDivElement>, element: HTMLDivElement) {
    const rect = element.getBoundingClientRect();
    const point = pointerToFraction(event.clientX, event.clientY, rect);
    const position: Position = {
      x: round3(point.x),
      y: round3(point.y),
      ...(withLevels ? { level } : {}),
    };
    return { point, position, widthPx: rect.width };
  }

  function handleDown(event: PointerEvent<HTMLDivElement>) {
    if (!ref.current) return;
    const { point, position, widthPx } = locate(event, ref.current);
    const shown = SPOTS.filter((spot) => onLevel(spots[spot]));
    const grabbed = nearestWithin(
      shown,
      (spot) => spots[spot] as Position,
      point,
      HIT_RADIUS_PX / widthPx,
    );
    if (!grabbed) onPlace(active, position);
    setDragging(grabbed ?? active);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleMove(event: PointerEvent<HTMLDivElement>) {
    if (dragging && ref.current) onPlace(dragging, locate(event, ref.current).position);
  }

  function handleUp() {
    if (!dragging) return;
    onRelease?.(dragging);
    setDragging(null);
  }

  return (
    <div
      ref={ref}
      className={styles.placement}
      data-testid="placement-radar"
      onPointerDown={handleDown}
      onPointerMove={handleMove}
      onPointerUp={handleUp}
      onPointerCancel={handleUp}
    >
      <Radar map={map} level={level} label={`${map.name} radar: click to place the ${active} spot`}>
        <g className={styles.context}>
          {context
            .filter((lineup) => onLevel(lineup.land))
            .map((lineup) => (
              <LandingMarker key={lineup.id} at={lineup.land} side={lineup.side} />
            ))}
        </g>
        {onLevel(stand) && onLevel(land) && <StandLine from={stand} to={land} />}
        {onLevel(land) && <LandingMarker at={land} side={side} selected />}
        {onLevel(stand) && <StandDot at={stand} side={side} />}
      </Radar>
    </div>
  );
}
```

- [ ] **Step 6: Run the tests to make sure they pass**

Run: `npx vitest run src/features/edit/PlacementRadar.test.tsx`
Expected: PASS (6 tests).

- [ ] **Step 7: Run everything, lint and commit**

Run: `npx vitest run && npm run format && npm run lint && npx tsc --noEmit`
Expected: all tests pass (including the `scripts/` ones, which run without `window`).

```bash
git add src/test/setup.ts src/test/editHelpers.ts src/features/edit/Edit.module.css src/features/edit/PlacementRadar.tsx src/features/edit/PlacementRadar.test.tsx
git commit -m "feat: add the placement radar for edit forms"
```

---

### Task 10: Clip timer

Spec §5, item 2: a player with YouTube's own controls that doesn't loop while editing; **Set start** (current time rounded down), **Set end** (rounded up), **▶ Play clip** (start → end once, then pause). The player is created once per video id; changing start or end doesn't recreate it.

**Files:**
- Create: `src/test/fakeYouTube.ts`
- Modify: `src/features/edit/Edit.module.css`
- Create: `src/features/edit/ClipTimer.tsx`
- Create: `src/features/edit/ClipTimer.test.tsx`

**Interfaces:**
- Consumes: `useYouTubePlayer` (Task 2); `YTNamespace`, `YTPlayer`, `YTPlayerOptions` from `src/features/smoke/youtubeApi.ts`.
- Produces (Task 11 uses them):
  - `ClipTimer(props: ClipTimerProps)` with `interface ClipTimerProps { videoId: string; initialStart: number; start: number | undefined; end: number | undefined; onSetStart: (seconds: number) => void; onSetEnd: (seconds: number) => void }`. Render it with `key={videoId}`.
  - Test helper `fakeYouTube(): { created: { options: YTPlayerOptions; player: FakePlayer }[]; YT: YTNamespace; ready(n?: number): Promise<FakePlayer> }`, `type FakeYouTube`, `type FakePlayer`.

- [ ] **Step 1: Write the fake YouTube API helper**

Create `src/test/fakeYouTube.ts`:

```ts
import { act, waitFor } from "@testing-library/react";
import { expect, vi } from "vitest";
import type { YTNamespace, YTPlayer, YTPlayerOptions } from "../features/smoke/youtubeApi";

function fakePlayer() {
  return {
    playVideo: vi.fn(),
    pauseVideo: vi.fn(),
    seekTo: vi.fn(),
    getCurrentTime: vi.fn(() => 0),
    setPlaybackRate: vi.fn(),
    mute: vi.fn(),
    destroy: vi.fn(),
  };
}

export type FakePlayer = ReturnType<typeof fakePlayer>;

/**
 * A fake YouTube IFrame API that records every player it creates. Use with
 * `vi.mock(".../youtubeApi", () => ({ loadYouTubeApi: api.load }))` and
 * `api.load.mockResolvedValue(fake.YT)`.
 */
export function fakeYouTube() {
  const created: { options: YTPlayerOptions; player: FakePlayer }[] = [];
  const Player = vi.fn(function (_element: HTMLElement, options: YTPlayerOptions) {
    const player = fakePlayer();
    created.push({ options, player });
    return player;
  });
  return {
    created,
    YT: { Player, PlayerState: { ENDED: 0 } } as unknown as YTNamespace,
    /** Waits for the nth player (0-based), then fires its onReady. */
    async ready(n = 0): Promise<FakePlayer> {
      await waitFor(() => expect(created.length).toBeGreaterThan(n));
      const { options, player } = created[n];
      act(() => options.events.onReady?.({ target: player as unknown as YTPlayer }));
      return player;
    },
  };
}

export type FakeYouTube = ReturnType<typeof fakeYouTube>;
```

- [ ] **Step 2: Write the failing tests**

Create `src/features/edit/ClipTimer.test.tsx`:

```tsx
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeYouTube, type FakeYouTube } from "../../test/fakeYouTube";
import { ClipTimer, type ClipTimerProps } from "./ClipTimer";

const api = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock("../smoke/youtubeApi", () => ({ loadYouTubeApi: api.load }));

let yt: FakeYouTube;
beforeEach(() => {
  yt = fakeYouTube();
  api.load.mockResolvedValue(yt.YT);
});
afterEach(() => vi.useRealTimers());

function renderTimer(props: Partial<ClipTimerProps> = {}) {
  const onSetStart = vi.fn();
  const onSetEnd = vi.fn();
  const view = render(
    <ClipTimer
      videoId="dQw4w9WgXcQ"
      initialStart={95}
      start={95}
      end={112}
      onSetStart={onSetStart}
      onSetEnd={onSetEnd}
      {...props}
    />,
  );
  return { view, onSetStart, onSetEnd };
}

describe("ClipTimer", () => {
  it("opens a paused player at the clip start", async () => {
    renderTimer();
    const player = await yt.ready();
    expect(yt.created[0].options.playerVars).toMatchObject({
      start: 95,
      autoplay: 0,
      playsinline: 1,
      rel: 0,
    });
    expect(player.playVideo).not.toHaveBeenCalled();
  });

  it("disables its buttons until the player is ready", () => {
    renderTimer();
    expect(screen.getByRole("button", { name: "Set start" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "▶ Play clip" })).toBeDisabled();
  });

  it("sets start from the current time rounded down, and end rounded up", async () => {
    const { onSetStart, onSetEnd } = renderTimer();
    const player = await yt.ready();
    player.getCurrentTime.mockReturnValue(97.8);
    await userEvent.click(screen.getByRole("button", { name: "Set start" }));
    expect(onSetStart).toHaveBeenCalledWith(97);
    player.getCurrentTime.mockReturnValue(111.2);
    await userEvent.click(screen.getByRole("button", { name: "Set end" }));
    expect(onSetEnd).toHaveBeenCalledWith(112);
  });

  it("plays the clip once and pauses at the end, without looping", async () => {
    renderTimer();
    const player = await yt.ready();
    vi.useFakeTimers();
    act(() => screen.getByRole("button", { name: "▶ Play clip" }).click());
    expect(player.seekTo).toHaveBeenCalledWith(95, true);
    expect(player.playVideo).toHaveBeenCalledTimes(1);
    player.getCurrentTime.mockReturnValue(112);
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(player.pauseVideo).toHaveBeenCalledTimes(1);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(player.pauseVideo).toHaveBeenCalledTimes(1);
    expect(player.seekTo).toHaveBeenCalledTimes(1);
  });

  it("keeps the same player when start or end change", async () => {
    const { view } = renderTimer();
    await yt.ready();
    view.rerender(
      <ClipTimer
        videoId="dQw4w9WgXcQ"
        initialStart={95}
        start={100}
        end={120}
        onSetStart={vi.fn()}
        onSetEnd={vi.fn()}
      />,
    );
    expect(yt.created).toHaveLength(1);
  });

  it("says so when the video can't play", async () => {
    renderTimer();
    await yt.ready();
    act(() => yt.created[0].options.events.onError?.({ data: 150 }));
    expect(screen.getByText("Video unavailable — check the link.")).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run them to make sure they fail**

Run: `npx vitest run src/features/edit/ClipTimer.test.tsx`
Expected: FAIL — `Failed to resolve import "./ClipTimer"`.

- [ ] **Step 4: Implement the clip timer**

Append to `src/features/edit/Edit.module.css`:

```css
.clip {
  display: grid;
  gap: 8px;
}

.frame {
  width: 100%;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  background: #000;
  border-radius: var(--radius);
}

.frame iframe {
  display: block;
  width: 100%;
  height: 100%;
  border: 0;
}

.buttonRow {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.buttonRow button {
  padding: 6px 12px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface-2);
}

.hint {
  margin: 0;
  font-size: 0.85rem;
  color: var(--text-muted);
}
```

Create `src/features/edit/ClipTimer.tsx`:

```tsx
import { useEffect, useRef, useState } from "react";
import { useYouTubePlayer } from "../smoke/useYouTubePlayer";
import styles from "./Edit.module.css";

const CHECK_MS = 250;

export interface ClipTimerProps {
  videoId: string;
  /** Where the player opens. Read once; render with key={videoId}. */
  initialStart: number;
  start: number | undefined;
  end: number | undefined;
  onSetStart: (seconds: number) => void;
  onSetEnd: (seconds: number) => void;
}

/** Spec §5 item 2: scrub with YouTube's controls, then Set start / Set end; no loop while editing. */
export function ClipTimer({ videoId, initialStart, start, end, onSetStart, onSetEnd }: ClipTimerProps) {
  const host = useRef<HTMLDivElement>(null);
  const [playingClip, setPlayingClip] = useState(false);
  const { status, player } = useYouTubePlayer(host, {
    videoId,
    playerVars: { start: initialStart, playsinline: 1, rel: 0, autoplay: 0 },
  });

  // ▶ Play clip: pause once playback reaches the end.
  useEffect(() => {
    if (!playingClip || end === undefined) return;
    const timer = window.setInterval(() => {
      const target = player.current;
      if (target && target.getCurrentTime() >= end) {
        target.pauseVideo();
        setPlayingClip(false);
      }
    }, CHECK_MS);
    return () => window.clearInterval(timer);
  }, [playingClip, end, player]);

  if (status === "error") {
    return (
      <p className={styles.hint} role="status">
        Video unavailable — check the link.
      </p>
    );
  }

  const now = () => player.current?.getCurrentTime() ?? 0;
  const ready = status === "ready";
  return (
    <div className={styles.clip}>
      <div className={styles.frame} ref={host} title="Video" data-testid="clip-frame" />
      <div className={styles.buttonRow}>
        <button type="button" disabled={!ready} onClick={() => onSetStart(Math.floor(now()))}>
          Set start
        </button>
        <button type="button" disabled={!ready} onClick={() => onSetEnd(Math.ceil(now()))}>
          Set end
        </button>
        <button
          type="button"
          disabled={!ready}
          onClick={() => {
            player.current?.seekTo(start ?? 0, true);
            player.current?.playVideo();
            setPlayingClip(true);
          }}
        >
          ▶ Play clip
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Run the tests to make sure they pass**

Run: `npx vitest run src/features/edit/ClipTimer.test.tsx`
Expected: PASS (6 tests).

- [ ] **Step 6: Lint and commit**

Run: `npm run format && npm run lint && npx tsc --noEmit`

```bash
git add src/test/fakeYouTube.ts src/features/edit/Edit.module.css src/features/edit/ClipTimer.tsx src/features/edit/ClipTimer.test.tsx
git commit -m "feat: add the clip timer for setting clip start and end"
```

---

### Task 11: Smoke form — Add and Edit

Spec §3.2, §3.4, §5 and §6 (the "+ Add smoke" button). The dev-only routes `#/maps/:mapId/smokes/new` and `#/maps/:mapId/smokes/:lineupId/edit` render one page: radar on the left (placement, Placing toggle, Nuke level switch, coordinates), form on the right.

**Files:**
- Create: `src/app/editMode.tsx`
- Modify: `src/app/AppRoutes.tsx`
- Modify: `src/features/map/FiltersBar.tsx` (export `Segmented`; accept `null`)
- Modify: `src/features/map/MapPage.tsx` and `src/features/map/MapPage.module.css` ("+ Add smoke")
- Modify: `src/features/edit/Edit.module.css`
- Create: `src/features/edit/formParts.tsx`
- Create: `src/features/edit/SmokeFields.tsx`
- Create: `src/features/edit/SmokeFormPage.tsx`
- Create: `src/features/edit/SmokeFormPage.test.tsx`

**Interfaces:**
- Consumes: `mapEdits` (Task 6), `smokeDraft` (Task 7), `saveMap` (Task 8), `PlacementRadar`/`Spot` (Task 9), `ClipTimer` (Task 10), `MapFrame` (Task 2), `useDataVersion`/`getMapData`/`findLineup` (Task 5), `useProgress().today`; test helpers `mockEditServer`, `mockServerDown`, `mockPlacementRadar`, `clickRadar`, `fakeYouTube`, `restoreFixtureData`.
- Produces (Tasks 12–13 extend or use them):
  - `Edit` in `src/app/editMode.tsx`: `null` in builds; in dev an object of lazy components, starting with `SmokeFormPage`. `EditBoundary({ children })`: a `Suspense` with no fallback.
  - `Segmented<T extends string>({ label, options, value: T | null, onSelect })` exported from `FiltersBar.tsx`.
  - `FieldErrors({ messages?: string[] })`, `FormNotice({ notice: Notice | null; errors?: string[] })`, `interface Notice { message: string; reload: boolean }`, `useLeaveWarning(dirty: boolean)` from `formParts.tsx`.
  - `SmokeFormPage()` from `SmokeFormPage.tsx`.
  - CSS classes in `Edit.module.css` used by later tasks: `form`, `field`, `row`, `counter`, `hint`, `error`, `notice`, `buttons`, `primary`, `secondary`, `controls`, `coords`, `check`, `technique`.

- [ ] **Step 1: Write the failing page tests**

Create `src/features/edit/SmokeFormPage.test.tsx`:

```tsx
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clickRadar,
  mockEditServer,
  mockPlacementRadar,
  mockServerDown,
} from "../../test/editHelpers";
import { fakeYouTube, type FakeYouTube } from "../../test/fakeYouTube";
import { FIXTURE_DATA, restoreFixtureData } from "../../test/fixtureData";
import { renderAt } from "../../test/render";

vi.mock("../../data", async () => (await import("../../test/fixtureData")).mockDataModule());
vi.mock("../smoke/VideoPlayer", () => ({
  VideoPlayer: ({ title }: { title: string }) => <div data-testid="video">{title}</div>,
}));
const api = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock("../smoke/youtubeApi", () => ({ loadYouTubeApi: api.load }));

const NOW = () => new Date(2026, 9, 12, 12);
let yt: FakeYouTube;

beforeEach(() => {
  yt = fakeYouTube();
  api.load.mockResolvedValue(yt.YT);
});
afterEach(async () => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  await restoreFixtureData();
});

const currentLocation = () => screen.getByTestId("location").textContent;
const group = (name: string) => within(screen.getByRole("group", { name }));
const saveButton = () => screen.getByRole("button", { name: "Save" });

/** Renders a form route and waits for the lazily loaded page. */
async function openForm(path: string) {
  renderAt(path, { now: NOW });
  await screen.findByRole("form", {}, { timeout: 5000 });
  mockPlacementRadar(500);
}

async function renameWindow(user: ReturnType<typeof userEvent.setup>, name = "Window box") {
  await openForm("/maps/mirage/smokes/mirage-window-from-t-spawn/edit");
  await user.clear(screen.getByLabelText("Name"));
  await user.type(screen.getByLabelText("Name"), name);
}

describe("Add smoke", () => {
  it("adds a smoke from a YouTube link and opens its card", async () => {
    const server = mockEditServer();
    const user = userEvent.setup();
    await openForm("/maps/mirage/smokes/new?side=T");

    await user.click(screen.getByLabelText("Video link"));
    await user.paste("https://youtu.be/dQw4w9WgXcQ?t=95");
    expect(screen.getByLabelText("Start (s)")).toHaveValue(95);
    const player = await yt.ready();
    player.getCurrentTime.mockReturnValue(111.2);
    await user.click(screen.getByRole("button", { name: "Set end" }));
    expect(screen.getByLabelText("End (s)")).toHaveValue(112);

    await user.type(screen.getByLabelText("Name"), "Stairs");
    await user.type(screen.getByLabelText("From"), "T Ramp");
    expect(screen.getByText("mirage-stairs-from-t-ramp")).toBeInTheDocument();
    expect(group("Side").getByRole("button", { name: "T" })).toHaveAttribute("aria-pressed", "true");
    await user.click(group("Area").getByRole("button", { name: "A" }));
    await user.click(group("Movement").getByRole("button", { name: "Run" }));
    await user.click(screen.getByLabelText("Jump"));
    expect(screen.getByText("Run + jump throw · left click")).toBeInTheDocument();

    clickRadar(150, 100);
    expect(group("Placing").getByRole("button", { name: "Stand" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    clickRadar(350, 150);
    expect(screen.getByText("Land 0.300, 0.200 · Stand 0.700, 0.300")).toBeInTheDocument();

    await user.click(saveButton());
    await waitFor(() =>
      expect(currentLocation()).toBe("/maps/mirage/smokes/mirage-stairs-from-t-ramp?side=T"),
    );
    expect(server.sent().file.lineups.at(-1)).toEqual({
      id: "mirage-stairs-from-t-ramp",
      name: "Stairs",
      from: "T Ramp",
      side: "T",
      area: "A",
      throw: { movement: "run", jump: true, click: "left" },
      stand: { x: 0.7, y: 0.3 },
      land: { x: 0.3, y: 0.2 },
      video: { url: "https://youtu.be/dQw4w9WgXcQ?t=95", start: 95, end: 112 },
      status: "unreviewed",
      checkedOn: "2026-10-12",
    });
    expect(screen.getByRole("heading", { name: "Stairs", level: 2 })).toBeInTheDocument();
  });

  it("has no clip times for a link that isn't YouTube", async () => {
    const user = userEvent.setup();
    await openForm("/maps/mirage/smokes/new");
    await user.click(screen.getByLabelText("Video link"));
    await user.paste("https://csnades.gg/mirage/smokes/stairs");
    expect(screen.queryByLabelText("Start (s)")).toBeNull();
    expect(screen.getByRole("link", { name: "Open video ↗" })).toHaveAttribute(
      "href",
      "https://csnades.gg/mirage/smokes/stairs",
    );
  });

  it("lists what is missing and sends nothing", async () => {
    const server = mockEditServer();
    await openForm("/maps/mirage/smokes/new");
    await userEvent.click(saveButton());
    for (const text of [
      "Paste a video link",
      "Enter the spot the smoke covers",
      "Enter where it is thrown from",
      "Choose a side",
      "Choose an area",
      "Place the land spot on the radar Place the stand spot on the radar",
    ]) {
      expect(screen.getByText(text)).toBeInTheDocument();
    }
    expect(server.fetch).not.toHaveBeenCalled();
  });

  it("places a Nuke spot on the level shown", async () => {
    await openForm("/maps/nuke/smokes/new");
    await userEvent.click(group("Level").getByRole("button", { name: "Lower" }));
    clickRadar(200, 250);
    expect(screen.getByText(/^Land 0\.400, 0\.500 \(lower\)/)).toBeInTheDocument();
  });

  it("is offered on the map view, keeping the filters", () => {
    renderAt("/maps/mirage?side=CT");
    expect(screen.getByRole("link", { name: "+ Add smoke" })).toHaveAttribute(
      "href",
      "/maps/mirage/smokes/new?side=CT",
    );
  });
});

describe("Edit smoke", () => {
  it("keeps the id after a rename and dates a status change", async () => {
    const server = mockEditServer();
    const user = userEvent.setup();
    await renameWindow(user);
    await user.click(group("Status").getByRole("button", { name: "OK" }));
    expect(screen.getByText("Last checked 2026-10-12")).toBeInTheDocument();
    await user.click(saveButton());
    await waitFor(() =>
      expect(currentLocation()).toBe("/maps/mirage/smokes/mirage-window-from-t-spawn"),
    );
    expect(server.sent().file.lineups[0]).toEqual({
      ...FIXTURE_DATA.mirage.lineups[0],
      name: "Window box",
      status: "ok",
      checkedOn: "2026-10-12",
    });
  });

  it("keeps the last-checked date when the status stays the same", async () => {
    const server = mockEditServer();
    const user = userEvent.setup();
    await renameWindow(user);
    await user.click(saveButton());
    await waitFor(() => expect(server.fetch).toHaveBeenCalled());
    expect(server.sent().file.lineups[0].checkedOn).toBe("2026-10-10");
  });

  it("opens a Nuke smoke on its landing level and keeps both levels when saved", async () => {
    const server = mockEditServer();
    const user = userEvent.setup();
    await openForm("/maps/nuke/smokes/nuke-ramp-from-lobby/edit");
    expect(group("Level").getByRole("button", { name: "Lower" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await user.type(screen.getByLabelText("Notes"), " Tight.");
    await user.click(saveButton());
    await waitFor(() => expect(server.fetch).toHaveBeenCalled());
    const saved = server.sent().file.lineups[1];
    expect(saved.stand).toEqual({ x: 0.3, y: 0.6, level: "upper" });
    expect(saved.land).toEqual({ x: 0.4, y: 0.7, level: "lower" });
  });

  it("blocks a side change that an execute doesn't allow", async () => {
    const server = mockEditServer();
    await openForm("/maps/mirage/smokes/mirage-ct-from-t-ramp/edit");
    await userEvent.click(group("Side").getByRole("button", { name: "CT" }));
    await userEvent.click(saveButton());
    expect(await screen.findByRole("alert")).toHaveTextContent(
      `Execute 'A execute': "mirage-ct-from-t-ramp" is a CT smoke but the execute is T`,
    );
    expect(server.fetch).not.toHaveBeenCalled();
  });

  it("shows Not found for an unknown smoke", async () => {
    renderAt("/maps/mirage/smokes/mirage-nope/edit?side=T");
    expect(
      await screen.findByRole("heading", { name: "Not found" }, { timeout: 5000 }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to Mirage" })).toHaveAttribute(
      "href",
      "/maps/mirage?side=T",
    );
  });
});

describe("saving", () => {
  it("shows the server's field errors and keeps the form", async () => {
    mockEditServer(() => ({
      status: 400,
      json: { errors: [{ path: "lineups[0].notes", message: "must be at most 280 characters" }] },
    }));
    const user = userEvent.setup();
    await openForm("/maps/mirage/smokes/mirage-window-from-t-spawn/edit");
    await user.type(screen.getByLabelText("Notes"), "!");
    await user.click(saveButton());
    expect(await screen.findByText("must be at most 280 characters")).toBeInTheDocument();
    expect(screen.getByLabelText("Notes")).toHaveValue("Aim at the top-left corner of the antenna!");
  });

  it("offers a reload when the map changed on disk", async () => {
    mockEditServer(() => ({ status: 409, json: { error: "changed" } }));
    const user = userEvent.setup();
    await renameWindow(user);
    await user.click(saveButton());
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This map changed outside this page (another tab, a hand edit or git). Reload to get the latest version.",
    );
    expect(screen.getByRole("button", { name: "Reload" })).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toHaveValue("Window box");
  });

  it("says when the dev server isn't running", async () => {
    mockServerDown();
    const user = userEvent.setup();
    await renameWindow(user);
    await user.click(saveButton());
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Can't reach the dev server — is npm run dev running?",
    );
  });

  it("sends one save for a double-click", async () => {
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = () => resolve();
    });
    const server = mockEditServer(async (body) => {
      await gate;
      return { status: 200, json: { file: body.file } };
    });
    const user = userEvent.setup();
    await renameWindow(user);
    await user.dblClick(saveButton());
    expect(server.fetch).toHaveBeenCalledTimes(1);
    expect(saveButton()).toBeDisabled();
    release();
    await waitFor(() =>
      expect(currentLocation()).toBe("/maps/mirage/smokes/mirage-window-from-t-spawn"),
    );
  });
});

describe("leaving the form", () => {
  it("goes back to the card without asking when nothing changed", async () => {
    const confirm = vi.spyOn(window, "confirm");
    await openForm("/maps/mirage/smokes/mirage-window-from-t-spawn/edit?area=Mid");
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(confirm).not.toHaveBeenCalled();
    expect(currentLocation()).toBe("/maps/mirage/smokes/mirage-window-from-t-spawn?area=Mid");
  });

  it("asks before discarding changes", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
    const user = userEvent.setup();
    await openForm("/maps/mirage/smokes/new");
    await user.type(screen.getByLabelText("Name"), "Stairs");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(confirm).toHaveBeenCalledWith("Discard changes?");
    expect(currentLocation()).toBe("/maps/mirage/smokes/new");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(currentLocation()).toBe("/maps/mirage");
  });

  it("warns before the tab closes with unsaved changes", async () => {
    await openForm("/maps/mirage/smokes/new");
    const clean = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(clean);
    expect(clean.defaultPrevented).toBe(false);
    await userEvent.type(screen.getByLabelText("Name"), "S");
    const dirty = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(dirty);
    expect(dirty.defaultPrevented).toBe(true);
  });
});

describe("outside dev", () => {
  it("has no add link and no form route", () => {
    vi.stubEnv("DEV", false);
    const view = renderAt("/maps/mirage");
    expect(screen.queryByRole("link", { name: "+ Add smoke" })).toBeNull();
    view.unmount();
    renderAt("/maps/mirage/smokes/new");
    expect(screen.getByRole("heading", { name: "Not found" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run them to make sure they fail**

Run: `npx vitest run src/features/edit/SmokeFormPage.test.tsx`
Expected: FAIL — most tests time out finding the form (no route yet); "is offered on the map view" fails (no link).

- [ ] **Step 3: Add the edit-mode boundary and routes**

Create `src/app/editMode.tsx`:

```tsx
import { lazy, Suspense, type ReactNode } from "react";

/**
 * Phase 2 edit mode, only under `npm run dev`. In builds Vite turns import.meta.env.DEV into
 * false and drops this branch with its lazy imports, so no edit code is published
 * (npm run check-bundle checks). Callers also test import.meta.env.DEV where they render, so
 * tests can switch edit mode off.
 */
export const Edit = import.meta.env.DEV
  ? {
      SmokeFormPage: lazy(() =>
        import("../features/edit/SmokeFormPage").then((m) => ({ default: m.SmokeFormPage })),
      ),
    }
  : null;

/** Shows nothing while an edit component loads. */
export function EditBoundary({ children }: { children: ReactNode }) {
  return <Suspense fallback={null}>{children}</Suspense>;
}
```

Replace `src/app/AppRoutes.tsx` with:

```tsx
import { Route, Routes } from "react-router";
import { HomePage } from "../features/home/HomePage";
import { MapPage } from "../features/map/MapPage";
import { SettingsPage } from "../features/settings/SettingsPage";
import { StudyPage } from "../features/study/StudyPage";
import { Edit, EditBoundary } from "./editMode";
import { Layout } from "./Layout";
import { NotFound } from "./NotFound";

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="maps/:mapId" element={<MapPage />} />
        <Route path="maps/:mapId/smokes/:lineupId" element={<MapPage />} />
        <Route path="maps/:mapId/executes/:executeId" element={<MapPage />} />
        {import.meta.env.DEV && Edit && (
          <>
            <Route
              path="maps/:mapId/smokes/new"
              element={
                <EditBoundary>
                  <Edit.SmokeFormPage />
                </EditBoundary>
              }
            />
            <Route
              path="maps/:mapId/smokes/:lineupId/edit"
              element={
                <EditBoundary>
                  <Edit.SmokeFormPage />
                </EditBoundary>
              }
            />
          </>
        )}
        <Route path="study" element={<StudyPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
```

React Router ranks the static `smokes/new` above `smokes/:lineupId`, and a real id can't be `new` (ids start with `<mapId>-`).

- [ ] **Step 4: Export `Segmented` and add "+ Add smoke"**

In `src/features/map/FiltersBar.tsx`, replace the `Segmented` function with:

```tsx
export function Segmented<T extends string>({
  label,
  options,
  value,
  onSelect,
}: {
  label: string;
  options: readonly (readonly [T, string])[];
  /** null: nothing chosen yet (edit forms). */
  value: T | null;
  onSelect: (value: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className={styles.segmented}>
      {options.map(([option, text]) => (
        <button
          key={option}
          type="button"
          aria-pressed={value === option}
          onClick={() => onSelect(option)}
        >
          {text}
        </button>
      ))}
    </div>
  );
}
```

In `src/features/map/MapPage.tsx`, add `Link` to the `react-router` import, and replace the `tab === "smokes" ? ( <LineupList … /> )` branch with:

```tsx
        {tab === "smokes" ? (
          <>
            {import.meta.env.DEV && (
              <Link to={`/maps/${map.id}/smokes/new${search}`} className={styles.addLink}>
                + Add smoke
              </Link>
            )}
            <LineupList
              mapId={map.id}
              lineups={visible}
              search={search}
              emptyText={
                data.lineups.length === 0
                  ? "No smokes on this map yet."
                  : "No smokes match these filters."
              }
            />
          </>
        ) : (
```

Append to `src/features/map/MapPage.module.css`:

```css
.addLink {
  justify-self: start;
  padding: 6px 12px;
  border: 1px dashed var(--border);
  border-radius: 999px;
  color: var(--accent);
  text-decoration: none;
}
```

- [ ] **Step 5: Add the shared form parts and styles**

Create `src/features/edit/formParts.tsx`:

```tsx
import { useEffect } from "react";
import styles from "./Edit.module.css";

export function FieldErrors({ messages }: { messages?: string[] }) {
  if (!messages || messages.length === 0) return null;
  return <p className={styles.error}>{messages.join(" ")}</p>;
}

export interface Notice {
  message: string;
  /** Offer a Reload button (the map changed on disk). */
  reload: boolean;
}

/** Save problems that belong to no single field. */
export function FormNotice({ notice, errors }: { notice: Notice | null; errors?: string[] }) {
  if (!notice && (!errors || errors.length === 0)) return null;
  return (
    <div className={styles.notice} role="alert">
      {notice && <p>{notice.message}</p>}
      {errors?.map((message) => <p key={message}>{message}</p>)}
      {notice?.reload && (
        <button type="button" onClick={() => window.location.reload()}>
          Reload
        </button>
      )}
    </div>
  );
}

/** The browser's leave-page warning while a form has unsaved changes. */
export function useLeaveWarning(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
}
```

Append to `src/features/edit/Edit.module.css`:

```css
.controls {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.coords {
  margin: 0;
  font-size: 0.85rem;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}

.form {
  display: grid;
  gap: 14px;
}

.form h2 {
  font-size: 1.3rem;
}

.field {
  display: grid;
  gap: 4px;
}

.field label {
  font-size: 0.85rem;
  color: var(--text-muted);
}

.field input[type="url"],
.field input[type="text"],
.field input[type="number"],
.field textarea,
.field select {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text);
  font: inherit;
}

.row {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 12px;
}

.row > .field {
  flex: 1;
  min-width: 120px;
}

.check {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 36px;
}

.counter {
  justify-self: end;
  font-size: 0.8rem;
  color: var(--text-muted);
}

.technique {
  margin: 0;
  font-weight: 600;
}

.error {
  margin: 0;
  font-size: 0.85rem;
  color: var(--bad);
}

.notice {
  display: grid;
  gap: 6px;
  padding: 10px 12px;
  border: 1px solid var(--bad);
  border-radius: var(--radius);
  background: color-mix(in srgb, var(--bad) 12%, transparent);
}

.notice p {
  margin: 0;
}

.notice button {
  justify-self: start;
}

.buttons {
  display: flex;
  gap: 8px;
}

.primary {
  padding: 8px 18px;
  border: 0;
  border-radius: 999px;
  background: var(--accent);
  color: #000;
  font-weight: 600;
}

.secondary {
  padding: 8px 18px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: transparent;
}
```

- [ ] **Step 6: Write the form fields**

Create `src/features/edit/SmokeFields.tsx`:

```tsx
import { useId } from "react";
import { techniqueText } from "../../lib/technique";
import { parseYouTubeUrl } from "../../lib/youtube";
import { Segmented } from "../map/FiltersBar";
import { ClipTimer } from "./ClipTimer";
import { FieldErrors } from "./formParts";
import { clock, seconds, withUrl, type DraftErrors, type SmokeDraft } from "./smokeDraft";
import styles from "./Edit.module.css";

const SIDE_OPTIONS = [
  ["T", "T"],
  ["CT", "CT"],
] as const;
const AREA_OPTIONS = [
  ["A", "A"],
  ["B", "B"],
  ["Mid", "Mid"],
  ["Other", "Other"],
] as const;
const MOVEMENT_OPTIONS = [
  ["stand", "Stand"],
  ["crouch", "Crouch"],
  ["walk", "Walk"],
  ["run", "Run"],
] as const;
const CLICK_OPTIONS = [
  ["left", "Left"],
  ["right", "Right"],
  ["both", "Both"],
] as const;
const STATUS_OPTIONS = [
  ["unreviewed", "Unreviewed"],
  ["ok", "OK"],
  ["broken", "Broken"],
] as const;

export interface SmokeFieldsProps {
  draft: SmokeDraft;
  errors: DraftErrors;
  onChange: (next: SmokeDraft) => void;
  /** The id the smoke has, or will get when added. */
  idText: string;
  /** The last-checked date the save will write. */
  checkedOn: string;
  autoFocusLink: boolean;
}

/** The smoke form's fields, in the spec §5 order. Stand and land are placed on the radar. */
export function SmokeFields({
  draft,
  errors,
  onChange,
  idText,
  checkedOn,
  autoFocusLink,
}: SmokeFieldsProps) {
  const id = useId();
  const set = (changes: Partial<SmokeDraft>) => onChange({ ...draft, ...changes });
  const link = draft.url.trim();
  const youtube = parseYouTubeUrl(link);
  const start = seconds(draft.start);
  const end = seconds(draft.end);

  return (
    <>
      <div className={styles.field}>
        <label htmlFor={`${id}-url`}>Video link</label>
        <input
          id={`${id}-url`}
          type="url"
          value={draft.url}
          autoFocus={autoFocusLink}
          onChange={(event) => onChange(withUrl(draft, event.target.value))}
        />
        <FieldErrors messages={errors.url} />
      </div>

      {youtube ? (
        <>
          <ClipTimer
            key={youtube.id}
            videoId={youtube.id}
            initialStart={start ?? youtube.t ?? 0}
            start={start ?? youtube.t}
            end={end}
            onSetStart={(value) => set({ start: String(value) })}
            onSetEnd={(value) => set({ end: String(value) })}
          />
          <div className={styles.row}>
            <ClipField
              id={`${id}-start`}
              label="Start (s)"
              value={draft.start}
              errors={errors.start}
              onChange={(value) => set({ start: value })}
            />
            <ClipField
              id={`${id}-end`}
              label="End (s)"
              value={draft.end}
              errors={errors.end}
              onChange={(value) => set({ end: value })}
            />
          </div>
        </>
      ) : (
        link !== "" && (
          <p className={styles.hint}>
            Not a YouTube link, so there are no clip times.{" "}
            <a href={link} target="_blank" rel="noreferrer">
              Open video ↗
            </a>
          </p>
        )
      )}

      <TextField
        id={`${id}-name`}
        label="Name"
        value={draft.name}
        errors={errors.name}
        onChange={(value) => set({ name: value })}
      />
      <TextField
        id={`${id}-from`}
        label="From"
        value={draft.from}
        errors={errors.from}
        onChange={(value) => set({ from: value })}
      />

      <div className={styles.row}>
        <div className={styles.field}>
          <Segmented
            label="Side"
            options={SIDE_OPTIONS}
            value={draft.side}
            onSelect={(side) => set({ side })}
          />
          <FieldErrors messages={errors.side} />
        </div>
        <div className={styles.field}>
          <Segmented
            label="Area"
            options={AREA_OPTIONS}
            value={draft.area}
            onSelect={(area) => set({ area })}
          />
          <FieldErrors messages={errors.area} />
        </div>
      </div>

      <div className={styles.field}>
        <div className={styles.row}>
          <Segmented
            label="Movement"
            options={MOVEMENT_OPTIONS}
            value={draft.movement}
            onSelect={(movement) => set({ movement })}
          />
          <label className={styles.check}>
            <input
              type="checkbox"
              checked={draft.jump}
              onChange={(event) => set({ jump: event.target.checked })}
            />
            Jump
          </label>
          <Segmented
            label="Click"
            options={CLICK_OPTIONS}
            value={draft.click}
            onSelect={(click) => set({ click })}
          />
        </div>
        <p className={styles.technique}>
          {techniqueText({ movement: draft.movement, jump: draft.jump, click: draft.click })}
        </p>
      </div>

      <div className={styles.field}>
        <p className={styles.hint}>
          Click the radar to place the land and stand spots; drag a spot to adjust it.
        </p>
        <FieldErrors messages={[...(errors.land ?? []), ...(errors.stand ?? [])]} />
      </div>

      <div className={styles.field}>
        <label htmlFor={`${id}-notes`}>Notes</label>
        <textarea
          id={`${id}-notes`}
          rows={3}
          value={draft.notes}
          onChange={(event) => set({ notes: event.target.value })}
        />
        <span className={styles.counter}>{draft.notes.length}/280</span>
        <FieldErrors messages={errors.notes} />
      </div>

      <div className={styles.row}>
        <Segmented
          label="Status"
          options={STATUS_OPTIONS}
          value={draft.status}
          onSelect={(status) => set({ status })}
        />
        <span className={styles.hint}>Last checked {checkedOn}</span>
      </div>
      <p className={styles.hint}>
        Id: <code>{idText}</code>
      </p>
    </>
  );
}

function TextField({
  id,
  label,
  value,
  errors,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  errors?: string[];
  onChange: (value: string) => void;
}) {
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      <input id={id} type="text" value={value} onChange={(event) => onChange(event.target.value)} />
      <span className={styles.counter}>{value.length}/40</span>
      <FieldErrors messages={errors} />
    </div>
  );
}

function ClipField({
  id,
  label,
  value,
  errors,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  errors?: string[];
  onChange: (value: string) => void;
}) {
  const parsed = seconds(value);
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="number"
        min={0}
        step={1}
        inputMode="numeric"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {parsed !== undefined && <span className={styles.hint}>{clock(parsed)}</span>}
      <FieldErrors messages={errors} />
    </div>
  );
}
```

- [ ] **Step 7: Write the page**

Create `src/features/edit/SmokeFormPage.tsx`:

```tsx
import { useRef, useState, type FormEvent } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { NotFound } from "../../app/NotFound";
import { useProgress } from "../../app/progress";
import { findLineup, getMapData, useDataVersion } from "../../data";
import { getMapInfo, hasLevels, type MapInfo } from "../../data/maps";
import { MAP_IDS, type Level, type Lineup, type Position } from "../../data/schema";
import { filtersToSearch, parseFilters, type Filters } from "../../lib/filters";
import { LevelSwitch, Segmented } from "../map/FiltersBar";
import { MapFrame } from "../map/MapFrame";
import { FormNotice, useLeaveWarning, type Notice } from "./formParts";
import { newLineupId, takenIds, upsertLineup } from "./mapEdits";
import { PlacementRadar, type Spot } from "./PlacementRadar";
import { saveMap } from "./saveClient";
import { SmokeFields } from "./SmokeFields";
import {
  draftFromLineup,
  emptyDraft,
  errorsForDraft,
  lineupFromDraft,
  type DraftErrors,
  type SmokeDraft,
} from "./smokeDraft";
import styles from "./Edit.module.css";

const PLACING_OPTIONS = [
  ["land", "Land"],
  ["stand", "Stand"],
] as const;

/** #/maps/:mapId/smokes/new and #/maps/:mapId/smokes/:lineupId/edit (dev only). */
export function SmokeFormPage() {
  const { mapId = "", lineupId } = useParams();
  const [params] = useSearchParams();
  useDataVersion();

  const map = getMapInfo(mapId);
  if (!map) return <NotFound />;
  const filters = parseFilters(params);
  const original = lineupId ? findLineup(map.id, lineupId) : undefined;
  if (lineupId && !original) {
    const backTo = { href: `/maps/${map.id}${filtersToSearch(filters)}`, label: `Back to ${map.name}` };
    return <NotFound backTo={backTo} />;
  }
  return <SmokeEditor key={lineupId ?? "new"} map={map} original={original} filters={filters} />;
}

function SmokeEditor({
  map,
  original,
  filters,
}: {
  map: MapInfo;
  original?: Lineup;
  filters: Filters;
}) {
  const navigate = useNavigate();
  const { today } = useProgress();
  const search = filtersToSearch(filters);
  const [draft, setDraft] = useState<SmokeDraft>(() =>
    original
      ? draftFromLineup(original)
      : emptyDraft({
          side: filters.side === "all" ? undefined : filters.side,
          area: filters.area === "all" ? undefined : filters.area,
        }),
  );
  const [initial] = useState(draft);
  const [active, setActive] = useState<Spot>("land");
  const [level, setLevel] = useState<Level>(original?.land.level ?? filters.level);
  const [errors, setErrors] = useState<DraftErrors>({});
  const [notice, setNotice] = useState<Notice | null>(null);
  const [saving, setSaving] = useState(false);
  const inFlight = useRef(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  useLeaveWarning(dirty);

  const data = getMapData(map.id);
  const id =
    original?.id ??
    newLineupId(map.id, draft.name, draft.from, takenIds(MAP_IDS.map((m) => getMapData(m))));
  const checkedOn = original && original.status === draft.status ? original.checkedOn : today;
  const cardHref = (lineupId: string) => `/maps/${map.id}/smokes/${lineupId}${search}`;
  const backHref = original ? cardHref(original.id) : `/maps/${map.id}${search}`;

  async function save(event: FormEvent) {
    event.preventDefault();
    if (inFlight.current) return;
    const built = lineupFromDraft(draft, { id, original, today });
    if (!built.ok) {
      setErrors(built.errors);
      setNotice(null);
      return;
    }
    const next = upsertLineup(data, built.lineup);
    inFlight.current = true;
    setSaving(true);
    try {
      const outcome = await saveMap(map.id, next);
      if (outcome.ok) {
        navigate(cardHref(id));
      } else if (outcome.kind === "invalid") {
        const index = next.lineups.findIndex((lineup) => lineup.id === id);
        setErrors(errorsForDraft(outcome.errors, index, next));
        setNotice(null);
      } else {
        setErrors({});
        setNotice({ message: outcome.message, reload: outcome.kind === "changed" });
      }
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }

  function cancel() {
    if (dirty && !window.confirm("Discard changes?")) return;
    navigate(backHref);
  }

  function place(spot: Spot, position: Position) {
    setDraft((current) =>
      spot === "land" ? { ...current, land: position } : { ...current, stand: position },
    );
  }

  return (
    <MapFrame
      map={map}
      controls={
        <div className={styles.controls}>
          <Segmented label="Placing" options={PLACING_OPTIONS} value={active} onSelect={setActive} />
          {hasLevels(map) && <LevelSwitch value={level} onSelect={setLevel} />}
        </div>
      }
      radar={
        <>
          <PlacementRadar
            map={map}
            level={level}
            side={draft.side ?? "T"}
            stand={draft.stand}
            land={draft.land}
            active={active}
            context={data.lineups.filter((lineup) => lineup.id !== original?.id)}
            onPlace={place}
            onRelease={(spot) => {
              // Spec §5: on Add, Stand becomes active once Land is placed.
              if (!original && spot === "land" && draft.stand === null) setActive("stand");
            }}
          />
          <p className={styles.coords}>
            Land {positionText(draft.land)} · Stand {positionText(draft.stand)}
          </p>
        </>
      }
      panel={
        <form
          className={styles.form}
          onSubmit={save}
          aria-label={original ? "Edit smoke" : "Add smoke"}
          noValidate
        >
          <h2>{original ? `Edit ${original.name}` : "Add smoke"}</h2>
          <FormNotice notice={notice} errors={errors.form} />
          <SmokeFields
            draft={draft}
            errors={errors}
            onChange={setDraft}
            idText={id}
            checkedOn={checkedOn}
            autoFocusLink={!original}
          />
          <div className={styles.buttons}>
            <button type="submit" className={styles.primary} disabled={saving}>
              Save
            </button>
            <button type="button" className={styles.secondary} onClick={cancel}>
              Cancel
            </button>
          </div>
        </form>
      }
    />
  );
}

function positionText(position: Position | null): string {
  if (!position) return "not placed";
  const text = `${position.x.toFixed(3)}, ${position.y.toFixed(3)}`;
  return position.level ? `${text} (${position.level})` : text;
}
```

- [ ] **Step 8: Run the page tests to make sure they pass**

Run: `npx vitest run src/features/edit/SmokeFormPage.test.tsx`
Expected: PASS (all tests in the file).

- [ ] **Step 9: Run everything, check the build, and commit**

Run: `npx vitest run && npm run format && npm run lint && npm run build && npm run check-bundle`
Expected: all tests pass; lint clean; `Bundle OK: no edit-mode code in dist/.` (the edit pages are now wired into the app, so this is the first real proof that the build drops them).

```bash
git add src/app/editMode.tsx src/app/AppRoutes.tsx src/features/map/FiltersBar.tsx src/features/map/MapPage.tsx src/features/map/MapPage.module.css src/features/edit/Edit.module.css src/features/edit/formParts.tsx src/features/edit/SmokeFields.tsx src/features/edit/SmokeFormPage.tsx src/features/edit/SmokeFormPage.test.tsx
git commit -m "feat: add the dev-only smoke form for adding and editing smokes"
```

---

### Task 12: Smoke card actions — Mark reviewed, Edit, Delete

Spec §6. Dev-only buttons on the smoke card. Mark reviewed saves `ok` + today, then opens the next unreviewed smoke in the current filtered list (wrapping), or says none are left. Delete confirms with the exact text, cleans up executes, and returns to the map view.

**Files:**
- Modify: `src/features/smoke/SmokeCard.tsx` (`actions` slot)
- Modify: `src/app/editMode.tsx` (add `SmokeActions`)
- Modify: `src/features/map/MapPage.tsx` (pass the actions)
- Modify: `src/features/edit/Edit.module.css`
- Create: `src/features/edit/SmokeActions.tsx`
- Create: `src/features/edit/SmokeActions.test.tsx`

**Interfaces:**
- Consumes: `markReviewed`, `nextUnreviewed`, `upsertLineup`, `deleteLineup`, `deleteConfirmText` (Task 6); `saveMap`, `describeProblem` (Task 8); `Edit`, `EditBoundary` (Task 11); `useProgress().today`.
- Produces:
  - `SmokeCard` accepts `actions?: ReactNode`, rendered under the header in the `page` variant only.
  - `SmokeActions({ map: MapInfo; lineup: Lineup; list: readonly Lineup[]; search: string })`, registered as `Edit.SmokeActions`.

- [ ] **Step 1: Write the failing tests**

Create `src/features/edit/SmokeActions.test.tsx`:

```tsx
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockEditServer } from "../../test/editHelpers";
import { restoreFixtureData } from "../../test/fixtureData";
import { renderAt } from "../../test/render";

vi.mock("../../data", async () => (await import("../../test/fixtureData")).mockDataModule());
vi.mock("../smoke/VideoPlayer", () => ({
  VideoPlayer: ({ title }: { title: string }) => <div data-testid="video">{title}</div>,
}));

const NOW = () => new Date(2026, 9, 12, 12);

afterEach(async () => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  await restoreFixtureData();
});

const currentLocation = () => screen.getByTestId("location").textContent;
/** Waits for a lazily loaded edit button. */
const button = (name: string) => screen.findByRole("button", { name }, { timeout: 5000 });
const CHANGED =
  "This map changed outside this page (another tab, a hand edit or git). Reload to get the latest version.";

// Fixture Mirage order: Window (unreviewed, Mid), CT (unreviewed, A), Jungle (unreviewed, A),
// Top Mid (ok, CT side), Market Window (broken, B). "A execute" = CT + Jungle.

describe("Mark reviewed", () => {
  it("marks the smoke ok today and opens the next unreviewed one", async () => {
    const server = mockEditServer();
    renderAt("/maps/mirage/smokes/mirage-window-from-t-spawn", { now: NOW });
    await userEvent.click(await button("Mark reviewed"));
    await waitFor(() =>
      expect(currentLocation()).toBe("/maps/mirage/smokes/mirage-ct-from-t-ramp"),
    );
    expect(server.sent().file.lineups[0]).toMatchObject({
      id: "mirage-window-from-t-spawn",
      status: "ok",
      checkedOn: "2026-10-12",
    });
    expect(screen.getByRole("heading", { name: "CT", level: 2 })).toBeInTheDocument();
  });

  it("wraps round within the filtered list", async () => {
    mockEditServer();
    renderAt("/maps/mirage/smokes/mirage-jungle-from-t-ramp?area=A", { now: NOW });
    await userEvent.click(await button("Mark reviewed"));
    await waitFor(() =>
      expect(currentLocation()).toBe("/maps/mirage/smokes/mirage-ct-from-t-ramp?area=A"),
    );
  });

  it("starts from the top of the list for a smoke the filters exclude", async () => {
    mockEditServer();
    renderAt("/maps/mirage/smokes/mirage-window-from-t-spawn?area=A", { now: NOW });
    await userEvent.click(await button("Mark reviewed"));
    await waitFor(() =>
      expect(currentLocation()).toBe("/maps/mirage/smokes/mirage-ct-from-t-ramp?area=A"),
    );
  });

  it("says when no unreviewed smokes are left, and stays", async () => {
    const server = mockEditServer();
    renderAt("/maps/mirage/smokes/mirage-top-mid-from-ct-spawn?side=CT", { now: NOW });
    await userEvent.click(await button("Mark reviewed"));
    expect(await screen.findByText("No unreviewed smokes left in this list.")).toBeInTheDocument();
    expect(currentLocation()).toBe("/maps/mirage/smokes/mirage-top-mid-from-ct-spawn?side=CT");
    expect(server.sent().file.lineups[3]).toMatchObject({ status: "ok", checkedOn: "2026-10-12" });
  });

  it("shows a save problem and stays", async () => {
    mockEditServer(() => ({ status: 409, json: { error: "changed" } }));
    renderAt("/maps/mirage/smokes/mirage-window-from-t-spawn", { now: NOW });
    await userEvent.click(await button("Mark reviewed"));
    expect(await screen.findByText(CHANGED)).toBeInTheDocument();
    expect(currentLocation()).toBe("/maps/mirage/smokes/mirage-window-from-t-spawn");
  });
});

describe("Edit and Delete", () => {
  it("links to the edit form, keeping the filters", async () => {
    renderAt("/maps/mirage/smokes/mirage-window-from-t-spawn?side=T");
    await button("Mark reviewed");
    expect(screen.getByRole("link", { name: "Edit" })).toHaveAttribute(
      "href",
      "/maps/mirage/smokes/mirage-window-from-t-spawn/edit?side=T",
    );
  });

  it("deletes a smoke after confirmation, cleaning up executes", async () => {
    const server = mockEditServer();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    renderAt("/maps/mirage/smokes/mirage-ct-from-t-ramp?area=A");
    await userEvent.click(await button("Delete"));
    expect(confirm).toHaveBeenCalledWith(
      "Delete 'CT from T Ramp'? 'A execute' is deleted too, because it would have fewer than 2 smokes.",
    );
    await waitFor(() => expect(currentLocation()).toBe("/maps/mirage?area=A"));
    const file = server.sent().file;
    expect(file.lineups.map((lineup) => lineup.id)).not.toContain("mirage-ct-from-t-ramp");
    expect(file.executes).toEqual([]);
  });

  it("does nothing when the delete is cancelled", async () => {
    const server = mockEditServer();
    vi.spyOn(window, "confirm").mockReturnValue(false);
    renderAt("/maps/mirage/smokes/mirage-ct-from-t-ramp");
    await userEvent.click(await button("Delete"));
    expect(server.fetch).not.toHaveBeenCalled();
    expect(currentLocation()).toBe("/maps/mirage/smokes/mirage-ct-from-t-ramp");
  });
});

describe("outside dev", () => {
  it("has no edit buttons on the card", () => {
    vi.stubEnv("DEV", false);
    renderAt("/maps/mirage/smokes/mirage-window-from-t-spawn");
    expect(screen.queryByRole("button", { name: "Mark reviewed" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Edit" })).toBeNull();
  });
});
```

- [ ] **Step 2: Run them to make sure they fail**

Run: `npx vitest run src/features/edit/SmokeActions.test.tsx`
Expected: FAIL — no "Mark reviewed" button (timeouts); the "outside dev" test passes already.

- [ ] **Step 3: Add the `actions` slot to the smoke card**

In `src/features/smoke/SmokeCard.tsx`:
- add `import type { ReactNode } from "react";` at the top;
- add to `SmokeCardProps`:

```ts
  /** Dev-only edit buttons, shown under the header (page variant only). */
  actions?: ReactNode;
```

- add `actions` to the destructured props;
- render it right after the `{variant === "page" && ( <header …> … </header> )}` block:

```tsx
      {variant === "page" && actions}
```

- [ ] **Step 4: Implement `SmokeActions`**

Append to `src/features/edit/Edit.module.css`:

```css
.actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.actions button,
.actions a {
  padding: 6px 12px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface-2);
  color: var(--text);
  font-size: 0.9rem;
  text-decoration: none;
}

.actions p {
  flex-basis: 100%;
  margin: 0;
  font-size: 0.85rem;
  color: var(--text-muted);
}
```

Create `src/features/edit/SmokeActions.tsx`:

```tsx
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { useProgress } from "../../app/progress";
import { getMapData } from "../../data";
import type { MapInfo } from "../../data/maps";
import type { Lineup, MapFile } from "../../data/schema";
import {
  deleteConfirmText,
  deleteLineup,
  markReviewed,
  nextUnreviewed,
  upsertLineup,
} from "./mapEdits";
import { describeProblem, saveMap } from "./saveClient";
import styles from "./Edit.module.css";

export interface SmokeActionsProps {
  map: MapInfo;
  lineup: Lineup;
  /** The filtered list that ‹ › steps through. */
  list: readonly Lineup[];
  /** The map filters, as a query string. */
  search: string;
}

/** Spec §6: Mark reviewed, Edit and Delete on the smoke card (dev only). */
export function SmokeActions({ map, lineup, list, search }: SmokeActionsProps) {
  const navigate = useNavigate();
  const { today } = useProgress();
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(next: MapFile, onSaved: () => void) {
    setBusy(true);
    setMessage(null);
    const outcome = await saveMap(map.id, next);
    setBusy(false);
    if (outcome.ok) onSaved();
    else setMessage(describeProblem(outcome));
  }

  function markReviewedAndGoOn() {
    const target = nextUnreviewed(list, lineup.id);
    void save(upsertLineup(getMapData(map.id), markReviewed(lineup, today)), () => {
      if (target) navigate(`/maps/${map.id}/smokes/${target.id}${search}`);
      else setMessage("No unreviewed smokes left in this list.");
    });
  }

  function remove() {
    const deletion = deleteLineup(getMapData(map.id), lineup.id);
    if (!window.confirm(deleteConfirmText(lineup, deletion))) return;
    void save(deletion.file, () => navigate(`/maps/${map.id}${search}`));
  }

  return (
    <div className={styles.actions}>
      <button type="button" disabled={busy} onClick={markReviewedAndGoOn}>
        Mark reviewed
      </button>
      <Link to={`/maps/${map.id}/smokes/${lineup.id}/edit${search}`}>Edit</Link>
      <button type="button" disabled={busy} onClick={remove}>
        Delete
      </button>
      {message && <p role="status">{message}</p>}
    </div>
  );
}
```

- [ ] **Step 5: Register it and pass it from the map page**

In `src/app/editMode.tsx`, add to the `Edit` object:

```tsx
      SmokeActions: lazy(() =>
        import("../features/edit/SmokeActions").then((m) => ({ default: m.SmokeActions })),
      ),
```

In `src/features/map/MapPage.tsx`, add `import { Edit, EditBoundary } from "../../app/editMode";` and give the `SmokeCard` in the `selected` branch this extra prop (keyed by smoke, so a message never carries over to another card):

```tsx
        actions={
          import.meta.env.DEV && Edit ? (
            <EditBoundary key={selected.id}>
              <Edit.SmokeActions map={map} lineup={selected} list={visible} search={search} />
            </EditBoundary>
          ) : undefined
        }
```

- [ ] **Step 6: Run the tests to make sure they pass**

Run: `npx vitest run src/features/edit/SmokeActions.test.tsx src/features/smoke src/features/map`
Expected: PASS.

- [ ] **Step 7: Run everything, check the build, and commit**

Run: `npx vitest run && npm run format && npm run lint && npm run build && npm run check-bundle`
Expected: all pass; `Bundle OK: no edit-mode code in dist/.`

```bash
git add src/features/smoke/SmokeCard.tsx src/app/editMode.tsx src/features/map/MapPage.tsx src/features/edit/Edit.module.css src/features/edit/SmokeActions.tsx src/features/edit/SmokeActions.test.tsx
git commit -m "feat: add Mark reviewed, Edit and Delete to the smoke card in dev"
```

---

### Task 13: Execute editor and execute actions

Spec §6 (execute buttons) and §7. Dev-only routes `#/maps/:mapId/executes/new` and `#/maps/:mapId/executes/:executeId/edit`; **+ Add execute** on the Executes tab; **Edit** and **Delete** on the execute view.

**Files:**
- Modify: `src/lib/filters.ts` and `src/lib/filters.test.ts` (`searchWithTab`)
- Modify: `src/features/map/MapPage.tsx` (use `searchWithTab`; "+ Add execute"; execute actions)
- Modify: `src/features/executes/ExecuteView.tsx` (`actions` slot)
- Modify: `src/app/editMode.tsx`, `src/app/AppRoutes.tsx`
- Modify: `src/features/edit/Edit.module.css`
- Create: `src/features/edit/executeDraft.ts`, `src/features/edit/executeDraft.test.ts`
- Create: `src/features/edit/ExecuteFormPage.tsx`, `src/features/edit/ExecuteFormPage.test.tsx`
- Create: `src/features/edit/ExecuteActions.tsx`, `src/features/edit/ExecuteActions.test.tsx`

**Interfaces:**
- Consumes: `newExecuteId`, `takenIds`, `upsertExecute`, `deleteExecute`, `idsOnSide` (Task 6); `saveMap`, `describeProblem` (Task 8); `ExecuteMarkers`, `MapFrame` (Task 2); `Segmented`, `FieldErrors`, `FormNotice`, `useLeaveWarning`, `Edit`, `EditBoundary` (Task 11).
- Produces:
  - `searchWithTab(filters: Filters, tab: "smokes" | "executes"): string` in `src/lib/filters.ts`.
  - `interface ExecuteDraft { name: string; side: Side; notes: string; lineupIds: string[] }`, `type ExecuteErrors = Partial<Record<"name" | "side" | "lineupIds" | "notes" | "form", string[]>>`, `emptyExecuteDraft(side: Side)`, `draftFromExecute(execute: Execute)`, `executeFromDraft(draft: ExecuteDraft, id: string): Execute`, `moved<T>(list: readonly T[], index: number, delta: number): T[]`, `errorsForExecute(errors, index: number): ExecuteErrors`.
  - `ExecuteFormPage()`, `ExecuteActions({ map, execute, search, listHref })`, registered on `Edit`.
  - `ExecuteView` accepts `actions?: ReactNode`.

- [ ] **Step 1: Move the tab query helper into `filters.ts`**

Append to `src/lib/filters.test.ts` (add `searchWithTab` to its import from `"./filters"`):

```ts
describe("searchWithTab", () => {
  it("adds the executes tab to the filters", () => {
    expect(searchWithTab({ side: "T", area: "all", level: "upper" }, "executes")).toBe(
      "?side=T&tab=executes",
    );
    expect(searchWithTab(DEFAULT_FILTERS, "executes")).toBe("?tab=executes");
  });

  it("leaves the smokes tab out, since it is the default", () => {
    expect(searchWithTab({ side: "T", area: "all", level: "upper" }, "smokes")).toBe("?side=T");
  });
});
```

(Add `DEFAULT_FILTERS` to the import too if the file doesn't import it yet.)

Run: `npx vitest run src/lib/filters.test.ts`
Expected: FAIL — `searchWithTab` is not exported.

Append to `src/lib/filters.ts`:

```ts
/** Filters plus the map view's list tab, as a query string ("smokes" is the default tab). */
export function searchWithTab(filters: Filters, tab: "smokes" | "executes"): string {
  const base = filtersToSearch(filters);
  if (tab === "smokes") return base;
  return base ? `${base}&tab=executes` : "?tab=executes";
}
```

In `src/features/map/MapPage.tsx`: delete the local `searchFor` function and its doc comment, import `searchWithTab` from `"../../lib/filters"` (and drop `type Filters` from that import, now unused), and replace every `searchFor(` with `searchWithTab(`.

Run: `npx vitest run src/lib/filters.test.ts src/features/map`
Expected: PASS.

- [ ] **Step 2: Write the failing execute-draft tests**

Create `src/features/edit/executeDraft.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { makeExecute } from "../../test/fixtures";
import {
  draftFromExecute,
  emptyExecuteDraft,
  errorsForExecute,
  executeFromDraft,
  moved,
} from "./executeDraft";

describe("execute drafts", () => {
  it("round-trips an execute through the form", () => {
    const execute = makeExecute({ notes: "Throw together" });
    expect(executeFromDraft(draftFromExecute(execute), execute.id)).toEqual(execute);
  });

  it("builds a new execute with trimmed text, fields in file order, empty notes left out", () => {
    const draft = { ...emptyExecuteDraft("T"), name: " B split ", lineupIds: ["mirage-a", "mirage-b"] };
    const execute = executeFromDraft(draft, "mirage-b-split");
    expect(execute).toEqual({
      id: "mirage-b-split",
      name: "B split",
      side: "T",
      lineupIds: ["mirage-a", "mirage-b"],
    });
    expect(Object.keys(execute)).toEqual(["id", "name", "side", "lineupIds"]);
  });

  it("moves an item up or down, staying inside the list", () => {
    expect(moved(["a", "b", "c"], 2, -1)).toEqual(["a", "c", "b"]);
    expect(moved(["a", "b", "c"], 0, 1)).toEqual(["b", "a", "c"]);
    expect(moved(["a", "b", "c"], 0, -1)).toEqual(["a", "b", "c"]);
  });

  it("puts validation errors on the execute's fields", () => {
    expect(
      errorsForExecute(
        [
          { path: "executes[1].lineupIds", message: "needs at least 2 smokes" },
          { path: "executes[1].name", message: "must be at most 40 characters" },
          { path: "executes[0].id", message: "duplicate id" },
        ],
        1,
      ),
    ).toEqual({
      lineupIds: ["needs at least 2 smokes"],
      name: ["must be at most 40 characters"],
      form: ["executes[0].id: duplicate id"],
    });
  });
});
```

Run: `npx vitest run src/features/edit/executeDraft.test.ts`
Expected: FAIL — `Failed to resolve import "./executeDraft"`.

- [ ] **Step 3: Implement `executeDraft.ts`**

Create `src/features/edit/executeDraft.ts`:

```ts
import type { Execute, Side } from "../../data/schema";

/** The execute form's state. */
export interface ExecuteDraft {
  name: string;
  side: Side;
  notes: string;
  /** Smoke ids in throw order. */
  lineupIds: string[];
}

export type ExecuteField = "name" | "side" | "lineupIds" | "notes";

/** Messages by field; "form" holds the ones that belong to no single field. */
export type ExecuteErrors = Partial<Record<ExecuteField | "form", string[]>>;

export function emptyExecuteDraft(side: Side): ExecuteDraft {
  return { name: "", side, notes: "", lineupIds: [] };
}

export function draftFromExecute(execute: Execute): ExecuteDraft {
  return {
    name: execute.name,
    side: execute.side,
    notes: execute.notes ?? "",
    lineupIds: [...execute.lineupIds],
  };
}

export function executeFromDraft(draft: ExecuteDraft, id: string): Execute {
  const notes = draft.notes.trim();
  return {
    id,
    name: draft.name.trim(),
    side: draft.side,
    lineupIds: [...draft.lineupIds],
    ...(notes === "" ? {} : { notes }),
  };
}

/** The list with the item at `index` moved `delta` places; unchanged if that leaves the list. */
export function moved<T>(list: readonly T[], index: number, delta: number): T[] {
  const target = index + delta;
  const next = [...list];
  if (target < 0 || target >= list.length) return next;
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

const FIELDS: readonly ExecuteField[] = ["name", "side", "lineupIds", "notes"];

/** Sorts validation errors onto the form; `index` is the execute's place in `executes`. */
export function errorsForExecute(
  errors: readonly { path: string; message: string }[],
  index: number,
): ExecuteErrors {
  const result: ExecuteErrors = {};
  const prefix = `executes[${index}].`;
  for (const { path, message } of errors) {
    const head = path.startsWith(prefix) ? path.slice(prefix.length).split(/[.[]/)[0] : "";
    const field = FIELDS.find((name) => name === head);
    if (field) (result[field] ??= []).push(message);
    else (result.form ??= []).push(path === "" ? message : `${path}: ${message}`);
  }
  return result;
}
```

Run: `npx vitest run src/features/edit/executeDraft.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 4: Write the failing page tests**

Create `src/features/edit/ExecuteFormPage.test.tsx`:

```tsx
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { replaceMapFile } from "../../data";
import { mockEditServer } from "../../test/editHelpers";
import { restoreFixtureData } from "../../test/fixtureData";
import { makeLineup, makeMapFile } from "../../test/fixtures";
import { renderAt } from "../../test/render";

vi.mock("../../data", async () => (await import("../../test/fixtureData")).mockDataModule());
vi.mock("../smoke/VideoPlayer", () => ({
  VideoPlayer: ({ title }: { title: string }) => <div data-testid="video">{title}</div>,
}));

afterEach(async () => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  await restoreFixtureData();
});

const currentLocation = () => screen.getByTestId("location").textContent;
const group = (name: string) => within(screen.getByRole("group", { name }));
const rows = () =>
  within(screen.getByRole("list", { name: "Smokes in throw order" })).queryAllByRole("listitem");
const addSmoke = () => screen.getByRole("combobox", { name: "Add smoke" });

async function openForm(path: string) {
  renderAt(path);
  await screen.findByRole("form", {}, { timeout: 5000 });
}

describe("Add execute", () => {
  it("builds an execute from the map's smokes, in the order chosen", async () => {
    const server = mockEditServer();
    const user = userEvent.setup();
    await openForm("/maps/mirage/executes/new");
    await user.type(screen.getByLabelText("Name"), "B split");
    expect(group("Side").getByRole("button", { name: "T" })).toHaveAttribute("aria-pressed", "true");
    expect(within(addSmoke()).queryByRole("option", { name: "Top Mid · CT Spawn" })).toBeNull();

    await user.selectOptions(addSmoke(), "mirage-window-from-t-spawn");
    await user.selectOptions(addSmoke(), "mirage-market-window-from-b-apps");
    await user.click(screen.getByRole("button", { name: "Move Market Window up" }));
    expect(rows().map((row) => row.textContent)).toEqual([
      expect.stringContaining("1. Market Window"),
      expect.stringContaining("2. Window"),
    ]);
    expect(screen.getAllByTestId("landing-marker")).toHaveLength(2);
    expect(screen.getByText("mirage-b-split")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(currentLocation()).toBe("/maps/mirage/executes/mirage-b-split"));
    expect(server.sent().file.executes.at(-1)).toEqual({
      id: "mirage-b-split",
      name: "B split",
      side: "T",
      lineupIds: ["mirage-market-window-from-b-apps", "mirage-window-from-t-spawn"],
    });
    expect(screen.getByRole("heading", { name: "B split", level: 2 })).toBeInTheDocument();
  });

  it("needs at least 2 smokes", async () => {
    const server = mockEditServer();
    const user = userEvent.setup();
    await openForm("/maps/mirage/executes/new");
    await user.type(screen.getByLabelText("Name"), "Solo");
    await user.selectOptions(addSmoke(), "mirage-window-from-t-spawn");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("needs at least 2 smokes")).toBeInTheDocument();
    expect(server.fetch).not.toHaveBeenCalled();
  });

  it("stops offering smokes at 8", async () => {
    replaceMapFile(
      "ancient",
      makeMapFile(
        "ancient",
        Array.from({ length: 9 }, (_, i) =>
          makeLineup({ id: `ancient-smoke-${i + 1}`, name: `Smoke ${i + 1}` }),
        ),
      ),
    );
    const user = userEvent.setup();
    await openForm("/maps/ancient/executes/new");
    for (let i = 1; i <= 8; i += 1) await user.selectOptions(addSmoke(), `ancient-smoke-${i}`);
    expect(rows()).toHaveLength(8);
    expect(addSmoke()).toBeDisabled();
  });

  it("is offered on the Executes tab, keeping the filters", () => {
    renderAt("/maps/mirage?tab=executes&side=T");
    expect(screen.getByRole("link", { name: "+ Add execute" })).toHaveAttribute(
      "href",
      "/maps/mirage/executes/new?side=T",
    );
  });
});

describe("Edit execute", () => {
  it("edits the smokes, keeping the id", async () => {
    const server = mockEditServer();
    const user = userEvent.setup();
    await openForm("/maps/mirage/executes/mirage-a-execute/edit");
    await user.click(screen.getByRole("button", { name: "Remove Jungle" }));
    await user.selectOptions(addSmoke(), "mirage-window-from-t-spawn");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(currentLocation()).toBe("/maps/mirage/executes/mirage-a-execute"));
    expect(server.sent().file.executes[0]).toEqual({
      id: "mirage-a-execute",
      name: "A execute",
      side: "T",
      lineupIds: ["mirage-ct-from-t-ramp", "mirage-window-from-t-spawn"],
    });
  });

  it("asks before a side change removes smokes", async () => {
    const confirm = vi
      .spyOn(window, "confirm")
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);
    const user = userEvent.setup();
    await openForm("/maps/mirage/executes/mirage-a-execute/edit");
    await user.click(group("Side").getByRole("button", { name: "CT" }));
    expect(confirm).toHaveBeenCalledWith("Changing the side removes 2 smokes from the other side.");
    expect(rows()).toHaveLength(2);
    await user.click(group("Side").getByRole("button", { name: "CT" }));
    expect(rows()).toHaveLength(0);
    expect(group("Side").getByRole("button", { name: "CT" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("shows Not found for an unknown execute", async () => {
    renderAt("/maps/mirage/executes/mirage-nope/edit");
    expect(
      await screen.findByRole("heading", { name: "Not found" }, { timeout: 5000 }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to Mirage" })).toHaveAttribute(
      "href",
      "/maps/mirage?tab=executes",
    );
  });
});
```

Create `src/features/edit/ExecuteActions.test.tsx`:

```tsx
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockEditServer } from "../../test/editHelpers";
import { restoreFixtureData } from "../../test/fixtureData";
import { renderAt } from "../../test/render";

vi.mock("../../data", async () => (await import("../../test/fixtureData")).mockDataModule());
vi.mock("../smoke/VideoPlayer", () => ({
  VideoPlayer: ({ title }: { title: string }) => <div data-testid="video">{title}</div>,
}));

afterEach(async () => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  await restoreFixtureData();
});

const currentLocation = () => screen.getByTestId("location").textContent;
const deleteButton = () => screen.findByRole("button", { name: "Delete" }, { timeout: 5000 });

describe("ExecuteActions", () => {
  it("links to the edit form", async () => {
    renderAt("/maps/mirage/executes/mirage-a-execute?side=T");
    await deleteButton();
    expect(screen.getByRole("link", { name: "Edit" })).toHaveAttribute(
      "href",
      "/maps/mirage/executes/mirage-a-execute/edit?side=T",
    );
  });

  it("deletes the execute after confirmation and keeps its smokes", async () => {
    const server = mockEditServer();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    renderAt("/maps/mirage/executes/mirage-a-execute");
    await userEvent.click(await deleteButton());
    expect(confirm).toHaveBeenCalledWith("Delete the execute 'A execute'? Its smokes are kept.");
    await waitFor(() => expect(currentLocation()).toBe("/maps/mirage?tab=executes"));
    expect(server.sent().file.executes).toEqual([]);
    expect(server.sent().file.lineups).toHaveLength(5);
  });

  it("does nothing when the delete is cancelled", async () => {
    const server = mockEditServer();
    vi.spyOn(window, "confirm").mockReturnValue(false);
    renderAt("/maps/mirage/executes/mirage-a-execute");
    await userEvent.click(await deleteButton());
    expect(server.fetch).not.toHaveBeenCalled();
  });

  it("has no execute edit controls outside dev", () => {
    vi.stubEnv("DEV", false);
    const view = renderAt("/maps/mirage?tab=executes");
    expect(screen.queryByRole("link", { name: "+ Add execute" })).toBeNull();
    view.unmount();
    renderAt("/maps/mirage/executes/mirage-a-execute");
    expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();
  });
});
```

Run: `npx vitest run src/features/edit/ExecuteFormPage.test.tsx src/features/edit/ExecuteActions.test.tsx`
Expected: FAIL — forms and buttons are not there yet (the "outside dev" test passes already).

- [ ] **Step 5: Add the `actions` slot to the execute view**

In `src/features/executes/ExecuteView.tsx`: add `type ReactNode` to the `react` import (`import { useState, type ReactNode } from "react";`), add `actions` to the destructured props and to the props type:

```ts
  /** Dev-only edit buttons, shown under the header. */
  actions?: ReactNode;
```

and render `{actions}` right after the closing `</header>`.

- [ ] **Step 6: Implement the execute form page**

Append to `src/features/edit/Edit.module.css`:

```css
.label {
  font-size: 0.85rem;
  color: var(--text-muted);
}

.steps {
  display: grid;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.steps li {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
}

.stepName {
  flex: 1;
}

.steps button {
  width: 32px;
  height: 32px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface-2);
}
```

Create `src/features/edit/ExecuteFormPage.tsx`:

```tsx
import { useId, useRef, useState, type FormEvent } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { NotFound } from "../../app/NotFound";
import { findExecute, getMapData, useDataVersion } from "../../data";
import { getMapInfo, hasLevels, type MapInfo } from "../../data/maps";
import {
  MAP_IDS,
  type Execute,
  type Level,
  type Lineup,
  type Position,
  type Side,
} from "../../data/schema";
import { filtersToSearch, parseFilters, searchWithTab, type Filters } from "../../lib/filters";
import { ExecuteMarkers } from "../executes/ExecuteMarkers";
import { LevelSwitch, Segmented } from "../map/FiltersBar";
import { MapFrame } from "../map/MapFrame";
import { Radar } from "../map/Radar";
import {
  draftFromExecute,
  emptyExecuteDraft,
  errorsForExecute,
  executeFromDraft,
  moved,
  type ExecuteDraft,
  type ExecuteErrors,
} from "./executeDraft";
import { FieldErrors, FormNotice, useLeaveWarning, type Notice } from "./formParts";
import { idsOnSide, newExecuteId, takenIds, upsertExecute } from "./mapEdits";
import { saveMap } from "./saveClient";
import styles from "./Edit.module.css";

const SIDE_OPTIONS = [
  ["T", "T"],
  ["CT", "CT"],
] as const;
const MAX_SMOKES = 8;

/** #/maps/:mapId/executes/new and #/maps/:mapId/executes/:executeId/edit (dev only). */
export function ExecuteFormPage() {
  const { mapId = "", executeId } = useParams();
  const [params] = useSearchParams();
  useDataVersion();

  const map = getMapInfo(mapId);
  if (!map) return <NotFound />;
  const filters = parseFilters(params);
  const original = executeId ? findExecute(map.id, executeId) : undefined;
  if (executeId && !original) {
    const backTo = {
      href: `/maps/${map.id}${searchWithTab(filters, "executes")}`,
      label: `Back to ${map.name}`,
    };
    return <NotFound backTo={backTo} />;
  }
  return <ExecuteEditor key={executeId ?? "new"} map={map} original={original} filters={filters} />;
}

function ExecuteEditor({
  map,
  original,
  filters,
}: {
  map: MapInfo;
  original?: Execute;
  filters: Filters;
}) {
  const navigate = useNavigate();
  const fieldId = useId();
  const search = filtersToSearch(filters);
  const [draft, setDraft] = useState<ExecuteDraft>(() =>
    original
      ? draftFromExecute(original)
      : emptyExecuteDraft(filters.side === "all" ? "T" : filters.side),
  );
  const [initial] = useState(draft);
  const [level, setLevel] = useState<Level>(filters.level);
  const [errors, setErrors] = useState<ExecuteErrors>({});
  const [notice, setNotice] = useState<Notice | null>(null);
  const [saving, setSaving] = useState(false);
  const inFlight = useRef(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  useLeaveWarning(dirty);

  const data = getMapData(map.id);
  const withLevels = hasLevels(map);
  const id =
    original?.id ?? newExecuteId(map.id, draft.name, takenIds(MAP_IDS.map((m) => getMapData(m))));
  const byId = new Map(data.lineups.map((lineup) => [lineup.id, lineup]));
  const chosen = draft.lineupIds
    .map((lineupId) => byId.get(lineupId))
    .filter((lineup): lineup is Lineup => lineup !== undefined);
  const available = data.lineups.filter(
    (lineup) => lineup.side === draft.side && !draft.lineupIds.includes(lineup.id),
  );
  const isShown = (position: Position) => !withLevels || (position.level ?? "upper") === level;
  const viewHref = (executeId: string) => `/maps/${map.id}/executes/${executeId}${search}`;
  const backHref = original
    ? viewHref(original.id)
    : `/maps/${map.id}${searchWithTab(filters, "executes")}`;
  const set = (changes: Partial<ExecuteDraft>) =>
    setDraft((current) => ({ ...current, ...changes }));

  function changeSide(side: Side) {
    if (side === draft.side) return;
    const kept = idsOnSide(draft.lineupIds, side, data.lineups);
    const dropped = draft.lineupIds.length - kept.length;
    const question = `Changing the side removes ${dropped} ${dropped === 1 ? "smoke" : "smokes"} from the other side.`;
    if (dropped > 0 && !window.confirm(question)) return;
    set({ side, lineupIds: kept });
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (inFlight.current) return;
    const next = upsertExecute(data, executeFromDraft(draft, id));
    inFlight.current = true;
    setSaving(true);
    try {
      const outcome = await saveMap(map.id, next);
      if (outcome.ok) {
        navigate(viewHref(id));
      } else if (outcome.kind === "invalid") {
        const index = next.executes.findIndex((execute) => execute.id === id);
        setErrors(errorsForExecute(outcome.errors, index));
        setNotice(null);
      } else {
        setErrors({});
        setNotice({ message: outcome.message, reload: outcome.kind === "changed" });
      }
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }

  function cancel() {
    if (dirty && !window.confirm("Discard changes?")) return;
    navigate(backHref);
  }

  return (
    <MapFrame
      map={map}
      controls={withLevels ? <LevelSwitch value={level} onSelect={setLevel} /> : undefined}
      radar={
        <Radar map={map} level={level} label={`${map.name} radar`}>
          <ExecuteMarkers lineups={chosen} isShown={isShown} />
        </Radar>
      }
      panel={
        <form
          className={styles.form}
          onSubmit={save}
          aria-label={original ? "Edit execute" : "Add execute"}
          noValidate
        >
          <h2>{original ? `Edit ${original.name}` : "Add execute"}</h2>
          <FormNotice notice={notice} errors={errors.form} />

          <div className={styles.field}>
            <label htmlFor={`${fieldId}-name`}>Name</label>
            <input
              id={`${fieldId}-name`}
              type="text"
              value={draft.name}
              autoFocus={!original}
              onChange={(event) => set({ name: event.target.value })}
            />
            <span className={styles.counter}>{draft.name.length}/40</span>
            <FieldErrors messages={errors.name} />
          </div>

          <div className={styles.field}>
            <Segmented label="Side" options={SIDE_OPTIONS} value={draft.side} onSelect={changeSide} />
            <FieldErrors messages={errors.side} />
          </div>

          <div className={styles.field}>
            <span className={styles.label}>Smokes, in throw order</span>
            <ol className={styles.steps} aria-label="Smokes in throw order">
              {draft.lineupIds.map((lineupId, index) => {
                const lineup = byId.get(lineupId);
                const name = lineup?.name ?? lineupId;
                return (
                  <li key={lineupId}>
                    <span className={styles.stepName}>
                      {index + 1}. {name}{" "}
                      {lineup && <span className={styles.hint}>· {lineup.from}</span>}
                    </span>
                    <button
                      type="button"
                      aria-label={`Move ${name} up`}
                      disabled={index === 0}
                      onClick={() => set({ lineupIds: moved(draft.lineupIds, index, -1) })}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      aria-label={`Move ${name} down`}
                      disabled={index === draft.lineupIds.length - 1}
                      onClick={() => set({ lineupIds: moved(draft.lineupIds, index, 1) })}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      aria-label={`Remove ${name}`}
                      onClick={() =>
                        set({ lineupIds: draft.lineupIds.filter((other) => other !== lineupId) })
                      }
                    >
                      ✕
                    </button>
                  </li>
                );
              })}
            </ol>
            <select
              aria-label="Add smoke"
              value=""
              disabled={draft.lineupIds.length >= MAX_SMOKES || available.length === 0}
              onChange={(event) => {
                if (event.target.value) set({ lineupIds: [...draft.lineupIds, event.target.value] });
              }}
            >
              <option value="">Add smoke…</option>
              {available.map((lineup) => (
                <option key={lineup.id} value={lineup.id}>
                  {lineup.name} · {lineup.from}
                </option>
              ))}
            </select>
            <FieldErrors messages={errors.lineupIds} />
          </div>

          <div className={styles.field}>
            <label htmlFor={`${fieldId}-notes`}>Notes</label>
            <textarea
              id={`${fieldId}-notes`}
              rows={3}
              value={draft.notes}
              onChange={(event) => set({ notes: event.target.value })}
            />
            <span className={styles.counter}>{draft.notes.length}/280</span>
            <FieldErrors messages={errors.notes} />
          </div>

          <p className={styles.hint}>
            Id: <code>{id}</code>
          </p>
          <div className={styles.buttons}>
            <button type="submit" className={styles.primary} disabled={saving}>
              Save
            </button>
            <button type="button" className={styles.secondary} onClick={cancel}>
              Cancel
            </button>
          </div>
        </form>
      }
    />
  );
}
```

- [ ] **Step 7: Implement the execute actions**

Create `src/features/edit/ExecuteActions.tsx`:

```tsx
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { getMapData } from "../../data";
import type { MapInfo } from "../../data/maps";
import type { Execute } from "../../data/schema";
import { deleteExecute } from "./mapEdits";
import { describeProblem, saveMap } from "./saveClient";
import styles from "./Edit.module.css";

export interface ExecuteActionsProps {
  map: MapInfo;
  execute: Execute;
  /** The map filters, as a query string. */
  search: string;
  /** The map view's Executes tab, where a deleted execute's page goes back to. */
  listHref: string;
}

/** Spec §6: Edit and Delete on the execute view (dev only). */
export function ExecuteActions({ map, execute, search, listHref }: ExecuteActionsProps) {
  const navigate = useNavigate();
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (!window.confirm(`Delete the execute '${execute.name}'? Its smokes are kept.`)) return;
    setBusy(true);
    setMessage(null);
    const outcome = await saveMap(map.id, deleteExecute(getMapData(map.id), execute.id));
    setBusy(false);
    if (outcome.ok) navigate(listHref);
    else setMessage(describeProblem(outcome));
  }

  return (
    <div className={styles.actions}>
      <Link to={`/maps/${map.id}/executes/${execute.id}/edit${search}`}>Edit</Link>
      <button type="button" disabled={busy} onClick={() => void remove()}>
        Delete
      </button>
      {message && <p role="status">{message}</p>}
    </div>
  );
}
```

- [ ] **Step 8: Register, route and wire them**

In `src/app/editMode.tsx`, add to the `Edit` object:

```tsx
      ExecuteFormPage: lazy(() =>
        import("../features/edit/ExecuteFormPage").then((m) => ({ default: m.ExecuteFormPage })),
      ),
      ExecuteActions: lazy(() =>
        import("../features/edit/ExecuteActions").then((m) => ({ default: m.ExecuteActions })),
      ),
```

In `src/app/AppRoutes.tsx`, add inside the dev-only fragment, after the two smoke routes:

```tsx
            <Route
              path="maps/:mapId/executes/new"
              element={
                <EditBoundary>
                  <Edit.ExecuteFormPage />
                </EditBoundary>
              }
            />
            <Route
              path="maps/:mapId/executes/:executeId/edit"
              element={
                <EditBoundary>
                  <Edit.ExecuteFormPage />
                </EditBoundary>
              }
            />
```

In `src/features/map/MapPage.tsx`:

- give the `ExecuteView` in the `execute` branch this extra prop:

```tsx
        actions={
          import.meta.env.DEV && Edit ? (
            <EditBoundary key={execute.id}>
              <Edit.ExecuteActions
                map={map}
                execute={execute}
                search={search}
                listHref={backToMap("executes")}
              />
            </EditBoundary>
          ) : undefined
        }
```

- replace the executes branch of the tab (the `( <ExecuteList … /> )` after `:`) with:

```tsx
          <>
            {import.meta.env.DEV && (
              <Link to={`/maps/${map.id}/executes/new${search}`} className={styles.addLink}>
                + Add execute
              </Link>
            )}
            <ExecuteList
              mapId={map.id}
              executes={visibleExecutes}
              lineups={data.lineups}
              search={search}
              emptyText={
                data.executes.length === 0
                  ? "No executes on this map yet."
                  : "No executes match these filters."
              }
            />
          </>
```

- [ ] **Step 9: Run the tests to make sure they pass**

Run: `npx vitest run src/features/edit src/features/executes src/features/map src/lib`
Expected: PASS.

- [ ] **Step 10: Run everything, check the build, and commit**

Run: `npx vitest run && npm run format && npm run lint && npm run build && npm run check-bundle`
Expected: all pass; `Bundle OK: no edit-mode code in dist/.`

```bash
git add src/lib/filters.ts src/lib/filters.test.ts src/features/map/MapPage.tsx src/features/executes/ExecuteView.tsx src/app/editMode.tsx src/app/AppRoutes.tsx src/features/edit/Edit.module.css src/features/edit/executeDraft.ts src/features/edit/executeDraft.test.ts src/features/edit/ExecuteFormPage.tsx src/features/edit/ExecuteFormPage.test.tsx src/features/edit/ExecuteActions.tsx src/features/edit/ExecuteActions.test.tsx
git commit -m "feat: add the dev-only execute editor and execute actions"
```

---

### Task 14: Docs and final checks

Spec §9 (Manual) and §10.

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-10-10-cs2-smoke-lineups-design.md` (§11)

- [ ] **Step 1: Update the README**

In the Commands table of `README.md`, add two rows after `npm run validate`:

```md
| `npm run format-data` | Rewrite the data files in the canonical layout |
| `npm run check-bundle` | Fail if edit-mode code is in `dist/` (CI runs it after the build) |
```

Replace the whole `## Data` section (up to `## Studying`) with:

```md
## Data

Each map has one file in `data/maps/` (`ancient`, `anubis`, `cache`, `dust2`, `inferno`,
`mirage`, `nuke`). The fields and rules are in the design spec (§6).

### Edit mode

Run `npm run dev` and open the local site. Edit mode only exists there; the published site
stays read-only.

- **Add a smoke:** on a map, choose **+ Add smoke**, paste the video link, use **Set start** and
  **Set end** while the video plays, fill in the fields, click the radar for the land spot and
  then the stand spot, and **Save**.
- **Review a smoke:** open it, check the clip and the spots, fix anything with **Edit**, then
  choose **Mark reviewed**. It is set to `ok`, dated today, and the next unreviewed smoke in the
  list opens.
- **Delete** asks first and also removes the smoke from executes.
- **Executes:** **+ Add execute** on the Executes tab; **Edit** and **Delete** on an execute.

Every save is checked like `npm run validate` and written in one canonical layout, so `git diff`
shows only what changed. Publish with `git commit` and `git push`.

### Editing by hand

You can still edit a file directly. Afterwards run `npm run format-data`, `npm run validate`,
`npm run check-videos` and `npm run preview-markers -- <mapId>`.

The starter smokes were added by following [docs/seeding.md](docs/seeding.md). They start as
`"status": "unreviewed"`; mark one reviewed (`"ok"`) once you have checked it in game, or set
`"broken"` if a map update broke it.
```

- [ ] **Step 2: Link the Phase 2 spec from the parent spec**

In `docs/superpowers/specs/2026-10-10-cs2-smoke-lineups-design.md`, in §11, replace the last bullet (`- This phase gets its own detailed design before it starts.`) with:

```md
- Designed in detail in
  [2026-10-10-cs2-smoke-lineups-phase2-edit-mode-design.md](2026-10-10-cs2-smoke-lineups-phase2-edit-mode-design.md).
```

- [ ] **Step 3: Run the full check**

Run: `npm run format && npm run lint && npm run validate && npx vitest run && npm run build && npm run check-bundle`
Expected: lint clean; `Data OK: 7 map files, 80 smokes.`; all tests pass; build succeeds; `Bundle OK: no edit-mode code in dist/.`

- [ ] **Step 4: Check the endpoint on the real dev server once more**

Start `npm run dev -- --port 5199 --strictPort` in the background, run `node tmp/put-unchanged.mjs` (from Task 4; recreate it from Task 4 Step 8 if `tmp/` was cleaned), and expect `same file: 200` and `foreign origin: 403`. `git status --short data/maps` must print nothing. Stop the dev server.

- [ ] **Step 5: Commit**

```bash
git add README.md docs/superpowers/specs/2026-10-10-cs2-smoke-lineups-design.md
git commit -m "docs: explain edit mode in the README and link the Phase 2 spec"
```

- [ ] **Step 6: Hand over the manual checks to the user**

These need a person at a browser; list them in the final report instead of claiming them:

1. `npm run dev`, open a map, **+ Add smoke** with a real YouTube link, and time it (spec criterion 1: about a minute).
2. On a seeded smoke, **Mark reviewed**: the next unreviewed smoke opens with no page reload (the browser console shows no `[vite] page reload`), spec criterion 2.
3. `git diff` shows only the added smoke and the reviewed smoke's two changed lines; `npm run validate` and `npm run lint` pass (criterion 3). Discard or keep these test edits as the user prefers.
4. `npm run build && npm run preview`: no **+ Add smoke**, **Mark reviewed** or **Edit** anywhere (criterion 4).

Do not push or merge. Report the branch, the commits and the manual checklist, and let the user decide.
