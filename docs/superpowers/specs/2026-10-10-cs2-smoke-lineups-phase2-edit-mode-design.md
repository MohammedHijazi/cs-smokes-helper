# CS2 Smoke Lineups — Phase 2: Edit Mode — Design Spec

- **Date:** 2026-10-10
- **Status:** Design approved section by section in brainstorming; this written spec awaits review
- **Parent spec:** [2026-10-10-cs2-smoke-lineups-design.md](2026-10-10-cs2-smoke-lineups-design.md)
  (§11 outlines this phase; the data model in §6 is unchanged)

## 1. Summary

A local editing UI for the lineup data. Under `npm run dev`, the site gains Add, Edit, Delete
and Mark reviewed for smokes, and an executes editor. Saving rewrites
`data/maps/<mapId>.json` through a Vite dev-server endpoint that validates the file with the
shared schema and writes it in Prettier's format. The published build stays read-only and
contains none of this code. Publishing stays manual: `git commit` and `git push`.

## 2. Intent

**Stated by the user (parent spec §2 and §11, and this brainstorming)**

- Edit on the PC only, under `npm run dev`; never in the published build.
- Saving writes the data files, validated by the same rules as `npm run validate`, formatted
  so git diffs stay clean.
- The features listed in parent spec §11: add, edit, delete; parse a pasted video URL
  (including `t=`); set clip start and end from the player; place stand and land by clicking
  the radar and adjust by dragging; "Mark reviewed"; deleting a smoke also removes it from
  executes after confirmation; an executes editor.
- Reviewing the 80 seeded smokes and adding new ones matter equally. "Mark reviewed" moves
  straight on to the next unreviewed smoke.
- No extras beyond §11 for now (see §11 of this spec).
- A save updates the open page in place, without a reload.

**Assumed (stated during brainstorming, not contradicted)**

- The form sits in the right-hand panel of the desktop layout, with the map's radar on the
  left for placing spots. No phone editing.
- One person edits at a time, but a stale tab or a hand edit must never be silently
  overwritten.

**Success criteria**

1. Adding a smoke from a YouTube link takes about a minute (parent spec criterion 4).
2. Reviewing a seeded smoke — watch, fix what is wrong, Mark reviewed — moves to the next
   unreviewed smoke without a page reload.
3. After a save, `git diff` shows only the lines that changed, and `npm run validate` and
   `npm run lint` pass.
4. The production build contains no edit code, checked in CI on every push.

## 3. Architecture

### 3.1 Units

| Unit | Runs in | Purpose |
|---|---|---|
| `scripts/edit-plugin.ts` | Vite dev server (Node) | Vite plugin with `apply: "serve"`. Mounts `PUT /__edit/maps/:mapId` (§4); skips Vite's reload for its own writes (§3.3) |
| `scripts/save-map.ts` | Node | `saveMapFile({ dataDir, mapId, base, file })`: stale check, validation, formatting, atomic write. Takes the data folder as an argument so tests use a temp folder |
| `scripts/format-map.ts` | Node | `formatMapFile(file)`: the one canonical text layout of a map file (§4.1), used by the save and by `npm run format-data` |
| `src/data/index.ts` | Browser | Gains `replaceMapFile(mapId, file)` and `useDataVersion()` (§3.3) |
| `src/features/edit/mapEdits.ts` | Browser (pure) | New ids, add/replace smoke, delete smoke with execute clean-up, add/replace/delete execute, mark reviewed, next unreviewed, form ↔ lineup conversion. No React |
| `src/features/edit/saveClient.ts` | Browser | Local validation, then the PUT, then `replaceMapFile` |
| `src/features/edit/` UI | Browser | Smoke form, clip-timing control, placement radar, execute form, edit buttons, edit pages |
| `src/features/smoke/useYouTubePlayer.ts` | Browser | Player setup extracted from `VideoPlayer`, shared with the clip-timing control |
| `src/features/map/MapFrame.tsx` | Browser | The radar-left / panel-right frame, extracted from `MapPage` and reused by the edit pages |

The two extractions (`useYouTubePlayer`, `MapFrame`) are behaviour-preserving refactors: the
existing `VideoPlayer` and `MapPage` tests must pass without changes.

### 3.2 Routes (dev only)

| Route | Screen |
|---|---|
| `#/maps/:mapId/smokes/new` | Add smoke |
| `#/maps/:mapId/smokes/:lineupId/edit` | Edit smoke |
| `#/maps/:mapId/executes/new` | Add execute |
| `#/maps/:mapId/executes/:executeId/edit` | Edit execute |

`new` cannot clash with a real id, because every id starts with `<mapId>-`. The map filters in
the query string are carried through these routes, as on the smoke card. An unknown map,
smoke or execute id shows the existing Not found screen.

### 3.3 How a save reaches the open page

1. The client sends the new map file (§4).
2. The server writes it and remembers the text it wrote.
3. When Vite's watcher reports the change, the plugin compares the file on disk with the
   remembered text. If they match, it returns no modules to update, so Vite neither reloads
   nor hot-updates. If they differ (a hand edit, `git checkout`), Vite behaves as it does
   today and reloads the page.
4. The client receives the file as written and calls `replaceMapFile(mapId, file)`, which
   swaps that map's entry in the bundled data and notifies subscribers.
5. Home, Map and Study call `useDataVersion()` (a `useSyncExternalStore` subscription), so
   they re-render with the new data. These are the only three modules that read the data
   (`src/data/index.ts` imports); the test helper `mockDataModule()` gains the same two
   exports.

Production never calls `replaceMapFile`, so the data there is as static as before.

### 3.4 Keeping edit code out of the published site

- The edit routes and buttons render only when `import.meta.env.DEV` is true.
- Everything under `src/features/edit/` is loaded with `lazy(() => import(...))` inside those
  checks, so Vite drops it from the production bundle.
- The plugin has `apply: "serve"`, so `vite build` never loads it.
- `npm run check-bundle` (new, `scripts/check-bundle.ts`) fails if any file in `dist/`
  contains `/__edit/`. CI runs it after `npm run build`, before deploying.

## 4. Save endpoint

**`PUT /__edit/maps/:mapId`**, JSON body `{ "base": MapFile, "file": MapFile }`.

- `file` is the whole new map file.
- `base` is the map file as the page had it before this edit, used to detect a stale tab.

**Server steps, in order:**

1. **Origin.** Only loopback addresses (`127.0.0.1`, `::1`, `::ffff:127.0.0.1`) are
   accepted, else **403**. If an `Origin` header is present, its host must equal the
   request's `Host`, else **403**. The body must be `application/json`, else **415**. This
   protects the files when the dev server runs with `--host`, or when another website is open
   in the same browser.
2. **Map id.** One of the seven map ids, else **404**.
3. **Stale check.** Read `data/maps/<mapId>.json` from disk and deep-compare it with `base`
   (key order ignored). If they differ, **409** `{ "error": "changed" }`. If the file on disk
   is not valid JSON, **409** `{ "error": "invalid-on-disk" }`.
4. **Validation.** `validateDataFiles` from `src/data/validate.ts` (the function behind
   `npm run validate`), run over all seven files with `file` in place of this map's file and
   the other six read from disk. This catches ids that clash across maps. Any errors →
   **400** `{ "errors": [{ "path": string, "message": string }] }`, with the JSON paths the
   validate script prints (for example `lineups[12].video.end`). Errors are only reported for
   this map's file.
5. **Format** with `formatMapFile` (§4.1), so the result passes `prettier --check` and matches
   the layout of every other data file.
6. **Atomic write.** Write `data/maps/.<mapId>.json.tmp`, then rename it over
   `<mapId>.json`. On `EPERM` or `EBUSY` (Windows, when an editor or antivirus has the file
   open) the rename is retried, up to 5 attempts over about 1 second. If it still fails, the
   temp file is removed and the answer is **500**
   `{ "error": "write-failed", "message": string }` (the file-system error's message); the
   original file is untouched. The temp name does not end in `.json`, so
   `npm run validate` never reads it.
7. **Remember** the written text for the reload check (§3.3).
8. **200** `{ "file": MapFile }`: the file as written. The client stores this as its copy, so
   its next `base` matches the disk exactly.

There is no endpoint to read data or to delete a file. A delete is a PUT of the map file
without that smoke.

**Client (`saveClient.ts`):**

- Before sending, it runs `validateDataFiles` over all seven bundled files with the edited
  one in place. Most mistakes show up at once on the right field; the server checks again.
- On 200, it calls `replaceMapFile` and the caller navigates on.
- If `fetch` fails (dev server not running), it reports that without changing anything.

**Ordering:** new smokes and new executes are appended to the end of the map's arrays. Array
order is the display order and the order new smokes enter study (parent spec §6.2).

### 4.1 One canonical layout for data files

Prettier keeps an object expanded over several lines if its input already had a line break
after the `{`, so the same data can be formatted in more than one valid way. The seeded files
mix both: formatting their parsed contents again changes 45–60 lines each in `ancient`,
`cache`, `mirage` and `nuke` (checked while writing this spec), without any data change.

- **Canonical layout:** `formatMapFile(file)` (in `scripts/format-map.ts`) formats
  `JSON.stringify(file)` — compact, so no object starts expanded — with Prettier's Node API,
  the repo's resolved config (`.prettierrc.json`) and the `json` parser. Objects then break
  across lines only when they exceed the 100-character print width.
- **One-time normalisation:** a new `npm run format-data` rewrites all seven files in the
  canonical layout. It runs once, as its own commit, before any editor save, so the layout
  change never mixes with a data change in a diff.
- **Guard:** a unit test reads each real file in `data/maps/` and checks it equals
  `formatMapFile(JSON.parse(text))`, failing with "<file> isn't in the canonical layout — run
  `npm run format-data`". It runs in CI with `npm test`, so a hand edit can't reintroduce
  drift.

## 5. Smoke form (Add and Edit)

The form is in the right-hand panel; the map's radar is on the left. Fields, in order:

1. **Video link.** Focused when Add opens.
   - A YouTube link (any form in parent spec §8) loads the clip-timing player.
   - If the link has a `t` or `start` value and Start is empty, Start is set to it.
   - A link to another site hides the clip fields and shows "Open video ↗". `start` and
     `end` are not saved for such links.
2. **Clip.**
   - The player shows YouTube's own controls for scrubbing and does **not** loop while
     editing, so you can scrub past the current end.
   - **Set start** takes the player's current time rounded down to whole seconds; **Set end**
     rounds up. Both fill number inputs (seconds, with an m:ss hint) that can also be typed.
   - **▶ Play clip** seeks to start, plays, and pauses at end.
   - Start and End are optional, as in the data model.
3. **Name** and **From.** Text inputs with a 40-character counter.
4. **Side** (T / CT) and **Area** (A / B / Mid / Other). Button groups.
   - On Add, a side or area filter set on the map view preselects that value; otherwise
     nothing is selected and choosing is required.
5. **Throw.** Movement (stand / crouch / walk / run), a Jump checkbox, Click
   (left / right / both). On Add: stand, no jump, left.
   - The technique text from `techniqueText` (parent spec §6.4) updates live under the
     inputs.
6. **Stand and land.**
   - A "Placing: Land | Stand" toggle above the radar. A click on the radar sets the active
     spot. On Add, the toggle starts on Land and switches to Stand once Land is placed.
   - Either marker can be dragged to adjust it (pointer events with pointer capture; the
     position comes from `pointerToFraction` in `src/lib/radar.ts`).
   - The map's other smokes are drawn faded, for context and to avoid duplicates. They are
     not clickable in the form.
   - On Nuke, the level switch is shown above the radar, and a placed spot takes the level
     being shown. The stand dot and line follow the existing rule: drawn only when the stand
     is on the level shown.
   - The coordinates appear below the radar as read-only text (three decimals, plus the
     level on Nuke).
   - Saving with a spot not placed shows "Place the stand spot on the radar" (or land).
7. **Notes.** Textarea with a 280-character counter. Empty notes are left out of the file.
8. **Status and last checked.**
   - Add: `unreviewed`, last checked today.
   - Edit: changing the status sets `checkedOn` to today. Changing other fields does not.
   - `checkedOn` is shown read-only.
9. **Id.** Read-only.
   - Add previews the id as you type: `<mapId>-<slug(name)>-from-<slug(from)>`, with `-2`,
     `-3`, … appended if the id exists in any map (lineups and executes share one id space).
   - **Slug:** lowercase; accents removed (Unicode NFKD, then combining marks dropped); every
     run of characters other than `a–z` and `0–9` becomes one `-`; leading and trailing `-`
     removed. A slug that comes out empty becomes `smoke`.
   - Edit never changes the id, even after a rename, so study progress stays attached.

**Save and Cancel**

- Validation errors appear next to their field: the path `lineups[i].<field>` maps to the
  form field. Errors elsewhere (for example an execute whose side no longer matches after
  this smoke's side changed) appear at the top of the form.
- After saving: Add opens the new smoke's card; Edit returns to the card. Map filters are
  kept.
- Cancel asks "Discard changes?" when anything has changed, then returns to where the form
  was opened from (the card, or the map view for Add).
- Closing or reloading the tab with unsaved changes triggers the browser's leave-page
  warning (`beforeunload`).
- **Known gap:** the app uses `HashRouter`, which does not support React Router's navigation
  blocker. Following another in-app link (such as "← Maps") discards the form without
  asking. Closing this gap would mean moving the whole app to a data router; not done for a
  single-user dev tool.

## 6. Buttons on existing screens (dev only)

| Screen | Buttons |
|---|---|
| Map view, Smokes tab | **+ Add smoke** above the list → `smokes/new` with the current filters |
| Map view, Executes tab | **+ Add execute** above the list → `executes/new` |
| Smoke card | **Mark reviewed**, **Edit**, **Delete** |
| Execute view | **Edit**, **Delete** |
| Home, Study, Settings | None. Study behaves the same in dev as in production |

**Mark reviewed**

- Sets `status` to `ok` and `checkedOn` to today, then saves.
- Then opens the next unreviewed smoke after this one in the current filtered list (the list
  ‹ › steps through), wrapping round to the start.
- If none is left, it stays on the card and shows "No unreviewed smokes left in this list."
- Shown for every status. On an `ok` smoke it refreshes `checkedOn`, which is useful when
  re-checking a map after an update.

**Delete smoke**

- Asks with a browser `confirm` that lists the consequences, for example:
  "Delete 'Window from T Spawn'? It is also removed from 'A execute'. 'B split' is deleted
  too, because it would have fewer than 2 smokes."
- Removes the smoke from every execute that lists it; executes left with fewer than 2 smokes
  are deleted.
- After saving, opens the map view with the current filters.
- Study progress for the deleted id stays in browser storage (parent spec §6.7), so
  restoring the smoke with git restores its progress.

**Delete execute** asks for confirmation and leaves its smokes untouched. After saving, opens
the map view's Executes tab.

## 7. Execute editor

Same layout as the smoke form: radar on the left, form on the right.

- **Radar:** the execute's smokes numbered 1…n, drawn as in the execute view (landing
  circles, stand dots, lines), updated as the list changes. The level switch is shown on Nuke.
- **Name** (40 characters), **Side** (T / CT), **Notes** (280 characters, left out when
  empty).
- **Smokes, in throw order:**
  - An "Add smoke…" dropdown lists this map's smokes with the execute's side that are not in
    the list yet, as "name · from". A chosen smoke is appended.
  - Each row shows its number, name and from, with ↑ / ↓ to reorder and ✕ to remove.
  - The dropdown is disabled at 8 smokes. Fewer than 2 fails validation, with the message
    shown on the list.
- **Changing the side** asks first when the list has smokes of the other side, then removes
  them.
- **Id:** read-only. A new execute gets `<mapId>-<slug(name)>` with `-2`, `-3`, … on a clash,
  matching the seeded ids (for example `mirage-a-execute`). It never changes after creation.
- **Save and Cancel** behave as in the smoke form. After saving, the execute view opens.
  Cancel returns to the execute view (Edit) or the map view's Executes tab (Add).

## 8. Error handling

The form keeps its contents in every case unless the row says otherwise.

| Situation | Behaviour |
|---|---|
| Invalid field (local check, or 400 from the server) | Message next to the field, or at the top of the form; nothing is written |
| Map file changed since the page loaded (409 `changed`) | "This map changed outside this page (another tab, a hand edit or git). Reload to get the latest version." with a **Reload** button; reloading loses this form's changes |
| Map file on disk is not valid JSON (409 `invalid-on-disk`) | "data/maps/<mapId>.json isn't valid JSON — fix or restore it first" |
| Dev server not running (`fetch` fails) | "Can't reach the dev server — is `npm run dev` running?" |
| Write fails after retries (500) | "Couldn't write data/maps/<mapId>.json: <message>"; the original file is untouched |
| Request from another address or origin (403), wrong content type (415) | Only reachable from outside the UI; nothing is written |
| The file changes on disk while a form is open | Vite reloads the page as it does today; the open form is lost (known limit) |

## 9. Testing

Tests are written before the code, as in Phase 1.

**Unit tests (Vitest)**

- `mapEdits.ts`:
  - slug rules: accents, punctuation runs, the empty-slug fallback;
  - lineup ids and execute ids, with `-2` / `-3` on clashes across maps and across lineups
    and executes;
  - adding appends; replacing keeps the position;
  - deleting a smoke removes it from executes and deletes executes left with fewer than 2
    smokes; the confirm text lists them;
  - Mark reviewed sets `ok` and today; next unreviewed searches forward, wraps, and reports
    none left;
  - `checkedOn` changes with the status and only then;
  - form ↔ lineup conversion: `t=` fills Start, non-YouTube links drop `start` and `end`,
    Nuke positions carry levels and other maps' do not, empty notes are omitted;
  - execute side change removes the other side's smokes.
- `format-map.ts`: an object that fits in 100 characters stays on one line even when the
  input had it expanded; a longer one breaks; the output passes `prettier --check`. Plus the
  guard over the real data files (§4.1).
- `save-map.ts` (temp folder):
  - a valid save writes exactly `formatMapFile(file)`;
  - invalid file → errors with paths; an id clashing with another map → error;
  - stale `base` → `changed`; broken JSON on disk → `invalid-on-disk`; unknown map → 404;
  - a failing rename leaves the original file intact and no temp file behind;
  - `EPERM` on the first rename attempts, then success → saved; still failing after the last
    attempt → `write-failed`.
- `edit-plugin.ts`:
  - non-loopback address → 403; foreign `Origin` → 403; non-JSON body → 415; only
    `PUT /__edit/maps/:mapId` is handled;
  - the reload is skipped only when the file on disk matches the last write.
- `src/data/index.ts`: `replaceMapFile` changes what `getMapData`, `findLineup` and
  `allLineups` return, and notifies `useDataVersion` subscribers.
- The `useYouTubePlayer` extraction: the existing `VideoPlayer` tests pass unchanged.

**Component tests (React Testing Library; YouTube IFrame API and `fetch` mocked)**

- Add: paste a link with `t=` → Start filled; Set start / Set end from the mocked current
  time; fill the fields; click the radar for land, then stand; Save sends the expected file
  (appended, generated id, today's date) and opens the new card.
- Edit: renaming keeps the id; a status change sets the date; a side change on a smoke used
  in an execute shows the top-of-form error and sends nothing.
- Dragging a marker moves the spot; on Nuke, a spot placed with the lower level shown gets
  `level: "lower"`.
- Mark reviewed opens the next unreviewed smoke (including the wrap), and shows the
  "none left" message at the end.
- Delete: the confirm text lists affected executes; cancelling changes nothing.
- Execute editor: add, reorder, remove, side change, the 8-smoke limit.
- 400, 409 and network errors show their messages and keep the form.
- With `DEV` stubbed to false, no edit buttons render.

**Build and CI**

- `npm run check-bundle` runs in CI after `npm run build` and fails if `dist/` contains
  `/__edit/`.

**Manual**

- Add a real smoke from a YouTube link and time it (success criterion 1).
- Review one seeded smoke end to end with Mark reviewed (criterion 2).
- `git diff` shows only the expected lines; `npm run validate` and `npm run lint` pass
  (criterion 3).
- `npm run build && npm run preview` shows no edit buttons.

## 10. Documentation changes

- README "Data": replace "Until the editor exists, add or fix a smoke by editing that file"
  with how to use edit mode (`npm run dev`, Add / Edit / Mark reviewed, then commit and push).
  Hand editing stays documented as the fallback.
- README "Commands": add `npm run check-bundle` and `npm run format-data`.
- Parent spec §11: add a link to this spec.

## 11. Out of scope for this phase

Offered during brainstorming and declined for now:

- Video check on paste (title, channel and embeddability from YouTube's oEmbed).
- A status filter on the map view.
- Duplicate smoke.
- Reordering smokes within a map. New smokes are appended; the order can still be changed by
  editing the JSON.

Also out of scope:

- Editing from the phone.
- Committing or pushing from the UI.
- Moving a smoke to another map.
- Blocking in-app navigation away from an unsaved form (see §5, known gap).
- Saving form drafts across reloads.

## 12. Build order

1. `formatMapFile`, `npm run format-data`, the layout guard test, and the one-time
   normalisation commit of the seven data files.
2. Extract `useYouTubePlayer` and `MapFrame` (existing tests stay green).
3. `save-map.ts` and `edit-plugin.ts`, wired into `vite.config.ts`; `check-bundle` and its CI
   step.
4. Data store: `replaceMapFile`, `useDataVersion`, the three consumers and the test mock.
5. `mapEdits.ts` and `saveClient.ts`.
6. Smoke form: Add and Edit, clip timing, placement radar.
7. Card actions: Mark reviewed → next, Delete.
8. Execute editor, and Delete execute.
9. README and parent-spec link; manual checks.
