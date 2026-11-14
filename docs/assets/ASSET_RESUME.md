# Resuming asset production

1. Read `CLAUDE.md`, then `docs/assets/ASSET_TECH.md` and `ASSET_STYLE_GUIDE.md`.
2. Run `python3 tools/assets/ledger.py --check`, then `python3 tools/assets/ledger.py`. This shows exactly what's done (`ASSET_PROGRESS.md` and `ASSET_MANIFEST.md`).
3. A row is untouched if it has no ledger entry, and unfinished if its entry is `partial`. The `parts` field says what's left.
4. Pick the next package from the table in `ASSET_PROGRESS.md`. Packages work on branches off `assets-production`, and the lead merges them in.

## State (14 Nov 2026, evening): handed over

- **Branch:** `assets-production`, in a PR into `dev`. Everything below is merged into it.
- **Rows:** 302 of 595 done and ticked, 19 partial, 46 blocked, 228 untouched.

### Packages

| Package | Result |
|---|---|
| audio | 19/19 done |
| weapons | 36/36 done |
| pickups | 80/80 done |
| vehicles | 22/22 done |
| ui-icons | 34 done, 16 partial |
| item-icons | done (the icon half of the weapons and pickups rows) |
| textures | 49 done, 1 partial |
| property | 33/33 done |
| animation | 28 done, 2 partial, 46 blocked |

- **ui-icons, partial:** the art is wired in but has never been seen on screen.
- **textures, partial:** `dripTexture`, a mask that needs no normal map.
- **animation, blocked:** the free UAL library has no clip for these rows.

### Not done: start from the briefs in `docs/assets/packages/`

| Package | Rows | Note |
|---|---|---|
| jewellery | 54 | started, but its work was lost in a workspace restart |
| household | 59 | started, but its work was lost in a workspace restart |
| character | 65 | started, but its work was lost in a workspace restart |
| world | 50 | not started |

### Known issues to pick up

- **Keyed face-down falls** (FALL_FRONT, LYING_FRONT) dip below the floor. This was already the case before this work. Back falls now use `onFloor` in `src/render/anim/ual.ts`, and the same fix would suit the keyed poses.
- **Landscape HUD:** with several needs low, the need chips overlap the health bar.
- **Ashcombe mansions:** the FOR SALE board slightly overlaps the house name plate.
- **Vehicles:** wheels don't turn. Pixie's white roof isn't modelled.
- **16 UI icons** to sight in game: boss, phone, coin, play, save, settings, controls, walk, back, quit, info, food, sleep, cars, bikes, parked.

### Constraints learned in the cloud workspace

- Run three workers at most at once. Seven exhausted the usage limit within hours, and a 2-CPU container can't load the game in seven Chromes at once.
- Commit work-in-progress often. Uncommitted work in worktrees has twice been lost when the workspace restarted.
- The cloud shell couldn't reach asset sites. Packs came from the owner's `StreetFightUK-assets` folder, through the desktop app.
