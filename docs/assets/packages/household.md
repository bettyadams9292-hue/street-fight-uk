# Household package (59 rows)

**Rows**

| Area | Rows | What's needed |
|---|---|---|
| Items: Valuables | 29 | Inventory icon, or icon plus a 3D pickup model |
| Home furniture | 13 | 3D model plus shop icon |
| Grow business: equipment | 8 | 3D model plus shop icon |
| Grow business: unit upgrades | 9 | Textures or 3D model for the upgrade |

Ledger: `docs/assets/ledger/household.json`.

**Models**
- Valuables pickups: same pattern as the pickups package. Add them to `src/render/props/pickupList.ts` and put the files in `public/models/pickups/`.
- Furniture and grow equipment: these are built from boxes in code today. Wire in GLBs and keep the box version as the fallback.
- CC0 sources: the Kenney Furniture Kit (`KenneyLibrary.ts`) and the hydroponics pack (`HydroLibrary`). Otherwise build original low-poly models.

**Icons:** extend `tools/icons/render_items.mjs` and register them in `src/ui/itemIconList.ts` (`RENDERED_ICON_IDS`), or in the shop's own icon path.

**Check in the game:**
- valuables on the street and in the inventory;
- furniture in the home and in its shop;
- grow equipment and upgrades in the grow unit;
- every shop at both phone sizes.

Add a test.
