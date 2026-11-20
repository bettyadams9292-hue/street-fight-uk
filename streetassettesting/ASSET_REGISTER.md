# Street Asset Testing — Batch Register

## Batch 01 — 9 unique asset types carried forward

The original street lamp is **excluded** because `newassetsfromchatgpt.ts` already provides `streetLamp`. The alternate `globeStreetLight` / UK swan-neck model remains in the Batch 01 source for comparison only and is not counted for integration.

1. `retailCounter` — retail counter
2. `highTable` — high café/pub table
3. `stockedShelves` — shop shelving
4. `manholeCover` — rectangular UK utility cover
5. `queueBarrier` — closed post, with `queueBarrierOpen`, `queueBarrierLine`, `queueBarrierCorner` variants
6. `drinksFridge` — shop drinks chiller
7. `streetPlanter` — British high-street planter
8. `shopCounterTill` — counter with till
9. `cardboardBox` — parcel carton

**Source:** `batch01.ts`

**Status:** Added to the approved-for-staging register at user's request. Not yet wired into the playable game. Visual inspection and integration checks still required.

## Batch 02 — 10 new asset types awaiting review

1. `cardTerminal` — UK chip-and-PIN terminal
2. `backBarShelves` — British pub back-bar shelves
3. `receptionCounter` — reception desk
4. `pottedTree` — indoor potted tree
5. `wineBottle` — wine bottle
6. `oilDrum` — industrial oil drum
7. `wallClock` — wall clock
8. `chalkboardMenu` — pub chalkboard
9. `pastryCabinet` — hot-food cabinet
10. `waitingSofa` — reception sofa

**Source:** `batch02.ts`; **viewer:** `batch02-viewer.html`

**Status:** First-pass test models, pending user review. No game integration.

## Batch 04 — 7 approved models

Approved by user and promoted to `assets/streetassettesting/batch04.ts`. CCTV/security model excluded entirely. No playable-game integration.

## Batch 05 — 20 user-approved models

Bus shelter, bus bench, pillar postbox, telephone kiosk, pavement bollard, bicycle stand, wheelie bin, trade waste bin, shipping pallet, traffic lights, roadside sign, parking meter, bus stop timetable pole, notice board, park bench, litter bin, flower bed, shopping basket, delivery sack truck and market stall.

**Source:** `streetassettesting/batch05.ts`; **viewer:** `streetassettesting/batch05-viewer.html`.

**Status:** User approved; promoted to `assets/streetassettesting/batch05.ts`. Not integrated into playable game. CCTV/security assets excluded.

## Batch 06 — 20 new models awaiting review

Bus shelter, bus timetable pole, pillar postbox, red telephone kiosk, pavement bollard, park bench, council litter bin, flower bed, road sign, bus bench, grit bin, dog waste bin, recycling bank, parcel locker, bike repair station, ashtray post, drain grate, speed hump, pedestrian refuge island and pub garden parasol.

**Source:** `streetassettesting/batch06.ts`; **viewer:** `streetassettesting/batch06-viewer.html`.

**Status:** First-pass test models, awaiting visual review. No playable-game integration. No CCTV/security assets.

## Batch 07 — 30 new first-pass models awaiting review

Terraced-house brickwork, door and windows; shop awning, roller shutter and fascia; pub sign, window, stool, booth and keg cradle; chimney pot, roof vent, air-conditioning, downpipe and gutter; coal bunker, milk crate, bread tray, takeaway menu, chip-shop fryer and warmer, butcher counter, greengrocer crate, laundrette folding table, clothes airer, garage door and water butt.

**Source:** `streetassettesting/batch07.ts`; **viewer:** `streetassettesting/batch07-viewer.html`.

**Status:** New procedural first-pass assets awaiting user review; no promotion or game integration. CCTV/security excluded. Batch 06 contains duplicate models and remains unapproved.

## Batch 07 — APPROVED (30 models)

User approved all 30 polished models and they were promoted to `assets/streetassettesting/batch07.ts`. Original test source and viewer retained. Not integrated into playable game. Original 1,348-row asset checklist updated separately with MADE, VARIANT and TO MAKE flags.

## Gym, security and neighbourhood expansion — APPROVED (39 models)

All 39 models in `newassetsfromchatgpt-expansion.ts` were confirmed by the user on 20 November 2026 as approved the previous night: 26 gym/weightlifting/boxing models, 9 fences and gates (including damaged variants), and 4 safes (`safeSmall`, `safeMedium`, `safeLarge`, `poorSafe`).

**Approved asset copy:** `assets/streetassettesting/gym-security-neighbourhood-expansion.ts` on `pr-dev`.

**Status:** User-approved for the asset library. No game integration. The 3D review viewer is optional inspection only and does not supersede this approval.

## Black corded office desk telephone — APPROVED (1 model)

- `blackDeskTelephone`: black office telephone with seated handset, coiled cable, corrected display and button layout.
- **Approved by user:** 20 November 2026.
- **Approved asset file:** `assets/streetassettesting/black-desk-telephone.ts` on `pr-dev`.
- **Original review source:** `streetassettesting/black-desk-telephone.ts`; **viewer:** `streetassettesting/black-desk-telephone-viewer.html`.
- **Integration:** Asset-library approval only; not wired into playable scenes.
