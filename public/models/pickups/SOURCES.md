# Pickup models

Food, groceries, first aid, materials, collectibles and quest items, shown on the ground when dropped. Wired in by Game id through `src/render/props/pickups.ts` and `PropLibrary.ts` (`ITEM_MODELS`).

All 80 files are built by `tools/pickups/build.mjs` from the definitions in `tools/pickups/models.mjs`: flat-shaded, untextured, one material per colour, 50 to 800 triangles each.

| File | Used for | Source and licence |
|---|---|---|
| Every file not listed below | Their Game id (file name with `-` for `_`) | Original work for Street Fight UK, built in code from three.js primitives |
| can-of-pop.glb | can_of_pop | Kenney Food Kit 2.0 `soda-can` (CC0 1.0, kenney.nl), texture flattened to plain colours |
| g-bread.glb | g_bread | Kenney Food Kit 2.0 `loaf` (CC0 1.0), flattened |
| g-steak.glb | g_steak | Kenney Food Kit 2.0 `meat-raw` (CC0 1.0), flattened, on original butcher's paper |
| g-bacon.glb | g_bacon | Kenney Food Kit 2.0 `bacon-raw` (CC0 1.0), flattened, in an original tray |
| g-onions.glb | g_onions | Kenney Food Kit 2.0 `onion` (CC0 1.0), flattened, plus an original tag |
| g-mushrooms.glb | g_mushrooms | Kenney Food Kit 2.0 `mushroom` (CC0 1.0), flattened, in an original punnet |
| g-tomatoes.glb | g_tomatoes | Kenney Food Kit 2.0 `tomato` (CC0 1.0), flattened, on an original vine |
| s-chocolate.glb | s_chocolate | Kenney Food Kit 2.0 `chocolate-wrapper` (CC0 1.0), flattened |
| s-fruit.glb | s_fruit | Kenney Food Kit 2.0 `apple` (CC0 1.0), flattened and recoloured green |
| m-sandwich.glb | m_sandwich | Kenney Food Kit 2.0 `sandwich` (CC0 1.0), flattened, on an original plate |
| m-cereal.glb | m_cereal | Kenney Food Kit 2.0 `bowl-cereal` (CC0 1.0), flattened, plus an original spoon |
| m-burger.glb | m_burger | Kenney Food Kit 2.0 `burger-cheese` (CC0 1.0), flattened, on an original plate |
| m-steak.glb | m_steak | Kenney Food Kit 2.0 `meat-cooked` (CC0 1.0), flattened, with original potatoes and plate |
| bacon-butty.glb | bacon_butty | Kenney Food Kit 2.0 `bacon` (CC0 1.0), flattened, in an original bun |
| fry-up.glb, m-full-english.glb | fry_up, m_full_english | Kenney Food Kit 2.0 `egg-cooked` and `bacon` (CC0 1.0), flattened, with original sausages, beans, toast and plate |

Kenney Food Kit: https://kenney.nl/assets/food-kit (pack copy in `StreetFightUK-assets/kenney_food-kit.zip`; its License.txt is CC0).
