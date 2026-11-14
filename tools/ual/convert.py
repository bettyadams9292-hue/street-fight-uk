#!/usr/bin/env python3
"""
Turns Quaternius' Universal Animation Library 1 and 2 (CC0, the "Standard" GLB files) into the
game's mocap JSON, the same format as public/anim/rokoko_mocap.json, so
src/render/anim/araPose.ts plays it on the game's rig.

    python3 -I tools/ual/convert.py list <UAL folder>                       # every clip and its length
    python3 -I tools/ual/convert.py all <UAL folder> /tmp/ual_all.json      # every clip, uncut (for previews)
    python3 -I tools/ual/convert.py build <UAL folder> public/anim/ual_mocap.json   # the clips in CLIPS

<UAL folder> holds both unzipped packs; the files used are
  .../Universal Animation Library[Standard]/Unreal-Godot/UAL1_Standard.glb
  .../Universal Animation Library 2[Standard]/Unreal-Godot/UAL2_Standard.glb
(the in-place versions, not _RM). Only data is read from them.

Format, per clip (see tools/rokoko/convert.py): world rotation of each bone relative to the bind
pose (int16 quaternions, base64), hips position in hip heights (int16 / 10000), and each limb's
direction in the bind pose. UAL's UE-style bones are renamed to the Mixamo names the player reads.
"""
import base64, glob, json, math, os, sys
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gltfanim

# Mixamo name (what araPose.ts reads) -> UAL bone.
NAMES = {
    'Hips': 'pelvis', 'Spine': 'spine_01', 'Spine1': 'spine_02', 'Spine2': 'spine_03', 'Neck': 'neck_01', 'Head': 'Head',
    'LeftShoulder': 'clavicle_l', 'LeftArm': 'upperarm_l', 'LeftForeArm': 'lowerarm_l', 'LeftHand': 'hand_l', 'LeftHandMiddle1': 'middle_01_l',
    'RightShoulder': 'clavicle_r', 'RightArm': 'upperarm_r', 'RightForeArm': 'lowerarm_r', 'RightHand': 'hand_r', 'RightHandMiddle1': 'middle_01_r',
    'LeftUpLeg': 'thigh_l', 'LeftLeg': 'calf_l', 'LeftFoot': 'foot_l', 'LeftToeBase': 'ball_l',
    'RightUpLeg': 'thigh_r', 'RightLeg': 'calf_r', 'RightFoot': 'foot_r', 'RightToeBase': 'ball_r',
}
BONES = ['Hips', 'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'RightUpLeg', 'RightLeg', 'RightFoot', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head',
         'LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand', 'RightShoulder', 'RightArm', 'RightForeArm', 'RightHand']
DIR_TO = {'LeftUpLeg': 'LeftLeg', 'LeftLeg': 'LeftFoot', 'RightUpLeg': 'RightLeg', 'RightLeg': 'RightFoot',
          'LeftArm': 'LeftForeArm', 'LeftForeArm': 'LeftHand', 'LeftHand': 'LeftHandMiddle1',
          'RightArm': 'RightForeArm', 'RightForeArm': 'RightHand', 'RightHand': 'RightHandMiddle1'}
FPS = 30

# id: (pack 1|2, clip, start s, end s or None for the whole clip, options).
# Options: loop; mirror (swap left and right); hit (s into the cut when a blow lands);
# hold (a one-shot: also used as a held pose); speed (playback-rate multiplier baked into 'duration').
# A list of pieces is joined end to end. Clips were picked and cut by eye on pose sheets
# (tools/posesheet.py). Most UAL gestures use the left hand; 'mirror' makes them right-handed
# like the game's own keyed poses.
CLIPS = {
    # ---- everyday (src/render/anim/ual.ts says which activity plays which) ----
    'ual_idle': (1, 'Idle_Loop', 0, None, {'loop': True}),
    'ual_fold_arms': (2, 'Idle_FoldArms_Loop', 0, None, {'loop': True}),
    'ual_talk': (1, 'Idle_Talking_Loop', 0, None, {'loop': True}),
    'ual_phone': (2, 'Idle_TalkingPhone_Loop', 0, None, {'loop': True}),
    'ual_lean': (2, 'Idle_Rail_Loop', 0, None, {'loop': True}),
    'ual_drink': (2, 'Consume', 0, None, {'loop': True, 'mirror': True, 'join': 8}),
    'ual_reach': (1, 'Interact', 0.1, 1.6, {'loop': True, 'mirror': True, 'join': 10}),
    'ual_reach_low': (2, 'Chest_Open', 0.3, 0.95, {'loop': True, 'mirror': True, 'join': 8}),
    'ual_carry': (2, 'Walk_Carry_Loop', 0, None, {'loop': True}),
    'ual_sit': (1, 'Sitting_Idle_Loop', 0, None, {'loop': True}),
    'ual_sit_talk': (1, 'Sitting_Talking_Loop', 0, None, {'loop': True}),
    'ual_drive': (1, 'Driving_Loop', 0, None, {'loop': True}),
    'ual_bag': [(1, 'Punch_Jab', 0, None, {}), (1, 'Punch_Cross', 0, None, {'loop': True, 'join': 4})],
    # ---- fighting ----
    'ual_cross': (1, 'Punch_Cross', 0, None, {'hit': 0.36}),
    # ---- reactions and stances ----
    'ual_guard_break': (2, 'Idle_Shield_Break', 0, None, {}),
    'ual_parried': (2, 'Idle_Shield_Break', 0, None, {'mirror': True}),
    'ual_jump_fall': (1, 'Jump_Loop', 0, None, {'loop': True}),
    'ual_fall_back': (2, 'Hit_Knockback', 0.05, None, {}),
    'ual_lay_to_idle': (2, 'LayToIdle', 0, None, {}),
}


def find_files(root):
    f1 = glob.glob(os.path.join(root, '**', 'UAL1_Standard.glb'), recursive=True)
    f2 = glob.glob(os.path.join(root, '**', 'UAL2_Standard.glb'), recursive=True)
    if not f1 or not f2:
        raise SystemExit(f'UAL1_Standard.glb / UAL2_Standard.glb not found under {root}')
    return {1: f1[0], 2: f2[0]}


def rot_of(M):
    u, _, vt = np.linalg.svd(M[:3, :3])
    return u @ vt


class Pack:
    def __init__(self, path):
        self.g = gltfanim.Glb(path)
        B = self.g.rest_globals()
        self.bind = {k: B[v] for k, v in NAMES.items()}
        self.bindR = {k: rot_of(v) for k, v in self.bind.items()}
        p = lambda n: self.bind[n][:3, 3]
        self.legBind = np.linalg.norm(p('LeftUpLeg') - p('LeftLeg')) + np.linalg.norm(p('LeftLeg') - p('LeftFoot'))
        self.hipBind = p('Hips')[1]

    def frame(self, clip, t):
        G = self.g.globals_at(clip, t)
        G = {k: G[v] for k, v in NAMES.items()}
        rot = {b: rot_of(G[b]) @ self.bindR[b].T for b in BONES}
        pos = {b: G[b][:3, 3] for b in G}
        return rot, pos, self.hipBind


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


def b64(arr):
    return base64.b64encode(arr.astype('<i2').tobytes()).decode()


def cut(pk, clip, t0, t1, opts):
    ts = np.arange(t0, t1 + 1e-6, 1 / FPS)
    if opts.get('reverse'):
        ts = ts[::-1]
    frames = [pk.frame(clip, t) for t in ts]
    mir = opts.get('mirror', False)
    Mx = np.diag([-1.0, 1, 1])
    yaw = math.radians(opts.get('turn', 0))
    c, s = math.cos(yaw), math.sin(yaw)
    Ri = np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])
    rot_q, hips = [], []
    p0 = Ri @ frames[0][1]['Hips']
    for rot, pos, unit in frames:
        for b in BONES:
            src = mirror_name(b) if mir else b
            R = Ri @ rot[src]
            if mir:
                R = Mx @ R @ Mx
            rot_q.append(quat(R))
        p = Ri @ pos['Hips']
        d = (p - p0) / unit
        hips.append([(-d[0] if mir else d[0]), p[1] / unit, d[2]])
    rot_q = np.array(rot_q)
    nb = len(BONES)
    for i in range(nb, len(rot_q)):
        if np.dot(rot_q[i], rot_q[i - nb]) < 0:
            rot_q[i] = -rot_q[i]
    hips = np.array(hips)
    n = len(hips)
    loop = bool(opts.get('loop'))
    if not opts.get('travel'):
        # In place: the game moves the body itself. Take out any drift across the cut.
        drift = (hips[-1] - hips[0]) * np.linspace(0, 1, n)[:, None]
        hips[:, 0] -= drift[:, 0]
        hips[:, 2] -= drift[:, 2]
    if loop:
        hips[:, 0] -= hips[:, 0].mean()
        hips[:, 2] -= hips[:, 2].mean()
        # Ease the last few frames into the first so the loop joins without a pop.
        k = min(n // 4, int(opts.get('join', 6)))
        q = rot_q.reshape(n, nb, 4)
        for i in range(n - k, n):
            w = (i - (n - k) + 1) / (k + 1)
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
        v = pk.bind[dst][:3, 3] - pk.bind[src][:3, 3]
        v = v / np.linalg.norm(v)
        if mir:
            v = v * np.array([-1, 1, 1])
        dirs[b] = [round(float(x), 5) for x in v]
    speed = float(opts.get('speed', 1.0))
    out = {
        'duration': round((n - 1) / FPS / speed, 4), 'loop': loop, 'frames': n, 'bones': BONES,
        'rot': b64(np.round(rot_q * 32767)), 'hips': b64(np.round(np.clip(hips, -3.2, 3.2) * 10000)),
        'dir': dirs, 'bias': {},
    }
    if 'hit' in opts:
        out['hit'] = round(opts['hit'] / speed, 4)
    return out


def concat(parts):
    """Join cuts end to end (same bones), e.g. a jab then a cross for a one-two loop."""
    rot = b''.join(base64.b64decode(p['rot']) for p in parts)
    hp = b''.join(base64.b64decode(p['hips']) for p in parts)
    n = sum(p['frames'] for p in parts)
    out = dict(parts[0])
    out.update({'frames': n, 'rot': base64.b64encode(rot).decode(), 'hips': base64.b64encode(hp).decode(),
                'duration': round(sum(p['duration'] for p in parts) + (len(parts) - 1) / FPS, 4)})
    return out


def build(root, out_path, ids=None):
    files = find_files(root)
    packs = {}
    data = {}
    for cid, spec in CLIPS.items():
        if ids and cid not in ids:
            continue
        pieces = spec if isinstance(spec, list) else [spec]
        cuts = []
        for pack, clip, t0, t1, opts in pieces:
            pk = packs.get(pack) or Pack(files[pack])
            packs[pack] = pk
            dur = pk.g.duration(clip)
            cuts.append(cut(pk, clip, t0, dur if t1 is None else min(t1, dur), opts))
        c = cuts[0] if len(cuts) == 1 else concat(cuts)
        if len(cuts) > 1:
            last = pieces[-1][4]
            c['loop'] = bool(last.get('loop'))
        data[cid] = c
        print(f'{cid:22s} {c["duration"]:5.2f} s  {"+".join(p[1] for p in pieces)}')
    json.dump(data, open(out_path, 'w'), separators=(',', ':'))
    print(f'{len(data)} clips, {os.path.getsize(out_path) / 1024:.0f} KB')


def everything(root, out_path):
    files = find_files(root)
    data = {}
    for pack, f in files.items():
        pk = Pack(f)
        for name in pk.g.clips:
            data[f'u{pack}_{name}'] = cut(pk, name, 0, pk.g.duration(name), {'loop': name.endswith('_Loop')})
    json.dump(data, open(out_path, 'w'), separators=(',', ':'))
    print(f'{len(data)} clips, {os.path.getsize(out_path) / 1024:.0f} KB')


if __name__ == '__main__':
    cmd = sys.argv[1]
    if cmd == 'list':
        for pack, f in find_files(sys.argv[2]).items():
            g = gltfanim.Glb(f)
            for n in sorted(g.clips):
                print(f'{pack} {n:28s} {g.duration(n):5.2f}')
    elif cmd == 'all':
        everything(sys.argv[2], sys.argv[3])
    else:
        build(sys.argv[2], sys.argv[3], set(sys.argv[4].split(',')) if len(sys.argv) > 4 else None)
