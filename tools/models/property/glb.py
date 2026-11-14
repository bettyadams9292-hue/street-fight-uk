"""Tiny flat-shaded low-poly GLB writer (original work for Street Fight UK).

Build a Model, add boxes / cylinders / extruded prisms / quads with a material
name, then save(). One mesh, one primitive per material, flat normals.
"""
import json, struct, math
import numpy as np


def hexrgb(h):
    h = h.lstrip('#')
    return [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]


def srgb_to_lin(c):
    return [((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92 for x in c]


def rot_y(a):
    c, s = math.cos(a), math.sin(a)
    return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])


def rot_x(a):
    c, s = math.cos(a), math.sin(a)
    return np.array([[1, 0, 0], [0, c, -s], [0, s, c]])


def rot_z(a):
    c, s = math.cos(a), math.sin(a)
    return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]])


class Model:
    def __init__(self):
        self.mats = {}  # name -> dict
        self.tris = {}  # name -> list of (p0,p1,p2, uv0,uv1,uv2)

    def material(self, name, colour, rough=0.8, metal=0.0, emissive=None, alpha=None, emissive_strength=1.0, uv=False):
        self.mats[name] = dict(colour=colour, rough=rough, metal=metal, emissive=emissive, alpha=alpha, es=emissive_strength, uv=uv)
        self.tris.setdefault(name, [])
        return name

    # -- primitives -----------------------------------------------------------------------
    def tri(self, mat, a, b, c, uv=((0, 0), (1, 0), (1, 1))):
        self.tris[mat].append((np.array(a, float), np.array(b, float), np.array(c, float), uv))

    def quad(self, mat, a, b, c, d, uv=((0, 0), (1, 0), (1, 1), (0, 1))):
        """a b c d counter-clockwise seen from the front."""
        self.tri(mat, a, b, c, (uv[0], uv[1], uv[2]))
        self.tri(mat, a, c, d, (uv[0], uv[2], uv[3]))

    def box(self, mat, w, h, d, x, y, z, R=None, faces='all', pivot=None):
        """Box of size w,h,d centred at x,y,z (y is the centre too). R rotates about its centre (or pivot)."""
        hx, hy, hz = w / 2, h / 2, d / 2
        v = np.array([[-hx, -hy, -hz], [hx, -hy, -hz], [hx, hy, -hz], [-hx, hy, -hz],
                      [-hx, -hy, hz], [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz]], float)
        if R is not None:
            v = v @ np.array(R).T
        v += [x, y, z]
        F = {
            'front': (4, 5, 6, 7), 'back': (1, 0, 3, 2), 'right': (5, 1, 2, 6), 'left': (0, 4, 7, 3),
            'top': (7, 6, 2, 3), 'bottom': (0, 1, 5, 4),
        }
        for k, (a, b, c, e) in F.items():
            if faces != 'all' and k not in faces:
                continue
            self.quad(mat, v[a], v[b], v[c], v[e])

    def box_b(self, mat, w, h, d, x, y0, z, **kw):
        """Box standing on y0."""
        self.box(mat, w, h, d, x, y0 + h / 2, z, **kw)

    def cyl(self, mat, r0, r1, h, x, y0, z, seg=8, caps=True, axis='y', R=None):
        """Cylinder from y0 to y0+h (r0 bottom, r1 top)."""
        pts = []
        for i in range(seg):
            a = 2 * math.pi * i / seg
            pts.append((math.cos(a), math.sin(a)))
        def P(r, c, s, yy):
            p = np.array([r * c, yy, -r * s])
            if axis == 'x':
                p = np.array([yy, r * c, r * s])
            elif axis == 'z':
                p = np.array([r * c, r * s, yy])
            if R is not None:
                p = np.array(R) @ p
            return p + [x, y0 if axis == 'y' else 0, z] if axis == 'y' else p + [x, y0, z]
        for i in range(seg):
            c0, s0 = pts[i]
            c1, s1 = pts[(i + 1) % seg]
            a, b = P(r0, c0, s0, 0), P(r0, c1, s1, 0)
            c, d = P(r1, c1, s1, h), P(r1, c0, s0, h)
            self.quad(mat, a, b, c, d)
            if caps:
                self.tri(mat, P(r1, 0, 0, h) * 0 + P(0, 1, 0, h), d, c)
                self.tri(mat, P(0, 1, 0, 0), b, a)

    def prism(self, mat, poly, depth, z0=0.0, R=None, offset=(0, 0, 0), caps=True):
        """Extrude a CCW 2D polygon (x,y) along +z from z0 to z0+depth. Convex or fan-safe polygons only."""
        n = len(poly)
        def P(px, py, pz):
            p = np.array([px, py, pz])
            if R is not None:
                p = np.array(R) @ p
            return p + offset
        for i in range(n):
            (x0, y0), (x1, y1) = poly[i], poly[(i + 1) % n]
            self.quad(mat, P(x0, y0, z0), P(x1, y1, z0), P(x1, y1, z0 + depth), P(x0, y0, z0 + depth))
        if caps:
            for i in range(1, n - 1):
                self.tri(mat, P(*poly[0], z0 + depth), P(*poly[i], z0 + depth), P(*poly[i + 1], z0 + depth))
                self.tri(mat, P(*poly[0], z0), P(*poly[i + 1], z0), P(*poly[i], z0))

    def count(self):
        return sum(len(t) for t in self.tris.values())

    # -- writing --------------------------------------------------------------------------
    def save(self, path, name='model'):
        bin_ = bytearray()
        accessors, views, prims, materials = [], [], [], []

        def add_view(data, target=None):
            while len(bin_) % 4:
                bin_.append(0)
            off = len(bin_)
            bin_.extend(data)
            v = {'buffer': 0, 'byteOffset': off, 'byteLength': len(data)}
            if target:
                v['target'] = target
            views.append(v)
            return len(views) - 1

        for mname, tris in self.tris.items():
            if not tris:
                continue
            m = self.mats[mname]
            pos, nor, uvs = [], [], []
            for a, b, c, uv in tris:
                nrm = np.cross(b - a, c - a)
                ln = np.linalg.norm(nrm)
                if ln < 1e-12:
                    continue
                nrm = nrm / ln
                for p, t in zip((a, b, c), uv):
                    pos.append(p)
                    nor.append(nrm)
                    uvs.append(t)
            pos = np.array(pos, np.float32)
            nor = np.array(nor, np.float32)
            uvs = np.array(uvs, np.float32)
            # Share identical corners (same position, normal and uv): indexed triangles.
            key = np.round(np.hstack([pos, nor, uvs if m['uv'] else uvs * 0]), 5)
            _, first, inv = np.unique(key, axis=0, return_index=True, return_inverse=True)
            inv = inv.reshape(-1)
            pos, nor, uvs = pos[first], nor[first], uvs[first]
            big = len(pos) > 65535
            ind = inv.astype(np.uint32 if big else np.uint16)
            vi = add_view(ind.tobytes(), 34963)
            accessors.append({'bufferView': vi, 'componentType': 5125 if big else 5123, 'count': len(ind), 'type': 'SCALAR'})
            ii = len(accessors) - 1
            vp = add_view(pos.tobytes(), 34962)
            accessors.append({'bufferView': vp, 'componentType': 5126, 'count': len(pos), 'type': 'VEC3',
                              'min': pos.min(0).tolist(), 'max': pos.max(0).tolist()})
            ia = len(accessors) - 1
            vn = add_view(nor.tobytes(), 34962)
            accessors.append({'bufferView': vn, 'componentType': 5126, 'count': len(nor), 'type': 'VEC3'})
            na = len(accessors) - 1
            ua = None
            if m['uv']:
                vu = add_view(uvs.tobytes(), 34962)
                accessors.append({'bufferView': vu, 'componentType': 5126, 'count': len(uvs), 'type': 'VEC2'})
                ua = len(accessors) - 1
            col = srgb_to_lin(hexrgb(m['colour']))
            mat = {'name': mname, 'pbrMetallicRoughness': {'baseColorFactor': col + [m['alpha'] if m['alpha'] is not None else 1.0],
                                                           'metallicFactor': m['metal'], 'roughnessFactor': m['rough']}}
            if m['alpha'] is not None:
                mat['alphaMode'] = 'BLEND'
                mat['doubleSided'] = True
            if m['emissive']:
                mat['emissiveFactor'] = srgb_to_lin(hexrgb(m['emissive']))
                if m['es'] != 1.0:
                    mat.setdefault('extensions', {})['KHR_materials_emissive_strength'] = {'emissiveStrength': m['es']}
            materials.append(mat)
            attrs = {'POSITION': ia, 'NORMAL': na}
            if ua is not None:
                attrs['TEXCOORD_0'] = ua
            prims.append({'attributes': attrs, 'indices': ii, 'material': len(materials) - 1})
        while len(bin_) % 4:
            bin_.append(0)
        gltf = {
            'asset': {'version': '2.0', 'generator': 'Street Fight UK property kit (original)'},
            'scene': 0, 'scenes': [{'nodes': [0]}],
            'nodes': [{'name': name, 'mesh': 0}],
            'meshes': [{'name': name, 'primitives': prims}],
            'materials': materials, 'accessors': accessors, 'bufferViews': views,
            'buffers': [{'byteLength': len(bin_)}],
        }
        if any('extensions' in mm for mm in materials):
            gltf['extensionsUsed'] = ['KHR_materials_emissive_strength']
        js = json.dumps(gltf, separators=(',', ':')).encode()
        while len(js) % 4:
            js += b' '
        out = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(bin_))
        out += struct.pack('<II', len(js), 0x4E4F534A) + js
        out += struct.pack('<II', len(bin_), 0x004E4942) + bytes(bin_)
        with open(path, 'wb') as f:
            f.write(out)
        return len(out)


    def hip_roof(self, mat, x0, x1, z0, z1, y0, h, inset=None):
        """Hipped roof over the rectangle x0..x1 / z0..z1 (z1 is the front), eaves at y0, ridge h above."""
        d = z1 - z0
        inset = d / 2 if inset is None else inset
        zm = (z0 + z1) / 2
        r0, r1 = x0 + inset, x1 - inset
        if r1 < r0:
            r0 = r1 = (x0 + x1) / 2
        A, B, C, D = (x0, y0, z1), (x1, y0, z1), (x1, y0, z0), (x0, y0, z0)
        R0, R1 = (r0, y0 + h, zm), (r1, y0 + h, zm)
        self.quad(mat, A, B, R1, R0)  # front
        self.quad(mat, C, D, R0, R1)  # back
        self.tri(mat, B, C, R1)
        self.tri(mat, D, A, R0)
        self.quad(mat, D, C, B, A)  # soffit

    def gable_roof(self, mat, x0, x1, z0, z1, y0, h, along='x'):
        """Pitched roof: ridge along x (gable ends at the sides) or along z (gable to the front)."""
        if along == 'x':
            zm = (z0 + z1) / 2
            A, B, C, D = (x0, y0, z1), (x1, y0, z1), (x1, y0, z0), (x0, y0, z0)
            R0, R1 = (x0, y0 + h, zm), (x1, y0 + h, zm)
            self.quad(mat, A, B, R1, R0)
            self.quad(mat, C, D, R0, R1)
            self.tri(mat, B, C, R1)
            self.tri(mat, D, A, R0)
        else:
            xm = (x0 + x1) / 2
            A, B, C, D = (x0, y0, z1), (x1, y0, z1), (x1, y0, z0), (x0, y0, z0)
            R0, R1 = (xm, y0 + h, z1), (xm, y0 + h, z0)
            self.quad(mat, B, C, R1, R0)
            self.quad(mat, D, A, R0, R1)
            self.tri(mat, A, B, R0)
            self.tri(mat, C, D, R1)
