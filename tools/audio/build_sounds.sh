#!/usr/bin/env bash
# Builds public/audio/*.mp3 from Kenney's CC0 packs (see public/audio/CREDITS.md).
#   tools/audio/build_sounds.sh <kenney-impact-sounds dir> <kenney-rpg-audio dir>
# Each clip: mono, leading silence trimmed, peak-normalised to -1 dB, 96 kbps MP3 (plays everywhere, iOS included).
set -euo pipefail
IMPACT="$1"; RPG="$2"; OUT="$(dirname "$0")/../../public/audio"
mkdir -p "$OUT"
conv() { # src dst
  local peak gain
  peak=$(ffmpeg -hide_banner -nostats -i "$1" -af "silenceremove=start_periods=1:start_threshold=-45dB,volumedetect" -f null - 2>&1 | sed -n 's/.*max_volume: \(-*[0-9.]*\) dB.*/\1/p')
  gain=$(python3 -c "print(round(-1 - float('$peak'), 2))")
  ffmpeg -hide_banner -loglevel error -y -i "$1" -af "silenceremove=start_periods=1:start_threshold=-45dB,volume=${gain}dB" -ac 1 -ar 44100 -c:a libmp3lame -b:a 96k "$OUT/$2.mp3"
}
for i in 0 1 2 3 4; do
  conv "$IMPACT/impact_punch_medium_00$i.ogg" "punch_medium_$i"
  conv "$IMPACT/impact_punch_heavy_00$i.ogg" "punch_heavy_$i"
  conv "$IMPACT/impact_soft_medium_00$i.ogg" "body_medium_$i"
  conv "$IMPACT/impact_soft_heavy_00$i.ogg" "body_heavy_$i"
  conv "$IMPACT/footstep_concrete_00$i.ogg" "step_$i"
done
for i in 0 1 2; do conv "$IMPACT/impact_glass_heavy_00$i.ogg" "glass_$i"; conv "$IMPACT/impact_plate_heavy_00$i.ogg" "metal_$i"; done
for i in 1 2 3 4; do conv "$RPG/cloth_$i.ogg" "cloth_$((i-1))"; done
conv "$RPG/handle_coins.ogg" "coins_0"; conv "$RPG/handle_coins_2.ogg" "coins_1"
conv "$RPG/door_open_1.ogg" "door_open_0"; conv "$RPG/door_close_1.ogg" "door_close_0"
echo "built $(ls "$OUT"/*.mp3 | wc -l) sounds"
