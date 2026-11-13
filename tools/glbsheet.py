"""
Contact sheet of .glb models, drawn flat-shaded from a three-quarter view, so
asset packs can be compared for style without the game or a browser.

    python3 tools/glbsheet.py out.png model1.glb model2.glb ... [--cols 6] [--size 220]

Reads node transforms, indexed triangles, material colours, vertex colours and
base-colour textures (sampled at each triangle's centre). Painter's algorithm,
so it's for judging looks, not exact depth.
"""
import io, json, math, struct, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont

COMP = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
NCOMP = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}


def load_glb(path):
    data = open(path, 'rb').read()
    magic, ver, length = struct.unpack_from('<III', data, 0)
    assert magic == 0x46546C67, f'{path}: not a glb'
    off = 12
    js = binc = None
    while off < length:
        clen, ctype = struct.unpack_from('<II', data, off)
        chunk = data[off + 8: off + 8 + clen]
        if ctype == 0x4E4F534A:
            js = json.loads(chunk)
        elif ctype == 0x004E4942:
            binc = chunk
        off += 8 + clen
    return js, binc


def accessor(js, binc, i):
    a = js['accessors'][i]
    bv = js['bufferViews'][a['bufferView']]
    dt = np.dtype(COMP[a['componentType']])
    n = NCOMP[a['type']]
    start = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
    stride = bv.get('byteStride', 0)
    if stride and stride != dt.itemsize * n:
        rows = [np.frombuffer(binc, dt, n, start + k * stride) for k in range(a['count'])]
        arr = np.array(rows)
    else:
        arr = np.frombuffer(binc, dt, a['count'] * n, start).reshape(a['count'], n) if n > 1 else np.frombuffer(binc, dt, a['count'], start)
    arr = arr.astype(np.float64)
    if a.get('normalized'):
        arr = arr / float(np.iinfo(dt).max)
    return arr


def mat4(node):
    if 'matrix' in node:
        return np.array(node['matrix'], dtype=float).reshape(4, 4).T
    t = np.array(node.get('translation', [0, 0, 0]), float)
    r = node.get('rotation', [0, 0, 0, 1])
    s = np.array(node.get('scale', [1, 1, 1]), float)
    x, y, z, w = r
    R = np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                  [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                  [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])
    M = np.eye(4)
    M[:3, :3] = R * s
    M[:3, 3] = t
    return M


def textures(js, binc, path):
    import os
    out = {}
    for i, tex in enumerate(js.get('textures', [])):
        img = js['images'][tex['source']]
        raw = None
        if 'bufferView' in img:
            bv = js['bufferViews'][img['bufferView']]
            raw = binc[bv.get('byteOffset', 0): bv.get('byteOffset', 0) + bv['byteLength']]
        elif 'uri' in img and not img['uri'].startswith('data:'):
            f = os.path.join(os.path.dirname(path), img['uri'])
            if os.path.exists(f):
                raw = open(f, 'rb').read()
        if raw:
            out[i] = np.asarray(Image.open(io.BytesIO(raw)).convert('RGB'), dtype=float) / 255
    return out


def triangles(path):
    """World-space triangles with an RGB colour each."""
    js, binc = load_glb(path)
    texs = textures(js, binc, path)
    tris, cols = [], []

    def walk(ni, parent):
        node = js['nodes'][ni]
        M = parent @ mat4(node)
        if 'mesh' in node:
            for prim in js['meshes'][node['mesh']]['primitives']:
                if prim.get('mode', 4) != 4:
                    continue
                P = accessor(js, binc, prim['attributes']['POSITION'])
                P = (M @ np.c_[P, np.ones(len(P))].T).T[:, :3]
                idx = accessor(js, binc, prim['indices']).astype(int) if 'indices' in prim else np.arange(len(P))
                idx = idx.reshape(-1, 3)
                base = np.array([0.8, 0.8, 0.8])
                tex = uv = vc = None
                if 'material' in prim:
                    m = js['materials'][prim['material']]
                    pbr = m.get('pbrMetallicRoughness', {})
                    if m.get('alphaMode') == 'BLEND' and pbr.get('baseColorFactor', [1, 1, 1, 1])[3] < 0.5:
                        continue  # see-through glass: leave it out so you can see what's behind
                    base = np.array(pbr.get('baseColorFactor', [0.8, 0.8, 0.8, 1])[:3])
                    if 'baseColorTexture' in pbr and pbr['baseColorTexture']['index'] in texs and 'TEXCOORD_0' in prim['attributes']:
                        tex = texs[pbr['baseColorTexture']['index']]
                        uv = accessor(js, binc, prim['attributes']['TEXCOORD_0'])
                if 'COLOR_0' in prim['attributes']:
                    vc = accessor(js, binc, prim['attributes']['COLOR_0'])[:, :3]
                for t in idx:
                    tris.append(P[t])
                    c = base.copy()
                    if tex is not None:
                        u, v = uv[t].mean(axis=0)
                        h, w, _ = tex.shape
                        c = c * tex[int((v % 1) * (h - 1)), int((u % 1) * (w - 1))]
                    if vc is not None:
                        c = c * vc[t].mean(axis=0)
                    cols.append(c)
        for ch in node.get('children', []):
            walk(ch, M)

    scene = js['scenes'][js.get('scene', 0)]
    for n in scene['nodes']:
        walk(n, np.eye(4))
    return np.array(tris), np.array(cols)


_KIT = None


def kit_triangles(spec):
    """'polyfork:cafe/bistro-chair' from public/models/polyfork (the game's packed kit)."""
    global _KIT
    import os
    root = os.path.join(os.path.dirname(__file__), '..', 'public', 'models', 'polyfork')
    if _KIT is None:
        _KIT = (json.load(open(os.path.join(root, 'kit.json')))['models'], open(os.path.join(root, 'kit.bin'), 'rb').read())
    models, blob = _KIT
    info = models[spec.split(':', 1)[1]]
    lo, hi = np.array(info['min']), np.array(info['max'])
    tris, cols = [], []
    for name, p in info['parts'].items():
        q = np.frombuffer(blob, np.uint16, p['verts'] * 3, p['pos']).reshape(-1, 3) / 65535.0
        P = lo + q * (hi - lo)
        c8 = np.frombuffer(blob, np.uint8, p['verts'] * 3, p['col']).reshape(-1, 3) / 255.0
        idx = np.frombuffer(blob, np.uint32 if p['wide'] else np.uint16, p['count'], p['idx']).astype(int).reshape(-1, 3)
        for t in idx:
            tris.append(P[t])
            c = c8[t].mean(0)
            if name == 'paint':
                c = np.array([0.55, 0.57, 0.6])
            elif name == 'glass':
                c = np.array([0.62, 0.75, 0.82])
            elif name == 'lit':
                c = np.array([1.0, 0.8, 0.5])
            cols.append(c)
    return np.array(tris), np.array(cols)


def draw(path, size, yaw=-35, pitch=22):
    T, C = kit_triangles(path) if path.startswith('polyfork:') else triangles(path)
    if not len(T):
        return Image.new('RGB', (size, size), (30, 32, 38))
    cy, sy = math.cos(math.radians(yaw)), math.sin(math.radians(yaw))
    cp, sp = math.cos(math.radians(pitch)), math.sin(math.radians(pitch))
    Ry = np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]])
    Rx = np.array([[1, 0, 0], [0, cp, -sp], [0, sp, cp]])
    V = T @ (Rx @ Ry).T
    lo, hi = V.reshape(-1, 3).min(0), V.reshape(-1, 3).max(0)
    ss = 2
    S = size * ss
    scale = 0.84 * S / max(hi[0] - lo[0], hi[1] - lo[1], 1e-6)
    cx, cyy = (lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2
    img = Image.new('RGB', (S, S), (30, 32, 38))
    d = ImageDraw.Draw(img)
    n = np.cross(V[:, 1] - V[:, 0], V[:, 2] - V[:, 0])
    n /= np.linalg.norm(n, axis=1, keepdims=True) + 1e-12
    light = np.array([-0.4, 0.7, 0.6])
    light /= np.linalg.norm(light)
    shade = 0.45 + 0.55 * np.abs(n @ light)
    order = np.argsort(V[:, :, 2].mean(1))
    for i in order:
        pts = [(S / 2 + (p[0] - cx) * scale, S / 2 - (p[1] - cyy) * scale) for p in V[i]]
        c = np.clip(C[i] * shade[i], 0, 1) ** (1 / 2.2)
        col = tuple(int(255 * x) for x in c)
        d.polygon(pts, fill=col)
    return img.resize((size, size), Image.LANCZOS)


def main():
    args = sys.argv[1:]
    cols, size = 6, 220
    if '--cols' in args:
        i = args.index('--cols'); cols = int(args[i + 1]); del args[i:i + 2]
    if '--size' in args:
        i = args.index('--size'); size = int(args[i + 1]); del args[i:i + 2]
    out, files = args[0], args[1:]
    rows = math.ceil(len(files) / cols)
    sheet = Image.new('RGB', (cols * size, rows * (size + 18)), (20, 21, 26))
    d = ImageDraw.Draw(sheet)
    for k, f in enumerate(files):
        x, y = (k % cols) * size, (k // cols) * (size + 18)
        try:
            sheet.paste(draw(f, size), (x, y + 18))
        except Exception as e:
            d.text((x + 4, y + 40), f'error: {e}'[:40], fill=(255, 90, 90))
        d.text((x + 4, y + 3), f.split('/')[-1][:34], fill=(220, 220, 220))
    sheet.save(out)


if __name__ == '__main__':
    main()
