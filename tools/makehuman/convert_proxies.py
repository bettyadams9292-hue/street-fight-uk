#!/usr/bin/env python3
"""
Packs MakeHuman proxy assets (clothes, hair, eyebrows, eyelashes, eyes, beards,
glasses...; CC0) for the game's character builder.

    python3 tools/makehuman/convert_proxies.py <list.json> [repo root]

list.json: [{ "id": "polo_shirt", "slot": "top", "mhclo": "/path/x.mhclo", "tags": [...] }, ...]

For each item writes public/models/human/proxies/<id>.bin and adds it to
public/models/human/proxies/catalogue.json:
  - fitting: per proxy vertex, three base-mesh vertices, their weights and an
    offset (MakeHuman units, scaled at runtime by the body's own proportions)
  - the item's mesh split at UV seams, triangulated
  - which body vertices the item hides (no skin poking through)
  - material: colour, textures (converted to WebP, 1024 px at most), alpha
Our own reader of MakeHuman's file formats.
"""
import json, os, struct, sys
from PIL import Image

LIST = json.load(open(sys.argv[1]))
ROOT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(__file__), '..', '..')
OUT = os.path.join(ROOT, 'public', 'models', 'human', 'proxies')
TEX = os.path.join(ROOT, 'public', 'models', 'human', 'tex')
os.makedirs(OUT, exist_ok=True)
os.makedirs(TEX, exist_ok=True)
cat_path = os.path.join(OUT, 'catalogue.json')
catalogue = json.load(open(cat_path)) if os.path.exists(cat_path) else {}


def parse_mhclo(path):
    head = {}
    refs = []
    delete = []
    section = None
    for line in open(path, encoding='utf-8', errors='replace'):
        s = line.strip()
        if not s or s.startswith('#'):
            continue
        p = s.split()
        if p[0] == 'verts':
            section = 'verts'
            continue
        if p[0] == 'delete_verts':
            section = 'delete'
            continue
        if section == 'verts' and p[0][0].isdigit():
            if len(p) == 1:
                refs.append(([int(p[0])] * 3, [1.0, 0.0, 0.0], [0.0, 0.0, 0.0]))
            else:
                refs.append(([int(x) for x in p[0:3]], [float(x) for x in p[3:6]], [float(x) for x in p[6:9]]))
            continue
        if section == 'delete' and (p[0][0].isdigit() or p[0] == '-'):
            # Ranges appear as '12-20', '12 - 20' or '12 -20'.
            toks = ' '.join(p).replace('-', ' - ').split()
            i = 0
            while i < len(toks):
                if i + 2 < len(toks) and toks[i + 1] == '-':
                    delete.extend(range(int(toks[i]), int(toks[i + 2]) + 1))
                    i += 3
                elif toks[i] == '-':
                    i += 1
                else:
                    delete.append(int(toks[i]))
                    i += 1
            continue
        section = None if p[0] not in ('verts', 'delete_verts') else section
        head.setdefault(p[0], []).append(p[1:])
    return head, refs, delete


def parse_obj(path):
    V, VT, faces = [], [], []
    for line in open(path, encoding='utf-8', errors='replace'):
        p = line.split()
        if not p:
            continue
        if p[0] == 'v':
            V.append(p[1:4])
        elif p[0] == 'vt':
            VT.append((float(p[1]), float(p[2])))
        elif p[0] == 'f':
            vs, ts = [], []
            for c in p[1:]:
                a = c.split('/')
                vs.append(int(a[0]) - 1)
                ts.append(int(a[1]) - 1 if len(a) > 1 and a[1] else -1)
            faces.append((vs, ts))
    return len(V), VT, faces


def parse_mhmat(path):
    m = {}
    if not os.path.exists(path):
        return m
    for line in open(path, encoding='utf-8', errors='replace'):
        p = line.strip().split()
        if len(p) >= 2 and not p[0].startswith(('#', '//')):
            m[p[0]] = p[1:]
    return m


def texture(src_dir, rel, out_name, alpha):
    if not rel:
        return None
    path = os.path.normpath(os.path.join(src_dir, rel))
    if not os.path.exists(path):
        alt = os.path.join(src_dir, os.path.basename(rel))
        if not os.path.exists(alt):
            return None
        path = alt
    im = Image.open(path)
    im = im.convert('RGBA' if alpha else 'RGB')
    if max(im.size) > 1024:
        k = 1024 / max(im.size)
        im = im.resize((round(im.size[0] * k), round(im.size[1] * k)), Image.LANCZOS)
    dst = os.path.join(TEX, out_name + '.webp')
    im.save(dst, 'WEBP', quality=86 if alpha else 82, method=6)
    return out_name + '.webp'


for item in LIST:
    mhclo = item['mhclo']
    d = os.path.dirname(mhclo)
    head, refs, delete = parse_mhclo(mhclo)
    obj = os.path.join(d, head['obj_file'][0][0])
    nv, VT, faces = parse_obj(obj)
    if nv != len(refs):
        raise SystemExit(f"{item['id']}: obj has {nv} verts, mhclo {len(refs)}")
    scales = {k: [int(head[k][0][0]), int(head[k][0][1]), float(head[k][0][2])] for k in ('x_scale', 'y_scale', 'z_scale') if k in head}

    rmap, rv, ruv, tris = {}, [], [], []
    for vs, ts in faces:
        ids = []
        for v, t in zip(vs, ts):
            k = (v, t)
            if k not in rmap:
                rmap[k] = len(rv)
                rv.append(v)
                ruv.append(VT[t] if t >= 0 else (0.0, 0.0))
            ids.append(rmap[k])
        for i in range(1, len(ids) - 1):
            tris.extend([ids[0], ids[i], ids[i + 1]])

    mat_rel = head.get('material', [[None]])[0][0]
    mat = parse_mhmat(os.path.join(d, mat_rel)) if mat_rel else {}
    mat_dir = os.path.dirname(os.path.join(d, mat_rel)) if mat_rel else d
    alpha = item.get('alpha', False) or mat.get('transparent', ['False'])[0].lower() == 'true' or item['slot'] in ('hair', 'eyebrows', 'eyelashes', 'beard')
    diffuse = texture(mat_dir, (mat.get('diffuseTexture') or [None])[0], item['id'] + '_d', alpha)
    normal = texture(mat_dir, (mat.get('normalmapTexture') or [None])[0], item['id'] + '_n', False) if not item.get('noNormal') else None
    colour = [float(x) for x in mat.get('diffuseColor', ['1', '1', '1'])[:3]]

    blob = bytearray()
    def put(fmt, values):
        while len(blob) % 4:
            blob.append(0)
        off = len(blob)
        blob.extend(struct.pack('<%d%s' % (len(values), fmt), *values))
        return off
    layout = {
        'refs': put('H', [i for r in refs for i in r[0]]),
        'w': put('f', [w for r in refs for w in r[1]]),
        'off': put('f', [o for r in refs for o in r[2]]),
        'renderProxy': put('H', rv),
        'uv': put('f', [c for t in ruv for c in t]),
        'index': put('I', tris) if len(rv) > 65535 else put('H', tris),
        'delete': put('H', sorted(set(delete))),
    }
    open(os.path.join(OUT, item['id'] + '.bin'), 'wb').write(blob)
    catalogue[item['id']] = {
        'slot': item['slot'], 'name': item.get('name', item['id'].replace('_', ' ')), 'tags': item.get('tags', []),
        'count': len(refs), 'renderCount': len(rv), 'indexCount': len(tris), 'index32': len(rv) > 65535,
        'deleteCount': len(set(delete)), 'scales': scales, 'layout': layout, 'bytes': len(blob),
        'material': {'diffuse': diffuse, 'normal': normal, 'colour': colour, 'alpha': alpha, 'tint': item.get('tint', True)},
        'zDepth': int(head.get('z_depth', [['50']])[0][0]),
        'source': item.get('source', ''),
    }
    print(f"{item['id']:<24} {item['slot']:<9} {len(refs):>6} verts {len(tris)//3:>6} tris  hides {len(set(delete)):>5}  {len(blob)/1024:.0f} KB  tex {diffuse} {normal}")

json.dump(catalogue, open(cat_path, 'w'), indent=1)
