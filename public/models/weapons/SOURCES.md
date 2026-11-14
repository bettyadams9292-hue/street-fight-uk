# Weapon models

All 36 melee weapons, one GLB each. **Original work for Street Fight UK**: modelled in code by
`tools/weapons/build_weapons.py` (with `tools/weapons/lowpoly.py`, a small GLB writer). No
downloaded assets were used, so there is no third-party licence.

Rebuild with `python3 tools/weapons/build_weapons.py`.

- Low-poly and flat-shaded: 40–720 triangles each, flat colours from the style guide, no textures.
- Grip at the origin, the weapon up +y, real-world size in metres. The scene's `extras.length` is the
  weapon length (`src/combat/Weapons.ts`) the model was made for.
- Loaded by `src/render/props/PropLibrary.ts` (`WEAPON_FILES`). If a file fails to load, the game
  draws the code-built weapon from `src/render/weaponMesh.ts` instead.

| File | Weapon |
|---|---|
| bottle.glb, broken-bottle.glb | Glass bottle, broken bottle |
| bat.glb, baseball-bat.glb | Cricket bat, baseball bat |
| pipe.glb, metal-bar.glb, crowbar.glb, hammer.glb, wrench.glb | Lead pipe, rebar, crowbar, claw hammer, pipe wrench |
| machete.glb, knife.glb, chain.glb, club.glb, pool-cue.glb, pole.glb, torch.glb | Machete, kitchen knife, bike chain, wooden club, pool cue, scaffold pole, heavy torch |
| mop.glb, broom.glb, road-sign.glb, cone.glb, plank.glb | Mop, broom, road sign (no entry), traffic cone, wooden plank |
| chair-leg.glb, table-leg.glb, chair.glb, tv.glb, monitor.glb | Chair leg, table leg, pub chair, old telly, computer monitor |
| skateboard.glb, umbrella.glb, shelf-bar.glb | Skateboard, golf umbrella, shelving upright |
| shovel.glb, garden-fork.glb, rake.glb | Shovel, garden fork, garden rake |
| brick.glb, frying-pan.glb, golf-club.glb, dustbin-lid.glb | Half brick, frying pan, golf club, bin lid |
