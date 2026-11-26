"""
Digits and "&" for the Hard Graft lettering kit (the owner's sheets have neither): drawn from Big Shoulders, roughened
to the brush, in the kit letters' own off-white, then set on the HG plate like any other button. Run it in the scratch
folder kit_from_titles.py made (it needs glyphs/, hgtype.py and kit_pick.py there):
    python3 /path/to/repo/tools/icons/hg/digits.py /path/to/repo "cash-4-u=CASH 4 U" "b-and-thc=B&THC"
kit_pick.py is one line, hgtype.PICK.update({...}) with kit_from_titles.py's PICK.
"""
import sys, os
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
sys.path.insert(0, '.')
import hgtype
REPO = sys.argv[1]
TITLES = os.path.join(REPO, 'public/art/titles')
exec(open('kit_pick.py').read()) if os.path.exists('kit_pick.py') else None
orig = hgtype.glyph
ref = np.array(orig('E')).astype(float)
solid = ref[..., 3] > 200
col = ref[solid][:, :3].mean(0)
def glyph(ch):
    if ch.isdigit() or ch == '+':
        draw = '&' if ch == '+' else ch
        H = hgtype.H
        f = ImageFont.truetype(f'{REPO}/public/fonts/BigShoulders.woff', int(H * 1.02))
        try: f.set_variation_by_axes([620])
        except Exception: pass
        im = Image.new('L', (H, H + 20), 0)
        d = ImageDraw.Draw(im)
        bb = d.textbbox((0, 0), draw, font=f)
        d.text((-bb[0] + 4, -bb[1] + 2), draw, font=f, fill=255)
        im = im.crop((0, 0, bb[2] - bb[0] + 8, H))
        # Rough brush edges: blur, threshold with noise.
        a = np.array(im.filter(ImageFilter.GaussianBlur(1.2))).astype(float)
        rng = np.random.default_rng(ord(ch))
        a = np.clip((a - 90 + rng.normal(0, 35, a.shape)) * 2.2, 0, 255)
        rgb = np.zeros(a.shape + (3,))
        rgb[:] = np.minimum(255, col * 1.18)
        rgb *= (0.85 + 0.15 * rng.random(a.shape))[..., None]
        out = np.dstack([rgb, a]).astype(np.uint8)
        return Image.fromarray(out, 'RGBA')
    return orig(ch)
hgtype.glyph = glyph
for arg in sys.argv[2:]:
    slug, text = arg.split('=', 1)
    im = hgtype.button(text.upper().replace('&', '+'), 'black')
    im = im.resize((round(im.width * 144 / im.height), 144), Image.LANCZOS)
    im.save(os.path.join(TITLES, slug + '.webp'), quality=90)
    print('wrote', slug)
