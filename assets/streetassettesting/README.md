# Street Fight UK — Approved environment assets

Both user-approved batches have been promoted from the isolated test workspace into this asset folder on the dev branch.

- `batch01.ts`: nine accepted asset types, plus queue-barrier configurations. The alternate `globeStreetLight` is retained in the source for compatibility but **excluded from the approved asset inventory** because `newassetsfromchatgpt.ts` already contains a street lamp.
- `batch02.ts`: ten accepted asset types, including the V4 card terminal and wine bottle corrections.

Total: **19 approved unique asset types**, excluding the redundant streetlight and counting queue-barrier arrangements as variants.

Original `streetassettesting/` sources and viewers are retained for comparison and rollback.

**Integration:** These are source assets in the repository, not automatically imported into game scenes. No gameplay or runtime asset registration has been changed. Review import paths and the existing scene-loading architecture before activating them.

**Status:** User-approved; moved to assets folder.

- `batch05.ts`: 20 user-approved British commercial and neighbourhood props, promoted without changing the playable game. Source preserved in `streetassettesting/batch05.ts`.
