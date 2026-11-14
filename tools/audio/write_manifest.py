"""Writes src/assets/audioManifest.ts from the files in public/audio (run after build_sounds.sh)."""
import os, re
root = os.path.join(os.path.dirname(__file__), '..', '..')
files = sorted(f for f in os.listdir(os.path.join(root, 'public/audio')) if f.endswith('.mp3'))
src = {
  'punch': 'Kenney Impact Sounds (impact_punch_*), CC0',
  'body': 'Kenney Impact Sounds (impact_soft_*), CC0',
  'step': 'Kenney Impact Sounds (footstep_concrete_*), CC0',
  'glass': 'Kenney Impact Sounds (impact_glass_heavy_*), CC0',
  'metal': 'Kenney Impact Sounds (impact_plate_heavy_*), CC0',
  'cloth': 'Kenney RPG Audio (cloth_*), CC0',
  'coins': 'Kenney RPG Audio (handle_coins*), CC0',
  'door': 'Kenney RPG Audio (door_*), CC0',
}
ORIGINAL = 'Original sound for Street Fight UK, rendered by tools/audio/make_sounds.py'
for k in ('swing', 'tell', 'danger', 'ui', 'house', 'loop', 'amb'):
  src[k] = ORIGINAL
lines = []
for f in files:
  sid = f[:-4]
  size = os.path.getsize(os.path.join(root, 'public/audio', f))
  kind = sid.split('_')[0]
  note = src[kind] if src[kind] == ORIGINAL else src[kind] + '; trimmed and levelled by tools/audio/build_sounds.sh'
  lines.append(f"  {{ id: 'sfx_{sid}', kind: 'audio', url: '/audio/{f}', bytes: {size}, group: 'audio', fallback: 'synthesised in AudioManager', source: '{note}' }},")
out = """/**
 * Recorded sound effects (written by tools/audio/write_manifest.py; credits in public/audio/CREDITS.md).
 * Each has a synthesised fallback in AudioManager, so a missing file only means a plainer sound.
 */
import type { AssetEntry } from './manifest';

export const AUDIO_ASSETS: AssetEntry[] = [
""" + "\n".join(lines) + "\n];\n"
open(os.path.join(root, 'src/assets/audioManifest.ts'), 'w').write(out)
print(len(lines), 'entries')
