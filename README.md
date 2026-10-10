# CS Smokes Helper

A personal website for learning Counter-Strike 2 smoke lineups away from the game: pick a map,
see its smokes on the radar, watch a looping clip of each throw, and drill them in study mode.

Live site: https://mohammedhijazi.github.io/cs-smokes-helper/

## Commands

| Command                              | What it does                                                      |
| ------------------------------------ | ----------------------------------------------------------------- |
| `npm run dev`                        | Start the local dev server                                        |
| `npm test`                           | Run the tests once                                                |
| `npm run lint`                       | ESLint and the Prettier check                                     |
| `npm run validate`                   | Check every file in `data/maps/`                                  |
| `npm run format-data`                | Rewrite the data files in the canonical layout                    |
| `npm run check-bundle`               | Fail if edit-mode code is in `dist/` (CI runs it after the build) |
| `npm run check-videos`               | Ask YouTube whether every video still exists and embeds           |
| `npm run preview-markers -- <mapId>` | Draw a map's markers on its radar in `tmp/preview-<mapId>.png`    |
| `npm run build`                      | Type-check and build the site into `dist/`                        |
| `npm run radars` / `npm run icons`   | Regenerate radar images / app icons (rarely needed)               |

## Run with Docker

To work on the project without installing Node, install
[Docker Desktop](https://www.docker.com/products/docker-desktop/) and run:

```sh
docker compose up
```

Then open http://localhost:5173. Changes to the source reload the page, and edit mode saves into
your own `data/maps/`, ready to commit. Stop it with Ctrl+C. The dev server is reachable from
your computer only.

Run any command from the table above in the container:

```sh
docker compose run --rm app npm test
docker compose run --rm app npm run lint
```

The container keeps its own `node_modules` and reinstalls it by itself when `package-lock.json`
changes. To try the built site, run
`docker compose run --rm -p 127.0.0.1:4173:4173 app sh -c "npm run build && npm run preview"` and
open http://localhost:4173.

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

## Studying

Study mode (`#/study`) shows the smokes that are due plus up to 10 new ones a day (change the
number in Settings). For each smoke: tap where you stand, pick the throw, watch the clip, then
answer Forgot or Got it. Smokes come back after 1, 2, 4, 8 and 16 days; from the 8-day box on
they count as known. Progress is saved in each browser separately — use Settings → Export /
Import to move it between your phone and PC.

## Publishing

Every push to `main` runs lint → validate → test → build, and deploys only if all of them pass.

## Credits

Counter-Strike 2, map names and radar images © Valve Corporation. Videos © their creators.
Not affiliated with Valve.

Design: `docs/superpowers/specs/2026-10-10-cs2-smoke-lineups-design.md`
