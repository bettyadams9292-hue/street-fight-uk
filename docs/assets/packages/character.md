# Character package (65 rows)

**Rows (65)**

| Area | Rows | What the rows ask for |
|---|---|---|
| Items: Clothing | 30 | Inventory icon, sometimes also a rigged clothing or shoe model |
| Items: Accessories | 15 | Icon, sometimes also a rigged or better worn model: earrings, belt, gumshield, headguard |
| Character: hair | 7 | Afro, cornrows, mohawk, quiff, buzz, curly, ponytail. Each borrows another style's model today. |
| Character: facial hair | 3 | |
| Character: tattoos | 6 | Decals |
| Character: scars | 4 | Decals |

Ledger: `docs/assets/ledger/character.json`.

**Code to read first**
- `src/characters/human/`: MakeHuman-style body with clothing and hair proxies.
- `fromAppearance.ts`, which maps the creator's choices to models.
- `garments.ts`, which builds clothes in code.
- `public/models/human`.

**Sources**
- The MakeHuman CC0 packs in the owner's `StreetFightUK-assets` folder: hair01, shirts01, pants01, suits01, shoes01, hats01, glasses01, gloves01, masks01 (`*_cc0.zip`). Convert them with the same pipeline as the existing proxies.
- Decimate each garment or hairstyle to under about 3k tris.
- Make the tattoos and scars as original decals.
- Caps and beanies currently show a flat cap as a stand-in. Fix that.
- Leave `src/render/jewellery.ts` alone; it belongs to the jewellery package.

**Icons**
- Extend `tools/icons/render_items.mjs` to render them.
- Clothing can be dyed (`ItemStack.colour`). Either tint the icon to match, or keep the painted fallback for dyed stacks.

**Check in the game**
- The character creator, with each new hairstyle and facial hair option.
- Garments, shoes and accessories worn, front and side.
- Tattoos and scars on the current rig.
- The clothes shop and the inventory at both phone sizes.
- Skinning while walking and fighting: no stretched vertices.

Add a test.
