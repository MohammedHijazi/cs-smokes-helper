# CS Smokes Helper

A personal website for learning Counter-Strike 2 smoke lineups away from the game: pick a map,
see its smokes on the radar, watch a looping clip of each throw, and drill them in study mode.

## Commands

| Command                              | What it does                                                   |
| ------------------------------------ | -------------------------------------------------------------- |
| `npm run dev`                        | Start the local dev server                                     |
| `npm test`                           | Run the tests once                                             |
| `npm run lint`                       | ESLint and the Prettier check                                  |
| `npm run validate`                   | Check every file in `data/maps/`                               |
| `npm run check-videos`               | Ask YouTube whether every video still exists and embeds        |
| `npm run preview-markers -- <mapId>` | Draw a map's markers on its radar in `tmp/preview-<mapId>.png` |
| `npm run build`                      | Type-check and build the site into `dist/`                     |
| `npm run radars` / `npm run icons`   | Regenerate radar images / app icons (rarely needed)            |

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
