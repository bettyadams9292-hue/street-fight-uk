#!/usr/bin/env python3
"""
Builds the low-poly melee weapon models in public/models/weapons (original work for
Street Fight UK; no downloaded assets).

    python3 tools/weapons/build_weapons.py [out_dir]

Every model follows the game's weapon convention (src/render/weaponMesh.ts): the grip
is at the origin and the weapon runs up +y, at real-world size in metres. Wide parts
(hammer heads, blades, sign faces) lie in the XY plane; +x is the striking side.
The scene's extras carry `length`, the weapon length the model was made for, so
PropLibrary can scale it if a weapon's length ever changes.

Flat colours from docs/assets/ASSET_STYLE_GUIDE.md, flat-shaded, 100-1,200 triangles.
No guns: every weapon in the game is melee or thrown.
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lowpoly import Mat, Model, Rx, Ry, Rz, T, chain  # noqa: E402

PI = math.pi

# ---------------------------------------------------------------- palette
# Metals are kept fairly rough and only half metallic: the game has no environment
# map, so a fully metallic surface renders black.
STEEL = Mat('steel', '#b9bdc4', 0.45, 0.42)
DARK_STEEL = Mat('dark_steel', '#5a5a5e', 0.45, 0.5)
GALV = Mat('galvanised', '#8a9098', 0.4, 0.5)
IRON = Mat('cast_iron', '#2a2a2e', 0.3, 0.6)
IRON_IN = Mat('cast_iron_inside', '#3a3a3e', 0.3, 0.45)
RUBBER = Mat('rubber', '#2a2a2e', 0.0, 0.9)
BLACK = Mat('black_plastic', '#1c1c20', 0.0, 0.6)
WOOD_LIGHT = Mat('wood_light', '#c8a070', 0.0, 0.8)
WOOD_MID = Mat('wood_mid', '#8a5a32', 0.0, 0.75)
WOOD_DARK = Mat('wood_dark', '#4a2e1a', 0.0, 0.75)
WHITE = Mat('white', '#f2efe6', 0.0, 0.7)
CREAM = Mat('cream', '#dcd4c0', 0.0, 0.95)
RED = Mat('red', '#e8333a', 0.0, 0.6)
RED_PAINT = Mat('red_paint', '#b3121b', 0.15, 0.5)
BLUE = Mat('blue', '#1f3f8a', 0.0, 0.6)
NAVY = Mat('navy', '#1f2a44', 0.0, 0.8)
GLASS = Mat('bottle_glass', '#2f6b3a', 0.1, 0.1, alpha=0.85, double=True)


def M(name, hex_colour, metal=0.0, rough=0.8, **kw):
    return Mat(name, hex_colour, metal, rough, **kw)


MODELS = {}


def weapon(wid, length):
    def deco(fn):
        MODELS[wid] = (fn, length)
        return fn
    return deco


def circle(r, n, cx=0.0, cy=0.0, a0=0.0):
    return [(cx + r * math.cos(a0 + 2 * PI * i / n), cy + r * math.sin(a0 + 2 * PI * i / n)) for i in range(n)]


def arc(cx, cy, r, a0, a1, n):
    return [(cx + r * math.cos(a0 + (a1 - a0) * i / n), cy + r * math.sin(a0 + (a1 - a0) * i / n)) for i in range(n + 1)]


def d_handle(m, grip, shaft_r=0.016):
    """A spade's D grip: crossbar at the origin, two arms down into the shaft at y = 0.13."""
    m.tube(grip, [(-0.055, 0, 0), (0.055, 0, 0)], 0.016, 6)
    m.tube(grip, [(0.055, -0.005, 0), (0.05, 0.05, 0), (0.025, 0.105, 0), (0.006, 0.135, 0)], 0.011, 5)
    m.tube(grip, [(-0.055, -0.005, 0), (-0.05, 0.05, 0), (-0.025, 0.105, 0), (-0.006, 0.135, 0)], 0.011, 5)
    m.lathe(grip, [(0, 0.12), (shaft_r + 0.004, 0.12), (shaft_r + 0.004, 0.17), (0, 0.17)], 8)


# ---------------------------------------------------------------- conventional

@weapon('bottle', 0.3)
def bottle(m):
    # Held by the neck; the mouth pokes out behind the fist, the base is the business end.
    m.lathe(GLASS, [(0, -0.035), (0.016, -0.035), (0.016, -0.025), (0.013, -0.02), (0.013, 0.07),
                    (0.022, 0.1), (0.035, 0.13), (0.036, 0.255), (0.033, 0.265), (0, 0.265)], 10)
    m.lathe(CREAM, [(0, 0.15), (0.0375, 0.15), (0.0375, 0.225), (0, 0.225)], 10)
    m.lathe(M('foil', '#d8b04a', 0.4, 0.4), [(0, -0.036), (0.017, -0.036), (0.017, -0.012), (0, -0.012)], 10)


@weapon('broken_bottle', 0.2)
def broken_bottle(m):
    m.lathe(GLASS, [(0, -0.035), (0.016, -0.035), (0.016, -0.025), (0.013, -0.02), (0.013, 0.07),
                    (0.022, 0.1), (0.035, 0.13), (0, 0.13)], 10)
    # A jagged crown of shards: each facet rises to a different height.
    seg = 10
    heights = [0.2, 0.15, 0.18, 0.14, 0.205, 0.16, 0.145, 0.19, 0.15, 0.17]
    for j in range(seg):
        a0, a1 = 2 * PI * j / seg, 2 * PI * (j + 1) / seg
        r = 0.035
        p0 = (r * math.sin(a0), 0.13, r * math.cos(a0))
        p1 = (r * math.sin(a1), 0.13, r * math.cos(a1))
        h0, h1 = heights[j], heights[(j + 1) % seg]
        mid = 0.5 * (h0 + h1) - 0.025
        q1 = (r * math.sin(a1), mid, r * math.cos(a1))
        tip = (r * math.sin(a0), h0, r * math.cos(a0))
        m.poly(GLASS, [p0, p1, q1, tip])


@weapon('bat', 0.85)
def cricket_bat(m):
    m.lathe(M('grip_red', '#7a2a2a', 0, 0.9), [(0, -0.01), (0.018, -0.01), (0.019, 0.0), (0.019, 0.27), (0.017, 0.28), (0, 0.28)], 8)
    m.lathe(WOOD_LIGHT, [(0, 0.27), (0.016, 0.27), (0.016, 0.31), (0, 0.31)], 8)
    blade = [(-0.054, -0.012), (0.054, -0.012), (0.054, 0.006), (0.022, 0.03), (-0.022, 0.03), (-0.054, 0.006)]
    shoulder = [(-0.03, -0.01), (0.03, -0.01), (0.03, 0.012), (-0.03, 0.012)]
    m.extrude_y(WOOD_LIGHT, shoulder, 0.29, 0.33)
    m.extrude_y(M('willow', '#d8b880', 0, 0.8), blade, 0.33, 0.84)
    # Rounded toe.
    m.extrude_y(M('willow', '#d8b880', 0, 0.8), [(-0.048, -0.01), (0.048, -0.01), (0.048, 0.004), (0.018, 0.022), (-0.018, 0.022), (-0.048, 0.004)], 0.84, 0.85)
    m.box(M('sticker', '#1f3f8a', 0, 0.6), 0.07, 0.06, 0.002, 0, 0.42, -0.0125)


@weapon('baseball_bat', 0.86)
def baseball_bat(m):
    m.lathe(WOOD_MID, [(0, -0.015), (0.028, -0.015), (0.03, -0.005), (0.016, 0.005), (0.0125, 0.03), (0.0125, 0.24),
                       (0.016, 0.38), (0.026, 0.55), (0.033, 0.68), (0.035, 0.82), (0.03, 0.85), (0, 0.86)], 10)
    m.lathe(RUBBER, [(0, 0.0), (0.0145, 0.0), (0.0145, 0.21), (0, 0.21)], 10)


@weapon('pipe', 0.75)
def lead_pipe(m):
    lead = M('lead', '#7c8088', 0.35, 0.6)
    m.lathe(lead, [(0, 0), (0.019, 0), (0.019, 0.62), (0, 0.62)], 8)
    # A bend at the far end where it was torn out of a wall.
    pts = [(0, 0.6, 0)] + [(0.07 - 0.07 * math.cos(t), 0.6 + 0.07 * math.sin(t), 0) for t in [PI / 8 * i for i in range(1, 5)]]
    pts.append((0.1, 0.67, 0))
    m.tube(lead, pts, 0.019, 8)
    m.tube(DARK_STEEL, [(0.095, 0.67, 0), (0.13, 0.67, 0)], 0.025, 8)
    m.lathe(DARK_STEEL, [(0, -0.01), (0.025, -0.01), (0.025, 0.04), (0, 0.04)], 8)


@weapon('metal_bar', 0.9)
def rebar(m):
    rust = M('rust', '#6b4a3a', 0.2, 0.9)
    prof = [(0, 0)]
    y = 0.0
    while y < 0.84:
        prof += [(0.012, y), (0.012, y + 0.03), (0.0145, y + 0.04), (0.012, y + 0.05)]
        y += 0.06
    prof += [(0.012, 0.88), (0, 0.88)]
    m.lathe(rust, prof, 6)
    m.lathe(M('concrete', '#8a8a8a', 0, 0.95), [(0, 0.8), (0.03, 0.8), (0.036, 0.84), (0.028, 0.9), (0, 0.9)], 6, phase=0.3)


@weapon('crowbar', 0.75)
def crowbar(m):
    path = [(0.018, -0.035, 0), (0.008, -0.01, 0), (0, 0.02, 0), (0, 0.66, 0)]
    path += [(-0.055 + 0.055 * math.cos(t), 0.66 + 0.055 * math.sin(t), 0) for t in [PI / 6 * i for i in range(1, 7)]]
    path += [(-0.112, 0.63, 0)]
    m.tube(RED_PAINT, path, 0.012, 6)
    # Flattened, split claw on the hook and a chisel on the straight end.
    m.extrude(STEEL, [(-0.122, 0.635), (-0.102, 0.635), (-0.106, 0.6), (-0.112, 0.592), (-0.118, 0.6)], -0.009, 0.009)
    m.extrude(STEEL, [(0.012, -0.03), (0.028, -0.035), (0.03, -0.055), (0.02, -0.06)], -0.009, 0.009)


@weapon('hammer', 0.34)
def claw_hammer(m):
    m.lathe(WOOD_LIGHT, [(0, 0), (0.014, 0), (0.016, 0.1), (0.012, 0.2), (0.011, 0.31), (0, 0.31)], 8, sx=0.8)
    m.lathe(RUBBER, [(0, -0.02), (0.017, -0.02), (0.018, 0.0), (0.0175, 0.12), (0.015, 0.13), (0, 0.13)], 8, sx=0.85)
    head = M('hammer_head', '#4a4d52', 0.45, 0.45)
    m.box(head, 0.06, 0.036, 0.03, 0.005, 0.305)
    # Striking face towards +x.
    m.lathe(head, [(0, 0.035), (0.017, 0.035), (0.017, 0.08), (0.015, 0.088), (0, 0.088)], 8, m=chain(T(0, 0.305, 0), Rz(-PI / 2)))
    # Claw curving back and down towards -x.
    claw = [(-0.025, 0.322), (-0.06, 0.318), (-0.09, 0.3), (-0.105, 0.275), (-0.095, 0.278), (-0.072, 0.292), (-0.045, 0.298), (-0.025, 0.29)]
    m.extrude(head, claw, -0.013, 0.013)


@weapon('machete', 0.62)
def machete(m):
    m.extrude_y(WOOD_DARK, [(-0.014, -0.011), (0.016, -0.011), (0.02, 0.0), (0.016, 0.011), (-0.014, 0.011), (-0.018, 0.0)], -0.01, 0.14)
    m.box(DARK_STEEL, 0.05, 0.012, 0.026, 0.004, 0.14)
    for y in (0.03, 0.1):
        m.lathe(STEEL, [(0, -0.0125), (0.005, -0.0125), (0.005, 0.0125), (0, 0.0125)], 6, m=chain(T(0.002, y, 0), Rx(PI / 2)))
    blade = [(-0.012, 0.146), (0.026, 0.146), (0.034, 0.3), (0.044, 0.48), (0.046, 0.56), (0.036, 0.6), (0.016, 0.622),
             (-0.004, 0.61), (-0.012, 0.58)]
    m.extrude(STEEL, blade, -0.002, 0.002)
    # A darker spine strip so it reads at a distance.
    m.extrude(DARK_STEEL, [(-0.013, 0.146), (-0.006, 0.146), (-0.006, 0.575), (-0.013, 0.58)], -0.0025, 0.0025)


@weapon('knife', 0.3)
def kitchen_knife(m):
    m.extrude_y(BLACK, [(-0.011, -0.009), (0.013, -0.009), (0.016, 0.0), (0.013, 0.009), (-0.011, 0.009), (-0.013, 0.0)], -0.01, 0.105)
    for y in (0.015, 0.05, 0.085):
        m.lathe(STEEL, [(0, -0.0095), (0.0035, -0.0095), (0.0035, 0.0095), (0, 0.0095)], 6, m=chain(T(0.001, y, 0), Rx(PI / 2)))
    m.box(STEEL, 0.032, 0.012, 0.016, 0.003, 0.111)
    blade = [(-0.012, 0.117), (0.028, 0.117), (0.03, 0.15), (0.026, 0.21), (0.016, 0.26), (0.0, 0.3), (-0.01, 0.27), (-0.012, 0.2)]
    m.extrude(STEEL, blade, -0.0018, 0.0018)


@weapon('chain', 0.9)
def bike_chain(m):
    plate_a = M('chain_plate', '#5a5e64', 0.45, 0.5)
    plate_b = M('chain_inner', '#3a3a3e', 0.4, 0.55)
    m.lathe(M('tape', '#2a2a2e', 0, 0.9), [(0, -0.02), (0.02, -0.02), (0.022, 0.0), (0.022, 0.08), (0.019, 0.09), (0, 0.09)], 8)
    n = 34
    pts = []
    for i in range(n + 1):
        t = i / n
        pts.append((math.sin(t * PI) * 0.07, 0.07 + t * 0.83))
    for i in range(n):
        (x0, y0), (x1, y1) = pts[i], pts[i + 1]
        ang = math.atan2(x1 - x0, y1 - y0)
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        if i % 2 == 0:
            # Outer link: two plates either side of the roller.
            for dz in (-0.006, 0.006):
                m.box(plate_a, 0.02, 0.034, 0.004, m=chain(T(cx, cy, dz), Rz(-ang)))
        else:
            m.box(plate_b, 0.015, 0.03, 0.012, m=chain(T(cx, cy, 0), Rz(-ang)))


@weapon('wrench', 0.45)
def pipe_wrench(m):
    handle_red = M('wrench_red', '#a01818', 0.15, 0.55)
    m.extrude(handle_red, [(-0.011, -0.01), (0.011, -0.01), (0.016, 0.31), (-0.016, 0.31)], -0.009, 0.009)
    m.extrude(DARK_STEEL, [(-0.005, 0.0), (0.005, 0.0), (0.005, 0.015), (-0.005, 0.015)], -0.01, 0.01)  # hanging hole plug
    jaw = M('jaw_steel', '#7a7e84', 0.45, 0.45)
    # Frame with the fixed lower jaw.
    m.extrude(jaw, [(-0.02, 0.3), (0.03, 0.3), (0.034, 0.37), (-0.045, 0.37), (-0.045, 0.385), (-0.03, 0.39), (-0.02, 0.36)], -0.013, 0.013)
    # Sliding hook jaw: shank plus the top jaw.
    m.extrude(jaw, [(0.024, 0.33), (0.04, 0.33), (0.04, 0.45), (-0.045, 0.45), (-0.045, 0.43), (-0.03, 0.425), (0.024, 0.425)], -0.011, 0.011)
    # Knurled adjusting nut.
    m.lathe(DARK_STEEL, [(0, 0.375), (0.017, 0.375), (0.019, 0.385), (0.019, 0.405), (0.017, 0.415), (0, 0.415)], 8, m=T(0.032, 0, 0))


@weapon('club', 0.7)
def wooden_club(m):
    wood = M('hardwood', '#6a4a2a', 0, 0.8)
    m.lathe(wood, [(0, -0.02), (0.022, -0.02), (0.024, -0.005), (0.018, 0.01), (0.019, 0.2), (0.03, 0.4), (0.044, 0.56),
                   (0.048, 0.64), (0.04, 0.69), (0, 0.7)], 7, phase=0.2)
    m.lathe(M('leather', '#4a2e1a', 0, 0.85), [(0, 0.0), (0.021, 0.0), (0.021, 0.15), (0, 0.15)], 7, phase=0.2)
    for y in (0.5, 0.58):
        m.lathe(M('band', '#3a3a3e', 0.3, 0.6), [(0, y), (0.047, y), (0.047, y + 0.015), (0, y + 0.015)], 7, phase=0.2)


@weapon('pool_cue', 1.45)
def pool_cue(m):
    m.lathe(BLACK, [(0, 0), (0.0155, 0), (0.0155, 0.012), (0, 0.012)], 8)
    m.lathe(WOOD_DARK, [(0, 0.012), (0.0155, 0.012), (0.0148, 0.5), (0, 0.5)], 8)
    m.lathe(M('cue_wrap', '#2a2a2e', 0, 0.9), [(0, 0.06), (0.016, 0.06), (0.0158, 0.32), (0, 0.32)], 8)
    m.lathe(M('cue_ring', '#d8b04a', 0.4, 0.4), [(0, 0.5), (0.0149, 0.5), (0.0149, 0.512), (0, 0.512)], 8)
    m.lathe(M('maple', '#d8b070', 0, 0.7), [(0, 0.512), (0.0145, 0.512), (0.0068, 1.425), (0, 1.425)], 8)
    m.lathe(WHITE, [(0, 1.425), (0.0068, 1.425), (0.0066, 1.443), (0, 1.443)], 8)
    m.lathe(M('chalk_blue', '#3a6ab0', 0, 0.9), [(0, 1.443), (0.0064, 1.443), (0.006, 1.45), (0, 1.45)], 8)


@weapon('pole', 1.7)
def scaffold_pole(m):
    m.lathe(GALV, [(0, -0.05), (0.024, -0.05), (0.024, 1.7), (0, 1.7)], 8)
    m.lathe(Mat('pole_end', '#2a2a2e', 0, 0.9), [(0, 1.69), (0.016, 1.69), (0.016, 1.701), (0, 1.701)], 8)
    # A swivel coupler still bolted on near the end.
    cl = M('coupler', '#5a5a5e', 0.4, 0.5)
    m.lathe(cl, [(0, 1.5), (0.033, 1.5), (0.033, 1.58), (0, 1.58)], 8)
    m.box(cl, 0.03, 0.05, 0.03, 0.045, 1.54)
    m.box(cl, 0.03, 0.05, 0.03, -0.045, 1.54)
    m.lathe(cl, [(0, 0.06), (0.033, 0.06), (0.033, 0.13), (0, 0.13)], 8, m=chain(T(0.07, 1.54, 0), Rx(PI / 2), T(0, -0.095, 0)))


@weapon('torch', 0.38)
def heavy_torch(m):
    body = M('torch_body', '#202226', 0.4, 0.45)
    prof = [(0, -0.01), (0.019, -0.01), (0.02, 0.0), (0.02, 0.02)]
    y = 0.03
    while y < 0.2:
        prof += [(0.0185, y), (0.0185, y + 0.025), (0.02, y + 0.03)]
        y += 0.035
    prof += [(0.019, 0.27), (0.03, 0.31), (0.033, 0.315), (0.033, 0.37), (0.03, 0.375), (0, 0.375)]
    m.lathe(body, prof, 8)
    m.lathe(M('lens', '#fff4c0', 0, 0.2, emissive='#fff4c0'), [(0, 0.374), (0.026, 0.374), (0.026, 0.38), (0, 0.38)], 8)
    m.box(RUBBER, 0.012, 0.022, 0.012, 0.0, 0.25, 0.019)


# ---------------------------------------------------------------- improvised

@weapon('mop', 1.3)
def mop(m):
    m.lathe(M('mop_handle', '#cfd2d8', 0.3, 0.5), [(0, 0), (0.0125, 0), (0.0125, 1.1), (0, 1.1)], 6)
    m.lathe(M('mop_cap', '#4a7ab0', 0, 0.6), [(0, -0.02), (0.015, -0.02), (0.015, 0.0), (0, 0.0)], 6)
    m.lathe(M('mop_clamp', '#4a7ab0', 0, 0.6), [(0, 1.08), (0.018, 1.08), (0.032, 1.12), (0.032, 1.15), (0, 1.15)], 8)
    strand = M('mop_strands', '#d8d4c0', 0, 1)
    # A shaggy head of cotton strands flopping out past the clamp.
    m.lathe(strand, [(0, 1.12), (0.03, 1.12), (0.07, 1.18), (0.085, 1.24), (0.07, 1.29), (0.03, 1.31), (0, 1.31)], 14,
            radial=lambda j: 1.0 if j % 2 == 0 else 0.7)
    for i in range(6):
        a = 2 * PI * i / 6
        m.lathe(strand, [(0, 0), (0.012, 0), (0.008, 0.12), (0, 0.13)], 4,
                m=chain(T(0.05 * math.sin(a), 1.2, 0.05 * math.cos(a)), Ry(a), Rx(0.45 + 0.15 * (i % 2))))


@weapon('broom', 1.3)
def broom(m):
    m.lathe(WOOD_LIGHT, [(0, 0), (0.0135, 0), (0.0135, 1.2), (0, 1.2)], 6)
    m.lathe(M('broom_cap', '#2a5a2a', 0, 0.6), [(0, -0.015), (0.0145, -0.015), (0.0145, 0.005), (0, 0.005)], 6)
    head = M('broom_head', '#2a5a2a', 0, 0.6)
    m.lathe(head, [(0, 1.15), (0.02, 1.15), (0.02, 1.21), (0, 1.21)], 6)
    m.box(head, 0.3, 0.045, 0.055, 0, 1.225)
    bristle = M('bristles', '#2a2a2e', 0, 1)
    m.frustum(bristle, 0.29, 0.042, 0.31, 0.05, 0, 0.08, m=chain(T(0, 1.247, 0), Rx(-PI / 2)))


@weapon('road_sign', 1.5)
def road_sign(m):
    m.lathe(GALV, [(0, -0.03), (0.022, -0.03), (0.022, 1.2), (0, 1.2)], 8)
    m.lathe(RUBBER, [(0, 1.2), (0.024, 1.2), (0.024, 1.21), (0, 1.21)], 8)
    # No entry: red disc, white bar, grey back.
    cy = 1.22
    m.lathe(RED, [(0, 0.03), (0.27, 0.03), (0.27, 0.036), (0, 0.036)], 20, m=chain(T(0, cy, 0), Rx(PI / 2)))
    m.lathe(GALV, [(0, 0.024), (0.27, 0.024), (0.27, 0.03), (0, 0.03)], 20, m=chain(T(0, cy, 0), Rx(PI / 2)))
    m.box(WHITE, 0.36, 0.08, 0.004, 0, cy, 0.038)
    for y in (cy - 0.17, cy + 0.12):
        m.box(DARK_STEEL, 0.06, 0.03, 0.03, 0, y, 0.0)


@weapon('cone', 0.7)
def traffic_cone(m):
    orange = M('cone_orange', '#e8642a', 0, 0.65)
    # Held by the tip; the square foot is the far end.
    m.lathe(orange, [(0, 0), (0.022, 0), (0.035, 0.1), (0.06, 0.22)], 12)
    m.lathe(WHITE, [(0, 0.22), (0.06, 0.22), (0.075, 0.28), (0, 0.28)], 12)
    m.lathe(orange, [(0, 0.28), (0.075, 0.28), (0.09, 0.34), (0, 0.34)], 12)
    m.lathe(WHITE, [(0, 0.34), (0.09, 0.34), (0.1, 0.38), (0, 0.38)], 12)
    m.lathe(orange, [(0, 0.38), (0.1, 0.38), (0.13, 0.64), (0, 0.64)], 12)
    m.lathe(orange, [(0, 0), (0.022, 0), (0, 0)], 12)
    m.box(M('cone_foot', '#2a2a2e', 0, 0.85), 0.34, 0.035, 0.34, 0, 0.66)


@weapon('plank', 1.1)
def plank(m):
    wood = M('plank_wood', '#b08a5a', 0, 0.85)
    outline = [(-0.06, 0.0), (0.06, 0.02), (0.06, 1.04), (0.035, 1.1), (0.02, 1.06), (0.0, 1.09), (-0.02, 1.05), (-0.04, 1.08), (-0.06, 1.03)]
    m.extrude(wood, outline, -0.0125, 0.0125)
    m.box(M('plank_stripe', '#8a5a32', 0, 0.85), 0.006, 0.9, 0.002, -0.025, 0.52, 0.0128)
    for y in (0.75, 0.95):
        m.lathe(STEEL, [(0, 0), (0.003, 0), (0.002, 0.06), (0, 0.065)], 4, m=chain(T(0.025, y, 0.012), Rx(PI / 2)))


@weapon('chair_leg', 0.45)
def chair_leg(m):
    wood = M('chair_leg_wood', '#7a5a3a', 0, 0.8)
    m.lathe(wood, [(0, 0), (0.016, 0), (0.018, 0.02), (0.015, 0.06), (0.019, 0.1), (0.022, 0.12), (0.019, 0.14),
                   (0.021, 0.3), (0.024, 0.32), (0.022, 0.34), (0.022, 0.4), (0, 0.4)], 8)
    # Splintered break.
    seg = 8
    hs = [0.45, 0.41, 0.43, 0.405, 0.44, 0.415, 0.42, 0.41]
    for j in range(seg):
        a0, a1 = 2 * PI * j / seg, 2 * PI * (j + 1) / seg
        r = 0.022
        p0 = (r * math.sin(a0), 0.4, r * math.cos(a0))
        p1 = (r * math.sin(a1), 0.4, r * math.cos(a1))
        top = (0, 0.4 + (hs[j] - 0.4) * 0.6, 0)
        m.poly(wood, [p0, p1, (r * 0.6 * math.sin(a1), hs[(j + 1) % seg], r * 0.6 * math.cos(a1)), top])
    m.lathe(STEEL, [(0, 0), (0.003, 0), (0.003, 0.04), (0, 0.045)], 4, m=chain(T(0.018, 0.37, 0), Rz(-PI / 2)))


@weapon('table_leg', 0.7)
def table_leg(m):
    wood = M('table_leg_wood', '#6a4a2a', 0, 0.8)
    m.lathe(wood, [(0, 0), (0.02, 0), (0.024, 0.03), (0.02, 0.06), (0.024, 0.1), (0.03, 0.2), (0.035, 0.3),
                   (0.028, 0.4), (0.036, 0.46), (0.03, 0.5), (0.025, 0.55), (0.03, 0.58), (0, 0.58)], 8, phase=PI / 8)
    m.box(wood, 0.06, 0.12, 0.06, 0, 0.64)
    m.box(DARK_STEEL, 0.02, 0.02, 0.064, 0, 0.67)


@weapon('chair', 0.9)
def pub_chair(m):
    wood = M('chair_wood', '#5a3a20', 0, 0.75)
    seat = M('chair_seat', '#7a2a2a', 0, 0.9)
    # Held by the top rail of the back; the back runs down to the seat and the legs beyond.
    m.box(wood, 0.4, 0.07, 0.03, 0, 0.02, 0.0)
    for x in (-0.17, 0.17):
        m.box(wood, 0.03, 0.4, 0.03, x, 0.24, 0.0)
    m.box(wood, 0.32, 0.03, 0.02, 0, 0.2, 0)
    m.box(wood, 0.32, 0.03, 0.02, 0, 0.3, 0)
    # Seat: a slab reaching out in +z, with a padded top.
    m.box(wood, 0.42, 0.035, 0.42, 0, 0.44, 0.19)
    m.box(seat, 0.38, 0.03, 0.38, 0, 0.41, 0.19)
    # Legs carry on past the seat (the chair is upside down in the hand).
    for x in (-0.18, 0.18):
        for z in (0.0, 0.38):
            m.lathe(wood, [(0, 0.45), (0.018, 0.45), (0.014, 0.88), (0, 0.88)], 4, phase=PI / 4, m=T(x, 0, z))
    for x in (-0.18, 0.18):
        m.box(wood, 0.018, 0.018, 0.38, x, 0.72, 0.19)
    m.box(wood, 0.36, 0.018, 0.018, 0, 0.66, 0.38)


@weapon('tv', 0.55)
def old_telly(m):
    case = M('tv_case', '#2a2a2a', 0, 0.55)
    # Held by the bottom edge: the set sits above the fist, screen facing +z.
    m.box(case, 0.52, 0.42, 0.06, 0, 0.23, 0.17)
    m.frustum(case, 0.5, 0.4, 0.3, 0.26, 0.14, -0.2, m=T(0, 0.23, 0))
    m.box(M('tv_screen', '#203028', 0.3, 0.15), 0.4, 0.31, 0.01, -0.035, 0.24, 0.2)
    m.box(M('tv_panel', '#3a3a3e', 0, 0.6), 0.06, 0.32, 0.006, 0.215, 0.24, 0.2)
    for y in (0.34, 0.28):
        m.lathe(M('tv_knob', '#8a8a8a', 0.3, 0.5), [(0, 0), (0.014, 0), (0.014, 0.018), (0, 0.018)], 8, m=chain(T(0.215, y, 0.2), Rx(PI / 2)))
    m.box(M('tv_led', '#e8333a', 0, 0.5), 0.012, 0.012, 0.004, 0.215, 0.12, 0.203)
    m.box(DARK_STEEL, 0.12, 0.02, 0.02, 0, 0.015, 0.0)


@weapon('monitor', 0.6)
def monitor(m):
    case = M('monitor_case', '#18191c', 0, 0.5)
    # Held by the stand's foot.
    m.box(case, 0.22, 0.016, 0.16, 0, 0.008, 0)
    m.box(case, 0.05, 0.3, 0.025, 0, 0.16, -0.02)
    m.box(case, 0.54, 0.33, 0.035, 0, 0.42, 0.0)
    m.frustum(case, 0.44, 0.24, 0.2, 0.14, -0.0175, -0.06, m=T(0, 0.41, 0))
    m.lathe(case, [(0, -0.04), (0.02, -0.04), (0.02, 0.04), (0, 0.04)], 8, m=chain(T(0, 0.31, -0.035), Rz(PI / 2)))
    for x in (-0.15, 0.0, 0.15):
        m.box(Mat('vent', '#2a2a2e', 0, 0.6), 0.08, 0.008, 0.004, x, 0.48, -0.019)
    m.box(M('monitor_screen', '#0a0e18', 0.3, 0.1, emissive='#0e1626'), 0.51, 0.3, 0.004, 0, 0.425, 0.018)
    m.box(M('monitor_led', '#1f3f8a', 0, 0.5, emissive='#1f3f8a'), 0.01, 0.006, 0.004, 0.25, 0.262, 0.018)


@weapon('skateboard', 0.8)
def skateboard(m):
    deck = M('deck', '#d83a2a', 0, 0.6)
    grip = M('griptape', '#1c1c20', 0, 1)
    shape = arc(0, 0.1, 0.1, PI, 2 * PI, 6) + arc(0, 0.7, 0.1, 0, PI, 6)
    m.extrude(deck, shape, -0.006, 0.006)
    m.extrude(grip, [(x * 0.96, 0.4 + (y - 0.4) * 0.97) for x, y in shape], 0.006, 0.008)
    m.box(WHITE, 0.08, 0.2, 0.001, 0, 0.4, -0.0065)
    for y in (0.17, 0.63):
        m.box(STEEL, 0.05, 0.03, 0.02, 0, y, -0.016)
        m.box(STEEL, 0.16, 0.014, 0.014, 0, y, -0.032)
        for x in (-0.085, 0.085):
            m.lathe(CREAM, [(0, -0.016), (0.026, -0.016), (0.027, 0.0), (0.026, 0.016), (0, 0.016)], 8,
                    m=chain(T(x, y, -0.032), Rz(PI / 2)))


@weapon('umbrella', 1.0)
def golf_umbrella(m):
    handle = M('umbrella_handle', '#4a2e1a', 0, 0.6)
    # J handle: the grip is the straight part, the crook hangs below the fist.
    m.tube(handle, [(0, 0.1, 0), (0, -0.04, 0)] + [(0.035 - 0.035 * math.cos(t), -0.04 - 0.035 * math.sin(t), 0) for t in [PI / 5 * i for i in range(1, 6)]] + [(0.07, -0.02, 0)], 0.014, 6)
    m.lathe(BLACK, [(0, 0.09), (0.007, 0.09), (0.007, 1.0), (0, 1.0)], 6)
    m.lathe(NAVY, [(0, 0.24), (0.014, 0.24), (0.05, 0.36), (0.058, 0.5), (0.04, 0.82), (0.016, 0.93), (0, 0.94)], 16,
            radial=lambda j: 1.0 if j % 2 == 0 else 0.72, mats=lambda j: NAVY if (j // 2) % 2 == 0 else WHITE)
    m.lathe(NAVY, [(0, 0.3), (0.06, 0.3), (0.06, 0.32), (0, 0.32)], 8)


@weapon('shelf_bar', 1.0)
def shelving_upright(m):
    bar = M('upright', '#9aa0a8', 0.4, 0.5)
    m.extrude_y(bar, [(-0.02, -0.02), (0.02, -0.02), (0.02, 0.02), (0.012, 0.02), (0.012, -0.012), (-0.012, -0.012), (-0.012, 0.02), (-0.02, 0.02)], 0, 1.0)
    slot = M('slots', '#22252a', 0, 0.6)
    y = 0.06
    while y < 0.97:
        m.box(slot, 0.008, 0.022, 0.002, -0.006, y, -0.0205)
        m.box(slot, 0.008, 0.022, 0.002, 0.006, y, -0.0205)
        y += 0.06
    m.box(DARK_STEEL, 0.05, 0.01, 0.05, 0, 0.005, 0)


@weapon('shovel', 1.15)
def shovel(m):
    d_handle(m, BLACK)
    m.lathe(WOOD_LIGHT, [(0, 0.15), (0.016, 0.15), (0.016, 0.85), (0, 0.85)], 8)
    socket = M('shovel_socket', '#5a6a5a', 0.35, 0.5)
    m.lathe(socket, [(0, 0.83), (0.02, 0.83), (0.024, 0.92), (0, 0.92)], 8)
    blade = [(-0.11, 0.9), (0.11, 0.9), (0.115, 1.08), (0.06, 1.13), (0.0, 1.15), (-0.06, 1.13), (-0.115, 1.08)]
    m.extrude(socket, blade, -0.003, 0.003)
    m.extrude(DARK_STEEL, [(-0.11, 0.9), (0.11, 0.9), (0.11, 0.915), (-0.11, 0.915)], -0.009, 0.004)


@weapon('garden_fork', 1.15)
def garden_fork(m):
    d_handle(m, BLACK)
    m.lathe(WOOD_LIGHT, [(0, 0.15), (0.016, 0.15), (0.016, 0.85), (0, 0.85)], 8)
    socket = M('fork_socket', '#3a5a2a', 0.3, 0.55)
    m.lathe(socket, [(0, 0.83), (0.02, 0.83), (0.024, 0.9), (0, 0.9)], 8)
    m.box(socket, 0.19, 0.025, 0.018, 0, 0.91)
    for i in range(4):
        x = -0.075 + i * 0.05
        m.lathe(STEEL, [(0, 0.915), (0.008, 0.915), (0.006, 1.1), (0, 1.15)], 4, phase=PI / 4, m=T(x, 0, 0))


@weapon('rake', 1.4)
def garden_rake(m):
    m.lathe(WOOD_LIGHT, [(0, 0), (0.014, 0), (0.014, 1.36), (0, 1.36)], 6)
    m.lathe(M('rake_cap', '#8a6a3a', 0, 0.7), [(0, -0.015), (0.015, -0.015), (0.015, 0.005), (0, 0.005)], 6)
    head = M('rake_head', '#5a5a5e', 0.4, 0.5)
    m.lathe(head, [(0, 1.33), (0.018, 1.33), (0.018, 1.38), (0, 1.38)], 6)
    m.box(head, 0.38, 0.022, 0.02, 0, 1.39)
    for i in range(12):
        x = -0.176 + i * 0.032
        m.lathe(head, [(0, 0), (0.0045, 0), (0.0035, 0.06), (0, 0.065)], 4, m=chain(T(x, 1.39, 0.008), Rx(PI / 2)))


@weapon('brick', 0.2)
def half_brick(m):
    brick = M('brick', '#8a4a36', 0, 0.95)
    # Half a brick (102 x 65 mm face), broken off unevenly at the far end.
    outline = [(-0.051, 0.0), (0.051, 0.0), (0.051, 0.1), (0.03, 0.118), (0.012, 0.104), (-0.01, 0.124), (-0.03, 0.108), (-0.051, 0.115)]
    m.extrude(brick, outline, -0.0325, 0.0325, m=T(0, -0.04, 0))
    mortar = M('mortar', '#dcd4c0', 0, 1)
    m.box(mortar, 0.08, 0.008, 0.05, -0.008, -0.044, 0.004)
    m.extrude(mortar, [(-0.051, -0.03), (-0.04, -0.04), (-0.025, -0.036), (-0.02, -0.01), (-0.035, 0.005), (-0.051, 0.0)], 0.0325, 0.036)



@weapon('frying_pan', 0.5)
def frying_pan(m):
    m.extrude(IRON, [(-0.011, -0.01), (0.011, -0.01), (0.014, 0.2), (0.01, 0.23), (-0.01, 0.23), (-0.014, 0.2)], -0.006, 0.006)
    m.lathe(IRON, [(0, -0.008), (0.003, -0.008), (0.003, 0.008), (0, 0.008)], 6, m=chain(T(0, 0.04, 0), Rx(PI / 2)))
    pan = chain(T(0, 0.36, -0.02), Rx(PI / 2))
    m.lathe(IRON, [(0, 0), (0.11, 0), (0.13, 0.045), (0.122, 0.045)], 16, m=pan)
    m.lathe(IRON_IN, [(0.122, 0.045), (0.106, 0.008), (0, 0.008)], 16, m=pan)


@weapon('golf_club', 0.95)
def golf_club(m):
    m.lathe(RUBBER, [(0, -0.01), (0.0145, -0.01), (0.0145, 0.0), (0.012, 0.27), (0, 0.27)], 8)
    m.lathe(STEEL, [(0, 0.26), (0.0058, 0.26), (0.0045, 0.88), (0, 0.88)], 6)
    m.lathe(DARK_STEEL, [(0, 0.87), (0.007, 0.87), (0.008, 0.92), (0, 0.92)], 6)
    head = [(-0.01, 0.9), (0.008, 0.9), (0.09, 0.912), (0.1, 0.935), (0.09, 0.962), (-0.004, 0.952), (-0.014, 0.93)]
    m.extrude(STEEL, head, -0.013, 0.013)
    for k in range(3):
        m.box(DARK_STEEL, 0.07, 0.003, 0.001, 0.045, 0.918 + k * 0.012, 0.0135)


@weapon('dustbin_lid', 0.55)
def bin_lid(m):
    # Held by the handle like a shield: the lid lies in the XY plane around the fist, dome facing +z.
    lid = M('bin_lid', '#8a8d93', 0.4, 0.5)
    prof = [(0, 0.075)] + [(0.27 * math.sin(t), 0.075 * math.cos(t) * 0.9 + 0.0) for t in [PI / 2 * i / 4 for i in range(1, 5)]]
    prof += [(0.275, -0.012), (0.255, -0.012), (0.255, 0.0), (0, 0.0)]
    m.lathe(lid, prof, 16, m=chain(T(0, 0.12, 0.02), Rx(PI / 2)))
    m.lathe(Mat('lid_ring', '#5a5a5e', 0.4, 0.5), [(0, 0.04), (0.2, 0.04), (0.2, 0.05), (0, 0.05)], 16, m=chain(T(0, 0.12, 0.02), Rx(PI / 2)))
    # Handle on the inside (-z).
    m.box(DARK_STEEL, 0.03, 0.12, 0.012, 0, 0.0, -0.022)
    for y in (-0.055, 0.055):
        m.box(DARK_STEEL, 0.03, 0.012, 0.03, 0, y, -0.005)


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), '..', '..', 'public', 'models', 'weapons')
    os.makedirs(out, exist_ok=True)
    for wid, (fn, length) in MODELS.items():
        m = Model(wid)
        fn(m)
        data = m.glb({'length': length, 'grip': 'origin', 'axis': '+y'})
        path = os.path.join(out, wid.replace('_', '-') + '.glb')
        with open(path, 'wb') as f:
            f.write(data)
        print(f'{wid:14s} tris={m.tri_count():5d} kb={len(data) / 1024:.1f}')


if __name__ == '__main__':
    main()
