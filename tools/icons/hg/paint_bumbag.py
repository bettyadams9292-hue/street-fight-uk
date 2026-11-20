"""
Paints the bum bag icon in the Hard Graft style of the owner's bag icons (backpack, holdall): black quilted leather
with a faint diamond pattern, a red stripe and red wear, black ink outlines, a silver zip and buckle, the white
sticker border and a red splash behind. The owner's sheets have backpacks and a holdall but no bum bag.

    python3 tools/icons/hg/paint_bumbag.py        (writes public/icons/hg/bumbag.webp)
"""
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage as ndi

ROOT = '/home/claude/street-fight-uk'
S = 232
K = 4  # draw shapes at 4x, then shrink, for clean edges
rng = np.random.default_rng(11)


def mask(draw_fn):
    im = Image.new('L', (S * K, S * K), 0)
    draw_fn(ImageDraw.Draw(im), K)
    return np.array(im.resize((S, S), Image.LANCZOS)) > 127


def pouch(d, k):
    # A wide crescent: flat-ish top, deep rounded belly.
    d.chord([26 * k, 40 * k, 206 * k, 196 * k], 0, 180, fill=255)
    d.rounded_rectangle([30 * k, 70 * k, 202 * k, 122 * k], radius=26 * k, fill=255)


def strap(d, k):
    # The waist belt behind the pouch, curving off both sides.
    d.line([(4 * k, 98 * k), (40 * k, 90 * k), (116 * k, 86 * k), (192 * k, 90 * k), (228 * k, 98 * k)], fill=255, width=17 * k, joint='curve')


def front_pocket(d, k):
    d.chord([62 * k, 84 * k, 170 * k, 182 * k], 0, 180, fill=255)
    d.rectangle([62 * k, 126 * k, 170 * k, 134 * k], fill=255)


def zip_line(d, k):
    d.arc([40 * k, 84 * k, 192 * k, 190 * k], 198, 342, fill=255, width=5 * k)


def pocket_zip(d, k):
    d.line([(66 * k, 131 * k), (166 * k, 131 * k)], fill=255, width=4 * k)


def stripe(d, k):
    d.polygon([(104 * k, 70 * k), (128 * k, 70 * k), (130 * k, 126 * k), (102 * k, 126 * k)], fill=255)


def buckle(d, k):
    d.rounded_rectangle([200 * k, 80 * k, 226 * k, 108 * k], radius=4 * k, fill=255)


def buckle_hole(d, k):
    d.rectangle([207 * k, 87 * k, 219 * k, 101 * k], fill=255)


def pull(d, k):
    d.rounded_rectangle([156 * k, 82 * k, 166 * k, 104 * k], radius=3 * k, fill=255)
    d.rounded_rectangle([140 * k, 132 * k, 150 * k, 152 * k], radius=3 * k, fill=255)


body_m = mask(pouch)
strap_m = mask(strap) & ~body_m
pocket_m = mask(front_pocket) & body_m
zip_m = mask(zip_line) & body_m
pzip_m = mask(pocket_zip) & pocket_m
stripe_m = mask(stripe) & body_m & ~pocket_m
buckle_m = mask(buckle) & ~mask(buckle_hole)
pull_m = mask(pull)
shape = body_m | strap_m | buckle_m | pull_m

yy, xx = np.mgrid[0:S, 0:S] / S

# Quilted black leather: brushed grain plus a faint diamond pattern, lighter top-left.
grain = ndi.gaussian_filter(rng.normal(0, 1, (S, S)), (0.7, 3)) + ndi.gaussian_filter(rng.normal(0, 1, (S, S)), 1.5) * 0.5
grain = (grain - grain.min()) / np.ptp(grain)
diamond = ((np.abs(((xx * S + yy * S) % 14) - 7) < 0.8) | (np.abs(((xx * S - yy * S) % 14) - 7) < 0.8)) & (ndi.gaussian_filter(rng.random((S, S)), 3) > 0.47)
shade = 1.0 - 0.45 * (yy * 0.7 + xx * 0.3)
grime = ndi.gaussian_filter(rng.random((S, S)), 4)
lum = (22 + 34 * shade + (grain - 0.5) * 40 + diamond * 26 + (grime - 0.5) * 60)[..., None]
rgb = np.repeat(lum, 3, axis=2) * np.array([1.0, 0.98, 0.98])

# Belly highlight and shadow: the pouch is round.
belly = np.exp(-(((xx - 0.4) / 0.2) ** 2 + ((yy - 0.42) / 0.1) ** 2))
rgb[body_m] += (belly[body_m] * 48)[:, None]
under = np.clip((yy - 0.62) / 0.22, 0, 1)
rgb[body_m] *= (1 - under[body_m] * 0.45)[:, None]

# Front pocket a touch darker; strap darker still, with a stitch line.
rgb[pocket_m] *= 0.86
rgb[strap_m] = rgb[strap_m] * 0.7
stitch = strap_m & ((xx * S).astype(int) % 7 < 3) & (np.abs(ndi.distance_transform_edt(strap_m) - 4.5) < 0.8)
rgb[stitch] = [150, 150, 152]

# Red stripe down the middle with brushed texture, like the backpacks.
red = np.array([206, 26, 30]) * (0.75 + 0.35 * grain[..., None]) * (shade[..., None] * 0.6 + 0.5)
rgb[stripe_m] = red[stripe_m]
# Red wear along the bottom edge.
edge = body_m & ~ndi.binary_erosion(body_m, iterations=8)
wear = edge & (yy > 0.6) & (ndi.gaussian_filter(rng.random((S, S)), 2) > 0.49)
rgb[wear] = rgb[wear] * 0.4 + np.array([205, 22, 26]) * 0.6

# Red brush streaks across the lower right, like the backpacks' paint.
streak = np.zeros((S, S), bool)
im = Image.new('L', (S * K, S * K), 0)
dd = ImageDraw.Draw(im)
for i in range(5):
    x0 = 120 + i * 14 + rng.integers(-4, 4)
    dd.line([(x0 * K, 188 * K), ((x0 + 50) * K, 120 * K)], fill=255, width=int(rng.integers(3, 7)) * K)
streak = (np.array(im.resize((S, S), Image.LANCZOS)) > 110) & body_m & (ndi.gaussian_filter(rng.random((S, S)), 1.5) > 0.42)
rgb[streak] = rgb[streak] * 0.3 + np.array([200, 24, 28]) * 0.7

# Silver zip, pull and buckle.
metal = (190 + (grain - 0.5) * 60 - yy * 60)[..., None] * np.array([1, 1, 1.02])
for m in (zip_m, pzip_m, pull_m, buckle_m):
    rgb[m] = metal[m]

img = np.zeros((S, S, 4), np.uint8)
img[..., :3] = np.clip(rgb, 0, 255).astype(np.uint8)
img[..., 3] = shape * 255

# Ink: round every part and along the seams, like the painted sheets.
ink = np.zeros((S, S), bool)
for m in (body_m, pocket_m, stripe_m, buckle_m, pull_m, strap_m):
    ink |= m & ~ndi.binary_erosion(m, iterations=2)
ink |= ndi.binary_dilation(zip_m, iterations=1) & ~zip_m & body_m
img[ink, :3] = (14, 12, 12)
outer = ndi.binary_dilation(shape, iterations=3) & ~shape
img[outer, :3] = (10, 10, 10)
img[outer, 3] = 255
full = shape | outer
sticker = ndi.binary_dilation(full, iterations=5) & ~full
w = (226 + rng.normal(0, 14, (S, S))).clip(170, 255)
# The bag icons on the sheets have no white sticker: just the ink edge, a little rough.
rough = sticker & ~ndi.binary_dilation(full, iterations=2) | (sticker & (rng.random((S, S)) > 0.55))
img[sticker & ~rough, :3] = (8, 8, 8)
img[sticker & ~rough, 3] = 255
icon = Image.fromarray(img)

can = Image.new('RGBA', (S, S), (0, 0, 0, 0))
sp = Image.open(f'{ROOT}/public/icons/hg/splat.webp').convert('RGBA')
sp.thumbnail((int(S * 0.5), int(S * 0.5)))
a = np.array(sp)
a[..., 3] = (a[..., 3] * 0.85).astype(np.uint8)
can.alpha_composite(Image.fromarray(a), (int(S * 0.06), int(S * 0.42)))
sh = Image.new('RGBA', (S, S), (0, 0, 0, 0))
sh.putalpha(icon.split()[3].filter(ImageFilter.GaussianBlur(4)).point(lambda v: int(v * 0.5)))
can.alpha_composite(sh, (3, 4))
can.alpha_composite(icon)
out = can.crop(can.getbbox())
out.save(f'{ROOT}/public/icons/hg/bumbag.webp', quality=88, method=6)
print('bumbag', out.size)
