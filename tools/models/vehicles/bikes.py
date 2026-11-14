"""Original low-poly off-road bikes for Street Fight UK, one GLB per bike.
Laid out like the old code-built bike (propModels.ts bike()): wheel radius R, wheelbase 1.45 * R / 0.37,
wheels on the ground at y = 0. Authored with the nose along +x and turned so the file's front is +Z.
Plastics are the 'paint' material (tinted in game); the side number boards are 'plate' (numbered in game)."""
import os, sys, math, numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from geom import Mesh, sw, torus
from glbio import Writer
from glbout import materials, add_mesh, prune
OUT = sys.argv[1]
DARK = sw(5, 2, 0.4); DARKER = sw(5, 2, 0.95); GREY = sw(7, 2, 0.3); WHITE = sw(12, 2); GOLD = sw(12, 3, 0.3)
ENG = sw(6, 2, 0.5); PAINT = sw(15, 0, 0.15); PAINT_LO = sw(15, 0, 0.6); BLUE = sw(1, 0, 0.7); BLACKP = sw(4, 2, 0.95)

BIKES = {
    'pup85':      dict(R=0.28, cls='beginner', seat=DARK, accent=WHITE),
    'trail125':   dict(R=0.32, cls='beginner', seat=DARK, accent=WHITE, lamp=True, rack=True),
    'mx250':      dict(R=0.36, cls='motocross', seat=DARK, accent=WHITE),
    'mx350':      dict(R=0.36, cls='motocross', seat=DARK, accent=DARK),
    'mx450r':     dict(R=0.37, cls='mx_pro', seat=DARK, accent=DARK),
    'mx450f':     dict(R=0.37, cls='mx_pro', seat=DARK, accent=WHITE, ti=True),
    'enduro300':  dict(R=0.37, cls='enduro', seat=DARK, accent=BLUE),
    'enduro500':  dict(R=0.37, cls='enduro', seat=DARK, accent=DARK),
    'factory450': dict(R=0.38, cls='racing', seat=DARK, accent=BLUE, carbon=True),
    'gp500':      dict(R=0.38, cls='racing', seat=DARK, accent=DARK, carbon=True),
}

def wheel(R, s, front):
    m = Mesh()
    torus(m, 'kit', DARK, (0, 0, 0), R - 0.05 * s, 0.055 * s, 16, 6)
    for i in range(16):                                   # knobs
        a = (i + 0.5) / 16 * 2 * math.pi
        m.box('kit', DARKER, (math.cos(a) * (R - 0.005), math.sin(a) * (R - 0.005), 0), (0.035 * s, 0.03 * s, 0.13 * s), rot=(0, 0, a))
    torus(m, 'metal', None, (0, 0, 0), R - 0.1 * s, 0.014, 16, 4)
    for i in range(6):                                    # spokes
        a = i / 6 * math.pi
        m.box('metal', None, (0, 0, 0), (2 * (R - 0.1 * s), 0.008, 0.008), rot=(0, 0, a))
    m.cyl('metal', None, (0, 0, 0), 0.05 * s, 0.14, 10, 'z')
    if front: m.cyl('metal', None, (0, 0, 0.07), 0.12 * s, 0.01, 14, 'z')
    return m

def bike(id, R, cls, seat, accent, lamp=False, rack=False, ti=False, carbon=False):
    s = R / 0.37; v = 0.78 * s; wb = 1.45 * s
    m = Mesh()
    frame = DARK if cls == 'racing' else GREY
    gold_forks = cls in ('mx_pro', 'racing')
    # Forks, raked back.
    for dz in (-0.09, 0.09):
        m.cyl('kit', GOLD if gold_forks else GREY, (wb / 2 - 0.13 * s, R + 0.38 * v, dz), 0.035, 0.85 * s, 8, 'y', r2=0.03, rot=(0, 0, 0.42))
        m.cyl('metal', None, (wb / 2 - 0.02 * s, R + 0.1 * v, dz), 0.028, 0.3 * s, 6, 'y', rot=(0, 0, 0.42))
    # Triple clamp, bars, grips.
    m.box('kit', DARK, (wb / 2 - 0.3 * s, R + 0.78 * v, 0), (0.08, 0.05, 0.28))
    m.cyl('metal', None, (wb / 2 - 0.36 * s, R + 0.86 * v, 0), 0.014, 0.8 * s, 6, 'z')
    for dz in (-0.36 * s, 0.36 * s):
        m.cyl('kit', DARKER, (wb / 2 - 0.36 * s, R + 0.86 * v, dz), 0.022, 0.12, 8, 'z')
        if cls == 'enduro': m.box('paint', PAINT, (wb / 2 - 0.3 * s, R + 0.86 * v, dz), (0.12, 0.06, 0.1))  # hand guards
    # Front number board (or headlight) and mudguard.
    if cls == 'enduro' or lamp:
        m.box('paint', PAINT, (wb / 2 - 0.22 * s, R + 0.62 * v, 0), (0.05, 0.24 * s, 0.24 * s), rot=(0, 0, 0.42))
        m.box('lamp', None, (wb / 2 - 0.19 * s, R + 0.6 * v, 0), (0.03, 0.1, 0.12), rot=(0, 0, 0.42))
    else:
        m.box('paint', PAINT, (wb / 2 - 0.22 * s, R + 0.62 * v, 0), (0.04, 0.22 * s, 0.26 * s), rot=(0, 0, 0.42))
        m.box('plate', None, (wb / 2 - 0.2 * s, R + 0.62 * v, 0), (0.01, 0.16 * s, 0.2 * s), rot=(0, 0, 0.42))
    m.box('paint', PAINT, (wb / 2 + 0.05 * s, R + 0.3 * v, 0), (0.55 * s, 0.03, 0.14), rot=(0, 0, -0.12))
    # Frame: down tube, top rail, swingarm.
    m.box('kit', frame, (wb / 2 - 0.55 * s, R + 0.32 * v, 0), (0.07, 0.75 * s, 0.07), rot=(0, 0, 0.75))
    m.box('kit', frame, (-0.05 * s, R + 0.62 * v, 0), (0.85 * s, 0.06, 0.07), rot=(0, 0, -0.12))
    for dz in (-0.07, 0.07):
        m.box('metal', None, (-wb / 4, R + 0.05 * v, dz), (0.7 * s, 0.06, 0.03), rot=(0, 0, -0.1))
    # Engine block and cylinder.
    m.box('kit', ENG, (0.05 * s, R + 0.12 * v, 0), (0.4 * s, 0.32 * s, 0.24))
    m.box('kit', DARK, (0.1 * s, R + 0.38 * v, 0), (0.18 * s, 0.24 * s, 0.18))
    for k in range(3): m.box('kit', DARKER, (0.1 * s, R + (0.3 + 0.08 * k) * v, 0), (0.2 * s, 0.015, 0.2))
    # Tank and radiator shrouds.
    m.box('paint', PAINT, (0.12 * s, R + 0.68 * v, 0), (0.46 * s, 0.2 * s, 0.32))
    for dz in (-0.17, 0.17):
        m.box('paint', PAINT_LO if not carbon else PAINT, (0.24 * s, R + 0.5 * v, dz), (0.3 * s, 0.3 * s, 0.02), rot=(0, 0, 0.25))
        m.box('kit', accent, (0.2 * s, R + 0.5 * v, dz * 1.08), (0.24 * s, 0.05 * s, 0.01), rot=(0, 0, 0.25))
        if carbon: m.box('kit', BLACKP, (0.3 * s, R + 0.4 * v, dz * 1.1), (0.16 * s, 0.1 * s, 0.01), rot=(0, 0, 0.25))
    # Seat and rear end.
    m.box('kit', seat, (-0.32 * s, R + 0.74 * v, 0), (0.7 * s, 0.08, 0.22))
    m.box('paint', PAINT, (-0.68 * s, R + 0.72 * v, 0), (0.6 * s, 0.05, 0.2), rot=(0, 0, 0.18))
    if rack: m.box('kit', DARK, (-0.72 * s, R + 0.82 * v, 0), (0.36 * s, 0.03, 0.24))
    if cls == 'enduro' or lamp: m.box('kit', sw(5, 3, 0.5), (-0.95 * s, R + 0.78 * v, 0), (0.03, 0.05, 0.08))
    # Side number boards.
    for dz in (-0.13, 0.13):
        m.box('paint', PAINT, (-0.42 * s, R + 0.56 * v, dz * 1.0), (0.28 * s, 0.22 * s, 0.01), rot=(0, 0, 0.15))
        m.box('plate', None, (-0.42 * s, R + 0.56 * v, dz * 1.1), (0.22 * s, 0.17 * s, 0.006), rot=(0, 0, 0.15))
    # Exhaust (pipe and silencer).
    exh = 'metal' if (ti or cls in ('racing', 'mx_pro')) else 'kit'
    m.cyl(exh, GREY if exh == 'kit' else None, (-0.5 * s, R + 0.5 * v, -0.14), 0.06 * s, 0.5 * s, 10, 'y', r2=0.05 * s, rot=(0, 0, math.pi / 2 - 0.25))
    m.box('metal', None, (0.15 * s, R + 0.28 * v, -0.12), (0.5 * s, 0.035, 0.035), rot=(0, 0, -0.35))
    # Shock, pegs.
    m.cyl('kit', GOLD, (-0.15 * s, R + 0.38 * v, 0), 0.03, 0.35 * s, 8, 'y', rot=(0, 0, -0.4))
    for dz in (-0.16, 0.16): m.box('metal', None, (-0.05 * s, R + 0.08 * v, dz), (0.05, 0.03, 0.08))
    if cls == 'enduro': m.box('kit', DARK, (-0.2 * s, R * 0.45, -0.2), (0.03, R * 0.85, 0.03), rot=(-0.3, 0, 0.6))  # kickstand
    # Turn: nose +x -> file +z.
    for p in m.parts.values():
        p[0] = [(-q[2], q[1], q[0]) for q in p[0]]
    w = Writer(); mats = materials(w)
    w.j['scenes'][0]['name'] = id
    w.node({'name': 'body', 'mesh': add_mesh(w, mats, 'body', m)})
    tris = m.tris()
    for front in (True, False):
        wm = wheel(R, s, front)
        for p in wm.parts.values(): p[0] = [(-q[2], q[1], q[0]) for q in p[0]]
        tris += wm.tris()
        w.node({'name': 'wheel-front' if front else 'wheel-back', 'mesh': add_mesh(w, mats, 'wheel', wm), 'translation': [0, R, wb / 2 if front else -wb / 2]})
    prune(w)
    w.save(f'{OUT}/bike-{id}.glb')
    print(id, tris)

for k, d in BIKES.items(): bike(k, **d)
