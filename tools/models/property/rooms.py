import sys, math, random
sys.path.insert(0, '/tmp/property')
from glb import Model, rot_y, rot_x, rot_z
OUT = '/tmp/property/out'


def pool_basin():
    """A raised, tiled indoor pool 5.6 x 1.6 m: coping, water, steps in at the left, a chrome ladder at the right."""
    m = Model()
    m.material('tile', '#dfe8ea', 0.4)
    m.material('tile_in', '#5ab4d0', 0.3)
    m.material('coping', '#e8e4dc', 0.6)
    m.material('water', '#2a9ac8', 0.05, 0.1, emissive='#0a3a5a')
    m.material('light', '#e8f8ff', 0.2, emissive='#a8e8ff')
    m.material('chrome', '#cfd2d8', 0.15, 0.95)
    m.material('grout', '#9ab0b8', 0.6)
    W, D, H = 5.6, 1.6, 0.45
    m.box_b('tile', W, H - 0.06, D, 0, 0, 0, faces=('front', 'back', 'left', 'right'))
    for k in range(1, 14):  # tile lines on the front
        x = -W / 2 + W * k / 14
        m.box('grout', 0.012, H - 0.08, 0.004, x, (H - 0.06) / 2, D / 2 + 0.002, faces=('front',))
    m.box('grout', W, 0.012, 0.004, 0, 0.2, D / 2 + 0.002, faces=('front',))
    c = 0.22
    m.box_b('coping', W + 0.08, 0.07, c, 0, H - 0.07, D / 2 - c / 2 + 0.04)
    m.box_b('coping', W + 0.08, 0.07, c, 0, H - 0.07, -D / 2 + c / 2 - 0.04)
    m.box_b('coping', c, 0.07, D - 2 * c + 0.08, -W / 2 + c / 2 - 0.04, H - 0.07, 0)
    m.box_b('coping', c, 0.07, D - 2 * c + 0.08, W / 2 - c / 2 + 0.04, H - 0.07, 0)
    iw, idp = W - 2 * c + 0.08, D - 2 * c + 0.08
    m.box('tile_in', iw, 0.08, idp, 0, H - 0.11, 0, faces=('left', 'right', 'front', 'back'))
    # Water surface with a gentle ripple (two tilted strips).
    y = H - 0.12
    m.quad('water', (-iw / 2, y, idp / 2), (iw / 2, y, idp / 2), (iw / 2, y, -idp / 2), (-iw / 2, y, -idp / 2))
    for k in range(5):
        x = -iw / 2 + 0.5 + k * 1.0
        m.box('tile_in', 0.5, 0.004, 0.02, x, y + 0.004, -0.2 + (k % 2) * 0.35, faces=('top',))
    # Steps into the water at the left end.
    for i in range(3):
        m.box_b('coping', 0.3, 0.04, idp - 0.1, -iw / 2 + 0.15 + i * 0.3, y - 0.02 - i * 0.0, 0, faces=('top', 'right'))
    # Underwater lights in the far wall.
    for x in (-1.4, 0, 1.4):
        m.box('light', 0.2, 0.012, 0.12, x, y + 0.002, -idp / 2 + 0.08, faces=('top',))
    # Ladder at the right end.
    for dz in (-0.22, 0.22):
        m.cyl('chrome', 0.022, 0.022, 0.55, W / 2 - c - 0.15, H - 0.12, dz, seg=6, caps=False)
        m.cyl('chrome', 0.022, 0.022, 0.22, W / 2 - c - 0.15, H + 0.43, dz, seg=6, caps=False, axis='x', R=None) if False else None
        m.box('chrome', 0.3, 0.04, 0.04, W / 2 - c - 0.0, H + 0.43, dz)
        m.cyl('chrome', 0.022, 0.022, 0.45, W / 2 - c + 0.13, H - 0.02, dz, seg=6, caps=False)
    return m


def pool_lounger():
    """A white sun lounger, 1.9 m long along x, back raised at the left end."""
    m = Model()
    m.material('frame', '#e8e4dc', 0.4)
    m.material('cushion', '#3a6a8a', 0.9)
    m.material('towel', '#e8333a', 0.95)
    L, Wd = 1.9, 0.65
    for x in (-L / 2 + 0.1, L / 2 - 0.1):
        for z in (-Wd / 2 + 0.05, Wd / 2 - 0.05):
            m.box_b('frame', 0.05, 0.3, 0.05, x, 0, z)
    m.box_b('frame', L, 0.05, Wd, 0, 0.3, 0)
    m.box_b('cushion', L - 0.6, 0.07, Wd - 0.06, 0.3, 0.35, 0)
    # Back rest, tilted up.
    a = 0.75
    m.box('frame', 0.65, 0.05, Wd, -L / 2 + 0.38, 0.5, 0, R=rot_z(-a))
    m.box('cushion', 0.62, 0.07, Wd - 0.06, -L / 2 + 0.42, 0.55, 0, R=rot_z(-a))
    m.box('towel', 0.5, 0.02, Wd - 0.1, 0.45, 0.43, 0, faces=('top', 'front', 'back', 'left', 'right'))
    return m


def cinema_screen():
    """A wall-mounted cinema screen 3.2 x 1.8 m in a black frame, glowing, between red velvet curtains."""
    m = Model()
    m.material('frame', '#101014', 0.6)
    m.material('screen_sky', '#9ab8e8', 0.5, emissive='#7a98d8')
    m.material('screen_land', '#3a5a8a', 0.5, emissive='#2a4a7a')
    m.material('screen_sun', '#ffd890', 0.5, emissive='#ffd080')
    m.material('curtain', '#7a2a2a', 0.95)
    m.material('pelmet', '#5a1a1a', 0.9)
    W, H, y0 = 3.2, 1.8, 0.9
    m.box_b('frame', W + 0.16, H + 0.16, 0.08, 0, y0 - 0.08, 0.04)
    z = 0.081
    ym = y0 + H * 0.42
    m.quad('screen_land', (-W / 2, y0, z), (W / 2, y0, z), (W / 2, ym, z), (-W / 2, ym, z))
    m.quad('screen_sky', (-W / 2, ym, z), (W / 2, ym, z), (W / 2, y0 + H, z), (-W / 2, y0 + H, z))
    sun = [(0.3 + 0.22 * math.cos(math.pi * i / 6), ym + 0.22 * math.sin(math.pi * i / 6)) for i in range(7)]
    m.prism('screen_sun', sun, 0.002, z0=z)
    hill = [(-W / 2, ym - 0.3), (-0.6, ym - 0.3), (-1.0, ym + 0.15), (-1.4, ym - 0.05)]
    m.prism('screen_land', [(-W / 2, ym - 0.01), (-0.4, ym - 0.01), (-1.0, ym + 0.25)], 0.002, z0=z)
    # Curtains: pleated (zig-zag) panels either side, and a pelmet.
    for sx in (-1, 1):
        x0 = sx * (W / 2 + 0.08)
        for k in range(5):
            xa = x0 + sx * k * 0.1
            xb = xa + sx * 0.1
            za, zb = (0.12, 0.2) if k % 2 == 0 else (0.2, 0.12)
            a, b = (xa, 0.0, za), (xb, 0.0, zb)
            c, d = (xb, 2.75, zb), (xa, 2.75, za)
            if sx > 0:
                m.quad('curtain', a, b, c, d)
            else:
                m.quad('curtain', b, a, d, c)
    m.box_b('pelmet', W + 1.4, 0.3, 0.25, 0, 2.7, 0.14)
    return m


def projector():
    """A ceiling projector on a drop rod (origin at the bottom of the body)."""
    m = Model()
    m.material('body', '#e8e4dc', 0.4)
    m.material('dark', '#2a2a2e', 0.4)
    m.material('lens', '#1a2a4a', 0.1, emissive='#a8c8ff')
    m.box_b('body', 0.36, 0.12, 0.3, 0, 0, 0)
    m.cyl('dark', 0.05, 0.05, 0.04, 0, 0.06, 0.15, seg=8, axis='z') if False else None
    m.box('dark', 0.1, 0.1, 0.04, -0.08, 0.06, 0.17)
    m.box('lens', 0.07, 0.07, 0.01, -0.08, 0.06, 0.195, faces=('front',))
    m.box_b('dark', 0.03, 0.4, 0.03, 0, 0.12, 0)
    m.box_b('dark', 0.16, 0.02, 0.16, 0, 0.52, 0)
    return m


def cinema_seats():
    """A row of three leather recliners 2.3 m wide, facing +z, with cupholder arms."""
    m = Model()
    m.material('leather', '#2a2a2e', 0.5)
    m.material('seam', '#1a1a1e', 0.6)
    m.material('cup', '#9a9ea6', 0.3, 0.7)
    m.material('led', '#3a6aff', 0.4, emissive='#3a6aff')
    sw, arm = 0.62, 0.14
    total = 3 * sw + 4 * arm
    x = -total / 2
    for i in range(4):
        m.box_b('leather', arm, 0.62, 0.85, x + arm / 2, 0, 0)
        m.cyl('cup', 0.035, 0.035, 0.02, x + arm / 2, 0.62, 0.28, seg=6)
        m.box('led', arm, 0.02, 0.01, x + arm / 2, 0.1, 0.426, faces=('front',))
        x += arm
        if i < 3:
            cx = x + sw / 2
            m.box_b('leather', sw, 0.42, 0.8, cx, 0, 0.02)
            m.box_b('seam', sw - 0.06, 0.06, 0.62, cx, 0.42, 0.08)
            m.box('leather', sw, 0.75, 0.22, cx, 0.82, -0.32, R=rot_x(-0.18))
            m.box('seam', sw - 0.1, 0.2, 0.05, cx, 1.02, -0.2, R=rot_x(-0.18))
            x += sw
    return m


def backdrop_night(m, W, garden=True, rnd=None):
    """A night view out of a window: sky, moon, and a garden (or the town's skyline)."""
    m.material('sky_top', '#141a30', 1.0, emissive='#0c1226')
    m.material('sky_low', '#3a3050', 1.0, emissive='#2a2040')
    m.material('moon', '#f4f0e0', 1.0, emissive='#f0e8c8')
    m.quad('sky_top', (-W / 2, 1.6, 0.03), (W / 2, 1.6, 0.03), (W / 2, 3.0, 0.03), (-W / 2, 3.0, 0.03))
    m.quad('sky_low', (-W / 2, 0.0, 0.03), (W / 2, 0.0, 0.03), (W / 2, 1.6, 0.03), (-W / 2, 1.6, 0.03))
    moon = [(W * 0.28 + 0.16 * math.cos(2 * math.pi * i / 10), 2.45 + 0.16 * math.sin(2 * math.pi * i / 10)) for i in range(10)]
    m.prism('moon', moon, 0.005, z0=0.035)
    if garden:
        m.material('lawn', '#2a4a2a', 1.0, emissive='#0a1a0a')
        m.material('hedge', '#1f3a1f', 1.0)
        m.material('tree', '#18301c', 1.0)
        m.quad('lawn', (-W / 2, 0.0, 0.25), (W / 2, 0.0, 0.25), (W / 2, 0.75, 0.06), (-W / 2, 0.75, 0.06))
        m.box_b('hedge', W, 1.05, 0.12, 0, 0, 0.1, faces=('front', 'top'))
        for k in range(int((W - 1.0) / 1.4) + 1):
            x = min(W / 2 - 0.5, -W / 2 + 0.5 + k * 1.4 + rnd.uniform(-0.2, 0.2))
            h = rnd.uniform(1.9, 2.6)
            m.prism('tree', [(-0.45, 0.9), (0.45, 0.9), (0.0, h)], 0.02, z0=0.08, offset=(x, 0, 0))
            m.prism('tree', [(-0.06, 0), (0.06, 0), (0.06, 0.95), (-0.06, 0.95)], 0.02, z0=0.08, offset=(x, 0, 0))
    else:
        m.material('city', '#151722', 1.0)
        m.material('city_far', '#22243a', 1.0)
        m.material('lit', '#ffd890', 1.0, emissive='#ffc870')
        m.material('red', '#e8333a', 1.0, emissive='#e8333a')
        x = -W / 2
        while x < W / 2:
            w = min(rnd.uniform(0.3, 0.7), W / 2 - x)
            h = rnd.uniform(1.4, 2.4)
            m.box_b('city_far', w, h, 0.02, x + w / 2, 0, 0.05, faces=('front',))
            x += w
        x = -W / 2
        while x < W / 2:
            w = min(rnd.uniform(0.35, 0.8), W / 2 - x)
            h = rnd.uniform(0.9, 2.0)
            m.box_b('city', w, h, 0.02, x + w / 2, 0, 0.09, faces=('front',))
            for r in range(int(h / 0.18) - 1):
                for c in range(int(w / 0.12)):
                    if rnd.random() < 0.28:
                        wx = x + 0.06 + c * 0.12
                        wy = 0.15 + r * 0.18
                        m.quad('lit', (wx, wy, 0.101), (wx + 0.05, wy, 0.101), (wx + 0.05, wy + 0.07, 0.101), (wx, wy + 0.07, 0.101))
            if h > 1.8:
                m.box('red', 0.04, 0.04, 0.01, x + w / 2, h + 0.03, 0.1)
            x += w


def conservatory():
    """Conservatory glazing for the back of a room, 6 m wide: dwarf brick wall, white frames, glass, a lean-to
    glass roof coming forward overhead, and the garden at night outside. Origin bottom centre at the wall, front +z."""
    m = Model()
    rnd = random.Random(5)
    W = 6.0
    backdrop_night(m, W, True, rnd)
    m.material('brick', '#8a4a36', 0.9)
    m.material('upvc', '#f4f4f0', 0.4)
    m.material('glass', '#bcd4e8', 0.05, 0.1, alpha=0.18)
    z = 0.4
    m.box_b('brick', W, 0.6, 0.25, 0, 0, z - 0.05)
    m.box_b('upvc', W + 0.04, 0.06, 0.32, 0, 0.6, z - 0.03)
    n = 8
    for k in range(n + 1):
        x = -W / 2 + W * k / n
        m.box_b('upvc', 0.07, 2.0, 0.08, x, 0.66, z)
    for y in (0.66, 2.0, 2.62):
        m.box('upvc', W + 0.07, 0.07, 0.09, 0, y, z)
    m.quad('glass', (-W / 2, 0.66, z), (W / 2, 0.66, z), (W / 2, 2.66, z), (-W / 2, 2.66, z))
    # Lean-to roof: rafters and glass from the eaves (2.66 at the glazing) up to 3.05 at 1.5 m in.
    a = math.atan2(0.4, 1.5)
    for k in range(n + 1):
        x = -W / 2 + W * k / n
        m.box('upvc', 0.06, 0.08, 1.56, x, 2.86, z + 0.75, R=rot_x(-a))
    m.quad('glass', (-W / 2, 2.68, z), (-W / 2, 3.07, z + 1.5), (W / 2, 3.07, z + 1.5), (W / 2, 2.68, z))
    m.box('upvc', W + 0.1, 0.1, 0.14, 0, 2.68, z + 0.02)
    # Finials along the ridge... and a little cresting.
    for k in range(n):
        x = -W / 2 + W * (k + 0.5) / n
        m.box('upvc', 0.012, 0.012, 0.02, x, 2.05, z + 0.05)
    return m


def terrace_balustrade():
    """Glass balustrade along the back of a roof terrace, 6 m wide, with the town's skyline at night beyond it."""
    m = Model()
    rnd = random.Random(9)
    W = 6.0
    backdrop_night(m, W, False, rnd)
    m.material('steel', '#b9bdc4', 0.3, 0.8)
    m.material('glass', '#bcd4e8', 0.05, 0.1, alpha=0.22)
    m.material('stone', '#cfc8b8', 0.8)
    z = 0.4
    m.box_b('stone', W, 0.12, 0.3, 0, 0, z)
    n = 6
    for k in range(n):
        x = -W / 2 + W * (k + 0.5) / n
        m.box_b('glass', W / n - 0.04, 1.0, 0.02, x, 0.12, z)
    for k in range(n + 1):
        x = -W / 2 + W * k / n
        m.box_b('steel', 0.05, 1.12, 0.05, x, 0.0, z)
    m.box_b('steel', W + 0.06, 0.05, 0.08, 0, 1.12, z)
    return m


def terrace_deck():
    """Timber decking for a roof terrace floor, 6 x 3.8 m, boards running along x."""
    m = Model()
    m.material('deck', '#8a5a32', 0.8)
    m.material('deck2', '#7a4e2a', 0.8)
    W, D = 6.0, 3.8
    n = 19
    for k in range(n):
        z = -D / 2 + D * (k + 0.5) / n
        m.box_b('deck' if k % 2 else 'deck2', W, 0.03, D / n - 0.015, 0, 0.0, z, faces=('top', 'front'))
    return m


def terrace_sofa():
    """An outdoor rattan sofa with cream cushions, 2.0 m wide."""
    m = Model()
    m.material('rattan', '#5a4a3a', 0.9)
    m.material('cushion', '#e8e0cc', 0.95)
    m.material('pillow', '#1f3f8a', 0.95)
    m.material('pillow2', '#e8333a', 0.95)
    W, D = 2.0, 0.85
    m.box_b('rattan', W, 0.38, D, 0, 0, 0)
    m.box_b('rattan', W, 0.42, 0.18, 0, 0.38, -D / 2 + 0.09)
    for sx in (-1, 1):
        m.box_b('rattan', 0.16, 0.24, D, sx * (W / 2 - 0.08), 0.38, 0)
    for k in (-1, 1):
        m.box_b('cushion', W / 2 - 0.2, 0.12, D - 0.22, k * (W / 4 - 0.04), 0.38, 0.06)
        m.box('cushion', W / 2 - 0.2, 0.4, 0.13, k * (W / 4 - 0.04), 0.7, -D / 2 + 0.26, R=rot_x(-0.15))
    m.box('pillow', 0.36, 0.32, 0.12, -0.6, 0.7, -0.15, R=rot_z(0.15))
    m.box('pillow2', 0.36, 0.32, 0.12, 0.62, 0.7, -0.15, R=rot_z(-0.15))
    return m


def terrace_table():
    """A round outdoor table with two chairs and a parasol (2.3 m tall)."""
    m = Model()
    m.material('metal', '#2a2a2e', 0.4, 0.6)
    m.material('top', '#e8e4dc', 0.3)
    m.material('canopy', '#f2efe6', 0.9)
    m.material('canopy2', '#1f3f8a', 0.9)
    m.material('glass', '#bcd4e8', 0.05, 0.1, alpha=0.4)
    m.material('candle', '#ffd890', 0.4, emissive='#ffb860')
    m.cyl('top', 0.45, 0.45, 0.03, 0, 0.72, 0, seg=12)
    m.cyl('metal', 0.03, 0.03, 0.72, 0, 0, 0, seg=6, caps=False)
    m.cyl('metal', 0.25, 0.25, 0.02, 0, 0, 0, seg=8)
    m.cyl('metal', 0.02, 0.02, 1.6, 0, 0.72, 0, seg=6, caps=False)
    # Parasol: an eight-panel cone in alternating colours.
    R, y0, y1 = 1.15, 2.05, 2.4
    for i in range(8):
        a0, a1 = 2 * math.pi * i / 8, 2 * math.pi * (i + 1) / 8
        p0 = (R * math.cos(a0), y0, -R * math.sin(a0))
        p1 = (R * math.cos(a1), y0, -R * math.sin(a1))
        m.tri('canopy' if i % 2 else 'canopy2', p0, p1, (0, y1, 0))
        m.tri('canopy' if i % 2 else 'canopy2', p1, p0, (0, y1 - 0.02, 0))
    m.cyl('candle', 0.04, 0.04, 0.08, 0.1, 0.75, 0.1, seg=6)
    # Two chairs either side.
    for sx in (-1, 1):
        cx = sx * 0.72
        for dx in (-0.2, 0.2):
            for dz in (-0.2, 0.2):
                m.box_b('metal', 0.03, 0.45, 0.03, cx + dx, 0, dz)
        m.box_b('metal', 0.46, 0.04, 0.46, cx, 0.45, 0)
        m.box_b('metal', 0.04, 0.45, 0.46, cx + sx * 0.22, 0.49, 0)
    return m


def wardrobe_wall():
    """A fitted wardrobe wall, 3.4 m wide x 2.6 m high x 0.6 m deep: glass-fronted hanging bays with clothes,
    shoe shelves, drawers, LED strips. Front +z."""
    m = Model()
    rnd = random.Random(17)
    m.material('carcass', '#2a2a2e', 0.5)
    m.material('inner', '#c8a070', 0.6)
    m.material('glass', '#c8d8e8', 0.05, 0.2, alpha=0.2)
    m.material('led', '#fff4e0', 0.3, emissive='#ffe8c8')
    m.material('rail', '#cfd2d8', 0.2, 0.9)
    m.material('handle', '#d8b04a', 0.3, 0.9)
    cols = ['#1f2a44', '#e8e4dc', '#7a2a2a', '#3a4a6a', '#2a2a2e', '#c8bca0', '#4a5a3a', '#e8333a']
    for i, c in enumerate(cols):
        m.material(f'cloth{i}', c, 0.95)
    W, H, D = 3.4, 2.6, 0.6
    m.box_b('carcass', W, 0.08, D, 0, 0, 0)
    m.box_b('carcass', W, 0.1, D, 0, H - 0.1, 0)
    m.box('inner', W, H - 0.18, 0.02, 0, H / 2, -D / 2 + 0.01, faces=('front',))
    bays = 4
    bw = W / bays
    for k in range(bays + 1):
        m.box_b('carcass', 0.04, H, D, -W / 2 + k * bw, 0, 0)
    for k in range(bays):
        cx = -W / 2 + bw * (k + 0.5)
        m.box('led', bw - 0.06, 0.015, 0.02, cx, H - 0.12, D / 2 - 0.06, faces=('bottom', 'front'))
        if k in (0, 3):
            # Hanging: a rail and a row of garments, behind glass doors.
            m.cyl('rail', 0.012, 0.012, bw - 0.06, cx - (bw - 0.06) / 2, 2.1, 0, seg=6, caps=False, axis='x')
            x = cx - bw / 2 + 0.08
            while x < cx + bw / 2 - 0.08:
                w = rnd.uniform(0.04, 0.07)
                L = rnd.uniform(0.7, 1.15)
                m.box(f'cloth{rnd.randrange(len(cols))}', w, L, 0.42, x, 2.08 - L / 2, 0, R=rot_y(rnd.uniform(-0.15, 0.15)))
                x += w + 0.015
            m.box_b('carcass', bw - 0.04, 0.03, D, cx, 0.75, 0)
            for s in range(2):
                m.box_b('inner', bw - 0.1, 0.25, 0.4, cx, 0.1 + s * 0.32, -0.04)
            m.box_b('glass', bw - 0.06, H - 0.2, 0.02, cx, 0.09, D / 2 - 0.01)
            m.box_b('handle', 0.02, 0.5, 0.03, cx + (bw / 2 - 0.08) * (1 if k == 0 else -1), 1.1, D / 2 + 0.01)
        elif k == 1:
            # Shoe and bag shelves.
            for s in range(6):
                y = 0.12 + s * 0.38
                m.box_b('carcass', bw - 0.04, 0.025, D, cx, y, 0)
                x = cx - bw / 2 + 0.1
                while x < cx + bw / 2 - 0.12:
                    c = f'cloth{rnd.randrange(len(cols))}'
                    if s >= 4:
                        m.box_b(c, 0.22, 0.2, 0.15, x + 0.1, y + 0.025, 0.05)
                        x += 0.27
                    else:
                        m.box_b(c, 0.1, 0.09, 0.26, x + 0.05, y + 0.025, 0.05)
                        x += 0.14
        else:
            # Drawers below, folded jumpers on shelves above.
            for d in range(4):
                y = 0.1 + d * 0.22
                m.box_b('inner', bw - 0.06, 0.2, 0.02, cx, y, D / 2 - 0.01)
                m.box_b('handle', 0.18, 0.02, 0.02, cx, y + 0.13, D / 2 + 0.01)
            for s in range(3):
                y = 1.05 + s * 0.45
                m.box_b('carcass', bw - 0.04, 0.025, D, cx, y, 0)
                for j in range(3):
                    m.box_b(f'cloth{rnd.randrange(len(cols))}', 0.22, 0.16, 0.32, cx - 0.26 + j * 0.26, y + 0.025, 0.02)
    return m


def dressing_island():
    """A dressing-room island: walnut drawers under a glass top showing watches. 1.6 x 0.9 x 0.7 m."""
    m = Model()
    m.material('walnut', '#4a2e1a', 0.5)
    m.material('top', '#e8e4dc', 0.25)
    m.material('glass', '#c8d8e8', 0.05, 0.2, alpha=0.25)
    m.material('velvet', '#1f2a44', 0.95)
    m.material('gold', '#d8b04a', 0.2, 0.95)
    m.material('silver', '#cfd2d8', 0.2, 0.95)
    m.material('handle', '#d8b04a', 0.3, 0.9)
    m.material('led', '#fff4e0', 0.3, emissive='#ffe8c8')
    W, H, D = 1.6, 0.9, 0.7
    m.box_b('walnut', W, H - 0.12, D, 0, 0.0, 0)
    m.box_b('led', W - 0.1, 0.02, D - 0.1, 0, 0.0, 0, faces=('front', 'back', 'left', 'right'))
    for c in (-1, 1):
        for r in range(3):
            y = 0.1 + r * 0.22
            m.box_b('walnut', W / 2 - 0.06, 0.19, 0.02, c * W / 4, y, D / 2)
            m.box_b('handle', 0.2, 0.02, 0.02, c * W / 4, y + 0.14, D / 2 + 0.02)
    m.box_b('velvet', W - 0.1, 0.02, D - 0.1, 0, H - 0.12, 0)
    for k in range(6):
        x = -W / 2 + 0.2 + k * 0.24
        m.cyl('gold' if k % 2 else 'silver', 0.04, 0.04, 0.015, x, H - 0.1, 0.0, seg=8)
        m.box_b('walnut', 0.03, 0.005, 0.18, x, H - 0.1, 0.0)
    m.box_b('glass', W, 0.1, D, 0, H - 0.12, 0, faces=('front', 'back', 'left', 'right', 'top'))
    m.box_b('top', W + 0.04, 0.025, D + 0.04, 0, H - 0.02, 0, faces=('front', 'back', 'left', 'right', 'bottom')) if False else None
    for sx in (-1, 1):
        m.box_b('top', 0.04, 0.12, D + 0.02, sx * (W / 2), H - 0.12, 0)
    return m


if __name__ == '__main__':
    for name, fn in (('pool_basin', pool_basin), ('pool_lounger', pool_lounger), ('cinema_screen', cinema_screen), ('projector', projector),
                     ('cinema_seats', cinema_seats), ('conservatory_glazing', conservatory), ('terrace_balustrade', terrace_balustrade),
                     ('terrace_deck', terrace_deck), ('terrace_sofa', terrace_sofa), ('terrace_table', terrace_table),
                     ('wardrobe_wall', wardrobe_wall), ('dressing_island', dressing_island)):
        m = fn()
        print(name, m.count(), m.save(f'{OUT}/{name}.glb', name))
