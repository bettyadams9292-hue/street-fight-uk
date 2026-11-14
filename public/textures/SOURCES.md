# Textures: sources

Every file in this folder is **original work for Street Fight UK**, painted procedurally by
`tools/textures/gen_textures.py` (numpy + PIL). No downloaded images were used. Run the script to
remake them all (it is deterministic).

| Files | Used for | Source | Licence |
|---|---|---|---|
| `street/*.webp` (brick, paving, road, markings, concrete, plaster, corrugated, tiles, shutter, wood_floor, sign_board, windows, graffiti, posters) | Canvas textures in `render/textures.ts`, `render/levelTextures.ts` and `LevelView.litWindowTexture` | original | Original work for Street Fight UK |
| `furniture/*.webp` | Kenney furniture surfaces (`KenneyLibrary.ts`) | original | Original work for Street Fight UK |
| `character/*.webp` | Eyebrows, eyelashes and garment weaves (`HumanBuilder.ts`) | original | Original work for Street Fight UK |
| `home/*.webp` | Home floor and wall finishes (`textureFiles.finishMaterial`) | original | Original work for Street Fight UK |
| `fx/particles.webp`, `fx/rain.webp` | Hit, heavy, block, glint and danger bursts (`HitFX.ts`); rain (`LevelView.buildWeather`) | original | Original work for Street Fight UK |

The lettering on the graffiti and poster atlases is drawn with Big Shoulders (`public/fonts`,
SIL Open Font License), which allows text rendered into images.

`<name>_n.webp` files are normal maps (linear, OpenGL convention). "Two-tone" files (concrete,
plaster, corrugated, tiles, markings, sign_board) hold light and shade in red and a second-colour
mask in green, so the game paints them in any colours.
