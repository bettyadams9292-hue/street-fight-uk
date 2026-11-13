"""
Turn a dense scanned/AI-generated .glb (hundreds of thousands of triangles, a
colour texture) into a light flat-shaded low-poly model the game can draw by
the dozen: vertex clustering on a grid, then each surviving triangle takes the
average texture colour of the triangles merged into it.

    python3 -I tools/models/decimate_plant.py in.glb out.glb --height 1.1 --cells 34

--height  real height in metres (the model is scaled to it, standing on y = 0)
--cells   grid cells across the model's height: fewer cells, fewer triangles

Used for the cannabis plant ("Cannabis Plant 0nE" by -X-ScornGames, CC BY 4.0).
No other tools needed: numpy and Pillow only.
"""
import io, json, os, struct, sys
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lowpoly import Model  # noqa: E402


def load(path):
    b = open(path, 'rb').read()
    n = struct.unpack('<I', b[12:16])[0]
    return json.loads(b[20:20 + n]), b[20 + n + 8:]


def accessor(js, binc, i):
    a = js['accessors'][i]
    v = js['bufferViews'][a['bufferView']]
    comp = {5126: np.float32, 5125: np.uint32, 5123: np.uint16, 5121: np.uint8}[a['componentType']]
    k = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}[a['type']]
    off = v.get('byteOffset', 0) + a.get('byteOffset', 0)
    arr = np.frombuffer(binc, comp, a['count'] * k, off)
    return arr.reshape(a['count'], k) if k > 1 else arr


def mat4(n):
    if 'matrix' in n:
        return np.array(n['matrix'], float).reshape(4, 4).T
    M = np.eye(4)
    if 'scale' in n:
        M[:3, :3] *= np.array(n['scale'])
    if 'translation' in n:
        M[:3, 3] = n['translation']
    return M


def triangles(js, binc):
    """World triangles, with the UV centroid of each."""
    tex = js['materials'][0]['pbrMetallicRoughness']['baseColorTexture']['index']
    img = js['images'][js['textures'][tex]['source']]
    v = js['bufferViews'][img['bufferView']]
    im = np.asarray(Image.open(io.BytesIO(binc[v.get('byteOffset', 0):v.get('byteOffset', 0) + v['byteLength']])).convert('RGB'), float) / 255
    tris, cols = [], []

    def walk(i, M):
        n = js['nodes'][i]
        M = M @ mat4(n)
        if 'mesh' in n:
            for p in js['meshes'][n['mesh']]['primitives']:
                P = accessor(js, binc, p['attributes']['POSITION']).astype(float)
                P = (M[:3, :3] @ P.T).T + M[:3, 3]
                UV = accessor(js, binc, p['attributes']['TEXCOORD_0']).astype(float)
                idx = accessor(js, binc, p['indices']).astype(np.int64).reshape(-1, 3)
                uv = UV[idx].mean(1)
                h, w, _ = im.shape
                c = im[(np.clip(uv[:, 1], 0, 1) * (h - 1)).astype(int), (np.clip(uv[:, 0], 0, 1) * (w - 1)).astype(int)]
                tris.append(P[idx])
                cols.append(c)
        for ch in n.get('children', []):
            walk(ch, M)

    for r in js['scenes'][js.get('scene', 0)]['nodes']:
        walk(r, np.eye(4))
    return np.concatenate(tris), np.concatenate(cols)


def cluster(T, C, cells):
    lo, hi = T.reshape(-1, 3).min(0), T.reshape(-1, 3).max(0)
    size = (hi[1] - lo[1]) / cells
    V = T.reshape(-1, 3)
    key = np.floor((V - lo) / size).astype(np.int64)
    flat = key[:, 0] * 1_000_000 + key[:, 1] * 1_000 + key[:, 2]
    uniq, inv = np.unique(flat, return_inverse=True)
    rep = np.zeros((len(uniq), 3))
    np.add.at(rep, inv, V)
    rep /= np.bincount(inv)[:, None]
    F = inv.reshape(-1, 3)
    keep = (F[:, 0] != F[:, 1]) & (F[:, 1] != F[:, 2]) & (F[:, 0] != F[:, 2])
    F, C = F[keep], C[keep]
    # Merge duplicates (same three clusters, either winding), averaging their colour.
    s = np.sort(F, axis=1)
    k = s[:, 0] * 10**12 + s[:, 1] * 10**6 + s[:, 2]
    u, first, inv2 = np.unique(k, return_index=True, return_inverse=True)
    col = np.zeros((len(u), 3))
    np.add.at(col, inv2, C)
    col /= np.bincount(inv2)[:, None]
    return rep, F[first], col


def main():
    args = sys.argv[1:]
    src, out = args[0], args[1]
    height = float(args[args.index('--height') + 1]) if '--height' in args else 1.0
    cells = int(args[args.index('--cells') + 1]) if '--cells' in args else 34
    js, binc = load(src)
    T, C = triangles(js, binc)
    V, F, col = cluster(T, C, cells)
    lo, hi = V.min(0), V.max(0)
    s = height / (hi[1] - lo[1])
    V = (V - [(lo[0] + hi[0]) / 2, lo[1], (lo[2] + hi[2]) / 2]) * s
    m = Model()
    lin = np.where(col <= 0.04045, col / 12.92, ((col + 0.055) / 1.055) ** 2.4)  # sRGB texture -> linear vertex colour
    for f, c in zip(F, lin):
        m.tris['solid'].append((V[f], c.tolist()))
    m.save(out)
    print(f'{len(T)} -> {len(F)} triangles, {os.path.getsize(out) // 1024} KB, size {np.round(V.max(0) - V.min(0), 2)}')


if __name__ == '__main__':
    main()
