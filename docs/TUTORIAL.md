# The tutorial: coverage matrix and design

Audit of `dev` on 21 Nov 2026, for the onboarding brief. Every input below was read from the code:
- keyboard: `KEY_BINDINGS` and `InputManager.onKeyDown`;
- pad: `PAD_BUTTONS` and `pollGamepad`;
- touch: `TouchControls`.

The tutorial reads the same tables (`src/tutorial/controls.ts`), so a prompt can't drift from the bindings.

## Where a new game starts

- **New game:** Main menu → New game → the creator (`Game.openCreator('new')`) → `newSave` → `startStory(true)`.
- **The house:** you start at home, 14 Tanner Road, entry `start`, bedroom x -16. The house has a bedroom, living room, kitchen, gym and garage. Cousin Mo stands on the gym mat (`sparring` station, `World.startSpar`).
- **First fight:** the front door leads to Tanner Road Estate (`estate`). The game's first fight is there: `lads`, one thug then a hothead and a thug, with the old coach prompts (`Game.coachText`, flag `coach:done`).

## Matrix

Inputs are keyboard / pad / touch. Unless a row says "(info)" or "(hint)", the lesson completes on the event or state shown.

| Mechanic | Files | Input | State needed | Available | Lesson | Completes on | Layer |
|---|---|---|---|---|---|---|---|
| Walk left/right | `InputManager`, `Fighter` | A/D or arrows / stick or d-pad / stick | free | start | 1.1 Move | 2.5 m walked | A |
| Depth (in and out) | same | W/S / stick up/down / stick | free | start | 1.2 Step in and out | 0.8 m of z travelled | A |
| Sprint | `tapDirection` | double-tap a direction / full stick or double-tap d-pad / full stick | free | start | 1.3 Run | player running for 0.5 s | A |
| Jump | `fighter:jump` | C / L3 / JUMP | free | start | 1.4 Jump | `fighter:jump` (player) | A |
| Interact | `World.interactable`, `station` event | E / LB / USE | near a station | start (bedroom) | 1.5 Use something | any `station` event | A |
| HUD: health, stamina, level and money, needs, objective | `Hud` | none | none | start | 1.6 Your HUD (highlights each in turn) | read (Next) | A |
| Phone (cabs, maps, bank, heat, wiki) | `ui/phone/Phone.ts` | P / RS click / phone button | out of a fight | start | 1.7 Your phone | phone opened, then closed | A |
| Pause | `pauseMenu` | Esc / Start / ❚❚ | any | start | 1.8 Pause | pause opened, then resumed | A |
| Light punch, light kick | `move:started`, `hit:landed` | J, K / X, A / PUNCH, KICK | Mo in lesson mode | home gym | 2.1, 2.3 | a hit that lands on Mo | A |
| Hard punch, hard kick | same | I, L / Y, B / HARD PUNCH, HARD KICK | same | home gym | 2.2, 2.4 | a hit that lands on Mo | A |
| Combos | `HitInfo.comboHits` | chain attacks | same | home gym | 2.5 | a hit with `comboHits` ≥ 3 | A |
| Block | `hit:blocked` | hold Space / RT / BLOCK | Mo swings slowly, every few seconds | home gym | 2.6 | Mo's hit blocked by you | A |
| Parry | `hit:parried` | tap Space / RT / BLOCK just before a hit | same | home gym | 2.7 | Mo's hit parried by you | A |
| Dodge | `fighter:dodge` | Shift / LT / DODGE | same | home gym | 2.8 | you dodge while Mo is swinging and take no hit | A |
| Grab | `grapple:start` | U / LB / GRAB | Mo stands | home gym | 2.9 | `grapple:start` with you as holder | A |
| Break free | `grapple:escape` | U / LB / GRAB while held | Mo grabs you | home gym | 2.10 | `grapple:escape` with you held | A |
| Stamina | `Vitals`, `fighter:fatigue`, `action:refused` | none | none | home gym | 2.11 (info, stamina bar highlighted) | read | A |
| Specials | `MOVE_UNLOCKS.specials`, held Special + attack | O + attack / RB + attack / SPECIAL then attack | bought at a coach (`specials`) | after purchase | C: Special moves | a special move started | C |
| Finishers | `canFinish` | O + I / RB + Y / SPECIAL then HARD PUNCH | `finishers` bought (after the Gaffer) | after purchase | C: Finishers (hint) | first `fighter:finished` by you | C |
| Styles | `data/styles`, `save.styles` | Tab / Back / STYLE | second style learned | style gyms | 3.1 your style (info); C: Swap styles | `style:swapped` (you) | A/C |
| First proper scrap | `estate` `lads` | all | first fight | estate | 4.1 Win your first fight | `encounter:cleared` id `lads` | A |
| Rewards | `encounter:cleared` cash and xp | none | after the fight | estate | 4.2 (info, money and XP highlighted) | read | A |
| XP, levels, training points | `level:up`, `save.trainingPoints` | H / none / Me on the phone | none | any | 5.1 Me screen; C: first level-up | Me screen opened | A/C |
| Pockets and bag | `inventoryUI`, HUD bag | B or I / none (a pad has no bag button) / bag button | out of a fight | any | B: Pockets (on the first pickup) | bag opened | B |
| Weapons, durability, throwing | `syncHeld`, `weapon:broken`, `weapon:thrown` | GRAB on a weapon at your feet in a fight | holding a weapon | streets | B: Weapons (hint) | first weapon held | B |
| Map and travel | `mapApp`, `travelTo` | M or Tab / phone / phone | out of a fight | any | B: Getting about (hint on first street) | Maps opened | B |
| Shops and pawn | `openStation` `shop`/`pawn` | USE | at a counter | High Street on | B: Shops (hint) | first shop opened | B |
| Gyms and coaches | `style_coach`, `coach_board`, `drill` | USE | a style gym | Leisure Park etc. | B: Gyms (hint) | first coach opened | B |
| Home: tin, needs, food, sleep, storage | `house`, `NUDGES` | USE | home | home | B: Home (hint on first visit back) | the tin used | B |
| Saving | autosave in `enterArea`, Pause → Save | none | any | any | info in the library | none | B |
| Injuries | `injury` event | none | after a fight | any | B: Injuries (hint) | first injury | B |
| Heat, police, custody, bail | `progress/heat.ts`, `cops.ts`, `custody.ts` | none | police heat > 0 | any | C: Heat (hint on first heat), C: Old Bill (on the first police arrival) | read | C |
| Crew | `companions/` | USE in the pub | a hire is open | the Red Lion | C: Crew (hint when first hired) | read | C |
| Jobs: contacts, taking a job, doing it, getting paid, standing | `src/jobs/`, `ui/jobsUI.ts`, phone Jobs | USE at a contact | a contact | the Red Lion, High Street, Hollins, Back Alleys | G: 06 Jobs (starts at the first contact) | a job taken (any active job), its hard part done (stage `back` or paid), no job left | G |
| Passers-by with a job | `World.setUpStreetGiver` | USE | a yellow ! on the street | streets | B: Someone needs a hand (when one's near) | read | B |
| A job gone wrong | `failJob`, `job:failed` | none | a job failed or dropped | any | B: A job gone wrong | read | B |
| Hotbar: medical, food, drink, weapon | `items/hotbar.ts`, `World.useHotbar` | 1–4 / Back + X, Y, A, B / the slots | hurt, with something to heal with | any | G: 07 The hotbar (starts when you're hurt) | `hotbar:used` | G |
| Clothes tiers, outfit buffs, jewellery XP | `items/gearBonus.ts` | none | wearing something that gives a buff | any | B: Dressed for it | read | B |
| Kitchen: fridge, cupboards, cooking | `home/house.ts`, `kitchenUI.ts` | USE | home | home | B: The kitchen (first fridge or cupboard) | read | B |
| The Red Lion: bar, lock-in, the Snug | `world/interiors.ts`, `recruit` | USE | in the pub | High Street | B: The Red Lion (first visit) | read | B |
| Property | `realty/` | USE at Keys & Co | Riverside Centre | later | C: Property (hint at the agent) | read | C |
| Bikes | `world/streetBikes.ts` | USE on a bike | bike racks | streets | C: Bikes (hint on the first bike) | read | C |
| Business | `business/` | the basement | basement unlocked | later | C: The basement (hint on the first visit) | read | C |

## Design

- **Layers.**
  - **A (essential):** chapters 1–5. They run on a new game, at home and in the first fight. Every step can be skipped, and so can the whole tutorial.
  - **B and C (contextual):** a one-time card the first time you meet the thing (`HINTS`). They respect Settings → Tutorial hints.
  - **G (guides):** short lessons for things met later (`GUIDES` in `lessons.ts`: 06 Jobs, 07 The hotbar), run on real events like the chapters. Each starts itself the first time you meet its thing (`start`: an event, or a check made every second, never in a fight), only once the first-run lessons are done and with Tutorial hints on. The first card has Not now (skips it; it's never offered again). Pause → Tutorials can start one, or replay one you've done. `save.tutorial.guide` keeps one in progress across a reload; `GUIDE_CHAPTERS` in `state.ts` must match `GUIDES` (`tests/tutorial.test.ts`).
- **Saves.**
  - `save.tutorial` holds the version, started, essential done, completed and skipped lesson ids, hints shown, the active step, and a guide in progress.
  - A save from before the tutorial counts as done, with every hint already shown, so existing players aren't marched through it.
- **Code.**
  - `src/tutorial/`:
    - `lessons.ts`: the data;
    - `TutorialManager.ts`: state, event bridge and objectives;
    - `controls.ts`: prompts from the bindings;
    - `overlay.ts`: UI, HUD highlights;
    - `library.ts`: Pause → Tutorials.
  - `Game` only creates the manager, passes events to it and calls `update` each frame.
- **Lesson mode for Mo** (`World.startLesson`). Sparring with a scripted brain (`ai/TutorialBrain.ts`):
  - stands for the attack lessons;
  - throws one slow, readable jab every few seconds for block, parry and dodge;
  - grabs you for break free;
  - his hits do no damage.

  It's the real combat engine; only Mo's brain changes.
- **Replays.** Chapter 2 replays at the home gym (Pause → Tutorials). Every other lesson replays its explanation. Replays never pay out.
