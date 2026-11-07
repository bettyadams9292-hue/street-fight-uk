/**
 * Key poses for the TEMPORARY procedural fighter rig. Stage 2 replaces the
 * rig and these poses with skinned GLB characters and real animation clips;
 * the simulation does not depend on any of this.
 *
 * Angles are radians. Arms and legs hang straight down at 0; a negative X
 * rotation swings a limb forward, a positive knee/elbow X bends it.
 * The fighter's forward is local +Z, its lead (left) side is local +X.
 */
export const JOINTS = ['hips', 'spine', 'head', 'lShoulder', 'lElbow', 'rShoulder', 'rElbow', 'lHip', 'lKnee', 'rHip', 'rKnee'] as const;
export type JointName = (typeof JOINTS)[number];
export type Vec3 = [number, number, number];

export interface Pose {
  joints: Partial<Record<JointName, Vec3>>;
  /** Lowers the hips (m), e.g. knees bent. */
  drop?: number;
  /** Whole-body pitch around the feet (radians, negative = falling backwards). */
  pitch?: number;
}

export const GUARD: Pose = {
  joints: {
    hips: [0, -0.35, 0],
    spine: [0.1, -0.45, 0],
    head: [-0.05, 0.7, 0],
    lShoulder: [-0.95, 0, -0.35],
    lElbow: [-1.85, 0, 0],
    rShoulder: [-0.8, 0, 0.45],
    rElbow: [-2.1, 0, 0],
    lHip: [-0.3, 0, 0.06],
    lKnee: [0.35, 0, 0],
    rHip: [0.3, 0, -0.06],
    rKnee: [0.45, 0, 0],
  },
  drop: 0.05,
};

export const BLOCK: Pose = {
  joints: {
    hips: [0, -0.3, 0],
    spine: [0.28, -0.25, 0],
    head: [0.25, 0.25, 0],
    lShoulder: [-1.2, 0, -0.5],
    lElbow: [-2.2, 0, 0],
    rShoulder: [-1.1, 0, 0.55],
    rElbow: [-2.3, 0, 0],
    lHip: [-0.35, 0, 0.08],
    lKnee: [0.55, 0, 0],
    rHip: [0.35, 0, -0.08],
    rKnee: [0.6, 0, 0],
  },
  drop: 0.1,
};

export const HITSTUN: Pose = {
  joints: {
    hips: [0, -0.3, 0],
    spine: [-0.35, -0.45, 0.1],
    head: [-0.45, 0.6, 0.15],
    lShoulder: [-0.5, 0, 0.35],
    lElbow: [-1.4, 0, 0],
    rShoulder: [-0.4, 0, -0.35],
    rElbow: [-1.6, 0, 0],
    lHip: [-0.2, 0, 0.06],
    lKnee: [0.3, 0, 0],
    rHip: [0.35, 0, -0.06],
    rKnee: [0.5, 0, 0],
  },
  drop: 0.06,
};

export const STAGGER: Pose = {
  joints: {
    hips: [0, -0.2, 0.1],
    spine: [-0.55, -0.3, 0.2],
    head: [-0.55, 0.5, 0.25],
    lShoulder: [-0.25, 0, 0.6],
    lElbow: [-0.6, 0, 0],
    rShoulder: [-0.2, 0, -0.6],
    rElbow: [-0.7, 0, 0],
    lHip: [-0.4, 0, 0.1],
    lKnee: [0.7, 0, 0],
    rHip: [0.4, 0, -0.1],
    rKnee: [0.7, 0, 0],
  },
  drop: 0.14,
};

export const GUARD_BREAK: Pose = {
  joints: {
    hips: [0, 0, 0],
    spine: [-0.45, 0, 0],
    head: [-0.35, 0, 0],
    lShoulder: [-0.4, 0, 1.25],
    lElbow: [-0.4, 0, 0],
    rShoulder: [-0.4, 0, -1.25],
    rElbow: [-0.4, 0, 0],
    lHip: [-0.3, 0, 0.1],
    lKnee: [0.5, 0, 0],
    rHip: [0.3, 0, -0.1],
    rKnee: [0.5, 0, 0],
  },
  drop: 0.1,
};

export const LYING: Pose = {
  joints: {
    hips: [0, 0, 0],
    spine: [0, 0, 0],
    head: [0.3, 0.4, 0],
    lShoulder: [-0.3, 0, 1.3],
    lElbow: [-0.5, 0, 0],
    rShoulder: [-0.2, 0, -1.2],
    rElbow: [-0.8, 0, 0],
    lHip: [-0.15, 0, 0.2],
    lKnee: [0.5, 0, 0],
    rHip: [-0.5, 0, -0.15],
    rKnee: [1.0, 0, 0],
  },
  drop: 0,
  pitch: -Math.PI / 2,
};

export const JUMP: Pose = {
  joints: {
    hips: [0, -0.3, 0],
    spine: [0.2, -0.4, 0],
    head: [0, 0.6, 0],
    lShoulder: [-0.9, 0, -0.3],
    lElbow: [-1.9, 0, 0],
    rShoulder: [-0.75, 0, 0.4],
    rElbow: [-2.1, 0, 0],
    lHip: [-1.0, 0, 0.05],
    lKnee: [1.5, 0, 0],
    rHip: [-0.5, 0, -0.05],
    rKnee: [1.7, 0, 0],
  },
  drop: 0,
};

/** Per-move chamber (wind-up) and strike poses, keyed by move id. */
export const MOVE_POSES: Record<string, { chamber: Pose; strike: Pose }> = {
  street_jab: {
    chamber: GUARD,
    strike: {
      joints: { ...GUARD.joints, spine: [0.15, -0.8, 0], hips: [0, -0.5, 0], lShoulder: [-1.55, 0.35, -0.2], lElbow: [-0.05, 0, 0], head: [0, 0.95, 0] },
      drop: 0.07,
    },
  },
  street_jab_2: {
    chamber: GUARD,
    strike: {
      joints: { ...GUARD.joints, spine: [0.18, -0.85, 0], hips: [0, -0.5, 0], lShoulder: [-1.55, 0.35, -0.2], lElbow: [-0.05, 0, 0], head: [0, 0.95, 0] },
      drop: 0.08,
    },
  },
  street_hook: {
    chamber: { joints: { ...GUARD.joints, spine: [0.1, -0.7, 0], rShoulder: [-0.9, 0, -0.7], rElbow: [-1.6, 0, 0] }, drop: 0.07 },
    strike: {
      joints: { ...GUARD.joints, hips: [0, 0.15, 0], spine: [0.15, 0.55, 0], head: [0, -0.4, 0], rShoulder: [-1.5, 0, -0.5], rElbow: [-1.35, 0, 0] },
      drop: 0.08,
    },
  },
  street_haymaker: {
    chamber: {
      joints: { ...GUARD.joints, hips: [0, -0.6, 0], spine: [0.05, -0.9, 0], head: [0, 1.0, 0], rShoulder: [-0.4, 0, -1.4], rElbow: [-1.3, 0, 0] },
      drop: 0.08,
    },
    strike: {
      joints: { ...GUARD.joints, hips: [0, 0.3, 0], spine: [0.3, 0.6, 0], head: [0, -0.5, 0], rShoulder: [-1.5, 0, -0.35], rElbow: [-0.45, 0, 0], lShoulder: [-0.3, 0, 0.4], lElbow: [-1.6, 0, 0] },
      drop: 0.12,
    },
  },
  street_front_kick: {
    chamber: { joints: { ...GUARD.joints, spine: [-0.05, -0.45, 0], lHip: [-1.6, 0, 0], lKnee: [2.0, 0, 0], rKnee: [0.25, 0, 0] }, drop: 0 },
    strike: { joints: { ...GUARD.joints, spine: [-0.25, -0.45, 0], lHip: [-1.5, 0, 0], lKnee: [0.08, 0, 0], rKnee: [0.2, 0, 0], rHip: [0.1, 0, 0] }, drop: 0 },
  },
  street_roundhouse: {
    chamber: {
      joints: { ...GUARD.joints, hips: [0, 0.5, 0], spine: [-0.15, 0.3, 0], head: [0, -0.4, 0], rHip: [-1.4, 0, -0.9], rKnee: [2.0, 0, 0], lKnee: [0.25, 0, 0] },
      drop: 0,
    },
    strike: {
      joints: { ...GUARD.joints, hips: [0, 1.1, 0], spine: [-0.35, 0.6, -0.3], head: [0.2, -1.0, 0], rHip: [-2.05, 0, -1.25], rKnee: [0.12, 0, 0], lKnee: [0.2, 0, 0], lHip: [0.05, 0, 0] },
      drop: 0,
    },
  },
};

export function lerpPose(a: Pose, b: Pose, t: number): Pose {
  const joints: Partial<Record<JointName, Vec3>> = {};
  for (const j of JOINTS) {
    const va = a.joints[j] ?? [0, 0, 0];
    const vb = b.joints[j] ?? [0, 0, 0];
    joints[j] = [va[0] + (vb[0] - va[0]) * t, va[1] + (vb[1] - va[1]) * t, va[2] + (vb[2] - va[2]) * t];
  }
  return {
    joints,
    drop: (a.drop ?? 0) + ((b.drop ?? 0) - (a.drop ?? 0)) * t,
    pitch: (a.pitch ?? 0) + ((b.pitch ?? 0) - (a.pitch ?? 0)) * t,
  };
}

export function easeOut(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

export function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

// ---------------------------------------------------------------------------------
// Stage 3: style stances, new move animations and grapple / defence states.
// ---------------------------------------------------------------------------------

type J = Partial<Record<JointName, Vec3>>;
/** A pose built from the guard with some joints changed. */
const g = (joints: J, drop = GUARD.drop ?? 0.05, pitch = 0): Pose => ({ joints: { ...GUARD.joints, ...joints }, drop, pitch });

/** Each style's stance: how it stands, walks and holds its hands. */
export const STANCES: Record<string, Pose> = {
  street: g({ lShoulder: [-0.85, 0, -0.3], lElbow: [-1.7, 0, 0], rShoulder: [-0.7, 0, 0.4], rElbow: [-1.95, 0, 0] }),
  boxing: g({ spine: [0.18, -0.4, 0], lShoulder: [-1.0, 0, -0.45], lElbow: [-2.05, 0, 0], rShoulder: [-0.9, 0, 0.5], rElbow: [-2.2, 0, 0], lKnee: [0.5, 0, 0], rKnee: [0.55, 0, 0] }, 0.1),
  kickboxing: GUARD,
  muay_thai: g({ hips: [0, -0.15, 0], spine: [0.02, -0.15, 0], head: [0, 0.3, 0], lShoulder: [-1.1, 0, -0.25], lElbow: [-1.7, 0, 0], rShoulder: [-1.0, 0, 0.3], rElbow: [-1.8, 0, 0], lHip: [-0.15, 0, 0.08], rHip: [0.15, 0, -0.08], lKnee: [0.2, 0, 0], rKnee: [0.25, 0, 0] }, 0.02),
  karate: g({ hips: [0, -0.75, 0], spine: [0.05, -0.6, 0], head: [0, 1.2, 0], lShoulder: [-1.25, 0, -0.15], lElbow: [-0.9, 0, 0], rShoulder: [-0.7, 0, 0.35], rElbow: [-2.1, 0, 0], lHip: [-0.45, 0, 0.05], rHip: [0.45, 0, -0.05], lKnee: [0.4, 0, 0], rKnee: [0.4, 0, 0] }, 0.08),
  wrestling: g({ spine: [0.45, -0.3, 0], head: [-0.35, 0.3, 0], lShoulder: [-1.1, 0, -0.2], lElbow: [-1.0, 0, 0], rShoulder: [-1.0, 0, 0.2], rElbow: [-1.1, 0, 0], lHip: [-0.6, 0, 0.1], lKnee: [0.9, 0, 0], rHip: [0.3, 0, -0.1], rKnee: [0.9, 0, 0] }, 0.25),
  bjj: g({ spine: [0.3, -0.35, 0], head: [-0.2, 0.35, 0], lShoulder: [-1.0, 0, -0.2], lElbow: [-1.3, 0, 0], rShoulder: [-0.9, 0, 0.25], rElbow: [-1.4, 0, 0], lHip: [-0.5, 0, 0.08], lKnee: [0.7, 0, 0], rHip: [0.3, 0, -0.08], rKnee: [0.7, 0, 0] }, 0.18),
};

const CLINCH_ARMS: J = { lShoulder: [-1.6, 0, -0.35], lElbow: [-1.2, 0, 0], rShoulder: [-1.6, 0, 0.35], rElbow: [-1.2, 0, 0] };
export const CLINCH_HOLD: Pose = g({ ...CLINCH_ARMS, spine: [0.25, -0.2, 0], head: [0.1, 0.2, 0] }, 0.08);
export const CLINCHED: Pose = g({ spine: [0.55, -0.2, 0], head: [0.3, 0, 0], ...BLOCK.joints, hips: [0, -0.2, 0] }, 0.15);
export const MOUNT: Pose = g({ spine: [0.45, 0, 0], head: [0.2, 0, 0], lHip: [-1.5, 0, 0.4], lKnee: [2.3, 0, 0], rHip: [-1.5, 0, -0.4], rKnee: [2.3, 0, 0] }, 0.55);
export const DODGE_BACK: Pose = g({ spine: [-0.3, -0.6, 0], head: [-0.25, 0.7, 0], lKnee: [0.7, 0, 0], rKnee: [0.8, 0, 0] }, 0.16);
export const DODGE_SIDE: Pose = g({ spine: [0.15, -0.5, 0.4], head: [0, 0.7, 0.35], lKnee: [0.8, 0, 0], rKnee: [0.6, 0, 0] }, 0.18);
export const SLIP: Pose = g({ spine: [0.35, -0.4, 0.45], head: [0.25, 0.5, 0.4], lKnee: [0.8, 0, 0], rKnee: [0.8, 0, 0] }, 0.22);
export const PARRIED: Pose = g({ spine: [-0.35, -0.2, 0], head: [-0.3, 0, 0], lShoulder: [-0.6, 0, 0.6], lElbow: [-0.7, 0, 0], rShoulder: [-0.5, 0, -0.6], rElbow: [-0.8, 0, 0] }, 0.1);

const mp = (chamber: Pose, strike: Pose) => ({ chamber, strike });

/** Chamber and strike poses for every animation key. Moves pick one with `anim`. */
export const ANIM_POSES: Record<string, { chamber: Pose; strike: Pose }> = {
  jab: MOVE_POSES.street_jab,
  hook: MOVE_POSES.street_hook,
  haymaker: MOVE_POSES.street_haymaker,
  front_kick: MOVE_POSES.street_front_kick,
  roundhouse: MOVE_POSES.street_roundhouse,
  spin_kick: MOVE_POSES.street_roundhouse,
  cross: mp(GUARD, g({ rShoulder: [-1.55, -0.3, 0.15], rElbow: [-0.05, 0, 0], spine: [0.2, 0.5, 0], hips: [0, 0.2, 0], head: [0, -0.4, 0] }, 0.1)),
  uppercut: mp(
    g({ spine: [0.25, -0.2, 0], rShoulder: [-0.3, 0, 0.3], rElbow: [-1.9, 0, 0] }, 0.2),
    g({ spine: [-0.1, 0.45, 0], rShoulder: [-1.9, 0, 0.25], rElbow: [-1.3, 0, 0] }, 0.02),
  ),
  overhand: mp(
    g({ rShoulder: [-2.4, 0, -0.3], rElbow: [-1.4, 0, 0], spine: [-0.1, -0.5, 0] }),
    g({ rShoulder: [-1.4, 0, 0.2], rElbow: [-0.4, 0, 0], spine: [0.4, 0.6, 0] }, 0.15),
  ),
  body_shot: mp(
    g({ spine: [0.25, -0.6, 0] }, 0.2),
    g({ lShoulder: [-1.2, 0.3, -0.1], lElbow: [-0.3, 0, 0], spine: [0.35, -0.7, 0], lKnee: [0.7, 0, 0], rKnee: [0.7, 0, 0] }, 0.22),
  ),
  teep: mp(
    g({ lHip: [-1.7, 0, 0], lKnee: [2.1, 0, 0], spine: [-0.1, -0.4, 0] }, 0),
    g({ lHip: [-1.55, 0, 0], lKnee: [0, 0, 0], spine: [-0.35, -0.3, 0], rKnee: [0.15, 0, 0] }, 0),
  ),
  low_kick: mp(
    g({ rHip: [-0.6, 0, -0.5], rKnee: [1.2, 0, 0], hips: [0, 0.4, 0] }, 0.03),
    g({ rHip: [-0.9, 0, -0.9], rKnee: [0.1, 0, 0], hips: [0, 0.9, 0], spine: [-0.15, 0.4, 0], lKnee: [0.3, 0, 0] }, 0.03),
  ),
  side_kick: mp(
    g({ lHip: [-1.6, 0, 0], lKnee: [2.0, 0, 0], spine: [-0.1, -1.0, 0], hips: [0, -1.0, 0] }, 0),
    g({ lHip: [-1.5, 0, 0.6], lKnee: [0, 0, 0], spine: [-0.4, -1.2, 0.3], hips: [0, -1.2, 0] }, 0),
  ),
  axe_kick: mp(
    g({ rHip: [-2.4, 0, 0], rKnee: [0.2, 0, 0], spine: [-0.4, 0.2, 0] }, 0),
    g({ rHip: [-1.0, 0, 0], rKnee: [0.1, 0, 0], spine: [0.2, 0.3, 0] }, 0.05),
  ),
  knee: mp(
    g({ rHip: [-1.2, 0, 0], rKnee: [2.2, 0, 0], ...CLINCH_ARMS }, 0.02),
    g({ rHip: [-1.9, 0, 0], rKnee: [2.3, 0, 0], spine: [-0.2, 0.3, 0], hips: [0, 0.4, 0], ...CLINCH_ARMS }, 0),
  ),
  elbow: mp(
    g({ rShoulder: [-0.6, 0, -1.3], rElbow: [-2.4, 0, 0], spine: [0.05, -0.7, 0] }),
    g({ rShoulder: [-1.7, 0, 0.4], rElbow: [-2.5, 0, 0], spine: [0.2, 0.6, 0], hips: [0, 0.3, 0] }, 0.1),
  ),
  spin_backfist: mp(
    g({ spine: [0.05, -1.6, 0], hips: [0, -1.4, 0], head: [0, 1.5, 0] }),
    g({ spine: [0.1, 1.4, 0], hips: [0, 1.2, 0], rShoulder: [-1.5, 0, -1.4], rElbow: [-0.2, 0, 0], head: [0, -0.6, 0] }),
  ),
  headbutt: mp(
    g({ spine: [-0.3, -0.3, 0], head: [-0.5, 0, 0] }),
    g({ spine: [0.6, -0.2, 0], head: [0.6, 0.2, 0], lShoulder: [-1.5, 0, -0.3], lElbow: [-0.7, 0, 0], rShoulder: [-1.5, 0, 0.3], rElbow: [-0.7, 0, 0] }),
  ),
  shove: mp(
    g({ lShoulder: [-1.2, 0, -0.4], lElbow: [-1.9, 0, 0], rShoulder: [-1.2, 0, 0.4], rElbow: [-1.9, 0, 0], spine: [0, -0.1, 0] }),
    g({ lShoulder: [-1.55, 0, -0.25], lElbow: [-0.1, 0, 0], rShoulder: [-1.55, 0, 0.25], rElbow: [-0.1, 0, 0], spine: [0.3, 0, 0] }),
  ),
  grab: mp(
    g({ lShoulder: [-1.3, 0, 0.1], lElbow: [-1.0, 0, 0], rShoulder: [-1.3, 0, -0.1], rElbow: [-1.0, 0, 0], spine: [0.2, -0.1, 0] }, 0.1),
    g({ lShoulder: [-1.55, 0, 0.1], lElbow: [-0.6, 0, 0], rShoulder: [-1.55, 0, -0.1], rElbow: [-0.6, 0, 0], spine: [0.35, 0, 0] }, 0.12),
  ),
  shoot: mp(
    g({ spine: [0.6, -0.2, 0], lKnee: [1.0, 0, 0], rKnee: [1.0, 0, 0] }, 0.35),
    g({ spine: [1.1, 0, 0], head: [-0.6, 0, 0], lHip: [-1.3, 0, 0], lKnee: [1.6, 0, 0], rHip: [0.6, 0, 0], rKnee: [1.6, 0, 0], lShoulder: [-1.0, 0, 0], lElbow: [-0.3, 0, 0], rShoulder: [-1.0, 0, 0], rElbow: [-0.3, 0, 0] }, 0.55),
  ),
  takedown: mp(CLINCH_HOLD, g({ spine: [1.0, 0.3, 0], head: [-0.4, 0, 0], ...CLINCH_ARMS, lKnee: [1.4, 0, 0], rKnee: [1.4, 0, 0] }, 0.45)),
  getup_kick: mp(
    g({ lHip: [-1.0, 0, 0], lKnee: [1.6, 0, 0], spine: [-0.6, 0, 0] }, 0.55),
    g({ lHip: [-1.4, 0, 0], lKnee: [0, 0, 0], spine: [-0.6, 0, 0], rKnee: [1.6, 0, 0] }, 0.5),
  ),
  clinch_knee: mp(g({ ...CLINCH_ARMS, rHip: [-0.8, 0, 0], rKnee: [1.6, 0, 0] }, 0.05), g({ ...CLINCH_ARMS, spine: [0.1, 0.2, 0], rHip: [-1.8, 0, 0], rKnee: [2.2, 0, 0] }, 0.02)),
  clinch_uppercut: mp(g({ lShoulder: [-1.6, 0, -0.35], lElbow: [-1.2, 0, 0], rShoulder: [-0.4, 0, 0.3], rElbow: [-1.9, 0, 0] }, 0.12), g({ lShoulder: [-1.6, 0, -0.35], lElbow: [-1.2, 0, 0], rShoulder: [-1.8, 0, 0.3], rElbow: [-1.6, 0, 0], spine: [0.1, 0.4, 0] }, 0.05)),
  clinch_headbutt: mp(g({ ...CLINCH_ARMS, spine: [-0.2, -0.2, 0], head: [-0.5, 0, 0] }), g({ ...CLINCH_ARMS, spine: [0.5, -0.2, 0], head: [0.7, 0, 0] })),
  clinch_elbow: mp(g({ lShoulder: [-1.6, 0, -0.35], lElbow: [-1.2, 0, 0], rShoulder: [-2.2, 0, -0.4], rElbow: [-2.4, 0, 0] }), g({ lShoulder: [-1.6, 0, -0.35], lElbow: [-1.2, 0, 0], rShoulder: [-1.5, 0, 0.5], rElbow: [-2.5, 0, 0], spine: [0.3, 0.5, 0] }, 0.1)),
  throw: mp(g({ ...CLINCH_ARMS, spine: [0.3, -0.8, 0], hips: [0, -0.6, 0] }, 0.2), g({ ...CLINCH_ARMS, spine: [-0.3, 1.5, 0], hips: [0, 1.3, 0], head: [0, -0.8, 0] }, 0.15)),
  ground_punch: mp(g({ ...MOUNT.joints, rShoulder: [-2.4, 0, 0.2], rElbow: [-1.6, 0, 0] }, 0.55), g({ ...MOUNT.joints, spine: [0.8, 0.3, 0], rShoulder: [-1.0, 0, 0.2], rElbow: [-0.1, 0, 0] }, 0.6)),
  submission: mp(MOUNT, g({ ...MOUNT.joints, spine: [1.0, 0, 0], lShoulder: [-1.4, 0, -0.6], lElbow: [-1.8, 0, 0], rShoulder: [-1.4, 0, 0.6], rElbow: [-1.8, 0, 0] }, 0.62)),
  finisher: mp(MOVE_POSES.street_haymaker.chamber, g({ spine: [0.45, 0.85, 0], hips: [0, 0.5, 0], rShoulder: [-1.6, 0, -0.2], rElbow: [0, 0, 0], head: [0, -0.6, 0] }, 0.18)),
};
