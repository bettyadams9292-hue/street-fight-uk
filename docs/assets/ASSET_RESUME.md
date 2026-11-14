# Resuming asset production

1. Read `CLAUDE.md`, then `docs/assets/ASSET_TECH.md` and `ASSET_STYLE_GUIDE.md`.
2. Run `python3 tools/assets/ledger.py --check`, then `python3 tools/assets/ledger.py`. This shows exactly what's done (`ASSET_PROGRESS.md` and `ASSET_MANIFEST.md`).
3. A row is untouched if it has no ledger entry, and unfinished if its entry is `partial`. The `parts` field says what's left.
4. Pick the next package from the table in `ASSET_PROGRESS.md`. Packages work on branches off `assets-production`, and the lead merges them in.

## State (14 Nov 2026, 14:50)

- **Branch:** `assets-production` (off `dev` at af3a3e6). Packages work in git worktrees `/home/claude/wt-<package>`, on branches `assets/<package>`. (Agent worktree isolation isn't permitted here, so the worktrees were made by hand.)
- **Done and merged:**
  - **Audio (lead):** all 19 Sound rows, as original recordings made by `tools/audio/make_sounds.py` and wired through `AudioManager`, with the old synthesis as fallback. Got it is ticked.
- **In flight, resumed after a rate-limit stop and an environment restart:**
  - `ui-icons`, `weapons`, `vehicles`.
- **Paused, with uncommitted work in their worktrees:**
  - `pickups`, `property`, `textures`, `animation`. Resume these when a slot frees.
- **Constraints learned:**
  - The container has 2 CPUs and 7 GB. Run three workers at most at once, and one headless Chrome per worker.
  - Seven parallel workers exhausted the usage limit in about 5 hours.
  - `build.sh` serves in the foreground, so run it in the background.
  - The shell can't reach the network at all now (GitHub too, outside this repo).
  - Kenney downloads work through the user's browser pane, but there's no route from the device to the container other than the connected folder.
  - Blender isn't running on the device, so it can't be used as a downloader.
- **Next action:** review each finished package branch, merge it into `assets-production`, run `ledger.py`, then run the tests, the type check and screenshots.
