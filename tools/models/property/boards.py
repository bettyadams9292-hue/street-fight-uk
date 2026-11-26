"""Wrongmove board artwork and the window display's header (original work, painted with PIL).

Wrongmove's own look: charcoal and sign yellow, a roof with an arrow doubling back under it."""
from PIL import Image, ImageDraw, ImageFont
import os
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
OUT = ROOT + '/public/art/agent'
CHAR, YELLOW, WHITE, INK = '#24272c', '#f2c230', '#f4f1e8', '#101014'


def font(name, size, weight='Black'):
    f = ImageFont.truetype(f'{ROOT}/public/fonts/{name}.woff', size)
    try:
        f.set_variation_by_name(weight)
    except Exception:
        try:
            f.set_variation_by_axes([900])
        except Exception:
            pass
    return f


def centred(d, text, f, y, w, fill):
    bb = d.textbbox((0, 0), text, font=f)
    d.text(((w - (bb[2] - bb[0])) / 2 - bb[0], y - bb[1]), text, font=f, fill=fill)


def fit(text, name, size, maxw, weight='Black'):
    while size > 10:
        f = font(name, size, weight)
        bb = f.getbbox(text)
        if bb[2] - bb[0] <= maxw:
            return f
        size -= 2
    return font(name, size, weight)


def mark(d, x, y, s, fill):
    """Wrongmove's mark: a roof, and under it an arrow that turns back on itself."""
    w = max(2, s // 7)
    d.line([(x, y + s * 0.5), (x + s * 0.6, y), (x + s * 1.2, y + s * 0.5)], fill=fill, width=w, joint='curve')
    d.arc([x + s * 0.25, y + s * 0.45, x + s * 0.95, y + s * 1.1], 0, 180, fill=fill, width=w)
    d.line([(x + s * 0.95, y + s * 0.78), (x + s * 0.95, y + s * 0.5)], fill=fill, width=w)
    d.polygon([(x + s * 0.25 - w, y + s * 0.78), (x + s * 0.25 + w * 1.5, y + s * 0.78), (x + s * 0.25 + w * 0.25, y + s * 0.55)], fill=fill)


def board(fname, big, bg, fg, band, bandfg, small=None):
    W, H = 384, 256
    im = Image.new('RGB', (W, H), bg)
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, W, 50], fill=band)
    mark(d, 16, 10, 30, bandfg)
    d.text((62, 4), 'wrongmove', font=font('Overpass', 34, 'Black'), fill=bandfg)
    if small:
        centred(d, small, fit(small, 'BigShoulders', 44, W - 40), 66, W, fg)
        centred(d, big, fit(big, 'BigShoulders', 96, W - 30), 112, W, fg)
    else:
        centred(d, big, fit(big, 'BigShoulders', 128, W - 30), 74, W, fg)
    d.rectangle([0, H - 40, W, H], fill=band)
    centred(d, '0161 496 0273  ·  wrongmove.example', font('Overpass', 17, 'Bold'), H - 30, W, bandfg)
    im.save(f'{OUT}/{fname}.webp', 'WEBP', quality=86)


board('board_for_sale', 'FOR SALE', YELLOW, CHAR, CHAR, YELLOW)
board('board_to_let', 'TO LET', WHITE, CHAR, CHAR, YELLOW)
board('board_sold', 'SOLD', CHAR, YELLOW, YELLOW, CHAR)
board('board_let_by', 'WRONGMOVE', CHAR, WHITE, YELLOW, CHAR, small='LET BY')

# Window display header: 1024 x 160.
W, H = 1024, 160
im = Image.new('RGB', (W, H), CHAR)
d = ImageDraw.Draw(im)
d.rectangle([0, H - 14, W, H], fill=YELLOW)
mark(d, 40, 34, 80, YELLOW)
d.text((160, 22), 'wrongmove', font=font('Overpass', 92, 'Black'), fill=WHITE)
d.text((700, 46), 'PROPERTY FOR SALE\nAND TO LET', font=font('Overpass', 28, 'Bold'), fill=YELLOW, spacing=6)
im.save(f'{OUT}/window_header.webp', 'WEBP', quality=86)
print('ok')
