# Character overhaul: technical assessment and plan

Written 11 November 2026 in response to the "Master character development" directive. Findings come from inspecting the shipped model files (`public/models/character_*.glb`), the original source kit on the development PC, and the game code. Nothing here is assumed.

## What the current character actually is

| | Shipped in the game | Original source (Quaternius Universal Base Characters, CC0) |
|---|---|---|
| Skeleton | **11 bones**: hips, spine, head, 2 per arm, 2 per leg (feet are added in code at load) | **65 bones**: 3 spine, neck, head, clavicles, hands, **15 finger bones per hand**, feet and toes |
| Body mesh | 12,566 triangles, skin texture and normal map | The same mesh |
| Clothing | 8 thin shell meshes, 1,000 to 3,000 triangles each, **one flat colour per garment, no texture, no normal map** | None: the kit ships a body only |
| Animation clips | **None.** Every movement is calculated from 13 joint angles | None in this kit; the same author's Universal Animation Library has 120+ clips for this rig |

## Why it looks and moves the way it does

1. **Thumbs and fists.** The shipped rig has no hand or finger bones at all. The fingers are frozen in the shape they were modelled in, so a fist cannot be formed and the wrist cannot turn. This is the single cause of the hand problem, and no amount of animation tuning can fix it on the current rig.
2. **Painted-on clothing.** The garments are real separate meshes, but they are thin shells in a single flat colour with no fabric texture, no folds in the surface detail, no seams, no thickness at cuffs, hems or collars. Under most lighting they read as body paint.
3. **Stiff posture and movement.** One spine bone instead of three, no neck, no clavicles: the torso can only tilt as a block, shoulders cannot shrug or roll, and the head cannot move independently of the chest. There are no animation clips, so walking, running and punches are formulas, not performances.
4. **Punches without body mechanics.** The stage 13 animator does rotate hips and shoulders, but with one spine bone the twist cannot travel up the body, and without wrists or fists the end of the punch is a paddle.
5. **Pedestrians getting stuck.** Measured, not guessed: a quicker walker behind a slower one changed sideways direction 24 times in 16 seconds; two people forced to the same side by a wall could deadlock; when blocked they simply reversed. Fixed in this change (see below).

## What is realistic, stated plainly

The directive's target is a character that would sit in a Rockstar production. Those characters are made by teams of specialist artists from scanned people, with motion capture, over months. **That standard is not reachable with no budget and no artist, and I will not claim it.** What is reachable, and is a very large step up from today:

- The full 65-bone skeleton, so hands close into proper fists with the thumb across the fingers, wrists align, shoulders and spine move.
- Real animation clips (walk, jog, sprint, turns, idle, punches, hit reactions, knockdowns) from the same author's CC0 library, authored for this exact rig, blended with the existing procedural system for foot planting, hit timing and aiming.
- Garments rebuilt in Blender with thickness, hems, cuffs, collars, fabric normal maps and sewn-in folds, weighted to the full skeleton.
- A face, hair and skin material pass using the textures the kit already includes (roughness maps are in the source and not yet used).

It will read as a well-made stylised character, not a photoreal one.

## Plan

| Step | What | Needs |
|---|---|---|
| 1 | Re-export the body on the 65-bone skeleton; map the game's 13 joints onto it; add a hand layer (fist, open, relaxed, grip) | Blender open on the PC |
| 2 | Re-weight all garments to the full skeleton; rebuild them with thickness, hems and fabric detail | Blender open on the PC |
| 3 | Import the Universal Animation Library clips; build the clip player and blend it with the procedural layer (feet, aim, hit reactions) | The two free library zips downloaded to the assets folder |
| 4 | Face, hair, skin and fabric materials; level of detail for crowds | Blender |
| 5 | Showcase: turnaround, hands, clothing close-ups, every animation, in-game shots, each inspected and fixed | The visual test harness (in place) |
| 6 | Pipeline document so every later character is built the same way | After the first character passes |

The engine stays. Three.js plays skinned clips and blends them without difficulty; the limits today are the assets, not the renderer. A move to Unreal would discard 36,000 lines of working, tested game for a problem the engine is not causing.

## Done in this change: pedestrians

Rewritten `src/world/civilians.ts`:

- **Passing:** everyone passes oncoming and standing people on the same hand, chooses a side once and holds a fixed line until past. If a wall forces both to the same side, one gives way.
- **Overtaking:** a quicker walker overtakes if there is room, otherwise falls in behind at the slower pace.
- **Blocked:** looks for another clear line across the pavement; if truly boxed in, waits; turns back only when patience runs out. Recovery from being stuck goes other side, then wait, then turn.
- **Individuals:** each has their own line, personal space, patience and temper.
- **Awareness:** a scripted fight or any punch landing nearby makes people react by temper. The nervy run, the nosy back off to a safe distance and watch, the steady turn away and walk on briskly or stay sat if it is far enough off. People further than 13 m take no notice. Nobody takes a spot someone is already standing in.

Measured on five streets, four seeds each, 60 seconds (`tsx tools/npc_metrics.ts`):

| | Before | After |
|---|---|---|
| Seconds stalled per pedestrian-minute | 0.59 | 0.38 |
| About-turns per pedestrian-minute | 1.86 | 1.46 |
| Metres walked per pedestrian-minute | 36.3 | 41.6 |
| Sideways direction changes while overtaking (16 s test) | 24 | 3 or fewer |

Not done for pedestrians: a navigation mesh. Streets here are a strip two to four metres deep, so lane steering with local avoidance does the job; a nav mesh becomes worthwhile when areas stop being strips.
