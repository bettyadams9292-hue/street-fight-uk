/**
 * The rider on a bike or scooter, fitted to that bike: hips on the seat, hands on the bars, feet on the pedals (going
 * round with the cranks), on the pegs or the footboard, or both feet on a stand-up scooter's deck. Legs and arms are
 * solved as two-bone chains in the rider's side view, so every model is ridden properly whatever its size.
 *
 * Rider frame: y up, z forward; the rider's hips stand over the seat. Joint angles follow the rig: a leg or arm at 0
 * hangs straight down, a negative x rotation swings it forward; knees bend with positive x, elbows with negative.
 */
import { solveBody, type Metrics } from './skeleton';
import type { Pose } from '../poses';
import type { BikeFit } from '../props/bikes';

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** A two-bone chain from (0,0) reaching (z, y): the first bone's swing forward from straight down, and the bend. */
function reach(z: number, y: number, a: number, b: number, elbowDown: boolean): [number, number] {
  const d = clamp(Math.hypot(z, y), Math.abs(a - b) + 0.01, a + b - 0.005);
  const toward = Math.atan2(z, -y); // forward of straight down
  const inner = Math.acos(clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1));
  const joint = Math.acos(clamp((a * a + b * b - d * d) / (2 * a * b), -1, 1));
  // Knees out in front of the line; elbows below it.
  const first = elbowDown ? toward - inner : toward + inner;
  return [first, Math.PI - joint];
}

export interface RideInputs {
  /** Crank angle (radians) for pedalling. */
  crank: number;
  /** Speed (m/s), for the lean into the bars. */
  speed: number;
  /** 0..1: getting on (or off); the leg nearest the camera swings over. 1 = riding. */
  on: number;
}

type Adj = { hand: [number, number]; l: [number, number]; r: [number, number] };

/**
 * The ride pose for this bike and this rider. The chains are solved on a simplified side view, then checked against
 * the real skeleton (solveBody) and nudged twice, so hands land on the grips and feet on the pedals within a centimetre.
 */
export function ridePose(fit: BikeFit, m: Metrics, inp: RideInputs): Pose {
  const adj: Adj = { hand: [0, 0], l: [0, 0], r: [0, 0] };
  let pose = build(fit, m, { ...inp, on: 1 }, adj);
  for (let it = 0; it < 3; it++) {
    const b = solveBody(pose, m);
    const want = targets(fit, m, inp.crank);
    adj.hand[0] += want.hand[0] - (b.hand.l[2] + b.hand.r[2]) / 2;
    adj.hand[1] += want.hand[1] - (b.hand.l[1] + b.hand.r[1]) / 2;
    adj.l[0] += want.l[0] - b.ankle.l[2];
    adj.l[1] += want.l[1] - b.ankle.l[1];
    adj.r[0] += want.r[0] - b.ankle.r[2];
    adj.r[1] += want.r[1] - b.ankle.r[1];
    pose = build(fit, m, { ...inp, on: 1 }, adj);
  }
  return inp.on < 1 ? build(fit, m, inp, adj) : pose;
}

/** Where the hands and ankles should be, in the rider's frame (z forward from the seat, y up from the floor). */
function targets(fit: BikeFit, m: Metrics, crank: number) {
  const ankle = m.ankleH + 0.02;
  const sx = fit.seat.x;
  const foot = (side: 1 | -1): [number, number] => {
    if (fit.pedal) {
      const a = crank + (side > 0 ? 0 : Math.PI);
      return [fit.pedal.x + Math.cos(a) * fit.pedal.crank - sx, fit.pedal.y + Math.sin(a) * fit.pedal.crank + ankle];
    }
    if (fit.ride === 'kick') return [fit.feet.x + (side > 0 ? 0.16 : -0.14) - sx, fit.feet.y + ankle];
    return [fit.feet.x - sx + (side > 0 ? 0.02 : -0.02), fit.feet.y + ankle];
  };
  return { hand: [fit.bars.x - sx, fit.bars.y] as [number, number], l: foot(1), r: foot(-1) };
}

function build(fit: BikeFit, m: Metrics, inp: RideInputs, adj: Adj): Pose {
  const ankle = m.ankleH + 0.02;
  const leg = m.thigh + m.shin;
  // How high the hips sit: on the seat (a little above the saddle top), or standing on the deck.
  const standing = fit.ride === 'kick';
  let hipY = standing ? fit.seat.y + leg * 0.96 + ankle - m.hip[1] : fit.seat.y + 0.07;
  if (fit.pedal) {
    // A tall saddle: sink into it until the bottom of the pedal stroke is still in reach.
    const dz = fit.pedal.x - fit.seat.x;
    const reachY = Math.sqrt(Math.max(0, (leg * 0.975) ** 2 - dz * dz));
    hipY = Math.min(hipY, fit.pedal.y - fit.pedal.crank + ankle + reachY - m.hip[1]);
  }
  // The legs hang from the hip joints, a little below the hips.
  const legTop = hipY + m.hip[1];
  const drop = m.hipsY - hipY;
  const sx = fit.seat.x;
  const joints: Pose['joints'] = {};

  // Legs. Feet relative to the hip (which is at the rider's root, hipY up).
  const foot = (side: 1 | -1): [number, number] => {
    if (fit.pedal) {
      const a = inp.crank + (side > 0 ? 0 : Math.PI);
      return [fit.pedal.x + Math.cos(a) * fit.pedal.crank - sx, fit.pedal.y + Math.sin(a) * fit.pedal.crank + ankle - legTop];
    }
    if (standing) return [fit.feet.x + (side > 0 ? 0.16 : -0.14) - sx, fit.feet.y + ankle - legTop];
    return [fit.feet.x - sx + (side > 0 ? 0.02 : -0.02), fit.feet.y + ankle - legTop];
  };
  for (const side of [1, -1] as const) {
    const [fz0, fy0] = foot(side);
    const a = side > 0 ? adj.l : adj.r;
    const fz = fz0 + a[0];
    const fy = fy0 + a[1];
    const [hip, knee] = reach(fz, fy, m.thigh, m.shin, false);
    const L = side > 0 ? 'l' : 'r';
    // Astride a motorbike the knees go round the tank.
    const splay = fit.ride === 'astride' ? 0.2 : fit.ride === 'step' ? 0.08 : 0.04;
    joints[`${L}Hip` as const] = [-hip, 0, side * splay];
    joints[`${L}Knee` as const] = [knee, 0, 0];
  }

  // Lean forward until the bars are in reach (a racer tucks, a shopper sits up), a touch more with speed.
  const torso = m.spine[1] + m.shoulder[1];
  const arm = m.upperArm + m.foreArm;
  const bz = fit.bars.x - sx + adj.hand[0];
  const by = fit.bars.y - hipY + adj.hand[1];
  let lean = 0;
  for (; lean < 1.4; lean += 0.03) {
    const d = Math.hypot(bz - Math.sin(lean) * torso, by - Math.cos(lean) * torso);
    if (d <= arm * 0.9) break;
  }
  lean = clamp(lean + Math.min(0.08, inp.speed * 0.006), 0.05, 1.4);
  joints.spine = [lean, 0, 0];
  joints.head = [-lean * 0.75, 0, 0];
  const shz = Math.sin(lean) * torso;
  const shy = Math.cos(lean) * torso;
  const [up, elbow] = reach(bz - shz, by - shy, m.upperArm, m.foreArm, true);
  // The arm is jointed to the leaning spine: its local swing is the world swing less the lean.
  for (const side of [1, -1] as const) {
    const L = side > 0 ? 'l' : 'r';
    joints[`${L}Shoulder` as const] = [-up - lean, 0, side * -0.12];
    joints[`${L}Elbow` as const] = [-elbow, 0, 0];
  }
  joints.hips = [0, 0, 0];

  // Getting on: the near (right) leg lifts and swings over the back of the seat, hips raised, then settles.
  if (inp.on < 1) {
    const t = clamp(inp.on, 0, 1);
    const swing = Math.sin(Math.PI * clamp(t * 1.15, 0, 1));
    const r = joints.rHip!;
    joints.rHip = [r[0] * t - 1.3 * swing, 0, r[2] - 0.9 * swing];
    joints.rKnee = [joints.rKnee![0] * t + 1.2 * swing, 0, 0];
    joints.spine = [lean * t + 0.15 * swing, 0, 0];
    return { joints, drop: drop * t - 0.04 * swing, ik: 0 };
  }
  return { joints, drop, ik: 0 };
}
