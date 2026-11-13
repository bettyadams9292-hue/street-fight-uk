"""
Gym equipment the LowPoly Gym Assets pack (Matrixxy, CC BY 4.0) doesn't have,
modelled to match it: dark matte frames with bevelled edges, black pads,
chrome bars. Sizes follow the game's gym kit (src/training/gym.ts) so the
places your fighter trains on each machine stay where they were.

    python3 tools/models/gym.py      # writes public/models/gym/*.glb

Front faces +z; x runs along the machine; y is up; metres.
"""
import math, os, sys
import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from lowpoly import Model, rot_x, rot_z  # noqa: E402
import glbsheet  # noqa: E402

OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'public', 'models', 'gym')
FRAME = '#3a3b3e'
DARK = '#232325'
PAD = '#1b1b1c'
CHROME = '#c9cdd2'
RUBBER = '#141415'
RED = '#9a1c1c'
SCREEN = '#3ab8ff'


def import_glb(m, path, scale, at, R=None):
    """Copy another model's triangles into m (used to put the pack's barbell on the squat rack)."""
    T, C = glbsheet.triangles(path)
    js, _ = glbsheet.load_glb(path)
    R = np.eye(3) if R is None else R
    # Keep chrome parts shiny: the pack's bar is the light grey one.
    for tri, col in zip(T, C):
        P = (R @ (tri * scale).T).T + np.asarray(at)
        mat = 'metal' if min(col) > 0.5 else 'solid'
        m.tris[mat].append((P, list(col)))


def treadmill():
    m = Model()
    # Deck: the running belt is at 0.17 m, where the fighter stands.
    m.box((1.72, 0.12, 0.72), (-0.04, 0.07, 0), FRAME, bevel=0.03)
    m.box((1.5, 0.03, 0.52), (-0.08, 0.145, 0), RUBBER)
    for z in (-0.3, 0.3):
        m.box((1.55, 0.04, 0.09), (-0.06, 0.15, z), DARK, bevel=0.012)  # side rails to step on
    m.cyl(0.05, 0.6, (-0.86, 0.07, 0), DARK, axis='z', sides=10)      # rear roller
    m.cyl(0.06, 0.62, (0.74, 0.08, 0), DARK, axis='z', sides=10)      # motor hood roller
    m.box((0.32, 0.16, 0.7), (0.78, 0.13, 0), FRAME, bevel=0.04)       # motor cover
    # Uprights leaning back toward the runner, with handrails.
    for z in (-0.32, 0.32):
        m.box((0.07, 1.2, 0.07), (0.78, 0.68, z), FRAME, bevel=0.015, R=rot_z(0.22))
        m.cyl(0.02, 0.42, (0.5, 1.02, z), CHROME, 'metal', axis='x', sides=8)
        m.box((0.12, 0.05, 0.05), (0.33, 1.02, z), PAD, bevel=0.01)   # grip
    # Console: angled panel with a lit screen and buttons.
    m.box((0.22, 0.26, 0.74), (0.98, 1.3, 0), DARK, bevel=0.03, R=rot_z(0.5))
    m.box((0.02, 0.13, 0.36), (0.9, 1.33, 0), SCREEN, 'glow', R=rot_z(0.5))
    for i in range(5):
        m.box((0.015, 0.03, 0.04), (0.93, 1.21, -0.24 + i * 0.12), RED if i == 4 else '#d8d8d8', R=rot_z(0.5))
    m.cyl(0.035, 0.03, (0.87, 1.42, 0.3), RED, axis='x', sides=10)     # stop button
    return m


def exercise_bike():
    m = Model()
    # Base: two feet joined by a beam.
    m.box((0.12, 0.08, 0.56), (-0.48, 0.04, 0), FRAME, bevel=0.02)
    m.box((0.12, 0.08, 0.5), (0.44, 0.04, 0), FRAME, bevel=0.02)
    m.box((0.95, 0.08, 0.1), (-0.02, 0.07, 0), FRAME, bevel=0.02)
    # Flywheel at the front with its guard.
    m.cyl(0.24, 0.06, (0.3, 0.33, 0), DARK, axis='z', sides=18)
    m.cyl(0.235, 0.02, (0.3, 0.33, 0.04), FRAME, axis='z', sides=18)
    m.ring(0.235, 0.012, (0.3, 0.33, 0.05), CHROME, 'metal', axis='z', sides=18, tube=4)
    m.cyl(0.05, 0.03, (0.3, 0.33, 0.06), CHROME, 'metal', axis='z', sides=10)
    m.box((0.5, 0.06, 0.12), (0.26, 0.6, 0), FRAME, bevel=0.02)
    # Seat post leaning back, saddle at 0.86 m.
    m.box((0.08, 0.8, 0.08), (-0.14, 0.45, 0), FRAME, bevel=0.015, R=rot_z(-0.32))
    m.box((0.32, 0.07, 0.2), (-0.22, 0.86, 0), PAD, bevel=0.03)
    m.box((0.18, 0.06, 0.14), (-0.3, 0.83, 0), PAD, bevel=0.02)
    # Cranks and pedals.
    m.cyl(0.07, 0.14, (0.08, 0.32, 0), CHROME, 'metal', axis='z', sides=10)
    for s in (-1, 1):
        m.box((0.03, 0.18, 0.02), (0.08, 0.32 + s * 0.08, s * 0.09), CHROME, 'metal')
        m.box((0.11, 0.03, 0.08), (0.08, 0.32 + s * 0.16, s * 0.14), DARK, bevel=0.01)
    # Handlebar stem and bars with grips.
    m.box((0.07, 0.62, 0.07), (0.36, 0.85, 0), FRAME, bevel=0.015, R=rot_z(0.25))
    m.cyl(0.02, 0.46, (0.44, 1.12, 0), CHROME, 'metal', axis='z', sides=8)
    for z in (-0.2, 0.2):
        m.cyl(0.027, 0.12, (0.44, 1.12, z), PAD, axis='z', sides=8)
    # Little console.
    m.box((0.1, 0.08, 0.14), (0.46, 1.2, 0), DARK, bevel=0.015)
    m.box((0.01, 0.05, 0.1), (0.4, 1.21, 0), '#40ff90', 'glow')
    return m


def speed_ball():
    m = Model()
    y = 1.7
    # Wall board and the round rebound board on brackets.
    m.box((0.62, 0.55, 0.05), (0, y + 0.05, -0.2), FRAME, bevel=0.015)
    for x in (-0.22, 0.22):
        m.box((0.05, 0.05, 0.4), (x, y + 0.3, -0.02), DARK, bevel=0.01)
    m.cyl(0.32, 0.06, (0, y + 0.34, 0.02), '#6a4a2a', sides=16)
    m.cyl(0.33, 0.02, (0, y + 0.37, 0.02), DARK, sides=16)
    # Swivel and the teardrop ball.
    m.cyl(0.015, 0.08, (0, y + 0.27, 0.06), CHROME, 'metal', sides=6)
    m.sphere(0.1, (0, y + 0.12, 0.06), RED, scale=(1, 1.3, 1), seg=10, rings=7)
    return m


def squat_rack():
    m = Model()
    # Uprights with J-hooks, joined at the top and on the floor.
    for x in (-0.6, 0.6):
        m.box((0.075, 1.9, 0.075), (x, 0.95, -0.15), FRAME, bevel=0.012)
        m.box((0.075, 0.075, 0.62), (x, 0.0375, 0.0), FRAME, bevel=0.012)
        # Holes up the uprights (small dark squares on the front face).
        for k in range(12):
            m.box((0.025, 0.025, 0.004), (x, 0.55 + k * 0.1, -0.11), DARK)
        m.box((0.09, 0.05, 0.12), (x, 1.35, -0.07), RED, bevel=0.01)   # J-hook
        m.box((0.03, 0.08, 0.03), (x, 1.39, -0.02), RED)
        # Safety arm.
        m.box((0.05, 0.05, 0.42), (x, 0.75, 0.05), CHROME, 'metal', bevel=0.008)
    m.box((1.275, 0.075, 0.075), (0, 1.88, -0.15), FRAME, bevel=0.012)
    m.box((1.275, 0.075, 0.075), (0, 0.0375, -0.3), FRAME, bevel=0.012)
    # Plate horns on the back.
    for x in (-0.42, 0.42):
        m.cyl(0.025, 0.2, (x, 0.5, -0.25), CHROME, 'metal', axis='z', sides=8)
    # The pack's loaded barbell, resting on the hooks (its bar is about 3.68 units long: make it 1.7 m).
    import_glb(m, os.path.join(OUT, 'barbell.glb'), 1.7 / 3.68, (0, 1.42 - 0.635 * 1.7 / 3.68, -0.06))
    # A spare plate leaning on the base.
    m.cyl(0.2, 0.04, (0.42, 0.22, -0.3), RUBBER, axis='z', sides=12, R=rot_x(-0.12))
    return m


def glove_rack():
    m = Model()
    # A wall rack: two rails of hooks with gloves, pads and skipping ropes.
    m.box((1.2, 1.5, 0.04), (0, 0.95, -0.2), FRAME, bevel=0.01)
    for y in (0.6, 1.15):
        m.box((1.16, 0.04, 0.12), (0, y, -0.14), DARK, bevel=0.01)
    colours = [RED, '#1f4fa8', RUBBER, RED, '#1f4fa8', RUBBER]
    for i, c in enumerate(colours):
        x = -0.42 + (i % 3) * 0.42
        y = 1.0 if i < 3 else 0.45
        for dx in (-0.06, 0.06):
            m.sphere(0.075, (x + dx, y, -0.06), c, scale=(0.9, 1.15, 1), seg=8, rings=6)
            m.box((0.1, 0.07, 0.1), (x + dx, y - 0.11, -0.07), c, bevel=0.02)  # cuff
        m.cyl(0.006, 0.12, (x, y + 0.12, -0.12), CHROME, 'metal', sides=5)  # hook
    # Focus pads and a coiled skipping rope on the top.
    for x in (-0.35, -0.15):
        m.box((0.16, 0.2, 0.06), (x, 1.47, -0.12), '#e8c020', bevel=0.03)
    m.ring(0.1, 0.008, (0.35, 1.5, -0.12), '#e8c020', axis='z', sides=12, tube=4)
    return m


def main():
    for name, fn in [('treadmill', treadmill), ('exercise_bike', exercise_bike), ('speed_ball', speed_ball), ('squat_rack', squat_rack), ('glove_rack', glove_rack)]:
        m = fn()
        path = os.path.join(OUT, f'{name}.glb')
        m.save(path)
        lo, hi = m.bounds()
        print(f'{name:14s} {m.triangles():5d} tris  {np.round(hi - lo, 2)}')


if __name__ == '__main__':
    main()
