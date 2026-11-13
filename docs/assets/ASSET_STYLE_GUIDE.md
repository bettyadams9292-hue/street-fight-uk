# Asset style guide

Every new asset must look like it belongs next to what's already in the game. Reference screenshots are in `docs/assets/reference/`. Look at them before choosing or making anything.

## The look

Street Fight UK is a **2.5D side-on brawler** in a stylised, low-poly British town at dusk and night.

- **World and props** are from Kenney (furniture, food, car kits) and Quaternius-style kits (the city kit in `public/models/city`, the Polyfork interiors). They are flat-shaded, clean and angular, with chunky silhouettes and simple colours from a small palette. There's almost no surface detail.
- **Characters** are MakeHuman bodies (smooth, mid-poly, realistic proportions) wearing proxy clothing. Items held or worn by characters may be a little more detailed than world props, but never photo-scanned.
- **Lighting** is warm sodium street lamps (orange), cool moonlight and blue shadows, with neon accents (red, blue, magenta). Bloom is on. The game reads from a distance: the camera sits 6–9 m from the action, and a fighter is about a fifth of the screen tall.
- **UI** uses the "Council Estate Grime" palette: red `#e8333a`, white `#f2efe6`, blue `#1f3f8a`, ink `#101014`, concrete `#8a8a8a`. Fonts are Big Shoulders and Overpass. Icons are bold line icons with 2 px strokes on a 24 px grid.

## Budgets (measured from the models already in the game)

| Kind | Triangles | Textures | File |
|---|---|---|---|
| Small item (food, tool, valuable) | 50–800 | none (flat colours), or one ≤256 px palette or atlas | ≤60 KB |
| Weapon | 100–1,200 | as above | ≤80 KB |
| Furniture | 70–1,500 | as above | ≤80 KB |
| Vehicle | 500–4,000 | one ≤512 px atlas | ≤250 KB |
| Building or mansion | 1,000–12,000 | ≤1024 px atlas, or tileables from `Textures` | ≤800 KB |
| Character clothing and hair | follow the MakeHuman proxy it replaces | ≤1024 px | ≤1.5 MB |

Kenney models are 70–600 triangles at 6–60 KB, and that is the benchmark. The prop models already in `public/models/props` (claw hammer, crowbar, wrench, keyring, smartphone, sunglasses, wristwatch, dumpster) are photo-scanned at 4k–15k triangles with 1k textures. **They do not meet this guide.** Don't copy them: they should be replaced with low-poly versions when their rows come up.

## Rules

- **Low-poly means low-poly.** Use clean geometric shapes, flat or near-flat shading, and a recognisable silhouette at 50 px tall. No photo-scans, no PBR detail maps, no fine bevels. If a model only reads well close up, it's wrong for this game.
- **Colour.** Use flat, slightly desaturated base colours from the palette below. Metals are flat with low roughness (gold `#d8b04a`, silver `#cfd2d8`, steel `#b9bdc4`). Glass is a dark blue tint. Emissive is only for things that glow in the world (screens, neon, lamps).
- **Scale.** 1 unit = 1 metre. Put the model's origin at the bottom centre for things that stand on the floor, and at the grip for things held in the hand. Facing: +Z is the front, +Y is up.
- **One material per colour** where you can, and one mesh per object. The game clones models and shares their materials.
- **Textures.** Tileables are 512 px (walls, floors) or 1024 px (big surfaces), seamless, WebP or JPEG. Normal maps are subtle. Never put a 4k texture on a small prop.
- **Icons (inventory).** Each item is rendered from its own 3D model by `tools/assets/render_icons` with the same lighting, a three-quarter view, a transparent background and a soft dark outline, at 128×128 WebP. Items without a model get an original painted icon in the same framing.
- **Licences.** CC0 or public domain only, or original work. Record the source URL and licence for every download in the package ledger. Reject anything with an unclear licence. "Free" isn't a licence.

## Palette (from the current scenes)

| Use | Colours |
|---|---|
| Brick and estate | `#8a4a36` `#9a5a40` `#7a4232` `#5a3a2a` |
| Render and stucco | `#e8e0cc` `#dcd4c0` `#eeece6` |
| Concrete and tarmac | `#8a8a8a` `#5a5a5e` `#3a3a3e` `#2a2a2e` |
| Wood | `#c8a070` `#8a5a32` `#4a2e1a` |
| Fabric | `#5a5a5e` `#3a4a6a` `#4a5a3a` `#7a2a2a` `#2a2a2e` |
| Accents (neon, signs) | `#e8333a` `#1f3f8a` `#ffd23d` `#6ad04a` `#ff4fd8` |
