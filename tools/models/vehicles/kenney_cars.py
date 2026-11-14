"""Re-export Kenney Car Kit (CC0) cars for Street Fight UK.
- drops tangents and KHR_texture_transform
- splits the body into three materials: 'kit' (colormap), 'paint' (colormap, neutral swatch, tinted in game), 'window' (dark glass)
- writes Textures/colormap.png with neutral grey copies of the paint swatches in the unused black corner of row 0
"""
import sys, os, numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from glbio import read, acc, Writer
from PIL import Image
SRC = (sys.argv[2] if len(sys.argv) > 2 else '/tmp/pack-carkit') + '/Models/GLB format/'
OUT = sys.argv[1]
os.makedirs(OUT + '/Textures', exist_ok=True)
cm = np.array(Image.open(SRC + 'Textures/colormap.png').convert('RGBA')).astype(np.float32)
# Neutral swatches: paint column c (row 1) -> column NEUTRAL[c] in row 0 (black / unused there).
NEUTRAL = {c: 6 + i for i, c in enumerate(range(4, 14))}  # cols 4..13 -> 6..15
NEUTRAL[14] = 15; NEUTRAL[15] = 15
out = cm.copy()
for c in range(4, 16):
    sw = cm[128:256, c*32:(c+1)*32, :3]
    lum = sw @ np.array([0.299, 0.587, 0.114])
    g = np.clip(lum / lum.max(), 0, 1) * 255
    n = NEUTRAL[c]
    if c in (14,):
        continue
    out[0:128, n*32:(n+1)*32, 0] = g; out[0:128, n*32:(n+1)*32, 1] = g; out[0:128, n*32:(n+1)*32, 2] = g; out[0:128, n*32:(n+1)*32, 3] = 255
Image.fromarray(out.astype(np.uint8)).save(OUT + '/Textures/colormap.png', optimize=True)

def mats(w):
    tex = {'index': 0}
    kit = w.material({'name': 'kit', 'pbrMetallicRoughness': {'baseColorTexture': tex, 'metallicFactor': 0.0, 'roughnessFactor': 0.8}})
    paint = w.material({'name': 'paint', 'pbrMetallicRoughness': {'baseColorTexture': tex, 'metallicFactor': 0.25, 'roughnessFactor': 0.4}})
    win = w.material({'name': 'window', 'pbrMetallicRoughness': {'baseColorFactor': [0.06, 0.08, 0.13, 1], 'metallicFactor': 0.1, 'roughnessFactor': 0.45}})
    w.j['images'] = [{'uri': 'Textures/colormap.png', 'name': 'colormap'}]
    w.j['samplers'] = [{'magFilter': 9729, 'minFilter': 9987}]
    w.j['textures'] = [{'sampler': 0, 'source': 0}]
    return kit, paint, win

def sub(pos, nrm, uv, tris):
    if len(tris) == 0: return None
    used, inv = np.unique(tris.ravel(), return_inverse=True)
    return pos[used], nrm[used], uv[used].copy(), inv.reshape(-1, 3)

def convert(name, outname, glass_cols=((1, 3),)):
    j, b = read(SRC + name + '.glb')
    w = Writer(); kit, paint, win = mats(w)
    w.j['scenes'][0]['name'] = outname
    report = {}
    roots = set(j['scenes'][0]['nodes'])
    newidx = {}
    for ni, nd in enumerate(j['nodes']):
        m = j['meshes'][nd['mesh']]; p = m['primitives'][0]
        pos = acc(j, b, p['attributes']['POSITION']); nrm = acc(j, b, p['attributes']['NORMAL'])
        uv = acc(j, b, p['attributes']['TEXCOORD_0']).copy(); idx = acc(j, b, p['indices']).reshape(-1, 3)
        prims = []
        if not m['name'].startswith('wheel'):
            c = np.clip((uv[idx].mean(1) * 512).astype(int), 0, 511)
            col, row = c[:, 0] // 32, c[:, 1] // 128
            is_paint = (row == 1) & (col >= 4)
            is_glass = np.zeros(len(idx), bool)
            for gc, gr in glass_cols: is_glass |= (col == gc) & (row == gr)
            rest = ~is_paint & ~is_glass
            report[m['name']] = {'paint': int(is_paint.sum()), 'glass': int(is_glass.sum()), 'kit': int(rest.sum())}
            s = sub(pos, nrm, uv, idx[rest]); prims.append((*s[:3], s[3], kit))
            s = sub(pos, nrm, uv, idx[is_paint])
            if s:
                u = s[2]
                pc = np.clip((u[:, 0] * 512).astype(int) // 32, 4, 15)
                u[:, 0] = u[:, 0] + (np.vectorize(NEUTRAL.get)(pc) - pc) * 32 / 512
                u[:, 1] = u[:, 1] - 128 / 512
                prims.append((s[0], s[1], u, s[3], paint))
            s = sub(pos, nrm, uv, idx[is_glass])
            if s: prims.append((s[0], s[1], None, s[3], win))
        else:
            prims.append((pos, nrm, uv, idx, kit))
        mi = w.mesh(m['name'], prims)
        n = {'name': nd['name'], 'mesh': mi}
        for k in ('translation', 'rotation', 'scale'):
            if k in nd: n[k] = nd[k]
        if 'children' in nd: n['children'] = nd['children']
        newidx[ni] = w.node(n, root=ni in roots)
    assert all(newidx[i] == i for i in newidx)
    w.save(f'{OUT}/{outname}.glb')
    print(outname, report)

for n in ['hatchback-sports', 'sedan', 'sedan-sports', 'suv', 'suv-luxury', 'truck']:
    convert(n, n)
