# Street Fight UK: notes for Claude

Read this first. Two people work on this repo, each with their own Claude: Leeko (the owner) and his friend. Keep this file up to date: add a line to the work log whenever a PR is merged.

## How we work

- **Branches and PRs.** Never commit to `dev` or `main` directly. Make a branch, push it, and open a PR into `dev`. Vercel deploys `dev` to https://street-fight-uk.vercel.app on every merge.
- **Merging.** Merge only when the person you're working for says "merge". Don't merge on your own initiative.
- **Visual regression CI.** It fails on `dev` because the saved screenshots are out of date, not because of a code fault. The owner refreshes them in GitHub: Actions → CI → Run workflow → `update_baselines`. "Type check, tests, build" is the check that matters.
- **Checks before a PR.** Run `npm run typecheck` and `npm test`. Check any UI change at both phone landscape (844×390) and phone portrait (390×700).
- **Credits.** Third-party CC BY assets must be credited in the folder's CREDITS/SOURCES file. Art the owner made or supplied needs no licence. The owner has chosen to keep the hydroponics pack in the public repo even though its licence says not to redistribute it.
- **Credit the creator.** Projects are credited to Leeko.

## Where things live

**Asset sets** (`src/render/props/`). Each set loads GLBs from `public/models/<set>/`:
- `GymLibrary`, `ShopLibrary`, `HydroLibrary`, `SecurityLibrary`, `DoorLibrary`, `KenneyLibrary` (furniture and food), and `PropLibrary` (weapons and small items).
- Shared loader: `modelSet.ts`. Some sets are used in `LevelView.ts` through the helpers `fit()` (Kenney), `fitting()` (shop), `gym()` and `piece()` (Polyfork kit).

**Streets** (`src/city/`). Built from the city kit (`public/models/city`).
- `street.ts`: `PROP_MODELS` lists the street props the kit draws. `KIT_KINDS` in `catalogue.ts` lists the building fronts it draws.
- Anything not covered there is built from boxes in `LevelView.ts`.

**Doors** (`src/city/doorSpots.ts`). Doors are random styles from DoorLibrary. In `World.findInteractable`, an exit is a strip in front of the door, so you use it standing at the door.
- Blue door boards show only over points of interest: `isPoiExit` at the end of `LevelView.ts` (shops, gyms, pub, casino, routes the story opens).

**Characters** (`src/characters/human/`, `public/models/human`).
- MakeHuman-style body plus clothing and hair proxies. `fromAppearance.ts` maps the creator's choices to models.
- Clothes with no proxy (hoodies, jackets, jeans and so on) are made in code by `garments.ts`.

**Animation.**
- Mocap: `public/anim/rokoko_mocap.json` (fight clips), `mixamo_mocap.json` (the owner's Mixamo library, `tools/mixamo/convert.py`) and `ara_mocap.json` (walk, run, sit and so on).
- Everything else is keyed in code: `src/render/poses.ts`, `src/render/activityPoses.ts`.

**UI** (`src/ui/`).
- `styles.css` is the base. `theme.css` is the "Council Estate Grime" design system: a red, white and blue palette, Big Shoulders and Overpass fonts. It loads after `styles.css`, so put new styling in `theme.css`.
- Portrait phone layout: the `@media (orientation: portrait) and (max-width: 700px)` blocks at the end of `theme.css`.

**Painted titles** (`public/art/titles/*.webp`).
- `src/ui/titles.ts`: `TITLE_SLUGS`, `titleArt()`, `titleFor()`.
- `menuButton(label, …, art)` in `controls.ts` shows the graphic in place of the text.
- New buttons need a graphic. Generate it with `tools/titles/gen.py` (instructions are in the file), then add the slug to `TITLE_SLUGS`. `tests/titles.test.ts` fails if the list and the folder disagree.

**Logo and icons.** `public/art/logo*.webp`, `menu-keyart*.webp`, `public/icons/`, `public/manifest.webmanifest`.

**Sound.** `src/audio/AudioManager.ts` uses the recorded mp3s in `public/audio`. Menu sounds, ambience and household sounds are synthesised in code. Music: `AudioManager.setMusic('menu' | 'street' | 'boss' | null)`, chosen each frame by `Game.updateMusic` (no music in rooms listed in `INDOOR_THEMES`); the loops come from `tools/audio/make_music.py`.

**Materials and textures.** The owner's texture library (130 ambientCG sets) is in `public/textures/lib`.
- `src/render/materials/library.ts` loads sets on demand and makes the materials; `assign.ts` decides what gets which; `streetDetail.ts` lays asphalt, concrete and brick on the kit streets.
- `docs/assets/TEXTURE_CATALOGUE.md` lists every set; `docs/assets/TEXTURE_ASSIGNMENTS.md` says where each is used and which are still spare.
- The owner wants realistic surfaces: use a library set for new surfaces rather than a flat colour or a drawn texture.

**Economy.** `docs/ECONOMY.md` has the targets and where every number lives. Run `npx tsx tools/economy/model.ts` after changing a price or reward; `tests/economy.test.ts` fails if the curve breaks.

**Old docs.** `docs/ASSET_REGISTER.md` is out of date (it predates the asset packs). For what's still missing, use the asset list below.

## Assets still needed

The full list of every texture, model, icon, animation and sound still made in code is in the repo (611 rows: 508 made on 13 Nov 2026, 87 added for PR #20's jewellery and property, and 16 for #36's bracelets and earrings):

- `docs/ASSETS_NEEDED.xlsx`: open it in Excel or Google Sheets. Its columns are Area, Name, Game id, Asset needed, How it is made now, and Got it.
- `docs/ASSETS_NEEDED.csv`: the same list as plain text, for Claude to read, search and update.

The owner also has it as a Sheet on claude.ai: https://claude.ai/artifact/AgbRW48tzHxub9PpgqpuGB

When someone asks for "the asset sheet", point them to `docs/ASSETS_NEEDED.xlsx`. When an asset is added and wired in, set its row's Got it to TRUE in both files, and say so in the PR.

The main gaps:
- Item icons: all 190 are painted by code (`src/ui/itemIcons.ts`).
- Weapons: 31 of 36 have no model.
- Owned vehicles: all 12 cars and 10 bikes are built in code.
- Accessories with no worn model: earrings, belt, gumshield and headguard. Chains, watches and rings show as code-built pieces since #20, but still need proper models.
- Jewellery (#20, #36): 68 pieces with no model or icon (rings, watches, necklaces, bracelets, earrings, grills), plus metal and gem materials.
- Property (#20): four mansion styles, 20 listing photos, a staircase, the estate agent boards, and rooms with no proper fittings (swimming pool, cinema, conservatory, roof terrace, dressing room).
- Caps and beanies show a flat cap as a stand-in.
- Hairstyles that borrow another style's model: afro, cornrows, mohawk, quiff, buzz, curly and ponytail.
- Fight moves: 22 are keyed in code (hook, uppercut and so on).
- Music: three synthesised loops exist (`tools/audio/make_music.py`: menu, street, boss). Recorded or commissioned tracks would still be better.

When the owner adds an asset that covers a row, wire it in and tick the row.

**Asset production (branch `assets-production`, 14 Nov 2026).** 302 of the 595 rows are done and ticked. The tracking lives in `docs/assets/`:
- `ASSET_RESUME.md`: where things stand and how to carry on. Read it first.
- `ASSET_STYLE_GUIDE.md`: the look and the triangle budgets.
- `ASSET_TECH.md`: formats and registries.
- `BRIEF_COMMON.md`: the rules for any asset work.
- `packages/`: ready briefs for the four unfinished packages (jewellery, household, character, world).
- `docs/assets/ledger/*.json`: one entry per row worked on. Run `python3 tools/assets/ledger.py` to rebuild `ASSET_MANIFEST.md` and `ASSET_PROGRESS.md` and to tick the sheet. Never tick it by hand.

## Work log

**12 Nov 2026**
- #1–#2: world rebuild into one continuous street from the low-poly kits; world polish.
- #3–#4: Rokoko mocap for combat; real front kicks; stamina.
- #5: gameplay stages 1–3.

**13 Nov 2026**
- #6–#7: gameplay stages 4–8 (difficulty curve, sprint, recorded sound, game feel).
- #8–#9: low-poly furniture for the home and shops; gym and shop furniture.
- #10: flat fixes (bath, TV, stairs, hiding walls).
- #11: hydroponics kit for the grow business.
- #12: security kit (CCTV, alarms, lamps, junction boxes).
- #13: cannabis plant model throughout the grow business.
- #14: doors from the PSX pack, picked at random across the city. Also fixed bloom glare, TV sitting, pedestrians getting stuck, and props on the road.
- #15: no door over the basement stairs. You now use a door standing at it.
- #16: UI overhaul ("Council Estate Grime"):
  - key-art main menu, logo, manifest and icons;
  - red, white and blue palette;
  - 147 painted title graphics wired into menus, settings, banners, boss intros and the FIGHT, YOU WIN and GAME OVER screens.
- #17: iPhone double-tap zoom fixed with `touch-action` in `styles.css` and `TouchControls.ts`.
- #18: iPhone portrait controls redone. Six buttons along the bottom, the stick on the left and the punch/kick diamond on the right, so nothing covers the stick. Door boards only on points of interest.
- #19: painted graphics for every remaining menu button (made with `tools/titles/gen.py`). Also:
  - no underlines under painted headings;
  - compact result screens on phones;
  - settings names on their own line in portrait;
  - the "turn sideways" hint hidden over menus;
  - weapon, bag and heat chips moved to the top under the objective.
- #20 (the friend's): jewellery and property.
  - **Jewellery:** the Halden & Crane jeweller in the Riverside Centre sells 52 pieces (rings, watches, chains and grills, each in several metals). A jewellery box keeps what you own, separate from the inventory. Worn pieces sit on the 3D character, fitted to its bones (`render/jewellery.ts`).
  - **Property:** 20 properties to buy, live in, let or sell, sold through the Keys & Co estate agents (`realty/`). There's a new gated road, Ashcombe Park, with mansions, and interiors are generated for each property. Rent and finance tracking is in `progress/finance.ts`.
  - All of it is built in code: no new asset files.

**14 Nov 2026**
- #22: asset production: 302 of the 595 sheet rows replaced with real assets (sound, weapons, pickups, vehicles, icons, textures, property, animation). See `docs/assets/ASSET_RESUME.md`.
- #23: Big Dunc progression. Boss rewards that don't fit wait on the ground and are saved (`save.bossLoot`); Hale House's gate, the objective and the victory screen say exactly what's left (`src/world/gates.ts`); result screens keep every button on screen.
- #24: face-down falls no longer sink into the floor: a tipped body rests on its lowest point (`src/render/anim/ground.ts`).
- #25: texture library: library sets on furniture, walls, floors and kit streets (`src/render/materials/`, `docs/assets/TEXTURE_ASSIGNMENTS.md`).

**15 Nov 2026**
- #26: clothing overhaul (`src/characters/human/garments.ts`):
  - new styles: polo, shirt, jumper, quarter-zip, gilet, windbreaker, Harrington, chinos, cargo shorts, denim shorts; bucket hat, flat cap, glasses;
  - caps, beanies and bucket hats are cut from the scalp, with a peak or brim on the head bone, and short hair goes under them;
  - trainers, runners and hi-tops are cut from the foot, laid on a shoe last, with a separate cupsole mesh;
  - cut edges are straightened (`smoothCutEdge`), the trouser crotch flattening no longer cuts into the belly, and tops ride over waistbands;
  - 38 new Threads items; `tests/clothing.test.ts`; `?shot=anims&wear=[…]` poses chosen outfits.
- #27: animation overhaul phase 1: 14 Mixamo clips from the owner's library (`tools/mixamo/convert.py` → `public/anim/mixamo_mocap.json`). Hook, elbow, knee, rear roundhouse and headbutt are captured now; extra jab and cross takes; head hits and staggers cycle through several reactions (`REACTIONS.heads`, `staggers`). Phase 2 followed in #28.
- #28: animation phase 2 (29 clips, `mixamo_mocap.json`): lead roundhouse; more hit and stagger reactions; knocked-out fighters lie hurt in a loop; captured gym loops (bag, speed bag, curls) and sitting loops. Home gym kit has `routine`s (`src/training/gym.ts`) switching exercise every 6 s: curls and front raises, squats and presses, skipping, push-ups, burpees and squats. Dumbbells and the barbell are held while training (`FighterView.syncGear`); `?shot=stance&act=<activity>` shows it.
- #29: texture logic review: painted metal shades as paint (the bath and fridge were black); bath, toilet and basin porcelain, fridge and cooker white painted metal; kit-street brick only on building walls (per-vertex `sdWall`), so awnings aren't brick; `assign.ts` rules tightened (wood only on wood tones, porcelain only in bathrooms, concrete only on buildings and grounds, cloth for baize, canvas and awnings). `tests/textureLogic.test.ts` checks every textured surface in every level.
- #30: kit-street brick on every building model (the pack's `building` flag), never on anything over 20 cm in front of a façade (awnings, canopies, signs); frontages record the doors they draw (`ownDoors`, mansion gates), so an exit there signs that door instead of adding a second. `?shot=<scene>&x=` (debug; didn't move the camera in testing). Still open: black-squares ground reported at the first boss (market setts surface suspected).

**19 Nov 2026**
- #31: area banner shows one painted title with the other name as a small line (`Hud.showBanner`), clear of the use prompt; subway stairs are a stairwell in a gap in the frontage (`isSubwayStairs`/`SUBWAY_GAP` in `world/strip.ts`, gap in `city/street.ts`, `LevelView.subwayEntrance`); outdoor barriers are railings; precincts, lanes, yards and the quay get a kerb and road in front (street.ts ground section); kit-street paving by ground kind (`PAVING_BY_GROUND` in `render/materials/streetDetail.ts`). `?shot=subway_stairs`.
- #32: City Centre and Ring Road Subway dressed with kit street furniture and security-set CCTV posts (`levels.ts`), and the subway gets 4 pedestrians (`civilians.ts`). Keep street furniture against the back wall (z ≤ -1.85) or at the kerb (z ≤ -0.22): `tests/npc.test.ts` limits pedestrian about-turns to 1.8 a minute and dev sits at 1.78, so anything in the walking lanes fails it (a planter at z -1.85 did).
- #33: fixes from the game audit (https://claude.ai/artifact/CyaZtY78EAxrvmF7XMjYpq):
  - portrait: no "turn sideways" hint, unclipped health numbers, a tighter fight camera, red edge arrows for off-screen enemies (`Game.updateEdgeMarkers`);
  - touch buttons in plain words (PUNCH, KICK, HARD, SPECIAL, STYLE); map, bag and crew hide during a fight (`body.fight-on`);
  - vibration on hits, blocks and knockdowns (Android; `InputManager.rumble`, Settings → Vibration);
  - original music (above) with a Music volume slider;
  - the first fights coach the buttons (`Game.coachText`, flag `coach:done`); Pause → Moves (`src/ui/moveList.ts`);
  - map labels by on-screen size, touch wording, practice chips without keys, painted creator buttons, no room plates at home, the objective stays readable in a fight;
  - grunts have first names and a shouted tell (`GRUNT_NAMES`, `Archetype.tell`; never uses the fight's RNG);
  - Threads and the Red Lion dressed;
  - boss challenges (Untouchable, No guard, Quick work; `challenge:<boss>:<id>`, £25 each) and a shareable KO photo.

- #34: economy fixes (`docs/ECONOMY.md`; `npx tsx tools/economy/model.ts` prints the whole economy; `tests/economy.test.ts` holds the targets):
  - loot and boss jewellery are jeweller pieces in the jewellery box, wearable, priced the same both ways (`JEWEL_ITEMS`); Threads sells no jewellery; old saves' loose loot jewellery moves into the box;
  - story boss purses about tripled (cash ≥ 90% of each boss's loot); the victory screen says what the loot is worth;
  - towns pay about double; the grow business £14 a unit; rent yields 1–1.5% a month (pays back in 11–17 h);
  - house prices settle towards a long-run level instead of compounding (index 0.75–1.8); mansions £650k–£1.25m, penthouse £480k;
  - arrest fine capped (`arrestFine`); food heals less and not when stuffed; plasters on the Red Lion menu; no smaller bags than one you own;
  - the jewellery box stacks in portrait;
  - the casino's prize draw (paid back 201%) and motor competition (1 in 40 for any car: a money machine) now return under 100%, like every other game (`HOUSE_RETURN`, `compOdds`).
  - Target: first mansion about 28 hours after the towns, every property about 51.

- #35: performance, first step: kit streets are baked in 12 m chunks (`STREET_CHUNK` in `render/kit/PolyKit.ts`) so off-screen parts are culled in both passes; a fight scene drew about 850k triangles a frame, now about 670k.

- #36: polish, part 2:
  - people are culled off screen (one fixed sphere per person, `cullAsCharacter` in `render/human/HumanBuilder.ts`) and the shadow camera is 20 m wide: a fight draws about 478k triangles a frame (850k before #35), the Red Lion 158k (963k);
  - the black squares at the market were the kit's checkerboard plaza tiles under chevron paving: plazas use `PavingStones092` and grey ground is evened out (`streetDetail.ts`); noise hashes no longer multiply big world coordinates (phone GPU precision);
  - fight balance: the harness walks the bot into each fight (drifting out of the trigger counted as a loss), the first fight is one lad then two, a few bosses and fights tuned (`docs/BALANCE.md`); `tools/economy/farming.ts` measures repeat-fight income (best about £3,700 an hour);
  - bracelets (other wrist, new wear slot `bracelet`) and earrings (a pair on the lobes) at Halden & Crane, 8 of each; loot diamond studs and bracelets go in the jewellery box; Threads' silver earring is drawn as sleeper hoops and no longer sold.
  - simpler phone screen: walking about, the touch pad is just the stick, PUNCH, KICK and JUMP (`body.roam`); block, dodge, grab, special, style and the hard hits appear in a fight. In portrait STYLE SWAP sits beside pause in a fight, needs are small icon badges right of LVL and money (the strip was half off-screen), and the stick ring stays inside its zone.
- #37: USE is its own action, not GRAB: on phones tap the "USE …" plate (`Hud` prompt, `InputManager.useFromTouch`, `CommandFrame.use`); E uses and U grabs on a keyboard; LB on a pad does both (use wins when there's something to use). Needs badges show their icons again (`.need-text`).
- #39: running keeps you on screen (`CameraRig.updateWorld`: dead zone scales with screen width, the camera leads the way you run, you're held 0.55 m inside the edge; a portrait sprint went from 117% to 44% of the way to the edge); passers-by and anyone they bump are pushed apart as round bodies, the passer-by giving way (`Simulation.separate`); walking or backing into a prop steps you round it to the nearest gap (`World.steerAround`, also enemies and crew).
- #41: the camera follows a run with no lag and leads the way you're going (eased `lead`, feed-forward of `cx` in `CameraRig.updateWorld`): a portrait sprint holds you about a third of the way across with the street ahead in view, never nearer than 110 px to an edge. A red USE button in the touch pad whenever there's something to use (`body.can-use`): bottom of the pad walking about, top-left corner in a fight; the plate can still be tapped.
- #42: shop windows sell what their signs say. Every see-into shop was filled from the café and office kits (coffee-cup neon in the pub, club and casino; cake cabinets in the phone and pawn shops; coat stands and lockers in clothes shops; a boardroom table in the furniture shop; BMXs in the moto shops; office chairs in salons; empty shelving). Layouts in `city/street.ts` (`INTERIORS`, `layoutFor` picks boxing / mats / gym, nails / hair, corner shop / hardware by the sign) now take stock from the other model sets as `ShopGood`s (`G(...)`: clothes rails, mannequins, gym kit, motorbikes, room sets, roulette, slots, the cage, stocked shelves), drawn by `LevelView.buildShopGoods` and baked per shop into a few meshes with no shadows (`render/bakeStatic.ts`): about 30–40 more draw calls on the busiest streets, fewer triangles. Jewellers are their own kind (`jeweller`: Halden & Crane, Station Jewellers). `tests/strip.test.ts` checks each kind has its stock and none of the borrowed kit.
- #43: windows on the kit buildings are windows, not flat tan panels: each lit pane gets its own (u, v) when the street is baked (`panes()` in `render/kit/PolyKit.ts`, attribute `rlWin`), and `roomLight` draws a white frame and glazing bars, sky-reflecting glass, and a room lit from a ceiling lamp, darker to the sill, some with curtains or blinds, some dark, a few blue with a telly. Property listings on kit streets stand at their building's own front door (x in `realty/catalogue.ts`, measured on screen) and no extra door is drawn (`LevelView.buildExitInner`); the Hollins bike rack moved off the cottage door. Still open: street brick is laid over flush doors and window frames on some buildings (`sdWall` takes everything within 20 cm of the wall).
- #44: rooms at their real size. Every interior (home, basement, the 20 properties, pub, casino, shops, gyms, jeweller, estate agent) was the same 3.7 m strip as the street; `deepRoom` (`world/rooms.ts`) carries each room forward 4.4 m (about 8 m deep), carries the walls between rooms through to the front (drawn by `LevelView.buildPartitions`, doorways kept on the walkway), and the indoor camera (`CameraRig.room`, set by `GameRenderer` for `level.deep`) rises and looks down into the whole room, fitted between the HUD and the touch pad. The new floor is filled: `FRONT` / `fitOut` in `world/interiors.ts` (pub tables, casino tables and slot rows, rails, room sets, gym kit…) and `midRoom` in `realty/world.ts` (rugs, armchairs, dining sets, cinema rows, a pool table; the pool room is 12 m with a real basin and lane ropes). The boxing gym has a full 5.2 m ring with corners, ropes and steps, the wrestling club a 7 m mat with its circles (ring and mats were drawn at the wrong depth before). Home furniture can go out on the front floor (`FRONT_FLOOR_Z` in `property/home.ts`).
- #45: visual overhaul, first pass (`docs/OVERHAUL_AUDIT.md`): approved asset registry and shared prototypes (`src/render/approved/`, copies synced by `tools/assets/syncApproved.mjs`); kit-street furniture swapped for the approved British set (K6 kiosk, pillar box, bus shelter, column lamps, wheelie bins, skips…) at real size; shop windows, awnings and pub signs; the interior furniture pack (142 models) drawing home, property and shop furniture (`render/props/packFurniture.ts`). `?shot=area&id=<area>` and `?shot=viewing` for looking by hand.
- #46: inside a building the scenery stops at its end walls (`X0`/`X1` in `LevelView` for `level.deep`): past the last wall is black, not more floor and the next room.
- #47: needs no longer pop up: a bell next to the map (`Hud.remember`, the notifications tray) lists what each need says and recent messages, with a dot when there's something new; tap a need badge to see what's wrong (`Hud.showTip`, `NUDGES` in `home/house.ts`); phone toasts are smaller, two at most. Indoors a zoom button (and Z) swaps the whole-room view for a closer one that follows you (`CameraRig.roomZoom`, `body.room-on`); top left of the room in portrait. It's a button, so Safari's page zoom is untouched.
- #48: rooms furnished like what they are. The house gets 16 furniture-pack pieces (pantry, round table and Windsor chairs, dressing table, tallboy, cube shelves, sideboard, club chair, coat stand, airer…) put out once as furniture you own (`dressHouse`, `save.property.dressed`), so the computer moves, turns and sells them like anything bought; they're in the Home & Hearth catalogue too. Properties, the pub (booths, poseur tables and stools, dartboard, chalkboard, dark bistro tables), the casino, agents, showrooms and shops get fixed dressing: props of kind `decor` (an approved model by id, sizes in `world/decorSizes.ts`), laid out by `world/roomDecor.ts` and kept only where they touch nothing (`addDecor`). The USE plate no longer shows over an open panel (the fridge).

## Open questions and next steps

- **Performance, still to do:** characters are about 36–40k triangles each (body about 27k). Agreed plan (19 Nov, not started), all from the models we already have, no new art:
  1. merge each person's ~10 skinned parts (body, clothes, hair, shoes) into one skinned mesh with material groups in `HumanBuilder.ts`: same look, one draw instead of ten;
  2. auto-decimate a lighter copy of the body and garments (about 27k → 8k) for people who aren't fighting; fighters and anyone close up keep the full model;
  3. only if still needed: pre-rendered impostors for the far crowd. Not for everyone: outfits are random (so they'd be baked at load), and lamps, rain and night would need relightable impostors.
  Expected: people cost half to two-thirds less. Profiling: in `?shot=` pages `window.__realNow` is the real clock (`performance.now` is frozen there), and `renderer.info` with `autoReset = false` gives triangles per frame.
- **Balance:** `docs/BALANCE.md`. A few late fights (underground platform, Hale House courtyard and gate) sit a little under target; the Estate King is easy.

- PR #20's own "not done" list:
  - section 11 onwards of the jewellery and property brief;
  - one-of-a-kind interiors for each property;
  - real upstairs floors;
  - the hoodie's jagged collar.
- The owner tests on an iPhone in portrait. Check every UI change at 390×700 as well as in landscape.
- The London place names and `arch-*` archetype graphics in `public/art/titles` aren't used yet.
