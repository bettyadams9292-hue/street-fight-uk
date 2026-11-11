#!/usr/bin/env python3
"""
Packs prop and item models for the game: shrinks every embedded texture to at
most 512 px JPEG (normal maps stay lossless-ish at quality 92) and rewrites the
GLB. Geometry and materials are untouched.

    python3 tools/props/pack.py <in.glb> <out.glb> [max_px]
"""
import io, json, struct, sys
from PIL import Image

src, dst = sys.argv[1], sys.argv[2]
MAX = int(sys.argv[3]) if len(sys.argv) > 3 else 512

data = open(src, 'rb').read()
assert data[:4] == b'glTF'
off = 12
chunks = []
while off < len(data):
    n, kind = struct.unpack_from('<II', data, off)
    chunks.append((kind, data[off + 8: off + 8 + n]))
    off += 8 + n
j = json.loads(chunks[0][1])
binc = chunks[1][1] if len(chunks) > 1 else b''

# Which images are normal maps (kept at higher quality).
normal_imgs = set()
for m in j.get('materials', []):
    t = m.get('normalTexture')
    if t:
        normal_imgs.add(j['textures'][t['index']]['source'])

views = j['bufferViews']
replaced = {}
for i, img in enumerate(j.get('images', [])):
    if 'bufferView' not in img:
        continue
    bv = views[img['bufferView']]
    raw = binc[bv.get('byteOffset', 0): bv.get('byteOffset', 0) + bv['byteLength']]
    im = Image.open(io.BytesIO(raw))
    im = im.convert('RGB')
    if max(im.size) > MAX:
        k = MAX / max(im.size)
        im = im.resize((max(1, round(im.size[0] * k)), max(1, round(im.size[1] * k))), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, 'JPEG', quality=92 if i in normal_imgs else 82, optimize=True)
    replaced[img['bufferView']] = buf.getvalue()
    img['mimeType'] = 'image/jpeg'

# Rebuild the binary chunk, 4-byte aligned, in bufferView order.
out = bytearray()
for vi, bv in enumerate(views):
    if bv.get('buffer', 0) != 0:
        continue
    piece = replaced.get(vi)
    if piece is None:
        piece = binc[bv.get('byteOffset', 0): bv.get('byteOffset', 0) + bv['byteLength']]
    while len(out) % 4:
        out.append(0)
    bv['byteOffset'] = len(out)
    bv['byteLength'] = len(piece)
    out.extend(piece)
while len(out) % 4:
    out.append(0)
j['buffers'][0]['byteLength'] = len(out)

js = json.dumps(j, separators=(',', ':')).encode()
while len(js) % 4:
    js += b' '
total = 12 + 8 + len(js) + 8 + len(out)
with open(dst, 'wb') as f:
    f.write(struct.pack('<III', 0x46546C67, 2, total))
    f.write(struct.pack('<II', len(js), 0x4E4F534A))
    f.write(js)
    f.write(struct.pack('<II', len(out), 0x004E4942))
    f.write(out)
print(f'{src} -> {dst}: {len(data)} -> {total} bytes')
