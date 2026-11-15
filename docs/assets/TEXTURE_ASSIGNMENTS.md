# Texture assignments

Which set from the texture library (`TEXTURE_CATALOGUE.md`) goes on what, and the code that decides it. Change an assignment in the file named, not here; this page is the map.

## How assignment works

- **`src/render/materials/library.ts`** loads sets on demand and builds the materials. `surface(set, { tint })` gives a shared material; `tint` shifts a set to a wanted colour while keeping its grain. `fitUVs` makes every texture repeat at its real size on whatever mesh it is on.
- **`src/render/materials/assign.ts`** holds the families (every suitable variant of wood, brick, steel and so on) and `guess()`, which works out what a plainly coloured thing is made of from its colour, roughness, metalness and the kind of prop being built.
- Where several sets suit, a seed (the level, the room, the piece of furniture) picks one, always the same one for the same place.

## Where each family is used

| What | Sets | Decided in |
|---|---|---|
| Road surface on every street | Road012A, 012B, 012C, 014B, 014C, 015A (one per district) | `materials/streetDetail.ts`, `street/Flooring.ts` |
| Pavements, yards, concrete ground | Concrete034, Concrete042A | `materials/streetDetail.ts`, `street/Flooring.ts` |
| Brick walls of street buildings | Bricks005, 007, 070, 097 (one per district) | `materials/streetDetail.ts` |
| Block paving, setts (streets not built from the kit) | PavingStones036, 083, 092, 102, 109, 123 | `street/Flooring.ts` (`GROUND`) |
| Mall and plaza floors (same) | Tiles050, Tiles074 | `street/Flooring.ts` |
| Dirt and waste ground (same) | Ground020, 037, 108 | `street/Flooring.ts` |
| Shop and business floors | per place: see `PLACE_FLOORS` (pub boards or Victorian tiles, casino carpet, jeweller marble, showroom granite or black tile, gym and lock-up concrete, dojo and boxing boards) | `materials/assign.ts`, `LevelView.libraryFloor` |
| Room floors without a chosen finish | WoodFloor014 to 070 (boards), Tiles055/057/068/138/140/143/144/050 and 131/074 (tiles), Fabric028/029/082A (carpet), Concrete034/042A (sealed floors) | `LevelView.libraryFloor` |
| Room walls | Concrete034 relief under paint; Bricks005/007/070/097; Tiles105/011/032/037/031; Tiles133C/136C in cellars; woods for panelling | `LevelView.libraryWall` |
| Home finishes you buy | WoodFloor040 (oak), WoodFloor064 (walnut), Fabric028/082A/026 (carpets), Tiles143 (stone), Tiles138 (slate), Bricks005, Wood066 (panelling), Tiles105 (metro tiles), Concrete034 relief under the paints | `textureFiles.ts` (`FINISH_LIBRARY`) |
| Furniture wood | Wood082B, 052, 096, 049 (light); Wood066, 026, 051, 084A, 067 (dark): one per kind of piece | `props/KenneyLibrary.ts` |
| Furniture upholstery and rugs | Fabric028, 029, 081A, 082A, 064, 001 | `props/KenneyLibrary.ts` |
| Appliances, sinks, taps, white goods | Metal052A, 038, 061A, 041A; Metal050C under enamel; Porcelain001 | `props/KenneyLibrary.ts` |
| Anything built from boxes in a plain colour | by `guess()`: woods and rough timber (Planks023A, Wood084B, Wood049), steels (Metal038, 041A, 052A, 061A, 063), brass and gold (Metal034, 042A, 048B, 048C), copper (Metal035), painted metal (Metal050C), weathered metal on skips, containers and fences (Metal022, 041B, 055B, 056B, 056C, 062C), cloth and leather seating (Leather037, 012, 033B, 034C, 034D, 025, 011, 036B, 038, 009, 008), porcelain (001 white, 003 black), concrete | `materials/assign.ts` |
| Worktops and bar tops | Rock058 (dark slate), Wood071, Wood082B, Wood026 | `materials/assign.ts` |
| Swimming pool | Tiles132A | `materials/assign.ts` |
| Lawns in front of houses | Grass006, 007, 004 | `materials/assign.ts` |
| Clothes (weave and sheen; colour stays per garment) | Fabric082A (fleece), Fabric026 (knit), Fabric081A (nylon), Fabric022 (denim), Leather037 (leather), Fabric064 (cotton), Fabric049 (canvas) | `human/HumanBuilder.ts` (`FABRIC_LIBRARY`) |

## Left as they are, on purpose

- Car and bike paint, screens, signs, glowing and see-through things: their look is their paint or their light.
- Painted and rendered walls, shop fronts and roofs of the kit street buildings: only brick-coloured walls take brick.
- Near-black plain surfaces (rubber, plastic).
- The black and white floor tiles and the striped wallpaper finishes: the library has no true match, so they keep their own files.

## In the library but not used yet (17)

| Set | Why |
|---|---|
| Bamboo001C | needs a blind or screen model with texture coordinates |
| Fabric004 | carbon fibre: for vehicle trim, in the vehicle tasks |
| Fabric015 | see-through strap weave: nothing in the game is made of it yet |
| Fabric023 | second denim: for the clothing overhaul |
| Fabric080 | tartan: for the clothing overhaul (scarves, blankets) |
| Fabric082B | floral print: for curtains and bedding once they have texture coordinates |
| Fabric083 | dogtooth: for the clothing overhaul (coats, caps) |
| Facade014 | a whole office front at night: needs a backdrop building to go on |
| Foliage006 | cut-out leaves: need leaf-card plant models |
| Foliage008 | cut-out leaves: need leaf-card plant models |
| Leaf001 | cut-out leaves: need leaf-card plant models |
| Metal057C | rose gold: for the jewellery models |
| PaintedBricks001 | glossy blue painted brick: no wall in the game is painted brick yet |
| PaintedWood007A | navy painted boards: for doors and sheds once they are built from boards |
| Rocks022 | pebbledash: the kit house fronts have no texture coordinates to lay it on |
| Tiles005 | pastel club tiles: for the nightclub interior when it is built |
| WoodSiding009 | cream clapboard: no clapboard building in the game |

## Logic review (15 Nov 2026)

The owner found a black, grimy bath and fridge (the same material) and brick shop awnings. Fixed, and
`tests/textureLogic.test.ts` now builds every level and checks each textured surface:
- Painted metal (Metal050C) shades as paint, not bare metal: without reflections, full metalness rendered it black.
- Baths, toilets and basins are white porcelain throughout; fridges and cookers are white painted metal.
- Porcelain only in the bathroom; white gloss elsewhere stays gloss paint.
- Concrete only on buildings and grounds, never on shelving, bins, the ring canvas or stall covers.
- Wood only on wood colours: orange, yellow and gold paint (awnings, skips, forklifts, bollards) is no longer wood.
- Card and pool table baize, the ring floor, market stall canopies and shop awnings are cloth (Fabric081A), not leather or planks.
- Kit streets: brick only on building walls (`nyc/bldg*` and blocks), flagged per vertex; red awnings, signs and shop panels are never brick.
