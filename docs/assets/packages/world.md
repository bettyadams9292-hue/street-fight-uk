# World package (50 rows)

**Rows**

| Area | Rows |
|---|---|
| World props | 28 |
| Buildings & backdrops | 15 |
| Breakable props | 7 |

Ledger: `docs/assets/ledger/world.json`.

**Sources**
- The Quaternius Downtown City MegaKit (CC0) in the owner's `StreetFightUK-assets` folder. The city kit in `public/models/city` already comes from it.
- The Kenney city-suburban kit (CC0).
- Original low-poly models where nothing fits.

**Wiring**
- Street props: `src/city/street.ts` `PROP_MODELS`.
- Building fronts: `KIT_KINDS` in `catalogue.ts`.
- Anything else is built from boxes in `LevelView.ts`. Wire it in there and keep the box fallback.
- Breakable props need intact and broken states.

**Budgets:** props ≤1,500 tris, buildings ≤12,000.

**Check in the game**
- Street screenshots of every area that uses the new props and fronts.
- Breakables before and after being broken.
- Console clean.

**Test:** add one.
