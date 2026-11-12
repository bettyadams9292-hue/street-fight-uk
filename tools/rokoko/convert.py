#!/usr/bin/env python3
"""
Turns Rokoko's free motion capture (FBX) into the game's mocap JSON, the same
format as public/anim/ara_mocap.json, so src/render/anim/araPose.ts plays it.

    python3 -I tools/rokoko/convert.py analyse <file.fbx> ...         # find strikes in a long take
    python3 -I tools/rokoko/convert.py build <rokoko folder> public/anim/rokoko_mocap.json  # every clip in CLIPS

Each entry of CLIPS cuts one move out of a take (start/end seconds), turns it to
face +z, can mirror it (left <-> right), and records when the blow lands
('hit', seconds into the cut) so the game can time it to a move's frames.

Format, per clip: world rotation of each bone relative to the bind pose
(int16 quaternions, base64), hips position in hip heights (int16 / 10000),
each limb's direction in the bind pose. Only data is read from the FBX files.
"""
import base64, json, math, os, sys
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import fbxanim

BONES = ['Hips', 'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'RightUpLeg', 'RightLeg', 'RightFoot', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head',
         'LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand', 'RightShoulder', 'RightArm', 'RightForeArm', 'RightHand']
DIR_TO = {'LeftUpLeg': 'LeftLeg', 'LeftLeg': 'LeftFoot', 'RightUpLeg': 'RightLeg', 'RightLeg': 'RightFoot',
          'LeftArm': 'LeftForeArm', 'LeftForeArm': 'LeftHand', 'LeftHand': 'LeftHandMiddle1',
          'RightArm': 'RightForeArm', 'RightForeArm': 'RightHand', 'RightHand': 'RightHandMiddle1'}
FPS = 30
PUNCH = float(os.environ.get('PUNCH', '0.93'))
M = 'Rokoko Studio (Mocap)/'
L = 'Rokoko Studio Legacy Mocap (older)/'

# id: (file, start s, end s, options). Times were found with `analyse` and checked on pose sheets.
# Options: loop, mirror, hit (s into the cut, when the blow lands), face (s into the cut to take the facing from).
CLIPS = {
    # Guards: loops, turned to face where the hands point. Fighters lead with the left.
    'rk_guard_a': (M + 'Combat/FightingIdle_mixamo.fbx', 20.0, -2.5, {'loop': True, 'aim': 'guard'}),
    'rk_guard_b': (L + 'Movement/Idle_FightStance_HUMANIK_769.fbx', 8.0, -2.5, {'loop': True, 'aim': 'guard'}),
    # Lead (left) and rear (right) straight punches, aimed along the arm at impact ('hit': seconds to impact).
    # 'orthodox': a cut where the actor stood southpaw is mirrored, so every fighter leads with the left.
    # Jabs are single punches that start and end in the guard (the Boxing take's jabs come in doubles, so none are used).
    'rk_jab': (M + 'Combat/ShadowBoxing_mixamo.fbx', 8.13, 8.75, {'hit': 0.30, 'aim': ['LeftHand', 0.30], 'orthodox': True}),
    'rk_jab_b': (M + 'Combat/ShadowBoxing_mixamo.fbx', 6.40, 7.10, {'hit': 0.30, 'aim': ['RightHand', 0.30], 'orthodox': True}),
    'rk_cross': (M + 'Combat/Boxing_mixamo.fbx', 9.88, 10.90, {'hit': 0.45, 'aim': ['RightHand', 0.45], 'orthodox': True}),
    'rk_cross_b': (M + 'Combat/ShadowBoxing_mixamo.fbx', 8.55, 9.45, {'hit': 0.28, 'aim': ['RightHand', 0.28], 'orthodox': True}),
    'rk_cross_c': (M + 'Combat/Boxing_mixamo.fbx', 13.55, 14.35, {'hit': 0.25, 'aim': ['RightHand', 0.25], 'orthodox': True}),
    # Kicks: a rear (right) front kick and a lead (left) roundhouse; stance is judged before the foot leaves the floor.
    'rk_front_kick': (M + 'Combat/BigFrontKick_mixamo.fbx', 3.40, 4.60, {'hit': 0.53, 'aim': ['RightFoot', 0.53], 'orthodox': True, 'stance_t': 0.0}),
    'rk_roundhouse_lead': (M + 'Combat/RoundHouseKick_mixamo.fbx', 7.25, 8.45, {'hit': 0.58, 'aim': ['RightFoot', 0.58], 'turn': -30, 'orthodox': True, 'stance_t': 0.0}),
    # Being hit, going down, getting up.
    'rk_hit_head': (L + 'Combat/Taunting_GettingPunched_HUMANIK_WHS_segment.fbx', 1.10, 2.40, {'face': 0.0}),
    'rk_hit_body': (L + 'Combat/Fight_GettingKickedinBalls_HUMANIK_WHS_segment.fbx', 5.35, 6.60, {'face': 0.0}),
    'rk_stagger': (M + 'Combat/KnockOut_Loser_mixamo.fbx', 8.8, 10.0, {'face': 0.0}),
    'rk_knockdown': (L + 'Combat/Taunting_GettingPunched02_HUMANIK_WHS_segment.fbx', 6.70, 8.20, {'face': 0.0}),
    'rk_ko': (L + 'Combat/Boxing_GettingKnockedOut_HUMANIK_WHS.fbx', 5.50, 7.60, {'face': 0.0}),
    'rk_ko_b': (M + 'Combat/KnockOut_Loser_mixamo.fbx', 9.6, 12.4, {'face': 0.0}),
    'rk_getup': (M + 'IdlesMocapPack_noFACE/Rise_04_Smooth_mixamo.fbx', 6.0, 8.3, {'face': 2.2}),
}


def norm_name(n):
    n = n.split(':')[-1]
    if n.startswith('Character') and '_' in n:
        n = n.split('_', 1)[1]
    return n


class Take:
    def __init__(self, path):
        self.clip = fbxanim.load(path)
        self.bind = {norm_name(k): v for k, v in self.clip.bind_globals().items()}
        missing = [b for b in BONES if b not in self.bind]
        if missing:
            raise ValueError(f'{path}: no {missing}')
        self.bindR = {b: self._rot(self.bind[b]) for b in self.bind}
        self.legBind = np.linalg.norm(self.bind['LeftUpLeg'][:3, 3] - self.bind['LeftLeg'][:3, 3]) + np.linalg.norm(self.bind['LeftLeg'][:3, 3] - self.bind['LeftFoot'][:3, 3])
        self.hipBind = self.bind['Hips'][1, 3]

    @staticmethod
    def _rot(Mx):
        R = Mx[:3, :3]
        u, _, vt = np.linalg.svd(R)
        return u @ vt

    def frame(self, t):
        G = {norm_name(k): v for k, v in self.clip.globals(t).items()}
        rot = {b: self._rot(G[b]) @ self.bindR[b].T for b in BONES}
        pos = {b: G[b][:3, 3] for b in G}
        leg = np.linalg.norm(pos['LeftUpLeg'] - pos['LeftLeg']) + np.linalg.norm(pos['LeftLeg'] - pos['LeftFoot'])
        # One hip height for this actor, from their own leg length.
        unit = self.hipBind * leg / self.legBind
        return rot, pos, unit


def yaw_of(R):
    f = R @ np.array([0, 0, 1.0])
    return math.atan2(f[0], f[2])


def Ry(a):
    c, s = math.cos(a), math.sin(a)
    return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])


def quat(R):
    t = np.trace(R)
    if t > 0:
        s = math.sqrt(t + 1) * 2
        q = [(R[2, 1] - R[1, 2]) / s, (R[0, 2] - R[2, 0]) / s, (R[1, 0] - R[0, 1]) / s, s / 4]
    else:
        i = int(np.argmax([R[0, 0], R[1, 1], R[2, 2]]))
        j, k = (i + 1) % 3, (i + 2) % 3
        s = math.sqrt(1 + R[i, i] - R[j, j] - R[k, k]) * 2
        q = [0, 0, 0, 0]
        q[i] = s / 4
        q[j] = (R[j, i] + R[i, j]) / s
        q[k] = (R[k, i] + R[i, k]) / s
        q[3] = (R[k, j] - R[j, k]) / s
    q = np.array(q)
    return q / np.linalg.norm(q)


def mirror_name(b):
    return b.replace('Left', '\0').replace('Right', 'Left').replace('\0', 'Right')


def stance_at(pos, yaw):
    """'orthodox' if the left foot is ahead along the facing yaw, else 'southpaw'."""
    fwd = np.array([math.sin(yaw), 0, math.cos(yaw)])
    return 'orthodox' if np.dot(pos['LeftFoot'] - pos['RightFoot'], fwd) > 0 else 'southpaw'


def analyse(path):
    """Prints the moments worth cutting: punches thrown at head height (labelled jab or cross by stance), kicks, falls."""
    tk = Take(path)
    c = tk.clip
    ts = np.arange(c.start + 0.3, c.end - 0.3, 1 / FPS)
    rows, frames = [], []
    for t in ts:
        rot, pos, unit = tk.frame(t)
        h = pos['Hips']
        r = []
        for side in ('Left', 'Right'):
            hand = pos[f'{side}Hand']
            r += [(hand[1] - h[1]) / unit, math.hypot(hand[0] - h[0], hand[2] - h[2]) / unit]
        r += [pos['LeftFoot'][1] / unit, pos['RightFoot'][1] / unit, h[1] / unit]
        rows.append(r)
        frames.append(pos)
    R = np.array(rows)
    print(f'== {os.path.basename(path)}  {c.end - c.start:.1f} s')
    events = []
    for k, side in ((0, 'Left'), (2, 'Right')):
        score = R[:, k + 1] * (R[:, k] > 0.35)
        for i in range(8, len(score) - 8):
            if score[i] > 0.62 and score[i] == score[i - 8:i + 9].max():
                pos = frames[i]
                yaw = math.atan2(*(pos[f'{side}Hand'] - pos[f'{side}Arm'])[[0, 2]])
                st = stance_at(pos, yaw)
                kind = 'jab' if (side == 'Left') == (st == 'orthodox') else 'cross'
                events.append((ts[i], f'{side[0]} {kind} ({st})', score[i]))
    for col, label in ((4, 'L kick'), (5, 'R kick')):
        v = R[:, col]
        for i in range(8, len(v) - 8):
            if v[i] > 0.33 and v[i] == v[i - 8:i + 9].max():
                events.append((ts[i], label, v[i]))
    for t, label, v in sorted(events):
        print(f'   {t:6.2f}  {label:24s} {v:.2f}')


def aim_yaw(frames, opts):
    """Which way the cut is turned so the fighter faces +z (towards the opponent).

    aim = 'guard': where the hands point on average (a guard faces its opponent);
    aim = ['LeftHand' | 'RightHand' | 'LeftFoot' | 'RightFoot', s]: along the striking limb at that moment;
    otherwise the hips at `face` seconds. `turn` adds degrees on top (positive turns the fighter to their left).
    """
    aim = opts.get('aim')
    flat = lambda v: math.atan2(v[0], v[2])
    if aim == 'guard':
        v = np.zeros(3)
        for rot, pos, unit in frames:
            v += (pos['LeftHand'] + pos['RightHand']) / 2 - (pos['LeftArm'] + pos['RightArm']) / 2
        yaw = flat(v)
    elif isinstance(aim, list):
        bone, t = aim
        rot, pos, unit = frames[min(len(frames) - 1, int(round(t * FPS)))]
        base = pos[bone.replace('Hand', 'Arm')] if 'Hand' in bone else pos['Hips']
        yaw = flat(pos[bone] - base)
    else:
        rot, pos, unit = frames[min(len(frames) - 1, int(round(opts.get('face', 0.0) * FPS)))]
        yaw = yaw_of(rot['Hips'])
    return yaw - math.radians(opts.get('turn', 0))


def best_loop_end(tk, t0, lo, hi):
    """The end time in [t0+lo, t0+hi] whose pose is nearest the start, so the loop joins up."""
    r0, p0, u0 = tk.frame(t0)
    best, best_d = t0 + lo, 1e9
    for t in np.arange(t0 + lo, t0 + hi, 1 / FPS):
        r, p, u = tk.frame(t)
        d = sum(1 - abs(np.dot(quat(r0[b]), quat(r[b]))) for b in BONES) * 20
        d += abs(p['Hips'][1] - p0['Hips'][1]) / u0 * 10
        if d < best_d:
            best, best_d = t, d
    return float(best)


def b64(arr):
    return base64.b64encode(arr.astype('<i2').tobytes()).decode()


def cut(tk, t0, t1, opts):
    ts = np.arange(t0, t1 + 1e-6, 1 / FPS)
    frames = [tk.frame(t) for t in ts]
    yaw = aim_yaw(frames, opts)
    Ri = Ry(-yaw)
    mir = opts.get('mirror', False)
    if opts.get('orthodox'):
        # Fighters in the game lead with the left: a southpaw take is mirrored.
        at = opts.get('stance_t', opts['aim'][1] if isinstance(opts.get('aim'), list) else 0.0)
        pos = frames[min(len(frames) - 1, int(round(at * FPS)))][1]
        mir = stance_at(pos, yaw) == 'southpaw'
    Mx = np.diag([-1.0, 1, 1])
    rot_q, hips = [], []
    p0 = Ri @ frames[0][1]['Hips']
    unit0 = np.mean([f[2] for f in frames])
    for rot, pos, unit in frames:
        for b in BONES:
            src = mirror_name(b) if mir else b
            R = Ri @ rot[src]
            if mir:
                R = Mx @ R @ Mx
            rot_q.append(quat(R))
        p = Ri @ pos['Hips']
        d = (p - p0) / unit0
        y = p[1] / unit0
        hips.append([(-d[0] if mir else d[0]), y, d[2]])
    rot_q = np.array(rot_q)
    # Keep each bone's quaternion on one side so frames blend the short way round.
    nb = len(BONES)
    for i in range(nb, len(rot_q)):
        if np.dot(rot_q[i], rot_q[i - nb]) < 0:
            rot_q[i] = -rot_q[i]
    hips = np.array(hips)
    loop = bool(opts.get('loop'))
    if 'hit' in opts and not loop:
        # A strike ends where it started: the game moves the fighter (a lunge, a step-in) itself.
        n = len(hips)
        drift = (hips[-1] - hips[0]) * np.linspace(0, 1, n)[:, None]
        hips[:, 0] -= drift[:, 0]
        hips[:, 2] -= drift[:, 2]
    if loop:
        # A loop stays where it is: take out the drift across the cycle and centre it.
        n = len(hips)
        drift = (hips[-1] - hips[0]) * np.linspace(0, 1, n)[:, None]
        hips[:, 0] -= drift[:, 0]
        hips[:, 2] -= drift[:, 2]
        hips[:, 0] -= hips[:, 0].mean()
        hips[:, 2] -= hips[:, 2].mean()
        # Ease the last third of a second into the first frame so the loop joins without a pop.
        k = min(n // 3, int(FPS / 3))
        q = rot_q.reshape(n, nb, 4)
        for i in range(n - k, n):
            w = (i - (n - k) + 1) / k
            w = w * w * (3 - 2 * w)
            for j in range(nb):
                a = q[0, j] if np.dot(q[0, j], q[i, j]) >= 0 else -q[0, j]
                v = (1 - w) * q[i, j] + w * a
                q[i, j] = v / np.linalg.norm(v)
            hips[i] = (1 - w) * hips[i] + w * hips[0]
        rot_q = q.reshape(-1, 4)
    dirs = {}
    for b, to in DIR_TO.items():
        src, dst = (mirror_name(b), mirror_name(to)) if mir else (b, to)
        if dst not in tk.bind:
            continue
        v = tk.bind[dst][:3, 3] - tk.bind[src][:3, 3]
        v = v / np.linalg.norm(v)
        if mir:
            v = v * np.array([-1, 1, 1])
        dirs[b] = [round(float(x), 5) for x in v]
    out = {
        'duration': round((len(ts) - 1) / FPS, 4), 'loop': loop, 'frames': len(ts), 'bones': BONES,
        'rot': b64(np.round(rot_q * 32767)), 'hips': b64(np.round(np.clip(hips, -3.2, 3.2) * 10000)),
        'dir': dirs, 'bias': {},
    }
    if 'hit' in opts:
        out['hit'] = opts['hit']
    return out


def build(root, out_path):
    takes, data = {}, {}
    for cid, (f, t0, t1, opts) in CLIPS.items():
        tk = takes.get(f) or Take(os.path.join(root, f))
        takes[f] = tk
        if opts.get('loop') and t1 < t0:
            # A negative end: search that window (seconds) for the frame that loops back best.
            t1 = best_loop_end(tk, t0, -t1 - 1.0, -t1 + 1.0)
        data[cid] = cut(tk, t0, t1, opts)
        print(f'{cid:22s} {t1 - t0:5.2f} s  {os.path.basename(f)}')
    json.dump(data, open(out_path, 'w'), separators=(',', ':'))
    print(f'{len(data)} clips, {os.path.getsize(out_path) / 1024:.0f} KB')


if __name__ == '__main__':
    if sys.argv[1] == 'analyse':
        for p in sys.argv[2:]:
            analyse(p)
    else:
        build(sys.argv[2], sys.argv[3])
