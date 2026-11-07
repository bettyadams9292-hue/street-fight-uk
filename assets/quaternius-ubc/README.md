# Universal Base Characters (Standard) by Quaternius

- **Source:** https://quaternius.com/packs/universalbasecharacters.html (download: https://quaternius.itch.io/universal-base-characters)
- **Author:** Quaternius (https://www.patreon.com/quaternius)
- **Licence:** CC0 1.0 Universal (public domain dedication). See `LICENSE.txt`, which is the licence file shipped in the pack, and https://creativecommons.org/publicdomain/zero/1.0/
  - Free for personal, educational and commercial use. No attribution is required, but we credit Quaternius here anyway.

## What's in this folder

The original, unmodified files from the free Standard pack (August 2025), as used to build the game's characters:

- **Characters.** `files/Superhero_Male_FullBody.gltf` and `files/Superhero_Female_FullBody.gltf`, with their `.bin` buffers and textures (Dark and Light skin, normal and roughness maps, eyes).
- **Hair.** `files/Hair_*.gltf` and `files/Eyebrows_*.gltf`, the "Origin at 0" glTF hairstyles: Buzzed, BuzzedFemale, SimpleParted, Long, Buns and Beard.
- **Preview.** `Preview.png` is the pack's own preview image.
- **Duplicate names.** Two texture copies, `T_Eye_Normal_png.png` and `T_Hair_1_Normal_png.png`, exist only because the original `.gltf` files refer to those names.

The FBX versions, the Unity/Unreal folders and the paid Source version (.blend files, Regular and Teen bodies, all 20 hairstyles) are not included.

## How the game uses them

The game loads `public/models/character_male.glb` and `public/models/character_female.glb`. These were made from these files in Blender 5.2 with these steps:

1. **Pose.** Arms lowered from the T-pose and fingers curled into fists, then baked into the rest shape.
2. **Skeleton.** The pack's 65-bone humanoid rig was replaced by the game's 11-joint skeleton:
   - Joints: hips, spine, head, shoulders, elbows, hips (legs) and knees.
   - Each joint sits at the pack's own joint position, with identity rest rotations, so the existing fight animations drive it.
   - Skin weights were merged into those joints. For example, clavicles go to the spine; hands and fingers go to the elbow joint; feet go to the knee joint.
3. **Body shapes.** "muscle" and "weight" shape keys were added for the character creator's sliders.
4. **Clothing.** Skinned garments were cut from each body and carry the same shape keys:
   - tops: long-sleeve, t-shirt, vest and puffer;
   - extras: hood, collar and coat skirt;
   - bottoms: trousers and shorts;
   - shoes.
5. **Hair.** Hairstyles were attached to the head joint. Styles made for the other body were moved to fit.
6. **Textures.** The light skin texture is used, tinted in-game to the chosen skin tone, together with the normal map. Hair textures are tinted to the chosen hair colour. Textures were downsized to 1024 px and stored as JPEG in the GLB.

The working Blender files (`sfuk_ubc_male.blend`, `sfuk_ubc_female.blend`) are kept outside the repo because of their size (16 MB and 29 MB).
