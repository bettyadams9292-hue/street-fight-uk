import type { JointName, Vec3 } from '../poses';
import { add, apply, euler, mul, solveBody, type Metrics } from './skeleton';

/**
 * Where a tipped-over body meets the floor.
 *
 * Hand-keyed falls lay the body down by pitching the whole rig about the point
 * between the feet. On its own that puts the body's centre line on the floor,
 * so whatever is in front of that line (chest, face, hands, knees, toes when
 * face down) ends up under the pavement. This works out, from the solved
 * skeleton, the lowest point of the actual body for the pose in hand, and so
 * how far the rig has to rise (or drop) for that point to rest on the floor:
 * falling forwards you pivot on your toes, then land on knees, hands and chest.
 *
 * The body is a set of balls on the joints (the flesh round them). The sizes
 * are calibrated on the skinned models in the game: lying flat, the lowest
 * vertex of the mesh is within a centimetre of the floor.
 *
 * No Three.js here, so the tests can check every keyed pose.
 */

/** Ball sizes (metres) for a 0.95 m hip height; scaled with the body. */
const R = { head: 0.07, chest: 0.118, belly: 0.09, shoulder: 0.03, elbow: 0.01, wrist: 0.02, fingers: 0.02, thigh: 0.092, knee: 0.05, ankle: 0.045, toe: 0.005, heel: 0.036 };

export interface Contact {
  /** Height of the lowest point of the body above the floor, with the rig pitched and not lifted (negative = under it). */
  lowest: number;
  /** Which part that is (for the tests and for tuning). */
  part: string;
}

/** The lowest point of the body for these joint angles, hips position and whole-body pitch. */
export function contact(joints: Partial<Record<JointName, Vec3>>, pelvis: Vec3, pitch: number, m: Metrics): Contact {
  const b = solveBody({ joints: joints as Record<JointName, Vec3> }, m, pelvis);
  const k = m.hipsY / 0.949;
  const c = Math.cos(pitch), s = Math.sin(pitch);
  let lowest = Infinity;
  let part = '';
  // rig.pitch.rotation.x = pitch, about the origin on the floor between the feet.
  const at = (name: string, p: Vec3, r: number): void => {
    const y = p[1] * c - p[2] * s - r * k;
    if (y < lowest) {
      lowest = y;
      part = name;
    }
  };
  at('head', add(b.head, apply(b.headR, [0, 0, 0.012 * k])), R.head);
  at('chest', add(b.chest, apply(b.spineR, [0, 0, 0.02 * k])), R.chest);
  at('belly', add(b.hips, apply(b.hipsR, [0, 0.03 * k, 0.012 * k])), R.belly);
  for (const side of ['l', 'r'] as const) {
    at('shoulder', b.shoulder[side], R.shoulder);
    at('elbow', b.elbow[side], R.elbow);
    at('wrist', b.hand[side], R.wrist);
    // The hand carries on past the wrist along the forearm.
    const fore: Vec3 = [b.hand[side][0] - b.elbow[side][0], b.hand[side][1] - b.elbow[side][1], b.hand[side][2] - b.elbow[side][2]];
    const len = Math.hypot(fore[0], fore[1], fore[2]) || 1;
    at('hand', [b.hand[side][0] + (fore[0] / len) * 0.1 * k, b.hand[side][1] + (fore[1] / len) * 0.1 * k, b.hand[side][2] + (fore[2] / len) * 0.1 * k], R.fingers);
    // The front of the thigh is the thickest part of the leg.
    const hj = b.hipJoint[side], kn = b.knee[side];
    at('thigh', [(hj[0] + kn[0]) / 2, (hj[1] + kn[1]) / 2, (hj[2] + kn[2]) / 2], R.thigh);
    at('knee', b.knee[side], R.knee);
    at('ankle', b.ankle[side], R.ankle);
    const footR = mul(b.shinR[side], euler(joints[`${side}Foot` as JointName]));
    at('toes', add(b.ankle[side], apply(footR, [0, -m.ankleH + 0.03 * k, m.footFwd])), R.toe);
    at('heel', add(b.ankle[side], apply(footR, [0, -m.ankleH + 0.04 * k, -0.045 * k])), R.heel);
  }
  return { lowest, part };
}

/**
 * How far to raise the pitched rig so the body rests on the floor. Nothing
 * for an upright body (the feet are already placed on the floor by the
 * animator); it comes in as the body tips over.
 */
export function groundLift(joints: Partial<Record<JointName, Vec3>>, pelvis: Vec3, pitch: number, m: Metrics): number {
  const tipped = Math.min(1, Math.max(0, (Math.abs(pitch) - 0.04) / 0.22));
  if (tipped <= 0) return 0;
  return -contact(joints, pelvis, pitch, m).lowest * tipped * tipped * (3 - 2 * tipped);
}
