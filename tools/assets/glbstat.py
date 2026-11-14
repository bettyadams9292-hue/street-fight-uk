#!/usr/bin/env python3
"""glbstat.py file.glb ... : triangles, meshes, materials, textures (and their sizes), bounding box (m)."""
import json, struct, sys
def stat(p):
    b = open(p, 'rb').read()
    assert b[:4] == b'glTF', 'not a GLB'
    n = struct.unpack_from('<I', b, 12)[0]
    j = json.loads(b[20:20 + n])
    acc = j.get('accessors', [])
    tris = 0
    lo = [1e9] * 3; hi = [-1e9] * 3
    for m in j.get('meshes', []):
        for pr in m['primitives']:
            if 'indices' in pr: tris += acc[pr['indices']]['count'] // 3
            else: tris += acc[pr['attributes']['POSITION']]['count'] // 3
            a = acc[pr['attributes']['POSITION']]
            if 'min' in a:
                lo = [min(x, y) for x, y in zip(lo, a['min'])]; hi = [max(x, y) for x, y in zip(hi, a['max'])]
    imgs = len(j.get('images', []))
    size = [round(h - l, 2) for l, h in zip(lo, hi)]
    return tris, len(j.get('meshes', [])), len(j.get('materials', [])), imgs, size, len(b)
for p in sys.argv[1:]:
    try:
        t, m, mt, im, sz, by = stat(p)
        print(f'{p.split("/")[-1]:32s} tris={t:6d} meshes={m:3d} mats={mt:2d} imgs={im} size(m)={sz} kb={by//1024}')
    except Exception as e:
        print(p, 'ERR', e)
