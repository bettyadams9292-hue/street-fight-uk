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

## Gym, security and neighbourhood expansion (39 user-approved assets; pr-dev)

- `gym-security-neighbourhood-expansion.ts` is a preserved copy of the existing `newassetsfromchatgpt-expansion.ts` source, including the four original safes: `safeSmall`, `safeMedium`, `safeLarge`, and `poorSafe`.
- Use `EXPANSION_ASSETS` and `createExpansionAsset(id)` to access the models. The file also includes the original gym and neighbourhood assets; no existing source or game integrations were changed.
- Branch: `pr-dev`; not merged into `dev`. **Approval status: all 39 expansion models confirmed approved by user on 20 November 2026, referring to approval the previous night.** This includes 26 gym models, 9 fences/gates, and 4 safes. Approved for the asset library; no playable-game integration.

## Black corded office desk telephone — APPROVED

- `black-desk-telephone.ts`: `blackDeskTelephone`, reference-based black corded desk telephone with handset resting on cradle, coiled cable, LCD, navigation and keypad.
- **Status:** user-approved 20 November 2026. Promoted from `streetassettesting/black-desk-telephone.ts` to this approved asset folder on `pr-dev` only.
- Import `TELEPHONE_ASSETS` and `createTelephoneAsset(id)` to use it. No playable-game integration or changes to `dev`.

## Bikes, scooters and motorcycles — 30 APPROVED (V7, pr-dev)

- `bikes-scooters-30.ts`: all 30 user-approved bicycle, electric bicycle, BMX, tandem, dirt bike, motorcycle, moped and scooter models, approved on 20 November 2026.
- Source preserved in `streetassettesting/bikes-scooters-30.ts`; iPhone review viewer preserved in `streetassettesting/bikes-scooters-30-viewer.html`.
- Import `BIKE_ASSETS` and `createBikeAsset(id)` from `assets/streetassettesting/bikes-scooters-30.ts` to instantiate approved models. All original IDs remain unchanged.
- **Status: user-approved for the asset library, V7.** Not integrated into gameplay. No changes to `dev` or existing approved models.
