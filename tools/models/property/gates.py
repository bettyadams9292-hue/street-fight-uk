import sys, math
sys.path.insert(0, '/tmp/property')
from glb import Model, rot_y
OUT = '/tmp/property/out'


def iron_mats(m, pier):
    m.material('iron', '#18191c', 0.4, 0.6)
    m.material('pier', pier, 0.85)
    m.material('lamp', '#fff2d0', 0.3, emissive='#ffd890')
    m.material('gold', '#d8b04a', 0.3, 0.9)


def bar(m, x, y0, h, z, R=None, off=(0, 0, 0)):
    """A square railing bar with a spear head."""
    m.box('iron', 0.035, h, 0.035, x, y0 + h / 2, z, faces=('front', 'back', 'left', 'right'))
    t = y0 + h
    a, b, c, d = (x - 0.05, t, z + 0.05), (x + 0.05, t, z + 0.05), (x + 0.05, t, z - 0.05), (x - 0.05, t, z - 0.05)
    tip = (x, t + 0.14, z)
    m.tri('gold', a, b, tip); m.tri('gold', b, c, tip); m.tri('gold', c, d, tip); m.tri('gold', d, a, tip)


def railing(pier):
    """A 4 m run of railings on a low wall, origin at the bottom centre, front +z."""
    m = Model()
    iron_mats(m, pier)
    m.box_b('pier', 4.0, 0.5, 0.3, 0, 0, 0, faces=('front', 'back', 'top', 'left', 'right'))
    m.box_b('pier', 4.04, 0.06, 0.36, 0, 0.5, 0)
    for i in range(25):
        bar(m, -2 + 0.08 + i * 0.16, 0.56, 1.36, 0)
    for y in (0.72, 1.78):
        m.box('iron', 4.0, 0.05, 0.05, 0, y, 0)
    return m


def gates(pier):
    """Gate piers 3.6 m apart with lamps on top, and the two iron gates standing open (swung inward)."""
    m = Model()
    iron_mats(m, pier)
    for sx in (-1, 1):
        px = sx * 1.8
        m.box_b('pier', 0.55, 2.3, 0.55, px, 0, 0, faces=('front', 'back', 'left', 'right'))
        m.box_b('pier', 0.7, 0.14, 0.7, px, 2.3, 0)
        m.box_b('pier', 0.5, 0.08, 0.5, px, 2.44, 0)
        # Lantern.
        m.box_b('iron', 0.26, 0.05, 0.26, px, 2.52, 0)
        m.box_b('lamp', 0.2, 0.32, 0.2, px, 2.57, 0, faces=('front', 'back', 'left', 'right'))
        for cx in (-1, 1):
            for cz in (-1, 1):
                m.box_b('iron', 0.025, 0.32, 0.025, px + cx * 0.105, 2.57, cz * 0.105)
        m.prism('iron', [(-0.16, 0), (0.16, 0), (0, 0.16)], 0.32, z0=-0.16, offset=(px, 2.89, 0))
        # The gate leaf: hinged at the pier, swung back toward the house.
        hinge = sx * 1.5
        ang = -sx * 1.35
        R = rot_y(ang)
        leaf = Model()
        def L(xl, yc, w, h, d=0.04):
            # local: x along the leaf from the hinge (toward the centre), rotate, then move to the hinge.
            v = R @ [(-sx) * xl, 0, 0]
            m.box('iron', w, h, d, hinge + v[0], yc, v[2], R=R)
        L(0.75, 1.85, 1.5, 0.06)
        L(0.75, 0.22, 1.5, 0.06)
        L(0.75, 1.1, 1.5, 0.04)
        for k in range(9):
            xl = 0.06 + k * 0.17
            v = R @ [(-sx) * xl, 0, 0]
            bar(m, hinge + v[0], 0.12, 1.75 + 0.25 * math.sin(math.pi * k / 8), v[2])
        # A little scroll at the top of each gate.
        v = R @ [(-sx) * 0.75, 0, 0]
        m.cyl('gold', 0.12, 0.12, 0.03, hinge + v[0], 1.4, v[2], seg=8, axis='z', R=None) if False else None
    return m


if __name__ == '__main__':
    for name, fn, pier in (('railing_stone', railing, '#d8d0c0'), ('railing_brick', railing, '#8a5a48'), ('gates_stone', gates, '#d8d0c0'), ('gates_brick', gates, '#8a5a48')):
        m = fn(pier)
        print(name, m.count(), m.save(f'{OUT}/{name}.glb', name))
