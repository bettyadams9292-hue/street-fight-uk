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
