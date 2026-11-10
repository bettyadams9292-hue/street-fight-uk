import type { JointName, Pose, Vec3 } from '../poses';

/**
 * The fighter's skeleton as numbers: where each joint sits and how long the
 * bones are. Pure maths (no Three.js), so the animation can be worked out and
 * tested anywhere. The frame is the fighter's own: x to their left (the lead
 * side), y up, z forwards; the origin is on the floor between the feet.
 *
 * Joint rotations are XYZ Euler angles exactly as the renderer applies them
 * (R = Rx·Ry·Rz). Arms and legs hang down −y at rest; a negative x rotation
 * swings a limb forwards; elbows flex with a negative x, knees with a positive.
 */
export interface Metrics {
  /** Height of the hips joint above the floor. */
  hipsY: number;
  /** hips → spine joint. */
  spine: Vec3;
  /** spine → head joint. */
  head: Vec3;
  /** spine → left shoulder (the right is mirrored in x). */
  shoulder: Vec3;
  upperArm: number;
  /** Elbow to the middle of the fist. */
  foreArm: number;
  /** hips → left hip joint (the right is mirrored in x). */
  hip: Vec3;
  thigh: number;
  /** Knee to ankle. */
  shin: number;
  /** Ankle above the sole. */
  ankleH: number;
  /** Sole length ahead of and behind the ankle. */
  footFwd: number;
  footBack: number;
}

/** The procedural (capsule) rig. */
export const CLASSIC_METRICS: Metrics = {
  hipsY: 0.95,
  spine: [0, 0.08, 0],
  head: [0, 0.55, 0],
  shoulder: [0.2, 0.44, 0],
  upperArm: 0.28,
  foreArm: 0.28,
  hip: [0.09, -0.06, 0],
  thigh: 0.44,
  shin: 0.36,
  ankleH: 0.08,
  footFwd: 0.17,
  footBack: 0.07,
};

/** The skinned male model (the female one is measured from its bones at load). */
export const MODEL_METRICS: Metrics = {
  hipsY: 0.949,
  spine: [0, 0.123, 0.036],
  head: [0, 0.448, -0.034],
  shoulder: [0.212, 0.383, -0.058],
  upperArm: 0.25,
  foreArm: 0.29,
  hip: [0.114, 0.022, 0.007],
  thigh: 0.429,
  shin: 0.452,
  ankleH: 0.09,
  footFwd: 0.17,
  footBack: 0.12,
};

// ---- 3×3 rotation matrices (row-major) ---------------------------------------------------------

export type M3 = [number, number, number, number, number, number, number, number, number];
export const IDENTITY: M3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];

/** R = Rx·Ry·Rz, the same as THREE.Euler 'XYZ'. */
export function euler(v: Vec3 | undefined): M3 {
  if (!v) return IDENTITY;
  const a = Math.cos(v[0]), b = Math.sin(v[0]);
  const c = Math.cos(v[1]), d = Math.sin(v[1]);
  const e = Math.cos(v[2]), f = Math.sin(v[2]);
  return [c * e, -c * f, d, a * f + b * e * d, a * e - b * f * d, -b * c, b * f - a * e * d, b * e + a * f * d, a * c];
}

/** The XYZ Euler angles of a rotation matrix. */
export function toEuler(m: M3): Vec3 {
  const m13 = Math.max(-1, Math.min(1, m[2]));
  const y = Math.asin(m13);
  if (Math.abs(m13) < 0.999999) return [Math.atan2(-m[5], m[8]), y, Math.atan2(-m[1], m[0])];
  return [Math.atan2(m[7], m[4]), y, 0];
}

export function mul(a: M3, b: M3): M3 {
  return [
    a[0] * b[0] + a[1] * b[3] + a[2] * b[6], a[0] * b[1] + a[1] * b[4] + a[2] * b[7], a[0] * b[2] + a[1] * b[5] + a[2] * b[8],
    a[3] * b[0] + a[4] * b[3] + a[5] * b[6], a[3] * b[1] + a[4] * b[4] + a[5] * b[7], a[3] * b[2] + a[4] * b[5] + a[5] * b[8],
    a[6] * b[0] + a[7] * b[3] + a[8] * b[6], a[6] * b[1] + a[7] * b[4] + a[8] * b[7], a[6] * b[2] + a[7] * b[5] + a[8] * b[8],
  ];
}

export function apply(m: M3, v: Vec3): Vec3 {
  return [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
}

export function transpose(m: M3): M3 {
  return [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
}

export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const len = (a: Vec3): number => Math.hypot(a[0], a[1], a[2]);
export const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export function norm(a: Vec3, fallback: Vec3 = [0, 0, 1]): Vec3 {
  const l = len(a);
  return l > 1e-6 ? [a[0] / l, a[1] / l, a[2] / l] : fallback;
}

// ---- forward kinematics -------------------------------------------------------------------------

export type Side = 'l' | 'r';
const mirror = (v: Vec3, s: Side): Vec3 => (s === 'l' ? v : [-v[0], v[1], v[2]]);

/** Where everything ends up for a pose (in the fighter's frame, before any whole-body pitch). */
export interface Body {
  hips: Vec3;
  hipsR: M3;
  spineR: M3;
  chest: Vec3;
  head: Vec3;
  headR: M3;
  shoulder: Record<Side, Vec3>;
  elbow: Record<Side, Vec3>;
  hand: Record<Side, Vec3>;
  hipJoint: Record<Side, Vec3>;
  knee: Record<Side, Vec3>;
  ankle: Record<Side, Vec3>;
  /** Rotation of each shin (for working out the foot). */
  shinR: Record<Side, M3>;
  thighR: Record<Side, M3>;
}

export function pelvisOf(pose: Pose, m: Metrics): Vec3 {
  return [pose.shift?.[0] ?? 0, m.hipsY - (pose.drop ?? 0), pose.shift?.[1] ?? 0];
}

/** Forward kinematics for a whole pose. */
export function solveBody(pose: Pose, m: Metrics, pelvis: Vec3 = pelvisOf(pose, m)): Body {
  const j = pose.joints;
  const hipsR = euler(j.hips);
  const spineR = mul(hipsR, euler(j.spine));
  const spineP = add(pelvis, apply(hipsR, m.spine));
  const headP = add(spineP, apply(spineR, m.head));
  const out: Body = {
    hips: pelvis,
    hipsR,
    spineR,
    chest: add(spineP, apply(spineR, [0, m.shoulder[1] * 0.8, 0])),
    head: add(headP, apply(mul(spineR, euler(j.head)), [0, 0.14, 0.02])),
    headR: mul(spineR, euler(j.head)),
    shoulder: { l: [0, 0, 0], r: [0, 0, 0] },
    elbow: { l: [0, 0, 0], r: [0, 0, 0] },
    hand: { l: [0, 0, 0], r: [0, 0, 0] },
    hipJoint: { l: [0, 0, 0], r: [0, 0, 0] },
    knee: { l: [0, 0, 0], r: [0, 0, 0] },
    ankle: { l: [0, 0, 0], r: [0, 0, 0] },
    shinR: { l: IDENTITY, r: IDENTITY },
    thighR: { l: IDENTITY, r: IDENTITY },
  };
  for (const s of ['l', 'r'] as Side[]) {
    const sh = add(spineP, apply(spineR, mirror(m.shoulder, s)));
    const armR = mul(spineR, euler(j[`${s}Shoulder` as JointName]));
    const el = add(sh, apply(armR, [0, -m.upperArm, 0]));
    const foreR = mul(armR, euler(j[`${s}Elbow` as JointName]));
    out.shoulder[s] = sh;
    out.elbow[s] = el;
    out.hand[s] = add(el, apply(foreR, [0, -m.foreArm, 0]));
    const hp = add(pelvis, apply(hipsR, mirror(m.hip, s)));
    const thighR = mul(hipsR, euler(j[`${s}Hip` as JointName]));
    const kn = add(hp, apply(thighR, [0, -m.thigh, 0]));
    const shinR = mul(thighR, euler(j[`${s}Knee` as JointName]));
    out.hipJoint[s] = hp;
    out.knee[s] = kn;
    out.ankle[s] = add(kn, apply(shinR, [0, -m.shin, 0]));
    out.thighR[s] = thighR;
    out.shinR[s] = shinR;
  }
  return out;
}

// ---- inverse kinematics --------------------------------------------------------------------------

export interface LimbSolution {
  /** Euler angles for the root joint (shoulder or hip), in its parent's frame. */
  root: Vec3;
  /** The hinge angle (elbow or knee x rotation). */
  hinge: number;
  /** How far past full reach the target was (0 when it could be reached). */
  over: number;
}

/**
 * Two-bone IK. `target` and `pole` are relative to the root joint, in the
 * parent's frame; the middle joint (elbow, knee) bends towards the pole.
 * `flex` is −1 for arms (elbows flex with negative x) and +1 for legs.
 * The limb never locks out straight or bends the wrong way.
 */
export function solveLimb(target: Vec3, pole: Vec3, a: number, b: number, flex: 1 | -1): LimbSolution {
  const max = (a + b) * 0.995;
  const min = Math.abs(a - b) + 0.04;
  const dist = len(target);
  const L = Math.max(min, Math.min(max, dist));
  const d = norm(target, [0, -1, 0]);
  const cosA = Math.max(-1, Math.min(1, (a * a + L * L - b * b) / (2 * a * L)));
  const sinA = Math.sqrt(1 - cosA * cosA);
  // The part of the pole that's square to the limb's line.
  let u = sub(pole, scale(d, dot(pole, d)));
  if (len(u) < 1e-4) u = sub([0, 0, flex], scale(d, d[2] * flex));
  u = norm(u, [1, 0, 0]);
  const ua = add(scale(d, cosA), scale(u, sinA));
  const fa = norm(sub(scale(d, L), scale(ua, a)), d);
  // The direction the lower bone leaves the upper bone's line in.
  let w = sub(fa, scale(ua, dot(fa, ua)));
  w = len(w) < 1e-5 ? scale(u, -1) : norm(w);
  const Y = scale(ua, -1);
  const Z = flex === -1 ? w : scale(w, -1);
  const X = cross(Y, Z);
  const root = toEuler([X[0], Y[0], Z[0], X[1], Y[1], Z[1], X[2], Y[2], Z[2]]);
  const bend = Math.acos(Math.max(-1, Math.min(1, dot(ua, fa))));
  return { root, hinge: flex * bend, over: Math.max(0, dist - max) };
}
