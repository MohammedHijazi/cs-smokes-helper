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
