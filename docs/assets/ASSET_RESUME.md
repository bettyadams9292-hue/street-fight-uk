# Resuming asset production

1. Read `CLAUDE.md`, then `docs/assets/ASSET_TECH.md` and `ASSET_STYLE_GUIDE.md`.
2. Run `python3 tools/assets/ledger.py --check`, then `python3 tools/assets/ledger.py`. This shows exactly what's done (`ASSET_PROGRESS.md` and `ASSET_MANIFEST.md`).
3. A row is untouched if it has no ledger entry, and unfinished if its entry is `partial`. The `parts` field says what's left.
4. Pick the next package from the table in `ASSET_PROGRESS.md`. Packages work on branches off `assets-production`, and the lead merges them in.

## State

- **Branch:** `assets-production` (off `dev` at af3a3e6).
- **Last completed batch:** none yet (setting up on 13 Nov 2026, 23:45).
- **Assignments in flight:** see the work package table.
- **Downloaded, awaiting integration:** none yet.
- **Next action:** launch the wave 1 packages.
