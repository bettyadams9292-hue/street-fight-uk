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

The full list of every texture, model, icon, animation and sound still made in code is in the repo (595 rows: 508 made on 13 Nov 2026, plus 87 added for PR #20's jewellery and property):

- `docs/ASSETS_NEEDED.xlsx`: open it in Excel or Google Sheets. Its columns are Area, Name, Game id, Asset needed, How it is made now, and Got it.
- `docs/ASSETS_NEEDED.csv`: the same list as plain text, for Claude to read, search and update.

The owner also has it as a Sheet on claude.ai: https://claude.ai/artifact/AgbRW48tzHxub9PpgqpuGB

When someone asks for "the asset sheet", point them to `docs/ASSETS_NEEDED.xlsx`. When an asset is added and wired in, set its row's Got it to TRUE in both files, and say so in the PR.

The main gaps:
- Item icons: all 190 are painted by code (`src/ui/itemIcons.ts`).
- Weapons: 31 of 36 have no model.
- Owned vehicles: all 12 cars and 10 bikes are built in code.
- Accessories with no worn model: earrings, belt, gumshield and headguard. Chains, watches and rings show as code-built pieces since #20, but still need proper models.
- Jewellery (#20): 52 pieces with no model or icon, plus metal and gem materials.
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

## Open questions and next steps

- PR #20's own "not done" list:
  - section 11 onwards of the jewellery and property brief;
  - one-of-a-kind interiors for each property;
  - real upstairs floors;
  - the hoodie's jagged collar.
- The owner tests on an iPhone in portrait. Check every UI change at 390×700 as well as in landscape.
- The London place names and `arch-*` archetype graphics in `public/art/titles` aren't used yet.
