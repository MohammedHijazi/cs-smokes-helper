# CS2 Smoke Lineups — Phase 1 (Website) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and publish the read-only website for learning CS2 smoke lineups — radar browser, looping YouTube clips, executes, spaced-repetition study and settings — seeded with 10–15 smokes for each of the seven Active Duty maps.

**Architecture:** A static React + TypeScript site built with Vite. Lineup data lives in `data/maps/<mapId>.json`, is checked by shared Zod schemas, and is bundled at build time. Routing is hash-based; study progress lives in `localStorage`. GitHub Actions lints, validates, tests, builds and deploys to static hosting.

**Tech Stack:** Node ≥ 22, TypeScript 5.9, React 19, React Router 7 (declarative mode), Zod 4, Vite 7, Vitest 3 + React Testing Library + jsdom, ESLint 9 + typescript-eslint 8, Prettier 3, tsx 4, sharp 0.34 (scripts only). One-time tools: Source 2 Viewer CLI (radar export), yt-dlp (seeding research).

**Spec:** `docs/superpowers/specs/2026-10-10-cs2-smoke-lineups-design.md` — read it before starting any task.

## Global Constraints

- Maps, in this order everywhere: `ancient` Ancient, `anubis` Anubis, `cache` Cache, `dust2` Dust II, `inferno` Inferno, `mirage` Mirage, `nuke` Nuke.
- Smokes only. No other grenade types, no in-game coordinates (`setpos`), no accounts, no analytics, no service worker, no offline mode.
- Data files: `data/maps/<mapId>.json`; all seven must exist; arrays may be empty; array order is display order and the order new smokes are introduced in study.
- Lineup and execute ids: kebab-case, start with `<mapId>-`, unique across all maps (one shared id space), never change after creation. New ids are `<mapId>-<slug(name)>-from-<slug(from)>`, with `-2`, `-3`, … on collision.
- `name` and `from`: 1–40 chars. `notes`: at most 280 chars. `checkedOn`: `YYYY-MM-DD`.
- Positions: `x`, `y` are fractions 0–1 of the radar image from its top-left corner. `level` (`upper` | `lower`) is required on Nuke and not allowed on any other map.
- Video: `video.url` is an absolute `https` URL. `start`/`end` (integer seconds) only on YouTube URLs; `end` must be greater than the effective start (`start`, else the URL's `t`, else 0).
- Routes (hash-based): `#/`, `#/maps/:mapId`, `#/maps/:mapId/smokes/:lineupId`, `#/maps/:mapId/executes/:executeId`, `#/study`, `#/settings`; anything else → Not found. Map filters live in the query string (`?side=T&area=A&level=upper`) and carry over to smoke-card routes.
- Layout breakpoint: below 900 px one column (phone); from 900 px two columns, radar left (about 60%).
- Dark theme only. T is amber, CT is blue.
- Radar tap hit area at least 32 px; study "where you stand" ✓ threshold is 0.06 (fraction of radar width).
- Study boxes: intervals 1, 2, 4, 8, 16 days; known = box ≥ 4; `newPerDay` default 10, allowed 1–30; a card's schedule changes at most once per day.
- `localStorage` key `cs-smokes:progress:v1`; corrupt-data backup key `cs-smokes:progress:backup:<timestamp>`; export file name `cs-smokes-progress-YYYY-MM-DD.json`.
- Video player: YouTube IFrame Player API on host `https://www.youtube-nocookie.com`, `playsinline=1`, `rel=0`, autoplays muted; speeds 0.5× and 1×.
- Footer text, exactly: `Counter-Strike 2, map names and radar images © Valve Corporation. Videos © their creators. Not affiliated with Valve.`
- Radar images: square 1024×1024 WebP in `public/radars/` (`<mapId>.webp`, plus `nuke-lower.webp`).
- Vite `base: './'`. CI order: `npm ci` → lint → validate → test → build → deploy; any failure stops the deploy. CI uses the current Node LTS.
- Pinned majors (newer majors exist; this plan is written against these APIs; upgrades are a separate task): `vite@^7`, `@vitejs/plugin-react@^5`, `vitest@^3`, `react-router@^7`, `typescript@~5.9`, `eslint@^9`, `zod@^4`.
- Never push, publish or install global tools without the user's go-ahead in the current session (Tasks 6, 7 and 13 say exactly where to ask).

## Review Focus

1. **Pasted YouTube share links** (`youtu.be/ID?si=…`, `watch?v=ID&list=…&index=3&t=95s`) must yield the right id and start time, not be rejected. Test lives in Task 3.
2. **A clip whose `end` is past the real end of the video** (or a video shorter than expected) must loop back to `start` when the video ends, not stop on a black frame. Test lives in Task 10.
3. **Opening a link to a smoke that the current filters exclude** (`#/maps/mirage/smokes/<T smoke>?side=CT`) must still show the card, with ‹ › disabled rather than jumping somewhere odd. Test lives in Task 12.
4. **Browser storage that throws on write** (Safari private mode, quota exceeded) must not break studying; the "Progress can't be saved in this browser" banner must appear. Test lives in Task 22.
5. **Studying across midnight, month end, year end and DST changes** must schedule on local calendar days (a review at 00:30 counts for the new day). Test lives in Task 21.

---

## File Map

| Path | Responsibility | Task |
|---|---|---|
| `package.json`, `tsconfig.json`, `vite.config.ts`, `eslint.config.js`, `.prettierrc.json`, `.prettierignore`, `.gitignore`, `.gitattributes`, `index.html`, `src/main.tsx`, `src/styles/global.css`, `src/test/setup.ts`, `README.md` | Tooling, entry point, theme tokens | 1 (README finished in 13; `main.tsx` replaced in 8, 22) |
| `src/data/schema.ts` | Zod schemas, enums and types for map files | 2 |
| `src/data/maps.ts` | Map registry (ids, names, radar paths, levels) | 2 |
| `src/lib/assets.ts` | Resolve public asset URLs against Vite's base | 2 |
| `src/test/fixtures.ts` | `makeLineup` / `makeExecute` / `makeMapFile` test builders | 2 |
| `src/lib/random.ts` | Injectable-RNG shuffle | 3 |
| `src/lib/youtube.ts` | YouTube URL and `t` parsing, effective start, watch URL | 3 |
| `src/lib/technique.ts` | Technique text and study distractors | 3 |
| `src/data/validate.ts` | Cross-file data validation, error formatting | 4 |
| `src/data/api.ts`, `src/data/index.ts` | Data access API; bundled JSON | 4 |
| `data/maps/*.json` | The lineup data (seven files) | 4 (seeded in 7, 14–19, 20) |
| `scripts/load-data.ts`, `scripts/validate-data.ts` | `npm run validate` | 4 |
| `src/test/fixtureData.ts` | Stable fixture data + data-module mock for page tests | 4 |
| `scripts/videos.ts`, `scripts/check-videos.ts` | `npm run check-videos` (oEmbed) | 5 |
| `scripts/make-radars.ts`, `scripts/make-icons.ts`, `scripts/preview-svg.ts`, `scripts/preview-markers.ts`, `public/radars/*`, `public/icons/*`, `public/manifest.webmanifest` | Radar images, icons, manifest, marker preview tool | 6 |
| `docs/seeding.md` | The seeding procedure every seeding task follows | 7 |
| `src/app/AppRoutes.tsx`, `src/app/Layout.tsx`, `src/app/NotFound.tsx`, `src/test/render.tsx`, `src/features/home/*` | Routes, shell, not-found, home | 8 (extended in 12, 20, 22–24) |
| `src/lib/radar.ts`, `src/lib/filters.ts`, `src/features/map/Radar.tsx`, `src/features/map/markers.tsx` | Radar math, filters, radar + marker components | 9 |
| `src/features/smoke/youtubeApi.ts`, `src/features/smoke/VideoPlayer.tsx` | YouTube clip player | 10 |
| `src/features/smoke/StatusBadge.tsx`, `src/features/smoke/SmokeCard.tsx` | Smoke card | 11 |
| `src/features/map/FiltersBar.tsx`, `src/features/map/LineupList.tsx`, `src/features/map/MapPage.tsx` | Map view | 12 (extended in 20) |
| `.github/workflows/deploy.yml` | CI and deploy | 13 |
| `src/features/executes/*` | Executes tab and execute view | 20 |
| `src/lib/dates.ts`, `src/lib/scheduler.ts` | Local dates, box scheduling, queue, counts | 21 |
| `src/lib/storage.ts`, `src/app/progress.tsx` | Progress persistence and React provider | 22 |
| `src/features/settings/*` | Settings page | 23 |
| `src/features/study/*` | Study session logic and UI | 24 |

Tests sit next to the code they test (`foo.ts` → `foo.test.ts`).

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `eslint.config.js`, `.prettierrc.json`, `.prettierignore`, `.gitignore`, `.gitattributes`, `index.html`, `src/main.tsx`, `src/styles/global.css`, `src/test/setup.ts`, `README.md`

**Interfaces:**
- Consumes: nothing.
- Produces: npm scripts `dev`, `build`, `preview`, `test`, `test:watch`, `lint`, `format`; Vitest config (jsdom, setup file `src/test/setup.ts`, test globs `src/**/*.test.{ts,tsx}` and `scripts/**/*.test.ts`); CSS variables `--bg`, `--surface`, `--surface-2`, `--border`, `--text`, `--text-muted`, `--accent`, `--t-color`, `--ct-color`, `--ok`, `--bad`, `--warn`, `--radius`, `--gap`.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "cs-smokes-helper",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "engines": {
    "node": ">=22"
  },
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint . && prettier --check .",
    "format": "prettier --write ."
  }
}
```

- [ ] **Step 2: Install dependencies**

Run:

```bash
npm install react@^19 react-dom@^19 react-router@^7 zod@^4
npm install -D vite@^7 @vitejs/plugin-react@^5 typescript@~5.9 @types/react@^19 @types/react-dom@^19 @types/node@^24 vitest@^3 jsdom@^26 @testing-library/react@^16 @testing-library/dom@^10 @testing-library/jest-dom@^6 @testing-library/user-event@^14 eslint@^9 @eslint/js@^9 typescript-eslint@^8 eslint-plugin-react-hooks@^5 globals@^16 prettier@^3 tsx@^4
```

Expected: both commands finish without `ERR!`; `package.json` now has `dependencies` and `devDependencies`; `package-lock.json` exists.

- [ ] **Step 3: Create the config files**

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "skipLibCheck": true,
    "types": ["vite/client", "node"]
  },
  "include": ["src", "scripts", "vite.config.ts"]
}
```

`vite.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.ts"],
  },
});
```

`eslint.config.js`:

```js
import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "node_modules", "coverage", "tmp"] },
  {
    files: ["**/*.{ts,tsx}"],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
);
```

`.prettierrc.json`:

```json
{
  "printWidth": 100
}
```

`.prettierignore`:

```
dist
node_modules
coverage
tmp
docs
public/radars
public/icons
package-lock.json
```

`.gitignore`:

```
node_modules
dist
coverage
tmp
*.local
.DS_Store
```

`.gitattributes`:

```
* text=auto eol=lf
*.png binary
*.webp binary
```

- [ ] **Step 4: Create the entry point, theme, test setup and README**

`index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#0f1115" />
    <title>CS Smokes</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`src/main.tsx` (replaced in Task 8):

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/global.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <p>CS Smokes</p>
  </StrictMode>,
);
```

`src/styles/global.css`:

```css
:root {
  color-scheme: dark;
  --bg: #0f1115;
  --surface: #181b22;
  --surface-2: #222631;
  --border: #2e3340;
  --text: #e8eaf0;
  --text-muted: #9aa1b2;
  --accent: #7cc4ff;
  --t-color: #f2a93b;
  --ct-color: #5b9dff;
  --ok: #4cc38a;
  --bad: #ff6b6b;
  --warn: #f5c451;
  --radius: 10px;
  --gap: 12px;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  line-height: 1.45;
}

* {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
}

body {
  min-height: 100dvh;
}

a {
  color: var(--accent);
}

button {
  font: inherit;
  color: inherit;
  cursor: pointer;
}

button:disabled {
  cursor: default;
  opacity: 0.5;
}

img {
  max-width: 100%;
  display: block;
}

h1,
h2,
h3 {
  line-height: 1.2;
  margin: 0;
}

:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
```

`src/test/setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
});
```

`README.md` (finished in Task 13):

```markdown
# CS Smokes Helper

A personal website for learning Counter-Strike 2 smoke lineups away from the game.

## Commands

| Command         | What it does                               |
| --------------- | ------------------------------------------ |
| `npm run dev`   | Start the local dev server                 |
| `npm test`      | Run the tests once                         |
| `npm run lint`  | ESLint and the Prettier check              |
| `npm run build` | Type-check and build the site into `dist/` |

Design: `docs/superpowers/specs/2026-10-10-cs2-smoke-lineups-design.md`
```

- [ ] **Step 5: Verify the toolchain**

Run: `npm run format && npm run lint && npx vitest run --passWithNoTests && npm run build`

Expected: Prettier rewrites nothing important; ESLint and `prettier --check` pass; Vitest prints `No test files found, exiting with code 0`; the build ends with `✓ built in …` and creates `dist/index.html`.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: scaffold Vite + React + TypeScript project"
```

---

### Task 2: Data schema and map registry

**Files:**
- Create: `src/data/schema.ts`, `src/data/maps.ts`, `src/lib/assets.ts`, `src/test/fixtures.ts`
- Test: `src/data/schema.test.ts`, `src/data/maps.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `schema.ts`: `MAP_IDS` (readonly tuple), `type MapId`; `SIDES`, `type Side` (`"T" | "CT"`); `AREAS`, `type Area` (`"A" | "B" | "Mid" | "Other"`); `MOVEMENTS`; `CLICKS`; `STATUSES`, `type Status`; `LEVELS`, `type Level`; `isRealDate(value: string): boolean`; `idSchema`; `dateSchema`; `positionSchema`; `throwSchema`; `videoSchema`; `lineupSchema`; `executeSchema`; `mapFileSchema`; types `Position`, `Throw`, `Video`, `Lineup`, `Execute`, `MapFile` (via `z.infer`).
  - `maps.ts`: `interface MapInfo { id: MapId; name: string; radar: string; lowerRadar?: string }`; `MAPS: readonly MapInfo[]`; `getMapInfo(id: string): MapInfo | undefined`; `hasLevels(map: MapInfo): boolean`; `radarPath(map: MapInfo, level?: Level): string`.
  - `assets.ts`: `assetUrl(path: string): string`.
  - `fixtures.ts`: `makeLineup(overrides?: Partial<Lineup>): Lineup`; `makeExecute(overrides?: Partial<Execute>): Execute`; `makeMapFile(map: MapId, lineups?: Lineup[], executes?: Execute[]): MapFile`.

- [ ] **Step 1: Write the test builders**

`src/test/fixtures.ts`:

```ts
import type { Execute, Lineup, MapFile, MapId } from "../data/schema";

export function makeLineup(overrides: Partial<Lineup> = {}): Lineup {
  return {
    id: "mirage-window-from-t-spawn",
    name: "Window",
    from: "T Spawn",
    side: "T",
    area: "Mid",
    throw: { movement: "stand", jump: true, click: "left" },
    stand: { x: 0.81, y: 0.62 },
    land: { x: 0.44, y: 0.47 },
    video: { url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", start: 95, end: 112 },
    notes: "Aim at the top-left corner of the antenna",
    status: "unreviewed",
    checkedOn: "2026-10-10",
    ...overrides,
  };
}

export function makeExecute(overrides: Partial<Execute> = {}): Execute {
  return {
    id: "mirage-a-execute",
    name: "A execute",
    side: "T",
    lineupIds: ["mirage-ct-from-t-ramp", "mirage-jungle-from-t-ramp"],
    ...overrides,
  };
}

export function makeMapFile(map: MapId, lineups: Lineup[] = [], executes: Execute[] = []): MapFile {
  return { map, lineups, executes };
}
```

- [ ] **Step 2: Write the failing schema tests**

`src/data/schema.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { makeExecute, makeLineup } from "../test/fixtures";
import { executeSchema, isRealDate, lineupSchema, mapFileSchema } from "./schema";

const pathsOf = (result: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }) =>
  result.error?.issues.map((issue) => issue.path.map(String).join(".")) ?? [];

describe("isRealDate", () => {
  it.each([
    ["2026-10-10", true],
    ["2024-02-29", true],
    ["2026-02-30", false],
    ["2026-2-3", false],
    ["abcd", false],
  ])("%s → %s", (value, expected) => {
    expect(isRealDate(value)).toBe(expected);
  });
});

describe("lineupSchema", () => {
  it("accepts a complete lineup", () => {
    expect(lineupSchema.safeParse(makeLineup()).success).toBe(true);
  });

  it("accepts a lineup without notes, start or end", () => {
    const { notes: _notes, ...rest } = makeLineup();
    const lineup = { ...rest, video: { url: "https://youtu.be/dQw4w9WgXcQ" } };
    expect(lineupSchema.safeParse(lineup).success).toBe(true);
  });

  it.each([
    ["an id that is not kebab-case", { id: "Mirage_Window" }, "id"],
    ["an empty name", { name: "" }, "name"],
    ["a name with a leading space", { name: " Window" }, "name"],
    ["a name over 40 characters", { name: "x".repeat(41) }, "name"],
    ["an unknown side", { side: "TT" }, "side"],
    ["an unknown area", { area: "C" }, "area"],
    ["x above 1", { stand: { x: 1.2, y: 0.5 } }, "stand.x"],
    ["y below 0", { land: { x: 0.5, y: -0.1 } }, "land.y"],
    ["an unknown level", { land: { x: 0.5, y: 0.5, level: "middle" } }, "land.level"],
    ["an http video URL", { video: { url: "http://youtu.be/dQw4w9WgXcQ" } }, "video.url"],
    ["a video URL that is not a URL", { video: { url: "not a url" } }, "video.url"],
    ["a negative start", { video: { url: "https://youtu.be/dQw4w9WgXcQ", start: -1 } }, "video.start"],
    ["a fractional end", { video: { url: "https://youtu.be/dQw4w9WgXcQ", end: 10.5 } }, "video.end"],
    ["notes over 280 characters", { notes: "x".repeat(281) }, "notes"],
    ["an unknown status", { status: "done" }, "status"],
    ["an impossible date", { checkedOn: "2026-02-30" }, "checkedOn"],
  ])("rejects %s", (_label, override, path) => {
    const result = lineupSchema.safeParse({ ...makeLineup(), ...override });
    expect(result.success).toBe(false);
    expect(pathsOf(result)).toContain(path);
  });

  it("rejects unknown fields", () => {
    expect(lineupSchema.safeParse({ ...makeLineup(), extra: 1 }).success).toBe(false);
  });
});

describe("executeSchema", () => {
  it("accepts a valid execute", () => {
    expect(executeSchema.safeParse(makeExecute()).success).toBe(true);
  });

  it("rejects fewer than 2 or more than 8 smokes", () => {
    expect(executeSchema.safeParse(makeExecute({ lineupIds: ["mirage-a"] })).success).toBe(false);
    const nine = Array.from({ length: 9 }, (_, i) => `mirage-smoke-${i}`);
    expect(executeSchema.safeParse(makeExecute({ lineupIds: nine })).success).toBe(false);
  });
});

describe("mapFileSchema", () => {
  it("accepts an empty map file", () => {
    expect(mapFileSchema.safeParse({ map: "nuke", lineups: [], executes: [] }).success).toBe(true);
  });

  it("rejects a map outside the pool", () => {
    expect(mapFileSchema.safeParse({ map: "overpass", lineups: [], executes: [] }).success).toBe(
      false,
    );
  });
});
```

- [ ] **Step 3: Run the tests to see them fail**

Run: `npx vitest run src/data/schema.test.ts`
Expected: FAIL — `Failed to resolve import "./schema"`.

- [ ] **Step 4: Implement `src/data/schema.ts`**

```ts
import { z } from "zod";

export const MAP_IDS = ["ancient", "anubis", "cache", "dust2", "inferno", "mirage", "nuke"] as const;
export type MapId = (typeof MAP_IDS)[number];

export const SIDES = ["T", "CT"] as const;
export type Side = (typeof SIDES)[number];

export const AREAS = ["A", "B", "Mid", "Other"] as const;
export type Area = (typeof AREAS)[number];

export const MOVEMENTS = ["stand", "crouch", "walk", "run"] as const;
export const CLICKS = ["left", "right", "both"] as const;

export const STATUSES = ["unreviewed", "ok", "broken"] as const;
export type Status = (typeof STATUSES)[number];

export const LEVELS = ["upper", "lower"] as const;
export type Level = (typeof LEVELS)[number];

const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const TRIMMED = /^\S(.*\S)?$/;

export function isRealDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export const idSchema = z.string().regex(KEBAB, "must be kebab-case (a-z, 0-9 and hyphens)");
export const dateSchema = z.string().refine(isRealDate, "must be a real date written YYYY-MM-DD");

const labelSchema = z
  .string()
  .max(40, "must be at most 40 characters")
  .regex(TRIMMED, "must not be empty or start or end with a space");
const notesSchema = z.string().max(280, "must be at most 280 characters");

export const positionSchema = z.strictObject({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  level: z.enum(LEVELS).optional(),
});

export const throwSchema = z.strictObject({
  movement: z.enum(MOVEMENTS),
  jump: z.boolean(),
  click: z.enum(CLICKS),
});

export const videoSchema = z.strictObject({
  url: z.string().refine(isHttpsUrl, "must be an absolute https URL"),
  start: z.number().int().min(0).optional(),
  end: z.number().int().min(1).optional(),
});

export const lineupSchema = z.strictObject({
  id: idSchema,
  name: labelSchema,
  from: labelSchema,
  side: z.enum(SIDES),
  area: z.enum(AREAS),
  throw: throwSchema,
  stand: positionSchema,
  land: positionSchema,
  video: videoSchema,
  notes: notesSchema.optional(),
  status: z.enum(STATUSES),
  checkedOn: dateSchema,
});

export const executeSchema = z.strictObject({
  id: idSchema,
  name: labelSchema,
  side: z.enum(SIDES),
  lineupIds: z
    .array(idSchema)
    .min(2, "needs at least 2 smokes")
    .max(8, "allows at most 8 smokes"),
  notes: notesSchema.optional(),
});

export const mapFileSchema = z.strictObject({
  map: z.enum(MAP_IDS),
  lineups: z.array(lineupSchema),
  executes: z.array(executeSchema),
});

export type Position = z.infer<typeof positionSchema>;
export type Throw = z.infer<typeof throwSchema>;
export type Video = z.infer<typeof videoSchema>;
export type Lineup = z.infer<typeof lineupSchema>;
export type Execute = z.infer<typeof executeSchema>;
export type MapFile = z.infer<typeof mapFileSchema>;
```

- [ ] **Step 5: Run the schema tests to see them pass**

Run: `npx vitest run src/data/schema.test.ts`
Expected: PASS (all tests green).

- [ ] **Step 6: Write the failing map-registry tests**

`src/data/maps.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { MAPS, getMapInfo, hasLevels, radarPath } from "./maps";
import { MAP_IDS } from "./schema";

describe("map registry", () => {
  it("lists the seven maps in id order with their display names", () => {
    expect(MAPS.map((m) => m.id)).toEqual([...MAP_IDS]);
    expect(MAPS.map((m) => m.name)).toEqual([
      "Ancient",
      "Anubis",
      "Cache",
      "Dust II",
      "Inferno",
      "Mirage",
      "Nuke",
    ]);
  });

  it("gives only Nuke two levels", () => {
    expect(MAPS.filter(hasLevels).map((m) => m.id)).toEqual(["nuke"]);
  });

  it("picks the lower radar only where one exists", () => {
    const nuke = getMapInfo("nuke")!;
    const mirage = getMapInfo("mirage")!;
    expect(radarPath(nuke, "lower")).toBe("radars/nuke-lower.webp");
    expect(radarPath(nuke)).toBe("radars/nuke.webp");
    expect(radarPath(mirage, "lower")).toBe("radars/mirage.webp");
  });

  it("returns undefined for maps outside the pool", () => {
    expect(getMapInfo("overpass")).toBeUndefined();
  });
});
```

- [ ] **Step 7: Run them to see them fail**

Run: `npx vitest run src/data/maps.test.ts`
Expected: FAIL — `Failed to resolve import "./maps"`.

- [ ] **Step 8: Implement `src/data/maps.ts` and `src/lib/assets.ts`**

`src/data/maps.ts`:

```ts
import type { Level, MapId } from "./schema";

export interface MapInfo {
  id: MapId;
  name: string;
  /** Path under public/, e.g. "radars/mirage.webp". */
  radar: string;
  /** Only maps with two levels (Nuke). */
  lowerRadar?: string;
}

export const MAPS: readonly MapInfo[] = [
  { id: "ancient", name: "Ancient", radar: "radars/ancient.webp" },
  { id: "anubis", name: "Anubis", radar: "radars/anubis.webp" },
  { id: "cache", name: "Cache", radar: "radars/cache.webp" },
  { id: "dust2", name: "Dust II", radar: "radars/dust2.webp" },
  { id: "inferno", name: "Inferno", radar: "radars/inferno.webp" },
  { id: "mirage", name: "Mirage", radar: "radars/mirage.webp" },
  { id: "nuke", name: "Nuke", radar: "radars/nuke.webp", lowerRadar: "radars/nuke-lower.webp" },
];

export function getMapInfo(id: string): MapInfo | undefined {
  return MAPS.find((map) => map.id === id);
}

export function hasLevels(map: MapInfo): boolean {
  return map.lowerRadar !== undefined;
}

export function radarPath(map: MapInfo, level: Level = "upper"): string {
  return level === "lower" && map.lowerRadar ? map.lowerRadar : map.radar;
}
```

`src/lib/assets.ts` (kept apart from `maps.ts` so Node scripts can import the registry without `import.meta.env`):

```ts
/** Resolves a path under public/ against Vite's base ("./" in production). */
export function assetUrl(path: string): string {
  return `${import.meta.env.BASE_URL}${path}`;
}
```

- [ ] **Step 9: Run the tests to see them pass**

Run: `npx vitest run src/data`
Expected: PASS.

- [ ] **Step 10: Lint and commit**

Run: `npm run format && npm run lint`
Expected: no errors.

```bash
git add src/data src/lib/assets.ts src/test/fixtures.ts
git commit -m "feat: add data schema and map registry"
```

---

### Task 3: YouTube links, technique text and shuffling

**Files:**
- Create: `src/lib/random.ts`, `src/lib/youtube.ts`, `src/lib/technique.ts`, `src/test/rng.ts`
- Test: `src/lib/random.test.ts`, `src/lib/youtube.test.ts`, `src/lib/technique.test.ts`

**Interfaces:**
- Consumes: `Video`, `Throw` types from `src/data/schema.ts` (Task 2).
- Produces:
  - `random.ts`: `type Rng = () => number`; `shuffle<T>(items: readonly T[], rng?: Rng): T[]` (Fisher–Yates, returns a new array).
  - `youtube.ts`: `interface YouTubeRef { id: string; t?: number }`; `parseTimeParam(value: string): number | null`; `parseYouTubeUrl(url: string): YouTubeRef | null`; `effectiveStart(video: Pick<Video, "url" | "start">): number`; `watchUrl(id: string, start?: number): string`.
  - `technique.ts`: `techniqueText(t: Throw): string`; `COMMON_TECHNIQUES: readonly string[]`; `techniqueChoices(correct: string, sameMap: readonly string[], rng?: Rng): string[]` (4 shuffled options).
  - `src/test/rng.ts`: `sequenceRng(...values: number[]): () => number` (test helper that cycles through `values`).

- [ ] **Step 1: Write the test helper and the failing tests**

`src/test/rng.ts`:

```ts
/** A deterministic random-number generator for tests: cycles through `values`. */
export function sequenceRng(...values: number[]): () => number {
  let index = 0;
  return () => values[index++ % values.length];
}
```

`src/lib/random.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { sequenceRng } from "../test/rng";
import { shuffle } from "./random";

describe("shuffle", () => {
  it("keeps every element and leaves the input alone", () => {
    const input = [1, 2, 3, 4, 5];
    const output = shuffle(input, sequenceRng(0.3, 0.9, 0.1, 0.6));
    expect([...output].sort()).toEqual([1, 2, 3, 4, 5]);
    expect(input).toEqual([1, 2, 3, 4, 5]);
  });

  it("is a Fisher–Yates shuffle driven by the generator", () => {
    expect(shuffle([1, 2, 3, 4, 5], () => 0)).toEqual([2, 3, 4, 5, 1]);
    expect(shuffle([1, 2, 3, 4, 5], () => 0.999)).toEqual([1, 2, 3, 4, 5]);
  });

  it("handles an empty list", () => {
    expect(shuffle([])).toEqual([]);
  });
});
```

`src/lib/youtube.test.ts` (the share-link rows cover Review Focus 1):

```ts
import { describe, expect, it } from "vitest";
import { effectiveStart, parseTimeParam, parseYouTubeUrl, watchUrl } from "./youtube";

const ID = "dQw4w9WgXcQ";

describe("parseYouTubeUrl", () => {
  it.each([
    [`https://www.youtube.com/watch?v=${ID}`, { id: ID }],
    [`https://youtube.com/watch?v=${ID}&t=95`, { id: ID, t: 95 }],
    [`https://m.youtube.com/watch?v=${ID}&t=1m35s`, { id: ID, t: 95 }],
    [`https://youtu.be/${ID}?t=95s`, { id: ID, t: 95 }],
    [`https://youtu.be/${ID}?si=AbCdEfGh12345`, { id: ID }],
    [
      `https://www.youtube.com/watch?v=${ID}&list=PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPboYG&index=3&t=95s`,
      { id: ID, t: 95 },
    ],
    [`https://www.youtube.com/shorts/${ID}`, { id: ID }],
    [`https://www.youtube.com/embed/${ID}?start=30`, { id: ID, t: 30 }],
    [`https://www.youtube.com/watch?v=${ID}&t=1h2m3s`, { id: ID, t: 3723 }],
  ])("parses %s", (url, expected) => {
    expect(parseYouTubeUrl(url)).toEqual(expected);
  });

  it.each([
    "https://csnades.gg/mirage/smokes/window",
    "not a url",
    "https://www.youtube.com/watch",
    "https://www.youtube.com/watch?v=short",
    "https://www.youtube.com/channel/UC1234567890",
    `https://evil.example/watch?v=${ID}`,
  ])("rejects %s", (url) => {
    expect(parseYouTubeUrl(url)).toBeNull();
  });

  it("ignores an unreadable t value", () => {
    expect(parseYouTubeUrl(`https://youtu.be/${ID}?t=abc`)).toEqual({ id: ID });
  });
});

describe("parseTimeParam", () => {
  it.each([
    ["95", 95],
    ["95s", 95],
    ["1m35s", 95],
    ["2m", 120],
    ["1h2m3s", 3723],
    ["", null],
    ["abc", null],
    ["-5", null],
  ])("%s → %s", (value, expected) => {
    expect(parseTimeParam(value)).toBe(expected);
  });
});

describe("effectiveStart", () => {
  it("prefers video.start", () => {
    expect(effectiveStart({ url: `https://youtu.be/${ID}?t=50`, start: 10 })).toBe(10);
  });
  it("falls back to the URL's t", () => {
    expect(effectiveStart({ url: `https://youtu.be/${ID}?t=50` })).toBe(50);
  });
  it("falls back to 0", () => {
    expect(effectiveStart({ url: `https://youtu.be/${ID}` })).toBe(0);
  });
  it("is 0 for other sites", () => {
    expect(effectiveStart({ url: "https://csnades.gg/mirage/smokes/window" })).toBe(0);
  });
});

describe("watchUrl", () => {
  it("adds the start time only when there is one", () => {
    expect(watchUrl(ID, 95)).toBe(`https://www.youtube.com/watch?v=${ID}&t=95s`);
    expect(watchUrl(ID)).toBe(`https://www.youtube.com/watch?v=${ID}`);
    expect(watchUrl(ID, 0)).toBe(`https://www.youtube.com/watch?v=${ID}`);
  });
});
```

`src/lib/technique.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { sequenceRng } from "../test/rng";
import { COMMON_TECHNIQUES, techniqueChoices, techniqueText } from "./technique";

describe("techniqueText", () => {
  it.each([
    [{ movement: "stand", jump: true, click: "left" }, "Jump throw · left click"],
    [{ movement: "run", jump: true, click: "left" }, "Run + jump throw · left click"],
    [{ movement: "stand", jump: false, click: "right" }, "Standing throw · right click"],
    [{ movement: "crouch", jump: false, click: "left" }, "Crouch + throw · left click"],
    [{ movement: "walk", jump: false, click: "both" }, "Walk + throw · left + right click"],
  ] as const)("%o → %s", (throwSpec, text) => {
    expect(techniqueText(throwSpec)).toBe(text);
  });
});

describe("techniqueChoices", () => {
  const correct = "Jump throw · left click";

  it("returns the correct answer plus three different distractors", () => {
    const choices = techniqueChoices(correct, [], sequenceRng(0.42));
    expect(choices).toHaveLength(4);
    expect(choices).toContain(correct);
    expect(new Set(choices).size).toBe(4);
  });

  it("uses techniques from the same map first", () => {
    const sameMap = [
      "Run + jump throw · left click",
      "Walk + throw · left click",
      "Crouch + throw · right click",
      correct,
    ];
    const choices = techniqueChoices(correct, sameMap, sequenceRng(0.42));
    expect([...choices].sort()).toEqual([correct, ...sameMap.slice(0, 3)].sort());
  });

  it("fills up from the common list when the map has too few", () => {
    const rare = "Crouch + throw · right click";
    const choices = techniqueChoices(correct, [rare, rare], sequenceRng(0.42));
    expect(choices).toHaveLength(4);
    expect(new Set(choices).size).toBe(4);
    expect(choices).toContain(rare);
    for (const choice of choices) {
      if (choice !== correct && choice !== rare) expect(COMMON_TECHNIQUES).toContain(choice);
    }
  });
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run src/lib`
Expected: FAIL — `Failed to resolve import "./random"` (and `./youtube`, `./technique`).

- [ ] **Step 3: Implement the three modules**

`src/lib/random.ts`:

```ts
export type Rng = () => number;

/** Fisher–Yates shuffle. Returns a new array; the input is not changed. */
export function shuffle<T>(items: readonly T[], rng: Rng = Math.random): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
```

`src/lib/youtube.ts`:

```ts
import type { Video } from "../data/schema";

export interface YouTubeRef {
  id: string;
  /** Start time from the URL's `t` or `start` parameter, in seconds. */
  t?: number;
}

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "youtu.be",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
]);

/** Parses "95", "95s", "1m35s" or "1h2m3s" into seconds. */
export function parseTimeParam(value: string): number | null {
  const text = value.trim();
  if (/^\d+s?$/.test(text)) return Number.parseInt(text, 10);
  const match = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(text);
  if (!match || text === "") return null;
  const [, hours = "0", minutes = "0", seconds = "0"] = match;
  return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
}

export function parseYouTubeUrl(url: string): YouTubeRef | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const host = parsed.hostname.toLowerCase();
  if (!HOSTS.has(host)) return null;

  const segments = parsed.pathname.split("/").filter(Boolean);
  let id: string | null | undefined;
  if (host === "youtu.be") id = segments[0];
  else if (segments[0] === "watch") id = parsed.searchParams.get("v");
  else if (segments[0] === "shorts" || segments[0] === "embed") id = segments[1];
  if (!id || !VIDEO_ID.test(id)) return null;

  const rawTime = parsed.searchParams.get("t") ?? parsed.searchParams.get("start");
  const t = rawTime === null ? null : parseTimeParam(rawTime);
  return t === null ? { id } : { id, t };
}

/** The clip start: `video.start`, else the URL's `t`, else 0. */
export function effectiveStart(video: Pick<Video, "url" | "start">): number {
  if (video.start !== undefined) return video.start;
  return parseYouTubeUrl(video.url)?.t ?? 0;
}

export function watchUrl(id: string, start?: number): string {
  const base = `https://www.youtube.com/watch?v=${id}`;
  return start ? `${base}&t=${start}s` : base;
}
```

`src/lib/technique.ts`:

```ts
import type { Throw } from "../data/schema";
import { shuffle, type Rng } from "./random";

const MOVEMENT_LABEL = { crouch: "Crouch", walk: "Walk", run: "Run" } as const;
const CLICK_LABEL = { left: "left click", right: "right click", both: "left + right click" } as const;

export function techniqueText(t: Throw): string {
  const movement =
    t.movement === "stand"
      ? t.jump
        ? "Jump throw"
        : "Standing throw"
      : `${MOVEMENT_LABEL[t.movement]} + ${t.jump ? "jump throw" : "throw"}`;
  return `${movement} · ${CLICK_LABEL[t.click]}`;
}

export const COMMON_TECHNIQUES: readonly string[] = [
  "Jump throw · left click",
  "Run + jump throw · left click",
  "Standing throw · left click",
  "Standing throw · right click",
  "Standing throw · left + right click",
  "Walk + throw · left click",
  "Crouch + throw · left click",
];

/**
 * The correct technique plus three different distractors, in random order. Distractors come
 * first from other smokes on the same map, then from COMMON_TECHNIQUES.
 */
export function techniqueChoices(
  correct: string,
  sameMap: readonly string[],
  rng: Rng = Math.random,
): string[] {
  const fromMap = shuffle(
    [...new Set(sameMap)].filter((text) => text !== correct),
    rng,
  );
  const distractors = fromMap.slice(0, 3);
  for (const text of shuffle(COMMON_TECHNIQUES, rng)) {
    if (distractors.length >= 3) break;
    if (text !== correct && !distractors.includes(text)) distractors.push(text);
  }
  return shuffle([correct, ...distractors], rng);
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `npx vitest run src/lib`
Expected: PASS.

- [ ] **Step 5: Lint and commit**

Run: `npm run format && npm run lint`
Expected: no errors.

```bash
git add src/lib src/test/rng.ts
git commit -m "feat: add YouTube link parsing, technique text and shuffle"
```

---

### Task 4: Data validation, data files and data access

**Files:**
- Create: `src/data/validate.ts`, `src/data/api.ts`, `src/data/index.ts`, `src/test/fixtureData.ts`, `scripts/load-data.ts`, `scripts/validate-data.ts`, `data/maps/ancient.json`, `data/maps/anubis.json`, `data/maps/cache.json`, `data/maps/dust2.json`, `data/maps/inferno.json`, `data/maps/mirage.json`, `data/maps/nuke.json`
- Modify: `package.json` (add the `validate` script)
- Test: `src/data/validate.test.ts`, `src/data/api.test.ts`, `src/data/index.test.ts`, `src/test/fixtureData.test.ts`

**Interfaces:**
- Consumes: `MAP_IDS`, `MapId`, `MapFile`, `Lineup`, `Execute`, `mapFileSchema` (Task 2); `parseYouTubeUrl`, `effectiveStart` (Task 3); `makeLineup`, `makeExecute`, `makeMapFile` (Task 2).
- Produces:
  - `validate.ts`: `interface DataFile { fileName: string; content: unknown; parseError?: string }`; `interface DataError { file: string; path: string; message: string }`; `formatPath(path: readonly PropertyKey[]): string`; `validateDataFiles(files: readonly DataFile[]): DataError[]`.
  - `api.ts`: `interface LocatedLineup { map: MapId; lineup: Lineup }`; `createDataApi(data: Record<MapId, MapFile>)` returning `{ getMapData(id: MapId): MapFile; findLineup(map: MapId, id: string): Lineup | undefined; findExecute(map: MapId, id: string): Execute | undefined; allLineups(): LocatedLineup[] }`.
  - `index.ts`: `MAP_DATA: Record<MapId, MapFile>` and the four functions above, bound to the bundled JSON. Pages import from `src/data` (this file).
  - `fixtureData.ts`: `FIXTURE_DATA: Record<MapId, MapFile>`; `mockDataModule()` — the replacement for `src/data/index.ts` in page tests: `vi.mock("<relative path to src/data>", async () => (await import("<relative path>/test/fixtureData")).mockDataModule())`.
  - `scripts/load-data.ts`: `DATA_DIR: string`; `loadDataFiles(dir?: string): DataFile[]`.
  - npm script `validate`.

`FIXTURE_DATA` contents (later tests rely on these exact ids):

| Map | id | side | area | notes |
|---|---|---|---|---|
| mirage | `mirage-window-from-t-spawn` | T | Mid | default `makeLineup` |
| mirage | `mirage-ct-from-t-ramp` | T | A | run + jump throw |
| mirage | `mirage-jungle-from-t-ramp` | T | A | standing throw |
| mirage | `mirage-top-mid-from-ct-spawn` | CT | Mid | CSNADES link, no start/end |
| mirage | `mirage-market-window-from-b-apps` | T | B | `status: "broken"` |
| mirage execute | `mirage-a-execute` | T | — | CT + Jungle |
| nuke | `nuke-outside-from-t-roof` | T | Other | upper → upper |
| nuke | `nuke-ramp-from-lobby` | T | B | stands upper, lands lower |

- [ ] **Step 1: Write the failing validation tests**

`src/data/validate.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { makeExecute, makeLineup, makeMapFile } from "../test/fixtures";
import { MAP_IDS, type MapId } from "./schema";
import { formatPath, validateDataFiles, type DataFile } from "./validate";

function filesWith(overrides: Partial<Record<MapId, unknown>> = {}): DataFile[] {
  return MAP_IDS.map((map) => ({
    fileName: `${map}.json`,
    content: overrides[map] ?? makeMapFile(map),
  }));
}

const VIDEO = "https://youtu.be/dQw4w9WgXcQ";

describe("formatPath", () => {
  it("joins keys and indexes", () => {
    expect(formatPath(["lineups", 0, "video", "end"])).toBe("lineups[0].video.end");
    expect(formatPath([])).toBe("");
  });
});

describe("validateDataFiles", () => {
  it("accepts seven valid files", () => {
    expect(validateDataFiles(filesWith())).toEqual([]);
  });

  it("reports a missing file", () => {
    const files = filesWith().filter((f) => f.fileName !== "cache.json");
    expect(validateDataFiles(files)).toEqual([
      { file: "cache.json", path: "", message: "file is missing" },
    ]);
  });

  it("reports a file that is not one of the seven maps", () => {
    const errors = validateDataFiles([...filesWith(), { fileName: "overpass.json", content: {} }]);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ file: "overpass.json", path: "" });
    expect(errors[0].message).toContain("unexpected file");
  });

  it("reports a file that is not valid JSON without also calling it missing", () => {
    const files = filesWith().map((f) =>
      f.fileName === "mirage.json"
        ? { fileName: "mirage.json", content: undefined, parseError: "Unexpected token" }
        : f,
    );
    expect(validateDataFiles(files)).toEqual([
      { file: "mirage.json", path: "", message: "not valid JSON: Unexpected token" },
    ]);
  });

  it("reports schema problems with a readable path", () => {
    const bad = makeMapFile("mirage", [makeLineup({ stand: { x: 2, y: 0.5 } })]);
    const errors = validateDataFiles(filesWith({ mirage: bad }));
    expect(errors.map((e) => e.path)).toEqual(["lineups[0].stand.x"]);
  });

  it("requires map to match the file name", () => {
    const errors = validateDataFiles(filesWith({ mirage: makeMapFile("nuke") }));
    expect(errors).toEqual([
      { file: "mirage.json", path: "map", message: 'must be "mirage" to match the file name' },
    ]);
  });

  it("requires ids to start with the map id", () => {
    const bad = makeMapFile("mirage", [makeLineup({ id: "dust2-window-from-t-spawn" })]);
    const errors = validateDataFiles(filesWith({ mirage: bad }));
    expect(errors).toEqual([
      { file: "mirage.json", path: "lineups[0].id", message: 'must start with "mirage-"' },
    ]);
  });

  it("finds duplicate ids within a file, across lineups and executes, and across files", () => {
    const mirage = makeMapFile(
      "mirage",
      [makeLineup(), makeLineup(), makeLineup({ id: "mirage-ct-from-t-ramp" }), makeLineup({ id: "mirage-jungle-from-t-ramp" })],
      [makeExecute({ id: "mirage-ct-from-t-ramp" })],
    );
    const nuke = makeMapFile("nuke", [
      makeLineup({
        id: "mirage-window-from-t-spawn",
        stand: { x: 0.1, y: 0.1, level: "upper" },
        land: { x: 0.2, y: 0.2, level: "upper" },
      }),
    ]);
    const messages = validateDataFiles(filesWith({ mirage, nuke })).map(
      (e) => `${e.file} ${e.path}: ${e.message}`,
    );
    expect(messages).toEqual([
      'mirage.json lineups[1].id: duplicate id "mirage-window-from-t-spawn" (also at mirage.json → lineups[0])',
      'mirage.json executes[0].id: duplicate id "mirage-ct-from-t-ramp" (also at mirage.json → lineups[2])',
      'nuke.json lineups[0].id: must start with "nuke-"',
      'nuke.json lineups[0].id: duplicate id "mirage-window-from-t-spawn" (also at mirage.json → lineups[0])',
    ]);
  });

  it("requires levels on Nuke and forbids them elsewhere", () => {
    const nuke = makeMapFile("nuke", [makeLineup({ id: "nuke-outside-from-t-roof" })]);
    const mirage = makeMapFile("mirage", [
      makeLineup({ stand: { x: 0.1, y: 0.1, level: "upper" } }),
    ]);
    const messages = validateDataFiles(filesWith({ nuke, mirage })).map(
      (e) => `${e.file} ${e.path}: ${e.message}`,
    );
    expect(messages).toEqual([
      "mirage.json lineups[0].stand.level: is only allowed on Nuke",
      "nuke.json lineups[0].stand.level: is required on Nuke",
      "nuke.json lineups[0].land.level: is required on Nuke",
    ]);
  });

  it("allows start and end only on YouTube URLs", () => {
    const bad = makeMapFile("mirage", [
      makeLineup({ video: { url: "https://csnades.gg/mirage/smokes/window", start: 5 } }),
    ]);
    expect(validateDataFiles(filesWith({ mirage: bad }))).toEqual([
      {
        file: "mirage.json",
        path: "lineups[0].video",
        message: "start and end are only allowed on YouTube URLs",
      },
    ]);
  });

  it("requires end after the effective start, including a start taken from the URL", () => {
    const bad = makeMapFile("mirage", [makeLineup({ video: { url: `${VIDEO}?t=100`, end: 90 } })]);
    expect(validateDataFiles(filesWith({ mirage: bad }))).toEqual([
      {
        file: "mirage.json",
        path: "lineups[0].video.end",
        message: "must be greater than the start (100s)",
      },
    ]);
    const good = makeMapFile("mirage", [makeLineup({ video: { url: `${VIDEO}?t=100`, end: 120 } })]);
    expect(validateDataFiles(filesWith({ mirage: good }))).toEqual([]);
  });

  it("checks execute references, sides and repeats", () => {
    const mirage = makeMapFile(
      "mirage",
      [
        makeLineup({ id: "mirage-ct-from-t-ramp" }),
        makeLineup({ id: "mirage-top-mid-from-ct-spawn", side: "CT" }),
      ],
      [
        makeExecute({
          lineupIds: [
            "mirage-ct-from-t-ramp",
            "mirage-ct-from-t-ramp",
            "mirage-top-mid-from-ct-spawn",
            "mirage-nowhere",
          ],
        }),
      ],
    );
    const messages = validateDataFiles(filesWith({ mirage })).map((e) => `${e.path}: ${e.message}`);
    expect(messages).toEqual([
      'executes[0].lineupIds[1]: "mirage-ct-from-t-ramp" is listed twice',
      'executes[0].lineupIds[2]: "mirage-top-mid-from-ct-spawn" is a CT smoke but the execute is T',
      'executes[0].lineupIds[3]: "mirage-nowhere" is not a smoke in mirage.json',
    ]);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/data/validate.test.ts`
Expected: FAIL — `Failed to resolve import "./validate"`.

- [ ] **Step 3: Implement `src/data/validate.ts`**

```ts
import { effectiveStart, parseYouTubeUrl } from "../lib/youtube";
import { MAP_IDS, mapFileSchema, type MapFile, type MapId } from "./schema";

export interface DataFile {
  fileName: string;
  content: unknown;
  /** Set when the file could not be parsed as JSON. */
  parseError?: string;
}

export interface DataError {
  file: string;
  /** JSON path such as "lineups[0].video.end"; "" for the whole file. */
  path: string;
  message: string;
}

const isMapId = (value: string): value is MapId => (MAP_IDS as readonly string[]).includes(value);

export function formatPath(path: readonly PropertyKey[]): string {
  return path.reduce<string>((text, key) => {
    if (typeof key === "number") return `${text}[${key}]`;
    return text ? `${text}.${String(key)}` : String(key);
  }, "");
}

export function validateDataFiles(files: readonly DataFile[]): DataError[] {
  const errors: DataError[] = [];
  const seenIds = new Map<string, string>();
  const present = new Set<MapId>();

  for (const { fileName, content, parseError } of files) {
    const mapId = fileName.replace(/\.json$/, "");
    if (!fileName.endsWith(".json") || !isMapId(mapId)) {
      errors.push({
        file: fileName,
        path: "",
        message: `unexpected file; expected one of ${MAP_IDS.map((id) => `${id}.json`).join(", ")}`,
      });
      continue;
    }
    present.add(mapId);
    if (parseError !== undefined) {
      errors.push({ file: fileName, path: "", message: `not valid JSON: ${parseError}` });
      continue;
    }
    const result = mapFileSchema.safeParse(content);
    if (!result.success) {
      for (const issue of result.error.issues) {
        errors.push({ file: fileName, path: formatPath(issue.path), message: issue.message });
      }
      continue;
    }
    errors.push(...checkMapFile(fileName, mapId, result.data, seenIds));
  }

  for (const id of MAP_IDS) {
    if (!present.has(id)) errors.push({ file: `${id}.json`, path: "", message: "file is missing" });
  }
  return errors;
}

function checkMapFile(
  file: string,
  mapId: MapId,
  data: MapFile,
  seenIds: Map<string, string>,
): DataError[] {
  const errors: DataError[] = [];
  const add = (path: string, message: string) => errors.push({ file, path, message });

  if (data.map !== mapId) add("map", `must be "${mapId}" to match the file name`);

  const claimId = (id: string, path: string) => {
    if (!id.startsWith(`${mapId}-`)) add(`${path}.id`, `must start with "${mapId}-"`);
    const previous = seenIds.get(id);
    if (previous) add(`${path}.id`, `duplicate id "${id}" (also at ${previous})`);
    else seenIds.set(id, `${file} → ${path}`);
  };

  const needsLevels = mapId === "nuke";
  data.lineups.forEach((lineup, i) => {
    const path = `lineups[${i}]`;
    claimId(lineup.id, path);
    for (const key of ["stand", "land"] as const) {
      const hasLevel = lineup[key].level !== undefined;
      if (needsLevels && !hasLevel) add(`${path}.${key}.level`, "is required on Nuke");
      if (!needsLevels && hasLevel) add(`${path}.${key}.level`, "is only allowed on Nuke");
    }
    const { video } = lineup;
    const isYouTube = parseYouTubeUrl(video.url) !== null;
    if (!isYouTube && (video.start !== undefined || video.end !== undefined)) {
      add(`${path}.video`, "start and end are only allowed on YouTube URLs");
    }
    if (isYouTube && video.end !== undefined && video.end <= effectiveStart(video)) {
      add(`${path}.video.end`, `must be greater than the start (${effectiveStart(video)}s)`);
    }
  });

  const lineupsById = new Map(data.lineups.map((lineup) => [lineup.id, lineup]));
  data.executes.forEach((execute, i) => {
    const path = `executes[${i}]`;
    claimId(execute.id, path);
    const listed = new Set<string>();
    execute.lineupIds.forEach((id, j) => {
      const ref = `${path}.lineupIds[${j}]`;
      if (listed.has(id)) {
        add(ref, `"${id}" is listed twice`);
        return;
      }
      listed.add(id);
      const lineup = lineupsById.get(id);
      if (!lineup) add(ref, `"${id}" is not a smoke in ${file}`);
      else if (lineup.side !== execute.side) {
        add(ref, `"${id}" is a ${lineup.side} smoke but the execute is ${execute.side}`);
      }
    });
  });

  return errors;
}
```

- [ ] **Step 4: Run the validation tests to see them pass**

Run: `npx vitest run src/data/validate.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing data-access tests**

`src/data/api.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { makeExecute, makeLineup, makeMapFile } from "../test/fixtures";
import { createDataApi } from "./api";
import { MAP_IDS, type MapFile, type MapId } from "./schema";

const data = Object.fromEntries(MAP_IDS.map((map) => [map, makeMapFile(map)])) as Record<
  MapId,
  MapFile
>;
data.mirage = makeMapFile(
  "mirage",
  [makeLineup({ id: "mirage-a" }), makeLineup({ id: "mirage-b" })],
  [makeExecute({ id: "mirage-exec", lineupIds: ["mirage-a", "mirage-b"] })],
);
data.ancient = makeMapFile("ancient", [makeLineup({ id: "ancient-a" })]);

describe("createDataApi", () => {
  const api = createDataApi(data);

  it("finds lineups and executes by map and id", () => {
    expect(api.findLineup("mirage", "mirage-b")?.id).toBe("mirage-b");
    expect(api.findLineup("mirage", "ancient-a")).toBeUndefined();
    expect(api.findExecute("mirage", "mirage-exec")?.lineupIds).toEqual(["mirage-a", "mirage-b"]);
    expect(api.findExecute("mirage", "nope")).toBeUndefined();
  });

  it("lists all lineups in map order, then file order", () => {
    expect(api.allLineups().map(({ map, lineup }) => `${map}/${lineup.id}`)).toEqual([
      "ancient/ancient-a",
      "mirage/mirage-a",
      "mirage/mirage-b",
    ]);
  });
});
```

`src/test/fixtureData.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { MAP_IDS } from "../data/schema";
import { validateDataFiles } from "../data/validate";
import { FIXTURE_DATA } from "./fixtureData";

describe("FIXTURE_DATA", () => {
  it("is valid data", () => {
    const files = MAP_IDS.map((map) => ({ fileName: `${map}.json`, content: FIXTURE_DATA[map] }));
    expect(validateDataFiles(files)).toEqual([]);
  });
});
```

`src/data/index.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { MAP_DATA, findLineup } from "./index";
import { MAP_IDS } from "./schema";
import { validateDataFiles } from "./validate";

describe("bundled data", () => {
  it("passes validation", () => {
    const files = MAP_IDS.map((map) => ({ fileName: `${map}.json`, content: MAP_DATA[map] }));
    expect(validateDataFiles(files)).toEqual([]);
  });

  it("returns undefined for an unknown smoke", () => {
    expect(findLineup("mirage", "mirage-does-not-exist")).toBeUndefined();
  });
});
```

- [ ] **Step 6: Run them to see them fail**

Run: `npx vitest run src/data/api.test.ts src/test/fixtureData.test.ts src/data/index.test.ts`
Expected: FAIL — `Failed to resolve import "./api"`, `"./fixtureData"` and `"./index"`.

- [ ] **Step 7: Create the seven data files**

Create each file with exactly this shape, changing only `map`. `data/maps/ancient.json`:

```json
{
  "map": "ancient",
  "lineups": [],
  "executes": []
}
```

Then `anubis.json`, `cache.json`, `dust2.json`, `inferno.json`, `mirage.json` and `nuke.json` in `data/maps/`, with `"map"` set to `"anubis"`, `"cache"`, `"dust2"`, `"inferno"`, `"mirage"` and `"nuke"`.

- [ ] **Step 8: Implement the data access modules and fixture data**

`src/data/api.ts`:

```ts
import { MAP_IDS, type Execute, type Lineup, type MapFile, type MapId } from "./schema";

export interface LocatedLineup {
  map: MapId;
  lineup: Lineup;
}

export function createDataApi(data: Record<MapId, MapFile>) {
  return {
    getMapData: (id: MapId): MapFile => data[id],
    findLineup: (map: MapId, id: string): Lineup | undefined =>
      data[map].lineups.find((lineup) => lineup.id === id),
    findExecute: (map: MapId, id: string): Execute | undefined =>
      data[map].executes.find((execute) => execute.id === id),
    allLineups: (): LocatedLineup[] =>
      MAP_IDS.flatMap((map) => data[map].lineups.map((lineup) => ({ map, lineup }))),
  };
}
```

`src/data/index.ts`:

```ts
import ancient from "../../data/maps/ancient.json";
import anubis from "../../data/maps/anubis.json";
import cache from "../../data/maps/cache.json";
import dust2 from "../../data/maps/dust2.json";
import inferno from "../../data/maps/inferno.json";
import mirage from "../../data/maps/mirage.json";
import nuke from "../../data/maps/nuke.json";
import { createDataApi } from "./api";
import type { MapFile, MapId } from "./schema";

export type { LocatedLineup } from "./api";

/** The bundled data. It is validated in CI (npm run validate), so it is trusted here. */
export const MAP_DATA: Record<MapId, MapFile> = {
  ancient: ancient as unknown as MapFile,
  anubis: anubis as unknown as MapFile,
  cache: cache as unknown as MapFile,
  dust2: dust2 as unknown as MapFile,
  inferno: inferno as unknown as MapFile,
  mirage: mirage as unknown as MapFile,
  nuke: nuke as unknown as MapFile,
};

export const { getMapData, findLineup, findExecute, allLineups } = createDataApi(MAP_DATA);
```

`src/test/fixtureData.ts`:

```ts
import { createDataApi } from "../data/api";
import type { MapFile, MapId } from "../data/schema";
import { makeExecute, makeLineup } from "./fixtures";

const empty = (map: MapId): MapFile => ({ map, lineups: [], executes: [] });

/** Small, stable data for page tests. Real data changes as smokes are seeded. */
export const FIXTURE_DATA: Record<MapId, MapFile> = {
  ancient: empty("ancient"),
  anubis: empty("anubis"),
  cache: empty("cache"),
  dust2: empty("dust2"),
  inferno: empty("inferno"),
  mirage: {
    map: "mirage",
    lineups: [
      makeLineup({
        id: "mirage-window-from-t-spawn",
        stand: { x: 0.8, y: 0.6 },
        land: { x: 0.45, y: 0.45 },
      }),
      makeLineup({
        id: "mirage-ct-from-t-ramp",
        name: "CT",
        from: "T Ramp",
        area: "A",
        throw: { movement: "run", jump: true, click: "left" },
        stand: { x: 0.7, y: 0.3 },
        land: { x: 0.3, y: 0.2 },
      }),
      makeLineup({
        id: "mirage-jungle-from-t-ramp",
        name: "Jungle",
        from: "T Ramp",
        area: "A",
        throw: { movement: "stand", jump: false, click: "left" },
        stand: { x: 0.72, y: 0.32 },
        land: { x: 0.35, y: 0.3 },
      }),
      makeLineup({
        id: "mirage-top-mid-from-ct-spawn",
        name: "Top Mid",
        from: "CT Spawn",
        side: "CT",
        area: "Mid",
        throw: { movement: "stand", jump: false, click: "right" },
        stand: { x: 0.2, y: 0.4 },
        land: { x: 0.6, y: 0.5 },
        video: { url: "https://csnades.gg/mirage/smokes/top-mid" },
        status: "ok",
      }),
      makeLineup({
        id: "mirage-market-window-from-b-apps",
        name: "Market Window",
        from: "B Apartments",
        area: "B",
        stand: { x: 0.5, y: 0.85 },
        land: { x: 0.25, y: 0.75 },
        status: "broken",
      }),
    ],
    executes: [
      makeExecute({
        id: "mirage-a-execute",
        name: "A execute",
        lineupIds: ["mirage-ct-from-t-ramp", "mirage-jungle-from-t-ramp"],
      }),
    ],
  },
  nuke: {
    map: "nuke",
    lineups: [
      makeLineup({
        id: "nuke-outside-from-t-roof",
        name: "Outside",
        from: "T Roof",
        area: "Other",
        stand: { x: 0.2, y: 0.5, level: "upper" },
        land: { x: 0.5, y: 0.5, level: "upper" },
      }),
      makeLineup({
        id: "nuke-ramp-from-lobby",
        name: "Ramp",
        from: "Lobby",
        area: "B",
        stand: { x: 0.3, y: 0.6, level: "upper" },
        land: { x: 0.4, y: 0.7, level: "lower" },
      }),
    ],
    executes: [],
  },
};

/** Drop-in replacement for src/data/index.ts in page tests. */
export function mockDataModule() {
  return { MAP_DATA: FIXTURE_DATA, ...createDataApi(FIXTURE_DATA) };
}
```

- [ ] **Step 9: Run the tests to see them pass**

Run: `npx vitest run src/data src/test`
Expected: PASS.

- [ ] **Step 10: Add the `npm run validate` command**

`scripts/load-data.ts`:

```ts
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
```

`scripts/validate-data.ts`:

```ts
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
```

Run: `npm pkg set scripts.validate="tsx scripts/validate-data.ts"`

- [ ] **Step 11: Check the command against good and bad data**

Run: `npm run validate`
Expected: `Data OK: 7 map files, 0 smokes.`

Temporarily change `"map": "cache"` to `"map": "nuke"` in `data/maps/cache.json`, then run `npm run validate`.
Expected: exit code 1 and `cache.json → map → must be "cache" to match the file name`. Undo the change (`git checkout data/maps/cache.json` does not work yet because the file is new — set it back to `"cache"` by hand) and run `npm run validate` again: `Data OK`.

- [ ] **Step 12: Run everything, lint and commit**

Run: `npm test && npm run format && npm run lint`
Expected: all tests pass; no lint errors.

```bash
git add data scripts src/data src/test package.json
git commit -m "feat: add data validation, data files and data access"
```

---

### Task 5: Dead-video checker (`npm run check-videos`)

**Files:**
- Create: `scripts/videos.ts`, `scripts/check-videos.ts`
- Modify: `package.json` (add the `check-videos` script)
- Test: `scripts/videos.test.ts`

**Interfaces:**
- Consumes: `parseYouTubeUrl` (Task 3); `loadDataFiles` (Task 4); `MapFile` (Task 2).
- Produces: `interface VideoCheck { lineupId: string; url: string; ok: boolean; detail: string }`; `interface FetchResponse { ok: boolean; status: number; json(): Promise<unknown> }`; `type FetchLike = (url: string) => Promise<FetchResponse>`; `oembedUrl(videoId: string): string`; `checkVideos(lineups: ReadonlyArray<{ id: string; video: { url: string } }>, fetchImpl: FetchLike): Promise<VideoCheck[]>`; `formatReport(checks: readonly VideoCheck[]): string`; npm script `check-videos` (exit code 1 when any video fails). It changes no files and is never run in CI.

- [ ] **Step 1: Write the failing tests**

`scripts/videos.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { checkVideos, formatReport, oembedUrl } from "./videos";

const ID = "dQw4w9WgXcQ";
const okResponse = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
const failResponse = (status: number) => ({ ok: false, status, json: async () => ({}) });

describe("checkVideos", () => {
  it("reports title and channel, asking oEmbed once per video", async () => {
    const fetchImpl = vi.fn(async () => okResponse({ title: "Mirage smokes", author_name: "NadeGuy" }));
    const checks = await checkVideos(
      [
        { id: "mirage-a", video: { url: `https://youtu.be/${ID}?t=5` } },
        { id: "mirage-b", video: { url: `https://www.youtube.com/watch?v=${ID}&t=60` } },
      ],
      fetchImpl,
    );
    expect(checks.map((c) => [c.lineupId, c.ok, c.detail])).toEqual([
      ["mirage-a", true, "Mirage smokes — NadeGuy"],
      ["mirage-b", true, "Mirage smokes — NadeGuy"],
    ]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith(oembedUrl(ID));
  });

  it("fails videos that oEmbed rejects", async () => {
    const checks = await checkVideos(
      [{ id: "mirage-a", video: { url: `https://youtu.be/${ID}` } }],
      async () => failResponse(401),
    );
    expect(checks[0]).toMatchObject({ ok: false, detail: "oEmbed returned HTTP 401" });
  });

  it("fails when the request itself fails", async () => {
    const checks = await checkVideos(
      [{ id: "mirage-a", video: { url: `https://youtu.be/${ID}` } }],
      async () => {
        throw new Error("offline");
      },
    );
    expect(checks[0]).toMatchObject({ ok: false, detail: "request failed: offline" });
  });

  it("skips links to other sites", async () => {
    const fetchImpl = vi.fn();
    const checks = await checkVideos(
      [{ id: "mirage-a", video: { url: "https://csnades.gg/mirage/smokes/window" } }],
      fetchImpl,
    );
    expect(checks[0]).toMatchObject({ ok: true, detail: "not a YouTube link (skipped)" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("formatReport", () => {
  it("lists every check and ends with a summary", () => {
    const report = formatReport([
      { lineupId: "mirage-a", url: "https://youtu.be/x", ok: true, detail: "Title — Channel" },
      { lineupId: "mirage-b", url: "https://youtu.be/y", ok: false, detail: "oEmbed returned HTTP 404" },
    ]);
    expect(report.split("\n")).toEqual([
      "OK    mirage-a  Title — Channel",
      "FAIL  mirage-b  oEmbed returned HTTP 404  https://youtu.be/y",
      "",
      "1 of 2 videos failed.",
    ]);
    expect(formatReport([])).toBe("\nAll 0 videos OK.");
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run scripts/videos.test.ts`
Expected: FAIL — `Failed to resolve import "./videos"`.

- [ ] **Step 3: Implement `scripts/videos.ts` and `scripts/check-videos.ts`**

`scripts/videos.ts`:

```ts
import { parseYouTubeUrl } from "../src/lib/youtube";

export interface VideoCheck {
  lineupId: string;
  url: string;
  ok: boolean;
  detail: string;
}

export interface FetchResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

export type FetchLike = (url: string) => Promise<FetchResponse>;

export function oembedUrl(videoId: string): string {
  const watch = `https://www.youtube.com/watch?v=${videoId}`;
  return `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(watch)}`;
}

async function lookup(videoId: string, fetchImpl: FetchLike) {
  try {
    const response = await fetchImpl(oembedUrl(videoId));
    if (!response.ok) return { ok: false, detail: `oEmbed returned HTTP ${response.status}` };
    const body = (await response.json()) as { title?: string; author_name?: string };
    return {
      ok: true,
      detail: `${body.title ?? "(no title)"} — ${body.author_name ?? "(no channel)"}`,
    };
  } catch (error) {
    return { ok: false, detail: `request failed: ${(error as Error).message}` };
  }
}

export async function checkVideos(
  lineups: ReadonlyArray<{ id: string; video: { url: string } }>,
  fetchImpl: FetchLike,
): Promise<VideoCheck[]> {
  const byVideo = new Map<string, Promise<{ ok: boolean; detail: string }>>();
  const checks: VideoCheck[] = [];
  for (const lineup of lineups) {
    const { url } = lineup.video;
    const ref = parseYouTubeUrl(url);
    if (!ref) {
      checks.push({ lineupId: lineup.id, url, ok: true, detail: "not a YouTube link (skipped)" });
      continue;
    }
    let pending = byVideo.get(ref.id);
    if (!pending) {
      pending = lookup(ref.id, fetchImpl);
      byVideo.set(ref.id, pending);
    }
    checks.push({ lineupId: lineup.id, url, ...(await pending) });
  }
  return checks;
}

export function formatReport(checks: readonly VideoCheck[]): string {
  const lines = checks.map((c) =>
    c.ok ? `OK    ${c.lineupId}  ${c.detail}` : `FAIL  ${c.lineupId}  ${c.detail}  ${c.url}`,
  );
  const failed = checks.filter((c) => !c.ok).length;
  lines.push(
    "",
    failed === 0 ? `All ${checks.length} videos OK.` : `${failed} of ${checks.length} videos failed.`,
  );
  return lines.join("\n");
}
```

`scripts/check-videos.ts`:

```ts
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
```

Run: `npm pkg set scripts.check-videos="tsx scripts/check-videos.ts"`

- [ ] **Step 4: Run the tests and the command**

Run: `npx vitest run scripts/videos.test.ts`
Expected: PASS.

Run: `npm run check-videos`
Expected: `All 0 videos OK.` (no smokes yet).

- [ ] **Step 5: Lint and commit**

Run: `npm run format && npm run lint`

```bash
git add scripts package.json
git commit -m "feat: add npm run check-videos"
```

---

### Task 6: Radar images, app icons, manifest and the marker preview tool

**Files:**
- Create: `scripts/make-radars.ts`, `scripts/make-icons.ts`, `scripts/preview-svg.ts`, `scripts/preview-markers.ts`, `public/icons/icon.svg`, `public/manifest.webmanifest`
- Generate (committed): `public/radars/{ancient,anubis,cache,dust2,inferno,mirage,nuke,nuke-lower}.webp`, `public/icons/icon-192.png`, `public/icons/icon-512.png`, `public/icons/apple-touch-icon.png`
- Modify: `package.json` (sharp, scripts `radars`, `icons`, `preview-markers`), `index.html` (icon and manifest links)
- Test: `scripts/preview-svg.test.ts`

**Interfaces:**
- Consumes: `getMapInfo`, `hasLevels`, `radarPath` (Task 2); `loadDataFiles` (Task 4); `MapFile`, `Level` (Task 2).
- Produces: `interface PreviewMarker { n: number; side: "T" | "CT"; stand: { x: number; y: number }; land: { x: number; y: number } }`; `buildPreviewSvg(size: number, markers: readonly PreviewMarker[]): string`; `npm run preview-markers -- <mapId>` writes `tmp/preview-<mapId>.png` (and `tmp/preview-nuke-lower.png`) — the radar with a labelled 0.1 grid and numbered markers, used by every seeding task; `npm run radars` (expects `tmp/radars-src/<name>.png`); `npm run icons`; radar files at the paths `MAPS` already points to.

- [ ] **Step 1: Install sharp and add the scripts**

Run:

```bash
npm install -D sharp@^0.34
npm pkg set scripts.radars="tsx scripts/make-radars.ts" scripts.icons="tsx scripts/make-icons.ts" scripts.preview-markers="tsx scripts/preview-markers.ts"
```

Expected: `sharp` appears in `devDependencies`.

- [ ] **Step 2: Write the failing preview tests**

`scripts/preview-svg.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildPreviewSvg } from "./preview-svg";

describe("buildPreviewSvg", () => {
  it("draws a 10×10 grid labelled in tenths", () => {
    const svg = buildPreviewSvg(1000, []);
    expect(svg.match(/<line /g)).toHaveLength(18);
    for (const label of ["0.1", "0.5", "0.9"]) expect(svg).toContain(`>${label}<`);
  });

  it("draws each smoke as a stand square, a dashed line and a numbered landing circle", () => {
    const svg = buildPreviewSvg(1000, [
      { n: 3, side: "T", stand: { x: 0.8, y: 0.6 }, land: { x: 0.4, y: 0.5 } },
    ]);
    expect(svg).toContain('<rect x="792" y="592"');
    expect(svg).toContain('x1="800" y1="600" x2="400" y2="500"');
    expect(svg).toContain('<circle cx="400" cy="500"');
    expect(svg).toContain(">3<");
    expect(svg.match(/<line /g)).toHaveLength(19);
  });
});
```

- [ ] **Step 3: Run them to see them fail**

Run: `npx vitest run scripts/preview-svg.test.ts`
Expected: FAIL — `Failed to resolve import "./preview-svg"`.

- [ ] **Step 4: Implement the preview tool**

`scripts/preview-svg.ts`:

```ts
export interface PreviewMarker {
  n: number;
  side: "T" | "CT";
  stand: { x: number; y: number };
  land: { x: number; y: number };
}

const COLORS = { T: "#f2a93b", CT: "#5b9dff" } as const;

/** An SVG overlay: a labelled 0.1 grid plus numbered markers (stand square → landing circle). */
export function buildPreviewSvg(size: number, markers: readonly PreviewMarker[]): string {
  const px = (fraction: number) => Math.round(fraction * size);
  const parts: string[] = [];

  for (let i = 1; i < 10; i++) {
    const p = px(i / 10);
    const label = (i / 10).toFixed(1);
    parts.push(
      `<line x1="${p}" y1="0" x2="${p}" y2="${size}" stroke="#ffffff" stroke-opacity="0.35" stroke-width="1"/>`,
      `<line x1="0" y1="${p}" x2="${size}" y2="${p}" stroke="#ffffff" stroke-opacity="0.35" stroke-width="1"/>`,
      `<text x="${p + 3}" y="14" font-size="13" fill="#ffffff">${label}</text>`,
      `<text x="3" y="${p - 3}" font-size="13" fill="#ffffff">${label}</text>`,
    );
  }

  for (const marker of markers) {
    const color = COLORS[marker.side];
    const [sx, sy] = [px(marker.stand.x), px(marker.stand.y)];
    const [lx, ly] = [px(marker.land.x), px(marker.land.y)];
    parts.push(
      `<line x1="${sx}" y1="${sy}" x2="${lx}" y2="${ly}" stroke="${color}" stroke-width="2" stroke-dasharray="6 4"/>`,
      `<rect x="${sx - 8}" y="${sy - 8}" width="16" height="16" fill="${color}" stroke="#000000" stroke-width="1"/>`,
      `<circle cx="${lx}" cy="${ly}" r="18" fill="${color}" fill-opacity="0.45" stroke="${color}" stroke-width="2"/>`,
      `<text x="${lx}" y="${ly + 5}" font-size="15" font-weight="bold" text-anchor="middle" fill="#ffffff">${marker.n}</text>`,
    );
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${parts.join("")}</svg>`;
}
```

`scripts/preview-markers.ts`:

```ts
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { getMapInfo, hasLevels, radarPath } from "../src/data/maps";
import type { Level, MapFile } from "../src/data/schema";
import { loadDataFiles } from "./load-data";
import { buildPreviewSvg, type PreviewMarker } from "./preview-svg";

const SIZE = 1000;
const ROOT = join(import.meta.dirname, "..");
const map = getMapInfo(process.argv[2] ?? "");
if (!map) {
  console.error("Usage: npm run preview-markers -- <ancient|anubis|cache|dust2|inferno|mirage|nuke>");
  process.exit(1);
}

const file = loadDataFiles().find((f) => f.fileName === `${map.id}.json`);
const lineups = (file?.content as MapFile | undefined)?.lineups ?? [];
mkdirSync(join(ROOT, "tmp"), { recursive: true });

const levels: Level[] = hasLevels(map) ? ["upper", "lower"] : ["upper"];
for (const level of levels) {
  const markers: PreviewMarker[] = lineups.flatMap((lineup, index) =>
    !hasLevels(map) || (lineup.land.level ?? "upper") === level
      ? [{ n: index + 1, side: lineup.side, stand: lineup.stand, land: lineup.land }]
      : [],
  );
  const out = join(ROOT, "tmp", `preview-${map.id}${level === "lower" ? "-lower" : ""}.png`);
  await sharp(join(ROOT, "public", radarPath(map, level)))
    .resize(SIZE, SIZE)
    .composite([{ input: Buffer.from(buildPreviewSvg(SIZE, markers)), top: 0, left: 0 }])
    .png()
    .toFile(out);
  console.log(`Wrote ${out}`);
}

lineups.forEach((lineup, index) => {
  const level = lineup.land.level ? ` (${lineup.land.level})` : "";
  console.log(
    `${String(index + 1).padStart(2)}  ${lineup.id}  stand ${lineup.stand.x},${lineup.stand.y} → land ${lineup.land.x},${lineup.land.y}${level}`,
  );
});
```

Run: `npx vitest run scripts/preview-svg.test.ts`
Expected: PASS.

- [ ] **Step 5: Ask the user before downloading Source 2 Viewer**

Ask, and wait for the answer: *"To make the radar images I need Source 2 Viewer's command-line tool (open source, from its official GitHub releases page). I'll download it into `tmp/s2v-cli` (git-ignored) and use it only to read radar textures from your CS2 install. OK?"*

- If yes: continue with Step 6.
- If no: ask the user to install Source 2 Viewer from https://s2v.app, open `…\Counter-Strike Global Offensive\game\csgo\pak01_dir.vpk`, browse to `panorama/images/overheadmaps/`, export each texture in the Step 7 table as PNG into `tmp/radars-src/` with the "Save as" name from that table, then skip to Step 8.

- [ ] **Step 6: Download the CLI and find the radar textures**

Run in PowerShell:

```powershell
New-Item -ItemType Directory -Force tmp/s2v-cli | Out-Null
$release = Invoke-RestMethod https://api.github.com/repos/ValveResourceFormat/ValveResourceFormat/releases/latest
$asset = $release.assets | Where-Object { $_.name -match 'cli' -and $_.name -match 'windows' -and $_.name -match 'x64' } | Select-Object -First 1
"Downloading $($asset.name) from release $($release.tag_name)"
Invoke-WebRequest $asset.browser_download_url -OutFile tmp/s2v-cli/cli.zip
Expand-Archive tmp/s2v-cli/cli.zip -DestinationPath tmp/s2v-cli -Force
$cli = (Get-ChildItem tmp/s2v-cli -Recurse -Filter "Source2Viewer-CLI.exe" | Select-Object -First 1).FullName
$csgo = "C:\Program Files (x86)\Steam\steamapps\common\Counter-Strike Global Offensive\game\csgo"
& $cli -i "$csgo\pak01_dir.vpk" -l -f "panorama/images/overheadmaps/" | Select-String "radar"
```

Expected: paths such as `panorama/images/overheadmaps/de_mirage_radar_psd.vtex_c`, one or more per map, plus a lower-level Nuke texture. If nothing prints, drop the `-f` filter and search the whole listing: `& $cli -i "$csgo\pak01_dir.vpk" -l | Select-String "_radar"`. If a map (most likely `de_cache`) is missing from `pak01_dir.vpk`, list its own archive: `& $cli -i "$csgo\maps\de_cache.vpk" -l | Select-String "radar"`.

- [ ] **Step 7: Export the textures and name them**

Run in PowerShell (PowerShell variables don't survive between tool calls, so they are set again; add a second export with `-i "$csgo\maps\de_cache.vpk"` if Step 6 found Cache's radar there):

```powershell
$cli = (Get-ChildItem tmp/s2v-cli -Recurse -Filter "Source2Viewer-CLI.exe" | Select-Object -First 1).FullName
$csgo = "C:\Program Files (x86)\Steam\steamapps\common\Counter-Strike Global Offensive\game\csgo"
& $cli -i "$csgo\pak01_dir.vpk" -d -o tmp/radars-raw -f "panorama/images/overheadmaps/" -e "vtex_c"
Get-ChildItem tmp/radars-raw -Recurse -Filter *.png | Where-Object Name -match "radar" | Select-Object -ExpandProperty FullName
```

Copy the matching PNGs into `tmp/radars-src/`. Use the plain competitive radar for each map (the `_radar_psd` texture, or plain `_radar` if there is no `_psd` one), never a `_night`, `_vanity` or preview variant:

| Texture | Save as |
|---|---|
| `de_ancient_radar_psd` | `tmp/radars-src/ancient.png` |
| `de_anubis_radar_psd` | `tmp/radars-src/anubis.png` |
| `de_cache_radar_psd` | `tmp/radars-src/cache.png` |
| `de_dust2_radar_psd` | `tmp/radars-src/dust2.png` |
| `de_inferno_radar_psd` | `tmp/radars-src/inferno.png` |
| `de_mirage_radar_psd` | `tmp/radars-src/mirage.png` |
| `de_nuke_radar_psd` | `tmp/radars-src/nuke.png` |
| `de_nuke_lower_radar_psd` | `tmp/radars-src/nuke-lower.png` |

Open two of them with the Read tool (for example `mirage.png` and `nuke-lower.png`) and check they are top-down radar maps of the right map.

- [ ] **Step 8: Convert the radars**

`scripts/make-radars.ts`:

```ts
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
```

Run: `npm run radars`
Expected: eight lines `public/radars/<name>.webp`; each file roughly 50–300 KB.

Run: `npm run preview-markers -- mirage`
Expected: `Wrote …\tmp\preview-mirage.png`. Open it with the Read tool: the Mirage radar with a white grid labelled 0.1–0.9 along the top and left edges.

- [ ] **Step 9: App icons and manifest**

`public/icons/icon.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#0f1115"/>
  <g fill="#c9ced8">
    <circle cx="200" cy="290" r="96"/>
    <circle cx="300" cy="250" r="110"/>
    <circle cx="330" cy="330" r="80"/>
    <circle cx="190" cy="350" r="70"/>
  </g>
  <circle cx="150" cy="150" r="34" fill="#f2a93b"/>
</svg>
```

`scripts/make-icons.ts`:

```ts
import { join } from "node:path";
import sharp from "sharp";

const ICONS = join(import.meta.dirname, "..", "public", "icons");
const SIZES = [
  ["icon-192.png", 192],
  ["icon-512.png", 512],
  ["apple-touch-icon.png", 180],
] as const;

for (const [name, size] of SIZES) {
  await sharp(join(ICONS, "icon.svg"), { density: 300 }).resize(size, size).png().toFile(join(ICONS, name));
  console.log(`public/icons/${name}`);
}
```

`public/manifest.webmanifest`:

```json
{
  "name": "CS Smokes",
  "short_name": "Smokes",
  "start_url": "./",
  "scope": "./",
  "display": "standalone",
  "background_color": "#0f1115",
  "theme_color": "#0f1115",
  "icons": [
    { "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

In `index.html`, add these lines inside `<head>`, after the `theme-color` meta tag:

```html
    <link rel="icon" type="image/svg+xml" href="/icons/icon.svg" />
    <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
    <link rel="manifest" href="/manifest.webmanifest" />
```

Run: `npm run icons && npm run build && grep -o 'href="[^"]*"' dist/index.html`
Expected: three PNGs written; the build passes; the hrefs in `dist/index.html` start with `./` (for example `./icons/icon.svg`, `./manifest.webmanifest`). If any still start with `/`, change that link in `index.html` to the `./` form and rebuild.

- [ ] **Step 10: Lint and commit**

Run: `npm test && npm run format && npm run lint`
Expected: all green.

```bash
git add scripts public index.html package.json package-lock.json
git commit -m "feat: add radar images, app icons, manifest and marker preview tool"
```

---

### Task 7: Seeding procedure, and Mirage's seed smokes

**Files:**
- Create: `docs/seeding.md`
- Modify: `data/maps/mirage.json`

**Interfaces:**
- Consumes: the schema rules (Task 2, spec §6.3); `npm run validate` (Task 4); `npm run check-videos` (Task 5); `npm run preview-markers` and `public/radars/mirage.webp` (Task 6).
- Produces: `docs/seeding.md`, the procedure that Tasks 14–19 follow; 10–15 Mirage lineups, every one `status: "unreviewed"`.

This is a research task: the content can't be written into the plan in advance. The procedure, the rules and the checks are fixed.

- [ ] **Step 1: Write the seeding procedure**

`docs/seeding.md`:

````markdown
# Seeding smokes

How the starter smokes for a map are added. The rules come from the design spec
(`docs/superpowers/specs/2026-10-10-cs2-smoke-lineups-design.md`, §6.3 and §10).

## 0. Tools

- `yt-dlp`, only to read video metadata. Never download videos. Check with
  `python -m yt_dlp --version`. If it's missing, ask the user before installing it with
  `python -m pip install --user yt-dlp`.
- `npm run preview-markers -- <mapId>`, `npm run validate`, `npm run check-videos`.

## 1. Find the map's last layout change

Search for the most recent Valve update that changed the map's layout (CS2 patch notes on
counter-strike.net or Steam news, HLTV, Liquipedia). Write the date down; it goes in the
report. Never use a date before CS2's release (2023-09-27). For Cache, never before its
return to CS2 (2026-04-29).

## 2. Choose 10–15 essential smokes

- T side: the smokes of the standard execute onto each site, plus mid-control smokes.
- CT side: two to four key smokes (delays, retakes, mid control).
- Cross-check against at least two current sources (for example the map's CSNADES page and
  2025–2026 guide articles). Prefer smokes that several sources list.
- Order them the way you'd learn them, most important first. Array order is the study order.

## 3. Find a video for each smoke

- Prefer one up-to-date guide for the map with chapters, or short single-smoke videos.
- Search:
  `python -m yt_dlp "ytsearch20:cs2 <map> smokes 2026" --flat-playlist --print "%(id)s | %(title)s | %(channel)s"`
  and WebSearch with `allowed_domains: ["youtube.com"]`.
- Read each candidate's metadata:
  `python -m yt_dlp --skip-download --print "%(upload_date)s | %(duration)s | %(playable_in_embed)s | %(title)s" "https://www.youtube.com/watch?v=<id>"`
- Keep a video only if `upload_date` is on or after the step 1 date and `playable_in_embed`
  is `True`.
- Chapters: `python -m yt_dlp --skip-download --dump-json "<url>"`, then read `chapters`
  (`start_time`, `end_time`, `title`) or the timestamps in `description`.
- If YouTube blocks yt-dlp ("Sign in to confirm you're not a bot"), use WebFetch on the
  watch page for the title, date and description, and rely on `npm run check-videos` for
  embeddability.

## 4. Write the entries

Add one lineup object per smoke to `data/maps/<mapId>.json`:

- `id`: `<mapId>-<slug(name)>-from-<slug(from)>`, where slug means lower-case with every run
  of spaces or punctuation turned into one `-`. Add `-2`, `-3`, … on a collision.
- `name` (the spot it covers) and `from` (where it's thrown): callout names as the sources
  use them, 1–40 characters.
- `side`; `area`: `A`, `B`, `Mid` or `Other`.
- `throw`: "jumpthrow" → `stand` + `jump: true` + `left`; "run jumpthrow" → `run` + `jump: true`
  + `left`; "right click" → `click: "right"`; "middle click" or "left + right" →
  `click: "both"`; "walk" or "crouch" → that movement. If the source doesn't say, pick the
  most likely technique and put `technique not stated in source` in `notes`.
- `video.url`: `https://www.youtube.com/watch?v=<id>`. `start`: the chapter's `start_time`,
  rounded down to whole seconds. `end`: the next chapter's start (or the chapter's
  `end_time`), rounded up; it must be greater than `start`. With no reliable timestamps,
  leave `start` and `end` out and write `no timestamps; plays the whole video` in `notes`.
- `notes`: aim hints only if a source states them; at most 280 characters.
- `status`: `"unreviewed"`. `checkedOn`: today's date.
- `stand` and `land`: start at `{ "x": 0.5, "y": 0.5 }` and fix them in step 5. On Nuke, add
  `"level"` to both.

## 5. Place the markers

1. Run `npm run preview-markers -- <mapId>` and open `tmp/preview-<mapId>.png` with the Read
   tool (on Nuke, also `tmp/preview-nuke-lower.png`). The console lists the marker numbers.
2. Using the grid (a line every 0.1), estimate each smoke's landing spot (the middle of the
   callout it covers) and its stand spot. Write the fractions with two or three decimals.
3. Run the preview again. Check that every numbered circle sits on the named callout and
   every square sits on the throw spot. Repeat until all are right to within about 0.05.
4. Nuke only: `level` is `"upper"` for outside, A site, heaven and roofs; `"lower"` for B
   site, ramp, secret and the lower tunnels. A smoke is drawn on its landing spot's level.

## 6. Check

- `npm run validate` prints `Data OK`.
- `npm run check-videos` reports every video OK.
- `npm test` passes (it validates the bundled data too).

## 7. Report and commit

Post this in chat:

- the layout-change date from step 1;
- a table:

  | # | Smoke | From | Side | Technique | Video |
  |---|---|---|---|---|---|
  | 1 | Window | T Spawn | T | Jump throw · left click | https://www.youtube.com/watch?v=VIDEO_ID&t=95s |

- anything uncertain: missing timestamps, unclear technique, markers you're unsure of.

Then commit: `git add data/maps/<mapId>.json && git commit -m "data: seed <Map name> smokes"`.
````

Commit it on its own:

```bash
git add docs/seeding.md
git commit -m "docs: add the smoke seeding procedure"
```

- [ ] **Step 2: Seed Mirage by following `docs/seeding.md`**

Map-specific notes:
- Map id `mirage`, radar `public/radars/mirage.webp`, one level (no `level` fields).
- Candidates that guides usually list. Verify each one against sources; don't copy this list blindly:
  - T, A execute: CT, Jungle, Stairs.
  - T, mid: Window, Top Mid / Connector, Short (Catwalk).
  - T, B execute: Market Window, Market Door (Kitchen).
  - CT: Top Mid, A Ramp, B Apartments.
- Expected result: 10–15 lineups in `data/maps/mirage.json`, ordered most important first, each `status: "unreviewed"`.

- [ ] **Step 3: Run the checks from `docs/seeding.md` step 6**

Run: `npm run validate && npm run check-videos && npm test`
Expected: `Data OK: 7 map files, N smokes.` (N = Mirage's count); `All N videos OK.`; all tests pass.

- [ ] **Step 4: Report and commit**

Post the report from `docs/seeding.md` step 7, then:

```bash
git add data/maps/mirage.json
git commit -m "data: seed Mirage smokes"
```

---

### Task 8: App shell, routes, not-found page and home

**Files:**
- Create: `src/app/AppRoutes.tsx`, `src/app/Layout.tsx`, `src/app/Layout.module.css`, `src/app/NotFound.tsx`, `src/app/NotFound.module.css`, `src/features/home/HomePage.tsx`, `src/features/home/HomePage.module.css`, `src/test/render.tsx`
- Modify: `src/main.tsx` (replace the placeholder)
- Test: `src/app/AppRoutes.test.tsx`

**Interfaces:**
- Consumes: `MAPS` (Task 2); `assetUrl` (Task 2); `getMapData` from `src/data` (Task 4); `mockDataModule` (Task 4).
- Produces: `AppRoutes()` (the `<Routes>` tree, rendered inside a router); `Layout()` with header, `<Outlet/>` and footer; `CREDITS: string` (exact footer text); `interface BackLink { href: string; label: string }`; `NotFound({ backTo?: BackLink })` (default back link: `/`, "Back to maps"); `HomePage()`; test helpers `renderAt(path: string)` and `LocationProbe()` (renders the current `pathname + search` in `data-testid="location"`).

- [ ] **Step 1: Write the test helper and the failing tests**

`src/test/render.tsx`:

```tsx
import { render } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router";
import { AppRoutes } from "../app/AppRoutes";

/** Renders the router's current path and query so tests can check navigation. */
export function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

/** Renders the whole app at `path`, with an in-memory router. */
export function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
      <LocationProbe />
    </MemoryRouter>,
  );
}
```

`src/app/AppRoutes.test.tsx`:

```tsx
import { screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderAt } from "../test/render";

vi.mock("../data", async () => (await import("../test/fixtureData")).mockDataModule());

describe("app shell", () => {
  it("lists the seven maps in order, with their smoke counts", () => {
    renderAt("/");
    const tiles = within(screen.getByRole("list", { name: "Maps" })).getAllByRole("link");
    expect(tiles.map((tile) => tile.getAttribute("href"))).toEqual([
      "/maps/ancient",
      "/maps/anubis",
      "/maps/cache",
      "/maps/dust2",
      "/maps/inferno",
      "/maps/mirage",
      "/maps/nuke",
    ]);
    expect(tiles[5]).toHaveTextContent("Mirage");
    expect(tiles[5]).toHaveTextContent("4 smokes");
    expect(tiles[0]).toHaveTextContent("0 smokes");
  });

  it("shows the credits in the footer", () => {
    renderAt("/");
    expect(screen.getByRole("contentinfo")).toHaveTextContent(
      "Counter-Strike 2, map names and radar images © Valve Corporation. Videos © their creators. Not affiliated with Valve.",
    );
  });

  it("shows Not found for unknown routes, with a way home", () => {
    renderAt("/nowhere");
    expect(screen.getByRole("heading", { name: "Not found" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to maps" })).toHaveAttribute("href", "/");
  });
});
```

(Mirage in `FIXTURE_DATA` has five smokes, one of them broken, so its tile says "4 smokes".)

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/app`
Expected: FAIL — `Failed to resolve import "../app/AppRoutes"`.

- [ ] **Step 3: Implement the shell**

`src/app/NotFound.tsx`:

```tsx
import { Link } from "react-router";
import styles from "./NotFound.module.css";

export interface BackLink {
  href: string;
  label: string;
}

export function NotFound({ backTo = { href: "/", label: "Back to maps" } }: { backTo?: BackLink }) {
  return (
    <section className={styles.page}>
      <h1>Not found</h1>
      <p>That page doesn't exist. It may have been renamed or removed.</p>
      <Link to={backTo.href}>{backTo.label}</Link>
    </section>
  );
}
```

`src/app/NotFound.module.css`:

```css
.page {
  display: grid;
  gap: 12px;
  padding: 32px 0;
}
```

`src/app/Layout.tsx`:

```tsx
import { Link, Outlet } from "react-router";
import styles from "./Layout.module.css";

export const CREDITS =
  "Counter-Strike 2, map names and radar images © Valve Corporation. Videos © their creators. Not affiliated with Valve.";

export function Layout() {
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <Link to="/" className={styles.brand}>
          CS Smokes
        </Link>
      </header>
      <main className={styles.main}>
        <Outlet />
      </main>
      <footer className={styles.footer}>{CREDITS}</footer>
    </div>
  );
}
```

`src/app/Layout.module.css`:

```css
.shell {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
}

.header {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--gap);
  padding: 12px 16px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
}

.brand {
  color: var(--text);
  font-weight: 700;
  text-decoration: none;
  letter-spacing: 0.02em;
}

.nav {
  display: flex;
  gap: 16px;
}

.nav a {
  color: var(--text-muted);
  text-decoration: none;
}

.nav a[aria-current="page"] {
  color: var(--text);
}

.main {
  flex: 1;
  width: 100%;
  max-width: 1400px;
  margin: 0 auto;
  padding: 16px;
}

.footer {
  padding: 16px;
  color: var(--text-muted);
  font-size: 0.8rem;
  text-align: center;
  border-top: 1px solid var(--border);
}
```

`src/features/home/HomePage.tsx`:

```tsx
import { Link } from "react-router";
import { getMapData } from "../../data";
import { MAPS } from "../../data/maps";
import { assetUrl } from "../../lib/assets";
import styles from "./HomePage.module.css";

export function HomePage() {
  return (
    <section>
      <h1 className={styles.title}>Maps</h1>
      <ul className={styles.grid} aria-label="Maps">
        {MAPS.map((map) => {
          const total = getMapData(map.id).lineups.filter((l) => l.status !== "broken").length;
          return (
            <li key={map.id}>
              <Link to={`/maps/${map.id}`} className={styles.tile}>
                <img src={assetUrl(map.radar)} alt="" loading="lazy" className={styles.thumb} />
                <span className={styles.name}>{map.name}</span>
                <span className={styles.count}>
                  {total} {total === 1 ? "smoke" : "smokes"}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
```

`src/features/home/HomePage.module.css`:

```css
.title {
  margin-bottom: 16px;
  font-size: 1.4rem;
}

.grid {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: var(--gap);
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
}

.tile {
  display: grid;
  gap: 6px;
  padding: 10px;
  border-radius: var(--radius);
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--text);
  text-decoration: none;
}

.tile:hover {
  border-color: var(--accent);
}

.thumb {
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  border-radius: 6px;
  background: #000;
}

.name {
  font-weight: 600;
}

.count {
  color: var(--text-muted);
  font-size: 0.85rem;
}
```

`src/app/AppRoutes.tsx`:

```tsx
import { Route, Routes } from "react-router";
import { HomePage } from "../features/home/HomePage";
import { Layout } from "./Layout";
import { NotFound } from "./NotFound";

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
```

`src/main.tsx` (replace the whole file):

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router";
import { AppRoutes } from "./app/AppRoutes";
import "./styles/global.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <HashRouter>
      <AppRoutes />
    </HashRouter>
  </StrictMode>,
);
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `npx vitest run src/app`
Expected: PASS.

- [ ] **Step 5: Build, lint and commit**

Run: `npm test && npm run format && npm run lint && npm run build`
Expected: all green; build succeeds.

```bash
git add src
git commit -m "feat: add app shell, home page and not-found page"
```

---

### Task 9: Radar math, filters, and the radar component

**Files:**
- Create: `src/lib/radar.ts`, `src/lib/filters.ts`, `src/features/map/Radar.tsx`, `src/features/map/Radar.module.css`, `src/features/map/markers.tsx`
- Test: `src/lib/radar.test.ts`, `src/lib/filters.test.ts`, `src/features/map/Radar.test.tsx`

**Interfaces:**
- Consumes: `MapInfo`, `radarPath`, `getMapInfo` (Task 2); `Lineup`, `Side`, `Area`, `Level`, `SIDES`, `AREAS`, `LEVELS` (Task 2); `assetUrl` (Task 2); `makeLineup` (Task 2).
- Produces:
  - `radar.ts`: `interface Point { x: number; y: number }`; `interface RectLike { left: number; top: number; width: number; height: number }`; `CLOSE_ENOUGH = 0.06`; `HIT_RADIUS_PX = 20` (a 40 px tap target); `pointerToFraction(clientX: number, clientY: number, rect: RectLike): Point` (clamped to 0–1); `distance(a: Point, b: Point): number`; `isClose(a: Point, b: Point): boolean`; `nearestWithin<T>(items: readonly T[], pointOf: (item: T) => Point, target: Point, maxDistance: number): T | undefined`.
  - `filters.ts`: `interface Filters { side: Side | "all"; area: Area | "all"; level: Level }`; `DEFAULT_FILTERS`; `parseFilters(params: URLSearchParams): Filters`; `filtersToSearch(filters: Filters): string` (`""` or `"?side=T&…"`, defaults left out); `applyFilters(lineups: readonly Lineup[], filters: Filters, withLevels: boolean): Lineup[]`; `neighbours(list: readonly Lineup[], id: string): { prev?: Lineup; next?: Lineup }`.
  - `Radar.tsx`: `interface RadarProps { map: MapInfo; level?: Level; label: string; onTap?: (point: Point, widthPx: number) => void; children?: ReactNode; className?: string }`; `Radar(props)` — the radar image (`alt={label}`) with an SVG overlay whose coordinates run 0–1000; the wrapper has `data-testid="radar"`.
  - `markers.tsx` (SVG children for `Radar`): `LandingMarker({ at: Point; side: Side; selected?: boolean; label?: string })` (`data-testid="landing-marker"`); `StandDot({ at: Point; side: Side })` (`data-testid="stand-dot"`); `StandLine({ from: Point; to: Point })` (`data-testid="stand-line"`); `TapMark({ at: Point; correct: boolean })` (`data-testid="tap-mark"`, `data-correct="true"|"false"`).

- [ ] **Step 1: Write the failing tests**

`src/lib/radar.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { CLOSE_ENOUGH, isClose, nearestWithin, pointerToFraction } from "./radar";

describe("pointerToFraction", () => {
  it("converts a pointer position into fractions of the element", () => {
    expect(pointerToFraction(150, 300, { left: 100, top: 100, width: 400, height: 400 })).toEqual({
      x: 0.125,
      y: 0.5,
    });
    expect(pointerToFraction(400, 250, { left: 0, top: 0, width: 800, height: 500 })).toEqual({
      x: 0.5,
      y: 0.5,
    });
  });

  it("clamps positions outside the element", () => {
    expect(pointerToFraction(-10, 900, { left: 0, top: 0, width: 400, height: 400 })).toEqual({
      x: 0,
      y: 1,
    });
  });
});

describe("isClose", () => {
  it("accepts a tap within 0.06 and rejects one farther away", () => {
    expect(CLOSE_ENOUGH).toBe(0.06);
    expect(isClose({ x: 0, y: 0 }, { x: 0.06, y: 0 })).toBe(true);
    expect(isClose({ x: 0, y: 0 }, { x: 0.05, y: 0.04 })).toBe(false);
  });
});

describe("nearestWithin", () => {
  const items = [
    { id: "a", p: { x: 0.1, y: 0.1 } },
    { id: "b", p: { x: 0.15, y: 0.1 } },
  ];

  it("picks the nearest item inside the radius", () => {
    expect(nearestWithin(items, (i) => i.p, { x: 0.14, y: 0.1 }, 0.05)?.id).toBe("b");
  });

  it("returns undefined when nothing is inside the radius", () => {
    expect(nearestWithin(items, (i) => i.p, { x: 0.9, y: 0.9 }, 0.05)).toBeUndefined();
  });
});
```

`src/lib/filters.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { makeLineup } from "../test/fixtures";
import { DEFAULT_FILTERS, applyFilters, filtersToSearch, neighbours, parseFilters } from "./filters";

describe("parseFilters", () => {
  it("reads valid values and falls back to defaults", () => {
    expect(parseFilters(new URLSearchParams("side=CT&area=B&level=lower"))).toEqual({
      side: "CT",
      area: "B",
      level: "lower",
    });
    expect(parseFilters(new URLSearchParams("side=X&area=&level=middle"))).toEqual(DEFAULT_FILTERS);
  });
});

describe("filtersToSearch", () => {
  it("writes only non-default values", () => {
    expect(filtersToSearch(DEFAULT_FILTERS)).toBe("");
    expect(filtersToSearch({ side: "T", area: "all", level: "lower" })).toBe("?side=T&level=lower");
  });
});

describe("applyFilters", () => {
  const a = makeLineup({ id: "mirage-a", side: "T", area: "A" });
  const b = makeLineup({ id: "mirage-b", side: "CT", area: "B" });

  it("filters by side and area", () => {
    expect(applyFilters([a, b], { ...DEFAULT_FILTERS, side: "CT" }, false)).toEqual([b]);
    expect(applyFilters([a, b], { ...DEFAULT_FILTERS, area: "A" }, false)).toEqual([a]);
  });

  it("filters by the landing spot's level only on maps with levels", () => {
    const upper = makeLineup({ id: "nuke-up", land: { x: 0.1, y: 0.1, level: "upper" } });
    const lower = makeLineup({ id: "nuke-low", land: { x: 0.1, y: 0.1, level: "lower" } });
    expect(applyFilters([upper, lower], DEFAULT_FILTERS, true)).toEqual([upper]);
    expect(applyFilters([upper, lower], { ...DEFAULT_FILTERS, level: "lower" }, true)).toEqual([
      lower,
    ]);
    expect(applyFilters([upper, lower], { ...DEFAULT_FILTERS, level: "lower" }, false)).toEqual([
      upper,
      lower,
    ]);
  });
});

describe("neighbours", () => {
  const list = ["a", "b", "c"].map((id) => makeLineup({ id: `mirage-${id}` }));

  it("finds the previous and next smoke", () => {
    expect(neighbours(list, "mirage-b")).toEqual({ prev: list[0], next: list[2] });
    expect(neighbours(list, "mirage-a")).toEqual({ prev: undefined, next: list[1] });
  });

  it("returns nothing for a smoke that isn't in the list", () => {
    expect(neighbours(list, "mirage-z")).toEqual({});
  });
});
```

`src/features/map/Radar.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { getMapInfo } from "../../data/maps";
import { Radar } from "./Radar";
import { LandingMarker, StandDot, StandLine, TapMark } from "./markers";

const mirage = getMapInfo("mirage")!;
const nuke = getMapInfo("nuke")!;

describe("Radar", () => {
  it("shows the radar image for the requested level", () => {
    const { rerender } = render(<Radar map={nuke} label="Nuke radar" />);
    expect(screen.getByRole("img", { name: "Nuke radar" }).getAttribute("src")).toContain(
      "radars/nuke.webp",
    );
    rerender(<Radar map={nuke} level="lower" label="Nuke radar" />);
    expect(screen.getByRole("img", { name: "Nuke radar" }).getAttribute("src")).toContain(
      "radars/nuke-lower.webp",
    );
  });

  it("reports taps as fractions of the radar, together with its width", () => {
    const onTap = vi.fn();
    render(<Radar map={mirage} label="Mirage radar" onTap={onTap} />);
    const radar = screen.getByTestId("radar");
    vi.spyOn(radar, "getBoundingClientRect").mockReturnValue({
      left: 100,
      top: 50,
      width: 400,
      height: 400,
    } as DOMRect);
    fireEvent.click(radar, { clientX: 300, clientY: 150 });
    expect(onTap).toHaveBeenCalledWith({ x: 0.5, y: 0.25 }, 400);
  });

  it("draws markers in a 0–1000 overlay", () => {
    render(
      <Radar map={mirage} label="Mirage radar">
        <LandingMarker at={{ x: 0.25, y: 0.5 }} side="CT" selected label="2" />
        <StandDot at={{ x: 0.75, y: 0.5 }} side="CT" />
        <StandLine from={{ x: 0.75, y: 0.5 }} to={{ x: 0.25, y: 0.5 }} />
        <TapMark at={{ x: 0.7, y: 0.5 }} correct={false} />
      </Radar>,
    );
    const landing = screen.getByTestId("landing-marker");
    expect(landing).toHaveAttribute("data-side", "CT");
    expect(landing).toHaveAttribute("data-selected", "true");
    expect(landing.querySelector("circle")).toHaveAttribute("cx", "250");
    expect(landing).toHaveTextContent("2");
    expect(screen.getByTestId("stand-dot")).toHaveAttribute("cx", "750");
    expect(screen.getByTestId("stand-line")).toHaveAttribute("x2", "250");
    expect(screen.getByTestId("tap-mark")).toHaveAttribute("data-correct", "false");
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/lib/radar.test.ts src/lib/filters.test.ts src/features/map`
Expected: FAIL — `Failed to resolve import "./radar"`, `"./filters"`, `"./Radar"`.

- [ ] **Step 3: Implement radar math and filters**

`src/lib/radar.ts`:

```ts
export interface Point {
  x: number;
  y: number;
}

export interface RectLike {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Study: a "where do you stand" tap counts as right within this fraction of the radar width. */
export const CLOSE_ENOUGH = 0.06;

/** Map view: a tap selects a landing marker within this many pixels (a 40 px target). */
export const HIT_RADIUS_PX = 20;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export function pointerToFraction(clientX: number, clientY: number, rect: RectLike): Point {
  return {
    x: clamp01((clientX - rect.left) / rect.width),
    y: clamp01((clientY - rect.top) / rect.height),
  };
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function isClose(a: Point, b: Point): boolean {
  return distance(a, b) <= CLOSE_ENOUGH;
}

export function nearestWithin<T>(
  items: readonly T[],
  pointOf: (item: T) => Point,
  target: Point,
  maxDistance: number,
): T | undefined {
  let best: T | undefined;
  let bestDistance = Infinity;
  for (const item of items) {
    const d = distance(pointOf(item), target);
    if (d <= maxDistance && d < bestDistance) {
      best = item;
      bestDistance = d;
    }
  }
  return best;
}
```

`src/lib/filters.ts`:

```ts
import {
  AREAS,
  LEVELS,
  SIDES,
  type Area,
  type Level,
  type Lineup,
  type Side,
} from "../data/schema";

export interface Filters {
  side: Side | "all";
  area: Area | "all";
  level: Level;
}

export const DEFAULT_FILTERS: Filters = { side: "all", area: "all", level: "upper" };

const oneOf = <T extends string>(options: readonly T[], value: string | null): T | undefined =>
  options.find((option) => option === value);

export function parseFilters(params: URLSearchParams): Filters {
  return {
    side: oneOf(SIDES, params.get("side")) ?? "all",
    area: oneOf(AREAS, params.get("area")) ?? "all",
    level: oneOf(LEVELS, params.get("level")) ?? "upper",
  };
}

export function filtersToSearch(filters: Filters): string {
  const params = new URLSearchParams();
  if (filters.side !== "all") params.set("side", filters.side);
  if (filters.area !== "all") params.set("area", filters.area);
  if (filters.level !== "upper") params.set("level", filters.level);
  const text = params.toString();
  return text ? `?${text}` : "";
}

export function applyFilters(
  lineups: readonly Lineup[],
  filters: Filters,
  withLevels: boolean,
): Lineup[] {
  return lineups.filter(
    (lineup) =>
      (filters.side === "all" || lineup.side === filters.side) &&
      (filters.area === "all" || lineup.area === filters.area) &&
      (!withLevels || (lineup.land.level ?? "upper") === filters.level),
  );
}

export function neighbours(list: readonly Lineup[], id: string): { prev?: Lineup; next?: Lineup } {
  const index = list.findIndex((lineup) => lineup.id === id);
  if (index === -1) return {};
  return { prev: list[index - 1], next: list[index + 1] };
}
```

- [ ] **Step 4: Implement the radar component and markers**

`src/features/map/Radar.tsx`:

```tsx
import { useRef, type MouseEvent, type ReactNode } from "react";
import { radarPath, type MapInfo } from "../../data/maps";
import type { Level } from "../../data/schema";
import { assetUrl } from "../../lib/assets";
import { pointerToFraction, type Point } from "../../lib/radar";
import styles from "./Radar.module.css";

export interface RadarProps {
  map: MapInfo;
  level?: Level;
  /** Accessible name of the radar image, e.g. "Mirage radar". */
  label: string;
  onTap?: (point: Point, widthPx: number) => void;
  /** SVG content drawn in a 0–1000 coordinate space (see markers.tsx). */
  children?: ReactNode;
  className?: string;
}

export function Radar({ map, level = "upper", label, onTap, children, className }: RadarProps) {
  const ref = useRef<HTMLDivElement>(null);

  function handleClick(event: MouseEvent<HTMLDivElement>) {
    if (!onTap || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    onTap(pointerToFraction(event.clientX, event.clientY, rect), rect.width);
  }

  return (
    <div
      ref={ref}
      className={[styles.radar, className].filter(Boolean).join(" ")}
      onClick={handleClick}
      data-testid="radar"
    >
      <img src={assetUrl(radarPath(map, level))} alt={label} draggable={false} />
      <svg viewBox="0 0 1000 1000" className={styles.overlay} aria-hidden="true">
        {children}
      </svg>
    </div>
  );
}
```

`src/features/map/markers.tsx`:

```tsx
import type { Side } from "../../data/schema";
import type { Point } from "../../lib/radar";
import styles from "./Radar.module.css";

/** Fraction (0–1) → overlay units (0–1000), one decimal. */
const units = (fraction: number) => Math.round(fraction * 10000) / 10;

export function LandingMarker({
  at,
  side,
  selected = false,
  label,
}: {
  at: Point;
  side: Side;
  selected?: boolean;
  label?: string;
}) {
  const cx = units(at.x);
  const cy = units(at.y);
  return (
    <g
      className={styles.landing}
      data-testid="landing-marker"
      data-side={side}
      data-selected={selected ? "true" : undefined}
    >
      <circle cx={cx} cy={cy} r={24} />
      {label && (
        <text x={cx} y={cy} dy="0.35em" textAnchor="middle">
          {label}
        </text>
      )}
    </g>
  );
}

export function StandDot({ at, side }: { at: Point; side: Side }) {
  return (
    <circle
      className={styles.stand}
      data-testid="stand-dot"
      data-side={side}
      cx={units(at.x)}
      cy={units(at.y)}
      r={10}
    />
  );
}

export function StandLine({ from, to }: { from: Point; to: Point }) {
  return (
    <line
      className={styles.line}
      data-testid="stand-line"
      x1={units(from.x)}
      y1={units(from.y)}
      x2={units(to.x)}
      y2={units(to.y)}
    />
  );
}

export function TapMark({ at, correct }: { at: Point; correct: boolean }) {
  const x = units(at.x);
  const y = units(at.y);
  const d = 14;
  return (
    <g className={styles.tap} data-testid="tap-mark" data-correct={String(correct)}>
      <line x1={x - d} y1={y - d} x2={x + d} y2={y + d} />
      <line x1={x - d} y1={y + d} x2={x + d} y2={y - d} />
    </g>
  );
}
```

`src/features/map/Radar.module.css`:

```css
.radar {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  overflow: hidden;
  background: #000;
  border-radius: var(--radius);
  user-select: none;
  touch-action: manipulation;
}

.radar img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.overlay {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.landing circle {
  fill: color-mix(in srgb, var(--t-color) 35%, transparent);
  stroke: var(--t-color);
  stroke-width: 3;
}

.landing[data-side="CT"] circle {
  fill: color-mix(in srgb, var(--ct-color) 35%, transparent);
  stroke: var(--ct-color);
}

.landing[data-selected="true"] circle {
  stroke: #fff;
  stroke-width: 6;
}

.landing text {
  fill: #fff;
  font-size: 26px;
  font-weight: 700;
}

.stand {
  fill: var(--t-color);
  stroke: #000;
  stroke-width: 3;
}

.stand[data-side="CT"] {
  fill: var(--ct-color);
}

.line {
  stroke: #fff;
  stroke-width: 3;
  stroke-dasharray: 10 8;
  opacity: 0.85;
}

.tap line {
  stroke: var(--ok);
  stroke-width: 5;
}

.tap[data-correct="false"] line {
  stroke: var(--bad);
}
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `npx vitest run src/lib/radar.test.ts src/lib/filters.test.ts src/features/map`
Expected: PASS.

- [ ] **Step 6: Lint and commit**

Run: `npm test && npm run format && npm run lint`

```bash
git add src
git commit -m "feat: add radar component, radar math and map filters"
```

---

### Task 10: YouTube clip player

**Files:**
- Create: `src/features/smoke/youtubeApi.ts`, `src/features/smoke/VideoPlayer.tsx`, `src/features/smoke/VideoPlayer.module.css`
- Test: `src/features/smoke/youtubeApi.test.ts`, `src/features/smoke/VideoPlayer.test.tsx`

**Interfaces:**
- Consumes: `Video` (Task 2); `parseYouTubeUrl`, `effectiveStart` (Task 3).
- Produces:
  - `youtubeApi.ts`: `interface YTPlayer { playVideo(): void; pauseVideo(): void; seekTo(seconds: number, allowSeekAhead: boolean): void; getCurrentTime(): number; setPlaybackRate(rate: number): void; mute(): void; destroy(): void }`; `interface YTPlayerOptions { host: string; videoId: string; width?: string | number; height?: string | number; playerVars: Record<string, string | number>; events: { onReady?: (e: { target: YTPlayer }) => void; onStateChange?: (e: { data: number; target: YTPlayer }) => void; onError?: (e: { data: number }) => void } }`; `interface YTNamespace { Player: new (element: HTMLElement, options: YTPlayerOptions) => YTPlayer; PlayerState: { ENDED: number } }`; `loadYouTubeApi(timeoutMs?: number): Promise<YTNamespace>` (adds `https://www.youtube.com/iframe_api` once; rejects on load error or after 10 s; a failed load can be retried).
  - `VideoPlayer.tsx`: `interface VideoPlayerProps { video: Video; title: string; autoplay?: boolean }`; `VideoPlayer(props)` — YouTube: looping clip with "↻ Replay", "0.5×", "1×" buttons; other sites: an "Open video ↗" link; failures: "Video unavailable." with an "Open the link ↗" link.

- [ ] **Step 1: Write the failing loader tests**

`src/features/smoke/youtubeApi.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";

const SCRIPT = 'script[src="https://www.youtube.com/iframe_api"]';

async function freshModule() {
  vi.resetModules();
  return import("./youtubeApi");
}

afterEach(() => {
  delete window.YT;
  delete window.onYouTubeIframeAPIReady;
  document.head.querySelectorAll(SCRIPT).forEach((script) => script.remove());
});

describe("loadYouTubeApi", () => {
  it("uses an API that is already loaded", async () => {
    const yt = { Player: vi.fn(), PlayerState: { ENDED: 0 } };
    window.YT = yt as unknown as Window["YT"];
    const { loadYouTubeApi } = await freshModule();
    await expect(loadYouTubeApi()).resolves.toBe(yt);
    expect(document.head.querySelector(SCRIPT)).toBeNull();
  });

  it("adds the script once and resolves when the API is ready", async () => {
    const { loadYouTubeApi } = await freshModule();
    const first = loadYouTubeApi();
    const second = loadYouTubeApi();
    expect(document.head.querySelectorAll(SCRIPT)).toHaveLength(1);
    const yt = { Player: vi.fn(), PlayerState: { ENDED: 0 } };
    window.YT = yt as unknown as Window["YT"];
    window.onYouTubeIframeAPIReady?.();
    await expect(first).resolves.toBe(yt);
    await expect(second).resolves.toBe(yt);
  });

  it("rejects when the script fails to load, and can try again", async () => {
    const { loadYouTubeApi } = await freshModule();
    const attempt = loadYouTubeApi();
    document.head.querySelector<HTMLScriptElement>(SCRIPT)!.dispatchEvent(new Event("error"));
    await expect(attempt).rejects.toThrow("YouTube API failed to load");
    loadYouTubeApi().catch(() => undefined);
    expect(document.head.querySelectorAll(SCRIPT)).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/features/smoke/youtubeApi.test.ts`
Expected: FAIL — `Failed to resolve import "./youtubeApi"`.

- [ ] **Step 3: Implement `src/features/smoke/youtubeApi.ts`**

```ts
export interface YTPlayer {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  setPlaybackRate(rate: number): void;
  mute(): void;
  destroy(): void;
}

export interface YTPlayerOptions {
  host: string;
  videoId: string;
  width?: string | number;
  height?: string | number;
  playerVars: Record<string, string | number>;
  events: {
    onReady?: (event: { target: YTPlayer }) => void;
    onStateChange?: (event: { data: number; target: YTPlayer }) => void;
    onError?: (event: { data: number }) => void;
  };
}

export interface YTNamespace {
  Player: new (element: HTMLElement, options: YTPlayerOptions) => YTPlayer;
  PlayerState: { ENDED: number };
}

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

const API_SRC = "https://www.youtube.com/iframe_api";
let pending: Promise<YTNamespace> | null = null;

/** Loads the YouTube IFrame Player API once. A failed load can be retried. */
export function loadYouTubeApi(timeoutMs = 10_000): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (pending) return pending;

  pending = new Promise<YTNamespace>((resolve, reject) => {
    const fail = (message: string) => {
      window.clearTimeout(timer);
      pending = null;
      reject(new Error(message));
    };
    const timer = window.setTimeout(() => fail("YouTube API timed out"), timeoutMs);
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      window.clearTimeout(timer);
      if (window.YT) resolve(window.YT);
      else fail("YouTube API loaded without YT");
    };
    const script = document.createElement("script");
    script.src = API_SRC;
    script.async = true;
    script.onerror = () => fail("YouTube API failed to load");
    document.head.appendChild(script);
  });
  return pending;
}
```

Run: `npx vitest run src/features/smoke/youtubeApi.test.ts`
Expected: PASS.

- [ ] **Step 4: Write the failing player tests**

`src/features/smoke/VideoPlayer.test.tsx` (the "video ends before the clip end" test covers Review Focus 2):

```tsx
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VideoPlayer } from "./VideoPlayer";
import type { YTNamespace, YTPlayerOptions } from "./youtubeApi";

const api = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock("./youtubeApi", () => ({ loadYouTubeApi: api.load }));

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

type FakePlayer = ReturnType<typeof fakePlayer>;
let created: { options: YTPlayerOptions; player: FakePlayer }[] = [];
const ENDED = 0;
const VIDEO = { url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", start: 95, end: 112 };

beforeEach(() => {
  created = [];
  const Player = vi.fn(function (_element: HTMLElement, options: YTPlayerOptions) {
    const player = fakePlayer();
    created.push({ options, player });
    return player;
  });
  api.load.mockResolvedValue({ Player, PlayerState: { ENDED } } as unknown as YTNamespace);
});

afterEach(() => {
  vi.useRealTimers();
});

async function renderReady() {
  render(<VideoPlayer video={VIDEO} title="Window from T Spawn" />);
  await waitFor(() => expect(created).toHaveLength(1));
  const { options, player } = created[0];
  act(() => options.events.onReady?.({ target: player }));
  return { options, player };
}

describe("VideoPlayer", () => {
  it("links out for videos that are not on YouTube", () => {
    render(<VideoPlayer video={{ url: "https://csnades.gg/mirage/smokes/top-mid" }} title="Top Mid" />);
    expect(screen.getByRole("link", { name: "Open video ↗" })).toHaveAttribute(
      "href",
      "https://csnades.gg/mirage/smokes/top-mid",
    );
    expect(api.load).not.toHaveBeenCalled();
  });

  it("creates a muted, inline, privacy-enhanced player at the clip start", async () => {
    const { options } = await renderReady();
    expect(options.host).toBe("https://www.youtube-nocookie.com");
    expect(options.videoId).toBe("dQw4w9WgXcQ");
    expect(options.playerVars).toMatchObject({ start: 95, playsinline: 1, rel: 0, mute: 1, autoplay: 1 });
  });

  it("starts playing, muted, when ready", async () => {
    const { player } = await renderReady();
    expect(player.mute).toHaveBeenCalled();
    expect(player.playVideo).toHaveBeenCalledTimes(1);
  });

  it("replays from the clip start", async () => {
    const { player } = await renderReady();
    await userEvent.click(screen.getByRole("button", { name: "↻ Replay" }));
    expect(player.seekTo).toHaveBeenCalledWith(95, true);
  });

  it("switches between 0.5× and 1×", async () => {
    const { player } = await renderReady();
    await userEvent.click(screen.getByRole("button", { name: "0.5×" }));
    expect(player.setPlaybackRate).toHaveBeenCalledWith(0.5);
    expect(screen.getByRole("button", { name: "0.5×" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "1×" })).toHaveAttribute("aria-pressed", "false");
  });

  it("jumps back to the start when the clip end is reached", async () => {
    render(<VideoPlayer video={VIDEO} title="Window" />);
    await waitFor(() => expect(created).toHaveLength(1));
    vi.useFakeTimers();
    const { options, player } = created[0];
    act(() => options.events.onReady?.({ target: player }));
    player.getCurrentTime.mockReturnValue(112);
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(player.seekTo).toHaveBeenCalledWith(95, true);
  });

  it("loops when the video ends before the clip end", async () => {
    const { options, player } = await renderReady();
    act(() => options.events.onStateChange?.({ data: ENDED, target: player }));
    expect(player.seekTo).toHaveBeenCalledWith(95, true);
    expect(player.playVideo).toHaveBeenCalledTimes(2);
  });

  it("shows a fallback when the player reports an error", async () => {
    const { options } = await renderReady();
    act(() => options.events.onError?.({ data: 150 }));
    expect(screen.getByText(/Video unavailable/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open the link ↗" })).toHaveAttribute("href", VIDEO.url);
  });

  it("shows the fallback when the API cannot load", async () => {
    api.load.mockRejectedValue(new Error("blocked"));
    render(<VideoPlayer video={VIDEO} title="Window" />);
    expect(await screen.findByText(/Video unavailable/)).toBeInTheDocument();
  });

  it("destroys the player when unmounted", async () => {
    const view = render(<VideoPlayer video={VIDEO} title="Window" />);
    await waitFor(() => expect(created).toHaveLength(1));
    view.unmount();
    expect(created[0].player.destroy).toHaveBeenCalled();
  });
});
```

- [ ] **Step 5: Run them to see them fail**

Run: `npx vitest run src/features/smoke/VideoPlayer.test.tsx`
Expected: FAIL — `Failed to resolve import "./VideoPlayer"`.

- [ ] **Step 6: Implement the player**

`src/features/smoke/VideoPlayer.tsx`:

```tsx
import { useEffect, useRef, useState } from "react";
import type { Video } from "../../data/schema";
import { effectiveStart, parseYouTubeUrl } from "../../lib/youtube";
import { loadYouTubeApi, type YTPlayer } from "./youtubeApi";
import styles from "./VideoPlayer.module.css";

const SPEEDS = [0.5, 1] as const;
const LOOP_CHECK_MS = 250;

export interface VideoPlayerProps {
  video: Video;
  /** Used in the player's label, e.g. "Window from T Spawn". */
  title: string;
  autoplay?: boolean;
}

export function VideoPlayer({ video, title, autoplay = true }: VideoPlayerProps) {
  const ref = parseYouTubeUrl(video.url);
  if (!ref) {
    return (
      <a className={styles.external} href={video.url} target="_blank" rel="noreferrer">
        Open video ↗
      </a>
    );
  }
  const start = effectiveStart(video);
  return (
    <YouTubeClip
      key={`${ref.id}:${start}:${video.end ?? ""}`}
      videoId={ref.id}
      start={start}
      end={video.end}
      url={video.url}
      title={title}
      autoplay={autoplay}
    />
  );
}

interface ClipProps {
  videoId: string;
  start: number;
  end?: number;
  url: string;
  title: string;
  autoplay: boolean;
}

function YouTubeClip({ videoId, start, end, url, title, autoplay }: ClipProps) {
  const host = useRef<HTMLDivElement>(null);
  const player = useRef<YTPlayer | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [speed, setSpeed] = useState<number>(1);

  useEffect(() => {
    let cancelled = false;
    let instance: YTPlayer | null = null;
    let timer: number | undefined;

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
          playerVars: { start, playsinline: 1, rel: 0, mute: 1, autoplay: autoplay ? 1 : 0 },
          events: {
            onReady: ({ target }) => {
              if (cancelled) return;
              player.current = target;
              target.mute();
              if (autoplay) target.playVideo();
              setStatus("ready");
              if (end !== undefined) {
                timer = window.setInterval(() => {
                  if (target.getCurrentTime() >= end) target.seekTo(start, true);
                }, LOOP_CHECK_MS);
              }
            },
            onStateChange: ({ data, target }) => {
              if (data === YT.PlayerState.ENDED) {
                target.seekTo(start, true);
                target.playVideo();
              }
            },
            onError: () => {
              if (!cancelled) setStatus("error");
            },
          },
        });
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearInterval(timer);
      instance?.destroy();
      player.current = null;
    };
  }, [videoId, start, end, autoplay]);

  if (status === "error") {
    return (
      <div className={styles.unavailable} role="status">
        Video unavailable.{" "}
        <a href={url} target="_blank" rel="noreferrer">
          Open the link ↗
        </a>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.frame} ref={host} title={`Video: ${title}`} data-testid="video-frame" />
      <div className={styles.controls}>
        <button
          type="button"
          disabled={status !== "ready"}
          onClick={() => {
            player.current?.seekTo(start, true);
            player.current?.playVideo();
          }}
        >
          ↻ Replay
        </button>
        {SPEEDS.map((rate) => (
          <button
            key={rate}
            type="button"
            aria-pressed={speed === rate}
            disabled={status !== "ready"}
            onClick={() => {
              player.current?.setPlaybackRate(rate);
              setSpeed(rate);
            }}
          >
            {rate}×
          </button>
        ))}
      </div>
    </div>
  );
}
```

`src/features/smoke/VideoPlayer.module.css`:

```css
.wrap {
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

.controls {
  display: flex;
  gap: 8px;
}

.controls button {
  padding: 6px 12px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface-2);
}

.controls button[aria-pressed="true"] {
  border-color: var(--accent);
  color: var(--accent);
}

.unavailable {
  padding: 16px;
  border-radius: var(--radius);
  background: var(--surface-2);
  color: var(--text-muted);
}

.external {
  display: inline-block;
  padding: 10px 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface-2);
  text-decoration: none;
}
```

- [ ] **Step 7: Run the tests to see them pass**

Run: `npx vitest run src/features/smoke`
Expected: PASS.

- [ ] **Step 8: Lint and commit**

Run: `npm test && npm run format && npm run lint`

```bash
git add src/features/smoke
git commit -m "feat: add looping YouTube clip player"
```

---

### Task 11: Smoke card

**Files:**
- Create: `src/features/smoke/StatusBadge.tsx`, `src/features/smoke/StatusBadge.module.css`, `src/features/smoke/SmokeCard.tsx`, `src/features/smoke/SmokeCard.module.css`
- Test: `src/features/smoke/SmokeCard.test.tsx`

**Interfaces:**
- Consumes: `MapInfo`, `getMapInfo` (Task 2); `Lineup`, `Status` (Task 2); `techniqueText` (Task 3); `parseYouTubeUrl`, `effectiveStart`, `watchUrl` (Task 3); `Radar`, `LandingMarker`, `StandDot`, `StandLine` (Task 9); `VideoPlayer` (Task 10); `makeLineup` (Task 2).
- Produces: `StatusBadge({ status: Status })` (labels "Unreviewed", "Checked", "Broken"); `interface SmokeCardProps { map: MapInfo; lineup: Lineup; variant?: "page" | "embedded"; closeHref?: string; prevHref?: string; nextHref?: string }`; `SmokeCard(props)`. In `page` variant the header has a "Back to the list" link (when `closeHref` is set) and two pager links named "Previous smoke" and "Next smoke"; a missing href renders `role="link" aria-disabled="true"` instead.

- [ ] **Step 1: Write the failing tests**

`src/features/smoke/SmokeCard.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { getMapInfo } from "../../data/maps";
import { makeLineup } from "../../test/fixtures";
import { SmokeCard, type SmokeCardProps } from "./SmokeCard";

vi.mock("./VideoPlayer", () => ({
  VideoPlayer: ({ title }: { title: string }) => <div data-testid="video">{title}</div>,
}));

const mirage = getMapInfo("mirage")!;
const nuke = getMapInfo("nuke")!;

function renderCard(props: Partial<SmokeCardProps> = {}) {
  return render(
    <MemoryRouter>
      <SmokeCard map={mirage} lineup={makeLineup()} {...props} />
    </MemoryRouter>,
  );
}

describe("SmokeCard", () => {
  it("shows the name, throw spot, technique, notes, status and video", () => {
    renderCard();
    expect(screen.getByRole("heading", { name: "Window" })).toBeInTheDocument();
    expect(screen.getByText("from T Spawn")).toBeInTheDocument();
    expect(screen.getByText("Jump throw · left click")).toBeInTheDocument();
    expect(screen.getByText("Aim at the top-left corner of the antenna")).toBeInTheDocument();
    expect(screen.getByText("Unreviewed")).toBeInTheDocument();
    expect(screen.getByText("Last checked 2026-10-10")).toBeInTheDocument();
    expect(screen.getByTestId("video")).toHaveTextContent("Window from T Spawn");
  });

  it("links to YouTube at the clip start", () => {
    renderCard();
    expect(screen.getByRole("link", { name: "Open on YouTube ↗" })).toHaveAttribute(
      "href",
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=95s",
    );
  });

  it("has no YouTube link for videos on other sites", () => {
    renderCard({ lineup: makeLineup({ video: { url: "https://csnades.gg/mirage/smokes/window" } }) });
    expect(screen.queryByRole("link", { name: "Open on YouTube ↗" })).toBeNull();
  });

  it("links to the previous smoke, the list, and disables a missing next smoke", () => {
    renderCard({ prevHref: "/maps/mirage/smokes/mirage-a", closeHref: "/maps/mirage" });
    expect(screen.getByRole("link", { name: "Previous smoke" })).toHaveAttribute(
      "href",
      "/maps/mirage/smokes/mirage-a",
    );
    expect(screen.getByRole("link", { name: "Next smoke" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("link", { name: "Back to the list" })).toHaveAttribute(
      "href",
      "/maps/mirage",
    );
  });

  it("draws the stand spot, the line and the landing spot on the mini radar", () => {
    renderCard();
    expect(screen.getByTestId("landing-marker")).toBeInTheDocument();
    expect(screen.getByTestId("stand-dot")).toBeInTheDocument();
    expect(screen.getByTestId("stand-line")).toBeInTheDocument();
  });

  it("uses the landing level's radar and leaves out a stand spot on the other level", () => {
    renderCard({
      map: nuke,
      lineup: makeLineup({
        id: "nuke-ramp-from-lobby",
        stand: { x: 0.3, y: 0.6, level: "upper" },
        land: { x: 0.4, y: 0.7, level: "lower" },
      }),
    });
    expect(screen.getByRole("img", { name: /radar/ }).getAttribute("src")).toContain("nuke-lower");
    expect(screen.queryByTestId("stand-dot")).toBeNull();
    expect(screen.queryByTestId("stand-line")).toBeNull();
  });

  it("has no header or navigation in the embedded variant", () => {
    renderCard({ variant: "embedded" });
    expect(screen.queryByRole("heading")).toBeNull();
    expect(screen.queryByRole("link", { name: "Previous smoke" })).toBeNull();
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/features/smoke/SmokeCard.test.tsx`
Expected: FAIL — `Failed to resolve import "./SmokeCard"`.

- [ ] **Step 3: Implement the badge and the card**

`src/features/smoke/StatusBadge.tsx`:

```tsx
import type { Status } from "../../data/schema";
import styles from "./StatusBadge.module.css";

const LABELS: Record<Status, string> = {
  unreviewed: "Unreviewed",
  ok: "Checked",
  broken: "Broken",
};

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={styles.badge} data-status={status}>
      {LABELS[status]}
    </span>
  );
}
```

`src/features/smoke/StatusBadge.module.css`:

```css
.badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 0.75rem;
  border: 1px solid currentColor;
}

.badge[data-status="unreviewed"] {
  color: var(--warn);
}

.badge[data-status="ok"] {
  color: var(--ok);
}

.badge[data-status="broken"] {
  color: var(--bad);
}
```

`src/features/smoke/SmokeCard.tsx`:

```tsx
import { Link } from "react-router";
import type { MapInfo } from "../../data/maps";
import type { Lineup } from "../../data/schema";
import { techniqueText } from "../../lib/technique";
import { effectiveStart, parseYouTubeUrl, watchUrl } from "../../lib/youtube";
import { Radar } from "../map/Radar";
import { LandingMarker, StandDot, StandLine } from "../map/markers";
import { StatusBadge } from "./StatusBadge";
import { VideoPlayer } from "./VideoPlayer";
import styles from "./SmokeCard.module.css";

export interface SmokeCardProps {
  map: MapInfo;
  lineup: Lineup;
  /** "page": header and navigation. "embedded": content only (used inside execute rows). */
  variant?: "page" | "embedded";
  closeHref?: string;
  prevHref?: string;
  nextHref?: string;
}

export function SmokeCard({
  map,
  lineup,
  variant = "page",
  closeHref,
  prevHref,
  nextHref,
}: SmokeCardProps) {
  const youtube = parseYouTubeUrl(lineup.video.url);
  const level = lineup.land.level ?? "upper";
  const standOnSameLevel = (lineup.stand.level ?? "upper") === level;
  const title = `${lineup.name} from ${lineup.from}`;

  return (
    <article className={styles.card} aria-label={title}>
      {variant === "page" && (
        <header className={styles.header}>
          {closeHref && (
            <Link to={closeHref} className={styles.close} aria-label="Back to the list">
              ←
            </Link>
          )}
          <div className={styles.titles}>
            <h2>{lineup.name}</h2>
            <p className={styles.from}>from {lineup.from}</p>
          </div>
          <span className={styles.side} data-side={lineup.side}>
            {lineup.side}
          </span>
          <nav className={styles.pager} aria-label="Smoke navigation">
            <PagerLink href={prevHref} label="Previous smoke" text="‹" />
            <PagerLink href={nextHref} label="Next smoke" text="›" />
          </nav>
        </header>
      )}

      <VideoPlayer video={lineup.video} title={title} />
      <p className={styles.technique}>{techniqueText(lineup.throw)}</p>
      {lineup.notes && <p className={styles.notes}>{lineup.notes}</p>}

      <div className={styles.meta}>
        <div className={styles.mini}>
          <Radar map={map} level={level} label={`${lineup.name} on the ${map.name} radar`}>
            {standOnSameLevel && <StandLine from={lineup.stand} to={lineup.land} />}
            <LandingMarker at={lineup.land} side={lineup.side} selected />
            {standOnSameLevel && <StandDot at={lineup.stand} side={lineup.side} />}
          </Radar>
        </div>
        <div className={styles.facts}>
          <StatusBadge status={lineup.status} />
          <span className={styles.checked}>Last checked {lineup.checkedOn}</span>
          {youtube && (
            <a
              href={watchUrl(youtube.id, effectiveStart(lineup.video))}
              target="_blank"
              rel="noreferrer"
            >
              Open on YouTube ↗
            </a>
          )}
        </div>
      </div>
    </article>
  );
}

function PagerLink({ href, label, text }: { href?: string; label: string; text: string }) {
  if (!href) {
    return (
      <span role="link" aria-label={label} aria-disabled="true" className={styles.pagerLink}>
        {text}
      </span>
    );
  }
  return (
    <Link to={href} aria-label={label} className={styles.pagerLink}>
      {text}
    </Link>
  );
}
```

`src/features/smoke/SmokeCard.module.css`:

```css
.card {
  display: grid;
  gap: 12px;
}

.header {
  display: flex;
  align-items: center;
  gap: 12px;
}

.close {
  font-size: 1.4rem;
  text-decoration: none;
  color: var(--text-muted);
}

.titles {
  flex: 1;
  min-width: 0;
}

.titles h2 {
  font-size: 1.3rem;
  overflow-wrap: anywhere;
}

.from {
  margin: 2px 0 0;
  color: var(--text-muted);
}

.side {
  padding: 2px 10px;
  border-radius: 999px;
  font-weight: 700;
  background: var(--t-color);
  color: #000;
}

.side[data-side="CT"] {
  background: var(--ct-color);
}

.pager {
  display: flex;
  gap: 4px;
}

.pagerLink {
  display: inline-grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 8px;
  background: var(--surface-2);
  color: var(--text);
  font-size: 1.4rem;
  text-decoration: none;
}

.pagerLink[aria-disabled="true"] {
  opacity: 0.35;
}

.technique {
  margin: 0;
  font-weight: 600;
}

.notes {
  margin: 0;
  color: var(--text-muted);
  overflow-wrap: anywhere;
}

.meta {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}

.mini {
  width: 160px;
  flex: none;
}

.facts {
  display: grid;
  gap: 6px;
  justify-items: start;
  font-size: 0.9rem;
}

.checked {
  color: var(--text-muted);
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `npx vitest run src/features/smoke`
Expected: PASS.

- [ ] **Step 5: Lint and commit**

Run: `npm test && npm run format && npm run lint`

```bash
git add src/features/smoke
git commit -m "feat: add smoke card"
```

---

### Task 12: Map page

**Files:**
- Create: `src/features/map/FiltersBar.tsx`, `src/features/map/LineupList.tsx`, `src/features/map/MapPage.tsx`, `src/features/map/MapPage.module.css`
- Modify: `src/app/AppRoutes.tsx` (add the map routes)
- Test: `src/features/map/MapPage.test.tsx`

**Interfaces:**
- Consumes: `getMapData`, `findLineup` from `src/data` (Task 4); `getMapInfo`, `hasLevels`, `MapInfo` (Task 2); `Filters`, `parseFilters`, `filtersToSearch`, `applyFilters`, `neighbours` (Task 9); `HIT_RADIUS_PX`, `nearestWithin`, `Point` (Task 9); `Radar`, `LandingMarker`, `StandDot`, `StandLine` (Task 9); `SmokeCard` (Task 11); `StatusBadge` (Task 11); `techniqueText` (Task 3); `NotFound` (Task 8); `renderAt`, `mockDataModule` (Tasks 8, 4).
- Produces: `FiltersBar({ map, filters, onChange })` — button groups named "Side", "Area" and (Nuke only) "Level", each button with `aria-pressed`; `LineupList({ mapId, lineups, search, emptyText })` — `<ul aria-label="Smokes">` of links to `/maps/<mapId>/smokes/<id><search>`; `MapPage()` — handles `/maps/:mapId` and `/maps/:mapId/smokes/:lineupId`; CSS classes `page`, `radarCol`, `panel`, `filters`, `segmented`, `list`, `row`, `empty` in `MapPage.module.css` (Task 20 adds tabs).

- [ ] **Step 1: Write the failing tests**

`src/features/map/MapPage.test.tsx` (the filtered-out deep link test covers Review Focus 3):

```tsx
import { fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderAt } from "../../test/render";

vi.mock("../../data", async () => (await import("../../test/fixtureData")).mockDataModule());
vi.mock("../smoke/VideoPlayer", () => ({
  VideoPlayer: ({ title }: { title: string }) => <div data-testid="video">{title}</div>,
}));

const smokeRows = () => within(screen.getByRole("list", { name: "Smokes" })).getAllByRole("link");
const currentLocation = () => screen.getByTestId("location").textContent;

function mockRadarSize(size: number) {
  vi.spyOn(screen.getByTestId("radar"), "getBoundingClientRect").mockReturnValue({
    left: 0,
    top: 0,
    width: size,
    height: size,
  } as DOMRect);
}

describe("MapPage", () => {
  it("shows every smoke on the radar and in the list", () => {
    renderAt("/maps/mirage");
    expect(screen.getByRole("heading", { name: "Mirage", level: 1 })).toBeInTheDocument();
    expect(smokeRows()).toHaveLength(5);
    expect(screen.getAllByTestId("landing-marker")).toHaveLength(5);
  });

  it("filters by side through the URL", async () => {
    renderAt("/maps/mirage");
    const sides = within(screen.getByRole("group", { name: "Side" }));
    await userEvent.click(sides.getByRole("button", { name: "CT" }));
    expect(currentLocation()).toBe("/maps/mirage?side=CT");
    expect(sides.getByRole("button", { name: "CT" })).toHaveAttribute("aria-pressed", "true");
    expect(smokeRows()).toHaveLength(1);
    expect(smokeRows()[0]).toHaveTextContent("Top Mid");
    expect(screen.getAllByTestId("landing-marker")).toHaveLength(1);
  });

  it("opens a smoke's card and keeps the filters in every link", async () => {
    renderAt("/maps/mirage?area=A");
    await userEvent.click(screen.getByRole("link", { name: /^CT from T Ramp/ }));
    expect(currentLocation()).toBe("/maps/mirage/smokes/mirage-ct-from-t-ramp?area=A");
    expect(screen.getByRole("heading", { name: "CT", level: 2 })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Previous smoke" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByRole("link", { name: "Next smoke" })).toHaveAttribute(
      "href",
      "/maps/mirage/smokes/mirage-jungle-from-t-ramp?area=A",
    );
    expect(screen.getByRole("link", { name: "Back to the list" })).toHaveAttribute(
      "href",
      "/maps/mirage?area=A",
    );
    expect(screen.getAllByTestId("stand-dot").length).toBeGreaterThan(0);
  });

  it("still opens a smoke that the filters exclude, with ‹ › disabled", () => {
    renderAt("/maps/mirage/smokes/mirage-window-from-t-spawn?side=CT");
    expect(screen.getByRole("heading", { name: "Window", level: 2 })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Previous smoke" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByRole("link", { name: "Next smoke" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("selects the nearest smoke when the radar is tapped", () => {
    renderAt("/maps/mirage");
    mockRadarSize(500);
    // The CT smoke lands at (0.3, 0.2), which is (150, 100) on a 500 px radar.
    fireEvent.click(screen.getByTestId("radar"), { clientX: 152, clientY: 101 });
    expect(currentLocation()).toBe("/maps/mirage/smokes/mirage-ct-from-t-ramp");
  });

  it("ignores taps far from every smoke", () => {
    renderAt("/maps/mirage");
    mockRadarSize(500);
    fireEvent.click(screen.getByTestId("radar"), { clientX: 5, clientY: 5 });
    expect(currentLocation()).toBe("/maps/mirage");
  });

  it("shows Nuke's upper level by default and switches to the lower one", async () => {
    renderAt("/maps/nuke");
    expect(smokeRows()).toHaveLength(1);
    expect(smokeRows()[0]).toHaveTextContent("Outside");
    const levels = within(screen.getByRole("group", { name: "Level" }));
    await userEvent.click(levels.getByRole("button", { name: "Lower" }));
    expect(currentLocation()).toBe("/maps/nuke?level=lower");
    expect(smokeRows()[0]).toHaveTextContent("Ramp");
  });

  it("has no level switch on single-level maps", () => {
    renderAt("/maps/mirage");
    expect(screen.queryByRole("group", { name: "Level" })).toBeNull();
  });

  it("says when a map has no smokes yet", () => {
    renderAt("/maps/ancient");
    expect(screen.getByText("No smokes on this map yet.")).toBeInTheDocument();
  });

  it("says when the filters match nothing", () => {
    renderAt("/maps/mirage?side=CT&area=B");
    expect(screen.getByText("No smokes match these filters.")).toBeInTheDocument();
  });

  it("shows Not found for an unknown map", () => {
    renderAt("/maps/overpass");
    expect(screen.getByRole("heading", { name: "Not found" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to maps" })).toHaveAttribute("href", "/");
  });

  it("shows Not found for an unknown smoke, linking back to the map", () => {
    renderAt("/maps/mirage/smokes/mirage-nope?side=T");
    expect(screen.getByRole("heading", { name: "Not found" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to Mirage" })).toHaveAttribute(
      "href",
      "/maps/mirage?side=T",
    );
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/features/map/MapPage.test.tsx`
Expected: FAIL — `/maps/mirage` renders Not found (no route yet), so the `Mirage` heading is missing.

- [ ] **Step 3: Implement the filters bar and the list**

`src/features/map/FiltersBar.tsx`:

```tsx
import { hasLevels, type MapInfo } from "../../data/maps";
import type { Filters } from "../../lib/filters";
import styles from "./MapPage.module.css";

const SIDE_OPTIONS = [
  ["all", "All"],
  ["T", "T"],
  ["CT", "CT"],
] as const;
const AREA_OPTIONS = [
  ["all", "All"],
  ["A", "A"],
  ["B", "B"],
  ["Mid", "Mid"],
  ["Other", "Other"],
] as const;
const LEVEL_OPTIONS = [
  ["upper", "Upper"],
  ["lower", "Lower"],
] as const;

export function FiltersBar({
  map,
  filters,
  onChange,
}: {
  map: MapInfo;
  filters: Filters;
  onChange: (next: Filters) => void;
}) {
  return (
    <div className={styles.filters}>
      <Segmented
        label="Side"
        options={SIDE_OPTIONS}
        value={filters.side}
        onSelect={(side) => onChange({ ...filters, side })}
      />
      <Segmented
        label="Area"
        options={AREA_OPTIONS}
        value={filters.area}
        onSelect={(area) => onChange({ ...filters, area })}
      />
      {hasLevels(map) && (
        <Segmented
          label="Level"
          options={LEVEL_OPTIONS}
          value={filters.level}
          onSelect={(level) => onChange({ ...filters, level })}
        />
      )}
    </div>
  );
}

function Segmented<T extends string>({
  label,
  options,
  value,
  onSelect,
}: {
  label: string;
  options: readonly (readonly [T, string])[];
  value: T;
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

`src/features/map/LineupList.tsx`:

```tsx
import { Link } from "react-router";
import type { Lineup, MapId } from "../../data/schema";
import { techniqueText } from "../../lib/technique";
import { StatusBadge } from "../smoke/StatusBadge";
import styles from "./MapPage.module.css";

export function LineupList({
  mapId,
  lineups,
  search,
  emptyText,
}: {
  mapId: MapId;
  lineups: readonly Lineup[];
  search: string;
  emptyText: string;
}) {
  if (lineups.length === 0) return <p className={styles.empty}>{emptyText}</p>;
  return (
    <ul className={styles.list} aria-label="Smokes">
      {lineups.map((lineup) => (
        <li key={lineup.id}>
          <Link to={`/maps/${mapId}/smokes/${lineup.id}${search}`} className={styles.row}>
            <span>
              <strong>{lineup.name}</strong>{" "}
              <span className={styles.rowFrom}>from {lineup.from}</span>
            </span>
            <span className={styles.rowMeta}>
              <span className={styles.sideTag} data-side={lineup.side}>
                {lineup.side}
              </span>
              <span>{techniqueText(lineup.throw)}</span>
              {lineup.status !== "ok" && <StatusBadge status={lineup.status} />}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 4: Implement the page and its routes**

`src/features/map/MapPage.tsx`:

```tsx
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { NotFound } from "../../app/NotFound";
import { findLineup, getMapData } from "../../data";
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
import { SmokeCard } from "../smoke/SmokeCard";
import { FiltersBar } from "./FiltersBar";
import { LineupList } from "./LineupList";
import { Radar } from "./Radar";
import { LandingMarker, StandDot, StandLine } from "./markers";
import styles from "./MapPage.module.css";

const isOn = (position: Position, level: Level, withLevels: boolean) =>
  !withLevels || (position.level ?? "upper") === level;

export function MapPage() {
  const { mapId = "", lineupId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const map = getMapInfo(mapId);
  if (!map) return <NotFound />;

  const data = getMapData(map.id);
  const withLevels = hasLevels(map);
  const filters = parseFilters(params);
  const search = filtersToSearch(filters);
  const mapHref = `/maps/${map.id}${search}`;
  const visible = applyFilters(data.lineups, filters, withLevels);
  const selected = lineupId ? findLineup(map.id, lineupId) : undefined;
  if (lineupId && !selected) {
    return <NotFound backTo={{ href: mapHref, label: `Back to ${map.name}` }} />;
  }

  const smokeHref = (lineup: Lineup) => `/maps/${map.id}/smokes/${lineup.id}${search}`;
  // A deep-linked smoke stays on the radar even when the filters exclude it.
  const markers =
    selected && !visible.includes(selected) && isOn(selected.land, filters.level, withLevels)
      ? [...visible, selected]
      : visible;
  const { prev, next } = selected ? neighbours(visible, selected.id) : {};

  function changeFilters(nextFilters: Filters) {
    navigate({ search: filtersToSearch(nextFilters) }, { replace: true });
  }

  function handleTap(point: Point, widthPx: number) {
    const hit = nearestWithin(markers, (lineup) => lineup.land, point, HIT_RADIUS_PX / widthPx);
    if (hit) navigate(smokeHref(hit));
  }

  const standVisible = selected !== undefined && isOn(selected.stand, filters.level, withLevels);
  const lineVisible =
    selected !== undefined && standVisible && isOn(selected.land, filters.level, withLevels);

  return (
    <div className={styles.page} data-open={selected ? "true" : "false"}>
      <section className={styles.radarCol}>
        <div className={styles.heading}>
          <Link to="/" className={styles.back}>
            ← Maps
          </Link>
          <h1>{map.name}</h1>
        </div>
        <FiltersBar map={map} filters={filters} onChange={changeFilters} />
        <Radar map={map} level={filters.level} label={`${map.name} radar`} onTap={handleTap}>
          {markers.map((lineup) => (
            <LandingMarker
              key={lineup.id}
              at={lineup.land}
              side={lineup.side}
              selected={lineup.id === selected?.id}
            />
          ))}
          {selected && lineVisible && <StandLine from={selected.stand} to={selected.land} />}
          {selected && standVisible && <StandDot at={selected.stand} side={selected.side} />}
        </Radar>
      </section>
      <section className={styles.panel}>
        {selected ? (
          <SmokeCard
            map={map}
            lineup={selected}
            closeHref={mapHref}
            prevHref={prev && smokeHref(prev)}
            nextHref={next && smokeHref(next)}
          />
        ) : (
          <LineupList
            mapId={map.id}
            lineups={visible}
            search={search}
            emptyText={
              data.lineups.length === 0 ? "No smokes on this map yet." : "No smokes match these filters."
            }
          />
        )}
      </section>
    </div>
  );
}
```

`src/features/map/MapPage.module.css`:

```css
.page {
  display: grid;
  gap: 16px;
}

.radarCol {
  display: grid;
  gap: 12px;
  align-content: start;
}

.panel {
  display: grid;
  gap: 12px;
  align-content: start;
}

@media (min-width: 900px) {
  .page {
    grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
    align-items: start;
  }

  .panel {
    position: sticky;
    top: 72px;
    max-height: calc(100dvh - 88px);
    overflow: auto;
  }
}

@media (max-width: 899px) {
  .page[data-open="true"] .radarCol {
    display: none;
  }
}

.heading {
  display: flex;
  align-items: baseline;
  gap: 12px;
}

.heading h1 {
  font-size: 1.5rem;
}

.back {
  color: var(--text-muted);
  text-decoration: none;
}

.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.segmented {
  display: inline-flex;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 999px;
}

.segmented button {
  min-height: 36px;
  padding: 6px 12px;
  border: 0;
  background: transparent;
}

.segmented button[aria-pressed="true"] {
  background: var(--surface-2);
  color: var(--accent);
}

.list {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.row {
  display: grid;
  gap: 4px;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  color: var(--text);
  text-decoration: none;
}

.row:hover {
  border-color: var(--accent);
}

.rowFrom {
  color: var(--text-muted);
}

.rowMeta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  font-size: 0.85rem;
  color: var(--text-muted);
}

.sideTag {
  font-weight: 700;
  color: var(--t-color);
}

.sideTag[data-side="CT"] {
  color: var(--ct-color);
}

.empty {
  color: var(--text-muted);
}
```

In `src/app/AppRoutes.tsx`, import the page and add two routes before the catch-all:

```tsx
import { Route, Routes } from "react-router";
import { HomePage } from "../features/home/HomePage";
import { MapPage } from "../features/map/MapPage";
import { Layout } from "./Layout";
import { NotFound } from "./NotFound";

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="maps/:mapId" element={<MapPage />} />
        <Route path="maps/:mapId/smokes/:lineupId" element={<MapPage />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `npx vitest run src/features/map src/app`
Expected: PASS.

- [ ] **Step 6: Try it in the browser**

Run: `npm run dev`, then open the printed URL followed by `#/maps/mirage` in a browser (ask the user to do this if you can't). Expected: the Mirage radar with the seeded smokes; filters change the markers; clicking a smoke shows its card with the clip playing muted. Narrow the window below 900 px: the card replaces the radar. Stop the server when done.

- [ ] **Step 7: Lint and commit**

Run: `npm test && npm run format && npm run lint && npm run build`

```bash
git add src
git commit -m "feat: add map page with radar, filters, list and smoke card"
```

---

### Task 13: CI, README and the first deploy (milestone: usable on the phone)

**Files:**
- Create: `.github/workflows/deploy.yml`
- Modify: `README.md` (replace the stub)

**Interfaces:**
- Consumes: npm scripts `lint`, `validate`, `test`, `build` (Tasks 1, 4).
- Produces: a workflow named "Check and deploy" that runs on every push to `main` and on demand; the live site URL, recorded in `README.md`.

- [ ] **Step 1: Create the workflow**

`.github/workflows/deploy.yml`:

```yaml
name: Check and deploy

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: lts/*
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run validate
      - run: npm test
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Replace `README.md`**

````markdown
# CS Smokes Helper

A personal website for learning Counter-Strike 2 smoke lineups away from the game: pick a map,
see its smokes on the radar, watch a looping clip of each throw, and drill them in study mode.

## Commands

| Command                              | What it does                                               |
| ------------------------------------ | ---------------------------------------------------------- |
| `npm run dev`                        | Start the local dev server                                 |
| `npm test`                           | Run the tests once                                         |
| `npm run lint`                       | ESLint and the Prettier check                              |
| `npm run validate`                   | Check every file in `data/maps/`                           |
| `npm run check-videos`               | Ask YouTube whether every video still exists and embeds    |
| `npm run preview-markers -- <mapId>` | Draw a map's markers on its radar in `tmp/preview-<mapId>.png` |
| `npm run build`                      | Type-check and build the site into `dist/`                 |
| `npm run radars` / `npm run icons`   | Regenerate radar images / app icons (rarely needed)        |

## Data

Each map has one file in `data/maps/` (`ancient`, `anubis`, `cache`, `dust2`, `inferno`,
`mirage`, `nuke`). Until the editor exists, add or fix a smoke by editing that file — the
fields and rules are in the design spec (§6) — then run `npm run validate`,
`npm run check-videos` and `npm run preview-markers -- <mapId>`.

The starter smokes were added by following [docs/seeding.md](docs/seeding.md). They start as
`"status": "unreviewed"`; set `"ok"` once you have checked one in game, or `"broken"` if a
map update broke it.

## Publishing

Every push to `main` runs lint → validate → test → build, and deploys only if all of them pass.

## Credits

Counter-Strike 2, map names and radar images © Valve Corporation. Videos © their creators.
Not affiliated with Valve.

Design: `docs/superpowers/specs/2026-10-10-cs2-smoke-lineups-design.md`
````

- [ ] **Step 3: Run the CI steps locally**

Run: `npm ci && npm run lint && npm run validate && npm test && npm run build`
Expected: every step passes.

```bash
git add .github README.md
git commit -m "ci: check and deploy on every push to main"
```

- [ ] **Step 4: Ask the user how to publish**

Ask, and wait for both answers:
1. *"Which GitHub account should the repo live under? And should it be public (free GitHub Pages) or private (Cloudflare Pages, also free)?"*
2. *"May I push the code to that repo now? Pushing publishes the site."*

Do not push without a yes to question 2.

- [ ] **Step 5a: Public repo — GitHub Pages**

1. Ask the user to create an empty repository named `cs-smokes-helper` at https://github.com/new (no README, licence or .gitignore) and to paste its URL.
2. Run: `git remote add origin <that URL>` then `git push -u origin main`. If Git asks for credentials, the user signs in through the Git Credential Manager window.
3. Ask the user to open the repository's **Settings → Pages** and set **Source** to **GitHub Actions**.
4. Start the workflow again: ask the user to open **Actions → Check and deploy → Run workflow**, or run `git commit --allow-empty -m "ci: trigger first deploy" && git push`.
5. When the run is green, the site is at `https://<account>.github.io/cs-smokes-helper/`. Check it:

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://<account>.github.io/cs-smokes-helper/
curl -s -o /dev/null -w "%{http_code}\n" https://<account>.github.io/cs-smokes-helper/radars/mirage.webp
```

Expected: `200` twice.

- [ ] **Step 5b: Private repo — Cloudflare Pages**

1. Ask the user to create an empty **private** repository named `cs-smokes-helper` at https://github.com/new and to paste its URL; then run `git remote add origin <that URL>` and `git push -u origin main`.
2. Delete the GitHub workflow, because Cloudflare will run the checks instead: `git rm .github/workflows/deploy.yml && git commit -m "ci: build and check on Cloudflare Pages instead" && git push`.
3. Ask the user, in the Cloudflare dashboard, to go to **Workers & Pages → Create → Pages → Connect to Git**, pick the repository, and set:
   - Framework preset: **None**
   - Build command: `npm run lint && npm run validate && npm test && npm run build`
   - Build output directory: `dist`
   - Environment variable: `NODE_VERSION` = `24`
4. When the first build is green, the site is at the `*.pages.dev` address Cloudflare shows. Check it with the two `curl` commands from Step 5a, using that address.

- [ ] **Step 6: Phone check (the user does this)**

Send the user the live URL and this checklist:
1. On the phone, the home page shows seven map tiles.
2. Mirage shows its smokes on the radar; the filters work.
3. Tapping a smoke opens its card; the clip starts muted, loops, and 0.5× slows it down.
4. ‹ › moves between smokes; ← goes back to the list.
5. "Add to Home Screen" (Safari share menu, or Chrome's menu) adds an icon that opens the site full screen.

Fix anything they report before continuing.

- [ ] **Step 7: Record the URL**

Add this line under the first paragraph of `README.md`, with the real address:

```markdown
Live site: https://<account>.github.io/cs-smokes-helper/
```

```bash
git add README.md
git commit -m "docs: add the live site address"
git push
```

---

### Tasks 14–19: Seed the other six maps

Each of these tasks seeds one map by following `docs/seeding.md` (written in Task 7) from step 0 to step 7. They are independent of each other; run them in any order. Each one changes only its own data file. Every task uses the same three steps; only the map notes differ.

### Task 14: Seed Ancient

**Files:**
- Modify: `data/maps/ancient.json`

**Interfaces:**
- Consumes: `docs/seeding.md` (Task 7); `npm run validate` (Task 4), `npm run check-videos` (Task 5), `npm run preview-markers` and `public/radars/ancient.webp` (Task 6).
- Produces: 10–15 Ancient lineups, all `status: "unreviewed"`.

- [ ] **Step 1: Seed Ancient by following `docs/seeding.md`**

Map notes: id `ancient`; radar `public/radars/ancient.webp`; one level (no `level` fields). Cover T-side smokes for the standard A execute (2–4), the standard B execute (2–4) and mid control (1–3), plus 2–4 key CT smokes. Use the callout names the sources use.

- [ ] **Step 2: Run the checks**

Run: `npm run validate && npm run check-videos && npm test`
Expected: `Data OK`; every video OK; all tests pass.

- [ ] **Step 3: Report and commit**

Post the report from `docs/seeding.md` step 7, then:

```bash
git add data/maps/ancient.json
git commit -m "data: seed Ancient smokes"
```

If the user approved pushing in Task 13, run `git push` so the live site updates.

### Task 15: Seed Anubis

**Files:**
- Modify: `data/maps/anubis.json`

**Interfaces:**
- Consumes: `docs/seeding.md` (Task 7); `npm run validate` (Task 4), `npm run check-videos` (Task 5), `npm run preview-markers` and `public/radars/anubis.webp` (Task 6).
- Produces: 10–15 Anubis lineups, all `status: "unreviewed"`.

- [ ] **Step 1: Seed Anubis by following `docs/seeding.md`**

Map notes: id `anubis`; radar `public/radars/anubis.webp`; one level. Anubis returned to the Active Duty pool in January 2026 — check whether its layout changed on its return and use that date in `docs/seeding.md` step 1 if so. Cover the standard A execute, the standard B execute and mid control on T side, plus 2–4 key CT smokes.

- [ ] **Step 2: Run the checks**

Run: `npm run validate && npm run check-videos && npm test`
Expected: `Data OK`; every video OK; all tests pass.

- [ ] **Step 3: Report and commit**

Post the report from `docs/seeding.md` step 7, then:

```bash
git add data/maps/anubis.json
git commit -m "data: seed Anubis smokes"
```

If the user approved pushing in Task 13, run `git push`.

### Task 16: Seed Cache

**Files:**
- Modify: `data/maps/cache.json`

**Interfaces:**
- Consumes: `docs/seeding.md` (Task 7); `npm run validate` (Task 4), `npm run check-videos` (Task 5), `npm run preview-markers` and `public/radars/cache.webp` (Task 6).
- Produces: 10–15 Cache lineups, all `status: "unreviewed"`.

- [ ] **Step 1: Seed Cache by following `docs/seeding.md`**

Map notes: id `cache`; radar `public/radars/cache.webp`; one level. Cache came back to CS2 on 2026-04-29 as a rebuilt map, so CS:GO-era and pre-2026 Cache videos do not apply: every video must be published on or after 2026-04-29, or after any later layout change. Cover the standard A execute, the standard B execute and mid control on T side, plus 2–4 key CT smokes. If fewer than 10 smokes have qualifying videos, seed the ones that do and say so in the report.

- [ ] **Step 2: Run the checks**

Run: `npm run validate && npm run check-videos && npm test`
Expected: `Data OK`; every video OK; all tests pass.

- [ ] **Step 3: Report and commit**

Post the report from `docs/seeding.md` step 7, then:

```bash
git add data/maps/cache.json
git commit -m "data: seed Cache smokes"
```

If the user approved pushing in Task 13, run `git push`.

### Task 17: Seed Dust II

**Files:**
- Modify: `data/maps/dust2.json`

**Interfaces:**
- Consumes: `docs/seeding.md` (Task 7); `npm run validate` (Task 4), `npm run check-videos` (Task 5), `npm run preview-markers` and `public/radars/dust2.webp` (Task 6).
- Produces: 10–15 Dust II lineups, all `status: "unreviewed"`.

- [ ] **Step 1: Seed Dust II by following `docs/seeding.md`**

Map notes: id `dust2`; radar `public/radars/dust2.webp`; one level. Candidates guides usually list (verify each against sources): T — Xbox (mid), CT and Long Cross for the A execute, B Window and B Doors for the B execute; CT — Mid Doors, Long Doors. Fill the rest from sources.

- [ ] **Step 2: Run the checks**

Run: `npm run validate && npm run check-videos && npm test`
Expected: `Data OK`; every video OK; all tests pass.

- [ ] **Step 3: Report and commit**

Post the report from `docs/seeding.md` step 7, then:

```bash
git add data/maps/dust2.json
git commit -m "data: seed Dust II smokes"
```

If the user approved pushing in Task 13, run `git push`.

### Task 18: Seed Inferno

**Files:**
- Modify: `data/maps/inferno.json`

**Interfaces:**
- Consumes: `docs/seeding.md` (Task 7); `npm run validate` (Task 4), `npm run check-videos` (Task 5), `npm run preview-markers` and `public/radars/inferno.webp` (Task 6).
- Produces: 10–15 Inferno lineups, all `status: "unreviewed"`.

- [ ] **Step 1: Seed Inferno by following `docs/seeding.md`**

Map notes: id `inferno`; radar `public/radars/inferno.webp`; one level. Candidates guides usually list (verify each): T — CT and Coffins for the B execute; the A execute smokes (sources often name Library, Arch, Pit or Moto); CT — Banana. Fill the rest from sources.

- [ ] **Step 2: Run the checks**

Run: `npm run validate && npm run check-videos && npm test`
Expected: `Data OK`; every video OK; all tests pass.

- [ ] **Step 3: Report and commit**

Post the report from `docs/seeding.md` step 7, then:

```bash
git add data/maps/inferno.json
git commit -m "data: seed Inferno smokes"
```

If the user approved pushing in Task 13, run `git push`.

### Task 19: Seed Nuke

**Files:**
- Modify: `data/maps/nuke.json`

**Interfaces:**
- Consumes: `docs/seeding.md` (Task 7); `npm run validate` (Task 4), `npm run check-videos` (Task 5), `npm run preview-markers`, `public/radars/nuke.webp` and `public/radars/nuke-lower.webp` (Task 6).
- Produces: 10–15 Nuke lineups, all `status: "unreviewed"`, every `stand` and `land` with a `level`.

- [ ] **Step 1: Seed Nuke by following `docs/seeding.md`**

Map notes: id `nuke`; two radars. Every `stand` and `land` needs `"level": "upper"` or `"lower"` (see `docs/seeding.md` step 5.4). `npm run preview-markers -- nuke` writes both `tmp/preview-nuke.png` and `tmp/preview-nuke-lower.png`; check each smoke on the level of its landing spot. Cover the outside smokes T side uses to cross to A or B, the standard A execute, the standard B (lower) execute, and 2–4 key CT smokes.

- [ ] **Step 2: Run the checks**

Run: `npm run validate && npm run check-videos && npm test`
Expected: `Data OK`; every video OK; all tests pass. A missing `level` shows up as `nuke.json → lineups[n].stand.level → is required on Nuke`.

- [ ] **Step 3: Report and commit**

Post the report from `docs/seeding.md` step 7, then:

```bash
git add data/maps/nuke.json
git commit -m "data: seed Nuke smokes"
```

If the user approved pushing in Task 13, run `git push`.

---

### Task 20: Executes — tab, execute view and seed data

**Files:**
- Create: `src/features/executes/ExecuteList.tsx`, `src/features/executes/ExecuteView.tsx`, `src/features/executes/ExecuteView.module.css`
- Modify: `src/features/map/FiltersBar.tsx` (export `LevelSwitch`), `src/features/map/MapPage.tsx` (replace the whole file), `src/features/map/MapPage.module.css` (add `.tabs`), `src/app/AppRoutes.tsx` (add the execute route), `docs/seeding.md` (add step 8), `data/maps/*.json` (seed executes)
- Test: `src/features/executes/Executes.test.tsx`

**Interfaces:**
- Consumes: everything Task 12's `MapPage` consumed, plus `findExecute` (Task 4) and `Execute` (Task 2); `SmokeCard` with `variant="embedded"` (Task 11).
- Produces: `LevelSwitch({ value: Level; onSelect: (level: Level) => void })` (a "Level" button group); `ExecuteList({ mapId, executes, lineups, search, emptyText })` — `<ul aria-label="Executes">`; `ExecuteView({ map, execute, lineups, closeHref })` — header with "Back to the list" link, `<h2>` name, side badge, notes, numbered step buttons (`aria-expanded`), one expanded embedded `SmokeCard` at a time; `MapPage` now also handles `/maps/:mapId/executes/:executeId` and a `tab=executes` query parameter, with tabs named "Smokes (n)" and "Executes (n)".

- [ ] **Step 1: Write the failing tests**

`src/features/executes/Executes.test.tsx`:

```tsx
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderAt } from "../../test/render";

vi.mock("../../data", async () => (await import("../../test/fixtureData")).mockDataModule());
vi.mock("../smoke/VideoPlayer", () => ({
  VideoPlayer: ({ title }: { title: string }) => <div data-testid="video">{title}</div>,
}));

const currentLocation = () => screen.getByTestId("location").textContent;

describe("executes", () => {
  it("lists the map's executes on the Executes tab", async () => {
    renderAt("/maps/mirage");
    await userEvent.click(screen.getByRole("tab", { name: /Executes/ }));
    expect(currentLocation()).toBe("/maps/mirage?tab=executes");
    const rows = within(screen.getByRole("list", { name: "Executes" })).getAllByRole("link");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent("A execute");
    expect(rows[0]).toHaveTextContent("CT · Jungle");
    expect(rows[0]).toHaveAttribute("href", "/maps/mirage/executes/mirage-a-execute");
  });

  it("keeps the tab when the filters change", async () => {
    renderAt("/maps/mirage?tab=executes");
    const sides = within(screen.getByRole("group", { name: "Side" }));
    await userEvent.click(sides.getByRole("button", { name: "CT" }));
    expect(currentLocation()).toBe("/maps/mirage?side=CT&tab=executes");
    expect(screen.getByText("No executes match these filters.")).toBeInTheDocument();
  });

  it("says when a map has no executes yet", () => {
    renderAt("/maps/nuke?tab=executes");
    expect(screen.getByText("No executes on this map yet.")).toBeInTheDocument();
  });

  it("shows an execute's smokes numbered on the radar, in throw order", () => {
    renderAt("/maps/mirage/executes/mirage-a-execute");
    expect(screen.getByRole("heading", { name: "A execute", level: 2 })).toBeInTheDocument();
    expect(screen.getAllByTestId("landing-marker").map((marker) => marker.textContent)).toEqual([
      "1",
      "2",
    ]);
    expect(screen.getByRole("button", { name: /^1\s*CT from T Ramp/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^2\s*Jungle from T Ramp/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to the list" })).toHaveAttribute(
      "href",
      "/maps/mirage?tab=executes",
    );
  });

  it("expands one smoke at a time", async () => {
    renderAt("/maps/mirage/executes/mirage-a-execute");
    await userEvent.click(screen.getByRole("button", { name: /CT from T Ramp/ }));
    expect(screen.getByText("Run + jump throw · left click")).toBeInTheDocument();
    expect(screen.getAllByTestId("video")).toHaveLength(1);
    await userEvent.click(screen.getByRole("button", { name: /Jungle from T Ramp/ }));
    expect(screen.getAllByTestId("video")).toHaveLength(1);
    expect(screen.getByTestId("video")).toHaveTextContent("Jungle from T Ramp");
  });

  it("shows Not found for an unknown execute", () => {
    renderAt("/maps/mirage/executes/mirage-nope");
    expect(screen.getByRole("heading", { name: "Not found" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to Mirage" })).toHaveAttribute(
      "href",
      "/maps/mirage?tab=executes",
    );
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/features/executes`
Expected: FAIL — no tab named "Executes".

- [ ] **Step 3: Implement the execute components**

`src/features/executes/ExecuteList.tsx`:

```tsx
import { Link } from "react-router";
import type { Execute, Lineup, MapId } from "../../data/schema";
import styles from "../map/MapPage.module.css";

export function ExecuteList({
  mapId,
  executes,
  lineups,
  search,
  emptyText,
}: {
  mapId: MapId;
  executes: readonly Execute[];
  lineups: readonly Lineup[];
  search: string;
  emptyText: string;
}) {
  if (executes.length === 0) return <p className={styles.empty}>{emptyText}</p>;
  const nameOf = (id: string) => lineups.find((lineup) => lineup.id === id)?.name ?? id;
  return (
    <ul className={styles.list} aria-label="Executes">
      {executes.map((execute) => (
        <li key={execute.id}>
          <Link to={`/maps/${mapId}/executes/${execute.id}${search}`} className={styles.row}>
            <span>
              <strong>{execute.name}</strong>{" "}
              <span className={styles.sideTag} data-side={execute.side}>
                {execute.side}
              </span>
            </span>
            <span className={styles.rowMeta}>{execute.lineupIds.map(nameOf).join(" · ")}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
```

`src/features/executes/ExecuteView.tsx`:

```tsx
import { useState } from "react";
import { Link } from "react-router";
import type { MapInfo } from "../../data/maps";
import type { Execute, Lineup } from "../../data/schema";
import { SmokeCard } from "../smoke/SmokeCard";
import styles from "./ExecuteView.module.css";

export function ExecuteView({
  map,
  execute,
  lineups,
  closeHref,
}: {
  map: MapInfo;
  execute: Execute;
  /** The execute's smokes, in throw order. */
  lineups: readonly Lineup[];
  closeHref: string;
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <article className={styles.view} aria-label={execute.name}>
      <header className={styles.header}>
        <Link to={closeHref} className={styles.close} aria-label="Back to the list">
          ←
        </Link>
        <h2>{execute.name}</h2>
        <span className={styles.side} data-side={execute.side}>
          {execute.side}
        </span>
      </header>
      {execute.notes && <p className={styles.notes}>{execute.notes}</p>}
      <ol className={styles.steps}>
        {lineups.map((lineup, index) => {
          const expanded = openId === lineup.id;
          return (
            <li key={lineup.id}>
              <button
                type="button"
                className={styles.step}
                aria-expanded={expanded}
                onClick={() => setOpenId(expanded ? null : lineup.id)}
              >
                <span className={styles.number}>{index + 1}</span>
                {lineup.name} <span className={styles.from}>from {lineup.from}</span>
              </button>
              {expanded && <SmokeCard map={map} lineup={lineup} variant="embedded" />}
            </li>
          );
        })}
      </ol>
    </article>
  );
}
```

`src/features/executes/ExecuteView.module.css`:

```css
.view {
  display: grid;
  gap: 12px;
}

.header {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header h2 {
  flex: 1;
  font-size: 1.3rem;
}

.close {
  font-size: 1.4rem;
  color: var(--text-muted);
  text-decoration: none;
}

.side {
  padding: 2px 10px;
  border-radius: 999px;
  font-weight: 700;
  background: var(--t-color);
  color: #000;
}

.side[data-side="CT"] {
  background: var(--ct-color);
}

.notes {
  margin: 0;
  color: var(--text-muted);
}

.steps {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.steps li {
  display: grid;
  gap: 8px;
}

.step {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  text-align: left;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
}

.step[aria-expanded="true"] {
  border-color: var(--accent);
}

.number {
  display: inline-grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--surface-2);
  font-weight: 700;
}

.from {
  color: var(--text-muted);
}
```

- [ ] **Step 4: Export `LevelSwitch` from `FiltersBar.tsx`**

In `src/features/map/FiltersBar.tsx`, add `import type { Level } from "../../data/schema";` to the imports, replace the `{hasLevels(map) && ( <Segmented label="Level" … /> )}` block inside `FiltersBar` with:

```tsx
      {hasLevels(map) && (
        <LevelSwitch value={filters.level} onSelect={(level) => onChange({ ...filters, level })} />
      )}
```

and add this exported component below `FiltersBar`:

```tsx
export function LevelSwitch({
  value,
  onSelect,
}: {
  value: Level;
  onSelect: (level: Level) => void;
}) {
  return <Segmented label="Level" options={LEVEL_OPTIONS} value={value} onSelect={onSelect} />;
}
```

- [ ] **Step 5: Replace `src/features/map/MapPage.tsx`**

```tsx
import type { ReactNode } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
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
import { ExecuteView } from "../executes/ExecuteView";
import { SmokeCard } from "../smoke/SmokeCard";
import { FiltersBar, LevelSwitch } from "./FiltersBar";
import { LineupList } from "./LineupList";
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
    radarContent = executeLineups.map((lineup, index) => (
      <g key={lineup.id}>
        {on(lineup.stand) && on(lineup.land) && <StandLine from={lineup.stand} to={lineup.land} />}
        {on(lineup.land) && (
          <LandingMarker at={lineup.land} side={lineup.side} label={String(index + 1)} />
        )}
        {on(lineup.stand) && <StandDot at={lineup.stand} side={lineup.side} />}
      </g>
    ));
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
              data.lineups.length === 0 ? "No smokes on this map yet." : "No smokes match these filters."
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
    <div className={styles.page} data-open={selected ? "true" : "false"}>
      <section className={styles.radarCol}>
        <div className={styles.heading}>
          <Link to="/" className={styles.back}>
            ← Maps
          </Link>
          <h1>{map.name}</h1>
        </div>
        {execute ? (
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
        )}
        <Radar
          map={map}
          level={filters.level}
          label={`${map.name} radar`}
          onTap={execute ? undefined : handleTap}
        >
          {radarContent}
        </Radar>
      </section>
      <section className={styles.panel}>{panel}</section>
    </div>
  );
}
```

Append to `src/features/map/MapPage.module.css`:

```css
.tabs {
  display: flex;
  gap: 8px;
}

.tabs button {
  padding: 6px 12px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: transparent;
}

.tabs button[aria-selected="true"] {
  border-color: var(--accent);
  background: var(--surface-2);
  color: var(--accent);
}
```

In `src/app/AppRoutes.tsx`, add this route after the smokes route:

```tsx
        <Route path="maps/:mapId/executes/:executeId" element={<MapPage />} />
```

- [ ] **Step 6: Run the tests to see them pass**

Run: `npx vitest run src/features`
Expected: PASS (the Task 12 map-page tests still pass too).

- [ ] **Step 7: Seed the executes**

Append to `docs/seeding.md`:

```markdown
## 8. Executes

For each site, add one execute (two at most per map) built only from smokes already in the
file, in the order a team throws them. Use the sources from step 2 to confirm which smokes
belong together; name them "A execute" or "B execute" (add a word such as "fast" or "split"
to tell two apart). Add `notes` only when the order or timing matters and a source says so.
Each execute needs 2–8 smokes, all from the same side. Then run step 6 again.
```

Then, for every map, add executes to its `data/maps/<mapId>.json` following that step. Example for Mirage, if its file has these three T smokes:

```json
"executes": [
  {
    "id": "mirage-a-execute",
    "name": "A execute",
    "side": "T",
    "lineupIds": ["mirage-ct-from-t-ramp", "mirage-jungle-from-tetris", "mirage-stairs-from-t-ramp"]
  }
]
```

(Use the real ids from the file; these three are illustrations.)

Run: `npm run validate && npm test`
Expected: `Data OK`; all tests pass. A typo in `lineupIds` shows up as `executes[0].lineupIds[n] → "…" is not a smoke in mirage.json`.

- [ ] **Step 8: Lint and commit**

Run: `npm run format && npm run lint && npm run build`

```bash
git add src docs/seeding.md data
git commit -m "feat: add executes tab and execute view, and seed executes"
```

If the user approved pushing in Task 13, run `git push`.

---

### Task 21: Local dates and study scheduling

**Files:**
- Create: `src/lib/dates.ts`, `src/lib/scheduler.ts`
- Test: `src/lib/dates.test.ts`, `src/lib/scheduler.test.ts`

**Interfaces:**
- Consumes: `LocatedLineup` (Task 4); `MAP_IDS`, `MapId`, `Side` (Task 2); `shuffle`, `Rng` (Task 3); `makeLineup` (Task 2).
- Produces:
  - `dates.ts`: `toLocalDate(date: Date): string` (device-local `YYYY-MM-DD`); `addDays(day: string, days: number): string`.
  - `scheduler.ts`: `type Box = 1 | 2 | 3 | 4 | 5`; `INTERVAL_DAYS: Readonly<Record<Box, number>>`; `type Rating = "forgot" | "got"`; `interface CardState { box: Box; due: string; lastReviewed: string }`; `interface NewToday { date: string; count: number }`; `interface StudyFilter { maps: readonly MapId[]; sides: readonly Side[] }`; `interface QueueItem extends LocatedLineup { isNew: boolean }`; `applyRating(card: CardState | undefined, rating: Rating, today: string): CardState`; `isKnown(card?: CardState): boolean`; `isDue(card: CardState, today: string): boolean`; `newAllowance(newToday: NewToday, newPerDay: number, today: string): number`; `eligible(candidates: readonly LocatedLineup[], filter: StudyFilter): LocatedLineup[]`; `interface QueueInput { candidates: readonly LocatedLineup[]; cards: Readonly<Record<string, CardState>>; filter: StudyFilter; allowance: number; today: string; rng?: Rng }`; `buildQueue(input: QueueInput): QueueItem[]`; `studyCounts(input: Omit<QueueInput, "rng">): { due: number; fresh: number }`; `nextDueDate(candidates, cards, filter, today): string | undefined`; `knownCount(lineups: readonly { id: string; status: string }[], cards): { known: number; total: number }`.

- [ ] **Step 1: Write the failing tests**

`src/lib/dates.test.ts` (covers Review Focus 5):

```ts
import { describe, expect, it } from "vitest";
import { addDays, toLocalDate } from "./dates";

describe("toLocalDate", () => {
  it("uses the device's calendar day, even just after midnight", () => {
    expect(toLocalDate(new Date(2026, 0, 1, 0, 30))).toBe("2026-01-01");
    expect(toLocalDate(new Date(2025, 11, 31, 23, 59))).toBe("2025-12-31");
  });
});

describe("addDays", () => {
  it.each([
    ["2026-10-10", 1, "2026-10-11"],
    ["2026-10-31", 1, "2026-11-01"],
    ["2026-12-31", 1, "2027-01-01"],
    ["2028-02-28", 1, "2028-02-29"],
    ["2026-03-28", 2, "2026-03-30"], // EU clocks go forward on 2026-03-29
    ["2026-10-24", 2, "2026-10-26"], // EU clocks go back on 2026-10-25
    ["2026-03-07", 2, "2026-03-09"], // US clocks go forward on 2026-03-08
    ["2026-10-10", 16, "2026-10-26"],
  ])("%s + %i days → %s", (day, days, expected) => {
    expect(addDays(day, days)).toBe(expected);
  });
});
```

`src/lib/scheduler.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { LocatedLineup } from "../data/api";
import type { MapId, Side, Status } from "../data/schema";
import { makeLineup } from "../test/fixtures";
import {
  INTERVAL_DAYS,
  applyRating,
  buildQueue,
  isKnown,
  knownCount,
  newAllowance,
  nextDueDate,
  studyCounts,
  type Box,
  type CardState,
} from "./scheduler";

const TODAY = "2026-10-10";
const card = (box: Box, due: string, lastReviewed = "2026-10-01"): CardState => ({
  box,
  due,
  lastReviewed,
});
const item = (map: MapId, id: string, side: Side = "T", status: Status = "unreviewed"): LocatedLineup => ({
  map,
  lineup: makeLineup({ id, side, status }),
});
const ALL_MAPS: MapId[] = ["ancient", "anubis", "cache", "dust2", "inferno", "mirage", "nuke"];
const ALL = { maps: ALL_MAPS, sides: ["T", "CT"] as Side[] };
const ids = (queue: readonly LocatedLineup[]) => queue.map((q) => q.lineup.id);

const candidates = [
  item("mirage", "mirage-a"),
  item("mirage", "mirage-b"),
  item("mirage", "mirage-c"),
  item("ancient", "ancient-a"),
  item("ancient", "ancient-b"),
  item("nuke", "nuke-a", "CT"),
  item("mirage", "mirage-broken", "T", "broken"),
];

describe("applyRating", () => {
  it("uses intervals of 1, 2, 4, 8 and 16 days", () => {
    expect(INTERVAL_DAYS).toEqual({ 1: 1, 2: 2, 3: 4, 4: 8, 5: 16 });
  });

  it("treats a new smoke as box 1", () => {
    expect(applyRating(undefined, "got", TODAY)).toEqual(card(2, "2026-10-12", TODAY));
    expect(applyRating(undefined, "forgot", TODAY)).toEqual(card(1, "2026-10-11", TODAY));
  });

  it("moves up one box on Got it, using the new box's interval", () => {
    expect(applyRating(card(3, TODAY, "2026-10-06"), "got", TODAY)).toEqual(
      card(4, "2026-10-18", TODAY),
    );
  });

  it("stays in box 5 and comes back after 16 days", () => {
    expect(applyRating(card(5, TODAY, "2026-09-24"), "got", TODAY)).toEqual(
      card(5, "2026-10-26", TODAY),
    );
  });

  it("goes back to box 1 on Forgot, due tomorrow", () => {
    expect(applyRating(card(4, TODAY, "2026-10-02"), "forgot", TODAY)).toEqual(
      card(1, "2026-10-11", TODAY),
    );
  });

  it("changes a schedule at most once per day", () => {
    const reviewed = applyRating(undefined, "forgot", TODAY);
    expect(applyRating(reviewed, "got", TODAY)).toBe(reviewed);
  });

  it("schedules across a year end on calendar days", () => {
    expect(applyRating(card(4, "2026-12-27", "2026-12-19"), "got", "2026-12-27").due).toBe(
      "2027-01-12",
    );
  });
});

describe("isKnown", () => {
  it("means box 4 or higher", () => {
    expect(isKnown(card(4, TODAY))).toBe(true);
    expect(isKnown(card(3, TODAY))).toBe(false);
    expect(isKnown(undefined)).toBe(false);
  });
});

describe("newAllowance", () => {
  it("subtracts today's new smokes", () => {
    expect(newAllowance({ date: TODAY, count: 4 }, 10, TODAY)).toBe(6);
  });
  it("starts again on a new day", () => {
    expect(newAllowance({ date: "2026-10-09", count: 10 }, 10, TODAY)).toBe(10);
  });
  it("never goes below zero", () => {
    expect(newAllowance({ date: TODAY, count: 12 }, 10, TODAY)).toBe(0);
  });
});

describe("buildQueue", () => {
  it("puts due cards first, then new smokes round-robin across maps", () => {
    const cards = { "mirage-a": card(2, TODAY), "ancient-a": card(1, "2026-10-11", TODAY) };
    const queue = buildQueue({ candidates, cards, filter: ALL, allowance: 10, today: TODAY });
    expect(ids(queue)).toEqual(["mirage-a", "ancient-b", "mirage-b", "nuke-a", "mirage-c"]);
    expect(queue.map((q) => q.isNew)).toEqual([false, true, true, true, true]);
  });

  it("stops adding new smokes at the allowance", () => {
    const queue = buildQueue({ candidates, cards: {}, filter: ALL, allowance: 2, today: TODAY });
    expect(ids(queue)).toEqual(["ancient-a", "mirage-a"]);
  });

  it("leaves out broken smokes and smokes outside the chosen maps and sides", () => {
    const filter = { maps: ["mirage", "nuke"] as MapId[], sides: ["T"] as Side[] };
    const queue = buildQueue({ candidates, cards: {}, filter, allowance: 10, today: TODAY });
    expect(ids(queue)).toEqual(["mirage-a", "mirage-b", "mirage-c"]);
  });

  it("shuffles the due cards", () => {
    const cards = {
      "mirage-a": card(1, TODAY),
      "mirage-b": card(1, TODAY),
      "mirage-c": card(1, TODAY),
    };
    const filter = { maps: ["mirage"] as MapId[], sides: ["T"] as Side[] };
    const queue = buildQueue({ candidates, cards, filter, allowance: 0, today: TODAY, rng: () => 0 });
    expect(ids(queue)).toEqual(["mirage-b", "mirage-c", "mirage-a"]);
  });
});

describe("studyCounts", () => {
  it("counts due cards and how many new smokes today allows", () => {
    const cards = { "mirage-a": card(2, "2026-10-09") };
    expect(studyCounts({ candidates, cards, filter: ALL, allowance: 3, today: TODAY })).toEqual({
      due: 1,
      fresh: 3,
    });
    expect(studyCounts({ candidates, cards, filter: ALL, allowance: 0, today: TODAY })).toEqual({
      due: 1,
      fresh: 0,
    });
  });
});

describe("nextDueDate", () => {
  it("finds the earliest future review among studyable smokes", () => {
    const cards = {
      "mirage-a": card(2, "2026-10-14", TODAY),
      "mirage-b": card(1, "2026-10-11", TODAY),
      "mirage-broken": card(1, "2026-10-11", TODAY),
    };
    expect(nextDueDate(candidates, cards, ALL, TODAY)).toBe("2026-10-11");
    expect(nextDueDate(candidates, {}, ALL, TODAY)).toBeUndefined();
  });
});

describe("knownCount", () => {
  it("counts known smokes among those that aren't broken", () => {
    const lineups = [
      makeLineup({ id: "mirage-a" }),
      makeLineup({ id: "mirage-b" }),
      makeLineup({ id: "mirage-c", status: "broken" }),
    ];
    const cards = { "mirage-a": card(4, "2026-10-20"), "mirage-c": card(5, "2026-10-20") };
    expect(knownCount(lineups, cards)).toEqual({ known: 1, total: 2 });
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/lib/dates.test.ts src/lib/scheduler.test.ts`
Expected: FAIL — `Failed to resolve import "./dates"` and `"./scheduler"`.

- [ ] **Step 3: Implement `src/lib/dates.ts`**

```ts
/** The device's local calendar date, as YYYY-MM-DD. */
export function toLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Adds whole calendar days. Works from noon, so clock changes can't shift the date. */
export function addDays(day: string, days: number): string {
  const [year, month, date] = day.split("-").map(Number);
  return toLocalDate(new Date(year, month - 1, date + days, 12));
}
```

- [ ] **Step 4: Implement `src/lib/scheduler.ts`**

```ts
import type { LocatedLineup } from "../data/api";
import { MAP_IDS, type MapId, type Side } from "../data/schema";
import { addDays } from "./dates";
import { shuffle, type Rng } from "./random";

export type Box = 1 | 2 | 3 | 4 | 5;
export const INTERVAL_DAYS: Readonly<Record<Box, number>> = { 1: 1, 2: 2, 3: 4, 4: 8, 5: 16 };
export type Rating = "forgot" | "got";

export interface CardState {
  box: Box;
  due: string;
  lastReviewed: string;
}

export interface NewToday {
  date: string;
  count: number;
}

export interface StudyFilter {
  maps: readonly MapId[];
  sides: readonly Side[];
}

export interface QueueItem extends LocatedLineup {
  isNew: boolean;
}

type Cards = Readonly<Record<string, CardState>>;

/** A new smoke counts as box 1. A card's schedule changes at most once per day. */
export function applyRating(card: CardState | undefined, rating: Rating, today: string): CardState {
  if (card && card.lastReviewed === today) return card;
  const current = card?.box ?? 1;
  const box: Box = rating === "got" ? (Math.min(current + 1, 5) as Box) : 1;
  return { box, due: addDays(today, INTERVAL_DAYS[box]), lastReviewed: today };
}

export function isKnown(card?: CardState): boolean {
  return card !== undefined && card.box >= 4;
}

export function isDue(card: CardState, today: string): boolean {
  return card.due <= today;
}

export function newAllowance(newToday: NewToday, newPerDay: number, today: string): number {
  const used = newToday.date === today ? newToday.count : 0;
  return Math.max(0, newPerDay - used);
}

/** Smokes that can be studied with these settings: not broken, on a chosen map and side. */
export function eligible(candidates: readonly LocatedLineup[], filter: StudyFilter): LocatedLineup[] {
  return candidates.filter(
    ({ map, lineup }) =>
      lineup.status !== "broken" && filter.maps.includes(map) && filter.sides.includes(lineup.side),
  );
}

export interface QueueInput {
  candidates: readonly LocatedLineup[];
  cards: Cards;
  filter: StudyFilter;
  allowance: number;
  today: string;
  rng?: Rng;
}

const dueIn = (pool: readonly LocatedLineup[], cards: Cards, today: string) =>
  pool.filter(({ lineup }) => {
    const card = cards[lineup.id];
    return card !== undefined && isDue(card, today);
  });

const freshIn = (pool: readonly LocatedLineup[], cards: Cards) =>
  pool.filter(({ lineup }) => cards[lineup.id] === undefined);

/** Due cards in random order, then new smokes round-robin across maps (file order within a map). */
export function buildQueue({ candidates, cards, filter, allowance, today, rng }: QueueInput): QueueItem[] {
  const pool = eligible(candidates, filter);
  const fresh = freshIn(pool, cards);
  const byMap = MAP_IDS.map((map) => fresh.filter((entry) => entry.map === map)).filter(
    (list) => list.length > 0,
  );
  const picked: LocatedLineup[] = [];
  for (let round = 0; picked.length < allowance && byMap.some((list) => round < list.length); round++) {
    for (const list of byMap) {
      if (picked.length >= allowance) break;
      if (round < list.length) picked.push(list[round]);
    }
  }
  return [
    ...shuffle(dueIn(pool, cards, today), rng).map((entry) => ({ ...entry, isNew: false })),
    ...picked.map((entry) => ({ ...entry, isNew: true })),
  ];
}

export function studyCounts({
  candidates,
  cards,
  filter,
  allowance,
  today,
}: Omit<QueueInput, "rng">): { due: number; fresh: number } {
  const pool = eligible(candidates, filter);
  return {
    due: dueIn(pool, cards, today).length,
    fresh: Math.min(freshIn(pool, cards).length, allowance),
  };
}

/** The earliest review after today among studyable smokes, if there is one. */
export function nextDueDate(
  candidates: readonly LocatedLineup[],
  cards: Cards,
  filter: StudyFilter,
  today: string,
): string | undefined {
  return eligible(candidates, filter)
    .map(({ lineup }) => cards[lineup.id]?.due)
    .filter((due): due is string => due !== undefined && due > today)
    .sort()[0];
}

/** Known and total smokes, leaving out broken ones. */
export function knownCount(
  lineups: readonly { id: string; status: string }[],
  cards: Cards,
): { known: number; total: number } {
  const active = lineups.filter((lineup) => lineup.status !== "broken");
  return {
    known: active.filter((lineup) => isKnown(cards[lineup.id])).length,
    total: active.length,
  };
}
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `npx vitest run src/lib/dates.test.ts src/lib/scheduler.test.ts`
Expected: PASS.

- [ ] **Step 6: Lint and commit**

Run: `npm test && npm run format && npm run lint`

```bash
git add src/lib
git commit -m "feat: add local dates and box scheduling"
```

---

### Task 22: Saving progress, the progress provider and storage banners

**Files:**
- Create: `src/lib/storage.ts`, `src/app/progress.tsx`, `src/test/memoryStorage.ts`
- Modify: `src/app/Layout.tsx`, `src/app/Layout.module.css`, `src/main.tsx`, `src/test/render.tsx`
- Test: `src/lib/storage.test.ts`, `src/app/progress.test.tsx`, `src/app/Layout.test.tsx`

**Interfaces:**
- Consumes: `MAP_IDS`, `SIDES`, `dateSchema` (Task 2); `applyRating`, `CardState`, `Rating` (Task 21); `toLocalDate` (Task 21).
- Produces:
  - `storage.ts`: `STORAGE_KEY = "cs-smokes:progress:v1"`; `BACKUP_PREFIX = "cs-smokes:progress:backup:"`; `NEW_PER_DAY_MIN = 1`; `NEW_PER_DAY_MAX = 30`; `progressSchema`; `type Progress` (`{ version: 1; cards: Record<string, CardState>; newToday: { date; count }; settings: { newPerDay: number; maps: MapId[]; sides: Side[] } }`); `type ProgressSettings = Progress["settings"]`; `interface StorageLike { getItem(key: string): string | null; setItem(key: string, value: string): void }`; `type LoadStatus = "ok" | "empty" | "reset" | "unavailable"`; `defaultProgress(): Progress`; `getBrowserStorage(): StorageLike | null`; `loadProgress(storage: StorageLike | null, now?: Date): { progress: Progress; status: LoadStatus }`; `saveProgress(storage, progress): boolean`; `recordAnswer(progress, lineupId, rating, today): Progress`; `exportProgress(progress): string`; `exportFileName(today: string): string`; `type ImportResult = { ok: true; progress: Progress } | { ok: false; error: string }`; `importProgress(text: string): ImportResult`.
  - `progress.tsx`: `interface ProgressContextValue { progress: Progress; status: LoadStatus; cannotSave: boolean; today: string; answer(lineupId: string, rating: Rating): void; updateSettings(changes: Partial<ProgressSettings>): void; replace(progress: Progress): void; reset(): void }`; `ProgressProvider({ children, storage?: StorageLike | null, now?: () => Date })` (no `storage` prop → browser storage); `useProgress(): ProgressContextValue`.
  - `memoryStorage.ts` (tests): `memoryStorage(initial?: Record<string, string>): StorageLike & { data: Map<string, string> }`; `failingStorage(): StorageLike` (writes throw).
  - `render.tsx`: `renderAt(path: string, options?: { storage?: StorageLike | null; now?: () => Date })` now wraps the app in `ProgressProvider` (memory storage by default).
  - `Layout`: banners "Progress can't be saved in this browser." and "Your saved progress couldn't be read, so it was reset. A backup copy was kept in this browser." (with a "Dismiss" button).

- [ ] **Step 1: Write the test storages and the failing storage tests**

`src/test/memoryStorage.ts`:

```ts
import type { StorageLike } from "../lib/storage";

export function memoryStorage(
  initial: Record<string, string> = {},
): StorageLike & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
  };
}

/** Storage that can be read but throws on every write, like a full or locked-down browser. */
export function failingStorage(): StorageLike {
  return {
    getItem: () => null,
    setItem: () => {
      throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
    },
  };
}
```

`src/lib/storage.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { failingStorage, memoryStorage } from "../test/memoryStorage";
import {
  BACKUP_PREFIX,
  STORAGE_KEY,
  defaultProgress,
  exportFileName,
  exportProgress,
  importProgress,
  loadProgress,
  recordAnswer,
  saveProgress,
} from "./storage";

const TODAY = "2026-10-10";
const NOW = new Date("2026-10-10T09:00:00.000Z");

describe("defaultProgress", () => {
  it("starts with no cards, 10 new smokes a day, every map and both sides", () => {
    expect(defaultProgress()).toEqual({
      version: 1,
      cards: {},
      newToday: { date: "1970-01-01", count: 0 },
      settings: {
        newPerDay: 10,
        maps: ["ancient", "anubis", "cache", "dust2", "inferno", "mirage", "nuke"],
        sides: ["T", "CT"],
      },
    });
  });
});

describe("loadProgress", () => {
  it("reports unavailable storage", () => {
    expect(loadProgress(null, NOW)).toEqual({ progress: defaultProgress(), status: "unavailable" });
    const throwing = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => undefined,
    };
    expect(loadProgress(throwing, NOW).status).toBe("unavailable");
  });

  it("starts empty when nothing is stored", () => {
    expect(loadProgress(memoryStorage(), NOW)).toEqual({ progress: defaultProgress(), status: "empty" });
  });

  it("loads what was saved", () => {
    const storage = memoryStorage();
    const progress = recordAnswer(defaultProgress(), "mirage-a", "got", TODAY);
    expect(saveProgress(storage, progress)).toBe(true);
    expect(loadProgress(storage, NOW)).toEqual({ progress, status: "ok" });
  });

  it("backs up and resets unreadable progress", () => {
    const storage = memoryStorage({ [STORAGE_KEY]: "{not json" });
    expect(loadProgress(storage, NOW)).toEqual({ progress: defaultProgress(), status: "reset" });
    expect(storage.data.get(`${BACKUP_PREFIX}2026-10-10T09:00:00.000Z`)).toBe("{not json");
    expect(JSON.parse(storage.data.get(STORAGE_KEY)!)).toEqual(defaultProgress());
  });

  it("backs up and resets progress from another version", () => {
    const stored = JSON.stringify({ ...defaultProgress(), version: 2 });
    const storage = memoryStorage({ [STORAGE_KEY]: stored });
    expect(loadProgress(storage, NOW).status).toBe("reset");
  });
});

describe("saveProgress", () => {
  it("returns false instead of throwing when the browser refuses to store", () => {
    expect(saveProgress(failingStorage(), defaultProgress())).toBe(false);
    expect(saveProgress(null, defaultProgress())).toBe(false);
  });
});

describe("recordAnswer", () => {
  it("counts a first answer as a new smoke for today", () => {
    const once = recordAnswer(defaultProgress(), "mirage-a", "got", TODAY);
    expect(once.cards["mirage-a"]).toEqual({ box: 2, due: "2026-10-12", lastReviewed: TODAY });
    expect(once.newToday).toEqual({ date: TODAY, count: 1 });
    const twice = recordAnswer(once, "mirage-b", "forgot", TODAY);
    expect(twice.newToday).toEqual({ date: TODAY, count: 2 });
  });

  it("does not count reviews of known cards, or repeats, as new", () => {
    const first = recordAnswer(defaultProgress(), "mirage-a", "forgot", TODAY);
    expect(recordAnswer(first, "mirage-a", "got", TODAY).newToday.count).toBe(1);
  });

  it("restarts the new-smoke count on a new day", () => {
    const yesterday = recordAnswer(defaultProgress(), "mirage-a", "got", "2026-10-09");
    expect(recordAnswer(yesterday, "mirage-b", "got", TODAY).newToday).toEqual({
      date: TODAY,
      count: 1,
    });
  });

  it("keeps progress for smokes that no longer exist", () => {
    const progress = recordAnswer(defaultProgress(), "mirage-removed", "got", "2026-10-09");
    expect(recordAnswer(progress, "mirage-b", "got", TODAY).cards["mirage-removed"]).toBeDefined();
  });
});

describe("export and import", () => {
  it("round-trips progress", () => {
    const progress = recordAnswer(defaultProgress(), "mirage-a", "got", TODAY);
    expect(importProgress(exportProgress(progress))).toEqual({ ok: true, progress });
  });

  it("rejects files that aren't progress exports", () => {
    expect(importProgress("hello")).toEqual({
      ok: false,
      error: "That file isn't a CS Smokes progress export.",
    });
    expect(importProgress(JSON.stringify({ version: 1 })).ok).toBe(false);
  });

  it("names exports by date", () => {
    expect(exportFileName(TODAY)).toBe("cs-smokes-progress-2026-10-10.json");
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/lib/storage.test.ts`
Expected: FAIL — `Failed to resolve import "./storage"`.

- [ ] **Step 3: Implement `src/lib/storage.ts`**

```ts
import { z } from "zod";
import { MAP_IDS, SIDES, dateSchema } from "../data/schema";
import { applyRating, type Rating } from "./scheduler";

export const STORAGE_KEY = "cs-smokes:progress:v1";
export const BACKUP_PREFIX = "cs-smokes:progress:backup:";
export const NEW_PER_DAY_MIN = 1;
export const NEW_PER_DAY_MAX = 30;

const cardSchema = z.strictObject({
  box: z.literal([1, 2, 3, 4, 5]),
  due: dateSchema,
  lastReviewed: dateSchema,
});

export const progressSchema = z.strictObject({
  version: z.literal(1),
  cards: z.record(z.string(), cardSchema),
  newToday: z.strictObject({ date: dateSchema, count: z.number().int().min(0) }),
  settings: z.strictObject({
    newPerDay: z.number().int().min(NEW_PER_DAY_MIN).max(NEW_PER_DAY_MAX),
    maps: z.array(z.enum(MAP_IDS)),
    sides: z.array(z.enum(SIDES)),
  }),
});

export type Progress = z.infer<typeof progressSchema>;
export type ProgressSettings = Progress["settings"];

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export type LoadStatus = "ok" | "empty" | "reset" | "unavailable";

export function defaultProgress(): Progress {
  return {
    version: 1,
    cards: {},
    newToday: { date: "1970-01-01", count: 0 },
    settings: { newPerDay: 10, maps: [...MAP_IDS], sides: [...SIDES] },
  };
}

/** localStorage if this browser lets us use it (private modes and policies can forbid it). */
export function getBrowserStorage(): StorageLike | null {
  try {
    const storage = window.localStorage;
    const probe = "cs-smokes:probe";
    storage.setItem(probe, "1");
    storage.removeItem(probe);
    return storage;
  } catch {
    return null;
  }
}

function parseProgress(text: string): Progress | null {
  try {
    const result = progressSchema.safeParse(JSON.parse(text));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

export function loadProgress(
  storage: StorageLike | null,
  now: Date = new Date(),
): { progress: Progress; status: LoadStatus } {
  if (!storage) return { progress: defaultProgress(), status: "unavailable" };
  let raw: string | null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return { progress: defaultProgress(), status: "unavailable" };
  }
  if (raw === null) return { progress: defaultProgress(), status: "empty" };

  const progress = parseProgress(raw);
  if (progress) return { progress, status: "ok" };

  try {
    storage.setItem(`${BACKUP_PREFIX}${now.toISOString()}`, raw);
    storage.setItem(STORAGE_KEY, JSON.stringify(defaultProgress()));
  } catch {
    // Keep going with fresh progress for this visit even if the backup can't be written.
  }
  return { progress: defaultProgress(), status: "reset" };
}

export function saveProgress(storage: StorageLike | null, progress: Progress): boolean {
  if (!storage) return false;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(progress));
    return true;
  } catch {
    return false;
  }
}

/** Applies a rating; a smoke answered for the first time counts toward today's new smokes. */
export function recordAnswer(
  progress: Progress,
  lineupId: string,
  rating: Rating,
  today: string,
): Progress {
  const previous = progress.cards[lineupId];
  const newToday =
    previous === undefined
      ? {
          date: today,
          count: (progress.newToday.date === today ? progress.newToday.count : 0) + 1,
        }
      : progress.newToday;
  return {
    ...progress,
    cards: { ...progress.cards, [lineupId]: applyRating(previous, rating, today) },
    newToday,
  };
}

export function exportProgress(progress: Progress): string {
  return `${JSON.stringify(progress, null, 2)}\n`;
}

export function exportFileName(today: string): string {
  return `cs-smokes-progress-${today}.json`;
}

export type ImportResult = { ok: true; progress: Progress } | { ok: false; error: string };

export function importProgress(text: string): ImportResult {
  const progress = parseProgress(text);
  return progress
    ? { ok: true, progress }
    : { ok: false, error: "That file isn't a CS Smokes progress export." };
}
```

Run: `npx vitest run src/lib/storage.test.ts`
Expected: PASS.

- [ ] **Step 4: Write the failing provider and banner tests**

`src/app/progress.test.tsx` (with the Layout tests below, this covers Review Focus 4):

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { STORAGE_KEY } from "../lib/storage";
import { failingStorage, memoryStorage } from "../test/memoryStorage";
import { ProgressProvider, useProgress } from "./progress";

const fixedNow = () => new Date(2026, 9, 10, 9, 0);

function Probe() {
  const { progress, status, cannotSave, today, answer } = useProgress();
  return (
    <div>
      <output data-testid="cards">{JSON.stringify(progress.cards)}</output>
      <output data-testid="flags">{`${status}|${cannotSave}|${today}`}</output>
      <button type="button" onClick={() => answer("mirage-a", "got")}>
        Answer
      </button>
    </div>
  );
}

describe("ProgressProvider", () => {
  it("saves answers to storage", async () => {
    const storage = memoryStorage();
    render(
      <ProgressProvider storage={storage} now={fixedNow}>
        <Probe />
      </ProgressProvider>,
    );
    expect(screen.getByTestId("flags")).toHaveTextContent("empty|false|2026-10-10");
    await userEvent.click(screen.getByRole("button", { name: "Answer" }));
    const saved = JSON.parse(storage.data.get(STORAGE_KEY)!);
    expect(saved.cards["mirage-a"]).toEqual({ box: 2, due: "2026-10-12", lastReviewed: "2026-10-10" });
    expect(saved.newToday).toEqual({ date: "2026-10-10", count: 1 });
  });

  it("keeps working in memory, and says so, when the browser refuses to store", async () => {
    render(
      <ProgressProvider storage={failingStorage()} now={fixedNow}>
        <Probe />
      </ProgressProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Answer" }));
    expect(screen.getByTestId("flags")).toHaveTextContent("empty|true");
    expect(screen.getByTestId("cards")).toHaveTextContent("mirage-a");
  });

  it("treats missing storage as unavailable", () => {
    render(
      <ProgressProvider storage={null} now={fixedNow}>
        <Probe />
      </ProgressProvider>,
    );
    expect(screen.getByTestId("flags")).toHaveTextContent("unavailable|true");
  });
});
```

`src/app/Layout.test.tsx`:

```tsx
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { STORAGE_KEY } from "../lib/storage";
import { memoryStorage } from "../test/memoryStorage";
import { renderAt } from "../test/render";

vi.mock("../data", async () => (await import("../test/fixtureData")).mockDataModule());

describe("Layout banners", () => {
  it("warns when progress can't be saved", () => {
    renderAt("/", { storage: null });
    expect(screen.getByText("Progress can't be saved in this browser.")).toBeInTheDocument();
  });

  it("shows no banner when storage works", () => {
    renderAt("/");
    expect(screen.queryByText("Progress can't be saved in this browser.")).toBeNull();
    expect(screen.queryByText(/couldn't be read/)).toBeNull();
  });

  it("explains a reset of unreadable progress, and can be dismissed", async () => {
    renderAt("/", { storage: memoryStorage({ [STORAGE_KEY]: "{not json" }) });
    expect(screen.getByText(/couldn't be read, so it was reset/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByText(/couldn't be read/)).toBeNull();
  });
});
```

Update `src/test/render.tsx` so every page test runs inside the provider:

```tsx
import { render } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router";
import { AppRoutes } from "../app/AppRoutes";
import { ProgressProvider } from "../app/progress";
import type { StorageLike } from "../lib/storage";
import { memoryStorage } from "./memoryStorage";

/** Renders the router's current path and query so tests can check navigation. */
export function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

export interface RenderOptions {
  /** Defaults to fresh in-memory storage; pass null to simulate a browser without storage. */
  storage?: StorageLike | null;
  now?: () => Date;
}

/** Renders the whole app at `path`, with an in-memory router and progress provider. */
export function renderAt(path: string, { storage = memoryStorage(), now }: RenderOptions = {}) {
  return render(
    <ProgressProvider storage={storage} now={now}>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
        <LocationProbe />
      </MemoryRouter>
    </ProgressProvider>,
  );
}
```

Run: `npx vitest run src/app`
Expected: FAIL — `Failed to resolve import "./progress"`.

- [ ] **Step 5: Implement the provider**

`src/app/progress.tsx`:

```tsx
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toLocalDate } from "../lib/dates";
import type { Rating } from "../lib/scheduler";
import {
  defaultProgress,
  getBrowserStorage,
  loadProgress,
  recordAnswer,
  saveProgress,
  type LoadStatus,
  type Progress,
  type ProgressSettings,
  type StorageLike,
} from "../lib/storage";

export interface ProgressContextValue {
  progress: Progress;
  /** "reset" means stored progress was unreadable; it was backed up and started again. */
  status: LoadStatus;
  /** True when progress can't be stored: no storage, or the last write failed. */
  cannotSave: boolean;
  /** The device's local date, YYYY-MM-DD. */
  today: string;
  answer(lineupId: string, rating: Rating): void;
  updateSettings(changes: Partial<ProgressSettings>): void;
  replace(progress: Progress): void;
  reset(): void;
}

const ProgressContext = createContext<ProgressContextValue | null>(null);
const systemNow = () => new Date();

export function ProgressProvider({
  children,
  storage,
  now = systemNow,
}: {
  children: ReactNode;
  /** Leave out to use the browser's localStorage. */
  storage?: StorageLike | null;
  now?: () => Date;
}) {
  const [store] = useState<StorageLike | null>(() =>
    storage === undefined ? getBrowserStorage() : storage,
  );
  const [initial] = useState(() => loadProgress(store, now()));
  const [progress, setProgress] = useState<Progress>(initial.progress);
  const [writeFailed, setWriteFailed] = useState(false);
  const loaded = useRef(false);

  useEffect(() => {
    // The first run is the value we just loaded; only save real changes.
    if (!loaded.current) {
      loaded.current = true;
      return;
    }
    setWriteFailed(!saveProgress(store, progress));
  }, [progress, store]);

  const answer = useCallback(
    (lineupId: string, rating: Rating) =>
      setProgress((current) => recordAnswer(current, lineupId, rating, toLocalDate(now()))),
    [now],
  );
  const updateSettings = useCallback(
    (changes: Partial<ProgressSettings>) =>
      setProgress((current) => ({ ...current, settings: { ...current.settings, ...changes } })),
    [],
  );
  const replace = useCallback((next: Progress) => setProgress(next), []);
  const reset = useCallback(() => setProgress(defaultProgress()), []);

  const today = toLocalDate(now());
  const value = useMemo<ProgressContextValue>(
    () => ({
      progress,
      status: initial.status,
      cannotSave: store === null || initial.status === "unavailable" || writeFailed,
      today,
      answer,
      updateSettings,
      replace,
      reset,
    }),
    [progress, initial.status, store, writeFailed, today, answer, updateSettings, replace, reset],
  );

  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>;
}

export function useProgress(): ProgressContextValue {
  const value = useContext(ProgressContext);
  if (!value) throw new Error("useProgress must be used inside <ProgressProvider>");
  return value;
}
```

- [ ] **Step 6: Add the banners and wire the provider in**

Replace `src/app/Layout.tsx`:

```tsx
import { useState } from "react";
import { Link, Outlet } from "react-router";
import { useProgress } from "./progress";
import styles from "./Layout.module.css";

export const CREDITS =
  "Counter-Strike 2, map names and radar images © Valve Corporation. Videos © their creators. Not affiliated with Valve.";

export function Layout() {
  const { status, cannotSave } = useProgress();
  const [showResetNotice, setShowResetNotice] = useState(status === "reset");

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <Link to="/" className={styles.brand}>
          CS Smokes
        </Link>
      </header>
      {cannotSave && (
        <p className={styles.banner} role="status">
          Progress can't be saved in this browser.
        </p>
      )}
      {showResetNotice && (
        <p className={styles.banner} role="status">
          Your saved progress couldn't be read, so it was reset. A backup copy was kept in this
          browser.{" "}
          <button type="button" onClick={() => setShowResetNotice(false)}>
            Dismiss
          </button>
        </p>
      )}
      <main className={styles.main}>
        <Outlet />
      </main>
      <footer className={styles.footer}>{CREDITS}</footer>
    </div>
  );
}
```

Append to `src/app/Layout.module.css`:

```css
.banner {
  margin: 0;
  padding: 10px 16px;
  background: color-mix(in srgb, var(--warn) 18%, var(--surface));
  border-bottom: 1px solid var(--border);
  color: var(--text);
}

.banner button {
  margin-left: 8px;
  padding: 2px 10px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface-2);
}
```

Replace `src/main.tsx`:

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router";
import { AppRoutes } from "./app/AppRoutes";
import { ProgressProvider } from "./app/progress";
import "./styles/global.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ProgressProvider>
      <HashRouter>
        <AppRoutes />
      </HashRouter>
    </ProgressProvider>
  </StrictMode>,
);
```

- [ ] **Step 7: Run all tests**

Run: `npm test`
Expected: PASS — including the earlier page tests, which now render inside the provider.

- [ ] **Step 8: Lint and commit**

Run: `npm run format && npm run lint && npm run build`

```bash
git add src
git commit -m "feat: save study progress and warn when it can't be saved"
```

---

### Task 23: Settings page

**Files:**
- Create: `src/features/settings/SettingsPage.tsx`, `src/features/settings/SettingsPage.module.css`
- Modify: `src/app/AppRoutes.tsx` (add the `settings` route), `src/app/Layout.tsx` (add the header nav with a Settings link)
- Test: `src/features/settings/SettingsPage.test.tsx`

**Interfaces:**
- Consumes: `useProgress` (Task 22); `NEW_PER_DAY_MIN`, `NEW_PER_DAY_MAX`, `exportProgress`, `exportFileName`, `importProgress`, `defaultProgress`, `STORAGE_KEY` (Task 22); `renderAt`, `memoryStorage` (Task 22).
- Produces: `SettingsPage()` at `#/settings` — a number field labelled "New smokes per day" (saves whole numbers 1–30 as you type; otherwise shows "Enter a whole number from 1 to 30."), buttons "Export progress" and "Reset progress", a file field labelled "Import progress", and a `role="status"` message ("Progress imported.", "Progress reset." or the import error). The header gets `<nav aria-label="Main">` with a "Settings" link.

- [ ] **Step 1: Write the failing tests**

`src/features/settings/SettingsPage.test.tsx`:

```tsx
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { STORAGE_KEY, defaultProgress } from "../../lib/storage";
import { memoryStorage } from "../../test/memoryStorage";
import { renderAt } from "../../test/render";

vi.mock("../../data", async () => (await import("../../test/fixtureData")).mockDataModule());

const now = () => new Date(2026, 9, 10, 9, 0);
const saved = (storage: ReturnType<typeof memoryStorage>) =>
  JSON.parse(storage.data.get(STORAGE_KEY) ?? "null");

afterEach(() => {
  vi.restoreAllMocks();
});

describe("SettingsPage", () => {
  it("is linked from the header", async () => {
    renderAt("/", { now });
    await userEvent.click(screen.getByRole("link", { name: "Settings" }));
    expect(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument();
  });

  it("saves the number of new smokes per day", async () => {
    const storage = memoryStorage();
    renderAt("/settings", { storage, now });
    const input = screen.getByLabelText("New smokes per day");
    await userEvent.clear(input);
    await userEvent.type(input, "15");
    expect(saved(storage).settings.newPerDay).toBe(15);
  });

  it("does not save numbers outside 1–30", async () => {
    const storage = memoryStorage();
    renderAt("/settings", { storage, now });
    const input = screen.getByLabelText("New smokes per day");
    await userEvent.clear(input);
    await userEvent.type(input, "45");
    expect(saved(storage).settings.newPerDay).toBe(4);
    expect(screen.getByText("Enter a whole number from 1 to 30.")).toBeInTheDocument();
  });

  it("exports progress as a dated JSON file", async () => {
    const createObjectURL = vi.fn(() => "blob:progress");
    Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    renderAt("/settings", { now });
    await userEvent.click(screen.getByRole("button", { name: "Export progress" }));
    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect((click.mock.instances[0] as unknown as HTMLAnchorElement).download).toBe(
      "cs-smokes-progress-2026-10-10.json",
    );
  });

  it("imports a valid file after confirmation", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const storage = memoryStorage();
    renderAt("/settings", { storage, now });
    const imported = {
      ...defaultProgress(),
      settings: { ...defaultProgress().settings, newPerDay: 7 },
    };
    const file = new File([JSON.stringify(imported)], "progress.json", { type: "application/json" });
    await userEvent.upload(screen.getByLabelText("Import progress"), file);
    expect(await screen.findByText("Progress imported.")).toBeInTheDocument();
    expect(screen.getByLabelText("New smokes per day")).toHaveValue(7);
    expect(saved(storage).settings.newPerDay).toBe(7);
  });

  it("rejects a file that isn't a progress export and keeps the current progress", async () => {
    const storage = memoryStorage();
    renderAt("/settings", { storage, now });
    const file = new File(["nope"], "progress.json", { type: "application/json" });
    await userEvent.upload(screen.getByLabelText("Import progress"), file);
    expect(
      await screen.findByText("That file isn't a CS Smokes progress export."),
    ).toBeInTheDocument();
    expect(saved(storage)).toBeNull();
  });

  it("resets progress after confirmation, and not without it", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const storage = memoryStorage({
      [STORAGE_KEY]: JSON.stringify({
        ...defaultProgress(),
        settings: { ...defaultProgress().settings, newPerDay: 20 },
      }),
    });
    renderAt("/settings", { storage, now });
    await userEvent.click(screen.getByRole("button", { name: "Reset progress" }));
    expect(screen.getByLabelText("New smokes per day")).toHaveValue(20);
    confirm.mockReturnValue(true);
    await userEvent.click(screen.getByRole("button", { name: "Reset progress" }));
    expect(screen.getByText("Progress reset.")).toBeInTheDocument();
    expect(saved(storage)).toEqual(defaultProgress());
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/features/settings`
Expected: FAIL — there is no "Settings" link and `/settings` shows Not found.

- [ ] **Step 3: Implement the page**

`src/features/settings/SettingsPage.tsx`:

```tsx
import { useState, type ChangeEvent } from "react";
import { useProgress } from "../../app/progress";
import {
  NEW_PER_DAY_MAX,
  NEW_PER_DAY_MIN,
  exportFileName,
  exportProgress,
  importProgress,
} from "../../lib/storage";
import styles from "./SettingsPage.module.css";

const isValidNewPerDay = (text: string) => {
  const value = Number(text);
  return text.trim() !== "" && Number.isInteger(value) && value >= NEW_PER_DAY_MIN && value <= NEW_PER_DAY_MAX;
};

export function SettingsPage() {
  const { progress, today, cannotSave, updateSettings, replace, reset } = useProgress();
  const [newPerDay, setNewPerDay] = useState(String(progress.settings.newPerDay));
  const [message, setMessage] = useState<string | null>(null);

  function changeNewPerDay(event: ChangeEvent<HTMLInputElement>) {
    const text = event.target.value;
    setNewPerDay(text);
    if (isValidNewPerDay(text)) updateSettings({ newPerDay: Number(text) });
  }

  function exportFile() {
    const url = URL.createObjectURL(
      new Blob([exportProgress(progress)], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = exportFileName(today);
    link.click();
    URL.revokeObjectURL(url);
  }

  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    const result = importProgress(await file.text());
    input.value = "";
    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    if (!window.confirm("Replace your current progress with the imported file?")) return;
    replace(result.progress);
    setNewPerDay(String(result.progress.settings.newPerDay));
    setMessage("Progress imported.");
  }

  function resetAll() {
    if (!window.confirm("Reset all study progress? This can't be undone.")) return;
    reset();
    setNewPerDay("10");
    setMessage("Progress reset.");
  }

  const invalid = !isValidNewPerDay(newPerDay);

  return (
    <section className={styles.page}>
      <h1>Settings</h1>
      {cannotSave && (
        <p className={styles.warning}>
          This browser can't save progress, so your settings and study progress last only until
          you close the page.
        </p>
      )}

      <label className={styles.field}>
        New smokes per day
        <input
          type="number"
          inputMode="numeric"
          min={NEW_PER_DAY_MIN}
          max={NEW_PER_DAY_MAX}
          value={newPerDay}
          onChange={changeNewPerDay}
          aria-invalid={invalid}
        />
      </label>
      {invalid && <p className={styles.hint}>Enter a whole number from 1 to 30.</p>}

      <div className={styles.actions}>
        <button type="button" onClick={exportFile}>
          Export progress
        </button>
        <label className={styles.fileButton}>
          Import progress
          <input type="file" accept="application/json,.json" onChange={importFile} />
        </label>
        <button type="button" onClick={resetAll} className={styles.danger}>
          Reset progress
        </button>
      </div>

      {message && <p role="status">{message}</p>}
    </section>
  );
}
```

`src/features/settings/SettingsPage.module.css`:

```css
.page {
  display: grid;
  gap: 16px;
  max-width: 520px;
}

.field {
  display: grid;
  gap: 6px;
  font-weight: 600;
}

.field input {
  width: 120px;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text);
  font: inherit;
}

.field input[aria-invalid="true"] {
  border-color: var(--bad);
}

.hint {
  margin: 0;
  color: var(--bad);
}

.warning {
  margin: 0;
  padding: 10px 12px;
  border-radius: var(--radius);
  background: color-mix(in srgb, var(--warn) 18%, var(--surface));
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.actions button,
.fileButton {
  position: relative;
  padding: 8px 14px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface-2);
  cursor: pointer;
}

.fileButton input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.danger {
  color: var(--bad);
}
```

In `src/app/Layout.tsx`, change the router import to `import { Link, NavLink, Outlet } from "react-router";` and add the nav after the brand link inside `<header>`:

```tsx
        <nav className={styles.nav} aria-label="Main">
          <NavLink to="/settings">Settings</NavLink>
        </nav>
```

In `src/app/AppRoutes.tsx`, add `import { SettingsPage } from "../features/settings/SettingsPage";` and this route before the catch-all:

```tsx
        <Route path="settings" element={<SettingsPage />} />
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `npx vitest run src/features/settings src/app`
Expected: PASS.

- [ ] **Step 5: Lint and commit**

Run: `npm test && npm run format && npm run lint && npm run build`

```bash
git add src
git commit -m "feat: add settings page with export, import and reset"
```

---

### Task 24: Study mode, and progress on the home page

**Files:**
- Create: `src/features/study/session.ts`, `src/features/study/StudyCard.tsx`, `src/features/study/StudyPage.tsx`, `src/features/study/Study.module.css`
- Modify: `src/features/home/HomePage.tsx` (replace the whole file), `src/features/home/HomePage.module.css` (add `.top`, `.study`), `src/app/Layout.tsx` (add the Study link), `src/app/AppRoutes.tsx` (add the `study` route), `src/app/AppRoutes.test.tsx` (tile text)
- Test: `src/features/study/session.test.ts`, `src/features/study/StudyPage.test.tsx`

**Interfaces:**
- Consumes: `useProgress` (Task 22); `allLineups`, `getMapData` (Task 4); `MAPS`, `getMapInfo`, `hasLevels` (Task 2); `MAP_IDS`, `SIDES`, `Level`, `Position` (Task 2); `buildQueue`, `eligible`, `knownCount`, `newAllowance`, `nextDueDate`, `studyCounts`, `QueueItem`, `Rating`, `StudyFilter` (Task 21); `techniqueText`, `techniqueChoices` (Task 3); `Rng` (Task 3); `isClose`, `Point` (Task 9); `Radar`, `LandingMarker`, `StandDot`, `StandLine`, `TapMark` (Task 9); `LevelSwitch` (Task 20); `VideoPlayer` (Task 10); `StatusBadge` (Task 11).
- Produces: `session.ts`: `interface Session { items: QueueItem[]; firstPass: number; index: number; got: number; forgot: number }`; `startSession(items)`, `currentItem(session)`, `isRepeat(session)`, `isFinished(session)`, `answerSession(session, rating)`. `StudyCard({ item, sameMapTechniques, onRate, rng? })`. `StudyPage()` at `#/study`. Home tiles read "N/M known"; home has a "Study · N due" link; the header nav reads "Study", "Settings".

- [ ] **Step 1: Write the failing session tests**

`src/features/study/session.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { QueueItem } from "../../lib/scheduler";
import { makeLineup } from "../../test/fixtures";
import { answerSession, currentItem, isFinished, isRepeat, startSession } from "./session";

const item = (id: string): QueueItem => ({ map: "mirage", lineup: makeLineup({ id }), isNew: true });

describe("study session", () => {
  it("goes through the cards in order", () => {
    let session = startSession([item("mirage-a"), item("mirage-b")]);
    expect(currentItem(session)?.lineup.id).toBe("mirage-a");
    session = answerSession(session, "got");
    expect(currentItem(session)?.lineup.id).toBe("mirage-b");
    session = answerSession(session, "got");
    expect(isFinished(session)).toBe(true);
    expect(session).toMatchObject({ got: 2, forgot: 0 });
  });

  it("shows a forgotten card once more at the end, and counts only first answers", () => {
    let session = startSession([item("mirage-a"), item("mirage-b")]);
    session = answerSession(session, "forgot");
    session = answerSession(session, "got");
    expect(currentItem(session)?.lineup.id).toBe("mirage-a");
    expect(isRepeat(session)).toBe(true);
    session = answerSession(session, "forgot");
    expect(isFinished(session)).toBe(true);
    expect(session).toMatchObject({ got: 1, forgot: 1 });
  });

  it("ignores answers after the end", () => {
    expect(answerSession(startSession([]), "got")).toEqual(startSession([]));
  });
});
```

Run: `npx vitest run src/features/study/session.test.ts`
Expected: FAIL — `Failed to resolve import "./session"`.

- [ ] **Step 2: Implement `src/features/study/session.ts`**

```ts
import type { QueueItem, Rating } from "../../lib/scheduler";

export interface Session {
  items: QueueItem[];
  /** How many items the session started with; anything after is an end-of-session repeat. */
  firstPass: number;
  index: number;
  got: number;
  forgot: number;
}

export function startSession(items: QueueItem[]): Session {
  return { items, firstPass: items.length, index: 0, got: 0, forgot: 0 };
}

export function currentItem(session: Session): QueueItem | undefined {
  return session.items[session.index];
}

export function isRepeat(session: Session): boolean {
  return session.index >= session.firstPass;
}

export function isFinished(session: Session): boolean {
  return session.index >= session.items.length;
}

/** A forgotten smoke is shown once more at the end. Repeats don't count in the totals. */
export function answerSession(session: Session, rating: Rating): Session {
  const item = currentItem(session);
  if (!item) return session;
  const repeat = isRepeat(session);
  return {
    ...session,
    items: rating === "forgot" && !repeat ? [...session.items, item] : session.items,
    index: session.index + 1,
    got: session.got + (!repeat && rating === "got" ? 1 : 0),
    forgot: session.forgot + (!repeat && rating === "forgot" ? 1 : 0),
  };
}
```

Run: `npx vitest run src/features/study/session.test.ts`
Expected: PASS.

- [ ] **Step 3: Write the failing page tests**

`src/features/study/StudyPage.test.tsx` (the last test pins Review Focus 4 at the screen level):

```tsx
import { fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { STORAGE_KEY, defaultProgress, type Progress } from "../../lib/storage";
import { failingStorage, memoryStorage } from "../../test/memoryStorage";
import { renderAt } from "../../test/render";

vi.mock("../../data", async () => (await import("../../test/fixtureData")).mockDataModule());
vi.mock("../smoke/VideoPlayer", () => ({
  VideoPlayer: ({ title }: { title: string }) => <div data-testid="video">{title}</div>,
}));

const now = () => new Date(2026, 9, 10, 9, 0);
const stored = (progress: Progress) => memoryStorage({ [STORAGE_KEY]: JSON.stringify(progress) });

async function answerCard(rating: "Forgot" | "Got it") {
  await userEvent.click(screen.getByRole("button", { name: "Skip" }));
  const choices = within(screen.getByRole("group", { name: "Technique" })).getAllByRole("button");
  await userEvent.click(choices[0]);
  await userEvent.click(screen.getByRole("button", { name: rating }));
}

describe("StudyPage", () => {
  it("counts due and new smokes, leaving out broken ones", () => {
    renderAt("/study", { now });
    expect(screen.getByText("0 due · 6 new")).toBeInTheDocument();
  });

  it("is linked from home and from the header", async () => {
    renderAt("/", { now });
    expect(screen.getByRole("link", { name: "Study · 6 due" })).toHaveAttribute("href", "/study");
    await userEvent.click(screen.getByRole("link", { name: "Study" }));
    expect(screen.getByRole("heading", { name: "Study", level: 1 })).toBeInTheDocument();
  });

  it("walks through a card: stand spot, technique, clip, rating", async () => {
    const storage = memoryStorage();
    renderAt("/study", { storage, now });
    await userEvent.click(screen.getByRole("button", { name: "Start" }));
    expect(screen.getByRole("heading", { name: "Window — from T Spawn" })).toBeInTheDocument();

    const radar = screen.getByTestId("radar");
    vi.spyOn(radar, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      width: 500,
      height: 500,
    } as DOMRect);
    fireEvent.click(radar, { clientX: 400, clientY: 300 }); // the stand spot is (0.8, 0.6)
    expect(screen.getByTestId("tap-mark")).toHaveAttribute("data-correct", "true");
    expect(screen.getByText("✓ Right spot")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Jump throw · left click" }));
    expect(screen.getByText("✓ Right")).toBeInTheDocument();
    expect(screen.getByTestId("video")).toHaveTextContent("Window from T Spawn");

    await userEvent.click(screen.getByRole("button", { name: "Got it" }));
    const saved = JSON.parse(storage.data.get(STORAGE_KEY)!);
    expect(saved.cards["mirage-window-from-t-spawn"]).toEqual({
      box: 2,
      due: "2026-10-12",
      lastReviewed: "2026-10-10",
    });
    expect(screen.getByRole("heading", { name: "Outside — from T Roof" })).toBeInTheDocument();
  });

  it("marks a tap far from the stand spot as wrong", async () => {
    renderAt("/study", { now });
    await userEvent.click(screen.getByRole("button", { name: "Start" }));
    const radar = screen.getByTestId("radar");
    vi.spyOn(radar, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      width: 500,
      height: 500,
    } as DOMRect);
    fireEvent.click(radar, { clientX: 50, clientY: 50 });
    expect(screen.getByTestId("tap-mark")).toHaveAttribute("data-correct", "false");
    expect(screen.getByTestId("stand-dot")).toBeInTheDocument();
  });

  it("shows a forgotten smoke once more at the end, without changing its schedule twice", async () => {
    const progress = {
      ...defaultProgress(),
      settings: { ...defaultProgress().settings, maps: ["mirage"], sides: ["CT"] },
    } as Progress;
    const storage = stored(progress);
    renderAt("/study", { storage, now });
    expect(screen.getByText("0 due · 1 new")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Start" }));
    expect(screen.getByText("Card 1 of 1")).toBeInTheDocument();
    await answerCard("Forgot");
    expect(screen.getByText("Card 2 of 2 · repeat")).toBeInTheDocument();
    await answerCard("Got it");
    expect(screen.getByRole("heading", { name: "Session done" })).toBeInTheDocument();
    expect(screen.getByText("Got it: 0 · Forgot: 1")).toBeInTheDocument();
    expect(screen.getByText("Next review: 2026-10-11")).toBeInTheDocument();
    expect(JSON.parse(storage.data.get(STORAGE_KEY)!).cards["mirage-top-mid-from-ct-spawn"]).toEqual({
      box: 1,
      due: "2026-10-11",
      lastReviewed: "2026-10-10",
    });
  });

  it("says when nothing is due and when the next review is", () => {
    const ids = [
      "mirage-window-from-t-spawn",
      "mirage-ct-from-t-ramp",
      "mirage-jungle-from-t-ramp",
      "mirage-top-mid-from-ct-spawn",
      "nuke-outside-from-t-roof",
      "nuke-ramp-from-lobby",
    ];
    const cards = Object.fromEntries(
      ids.map((id) => [id, { box: 2, due: "2026-10-12", lastReviewed: "2026-10-10" }]),
    );
    renderAt("/study", { storage: stored({ ...defaultProgress(), cards } as Progress), now });
    expect(screen.getByText("0 due · 0 new")).toBeInTheDocument();
    expect(
      screen.getByText("Nothing to study right now. Next review: 2026-10-12."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start" })).toBeDisabled();
  });

  it("says when no smokes match the chosen maps and sides", async () => {
    renderAt("/study", { now });
    await userEvent.click(screen.getByRole("checkbox", { name: "T" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "CT" }));
    expect(screen.getByText("No smokes match these choices.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start" })).toBeDisabled();
  });

  it("keeps studying when the browser can't save, and says so", async () => {
    renderAt("/study", { storage: failingStorage(), now });
    await userEvent.click(screen.getByRole("button", { name: "Start" }));
    await answerCard("Got it");
    expect(screen.getByText("Progress can't be saved in this browser.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Outside — from T Roof" })).toBeInTheDocument();
  });
});
```

(With `FIXTURE_DATA`, six smokes can be studied — Mirage's four that aren't broken plus Nuke's two — and new smokes come round-robin across maps: Window, Outside, CT, Ramp, Jungle, Top Mid.)

In `src/app/AppRoutes.test.tsx`, change the two tile-count expectations to the new wording:

```tsx
    expect(tiles[5]).toHaveTextContent("0/4 known");
    expect(tiles[0]).toHaveTextContent("0/0 known");
```

Run: `npx vitest run src/features/study src/app`
Expected: FAIL — `/study` shows Not found; home tiles still say "4 smokes".

- [ ] **Step 4: Implement the study card**

`src/features/study/StudyCard.tsx`:

```tsx
import { useState } from "react";
import { getMapInfo, hasLevels } from "../../data/maps";
import type { Level, Position } from "../../data/schema";
import { isClose, type Point } from "../../lib/radar";
import type { Rng } from "../../lib/random";
import type { QueueItem, Rating } from "../../lib/scheduler";
import { techniqueChoices, techniqueText } from "../../lib/technique";
import { LevelSwitch } from "../map/FiltersBar";
import { Radar } from "../map/Radar";
import { LandingMarker, StandDot, StandLine, TapMark } from "../map/markers";
import { StatusBadge } from "../smoke/StatusBadge";
import { VideoPlayer } from "../smoke/VideoPlayer";
import styles from "./Study.module.css";

export interface StudyCardProps {
  item: QueueItem;
  /** Technique texts of the map's other smokes, used for distractors. */
  sameMapTechniques: readonly string[];
  onRate: (rating: Rating) => void;
  rng?: Rng;
}

export function StudyCard({ item, sameMapTechniques, onRate, rng }: StudyCardProps) {
  const { lineup } = item;
  const map = getMapInfo(item.map)!;
  const withLevels = hasLevels(map);
  const correct = techniqueText(lineup.throw);

  const [level, setLevel] = useState<Level>(lineup.stand.level ?? "upper");
  const [tap, setTap] = useState<Point | null>(null);
  const [standShown, setStandShown] = useState(false);
  const [choices] = useState(() => techniqueChoices(correct, sameMapTechniques, rng));
  const [picked, setPicked] = useState<string | null>(null);

  const on = (position: Position) => !withLevels || (position.level ?? "upper") === level;
  const tapRight = tap !== null && isClose(tap, lineup.stand);

  return (
    <article className={styles.card} aria-label={`Study: ${lineup.name} from ${lineup.from}`}>
      <header className={styles.prompt}>
        <p className={styles.mapName}>
          {map.name} ·{" "}
          <span className={styles.side} data-side={lineup.side}>
            {lineup.side}
          </span>
        </p>
        <h2>
          {lineup.name} — from {lineup.from}
        </h2>
        {lineup.status === "unreviewed" && <StatusBadge status="unreviewed" />}
      </header>

      <section className={styles.step}>
        <h3>1. Where do you stand?</h3>
        {withLevels && <LevelSwitch value={level} onSelect={setLevel} />}
        <Radar
          map={map}
          level={level}
          label={`${map.name} radar`}
          onTap={
            standShown
              ? undefined
              : (point) => {
                  setTap(point);
                  setStandShown(true);
                }
          }
        >
          {on(lineup.land) && <LandingMarker at={lineup.land} side={lineup.side} />}
          {standShown && on(lineup.stand) && on(lineup.land) && (
            <StandLine from={lineup.stand} to={lineup.land} />
          )}
          {standShown && on(lineup.stand) && <StandDot at={lineup.stand} side={lineup.side} />}
          {tap && <TapMark at={tap} correct={tapRight} />}
        </Radar>
        {standShown ? (
          <p className={styles.result}>
            {tap === null
              ? "The dot shows where to stand."
              : tapRight
                ? "✓ Right spot"
                : "✗ Not quite — the dot shows where to stand."}
          </p>
        ) : (
          <button type="button" onClick={() => setStandShown(true)}>
            Skip
          </button>
        )}
      </section>

      {standShown && (
        <section className={styles.step}>
          <h3>2. How do you throw it?</h3>
          <div className={styles.choices} role="group" aria-label="Technique">
            {choices.map((choice) => (
              <button
                key={choice}
                type="button"
                disabled={picked !== null}
                data-result={
                  picked === null
                    ? undefined
                    : choice === correct
                      ? "correct"
                      : choice === picked
                        ? "wrong"
                        : undefined
                }
                onClick={() => setPicked(choice)}
              >
                {choice}
              </button>
            ))}
          </div>
          {picked && (
            <p className={styles.result}>{picked === correct ? "✓ Right" : `✗ It's ${correct}`}</p>
          )}
        </section>
      )}

      {picked && (
        <section className={styles.step}>
          <h3>3. Check your aim</h3>
          <VideoPlayer video={lineup.video} title={`${lineup.name} from ${lineup.from}`} />
          {lineup.notes && <p className={styles.notes}>{lineup.notes}</p>}
          <div className={styles.rating}>
            <button type="button" onClick={() => onRate("forgot")}>
              Forgot
            </button>
            <button type="button" onClick={() => onRate("got")}>
              Got it
            </button>
          </div>
        </section>
      )}
    </article>
  );
}
```

- [ ] **Step 5: Implement the study page and its styles**

`src/features/study/StudyPage.tsx`:

```tsx
import { useState } from "react";
import { Link } from "react-router";
import { useProgress } from "../../app/progress";
import { allLineups, getMapData } from "../../data";
import { MAPS } from "../../data/maps";
import { MAP_IDS, SIDES, type MapId, type Side } from "../../data/schema";
import {
  buildQueue,
  eligible,
  newAllowance,
  nextDueDate,
  studyCounts,
  type StudyFilter,
} from "../../lib/scheduler";
import { techniqueText } from "../../lib/technique";
import { StudyCard } from "./StudyCard";
import {
  answerSession,
  currentItem,
  isFinished,
  isRepeat,
  startSession,
  type Session,
} from "./session";
import styles from "./Study.module.css";

/** Adds or removes `value`, keeping the result in `order`. */
function toggled<T>(list: readonly T[], value: T, order: readonly T[]): T[] {
  const next = list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
  return order.filter((v) => next.includes(v));
}

export function StudyPage() {
  const { progress, today, answer, updateSettings } = useProgress();
  const [session, setSession] = useState<Session | null>(null);
  const candidates = allLineups();
  const filter: StudyFilter = { maps: progress.settings.maps, sides: progress.settings.sides };
  const allowance = newAllowance(progress.newToday, progress.settings.newPerDay, today);

  if (session && !isFinished(session)) {
    const item = currentItem(session)!;
    const sameMap = getMapData(item.map)
      .lineups.filter((lineup) => lineup.id !== item.lineup.id)
      .map((lineup) => techniqueText(lineup.throw));
    return (
      <section className={styles.page}>
        <p className={styles.progressLine}>
          Card {session.index + 1} of {session.items.length}
          {isRepeat(session) ? " · repeat" : ""}
        </p>
        <StudyCard
          key={`${session.index}:${item.lineup.id}`}
          item={item}
          sameMapTechniques={sameMap}
          onRate={(rating) => {
            answer(item.lineup.id, rating);
            setSession(answerSession(session, rating));
          }}
        />
      </section>
    );
  }

  const next = nextDueDate(candidates, progress.cards, filter, today);

  if (session) {
    return (
      <section className={styles.page}>
        <h1>Session done</h1>
        <p>
          Got it: {session.got} · Forgot: {session.forgot}
        </p>
        <p>{next ? `Next review: ${next}` : "Nothing is scheduled yet."}</p>
        <div className={styles.row}>
          <button type="button" onClick={() => setSession(null)}>
            Study setup
          </button>
          <Link to="/">Back to maps</Link>
        </div>
      </section>
    );
  }

  const { due, fresh } = studyCounts({ candidates, cards: progress.cards, filter, allowance, today });
  const empty = due + fresh === 0;

  return (
    <section className={styles.page}>
      <h1>Study</h1>
      <fieldset className={styles.fieldset}>
        <legend>Maps</legend>
        {MAPS.map((map) => (
          <label key={map.id} className={styles.check}>
            <input
              type="checkbox"
              checked={progress.settings.maps.includes(map.id)}
              onChange={() =>
                updateSettings({ maps: toggled<MapId>(progress.settings.maps, map.id, MAP_IDS) })
              }
            />
            {map.name}
          </label>
        ))}
      </fieldset>
      <fieldset className={styles.fieldset}>
        <legend>Sides</legend>
        {SIDES.map((side) => (
          <label key={side} className={styles.check}>
            <input
              type="checkbox"
              checked={progress.settings.sides.includes(side)}
              onChange={() =>
                updateSettings({ sides: toggled<Side>(progress.settings.sides, side, SIDES) })
              }
            />
            {side}
          </label>
        ))}
      </fieldset>
      <p className={styles.counts}>
        {due} due · {fresh} new
      </p>
      {empty && (
        <p>
          {eligible(candidates, filter).length === 0
            ? "No smokes match these choices."
            : `Nothing to study right now.${next ? ` Next review: ${next}.` : ""}`}
        </p>
      )}
      <button
        type="button"
        className={styles.start}
        disabled={empty}
        onClick={() =>
          setSession(
            startSession(buildQueue({ candidates, cards: progress.cards, filter, allowance, today })),
          )
        }
      >
        Start
      </button>
    </section>
  );
}
```

`src/features/study/Study.module.css`:

```css
.page {
  display: grid;
  gap: 16px;
  max-width: 720px;
}

.progressLine {
  margin: 0;
  color: var(--text-muted);
}

.card {
  display: grid;
  gap: 16px;
}

.prompt {
  display: grid;
  gap: 6px;
  justify-items: start;
}

.prompt h2 {
  font-size: 1.3rem;
  overflow-wrap: anywhere;
}

.mapName {
  margin: 0;
  color: var(--text-muted);
}

.side {
  font-weight: 700;
  color: var(--t-color);
}

.side[data-side="CT"] {
  color: var(--ct-color);
}

.step {
  display: grid;
  gap: 10px;
  justify-items: start;
}

.step h3 {
  font-size: 1rem;
}

.step > div[data-testid="radar"] {
  max-width: 520px;
}

.choices {
  display: grid;
  gap: 8px;
  width: 100%;
}

.choices button,
.rating button,
.step > button,
.row button,
.start {
  min-height: 44px;
  padding: 8px 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface-2);
  text-align: left;
}

.choices button[data-result="correct"] {
  border-color: var(--ok);
  color: var(--ok);
}

.choices button[data-result="wrong"] {
  border-color: var(--bad);
  color: var(--bad);
}

.result {
  margin: 0;
  font-weight: 600;
}

.notes {
  margin: 0;
  color: var(--text-muted);
}

.rating {
  display: flex;
  gap: 8px;
}

.fieldset {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  margin: 0;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
}

.check {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 32px;
}

.counts {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
}

.start {
  justify-self: start;
  background: var(--accent);
  color: #000;
  font-weight: 700;
}

.row {
  display: flex;
  align-items: center;
  gap: 16px;
}
```

- [ ] **Step 6: Show progress on the home page and link to Study**

Replace `src/features/home/HomePage.tsx`:

```tsx
import { Link } from "react-router";
import { useProgress } from "../../app/progress";
import { allLineups, getMapData } from "../../data";
import { MAPS } from "../../data/maps";
import { assetUrl } from "../../lib/assets";
import { knownCount, newAllowance, studyCounts } from "../../lib/scheduler";
import styles from "./HomePage.module.css";

export function HomePage() {
  const { progress, today } = useProgress();
  const { due, fresh } = studyCounts({
    candidates: allLineups(),
    cards: progress.cards,
    filter: { maps: progress.settings.maps, sides: progress.settings.sides },
    allowance: newAllowance(progress.newToday, progress.settings.newPerDay, today),
    today,
  });

  return (
    <section>
      <div className={styles.top}>
        <h1 className={styles.title}>Maps</h1>
        <Link to="/study" className={styles.study}>
          Study · {due + fresh} due
        </Link>
      </div>
      <ul className={styles.grid} aria-label="Maps">
        {MAPS.map((map) => {
          const { known, total } = knownCount(getMapData(map.id).lineups, progress.cards);
          return (
            <li key={map.id}>
              <Link to={`/maps/${map.id}`} className={styles.tile}>
                <img src={assetUrl(map.radar)} alt="" loading="lazy" className={styles.thumb} />
                <span className={styles.name}>{map.name}</span>
                <span className={styles.count}>
                  {known}/{total} known
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
```

In `src/features/home/HomePage.module.css`, change `.title` to `margin: 0; font-size: 1.4rem;` and append:

```css
.top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--gap);
  margin-bottom: 16px;
}

.study {
  padding: 8px 14px;
  border-radius: 999px;
  background: var(--accent);
  color: #000;
  font-weight: 700;
  text-decoration: none;
}
```

In `src/app/Layout.tsx`, put a Study link before the Settings link inside the nav:

```tsx
        <nav className={styles.nav} aria-label="Main">
          <NavLink to="/study">Study</NavLink>
          <NavLink to="/settings">Settings</NavLink>
        </nav>
```

In `src/app/AppRoutes.tsx`, add `import { StudyPage } from "../features/study/StudyPage";` and this route before the catch-all:

```tsx
        <Route path="study" element={<StudyPage />} />
```

- [ ] **Step 7: Run all tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 8: Lint, build and commit**

Run: `npm run format && npm run lint && npm run build`

```bash
git add src
git commit -m "feat: add study mode and show progress on the home page"
```

If the user approved pushing in Task 13, run `git push`.

---

### Task 25: Final check and release

**Files:**
- Modify: `README.md` (add a Study section)

**Interfaces:**
- Consumes: everything above.
- Produces: a green CI run and the live site with all Phase 1 features.

- [ ] **Step 1: Document studying**

Add this section to `README.md`, after "Data":

```markdown
## Studying

Study mode (`#/study`) shows the smokes that are due plus up to 10 new ones a day (change the
number in Settings). For each smoke: tap where you stand, pick the throw, watch the clip, then
answer Forgot or Got it. Smokes come back after 1, 2, 4, 8 and 16 days; from the 8-day box on
they count as known. Progress is saved in each browser separately — use Settings → Export /
Import to move it between your phone and PC.
```

- [ ] **Step 2: Run every check from a clean install**

Run: `npm ci && npm run lint && npm run validate && npm run check-videos && npm test && npm run build`
Expected: every step passes. If `check-videos` reports a failed video, mark that smoke `"status": "broken"` in its data file (or replace the video by following `docs/seeding.md` steps 3–4), then run the checks again.

- [ ] **Step 3: Commit and publish**

```bash
git add README.md data
git commit -m "docs: explain study mode"
git push
```

(Push only if the user approved pushing in Task 13.) Wait for the "Check and deploy" run (or the Cloudflare build) to finish green.

- [ ] **Step 4: Final phone check (the user does this)**

Send the user the live URL and this checklist:
1. Home shows "Study · N due" and every tile reads "0/M known".
2. Study → Start: tap a stand spot, pick a throw, watch the clip, answer; the next card appears.
3. Settings → Export progress downloads a file; Import progress brings it back on another device.
4. Each map's Executes tab lists its executes; opening one numbers its smokes on the radar.

- [ ] **Step 5: Hand over**

Tell the user how many smokes are still `unreviewed` per map (count them in `data/maps/*.json`) and that marking reviewed smokes `"ok"` by hand works until Phase 2's editor exists.

