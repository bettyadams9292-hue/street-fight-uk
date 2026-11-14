# Jewellery package (54 rows)

**Rows.** Every Area starting with "Jewellery:":

| Area | Rows | Needed |
|---|---|---|
| Necklaces | 18 | 3D model (worn on the body, in each metal) + shop icon |
| Rings | 13 | same |
| Watches | 12 | same |
| Grills | 9 | same |
| materials | 2 | metal matcap textures; gem textures |

Ledger: `docs/assets/ledger/jewellery.json`.

**Current state.** `src/render/jewellery.ts` builds every piece in code and fits it to the character's bones. The Halden & Crane shop shows each piece on a generic preview.

**What to deliver.**
1. **Materials:** original matcap or environment textures for each metal the game uses, plus gem textures or materials, all made programmatically. Use them in `jewellery.ts` and keep the flat colours as the fallback.
2. **Models:** one low-poly GLB per design, in a neutral metal. Recolour it per metal at runtime, the way vehicle paint works (see `VehicleLibrary.ts`). Each is 50–800 tris and sized to the existing bone attachment points. The code-built piece stays as the fallback.
3. **Icons:** a 128 px WebP shop icon per piece, made by extending `tools/icons/render_items.mjs` so the camera, lighting and outline match the item icons. Show them in the jeweller shop and the jewellery box.

**Check in the game:**
- the jeweller shop at 844×390 and 390×700;
- the jewellery box;
- the character wearing a chain, a watch, a ring and a grill in at least two metals;
- a clean console and no 404s.

Add a test for the files and budgets.
