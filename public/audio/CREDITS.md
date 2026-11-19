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

## Original music

Also original work, with no samples: `tools/audio/make_music.py` synthesises three grime-style instrumentals at 140 bpm in F# minor (808 sub, square "eskibeat" lead, synthesised drums) and writes them as seamless stereo MP3 loops.

| File | Plays |
|---|---|
| `music_menu.mp3` | main menu and character creator (14 s loop) |
| `music_street.mp3` | out on the streets (28 s loop) |
| `music_boss.mp3` | while a boss is up (28 s loop) |

Home, shops, the pub and other rooms have no music. Volume is under Settings → Music volume.
