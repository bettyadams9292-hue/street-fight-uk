#!/usr/bin/env python3
"""
Makes every tileable texture, atlas and particle sprite in public/textures/.

All of it is original work for Street Fight UK, painted procedurally here with
numpy and PIL: no downloaded images. The look is stylised and low-poly friendly:
flat, slightly desaturated colours from the style guide's palette, crisp
patterns (joints, boards, courses), and only gentle variation. Every surface
texture is seamless (all noise is periodic, all patterns divide the tile) and
gets a subtle normal map made from its height field.

Formats (the game reads these in src/render/textureFiles.ts):
  <name>.webp     colour map (sRGB)
  <name>_n.webp   normal map (linear, OpenGL convention: green = +V)
  Two-tone files (marked TWO_TONE below) are not colours: red is light and
  shade (204 = 1.0), green is a mask for the second colour (grout, line), so
  code can paint them in any pair of colours.

Run: python3 tools/textures/gen_textures.py [out_dir]   (default public/textures)
"""
import math
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'public', 'textures')
FONT_DIR = os.path.join(ROOT, 'public', 'fonts')

# ---------------------------------------------------------------------------- helpers


def rng(seed):
    return np.random.default_rng(seed)


def noise(size, scale, seed, w=None):
    """Periodic smooth noise in 0..1: white noise low-pass filtered in the frequency domain."""
    h = size
    w = w or size
    r = rng(seed).standard_normal((h, w))
    fy = np.fft.fftfreq(h)[:, None]
    fx = np.fft.fftfreq(w)[None, :]
    f = np.sqrt(fx * fx + fy * fy)
    k = np.exp(-(f * scale) ** 2 * 8.0)
    out = np.real(np.fft.ifft2(np.fft.fft2(r) * k))
    out -= out.min()
    out /= max(1e-9, out.max())
    return out


def fbm(size, seed, scales=(64, 24, 8), weights=(0.6, 0.3, 0.1), w=None):
    acc = sum(wt * noise(size, s, seed + i * 17, w) for i, (s, wt) in enumerate(zip(scales, weights)))
    acc -= acc.min()
    return acc / max(1e-9, acc.max())


def hexc(c):
    c = c.lstrip('#')
    return np.array([int(c[i:i + 2], 16) for i in (0, 2, 4)], dtype=np.float64) / 255.0


def normal_map(height, strength):
    """Normals from a periodic height field (0..1). OpenGL convention."""
    dx = (np.roll(height, -1, axis=1) - np.roll(height, 1, axis=1)) * 0.5
    dy = (np.roll(height, -1, axis=0) - np.roll(height, 1, axis=0)) * 0.5
    n = np.dstack([-dx * strength, dy * strength, np.ones_like(height)])
    n /= np.linalg.norm(n, axis=2, keepdims=True)
    return n * 0.5 + 0.5


def save(rel, rgb, height=None, strength=4.0, alpha=None, q=82):
    path = os.path.join(OUT, rel + '.webp')
    os.makedirs(os.path.dirname(path), exist_ok=True)
    arr = np.clip(rgb, 0, 1)
    if alpha is not None:
        arr = np.dstack([arr, np.clip(alpha, 0, 1)])
        img = Image.fromarray((arr * 255 + 0.5).astype(np.uint8), 'RGBA')
        img.save(path, 'WEBP', quality=q, method=6, exact=False)
    else:
        Image.fromarray((arr * 255 + 0.5).astype(np.uint8), 'RGB').save(path, 'WEBP', quality=q, method=6)
    if height is not None:
        n = normal_map(height, strength)
        Image.fromarray((n * 255 + 0.5).astype(np.uint8), 'RGB').save(os.path.join(OUT, rel + '_n.webp'), 'WEBP', quality=88, method=6)


def two_tone(shade, mask):
    """Red: light and shade (204 = 1.0); green: second-colour mask; blue: shade again."""
    r = np.clip(shade * 0.8, 0, 1)
    return np.dstack([r, np.clip(mask, 0, 1), r])


def colour(base, shade):
    return base[None, None, :] * shade[:, :, None]


def mix(a, b, t):
    t = t[:, :, None] if t.ndim == 2 else t
    return a * (1 - t) + b * t


def grid_coords(size, w=None):
    w = w or size
    y, x = np.mgrid[0:size, 0:w]
    return x.astype(np.float64), y.astype(np.float64)


def joint(dist, width):
    """1 in the joint, 0 on the face, a soft edge between."""
    return np.clip(1.0 - (dist - width * 0.5) / max(0.5, width * 0.5), 0, 1)


def bevel(dist, width):
    """Height of a stone/board with a small rounded edge (0 in the joint, 1 on the face)."""
    return np.clip(dist / max(1.0, width), 0, 1) ** 0.6


def font(size, kind='bold'):
    for p in [
        os.path.join(FONT_DIR, 'BigShoulders.woff'),
        '/usr/share/fonts/truetype/google-fonts/Poppins-Bold.ttf',
        '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
    ]:
        if kind == 'body' and 'BigShoulders' in p:
            continue
        try:
            f = ImageFont.truetype(p, size)
            if 'BigShoulders' in p:
                try:
                    f.set_variation_by_axes([900])
                except Exception:
                    pass
            return f
        except Exception:
            continue
    return ImageFont.load_default()


def cells(size, nx, ny, stagger=0.0, w=None, jitter_seed=None):
    """Running-bond cell layout: per pixel, distance to the nearest joint and a per-cell id."""
    w = w or size
    x, y = grid_coords(size, w)
    ch = size / ny
    cw = w / nx
    row = np.floor(y / ch)
    xo = x + (row % 2) * stagger * cw
    col = np.floor(xo / cw) % nx
    fx = (xo % cw)
    fy = (y % ch)
    d = np.minimum(np.minimum(fx, cw - fx), np.minimum(fy, ch - fy))
    cid = (row * 131 + col * 17) % 997
    return d, cid, fx / cw, fy / ch, row, col


def per_cell(cid, seed, lo, hi):
    r = rng(seed).uniform(lo, hi, 1000)
    return r[cid.astype(int)]


# ---------------------------------------------------------------------------- street


def brick(size=512):
    # 8 bricks across, 20 courses: 64 x 25.6 px, stretcher bond (as the old canvas, close enough in scale).
    d, cid, u, v, row, col = cells(size, 8, 20, 0.5)
    j = joint(d, 3.2)
    face = per_cell(cid, 11, 0.82, 1.1)
    hue = per_cell(cid, 12, 0, 1)
    base = mix(np.broadcast_to(hexc('#8a4a36'), (size, size, 3)), np.broadcast_to(hexc('#7a4232'), (size, size, 3)), (hue > 0.6).astype(float) * 0.8)
    base = mix(base, np.broadcast_to(hexc('#9a5a40'), (size, size, 3)), (hue < 0.18).astype(float) * 0.8)
    grain = fbm(size, 13, (10, 4), (0.7, 0.3))
    shade = face * (0.92 + 0.12 * grain)
    soot = noise(size, 90, 14)
    shade *= 1.0 - 0.18 * np.clip(soot - 0.4, 0, 1) * 2
    rgb = base * shade[:, :, None]
    mortar = hexc('#5a544c') * (0.9 + 0.15 * grain)[:, :, None]
    rgb = mix(rgb, mortar, j)
    h = bevel(d, 3.5) * 0.85 + grain * 0.15
    save('street/brick', rgb, h, 3.0)


def paving(size=512):
    # 4 x 4 slabs (600 mm grid), thin dark joints, a few gum spots.
    d, cid, u, v, *_ = cells(size, 4, 4)
    j = joint(d, 4)
    face = per_cell(cid, 21, 0.9, 1.06)
    grain = fbm(size, 22, (14, 5), (0.6, 0.4))
    shade = face * (0.93 + 0.1 * grain)
    rgb = colour(hexc('#8a8a8a'), shade)
    x, y = grid_coords(size)
    r = rng(23)
    for _ in range(14):
        cx, cy, rad = r.uniform(0, size), r.uniform(0, size), r.uniform(2.5, 5)
        dd = np.hypot((x - cx + size / 2) % size - size / 2, (y - cy + size / 2) % size - size / 2)
        rgb = mix(rgb, hexc('#5a5a5e'), np.clip(rad - dd, 0, 1) * 0.7)
    rgb = mix(rgb, hexc('#3a3a3e'), j)
    h = bevel(d, 5) * 0.8 + grain * 0.2
    save('street/paving', rgb, h, 3.0)


def road(size=512):
    # Tarmac, 512 x 256, with double yellow lines along one edge (as the old canvas).
    w, hgt = size, size // 2
    agg = noise(hgt, 1.2, 31, w)
    agg2 = fbm(hgt, 32, (40, 12), (0.6, 0.4), w)
    shade = 0.9 + 0.12 * (agg - 0.5) + 0.12 * (agg2 - 0.5)
    rgb = colour(hexc('#2a2a2e'), shade / 0.95)
    y = np.arange(hgt)[:, None] * np.ones((1, w))
    wear = noise(hgt, 6, 33, w)
    line = (((y >= 14) & (y < 21)) | ((y >= 28) & (y < 35))).astype(float) * np.clip(0.75 + wear * 0.5, 0, 1)
    rgb = mix(rgb, hexc('#c9a227') * (0.92 + 0.1 * agg)[:, :, None], line)
    h = agg * 0.6 + agg2 * 0.4 + line * 0.3
    save('street/road', rgb, h, 2.0)


def markings(size=512):
    # TWO_TONE: base colour and painted line (512 x 128): a line along the bottom, bay lines every 128 px.
    w, hgt = size, size // 4
    x, y = grid_coords(hgt, w)
    stain = fbm(hgt, 41, (30, 10), (0.6, 0.4), w)
    shade = 0.92 + 0.12 * (stain - 0.5) * 2
    m = ((y >= 100) & (y < 106)) | ((x % 128 < 6) & (y >= 20) & (y < 100))
    wear = noise(hgt, 5, 42, w)
    mask = m.astype(float) * np.clip(0.7 + wear * 0.6, 0, 1)
    save('street/markings', two_tone(shade, mask), stain * 0.5 + mask * 0.4, 2.0)


def concrete(size=512):
    # TWO_TONE (single colour): concrete panel, board marks, stains, a seam around the edge.
    x, y = grid_coords(size)
    st = fbm(size, 51, (70, 20, 6), (0.5, 0.3, 0.2))
    shade = 0.9 + 0.16 * (st - 0.5)
    shade *= 1 - 0.05 * ((np.floor(y / 64) % 2))
    d = np.minimum(np.minimum(x, size - 1 - x), np.minimum(y, size - 1 - y))
    seam = joint(d, 3)
    shade = shade * (1 - 0.35 * seam)
    pits = (noise(size, 1.0, 52) > 0.82).astype(float)
    shade *= 1 - 0.06 * pits
    save('street/concrete', two_tone(shade, np.zeros_like(shade)), bevel(d, 3) * 0.6 + st * 0.4 - pits * 0.1, 2.5)


def plaster(size=512):
    # TWO_TONE (single colour): painted plaster, soft mottling and trowel marks.
    m = fbm(size, 61, (80, 26, 6), (0.5, 0.35, 0.15))
    shade = 0.95 + 0.07 * (m - 0.5)
    save('street/plaster', two_tone(shade, np.zeros_like(shade)), m, 1.6)


def corrugated(size=512):
    # TWO_TONE (single colour): 16 ribs per tile, rust streaks running down.
    x, y = grid_coords(size)
    ph = (x / (size / 16)) * 2 * math.pi
    rib = np.sin(ph)
    shade = 0.92 + 0.14 * np.cos(ph + 0.8)
    r = rng(71)
    rust = np.zeros_like(shade)
    for _ in range(12):
        cx = r.uniform(0, size)
        top = r.uniform(0, size)
        ln = r.uniform(80, 260)
        wid = r.uniform(2, 6)
        dx = np.abs(((x - cx + size / 2) % size) - size / 2)
        dy = ((y - top) % size)
        rust = np.maximum(rust, np.clip(1 - dx / wid, 0, 1) * np.clip(1 - dy / ln, 0, 1) * (dy < ln))
    shade *= 1 - 0.25 * rust
    # The mask channel carries rust, so code can tint it rusty.
    save('street/corrugated', two_tone(shade, rust * 0.8), rib * 0.5 + 0.5, 5.0)


def tiles(size=512):
    # TWO_TONE: 4 x 4 glazed tiles (grout in green), a little grime low down.
    d, cid, *_ = cells(size, 4, 4)
    j = joint(d, 6)
    face = per_cell(cid, 81, 0.92, 1.04)
    glaze = noise(size, 30, 82)
    shade = face * (0.97 + 0.05 * glaze)
    save('street/tiles', two_tone(shade, j), bevel(d, 7) * 0.9 + glaze * 0.1, 3.0)


def shutter(size=256):
    # A roller shutter: slats every 8 px, grubby bottom.
    x, y = grid_coords(size)
    slat = (y % 16) / 16
    prof = np.sin(slat * 2 * math.pi)
    shade = 0.92 + 0.1 * prof
    grime = fbm(size, 91, (40, 10), (0.6, 0.4))
    base = mix(np.broadcast_to(hexc('#5d6066'), (size, size, 3)), np.broadcast_to(hexc('#4c4f55'), (size, size, 3)), ((y % 16) >= 8).astype(float))
    rgb = base * shade[:, :, None] * (0.95 + 0.1 * grime)[:, :, None]
    lo = np.clip((y - size * 0.78) / (size * 0.22), 0, 1)
    rgb *= (1 - 0.22 * lo)[:, :, None]
    save('street/shutter', rgb, prof * 0.5 + 0.5, 3.0)


def wood_floor(size=512):
    # 8 boards per tile (as the old canvas), random butt joints, wavy grain.
    x, y = grid_coords(size)
    bh = size / 8
    row = np.floor(y / bh)
    r = rng(101)
    cut = r.uniform(0, size, 8)[row.astype(int)]
    seg = ((x - cut) % size) < size / 2
    bid = (row * 2 + seg).astype(int)
    tone = r.uniform(0.85, 1.08, 32)[bid]
    yy = y % bh
    dj = np.minimum(yy, bh - yy)
    dx = np.minimum((x - cut) % (size / 2), size / 2 - (x - cut) % (size / 2))
    d = np.minimum(dj, dx)
    gn = noise(size, 20, 102)
    grain = 0.5 + 0.5 * np.sin((y + gn * 18) * 0.9 + bid * 1.7)
    shade = tone * (0.92 + 0.08 * grain)
    rgb = colour(hexc('#8a6a42'), shade)
    rgb = mix(rgb, hexc('#2e2016'), joint(d, 2.5))
    save('street/wood_floor', rgb, bevel(d, 3) * 0.8 + grain * 0.2, 3.0)


def sign_board(size=512):
    # TWO_TONE (single colour): a painted board, horizontal timber grain, worn paint.
    w, h = size, size // 4
    gn = noise(h, 10, 111, w)
    x, y = grid_coords(h, w)
    grain = 0.5 + 0.5 * np.sin(y * 0.6 + gn * 8)
    wear = fbm(h, 112, (30, 8), (0.6, 0.4), w)
    shade = 0.95 + 0.05 * (grain - 0.5) - 0.06 * np.clip(wear - 0.6, 0, 1) * 3
    save('street/sign_board', two_tone(shade, np.zeros_like(shade)), grain * 0.3 + wear * 0.7, 1.5)


def window_cell(w, h, kind, seed):
    """One window (frame, glass and what's behind it), for the atlas."""
    r = rng(seed)
    img = np.zeros((h, w, 3))
    x, y = grid_coords(h, w)
    fr = 10
    inner = (x >= fr) & (x < w - fr) & (y >= fr) & (y < h - fr)
    frame = hexc('#1a1a1c')
    img[:] = frame
    if kind.startswith('unlit'):
        g = hexc('#0d1118') + 0.05 * np.clip(1 - y / h, 0, 1)[:, :, None] * hexc('#3a4a6a')
        img = np.where(inner[:, :, None], g, img)
        if kind == 'unlit_blinds':
            sl = ((y // 8) % 2 == 0) & inner
            img = np.where(sl[:, :, None], hexc('#151a22'), img)
    else:
        warm = {'lit_warm': '#f3b45c', 'lit_warm2': '#ffcf7a', 'lit_cool': '#d9e2f0', 'lit_amber': '#e89a40', 'lit_tv': '#9ab8ff', 'lit_cream': '#f6e2b0'}[kind.replace('_curtains', '').replace('_blinds', '')]
        c = hexc(warm)
        cx, cy = w * r.uniform(0.35, 0.65), h * 0.35
        dd = np.hypot((x - cx) / w, (y - cy) / h)
        glow = np.clip(1.25 - dd * 1.6, 0.35, 1.2)
        g = c[None, None, :] * glow[:, :, None]
        g = np.where((dd < 0.08)[:, :, None], np.minimum(1, c * 1.3 + 0.2), g)
        img = np.where(inner[:, :, None], g, img)
        if 'curtains' in kind:
            cw = w * 0.22
            cur = ((x < fr + cw) | (x > w - fr - cw)) & inner
            fold = 0.75 + 0.25 * np.sin(x * 0.5)
            img = np.where(cur[:, :, None], hexc('#5a2420') * fold[:, :, None] * (0.6 + 0.4 * glow)[:, :, None], img)
        if 'blinds' in kind:
            sl = ((y // 8) % 2 == 0) & inner & (y < h * 0.55)
            img = np.where(sl[:, :, None], img * 0.55, img)
    # Glazing bars: one upright, one transom.
    bar = ((np.abs(x - w / 2) < 3) | (np.abs(y - h * 0.45) < 3)) & inner
    img = np.where(bar[:, :, None], frame, img)
    hgt = (~inner).astype(float) * 0.8 + bar * 0.6
    return img, hgt


WINDOW_CELLS = ['unlit', 'unlit_blinds', 'lit_warm', 'lit_warm2_curtains', 'lit_cool', 'lit_cream_blinds', 'lit_amber_curtains', 'lit_tv']


def windows(size=512):
    # Atlas: 4 x 2 cells of 128 x 256 (see WINDOW_CELLS for the order).
    W, H = size // 4, size // 2
    rgb = np.zeros((size, size, 3))
    hgt = np.zeros((size, size))
    for i, k in enumerate(WINDOW_CELLS):
        c, h = window_cell(W, H, k, 120 + i)
        cx, cy = (i % 4) * W, (i // 4) * H
        rgb[cy:cy + H, cx:cx + W] = c
        hgt[cy:cy + H, cx:cx + W] = h
    save('street/windows', rgb, hgt, 4.0, q=85)


TAGS = ['KROZEP', 'MOX', 'RAZONE', 'VEXUK', 'SNO', 'GRITKAZ', 'DEKTWO', 'FLOBIZ']
SPRAY = ['#e8e8e8', '#ff3d6e', '#3dd7ff', '#ffd23d', '#7dff5a', '#b06bff', '#ff7a2e']


def graffiti():
    # Atlas 1024 x 1024: 2 x 4 cells of 512 x 256, each an original made-up tag on a clear background.
    A = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0))
    hA = np.zeros((1024, 1024))
    r = rng(131)
    for i, word in enumerate(TAGS):
        cell = Image.new('RGBA', (512, 256), (0, 0, 0, 0))
        fill = SPRAY[i % len(SPRAY)]
        out = SPRAY[(i * 3 + 2) % len(SPRAY)]
        size = 150
        f = font(size)
        g = ImageDraw.Draw(cell)
        while g.textlength(word, font=f) > 440 and size > 40:
            size -= 6
            f = font(size)
        layer = Image.new('RGBA', (512, 256), (0, 0, 0, 0))
        gl = ImageDraw.Draw(layer)
        gl.text((256, 128), word, font=f, anchor='mm', fill='#101010', stroke_width=11, stroke_fill='#101010')
        gl.text((256, 128), word, font=f, anchor='mm', fill=out, stroke_width=6, stroke_fill=out)
        gl.text((256, 128), word, font=f, anchor='mm', fill=fill)
        # Drips from the bottom of the letters.
        bb = layer.getbbox() or (60, 60, 450, 190)
        for _ in range(7):
            dx = r.uniform(bb[0] + 20, bb[2] - 20)
            y0 = bb[3] - 18
            gl.line([(dx, y0), (dx, y0 + r.uniform(15, 50))], fill=fill, width=4)
            gl.ellipse([dx - 3, y0 + 45, dx + 3, y0 + 51], fill=fill) if r.uniform() < 0.3 else None
        sk = float(r.uniform(-0.35, 0.35))
        layer = layer.transform((512, 256), Image.AFFINE, (1, sk, -sk * 128, 0, 1, 0), resample=Image.BICUBIC)
        layer = layer.rotate(float(r.uniform(-6, 6)), resample=Image.BICUBIC, center=(256, 128))
        # Overspray: a soft halo of the fill colour.
        halo = layer.filter(ImageFilter.GaussianBlur(5))
        ha = np.asarray(halo).astype(np.float64)
        ha[:, :, 3] *= 0.25
        cell = Image.alpha_composite(Image.fromarray(ha.astype(np.uint8)), layer)
        cx, cy = (i % 2) * 512, (i // 2) * 256
        A.paste(cell, (cx, cy))
        hA[cy:cy + 256, cx:cx + 256 * 2] = np.asarray(cell)[:, :, 3] / 255.0
    a = np.asarray(A).astype(np.float64) / 255
    save('street/graffiti', a[:, :, :3], np.asarray(Image.fromarray((hA * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.5))) / 255.0, 2.0, alpha=a[:, :, 3], q=85)


POSTERS = [
    ('#f2e8d0', 'LIVE\nTONIGHT'), ('#1d1d1d', 'CAR BOOT\nSALE'), ('#d63a2a', 'BOXING\nNIGHT'), ('#2a5bd6', 'RAVE'),
    ('#f5d000', 'CASH 4\nGOLD'), ('#ffffff', 'MISSING\nCAT'), ('#f2e8d0', 'STREET\nPARTY'), ('#1d1d1d', 'KARAOKE'),
]


def posters():
    # Atlas 1024 x 720: 4 x 2 cells of 256 x 360.
    A = Image.new('RGB', (1024, 720))
    r = rng(141)
    for i, (bg, head) in enumerate(POSTERS):
        cell = Image.new('RGB', (256, 360), bg)
        g = ImageDraw.Draw(cell)
        dark = bg in ('#1d1d1d', '#2a5bd6', '#d63a2a')
        ink = '#f2efe6' if dark else '#101014'
        accent = '#ffd23d' if dark else '#e8333a'
        f = font(54)
        lines = head.split('\n')
        for k, ln in enumerate(lines):
            size = 54
            while g.textlength(ln, font=f) > 220 and size > 20:
                size -= 4
                f = font(size)
            g.text((128, 62 + k * 56), ln, font=f, anchor='mm', fill=ink)
            f = font(54)
        yb = 62 + len(lines) * 56 - 14
        g.rectangle([30, yb, 226, yb + 6], fill=accent)
        # A simple picture block and lines of "small print".
        g.rectangle([36, yb + 22, 220, yb + 110], outline=ink, width=3)
        g.polygon([(50, yb + 100), (110, yb + 40), (150, yb + 80), (180, yb + 55), (210, yb + 100)], fill=accent)
        for k in range(4):
            g.rectangle([36, yb + 128 + k * 18, 36 + int(r.uniform(100, 184)), yb + 136 + k * 18], fill=ink)
        A.paste(cell, ((i % 4) * 256, (i // 4) * 360))
    a = np.asarray(A).astype(np.float64) / 255
    # Paper: a little wrinkle and fade.
    wr = fbm(720, 142, (30, 8), (0.6, 0.4), 1024)
    a = a * (0.94 + 0.08 * wr)[:, :, None]
    save('street/posters', a, wr, 2.5, q=85)


# ---------------------------------------------------------------------------- furniture


def furniture_wood(light, size=256):
    x, y = grid_coords(size)
    gn = noise(size, 18, 151 if light else 152)
    gn2 = noise(size, 4, 153)
    rings = 0.5 + 0.5 * np.sin(y * 0.45 + gn * 4 + gn2 * 1.2)
    base = hexc('#b08458') if light else hexc('#5a3a22')
    shade = 0.9 + 0.12 * rings
    rgb = colour(base, shade)
    save('furniture/wood_light' if light else 'furniture/wood_dark', rgb, rings, 1.5)


def weave(size=128):
    x, y = grid_coords(size)
    over = ((x // 2 + y // 2) % 2).astype(float)
    th = 0.5 + 0.5 * np.where(over > 0, np.sin((x % 2 + 0.5) / 2 * math.pi), np.sin((y % 2 + 0.5) / 2 * math.pi))
    n = noise(size, 2, 161)
    shade = 0.82 + 0.1 * th + 0.06 * (n - 0.5)
    save('furniture/weave', colour(np.ones(3), shade), th * 0.8 + n * 0.2, 2.0)


def brushed(size=256):
    # Brushing runs vertically in the texture (boxUV turns it across fronts and sides).
    n = noise(size, 0.6, 171, size)
    streak = np.repeat(noise(1, 0.5, 172, size)[0:1, :], size, axis=0)
    shade = 0.78 + 0.06 * (streak - 0.5) * 2 + 0.03 * (n - 0.5)
    save('furniture/brushed_metal', colour(np.ones(3), shade), streak * 0.7 + n * 0.3, 1.0)


# ---------------------------------------------------------------------------- character


def stroke_layer(w, h, strokes, blur=0.6):
    img = Image.new('L', (w * 2, h * 2), 0)
    g = ImageDraw.Draw(img)
    for (x0, y0, x1, y1, a, wd) in strokes:
        g.line([(x0 * 2, y0 * 2), (x1 * 2, y1 * 2)], fill=int(a * 255), width=max(1, int(wd * 2)))
    img = img.resize((w, h), Image.LANCZOS).filter(ImageFilter.GaussianBlur(blur))
    return np.asarray(img).astype(np.float64) / 255


def brow():
    # White hair strokes on clear; the material tints them. 256 x 64.
    W, H = 256, 64
    r = rng(181)
    st = []
    for _ in range(900):
        u = r.uniform() ** 0.85
        hh = H * (0.5 - 0.3 * u)
        y = H / 2 + (r.uniform() - 0.5) * hh
        x = u * W * 0.94 + W * 0.03
        ang = -math.pi / 2 + (0.4 + u * 1.0) + (r.uniform() - 0.5) * 0.3
        ln = 6 + r.uniform() * 9
        st.append((x, y, x + math.cos(ang) * ln, y - math.sin(ang) * ln * 0.45, 0.55 + r.uniform() * 0.45, 1 + r.uniform() * 1.2))
    a = stroke_layer(W, H, st)
    yy = np.linspace(0, 1, H)[:, None]
    xx = np.linspace(0, 1, W)[None, :]
    a *= np.clip(np.minimum(yy / 0.3, (1 - yy) / 0.3), 0, 1) * np.clip(np.minimum(xx / 0.08, (1 - xx) / 0.15), 0, 1)
    save('character/brow', np.ones((H, W, 3)), a, 2.0, alpha=np.clip(a * 1.2, 0, 1), q=90)


def lash():
    W, H = 128, 32
    r = rng(182)
    st = []
    for x in range(2, W - 2):
        k = x / W
        t = 2.5 + 3.5 * k
        st.append((x, H * 0.62 - t / 2, x, H * 0.62 + t / 2, 0.75, 1))
    for _ in range(80):
        k = 0.05 + r.uniform() * 0.92
        x = k * W
        ln = H * (0.25 + 0.35 * k) * (0.7 + r.uniform() * 0.3)
        x2, y2 = x + 4 + k * 6, H * 0.6 - ln
        xm, ym = x + 2 + k * 4, H * 0.6 - ln * 0.7
        st.append((x, H * 0.6, xm, ym, 0.5 + r.uniform() * 0.4, 0.8))
        st.append((xm, ym, x2, y2, 0.5 + r.uniform() * 0.4, 0.7))
    a = stroke_layer(W, H, st, 0.4)
    save('character/lash', np.ones((H, W, 3)), a, 1.5, alpha=np.clip(a, 0, 1), q=90)


def fabric(kind, size=128):
    """Grey weave (garments are coloured per vertex): mean about 0.85, as before."""
    x, y = grid_coords(size)
    n = noise(size, 1.0, 190 + len(kind) * 7)
    if kind == 'knit':
        # Rows of V stitches.
        v = np.abs(((x % 8) - 3.5)) / 3.5
        h = 0.5 + 0.5 * np.sin((y + v * 3) / 6 * 2 * math.pi)
        shade = 0.74 + 0.2 * h + 0.04 * n
    elif kind == 'fleece':
        h = fbm(size, 191, (3, 1.2), (0.6, 0.4))
        shade = 0.84 + 0.1 * h
    elif kind == 'denim':
        h = (((x + y) % 4) < 2).astype(float) * 0.7 + n * 0.3
        shade = 0.7 + 0.2 * h + 0.08 * noise(size, 12, 192)
    elif kind == 'nylon':
        h = 0.5 + 0.5 * np.sin(x * 2 * math.pi / 4) * np.sin(y * 2 * math.pi / 4)
        shade = 0.88 + 0.05 * h + 0.03 * n
    elif kind == 'leather':
        cellsn = noise(size, 3, 193)
        h = np.abs(cellsn - 0.5) * 2
        shade = 0.8 + 0.16 * (1 - h) ** 2
    elif kind == 'canvas':
        h = ((x + y) % 2) * 0.6 + n * 0.4
        shade = 0.76 + 0.15 * h
    else:  # cotton jersey
        h = (((x + y * 2) % 3) == 0).astype(float) * 0.5 + n * 0.5
        shade = 0.82 + 0.1 * h
    save(f'character/fabric_{kind}', colour(np.ones(3), shade), h, 2.0)


# ---------------------------------------------------------------------------- home finishes

# Colours read from src/property/catalogue.ts, so the textures match the finish the player bought.
def _finishes():
    import re
    src = open(os.path.join(ROOT, 'src', 'property', 'catalogue.ts'), encoding='utf-8').read()
    out = {}
    for m in re.finditer(r"\{ id: '([fw]_[a-z_]+)'[^}]*?colour: '(#[0-9a-f]{6})'(?:, colour2: '(#[0-9a-f]{6})')?", src):
        out[m.group(1)] = (m.group(2),) + ((m.group(3),) if m.group(3) else ())
    return out


FIN = _finishes()


def sid(name):
    return sum(ord(c) * (i + 1) for i, c in enumerate(name)) % 1000


def boards(name, base, size=512):
    # 1 m tile: 7 boards across, staggered butt joints, a gentle grain.
    x, y = grid_coords(size)
    n = 7
    bw = size / n
    col = np.floor(x / bw)
    r = rng(sid(name))
    cut = r.uniform(0, size, n)[col.astype(int) % n]
    seg = ((y - cut) % size) < size / 2
    bid = (col * 2 + seg).astype(int)
    tone = r.uniform(0.86, 1.1, 32)[bid]
    xx = x % bw
    dj = np.minimum(xx, bw - xx)
    dy = np.minimum((y - cut) % (size / 2), size / 2 - (y - cut) % (size / 2))
    d = np.minimum(dj, dy)
    gn = noise(size, 16, 201)
    grain = 0.5 + 0.5 * np.sin((x + gn * 24) * 0.55 + bid * 2.1)
    shade = tone * (0.93 + 0.08 * grain)
    rgb = colour(hexc(base), shade / 0.98)
    rgb = mix(rgb, hexc(base) * 0.35, joint(d, 2.5))
    save(f'home/{name}', rgb, bevel(d, 3) * 0.8 + grain * 0.2, 3.0)


def carpet(name, base, size=512):
    pile = noise(size, 0.8, 211 + len(name))
    tuft = fbm(size, 212, (4, 1.5), (0.6, 0.4))
    shade = 0.93 + 0.08 * (tuft - 0.5) * 2 + 0.04 * (pile - 0.5)
    shade *= 0.97 + 0.04 * noise(size, 60, 213)
    save(f'home/{name}', colour(hexc(base), shade), tuft * 0.7 + pile * 0.3, 2.0)


def floor_tiles(name, c1, c2, n, check, size=512):
    d, cid, u, v, row, col = cells(size, n, n)
    j = joint(d, 3)
    face = per_cell(cid, 221 + len(name), 0.94, 1.05)
    m = noise(size, 26, 222)
    shade = face * (0.97 + (0.02 if check else 0.06) * m)
    if check:
        alt = ((row + col) % 2).astype(float)
        base = mix(np.broadcast_to(hexc(c1), (size, size, 3)), np.broadcast_to(hexc(c2), (size, size, 3)), alt)
        grout = hexc('#8a8680')
    else:
        base = np.broadcast_to(hexc(c1), (size, size, 3)) * 1.0
        # Stone and slate: veins and a cleft surface.
        # Stone and slate: a gentle cloud of the second colour, no busy veining.
        base = mix(base, np.broadcast_to(hexc(c2), (size, size, 3)), np.clip((m - 0.35) * 0.35, 0, 0.25))
        grout = hexc(c2) * 0.8
    rgb = base * shade[:, :, None]
    rgb = mix(rgb, grout, j)
    h = bevel(d, 3.5) * 0.85 + m * 0.15 * (0 if check else 1)
    save(f'home/{name}', rgb, h, 3.0)


def paint(name, base, size=512):
    # 2 m tile: roller texture (a fine stipple) and soft mottling.
    st = noise(size, 0.9, 231)
    mo = noise(size, 70, 232)
    shade = 0.975 + 0.025 * (st - 0.5) * 2 + 0.012 * (mo - 0.5) * 2
    save(f'home/{name}', colour(hexc(base), shade), st * 0.6 + mo * 0.4, 1.2)


def stripes(name, c1, c2, size=512):
    # 0.5 m tile: a Regency stripe (wide band, two pinstripes), faint paper texture.
    x, y = grid_coords(size)
    u = x / size
    band = ((u > 0.1) & (u < 0.4)).astype(float)
    pin = ((np.abs(u - 0.47) < 0.006) | (np.abs(u - 0.03) < 0.006)).astype(float)
    paper = noise(size, 1.0, 241)
    shade = 0.97 + 0.04 * (paper - 0.5)
    rgb = mix(np.broadcast_to(hexc(c1), (size, size, 3)), np.broadcast_to(hexc(c2), (size, size, 3)), np.clip(band + pin, 0, 1))
    save(f'home/{name}', rgb * shade[:, :, None], paper * 0.5 + band * 0.2, 1.5)


def brick_slips(name, base, size=512):
    # 1 m tile: 4 slips across (225 mm), 13 courses (75 mm), pale mortar.
    d, cid, *_ = cells(size, 4, 13, 0.5)
    j = joint(d, 4)
    face = per_cell(cid, 251, 0.8, 1.12)
    hue = per_cell(cid, 252, 0, 1)
    b = np.broadcast_to(hexc(base), (size, size, 3)) * 1.0
    b = mix(b, np.broadcast_to(hexc('#7a4232'), (size, size, 3)), (hue > 0.65).astype(float) * 0.7)
    b = mix(b, np.broadcast_to(hexc('#b07050'), (size, size, 3)), (hue < 0.2).astype(float) * 0.6)
    grain = fbm(size, 253, (8, 3), (0.7, 0.3))
    rgb = b * (face * (0.94 + 0.1 * grain))[:, :, None]
    rgb = mix(rgb, hexc('#cfc6b4'), j)
    save(f'home/{name}', rgb, bevel(d, 4) * 0.85 + grain * 0.15, 3.0)


def panelling(name, wood, size=512):
    # 1 m tile: two raised-and-fielded panels side by side, framed by stiles and rails.
    x, y = grid_coords(size)
    pw = size / 2
    u = (x % pw) / pw
    v = y / size
    du = np.minimum(u, 1 - u) * pw
    dv = np.minimum(v, 1 - v) * size
    d = np.minimum(du, dv)
    frame = 40.0
    inpanel = d > frame
    raised = np.clip((d - frame) / 18, 0, 1)
    gn = noise(size, 16, 261)
    grain = 0.5 + 0.5 * np.sin((y + gn * 20) * 0.5)
    shade = 0.9 + 0.08 * grain
    shade = np.where(inpanel, shade * (0.94 + 0.08 * raised), shade)
    groove = np.clip(1 - np.abs(d - frame) / 2.5, 0, 1)
    rgb = colour(hexc(wood), shade)
    rgb = mix(rgb, hexc(wood) * 0.45, groove)
    h = np.where(inpanel, 0.3 + 0.5 * raised, 0.9) - groove * 0.4 + grain * 0.05
    save(f'home/{name}', rgb, h, 4.0)


def metro(name, c1, c2, size=512):
    # 0.6 m tile: 4 tiles across (150 mm), 8 courses (75 mm), brick bond, bevelled edges.
    d, cid, *_ = cells(size, 4, 8, 0.5)
    j = joint(d, 4)
    glaze = noise(size, 40, 271)
    face = per_cell(cid, 272, 0.96, 1.03)
    edge = np.clip(1 - d / 10, 0, 1)
    shade = face * (0.98 + 0.03 * glaze) * (1 - 0.1 * edge)
    rgb = colour(hexc(c1), shade)
    rgb = mix(rgb, hexc(c2), j)
    save(f'home/{name}', rgb, bevel(d, 10) * 0.95 + glaze * 0.05, 4.0)


def home():
    boards('f_oak', FIN['f_oak'][0])
    boards('f_walnut', FIN['f_walnut'][0])
    for k in ('f_grey_carpet', 'f_cream_carpet', 'f_plum_carpet', 'f_red_carpet'):
        carpet(k, FIN[k][0])
    floor_tiles('f_check_tiles', *FIN['f_check_tiles'], 4, True)
    floor_tiles('f_stone_tiles', *FIN['f_stone_tiles'], 2, False)
    floor_tiles('f_slate_tiles', *FIN['f_slate_tiles'], 3, False)
    for k in ('w_magnolia', 'w_white', 'w_sage', 'w_navy', 'w_charcoal', 'w_blush', 'w_slate_blue', 'w_stone'):
        paint(k, FIN[k][0])
    stripes('w_stripes', *FIN['w_stripes'])
    brick_slips('w_brick', FIN['w_brick'][0])
    panelling('w_panelling', FIN['w_panelling'][0])
    metro('w_tiles', *FIN['w_tiles'])


# ---------------------------------------------------------------------------- effects

FX_CELLS = ['hit', 'heavy', 'block', 'glint', 'danger', 'dot', 'smoke', 'drop']


def fx_cell(kind, S=128, seed=0):
    x, y = grid_coords(S)
    cx = cy = (S - 1) / 2
    dx, dy = (x - cx) / (S / 2), (y - cy) / (S / 2)
    r = np.hypot(dx, dy)
    th = np.arctan2(dy, dx)
    rg = rng(300 + seed)
    if kind == 'hit':
        # A hot core with uneven radial spikes.
        spikes = np.zeros_like(r)
        for a in rg.uniform(0, 2 * math.pi, 7):
            dth = np.abs(np.angle(np.exp(1j * (th - a))))
            ln = rg.uniform(0.55, 0.95)
            spikes = np.maximum(spikes, np.clip(1 - dth / (0.16 * (1 - r / ln + 0.25)), 0, 1) * np.clip(1 - r / ln, 0, 1) ** 0.6)
        core = np.clip(1 - r / 0.45, 0, 1) ** 0.8
        a = np.clip(core + spikes, 0, 1)
    elif kind == 'heavy':
        # A bigger star burst with a shock ring.
        spikes = np.zeros_like(r)
        for k in range(10):
            a0 = k * 2 * math.pi / 10 + rg.uniform(-0.12, 0.12)
            dth = np.abs(np.angle(np.exp(1j * (th - a0))))
            ln = rg.uniform(0.75, 1.0)
            spikes = np.maximum(spikes, np.clip(1 - dth / 0.14, 0, 1) * np.clip(1 - r / ln, 0, 1) ** 0.8)
        ring = np.clip(1 - np.abs(r - 0.7) / 0.06, 0, 1) * 0.6
        core = np.clip(1 - r / 0.42, 0, 1) ** 1.2
        a = np.clip(core + spikes + ring, 0, 1)
    elif kind == 'block':
        # A cold, hard chevron shard (a six-sided flake).
        hexd = np.maximum(np.abs(dx) * 0.866 + np.abs(dy) * 0.5, np.abs(dy))
        a = np.clip((0.62 - hexd) / 0.05, 0, 1) * (0.55 + 0.45 * np.clip(1 - r / 0.62, 0, 1))
        a = np.maximum(a, np.clip(1 - np.abs(hexd - 0.62) / 0.04, 0, 1))
    elif kind == 'glint':
        # A four-point star with a small cross flare.
        star = np.clip(1 - np.abs(dx) / (0.12 * (1 - np.abs(dy)) + 1e-3), 0, 1) * np.clip(1 - np.abs(dy), 0, 1) ** 0.8
        star = np.maximum(star, np.clip(1 - np.abs(dy) / (0.12 * (1 - np.abs(dx)) + 1e-3), 0, 1) * np.clip(1 - np.abs(dx), 0, 1) ** 0.8)
        core = np.clip(1 - r / 0.3, 0, 1) ** 0.7
        a = np.clip(star + core, 0, 1)
    elif kind == 'danger':
        # A warning ring with a bright edge and a soft fill.
        a = np.clip(1 - np.abs(r - 0.68) / 0.1, 0, 1) + np.clip(1 - r / 0.68, 0, 1) * 0.25
        a = np.clip(a, 0, 1) * (r < 0.8)
    elif kind == 'dot':
        a = np.clip(1 - r, 0, 1) ** 2
    elif kind == 'smoke':
        n = noise(S, 10, 310)
        a = np.clip(1 - r / 0.9, 0, 1) ** 1.5 * (0.5 + 0.7 * n)
    else:  # drop (sweat/blood spray): a teardrop pointing up
        a = np.clip(1 - np.hypot(dx / 0.35, (dy - 0.25) / 0.35), 0, 1)
        a = np.maximum(a, np.clip(1 - np.abs(dx) / (0.35 * np.clip((dy + 0.6) / 0.85, 0, 1) + 1e-3), 0, 1) * (dy < 0.25) * (dy > -0.6))
        a = np.clip(a * 1.4, 0, 1)
    return np.clip(a, 0, 1)


def effects():
    # Atlas 512 x 256: 4 x 2 cells of 128 (see FX_CELLS). White, shape in alpha (and in the colour,
    # so it works with additive blending too); the game tints each particle.
    S = 128
    A = np.zeros((256, 512))
    for i, k in enumerate(FX_CELLS):
        a = fx_cell(k, S, i)
        A[(i // 4) * S:(i // 4 + 1) * S, (i % 4) * S:(i % 4 + 1) * S] = a
    save('fx/particles', np.dstack([A, A, A]), None, alpha=A, q=90)
    # Rain: a tapered streak down the middle of a 64 px square (the game draws drops as point sprites).
    W, H = 64, 64
    x, y = grid_coords(H, W)
    v = y / H
    wd = 2.5 + 3.5 * v
    a = np.clip(1 - np.abs(x - W / 2 + 0.5) / wd, 0, 1) * np.clip(v * 1.3, 0, 1) * np.clip((1 - v) * 8, 0, 1)
    save('fx/rain', np.ones((H, W, 3)) * np.array([0.85, 0.9, 1.0]), None, alpha=a * 0.9, q=90)


# ---------------------------------------------------------------------------- main


def main():
    brick(); paving(); road(); markings(); concrete(); plaster(); corrugated(); tiles(); shutter(); wood_floor()
    sign_board(); windows(); graffiti(); posters()
    furniture_wood(True); furniture_wood(False); weave(); brushed()
    brow(); lash()
    for k in ('fleece', 'knit', 'nylon', 'denim', 'leather', 'cotton', 'canvas'):
        fabric(k)
    home()
    effects()
    total = 0
    for dp, _, fs in os.walk(OUT):
        for f in fs:
            if f.endswith('.webp'):
                total += os.path.getsize(os.path.join(dp, f))
    print(f'wrote {OUT}: {total / 1024:.0f} KB')


if __name__ == '__main__':
    main()
