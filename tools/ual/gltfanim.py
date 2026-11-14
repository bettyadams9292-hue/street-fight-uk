"""Minimal glTF 2.0 (GLB) skeleton-animation reader: node hierarchy, rest pose and sampled clips.

Only data is read (numpy, no other dependencies). Used by tools/ual/convert.py.
"""
import json, struct
import numpy as np

_COMP = {5126: np.float32, 5123: np.uint16, 5121: np.uint8, 5125: np.uint32, 5122: np.int16, 5120: np.int8}
_N = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}


def quat_mat(q):
    x, y, z, w = q
    return np.array([
        [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
        [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
        [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)],
    ])


def trs(t, r, s):
    M = np.eye(4)
    M[:3, :3] = quat_mat(r) * np.asarray(s)[None, :]
    M[:3, 3] = t
    return M


def slerp(a, b, w):
    d = float(np.dot(a, b))
    if d < 0:
        b, d = -b, -d
    if d > 0.9995:
        q = a + (b - a) * w
        return q / np.linalg.norm(q)
    th = np.arccos(d)
    return (np.sin((1 - w) * th) * a + np.sin(w * th) * b) / np.sin(th)


class Glb:
    def __init__(self, path):
        raw = open(path, 'rb').read()
        jl = struct.unpack('<I', raw[12:16])[0]
        self.g = json.loads(raw[20:20 + jl])
        o = 20 + jl
        bl = struct.unpack('<I', raw[o:o + 4])[0]
        self.bin = raw[o + 8:o + 8 + bl]
        self.nodes = self.g['nodes']
        self.parent = {}
        for i, n in enumerate(self.nodes):
            for c in n.get('children', []):
                self.parent[c] = i
        self.index = {n.get('name', f'n{i}'): i for i, n in enumerate(self.nodes)}
        self.rest = [(np.array(n.get('translation', [0, 0, 0]), float), np.array(n.get('rotation', [0, 0, 0, 1]), float),
                      np.array(n.get('scale', [1, 1, 1]), float)) for n in self.nodes]
        self.clips = {a['name']: a for a in self.g.get('animations', [])}
        self._acc = {}

    def acc(self, i):
        if i in self._acc:
            return self._acc[i]
        a = self.g['accessors'][i]
        bv = self.g['bufferViews'][a['bufferView']]
        dt = _COMP[a['componentType']]
        n = _N[a['type']]
        off = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
        arr = np.frombuffer(self.bin, dtype=dt, count=a['count'] * n, offset=off).astype(float).reshape(a['count'], n)
        self._acc[i] = arr
        return arr

    def duration(self, name):
        a = self.clips[name]
        return max(float(self.acc(s['input'])[-1, 0]) for s in a['samplers'])

    def local_at(self, name, t):
        """Each node's (t, r, s) at time t in clip `name` (rest values where a channel is missing)."""
        out = [list(x) for x in self.rest]
        a = self.clips[name]
        for ch in a['channels']:
            node = ch['target'].get('node')
            path = ch['target']['path']
            if node is None or path not in ('translation', 'rotation', 'scale'):
                continue
            s = a['samplers'][ch['sampler']]
            ts = self.acc(s['input'])[:, 0]
            vs = self.acc(s['output'])
            if t <= ts[0]:
                v = vs[0]
            elif t >= ts[-1]:
                v = vs[len(ts) - 1]
            else:
                k = int(np.searchsorted(ts, t) - 1)
                w = (t - ts[k]) / max(1e-9, ts[k + 1] - ts[k])
                if s.get('interpolation', 'LINEAR') == 'STEP':
                    v = vs[k]
                elif path == 'rotation':
                    v = slerp(vs[k], vs[k + 1], w)
                else:
                    v = vs[k] * (1 - w) + vs[k + 1] * w
            out[node][{'translation': 0, 'rotation': 1, 'scale': 2}[path]] = np.array(v, float)
        return out

    def globals(self, local):
        G = {}

        def get(i):
            if i in G:
                return G[i]
            M = trs(*local[i])
            p = self.parent.get(i)
            G[i] = M if p is None else get(p) @ M
            return G[i]

        return {self.nodes[i].get('name', f'n{i}'): get(i) for i in range(len(self.nodes))}

    def rest_globals(self):
        return self.globals(self.rest)

    def globals_at(self, name, t):
        return self.globals(self.local_at(name, t))
