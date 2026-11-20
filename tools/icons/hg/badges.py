"""
Square, centred versions of the need icons for the round need badges (public/icons/hg/badge/): the painted
icons carry a red splash off to one side, which pulls the picture off the middle of a ring. This drops the
splash (strongly red, unshaded pixels away from the object) and centres what's left on its own centre of mass.

    python3 tools/icons/hg/badges.py
"""
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

ROOT = '/home/claude/street-fight-uk/public/icons/hg'
NAMES = ['food', 'sleep', 'shower', 'tooth', 'toilet', 'info']
S = 128

for n in NAMES:
    a = np.array(Image.open(f'{ROOT}/{n}.webp').convert('RGBA')).astype(float)
    r, g, b, al = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
    solid = al > 40
    splash = solid & (r > 120) & (g < 70) & (b < 70)
    keep = solid & ~splash
    # The object is the biggest connected part; anything small left over (spatter) goes.
    lab, k = ndi.label(ndi.binary_dilation(keep, iterations=2))
    if k > 1:
        sizes = ndi.sum(keep, lab, range(1, k + 1))
        main = lab == (1 + int(np.argmax(sizes)))
        keep &= main
    # Red that's part of the object (shading inside it) stays: anything red inside its filled outline.
    inside = ndi.binary_fill_holes(ndi.binary_closing(keep, iterations=3))
    keep |= splash & inside
    out = a.copy()
    out[..., 3] = np.where(keep, al, 0)
    ys, xs = np.nonzero(keep)
    w = al[keep]
    cy, cx = (ys * w).sum() / w.sum(), (xs * w).sum() / w.sum()
    half = max(cy - ys.min(), ys.max() - cy, cx - xs.min(), xs.max() - cx) + 2
    img = Image.fromarray(out.astype(np.uint8))
    box = (int(round(cx - half)), int(round(cy - half)), int(round(cx + half)), int(round(cy + half)))
    can = Image.new('RGBA', (box[2] - box[0], box[3] - box[1]), (0, 0, 0, 0))
    can.alpha_composite(img, (-box[0], -box[1])) if box[0] <= 0 and box[1] <= 0 else can.paste(img.crop(box), (0, 0))
    can.resize((S, S), Image.LANCZOS).save(f'{ROOT}/badge/{n}.webp', quality=90, method=6)
    print(n)
