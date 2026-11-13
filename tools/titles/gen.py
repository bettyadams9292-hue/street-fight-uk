"""
Makes painted button/heading graphics in the style of public/art/titles: chunky white italic
capitals with a black outline over red and blue brush strokes.

    python3 tools/titles/gen.py public/art/titles "save=Save" "walk-home=Walk home"

Then add each new slug to TITLE_SLUGS in src/ui/titles.ts (tests/titles.test.ts checks the list
matches the folder). The originals were painted by the owner; this only fills gaps in the set.
Needs Pillow, numpy and the Inter Display Black Italic font (fc-list).
"""
import sys, random, math
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops
import numpy as np
FONT = '/usr/share/fonts/truetype/inter/InterDisplay-BlackItalic.ttf'
def find_font():
    import subprocess
    out = subprocess.run(['fc-list', ':family=Inter Display:style=Black Italic', 'file'], capture_output=True, text=True).stdout.strip().split('\n')
    return out[0].split(':')[0]
FONT = find_font()

def brush(draw, x0, x1, yc, th, colour, rnd):
    # a jagged dry-brush streak: a ragged band with splintered ends
    pts_top, pts_bot = [], []
    n = 28
    for i in range(n + 1):
        t = i / n
        x = x0 + (x1 - x0) * t
        taper = min(1, t * 5, (1 - t) * 4)
        w = th * (0.35 + 0.65 * taper) * (0.8 + rnd.random() * 0.4)
        y = yc + math.sin(t * 3 + rnd.random()) * th * 0.15
        pts_top.append((x, y - w / 2 + rnd.uniform(-2, 2)))
        pts_bot.append((x, y + w / 2 + rnd.uniform(-2, 2)))
    draw.polygon(pts_top + pts_bot[::-1], fill=colour)
    # splinters off the ends
    for _ in range(10):
        sx = rnd.choice([x0 + rnd.uniform(-10, 30), x1 + rnd.uniform(-30, 10)])
        sy = yc + rnd.uniform(-th * 0.6, th * 0.6)
        ln = rnd.uniform(15, 50) * (1 if sx > (x0 + x1) / 2 else -1)
        draw.polygon([(sx, sy), (sx + ln, sy + rnd.uniform(-3, 3)), (sx + ln * 0.2, sy + rnd.uniform(2, 5))], fill=colour)

def render(text, seed, cap=1.0):
    S = 4  # supersample
    rnd = random.Random(seed)
    words = text.upper()
    big = ImageFont.truetype(FONT, int(64 * S * cap))
    small = ImageFont.truetype(FONT, int(50 * S * cap))
    # first letter of each word bigger, like the painted set
    pieces = []
    for wi, word in enumerate(words.split(' ')):
        for ci, ch in enumerate(word):
            pieces.append((ch, big if ci == 0 else small))
        pieces.append((' ', small))
    pieces = pieces[:-1]
    track = -2 * S
    widths = [f.getlength(c) + (track if c != ' ' else 4 * S) for c, f in pieces]
    tw = int(sum(widths)) + 40 * S
    H = int(110 * S * cap)
    W = tw + 120 * S
    base = int(H * 0.72)
    # text mask
    mask = Image.new('L', (W, H), 0)
    d = ImageDraw.Draw(mask)
    x = 60 * S
    for (c, f), w in zip(pieces, widths):
        d.text((x, base), c, font=f, fill=255, anchor='ls')
        x += w
    # a slight extra lean
    mask = mask.transform(mask.size, Image.AFFINE, (1 / 0.8, 0.16, -0.16 * base - 60 * S * 0.25, 0, 1, 0), resample=Image.BICUBIC)
    bbox = mask.getbbox()
    # brush streaks behind
    back = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    bd = ImageDraw.Draw(back)
    x0, y0, x1, y1 = bbox
    mid = (y0 + y1) / 2
    hgt = y1 - y0
    def dry(xa, xb, yc, th, col, n):
        for _ in range(n):
            yy0 = yc + rnd.uniform(-th / 2, th / 2)
            xs = xa + rnd.uniform(-10, 20) * S
            xe = xb + rnd.uniform(-30, 12) * S
            w = rnd.uniform(1.5, 5) * S
            bd.polygon([(xs, yy0), (xe, yy0 + rnd.uniform(-2, 2) * S), (xe - 6 * S, yy0 + w), (xs + 8 * S, yy0 + w)], fill=col)
    BLUE, RED, INK = (31, 79, 209, 255), (214, 34, 44, 255), (10, 10, 14, 255)
    brush(bd, x0 - 12 * S, x1 + 12 * S, mid, hgt * 0.9, BLUE, rnd)
    dry(x0 - 18 * S, x1 + 18 * S, mid, hgt * 0.95, BLUE, 26)
    brush(bd, x0 + (x1 - x0) * 0.45, x1 + 30 * S, mid + hgt * 0.34, hgt * 0.34, RED, rnd)
    dry(x0 + (x1 - x0) * 0.4, x1 + 38 * S, mid + hgt * 0.34, hgt * 0.4, RED, 14)
    brush(bd, x0 - 22 * S, x0 + (x1 - x0) * 0.4, mid - hgt * 0.05, hgt * 0.3, RED, rnd)
    dry(x0 - 26 * S, x0 + (x1 - x0) * 0.45, mid - hgt * 0.05, hgt * 0.36, RED, 10)
    brush(bd, x0 - 8 * S, x1 + 6 * S, mid + hgt * 0.04, hgt * 0.7, INK, rnd)
    # black outline and drop shadow
    outline = mask.filter(ImageFilter.MaxFilter(1 + 2 * int(4.5 * S) if int(4.5*S)%2==0 else 2*int(4.5*S)+1))
    shadow = ImageChops.offset(outline, 3 * S, 4 * S).filter(ImageFilter.GaussianBlur(2 * S))
    img = back.copy()
    img.alpha_composite(Image.merge('RGBA', [Image.new('L', (W, H), 0)] * 3 + [shadow.point(lambda v: v * 0.7)]))
    img.alpha_composite(Image.merge('RGBA', [Image.new('L', (W, H), 8)] * 3 + [outline]))
    # white-to-grey fill with scuffs
    yy = np.linspace(0, 1, H)[:, None] * np.ones((1, W))
    rel = np.clip((yy * H - y0) / max(1, hgt), 0, 1)
    g = 252 - rel * 70
    noise = np.array(Image.effect_noise((W // (3*S) + 1, H // (3*S) + 1), 60).resize((W, H), Image.BILINEAR)).astype(float) - 128
    g = np.clip(g + noise * 0.22, 140, 255)
    # dark scratch marks
    scr = Image.new('L', (W, H), 0)
    sd = ImageDraw.Draw(scr)
    for _ in range(int(len(words) * 3)):
        sx = rnd.uniform(x0, x1); sy = rnd.uniform(y0, y1)
        sd.line([(sx, sy), (sx + rnd.uniform(8, 30) * S, sy + rnd.uniform(-4, 4) * S)], fill=255, width=int(S * rnd.uniform(1, 2.5)))
    g = g - np.array(scr).astype(float) * 0.45
    fill = Image.fromarray(np.clip(g, 0, 255).astype(np.uint8))
    fill_rgb = Image.merge('RGBA', [fill, fill, Image.fromarray(np.clip(g + 4, 0, 255).astype(np.uint8)), mask])
    img.alpha_composite(fill_rgb)
    img = img.crop(img.getbbox())
    img = img.resize((img.width // S, img.height // S), Image.LANCZOS)
    return img

if __name__ == '__main__':
    out = sys.argv[1]
    for arg in sys.argv[2:]:
        slug, text = arg.split('=', 1)
        im = render(text, hash(slug) & 0xffff)
        im.save(f'{out}/{slug}.webp', quality=90, method=6)
        print(slug, im.size)
