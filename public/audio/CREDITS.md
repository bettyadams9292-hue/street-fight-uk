# Sound effects

All recorded sounds here are from Kenney (https://kenney.nl), released under CC0 1.0 (public domain). Credit isn't required, but thank you Kenney.

- **Impact Sounds** (via the CC0 Godot port at github.com/Boyquotes/kenney-impact-sounds-for-godot): punches (`punch_*`), body hits and falls (`body_*`), concrete footsteps (`step_*`), breaking glass (`glass_*`), metal plates (`metal_*`).
- **RPG Audio** (via github.com/Boyquotes/kenney-rpg-audio-for-godot): clothing (`cloth_*`), coins (`coins_*`), doors (`door_*`).

Each clip was converted to mono MP3, its leading silence trimmed and its peak levelled to −1 dB by `tools/audio/build_sounds.sh`. `tools/audio/write_manifest.py` then lists them in `src/assets/audioManifest.ts`. ## Original sounds

These are original work for Street Fight UK. They contain no samples, so no licence applies. `tools/audio/make_sounds.py` designs and renders them offline (layered noise, modal resonances and a small room), levels them to a −1 dB peak, and writes them as mono MP3.

| File | Used for |
|---|---|
| `swing_*` | punch and kick whooshes |
| `tell_0` | parry tell (metal scrape) |
| `danger_0` | big-shot warning swell |
| `ui_move_0`, `ui_confirm_0` | menu move and confirm |
| `house_*` | fridge open/close, cupboard, chopping, clinks, eating, toilet flush, tap on, light switch |
| `loop_*` | oven, shower, frying pan and tap loops (seamless) |
| `amb_night_0` | night-time estate ambience (24 s seamless loop) |

The live synthesis in `src/audio/AudioManager.ts` is still the fallback for any of these that fail to load.
