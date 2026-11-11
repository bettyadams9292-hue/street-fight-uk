#!/usr/bin/env python3
"""
Converts chosen MakeHuman skin textures (CC0 skin packs) to 1024 px WebP for
the game and writes public/models/human/skins.json.

    python3 tools/makehuman/convert_skins.py <skins.json> [repo root]

skins.json: [{ "id", "dir" (pack skin folder), "gender": "male"|"female", "tone": 0..1 light..dark, "age": "young"|"middle"|"old", "tags": [] }]
"""
import json, os, sys
from PIL import Image

LIST = json.load(open(sys.argv[1]))
ROOT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(__file__), '..', '..')
TEX = os.path.join(ROOT, 'public', 'models', 'human', 'tex')
os.makedirs(TEX, exist_ok=True)
out = []
for s in LIST:
    mhmat = [f for f in os.listdir(s['dir']) if f.endswith('.mhmat')][0]
    mat = {}
    for line in open(os.path.join(s['dir'], mhmat), encoding='utf-8', errors='replace'):
        p = line.strip().split()
        if len(p) >= 2:
            mat[p[0]] = p[1]
    def conv(key, suffix):
        rel = mat.get(key)
        if not rel:
            return None
        path = os.path.join(s['dir'], os.path.basename(rel))
        if not os.path.exists(path):
            return None
        im = Image.open(path).convert('RGB')
        if max(im.size) > 1024:
            im = im.resize((1024, 1024), Image.LANCZOS)
        name = f"skin_{s['id']}{suffix}.webp"
        im.save(os.path.join(TEX, name), 'WEBP', quality=84, method=6)
        return name
    entry = {k: s[k] for k in ('id', 'gender', 'tone', 'age')}
    entry['tags'] = s.get('tags', [])
    entry['diffuse'] = conv('diffuseTexture', '')
    entry['normal'] = conv('normalmapTexture', '_n')
    entry['source'] = f"MakeHuman skin pack ({os.path.basename(s['dir'])}), CC0"
    if not entry['diffuse']:
        raise SystemExit(f"{s['id']}: no diffuse texture")
    out.append(entry)
    print(entry['id'], entry['diffuse'], entry['normal'])
json.dump(out, open(os.path.join(ROOT, 'public', 'models', 'human', 'skins.json'), 'w'), indent=1)
