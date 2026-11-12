"""
Reads skeletal animation out of a binary FBX (7.x), with no FBX SDK and no Blender.

    clip = load(path)            # bind pose + animation, sampled on demand
    G = clip.globals(t)          # {bone: 4x4 global matrix} at t seconds

Only what Rokoko's mocap exports use is handled: joint translation and Euler
rotation curves (any rotation order), pre/post rotations, a bind pose. Pivots,
offsets and animated scale are ignored (they are zero/one in these files).
Run with python3 -I. Needs numpy.
"""
import struct, zlib
import numpy as np

FBX_SEC = 46186158000


def _read(path):
    b = open(path, 'rb').read()
    if b[:20] != b'Kaydara FBX Binary  ':
        raise ValueError(f'{path}: not a binary FBX')
    ver = struct.unpack_from('<I', b, 23)[0]
    wide = ver >= 7500

    def node(o):
        if wide:
            end, nprop, plen = struct.unpack_from('<QQQ', b, o); o += 24
        else:
            end, nprop, plen = struct.unpack_from('<III', b, o); o += 12
        nl = b[o]; o += 1
        name = b[o:o + nl].decode('latin1'); o += nl
        if end == 0:
            return None, o
        props, p = [], o
        for _ in range(nprop):
            t = chr(b[p]); p += 1
            if t == 'Y': props.append(struct.unpack_from('<h', b, p)[0]); p += 2
            elif t == 'C': props.append(b[p]); p += 1
            elif t == 'I': props.append(struct.unpack_from('<i', b, p)[0]); p += 4
            elif t == 'F': props.append(struct.unpack_from('<f', b, p)[0]); p += 4
            elif t == 'D': props.append(struct.unpack_from('<d', b, p)[0]); p += 8
            elif t == 'L': props.append(struct.unpack_from('<q', b, p)[0]); p += 8
            elif t in 'fdlib':
                n, enc, cl = struct.unpack_from('<III', b, p); p += 12
                raw = b[p:p + cl]; p += cl
                if enc: raw = zlib.decompress(raw)
                props.append(np.frombuffer(raw, {'f': '<f4', 'd': '<f8', 'l': '<i8', 'i': '<i4', 'b': 'u1'}[t], n))
            elif t in 'SR':
                n = struct.unpack_from('<I', b, p)[0]; p += 4
                props.append(b[p:p + n] if t == 'R' else b[p:p + n].decode('latin1')); p += n
            else:
                raise ValueError(f'property type {t}')
        o += plen
        kids = []
        while o < end:
            k, o2 = node(o)
            if k is None:
                o = end
                break
            kids.append(k); o = o2
        return (name, props, kids), end

    o, top = 27, []
    while o < len(b) - 200:
        k, o = node(o)
        if k is None: break
        top.append(k)
    return top


def _p70(n):
    out = {}
    for k in n[2]:
        if k[0] == 'Properties70':
            for pp in k[2]:
                out[pp[1][0]] = pp[1][4:]
    return out


def _euler(deg, order):
    """Rotation matrix for Euler angles in degrees; FBX order 0=XYZ (X applied first) .. 5=ZYX."""
    x, y, z = np.radians(deg)
    cx, sx, cy, sy, cz, sz = np.cos(x), np.sin(x), np.cos(y), np.sin(y), np.cos(z), np.sin(z)
    X = np.array([[1, 0, 0], [0, cx, -sx], [0, sx, cx]])
    Y = np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]])
    Z = np.array([[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]])
    seq = {0: 'XYZ', 1: 'XZY', 2: 'YZX', 3: 'YXZ', 4: 'ZXY', 5: 'ZYX'}[int(order)]
    M = np.eye(3)
    for a in seq:  # first letter applied first, so it sits rightmost
        M = {'X': X, 'Y': Y, 'Z': Z}[a] @ M
    return M


class Clip:
    def __init__(self, path):
        top = _read(path)
        objs = next(n for n in top if n[0] == 'Objects')[2]
        conns = next(n for n in top if n[0] == 'Connections')[2]
        self.models = {}
        for n in objs:
            if n[0] == 'Model' and n[1][2] in ('LimbNode', 'Root', 'Null'):
                p = _p70(n)
                self.models[n[1][0]] = {
                    'name': n[1][1].split('\x00')[0].split(':')[-1],
                    't': np.array(p.get('Lcl Translation', [0, 0, 0]), float),
                    'r': np.array(p.get('Lcl Rotation', [0, 0, 0]), float),
                    'pre': np.array(p.get('PreRotation', [0, 0, 0]), float),
                    'post': np.array(p.get('PostRotation', [0, 0, 0]), float),
                    'order': (p.get('RotationOrder') or [0])[0],
                    'curves': {},
                }
        curves = {}
        for n in objs:
            if n[0] == 'AnimationCurve':
                kt = next(k for k in n[2] if k[0] == 'KeyTime')[1][0].astype(np.int64)
                kv = next(k for k in n[2] if k[0] == 'KeyValueFloat')[1][0].astype(float)
                curves[n[1][0]] = (kt / FBX_SEC, kv)
        cnodes = {n[1][0]: {} for n in objs if n[0] == 'AnimationCurveNode'}
        self.parent = {}
        for c in conns:
            kind, a, b_ = c[1][0], c[1][1], c[1][2]
            if kind == 'OO' and a in self.models and b_ in self.models:
                self.parent[a] = b_
            elif kind == 'OP' and a in curves and b_ in cnodes:
                cnodes[b_][c[1][3][-1].upper()] = curves[a]
            elif kind == 'OP' and a in cnodes and b_ in self.models:
                prop = c[1][3]
                key = 't' if 'Translation' in prop else 'r' if 'Rotation' in prop else None
                if key: self.models[b_]['curves'][key] = cnodes[a]
        self.bind = {}
        for n in objs:
            if n[0] == 'Pose' and len(n[1]) > 2 and n[1][2] == 'BindPose':
                for pn in n[2]:
                    if pn[0] != 'PoseNode': continue
                    nid = next(k for k in pn[2] if k[0] == 'Node')[1][0]
                    mat = next(k for k in pn[2] if k[0] == 'Matrix')[1][0].reshape(4, 4).T
                    if nid in self.models: self.bind.setdefault(nid, mat)
        self.by_name = {m['name']: i for i, m in self.models.items()}
        ts = [c[0] for m in self.models.values() for cn in m['curves'].values() for c in cn.values()]
        self.start = min(t[0] for t in ts) if ts else 0.0
        self.end = max(t[-1] for t in ts) if ts else 0.0

    def _local(self, mid, t):
        m = self.models[mid]
        vals = {}
        for key in ('t', 'r'):
            v = m[key].copy()
            cn = m['curves'].get(key)
            if cn:
                for i, ax in enumerate('XYZ'):
                    if ax in cn:
                        kt, kv = cn[ax]
                        v[i] = np.interp(t, kt, kv)
            vals[key] = v
        R = _euler(m['pre'], 0) @ _euler(vals['r'], m['order']) @ _euler(m['post'], 0).T
        L = np.eye(4); L[:3, :3] = R; L[:3, 3] = vals['t']
        return L

    def globals(self, t):
        out = {}
        def g(mid):
            if mid in out: return out[mid]
            L = self._local(mid, t)
            p = self.parent.get(mid)
            out[mid] = (g(p) @ L) if p is not None else L
            return out[mid]
        for mid in self.models: g(mid)
        return {self.models[k]['name']: v for k, v in out.items()}

    def bind_globals(self):
        """Global bind matrices; bones missing from the bind pose are rebuilt from their rest values."""
        out = {}
        def g(mid):
            if mid in out: return out[mid]
            if mid in self.bind:
                out[mid] = self.bind[mid]
            else:
                m = self.models[mid]
                L = np.eye(4); L[:3, :3] = _euler(m['pre'], 0) @ _euler(m['r'], m['order']) @ _euler(m['post'], 0).T; L[:3, 3] = m['t']
                p = self.parent.get(mid)
                out[mid] = (g(p) @ L) if p is not None else L
            return out[mid]
        for mid in self.models: g(mid)
        return {self.models[k]['name']: v for k, v in out.items()}


def load(path):
    return Clip(path)
