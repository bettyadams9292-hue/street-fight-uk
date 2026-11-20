"""Cut the white brush letters out of the Hard Graft buttons into a glyph kit (glyphs/<LETTER>_<n>.png, 100 px tall)."""
import os
from PIL import Image
import numpy as np
from scipy import ndimage as ndi

os.makedirs('glyphs', exist_ok=True)
SRC = {'CONTINUE': 'cut3/002.png', 'NEWGAME': 'cut3/003.png', 'CHARACTER': 'cut3/005.png', 'SETTINGS': 'cut3/006.png',
       'LOADGAME': 'cut1/009.png', 'INVENTORY': 'cut1/011.png', 'MAP': 'cut1/012.png', 'EXIT': 'cut1/014.png'}


def letters_mask(A):
    r, g, b, a = [A[..., i].astype(int) for i in range(4)]
    return (np.minimum(np.minimum(r, g), b) > 140) & (np.abs(r - b) < 50) & (a > 200)


SHEAR = 0.24
out = {}
for word, f in SRC.items():
    im = Image.open(f).convert('RGBA')
    # Undo the italic so letters stand apart on vertical cuts (put back when words are set).
    k = SHEAR
    pad = int(im.height * k) + 4
    im = im.transform((im.width + pad, im.height), Image.AFFINE, (1, -k, 0, 0, 1, 0), Image.BICUBIC)
    A = np.array(im)
    m = ndi.binary_opening(letters_mask(A), iterations=1)
    lab, n = ndi.label(ndi.binary_closing(m, iterations=1))
    comps = []
    for i, s in enumerate(ndi.find_objects(lab), 1):
        if (lab[s] == i).sum() < 60:
            continue
        comps.append([s[1].start, s[1].stop])
    comps.sort()
    mg = []
    for c in comps:
        if mg and c[0] < mg[-1][1] - 6:
            mg[-1][1] = max(mg[-1][1], c[1])
        else:
            mg.append(c)
    proj = m.sum(0)
    while len(mg) < len(word):
        w = [c[1] - c[0] for c in mg]
        j = int(np.argmax(w))
        x0, x1 = mg[j]
        a0 = x0 + int((x1 - x0) * 0.25)
        inner = proj[a0:x0 + int((x1 - x0) * 0.75)]
        cut = a0 + int(np.argmin(inner))
        mg[j:j + 1] = [[x0, cut], [cut, x1]]
    while len(mg) > len(word):
        gaps = [mg[i + 1][0] - mg[i][1] for i in range(len(mg) - 1)]
        j = int(np.argmin(gaps))
        mg[j:j + 2] = [[mg[j][0], mg[j + 1][1]]]
    ys = np.where(m.any(1))[0]
    y0, y1 = ys[0], ys[-1] + 1
    for ch, (x0, x1) in zip(word, mg):
        xa = max(0, x0 - 2)
        sub = A[y0:y1, xa:x1 + 2].copy()
        mm = ndi.binary_dilation(m[y0:y1, xa:x1 + 2], iterations=2)
        sub[..., 3] = np.where(mm, sub[..., 3], 0)
        g = Image.fromarray(sub)
        bb = g.getbbox()
        if not bb:
            continue
        g = g.crop(bb)
        scale = 100 / (y1 - y0)
        g = g.resize((max(1, round(g.width * scale)), max(1, round(g.height * scale))), Image.LANCZOS)
        out.setdefault(ch, []).append((g, f.startswith('cut3')))

for ch, gs in out.items():
    gs.sort(key=lambda t: (not t[1], -t[0].height))
    for k, (g, _) in enumerate(gs):
        g.save(f'glyphs/{ch}_{k}.png')
print(sorted(out), len(out))
