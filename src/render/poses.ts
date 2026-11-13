/**
 * Key poses for the fighter rig. The simulation does not depend on any of this.
 *
 * Angles are radians. Arms and legs hang straight down at 0; a negative X
 * rotation swings a limb forward, a positive knee X (negative elbow X) bends it.
 * The fighter's forward is local +Z, its lead (left) side is local +X.
 * Shoulder Y turns the upper arm about its length: negative brings the left
 * forearm in across the body, positive the right. Z lifts an arm or leg out
 * to the side (positive for the left, negative for the right).
 *
 * Standing poses say where the feet go (`feet`); the animator (anim/animator.ts)
 * plants them there with IK, so nothing floats, sinks or slides, and bends the
 * knees to suit. A foot that isn't listed is in the air and follows the leg
 * angles as written (kicks, knees, jumps). Poses that aren't standing at all
 * (lying, kneeling, sat down) set `ik: 0` and use the leg angles exactly.
 */
export const JOINTS = ['hips', 'spine', 'head', 'lShoulder', 'lElbow', 'rShoulder', 'rElbow', 'lHip', 'lKnee', 'rHip', 'rKnee', 'lFoot', 'rFoot'] as const;
export type JointName = (typeof JOINTS)[number];
export type Vec3 = [number, number, number];
/** Where a planted foot goes: [to the left, forwards, toes turned (radians, + to the left), heel raised (m)]. */
export type FootSpec = [number, number, number, number?];

export interface Pose {
  joints: Partial<Record<JointName, Vec3>>;
  /** Lowers the hips (m), e.g. knees bent. */
  drop?: number;
  /** Whole-body pitch around the feet (radians, negative = falling backwards). */
  pitch?: number;
  /** Moves the hips over the feet: [to the fighter's left, forwards] in metres (weight transfer). */
  shift?: [number, number];
  /** Planted feet. */
  feet?: { l?: FootSpec; r?: FootSpec };
  /** 1 (default): feet are planted on the floor with IK. 0: the legs are exactly as authored. */
  ik?: number;
}

type J = Partial<Record<JointName, Vec3>>;
type Extra = Omit<Pose, 'joints' | 'drop'>;

/** Orthodox fighting stance: lead (left) foot forward, body bladed, hands up, chin down. */
const STANCE_FEET = { l: [0.15, 0.24, -0.12] as FootSpec, r: [-0.16, -0.26, -0.75, 0.035] as FootSpec };

export const GUARD: Pose = {
  joints: {
    hips: [0, -0.42, 0],
    spine: [0.14, -0.3, 0],
    head: [0.1, 0.66, 0],
    lShoulder: [-0.8, -0.5, 0.1],
    lElbow: [-1.95, 0, 0],
    rShoulder: [-0.4, 0.55, -0.05],
    rElbow: [-2.3, 0, 0],
    lHip: [-0.4, 0, 0.2],
    lKnee: [0.5, 0, 0],
    rHip: [0.2, 0, -0.2],
    rKnee: [0.55, 0, 0],
  },
  drop: 0.07,
  feet: STANCE_FEET,
};

/** A pose built from the guard with some joints changed. */
const g = (joints: J, drop = GUARD.drop ?? 0.07, extra: Extra = {}): Pose => ({ joints: { ...GUARD.joints, ...joints }, drop, feet: STANCE_FEET, ...extra });
/** A pose with the legs used exactly as written (no planted feet). */
const fk = (joints: J, drop = 0, extra: Extra = {}): Pose => ({ joints: { ...GUARD.joints, ...joints }, drop, ik: 0, ...extra });

/** Stood about, not fighting: arms loose at the sides, weight even. */
export const RELAXED: Pose = {
  joints: {
    hips: [0, 0, 0],
    spine: [0.03, 0, 0],
    head: [0.02, 0, 0],
    lShoulder: [0.04, 0, 0.07],
    lElbow: [-0.22, 0, 0],
    rShoulder: [0.04, 0, -0.07],
    rElbow: [-0.22, 0, 0],
    lHip: [0, 0, 0.04],
    lKnee: [0.06, 0, 0],
    rHip: [0, 0, -0.04],
    rKnee: [0.06, 0, 0],
  },
  drop: 0.012,
  feet: { l: [0.11, 0.02, 0.14], r: [-0.11, -0.02, -0.14] },
};

// ---- guarding -----------------------------------------------------------------------------------

/** High guard: both gloves at the temples, elbows in, chin behind the lead shoulder. */
export const BLOCK: Pose = g(
  { spine: [0.26, -0.2, 0], head: [0.22, 0.5, 0], lShoulder: [-1.05, -0.7, 0.05], lElbow: [-2.3, 0, 0], rShoulder: [-0.9, 0.75, -0.02], rElbow: [-2.4, 0, 0] },
  0.12,
  { shift: [0, -0.03] },
);
/** Low guard: elbows dropped to cover the ribs, lead forearm across the body, knees bent. */
export const BLOCK_LOW: Pose = g(
  { spine: [0.36, -0.25, 0], head: [0.2, 0.55, 0], lShoulder: [-0.45, -0.9, 0.05], lElbow: [-1.7, 0, 0], rShoulder: [-0.3, 0.8, -0.02], rElbow: [-2.15, 0, 0] },
  0.2,
  { shift: [0, -0.04] },
);

// ---- being hit ------------------------------------------------------------------------------------

/** Rocked by a shot to the head: weight on the back foot, chin still tucked, hands coming back up. */
export const HIT_HIGH: Pose = g(
  { hips: [0, -0.3, 0], spine: [-0.2, -0.38, 0.06], head: [-0.1, 0.5, 0.1], lShoulder: [-0.6, -0.4, 0.25], lElbow: [-1.7, 0, 0], rShoulder: [-0.3, 0.45, -0.2], rElbow: [-2.0, 0, 0] },
  0.1,
  { shift: [0, -0.1] },
);
/** Folded over a body shot: elbows pulled in to the stomach, hips back. */
export const HIT_MID: Pose = g(
  { hips: [0.08, -0.3, 0], spine: [0.5, -0.25, 0], head: [0.3, 0.45, 0], lShoulder: [-0.35, -0.75, 0.05], lElbow: [-1.75, 0, 0], rShoulder: [-0.2, 0.8, -0.05], rElbow: [-1.95, 0, 0] },
  0.16,
  { shift: [0, -0.12] },
);
/** Leg kicked: the knee buckles and the weight comes off it. */
export const HIT_LOW: Pose = g(
  { hips: [0, -0.35, 0.08], spine: [0.26, -0.3, -0.1], head: [0.12, 0.6, 0.06], lShoulder: [-0.6, -0.45, 0.3], lElbow: [-1.6, 0, 0], rShoulder: [-0.35, 0.5, -0.15], rElbow: [-2.1, 0, 0] },
  0.2,
  { shift: [-0.07, -0.06] },
);
export const HITSTUN = HIT_HIGH;

/** Hurt and unsteady: hands half up, head low, knees soft. The animator adds the sway and the stumbling steps. */
export const STAGGER: Pose = g(
  { hips: [0, -0.25, 0.04], spine: [0.12, -0.25, 0.08], head: [0.25, 0.4, 0.1], lShoulder: [-0.45, -0.3, 0.3], lElbow: [-1.35, 0, 0], rShoulder: [-0.25, 0.4, -0.25], rElbow: [-1.6, 0, 0] },
  0.17,
  { shift: [0.02, -0.08] },
);
export const STAGGER_MID: Pose = g(
  { hips: [0.06, -0.25, 0], spine: [0.55, -0.2, 0.06], head: [0.25, 0.4, 0], lShoulder: [-0.3, -0.8, 0.1], lElbow: [-1.6, 0, 0], rShoulder: [-0.15, 0.85, -0.05], rElbow: [-1.8, 0, 0] },
  0.2,
  { shift: [0, -0.1] },
);

/** Guard smashed open: hands knocked down and apart, chest exposed, rocked onto the heels. */
export const GUARD_BREAK: Pose = g(
  { hips: [0, -0.2, 0], spine: [-0.22, -0.15, 0], head: [-0.05, 0.3, 0], lShoulder: [-0.25, -0.1, 0.55], lElbow: [-1.0, 0, 0], rShoulder: [-0.15, 0.1, -0.55], rElbow: [-1.1, 0, 0] },
  0.12,
  { shift: [0, -0.12] },
);
/** Attack turned aside: the striking arm thrown wide, body opened up. */
export const PARRIED: Pose = g(
  { hips: [0, -0.15, 0], spine: [-0.18, 0.1, 0.08], head: [0, 0.2, 0], lShoulder: [-0.7, 0.1, 0.75], lElbow: [-0.9, 0, 0], rShoulder: [-0.3, 0.4, -0.3], rElbow: [-1.7, 0, 0] },
  0.1,
  { shift: [0, -0.06] },
);

// ---- falling, lying and getting up (legs as written) ---------------------------------------------

/** Halfway down: knees gone, chin tucked, arms coming out to break the fall. */
export const FALL_BACK: Pose = fk(
  { hips: [0, -0.1, 0], spine: [0.35, -0.1, 0], head: [0.45, 0.1, 0], lShoulder: [-1.1, 0, 0.5], lElbow: [-0.7, 0, 0], rShoulder: [-1.0, 0, -0.5], rElbow: [-0.8, 0, 0], lHip: [-0.9, 0, 0.12], lKnee: [1.3, 0, 0], rHip: [-0.6, 0, -0.12], rKnee: [1.2, 0, 0] },
  0.25,
  { pitch: -0.65 },
);
/** Hitting the floor: arms slap down either side, knees up. */
export const LAND_BACK: Pose = fk(
  { hips: [0, 0, 0], spine: [0.3, 0, 0], head: [0.4, 0, 0], lShoulder: [0.15, 0, 0.85], lElbow: [-0.35, 0, 0], rShoulder: [0.15, 0, -0.85], rElbow: [-0.35, 0, 0], lHip: [-1.0, 0, 0.15], lKnee: [1.5, 0, 0], rHip: [-0.75, 0, -0.15], rKnee: [1.3, 0, 0] },
  0,
  { pitch: -Math.PI / 2 },
);
/** Flat on the back. */
export const LYING: Pose = fk(
  { hips: [0, 0, 0], spine: [0.05, 0, 0], head: [0.15, 0.35, 0], lShoulder: [0.08, 0, 0.6], lElbow: [-0.5, 0, 0], rShoulder: [0.08, 0, -0.45], rElbow: [-0.9, 0, 0], lHip: [-0.12, 0, 0.16], lKnee: [0.3, 0, 0], rHip: [-0.5, 0, -0.12], rKnee: [1.0, 0, 0] },
  0,
  { pitch: -Math.PI / 2 },
);
/** Out cold: limp, head rolled to the side. */
export const LYING_KO: Pose = fk(
  { hips: [0, 0, 0], spine: [0, 0.08, 0], head: [0.05, 0.7, 0.1], lShoulder: [0.1, 0, 0.95], lElbow: [-0.3, 0, 0], rShoulder: [0.1, 0, -0.35], rElbow: [-0.15, 0, 0], lHip: [-0.05, 0, 0.22], lKnee: [0.12, 0, 0], rHip: [-0.2, 0, -0.2], rKnee: [0.45, 0, 0] },
  0,
  { pitch: -Math.PI / 2 },
);
/** Sitting up off the back: hands behind on the floor, knees drawn in. */
export const SIT_UP: Pose = fk(
  { hips: [0, 0, 0], spine: [0.75, -0.1, 0], head: [0.25, 0.1, 0], lShoulder: [0.75, 0, 0.3], lElbow: [-0.25, 0, 0], rShoulder: [0.75, 0, -0.3], rElbow: [-0.25, 0, 0], lHip: [-1.75, 0, 0.15], lKnee: [1.9, 0, 0], rHip: [-1.5, 0, -0.15], rKnee: [1.75, 0, 0] },
  0,
  { pitch: -1.0 },
);
/** Low crouch on the way up: one hand on the floor, feet under the hips. */
export const CROUCH_UP: Pose = {
  joints: { ...GUARD.joints, hips: [0, -0.3, 0], spine: [0.7, -0.2, 0], head: [-0.3, 0.4, 0], lShoulder: [-0.5, 0, 0.2], lElbow: [-0.5, 0, 0], rShoulder: [-0.6, 0.3, -0.1], rElbow: [-1.5, 0, 0] },
  drop: 0.46,
  feet: { l: [0.17, 0.14, -0.1], r: [-0.17, -0.12, -0.5, 0.06] },
  shift: [0, -0.02],
};
/** Pitching forwards (hit from behind): hands going out in front. */
export const FALL_FRONT: Pose = fk(
  { hips: [0, 0, 0], spine: [0.2, 0, 0], head: [-0.35, 0, 0], lShoulder: [-1.7, 0, 0.3], lElbow: [-0.9, 0, 0], rShoulder: [-1.7, 0, -0.3], rElbow: [-0.9, 0, 0], lHip: [-0.5, 0, 0.1], lKnee: [1.1, 0, 0], rHip: [-0.3, 0, -0.1], rKnee: [0.9, 0, 0] },
  0.2,
  { pitch: 0.7 },
);
/** Face down. */
export const LYING_FRONT: Pose = fk(
  { hips: [0, 0, 0], spine: [-0.08, 0, 0], head: [-0.25, 0.75, 0], lShoulder: [-2.5, 0, 0.5], lElbow: [-1.5, 0, 0], rShoulder: [-2.3, 0, -0.6], rElbow: [-1.7, 0, 0], lHip: [0.05, 0, 0.15], lKnee: [0.15, 0, 0], rHip: [0.05, 0, -0.2], rKnee: [0.35, 0, 0] },
  0,
  { pitch: Math.PI / 2 },
);
/** Pushing up off the chest onto the knees. */
export const PUSH_UP: Pose = fk(
  { hips: [0, 0, 0], spine: [-0.35, 0, 0], head: [-0.5, 0, 0], lShoulder: [-1.35, 0, 0.3], lElbow: [-0.3, 0, 0], rShoulder: [-1.35, 0, -0.3], rElbow: [-0.3, 0, 0], lHip: [-0.9, 0, 0.12], lKnee: [1.7, 0, 0], rHip: [-0.6, 0, -0.12], rKnee: [1.5, 0, 0] },
  0.15,
  { pitch: 1.1 },
);

// ---- in the air ---------------------------------------------------------------------------------

/** Going up: knees driving, arms lifting. */
export const JUMP: Pose = fk({ hips: [0, -0.3, 0], spine: [0.22, -0.3, 0], head: [0, 0.55, 0], lShoulder: [-1.0, -0.4, 0.15], lElbow: [-1.8, 0, 0], rShoulder: [-0.7, 0.5, -0.1], rElbow: [-2.0, 0, 0], lHip: [-1.1, 0, 0.1], lKnee: [1.6, 0, 0], rHip: [-0.5, 0, -0.1], rKnee: [1.5, 0, 0], lFoot: [0.3, 0, 0], rFoot: [0.4, 0, 0] });
/** Coming down: legs reaching for the floor, arms out for balance. */
export const JUMP_FALL: Pose = fk({ hips: [0, -0.3, 0], spine: [0.12, -0.3, 0], head: [0.1, 0.55, 0], lShoulder: [-0.7, -0.3, 0.4], lElbow: [-1.5, 0, 0], rShoulder: [-0.5, 0.4, -0.35], rElbow: [-1.7, 0, 0], lHip: [-0.5, 0, 0.14], lKnee: [0.6, 0, 0], rHip: [0.05, 0, -0.14], rKnee: [0.5, 0, 0], lFoot: [0.25, 0, 0], rFoot: [0.3, 0, 0] });

// ---- style stances -------------------------------------------------------------------------------

/** Each style's stance: how it stands, moves and holds its hands. */
export const STANCES: Record<string, Pose> = {
  // Scrapper: squarer, hands lower and looser, chin not tucked as well.
  street: {
    ...g({ hips: [0, -0.3, 0], spine: [0.12, -0.22, 0], head: [0.04, 0.48, 0], lShoulder: [-0.65, -0.4, 0.14], lElbow: [-1.75, 0, 0], rShoulder: [-0.3, 0.45, -0.1], rElbow: [-2.1, 0, 0] }, 0.06),
    feet: { l: [0.17, 0.2, -0.05], r: [-0.18, -0.22, -0.6, 0.02] },
  },
  // Boxer: compact, crouched, gloves high and tight, weight on the balls of the feet.
  boxing: {
    ...g({ spine: [0.24, -0.3, 0], head: [0.16, 0.66, 0], lShoulder: [-0.9, -0.6, 0.06], lElbow: [-2.15, 0, 0], rShoulder: [-0.55, 0.7, -0.03], rElbow: [-2.4, 0, 0] }, 0.11),
    feet: { l: [0.14, 0.22, -0.2, 0.015], r: [-0.15, -0.24, -0.8, 0.05] },
  },
  kickboxing: GUARD,
  // Thai: tall and square, hands high and forward, weight back so the lead leg is light.
  muay_thai: {
    ...g({ hips: [0, -0.18, 0], spine: [0.04, -0.14, 0], head: [0.06, 0.3, 0], lShoulder: [-1.15, -0.45, 0.12], lElbow: [-1.75, 0, 0], rShoulder: [-0.95, 0.5, -0.1], rElbow: [-1.95, 0, 0] }, 0.03, { shift: [0, -0.07] }),
    feet: { l: [0.13, 0.2, 0, 0.03], r: [-0.14, -0.18, -0.5] },
  },
  // Karate: long and side-on, lead hand out as a range-finder, rear fist at the hip-rib.
  karate: {
    ...g({ hips: [0, -0.8, 0], spine: [0.06, -0.4, 0], head: [0.04, 1.15, 0], lShoulder: [-0.95, -0.25, 0.1], lElbow: [-1.05, 0, 0], rShoulder: [0.1, 0.5, -0.12], rElbow: [-1.9, 0, 0] }, 0.13),
    feet: { l: [0.07, 0.36, -0.15], r: [-0.1, -0.36, -1.1] },
  },
  // Wrestler: low, head up, hands out in front ready to shoot or sprawl.
  wrestling: {
    ...g({ hips: [0.1, -0.25, 0], spine: [0.5, -0.15, 0], head: [-0.45, 0.35, 0], lShoulder: [-1.15, -0.3, 0.2], lElbow: [-1.25, 0, 0], rShoulder: [-1.05, 0.3, -0.2], rElbow: [-1.35, 0, 0] }, 0.24),
    feet: { l: [0.21, 0.2, 0], r: [-0.22, -0.2, -0.45, 0.03] },
  },
  bjj: {
    ...g({ hips: [0.06, -0.3, 0], spine: [0.4, -0.2, 0], head: [-0.32, 0.45, 0], lShoulder: [-0.85, -0.35, 0.18], lElbow: [-1.35, 0, 0], rShoulder: [-0.7, 0.4, -0.15], rElbow: [-1.5, 0, 0] }, 0.19),
    feet: { l: [0.19, 0.2, -0.05], r: [-0.2, -0.2, -0.5, 0.03] },
  },
};

// ---- grappling and defence -------------------------------------------------------------------------

const CLINCH_ARMS: J = { lShoulder: [-1.5, -0.35, 0.05], lElbow: [-1.15, 0, 0], rShoulder: [-1.5, 0.35, -0.05], rElbow: [-1.15, 0, 0] };
export const CLINCH_HOLD: Pose = g({ ...CLINCH_ARMS, spine: [0.25, -0.2, 0], head: [0.1, 0.4, 0] }, 0.09, { shift: [0, 0.04] });
export const CLINCHED: Pose = g({ hips: [0.05, -0.2, 0], spine: [0.6, -0.15, 0], head: [0.3, 0.2, 0], lShoulder: [-1.0, -0.7, 0.05], lElbow: [-2.2, 0, 0], rShoulder: [-0.9, 0.75, -0.02], rElbow: [-2.3, 0, 0] }, 0.16);
export const MOUNT: Pose = fk({ hips: [0, 0, 0], spine: [0.45, 0, 0], head: [0.2, 0, 0], lShoulder: [-0.9, -0.3, 0.1], lElbow: [-1.5, 0, 0], rShoulder: [-0.8, 0.3, -0.1], rElbow: [-1.6, 0, 0], lHip: [-1.5, 0, 0.4], lKnee: [2.3, 0, 0], rHip: [-1.5, 0, -0.4], rKnee: [2.3, 0, 0] }, 0.55);
export const DODGE_BACK: Pose = g({ spine: [-0.22, -0.4, 0], head: [-0.05, 0.6, 0] }, 0.14, { shift: [0, -0.1] });
export const DODGE_SIDE: Pose = g({ spine: [0.2, -0.4, 0.3], head: [0.05, 0.6, -0.2] }, 0.18);
export const SLIP: Pose = g({ hips: [0, -0.55, 0.08], spine: [0.4, -0.5, 0.35], head: [0.2, 0.7, -0.25] }, 0.22, { shift: [-0.06, 0.02] });

// ---- attacks -----------------------------------------------------------------------------------------

const mp = (chamber: Pose, strike: Pose) => ({ chamber, strike });
/** Rear foot pivoted in with the heel up: the hip has turned through the punch. */
const PIVOT = { l: STANCE_FEET.l, r: [-0.16, -0.24, -0.15, 0.08] as FootSpec };
/** Lead foot turned out with the heel up: the hip has turned through a lead hook. */
const LEAD_PIVOT = { l: [0.15, 0.24, -0.85, 0.07] as FootSpec, r: STANCE_FEET.r };
/** Standing on the rear leg (lead-leg kicks). */
const ON_REAR = (yaw = -0.9): Pose['feet'] => ({ r: [-0.08, -0.12, yaw] });
/** Standing on the lead leg (rear-leg kicks), turned out as the hip comes over. */
const ON_LEAD = (yaw = 0.5): Pose['feet'] => ({ l: [0.08, 0.14, yaw, 0.03] });
const REAR_GUARD: J = { rShoulder: [-0.5, 0.6, -0.05], rElbow: [-2.35, 0, 0] };
const LEAD_GUARD: J = { lShoulder: [-0.85, -0.6, 0.08], lElbow: [-2.2, 0, 0] };

const JAB = mp(
  g({ spine: [0.14, -0.2, 0], lShoulder: [-0.75, -0.5, 0.06], lElbow: [-2.2, 0, 0] }),
  g({ hips: [0, -0.6, 0], spine: [0.16, -0.5, 0], head: [0.1, 1.02, 0], lShoulder: [-1.5, -0.25, 0], lElbow: [-0.1, 0, 0], ...REAR_GUARD }, 0.09, { shift: [0, 0.07] }),
);
const CROSS = mp(
  g({ hips: [0, -0.55, 0], spine: [0.14, -0.42, 0], head: [0.1, 0.9, 0], rShoulder: [-0.3, 0.5, -0.1], rElbow: [-2.4, 0, 0] }, 0.09, { shift: [0, -0.03] }),
  { ...g({ hips: [0, 0.2, 0], spine: [0.2, 0.45, 0], head: [0.1, -0.6, 0], rShoulder: [-1.52, 0.2, 0.05], rElbow: [-0.1, 0, 0], ...LEAD_GUARD }, 0.11, { shift: [0, 0.12] }), feet: PIVOT },
);
const REAR_HOOK = mp(
  g({ hips: [0, -0.55, 0], spine: [0.12, -0.5, 0], head: [0.1, 0.95, 0], rShoulder: [-0.75, 0.3, -0.75], rElbow: [-1.7, 0, 0] }, 0.1, { shift: [0, -0.03] }),
  { ...g({ hips: [0, 0.3, 0], spine: [0.16, 0.55, 0], head: [0.1, -0.8, 0], rShoulder: [-1.4, 1.3, -0.05], rElbow: [-1.5, 0, 0], ...LEAD_GUARD }, 0.1, { shift: [0, 0.08] }), feet: PIVOT },
);
const LEAD_HOOK = mp(
  g({ hips: [0, -0.2, 0], spine: [0.14, 0.05, 0], head: [0.1, 0.1, 0], lShoulder: [-0.8, -0.3, 0.8], lElbow: [-1.7, 0, 0] }, 0.1, { shift: [0.03, 0.04] }),
  { ...g({ hips: [0, -0.85, 0], spine: [0.14, -0.75, 0], head: [0.1, 1.4, 0], lShoulder: [-1.4, -1.3, 0.05], lElbow: [-1.5, 0, 0], ...REAR_GUARD }, 0.1, { shift: [-0.03, 0.02] }), feet: LEAD_PIVOT },
);
const HAYMAKER = mp(
  g({ hips: [0, -0.7, 0], spine: [0.02, -0.7, -0.08], head: [0.08, 1.2, 0], rShoulder: [-0.5, 0, -1.25], rElbow: [-1.2, 0, 0], lShoulder: [-0.7, -0.4, 0.2], lElbow: [-1.6, 0, 0] }, 0.1, { shift: [0, -0.06] }),
  { ...g({ hips: [0, 0.4, 0], spine: [0.3, 0.6, 0.06], head: [0.05, -0.9, 0], rShoulder: [-1.45, 1.0, -0.15], rElbow: [-0.9, 0, 0], lShoulder: [-0.5, -0.5, 0.3], lElbow: [-1.7, 0, 0] }, 0.14, { shift: [0, 0.14] }), feet: PIVOT },
);
const UPPERCUT = mp(
  g({ hips: [0, -0.5, 0], spine: [0.32, -0.4, -0.1], head: [0.05, 0.85, 0], rShoulder: [0.1, 0.3, -0.15], rElbow: [-1.75, 0, 0] }, 0.22, { shift: [0, 0] }),
  { ...g({ hips: [0, 0.15, 0], spine: [-0.06, 0.4, 0], head: [0.12, -0.5, 0], rShoulder: [-1.25, 0.35, 0.1], rElbow: [-1.9, 0, 0], ...LEAD_GUARD }, 0.02, { shift: [0, 0.08] }), feet: PIVOT },
);
const OVERHAND = mp(
  g({ hips: [0, -0.6, 0], spine: [0.0, -0.55, -0.15], head: [0.1, 1.05, 0], rShoulder: [-1.9, 0.2, -0.75], rElbow: [-1.6, 0, 0] }, 0.08, { shift: [0, -0.04] }),
  { ...g({ hips: [0, 0.3, 0], spine: [0.42, 0.5, 0.22], head: [-0.05, -0.75, -0.1], rShoulder: [-1.6, 0.8, -0.2], rElbow: [-0.6, 0, 0], ...LEAD_GUARD }, 0.17, { shift: [0.04, 0.14] }), feet: PIVOT },
);
const BODY_SHOT = mp(
  g({ hips: [0, -0.2, 0], spine: [0.34, -0.05, 0.12], head: [0.0, 0.2, 0], lShoulder: [-0.2, -0.3, 0.45], lElbow: [-1.6, 0, 0] }, 0.22, { shift: [0.04, 0.03] }),
  { ...g({ hips: [0, -0.75, 0], spine: [0.34, -0.6, 0.1], head: [0.0, 1.2, 0], lShoulder: [-0.85, -1.1, 0.15], lElbow: [-1.55, 0, 0], ...REAR_GUARD }, 0.2, { shift: [0, 0.05] }), feet: LEAD_PIVOT },
);

const FRONT_KICK = mp(
  { ...g({ spine: [0.05, -0.3, 0], head: [0.1, 0.6, 0], lHip: [-1.5, 0, 0.05], lKnee: [1.9, 0, 0], lFoot: [-0.3, 0, 0], lShoulder: [-0.6, -0.4, 0.2], lElbow: [-1.7, 0, 0] }, 0.02, { shift: [-0.05, -0.08] }), feet: ON_REAR() },
  { ...g({ hips: [-0.12, -0.42, 0], spine: [-0.18, -0.3, 0], head: [0.3, 0.6, 0], lHip: [-1.45, 0, 0.05], lKnee: [0.12, 0, 0], lFoot: [-0.45, 0, 0], lShoulder: [-0.3, -0.2, 0.35], lElbow: [-1.3, 0, 0] }, 0.01, { shift: [-0.05, -0.02] }), feet: ON_REAR() },
);
/** Rear-leg front kick: the rear hip drives through and the kick goes straight up the middle. */
const REAR_FRONT_KICK = mp(
  { ...g({ hips: [0, 0.35, 0], spine: [0.05, 0.1, 0], head: [0.1, -0.3, 0], rHip: [-1.55, 0, -0.05], rKnee: [2.0, 0, 0], rFoot: [-0.3, 0, 0], ...LEAD_GUARD }, 0.02, { shift: [0.05, 0.04] }), feet: ON_LEAD(0.35) },
  { ...g({ hips: [-0.12, 0.6, 0], spine: [-0.2, 0.15, 0], head: [0.3, -0.6, 0], rHip: [-1.45, 0, -0.05], rKnee: [0.12, 0, 0], rFoot: [-0.45, 0, 0], rShoulder: [-0.2, 0.2, -0.35], rElbow: [-1.2, 0, 0], ...LEAD_GUARD }, 0.01, { shift: [0.06, 0.06] }), feet: ON_LEAD(0.6) },
);
const TEEP = FRONT_KICK;
const ROUNDHOUSE = mp(
  { ...g({ hips: [0, 0.35, 0], spine: [-0.05, 0.1, 0.1], head: [0.1, -0.3, 0], rHip: [-1.0, 0, -0.9], rKnee: [1.9, 0, 0], rFoot: [0.5, 0, 0], rShoulder: [-0.6, 0.5, -0.3], rElbow: [-1.8, 0, 0] }, 0.03, { shift: [0.06, 0.06] }), feet: ON_LEAD(0.5) },
  { ...g({ hips: [0, 1.25, -0.45], spine: [-0.35, 0.25, 0.75], head: [0.3, -1.2, -0.45], rHip: [-1.45, 0, -0.95], rKnee: [0.15, 0, 0], rFoot: [0.7, 0, 0], rShoulder: [0.55, 0.1, -0.35], rElbow: [-0.35, 0, 0], ...LEAD_GUARD }, 0.04, { shift: [0.12, 0.0] }), feet: ON_LEAD(1.4) },
);
const LEAD_ROUNDHOUSE = mp(
  { ...g({ hips: [0, -0.9, 0], spine: [-0.05, -0.5, -0.1], head: [0.1, 1.3, 0], lHip: [-1.0, 0, 0.9], lKnee: [1.9, 0, 0], lFoot: [0.5, 0, 0] }, 0.03, { shift: [-0.06, -0.08] }), feet: ON_REAR(-1.2) },
  { ...g({ hips: [0, -1.6, 0.15], spine: [-0.3, -0.35, -0.3], head: [0.25, 1.7, 0.1], lHip: [-1.5, 0, 1.2], lKnee: [0.15, 0, 0], lFoot: [0.7, 0, 0], lShoulder: [0.3, -0.2, 0.5], lElbow: [-0.6, 0, 0], ...REAR_GUARD }, 0.02, { shift: [-0.08, -0.04] }), feet: ON_REAR(-1.9) },
);
const LOW_KICK = mp(
  { ...g({ hips: [0, 0.3, 0], spine: [0.05, 0.1, 0], head: [0.1, -0.25, 0], rHip: [-0.5, 0, -0.6], rKnee: [1.3, 0, 0], rFoot: [0.4, 0, 0] }, 0.08, { shift: [0.06, 0.06] }), feet: ON_LEAD(0.4) },
  { ...g({ hips: [0, 1.0, -0.08], spine: [-0.1, 0.15, 0.15], head: [0.15, -0.95, 0], rHip: [-0.85, 0, -0.75], rKnee: [0.2, 0, 0], rFoot: [0.6, 0, 0], rShoulder: [0.1, 0.3, -0.4], rElbow: [-0.9, 0, 0], ...LEAD_GUARD }, 0.1, { shift: [0.08, 0.04] }), feet: ON_LEAD(1.1) },
);
const SIDE_KICK = mp(
  { ...g({ hips: [0, -1.1, 0], spine: [0.1, -0.3, 0], head: [0.05, 1.35, 0], lHip: [-1.5, 0, 0.3], lKnee: [2.0, 0, 0], lFoot: [-0.3, 0, 0] }, 0.03, { shift: [-0.04, -0.1] }), feet: ON_REAR(-1.5) },
  { ...g({ hips: [0, -1.35, 0.3], spine: [-0.1, -0.2, -0.5], head: [0.15, 1.5, 0.3], lHip: [-0.5, 0, 1.25], lKnee: [0.1, 0, 0], lFoot: [-0.4, 0, 0], lShoulder: [-0.3, -0.3, 0.5], lElbow: [-1.0, 0, 0] }, 0.02, { shift: [-0.06, -0.08] }), feet: ON_REAR(-1.9) },
);
const AXE_KICK = mp(
  { ...g({ hips: [0, 0.2, 0], spine: [-0.3, 0.1, 0], head: [0.3, -0.2, 0], rHip: [-2.2, 0, -0.15], rKnee: [0.2, 0, 0], rFoot: [-0.3, 0, 0] }, 0, { shift: [0.05, 0.02] }), feet: ON_LEAD(0.3) },
  { ...g({ hips: [0, 0.2, 0], spine: [0.2, 0.2, 0], head: [0.1, -0.3, 0], rHip: [-1.1, 0, -0.1], rKnee: [0.15, 0, 0], rFoot: [-0.3, 0, 0] }, 0.06, { shift: [0.05, 0.08] }), feet: ON_LEAD(0.3) },
);
const KNEE = mp(
  { ...g({ ...CLINCH_ARMS, hips: [0, 0.1, 0], spine: [0.15, 0.1, 0], head: [0.1, -0.1, 0], rHip: [-0.4, 0, -0.1], rKnee: [1.9, 0, 0], rFoot: [0.6, 0, 0] }, 0.04, { shift: [0.05, 0.06] }), feet: ON_LEAD(0.3) },
  { ...g({ lShoulder: [-1.2, -0.4, 0.05], lElbow: [-1.6, 0, 0], rShoulder: [-1.2, 0.4, -0.05], rElbow: [-1.6, 0, 0], hips: [-0.3, 0.45, 0], spine: [-0.05, 0.15, 0], head: [0.3, -0.5, 0], rHip: [-1.75, 0, -0.05], rKnee: [2.3, 0, 0], rFoot: [0.7, 0, 0] }, 0, { shift: [0.05, 0.12] }), feet: { l: [0.08, 0.14, 0.3, 0.06] } },
);
const ELBOW = mp(
  g({ hips: [0, -0.55, 0], spine: [0.1, -0.5, 0], head: [0.1, 1.0, 0], rShoulder: [-1.0, 0.4, -0.9], rElbow: [-2.5, 0, 0] }, 0.08),
  { ...g({ hips: [0, 0.3, 0], spine: [0.2, 0.55, 0], head: [0.1, -0.8, 0], rShoulder: [-1.5, 1.2, 0.1], rElbow: [-2.5, 0, 0], ...LEAD_GUARD }, 0.1, { shift: [0, 0.12] }), feet: PIVOT },
);
const SPIN_BACKFIST = mp(
  g({ hips: [0, -1.5, 0], spine: [0.05, -0.9, 0], head: [0.05, 1.6, 0], rShoulder: [-1.2, 0.9, 0.2], rElbow: [-1.9, 0, 0] }, 0.08, { feet: { l: [0.1, 0.2, -1.0, 0.04], r: [-0.1, -0.2, -1.6, 0.04] } }),
  { ...g({ hips: [0, 0.9, 0], spine: [0.08, 0.8, 0], head: [0.05, -1.3, 0], rShoulder: [-1.5, 0, -1.2], rElbow: [-0.25, 0, 0], ...LEAD_GUARD }, 0.08), feet: PIVOT },
);
const HEADBUTT = mp(
  g({ spine: [-0.25, -0.25, 0], head: [-0.35, 0.5, 0], lShoulder: [-1.1, -0.3, 0.15], lElbow: [-1.3, 0, 0], rShoulder: [-1.0, 0.3, -0.15], rElbow: [-1.4, 0, 0] }, 0.08, { shift: [0, -0.05] }),
  g({ spine: [0.55, -0.2, 0], head: [0.45, 0.4, 0], lShoulder: [-1.2, -0.3, 0.2], lElbow: [-1.0, 0, 0], rShoulder: [-1.1, 0.3, -0.2], rElbow: [-1.1, 0, 0] }, 0.12, { shift: [0, 0.14] }),
);
const SHOVE = mp(
  g({ hips: [0, -0.15, 0], spine: [0.1, -0.1, 0], head: [0.05, 0.25, 0], lShoulder: [-0.9, -0.2, 0.1], lElbow: [-2.0, 0, 0], rShoulder: [-0.9, 0.2, -0.1], rElbow: [-2.0, 0, 0] }, 0.1, { shift: [0, -0.04] }),
  g({ hips: [0, -0.15, 0], spine: [0.32, -0.1, 0], head: [-0.1, 0.25, 0], lShoulder: [-1.45, -0.1, 0.05], lElbow: [-0.2, 0, 0], rShoulder: [-1.45, 0.1, -0.05], rElbow: [-0.2, 0, 0] }, 0.1, { shift: [0, 0.14] }),
);
const GRAB = mp(
  g({ hips: [0, -0.15, 0], spine: [0.2, -0.1, 0], head: [0, 0.25, 0], lShoulder: [-1.1, -0.2, 0.3], lElbow: [-1.2, 0, 0], rShoulder: [-1.1, 0.2, -0.3], rElbow: [-1.2, 0, 0] }, 0.1),
  g({ hips: [0, -0.15, 0], spine: [0.35, -0.1, 0], head: [-0.1, 0.25, 0], lShoulder: [-1.45, -0.3, 0.1], lElbow: [-0.7, 0, 0], rShoulder: [-1.45, 0.3, -0.1], rElbow: [-0.7, 0, 0] }, 0.12, { shift: [0, 0.12] }),
);
const SHOOT = mp(
  g({ hips: [0.1, -0.2, 0], spine: [0.6, -0.15, 0], head: [-0.5, 0.3, 0], lShoulder: [-0.8, -0.2, 0.2], lElbow: [-1.0, 0, 0], rShoulder: [-0.8, 0.2, -0.2], rElbow: [-1.0, 0, 0] }, 0.34),
  { ...g({ hips: [0.25, -0.1, 0], spine: [0.8, -0.05, 0], head: [-0.7, 0.1, 0], lShoulder: [-1.5, -0.2, 0.25], lElbow: [-0.5, 0, 0], rShoulder: [-1.5, 0.2, -0.25], rElbow: [-0.5, 0, 0] }, 0.5, { shift: [0, 0.2] }), feet: { l: [0.17, 0.35, 0], r: [-0.18, -0.4, -0.3, 0.1] } },
);
const TAKEDOWN = mp(CLINCH_HOLD, g({ hips: [0.2, 0.2, 0], spine: [0.75, 0.25, 0], head: [-0.4, -0.2, 0], ...CLINCH_ARMS }, 0.42, { shift: [0, 0.15] }));
const GETUP_KICK = mp(
  { ...CROUCH_UP, joints: { ...CROUCH_UP.joints, lHip: [-1.3, 0, 0.1], lKnee: [1.8, 0, 0] }, feet: { r: [-0.1, -0.1, -0.8] } },
  { ...g({ hips: [-0.1, -0.4, 0], spine: [0.0, -0.3, 0], head: [0.2, 0.6, 0], lHip: [-1.25, 0, 0.05], lKnee: [0.12, 0, 0], lFoot: [-0.4, 0, 0] }, 0.2, { shift: [-0.04, -0.06] }), feet: { r: [-0.1, -0.1, -0.8] } },
);
const FINISHER = mp(HAYMAKER.chamber, {
  ...g({ hips: [0, 0.5, 0], spine: [0.42, 0.7, 0.08], head: [0, -1.05, 0], rShoulder: [-1.5, 0.5, 0], rElbow: [-0.12, 0, 0], lShoulder: [-0.4, -0.5, 0.35], lElbow: [-1.7, 0, 0] }, 0.18, { shift: [0, 0.18] }),
  feet: PIVOT,
});

/** Chamber (wind-up) and strike poses for every animation key. Moves pick one with `anim`; a `key:limb` entry wins for that limb. */
export const ANIM_POSES: Record<string, { chamber: Pose; strike: Pose }> = {
  jab: JAB,
  cross: CROSS,
  hook: REAR_HOOK,
  'hook:leadHand': LEAD_HOOK,
  haymaker: HAYMAKER,
  uppercut: UPPERCUT,
  overhand: OVERHAND,
  'overhand:leadHand': { chamber: BODY_SHOT.chamber, strike: LEAD_HOOK.strike },
  body_shot: BODY_SHOT,
  front_kick: FRONT_KICK,
  teep: TEEP,
  roundhouse: ROUNDHOUSE,
  'roundhouse:leadFoot': LEAD_ROUNDHOUSE,
  'front_kick:rearFoot': REAR_FRONT_KICK,
  spin_kick: ROUNDHOUSE,
  low_kick: LOW_KICK,
  side_kick: SIDE_KICK,
  axe_kick: AXE_KICK,
  knee: KNEE,
  elbow: ELBOW,
  spin_backfist: SPIN_BACKFIST,
  headbutt: HEADBUTT,
  shove: SHOVE,
  grab: GRAB,
  shoot: SHOOT,
  takedown: TAKEDOWN,
  getup_kick: GETUP_KICK,
  clinch_knee: mp(
    { ...g({ ...CLINCH_ARMS, rHip: [-0.3, 0, -0.1], rKnee: [1.6, 0, 0], rFoot: [0.5, 0, 0] }, 0.06, { shift: [0.05, 0.04] }), feet: ON_LEAD(0.2) },
    { ...g({ ...CLINCH_ARMS, hips: [-0.25, 0.3, 0], spine: [0.1, 0.1, 0], rHip: [-1.65, 0, -0.05], rKnee: [2.2, 0, 0], rFoot: [0.7, 0, 0] }, 0.02, { shift: [0.05, 0.1] }), feet: { l: [0.08, 0.14, 0.2, 0.05] } },
  ),
  clinch_uppercut: mp(
    g({ lShoulder: CLINCH_ARMS.lShoulder, lElbow: CLINCH_ARMS.lElbow, spine: [0.3, -0.35, -0.08], rShoulder: [0.05, 0.3, -0.15], rElbow: [-1.8, 0, 0] }, 0.16),
    { ...g({ lShoulder: CLINCH_ARMS.lShoulder, lElbow: CLINCH_ARMS.lElbow, hips: [0, 0.1, 0], spine: [0.0, 0.35, 0], head: [0.1, -0.4, 0], rShoulder: [-1.3, 0.35, 0.1], rElbow: [-1.85, 0, 0] }, 0.04), feet: PIVOT },
  ),
  clinch_headbutt: mp(g({ ...CLINCH_ARMS, spine: [-0.15, -0.2, 0], head: [-0.4, 0.4, 0] }), g({ ...CLINCH_ARMS, spine: [0.5, -0.2, 0], head: [0.5, 0.4, 0] }, 0.1, { shift: [0, 0.08] })),
  clinch_elbow: mp(
    g({ lShoulder: CLINCH_ARMS.lShoulder, lElbow: CLINCH_ARMS.lElbow, spine: [0.1, -0.5, 0], rShoulder: [-1.9, 0.3, -0.6], rElbow: [-2.5, 0, 0] }),
    { ...g({ lShoulder: CLINCH_ARMS.lShoulder, lElbow: CLINCH_ARMS.lElbow, hips: [0, 0.2, 0], spine: [0.3, 0.45, 0.1], head: [0.1, -0.6, 0], rShoulder: [-1.4, 1.1, 0.1], rElbow: [-2.5, 0, 0] }, 0.1), feet: PIVOT },
  ),
  throw: mp(
    g({ ...CLINCH_ARMS, hips: [0, -0.7, 0], spine: [0.3, -0.6, 0], head: [0, 1.0, 0] }, 0.2),
    { ...g({ ...CLINCH_ARMS, hips: [0, 1.2, 0], spine: [0.35, 1.0, 0.2], head: [0, -1.2, 0] }, 0.16), feet: { l: [0.15, 0.2, 0.9, 0.05], r: [-0.16, -0.2, 0.4, 0.07] } },
  ),
  ground_punch: mp(
    fk({ ...MOUNT.joints, spine: [0.3, -0.3, 0], rShoulder: [-2.3, 0.2, -0.3], rElbow: [-1.7, 0, 0] }, 0.55),
    fk({ ...MOUNT.joints, spine: [0.8, 0.3, 0], rShoulder: [-1.0, 0.3, 0], rElbow: [-0.15, 0, 0] }, 0.6),
  ),
  submission: mp(MOUNT, fk({ ...MOUNT.joints, spine: [1.0, 0, 0], lShoulder: [-1.4, -0.6, 0], lElbow: [-1.8, 0, 0], rShoulder: [-1.4, 0.6, 0], rElbow: [-1.8, 0, 0] }, 0.62)),
  finisher: FINISHER,
};

/** The chamber and strike poses for a move (a limb-specific pair if there is one). */
export function animPoses(anim: string, limb: string): { chamber: Pose; strike: Pose } | undefined {
  return ANIM_POSES[`${anim}:${limb}`] ?? ANIM_POSES[anim];
}

// ---- blending -----------------------------------------------------------------------------------------

const ZERO: Vec3 = [0, 0, 0];
const ZERO2: [number, number] = [0, 0];

function lerpFoot(a: FootSpec | undefined, b: FootSpec | undefined, t: number): FootSpec | undefined {
  if (!a || !b) return t < 0.5 ? a : b;
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, (a[3] ?? 0) + ((b[3] ?? 0) - (a[3] ?? 0)) * t];
}

export function lerpPose(a: Pose, b: Pose, t: number): Pose {
  const joints: Partial<Record<JointName, Vec3>> = {};
  for (const j of JOINTS) {
    const va = a.joints[j] ?? ZERO;
    const vb = b.joints[j] ?? ZERO;
    joints[j] = [va[0] + (vb[0] - va[0]) * t, va[1] + (vb[1] - va[1]) * t, va[2] + (vb[2] - va[2]) * t];
  }
  const sa = a.shift ?? ZERO2;
  const sb = b.shift ?? ZERO2;
  const feet = a.feet || b.feet ? { l: lerpFoot(a.feet?.l, b.feet?.l, t), r: lerpFoot(a.feet?.r, b.feet?.r, t) } : undefined;
  return {
    joints,
    drop: (a.drop ?? 0) + ((b.drop ?? 0) - (a.drop ?? 0)) * t,
    pitch: (a.pitch ?? 0) + ((b.pitch ?? 0) - (a.pitch ?? 0)) * t,
    shift: [sa[0] + (sb[0] - sa[0]) * t, sa[1] + (sb[1] - sa[1]) * t],
    feet,
    ik: (a.ik ?? 1) + ((b.ik ?? 1) - (a.ik ?? 1)) * t,
  };
}

/**
 * The kinetic chain: how far behind the hips each joint moves, as a share of the move. Into a strike,
 * the hips turn first, the trunk and shoulders follow, and the elbow or knee snaps out last, like a
 * whip. Every joint still arrives at t = 1, so the impact frame doesn't move. (`reverse` runs it the
 * other way, limb first; it isn't used for recovery because the hips then catch up too fast.)
 */
const CHAIN_DELAY: Record<JointName, number> = {
  // Feet stay with the leg: the knee carries the snap.
  hips: 0, lHip: 0.04, rHip: 0.04, spine: 0.08, head: 0.1, lShoulder: 0.14, rShoulder: 0.14, lKnee: 0.18, rKnee: 0.18, lElbow: 0.24, rElbow: 0.24, lFoot: 0, rFoot: 0,
};

/** lerpPose, but each joint follows the kinetic chain (`reverse` for recovering: limbs first). */
export function lerpPoseChain(a: Pose, b: Pose, t: number, ease: (x: number) => number, amount = 1, reverse = false): Pose {
  const base = lerpPose(a, b, ease(t));
  const joints = { ...base.joints };
  for (const j of JOINTS) {
    const d = (reverse ? 0.24 - CHAIN_DELAY[j] : CHAIN_DELAY[j]) * amount;
    const k = ease(Math.max(0, Math.min(1, (t - d) / (1 - d))));
    const va = a.joints[j] ?? ZERO;
    const vb = b.joints[j] ?? ZERO;
    joints[j] = [va[0] + (vb[0] - va[0]) * k, va[1] + (vb[1] - va[1]) * k, va[2] + (vb[2] - va[2]) * k];
  }
  return { ...base, joints };
}

export function easeOut(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

export function easeIn(t: number): number {
  return t * t;
}

export function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}
