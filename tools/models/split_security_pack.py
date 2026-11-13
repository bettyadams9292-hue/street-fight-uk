"""
Split "Security Set CCTV Low Poly" by MesXwi (CC BY 4.0, Sketchfab) into the
pieces the game uses, each a small .glb in public/models/security.

The original is one 85 MB scene with 2048 px PNG texture sets. Each piece keeps
its colour map (shrunk to 512 px JPEG) and any glow map (128 px). The normal,
roughness and occlusion maps are dropped (flat-shaded low poly doesn't need them).
Positions are baked into game axes: y up, metres, the front faces +z.

    python3 -I tools/models/split_security_pack.py path/to/security_set_cctv_low_poly.glb

Wall pieces have their origin where they meet the wall (z = 0), at their own height.
Post sets stand on y = 0 with the post at the origin.
"""
import io, json, os, struct, sys
import numpy as np
from PIL import Image

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'public', 'models', 'security')

# Blender axes -> game axes.
WALL = np.array([[0, 1, 0], [0, 0, 1], [1, 0, 0]], float)   # the scene's wall faces +x: out of the wall becomes +z
BOX = np.array([[1, 0, 0], [0, 0, 1], [0, -1, 0]], float)   # a box's own mesh sticks out along -y

# name -> (scene nodes, axes, origin in scene coordinates or None for the mesh's own origin)
PIECES = {
    'wall_camera': (['Handle for wall', 'Camera Basic.3'], WALL, (-0.03, 2.52, 1.10)),
    'wall_dome': (['Handle for wall_revers', 'Camera Round'], WALL, (-0.03, 2.84, 1.11)),
    'wall_lamp': (['Lamp for wall - handle', 'Lamp for wall'], WALL, (-0.03, 0.92, 1.11)),
    'alarm_box': (['Alarm box'], WALL, (-0.03, 2.18, 1.11)),
    'keypad': (['Security pad'], WALL, (-0.03, 1.81, 1.11)),
    'motion_sensor': (['Movement sensor'], WALL, (-0.03, 1.52, 1.11)),
    'post_high': (['Post - high', 'Electric Box.1', 'Electric Box OPEN', 'Handle for post.1', 'Camera Basic.1', 'Handle for post_revers', 'Lamp for post.1'], WALL, (0, 0, 0)),
    'post_medium': (['Post - medium', 'Handle big', 'Camera Double', 'Lamp for post.2', 'Electric Box.2', 'Camera Basic.2'], WALL, (0, -2.33, 0)),
    'post_short': (['Post - short', 'Electric Box BROKEN', 'Camera Broken', 'Handle for post.2', 'Handle for post.3', 'Camera Basic.4'], WALL, (0, 3.39, 0)),
    'electric_box': (['Electric Box.1'], BOX, None),
    'electric_box_open': (['Electric Box OPEN'], BOX, None),
    'electric_box_broken': (['Electric Box BROKEN'], BOX, None),
}


def load(path):
    b = open(path, 'rb').read()
    n = struct.unpack('<I', b[12:16])[0]
    js = json.loads(b[20:20 + n])
    return js, b[20 + n + 8:]


def accessor(js, binc, i):
    a = js['accessors'][i]
    v = js['bufferViews'][a['bufferView']]
    comp = {5126: np.float32, 5125: np.uint32, 5123: np.uint16, 5121: np.uint8}[a['componentType']]
    k = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}[a['type']]
    off = v.get('byteOffset', 0) + a.get('byteOffset', 0)
    stride = v.get('byteStride')
    if stride and stride != np.dtype(comp).itemsize * k:
        raw = np.frombuffer(binc, np.uint8, a['count'] * stride, off).reshape(a['count'], stride)
        return raw[:, :np.dtype(comp).itemsize * k].copy().view(comp).reshape(a['count'], k)
    return np.frombuffer(binc, comp, a['count'] * k, off).reshape(a['count'], k) if k > 1 else np.frombuffer(binc, comp, a['count'], off)


def image(js, binc, tex_index, size, fmt):
    img = js['images'][js['textures'][tex_index]['source']]
    v = js['bufferViews'][img['bufferView']]
    data = binc[v.get('byteOffset', 0):v.get('byteOffset', 0) + v['byteLength']]
    im = Image.open(io.BytesIO(data)).convert('RGB').resize((size, size), Image.LANCZOS)
    out = io.BytesIO()
    im.save(out, 'JPEG', quality=82, optimize=True)
    return out.getvalue()


def node_matrix(n):
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


def export(js, binc, name, nodes, axes, origin):
    by_name = {n.get('name'): n for n in js['nodes']}
    bins, views, accessors, prims, mats, images, textures = bytearray(), [], [], [], [], [], []

    def view(data, target=None):
        nonlocal bins
        while len(bins) % 4:
            bins.append(0)
        off = len(bins)
        bins += data
        v = {'buffer': 0, 'byteOffset': off, 'byteLength': len(data)}
        if target:
            v['target'] = target
        views.append(v)
        return len(views) - 1

    mat_cache = {}
    for nn in nodes:
        holder = by_name[nn]
        M = node_matrix(holder) if origin is not None else np.eye(4)
        if origin is not None:
            M[:3, 3] -= origin
        mesh_node = js['nodes'][holder['children'][0]]
        M = M @ node_matrix(mesh_node)
        for p in js['meshes'][mesh_node['mesh']]['primitives']:
            P = accessor(js, binc, p['attributes']['POSITION']).astype(float)
            N = accessor(js, binc, p['attributes']['NORMAL']).astype(float)
            UV = accessor(js, binc, p['attributes']['TEXCOORD_0']).astype(np.float32)
            P = (axes @ (M[:3, :3] @ P.T + M[:3, 3:4])).T.astype(np.float32)
            N = (axes @ (M[:3, :3] @ N.T)).T
            N = (N / (np.linalg.norm(N, axis=1, keepdims=True) + 1e-9)).astype(np.float32)
            idx = accessor(js, binc, p['indices']).astype(np.uint32)
            src = js['materials'][p['material']]
            if src['name'] not in mat_cache:
                m = {'name': src['name'], 'doubleSided': True, 'pbrMetallicRoughness': {'metallicFactor': 0.25, 'roughnessFactor': 0.6}}
                bc = src.get('pbrMetallicRoughness', {}).get('baseColorTexture')
                if bc:
                    images.append({'bufferView': view(image(js, binc, bc['index'], 512, 'JPEG')), 'mimeType': 'image/jpeg'})
                    textures.append({'source': len(images) - 1})
                    m['pbrMetallicRoughness']['baseColorTexture'] = {'index': len(textures) - 1}
                em = src.get('emissiveTexture')
                if em:
                    images.append({'bufferView': view(image(js, binc, em['index'], 128, 'JPEG')), 'mimeType': 'image/jpeg'})
                    textures.append({'source': len(images) - 1})
                    m['emissiveTexture'] = {'index': len(textures) - 1}
                    m['emissiveFactor'] = src.get('emissiveFactor', [1, 1, 1])
                mats.append(m)
                mat_cache[src['name']] = len(mats) - 1
            a0 = len(accessors)
            accessors.append({'bufferView': view(P.tobytes(), 34962), 'componentType': 5126, 'count': len(P), 'type': 'VEC3', 'min': P.min(0).tolist(), 'max': P.max(0).tolist()})
            accessors.append({'bufferView': view(N.tobytes(), 34962), 'componentType': 5126, 'count': len(N), 'type': 'VEC3'})
            accessors.append({'bufferView': view(UV.tobytes(), 34962), 'componentType': 5126, 'count': len(UV), 'type': 'VEC2'})
            accessors.append({'bufferView': view(idx.tobytes(), 34963), 'componentType': 5125, 'count': len(idx), 'type': 'SCALAR'})
            prims.append({'attributes': {'POSITION': a0, 'NORMAL': a0 + 1, 'TEXCOORD_0': a0 + 2}, 'indices': a0 + 3, 'material': mat_cache[src['name']]})
    out = {
        'asset': {'version': '2.0', 'generator': 'street-fight-uk tools/models/split_security_pack.py',
                  'extras': {'title': 'Security Set CCTV Low Poly', 'author': 'MesXwi', 'license': 'CC-BY-4.0'}},
        'scene': 0, 'scenes': [{'nodes': [0]}], 'nodes': [{'mesh': 0, 'name': name}],
        'meshes': [{'primitives': prims}], 'materials': mats, 'images': images, 'textures': textures,
        'samplers': [], 'accessors': accessors, 'bufferViews': views, 'buffers': [{'byteLength': len(bins)}],
    }
    out.pop('samplers')
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
    return path


def main():
    js, binc = load(sys.argv[1])
    os.makedirs(OUT, exist_ok=True)
    for name, (nodes, axes, origin) in PIECES.items():
        path = export(js, binc, name, nodes, axes, None if origin is None else np.array(origin, float))
        print(f'{name:20s} {os.path.getsize(path) // 1024:5d} KB')


if __name__ == '__main__':
    main()
