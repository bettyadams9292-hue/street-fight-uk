#!/usr/bin/env python3
"""
Converts the Quaternius Downtown City MegaKit (Standard, CC0) into the game's
compact city kit:

    public/models/city/kit.json   piece index: size, bounds, one entry per material
    public/models/city/kit.bin    all vertex data (float32 position/normal/uv, uint16/32 indices)
    public/models/city/tex/*.webp textures at 1024 px

Usage:
    python3 tools/megakit/convert.py "<extracted kit folder>" [repo root]

Only the kit's own data files are read. Interior-only pieces (floors, interior
walls) and the three example buildings are left out: the game builds its own
buildings from the modules.
"""
import json, math, os, struct, sys
from PIL import Image

KIT = sys.argv[1]
ROOT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(__file__), '..', '..')
SRC = os.path.join(KIT, 'Exports', 'glTF (Godot)')
OUT = os.path.join(ROOT, 'public', 'models', 'city')
TEX_OUT = os.path.join(OUT, 'tex')
SKIP_PREFIX = ('Brick_InteriorWall', 'Floor_', 'Building_')
TEX_SIZE = 1024

COMP = {5120: ('b', 1), 5121: ('B', 1), 5122: ('h', 2), 5123: ('H', 2), 5125: ('I', 4), 5126: ('f', 4)}
NCOMP = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}


def read_accessor(j, bins, idx):
    a = j['accessors'][idx]
    bv = j['bufferViews'][a['bufferView']]
    fmt, size = COMP[a['componentType']]
    n = NCOMP[a['type']]
    stride = bv.get('byteStride', size * n)
    base = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
    data = bins[bv['buffer']]
    out = []
    for i in range(a['count']):
        o = base + i * stride
        out.append(struct.unpack_from('<' + fmt * n, data, o))
    return out


def quat_rot(q, v):
    x, y, z, w = q
    vx, vy, vz = v
    # v' = v + 2w(q x v) + 2 q x (q x v)
    cx, cy, cz = y * vz - z * vy, z * vx - x * vz, x * vy - y * vx
    cx2, cy2, cz2 = y * cz - z * cy, z * cx - x * cz, x * cy - y * cx
    return (vx + 2 * (w * cx + cx2), vy + 2 * (w * cy + cy2), vz + 2 * (w * cz + cz2))


def main():
    os.makedirs(TEX_OUT, exist_ok=True)
    blob = bytearray()

    def put(fmt, values):
        while len(blob) % 4:
            blob.append(0)
        off = len(blob)
        blob.extend(struct.pack('<%d%s' % (len(values), fmt), *values))
        return off

    pieces = {}
    materials = {}
    textures = set()
    for name in sorted(os.listdir(SRC)):
        if not name.endswith('.gltf'):
            continue
        pid = name[:-5]
        if pid.startswith(SKIP_PREFIX):
            continue
        j = json.load(open(os.path.join(SRC, name)))
        bins = [open(os.path.join(SRC, b['uri']), 'rb').read() for b in j['buffers']]
        prims = []
        lo = [1e9] * 3
        hi = [-1e9] * 3
        for node in j['nodes']:
            if 'mesh' not in node:
                continue
            t = node.get('translation', [0, 0, 0])
            r = node.get('rotation', [0, 0, 0, 1])
            s = node.get('scale', [1, 1, 1])
            for p in j['meshes'][node['mesh']]['primitives']:
                mat = j['materials'][p['material']] if 'material' in p else {'name': 'MI_Trim'}
                mname = mat['name']
                pb = mat.get('pbrMetallicRoughness', {})
                if mname not in materials:
                    def tex(tinfo):
                        if not tinfo:
                            return None
                        uri = j['images'][j['textures'][tinfo['index']]['source']]['uri']
                        textures.add(uri)
                        return os.path.splitext(uri)[0] + '.webp'
                    materials[mname] = {
                        'map': tex(pb.get('baseColorTexture')),
                        'orm': tex(pb.get('metallicRoughnessTexture')),
                        'normal': tex(mat.get('normalTexture')),
                        'color': pb.get('baseColorFactor', [1, 1, 1, 1]),
                        'roughness': pb.get('roughnessFactor', 1),
                        'blend': mat.get('alphaMode') == 'BLEND',
                    }
                pos = read_accessor(j, bins, p['attributes']['POSITION'])
                nrm = read_accessor(j, bins, p['attributes']['NORMAL']) if 'NORMAL' in p['attributes'] else [(0, 1, 0)] * len(pos)
                uv = read_accessor(j, bins, p['attributes']['TEXCOORD_0']) if 'TEXCOORD_0' in p['attributes'] else [(0, 0)] * len(pos)
                idx = [i[0] for i in read_accessor(j, bins, p['indices'])] if 'indices' in p else list(range(len(pos)))
                P = []
                N = []
                for v in pos:
                    v = quat_rot(r, (v[0] * s[0], v[1] * s[1], v[2] * s[2]))
                    v = (v[0] + t[0], v[1] + t[1], v[2] + t[2])
                    P.extend(v)
                    for k in range(3):
                        lo[k] = min(lo[k], v[k])
                        hi[k] = max(hi[k], v[k])
                for n in nrm:
                    n = quat_rot(r, n)
                    L = math.sqrt(n[0] ** 2 + n[1] ** 2 + n[2] ** 2) or 1
                    N.extend((n[0] / L, n[1] / L, n[2] / L))
                U = [c for u in uv for c in u]
                big = len(pos) > 65535
                prims.append({
                    'mat': mname,
                    'count': len(pos),
                    'pos': put('f', P),
                    'nrm': put('f', N),
                    'uv': put('f', U),
                    'idx': put('I' if big else 'H', idx),
                    'icount': len(idx),
                    'i32': big,
                })
        pieces[pid] = {'min': [round(x, 4) for x in lo], 'max': [round(x, 4) for x in hi], 'prims': prims}

    with open(os.path.join(OUT, 'kit.bin'), 'wb') as f:
        f.write(blob)
    with open(os.path.join(OUT, 'kit.json'), 'w') as f:
        json.dump({'source': 'Quaternius Downtown City MegaKit (Standard), CC0 1.0', 'bytes': len(blob), 'materials': materials, 'pieces': pieces}, f, separators=(',', ':'))

    tdir = os.path.join(KIT, 'Textures')
    total = 0
    # Window interiors: only the example buildings reference them, but every window uses them in the game.
    textures.update({'T_lit_interior_1.png', 'T_lit_interior_2.png', 'T_dark_interior.png'})
    for uri in sorted(textures):
        im = Image.open(os.path.join(tdir, uri))
        keep_alpha = 'Decals' in uri or 'interior' in uri.lower()
        im = im.convert('RGBA' if keep_alpha else 'RGB')
        if max(im.size) > TEX_SIZE:
            im = im.resize((TEX_SIZE, TEX_SIZE), Image.LANCZOS)
        dst = os.path.join(TEX_OUT, os.path.splitext(uri)[0] + '.webp')
        im.save(dst, 'WEBP', quality=82, method=6, lossless=False)
        total += os.path.getsize(dst)
    print('pieces', len(pieces), 'materials', len(materials), 'geometry', len(blob), 'bytes', 'textures', len(textures), total, 'bytes')


if __name__ == '__main__':
    main()
