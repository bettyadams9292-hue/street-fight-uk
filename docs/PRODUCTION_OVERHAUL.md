# Hard Graft: production overhaul report

Branch `overhaul/production`, PR into `dev`, 28 Nov 2026. Not merged, nothing sent to `main`.

Each phase of the directive is marked **Done** (built and tested here), **Partial** (some of it built; the rest listed), **Device** (built, but only a real iPhone or iPad can confirm it) or **Blocked** (can't be done from this workspace; the reason is given).

## Summary

| Phase | Status | What changed |
|---|---|---|
| 1 Architecture | Partial | Metro travel taken out of `Game.ts` into `src/controllers/MetroController.ts`. The other systems in `Game.ts` are still there (see below). |
| 2 World geometry | Partial | Subway gaps checked at both sizes (clean). No new geometry work. |
| 3 Metro | Done | Real timetable: arrive, slow, stop, doors open, people off and on, doors close, leave. Draw calls cut. |
| 4 Performance | Done (measuring) / Device | Two GPU leaks fixed; background build budget by how soon you reach the seam; `window.__perf` report for scripts (no overlay). |
| 5 Characters and animation | Not started | |
| 6 Combat feel | Not started | |
| 7 Art consistency | Not started | |
| 8 NPCs | Partial | Metro passengers step off and board with the train. |
| 9 UI consistency | Partial | New Saves screen checked at 844×390 and 390×700. |
| 10 Save system | Done | Three slots, backups, snapshots, checksums, recovery, export and import, failure notices. |
| 11 Economy | Not started | `tests/economy.test.ts` still passes unchanged. |
| 12 Tutorial | Partial | Metro guide's wording matches the timetable. |
| 13 Audio | Not started | |
| 14 Build reliability | Partial / Blocked | CI uses `npm ci` when a lockfile is there and has a job to make one; screenshots are never approved automatically; a WebKit phone job. The lockfile itself can't be made here (no network). |
| 15 Final QA | Done here | Typecheck clean, every test suite passes, build passes. |
| 16 Report | Done | This file, CLAUDE.md, the PR. |

## Phase 1: architecture

- `src/controllers/MetroController.ts`: arriving at a station, boarding, the doors screen and the ride, behind a small `MetroHost` interface (`progress`, `backToPlay`, `play`, `toast`, `goTo`). `Game` keeps one instance and its `metro_board` / `metro_train` cases call it.
- `src/render/mergeParts.ts`: the static-mesh merger LevelView used, shared so the metro station can use it too.

Still in `Game.ts` (about the same size as before): screens, jobs, police, club, travel, hotbar. The pattern is there to follow one system at a time; doing them all at once in one PR would be too risky to review.

## Phase 3: the Metro

- `src/travel/metro.ts`: a timetable. Every `HEADWAY` (90 s) a train runs in over `ARRIVE` (6 s, slowing from `RUN_IN` 42 m out), the doors open (`OPEN` 1 s), it waits `DWELL` (24 s), the doors close (`CLOSE` 1.5 s) and it leaves (`LEAVE` 6 s). `trainAt(visit)` is pure; where in the cycle you arrive is fixed by station and visit, so a reload finds the same train. `boardWhen` gives the board's Now / Arriving / Due / N min.
- You can board only while the doors are open (`rideRefusal`: "Too late: the doors are shut", "No train in yet"). Getting off a train, its doors are open behind you (`arriveBy`).
- `World` ticks the station clock on metro levels; when the doors open, one or two passers-by step off and up to two on the platform get on (`updatePassengers`).
- `render/metroStation.ts`: the train is built once and moved each frame; door leaves slide; the departures board redraws when its lines change. Station meshes merged 519 → 155, the train 300 → 93.
- Tests: `tests/metro.test.ts` (12, including the timetable, the World clock and passengers).

## Phase 4: performance

Measured with `?shot=` pages over eight area changes (home, pub and street):

- **Fixed:** each area change left one texture on the GPU. It was the old level's lights' shadow maps: `disposeGroup` (`render/weaponMesh.ts`) now disposes light shadows, sprite and points materials, and every texture on a material (anything marked `userData.shared` is left alone; the use marker's textures are). Textures now stay flat (103 over four re-entries of the same area; 183 across the mixed run).
- Geometries stay flat across area changes (249).
- `GameRenderer.districtBudget`: the background build gets 5–12 ms a frame depending on how many seconds you are from an unbuilt seam at your current speed, instead of a fixed urgent budget; finished at once inside 4 m.
- `renderer.info.autoReset` is off and reset once a frame, so draw calls count the whole frame (look buffer included).
- `src/performance/perfStats.ts` and `window.__perf.report()` (localhost, `?perf`, `?debug`, shot pages): frame average, 95th percentile and worst, background time, longest background step and overrun, draw calls, triangles, geometries, textures, people, heap. No on-screen overlay, per the owner's rule.

**Device:** frame pacing on a real iPhone and iPad. Here frames run on SwiftShader, so only counts (draw calls, triangles, memory) mean anything.

## Phase 10: saves

- `src/save/SaveStore.ts`: three slots (slot 1 is the old save key, so existing saves are slot 1). Each write keeps the previous good save as a backup, a snapshot every 10 minutes, and a checksum. A save that wouldn't load again is refused rather than written. Loading tries the save, then the backup, then the snapshot, and the game says which it used. Old v2 saves and the old character store still load into slot 1.
- Export and import: a file with a tag, format number and checksum; a damaged or edited file is refused with a reason; plain old saves are accepted.
- `src/ui/savesUI.ts`: the Saves screen (main menu → Saves, Pause → Save): slot cards with level, place and time; Save now, Load, Save here / over, Download, Bring in a file, Delete, New fighter here; anything that overwrites or deletes asks first.
- A failed save shows a notice (full storage or a bad save), not more than once a minute.
- Cloud-ready: the export file is the shape a cloud slot would store. No backend added.
- Tests: `tests/saves.test.ts` (6) and the save test in `tests/world.test.ts`.

## Phase 14: build reliability

- `.github/workflows/ci.yml`: `npm ci` when `package-lock.json` exists, `npm install` otherwise, in every job.
- **Blocked here:** there's no lockfile and this workspace has no network, so one can't be made. Run CI by hand with `make_lockfile` ticked: it makes the lockfile and opens a PR with it.
- Visual regression: screenshots are recorded only when `update_baselines` is ticked; otherwise compared with `--update-snapshots=none` and never committed.
- `phone-webkit`: the phone app check on WebKit (`PW_BROWSER=webkit`), allowed to fail for now, its report kept as an artifact.
- Naming: page title, description, package description and README say Hard Graft by Leeko. Internal ids, save keys and the repo name are unchanged.

## Final testing (this workspace)

- `npm run typecheck`: clean apart from the known untyped-module warnings.
- `npm test`: every suite passes (metro 12, saves 6, scheduler, world, economy and the rest).
- Build: passes.
- Screens checked at 844×390 and 390×700: Saves, subway stairs.

## Still needed from people

1. **Leeko on an iPhone and an iPad:** play through a Metro ride (wait, board, ride, get off) and the Saves screen (save, download, bring the file back). Watch for frame hitches walking between districts.
2. **The lockfile:** run CI with `make_lockfile`, then merge its PR.
3. **Visual baselines:** refresh with `update_baselines` once this is on `dev`.
4. Phases 5, 6, 7, 11 and 13 are untouched here and are separate pieces of work.
