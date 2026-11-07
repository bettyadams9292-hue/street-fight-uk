# STREET FIGHT UK

A gritty 2.5D street-fighting action RPG set in modern Britain. Browser game built with TypeScript and Three.js, playable on PC and iPhone.

**Current build: Stage 3 (Combat expansion)**: create your fighter, then fight in the back-alley training ground: seven styles, parries, dodges, grappling, finishers and eight enemy types.

## Run it

```bash
npm install
npm run dev        # local dev server with instant reload
npm test           # headless combat and stats tests
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
| Procedural fighter model and code-driven poses | `src/render/CharacterRig.ts`, `src/render/poses.ts` | Blender GLB characters and real animation clips (needs animation files, see Stage 2 report) |
| Alley built from boxes and procedural textures | `src/render/ArenaView.ts`, `src/render/textures.ts` | Stage 5 (Blender-modelled locations) |
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
