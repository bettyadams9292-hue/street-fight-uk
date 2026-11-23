"""
Hard Graft lettering and buttons, built from the owner's own painted buttons:
- letters are cut from the HG buttons (glyphs/, made by glyphs.py); the few the buttons never spell (B, F, J, K, Q, Z, !)
  are put together from parts of the others, in the same brush;
- the plate is the HG button's own black (or red) brush plate with its lettering painted out, stretched to fit.
"""
import cv2
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

SHEAR = 0.24  # the italic, undone when the letters were cut
PICK = {'A': 1, 'C': 0, 'D': 0, 'E': 3, 'G': 1, 'H': 0, 'I': 2, 'L': 0, 'M': 1, 'N': 2, 'O': 1, 'P': 0, 'R': 1, 'S': 1,
        'T': 2, 'U': 0, 'V': 0, 'W': 0, 'X': 0, 'Y': 0}
H = 100


def _clean(g):
    A = np.array(g)
    m = A[..., 3] > 60
    lab, n = ndi.label(m)
    if n > 1:
        sizes = ndi.sum(m, lab, range(1, n + 1))
        keep = [i + 1 for i, s in enumerate(sizes) if s >= sizes.max() * 0.4]
        km = ndi.binary_dilation(np.isin(lab, keep), iterations=2)
        A[..., 3] = np.where(km, A[..., 3], 0)
    out = Image.fromarray(A)
    bb = out.getbbox()
    out = out.crop((bb[0], 0, bb[2], out.height))
    return out.resize((out.width, H), Image.LANCZOS) if out.height != H else out


_G = {}


def glyph(ch):
    if ch in _G:
        return _G[ch]
    if ch in PICK:
        g = _clean(Image.open(f'glyphs/{ch}_{PICK[ch]}.png').convert('RGBA'))
    elif ch == 'F':
        e = np.array(glyph('E'))
        w = e.shape[1]
        stem = int(w * 0.42)
        e[int(H * 0.66):, stem:, 3] = 0
        g = Image.fromarray(e)
        g = g.crop((0, 0, g.getbbox()[2], H))
    elif ch == 'B':
        d = glyph('D')
        top = d.resize((int(d.width * 0.9), H // 2 + 3), Image.LANCZOS)
        bot = d.resize((d.width, H // 2 + 3), Image.LANCZOS)
        g = Image.new('RGBA', (d.width, H), (0, 0, 0, 0))
        g.alpha_composite(bot, (0, H - bot.height))
        g.alpha_composite(top, (0, 0))
    elif ch == 'K':
        i = glyph('I')
        x = glyph('X')
        arms = x.crop((int(x.width * 0.42), 0, x.width, H))
        g = Image.new('RGBA', (i.width + arms.width - 6, H), (0, 0, 0, 0))
        g.alpha_composite(arms, (i.width - 6, 0))
        g.alpha_composite(i, (0, 0))
    elif ch == 'Q':
        o = glyph('O')
        r = glyph('R')
        tail = r.crop((int(r.width * 0.45), int(H * 0.62), r.width, H))
        tail = tail.resize((int(tail.width * 0.8), int(tail.height * 0.7)), Image.LANCZOS)
        g = Image.new('RGBA', (max(o.width, int(o.width * 0.55) + tail.width), H), (0, 0, 0, 0))
        g.alpha_composite(o, (0, 0))
        g.alpha_composite(tail, (int(o.width * 0.55), H - tail.height))
    elif ch == 'Z':
        n = glyph('N')
        g = n.rotate(-90, expand=True, resample=Image.BICUBIC)
        g = g.resize((int(n.width * 0.95), H), Image.LANCZOS)
    elif ch == 'J':
        # The U's right stroke and its hooked foot: the top of its left stroke painted out.
        u = np.array(glyph('U'))
        w = u.shape[1]
        u[: int(H * 0.58), : int(w * 0.45), 3] = 0
        g = Image.fromarray(u)
        bb = g.getbbox()
        g = g.crop((bb[0], 0, bb[2], H))
    elif ch == '!':
        i = glyph('I')
        top = i.resize((i.width, int(H * 0.7)), Image.LANCZOS)
        dot = i.crop((0, int(H * 0.72), i.width, H)).resize((int(i.width * 0.8), int(H * 0.17)), Image.LANCZOS)
        g = Image.new('RGBA', (i.width, H), (0, 0, 0, 0))
        g.alpha_composite(top, (0, 0))
        g.alpha_composite(dot, (int(i.width * 0.05), H - dot.height))
    else:
        raise KeyError(ch)
    _G[ch] = g
    return g


def word(text):
    """The words set in the brush capitals, upright, then sloped like the originals."""
    text = text.upper().replace('&', 'AND')
    parts = []
    for ch in text:
        if ch == ' ':
            parts.append(None)
        elif ch in "'’.,:()-/":
            continue
        else:
            parts.append(glyph(ch))
    track = -int(H * 0.035)
    gap = int(H * 0.3)
    w = sum((p.width + track) if p else gap for p in parts) - track
    img = Image.new('RGBA', (max(1, w), H), (0, 0, 0, 0))
    x = 0
    for p in parts:
        if p is None:
            x += gap
            continue
        img.alpha_composite(p, (x, 0))
        x += p.width + track
    k = SHEAR
    pad = int(k * H)
    return img.transform((img.width + pad, H), Image.AFFINE, (1, k, -pad, 0, 1, 0), Image.BICUBIC)


def _plate(src):
    """The button's plate with its lettering painted out; and where the lettering sat (y centre, height)."""
    im = Image.open(src).convert('RGBA')
    A = np.array(im)
    r, g, b, a = [A[..., i].astype(int) for i in range(4)]
    m = (np.minimum(np.minimum(r, g), b) > 120) & (np.abs(r - b) < 60) & (a > 150)
    m = ndi.binary_dilation(m, iterations=3)
    ys = np.where(m.any(1))[0]
    bgr = cv2.cvtColor(A[..., :3], cv2.COLOR_RGB2BGR)
    filled = cv2.inpaint(bgr, (m * 255).astype(np.uint8), 7, cv2.INPAINT_TELEA)
    out = A.copy()
    out[..., :3] = cv2.cvtColor(filled, cv2.COLOR_BGR2RGB)
    return Image.fromarray(out), (ys[0] + ys[-1]) / 2, ys[-1] - ys[0]


PLATES = {}


def plate(kind, width):
    if kind not in PLATES:
        PLATES[kind] = _plate({'black': 'cut3/006.png', 'red': 'cut3/003.png'}[kind])
    p, yc, th = PLATES[kind]
    w, h = p.size
    if width <= w:
        return p.resize((width, h), Image.LANCZOS), yc, th
    l, r = int(w * 0.28), int(w * 0.72)
    left, mid, right = p.crop((0, 0, l, h)), p.crop((l, 0, r, h)), p.crop((r, 0, w, h))
    mid = mid.resize((width - left.width - right.width, h), Image.LANCZOS)
    out = Image.new('RGBA', (width, h), (0, 0, 0, 0))
    out.paste(left, (0, 0))
    out.paste(mid, (left.width, 0))
    out.paste(right, (left.width + mid.width, 0))
    return out, yc, th


def button(text, kind='black'):
    p0, yc, th = PLATES.get(kind) or plate(kind, 10)[:0] or PLATES[kind]
    t = word(text)
    s = th / H * 1.02
    t = t.resize((max(1, int(t.width * s)), max(1, int(t.height * s))), Image.LANCZOS)
    margin = int(p0.height * 0.42)
    width = max(int(p0.width * 0.55), t.width + 2 * margin)
    p, yc, th = plate(kind, width)
    out = p.copy()
    # Lettering a touch darker at the edges, as painted: a soft shadow under it.
    sh = Image.new('RGBA', t.size, (0, 0, 0, 0))
    sh.putalpha(t.split()[3].point(lambda v: int(v * 0.55)))
    x = (width - t.width) // 2
    y = int(yc - t.height / 2)
    out.alpha_composite(sh, (x + 3, y + 3))
    out.alpha_composite(t, (x, y))
    return out
