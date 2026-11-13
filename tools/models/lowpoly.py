"""
A tiny low-poly modeller: bevelled boxes, cylinders, cones, rings and spheres,
flat-shaded with a colour per part, written out as .glb. Used to model the
pieces no CC0 kit has (gym equipment) in the same look as the city kit:
faceted, vertex-coloured, a few hundred triangles each.

Parts go into four materials: 'solid' (matte), 'metal' (shiny), 'glow'
(emissive screens and lights) and 'glass' (see-through). Units are metres; y is up; the front faces +z.
"""
import json, math, struct
import numpy as np


def _hex(c):
    """'#rrggbb' as seen on screen (sRGB) -> the linear values glTF vertex colours hold."""
    c = c.lstrip('#')
    v = [int(c[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in v]


def rot_x(a):
    c, s = math.cos(a), math.sin(a)
    return np.array([[1, 0, 0], [0, c, -s], [0, s, c]])


def rot_y(a):
    c, s = math.cos(a), math.sin(a)
    return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])


def rot_z(a):
    c, s = math.cos(a), math.sin(a)
    return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]])


class Model:
    MATS = ('solid', 'metal', 'glow', 'glass')

    def __init__(self):
        self.tris = {m: [] for m in self.MATS}  # (3x3 positions, rgb)

    # ---- low level ----
    def tri(self, a, b, c, colour, mat='solid'):
        self.tris[mat].append((np.array([a, b, c], float), _hex(colour) if isinstance(colour, str) else colour))

    def quad(self, a, b, c, d, colour, mat='solid'):
        self.tri(a, b, c, colour, mat)
        self.tri(a, c, d, colour, mat)

    def _place(self, pts, at, R):
        return [np.asarray(at, float) + (R @ np.asarray(p, float)) for p in pts]

    # ---- shapes ----
    def box(self, size, at, colour, mat='solid', bevel=0.0, R=None):
        """A box size=(w,h,d) centred at `at`, with its edges chamfered by `bevel`."""
        R = np.eye(3) if R is None else R
        w, h, d = (s / 2 for s in size)
        b = min(bevel, w * 0.45, h * 0.45, d * 0.45)
        if b <= 0:
            v = [(-w, -h, -d), (w, -h, -d), (w, h, -d), (-w, h, -d), (-w, -h, d), (w, -h, d), (w, h, d), (-w, h, d)]
            v = self._place(v, at, R)
            for f in ((4, 5, 6, 7), (1, 0, 3, 2), (5, 1, 2, 6), (0, 4, 7, 3), (7, 6, 2, 3), (0, 1, 5, 4)):
                self.quad(*(v[i] for i in f), colour, mat)
            return
        # Chamfered: each face inset by b, edges and corners filled.
        def P(x, y, z):
            return self._place([(x, y, z)], at, R)[0]
        sx, sy, sz = w, h, d
        faces = {
            '+x': [P(sx, -sy + b, sz - b), P(sx, -sy + b, -sz + b), P(sx, sy - b, -sz + b), P(sx, sy - b, sz - b)],
            '-x': [P(-sx, -sy + b, -sz + b), P(-sx, -sy + b, sz - b), P(-sx, sy - b, sz - b), P(-sx, sy - b, -sz + b)],
            '+y': [P(-sx + b, sy, sz - b), P(sx - b, sy, sz - b), P(sx - b, sy, -sz + b), P(-sx + b, sy, -sz + b)],
            '-y': [P(-sx + b, -sy, -sz + b), P(sx - b, -sy, -sz + b), P(sx - b, -sy, sz - b), P(-sx + b, -sy, sz - b)],
            '+z': [P(-sx + b, -sy + b, sz), P(sx - b, -sy + b, sz), P(sx - b, sy - b, sz), P(-sx + b, sy - b, sz)],
            '-z': [P(sx - b, -sy + b, -sz), P(-sx + b, -sy + b, -sz), P(-sx + b, sy - b, -sz), P(sx - b, sy - b, -sz)],
        }
        for f in faces.values():
            self.quad(*f, colour, mat)
        # Edge strips and corner triangles, built from the corner points of the face rectangles.
        def corner(ix, iy, iz):
            return [P(ix * sx, iy * (sy - b), iz * (sz - b)), P(ix * (sx - b), iy * sy, iz * (sz - b)), P(ix * (sx - b), iy * (sy - b), iz * sz)]
        shade = colour
        for ix in (-1, 1):
            for iy in (-1, 1):
                for iz in (-1, 1):
                    a, bb, c = corner(ix, iy, iz)
                    if ix * iy * iz > 0:
                        self.tri(a, bb, c, shade, mat)
                    else:
                        self.tri(a, c, bb, shade, mat)
        # 12 edges.
        for iy in (-1, 1):
            for iz in (-1, 1):  # along x
                p = [P(-sx + b, iy * sy, iz * (sz - b)), P(sx - b, iy * sy, iz * (sz - b)), P(sx - b, iy * (sy - b), iz * sz), P(-sx + b, iy * (sy - b), iz * sz)]
                self._edge(p, iy * iz > 0, shade, mat)
        for ix in (-1, 1):
            for iz in (-1, 1):  # along y
                p = [P(ix * sx, -sy + b, iz * (sz - b)), P(ix * sx, sy - b, iz * (sz - b)), P(ix * (sx - b), sy - b, iz * sz), P(ix * (sx - b), -sy + b, iz * sz)]
                self._edge(p, ix * iz < 0, shade, mat)
        for ix in (-1, 1):
            for iy in (-1, 1):  # along z
                p = [P(ix * sx, iy * (sy - b), -sz + b), P(ix * sx, iy * (sy - b), sz - b), P(ix * (sx - b), iy * sy, sz - b), P(ix * (sx - b), iy * sy, -sz + b)]
                self._edge(p, ix * iy > 0, shade, mat)

    def _edge(self, p, flip, colour, mat):
        if flip:
            self.quad(p[0], p[1], p[2], p[3], colour, mat)
        else:
            self.quad(p[3], p[2], p[1], p[0], colour, mat)

    def cyl(self, r, h, at, colour, mat='solid', sides=12, axis='y', r2=None, caps=True, R=None):
        """Cylinder (or cone with r2) of height h centred at `at`, along an axis."""
        r2 = r if r2 is None else r2
        A = {'y': np.eye(3), 'x': rot_z(-math.pi / 2), 'z': rot_x(math.pi / 2)}[axis]
        if R is not None:
            A = R @ A
        bot = [(r * math.cos(2 * math.pi * i / sides), -h / 2, r * math.sin(2 * math.pi * i / sides)) for i in range(sides)]
        top = [(r2 * math.cos(2 * math.pi * i / sides), h / 2, r2 * math.sin(2 * math.pi * i / sides)) for i in range(sides)]
        B = self._place(bot, at, A)
        T = self._place(top, at, A)
        for i in range(sides):
            j = (i + 1) % sides
            self.quad(B[j], B[i], T[i], T[j], colour, mat)
        if caps:
            cb = self._place([(0, -h / 2, 0)], at, A)[0]
            ct = self._place([(0, h / 2, 0)], at, A)[0]
            for i in range(sides):
                j = (i + 1) % sides
                self.tri(cb, B[i], B[j], colour, mat)
                if r2 > 0:
                    self.tri(ct, T[j], T[i], colour, mat)

    def ring(self, R_, r, at, colour, mat='solid', sides=14, tube=6, axis='y', R=None):
        """A torus (tyre, rope coil, chain link) lying flat, around an axis."""
        A = {'y': np.eye(3), 'x': rot_z(-math.pi / 2), 'z': rot_x(math.pi / 2)}[axis]
        if R is not None:
            A = R @ A
        grid = []
        for i in range(sides):
            a = 2 * math.pi * i / sides
            row = []
            for k in range(tube):
                t = 2 * math.pi * k / tube
                rr = R_ + r * math.cos(t)
                row.append(self._place([(rr * math.cos(a), r * math.sin(t), rr * math.sin(a))], at, A)[0])
            grid.append(row)
        for i in range(sides):
            for k in range(tube):
                i2, k2 = (i + 1) % sides, (k + 1) % tube
                self.quad(grid[i][k], grid[i2][k], grid[i2][k2], grid[i][k2], colour, mat)

    def sphere(self, r, at, colour, mat='solid', scale=(1, 1, 1), seg=8, rings=6):
        pts = []
        for j in range(rings + 1):
            ph = math.pi * j / rings
            pts.append([(r * scale[0] * math.sin(ph) * math.cos(2 * math.pi * i / seg), r * scale[1] * math.cos(ph), r * scale[2] * math.sin(ph) * math.sin(2 * math.pi * i / seg)) for i in range(seg)])
        P = [self._place(row, at, np.eye(3)) for row in pts]
        for j in range(rings):
            for i in range(seg):
                i2 = (i + 1) % seg
                self.quad(P[j][i], P[j][i2], P[j + 1][i2], P[j + 1][i], colour, mat)

    # ---- output ----
    def bounds(self):
        allp = np.concatenate([np.array([t[0] for t in ts]).reshape(-1, 3) for ts in self.tris.values() if ts])
        return allp.min(0), allp.max(0)

    def triangles(self):
        return sum(len(t) for t in self.tris.values())

    def save(self, path):
        """Write a .glb: one primitive per material, flat normals, vertex colours."""
        bins, views, accessors, prims, mats = bytearray(), [], [], [], []
        MAT = {
            'solid': {'pbrMetallicRoughness': {'baseColorFactor': [1, 1, 1, 1], 'metallicFactor': 0.0, 'roughnessFactor': 0.85}},
            'metal': {'pbrMetallicRoughness': {'baseColorFactor': [1, 1, 1, 1], 'metallicFactor': 0.75, 'roughnessFactor': 0.35}},
            'glow': {'pbrMetallicRoughness': {'baseColorFactor': [1, 1, 1, 1], 'metallicFactor': 0.0, 'roughnessFactor': 0.4}, 'emissiveFactor': [1, 1, 1]},
            'glass': {'pbrMetallicRoughness': {'baseColorFactor': [1, 1, 1, 0.28], 'metallicFactor': 0.1, 'roughnessFactor': 0.08}, 'alphaMode': 'BLEND'},
        }

        def add_view(arr, target):
            nonlocal bins
            while len(bins) % 4:
                bins.append(0)
            off = len(bins)
            bins += arr.tobytes()
            views.append({'buffer': 0, 'byteOffset': off, 'byteLength': arr.nbytes, 'target': target})
            return len(views) - 1

        for name in self.MATS:
            ts = self.tris[name]
            if not ts:
                continue
            P = np.array([t[0] for t in ts], np.float32).reshape(-1, 3)
            C = np.repeat(np.array([t[1] for t in ts], np.float32), 3, axis=0)
            N = []
            for t in ts:
                n = np.cross(t[0][1] - t[0][0], t[0][2] - t[0][0])
                n = n / (np.linalg.norm(n) + 1e-12)
                N += [n, n, n]
            N = np.array(N, np.float32)
            idx = np.arange(len(P), dtype=np.uint32 if len(P) > 65535 else np.uint16)
            a0 = len(accessors)
            accessors.append({'bufferView': add_view(P, 34962), 'componentType': 5126, 'count': len(P), 'type': 'VEC3', 'min': P.min(0).tolist(), 'max': P.max(0).tolist()})
            accessors.append({'bufferView': add_view(N, 34962), 'componentType': 5126, 'count': len(N), 'type': 'VEC3'})
            accessors.append({'bufferView': add_view(C, 34962), 'componentType': 5126, 'count': len(C), 'type': 'VEC3'})
            accessors.append({'bufferView': add_view(idx, 34963), 'componentType': 5125 if idx.dtype == np.uint32 else 5123, 'count': len(idx), 'type': 'SCALAR'})
            # Double-sided: lighting is right whichever way a face winds (three.js flips the normal for back faces).
            mats.append({'name': name, 'doubleSided': True, **MAT[name]})
            prims.append({'attributes': {'POSITION': a0, 'NORMAL': a0 + 1, 'COLOR_0': a0 + 2}, 'indices': a0 + 3, 'material': len(mats) - 1})
        js = {
            'asset': {'version': '2.0', 'generator': 'street-fight-uk tools/models/lowpoly.py'},
            'scene': 0, 'scenes': [{'nodes': [0]}], 'nodes': [{'mesh': 0, 'name': path.split('/')[-1][:-4]}],
            'meshes': [{'primitives': prims}], 'materials': mats, 'accessors': accessors, 'bufferViews': views,
            'buffers': [{'byteLength': len(bins)}],
        }
        j = json.dumps(js, separators=(',', ':')).encode()
        while len(j) % 4:
            j += b' '
        while len(bins) % 4:
            bins.append(0)
        with open(path, 'wb') as f:
            f.write(struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(j) + 8 + len(bins)))
            f.write(struct.pack('<II', len(j), 0x4E4F534A) + j)
            f.write(struct.pack('<II', len(bins), 0x004E4942) + bytes(bins))
