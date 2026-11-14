# Listing photos: sources

Original work for Street Fight UK: each is a render of the property's real exterior in the running
game (fixed camera per property, dusk sky and lifted ambient light, HUD and player hidden), captured
with Playwright and saved as 640 x 400 WebP. The capture scripts and camera positions are in
`tools/models/property/photos/` (`photos.py` writes `props.json`; `run.mjs s_photos.mjs` takes the
pictures against a local build). `src/ui/propertyPhoto.ts` shows them and falls back to the painted
picture if one fails to load.

| Files | Used for | Licence |
|---|---|---|
| `<property id>.webp` (20) | Keys & Co listings, brochures and the agent's window display | Original work for Street Fight UK |
