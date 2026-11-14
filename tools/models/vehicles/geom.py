"""Tiny flat-shaded mesh builder (numpy). Parts are grouped by material; UVs point into the Kenney colormap."""
import numpy as np, math

def sw(c, r, f=0.5):
    """UV of colormap swatch column c, row r (32x128 px cells), f = 0 top .. 1 bottom."""
    return ((c * 32 + 16) / 512, (r * 128 + 4 + f * 120) / 512)

class Mesh:
    def __init__(self):
        self.parts = {}  # material -> [pos list, uv list]
    def tri(self, mat, a, b, c, uva, uvb=None, uvc=None):
        p = self.parts.setdefault(mat, [[], []])
        uva = uva or (0.0, 0.0)
        p[0] += [a, b, c]
        p[1] += [uva, (uvb or uva), (uvc or uva)]
    def quad(self, mat, a, b, c, d, uv, uvf=None):
        u = (lambda q: uvf(q)) if uvf else (lambda q: uv)
        self.tri(mat, a, b, c, u(a), u(b), u(c)); self.tri(mat, a, c, d, u(a), u(c), u(d))
    def poly(self, mat, pts, uv, uvf=None):
        """Simple polygon (ear clipping), pts in order; facing by winding."""
        u = (lambda q: uvf(q)) if uvf else (lambda q: uv)
        for a, b, c in earclip(pts):
            self.tri(mat, a, b, c, u(a), u(b), u(c))
    def box(self, mat, uv, c, s, rot=None, uvf=None):
        """Box centred c, size s, optional rotation (rx, ry, rz) radians."""
        hx, hy, hz = s[0] / 2, s[1] / 2, s[2] / 2
        v = np.array([[x, y, z] for x in (-hx, hx) for y in (-hy, hy) for z in (-hz, hz)])
        if rot: v = v @ rotm(*rot).T
        v = v + np.array(c)
        F = [(0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)]
        for f in F: self.quad(mat, *[tuple(v[i]) for i in f], uv, uvf)
    def cyl(self, mat, uv, c, r, h, n=12, axis='x', r2=None, caps=True, uvf=None, rot=None):
        r2 = r if r2 is None else r2
        ring = lambda rr, y: [np.array([rr * math.cos(2 * math.pi * i / n), y, rr * math.sin(2 * math.pi * i / n)]) for i in range(n)]
        A, B = ring(r, -h / 2), ring(r2, h / 2)
        M = {'y': np.eye(3), 'x': rotm(0, 0, math.pi / 2), 'z': rotm(math.pi / 2, 0, 0)}[axis]
        if rot: M = rotm(*rot) @ M
        T = lambda p: tuple(M @ p + np.array(c))
        for i in range(n):
            j = (i + 1) % n
            self.quad(mat, T(A[i]), T(B[i]), T(B[j]), T(A[j]), uv, uvf)
        if caps:
            self.poly(mat, [T(p) for p in A], uv, uvf)
            self.poly(mat, [T(p) for p in B[::-1]], uv, uvf)
    def loft(self, mat, prof, hw, ch, uv=None, uvf=None, cap_mat=None, cap_uv=None):
        """Side profile prof [(z, y)...] counter-clockwise seen from +x; extruded across x in [-hw, hw] with chamfered edges."""
        P = np.array(prof, float)
        lo, hi = P.min(0), P.max(0); ctr = (lo + hi) / 2; half = (hi - lo) / 2
        Q = ctr + (P - ctr) * (1 - ch / np.maximum(half, 1e-3))
        slices = [(-hw, Q), (-hw + ch, P), (hw - ch, P), (hw, Q)] if ch > 0 else [(-hw, P), (hw, P)]
        n = len(P)
        for (x0, S0), (x1, S1) in zip(slices, slices[1:]):
            for i in range(n):
                j = (i + 1) % n
                a = (x0, S0[i][1], S0[i][0]); b = (x0, S0[j][1], S0[j][0]); c = (x1, S1[j][1], S1[j][0]); d = (x1, S1[i][1], S1[i][0])
                self.quad(mat, a, b, c, d, uv, uvf)
        cm, cu = cap_mat or mat, cap_uv or uv
        x, S = slices[-1]; self.poly(cm, [(x, q[1], q[0]) for q in S], cu, uvf if cap_uv is None else None)
        x, S = slices[0]; self.poly(cm, [(x, q[1], q[0]) for q in S[::-1]], cu, uvf if cap_uv is None else None)
    def tris(self):
        return sum(len(p[0]) for p in self.parts.values()) // 3

def rotm(rx, ry, rz):
    cx, sx, cy, sy, cz, sz = math.cos(rx), math.sin(rx), math.cos(ry), math.sin(ry), math.cos(rz), math.sin(rz)
    X = np.array([[1, 0, 0], [0, cx, -sx], [0, sx, cx]]); Y = np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]]); Z = np.array([[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]])
    return Z @ Y @ X

def earclip(pts):
    P = [np.array(p, float) for p in pts]
    if len(P) < 3: return []
    nrm = np.zeros(3)
    for i in range(len(P)): nrm += np.cross(P[i], P[(i + 1) % len(P)])
    if np.linalg.norm(nrm) < 1e-9: return []
    nrm /= np.linalg.norm(nrm)
    idx = list(range(len(P))); out = []
    def inside(p, a, b, c):
        for u, v in ((a, b), (b, c), (c, a)):
            if np.dot(np.cross(v - u, p - u), nrm) < -1e-9: return False
        return True
    guard = 0
    while len(idx) > 3 and guard < 1000:
        guard += 1
        for k in range(len(idx)):
            i0, i1, i2 = idx[k - 1], idx[k], idx[(k + 1) % len(idx)]
            a, b, c = P[i0], P[i1], P[i2]
            if np.dot(np.cross(b - a, c - b), nrm) <= 1e-12: continue
            if any(inside(P[m], a, b, c) for m in idx if m not in (i0, i1, i2)): continue
            out.append((tuple(a), tuple(b), tuple(c))); idx.pop(k); break
        else:
            break
    if len(idx) == 3: out.append(tuple(tuple(P[i]) for i in idx))
    return out

def flat(pos, uv):
    pos = np.array(pos, np.float32).reshape(-1, 3, 3)
    n = np.cross(pos[:, 1] - pos[:, 0], pos[:, 2] - pos[:, 0])
    ln = np.linalg.norm(n, axis=1, keepdims=True); keep = ln[:, 0] > 1e-10
    n = n[keep] / ln[keep]; pos = pos[keep]
    uv = np.array(uv, np.float32).reshape(-1, 3, 2)[keep]
    N = np.repeat(n[:, None, :], 3, 1).reshape(-1, 3)
    P, U = pos.reshape(-1, 3), uv.reshape(-1, 2)
    key = np.round(np.hstack([P, N, U]), 5)
    _, first, inv = np.unique(key, axis=0, return_index=True, return_inverse=True)
    return P[first], N[first], U[first], inv.reshape(-1, 3)

def torus(m, mat, uv, c, R, r, n=16, k=6, uvf=None):
    """Torus in the XY plane (axis z), like three's TorusGeometry."""
    import math
    P = [[np.array(c) + np.array([(R + r * math.cos(b)) * math.cos(a), (R + r * math.cos(b)) * math.sin(a), r * math.sin(b)])
          for b in [2 * math.pi * j / k for j in range(k)]] for a in [2 * math.pi * i / n for i in range(n)]]
    for i in range(n):
        for j in range(k):
            i2, j2 = (i + 1) % n, (j + 1) % k
            m.quad(mat, tuple(P[i][j]), tuple(P[i2][j]), tuple(P[i2][j2]), tuple(P[i][j2]), uv, uvf)
