# Asset production: technical reference

Read this alongside `CLAUDE.md` and `ASSET_STYLE_GUIDE.md`. Everyone working on assets follows it.

## The game

- **Engine and build.** TypeScript, three.js r170 and Vite. Models are **GLB**, textures **WebP/PNG/JPEG**, sounds **MP3**, animation clips **JSON** (`public/anim/*.json`).
- **Static files** live in `public/` and are served from `/`. Models are under `public/models/<set>/`.
- **Loading.** Model sets load GLBs once at boot with a shared loader (`src/render/props/modelSet.ts`). Anything that fails to load falls back to the code-built version, so a new model never stops the game from starting.
- **Registries by asset kind:**
  - **Weapons and small items:** `src/render/props/PropLibrary.ts`.
    - `PROP_FILES` maps a prop id to a file in `public/models/props/`.
    - `WEAPON_MODELS` maps a weapon item to its prop; `ITEM_MODELS` maps an item to the model it shows lying on the ground.
    - Item definitions are in `src/items/items.ts`; their icons are painted in `src/ui/itemIcons.ts`.
  - **Furniture and food:** `src/render/props/KenneyLibrary.ts` loads `public/models/kenney/{furniture,food}`. Furniture data is in `src/property/catalogue.ts`.
  - **Shop, gym, hydroponics, security and doors:** `ShopLibrary`, `GymLibrary`, `HydroLibrary`, `SecurityLibrary` and `DoorLibrary` in `src/render/props/`.
  - **Streets:** `src/city/` (`street.ts` lists `PROP_MODELS`; `catalogue.ts` lists the building designs). Anything else is built from boxes in `src/render/LevelView.ts`.
  - **Characters:** `src/characters/human/`, with models in `public/models/human`. Clothes without a proxy are made in code by `garments.ts`; `fromAppearance.ts` maps the creator's choices to models.
  - **Jewellery:** `src/items/jewellery.ts` (the data) and `src/render/jewellery.ts` (fitting pieces to the body).
  - **Animation:**
    - Mocap: `public/anim/rokoko_mocap.json` (fights) and `ara_mocap.json` (everyday). The converters are in `tools/rokoko`, `tools/ara` and `tools/makehuman`.
    - Keyed in code: `src/render/poses.ts` and `src/render/activityPoses.ts`.
  - **Sound:** `src/audio/AudioManager.ts` plays the files in `public/audio`. Some sounds are synthesised in code.
  - **UI icons:** `src/ui/icons.ts`, inline SVG paths on a 24 px grid.
  - **Property photos:** `src/ui/propertyPhoto.ts`.
- **Credits.** Every downloaded asset needs a line in its folder's `SOURCES.md` or `CREDITS` file (source URL and licence).

## Tools in this environment

- **No `node_modules` in the repo.** three.js and friends are in `/tmp/nm/node_modules`.
- **Build and serve:** `/opt/sfuk/build.sh <repo> <port>`. Each worker uses its own port, then `http://127.0.0.1:<port>/`. Add `?debug=1&shot=estate` for a quick deterministic start; `window.sfuk` is the game.
- **Type check:** `/opt/sfuk/typecheck.sh <repo>`. This is a stand-in for `npm run typecheck`, with three.js stubbed. Errors in `modelSet.ts`, `KenneyLibrary.ts` and `PolyKit.ts` were already there and are filtered out.
- **Tests:** `/opt/sfuk/test.sh <repo> [files]`. All test files must pass.
- **Model stats:** `python3 /opt/sfuk/glbstat.py file.glb` gives triangles, materials, textures and size in metres.
- **Screenshots:** Playwright, with `import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs'` and `chromium.launch({ channel: 'chrome' })`.
- **Making GLBs:** three.js `GLTFExporter` runs in headless Chrome. Build the mesh in a page, export it with `binary: true`, and save the bytes. Python has `numpy`, `PIL` and `scipy`. There's no Blender in this container.
- **Network.** The shell reaches GitHub and npm only. Kenney, Poly Haven, ambientCG and the rest are not reachable from here. Packs already downloaded are in `/mnt/user-data/uploads/StreetFightUK-assets/`, and the lead fetches more with the user's browser.

## Recording work

Each work package writes `docs/assets/ledger/<package>.json`: a list of entries, one per spreadsheet row, with the fields described at the top of `tools/assets/ledger.py`. A row is `done` only when every part of "Asset needed" is delivered, wired into the game, and checked in the running game. Otherwise it's `partial`, with `parts` saying what's left. Only the lead runs `tools/assets/ledger.py`, which ticks the workbook.
