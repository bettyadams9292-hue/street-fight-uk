"""
Shop and casino fittings no kit has, modelled to match the city kit and the gym
pieces: faceted, bevelled, vertex-coloured, a few hundred triangles each.
Sizes match the props' footprints (PROP_SIZE in src/world/LevelTypes.ts), so
they drop in where the built-in boxes were.

    python3 tools/models/shop.py      # writes public/models/shop/*.glb

Front faces +z; x runs along the piece; y is up; metres.
"""
import math, os, random, sys
import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
from lowpoly import Model, rot_x, rot_y, rot_z  # noqa: E402

OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'public', 'models', 'shop')
CHROME = '#c9cdd2'
DARK = '#232325'
STEEL = '#5a5e64'
CREAM = '#e8e4dc'
WOOD = '#6b4a2e'
DARKWOOD = '#3a2414'
GOLD = '#c9a227'
FELT = '#1d5a30'
CLOTHES = ['#1a1a1a', '#1f2a44', '#7a1414', '#3a5a3a', '#e8e4dc', '#5a4a3a', '#8a8a8a', '#c97a1a']


def clothes_rail():
    m = Model()
    rnd = random.Random(3)
    W = 1.8
    # Chrome frame: two uprights on splayed feet with castors, and the top rail.
    for x in (-W / 2 + 0.05, W / 2 - 0.05):
        m.cyl(0.018, 1.5, (x, 0.8, 0), CHROME, 'metal', sides=8)
        m.cyl(0.015, 0.56, (x, 0.06, 0), CHROME, 'metal', axis='z', sides=8)
        for z in (-0.27, 0.27):
            m.cyl(0.03, 0.03, (x, 0.025, z), DARK, axis='x', sides=8)
    m.cyl(0.016, W, (0, 1.55, 0), CHROME, 'metal', axis='x', sides=8)
    m.cyl(0.012, W - 0.1, (0, 0.06, 0), CHROME, 'metal', axis='x', sides=8)
    # Hangers with garments: shirts and jackets of different lengths, thin across the rail.
    x = -W / 2 + 0.16
    while x < W / 2 - 0.12:
        c = rnd.choice(CLOTHES)
        length = rnd.choice([0.62, 0.7, 0.85, 0.95])
        m.box((0.012, 0.05, 0.36), (x, 1.5, 0), '#2a2a2a', R=rot_x(0))  # hanger bar
        m.box((0.035, 0.08, 0.42), (x, 1.44, 0), c, bevel=0.012)        # shoulders
        m.box((0.03, length, 0.38), (x, 1.42 - length / 2, 0), c, bevel=0.01)
        if rnd.random() < 0.5:  # sleeves hanging at the sides
            for z in (-0.21, 0.21):
                m.box((0.025, length * 0.7, 0.05), (x, 1.4 - length * 0.35, z), c)
        x += 0.09 + rnd.random() * 0.05
    return m


def mannequin(top, bottom):
    m = Model()
    SKIN = '#e8e4dc'
    m.cyl(0.2, 0.025, (0, 0.0125, 0), DARK, 'metal', sides=16)
    m.cyl(0.015, 0.7, (0, 0.38, 0), CHROME, 'metal', sides=6)
    # Trousers: hips and the top of the legs (the stand takes the rest).
    m.cyl(0.15, 0.2, (0, 0.78, 0), bottom, sides=10, r2=0.16)
    for x in (-0.075, 0.075):
        m.cyl(0.065, 0.08, (x, 0.65, 0), bottom, sides=8, r2=0.075)
    # Torso: waist to shoulders, in the top.
    m.cyl(0.15, 0.28, (0, 1.02, 0), top, sides=10, r2=0.18)
    m.cyl(0.18, 0.22, (0, 1.27, 0), top, sides=10, r2=0.13)
    m.box((0.44, 0.08, 0.2), (0, 1.36, 0), top, bevel=0.035)
    # Arms hanging slightly away from the body.
    for s in (-1, 1):
        m.cyl(0.045, 0.55, (s * 0.24, 1.1, 0), top, sides=8, r2=0.05, R=rot_z(s * 0.08))
        m.sphere(0.035, (s * 0.265, 0.8, 0.0), SKIN, seg=6, rings=4)
    # Neck and an egg head.
    m.cyl(0.045, 0.1, (0, 1.44, 0), SKIN, sides=8)
    m.sphere(0.11, (0, 1.59, 0.0), SKIN, scale=(0.85, 1.15, 0.95), seg=10, rings=7)
    return m


def changing_booth():
    m = Model()
    W, H, D = 1.2, 2.2, 1.2
    # Two side panels and the back, cream with a wood skirting and cap.
    for x in (-W / 2 + 0.025, W / 2 - 0.025):
        m.box((0.05, H, D), (x, H / 2, 0), CREAM, bevel=0.008)
        m.box((0.06, 0.12, D), (x, 0.06, 0), WOOD)
        m.box((0.07, 0.05, D + 0.02), (x, H - 0.02, 0), WOOD, bevel=0.01)
    m.box((W, H, 0.05), (0, H / 2, -D / 2 + 0.025), CREAM, bevel=0.008)
    # Mirror on the back wall with a light over it, a stool and a hook.
    m.box((0.52, 1.3, 0.02), (0, 1.15, -D / 2 + 0.06), '#a8b8c8', 'metal')
    m.box((0.58, 1.36, 0.015), (0, 1.15, -D / 2 + 0.055), WOOD)
    m.box((0.3, 0.04, 0.06), (0, 1.9, -D / 2 + 0.08), '#fff4d8', 'glow')
    m.cyl(0.17, 0.05, (0.3, 0.45, -0.2), WOOD, sides=12)
    for dx in (-0.12, 0.12):
        m.cyl(0.02, 0.43, (0.3 + dx, 0.21, -0.2), DARK, sides=5)
    m.cyl(0.01, 0.1, (-W / 2 + 0.1, 1.6, -0.1), CHROME, 'metal', axis='x', sides=5)
    # Curtain rail across the front with a pleated curtain drawn to one side.
    m.cyl(0.012, W, (0, H - 0.08, D / 2 - 0.04), CHROME, 'metal', axis='x', sides=6)
    folds = 6
    fw = 0.42 / folds
    for i in range(folds):
        x = -W / 2 + 0.05 + fw * (i + 0.5)
        z = D / 2 - 0.04 + (0.03 if i % 2 else -0.03)
        m.box((fw * 1.15, H - 0.2, 0.03), (x, (H - 0.12) / 2 + 0.03, z), '#2a3a5a', R=rot_y(0.5 if i % 2 else -0.5))
    return m


def display_cabinet():
    m = Model()
    rnd = random.Random(7)
    W, H, D = 1.6, 1.8, 0.7
    # Dark wood plinth and cap, chrome corner posts, glass all round, three glass shelves.
    m.box((W, 0.3, D), (0, 0.15, 0), DARKWOOD, bevel=0.02)
    m.box((W, 0.1, D), (0, H - 0.05, 0), DARKWOOD, bevel=0.02)
    for x in (-W / 2 + 0.02, W / 2 - 0.02):
        for z in (-D / 2 + 0.02, D / 2 - 0.02):
            m.box((0.03, H - 0.4, 0.03), (x, 0.3 + (H - 0.4) / 2, z), CHROME, 'metal')
    gh = H - 0.4
    m.box((W - 0.04, gh, 0.01), (0, 0.3 + gh / 2, D / 2 - 0.02), '#c8e0f0', 'glass')
    m.box((W - 0.04, gh, 0.01), (0, 0.3 + gh / 2, -D / 2 + 0.02), '#c8e0f0', 'glass')
    for x in (-W / 2 + 0.02, W / 2 - 0.02):
        m.box((0.01, gh, D - 0.04), (x, 0.3 + gh / 2, 0), '#c8e0f0', 'glass')
    m.box((W - 0.2, 0.02, 0.05), (0, H - 0.12, 0), '#fff4d8', 'glow')  # strip light
    for k in range(3):
        y = 0.32 + k * 0.45
        m.box((W - 0.06, 0.015, D - 0.06), (0, y, 0), '#c8e0f0', 'glass')
        # Watches, rings and phones on stands.
        for i in range(5):
            x = -W / 2 + 0.2 + i * (W - 0.4) / 4 + (rnd.random() - 0.5) * 0.08
            kind = rnd.random()
            if kind < 0.4:  # watch on a pillow
                m.box((0.09, 0.06, 0.07), (x, y + 0.04, 0), '#1a1a1a', bevel=0.015)
                m.cyl(0.03, 0.012, (x, y + 0.085, 0.01), GOLD if rnd.random() < 0.5 else CHROME, 'metal', axis='z', sides=10)
            elif kind < 0.7:  # ring box
                m.box((0.06, 0.04, 0.06), (x, y + 0.03, 0), '#5a1414', bevel=0.01)
                m.ring(0.015, 0.004, (x, y + 0.06, 0.0), GOLD, 'metal', axis='z', sides=8, tube=4)
            else:  # phone on a stand
                m.box((0.07, 0.14, 0.01), (x, y + 0.08, 0), DARK, R=rot_x(-0.25))
                m.box((0.06, 0.12, 0.005), (x, y + 0.08, 0.008), '#2a6ad8', 'glow', R=rot_x(-0.25))
    return m


def atm():
    m = Model()
    W, H, D = 0.7, 1.7, 0.5
    BODY = '#4a4d55'
    m.box((W, H, D), (0, H / 2, -0.02), BODY, bevel=0.03)
    # Recessed fascia: hood, screen, keypad, card and cash slots.
    m.box((W - 0.06, 0.6, 0.06), (0, 1.02, D / 2 - 0.02), '#2a2c30', bevel=0.01)
    m.box((W - 0.04, 0.05, 0.14), (0, 1.35, D / 2 + 0.03), BODY, bevel=0.01)  # hood
    m.box((0.36, 0.26, 0.02), (0, 1.17, D / 2 + 0.015), '#2a8ad8', 'glow', R=rot_x(-0.15))
    m.box((0.28, 0.06, 0.2), (-0.04, 0.88, D / 2 + 0.05), '#2a2c30', bevel=0.01, R=rot_x(0.35))
    for r in range(3):
        for k in range(3):
            m.box((0.05, 0.012, 0.04), (-0.12 + k * 0.07, 0.91 + r * 0.012, D / 2 + 0.06 + r * 0.035 - 0.04), '#c8ccd0', 'metal', R=rot_x(0.35))
    m.box((0.08, 0.02, 0.02), (0.22, 0.93, D / 2 + 0.03), '#2aff6a', 'glow')  # card slot light
    m.box((0.3, 0.03, 0.03), (0, 0.76, D / 2 + 0.02), DARK)                 # cash slot
    m.box((W, 0.18, 0.03), (0, H - 0.12, D / 2 - 0.01), '#1f6a3a', 'glow')  # green header (sign drawn on it)
    return m


def workbench():
    m = Model()
    W, H, D = 2.0, 2.0, 0.8
    # Thick wood top on steel legs with a lower shelf.
    m.box((W, 0.07, D), (0, 0.9, 0), '#8a6a3a', bevel=0.012)
    for x in (-W / 2 + 0.06, W / 2 - 0.06):
        for z in (-D / 2 + 0.06, D / 2 - 0.06):
            m.box((0.06, 0.87, 0.06), (x, 0.435, z), STEEL, 'metal', bevel=0.008)
    m.box((W - 0.1, 0.03, D - 0.1), (0, 0.18, 0), STEEL, 'metal')
    # A toolbox and a paint tin on the shelf.
    m.box((0.5, 0.22, 0.25), (-0.5, 0.31, 0), '#b81c1c', 'metal', bevel=0.02)
    m.cyl(0.09, 0.16, (0.4, 0.28, 0.05), '#d8d8d8', 'metal', sides=10)
    # Vice on the front corner.
    m.box((0.18, 0.1, 0.16), (W / 2 - 0.25, 0.99, D / 2 - 0.1), '#2a4a7a', 'metal', bevel=0.015)
    m.box((0.18, 0.08, 0.04), (W / 2 - 0.25, 1.02, D / 2 + 0.0), '#2a4a7a', 'metal')
    m.cyl(0.01, 0.2, (W / 2 - 0.25, 0.99, D / 2 + 0.04), CHROME, 'metal', axis='x', sides=5)
    # Pegboard with tools.
    m.box((W, 1.0, 0.03), (0, 1.55, -D / 2 + 0.015), '#7a5e3a')
    m.box((W + 0.04, 0.05, 0.05), (0, 2.07, -D / 2 + 0.025), '#5a4a3a')
    tools = [
        ('hammer', -0.8), ('spanner', -0.55), ('spanner', -0.45), ('spanner', -0.36), ('saw', -0.05),
        ('screwdriver', 0.3), ('screwdriver', 0.38), ('screwdriver', 0.46), ('pliers', 0.7),
    ]
    z = -D / 2 + 0.06
    for t, x in tools:
        if t == 'hammer':
            m.box((0.04, 0.34, 0.03), (x, 1.5, z), '#c8a060', bevel=0.008)
            m.box((0.16, 0.05, 0.04), (x, 1.68, z), STEEL, 'metal', bevel=0.008)
        elif t == 'spanner':
            m.box((0.03, 0.26, 0.015), (x, 1.55, z), CHROME, 'metal')
            m.ring(0.028, 0.009, (x, 1.7, z), CHROME, 'metal', axis='z', sides=8, tube=4)
        elif t == 'saw':
            m.box((0.45, 0.13, 0.008), (x, 1.62, z), '#b8bcc0', 'metal')
            m.box((0.1, 0.12, 0.025), (x + 0.26, 1.63, z), '#b81c1c', bevel=0.01)
        elif t == 'screwdriver':
            m.cyl(0.015, 0.1, (x, 1.42, z), '#e8c020', sides=6)
            m.cyl(0.004, 0.12, (x, 1.31, z), CHROME, 'metal', sides=4)
        elif t == 'pliers':
            for s in (-1, 1):
                m.box((0.02, 0.2, 0.01), (x + s * 0.02, 1.5, z), '#b81c1c', R=rot_z(s * 0.12))
    # Extension lead on the bench.
    m.box((0.3, 0.04, 0.07), (0.1, 0.955, 0.15), CREAM, bevel=0.01)
    return m


def grow_shelf():
    """Grow-shop shelving: white steel with a green back and price strips. The stock on it is the
    hydroponics pack's own kit, placed by the game (src/render/LevelView.ts)."""
    m = Model()
    W, H, D = 2.0, 2.0, 0.5
    FRAME = '#e8ece8'
    for x in (-W / 2 + 0.02, W / 2 - 0.02):
        for z in (-D / 2 + 0.02, D / 2 - 0.02):
            m.box((0.035, H, 0.035), (x, H / 2, z), FRAME, 'metal')
    m.box((W, H - 0.1, 0.01), (0, H / 2, -D / 2 + 0.01), '#2a8a3a')
    for lv in range(4):
        y = 0.12 + lv * 0.48
        m.box((W, 0.025, D), (0, y, 0), FRAME, 'metal')
        m.box((W, 0.035, 0.008), (0, y - 0.01, D / 2 + 0.005), '#ffd23d', 'glow')
    m.box((W, 0.05, D), (0, H - 0.02, 0), FRAME, 'metal')
    return m


def roulette_table():
    m = Model()
    W, D = 2.4, 1.2
    # Wood rim with a padded edge, felt top at 0.87 m (the layout and wheel are drawn over it).
    m.box((W, 0.08, D), (0, 0.82, 0), DARKWOOD, bevel=0.02)
    m.box((W - 0.1, 0.02, D - 0.1), (0, 0.865, 0), FELT)
    for x in (-W / 2 + 0.02, W / 2 - 0.02):
        m.box((0.06, 0.06, D), (x, 0.88, 0), '#4a2a14', bevel=0.02)
    for z in (-D / 2 + 0.02, D / 2 - 0.02):
        m.box((W, 0.06, 0.06), (0, 0.88, z), '#4a2a14', bevel=0.02)
    # Two turned pedestal ends and a footrest.
    for x in (-W / 2 + 0.4, W / 2 - 0.4):
        m.cyl(0.08, 0.7, (x, 0.43, 0), DARKWOOD, sides=10, r2=0.1)
        m.box((0.5, 0.08, D - 0.3), (x, 0.04, 0), DARKWOOD, bevel=0.02)
    m.cyl(0.02, W - 0.8, (0, 0.18, D / 2 - 0.2), GOLD, 'metal', axis='x', sides=8)
    # The wheel's bowl at the left end (the spinning wheel face sits in it).
    m.cyl(0.38, 0.12, (-W / 2 + 0.48, 0.94, 0), '#3a1a0a', sides=24, r2=0.34)
    m.ring(0.34, 0.015, (-W / 2 + 0.48, 1.0, 0), GOLD, 'metal', sides=24, tube=4)
    return m


def blackjack_table():
    m = Model()
    W, D = 2.2, 1.1
    # Kidney table: a half-ellipse, dealer on the straight back edge, players round the curve (+z).
    n = 20
    def edge(r_scale):
        return [(math.cos(math.pi * i / n) * W / 2 * r_scale, math.sin(math.pi * i / n) * D * 0.85 * r_scale - D / 2 + 0.05) for i in range(n + 1)]
    top = edge(1.0)
    felt = edge(0.9)
    y0, y1 = 0.78, 0.86
    cx, cz = 0, -D / 2 + 0.05
    for (ax, az), (bx, bz) in zip(top, top[1:]):
        m.quad((ax, y0, az), (bx, y0, bz), (bx, y1, bz), (ax, y1, az), '#4a2a14')  # side
        m.cyl(0.045, math.hypot(bx - ax, bz - az) + 0.02, ((ax + bx) / 2, y1 + 0.02, (az + bz) / 2), '#2a1a10', sides=6, axis='x', R=rot_y(-math.atan2(bz - az, bx - ax)))  # padded rail
        m.tri((cx, y1, cz), (bx, y1, bz), (ax, y1, az), '#4a2a14')
        m.tri((cx, y0, cz), (ax, y0, az), (bx, y0, bz), '#2a1a10')
    for (ax, az), (bx, bz) in zip(felt, felt[1:]):
        m.tri((cx, y1 + 0.006, cz + 0.02), (bx, y1 + 0.006, bz), (ax, y1 + 0.006, az), FELT)
    m.quad((-W / 2, y0, cz), (W / 2, y0, cz), (W / 2, y1, cz), (-W / 2, y1, cz), '#4a2a14')
    # Pedestal, dealer's chip tray and card shoe.
    m.cyl(0.1, 0.72, (0, 0.4, -0.1), DARKWOOD, sides=10, r2=0.12)
    m.box((0.8, 0.06, 0.5), (0, 0.03, -0.1), DARKWOOD, bevel=0.02)
    m.box((0.5, 0.05, 0.14), (0, y1 + 0.03, cz + 0.12), '#2a2a2e', bevel=0.01)
    for i in range(7):
        m.cyl(0.025, 0.045, (-0.21 + i * 0.07, y1 + 0.07, cz + 0.12), ['#c81010', '#1f4fa8', '#1a1a1a', CREAM, '#2a8a3a'][i % 5], sides=8, axis='z')
    m.box((0.14, 0.1, 0.2), (0.5, y1 + 0.05, cz + 0.15), '#7a1414', bevel=0.02)
    # Betting spots and dealt cards.
    for i in range(5):
        a = math.pi * (0.15 + i * 0.175)
        px, pz = math.cos(a) * W * 0.34, math.sin(a) * D * 0.55 - D / 2 + 0.05
        m.ring(0.07, 0.006, (px, y1 + 0.01, pz), '#e8d890', sides=12, tube=3)
        m.box((0.07, 0.004, 0.1), (px * 0.8, y1 + 0.012, pz - 0.12), '#f8f4ec', R=rot_y(a))
        m.box((0.07, 0.004, 0.1), (px * 0.8 + 0.03, y1 + 0.016, pz - 0.11), '#f8f4ec', R=rot_y(a + 0.2))
    # Three stools along the curve.
    for i in range(3):
        a = math.pi * (0.25 + i * 0.25)
        sx, sz = math.cos(a) * W * 0.42, math.sin(a) * D * 0.85 - D / 2 + 0.05 + 0.32
        m.cyl(0.17, 0.08, (sx, 0.68, sz), '#7a1414', sides=14)
        m.cyl(0.03, 0.62, (sx, 0.33, sz), GOLD, 'metal', sides=8)
        m.ring(0.12, 0.01, (sx, 0.3, sz), GOLD, 'metal', sides=12, tube=4)
        m.cyl(0.16, 0.02, (sx, 0.01, sz), DARK, sides=12)
    return m


def casino_cage():
    m = Model()
    W, D = 2.8, 0.8
    # Counter: dark wood with panels, a brass top.
    m.box((W, 1.0, D), (0, 0.5, 0), DARKWOOD, bevel=0.02)
    for i in range(4):
        m.box((W / 4 - 0.12, 0.6, 0.02), (-W / 2 + W / 8 + i * W / 4, 0.5, D / 2 + 0.005), '#4a2a14', bevel=0.01)
    m.box((W + 0.04, 0.05, D + 0.06), (0, 1.02, 0.01), GOLD, 'metal', bevel=0.01)
    # Brass grille with two serving windows, posts, and the header the sign goes on.
    for x in (-W / 2 + 0.04, W / 2 - 0.04, 0):
        m.box((0.08, 1.2, 0.08), (x, 1.65, D / 2 - 0.05), DARKWOOD, bevel=0.01)
    x = -W / 2 + 0.12
    while x < W / 2 - 0.08:
        win = abs(x + W / 4) < 0.3 or abs(x - W / 4) < 0.3
        if not win:
            m.cyl(0.008, 1.2, (x, 1.65, D / 2 - 0.05), GOLD, 'metal', sides=5)
        else:
            m.cyl(0.008, 0.6, (x, 1.95, D / 2 - 0.05), GOLD, 'metal', sides=5)
        x += 0.1
    for y in (1.35, 1.65, 2.2):
        m.box((W - 0.08, 0.025, 0.025), (0, y, D / 2 - 0.05), GOLD, 'metal')
    for wx in (-W / 4, W / 4):
        m.box((0.5, 0.03, 0.25), (wx, 1.06, D / 2 - 0.05), '#2a1a10')  # cash tray
    m.box((W, 0.3, D), (0, 2.4, 0), DARKWOOD, bevel=0.02)
    m.box((W + 0.04, 0.04, D + 0.04), (0, 2.25, 0), GOLD, 'metal')
    # Behind the glass: stacked chip racks and a lamp.
    for i in range(6):
        m.cyl(0.03, 0.12, (-0.9 + i * 0.12, 1.11, -0.15), ['#c81010', '#1f4fa8', '#1a1a1a', CREAM, '#2a8a3a', GOLD][i], sides=8)
    m.cyl(0.14, 0.12, (0.9, 2.15, 0), '#1a5a2a', sides=10, r2=0.04)
    m.sphere(0.05, (0.9, 2.08, 0), '#fff4d8', 'glow', seg=6, rings=4)
    return m


def main():
    models = [
        ('clothes_rail', clothes_rail),
        ('mannequin', lambda: mannequin('#1a1a1a', '#2a3a5a')),
        ('mannequin_red', lambda: mannequin('#7a1414', '#1a1a1a')),
        ('mannequin_navy', lambda: mannequin('#1f2a44', '#8a8a8a')),
        ('changing_booth', changing_booth),
        ('display_cabinet', display_cabinet),
        ('atm', atm),
        ('workbench', workbench),
        ('grow_shelf', grow_shelf),
        ('roulette_table', roulette_table),
        ('blackjack_table', blackjack_table),
        ('casino_cage', casino_cage),
    ]
    os.makedirs(OUT, exist_ok=True)
    for name, fn in models:
        m = fn()
        path = os.path.join(OUT, f'{name}.glb')
        m.save(path)
        lo, hi = m.bounds()
        print(f'{name:16s} {m.triangles():5d} tris  size {np.round(hi - lo, 2)}  min {np.round(lo, 2)}')


if __name__ == '__main__':
    main()
