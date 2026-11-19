# Visual overhaul: audit and record

The brief: make the whole game a cohesive, recognisably British 2.5D world with the owner's approved asset library,
without rebuilding anything or losing gameplay. This file is the audit (phase 1) and the running record of what is
integrated, what is available but unused, and what is still to make.

## How the world is drawn (what everything depends on)

- **Districts on the long street** (`src/world/strip.ts`, `src/world/levels.ts`, `src/world/districts.ts`): each
  `LevelDef` has props, facades, exits, lights and bounds. Positions are fixed data, so walking back always finds
  the same street.
- **Street planner** (`src/city/street.ts` `planStreet`): turns a district into placements of the city kit
  (`public/models/polyfork`, mostly US low-poly packs: `nyc/`, `hood/`, `cars/`, `cafe/`, `office/`), deterministic
  per district (hashed RNG). `PROP_MODELS` maps game props to kit models; anything it can't draw falls back to
  box-built models in `LevelView.buildProp`.
- **Bake** (`src/render/kit/PolyKit.ts` `buildKitStreet`): placements merged into 12 m chunks, three materials
  (solid, glass, lit windows), culled per chunk.
- **Interiors** (`src/world/interiors.ts`, `src/realty/world.ts`, `src/property/home.ts`, `src/business/basement.ts`):
  rooms at real depth since #44, furnished by `LevelView.buildProp` from Kenney, shop, gym, property and box builds.
- **Collision** comes from each prop's `PROP_SIZE` box, not from its model, so a model can change without changing
  how the world plays. Interactions (exits, stations) are separate data.

## The approved library

Six sources, all code-built Three.js factories (no model files):

| Source | Models | Status |
| --- | --- | --- |
| `newassetsfromchatgpt.ts`, original street furniture | 21 | Accepted library (the batch register relies on it) |
| `newassetsfromchatgpt.ts`, Batch 03 | 10 | Approved (`APPROVED_STREET_ASSET_IDS`, "promoted after user sign-off") |
| `assets/streetassettesting/batch01.ts` | 12 | Approved; the alternate globe street light excluded by its register |
| `assets/streetassettesting/batch02.ts` | 10 | Approved |
| `assets/streetassettesting/batch04.ts` | 7 | Approved |
| `assets/streetassettesting/batch05.ts` | 20 | Approved |
| `assets/streetassettesting/batch07.ts` | 30 | Approved |
| `streetassettesting/batch06.ts` | 20 | **Not approved: not used** |
| `newassetsfromchatgpt-expansion.ts` (gym, fences, safes) | 38 | Not in the approved batches: not used |

The originals don't pass the game's strict type checks, so `tools/assets/syncApproved.mjs` copies them unchanged
into `src/render/approved/sources/` with a skip-checks header; `tests/approvedAssets.test.ts` fails if a copy differs.

## Weaknesses found (baseline, 19 Nov)

1. **The streets read as American.** US phone booth painted red, US bus shelter, US globe and cobra lamps, US
   street signs, US bench, a catering trolley standing in for a shopping trolley, fire escapes and brownstones.
2. **Box-built placeholders** for the postbox, cashpoint, pallets, bin bags and scrap.
3. **Repetitive shopfronts:** the high street is one white commercial block repeated, with no awnings, fascias or
   shutters; every shop reads the same until you look through the glass.
4. **Houses with no British detail:** no bay or sash windows, chimney pots, gutters, downpipes, garden walls.
5. **Heavy approved models** that need slimming before they can repeat along a street: tyre stack 24k triangles,
   street planter 18.6k, back-bar shelves 12.5k, pub barrel 8.4k, potted tree 8.1k, pastry cabinet 8.2k.

Baseline cost (fixed camera, `renderer.info`): high street 170 draws / 505k triangles, precinct 131 / 554k,
city 112 / 379k, Hollins Estate 74 / 240k, Tanner Road Estate 98 / 320k.

## Done

- **Registry** (`src/render/approved/registry.ts`): 110 models, each with id, batch, category, name, factory,
  placement rule, solidity, and the game props it may draw.
- **Shared prototypes** (`src/render/approved/prototype.ts`): each model built once; plain colours folded into five
  shared materials (matte, satin, metal, glass, glow) as vertex colours; `bakeApproved` merges copies per 12 m
  chunk. A street of approved furniture costs a few draws per chunk.
- **Street furniture swapped** (`APPROVED_STREET` in `src/city/street.ts`, drawn by `LevelView.buildApproved`):
  K6 telephone kiosk, pillar box, UK bus shelter, column street lamps on roads and suburbs (with a lit lens),
  UK road signs and traffic lights, park bench, Sheffield stand, wheelie bins in UK colours, bollards, cashpoint,
  vending machine, market stall, skip, trade bin, cones, barriers, supermarket trolley, oil drums, crates, boxes,
  bin bags, pallets, scrap, containers, utility covers. Each stands at its prop's spot with its collision box
  unchanged; real size unless the slot is smaller. Kept on the kit: the newsstand kiosk (the approved rack is no
  kiosk), the planter (until slimmed), vehicles, fountains, pillars, turnstiles. Cost: 0 to 8 more draws per area.

## Update, 19 Nov: shop fronts, furniture pack, street scale

- **Shop windows and fronts:** pubs, chippies, bakeries, kebab shops, corner shops and off-licences show approved stock; awnings over most small shops in the shop's colour; hanging signs on pubs.
- **Interior furniture pack** (`FURNITURE` batch, 142 of 150 models; the 8 bookcases that throw as authored are left out, `FURNITURE_BROKEN`). Catalogue furniture with a pack equivalent is drawn from it everywhere furniture appears (home, the 20 properties, Home & Hearth, shop goods): `src/render/props/packFurniture.ts`, fitted to the item's footprint so collision and the home editor are unchanged, the chosen colour on its upholstery or wood. TVs, rugs, appliances, bathroom fittings and wall pieces keep their own models.
- **Street furniture at real size:** placements no longer shrink a whole model to fit a shallow slot (bus shelters were drawn at 70%). Height and length stay real (2.5 m shelter, 2.7 m phone box beside a 1.78 m player); only depth gives way.
