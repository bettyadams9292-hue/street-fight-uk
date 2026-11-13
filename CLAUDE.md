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
- Mocap: `public/anim/rokoko_mocap.json` (fight clips) and `ara_mocap.json` (walk, run, sit and so on).
- Everything else is keyed in code: `src/render/poses.ts`, `src/render/activityPoses.ts`.

**UI** (`src/ui/`).
- `styles.css` is the base. `theme.css` is the "Council Estate Grime" design system: a red, white and blue palette, Big Shoulders and Overpass fonts. It loads after `styles.css`, so put new styling in `theme.css`.
- Portrait phone layout: the `@media (orientation: portrait) and (max-width: 700px)` blocks at the end of `theme.css`.

**Painted titles** (`public/art/titles/*.webp`).
- `src/ui/titles.ts`: `TITLE_SLUGS`, `titleArt()`, `titleFor()`.
- `menuButton(label, …, art)` in `controls.ts` shows the graphic in place of the text.
- New buttons need a graphic. Generate it with `tools/titles/gen.py` (instructions are in the file), then add the slug to `TITLE_SLUGS`. `tests/titles.test.ts` fails if the list and the folder disagree.

**Logo and icons.** `public/art/logo*.webp`, `menu-keyart*.webp`, `public/icons/`, `public/manifest.webmanifest`.

**Sound.** `src/audio/AudioManager.ts` uses the recorded mp3s in `public/audio`. Menu sounds, ambience and household sounds are synthesised in code.

**Old docs.** `docs/ASSET_REGISTER.md` is out of date (it predates the asset packs). For what's still missing, use the asset list below.

## Assets still needed

The owner keeps a Sheet listing every texture, model, icon, animation and sound still made in code (508 rows, made 13 Nov 2026): https://claude.ai/artifact/AgbRW48tzHxub9PpgqpuGB

The main gaps:
- Item icons: all 190 are painted by code (`src/ui/itemIcons.ts`).
- Weapons: 31 of 36 have no model.
- Owned vehicles: all 12 cars and 10 bikes are built in code.
- Accessories with no worn model: chains, watches, earrings, rings, belt, gumshield and headguard.
- Caps and beanies show a flat cap as a stand-in.
- Hairstyles that borrow another style's model: afro, cornrows, mohawk, quiff, buzz, curly and ponytail.
- Fight moves: 22 are keyed in code (hook, uppercut and so on).
- There is no music at all.

When the owner adds an asset that covers a row, wire it in and tick the row.

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

## Open questions and next steps

- The owner tests on an iPhone in portrait. Check every UI change at 390×700 as well as in landscape.
- The London place names and `arch-*` archetype graphics in `public/art/titles` aren't used yet.
