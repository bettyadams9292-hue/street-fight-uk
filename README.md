# STREET FIGHT UK

A gritty 2.5D street-fighting action RPG set in modern Britain. Browser game built with TypeScript and Three.js, playable on PC and iPhone.

**Current build: Stage 5 (expanded campaign, items and shops)**: 24 areas, 13 bosses, an inventory and stash, a clothes shop with try-on, a pawn shop, robbery with police consequences, and 36 melee and improvised weapons (no firearms). The training ground is still on the main menu.

## Run it

```bash
npm install
npm run dev        # local dev server with instant reload
npm test           # headless tests (combat, character, grappling/AI, world, Stage 5 systems)
npm run balance    # bots play every main fight; prints win rates
npx tsx tests/assetRegister.ts   # regenerates docs/ASSET_REGISTER.md
npm run typecheck  # TypeScript check
npm run build      # production build into dist/
```

On Vercel: import the repo, framework preset **Vite**, no extra settings. Every branch gets its own preview link.

## Controls

The full list (with combos) is on the in-game Controls screen.

| Action | Keyboard | Gamepad | Touch |
| --- | --- | --- | --- |
| Move | WASD or arrows | Left stick / D-pad | Left stick |
| Light / heavy punch | J / I | X / Y | LP / HP |
| Light / heavy kick | K / L | A / B | LK / HK |
| Block (hold), parry (tap just before a hit) | Space | RT | BLOCK |
| Dodge (hold up/down to sidestep) | Shift | LT | DODGE |
| Grab, break free, let go | U | LB | GRAB |
| Special (hold, then attack) | O | RB | SP, then attack |
| Finisher | O + I | RB + Y | SP, then HP |
| Swap style | Tab | Back / View | SWAP |
| Jump | C | Left stick click | JUMP |
| Pause | Esc / P | Start | pause button |
| Inventory (story) | B | Right-stick click | BAG |
| Use / pick up / search / talk | E or U | LB | GRAB |
| Throw held weapon (if throwable) | Grab while holding it | LB | GRAB |
| Training partner: stand / block / spar / group | 1 / 2 / 3 / 4 | - | top bar |
| Next opponent type / reset | N / R | - | top bar |

## How it's built

```
src/
  main.ts, Game.ts   boot, game flow (menu / playing / paused), fixed 60 Hz loop
  core/              Simulation, EventBus, game events, RNG, TrainingMode, constants
  input/             CommandFrame (what every fighter is driven by), keyboard/gamepad/touch
  stats/             Attributes, modifiers and effects, health, stamina, fatigue
  combat/            Move data types, damage formula, hit detection and resolution
  fighter/           Fighter: the one class shared by the player and every enemy
  ai/                Enemy AI (FighterAI), eight archetypes, attack tokens, training dummy
  character/         Appearance data, backgrounds, attribute allocation rules
  world/             Arena bounds
  data/styles/       The seven fighting styles: moves, combo graphs, specials, grappling (pure data)
  styles/            Style data types
  render/            Three.js: renderer, alley, temporary fighter rig, camera, hit FX
  ui/                Menus, settings, controls, HUD, touch controls, styles
  audio/             Web Audio engine
  save/              Settings and character persistence (browser storage)
  debug/             Hitbox overlay
tests/               Headless simulation tests
```

The simulation (`core`, `stats`, `combat`, `fighter`, `ai`, `world`, `data`) has no rendering code, so the same fights run in the browser and in the tests. Player and AI both send `CommandFrame`s, so enemies follow exactly the player's rules.

## Temporary assets (to be replaced)

| What | Where | Replaced in |
| --- | --- | --- |
| Procedural fighter model and code-driven poses | `src/render/CharacterRig.ts`, `src/render/poses.ts` | Blender GLB characters and real animation clips (needs model and animation files) |
| Locations, props and weapons built in code with canvas textures | `src/render/LevelView.ts`, `weaponMesh.ts`, `levelTextures.ts` | Modelled GLB sets and PBR texture sets (needs asset files) |
| Item icons drawn on canvas | `src/ui/itemIcons.ts` | Painted or rendered icons |

Every visual asset, with where it appears, its status and collision, is listed in [docs/ASSET_REGISTER.md](docs/ASSET_REGISTER.md).
| Synthesised impact, swing and ambience sounds | `src/audio/AudioManager.ts` | Stage 7 (recorded audio) |

## Stage 1 report

**Built**
- Project setup: Vite, TypeScript, Three.js, Vercel-ready.
- Main menu (Training Ground, Settings, Controls), pause menu, settings saved in the browser, controls screen. Every menu works with mouse, touch, keyboard and gamepad.
- Fixed 60 Hz simulation loop, separate from rendering.
- Input from keyboard, gamepad and on-screen touch controls, with a 9-frame input buffer (12 on touch).
- 2.5D movement with a 4 m depth band, facing, jumping, fighter-to-fighter collision.
- Side-on camera that frames both fighters, pulls back as they separate and shakes on impact.
- Stats and effects system: six attributes, all wired into gameplay per the design doc.
- Health and stamina: stamina costs, regen delay, half regen while blocking, fatigue states (tired, exhausted) with real penalties, recoverable chip damage, out-of-combat regen to 50%, KO.
- Combat: six Street Fighting moves with frame data, combo graph, hit detection with depth tolerance, damage formula, clean hits, repetition penalty, hitstop, blocking, guard break, poise, flinch, stagger, knockdown and get-up (with quick rise).
- Sparring partner with three modes, including a "spar back" mode that uses the same commands as the player.
- HUD: health with damage trail and recoverable segment, stamina with 30% and 10% markers, opponent bars, combat call-outs, combo counter, floating damage numbers, FPS counter.
- 23 automated tests plus a 15-minute random-fight soak test.

**Needs testing on a real device**
- Look and feel of the fight (pose timing, camera, hit effects) on PC and iPhone.
- Touch control layout and comfort on your phone.
- Performance on your iPhone at each quality setting.

**Next: Stage 2 (Character)**: character creation with live preview, modular appearance, shared skeleton, real animation clips replacing the capsule rig.

## Stage 2 report

**Built**
- Character creator with a live 3D preview in a photo studio: drag (or use the arrow buttons) to turn the model; the camera moves in for face and hair.
- Appearance: male/female body, muscle, weight, height; head width, jaw, nose, brow, eye spacing, ears; 12 hairstyles, hair colour, greying; 6 facial hair styles; 12 skin tones; tattoos in 6 places (6 designs plus full sleeves) with ink colour; face and arm scars; tops, bottoms, shoes in any colour; hand wraps, chain, cap, watch, earring, head guard.
- Name, five backgrounds (bonus attributes, perk, starting cash) and 10 attribute points to spend, with a live readout of what your stats do in a fight.
- Your fighter is saved in the browser. Main menu now has Continue, New Game (with a warning before replacing your fighter) and Character.
- Character sheet: attributes with their breakdown, fight stats, style rank, cash and perk; "Change look" reopens the creator.
- The training ground uses your fighter: your name, attributes, look and style rank. Estate scrapper's Street Fighting rank 2 gives +5% damage with Street Fighting moves; other background perks say which stage they start working in.
- 9 new automated tests (32 in total).

**Needs testing on a real device**
- The creator's layout on your iPhone (portrait and landscape) and on PC.
- How the hairstyles, beards, tattoos and clothes look on the model.

**Not done yet: real animation clips.** The fighters still move with code-driven poses. Proper animation needs animation files (for example from Mixamo, which needs a free Adobe account to download, or made in Blender). Once there are files in `public/assets/animations/`, the animation controller can switch to them without touching the combat code.

**Next: Stage 3 (Combat expansion)**: the other six fighting styles, parry and counters, dodging and sidestepping, grapples and takedowns, and enemy AI for eight fighter types.

## Stage 3 report

**Built**
- Seven fighting styles, each with its own stance, moves, combo graph, two specials, clinch moves, finisher and defensive ability: Street Fighting (shove), Boxing (slip, no kicks, body shots drain stamina), Kickboxing (checks: blocked kicks do no chip), Muay Thai (teep, leg kicks slow you, deadly clinch), Karate (blitz dash, longer counter window), Wrestling (shoots from range, sprawl beats grabs) and BJJ (submissions, sweeps from the floor).
- Stance swap between two styles mid-fight.
- Parry (tap block just before a hit) opens a counter window: counter hits do 1.5x damage and always stagger.
- Dodge with invulnerability frames: back-step, sidestep into or out of the screen, style versions (slip, blitz).
- Knockdown options: stay down, quick rise, roll, get up swinging, or (BJJ) sweep.
- Grappling: grab into a clinch; clinch strikes, throws (extra damage near a wall), takedowns to the ground, ground strikes and submissions; escapes are a stamina and skill contest, with a resist meter for submissions.
- Finishers on opponents below 15% health who are reeling.
- Enemy AI that uses the same controls as you: approaches, keeps its range, attacks along its style's combo graph, blocks, parries, dodges, grapples, backs off when tired, and swaps stance. Only two enemies attack at once; the rest circle.
- Eight enemy types: Street Thug, Hothead, Heavy Bruiser, Skilled Boxer, Kickboxer, Grappler, Rival, and Big Dunc (boss: goes berserk below half health).
- Training ground: stand / block / spar / group of three, opponent picker, practice any style from the pause menu, context prompts for grapples and finishers.
- Rugby player and Dancer background perks now work.
- 24 new automated tests (56 in total), plus a soak test of every style in every mode.

**Needs testing on a real device**
- How each style feels, and whether the AI is too hard or too easy.
- Touch layout with the extra buttons (DODGE, GRAB, SP, SWAP).

**Next: Stage 4 (RPG systems)**: inventory and equipment, XP and levelling, skill trees and style mastery, training sessions, full save and load.

## Stage 4 report: arcade beat-'em-up world

**What's new**
- **Story mode.** New Game creates a fighter and starts at home. Continue resumes where you last arrived. The training ground is still on the main menu.
- **The neighbourhood.** It has eight connected areas: Home, Tanner Road Estate, the High Street, the Back Alleys, Canal Side Works, the Ring Road Subway, Market Square and The Pit.
  - You move between areas by walking off an edge or using a door.
  - Each district's exit opens once its boss is beaten.
  - The subway lever opens a shortcut back to the estate.
- **Collision.** Props, room walls and gates are solid for players and AI alike. Their boxes come from the same size table the renderer uses. AI steers round obstacles.
- **Home hub.** These are rooms you walk around in, with walls and doorways between them:

  | Room | What you can do |
  |---|---|
  | Bedroom | Wardrobe (change your look; clothes you haven't found yet stay locked); mirror (character sheet); biscuit tin (bank your pocket money) |
  | Living room | Sofa (story so far, stats, save); phone (hints, and £5 cabs to unlocked districts); front door |
  | Kitchen | Free full recovery; Full English buff |
  | Gym | Upgrades (a training point plus banked cash each); move unlocks; style lessons; choose main and swap styles; Cousin Mo to spar |
  | Garage | Choose a weapon to take out; choose gear |

- **Encounters.**
  - Trigger lines work from either direction. A fight walls you in until it's over, and enemies come in waves.
  - Main fights pay out once; optional fights come back each visit at half pay.
  - Beaten enemies drop cash.
- **Bosses.** Each has a bottom-screen boss bar and an intro line, and changes at phase thresholds: summons, enrage, style swap.
  - The defeat event fires once and pays once (`Progress.claim`), then sets the district flag.
  - After it, the victory screen offers "Head home" or "Stay and explore".
- **Combat additions.**
  - Weapons: bottle, cricket bat, lead pipe. You can pick them up, swing them, wear them out (bottles smash), and you drop them when knocked down. The first one of each kind found also goes into the garage.
  - Jump attacks and a dash strike.
  - Enemies glow red while winding up heavy moves.
- **Progression.**
  - Pocket cash versus banked cash: getting battered loses 25% of your pocket and sends you home.
  - XP, levels and training points.
  - Secrets hold gear and clothes; one-time pickups stay collected.
- **Saving.** Save v2 lives in `sfuk.save.v2`, with a backup copy. A corrupt save falls back to the backup, then to the Stage 1–3 fighter. The game saves when you enter an area, clear a fight, find something, beat a boss, buy at home, or close the page.
- **Camera.** Has a dead zone, frames the fight, and is clamped to the area and to fight locks. Scenery runs past both ends of each area, so nothing beyond it is ever in view.
- **HUD.** Money, level/XP, objective, held weapon, area name card, toasts, boss bar, and the interaction prompt (E or U on keyboard, LB on gamepad, GRAB on touch).

**Files.**
- New:
  - `src/world/World.ts`, `LevelTypes.ts`, `levels.ts`
  - `src/render/LevelView.ts`, `levelTextures.ts`, `weaponMesh.ts`
  - `src/progress/Progress.ts`, `catalogue.ts`
  - `src/save/SaveStore.ts`
  - `src/ai/bosses.ts`
  - `src/combat/Weapons.ts`
  - `src/ui/hub.ts`
  - `tests/world.test.ts`
- Changed: Game, Arena, Fighter, FighterAI, archetypes, CombatSystem, Stats, styles, CameraRig, GameRenderer, FighterView, Hud, CharacterCreator, screens, InputManager, styles.css.

**Tests.** `npm test` runs 75 tests: 23 + 9 + 24, plus 19 new world tests. The new tests cover:
- Every exit leads to a real entry.
- A flood-fill check that every entry, door, station, pickup, lever and fight trigger can be reached, and that a closed gate really blocks.
- No walking through walls or props, and no interacting through walls.
- Fight locks, waves and one-time pay.
- Boss phases, a single defeat event, a single reward, and the next district unlocking.
- Pickups staying collected.
- Weapons.
- The lever shortcut.
- Defeat.
- AI steering round obstacles.
- Save round trip, backup recovery and sanitising bad data.
- A full loop: home → out → boss → home → bank → train → save → reload → next district.
- A 40-second AI soak in every area that checks nobody ends up inside an obstacle or out of bounds.

**Balance pass (after Stage 4).**
- New **Difficulty** setting (Settings → Game) for story mode: Easy, Normal or Hard. It changes how much damage you deal and take, and takes effect immediately.
- Each level now gives +5% damage, −2.5% damage taken and +4 max health.
- Grappling is fairer on you in story mode. After a hold ends you can't be grabbed again for 2.5 s, submissions build more slowly, and a tap-out costs 22% of max health instead of 35%.
- The late fights are lighter. City square and Pit gauntlet waves were trimmed, and the Ratcatcher and Big Dunc toned down.
- `npm run balance` has bots play every main fight at the progression you'd roughly have by then. On Normal:
  - The early districts are won 80–100% of the time.
  - Sully and the subway: 50–90%.
  - The Ratcatcher: about 40–60%.
  - Big Dunc: about 20–25%, the hardest fight, as intended.
- The bots are cruder than a human, so treat these numbers as a floor.

**Known limits.**
- Art is still built from simple shapes and procedural textures.
- Audio reuses the Stage 1 synthesised sounds.
- The camera always faces side-on.
- Bosses are tuned by numbers; nobody has played them through yet.


## Stage 5 report: campaign, items, shops and weapons

**The honest headline on graphics.** No external models or textures could be downloaded in this environment, so there are no GLB characters, scanned textures or motion-captured animations. Everything below was built in code. It's a big step up from Stage 4, but it is not a photoreal AAA look; getting there needs real asset files.

**Graphics and assets**
- **Characters.** 7 new tops (designer hoodie, football shirt, puffer, leather, denim, long coat, hi-vis workwear), 3 new bottoms (joggers, cargos, workwear) and runners each have their own geometry: cuffs, collars, lapels, zips, quilting, pockets, reflective bands, knee pads. Padded tops bulk out the body. New accessories: beanie, sunglasses, snood, ring, belt, mouthguard. Fists now have a palm, four curled fingers and a thumb (they were a single sphere).
- **Weapons.** All 36 weapons have their own model. Stage 4 had 3 shapes shared by everything.
- **Locations.** 13 new building types (1930s semis, shopping parade, mall fronts, football stand, leisure centre, dock warehouse, container stacks, Victorian market hall, car-park deck, derelict mill, underground platform, the Boss's compound, and shop/pawn/pub interiors) and 37 new prop models (dumpsters, buses, forklifts, market stalls, a pool table, a bar with pumps, display cabinets, mannequins and more).
- **Per-area look.** Each theme sets its ground (paving, cobbles, concrete, markings, tiles, boards, carpet), skyline, fog, roofs and lighting. There's water at the docks and rain where an area's weather says so.
- **World objects.** Breakables show debris when smashed. Items on the ground show their 3D model (weapons) or icon with a rarity ring. Unsearched containers glint.
- **Asset register.** [docs/ASSET_REGISTER.md](docs/ASSET_REGISTER.md) lists all 181 assets with the 10 fields asked for. It is generated from the game data, so where each asset appears and its collision size are always accurate. It also says plainly which Stage 5 assets have not yet been looked at in a running build.

**Campaign**
- **24 areas.** The 8 Stage 4 areas are kept. 13 new districts: Hollins Estate, Kirkgate Leisure, Kirkgate Ground (stadium), Old Market, Canal Docks, Westgate Industrial Estate, the abandoned factory, Kingsway Precinct, the shopping centre, the multi-storey car park, the Neon Mile, the Deep Line and Hale House. Plus 3 interiors: Threads (clothes shop), Pawn & Gold and the Red Lion pub.
- **Routes.** Quest items open the way on: the lock-up key, stadium key, VIP pass and Dunc's phone. Hale House needs Dunc's phone plus the Docks, Precinct, Neon Mile and Firm bosses.
- **13 bosses.** 9 are new. Each has a look, intro and defeat lines, phases (summons, style swaps, weapons drawn mid-fight), cash/XP rewards and item drops. Optional districts are marked as optional in the phone's hints.
- **Enemies.** 10 new types: hooded fighter, runner, knifeman, brawler, football casual, gang enforcer, docker, bouncer, security guard and police. Enemies can carry knives, bats, pipes and more.

**Items, inventory and storage**
- **Items.** 8 categories (weapons, clothing, accessories, consumables, valuables, collectibles, quest items, misc) and 5 rarities. Each has an icon, value, stack size and description.
- **Pockets.** 12 slots, plus 4, 8 or 12 from a bag. You can pick up, inspect, use, wear, take off, hold, put away, drop, sort and filter, and compare against what you're wearing. A full inventory leaves the item on the floor and tells you; nothing is silently deleted. Quest items can't be dropped or sold. A bag can't be dropped while it's holding things.
- **The stash.** A chest in the garage at home holds 60 slots, and shelving upgrades add 30 at a time up to 150 (paid from the tin). Deposit and withdraw *move* stacks; every stack has a unique id, so nothing can be duplicated. Carried, stashed, worn and held are kept separate.

**Shops**
- **Threads (clothes shop).** Walk in off the High Street. The catalogue has 45 lines in 5 sections. Selecting one previews it on your character, and you can turn and zoom. Paying takes your pocket money first, then the tin. If your pockets are full, it's delivered to your stash. What you buy is saved and worn from your inventory.
- **Robbing Threads.** It needs a confirm.
  - You grab up to 3 clothes, all marked STOLEN. The first time, Priya might empty the till or fight back. After that she always fights, and a security guard joins her.
  - It raises your heat, sets off the alarm, and the police arrive 12 seconds later.
  - The shop is shut for 8 trips, prices for you go up 25% per robbery (up to double), and each robbery yields fewer goods and less cash.
  - Being beaten by the police, or beaten anywhere while your heat is 60 or more, gets you **nicked**: stolen goods are seized from your pockets, clothes and hands, you pay a 15% fine (at least £25), and your heat is cleared. Heat cools as you move between areas.
- **Getting to the shops.** Pawn & Gold is on Market Square; Threads and the Red Lion are on the High Street. The phone's cab list can drop you at any shop door (Pawn & Gold has a back-door cab home, so you can sell before you've reached Market Square), and walking onto a street with a shop puts a pointer in the HUD.
- **Pawn & Gold.** Mr Kaur offers 55% of value for valuables and collectibles, 35–60% for other things, and 40% less for anything stolen. You can sell one, several, or the whole stack, with a confirm before selling everything. Quest items are refused.
- **Robbing Pawn & Gold.** It works like Threads, but you grab from the display cabinets (watches, chains, rings, phones, gadgets) and the till opens if you get past Mr Kaur. Afterwards it's shut for 8 trips, and when it reopens his offers to you are cut by the same margin Threads raises its prices.
- **The Red Lion.** Food and drink at the bar, a game of pool, a DJ booth, and an optional lock-in fight. It can be robbed too (the night's takings), with the same alarm, police, closure and price consequences.

**Weapons (melee only)**
- **36 weapons.** 16 conventional (bottle, broken bottle, cricket bat, baseball bat, lead pipe, metal bar, crowbar, claw hammer, machete, kitchen knife, bike chain, pipe wrench, club, pool cue, scaffold pole, heavy torch). 20 improvised everyday objects (mop, broom, road sign, traffic cone, plank, chair leg, table leg, pub chair, telly, monitor, skateboard, golf umbrella, shelving upright, shovel, garden fork, rake, half brick, frying pan, golf club, bin lid). **There are no guns or firearms**, and a test enforces it.
- **Stats.** Each weapon has damage, speed, reach, weight, durability and value. Breakable weapons wear out; a bottle becomes a broken bottle. Throwable weapons are thrown with Grab, fly, hit, and land where they can be picked up again. Your held weapon and its condition are saved.

**Interactive world**
- **Containers.** Bins, skips, dumpsters, cars, drawers, cupboards, lockers, crates and tills. Searching takes half a second. Random loot refills every 6 trips; fixed finds are once only. Locked ones need their key.
- **Breakables.** Crates, pallets, chairs, tables, tellies and boxes break, stop blocking, drop a weapon or loot, and stay broken.
- **Loot.** Enemies drop cash and items from loot tables by type. Everyday ground finds restock every 6 trips instead of on every visit, so they can't be farmed by walking in and out.
- **No interacting through walls.** This was already tested in Stage 4 and still applies. Collision boxes and models share one size table.

**HUD.** It shows pocket slots used, the held weapon's condition bar, and heat ("WANTED" at 60 or more, "POLICE" when they're on you). The toasts are colour-coded by rarity. The BAG button is on touch screens.

**Saving.** Save v3 (`sfuk.save.v3` plus a backup).
- A Stage 4 save converts on first load: gear, weapons and cosmetics become items, what you had equipped is worn or held, and money and flags are kept. The old v2 save is left untouched.
- Loading removes duplicate item ids and never truncates storage.

**Bugs fixed during Stage 5**
- Wearing or holding one item from a stack of more than one could duplicate it.
- Shopkeepers stood inside their counters.
- Enemies could spawn inside furniture; they now use the nearest free spot.
- The inventory key was I (heavy punch) and RB (special), so attacking opened the bag. It is now B, right-stick click, or BAG.
- Loading an over-full save could drop stash items.

**Files.**
- New:
  - `src/items/` (items, Inventory, loot, shops)
  - `src/world/districts.ts`, `interiors.ts`, `robbery.ts`
  - `src/ui/inventoryUI.ts`, `itemIcons.ts`
  - `src/render/themes.ts`
  - `tests/stage5.test.ts`, `tests/assetRegister.ts`
  - `docs/ASSET_REGISTER.md`
- Heavily changed: World, levels, LevelTypes, Progress, SaveStore, Weapons, Fighter, CombatSystem, bosses, archetypes, LevelView, weaponMesh, CharacterRig, GameRenderer, Game, Hud, hub, InputManager, styles.css.

**Tests.**
- **New Stage 5 suite.** `npm test` now includes `tests/stage5.test.ts`, which has 29 tests:
  - no firearms;
  - weapon, item and loot data integrity;
  - stacking and capacity;
  - overflow onto the floor;
  - consumables;
  - wearing and swapping without duplication;
  - stash deposit, withdraw, capacity and upgrades;
  - weapons moving between hands and pockets;
  - clothes buying (including when broke, or with full pockets);
  - pawn offers and selling;
  - robbery consequences, repeat robbery, the pawn shop and pub robberies, and arrest;
  - heat decay;
  - enemy item drops;
  - boss drops and quest gating;
  - containers (timing, once only, locked, refill);
  - breakables;
  - thrown weapons;
  - save v3 round trip;
  - de-duplication;
  - v2 migration;
  - all 24 areas linked;
  - every area and entry loading and running.
- **Updated world tests.** They now run over all 24 areas, including the AI soak.
- **Last full run.** It was during this stage, before the final bindings, HUD and clothing changes: 103 passed, 0 failed.
- **Vercel build.** The build now type-checks first (`tsc --noEmit && vite build`). The Vercel build of the main Stage 5 commit passed.

**Balance (bots, 6–8 runs each, Normal).**
- **Core districts.** Similar to Stage 4.
- **New fights.** Most are won 50–100% of the time.
- **Toned down after the first run.** The Estate King, Dean Pryce, Simone Achebe, Victor Hale and the leisure centre fight were the outliers and have been eased.
- **Re-run results.** Estate King 63–88%, Pryce 50–63%, Simone 75–88%, Hale 50–63%, leisure centre 50–75%.
- **Caveat.** Fast, dodgy enemies (runners) are disproportionately hard for the bots.

**Known limits and what's outstanding.**
- No real 3D asset files (see above). Characters, buildings and props are procedural and stylised, not photoreal.
- The Stage 5 visuals (new clothing, facades, props, weapon models, rain, interiors) type-check and are wired in. The new areas loaded without errors in the live build, but they have **not** been screenshot-checked. The browser pane was hidden during testing, so screenshots weren't possible.
- Animation is still the code-driven pose system; there are no animation clips.


## Stage 6 report: house, shops, vehicles and casino

**House (14 Tanner Road).** The house is now built from the save (`src/property/home.ts`). It has a new bathroom, so there are four rooms you can decorate: bathroom, bedroom, living room and kitchen. The fixed fittings (wardrobe, desk and tin, kitchen, gym, workbench, stash) stay where they are. Everything else can be moved.

- **Placing furniture.** Use the **Home planner** by the front door. Pick a piece, then move it with arrows/WASD, turn it with Q/E (Shift for bigger steps), and press Enter to place it. Esc cancels and Delete puts it back in its box. The same actions are on on-screen buttons. A see-through preview shows green where the piece fits and red where it doesn't, with the reason.
- **Placement rules.** Pieces stay inside the room. They can't overlap other pieces, clip the walls or fittings, or block the walkway, the front door, a cupboard or any station. Tall pieces can't stand in front of windows, and wall pieces avoid windows, the door, the mirror and each other. Rugs can go under furniture.
- **Colours and finishes.** Pieces can be recoloured, put back in their box or sold for half price. Floors and walls are set per room.
- **Seat to save.** The sofa/save station follows your sofa or armchair. With no seat, there's a floor cushion instead.
- **Exterior.** It has been rebuilt: panelled door, letterbox, handle, porch light, bay window, tiled roof, gutter, downpipe, chimney, garden wall, block-paved drive and path.

**Home & Hearth (High Street).** About 45 pieces in 6 categories, each with colour choices. You can buy several at once, and each piece has a turning 3D preview. You can also buy floors and walls here. Everything is delivered to the house.

**Brackley Motors (trading estate).** Twelve cars across hatchback, saloon, sports, SUV, 4x4 and performance. Each has a price, top speed, 0-60 time, handling and seats.

- Cars park **on the drive outside the house**, never in the garage, with collision.
- Only the active car is shown. Use the car on the drive to swap cars or drive free to any unlocked stop.
- You can sell cars back.

**Mudlark Moto (trading estate).** Ten bikes across beginner, motocross, high-performance MX, enduro and pro racing. Each has a price, top speed, acceleration, handling, braking and suspension. You can compare two bikes on the stat bars.

- The car in the garage has gone. The garage now holds three bikes in bays.
- Take a bike out from the bike store: it waits by the front door.
- **Riding.** Interact to get on. You move faster and can't fight. Interact again to get off. A fight starting knocks you off.
- **Parking.** Going into a building leaves the bike outside, and riding home puts it back in the garage.

**The Golden Lion (Market Square).** Everything here uses game money only.

- **Games.** Slots, single-zero roulette (evens, dozens, single numbers) and blackjack (3:2, double down). There is also a £10 prize draw and a £50 competition for the car or bike on the podium (1 in 40). The prize changes every few trips.
- **Prizes.** Won cars park on the drive. Won bikes go in the garage, or you get the cash value if there's no room.

**Getting there.** All four buildings have shopfronts, doors, staff and a back-door ride home. They are also on Dave's Cabs.

**Saving.** Save v3 gains a `property` block: furniture with position, rotation and colour; finishes; cars and the active car; bikes and where the one that's out is; whether you're riding; and casino stats. Saves without it load with the house as it came. Bad data is repaired: a misplaced piece goes back in its box and is never lost.

**Files.**

- New: `src/property/` (catalogue, home, state, casino, levels), `src/render/propModels.ts`, `src/ui/propertyUI.ts`, `src/ui/propPreview.ts`, `tests/stage6.test.ts`.
- Changed: `Game.ts`, `LevelView.ts`, `FighterView.ts`, `GameRenderer.ts`, `LevelTypes.ts`, `levels.ts`, `districts.ts`, `interiors.ts`, `Progress.ts`, `themes.ts`, `hub.ts`, `styles.css`, `weaponMesh.ts`.

**Limits.**

- Driving is a free cab ride, not a drivable car.
- Furniture is procedural, built from primitives.
- The planner is keyboard, mouse or touch only; there's no gamepad support in the editor.
- Gym and garage can't be decorated.

## Stage 7 report: the basement business

A fictional passive-income business in the basement of 14 Tanner Road. Production is abstract throughout: capacity, light, air, cycles and units of stock. Nothing real-world is modelled.

**The basement.** Reached by the stairs in the garage (moved there in Stage 8; it was a cellar door by the front door). Stairs come down the left wall, the business terminal is on a desk by the stairs, and the room has brick walls, joists, copper pipes, a cable tray and a fuse board. It starts dirty: damp brick, two bare bulbs and junk taking up the far end. Basement works (from Green Fingers or the terminal) change the actual room:

- **Tiers.**
  - Renovated: junk cleared, sealed floor, strip lights.
  - Expanded: 22 m.
  - Professional: 30 m, with branding and an office desk.
- **Improvements.** Epoxy floor, painted walls, tiled walls, LED lighting, ducting, a reinforced steel door, an electrical upgrade, a three-phase supply and an office lounge.

**Green Fingers Hydroponics.** The grow shop is on the Brackley Trading Estate, next to the carpet unit; Dave's Cabs also goes there.

- **The shop.** Shopfront, lit fascia and totem sign, shelves, demo kit on plinths and Kez at the till.
- **Product displays.** Each one opens its own section.
- **What's on sale.** 21 products in room, environmental and security categories, plus business upgrades and basement works. Each has a price, description, starter/intermediate/professional tier and an ownership count.
- **Buying.** You see what one more would do to your numbers and the £ per point. Buying several takes two clicks to confirm, and there's a not-enough-money warning. You can sell back from storage at half price.
- Everything is delivered to basement storage.

**Placing equipment.** At the terminal, open Equipment → Install/Move. This uses the same editor as the house furniture: a green/red preview, arrows/WASD, Q/E to turn, Enter, Esc, Store and Sell, with on-screen buttons for touch.

- Kit can't overlap other kit, the walls, the stairs, the terminal, the walkway or the junk.
- Installed kit has collision and stays where you put it.

**How income is worked out** (`src/business/production.ts`):

- **Capacity.** Capacity = grow units, limited by light and air (whichever is lowest), then +10% per capacity upgrade.
- **Output per cycle.** Units per cycle = capacity × efficiency (coolers, climate unit, sensors, workbench, upgrades and improvements).
- **Cycle length.** A cycle is 8 minutes of play, 12% shorter per automation point (control panels and upgrades, maximum 4).
- **Stock.** Stock fills to the storage limit (shelving, cabinets, racks, safe, upgrades), then production stops until you sell.
- **Selling.** Each unit sells for £10, +4% per business level (5 levels by units sold).
- **Running costs.** Every installed piece has an hourly cost. Costs are paid from the business's takings; if more than £300 is owed, the power is cut until you pay.
- **Power.** Kit draws power; you need the electrical upgrade or three-phase supply to run more than 4 kW.
- **Starting and collecting.** Starting costs £200. Sell stock into the business balance, then take it into your pocket or the tin.
- **Rough numbers.** A starter setup (about £1,000) makes about £280 per hour of play. A full professional setup makes about £11,000 per hour but fills its storage in about a minute and a half, so you have to keep coming back.

**Clock and exploits.** Production runs only on time spent in the game world (`save.playTime`). Closing the game or changing the computer's clock earns nothing, and any catch-up is capped at 15 minutes. Loading a save doesn't produce anything, and a save with a clock from the future is reset.

**Risk.** At the end of each cycle there's a chance of trouble: about 10% with no security, lowered by security and raised by your heat (wanted level).

- **Power trip:** 2 minutes of downtime and a £40 call-out.
- **Fault:** one piece of kit runs at half power until you repair it at 25% of its price.
- **Theft:** you lose 40% of stock, or 15% with locked storage.
- **Nosy neighbours:** 5 minutes of downtime.

Rolls are seeded from the save, so reloading doesn't re-roll them.

**Saving.** `save.basement` holds the tier, improvements, every piece of equipment with its position, rotation and fault state, upgrades, business state (active/paused, cycle progress, stock, balance, bills, downtime, totals, events), a purchase ledger and the event seed. Older saves load with an untouched basement. Bad data is repaired: kit that no longer fits goes back to storage and duplicates are dropped.

**Files.**

- New: `src/business/catalogue.ts`, `basement.ts`, `production.ts`, `src/ui/businessUI.ts`, `tests/stage7.test.ts`.
- Changed: `Game.ts` (editor for both spaces, business clock, terminal and shop stations), `LevelView.ts`, `propModels.ts`, `propPreview.ts`, `LevelTypes.ts`, `levels.ts`, `districts.ts`, `interiors.ts`, `Progress.ts`, `themes.ts`, `hub.ts`, `property/home.ts` (cellar door kept clear), `property/levels.ts`, `styles.css`.

## Stage 8 report: gyms, crew, workbench, pedestrians and the bike fix

**Motorbike bug (fixed at the source).** Getting on or off the bike rebuilt the whole area and put you back at the bike's position. The fight-trigger check then ran from the area's entry point to the bike, so it "crossed" every fight line in between, started a fight, and a separate rule knocked you off whenever a fight was on.

- The World now takes `at` (where you are) and starts its trigger line from there, so a rebuild can't cross anything.
- Side fights you'd cleared on this visit stay cleared when the area is rebuilt (`keepCleared`).
- Mounting and dismounting now happen in place, without a rebuild: the parked bike is added or removed as a live prop and station.
- You're only knocked off by an actual hit landing on you while riding, not just because a fight exists.
- Riding past a side fight's spot no longer starts it (side fights re-arm each visit, so riding up and down a street kept setting them off). You meet them when you walk past. Story fights still start on the bike.
- Tested by mounting and parking 12 times across two streets, and with a rebuild past every fight line in four districts (`tests/stage8.test.ts`).

**Basement stairs.** The cellar door in the living room is gone. The garage now has a stairwell cut into the floor, with steps, side walls, hazard nosing, railings and a light. Interacting at the top walks you down the steps with a fade, and you arrive walking off the basement stairs; coming up is the reverse. The opening has collision. The house is wider to fit it (the garage is now 12–22 m).

**House computer.** A desk with a PC in the living room replaces the old planner board. It has two tabs:
- *My furniture*: place, move, turn, store and sell what you own, and change floors and walls.
- *Shop online*: the Home & Hearth catalogue, delivered to storage.

**Pedestrians** (`src/world/civilians.ts`).
- Each street has its own density cap.
- They walk the pavement lanes at different speeds, browse at shop doors, stand in groups outside pubs, clubs and the casino, chat in pairs, and sit on benches.
- They step round scenery and each other.
- They spawn 11–17 m from you, off-screen, and despawn beyond 22 m.
- They're neutral and can't be hit; when a fight starts they scatter, and they go back to walking once it's over.
- Two people meeting head-on step round each other.
- They're never pulled into a locked fight zone (that was a bug found by the soak test and fixed in `Arena.clamp`).

**Companions** (`src/companions/`). Seven fighters sit in the Snug, a new back room of the Red Lion:

| Fighter | Type | How you get them |
|---|---|---|
| Shaz | street fighter | £250 |
| Danny | boxer | £450 |
| Mia | fast and agile | £650, after Gaffer |
| Leah | defensive | £700, after Sully |
| Jonno | wrestler | beat him in a challenge fight |
| Tank | heavyweight | £1,200, after Sully |
| Old Reg | experienced | £1,800, after the Ratcatcher |

- **Managing your crew.** Use the phone's Crew page to see your recruits, choose who follows you, or dismiss them.
- **Following.** The active companion follows a step behind and to one side. They go round you rather than through you (allies no longer shove each other), detour round obstacles, and catch up from off-screen if they're left far behind, so there's no constant teleporting.
- **Fighting.** In a fight they use the normal fighting AI tuned per companion. They hit for 70–85% of normal damage and have extra health. They never target pedestrians or your sparring partner.
- **After a fight.** If they're knocked out, they get back up at 40% health three seconds after the fight ends.
- **At home.** They wait outside your house and basement.

**Garage workbench** (`src/workshop/workshop.ts`).

- **Repair.** Shows the weapon's condition before and after, and costs money plus duct tape. Bottles and other smashables can't be repaired.
- **Craft.** Nine recipes (pipe to machete). Each needs its listed materials and some cash, and some come with a free upgrade. The finished weapon goes to your pockets, or to the stash if they're full.
- **Upgrade.** Four tracks, each up to three levels, with limits that differ per weapon. Each level costs more and needs rarer materials.

  | Track | Effect per level |
  |---|---|
  | Power | +12% damage |
  | Speed | quicker start-up and recovery |
  | Handling | −15% stamina cost |
  | Durability | +35% condition |

  The weapon you hold really swings the upgraded numbers. Upgrades stay on the weapon when it's dropped, picked up, stored or saved.
- **Materials.** New materials (duct tape, bolts, leather strip, steel bar, spring steel, carbon fibre) drop from bins, skips, cars and fighters. Basics can also be bought at the bench. Weapons can be salvaged for materials.

**Iron Temple Fitness** (Leisure Park, cab stop). Sells dumbbells, a barbell and bench, a treadmill, an exercise bike, a speed ball, a heavy bag and a mat, one of each. Bought kit is set up in its own spot in the home gym. You can sell it back.

**Home gym training** (`src/training/gym.ts`).

- **What each piece trains.**

  | Kit | Trains |
  |---|---|
  | Bag, dumbbells, barbell | Strength |
  | Treadmill | Roadwork (stamina) |
  | Bike | Conditioning (health) |
  | Speed ball | Technique |
  | Mat (skipping) | Agility |
  | Sparring with Mo | Defence |

- **How a session works.** Each session is 10 reps on a timing bar, and you're animated on the kit (running, cycling, curling, pressing, hitting the bag). Perfect, good and missed reps earn full, part and no XP.
- **Fatigue.** Each session adds fatigue. Tired sessions earn less, and at 85 you have to rest: play time, a brew, a meal or the sofa brings it down.
- **Ranks.** Each rank needs 32% more XP than the last, and the top rank is 10. Ranks 6–10 count half towards your stats.
- **Training points.** These are no longer spent on the attributes above; they go on moves and fighting styles.

**Sparring.** Mo is on the mat and isn't an enemy. You start a spar at the mat, and he becomes a soft, low-damage opponent. It ends when either of you is nearly out, when you walk away, or when you press the mat again. Both of you are patched up afterwards, and it trains Defence.

**Fighting gyms** (`src/training/styleGyms.ts`). Each gym has a coach and a drill spot:

| Gym | Where | Styles |
|---|---|---|
| Del's Boxing Club | Tanner Road Estate | boxing, kickboxing |
| Okafor Karate & Muay Thai | Leisure Park | karate, Muay Thai |
| Kev's Wrestling | Precinct | wrestling, BJJ |

- **Ranks.** Styles have ranks 1–5. Rank 1 is the lesson fee. Higher ranks need drill XP, training points and cash, and some styles are locked behind story bosses.
- **Drills.** You repeat real combo strings from that style's own move graph, pressing the buttons in time.
- **What ranks unlock in combat.**
  - Rank 2: the style's specials.
  - Rank 3: three-hit strings and beyond, clinch power moves and submissions.
- **Cross-training.** Every style at rank 3 gives +1 Technique, up to +4.
- These limits only apply to you; enemies and Street style are never locked.

**Saving.** New save fields `gym`, `styleTraining` and `companions` are added; weapon stacks gain `mods` and `crafted`. All of them are sanitised. Older saves keep their trained ranks, get the old bag and dumbbells in the gym, and any style learned before keeps its specials (rank 2).

**Tests.** `tests/stage8.test.ts` has 27 tests. Full `npm test` (all eight suites) passed in this build.

**Files.**

- New:
  - `src/training/gym.ts`, `src/training/styleGyms.ts`
  - `src/companions/companions.ts`, `src/companions/brain.ts`
  - `src/world/civilians.ts`
  - `src/workshop/workshop.ts`, `src/combat/weaponMods.ts`
  - `src/ui/gymUI.ts`, `src/ui/workshopUI.ts`, `src/ui/companionUI.ts`
  - `tests/stage8.test.ts`
- Changed:
  - Core: `Game.ts`, `World.ts`, `Arena.ts`, `Simulation.ts`
  - Fighting: `Fighter.ts`, `Grapple.ts`
  - Progress and items: `Progress.ts`, `catalogue.ts`, `Inventory.ts`, `items.ts`, `loot.ts`
  - Levels: `levels.ts`, `districts.ts`, `interiors.ts`, `LevelTypes.ts`, `property/home.ts`, `property/levels.ts`
  - Rendering: `LevelView.ts`, `GameRenderer.ts`, `FighterView.ts`, `propModels.ts`, `themes.ts`
  - UI: `propertyUI.ts`, `hub.ts`, `styles.css`
  - Tests and docs: `tests/assetRegister.ts`, the area counts in the stage 5 and 7 tests

**Not done or limited.**
- All new models are procedural, not GLB.
- The placement editor has no gamepad support.
- Companions don't come into the house.
- The training and drill minigames use keyboard or tap only.
- The `stage3` "defender never landed a hit" soak test is unseeded and fails roughly one run in five; that's unrelated to these changes.

## Stage 9 report: town map, travel, inventory and UI clean-up

**Town map** (`src/map/worldMap.ts` for the data, `src/ui/mapUI.ts` for the screen). Open it with **M**, with **Tab** when no fight is on, with the map button on the HUD, from the pause menu, or from the phone.

- **What it shows.** A drawn town: district shading, main roads with centre lines, side streets, blocks, roundabouts at junctions, the canal, the River Brack, parks and the Kirkgate pitch. Every one of the 34 areas is on it.
  - Streets are drawn as roads, because each street is a side-scroller from its left end to its right end.
  - Shops, gyms and the pub sit next to their own front door on the street.
  - Your position is placed along the street by how far along it you are.
- **Markers.** There's an icon for:
  - places: home (safehouse), shops, clothes shop, pawn shop, fighting gyms, the pub, the casino, the car and bike dealers;
  - your things: your basement business and where you left your bike;
  - people: the Snug's fighters for hire;
  - the story: the main mission, side bosses and bosses you've beaten.

  Hovering shows a tooltip; clicking opens a card. Filters hide or show each group.
- **The card.** It shows:
  - the name and type of place;
  - "You are here", "Locked" or "Not visited yet";
  - a description;
  - things to do, worked out from the place's real stations, side fights, hidden stashes, search spots and boss;
  - the people there;
  - the lock reason, if it's locked;
  - the travel options.
- **Locks.** These come from the game's own exits, by searching from home through the open links. The reason shown is the first lock on the easiest way there, for example "Beat Gaz Mullins (The Gaffer) first" or "Needs the stadium service key".
- **Travel.** Nothing happens until you confirm.
  - **Take a cab.** Dave's Cabs, £5 from the tin. Cabs only go to the stops the phone already served, and not while a fight's on, with the police after you, to a locked place, or to a shop that's shut after a robbery.
  - **Head home.** Free, as before.
  - **Set as destination.** Draws your route on the map, and the HUD then shows which way to go, which exit and how far. The route clears when you arrive.
  - Getting into a cab while riding parks the bike where you are.
- **Controls.** Drag to pan, scroll or pinch to zoom, the + and − buttons, and "centre on me" (C). The arrow keys and WASD pan; `[` and `]` step through places; Esc backs out. The districts list in the side panel jumps to each district. The layout works at desktop, landscape phone and portrait phone sizes.

**Replacing the location menu.** The phone's long list of cab destinations is gone; the phone now has Mo's message, "Dave's Cabs → Open map" and your crew. The stop data (`TAXI_STOPS`, `SHOP_STOPS`) is unchanged and is what the map uses. The street-by-street "X is on this street" toasts are replaced by a single line the first time you visit a street.

**Inventory.**

- **Tabs.** All, Weapons, Clothing, Equipment (bags), Consumables, Materials (workbench), Valuables and Other.
  - These group the existing item categories; the item data is unchanged.
  - Empty tabs are hidden.
  - All the weapons are melee, so there's no separate "melee" tab.
- **Item cards.** Each card shows the picture, name, the key fact, quantity, condition and rarity colour.
  - Equipped items appear in the list with a "Holding" or "Worn" tag.
  - Double-click a card to use, hold, wear, take off or put away.
  - The detail panel puts the main action first, then the stash, drop (with a confirm step) and compare.
- **Selling.** Valuables have a "Where to sell it" button that opens the map at Pawn & Gold. Selling still happens at the pawn shop.
- **Keys.** **I** opens the inventory when no fight is on; **B** still works anywhere.

**HUD.**

- **Always shown:** your health and stamina, level, cash on you, the objective, and the route line when you have a destination.
- **Only when needed:**
  - the opponent bar and "VS", when you have a target;
  - your style, when you're in a fight;
  - pockets, when they're nearly full;
  - the weapon chip with its condition, when you're holding a weapon.
- **Buttons:** Map, Inventory and Pause, top right.
- There's no ammo display because there are no guns.

**Menus and design.**

- **Icon set.** One set of icons, drawn for this game in `src/ui/icons.ts`, used on the map markers, menu buttons, inventory tabs and HUD buttons.
- **Shared styles.** Buttons, close buttons, chips, cards and panels share one look: rounded panels, a fade-in, consistent hover, pressed and selected states, and a primary style.
- **Main and pause menus** have icons and key hints; the pause menu has Map and Inventory.
- **Every panel screen** (shops, gym, workshop, crew, business, property) has a close button in its header as well as Back.
- **Controls screen** is updated with the new keys.

**Keys.**

| Key | What it does |
|---|---|
| M | Map |
| Tab | Map outside a fight; swaps style in a fight |
| I | Inventory outside a fight; heavy punch in a fight |
| B | Inventory |
| Esc | Closes the current menu, or pauses |

Opening a menu pauses the game and clears any queued input, so you can't move or attack while a menu is open. Opening the map from another menu replaces that menu, so menus never stack.

**Bugs fixed.** The screen-fade layer (there since Stage 4) was catching every mouse click and tap on menus while invisible, so only the keyboard worked. Mouse clicks now work on all menus.

**Saving.** Two new save fields: `visited` (places you've been) and `destination`. Older saves get home, the estate, where they were, and every district whose boss they've beaten.

**Tests.** `tests/stage9.test.ts` has 9 tests:

- every area is on the map and inside it;
- streets meet where their exits join;
- markers point at real areas;
- locks match the level links and give a reason;
- routes follow real exits;
- cab rules;
- save fields and migration;
- every item has a tab;
- key bindings.

The full `npm test` (nine suites) passed.

**Files.**

- New: `src/map/worldMap.ts`, `src/ui/mapUI.ts`, `src/ui/icons.ts`, `tests/stage9.test.ts`.
- Changed: `Game.ts`, `InputManager.ts`, `Progress.ts`, `Hud.ts`, `inventoryUI.ts`, `hub.ts`, `controls.ts`, `screens.ts`, `styles.css`, `package.json`.

**Still needs attention.**

- The map is stylised, not drawn to real-world scale.
- Older saves don't know which shops you'd already been in, so they show as "Not visited yet" until you go in again.
- A gamepad can step through places with the D-pad but can't pan the map.
- The shop, stash and pawn screens share the new styles but keep their tile grids rather than the inventory's cards.

## Stage 10 report: Character & Crew, injuries and condition

**One screen, two tabs.** Open it with **H**, the person button on the HUD, the pause menu ("Character & crew"), or the phone ("Your crew"). Esc or H closes it. Everything on it is read from the real game state; nothing is a placeholder.

**Character tab**

- **Left: you.**
  - A live 3D portrait using the game's own character model, in your guard, holding your weapon.
  - Name, level, background, an overall condition badge, and live health and stamina.
- **Centre: your numbers.**
  - **Progress.** Level, XP to the next level, total XP, training points, money on you and in the tin, and your fighting styles with their ranks.
  - **Physical.** The six real attributes: Strength, Endurance, Agility, Speed, Defence and Technique. Each shows its current value, how much gear, training or injuries change it, and what it does.
  - **Fitness.** Your home-gym training ranks.
  - **In a fight.** Damage multiplier, clean-hit chance (the game's ×1.3 "crit"), share of damage taken, attack and move speed, stamina recovery per second, poise, and your record (KOs, bosses, times beaten).
- **Right: condition and kit.**
  - Health, stamina, training fatigue, and each injury with its severity, effect, a recovery bar and time left.
  - The weapon in your hands (damage and hits left), everything you're wearing with its bonuses, and your pockets and stash.
- **Left out:** accuracy and per-weapon proficiency, because the game doesn't have them.

**Injuries** (`src/condition/condition.ts`)

- **How damage is counted.** During a fight, damage you take is counted by where it lands: high hits on the head, mid on the body, low on the legs. Heavy blows you block land on the arms, and clean hits also add bruising.
- **When it turns into an injury.** When the fight ends (or you go down), any part that took 30% or more of your max health is injured; 65% or more is a level worse. A knockout adds a level to the worst-hit part. Sparring with Mo never injures you.
- **Levels.** Minor, Serious or Severe. Each level's effect goes through the normal stat modifiers, so it really changes your fighter:

  | Injury | Effect (minor / serious / severe) |
  |---|---|
  | Head | Hits hurt 5 / 10 / 18% more |
  | Arm | 7 / 14 / 22% less damage and slightly slower swings |
  | Leg | 7 / 14 / 22% slower |
  | Body | −10 / −20 / −35 max stamina and slower stamina recovery |
  | Bruising | −8 / −16 / −25 max health |

- **Exhaustion.** Training fatigue of 50 or more slows stamina recovery by 15%; 75 or more slows it by 30%.
- **Overall condition.** Excellent, Good, Tired, Injured, Badly injured or Critical, each with a colour and a line of text.
- **Recovery.**
  - Each level heals with play time (3, 5 or 7 minutes) and three times as fast at home.
  - The sofa takes a level off every injury, yours and your crew's.
  - A first aid kit takes a level off your worst injury.
  - Plasters or a meal clear bruising.
  - You get a toast when you're hurt and when you heal.

**Crew tab**

- **Active crew panel.** Shows who's following you (1 of 1 slots) with their health, stamina, condition, weapon and whether they're ready.
- **Crew list.** A card for everyone you've hired, with a portrait, level, role, a health bar and a clear status: Following you, Available, Injured or Recovering.
- **Profile.**
  - A live 3D portrait, role and style, condition, their line, and a 0–100 fight rating. The rating is worked out from their attributes, damage share, level, health, injuries and weapon.
  - Level and XP, fights and KOs, attributes, damage, clean-hit chance, damage taken, and what they're good and bad at.
  - Health, stamina, whether they're ready to fight, injuries with recovery, and their weapon and clothes.
  - The numbers are built exactly the way the fight builds them (`src/companions/crewFighter.ts`), so they match what turns up in a fight.
- **Actions.** All of them work:
  - **Follow me / Stand down.** Swaps who's following, applied straight away (or after the fight, if one's on).
  - **Patch them up.** Uses a first aid kit from your pockets: worst injury down a level, +40% health.
  - **Give a weapon / Swap weapon / Take weapon back.** Takes a real item from your pockets. They hold it in fights, its wear is saved, and they keep hold of it if they're knocked down.
  - **Let them go.** Asks you to confirm; their weapon comes back to you.

**Companion state** (saved per companion)

- **Level.** XP from every enemy KO while they're out with you (more for their own KOs), up to level 10. Each level is +4% damage and +6 health.
- **Health** carries over between fights and areas instead of resetting to full.
- **Injuries** use the same system as yours.
- **Recovery.**
  - Anyone not out with you gets their health back resting: full in about 100 seconds of play.
  - A companion with a severe injury, or under 25% health, can't follow you; they rest at home until they're fit.
- They still get back up at 40% health three seconds after a fight, as before.

**Saving.** Two new save fields: `condition` (your injuries) and `companions.state` (each companion's level, XP, health, injuries, weapon, fights and KOs). Older saves load with no injuries and everyone fit at level 1. Weapons held by the crew are checked like every other item stack.

**Tests.** `tests/stage10.test.ts` has 12 tests, covering:

- hit counting and the injury thresholds;
- injury effects on real stats;
- healing over time, at home, and with first aid and plasters;
- the condition levels;
- a real fight leaving injuries;
- sparring never injuring you;
- crew health carried into and out of the world;
- the crew screen's numbers matching the fight;
- levelling, and XP from real KOs;
- the availability rule and recovery;
- giving and taking weapons;
- save migration.

The full `npm test` (ten suites) passed.

**Files.**

- New: `src/condition/condition.ts`, `src/companions/crewFighter.ts`, `src/ui/profileUI.ts`, `src/ui/portrait.ts`, `tests/stage10.test.ts`.
- Changed: `src/companions/companions.ts`, `src/world/World.ts`, `src/progress/Progress.ts`, `src/Game.ts`, `src/input/InputManager.ts`, `src/ui/Hud.ts`, `src/ui/hub.ts`, `src/ui/screens.ts`, `src/ui/styles.css`, `package.json`.

**Limits.**

- Only one companion follows at a time (that's the game's existing rule; the panel shows the slot).
- Companions wear their own fixed clothes, and there's no armour in the game.
- Your health still refills when you change area, as it always has. Injuries are the lasting damage.

## Stage 11 report: crew personalities, fighting styles and home life

**Ten companions.** Seven from before, plus three new ones in the Snug:

| Companion | Personality | Fighting style |
|---|---|---|
| Shaz | Joker | MMA |
| Danny | Hothead | Fast combinations (boxing) |
| Mia | Fast fighter | Kickboxing |
| Leah | Quiet professional | Defensive counter-fighting (karate) |
| Jonno | Loyal friend | Wrestling |
| Tank | Heavy hitter | Heavy boxing |
| Old Reg | Calm veteran | Technical boxing |
| Kay (new, £900, after the Gaffer) | Aggressive fighter | Muay Thai |
| Paddy (new, £550) | Street brawler | Street fighting |
| Bats (new, £1,000, after the Gaffer) | Weapons specialist | Weapons |

The Snug is now wider to fit everyone.

**Personalities** (`src/companions/personality.ts`) change what companions actually do:

- **Following.** How far behind you they walk.
- **Joining a fight.** How far away an enemy can be before they go in (6.5–11 m; more when told to get ready, less when told to wait).
- **Who they go for.**
  - The nearest enemy (default).
  - Whoever's on you (loyal friend, veteran).
  - The weakest enemy (professional, fast fighter).
- **Backing off.** Some step back behind you, guard up, when badly hurt: the veteran under 30%, the professional, fast fighter and weapons specialist under 25%, the joker under 20%.
- **Helping crew mates.** Loyal friends and veterans go after whoever is on a crew mate who's down or under 30%.
- **Talk.** Each personality has its own lines, and some talk more than others: fight starts, taunts, wins, being hurt, a crew mate down, jokes and stories at home, and reactions to each other.
- **Home.** Each personality has its own favourite things to do at home.

**Fighting styles** change how they fight:

- **Move set.** They use a real game style: boxing, kickboxing, Muay Thai, karate, wrestling, BJJ or street.
- **Stats.** Attack speed, damage, move speed, damage taken and poise (stagger resistance), all through stat modifiers.
- **Button habits.** Starters and combo follow-ups are chosen in the AI itself:
  - heavy boxers throw mostly heavy shots;
  - boxers never kick;
  - kickboxers kick;
  - wrestlers and grapplers grab a lot.
- **Counters.** Counter-fighters hit straight back after a block or parry.
- **Weapons.**
  - The weapons specialist does 35% more damage with bats, bars and pipes and 18% less with his fists.
  - He picks weapons up off the floor, even mid-fight if nobody's right on him, and keeps them.

Every style except MMA has a real upside and a real downside, so nobody is better at everything.

**Measured in real fights** (`tests/stage11.test.ts`):

- Tank's heavy share was clearly higher than Mia's, and Tank never kicked.
- Mia kicked in more than a quarter of her attacks.
- Jonno grabbed more than Tank.
- Bats picked up a metal bar mid-fight.
- The loyal friend went for whoever was on you more than 85% of the time.

**Crew of two.** One companion follows you at first; two once Sully Kane is beaten.

- **Saving.** The follow list is saved as `companions.following`. An old save's single companion becomes the first follower.
- **Positions.** Followers spread out behind you and keep apart from each other (crew members now push apart, but never push you).
- **Orders.** From the Crew tab, or **G** to cycle through everyone with you:
  - **Follow me.**
  - **Relax at home.** They stay home until you call them.
  - **Wait here.**
  - **Get ready.** Closer to you, and they join a fight sooner.
  - **At home:** "Come with me" (follow you round the house) and "Make yourself at home".

**Home life** (`src/companions/home.ts`)

- **Who's there.**
  - Everyone you've hired lives at your house.
  - Those who were out with you come in through the front door a step behind you and walk into the house.
  - The rest are already inside, relaxing.
- **Seats.** Seats come from the furniture you've actually placed. Each piece has seat points: three on a 3-seater, two on a 2-seater, one on an armchair or dining chair, and two stools at the kitchen island. They're placed using the piece's size and rotation.
  - Seats are claimed so no two people share one.
  - A seat is skipped if its front is boxed in.
  - Seats near a telly get a "watching TV" lean.
- **Standing spots.** Kitchen counter, cooker, fridge, windows, a living-room corner, the gym floor (stretching), and places to stand on the phone.
- **Getting about.** Companions walk along the hallway that runs past every room's doorway, so they never cut through walls or furniture. If someone's in the way, they skip ahead or re-route.
- **Sitting down.** They walk to the front of the seat, turn, and lower onto it over half a second while the pose blends from standing to sitting. While seated they're held in place (not pushed or clamped). Standing up is the reverse.
- **What they do.**
  - Seated: sitting, leaning back, on the phone, arms folded, turning to talk.
  - Standing: leaning on the counter, having a drink, looking about, arms folded, stretching, on the phone, talking, laughing.
  - They pick by personality and change every so often.
- **Conversations.** Every so often the chattiest free companion starts one with someone nearby. The joker tells a joke; others tell a story or chat. The listener reacts by personality:
  - veterans, professionals and the weapons specialist ignore it;
  - aggressive types and hotheads get annoyed (the joker laughs at that);
  - loyal friends, fast fighters and brawlers join in;
  - the rest laugh.

  Lines show as speech bubbles over their heads, rate-limited so they don't repeat or talk over each other.
- **Going out.** Walk back to the front door and your followers get up and come with you. Anyone you told to relax at home stays sat down.
- **Recovery.**
  - Health and fatigue come back fastest sat on a sofa at home, more slowly standing at home, and slowly out with you.
  - Fights add fatigue: 12 plus up to 18 more for damage taken. Fatigue of 50 or more slows a companion's stamina.
  - The sofa rest takes 50 off everyone's fatigue.
  - Injuries heal three times as fast at home.
  - The Crew tab shows fatigue, recovery and readiness.

**Crew screen.**

- **Personality:** type, description, and how they behave in a fight.
- **Fighting style:** the moves it uses, a description, attack speed, damage, weapon skill, move speed, damage taken and clean-hit chance, plus strengths and weaknesses.
- **Level and stats.**
- **Status:** following you, at home, injured, tired or recovering.
- **Active crew panel:** 1 or 2 of 2 places, depending on whether Sully Kane is beaten.
- **Orders:** as listed above.

**Animations.**

- **Reused:** the existing character rig, walk cycle, guard, combat moves and the bench 'sit' pose.
- **Added:** seated variants (leaning back, on the phone, talking, arms folded) and standing ones (phone, arms folded, looking around, stretching, laughing, drinking, leaning).
- **Blending and turning:** all of them blend through the existing pose blending. A render-only facing direction lets seated characters face out of the furniture, turning the short way round.

**Saving.**

- `companions.following` replaces the old `companions.active`.
- Each companion's state gains `fatigue`.
- Personality and style come from who the companion is, so they don't need saving.
- Sitting and other moment-to-moment states are not saved.
- Older saves load fine.

**Bugs fixed along the way.**

- Crew members could stand inside each other (they now push apart).
- A Stage 8 test checked the enemies' total health, which new waves arriving with full health could push back up; it now checks damage the companion actually dealt.

**Tests.** `tests/stage11.test.ts` has 18 tests. The full `npm test` (eleven suites) passed.

**Files.**

- New: `src/companions/personality.ts`, `src/companions/home.ts`, `tests/stage11.test.ts`.
- Changed: `src/companions/brain.ts` (rewritten), `src/companions/companions.ts`, `src/companions/crewFighter.ts`, `src/ai/FighterAI.ts`, `src/ai/archetypes.ts`, `src/world/World.ts`, `src/world/interiors.ts`, `src/core/Simulation.ts`, `src/fighter/Fighter.ts`, `src/render/FighterView.ts`, `src/render/GameRenderer.ts`, `src/ui/Hud.ts`, `src/ui/profileUI.ts`, `src/ui/companionUI.ts`, `src/ui/hub.ts`, `src/Game.ts`, `src/input/InputManager.ts`, `src/ui/styles.css`, `tests/stage8.test.ts`.

**Limits.**

- Poses are procedural on the shared rig; there are no motion-captured animations.
- No phone or cup props are held in hand.
- Companions don't go upstairs to the basement.
- Seats come only from sofas, armchairs, dining chairs and the island. With no free seat, a companion stands somewhere sensible instead.
- Up to two followers.

## Characters: Quaternius Universal Base Characters (CC0)

- **Source.** Fighters use the male and female models from Quaternius' **Universal Base Characters** (Standard, CC0, public domain). The originals and their licence are in [`assets/quaternius-ubc`](assets/quaternius-ubc/README.md).
- **Conversion.** They were converted in Blender for the game's 11-joint skeleton, so every existing move, finisher and pose drives them unchanged. The game loads them from `public/models/character_male.glb` and `character_female.glb`, about 4 MB each.
- **The models.** Real anatomy, faces, eyes, eyebrows and fists. Skin tone and hair colour are tints on the pack's own textures.
- **Hairstyles.** The pack's 6 hairstyles stand in for the game's 12 (closest match), and males can have its beard.
- **Clothing.** Skinned garments cut from each body follow the muscle and weight sliders:
  - tops: long-sleeve, t-shirt, vest and puffer;
  - extras: hood, collar and coat skirt;
  - bottoms: trousers and shorts;
  - shoes.
- **Headwear.** Hats, sunglasses, snood, mouthguard, headguard, earring and chain are the game's own pieces, lined up on the new heads.
- **Not carried over.** The creator's detailed face sliders (jaw, nose, eye spacing and so on), tattoos, and scars apply only to the classic rig.
- **Fallback.** Add `?classic` to the URL to use the old procedural fighters. They are also used automatically if a model fails to load.

## Stage 12 report: the interactive house — cooking, eating, washing, sleeping

**Needs** (`src/home/needs.ts`, saved as `needs`): hunger, energy, hygiene, teeth, bladder and diet, each 0–100.

- They change with play time: slower at home, faster in a fight (hygiene and energy), and not at all while you sleep. Full to empty hunger takes about 45 minutes out.
- Hygiene levels follow the brief: Excellent 90+, Good 70–89, Average 40–69, Poor 20–39, Very poor 0–19.
- **Effects are mild:**
  - Hungry or tired: stamina comes back a bit slower.
  - Starving: also −10 max stamina.
  - A poor diet over time: −5% stamina recovery.
  - Eating well: +8 max stamina.
  - Hygiene, teeth and the loo never affect fighting.
- **HUD:** only needs that want attention show, as small chips by the status strip (hidden in fights), with a one-off nudge when one becomes urgent.
- **Character screen:** a Needs & lifestyle section shows bars and labels ("Hungry", "Needs a shower", "Comfortable").

**Groceries.**

- Real ingredient items live in the fridge or the cupboards (saved as `pantry`).
- New games and older saves come stocked.
- From the fridge or cupboard screen you can take things out, put shopping away from your pockets, or order a delivery (a £25 weekly shop or single items).
- Snacks (crisps, chocolate, an apple, biscuits) live in the cupboard.

**Recipes** (`src/home/recipes.ts`), 16 in all:

- **Quick:** sandwich, toast, cereal, beans on toast, scrambled eggs.
- **Cooked:** full English, sausage and mash, chicken and chips, steak and potatoes, pasta bake, burgers, curry.
- **Snacks:** crisps, chocolate, fruit, biscuits.

Each has ingredients, prep and cook time, servings, hunger filled, energy, health, diet quality and star quality, and makes a meal item with its own icon.

**Cooking** is acted out in the house. Choosing a recipe at the worktop or cooker starts the sequence:

1. Walk to the fridge: the door swings open, the light comes on, and you take things out.
2. Then the cupboards, the same way.
3. The worktop: chopping on a board, with knife sounds.
4. The hob (stirring a pan, steam, a sizzle) or the oven (crouch, wait while it glows, take it out).
5. Plate up.

Ingredients are taken when prep starts. Stopping during prep puts them back. Stopping while it's on the heat ruins it. Extra servings go into the fridge as leftovers. Then you walk to a seat (the dining table first, otherwise the sofa), sit, eat (with a plate in front of you), and have a drink. A home-cooked full English gives the old +25 max-health bonus.

**The crew at meals.** Companions at home come and sit down to eat while there are servings in the fridge. Each serving they eat lowers their fatigue and restores some health.

**Bathroom.**

- **Shower:** you step into the bath, the curtain is drawn, and water, steam and sound play while hygiene rises to Excellent over ten seconds. You stay clothed, behind the curtain.
- **Sinks:** wash hands (also at the kitchen sink), wash face, and brush teeth. Each has its own animation, and the tap runs where it should.
- **Toilet:** sit down clothed, the bladder empties, then flush. It can be stopped part way, and it won't let you go when you don't need to.
- **Mirror cabinet (if placed):** freshen up.

**Rest.**

- **Bed:** choose sleep or a lie down. You sit on the edge, lie back, the screen dims with "Zzz…", then you get up.
  - Sleep: full energy, training fatigue gone, injuries down a level, crew rested.
  - Sleep doesn't move the story clock.
  - A lie down gives +35 energy.
- **TV:** sit on the sofa facing it; energy and fatigue slowly improve.

**Prompts.** These read like "FRIDGE  E  Open fridge" and "SHOWER  E  Take shower". There's one list at most, never nested menus.

**Stopping and safety.**

- Every activity can be stopped with Esc, by moving, or by pressing E.
- You ease back out of where you were (bath, bed, chair) onto open floor, and the effects and sounds stop.
- Leaving the house or opening a menu stops it cleanly.
- If the way is blocked for too long, a safety net moves you, so nobody ends up stuck. A test checks it's never needed on the normal routes.
- While pinned in place, the character isn't pushed or pulled by gravity, so there's no floating or sinking.

**Animations** (new: `src/render/activityPoses.ts`): reach into the fridge, crouch at a cupboard or oven, chop, stir, carry a plate, wait, eat sitting, drink sitting, shower, wash hands, wash face, brush teeth, sit on the bed edge, and lie in bed. They blend through the existing pose system. **Effects** are in `src/render/HouseFX.ts` and **sounds** in `AudioManager.loop` and `house`: water, sizzle, oven hum, fridge, cupboard, chopping, cutlery, eating, flush, tap, brushing.

**Companions.**

- They never use standing spots at the hob, fridge, sinks, toilet, shower or bed. The kitchen standing spots moved out of the way.
- Seats boxed in by a coffee table are now reached from the side, which gives more usable sofa seats.
- Someone who can't reach a seat gives up and picks something else.
- Fixed a Stage 11 bug where a companion re-choosing their own seat could let someone else sit on them.

**Tests.** `tests/stage12.test.ts` has 25 tests covering needs, recipes, saves, every activity, stopping, crew and reachability. The full `npm test` (12 suites, 255 tests) passed.

## Stage 13 report: animation, movement and combat overhaul

**What the engine is.** Characters are an 11-joint skeleton (now 13 with ankles) posed in code; there are no motion-capture clips. This stage replaced how those poses are produced.

**The animator** (`src/render/anim/animator.ts`, `skeleton.ts`; pure maths, no Three.js):

- **Feet.** Each foot is locked to the floor where it stands and only moves by taking a step. Walking, backing off, sidestepping, lunging and being knocked back never slide a planted foot. Hips sink if a leg can't reach; the trailing heel lifts.
- **Ankles.** Both rigs gained a foot joint. The skinned models had none (feet were part of the shin), so foot bones are added and the foot's skin re-weighted when the model loads (`characterModels.ts`). Soles sit flat; toes never dig into the floor.
- **Strikes on target.** The striking hand or foot is aimed with two-bone IK at the opponent's surface, so it lands on them and stops there.
- **Attack timing.** Wind-up, acceleration into the first active frame, follow-through of hips and shoulders, then recovery. Rear-hand punches pivot the rear foot and move the weight forward; kicks stand on one planted leg with the hips over it.
- **Blending.** Changing state carries the difference from the old pose and fades it out, so nothing snaps.
- **Hit reactions.** Springs driven by where, how hard and from which side the hit landed: the head snaps back from a jab, the body folds over a body shot, the leg buckles under a low kick; blocked shots drive the gloves back. Stun sways and recovers into the stance instead of freezing. Neck and arm angles are limited.
- **Falling and getting up.** Knees go, arms come out, land, settle; then sit up, crouch, stand. Hit from behind falls face down. KO lies limp.
- **Stances.** Seven style stances rewritten, each with its own foot placement. Fighters carry them differently: novices drop their hands and lift their chin, big builds hold their arms wider, tired fighters sag.
- **Relaxed or fighting.** With no opponent near, characters stand and walk relaxed with swinging arms and turn to face the way they walk. The guard comes up when a fight is on.
- **Guard.** High guard for head shots, low guard for body and leg attacks.

**Combat.**

- Counter hits: catching someone mid-swing does 20% more damage and 4 more frames of stun.
- Combo scaling: from the third hit of a combo each hit does 10% less, never below half.
- Movement has weight: about 6 frames to reach walking speed, 5 to stop.
- Unchanged: four attack buttons plus special, combo strings, cancel windows, hitstun, blockstun, parry ripostes, hitstop, the anti-spam penalty. There is no separate medium attack button.

**Enemy behaviour** (`FighterAI.ts`): trained fighters step out after an exchange, pull back from slow attacks to make them miss, punish whiffs, and change tactics when blocked repeatedly. Novices sometimes swing from too far. Fighters hit a lot cover up more. Waiting enemies prowl. Hesitating no longer costs a full wait, so low-aggression enemies attack somewhat more often.

**Tests.** `tests/stage13.test.ts` (24 tests) runs real fights and measures the skeleton every frame: feet on the floor, zero slide on planted feet, legs within reach, joints bending the right way, no jumps between frames, strikes within range of their target, reactions differing by hit, falls and get-ups, stance differences, counter hits, scaling, AI behaviour, and cost (16 fighters well under a millisecond a frame). Dev tools `tools/sheet_sim.ts` and `tools/posesheet.py` draw stick-figure sheets of any move from the real pipeline.

**Not done.** No wrist or neck joints. No medium attack tier or launchers. Kick heights and hook arcs were checked on stick-figure sheets and by measurement, with only one screenshot of the real model (stances).

## Phase 1 report: foundations (CI, visual regression, asset pipeline)

No change to how the game looks or plays. This phase adds the safety net the later visual work needs.

### Continuous integration

`.github/workflows/ci.yml` runs on every push to `dev` or `main` and on pull requests:

1. **Type check, tests, build**: `tsc --noEmit`, all 17 test suites (`npm test`), then `vite build`.
2. **Visual regression**: draws ten fixed scenes in headless Chrome and compares each with its stored picture.

### Visual regression

- `?shot=<scene>` builds one scripted scene on a fixed clock with fixed random numbers and a blank in-memory save, so it can never read or change a real save. Scenes: `menu`, `stance`, `jab`, `cross`, `kick`, `blocked`, `spar`, `group`, `home`, `estate` (`src/debug/shots.ts`, names in `src/debug/shotList.ts`).
- `Game.advance(n)` runs exactly `n` frames at 60 a second; only the last two are drawn, so a scene takes a few seconds even with software WebGL.
- `tools/visual/` holds the Playwright config and spec. Baselines live in `tools/visual/baseline/` and are recorded by CI (pictures depend on the machine that draws them). A scene fails if more than 0.2% of its pixels differ.
- To accept an intended visual change: run the CI workflow by hand with **update_baselines** ticked. CI records the new pictures, checks they reproduce on a second load, and commits them.
- Locally: `npm i --no-save @playwright/test && npx playwright install chromium`, then `npm run build && npm run visual`.

### Asset pipeline

- `src/assets/manifest.ts` lists every external file with its size, group, source and built-in fallback.
- `src/assets/AssetStore.ts` loads them. Loading never throws and never hangs: each asset ends `ready`, `failed`, `timeout` or `off`, and anything not `ready` uses the built-in version.
- Switches: `?assets=builtin` (or the older `?classic`) uses built-in versions of everything; `?assets=-character_male` turns one asset off.
- A loading screen with a real progress bar shows from the first paint until the game starts.
- `tests/assets.test.ts` (11 tests) covers all of the above and checks the manifest against the files in `public/`.

### Not done in this phase

- Model and texture compression (Draco/Meshopt, KTX2): needs `gltf-transform`, to be added as a CI build step when the first new assets arrive in phase 2.
- No `package-lock.json` yet, so CI installs the newest versions allowed by `package.json`.

## Phase 2 report: art direction on a zero budget

No money is available, so the look comes from lighting, colour and post-processing rather than generated or bought art. **The default game is unchanged**; every look is behind `?look=`.

- **Three candidate looks**, each a reflection environment, bloom and colour grade: `?look=sodium` (Sodium Night), `?look=overcast` (Kitchen Sink), `?look=ink` (Back-Page Ink). Definitions in `src/render/look/looks.ts`; the renderer side in `src/render/look/PostFX.ts`.
- **Style guide and comparison frames** in `docs/art/`: `STYLE_GUIDE.md`, `looks_spar.jpg`, `looks_estate.jpg`, `looks_home.jpg`.
- Looks are off at low quality, which stays the plain picture for weak devices.
- Uses only what ships with Three.js (`EffectComposer`, `UnrealBloomPass`, `OutputPass`); no new dependency.
- Visual tests now cover each look on three scenes (19 pictures in all), and shot pages hide timed interface elements (banner, toasts) so pictures can't depend on timing. The baselines were re-recorded for that reason.
- `tests/look.test.ts` (5 tests): no look without `?look=`, and every look stays inside safe limits.

Gate: choose one look. See the style guide for what that unlocks.

### Look signed off: Sodium Night is now the default

- On by default at medium and high quality; **Settings > Display > Lighting and glow** or `?look=off` turns it off. Low quality always draws the plain picture.
- If frames stay slow at the lowest dynamic resolution, the look turns itself off for the session.
- Multisampling through the look is used at high quality only.
- The alley's puddles are now see-through like the street's, so they no longer look like black holes.
- Visual tests: all ten scenes with the look, plus three with it off. Baselines re-recorded because the default picture changed on purpose.

## Phase 3 report (part 1): the estate street pass

Zero-budget work on the vertical slice, all in code. No gameplay data changed.

- **Street pass** (`src/render/street/StreetDressing.ts`) on Tanner Road Estate: lamp pools and beams, uneven puddles, wet gutter, rain splashes, drainpipes, wall grime, weeds, litter, contact shadows. One extra draw call for the splashes; everything else is static.
- **Cars** (`src/render/street/carModel.ts`): a shaped hatchback replaces the box car in every district. A car between the camera and the player fades to 22% so the fighter is never hidden.
- **Fallback:** `?street=classic` draws streets and cars the old way.
- **Tests:** `tests/street.test.ts` (4 tests) and four new pictures along the street (`estate_terrace`, `estate_fight`, `estate_garages`, `estate_gym`) plus one of the classic street. 16 suites, 18 pictures.

Not yet done for the slice: fuller character skeletons, recorded sound and music, modelled hero props, and a frame-rate check on a real device. See `docs/art/STYLE_GUIDE.md` for what each needs.

## Character overhaul (priority zero): assessment and pedestrian rewrite

- `docs/characters/ASSESSMENT.md`: findings from the real model files, root causes, an honest statement of what is reachable, and the plan.
- **Pedestrians rewritten** (`src/world/civilians.ts`): committed passing sides, overtaking, alternative lines when blocked, staged stuck recovery, individual tempers, and reactions to fights. `tests/npc.test.ts` (7 tests) and `tools/npc_metrics.ts`.
- The character model work itself needs Blender running on the development PC; it has not started.
