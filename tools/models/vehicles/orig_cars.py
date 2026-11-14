"""Original low-poly cars for Street Fight UK (no Kenney match): Lotte Vixen S, Kestrel GT Roadster, Velocita Phantom V12.
Front is +Z, origin bottom centre, metres. Body colour is the 'paint' material (tinted in game)."""
import os, sys, numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from geom import Mesh, sw
from glbio import Writer
from glbout import materials, add_mesh, prune
OUT = sys.argv[1]
DARK = sw(5, 2, 0.4); DARKER = sw(5, 2, 0.95); GREY = sw(7, 2, 0.3); WHITE = sw(12, 2); YEL = sw(3, 3, 0.3); RED = sw(5, 3, 0.5); FABRIC = sw(4, 2, 0.6)

def paintuv(ybot, ytop):
    return lambda p: sw(15, 0, min(1, max(0, (ytop - p[1]) / (ytop - ybot))) * 0.85)

def wheel(r, w, rim_uv, spokes=5):
    m = Mesh()
    m.cyl('kit', DARK, (0, 0, 0), r, w, 16, 'x')
    m.cyl('kit', DARKER, (0, 0, 0), r * 0.72, w + 0.012, 16, 'x', caps=True)
    for s in (-1, 1):
        m.cyl('kit', rim_uv, (s * (w / 2 + 0.008), 0, 0), r * 0.62, 0.02, 10, 'x')
        m.cyl('kit', DARKER, (s * (w / 2 + 0.02), 0, 0), r * 0.16, 0.02, 8, 'x')
    return m

def side_windows(m, prof, x, shrink=0.72, lift=0.0):
    P = np.array(prof, float); c = P.mean(0)
    Q = c + (P - c) * shrink; Q[:, 1] += lift
    for s in (-1, 1):
        m.poly('window', [(s * x, q[1], q[0]) for q in (Q if s > 0 else Q[::-1])], None)

def screen(m, a, b, hw, inset=0.06, out=0.012):
    """Windscreen along the edge a->b (z, y) of a canopy, across +-hw."""
    a, b = np.array(a, float), np.array(b, float)
    d = b - a; n = np.array([d[1], -d[0]]); n /= np.linalg.norm(n)
    a2, b2 = a + d * 0.06 + n * out, b - d * 0.08 + n * out
    m.quad('window', (-hw + inset, a2[1], a2[0]), (hw - inset, a2[1], a2[0]), (hw - inset, b2[1], b2[0]), (-hw + inset, b2[1], b2[0]), None)

def lights(m, zf, zr, yf, yr, hw, shape=(0.34, 0.1)):
    for s in (-1, 1):
        m.box('kit', YEL, (s * (hw - 0.28), yf, zf), (shape[0], shape[1], 0.06))
        m.box('kit', RED, (s * (hw - 0.26), yr, zr), (0.36, 0.11, 0.06))

def build(name, body, hw, axles, r, extra, rim=GREY, tyre_w=0.27):
    m = Mesh()
    P = np.array(body); ybot, ytop = P[:, 1].min(), P[:, 1].max()
    m.loft('paint', body, hw, 0.07, uvf=paintuv(ybot, ytop + 0.25))
    # Underside skirt and bumpers.
    zf, zr = P[:, 0].max(), P[:, 0].min()
    m.box('kit', DARK, (0, ybot + 0.06, zf - 0.02), (hw * 2 - 0.12, 0.14, 0.1))
    m.box('kit', DARK, (0, ybot + 0.06, zr + 0.02), (hw * 2 - 0.12, 0.14, 0.1))
    # Wheel arches: dark panels behind the wheels.
    for z in axles:
        for s in (-1, 1):
            m.cyl('kit', DARKER, (s * (hw + 0.002), r, z), r * 1.12, 0.004, 14, 'x')
    extra(m, hw, zf, zr, ybot, ytop)
    w = Writer(); mats = materials(w)
    w.j['scenes'][0]['name'] = name
    bm = add_mesh(w, mats, 'body', m)
    w.node({'name': 'body', 'mesh': bm})
    wm = add_mesh(w, mats, 'wheel', wheel(r, tyre_w, rim))
    tx = hw - tyre_w / 2 + 0.02
    for z, tag in zip(axles, ('front', 'back')):
        for s, side in ((1, 'left'), (-1, 'right')):
            w.node({'name': f'wheel-{tag}-{side}', 'mesh': wm, 'translation': [s * tx, r, z]})
    prune(w)
    w.save(f'{OUT}/{name}.glb')
    print(name, m.tris())

# ---- Lotte Vixen S: small open two-seater, roll hoop, short screen ----
def vixen_extra(m, hw, zf, zr, yb, yt):
    m.box('kit', DARKER, (0, 0.87, 0.1), (hw * 2 - 0.34, 0.03, 0.85))      # cockpit floor
    for s in (-1, 1):
        m.box('kit', DARK, (s * 0.36, 0.98, -0.28), (0.46, 0.22, 0.4))      # seat base
        m.box('kit', DARK, (s * 0.36, 1.12, -0.48), (0.46, 0.5, 0.12), rot=(-0.2, 0, 0))
    m.box('kit', DARK, (0, 1.12, -0.66), (hw * 2 - 0.3, 0.08, 0.08))         # roll hoop
    for s in (-1, 1): m.box('kit', DARK, (s * (hw - 0.19), 1.0, -0.66), (0.07, 0.26, 0.07))
    m.box('kit', DARK, (0, 0.93, 0.5), (hw * 2 - 0.3, 0.16, 0.1))          # dash
    m.box('window', None, (0, 1.02, 0.6), (hw * 2 - 0.18, 0.34, 0.03), rot=(-0.55, 0, 0))
    m.box('kit', DARK, (0, 0.88, 0.7), (hw * 2 - 0.16, 0.04, 0.06))
    for s in (-1, 1): m.box('kit', DARK, (s * (hw - 0.02), 0.62, -0.75), (0.04, 0.16, 0.5))  # side intake
    lights(m, zf - 0.08, zr + 0.03, 0.62, 0.72, hw, (0.3, 0.12))
    m.box('kit', DARK, (0, 0.5, zf + 0.005), (0.7, 0.12, 0.02))
build('car-vixen',
      [(2.1, 0.3), (2.12, 0.52), (1.95, 0.66), (1.2, 0.76), (0.62, 0.86), (-0.75, 0.88), (-1.6, 0.92), (-2.08, 0.9), (-2.12, 0.78), (-2.1, 0.34), (-1.9, 0.24), (1.9, 0.24)],
      0.88, (1.35, -1.32), 0.31, vixen_extra)

# ---- Kestrel GT Roadster: long bonnet, soft top up ----
TOP = [(0.25, 0.9), (-0.08, 1.24), (-0.92, 1.26), (-1.42, 0.9)]
def kestrel_extra(m, hw, zf, zr, yb, yt):
    m.loft('kit', TOP, hw - 0.1, 0.06, uv=FABRIC)
    side_windows(m, [(0.12, 0.92), (-0.12, 1.18), (-0.78, 1.19), (-0.9, 0.92)], hw - 0.1 + 0.004, shrink=0.9, lift=0.02)
    screen(m, TOP[0], TOP[1], hw - 0.1)
    m.box('kit', GREY, (0, 0.52, zf + 0.01), (0.62, 0.2, 0.03))            # grille
    for k in range(4): m.box('kit', DARKER, (0, 0.45 + k * 0.05, zf + 0.025), (0.56, 0.015, 0.01))
    for s in (-1, 1):
        m.cyl('kit', YEL, (s * (hw - 0.3), 0.66, zf - 0.12), 0.1, 0.06, 10, 'z')
        m.box('kit', GREY, (s * (hw + 0.005), 0.6, 0.9), (0.02, 0.06, 0.5))   # side vent
    m.box('kit', RED, (0.5, 0.7, zr + 0.01), (0.3, 0.1, 0.04)); m.box('kit', RED, (-0.5, 0.7, zr + 0.01), (0.3, 0.1, 0.04))
    for s in (-1, 1): m.cyl('kit', GREY, (s * 0.35, 0.3, zr - 0.02), 0.045, 0.16, 8, 'z')  # twin exhausts
build('car-kestrel',
      [(2.2, 0.32), (2.22, 0.58), (2.05, 0.72), (1.1, 0.84), (0.25, 0.9), (-1.42, 0.9), (-2.05, 0.86), (-2.2, 0.72), (-2.2, 0.34), (-2.0, 0.24), (2.0, 0.24)],
      0.9, (1.45, -1.35), 0.33, kestrel_extra)

# ---- Velocita Phantom V12: wedge supercar, glass canopy, rear wing ----
CAN = [(0.85, 0.8), (-0.1, 1.14), (-0.8, 1.14), (-1.75, 0.86)]
def phantom_extra(m, hw, zf, zr, yb, yt):
    m.loft('paint', CAN, hw - 0.2, 0.08, uvf=paintuv(0.25, 1.4))
    side_windows(m, CAN, hw - 0.2 + 0.004, shrink=0.72, lift=0.0)
    screen(m, CAN[0], CAN[1], hw - 0.2)
    for s in (-1, 1):
        m.poly('kit', [(s * (hw + 0.004), y, z) for z, y in ([(-0.35, 0.42), (-0.25, 0.72), (-1.05, 0.72), (-1.1, 0.48)] if s > 0 else [(-1.1, 0.48), (-1.05, 0.72), (-0.25, 0.72), (-0.35, 0.42)])], DARKER)  # side intake
        m.box('kit', YEL, (s * (hw - 0.3), 0.58, zf - 0.3), (0.36, 0.05, 0.22), rot=(0.42, 0, 0))
        m.box('kit', RED, (s * (hw - 0.3), 0.74, zr + 0.01), (0.46, 0.06, 0.04))
        m.box('kit', DARK, (s * 0.5, 1.0, -2.05), (0.06, 0.2, 0.12))       # wing struts
    m.box('kit', DARK, (0, 1.1, -2.1), (hw * 2 - 0.2, 0.04, 0.32))          # wing
    m.box('kit', DARKER, (0, 0.42, zr + 0.01), (hw * 2 - 0.4, 0.22, 0.03))  # diffuser
    m.box('kit', DARKER, (0, 0.36, zf + 0.0), (hw * 2 - 0.5, 0.08, 0.04))   # splitter
    for s in (-0.12, 0.12): m.cyl('kit', GREY, (s, 0.5, zr - 0.03), 0.05, 0.1, 8, 'z')
build('car-phantom',
      [(2.3, 0.26), (2.32, 0.44), (1.5, 0.66), (0.85, 0.8), (-1.75, 0.86), (-2.28, 0.88), (-2.3, 0.4), (-2.12, 0.26)],
      0.95, (1.48, -1.38), 0.34, phantom_extra, rim=DARK, tyre_w=0.3)
