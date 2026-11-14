import sys, math
sys.path.insert(0, '/tmp/property')
from glb import Model, rot_y, rot_x, rot_z
OUT = '/tmp/property/out'


def staircase():
    """A straight flight up to the right, 2.2 m long x 1.0 m deep x 2.52 m rise, banister on the open (front) side."""
    m = Model()
    m.material('tread', '#8a5a32', 0.55)
    m.material('riser', '#f0ece2', 0.7)
    m.material('rail', '#3a2416', 0.4)
    W, D, n, rise = 2.2, 1.0, 12, 0.21
    run = W / n
    for i in range(n):
        x = -W / 2 + run * (i + 0.5)
        m.box('riser', 0.025, rise, D - 0.08, x - run / 2 + 0.0125, rise * (i + 0.5), -0.02, faces=('left', 'right'))
        m.box('tread', run + 0.03, 0.045, D - 0.04, x, rise * (i + 1) - 0.02, 0, faces=('front', 'top', 'left', 'right', 'bottom'))
    # The solid side below the flight (a triangle of white panelling) and the stringers.
    # Cut string on the open side: the stepped outline, painted, with the treads' nosings over it.
    for i in range(n):
        x = -W / 2 + run * (i + 0.5)
        m.box_b('riser', run + 0.002, rise * (i + 1) - 0.045, 0.04, x, 0, D / 2 - 0.04, faces=('front', 'back', 'left', 'right'))
    m.prism('riser', [(-W / 2, 0), (W / 2, 0), (W / 2, rise * n)], 0.02, z0=-D / 2)
    a = math.atan2(rise * n, W)
    L = math.hypot(W, rise * n)
    # Handrail, balusters and newel posts.
    m.box('rail', L + 0.2, 0.07, 0.08, 0.05, rise * n / 2 + 0.95, D / 2 - 0.02, R=rot_z(a))
    for i in range(0, n, 1):
        x = -W / 2 + run * (i + 0.5)
        y0 = rise * (i + 1)
        top = (x + W / 2) / W * rise * n + 0.92
        m.box_b('riser', 0.035, top - y0, 0.035, x, y0, D / 2 - 0.02, faces=('front', 'back', 'left', 'right'))
    for x, y0, h in ((-W / 2 + 0.06, 0, 1.15), (W / 2 - 0.04, rise * n - 0.3, 1.35)):
        m.box_b('rail', 0.13, h, 0.13, x, y0, D / 2 - 0.02)
        m.box_b('rail', 0.17, 0.06, 0.17, x, y0 + h, D / 2 - 0.02)
        m.box_b('rail', 0.08, 0.08, 0.08, x, y0 + h + 0.06, D / 2 - 0.02)
    # Carpet runner up the middle.
    m.material('runner', '#7a2a2a', 0.95)
    for i in range(n):
        x = -W / 2 + run * (i + 0.5)
        m.box('runner', run + 0.01, 0.01, 0.55, x, rise * (i + 1) + 0.008, -0.05, faces=('top',))
        m.box('runner', 0.01, rise, 0.55, x - run / 2 + 0.03, rise * (i + 0.5), -0.05, faces=('left',))
    return m


def agent_board():
    """An estate agent's board on a post. The board's face (material board_face, uv 0..1) takes the artwork."""
    m = Model()
    m.material('post', '#e8e4dc', 0.6)
    m.material('board_edge', '#16365a', 0.5)
    m.material('board_face', '#ffffff', 0.55, uv=True)
    m.material('metal', '#9a9ea6', 0.4, 0.7)
    m.box_b('post', 0.08, 2.15, 0.08, 0, 0, 0, faces=('front', 'back', 'left', 'right', 'top'))
    m.prism('post', [(-0.06, 0), (0.06, 0), (0, 0.08)], 0.1, z0=-0.05, offset=(0, 2.15, 0))
    m.box_b('metal', 0.05, 0.05, 0.12, -0.25, 2.06, 0.04)
    m.box_b('metal', 0.05, 0.05, 0.12, 0.25, 2.06, 0.04)
    m.box('board_edge', 0.78, 0.53, 0.025, 0, 1.82, 0.075, faces=('back', 'left', 'right', 'top', 'bottom'))
    hw, hh, z = 0.39, 0.265, 0.0885
    m.quad('board_face', (-hw, 1.82 - hh, z), (hw, 1.82 - hh, z), (hw, 1.82 + hh, z), (-hw, 1.82 + hh, z), uv=((0, 0), (1, 0), (1, 1), (0, 1)))
    return m


def agent_window():
    """Keys & Co's window display: two posts on feet, wires, six lit listing cards and a header.
    photo_0..photo_5 and header take textures (uv 0..1)."""
    m = Model()
    m.material('alu', '#c8ccd2', 0.35, 0.8)
    m.material('acrylic', '#f4f4f0', 0.3)
    m.material('card', '#f8f6f0', 0.6, emissive='#3a3a36')
    m.material('text', '#5a5a5e', 0.8)
    m.material('header', '#16365a', 0.5, uv=True, emissive='#202020')
    m.material('led', '#ffffff', 0.3, emissive='#fff4e0')
    for i in range(6):
        m.material(f'photo_{i}', '#8a9ab8', 0.5, uv=True, emissive='#303030')
    W, H = 2.1, 2.2
    for sx in (-1, 1):
        m.box_b('alu', 0.05, H, 0.05, sx * W / 2, 0, 0)
        m.box_b('alu', 0.08, 0.03, 0.4, sx * W / 2, 0, 0.05)
    m.box('alu', W + 0.05, 0.05, 0.05, 0, H, 0)
    m.box('led', W - 0.1, 0.02, 0.02, 0, H - 0.04, 0.03)
    m.box('header', W - 0.1, 0.32, 0.02, 0, H - 0.26, 0.0, faces=('back', 'left', 'right', 'top', 'bottom'))
    hz = 0.011
    m.quad('header', (-W / 2 + 0.05, H - 0.42, hz), (W / 2 - 0.05, H - 0.42, hz), (W / 2 - 0.05, H - 0.10, hz), (-W / 2 + 0.05, H - 0.10, hz))
    cw, ch = 0.58, 0.62
    k = 0
    for r, cy in enumerate((1.36, 0.62)):
        for c, cx in enumerate((-0.68, 0, 0.68)):
            # wires
            m.box('alu', 0.006, 0.12, 0.006, cx - 0.2, cy + ch / 2 + 0.06, 0)
            m.box('alu', 0.006, 0.12, 0.006, cx + 0.2, cy + ch / 2 + 0.06, 0)
            m.box('card', cw, ch, 0.012, cx, cy, 0, faces=('back', 'left', 'right', 'top', 'bottom'))
            z = 0.0065
            m.quad('card', (cx - cw / 2, cy - ch / 2, z), (cx + cw / 2, cy - ch / 2, z), (cx + cw / 2, cy + ch / 2, z), (cx - cw / 2, cy + ch / 2, z))
            pw, ph = cw - 0.06, (cw - 0.06) * 0.625
            py = cy + ch / 2 - 0.03 - ph / 2
            z2 = 0.008
            m.quad(f'photo_{k}', (cx - pw / 2, py - ph / 2, z2), (cx + pw / 2, py - ph / 2, z2), (cx + pw / 2, py + ph / 2, z2), (cx - pw / 2, py + ph / 2, z2))
            for t, tw in enumerate((0.36, 0.44, 0.26)):
                ty = cy - ch / 2 + 0.2 - t * 0.055
                m.quad('text', (cx - pw / 2, ty, z2), (cx - pw / 2 + tw, ty, z2), (cx - pw / 2 + tw, ty + 0.025, z2), (cx - pw / 2, ty + 0.025, z2))
            k += 1
    return m


def jewel_bust():
    """A velvet necklace bust on a white plinth, with a gold chain and pendant. 'velvet' takes the shop's colour."""
    m = Model()
    m.material('plinth', '#e8e4dc', 0.3)
    m.material('velvet', '#1a1a22', 0.95)
    m.material('gold', '#d8b04a', 0.18, 0.95, emissive='#3a2a08')
    m.material('base', '#2a2a30', 0.5)
    m.box_b('plinth', 0.44, 0.88, 0.4, 0, 0, 0)
    m.box_b('base', 0.46, 0.04, 0.42, 0, 0.0, 0)
    m.box_b('plinth', 0.48, 0.03, 0.44, 0, 0.88, 0)
    # Base of the bust and the bust itself: a faceted shoulders-and-neck shape.
    m.cyl('velvet', 0.09, 0.07, 0.05, 0, 0.91, 0, seg=8)
    m.cyl('velvet', 0.03, 0.03, 0.07, 0, 0.96, 0, seg=6, caps=False)
    prof = [(-0.17, 0.0), (0.17, 0.0), (0.18, 0.12), (0.12, 0.2), (0.05, 0.23), (-0.05, 0.23), (-0.12, 0.2), (-0.18, 0.12)]
    m.prism('velvet', prof, 0.12, z0=-0.06, offset=(0, 1.03, 0))
    m.cyl('velvet', 0.05, 0.045, 0.16, 0, 1.24, 0, seg=8)
    m.cyl('velvet', 0.06, 0.06, 0.02, 0, 1.40, 0, seg=8)
    # Chain: a V of little links from the neck down to a pendant.
    pts = []
    for i in range(13):
        t = -1 + 2 * i / 12
        pts.append((t * 0.075, 1.27 - 0.13 * (1 - t * t), 0.062 + 0.0 * t))
    for (x0, y0, z0), (x1, y1, z1) in zip(pts, pts[1:]):
        L = math.hypot(x1 - x0, y1 - y0)
        a = math.atan2(y1 - y0, x1 - x0)
        m.box('gold', L + 0.004, 0.012, 0.012, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, R=rot_z(a))
    m.prism('gold', [(0, -0.05), (0.025, -0.02), (0.012, 0.0), (-0.012, 0.0), (-0.025, -0.02)], 0.012, z0=0.058, offset=(0, 1.14, 0))
    return m


if __name__ == '__main__':
    for name, fn in (('staircase', staircase), ('agent_board', agent_board), ('agent_window', agent_window), ('jewel_bust', jewel_bust)):
        m = fn()
        print(name, m.count(), m.save(f'{OUT}/{name}.glb', name))
