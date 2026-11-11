#!/usr/bin/env python3
"""
Builds the game's human body pack from MakeHuman's CC0 data
(github.com/makehumancommunity/makehuman, folder makehuman/data).

    python3 tools/makehuman/convert_body.py <makehuman/data> [repo root]

Writes public/models/human/body.json and body.bin:
  - the base mesh (metres, y up, facing +z): every base vertex, plus the
    rendered body split at UV seams, triangulated
  - shape targets, sparse and quantised: the adult macro lattice (gender,
    age, muscle, weight), height, ethnicity, and the creator's detail sliders
  - the game rig: 67 of MakeHuman's 163 bones, each placed at the average of
    its joint vertices (so bones follow the shape), with skin weights; the
    weights of dropped bones (face muscles, metacarpals, toes...) fold into
    their nearest kept ancestor
This is our own reader of MakeHuman's data files; no MakeHuman code is used.
"""
import json, os, struct, sys

MH = sys.argv[1]
ROOT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(__file__), '..', '..')
OUT = os.path.join(ROOT, 'public', 'models', 'human')
SCALE = 0.1  # MakeHuman works in decimetres
Q = 1 / 20000  # target delta quantum, metres (0.05 mm)

# ---------------------------------------------------------------- base mesh
V, VT, faces = [], [], []
group = ''
for line in open(os.path.join(MH, '3dobjs/base.obj')):
    p = line.split()
    if not p:
        continue
    if p[0] == 'v':
        V.append([float(p[1]) * SCALE, float(p[2]) * SCALE, float(p[3]) * SCALE])
    elif p[0] == 'vt':
        VT.append([float(p[1]), float(p[2])])
    elif p[0] == 'g':
        group = p[1] if len(p) > 1 else ''
    elif p[0] == 'f' and group == 'body':
        vs, ts = [], []
        for c in p[1:]:
            a = c.split('/')
            vs.append(int(a[0]) - 1)
            ts.append(int(a[1]) - 1 if len(a) > 1 and a[1] else int(a[0]) - 1)
        faces.append((vs, ts))
NV = len(V)

# Render vertices: one per (vertex, uv) pair.
rmap = {}
r_base, r_uv, tris = [], [], []
for vs, ts in faces:
    ids = []
    for v, t in zip(vs, ts):
        k = (v, t)
        if k not in rmap:
            rmap[k] = len(r_base)
            r_base.append(v)
            r_uv.append(VT[t])
        ids.append(rmap[k])
    for i in range(1, len(ids) - 1):
        tris.extend([ids[0], ids[i], ids[i + 1]])

# ---------------------------------------------------------------- targets
def read_target(rel):
    path = os.path.join(MH, 'targets', rel + '.target')
    if not os.path.exists(path):
        return None
    out = []
    for line in open(path):
        if not line.strip() or line[0] == '#':
            continue
        p = line.split()
        out.append((int(p[0]), float(p[1]) * SCALE, float(p[2]) * SCALE, float(p[3]) * SCALE))
    return out

targets = {}  # name -> list
GENDERS = ['female', 'male']
AGES = ['young', 'old']
MUSCLE = ['minmuscle', 'averagemuscle', 'maxmuscle']
WEIGHT = ['minweight', 'averageweight', 'maxweight']
for g in GENDERS:
    for a in AGES:
        for m in MUSCLE:
            for w in WEIGHT:
                n = f'universal-{g}-{a}-{m}-{w}'
                t = read_target('macrodetails/' + n)
                if t:
                    targets[n] = t
        for h in ['minheight', 'maxheight']:
            n = f'{g}-{a}-averagemuscle-averageweight-{h}'
            t = read_target('macrodetails/height/' + n)
            if t:
                targets['height-' + n] = t
        for e in ['african', 'asian', 'caucasian']:
            n = f'{e}-{g}-{a}'
            t = read_target('macrodetails/' + n)
            if t:
                targets[n] = t

# Creator sliders: id -> (negative files, positive files). Paired l/r files move together.
LR = lambda s: [s.replace('{s}', 'l'), s.replace('{s}', 'r')]
SLIDERS = {
    'head-age': (['head/head-age-decr'], ['head/head-age-incr']),
    'head-fat': (['head/head-fat-decr'], ['head/head-fat-incr']),
    'head-oval': ([], ['head/head-oval']),
    'head-round': ([], ['head/head-round']),
    'head-square': ([], ['head/head-square']),
    'head-triangular': ([], ['head/head-triangular']),
    'head-width': (['head/head-scale-horiz-decr'], ['head/head-scale-horiz-incr']),
    'forehead-height': (['forehead/forehead-scale-vert-decr'], ['forehead/forehead-scale-vert-incr']),
    'brow-angle': (['eyebrows/eyebrows-angle-down'], ['eyebrows/eyebrows-angle-up']),
    'eye-size': (['eyes/' + x for x in LR('{s}-eye-scale-decr')], ['eyes/' + x for x in LR('{s}-eye-scale-incr')]),
    'eye-bags': (['eyes/' + x for x in LR('{s}-eye-bag-decr')], ['eyes/' + x for x in LR('{s}-eye-bag-incr')]),
    'nose-width': (['nose/nose-scale-horiz-decr'], ['nose/nose-scale-horiz-incr']),
    'nose-length': (['nose/nose-scale-vert-decr'], ['nose/nose-scale-vert-incr']),
    'nose-hump': (['nose/nose-hump-decr'], ['nose/nose-hump-incr']),
    'nose-tip': (['nose/nose-point-down'], ['nose/nose-point-up']),
    'nostrils': (['nose/nose-nostrils-width-decr'], ['nose/nose-nostrils-width-incr']),
    'mouth-width': (['mouth/mouth-scale-horiz-decr'], ['mouth/mouth-scale-horiz-incr']),
    'lip-upper': (['mouth/mouth-upperlip-volume-decr'], ['mouth/mouth-upperlip-volume-incr']),
    'lip-lower': (['mouth/mouth-lowerlip-volume-decr'], ['mouth/mouth-lowerlip-volume-incr']),
    'ear-size': (['ears/' + x for x in LR('{s}-ear-scale-decr')], ['ears/' + x for x in LR('{s}-ear-scale-incr')]),
    'ear-flap': (['ears/' + x for x in LR('{s}-ear-flap-decr')], ['ears/' + x for x in LR('{s}-ear-flap-incr')]),
    'chin-prominent': (['chin/chin-prominent-decr'], ['chin/chin-prominent-incr']),
    'chin-width': (['chin/chin-width-decr'], ['chin/chin-width-incr']),
    'chin-height': (['chin/chin-height-decr'], ['chin/chin-height-incr']),
    'cheekbones': (['cheek/' + x for x in LR('{s}-cheek-bones-decr')], ['cheek/' + x for x in LR('{s}-cheek-bones-incr')]),
    'cheek-volume': (['cheek/' + x for x in LR('{s}-cheek-volume-decr')], ['cheek/' + x for x in LR('{s}-cheek-volume-incr')]),
    'neck-width': (['neck/neck-scale-horiz-decr'], ['neck/neck-scale-horiz-incr']),
    'torso-vshape': (['torso/torso-vshape-decr'], ['torso/torso-vshape-incr']),
    'chest-muscle': (['torso/torso-muscle-pectoral-decr'], ['torso/torso-muscle-pectoral-incr']),
    'back-muscle': (['torso/torso-muscle-dorsi-decr'], ['torso/torso-muscle-dorsi-incr']),
    'hip-width': (['hip/hip-scale-horiz-decr'], ['hip/hip-scale-horiz-incr']),
    'belly': (['stomach/stomach-pregnant-decr'], ['stomach/stomach-pregnant-incr']),
    'glutes': (['buttocks/buttocks-volume-decr'], ['buttocks/buttocks-volume-incr']),
    'arm-muscle': (['armslegs/' + x for x in LR('{s}-upperarm-muscle-decr')], ['armslegs/' + x for x in LR('{s}-upperarm-muscle-incr')]),
    'arm-fat': (['armslegs/' + x for x in LR('{s}-upperarm-fat-decr')], ['armslegs/' + x for x in LR('{s}-upperarm-fat-incr')]),
}

def merge(files):
    acc = {}
    for f in files:
        t = read_target(f)
        if t is None:
            raise SystemExit(f'missing target {f}')
        for i, x, y, z in t:
            a = acc.setdefault(i, [0.0, 0.0, 0.0])
            a[0] += x; a[1] += y; a[2] += z
    return [(i, *d) for i, d in sorted(acc.items())]

sliders = {}
for sid, (neg, pos) in SLIDERS.items():
    entry = {}
    if neg:
        targets[sid + ':-'] = merge(neg)
        entry['neg'] = sid + ':-'
    targets[sid + ':+'] = merge(pos)
    entry['pos'] = sid + ':+'
    sliders[sid] = entry

# ---------------------------------------------------------------- skeleton
skel = json.load(open(os.path.join(MH, 'rigs/default.mhskel')))
bones_all = skel['bones']
joints = skel['joints']
KEEP = ['root', 'spine05', 'spine04', 'spine03', 'spine02', 'spine01', 'neck01', 'neck02', 'neck03', 'head', 'jaw']
for s in ['L', 'R']:
    KEEP += [f'{b}.{s}' for b in ['clavicle', 'shoulder01', 'upperarm01', 'upperarm02', 'lowerarm01', 'lowerarm02', 'wrist']]
    KEEP += [f'finger{f}-{k}.{s}' for f in range(1, 6) for k in range(1, 4)]
    KEEP += [f'{b}.{s}' for b in ['pelvis', 'upperleg01', 'upperleg02', 'lowerleg01', 'lowerleg02', 'foot']]
keep_set = set(KEEP)

def kept_parent(name):
    p = bones_all[name]['parent']
    while p is not None and p not in keep_set:
        p = bones_all[p]['parent']
    return p

def kept_self(name):
    n = name
    while n is not None and n not in keep_set:
        n = bones_all[n]['parent']
    return n

bones = []
for b in KEEP:
    info = bones_all[b]
    if b != 'root' and kept_parent(b) is None:
        raise SystemExit(f'{b} has no kept parent')
    bones.append({'name': b, 'parent': KEEP.index(kept_parent(b)) if b != 'root' else -1, 'head': joints[info['head']], 'tail': joints[info['tail']]})

weights_raw = json.load(open(os.path.join(MH, 'rigs', skel.get('weights_file', 'default_weights.mhw'))))['weights']
per_vert = [dict() for _ in range(NV)]
for bname, lst in weights_raw.items():
    tgt = kept_self(bname)
    bi = KEEP.index(tgt)
    for v, w in lst:
        per_vert[v][bi] = per_vert[v].get(bi, 0.0) + w
skin_i = []
skin_w = []
for d in per_vert:
    top = sorted(d.items(), key=lambda kv: -kv[1])[:4]
    s = sum(w for _, w in top)
    if s <= 0:
        top, s = [(KEEP.index('root'), 1.0)], 1.0
    top += [(0, 0.0)] * (4 - len(top))
    ws = [round(w / s * 255) for _, w in top]
    ws[0] += 255 - sum(ws)
    skin_i.extend(i for i, _ in top)
    skin_w.extend(ws)

# ---------------------------------------------------------------- write
os.makedirs(OUT, exist_ok=True)
blob = bytearray()
def put(fmt, values):
    while len(blob) % 4:
        blob.append(0)
    off = len(blob)
    blob.extend(struct.pack('<%d%s' % (len(values), fmt), *values))
    return off

layout = {}
layout['base'] = put('f', [c for v in V for c in v])
layout['renderBase'] = put('I', r_base)
layout['uv'] = put('f', [c for t in r_uv for c in t])
layout['index'] = put('I', tris)
layout['skinIndex'] = put('B', skin_i)
layout['skinWeight'] = put('B', skin_w)
tmeta = {}
for name, t in targets.items():
    idx = [i for i, *_ in t]
    d = []
    for _, x, y, z in t:
        for c in (x, y, z):
            q = round(c / Q)
            if not -32768 <= q <= 32767:
                raise SystemExit(f'{name}: delta {c} out of range')
            d.append(q)
    tmeta[name] = {'count': len(t), 'idx': put('H' if NV < 65536 else 'I', idx), 'd': put('h', d)}

meta = {
    'source': 'MakeHuman 1.x data (CC0 1.0), github.com/makehumancommunity/makehuman',
    'scale': SCALE, 'quantum': Q, 'baseCount': NV, 'renderCount': len(r_base), 'indexCount': len(tris),
    'layout': layout, 'targets': tmeta, 'sliders': sliders,
    'bones': bones, 'boneNames': KEEP,
    'lattice': {'gender': GENDERS, 'age': AGES, 'muscle': MUSCLE, 'weight': WEIGHT, 'ethnic': ['african', 'asian', 'caucasian']},
    'bytes': len(blob),
}
open(os.path.join(OUT, 'body.bin'), 'wb').write(blob)
json.dump(meta, open(os.path.join(OUT, 'body.json'), 'w'), separators=(',', ':'))
print(f'base {NV} verts, render {len(r_base)} verts / {len(tris)//3} tris, {len(targets)} targets, {len(bones)} bones, {len(blob)/1e6:.1f} MB')
