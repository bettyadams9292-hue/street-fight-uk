"""Clothing, hair and eye textures for the MakeHuman characters at 512 px (they shipped at 1024).

A person is a couple of hundred pixels tall on a phone, so 1024 px maps were downloaded (about 5 MB of the
start-up) and held in graphics memory (about 5 MB each once used) for detail nobody sees. Skins stay at 1024:
the face is a small part of the skin's atlas. Run from the repo root: python3 tools/human/shrink_textures.py
(the originals are in git history if a higher-quality copy is ever wanted).
"""
import glob
import os
from PIL import Image

SIZE = 512
before = after = 0
for f in sorted(glob.glob('public/models/human/tex/*.webp')):
    if os.path.basename(f).startswith('skin_'):
        continue
    im = Image.open(f)
    before += os.path.getsize(f)
    if max(im.size) > SIZE:
        im = im.resize((SIZE, SIZE), Image.LANCZOS)
        # Normal maps a little higher: their errors show as bumps.
        im.save(f, 'WEBP', quality=92 if f.endswith('_n.webp') else 88, method=6)
    after += os.path.getsize(f)
print(f'clothing, hair and eye textures: {before / 1e6:.1f} MB -> {after / 1e6:.1f} MB')
