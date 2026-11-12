# Sound effects

All recorded sounds here are from Kenney (https://kenney.nl), released under CC0 1.0 (public domain). Credit isn't required, but thank you Kenney.

- **Impact Sounds** (via the CC0 Godot port at github.com/Boyquotes/kenney-impact-sounds-for-godot): punches (`punch_*`), body hits and falls (`body_*`), concrete footsteps (`step_*`), breaking glass (`glass_*`), metal plates (`metal_*`).
- **RPG Audio** (via github.com/Boyquotes/kenney-rpg-audio-for-godot): clothing (`cloth_*`), coins (`coins_*`), doors (`door_*`).

Each clip was converted to mono MP3, its leading silence trimmed and its peak levelled to −1 dB by `tools/audio/build_sounds.sh`. `tools/audio/write_manifest.py` then lists them in `src/assets/audioManifest.ts`. Whooshes, the parry tell and street ambience are still made in code (`src/audio/AudioManager.ts`).
