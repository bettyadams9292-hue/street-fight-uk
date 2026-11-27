# World integrity, Metro and UI overhaul: checklist

Directive: "Hard Graft — complete post-merge regression, world integrity, Metro and UI overhaul" (27 Nov 2026), with
13 iPhone screenshots. Branch `overhaul/world-integrity`. This file records every requirement: what was wrong, why,
where, what was done, and how it was checked. Status: **todo**, **done** (code changed), **verified** (checked in the
running game by screenshot, or by a test). A session picking this up starts here.

## Screenshots (what each showed)

| Shot | Where | Defects seen |
|---|---|---|
| IMG_1319 | Hollins Estate, house wall | flat render wall; dark band and blue strip at pavement level; skip against the wall; search sparkle hanging against the wall; white streak on trousers |
| IMG_1316 | Tanner Road station entrance | American fire escape and drop ladder over the door; name board and roundel; sparkle |
| IMG_1317 | Old Market into the next district | pavement runs into road at the join; double yellows stop dead; kerb jumps |
| IMG_1318 | Game Over | generic web modal: rounded card, red pill, black slab, loose spacing |
| IMG_1315 | Fight, street | player shown as UNKNOWN; tall, misaligned combat HUD; fire escapes |
| IMG_1314, 1313, 1309, 1311, 1312 | Metro platform and hall | pillar in front of "Trains" and the line sign; train as loose boxes; board text clipped; black void past the platform end and in front of the floor |
| IMG_1308 | Metro platform, narrow window | health bar in black bands at 152/152; solid white joystick |
| IMG_1307 | Metro hall stairs | a building door in front of the Way out stairs; black void beside them |
| IMG_1304 | High Street | "Into Weatherspoons" board (removed in the previous PR; confirmed gone) |

## Checklist

### Phase 2: buildings and architecture
- [x] **B3 Fire escapes and drop ladders** — cause: five New York kit buildings (tenement, corner tenement, walkup infill, brownstone, loft warehouse) carry an iron fire escape baked into the model. Found by measuring the kit: near-black parts standing out in front of the façade (`wall`) above the ground floor. Fix: `withoutFireEscape` in `render/kit/PolyKit.ts` drops those parts when the model is decoded (landings, rails, stairs and the ladder down to 2.35 m); plinths and low railings stay. — **verified** (street shots: High Street, Market Square, Canal Docks, Tanner Road).
- [x] **B5 Boards over doors** — removed in the previous PR (`exitSign`); the Metro station's stairs no longer get a door frame either (see M1). — **verified**.
- [x] **B4 Bright windows** — cause: lit panes at emissive 0.6 under bloom, four rooms in five lit. Fix: 0.4 at night (0.2 by day) and a third of rooms dark (`roomLight`, PolyKit.ts). — **done** (seen in shots; judge on a phone).
- [ ] **B1 Squashed buildings beside the station stairs** — the stairwell takes a 3.4 m gap (`SUBWAY_GAP`) and the frontage either side is cut to fit. Not changed: the shots show the neighbours at normal widths now the fire escapes are gone. — **needs a look on the phone**.
- [ ] **B2 Dark band and blue strip under the estate houses** — not reproduced in the shots of Hollins Estate (x 20 and 44). — **needs the exact spot**.

### Phase 3: district joins
- [x] **D1 Pavement into road at a join** — cause: a street district's kerb is at `KERB_Z` (0.45) but a plaza, lane, yard or quay keeps its own kerb at the front of its walkable ground (2.0–2.4), so at the join the pavement stopped against the other's paving and the kerb and lines jumped 1.5 m. Fix: the street builds out to meet the neighbour's kerb (`BUILD_OUT`, 3.2 m) with the kerb turning the corner and the double yellows following it round (`planStreet` in `city/street.ts`; neighbour depth from `STRIP_BOUNDS` in `world/strip.ts`). — **verified** (`tests/kerb.test.ts` "District joins", and shots of Ring Road Subway / Old Market and High Street / Back Alleys).
- [x] **D3 Black squares in the Back Alleys** — cause: the lane laid the kit's checkerboard plaza tile tinted dark, so its dark squares fell under the street shader's asphalt threshold. Fix: plain slabs under the setts. — **verified** (shot).
- [ ] **D2 Building line steps 0.4 m** where a 2 m-deep district meets a 1.6 m one (their walkable depths differ). Left: changing the depths moves every fight and passer-by; a step in a building line is normal on a real street.

### Phase 4: Metro stations and train
- [x] **M1 A door in front of the station's Way out stairs** — cause: `LevelView.buildExitInner` drew a door frame and dark panel for every door exit, the station's stairs included. Fix: a station's exits draw nothing; the station's own tiled stairway is the way out. — **verified**.
- [x] **M2 Voids** — cause: nothing past the hall's left end or the platform's far end, and floors ended at the room's front edge. Fix: tiled end walls the full depth of the room at both ends (the far one with a No entry sign), the tunnel mouth moved onto the far wall, floors carried 3 m past the front, the coping and yellow line run to the end. — **verified**.
- [x] **M3 Pillar in front of signs** — cause: the header wall where the hall meets the platform (x 18.8) stood in front of the "Trains" and line signs. Fix: the signs are hung clear of it on drop rods. — **verified**.
- [x] **M4 Train** — rebuilt (`buildTrain` in `render/metroStation.ts`): each car's side is one panel with its doors and windows cut out, glazed; blue skirt band and red line; a roof that rounds over; doors that slide inside the body (open and shut positions for the existing animation); two bogies a car with wheels on the rails; gangways between cars; a cab at each end with windscreen, destination blind, head and tail lights; inside, lengthwise seats, poles, grab rail, lit ceiling, black tunnel through the far windows; car numbers. — **verified** (shots).
- [x] **M5 Board and sign text clipped** — fix: `fitFont` sizes text to its board. — **verified**.
- [x] **M7 Street entrance** — black railings in place of the New York kit's green. — **done**.

### Phase 5: Metro travel and progression
- [x] **T1/T2 Validation in the travel layer** — `rideRefusal` in `travel/metro.ts`: both stations real and open, not the same, a train in at this station this visit. `payRide` checks it before charging, so no screen, direct call, stale choice or reload can ride to a locked station; boarding with no train in says so (`Game`, `metro_train`). Locked stations stay listed on the train screen with what opens them. — **verified** (`tests/metro.test.ts`).
- [x] **T3 Saves** — `progress/resume.ts` `safeResume`: a save left in a shut station comes back up its stairs; a lost arrival spot falls back to the level's first. — **verified** (test).

### Phase 6: geometry, collision, camera
- [x] **W1 Search sparkle in the wall** — cause: drawn at a fixed 1.45 m over every searchable thing. Fix: just over the thing's own top (`CONTAINER_TOP` in LevelView), a little in front. — **done**.
- [x] **W2 Camera into voids in stations** — covered by M2.

### Phase 7: popups
- [x] **U1 Game Over** — rebuilt as a result card (`ui/outcome.ts`): where, what happened (who did it), a ledger of what was taken and what's kept (bank and tin, bag and jewellery, level and story, a failed job), a note, and one squared action. Two-column on a sideways phone. — **verified** (shots at 844×390 and 390×700).
- [x] **U2 Shared card** — the boss victory screen uses the same card (purse, XP, items, worth, unlocks, gate needs, challenges). The old `rewardScreen` is no longer used by the game.
- [ ] **U3** Other screens with their own designs (police, ATM, branch, venue screens) keep them; toasts and notifications were redesigned in #63.

### Phase 8: HUD
- [x] **H1 Black bands in the health bar** — cause: the ten notches were a repeating gradient with stops at `calc(10% - 2px)`; Safari rounds those at small sizes into wide black bands. Fix: one notch tile repeated by `background-size`. — **done** (Chrome shot fine; check on the iPhone).
- [x] **H2 UNKNOWN** — cause: a blank name in the creator was saved as "Unknown". Fix: the creator and `cleanName` fall back to "Grafter", and the fight HUD shows YOU for a blank or old "Unknown" name (`playerLabel` in `Hud.ts`). — **done**.
- [x] **H3 Compact fight HUD on an upright phone** — the style lines ran under the other bar and the buttons; hidden in portrait as they already were sideways. — **verified**.

### Phase 9: touch controls
- [x] **C1 Solid white stick** — the knob was 95% white; at rest it's glass now and firms up only while held; tap highlight, callout and selection are off on the whole pad (iOS painted a long press as a white disc). — **done** (needs the iPhone).
- [ ] **C2 Safari toolbar** — safe-area padding already in place (`--safe-*`); not changed.

### Phase 10: characters
- [x] **P1 White streaks on trousers** — intentional: trackies, tracksuit tops and fight shorts have a side stripe (`stripe` in `garments.ts`). It was near white and bloomed; now a softer off-white. — **done**.

### Phase 12: regressions, saves, performance
- [x] **R1 Saves** — see T3. Saves keep areas and named arrival spots, not coordinates.
- [x] **R2 Performance** — the train adds about 300 meshes only when a train is in; the fire-escape filter removes triangles; no new lights.

## Phase 13: checks
- typecheck, `npm test`, build: see the PR.
- Screenshots taken: streets (14 spots), Metro hall, stairs, platform with and without train, far end, portrait; Game Over sideways and upright.

## Not done, needs Leeko
- B1/B2: the exact spots on the phone.
- On the iPhone: the health bar notches, the stick, Safari's toolbar.
