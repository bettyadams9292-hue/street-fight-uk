"""
A tiny low-poly modelling kit that writes GLB 2.0 files directly (numpy + struct, no Blender).

Used by tools/weapons/build_weapons.py. Every part is made of flat polygons, so the
models are flat-shaded like the Kenney and Quaternius kits the game uses. Parts that
share a material are merged into one primitive; the file has one mesh and one node.

Conventions: 1 unit = 1 metre, +y up. Polygons are wound counter-clockwise seen from
outside (the right-hand rule gives the outward normal).
"""
import json
import math
import struct

import numpy as np


# ---------------------------------------------------------------- transforms

def T(x=0.0, y=0.0, z=0.0):
    m = np.eye(4)
    m[:3, 3] = (x, y, z)
    return m


def Rx(a):
    c, s = math.cos(a), math.sin(a)
    return np.array([[1, 0, 0, 0], [0, c, -s, 0], [0, s, c, 0], [0, 0, 0, 1]], float)


def Ry(a):
    c, s = math.cos(a), math.sin(a)
    return np.array([[c, 0, s, 0], [0, 1, 0, 0], [-s, 0, c, 0], [0, 0, 0, 1]], float)


def Rz(a):
    c, s = math.cos(a), math.sin(a)
    return np.array([[c, -s, 0, 0], [s, c, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]], float)


def S(x, y=None, z=None):
    return np.diag([x, x if y is None else y, x if z is None else z, 1.0])


def chain(*ms):
    """chain(A, B, C) applies C first, then B, then A (like A @ B @ C)."""
    out = np.eye(4)
    for m in ms:
        out = out @ m
    return out


# ---------------------------------------------------------------- materials

def srgb_to_linear(c):
    c = c / 255.0
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


class Mat:
    def __init__(self, name, hex_colour, metal=0.0, rough=0.8, alpha=1.0, emissive=None, double=False):
        self.name = name
        h = hex_colour.lstrip('#')
        self.rgb = [srgb_to_linear(int(h[i:i + 2], 16)) for i in (0, 2, 4)]
        self.metal, self.rough, self.alpha = metal, rough, alpha
        self.emissive = emissive
        self.double = double

    def gltf(self):
        m = {
            'name': self.name,
            'pbrMetallicRoughness': {
                'baseColorFactor': [round(v, 5) for v in self.rgb] + [self.alpha],
                'metallicFactor': self.metal,
                'roughnessFactor': self.rough,
            },
        }
        if self.alpha < 1:
            m['alphaMode'] = 'BLEND'
        if self.double:
            m['doubleSided'] = True
        if self.emissive:
            h = self.emissive.lstrip('#')
            m['emissiveFactor'] = [round(srgb_to_linear(int(h[i:i + 2], 16)), 5) for i in (0, 2, 4)]
        return m


# ---------------------------------------------------------------- triangulation

def _area2(pts):
    a = 0.0
    for i in range(len(pts)):
        x0, y0 = pts[i]
        x1, y1 = pts[(i + 1) % len(pts)]
        a += x0 * y1 - x1 * y0
    return a


def ccw(pts):
    return list(pts) if _area2(pts) > 0 else list(reversed(pts))


def earclip(pts):
    """Triangulate a simple CCW polygon; returns index triples."""
    idx = list(range(len(pts)))
    tris = []

    def inside(p, a, b, c):
        def s(p1, p2, p3):
            return (p1[0] - p3[0]) * (p2[1] - p3[1]) - (p2[0] - p3[0]) * (p1[1] - p3[1])
        d1, d2, d3 = s(p, a, b), s(p, b, c), s(p, c, a)
        return d1 >= 0 and d2 >= 0 and d3 >= 0

    guard = 0
    while len(idx) > 3 and guard < 10000:
        guard += 1
        n = len(idx)
        for k in range(n):
            i0, i1, i2 = idx[(k - 1) % n], idx[k], idx[(k + 1) % n]
            a, b, c = pts[i0], pts[i1], pts[i2]
            cross = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
            if cross <= 1e-12:
                continue
            if any(inside(pts[j], a, b, c) for j in idx if j not in (i0, i1, i2)):
                continue
            tris.append((i0, i1, i2))
            idx.pop(k)
            break
        else:
            break
    if len(idx) == 3:
        tris.append(tuple(idx))
    return tris


# ---------------------------------------------------------------- the model

class Model:
    def __init__(self, name):
        self.name = name
        self.polys = {}  # Mat -> list of (verts Nx3, tris or None)
        self.mats = []

    # Every primitive ends up here.
    def poly(self, mat, verts, tris=None):
        if mat not in self.polys:
            self.polys[mat] = []
            self.mats.append(mat)
        self.polys[mat].append((np.asarray(verts, float), tris))

    def _xf(self, m, pts):
        p = np.asarray(pts, float)
        h = np.c_[p, np.ones(len(p))]
        return (h @ m.T)[:, :3]

    # A closed surface of revolution around +y. profile: [(r, y), ...], walked so the
    # outside is on the right (bottom centre, out, up, back in to the top centre).
    # radial(j) scales the radius per segment corner (for pleats); mats(j) picks a
    # material per segment (for striped panels).
    def lathe(self, mat, profile, seg=8, m=np.eye(4), phase=0.0, radial=None, mats=None, sx=1.0, sz=1.0):
        rings = []
        for r, y in profile:
            ring = []
            for j in range(seg):
                a = phase + 2 * math.pi * j / seg
                k = radial(j) if radial else 1.0
                ring.append((r * k * sx * math.sin(a), y, r * k * sz * math.cos(a)))
            rings.append(self._xf(m, ring))
        for i in range(len(profile) - 1):
            r0, r1 = profile[i][0], profile[i + 1][0]
            for j in range(seg):
                jn = (j + 1) % seg
                mm = mats(j) if mats else mat
                a, b, c, d = rings[i][j], rings[i][jn], rings[i + 1][jn], rings[i + 1][j]
                if r0 == 0 and r1 == 0:
                    continue
                if r0 == 0:
                    self.poly(mm, [a, c, d])
                elif r1 == 0:
                    self.poly(mm, [a, b, c])
                else:
                    self.poly(mm, [a, b, c, d])

    # A closed prism: a 2D outline (u, v) in the XY plane, from z0 to z1.
    def extrude(self, mat, outline, z0, z1, m=np.eye(4), cap_mat=None):
        o = ccw(outline)
        n = len(o)
        front = self._xf(m, [(u, v, z1) for u, v in o])
        back = self._xf(m, [(u, v, z0) for u, v in o])
        tris = earclip(o)
        self.poly(cap_mat or mat, front, tris)
        self.poly(cap_mat or mat, back, [(a, c, b) for a, b, c in tris])
        for k in range(n):
            kn = (k + 1) % n
            self.poly(mat, [back[k], back[kn], front[kn], front[k]])

    # The same, but the outline is a cross-section (x, z) swept along +y from y0 to y1.
    def extrude_y(self, mat, section, y0, y1, m=np.eye(4)):
        # Rx(-90) takes the extrusion axis z onto +y and outline v onto -z.
        sec = [(x, -z) for x, z in section]
        self.extrude(mat, sec, y0, y1, chain(m, Rx(-math.pi / 2)))

    def box(self, mat, sx, sy, sz, x=0.0, y=0.0, z=0.0, m=np.eye(4)):
        hx, hy = sx / 2, sy / 2
        self.extrude(mat, [(-hx, -hy), (hx, -hy), (hx, hy), (-hx, hy)], -sz / 2, sz / 2, chain(m, T(x, y, z)))

    # A box whose far (+z) face has a different size: a CRT telly's back, a cone's foot.
    def frustum(self, mat, w0, h0, w1, h1, z0, z1, m=np.eye(4)):
        a = [(-w0 / 2, -h0 / 2, z0), (w0 / 2, -h0 / 2, z0), (w0 / 2, h0 / 2, z0), (-w0 / 2, h0 / 2, z0)]
        b = [(-w1 / 2, -h1 / 2, z1), (w1 / 2, -h1 / 2, z1), (w1 / 2, h1 / 2, z1), (-w1 / 2, h1 / 2, z1)]
        A, B = self._xf(m, a), self._xf(m, b)
        self.poly(mat, [B[0], B[1], B[2], B[3]])
        self.poly(mat, [A[3], A[2], A[1], A[0]])
        for k in range(4):
            kn = (k + 1) % 4
            self.poly(mat, [A[k], A[kn], B[kn], B[k]])

    # A round tube of `seg` sides along a 3D path, capped at both ends.
    def tube(self, mat, path, r, seg=6, m=np.eye(4), radii=None):
        P = np.asarray(path, float)
        n = len(P)
        tangents = []
        for i in range(n):
            t = P[min(i + 1, n - 1)] - P[max(i - 1, 0)]
            tangents.append(t / np.linalg.norm(t))
        ref = np.array([0.0, 0.0, 1.0])
        if abs(np.dot(ref, tangents[0])) > 0.9:
            ref = np.array([1.0, 0.0, 0.0])
        nrm = np.cross(tangents[0], ref)
        nrm /= np.linalg.norm(nrm)
        rings = []
        for i in range(n):
            t = tangents[i]
            nrm = nrm - np.dot(nrm, t) * t  # parallel transport
            nrm /= np.linalg.norm(nrm)
            bi = np.cross(t, nrm)
            rr = radii[i] if radii else r
            ring = [P[i] + rr * (math.cos(2 * math.pi * j / seg) * nrm + math.sin(2 * math.pi * j / seg) * bi) for j in range(seg)]
            rings.append(self._xf(m, ring))
        # Wind so normals point away from the path.
        a, b, c = rings[0][0], rings[0][1], rings[1][1]
        nq = np.cross(b - a, c - a)
        flip = np.dot(nq, (a + b) / 2 - self._xf(m, [P[0]])[0]) < 0
        for i in range(n - 1):
            for j in range(seg):
                jn = (j + 1) % seg
                q = [rings[i][j], rings[i][jn], rings[i + 1][jn], rings[i + 1][j]]
                self.poly(mat, q[::-1] if flip else q)
        c0 = list(rings[0])
        c1 = list(rings[-1])
        self.poly(mat, c0 if flip else c0[::-1])
        self.poly(mat, c1[::-1] if flip else c1)

    # ------------------------------------------------------------ output

    def tri_count(self):
        n = 0
        for mat in self.mats:
            for v, tris in self.polys[mat]:
                n += len(tris) if tris is not None else len(v) - 2
        return n

    def glb(self, extras=None):
        prims = []
        blobs = []
        accessors = []
        views = []
        offset = 0

        def add_view(data, target):
            nonlocal offset
            pad = (-len(data)) % 4
            views.append({'buffer': 0, 'byteOffset': offset, 'byteLength': len(data), 'target': target})
            blobs.append(data + b'\0' * pad)
            offset += len(data) + pad
            return len(views) - 1

        for mi, mat in enumerate(self.mats):
            pos, nor, idx = [], [], []
            for v, tris in self.polys[mat]:
                base = len(pos)
                # Newell normal: robust for slightly non-planar quads.
                nn = np.zeros(3)
                for k in range(len(v)):
                    a, b = v[k], v[(k + 1) % len(v)]
                    nn += np.array([(a[1] - b[1]) * (a[2] + b[2]), (a[2] - b[2]) * (a[0] + b[0]), (a[0] - b[0]) * (a[1] + b[1])])
                ln = np.linalg.norm(nn)
                if ln < 1e-12:
                    continue
                nn /= ln
                for p in v:
                    pos.append(p)
                    nor.append(nn)
                if tris is None:
                    tris = [(0, k, k + 1) for k in range(1, len(v) - 1)]
                for a, b, c in tris:
                    idx += [base + a, base + b, base + c]
            pos = np.asarray(pos, np.float32)
            nor = np.asarray(nor, np.float32)
            ind = np.asarray(idx, np.uint16 if len(pos) < 65535 else np.uint32)
            pv = add_view(pos.tobytes(), 34962)
            accessors.append({'bufferView': pv, 'componentType': 5126, 'count': len(pos), 'type': 'VEC3',
                              'min': [float(x) for x in pos.min(0)], 'max': [float(x) for x in pos.max(0)]})
            pa = len(accessors) - 1
            nv = add_view(nor.tobytes(), 34962)
            accessors.append({'bufferView': nv, 'componentType': 5126, 'count': len(nor), 'type': 'VEC3'})
            na = len(accessors) - 1
            iv = add_view(ind.tobytes(), 34963)
            accessors.append({'bufferView': iv, 'componentType': 5123 if ind.dtype == np.uint16 else 5125, 'count': len(ind), 'type': 'SCALAR'})
            prims.append({'attributes': {'POSITION': pa, 'NORMAL': na}, 'indices': len(accessors) - 1, 'material': mi})

        doc = {
            'asset': {'version': '2.0', 'generator': 'Street Fight UK tools/weapons (original work)'},
            'scene': 0,
            'scenes': [{'name': self.name, 'nodes': [0], **({'extras': extras} if extras else {})}],
            'nodes': [{'name': self.name, 'mesh': 0}],
            'meshes': [{'name': self.name, 'primitives': prims}],
            'materials': [m.gltf() for m in self.mats],
            'accessors': accessors,
            'bufferViews': views,
            'buffers': [{'byteLength': offset}],
        }
        js = json.dumps(doc, separators=(',', ':')).encode()
        js += b' ' * ((-len(js)) % 4)
        binary = b''.join(blobs)
        total = 12 + 8 + len(js) + 8 + len(binary)
        return (struct.pack('<III', 0x46546C67, 2, total) + struct.pack('<II', len(js), 0x4E4F534A) + js
                + struct.pack('<II', len(binary), 0x004E4942) + binary)
