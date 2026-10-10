# CS2 Smoke Lineups — Design Spec

- **Date:** 2026-10-10
- **Status:** Design approved section by section in brainstorming; this written spec awaits review
- **Project folder:** `cs-smokes-helper/`

## 1. Summary

A personal website for learning Counter-Strike 2 smoke lineups away from the game.
You pick a map, see every smoke on the radar, watch a short looping clip of the throw,
and drill the smokes with a spaced-repetition study mode. It covers the seven Active Duty
maps: Ancient, Anubis, Cache, Dust II, Inferno, Mirage and Nuke.

It is a static site. Lineup data lives in the repo as JSON, changes are published with
`git push`, and the same site works on PC and phone.

## 2. Intent

**Stated by the user**

- Learn smoke lineups for Dust II, Mirage, Nuke, Ancient, Anubis, Cache and Inferno.
- Study outside the game; nothing should require launching CS2.
- Learn each lineup from a video of the throw.
- Claude seeds a starter set; the user adds more later.
- Use it on PC and phone; edit on the PC; publish as a free static website.
- Build the website first; editing tools come later.

**Assumed (stated during brainstorming, not contradicted)**

- Smokes only in this version.
- One user. Friends may open the link; there are no accounts.
- Study progress is stored per device.
- Written in TypeScript, matching the user's other Node projects.

**Success criteria**

1. On a phone, from the home screen, you can pick a map, see its smokes on the radar
   and play a smoke's clip within three taps.
2. A daily study session shows which smokes you know and repeats the weak ones.
3. All seven maps have 10–15 seeded essential smokes from recent CS2-era videos, each
   marked `unreviewed` until the user checks it.
4. (Phase 2) Adding a smoke from a video link takes about a minute.

## 3. Background (research, October 2026)

- The seven maps are the current Active Duty pool. Anubis returned in January 2026
  (replacing Train) and Cache was promoted mid-2026 (replacing Overpass). This comes from
  several up-to-date third-party sites, not an official Valve post.
- Large free lineup libraries already exist: CSNADES.gg (about 930 smokes with videos),
  SCOPE.GG (radar with copyable `setpos`) and the Yprac Hub workshop map. None offers its
  data for reuse, and none of those found offers spaced-repetition study. This project's
  value is a personal, curated set plus a study mode.
- Since March 2026, CS2 has in-game Map Guides (annotation files showing where to stand
  and aim). Not used here, because the user wants to study outside the game. Listed as a
  future idea.
- Since the 19 August 2024 update, binds that combine movement and attack actions (such
  as jump-throw binds) are ignored on official servers. Throws are done by hand, so every
  smoke records its technique explicitly.

## 4. Scope

**Phase 1 — website (this spec's main deliverable)**

- Home, map view (radar, list, filters), smoke card with looping video, execute view,
  study mode, settings.
- Data files for all seven maps, seeded by Claude.
- Data validation, tests, and CI that deploys to static hosting.
- Phone-friendly layout that can be added to the phone's home screen.

**Phase 2 — edit mode (outlined in §11, designed in detail before it starts)**

- A local-only editing UI that writes the data files.

**Out of scope**

- Grenades other than smokes.
- In-game coordinates (`setpos`), practice configs, in-game guide export.
- Demo parsing and 3D map rendering.
- Accounts, cross-device sync, offline mode, translations, analytics.
- Editing from the phone.

## 5. Architecture

| Concern | Decision |
|---|---|
| Language and build | TypeScript (strict), React, Vite — current stable versions at setup time |
| Routing | React Router with hash routes, so any static host works |
| Data shape | Zod schemas in `src/data/schema.ts`; TypeScript types come from them (`z.infer`). Shared by the app, the validation script and the Phase 2 editor |
| Data | `data/maps/<mapId>.json`, one file per map, committed to git. All files are bundled at build time (about 100 smokes, tens of KB) |
| Radar images | `public/radars/<mapId>.webp`, plus `nuke-lower.webp` |
| Styling | Plain CSS: CSS Modules plus CSS variables; dark theme only |
| Quality tools | ESLint and Prettier (Prettier also formats the data files) |
| Tests | Vitest, React Testing Library, jsdom |
| Progress | Browser `localStorage`, with export and import as a JSON file |
| Hosting | GitHub Pages via GitHub Actions (needs a public repo on GitHub's free plan); Cloudflare Pages if the repo should stay private |
| Asset paths | Vite `base: './'`, so the same build works at any URL path |
| Phone | Responsive layout; web manifest and icons for add-to-home-screen; no service worker |
| Runtime | Node 22 or newer locally (this PC has Node 25); CI uses the current Node LTS |

**One app, two modes.** The published build is read-only. In Phase 2, running
`npm run dev` adds editing; that code sits behind `import.meta.env.DEV`, so it is left
out of the production bundle.

The app does not re-validate data at runtime: validation runs before every build in CI
(§6.6), so the bundled data is trusted.

**Project layout**

```
cs-smokes-helper/
  data/maps/              ancient.json … nuke.json
  public/radars/          radar images
  public/                 web manifest, icons
  src/
    app/                  routes, layout, not-found
    data/                 schema.ts, maps.ts (map registry), index.ts (bundled data)
    features/
      home/
      map/                radar, markers, filters, list
      smoke/              smoke card, video player
      executes/
      study/              setup, session, summary
      settings/
    lib/                  youtube.ts, technique.ts, scheduler.ts, storage.ts, radar.ts
  scripts/                validate-data.ts, check-videos.ts
  .github/workflows/      deploy.yml
  docs/superpowers/specs/ this spec
  README.md               run, validate, deploy, add a smoke by hand (until Phase 2)
```

## 6. Data model

### 6.1 Map registry (`src/data/maps.ts`)

| id | Display name | Radar images | Levels |
|---|---|---|---|
| `ancient` | Ancient | `ancient.webp` | — |
| `anubis` | Anubis | `anubis.webp` | — |
| `cache` | Cache | `cache.webp` | — |
| `dust2` | Dust II | `dust2.webp` | — |
| `inferno` | Inferno | `inferno.webp` | — |
| `mirage` | Mirage | `mirage.webp` | — |
| `nuke` | Nuke | `nuke.webp` (upper), `nuke-lower.webp` (lower) | `upper`, `lower` |

The home screen lists maps in this (alphabetical) order.

### 6.2 Map file (`data/maps/<mapId>.json`)

```json
{
  "map": "mirage",
  "lineups": [],
  "executes": []
}
```

- `map` must equal the file name.
- All seven files must exist; the arrays may be empty.
- Array order matters: it is the display order in lists and the order in which new
  smokes are introduced in study.

### 6.3 Lineup

| Field | Type | Rules |
|---|---|---|
| `id` | string | kebab-case; starts with `<mapId>-`; unique across all maps; never changes after creation |
| `name` | string | 1–40 chars; the spot the smoke covers, e.g. "Window" |
| `from` | string | 1–40 chars; where it is thrown from, e.g. "T Spawn" |
| `side` | `"T"` \| `"CT"` | |
| `area` | `"A"` \| `"B"` \| `"Mid"` \| `"Other"` | |
| `throw.movement` | `"stand"` \| `"crouch"` \| `"walk"` \| `"run"` | |
| `throw.jump` | boolean | |
| `throw.click` | `"left"` \| `"right"` \| `"both"` | |
| `stand` | Position | where to stand |
| `land` | Position | where the smoke lands |
| `video.url` | string | absolute `https` URL |
| `video.start` | integer ≥ 0 | seconds; optional; YouTube URLs only |
| `video.end` | integer | seconds; optional; YouTube URLs only; greater than the effective start: `start`, else the URL's `t` value (§8), else 0 |
| `notes` | string | optional; at most 280 chars; aim hints, timing |
| `status` | `"unreviewed"` \| `"ok"` \| `"broken"` | |
| `checkedOn` | string | `YYYY-MM-DD`; when the smoke was created or last checked |

**Position** is `{ "x": number, "y": number, "level"?: "upper" | "lower" }`.
`x` and `y` are fractions (0–1) of the radar image's width and height, measured from the
top-left corner. `level` is required on Nuke and not allowed on any other map.

**New IDs** are `<mapId>-<slug(name)>-from-<slug(from)>`, with `-2`, `-3`, … added on a
collision. Renaming a smoke later does not change its id, so study progress stays attached.

Example:

```json
{
  "id": "mirage-window-from-t-spawn",
  "name": "Window",
  "from": "T Spawn",
  "side": "T",
  "area": "Mid",
  "throw": { "movement": "stand", "jump": true, "click": "left" },
  "stand": { "x": 0.81, "y": 0.62 },
  "land": { "x": 0.44, "y": 0.47 },
  "video": { "url": "https://www.youtube.com/watch?v=VIDEO_ID", "start": 95, "end": 112 },
  "notes": "Aim at the top-left corner of the antenna",
  "status": "unreviewed",
  "checkedOn": "2026-10-10"
}
```

(`VIDEO_ID` stands in for a real YouTube id; real data always has one.)

### 6.4 Technique text (`src/lib/technique.ts`)

The text is `<movement part> · <click part>`:

- Movement part:
  - `stand` + jump → "Jump throw"; `stand` without jump → "Standing throw"
  - otherwise "Crouch", "Walk" or "Run", followed by " + jump throw" or " + throw"
- Click part: "left click", "right click", or "left + right click"

| throw | Text |
|---|---|
| stand, jump, left | Jump throw · left click |
| run, jump, left | Run + jump throw · left click |
| stand, no jump, right | Standing throw · right click |
| crouch, no jump, left | Crouch + throw · left click |
| walk, no jump, both | Walk + throw · left + right click |

### 6.5 Execute

| Field | Type | Rules |
|---|---|---|
| `id` | string | kebab-case; starts with `<mapId>-`; unique across all maps (lineups and executes share one id space) |
| `name` | string | 1–40 chars, e.g. "A execute" |
| `side` | `"T"` \| `"CT"` | |
| `lineupIds` | string[] | 2–8 ids in throw order; each exists in the same file with the same side; no duplicates |
| `notes` | string | optional; at most 280 chars |

### 6.6 Validation

`npm run validate` runs the Zod schemas plus cross-checks:

- file name matches `map`, and all seven files exist;
- ids are unique across all files (lineups and executes);
- Nuke `level` rules (§6.3);
- execute references and sides (§6.5);
- video rules: `start`/`end` only on YouTube URLs, and `end` after the effective start.

Each error prints as `file → JSON path → message`, and the command exits non-zero. CI runs
it before every build.

### 6.7 Study progress (browser)

Stored under the `localStorage` key `cs-smokes:progress:v1`:

```json
{
  "version": 1,
  "cards": {
    "mirage-window-from-t-spawn": { "box": 3, "due": "2026-10-14", "lastReviewed": "2026-10-10" }
  },
  "newToday": { "date": "2026-10-10", "count": 4 },
  "settings": {
    "newPerDay": 10,
    "maps": ["ancient", "anubis", "cache", "dust2", "inferno", "mirage", "nuke"],
    "sides": ["T", "CT"]
  }
}
```

- A smoke with no entry in `cards` is *new*.
- Dates are the device's local calendar date.
- Entries for ids that no longer exist are kept but ignored, so restoring a smoke restores
  its progress.
- Defaults: `newPerDay` 10, all maps, both sides.

## 7. Screens

**Routes** (hash-based):

| Route | Screen |
|---|---|
| `#/` | Home |
| `#/maps/:mapId` | Map view |
| `#/maps/:mapId/smokes/:lineupId` | Smoke card |
| `#/maps/:mapId/executes/:executeId` | Execute view |
| `#/study` | Study (setup → session → summary) |
| `#/settings` | Settings |
| anything else, or an unknown id | Not found, with a link to the map or home |

Map-view filters live in the query string (`?side=T&area=A&level=upper`) and are carried
over to smoke-card routes, so back/forward, sharing and ‹ › navigation all respect them.

**Layout:** below 900 px wide, a single column (phone). From 900 px, two columns: radar on
the left (about 60%), list, card or execute on the right. On phone, the smoke card and
execute view fill the screen; on desktop they appear in the right-hand panel next to the
radar.

**Accessibility:** everything selectable on the radar is also reachable from the list,
which is keyboard- and screen-reader-friendly.

### 7.1 Home

- Seven map tiles: radar thumbnail, name, and "N/M known", where M is the number of
  smokes on that map that are not `broken`.
- A **Study** button showing "N due" (§9.2).
- A link to Settings, and a footer with credits (§13).

### 7.2 Map view

- A square radar with an SVG overlay. Each smoke that matches the filters appears as a
  landing circle coloured by side (T amber, CT blue).
- Filters:
  - Side: All / T / CT (default All).
  - Area: All / A / B / Mid / Other (default All).
  - Nuke only — Level: Upper / Lower (default Upper). A smoke appears on the level of its
    landing spot.
- Selecting a smoke (tapping its marker or its list row) goes to its smoke-card route. The
  radar highlights it, shows its stand dot, and draws a dashed line from stand to land.
  The stand dot and line are drawn only when the stand spot is on the level being shown.
- A tap selects the nearest landing marker within the hit area (at least 32 px). For
  crowded spots, the list is the fallback.
- Two tabs beside or below the radar:
  - **Smokes:** rows show name · from · side · technique, with an *unreviewed* or *broken*
    badge where relevant.
  - **Executes:** the map's executes.

### 7.3 Smoke card

- Header: name, "from <from>", side badge, and ‹ › to move to the previous or next smoke in
  the current filtered list.
- The video player (§8).
- Technique text (§6.4) and notes.
- A mini radar showing stand → land.
- Status badge and `checkedOn`.
- An "Open on YouTube" or "Open video" link.

### 7.4 Execute view

- Name, side and notes.
- A radar with the execute's smokes numbered 1…n (landing circles, stand dots, lines).
  On Nuke it has the same level switch as the map view.
- The smokes in throw order. Each row expands to show the smoke card's content; only the
  expanded row's video plays.

### 7.5 Study

- **Setup:** choose maps (checkboxes, default all) and sides; the screen shows
  "N due · M new" and a Start button. Choices are saved in `settings`. If nothing is due
  and no new smokes are left for today, it says so and shows the next due date instead.
- **Queue:**
  1. Due cards (`due` ≤ today) in random order.
  2. Then new smokes, up to today's remaining allowance (§9.2). They are taken round-robin
     across the selected maps (in registry order), and in file order within each map.

  Only `unreviewed` and `ok` smokes are included; `broken` smokes are left out.
- **Each card:**
  1. **Prompt:** map, side, "<name> — from <from>", and an *unreviewed* badge where
     relevant. The radar shows the landing spot. On Nuke it opens on the stand spot's
     level, with the level switch available.
  2. **Where you stand:** you tap the radar. The app reveals the real stand spot and marks
     your tap ✓ if it is within 0.06 (as a fraction of the radar width) of it, otherwise ✗.
     "Skip" reveals the spot without a tap.
  3. **How you throw:** four options, the correct technique text plus three distractors
     (§9.3). The app marks your choice.
  4. **Where you aim:** the clip plays and the notes are shown, so you can check your aim.
  5. **Rating:** "Forgot" or "Got it" updates the schedule (§9.1).
- **Summary:** how many you got and forgot, when the next card is due, and a link home.

### 7.6 Settings

- New smokes per day: 1–30, default 10.
- Export progress: downloads `cs-smokes-progress-YYYY-MM-DD.json`.
- Import progress: validated first; replaces current progress after confirmation.
- Reset progress, after confirmation.
- A warning when browser storage is unavailable.

## 8. Video playback

- **Recognised YouTube URLs:** `youtube.com/watch?v=ID`, `m.youtube.com/watch?v=ID`,
  `youtu.be/ID`, `youtube.com/shorts/ID` and `youtube.com/embed/ID`, with an optional
  `t` or `start` parameter in the forms `95`, `95s`, `1m35s` or `1h2m3s`. If `video.start`
  is absent, the URL's `t` value is used as the start.
- **Player:** the YouTube IFrame Player API, loaded once on first use, on the
  `youtube-nocookie.com` host with `playsinline=1` and `rel=0`. It autoplays muted when
  the card opens (phones only allow muted autoplay); the viewer can unmute.
- **Clip loop:** play from `start` (or 0); on reaching `end` (or the end of the video), seek
  back to `start` and play again.
- **Controls under the player:** Replay (seek to start), and speed 0.5× / 1×.
- **Other sites:** no embedded player, just an "Open video ↗" button that opens a new tab.
- **Errors:** any player error (the API's `onError` event, e.g. a removed video or one
  that blocks embedding) or a failure to load the API script shows a "Video unavailable"
  panel with the link.

## 9. Study scheduling (`src/lib/scheduler.ts`)

### 9.1 Boxes

| Box | Next review after |
|---|---|
| 1 | 1 day |
| 2 | 2 days |
| 3 | 4 days |
| 4 | 8 days |
| 5 | 16 days |

- A new smoke is treated as being in box 1. Answering a new smoke for the first time adds
  1 to `newToday.count`, which resets when the date changes. A new smoke that was shown
  but not answered stays new.
- **Got it:** box becomes min(box + 1, 5); `due` becomes today plus the new box's interval.
- **Forgot:** box becomes 1; `due` becomes tomorrow; the card is shown once more at the
  end of the current session. That repeat does not change its schedule.
- A card's schedule changes at most once per day.
- **Known** means box 4 or higher.

### 9.2 Counts

- **Due:** cards whose `due` is today or earlier and that match the study settings.
- **New allowance today:** `newPerDay − newToday.count` (or `newPerDay` if `newToday.date`
  is not today), never below 0.
- **Home "N due"** = due + min(new smokes available, new allowance today).

### 9.3 Technique distractors

Three distinct technique texts that differ from the correct one, picked at random: first
from the techniques of other smokes on the same map, then, if fewer than three were found,
from this fixed list:

- Jump throw · left click
- Run + jump throw · left click
- Standing throw · left click
- Standing throw · right click
- Standing throw · left + right click
- Walk + throw · left click
- Crouch + throw · left click

The four options are shown in random order.

## 10. Seed content (by Claude)

- **Amount:** 10–15 smokes per map (70–105 in total), plus one or two executes per map
  where the seeded smokes support them.
- **Choosing smokes:** the standard T-side execute smokes for each site, mid-control
  smokes, and a few key CT smokes, cross-checked across several current sources.
- **Video rules:**
  - Published after the map's most recent layout-changing update (looked up per map while
    seeding), and never before CS2's release on 27 September 2023. For Cache, that means
    after its return in April 2026.
  - Embeddable, checked through YouTube's oEmbed endpoint.
  - Prefer one guide per map with chapters, or short single-smoke videos.
- **Filling entries:** name, from, side, area, technique and notes come from the video's
  title, chapters and description. Start and end come from chapters or description
  timestamps, read from YouTube metadata; no videos are downloaded. If there are no
  reliable timestamps, `start` and `end` are left out and the notes say so.
- **Markers:** Claude places them by reading the radar image, aiming for accuracy within
  5% of the radar width.
- **Status:** every seed is `unreviewed`, with `checkedOn` set to the seeding date.
- **Order:** Mirage first, all the way to the first deploy; then the other six maps.
- **Report:** after each map, Claude posts a table in chat (name, from, side, technique,
  video link) for spot-checking.
- **Known limit:** Claude cannot watch videos, so clip times, technique and markers are
  best effort until the user reviews them.

## 11. Edit mode (Phase 2, outline)

- Available only under `npm run dev`; never in the published build.
- A Vite dev-server plugin exposes `PUT /__edit/maps/:mapId`, which takes a whole map file.
  It validates it with the shared schema and cross-checks, then writes the file atomically
  (temporary file, then rename) in Prettier's format, so git diffs stay clean. Errors come
  back as a list of `{ path, message }`.
- UI additions:
  - "Add smoke" on the map view; Edit and Delete on the smoke card.
  - The form parses a pasted video URL (including `t=`), can set start and end from the
    player's current time, and sets stand and land by clicking the radar, with dragging to
    adjust.
  - "Mark reviewed" sets `status` to `ok` and `checkedOn` to today.
  - Deleting a smoke also removes it from executes, after confirmation.
  - An executes editor picks smokes in order.
- Publishing stays manual: `git commit` and `git push`.
- Designed in detail in
  [2026-10-10-cs2-smoke-lineups-phase2-edit-mode-design.md](2026-10-10-cs2-smoke-lineups-phase2-edit-mode-design.md).

## 12. Error handling

| Situation | Behaviour |
|---|---|
| Invalid data file | `npm run validate` fails; CI stops before deploying; the message names the file, the JSON path and the problem |
| Video deleted, private or not embeddable | "Video unavailable" panel with the link; `npm run check-videos` lists such videos |
| YouTube API script fails to load | The same "Video unavailable" panel |
| `localStorage` unavailable | The app still works and shows "Progress can't be saved in this browser" |
| Stored progress corrupt or a different version | The raw value is copied to `cs-smokes:progress:backup:<timestamp>`, progress resets, and a one-time notice is shown |
| Imported progress file invalid | Rejected with a message; current progress unchanged |
| Unknown map, smoke or execute id in a URL | Not found screen with a link to the map or home |

`npm run check-videos` calls YouTube's oEmbed endpoint for every YouTube video and reports
each one as OK (with its title and channel) or failing (with the HTTP status oEmbed
returned, which covers removed, private and non-embeddable videos). It changes no files
and does not run in CI.

## 13. Radar images and credits

- **Source:** awpy's published map data. If Cache, or any other map, is missing or out of
  date there, the radars are exported from this PC's CS2 install with Source 2 Viewer (the
  radar textures in the game's overview-map images, including Nuke's lower level).
- **Processing:** square 1024×1024 WebP files, committed to `public/radars/`.
- **Footer:** "Counter-Strike 2, map names and radar images © Valve Corporation. Videos ©
  their creators. Not affiliated with Valve."
- Nothing is copied from other lineup sites. YouTube videos play through YouTube's own
  player; other sites are only linked.

## 14. Testing

- **Unit tests (Vitest), written before the code:**
  - schema and cross-checks: a valid file passes, and every rule has a failing case;
  - `youtube.ts`: every URL form and `t` format in §8;
  - `technique.ts`: the table in §6.4;
  - `scheduler.ts`: box moves, due dates, the once-per-day rule, the end-of-session repeat,
    the new-per-day limit and its daily reset, the known rule, and the counts in §9.2;
  - `radar.ts`: turning a pointer position into 0–1 fractions at different element sizes,
    and the 0.06 distance check;
  - `storage.ts`: missing, corrupt and wrong-version data, unknown ids, and import
    validation.
- **Component tests (React Testing Library):** the smoke card (technique text, video
  fallback, non-YouTube link), map filters (URL ↔ visible markers), and the study flow
  (tap → reveal → throw choice → rating updates progress). The YouTube IFrame API is
  mocked.
- **Data:** `npm run validate` over the real data files.
- **CI** (`.github/workflows/deploy.yml`, on every push to `main`): `npm ci` → lint →
  validate → test → build → deploy. Any failure stops the deploy.
- **Manual:** after the first deploy, a check on a real phone: layout, video playback and
  add-to-home-screen.
- **Not now:** end-to-end browser tests (e.g. Playwright). They will be added if UI
  regressions start appearing.

## 15. Build order

1. Project setup: Vite, React and TypeScript; ESLint and Prettier; Vitest; README.
2. Data schema, map registry, validation script, and radar images.
3. Mirage seed data.
4. Home, map view and smoke card, including the video player.
5. CI and the first deploy. **Milestone: usable on the phone.**
6. Seed data for the other six maps.
7. Executes: seed data and the execute view.
8. Study mode and settings.
9. Phase 2: edit mode, after its own detailed design.

## 16. Risks and open questions

- **Seed accuracy.** Claude cannot watch videos, so seeds start `unreviewed` and need the
  user's review. Expect some fixes.
- **YouTube metadata access** for chapters and timestamps may be limited while seeding.
  Fallback: description timestamps, or playing the whole video.
- **Cache radar availability** in awpy's data. Fallback: export from the local CS2 install
  with Source 2 Viewer.
- **Map updates** can silently break lineups. Mitigation: the `broken` status and
  `checkedOn` date; re-check a map's smokes after a big update to it.
- **Map pool facts** come from third-party sites, not a Valve post.
- **Hosting decision.** The GitHub account, and a public or private repo, are decided at
  the first deploy (step 5). The GitHub CLI isn't installed on this PC, so the repo is
  created on github.com or after installing `gh`.
- **Jump-throws without binds** can be inconsistent for tight lineups. Notes should flag
  tight ones.

## 17. Future ideas (not planned)

- Export your smokes as a CS2 Map Guide (annotation file) for in-game markers.
- Progress sync between devices.
- Flashes, molotovs and HE grenades.
- Popularity data mined from pro match demos.
