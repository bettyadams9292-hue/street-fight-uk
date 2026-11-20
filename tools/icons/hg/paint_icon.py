"""
Paints a Hard Graft style icon from a line icon (public/icons/ui/<name>.svg), for the few the owner's sheets don't have:
brushed silver-grey metal with shading, a black ink outline and inner lines, a red splash behind, and the white
"sticker" border the sheet icons have.

    python3 paint_icon.py out_dir name [name ...]
"""
import subprocess
import sys

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as ndi

ROOT = '/home/claude/street-fight-uk'
S = 232  # working size; the icon sits in about 180 px of it
rng = np.random.default_rng(7)


def line_mask(name, stroke=1.9):
    svg = open(f'{ROOT}/public/icons/ui/{name}.svg').read()
    svg = svg.replace('stroke="currentColor"', 'stroke="#ffffff"').replace('stroke-width="2"', f'stroke-width="{stroke}"')
    svg = svg.replace('stroke-linecap="square"', 'stroke-linecap="round"').replace('stroke-linejoin="miter"', 'stroke-linejoin="round"')
    png = subprocess.run(['rsvg-convert', '-w', '180', '-h', '180'], input=svg.encode(), capture_output=True).stdout
    open('/tmp/_line.png', 'wb').write(png)
    im = Image.open('/tmp/_line.png').convert('RGBA')
    can = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    can.alpha_composite(im, ((S - 180) // 2, (S - 180) // 2))
    return np.array(can)[..., 3] > 90


# Brushed metal and grime, taken from the owner's painted safe and padlock.
# brushed metal: fine grain streaked sideways, a few scratches
_n = ndi.gaussian_filter(rng.normal(0, 1, (S, S)), (0.6, 5))
_n += ndi.gaussian_filter(rng.normal(0, 1, (S, S)), 1.2) * 0.6
for _ in range(40):
    y0, x0 = rng.integers(0, S, 2); L = rng.integers(8, 30)
    _n[y0, x0:x0 + L] += 2.5
grey = (_n - _n.min()) / (np.ptp(_n) + 1e-6)
SPLAT = Image.open(f'{ROOT}/public/icons/hg/splat.webp').convert('RGBA')


def paint(name, red_fill=False):
    line = line_mask(name)
    body = ndi.binary_fill_holes(ndi.binary_dilation(line, iterations=4))
    body = ndi.binary_closing(body, iterations=3)
    yy, xx = np.mgrid[0:S, 0:S] / S
    # metal: mid grey, lighter top-left, darker bottom-right, with the painted texture's grain
    shade = 1.0 - 0.38 * (yy * 0.75 + xx * 0.25) + (grey - 0.5) * 0.28 + rng.normal(0, 0.025, (S, S))
    base = np.array([196, 196, 198]) if not red_fill else np.array([210, 28, 32])
    rgb = np.clip(shade[..., None] * base[None, None, :] * 1.08, 0, 255)
    # red wear along the lower edge, like the sheet's icons
    edge = ndi.binary_dilation(body, iterations=1) & ~ndi.binary_erosion(body, iterations=9)
    low = (yy > 0.62) & edge & (ndi.gaussian_filter(rng.random((S, S)), 2) > 0.5)
    rgb[low] = rgb[low] * 0.45 + np.array([200, 20, 24]) * 0.55
    img = np.zeros((S, S, 4), np.uint8)
    img[..., :3] = rgb.astype(np.uint8)
    img[..., 3] = body * 255
    # inner ink lines (the line icon itself), black, a little rough
    ink = ndi.binary_erosion(line, iterations=3)
    img[ink, :3] = (18, 16, 16)
    # black outline round the body
    out1 = ndi.binary_dilation(body, iterations=3) & ~body
    img[out1, :3] = (10, 10, 10)
    img[out1, 3] = 255
    # white sticker border round that, slightly grubby
    full = ndi.binary_dilation(body, iterations=3)
    out2 = ndi.binary_dilation(full, iterations=5) & ~full
    w = (226 + rng.normal(0, 14, (S, S))).clip(170, 255)
    img[out2, 0] = w[out2]
    img[out2, 1] = (w[out2] * 0.97)
    img[out2, 2] = (w[out2] * 0.96)
    img[out2, 3] = 255
    icon = Image.fromarray(img)
    # a red splash behind, bottom left
    can = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    sp = SPLAT.copy()
    sp.thumbnail((int(S * 0.45), int(S * 0.45)))
    a = np.array(sp)
    a[..., 3] = (a[..., 3] * 0.85).astype(np.uint8)
    can.alpha_composite(Image.fromarray(a), (int(S * 0.08), int(S * 0.5)))
    # a soft drop shadow
    sh = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    sh.putalpha(icon.split()[3].filter(ImageFilter.GaussianBlur(4)).point(lambda v: int(v * 0.5)))
    can.alpha_composite(sh, (3, 4))
    can.alpha_composite(icon)
    return can.crop(can.getbbox())


if __name__ == '__main__':
    out = sys.argv[1]
    for n in sys.argv[2:]:
        red = n.endswith('!')
        n = n.rstrip('!')
        paint(n, red).save(f'{out}/{n.replace("-", "_")}.webp', quality=88, method=6)
        print(n)
