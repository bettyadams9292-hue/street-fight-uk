# STREET FIGHT UK: art direction (phase 2, zero budget)

Status: **Look A, Sodium Night, signed off on 11 November 2026.** It is the default at medium and high quality. `?look=off` or Settings > Display > Lighting and glow gives the plain picture; low quality always uses the plain picture.

## The constraint

There is no money for generators, asset packs or artists. That rules out photoreal characters and bespoke modelled streets, and it decides the style: **stylised, lighting-led, low-detail models made to look deliberate.** The look has to come from light, colour and post-processing, which cost nothing, plus free public-domain (CC0) assets.

## The three candidates (A was chosen)

Side-by-side frames, each showing the current game and the three looks: `looks_spar.jpg`, `looks_estate.jpg`, `looks_home.jpg`.
Try them live: add `?look=sodium`, `?look=overcast` or `?look=ink` to the game's address.

| | Look | Intent | Strength | Risk |
|---|---|---|---|---|
| A | **Sodium Night** (`sodium`) | Wet streets under orange lamps: teal shadows, amber light, lamps and windows that glow | Closest to the game as built; puddles and lamps finally read; flatters night scenes | Daytime and interiors need their own lighting pass |
| B | **Kitchen Sink** (`overcast`) | British social-realist film: drained colour, flat grey light, soft blacks, grain | Most distinctive tone; very British | Shows up low-detail models most; can look drab on a phone |
| C | **Back-Page Ink** (`ink`) | Printed comic: ink outlines, bold colour, stepped tones | Hides low-detail models best; reads well small | Furthest from "gritty"; outlines are heavy on brick and small text |

**Chosen: A, Sodium Night.** B and C stay selectable with `?look=overcast` and `?look=ink` for reference.

## Rules that hold whichever look is chosen

- **Palette.** Brick red `#7a2a22`, sodium amber `#ff8f29`, wet-slate blue `#1c2733`, bin green `#1f4a2b`, off-white trim `#d8cfc0`. UI accent stays `#f2c230`.
- **Colour script.** Estate: amber on slate. High street: cooler, shop-window whites. Interiors: warm bulb light, one cool window. Fights: push contrast, never hue.
- **Value before colour.** Fighters must separate from the background in greyscale. Player clothing stays darker or lighter than the wall behind, never the same value.
- **One light tells the story.** Each scene has one dominant light (a lamp, a window, a strip light). Everything else is fill.
- **Emissive things glow, nothing else does.** Bloom is only for lamps, windows, signs and screens.
- **No photographic textures on stylised models.** Flat or lightly painted colour only, so free assets from different authors sit together.
- **Readability beats mood.** Health bars, prompts and hit effects are never graded darker than the scene.

## Zero-budget asset sources

Every file goes through `src/assets/manifest.ts` with its source and licence recorded. Confirm the licence on the download page each time.

| Need | Source | Licence | Note |
|---|---|---|---|
| Characters | Quaternius (already in use) | CC0 | Fuller 65-bone skeleton available from the same source |
| Props, street furniture | Kenney, Quaternius, Poly Haven models | CC0 | Recolour to the palette; reject anything photoreal |
| Sky and reflection maps | Poly Haven HDRIs | CC0 | Would replace the code-built reflection environment |
| Surface textures | ambientCG, Poly Haven | CC0 | Use sparingly, see the texture rule above |
| Sound effects, ambience | Freesound (filter to CC0), Kenney audio | CC0 only | Avoid attribution or non-commercial licences |
| Music | CC0 tracks only | CC0 | Much "royalty-free" music is not free for commercial use |
| Motion clips | Mixamo | Free with an Adobe account | Terms must be read before use: this repository is public and raw clips may not be redistributable |
| Modelling, cleanup | Blender | Free | Runs on your computer |

Not used: Higgsfield, Meshy or any paid generator. Revisit when there is a budget.

## What sign-off unlocks (phase 3, the vertical slice)

1. Done: the chosen look is the default at medium and high quality, with a setting to turn it off; low quality keeps the plain picture. If a device is still slow at the lowest resolution, the look switches itself off for that session.
2. One street (the estate) is rebuilt to the guide with CC0 props and proper light placement.
3. Three characters get the fuller skeleton.
4. Recorded CC0 sound replaces the synthesised effects for that street.

## Phase 3 progress: the estate street

Done in code, at no cost:

- **Street pass on Tanner Road Estate:** lamp light pools on the ground and wall, faint beams through the rain, uneven puddles and a wet gutter, rain splashes, drainpipes, damp at the foot of the wall, weeds, litter, and soft contact shadows under street furniture. `?street=classic` turns it off.
- **Cars:** a shaped hatchback replaces the box car everywhere, and a car standing between the camera and the player fades so you can always see your fighter.

Still to do for the slice, and what each needs:

| Item | Needs |
|---|---|
| Fuller character skeleton (hands, neck, clavicles) on three characters | The original 65-bone Quaternius source files |
| Recorded impacts, footsteps, rain and one music track | CC0 audio files downloaded and attached |
| Modelled hero props (bins, bench, skip, trolley) | CC0 models downloaded, or built in Blender on a linked computer |
| 60 frames a second on the minimum device | A real phone to measure on |
