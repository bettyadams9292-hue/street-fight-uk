"""Convert Ara 3D Gen's baked CMU motion capture (src/core/anim/clips/mocap-data.ts) to JSON.

Usage: python3 -I tools/ara/convert_mocap.py <mocap-data.ts> public/anim/ara_mocap.json
Only data is read; nothing from Ara is run. Clips that aren't useful here are left out.
"""
import json, sys

src, out = sys.argv[1], sys.argv[2]
s = open(src, encoding='utf8').read()
d = json.loads(s[s.index('= {') + 2:s.rindex('}') + 1])
KEEP = ['walk', 'walk_slouch', 'run', 'strafe_left', 'strafe_right', 'cry', 'sit_down', 'sit_idle', 'punch_low', 'jump']
res = {k: d[k] for k in KEEP if k in d}
json.dump(res, open(out, 'w'), separators=(',', ':'))
print({k: v['frames'] for k, v in res.items()})
