/**
 * Plays Ara 3D Gen's animation clips (ara/, MIT) and its CMU motion capture on
 * this game's 13-joint rig, as ordinary Poses the animator can blend.
 *
 * Keyframed clips give per-bone degrees on Ara's rig (Hips, Spine, Spine1,
 * Spine2, Neck, Head, Left/Right Shoulder, Arm, ForeArm, UpLeg, Leg, Foot) plus
 * optional hand targets in chest space; they are folded onto our joints and
 * the hands are placed with our own two-bone IK. Motion capture gives world
 * rotations per bone relative to the capture's rest pose; each is turned into
 * our joint's local rotation. Either way the lowest foot is put on the floor.
 *
 * Pure maths, no Three.js.
 */
import type { JointName, Pose, Vec3 } from '../poses';
import { apply, euler, mul, solveBody, solveLimb, toEuler, transpose, type M3, type Metrics } from './skeleton';
import type { Ch, Clip, HandTarget, Sample } from './ara/types';
import { idle } from './ara/basic';
import { SOCIAL_EMOTES, wave, cheer, laugh, talk } from './ara/emotes';
import { EVERYDAY } from './ara/everyday';
import { REACTIONS } from './ara/reactions';
import { COMBAT } from './ara/combat';
import { DODGES } from './ara/dodge';
import { MELEE } from './ara/melee';

const D = Math.PI / 180;

/** Every keyframed clip we use, by Ara's id. */
export const ARA_CLIPS: Record<string, Clip> = Object.fromEntries(
  ([idle, wave, cheer, laugh, talk] as Clip[]).concat(SOCIAL_EMOTES, EVERYDAY, REACTIONS, COMBAT, DODGES, MELEE).map((c) => [c.id, c]),
);

const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const ch = (bones: Record<string, Ch>, n: string): Vec3 => {
  const c = bones[n];
  return c ? [c[0] * D, c[1] * D, c[2] * D] : [0, 0, 0];
};
/** Trunk bones point up: Ara's +X (lean forward) and +Y (turn left) are ours too. */
const trunk = (c: Vec3): Vec3 => [c[0], c[1], c[2]];
/** Limbs hang down: forward swing and flex are negative X for us, twist turns the other way. */
const limb = (c: Vec3): Vec3 => [-c[0], -c[1], c[2]];

/** Fold a keyframed sample onto our joints (before hand IK and grounding). */
function fkJoints(bones: Record<string, Ch>): Record<JointName, Vec3> {
  const j = {} as Record<JointName, Vec3>;
  j.hips = trunk(ch(bones, 'Hips'));
  j.spine = trunk(add(add(ch(bones, 'Spine'), ch(bones, 'Spine1')), ch(bones, 'Spine2')));
  j.head = trunk(add(ch(bones, 'Neck'), ch(bones, 'Head')));
  for (const [s, S] of [['l', 'Left'], ['r', 'Right']] as const) {
    // The clavicle lifts the arm with it.
    const clav = ch(bones, `${S}Shoulder`);
    const arm = add(ch(bones, `${S}Arm`), [0, 0, clav[2] * 0.6]);
    j[`${s}Shoulder`] = limb(arm);
    j[`${s}Elbow`] = limb(ch(bones, `${S}ForeArm`));
    j[`${s}Hip`] = limb(ch(bones, `${S}UpLeg`));
    j[`${s}Knee`] = limb(ch(bones, `${S}Leg`));
    j[`${s}Foot`] = limb(ch(bones, `${S}Foot`));
  }
  return j;
}

/** Put a hand on an Ara chest-space target with our own IK (hand 0..1 weight). */
function reach(j: Record<JointName, Vec3>, m: Metrics, s: 'l' | 'r', t: HandTarget, w: number): void {
  if (t.space === 'floor' || t.support) return;
  const k = m.hipsY / 0.95; // Ara's targets are for a 1.8 m body
  const sh: Vec3 = s === 'l' ? m.shoulder : [-m.shoulder[0], m.shoulder[1], m.shoulder[2]];
  // In the spine's frame: from the shoulder to the neck base, then out to the target.
  const rel: Vec3 = [m.head[0] + t.pos[0] * k - sh[0], m.head[1] + t.pos[1] * k - sh[1], m.head[2] + t.pos[2] * k - sh[2]];
  const sol = solveLimb(rel, t.pole as Vec3, m.upperArm, Math.max(0.15, m.foreArm - 0.06), -1);
  const S = `${s}Shoulder` as JointName;
  const E = `${s}Elbow` as JointName;
  if (w >= 1) {
    j[S] = sol.root;
    j[E] = [sol.hinge, 0, 0];
  } else {
    j[S] = [j[S][0] + (sol.root[0] - j[S][0]) * w, j[S][1] + (sol.root[1] - j[S][1]) * w, j[S][2] + (sol.root[2] - j[S][2]) * w];
    j[E] = [j[E][0] + (sol.hinge - j[E][0]) * w, j[E][1] * (1 - w), j[E][2] * (1 - w)];
  }
}

/** Lower or raise the hips so the lowest ankle is at ankle height (plus any lift). */
function ground(j: Record<JointName, Vec3>, m: Metrics, shift: [number, number], lift = 0): number {
  const pose: Pose = { joints: j, drop: 0, shift };
  const b = solveBody(pose, m);
  const low = Math.min(b.ankle.l[1], b.ankle.r[1]);
  return low - m.ankleH - lift;
}

function fromSample(s: Sample, m: Metrics): Pose {
  const j = fkJoints(s.bones);
  if (s.ik?.Left) reach(j, m, 'l', s.ik.Left, s.ikWeight?.Left ?? 1);
  if (s.ik?.Right) reach(j, m, 'r', s.ik.Right, s.ikWeight?.Right ?? 1);
  const r = s.root ?? {};
  const k = m.hipsY / 0.95;
  if (r.yaw) j.hips = [j.hips[0], j.hips[1] + r.yaw * D, j.hips[2]];
  const shift: [number, number] = [(r.x ?? 0) * k, (r.z ?? 0) * k];
  let drop = (r.drop ?? 0) * (m.hipsY - 0.14) - (r.y ?? 0) * k;
  if (r.ground || r.floor) drop = ground(j, m, shift, r.lift ?? 0) + (r.drop ?? 0) * 0;
  return { joints: j, drop, shift, pitch: r.pitch ? -r.pitch * D : 0, ik: 0 };
}

/** A keyframed Ara clip as a pose at time t (loops wrap; one-shots hold their last frame). */
export function araClipPose(id: string, t: number, m: Metrics): Pose | null {
  const c = ARA_CLIPS[id];
  if (!c) return null;
  const tt = c.loop ? ((t % c.duration) + c.duration) % c.duration : Math.min(t, c.duration);
  return fromSample(c.sample(tt), m);
}

// ---- motion capture ------------------------------------------------------------------------

type Q = [number, number, number, number];
interface MocapRaw {
  duration: number;
  loop: boolean;
  travel?: Vec3;
  frames: number;
  bones: string[];
  rot: string;
  hips: string;
  dir: Record<string, Vec3>;
  bias: Record<string, Q>;
}
export interface MocapClip {
  id: string;
  duration: number;
  loop: boolean;
  /** Metres per second at 1.8 m (+z forward). */
  travel: Vec3 | null;
  frames: number;
  bones: string[];
  rot: Float32Array;
  hips: Float32Array;
  /** Per bone: rest alignment (ours to the capture's) with the calibration, as a matrix. */
  rest: M3[];
}

const mocap = new Map<string, MocapClip>();

function b64(s: string): Int16Array {
  const bin = atob(s);
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return new Int16Array(u.buffer, 0, u.length >> 1);
}

function qMat(q: Q): M3 {
  const [x, y, z, w] = q;
  return [
    1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w),
    2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w),
    2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y),
  ];
}

/** Rotation taking unit a to unit b (shortest). */
function fromTo(a: Vec3, b: Vec3): Q {
  const d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  if (d < -0.999999) {
    const ax: Vec3 = Math.abs(a[0]) < 0.9 ? [0, -a[2], a[1]] : [-a[1], a[0], 0];
    const l = Math.hypot(...ax);
    return [ax[0] / l, ax[1] / l, ax[2] / l, 0];
  }
  const c: Vec3 = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const q: Q = [c[0], c[1], c[2], 1 + d];
  const l = Math.hypot(...q);
  return [q[0] / l, q[1] / l, q[2] / l, q[3] / l];
}

/** Add motion-capture clips (the JSON made by tools/ara/convert_mocap.py). */
export function registerMocap(data: Record<string, MocapRaw>): void {
  for (const [id, r] of Object.entries(data)) {
    const rot = b64(r.rot);
    const hp = b64(r.hips);
    const rest = r.bones.map((n) => {
      const dir = r.dir[n];
      const align = dir ? qMat(fromTo([0, -1, 0], dir)) : qMat([0, 0, 0, 1]);
      const bias = r.bias[n] ? qMat(r.bias[n]) : qMat([0, 0, 0, 1]);
      return mul(bias, align);
    });
    mocap.set(id, {
      id,
      duration: r.duration,
      loop: r.loop,
      travel: r.travel ?? null,
      frames: r.frames,
      bones: r.bones,
      rot: Float32Array.from(rot, (v) => v / 32767),
      hips: Float32Array.from(hp, (v) => v / 10000),
      rest,
    });
  }
}

export function mocapClip(id: string): MocapClip | undefined {
  return mocap.get(id);
}

let loading: Promise<void> | null = null;
/** Fetch the motion capture once (about 230 KB). Never rejects. */
export function loadAraMocap(url = '/anim/ara_mocap.json'): Promise<void> {
  loading ??= fetch(url)
    .then((r) => r.json())
    .then((d) => registerMocap(d))
    .catch((e) => console.warn('[anim] motion capture not loaded', e));
  return loading;
}

function nlerpQ(a: Float32Array, i: number, b: Float32Array, j: number, w: number): Q {
  let d = a[i] * b[j] + a[i + 1] * b[j + 1] + a[i + 2] * b[j + 2] + a[i + 3] * b[j + 3];
  const s = d < 0 ? -1 : 1;
  d = 0;
  const q: Q = [0, 0, 0, 0];
  for (let k = 0; k < 4; k++) q[k] = a[i + k] * (1 - w) + b[j + k] * s * w;
  const l = Math.hypot(...q) || 1;
  return [q[0] / l, q[1] / l, q[2] / l, q[3] / l];
}

/** World rotation of every capture bone (as our-rig matrices) at time t. */
function mocapWorld(c: MocapClip, t: number): { world: Record<string, M3>; hips: Vec3 } {
  const n = c.frames - 1;
  const tt = c.loop ? ((t % c.duration) + c.duration) % c.duration : Math.max(0, Math.min(c.duration, t));
  const x = (tt / c.duration) * n;
  const fa = Math.min(n, Math.floor(x));
  const fb = c.loop ? (fa + 1) % (n + 1) : Math.min(n, fa + 1);
  const w = x - fa;
  const nb = c.bones.length;
  const world: Record<string, M3> = {};
  c.bones.forEach((name, b) => {
    const q = nlerpQ(c.rot, (fa * nb + b) * 4, c.rot, (fb * nb + b) * 4, w);
    world[name] = mul(qMat(q), c.rest[b]);
  });
  const h = (k: number) => c.hips[fa * 3 + k] * (1 - w) + c.hips[fb * 3 + k] * w;
  return { world, hips: [h(0), h(1), h(2)] };
}

const local = (parent: M3, child: M3): Vec3 => toEuler(mul(transpose(parent), child));

/** A motion-capture clip as a pose at time t (`grounded`: put the lowest foot on the floor). */
export function araMocapPose(id: string, t: number, m: Metrics, grounded = true): Pose | null {
  const c = mocap.get(id);
  if (!c) return null;
  const { world: W, hips } = mocapWorld(c, t);
  const I: M3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
  const get = (n: string) => W[n] ?? I;
  const j = {} as Record<JointName, Vec3>;
  const H = get('Hips');
  const C = get('Spine2');
  j.hips = toEuler(H);
  j.spine = local(H, C);
  j.head = local(C, get('Head'));
  for (const [s, S] of [['l', 'Left'], ['r', 'Right']] as const) {
    const arm = get(`${S}Arm`);
    const fore = get(`${S}ForeArm`);
    const up = get(`${S}UpLeg`);
    const leg = get(`${S}Leg`);
    j[`${s}Shoulder`] = local(C, arm);
    j[`${s}Elbow`] = local(arm, fore);
    j[`${s}Hip`] = local(H, up);
    j[`${s}Knee`] = local(up, leg);
    j[`${s}Foot`] = local(leg, get(`${S}Foot`));
  }
  const shift: [number, number] = [hips[0] * m.hipsY, hips[2] * m.hipsY];
  const drop = grounded ? ground(j, m, shift) : m.hipsY * (1 - hips[1]);
  return { joints: j, drop, shift, ik: 0 };
}

/** Distance covered by one cycle of a travelling capture, for a body with these metrics (m). */
export function mocapStride(id: string, m: Metrics): number {
  const c = mocap.get(id);
  if (!c?.travel) return 1;
  return Math.hypot(c.travel[0], c.travel[2]) * c.duration * (m.hipsY / 0.95);
}

/** Any Ara clip by name: motion capture first, then keyframed. */
export function araPose(id: string, t: number, m: Metrics): Pose | null {
  return araMocapPose(id, t, m) ?? araClipPose(id, t, m);
}

export const _test = { apply, euler };
