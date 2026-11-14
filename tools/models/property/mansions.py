import sys, random, math
sys.path.insert(0, '/tmp/property')
from glb import Model, rot_y, rot_x, rot_z

OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp/property/out'


def common(m, wall, trim, roof):
    m.material('wall', wall, 0.9)
    m.material('trim', trim, 0.7)
    m.material('roof', roof, 0.8)
    m.material('window_lit', '#4a3a22', 0.4, emissive='#e8b060')
    m.material('window_dark', '#1d2638', 0.15, 0.3)
    m.material('door', '#1a1a1e', 0.4)
    m.material('brass', '#d8b04a', 0.3, 0.9)
    m.material('step', '#bdb5a4', 0.95)


def window(m, rnd, x, y, z, w, h, bars=(1, 1), lit_p=0.5, sill=True, surround=0.12, frame='trim'):
    """A window on a wall facing +z at depth z: surround, pane, glazing bars, sill. y is the centre."""
    m.box(frame, w + surround * 2, h + surround * 2, 0.08, x, y, z + 0.04, faces=('front', 'left', 'right', 'top', 'bottom'))
    pane = 'window_lit' if rnd.random() < lit_p else 'window_dark'
    m.quad(pane, (x - w / 2, y - h / 2, z + 0.085), (x + w / 2, y - h / 2, z + 0.085), (x + w / 2, y + h / 2, z + 0.085), (x - w / 2, y + h / 2, z + 0.085))
    nv, nh = bars
    for i in range(1, nv + 1):
        bx = x - w / 2 + w * i / (nv + 1)
        m.box(frame, 0.05, h, 0.03, bx, y, z + 0.1, faces=('front', 'left', 'right'))
    for i in range(1, nh + 1):
        by = y - h / 2 + h * i / (nh + 1)
        m.box(frame, w, 0.05, 0.03, x, by, z + 0.1, faces=('front', 'top', 'bottom'))
    if sill:
        m.box(frame, w + surround * 2 + 0.16, 0.1, 0.22, x, y - h / 2 - surround - 0.05, z + 0.11, faces=('front', 'left', 'right', 'top', 'bottom'))


def steps(m, cx, w, z0, n=3, rise=0.18, run=0.35):
    for i in range(n):
        m.box_b('step', w - i * 0.3, rise * (n - i), run, cx, 0, z0 + (n - 1 - i) * run + run / 2, faces=('front', 'left', 'right', 'top'))


def chimney(m, x, z, y0, h, pots=2, mat='wall'):
    m.box_b(mat, 0.9, h, 0.7, x, y0, z, faces=('front', 'back', 'left', 'right'))
    m.box_b('trim', 1.05, 0.15, 0.85, x, y0 + h, z)
    for i in range(pots):
        m.cyl('pot', 0.1, 0.09, 0.4, x - 0.2 + i * 0.4, y0 + h + 0.15, z, seg=6, caps=True)


def georgian():
    m = Model()
    common(m, '#e6dcc4', '#f2eee4', '#3a3e46')
    m.material('pot', '#8a5a48', 0.9)
    m.material('base', '#cfc3a6', 0.95)
    rnd = random.Random(11)
    # Main block (front face z=0), three storeys, 10 m wide.
    m.box('wall', 10, 9.6, 6, 0, 4.8, -3, faces=('front', 'left', 'right', 'back'))
    m.box_b('base', 10.2, 0.7, 6.1, 0, 0, -3, faces=('front', 'left', 'right'))
    for y in (3.45, 6.65):
        m.box('trim', 10.15, 0.16, 0.12, 0, y, 0.06, faces=('front', 'top', 'bottom', 'left', 'right'))
    for sx in (-1, 1):  # quoins
        for k in range(12):
            m.box('trim', 0.5 if k % 2 else 0.34, 0.36, 0.06, sx * (5 - (0.25 if k % 2 else 0.17)), 0.9 + k * 0.72, 0.03, faces=('front', 'top', 'bottom', 'left', 'right'))
    m.box('trim', 10.6, 0.36, 6.5, 0, 9.6, -3)  # cornice
    m.box_b('wall', 10.3, 0.75, 0.25, 0, 9.78, 0.05)  # parapet
    m.box_b('trim', 10.4, 0.1, 0.32, 0, 10.53, 0.05)
    m.hip_roof('roof', -4.9, 4.9, -5.9, -0.2, 9.78, 2.4, inset=2.6)
    chimney(m, -3.8, -3.0, 10.2, 2.4)
    chimney(m, 3.8, -3.0, 10.2, 2.4)
    for c in range(5):
        x = -4 + c * 2
        if c != 2:
            window(m, rnd, x, 2.0, 0, 1.05, 1.9, (1, 2))
        window(m, rnd, x, 5.05, 0, 1.1, 2.1, (1, 2))
        window(m, rnd, x, 8.15, 0, 1.0, 1.2, (1, 1))
    # Wings, lower and set back.
    for sx in (-1, 1):
        cx = sx * 7.4
        m.box('wall', 4.8, 6.8, 4, cx, 3.4, -3, faces=('front', 'left', 'right', 'back'))
        m.box_b('base', 4.9, 0.7, 4.05, cx, 0, -3, faces=('front', 'left', 'right'))
        m.box('trim', 5.1, 0.3, 4.4, cx, 6.8, -3)
        m.hip_roof('roof', cx - 2.45, cx + 2.45, -5.1, -0.9, 6.95, 1.7, inset=2.0)
        for c in (-1, 1):
            window(m, rnd, cx + c * 1.2, 2.0, -1, 1.0, 1.8, (1, 2))
            window(m, rnd, cx + c * 1.2, 4.9, -1, 1.0, 1.7, (1, 2))
    # Portico on steps: four columns, entablature and pediment.
    steps(m, 0, 5.2, 0, 3)
    for dx in (-1.8, -0.6, 0.6, 1.8):
        m.box_b('trim', 0.5, 0.25, 0.5, dx, 0.54, 1.3)
        m.cyl('trim', 0.2, 0.17, 3.2, dx, 0.79, 1.3, seg=10, caps=False)
        m.box_b('trim', 0.5, 0.2, 0.5, dx, 3.99, 1.3)
    m.box_b('trim', 4.8, 0.5, 1.75, 0, 4.19, 0.88)
    m.prism('trim', [(-2.55, 0), (2.55, 0), (0, 1.15)], 0.3, z0=1.45, offset=(0, 4.69, 0))
    m.prism('roof', [(-2.65, 0), (2.65, 0), (0, 1.25)], 1.4, z0=0.05, offset=(0, 4.69, 0))
    m.box('door', 1.4, 2.5, 0.08, 0, 1.79, 0.04)
    m.prism('window_lit', [(-0.7 + 1.4 * i / 8 - 0.0, 0) for i in range(1)] + [(0.7 * math.cos(math.pi * i / 8), 0.7 * math.sin(math.pi * i / 8)) for i in range(9)][::1], 0.02, z0=0.06, offset=(0, 3.1, 0)) if False else None
    fan = [(0.7 * math.cos(math.pi * i / 8), 0.7 * math.sin(math.pi * i / 8)) for i in range(9)]
    m.prism('window_lit', fan, 0.04, z0=0.04, offset=(0, 3.1, 0))
    m.box('brass', 0.08, 0.08, 0.06, 0.45, 1.75, 0.11)
    return m


def stone():
    m = Model()
    common(m, '#c8bc9e', '#a8987a', '#3a3e46')
    m.material('pot', '#8a5a48', 0.9)
    rnd = random.Random(23)
    m.box('wall', 12, 7.6, 6, 0, 3.8, -3, faces=('front', 'left', 'right', 'back'))
    m.box_b('trim', 12.1, 0.5, 6.05, 0, 0, -3, faces=('front', 'left', 'right'))
    m.gable_roof('roof', -6.3, 6.3, -6.3, 0.3, 7.6, 3.6, along='x')
    m.prism('wall', [(-6, 0), (6, 0)][:0] + [(-3.0, 0), (3.0, 0), (0, 3.6)], 0.01, z0=-6.0) if False else None
    for sx in (-1, 1):  # gable ends
        m.prism('wall', [(-3.0, 0), (3.0, 0), (0, 3.4)], 12.0 * 0 + 0.01, z0=0, R=rot_y(math.pi / 2), offset=(sx * 6.0, 7.6, -3.0))
    # Two projecting front gables with ground-floor bays.
    for gx in (-3.6, 3.6):
        m.box('wall', 3.8, 7.6, 1.4, gx, 3.8, 0.7, faces=('front', 'left', 'right'))
        m.prism('wall', [(-1.9, 0), (1.9, 0), (0, 2.9)], 1.4, z0=0.0, offset=(gx, 7.6, 0))
        m.gable_roof('roof', gx - 2.15, gx + 2.15, -0.5, 1.65, 7.6, 3.1, along='z')
        m.box('trim', 0.3, 0.6, 0.2, gx, 10.9, 1.5)  # finial
        # Canted bay: three faces of glass on the ground floor.
        m.box_b('trim', 3.0, 0.6, 0.9, gx, 0, 1.85, faces=('front', 'left', 'right', 'top'))
        m.box_b('wall', 3.0, 2.6, 0.9, gx, 0.6, 1.85, faces=('left', 'right')) if False else None
        for k, dx in enumerate((-1.0, 0, 1.0)):
            window(m, rnd, gx + dx, 1.85, 2.3, 0.75, 1.9, (0, 1), sill=False, surround=0.1)
        m.box_b('trim', 3.1, 0.25, 0.95, gx, 3.0, 1.85)
        m.box('roof', 3.1, 0.12, 1.0, gx, 3.35, 1.85, R=rot_x(-0.25))
        m.box('wall', 3.0, 2.4, 0.9, gx, 1.8, 1.85, faces=('back',))
        window(m, rnd, gx, 5.3, 1.4, 2.0, 1.7, (2, 1))
        window(m, rnd, gx, 8.6, 1.4, 0.8, 1.0, (0, 1))
    # Centre: arched porch and the windows above.
    m.box_b('wall', 2.4, 3.2, 1.4, 0, 0, 0.7, faces=('front', 'left', 'right'))
    m.gable_roof('roof', -1.4, 1.4, 0.0, 1.5, 3.2, 1.3, along='z')
    m.prism('wall', [(-1.2, 0), (1.2, 0), (0, 1.1)], 0.02, z0=1.4, offset=(0, 3.2, 0))
    arch = [(-0.7, 0), (0.7, 0)] + [(0.7 * math.cos(math.pi * i / 6), 2.0 + 0.7 * math.sin(math.pi * i / 6)) for i in range(7)]
    arch = [(-0.7, 0), (0.7, 0), (0.7, 2.0)] + [(0.7 * math.cos(math.pi * i / 6), 2.0 + 0.7 * math.sin(math.pi * i / 6)) for i in range(1, 6)] + [(-0.7, 2.0)]
    m.prism('door', arch, 0.03, z0=1.4)
    m.box('brass', 0.08, 0.08, 0.04, 0.4, 1.2, 1.45)
    window(m, rnd, 0, 5.3, 0, 1.6, 1.6, (1, 1))
    steps(m, 0, 2.6, 1.4, 2)
    for gx in (-1.35, 1.35):
        pass
    for x in (-5.4, 5.4):
        window(m, rnd, x, 1.9, 0, 0.6, 1.7, (0, 1))
        window(m, rnd, x, 5.3, 0, 0.6, 1.6, (0, 1))
    # Wings.
    for sx in (-1, 1):
        cx = sx * 8.0
        m.box('wall', 4.0, 5.2, 4.0, cx, 2.6, -3.2, faces=('front', 'left', 'right', 'back'))
        m.box_b('trim', 4.05, 0.5, 4.05, cx, 0, -3.2, faces=('front', 'left', 'right'))
        m.gable_roof('roof', cx - 2.2, cx + 2.2, -5.4, -1.0, 5.2, 2.2, along='x')
        m.prism('wall', [(-2.0, 0), (2.0, 0), (0, 2.1)], 0.01, z0=0, R=rot_y(math.pi / 2), offset=(cx + sx * 2.0, 5.2, -3.2))
        for c in (-0.9, 0.9):
            window(m, rnd, cx + c, 2.2, -1.2, 0.8, 1.7, (1, 1))
    for x in (-3.0, 0.4, 3.4):
        chimney(m, x, -3.0, 9.0, 2.4, 3)
    return m


def brick():
    m = Model()
    common(m, '#8a4a36', '#e8e0cc', '#4a3a32')
    m.material('pot', '#7a4232', 0.9)
    m.material('cctv', '#e8e4dc', 0.5)
    rnd = random.Random(37)
    m.box('wall', 9, 8.4, 6, 0, 4.2, -3, faces=('front', 'left', 'right', 'back'))
    m.box_b('trim', 9.1, 0.45, 6.05, 0, 0, -3, faces=('front', 'left', 'right'))
    m.box('trim', 9.1, 0.18, 0.1, 0, 3.6, 0.05, faces=('front', 'top', 'bottom', 'left', 'right'))
    for sx in (-1, 1):
        for k in range(11):
            m.box('trim', 0.46 if k % 2 else 0.3, 0.34, 0.06, sx * (4.5 - (0.23 if k % 2 else 0.15)), 0.7 + k * 0.7, 0.03, faces=('front', 'top', 'bottom', 'left', 'right'))
    m.box('trim', 9.5, 0.3, 6.4, 0, 8.4, -3)
    m.hip_roof('roof', -4.75, 4.75, -6.2, 0.2, 8.55, 3.0, inset=2.4)
    # Dormers in the roof.
    for dx in (-2.6, 2.6):
        m.box_b('roof', 1.4, 1.3, 1.0, dx, 8.8, -0.9, faces=('front', 'left', 'right'))
        m.gable_roof('roof', dx - 0.85, dx + 0.85, -1.6, -0.3, 10.1, 0.7, along='z')
        window(m, rnd, dx, 9.45, -0.4, 0.7, 0.8, (1, 0), sill=False, surround=0.1)
    # Central bay, a storey taller, with a white-trimmed gable.
    m.box('wall', 3.4, 9.6, 0.9, 0, 4.8, 0.45, faces=('front', 'left', 'right'))
    m.prism('wall', [(-1.7, 0), (1.7, 0), (0, 1.7)], 0.9, z0=0.0, offset=(0, 9.6, 0))
    m.gable_roof('roof', -1.95, 1.95, -0.6, 1.1, 9.6, 1.85, along='z')
    m.prism('trim', [(-1.6, 0), (1.6, 0), (1.6, 0.15), (0, 1.75), (-1.6, 0.15)][::1], 0.05, z0=0.9, offset=(0, 9.6, 0)) if False else None
    m.box('trim', 3.6, 0.2, 1.0, 0, 9.55, 0.45)
    window(m, rnd, 0, 6.3, 0.9, 1.6, 2.0, (1, 2))
    window(m, rnd, 0, 10.2, 0.9, 0.6, 0.6, (0, 0), sill=False)
    # Porch: a flat canopy on two posts over the door.
    m.box('door', 1.3, 2.5, 0.06, 0, 1.7, 0.93)
    m.box('window_lit', 1.3, 0.45, 0.04, 0, 3.2, 0.93)
    m.box('trim', 2.8, 0.22, 1.6, 0, 3.6, 1.6)
    for dx in (-1.25, 1.25):
        m.cyl('trim', 0.1, 0.1, 3.2, dx, 0.25, 2.25, seg=8, caps=False)
    steps(m, 0, 2.8, 0.9, 2)
    m.box('brass', 0.08, 0.08, 0.05, 0.4, 1.7, 0.98)
    for x in (-3.3, -1.9, 1.9, 3.3):
        window(m, rnd, x, 1.9, 0, 0.95, 1.85, (1, 2))
        m.box('trim', 0.28, 0.32, 0.1, x, 3.0, 0.08)  # keystone
        window(m, rnd, x, 5.6, 0, 0.95, 1.85, (1, 2))
    for sx in (-1, 1):
        cx = sx * 6.3
        m.box('wall', 3.6, 6.0, 4.0, cx, 3.0, -3.0, faces=('front', 'left', 'right', 'back'))
        m.box_b('trim', 3.65, 0.45, 4.05, cx, 0, -3.0, faces=('front', 'left', 'right'))
        m.box('trim', 3.9, 0.25, 4.3, cx, 6.0, -3.0)
        m.hip_roof('roof', cx - 1.95, cx + 1.95, -5.15, -0.85, 6.1, 1.6, inset=1.6)
        window(m, rnd, cx, 1.9, -1.0, 1.4, 1.8, (2, 1))
        window(m, rnd, cx, 4.5, -1.0, 1.4, 1.5, (2, 1))
        # A CCTV camera on each wing corner (it's Wyvern Hall).
        m.box('cctv', 0.16, 0.14, 0.36, cx + sx * 1.6, 5.4, -0.8)
    for x in (-3.2, 3.2):
        chimney(m, x, -3.2, 9.6, 2.2, 2)
    return m


def modern():
    m = Model()
    m.material('wall', '#eeece6', 0.6)
    m.material('trim', '#2a2c30', 0.5, 0.2)
    m.material('roof', '#2a2c30', 0.6)
    m.material('timber', '#8a5a32', 0.7)
    m.material('window_lit', '#4a3a22', 0.3, emissive='#f0c070')
    m.material('window_dark', '#22304a', 0.1, 0.4)
    m.material('glass', '#9ab8d8', 0.05, 0.1, alpha=0.3)
    m.material('door', '#4a2e1a', 0.5)
    m.material('step', '#bdb5a4', 0.9)
    m.material('brass', '#d8b04a', 0.3, 0.9)
    rnd = random.Random(53)
    # Ground floor: a long white box with floor-to-ceiling glass.
    m.box('wall', 15, 3.4, 7, -1, 1.7, -3.5, faces=('front', 'left', 'right', 'back'))
    m.box('wall', 15.6, 0.35, 7.4, -1, 3.55, -3.5)
    def glass_band(x0, x1, y0, y1, z, lit_p):
        n = max(1, round((x1 - x0) / 1.3))
        pw = (x1 - x0) / n
        for i in range(n):
            pane = 'window_lit' if rnd.random() < lit_p else 'window_dark'
            a = x0 + i * pw
            m.quad(pane, (a, y0, z), (a + pw, y0, z), (a + pw, y1, z), (a, y1, z))
            m.box('trim', 0.07, y1 - y0, 0.08, a, (y0 + y1) / 2, z + 0.03, faces=('front', 'left', 'right'))
        m.box('trim', 0.07, y1 - y0, 0.08, x1, (y0 + y1) / 2, z + 0.03, faces=('front', 'left', 'right'))
        m.box('trim', x1 - x0 + 0.07, 0.08, 0.1, (x0 + x1) / 2, y1, z + 0.03)
        m.box('trim', x1 - x0 + 0.07, 0.08, 0.1, (x0 + x1) / 2, y0, z + 0.03)
    glass_band(-7.8, -0.9, 0.15, 3.15, 0.02, 0.75)
    glass_band(0.9, 3.4, 0.15, 3.15, 0.02, 0.75)
    m.box('timber', 2.4, 3.2, 0.06, 4.9, 1.65, 0.03)  # timber-clad panel
    for k in range(9):
        m.box('trim', 0.03, 3.2, 0.03, 3.8 + k * 0.27, 1.65, 0.07, faces=('front',))
    # Tall pivot door.
    m.box('door', 1.5, 3.0, 0.08, 0, 1.6, 0.04)
    m.box('brass', 0.05, 1.2, 0.06, 0.55, 1.6, 0.1)
    m.box_b('step', 2.4, 0.12, 1.2, 0, 0, 0.6)
    # Upper floor: a dark box cantilevered out over the front, with a glass band.
    m.box('trim', 13, 3.4, 7.2, 2.5, 5.45, -2.6, faces=('front', 'left', 'right', 'back', 'bottom'))
    m.box('wall', 13.4, 0.3, 7.6, 2.5, 7.3, -2.6)
    glass_band(-3.3, 8.3, 4.15, 6.75, 1.03, 0.55)
    # Roof terrace on the low part: glass balustrade.
    for k in range(4):
        m.box('glass', 0.95, 1.0, 0.03, -8.0 + k * 1.0, 4.2, -0.2)
    m.box('trim', 4.0, 0.05, 0.06, -6.5, 4.72, -0.2)
    m.box('glass', 0.03, 1.0, 6.6, -8.45, 4.2, -3.5)
    # Garage block to the right.
    m.box('trim', 4.0, 3.0, 6.0, 8.5, 1.5, -3.5, faces=('front', 'left', 'right', 'back', 'top'))
    m.box('wall', 3.0, 2.4, 0.05, 8.6, 1.2, -0.48)
    for k in range(6):
        m.box('trim', 3.0, 0.03, 0.03, 8.6, 0.25 + k * 0.4, -0.44, faces=('front',))
    # Low garden wall on the left end.
    m.box_b('wall', 2.2, 1.0, 0.3, -9.4, 0, -1.0)
    return m


if __name__ == '__main__':
    for name, fn in (('mansion_georgian', georgian), ('mansion_stone', stone), ('mansion_brick', brick), ('mansion_modern', modern)):
        m = fn()
        n = m.save(f'{OUT}/{name}.glb', name)
        print(name, m.count(), 'tris', n, 'bytes')
