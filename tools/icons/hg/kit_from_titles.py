"""
Rebuild the Hard Graft lettering kit (glyphs/) from the painted buttons already in public/art/titles, for when the
owner's cut-out sheets (cut1/, cut3/) aren't to hand, then set new buttons in it. Used for police step 2's buttons.

    cd /tmp/hgkit   # any scratch folder
    python3 /path/to/repo/tools/icons/hg/kit_from_titles.py /path/to/repo "offer-a-bung=OFFER A BUNG" "leave=LEAVE"

Each slug is written to public/art/titles/<slug>.webp at the set's height (144 px); add it to TITLE_SLUGS in
src/ui/titles.ts. Look at the result: the letters are cut automatically, and PICK below says which cut of each
letter reads best (checked by eye on 21 Nov 2026). B, F, J, K, Q, Z and ! are put together by hgtype.py.
"""
import os
import shutil
import subprocess
import sys

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

REPO = sys.argv[1]
HERE = os.path.dirname(os.path.abspath(__file__))
TITLES = os.path.join(REPO, 'public/art/titles')
# The buttons glyphs.py cuts letters from, standing in for the sheets' own copies.
SOURCES = {
    'cut3/002.png': 'continue', 'cut3/003.png': 'new-game', 'cut3/005.png': 'character', 'cut3/006.png': 'settings',
    'cut1/011.png': 'inventory', 'cut1/012.png': 'map', 'cut1/014.png': 'exit',
    'cut1/lo.png': 'low', 'cut1/ni.png': 'nicked', 'cut1/di.png': 'display',
}
PICK = {'A': 1, 'C': 0, 'D': 9, 'E': 1, 'G': 1, 'H': 0, 'I': 2, 'L': 1, 'M': 0, 'N': 0, 'O': 0, 'P': 0, 'R': 0, 'S': 1,
        'T': 0, 'U': 0, 'V': 9, 'W': 1, 'X': 0, 'Y': 1}

os.makedirs('cut1', exist_ok=True)
os.makedirs('cut3', exist_ok=True)
for to, slug in SOURCES.items():
    Image.open(os.path.join(TITLES, slug + '.webp')).convert('RGBA').save(to)
for f in ('glyphs.py', 'hgtype.py'):
    shutil.copy(os.path.join(HERE, f), f)
# glyphs.py's word list: no LOAD GAME button any more; LOW, NICKED and DISPLAY give the L and the D.
src = open('glyphs.py').read().replace("'LOADGAME': 'cut1/009.png', ", '').replace(
    "'EXIT': 'cut1/014.png'}", "'EXIT': 'cut1/014.png', 'LOW': 'cut1/lo.png', 'NICKED': 'cut1/ni.png', 'DISPLAY': 'cut1/di.png'}")
open('glyphs.py', 'w').write(src)
shutil.rmtree('glyphs', ignore_errors=True)
subprocess.run([sys.executable, 'glyphs.py'], check=True)

# V: the cut runs V, E and W together; keep the V. D: drop the specks off its left edge.
v = Image.open('glyphs/V_0.png').convert('RGBA')
v.crop((0, 0, int(v.width * 0.36), v.height)).save('glyphs/V_9.png')
A = np.array(Image.open('glyphs/D_1.png').convert('RGBA'))
m = A[..., 3] > 60
lab, n = ndi.label(m)
big = int(np.argmax(ndi.sum(m, lab, range(1, n + 1)))) + 1
A[..., 3] = np.where(ndi.binary_dilation(lab == big, iterations=2), A[..., 3], 0)
h, w = A.shape[:2]
A[int(h * 0.35):, :int(w * 0.2), 3] = 0
d = Image.fromarray(A)
d.crop(d.getbbox()).save('glyphs/D_9.png')

sys.path.insert(0, '.')
import hgtype  # noqa: E402

hgtype.PICK.update(PICK)
for arg in sys.argv[2:]:
    slug, text = arg.split('=', 1)
    im = hgtype.button(text.upper(), 'black')
    im = im.resize((round(im.width * 144 / im.height), 144), Image.LANCZOS)
    im.save(os.path.join(TITLES, slug + '.webp'), quality=90)
    print('wrote', slug)
