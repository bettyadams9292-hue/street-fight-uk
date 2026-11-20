# Street Fight UK — Approved environment assets

Both user-approved batches have been promoted from the isolated test workspace into this asset folder on the dev branch.

- `batch01.ts`: nine accepted asset types, plus queue-barrier configurations. The alternate `globeStreetLight` is retained in the source for compatibility but **excluded from the approved asset inventory** because `newassetsfromchatgpt.ts` already contains a street lamp.
- `batch02.ts`: ten accepted asset types, including the V4 card terminal and wine bottle corrections.

Total: **19 approved unique asset types**, excluding the redundant streetlight and counting queue-barrier arrangements as variants.

Original `streetassettesting/` sources and viewers are retained for comparison and rollback.

**Integration:** These are source assets in the repository, not automatically imported into game scenes. No gameplay or runtime asset registration has been changed. Review import paths and the existing scene-loading architecture before activating them.

**Status:** User-approved; moved to assets folder.

- `batch05.ts`: 20 user-approved British commercial and neighbourhood props, promoted without changing the playable game. Source preserved in `streetassettesting/batch05.ts`.

- `batch07.ts`: 30 user-approved British architecture, shop, pub, takeaway and domestic assets, promoted from testing. **Approved for staging only; not integrated into the playable game.**

## Interior furniture mega pack (pending visual approval)

- `interior-furniture-megapack.ts`: 150 procedural furniture model definitions copied from `streetassettesting/interior-furniture-megapack.ts` at V10.
- Includes shelving/storage, tables/desks, cabinets, chairs/armchairs, sofas and bedroom/miscellaneous furnishings.
- **Status: imported into asset folder for availability, NOT final visually approved.** Existing furniture assets and the playable game have not been replaced or modified.
- Keep the source test viewer and staging file for continued review; fix defects in staging before updating this asset copy.

## Gym, security and neighbourhood expansion (pr-dev)

- `gym-security-neighbourhood-expansion.ts` is a preserved copy of the existing `newassetsfromchatgpt-expansion.ts` source, including the four original safes: `safeSmall`, `safeMedium`, `safeLarge`, and `poorSafe`.
- Use `EXPANSION_ASSETS` and `createExpansionAsset(id)` to access the models. The file also includes the original gym and neighbourhood assets; no existing source or game integrations were changed.
- Branch: `pr-dev`; not merged into `dev`. Visual review status remains unchanged.
