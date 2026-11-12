#!/usr/bin/env python3
"""
Packs the Polyfork low-poly kits into one geometry file for the game.

    python3 tools/polyfork/pack.py <folder holding the unzipped kits> public/models/polyfork

Reads each model's .glb (CC BY 4.0, see CREDITS.txt written beside the pack) and
writes kit.bin + kit.json. Nothing from the kits' .mjs modules is copied: they are
only read here to learn which colour a model uses for its window glass.

What changes on the way in (the "changes made" CC BY asks us to state):
  - every node of a model is flattened into up to four parts: solid, paint
    (a vehicle's bodywork, stored white so the game can respray it), glass
    (see-through panes) and lit (windows and lamps that glow at night)
  - positions are quantised to 16 bits, normals to 8, colours to 8-bit sRGB
  - people, the composed scene files and a few unmistakably American pieces are left out

Needs numpy. No Three.js, no Blender.
"""
import json, os, re, struct, sys
import numpy as np

KITS = {
    'nyc': 'kit-nyc-city-kit',
    'hood': 'kit-neighborhood-pathways-kit',
    'cafe': 'kit-modern-restaurant-cafe',
    'office': 'kit-office',
    'cars': 'kit-racing-cars-kit',
}

# Left out: people (the game has its own), whole composed scenes, and pieces that only belong on an American street.
SKIP = re.compile(r'^(char-.*|scene|terrain|barista|waiter|cafe-customer|seated-worker|standing-caller|visitor-with-badge|neighborhood-child|suburban-resident'
                  r'|yellow-school-bus|veh-police-cruiser|prop-hydrant|prop-mailbox|curbside-mailbox|prop-fire-alarm-box|prop-newspaper-box|prop-payphone'
                  r'|driveway-basketball-hoop|checkered-flag|motel-sign|diner-sign|gas-pump|speaker-post|lanyard-badge|sticky-note-patch|landscape-pebble'
                  r'|backyard-trampoline|above-ground-pool|riding-lawn-tractor|push-lawn-mower|raked-leaf-pile|yard-sign|little-free-library-post)$')

CT = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}


def read_glb(path):
    """Every triangle of the file in model space: positions, normals, linear colours, and which are see-through or glowing."""
    b = open(path, 'rb').read()
    n = struct.unpack_from('<I', b, 12)[0]
    j = json.loads(b[20:20 + n])
    blob = b[20 + n + 8:]

    def acc(i):
        a = j['accessors'][i]
        bv = j['bufferViews'][a['bufferView']]
        dt = np.dtype(CT[a['componentType']])
        nc = NC[a['type']]
        off = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
        stride = bv.get('byteStride', 0)
        if stride and stride != dt.itemsize * nc:
            arr = np.array([np.frombuffer(blob, dt, nc, off + k * stride) for k in range(a['count'])])
        else:
            arr = np.frombuffer(blob, dt, a['count'] * nc, off).reshape(a['count'], nc)
        if a.get('normalized'):
            arr = arr.astype(np.float32) / np.iinfo(dt).max
        return arr

    def mat(nd):
        if 'matrix' in nd:
            return np.array(nd['matrix'], float).reshape(4, 4).T
        T = np.eye(4)
        x, y, z, w = nd.get('rotation', [0, 0, 0, 1])
        R = np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                      [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                      [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])
        T[:3, :3] = R * np.array(nd.get('scale', [1, 1, 1]))
        T[:3, 3] = nd.get('translation', [0, 0, 0])
        return T

    P, N, C, A, E = [], [], [], [], []

    def walk(i, M):
        nd = j['nodes'][i]
        M = M @ mat(nd)
        if 'mesh' in nd:
            for pr in j['meshes'][nd['mesh']]['primitives']:
                p = acc(pr['attributes']['POSITION']).astype(float)
                p = (M[:3, :3] @ p.T).T + M[:3, 3]
                idx = acc(pr['indices']).reshape(-1).astype(np.int64) if 'indices' in pr else np.arange(len(p))
                c = acc(pr['attributes']['COLOR_0']).astype(float)[:, :3] if 'COLOR_0' in pr['attributes'] else np.ones((len(p), 3))
                m = j['materials'][pr['material']] if 'material' in pr else {}
                bc = np.array(m.get('pbrMetallicRoughness', {}).get('baseColorFactor', [1, 1, 1, 1]), float)
                tri = p[idx].reshape(-1, 3, 3)
                fn = np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0])
                ln = np.linalg.norm(fn, axis=1)
                keep = ln > 1e-10
                tri, fn = tri[keep], fn[keep] / ln[keep, None]
                col = (c * bc[:3])[idx].reshape(-1, 3, 3)[keep]
                P.append(tri)
                N.append(fn)
                C.append(col)
                A.append(np.full(len(tri), bc[3] if m.get('alphaMode') == 'BLEND' else 1.0))
                E.append(np.full(len(tri), 1.0 if max(m.get('emissiveFactor', [0, 0, 0])) > 0.05 else 0.0))
        for ch in nd.get('children', []):
            walk(ch, M)

    for r in j['scenes'][j.get('scene', 0)]['nodes']:
        walk(r, np.eye(4))
    return np.concatenate(P), np.concatenate(N), np.concatenate(C), np.concatenate(A), np.concatenate(E), j['asset'].get('copyright', '')


def hex_lin(h):
    c = np.array([int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)])
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def lin_srgb(c):
    c = np.clip(c, 0, 1)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * np.power(c, 1 / 2.4) - 0.055)


def glass_colours(mjs_path, lit_zones):
    """The hex colours a model's module gives its glowing zones (window glass above all)."""
    if not os.path.exists(mjs_path):
        return []
    src = open(mjs_path).read()
    zones = dict(re.findall(r"\b(\w+):\s*'(#[0-9a-fA-F]{6})'", src))
    out = []
    for z in ['glass'] + [z for z in (lit_zones or []) if z != 'glass']:
        if z in zones and z in ('glass', 'hall', 'lens', 'lamp', 'globe'):
            out.append(zones[z])
    return out


def paint_colour(tri, col):
    """A vehicle's bodywork: the colour covering the most surface that is neither glass-dark nor tyre-dark."""
    area = np.linalg.norm(np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0]), axis=1) / 2
    face = col.mean(1)
    key = (lin_srgb(face) * 255).round().astype(int)
    uniq, inv = np.unique(key, axis=0, return_inverse=True)
    tot = np.bincount(inv.reshape(-1), weights=area)
    best, score = None, 0
    for k, u in enumerate(uniq):
        mx, mn = u.max() / 255, u.min() / 255
        sat = (mx - mn) / (mx + 1e-6)
        if mx < 0.3:
            continue
        s = tot[k] * (0.4 + sat)
        if s > score:
            best, score = u, s
    return best


def hash01(a, b, c):
    h = (int(a) * 73856093) ^ (int(b) * 19349663) ^ (int(c) * 83492791)
    h = (h ^ (h >> 13)) * 1274126177 & 0xFFFFFFFF
    return ((h ^ (h >> 16)) & 0xFFFF) / 65535.0


def main(src, out):
    os.makedirs(out, exist_ok=True)
    folders = {k: next((os.path.join(src, d) for d in sorted(os.listdir(src)) if v in d and os.path.isdir(os.path.join(src, d))), None) for k, v in KITS.items()}
    blob = bytearray()
    models = {}
    credits = []

    def put(arr):
        while len(blob) % 4:
            blob.append(0)
        off = len(blob)
        blob.extend(arr.tobytes())
        return off

    for kit, folder in folders.items():
        if not folder:
            print('missing kit', kit)
            continue
        parts_meta = json.load(open(os.path.join(folder, 'PARTS.json')))
        for f in sorted(os.listdir(folder)):
            if not f.endswith('.glb'):
                continue
            name = f[:-4]
            if SKIP.match(name):
                continue
            tri, fn, col, alpha, emis, credit = read_glb(os.path.join(folder, f))
            meta = parts_meta.get(name, {})
            is_vehicle = meta.get('class') == 'vehicle' or name.startswith('veh-') or re.search(r'(sedan|coupe|van|car|wagon|truck|suv|hatchback|convertible|minivan)', name) is not None and np.ptp(tri.reshape(-1, 3)[:, 2]) > 3
            is_building = meta.get('class') == 'building' or name.startswith('bldg-') or re.search(r'(house|cottage|townhouse|storefront-unit|restaurant-unit|detached-garage|garden-shed|coffee-kiosk)', name) is not None
            face = col.mean(1)
            part = np.zeros(len(tri), int)  # 0 solid, 1 paint, 2 glass, 3 lit
            part[alpha < 0.99] = 2
            part[(emis > 0) & (part == 0)] = 3
            paint = None
            if is_vehicle:
                pc = paint_colour(tri, col)
                if pc is not None:
                    key = (lin_srgb(face) * 255).round().astype(int)
                    hit = (np.abs(key - pc).max(1) <= 2) & (part == 0)
                    if hit.sum() >= 8:
                        part[hit] = 1
                        paint = '#%02x%02x%02x' % tuple(int(v) for v in pc)
            windows = 0
            for hx in glass_colours(os.path.join(folder, name + '.mjs'), meta.get('lit')):
                hit = (np.abs(face - hex_lin(hx)).max(1) < 0.006) & (part == 0)
                if not hit.any() or is_vehicle:
                    continue
                cen = tri[hit].mean(1)
                # Shop windows at street level always glow; upstairs, about four panes in ten are lit.
                on = np.array([c[1] < 3.2 and is_building or hash01(round(c[0] / 1.1), round(c[1] / 1.4), round(c[2] / 1.1)) < 0.42 for c in cen])
                idx = np.where(hit)[0]
                part[idx[on]] = 3
                windows += int(on.sum())
            flat = tri.reshape(-1, 3)
            mn, mx = flat.min(0), flat.max(0)
            span = np.maximum(mx - mn, 1e-6)
            entry = {'kit': kit, 'min': [round(float(v), 4) for v in mn], 'max': [round(float(v), 4) for v in mx], 'parts': {}, 'tris': int(len(tri))}
            # Where the front wall stands (the plane most of the +z-facing surface lies on) and how far
            # anything at ground level (steps, railings) sticks out past it. The street planner sets buildings back by these.
            facing = fn[:, 2] > 0.9
            if facing.any():
                area = np.linalg.norm(np.cross(tri[facing, 1] - tri[facing, 0], tri[facing, 2] - tri[facing, 0]), axis=1) / 2
                zc = tri[facing].mean(1)[:, 2]
                bins = np.round(zc / 0.05).astype(int)
                ub, inv2 = np.unique(bins, return_inverse=True)
                entry['wall'] = round(float(ub[np.argmax(np.bincount(inv2.reshape(-1), weights=area))] * 0.05), 3)
            low = flat[flat[:, 1] < 1.2]
            if len(low):
                entry['foot'] = round(float(low[:, 2].max()), 3)
            if paint:
                entry['paint'] = paint
            if is_building:
                entry['building'] = True
            for pi, pname in enumerate(['solid', 'paint', 'glass', 'lit']):
                sel = part == pi
                if not sel.any():
                    continue
                t = tri[sel].reshape(-1, 3)
                q = np.round((t - mn) / span * 65535).astype(np.uint16)
                nrm = np.round(np.repeat(fn[sel], 3, axis=0) * 127).astype(np.int8)
                c = col[sel].reshape(-1, 3)
                if pname == 'paint':
                    c = np.ones_like(c)
                c8 = np.round(lin_srgb(c) * 255).astype(np.uint8)
                # Weld identical vertices so the file is indexed.
                rec = np.concatenate([q.astype(np.int32), nrm.astype(np.int32), c8.astype(np.int32)], axis=1)
                uniq, inv = np.unique(rec, axis=0, return_inverse=True)
                inv = inv.reshape(-1)
                uq = uniq[:, 0:3].astype(np.uint16)
                un = uniq[:, 3:6].astype(np.int8)
                uc = uniq[:, 6:9].astype(np.uint8)
                wide = len(uniq) > 65535
                ia = inv.astype(np.uint32 if wide else np.uint16)
                p = {'verts': int(len(uniq)), 'count': int(len(ia)), 'wide': bool(wide), 'pos': put(uq), 'nrm': put(un), 'col': put(uc), 'idx': put(ia)}
                if pname == 'glass':
                    p['alpha'] = round(float(alpha[sel].mean()), 3)
                entry['parts'][pname] = p
            models[f'{kit}/{name}'] = entry
            if credit:
                credits.append(f'{kit}/{name}  {credit}')
            print(f'{kit}/{name:34s} tris {len(tri):5d}  {" ".join(f"{k}:{v['count'] // 3}" for k, v in entry["parts"].items())}{"  paint " + paint if paint else ""}{"  lit windows " + str(windows) if windows else ""}')

    open(os.path.join(out, 'kit.bin'), 'wb').write(bytes(blob))
    # Sizes for the street planner (src/city/street.ts), which must not load the geometry to lay a street out.
    here = os.path.dirname(os.path.abspath(__file__))
    with open(os.path.join(here, '..', '..', 'src', 'city', 'polyKitMetrics.ts'), 'w') as fh:
        fh.write('/** Generated by tools/polyfork/pack.py from the packed models. Do not edit by hand. */\n')
        fh.write('/** [min x, min y, min z, max x, max y, max z, foot]: the box of each model in metres, and how far forward it reaches at ground level. */\n')
        fh.write('export const KIT_METRICS: Record<string, readonly [number, number, number, number, number, number, number]> = {\n')
        for k, m in models.items():
            vals = [*m['min'], *m['max'], m.get('foot', m['max'][2])]
            fh.write(f"  '{k}': [{', '.join(f'{v:.3f}'.rstrip('0').rstrip('.') for v in vals)}],\n")
        fh.write('};\n')
    json.dump({'version': 1, 'models': models}, open(os.path.join(out, 'kit.json'), 'w'), separators=(',', ':'))
    with open(os.path.join(out, 'CREDITS.txt'), 'w') as fh:
        fh.write('Low-poly city, neighbourhood, cafe, office and vehicle models by Polyfork (https://polyfork.dev), used under CC BY 4.0\n')
        fh.write('https://creativecommons.org/licenses/by/4.0/\n\n')
        fh.write('Changes made: the models were repacked into one file (kit.bin, index in kit.json) by tools/polyfork/pack.py.\n')
        fh.write('Each model is flattened into solid, paint, glass and lit parts; positions, normals and colours are quantised;\n')
        fh.write('vehicle bodywork is stored white so the game can respray it; some upstairs windows are marked as lit.\n')
        fh.write('In the game some models are also tinted, scaled or mirrored.\n\n')
        fh.write('One line per model, as its author asks:\n\n')
        for c in credits:
            fh.write(c + '\n')
    print(f'\n{len(models)} models, {sum(m["tris"] for m in models.values())} triangles, kit.bin {len(blob) / 1e6:.2f} MB')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
