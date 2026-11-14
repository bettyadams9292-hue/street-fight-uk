"""Keys & Co board artwork and the window display's header (original work, painted with PIL)."""
from PIL import Image, ImageDraw, ImageFont
ROOT = '/home/claude/wt-property'
OUT = ROOT + '/public/art/agent'
NAVY, RED, WHITE, INK = '#16365a', '#b3121b', '#f2efe6', '#101014'


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


def keys_mark(d, x, y, s, fill):
    """A little key: a ring and a bit."""
    d.ellipse([x, y, x + s, y + s], outline=fill, width=max(2, s // 6))
    d.rectangle([x + s, y + s * 0.42, x + s * 2.4, y + s * 0.58], fill=fill)
    d.rectangle([x + s * 1.9, y + s * 0.5, x + s * 2.05, y + s * 0.85], fill=fill)
    d.rectangle([x + s * 2.2, y + s * 0.5, x + s * 2.35, y + s * 0.78], fill=fill)


def board(fname, big, bg, fg, band, small=None):
    W, H = 384, 256
    im = Image.new('RGB', (W, H), bg)
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, W, 46], fill=band)
    f = font('BigShoulders', 34)
    keys_mark(d, 18, 12, 22, WHITE)
    d.text((80, 4), 'KEYS & CO', font=f, fill=WHITE)
    fs = font('Overpass', 14, 'Bold')
    d.text((W - 118, 16), 'EST. 1987', font=fs, fill=WHITE)
    if small:
        centred(d, small, fit(small, 'BigShoulders', 44, W - 40), 62, W, fg)
        centred(d, big, fit(big, 'BigShoulders', 96, W - 30), 108, W, fg)
    else:
        centred(d, big, fit(big, 'BigShoulders', 128, W - 30), 70, W, fg)
    d.rectangle([0, H - 40, W, H], fill=band)
    centred(d, '0161 496 0273  ·  keysandco.example', font('Overpass', 17, 'Bold'), H - 30, W, WHITE)
    im.save(f'{OUT}/{fname}.webp', 'WEBP', quality=86)


board('board_for_sale', 'FOR SALE', NAVY, WHITE, RED)
board('board_to_let', 'TO LET', WHITE, NAVY, NAVY)
board('board_sold', 'SOLD', RED, WHITE, NAVY)
board('board_let_by', 'KEYS & CO', RED, WHITE, NAVY, small='LET BY')

# Window display header: 1024 x 160.
W, H = 1024, 160
im = Image.new('RGB', (W, H), NAVY)
d = ImageDraw.Draw(im)
d.rectangle([0, H - 14, W, H], fill=RED)
keys_mark(d, 40, 40, 56, WHITE)
d.text((200, 18), 'KEYS & CO', font=font('BigShoulders', 96), fill=WHITE)
d.text((640, 46), 'PROPERTY FOR SALE\nAND TO LET', font=font('Overpass', 30, 'Bold'), fill=WHITE, spacing=6)
im.save(f'{OUT}/window_header.webp', 'WEBP', quality=86)
print('ok')
