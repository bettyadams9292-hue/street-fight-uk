"""
Split "Low-Poly PSX Style Essential Doors Pack" by vanillao03 (CC BY 4.0,
Sketchfab) into one .glb per door: frame, leaf (or leaves), handle and any
glass, closed, in public/models/doors.

    python3 -I tools/models/split_doors_pack.py path/to/low-poly_psx_style_essential_doors_pack.glb

Each door stands on y = 0, centred on x, with its face to +z and the frame's
back at z = 0 (so it sits flush on a wall). Sizes are the pack's own, about
0.9 x 1.95 m. The shared texture atlas is kept (as JPEG) with nearest-pixel
filtering for the PSX look.
"""
import io, json, os, struct, sys
import numpy as np
from PIL import Image

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'public', 'models', 'doors')

DOORS = {
    'door_front': ['Front Door_006.001', 'Front Doorframe_003.001'],
    'door_wooden': ['Wooden Door_001.001', 'Wooden Doorframe_001.002'],
    'door_panel': ['Wooden Door_009.001', 'Wooden Doorframe_009.002'],
    'door_worn': ['Worn Door_004.001', 'Worn Doorframe_004.001'],
    'door_bathroom': ['Bathroom Door_002.001', 'Bathroom Doorframe_001.001'],
    'door_closet': ['Closet Door_001.001', 'Closet Door_002.001', 'Closet Doorframe_001.001'],
}


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
    if 'rotation' in n:
        x, y, z, w = n['rotation']
        M[:3, :3] = [[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)], [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)], [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]]
    if 'scale' in n:
        M[:3, :3] = M[:3, :3] * np.array(n['scale'])
    if 'translation' in n:
        M[:3, 3] = n['translation']
    return M


def world_matrices(js):
    W = {}

    def walk(i, P):
        M = P @ mat4(js['nodes'][i])
        W[i] = M
        for c in js['nodes'][i].get('children', []):
            walk(c, M)

    for r in js['scenes'][js.get('scene', 0)]['nodes']:
        walk(r, np.eye(4))
    return W


def subtree(js, i):
    out = [i]
    for c in js['nodes'][i].get('children', []):
        out += subtree(js, c)
    return out


def main():
    js, binc = load(sys.argv[1])
    W = world_matrices(js)
    by_name = {n.get('name'): i for i, n in enumerate(js['nodes'])}
    img = js['images'][0]
    v = js['bufferViews'][img['bufferView']]
    atlas = io.BytesIO()
    Image.open(io.BytesIO(binc[v.get('byteOffset', 0):v.get('byteOffset', 0) + v['byteLength']])).convert('RGB').save(atlas, 'JPEG', quality=90)
    atlas = atlas.getvalue()
    os.makedirs(OUT, exist_ok=True)
    for name, roots in DOORS.items():
        parts = []  # (P, N, UV, idx, material)
        for r in roots:
            for i in subtree(js, by_name[r]):
                n = js['nodes'][i]
                if 'mesh' not in n:
                    continue
                M = W[i]
                for p in js['meshes'][n['mesh']]['primitives']:
                    P = accessor(js, binc, p['attributes']['POSITION']).astype(float)
                    N = accessor(js, binc, p['attributes']['NORMAL']).astype(float)
                    uv = accessor(js, binc, p['attributes']['TEXCOORD_0']).astype(np.float32) if 'TEXCOORD_0' in p['attributes'] else np.zeros((len(P), 2), np.float32)
                    P = (M[:3, :3] @ P.T).T + M[:3, 3]
                    N = (np.linalg.inv(M[:3, :3]).T @ N.T).T
                    N /= np.linalg.norm(N, axis=1, keepdims=True) + 1e-9
                    parts.append([P, N, uv, accessor(js, binc, p['indices']).astype(np.uint32), js['materials'][p['material']]['name']])
        allp = np.concatenate([p[0] for p in parts])
        lo, hi = allp.min(0), allp.max(0)
        # Thin axis is the door's depth: turn it to z if it's x.
        size = hi - lo
        R = np.eye(3)
        if size[0] < size[2]:
            R = np.array([[0, 0, -1], [0, 1, 0], [1, 0, 0]], float)
        for p in parts:
            p[0] = (R @ p[0].T).T
            p[1] = (R @ p[1].T).T
        allp = np.concatenate([p[0] for p in parts])
        lo, hi = allp.min(0), allp.max(0)
        shift = np.array([(lo[0] + hi[0]) / 2, lo[1], lo[2]])
        bins, views, accessors, prims = bytearray(), [], [], []

        def view(data, target=None):
            nonlocal bins
            while len(bins) % 4:
                bins.append(0)
            off = len(bins)
            bins += data
            vv = {'buffer': 0, 'byteOffset': off, 'byteLength': len(data)}
            if target:
                vv['target'] = target
            views.append(vv)
            return len(views) - 1

        mats = [
            {'name': 'door', 'doubleSided': True, 'pbrMetallicRoughness': {'baseColorTexture': {'index': 0}, 'metallicFactor': 0.0, 'roughnessFactor': 0.8}},
            {'name': 'glass', 'doubleSided': True, 'alphaMode': 'BLEND', 'pbrMetallicRoughness': {'baseColorFactor': [0.08, 0.1, 0.12, 0.35], 'metallicFactor': 0.1, 'roughnessFactor': 0.1}},
        ]
        for P, N, uv, idx, mname in parts:
            P = (P - shift).astype(np.float32)
            N = N.astype(np.float32)
            a0 = len(accessors)
            accessors.append({'bufferView': view(P.tobytes(), 34962), 'componentType': 5126, 'count': len(P), 'type': 'VEC3', 'min': P.min(0).tolist(), 'max': P.max(0).tolist()})
            accessors.append({'bufferView': view(N.tobytes(), 34962), 'componentType': 5126, 'count': len(N), 'type': 'VEC3'})
            accessors.append({'bufferView': view(uv.tobytes(), 34962), 'componentType': 5126, 'count': len(uv), 'type': 'VEC2'})
            accessors.append({'bufferView': view(idx.tobytes(), 34963), 'componentType': 5125, 'count': len(idx), 'type': 'SCALAR'})
            prims.append({'attributes': {'POSITION': a0, 'NORMAL': a0 + 1, 'TEXCOORD_0': a0 + 2}, 'indices': a0 + 3, 'material': 1 if mname == 'Glass_Plane' else 0})
        img_view = view(atlas)
        out = {
            'asset': {'version': '2.0', 'generator': 'street-fight-uk tools/models/split_doors_pack.py',
                      'extras': {'title': 'Low-Poly PSX Style Essential Doors Pack', 'author': 'vanillao03', 'license': 'CC-BY-4.0'}},
            'scene': 0, 'scenes': [{'nodes': [0]}], 'nodes': [{'mesh': 0, 'name': name}],
            'meshes': [{'primitives': prims}], 'materials': mats,
            'images': [{'bufferView': img_view, 'mimeType': 'image/jpeg'}],
            'samplers': [{'magFilter': 9728, 'minFilter': 9986, 'wrapS': 10497, 'wrapT': 10497}],
            'textures': [{'sampler': 0, 'source': 0}],
            'accessors': accessors, 'bufferViews': views, 'buffers': [{'byteLength': len(bins)}],
        }
        j = json.dumps(out, separators=(',', ':')).encode()
        while len(j) % 4:
            j += b' '
        while len(bins) % 4:
            bins.append(0)
        path = os.path.join(OUT, f'{name}.glb')
        with open(path, 'wb') as f:
            f.write(struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(j) + 8 + len(bins)))
            f.write(struct.pack('<II', len(j), 0x4E4F534A) + j)
            f.write(struct.pack('<II', len(bins), 0x004E4942) + bytes(bins))
        print(f'{name:14s} {os.path.getsize(path) // 1024:4d} KB  size {np.round(hi - lo, 2)}')


if __name__ == '__main__':
    main()
