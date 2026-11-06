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
    lShoulder: [-0.75, 0, 0.15],
    lElbow: [-2.0, 0, 0],
    rShoulder: [-0.55, 0, -0.25],
    rElbow: [-2.35, 0, 0],
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
    lShoulder: [-1.15, 0, 0.35],
    lElbow: [-2.3, 0, 0],
    rShoulder: [-1.05, 0, -0.35],
    rElbow: [-2.4, 0, 0],
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
    lShoulder: [-0.9, 0, 0.2],
    lElbow: [-2.0, 0, 0],
    rShoulder: [-0.7, 0, -0.3],
    rElbow: [-2.2, 0, 0],
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
      joints: { ...GUARD.joints, spine: [0.15, -0.8, 0], hips: [0, -0.5, 0], lShoulder: [-1.55, 0.35, 0.05], lElbow: [-0.05, 0, 0], head: [0, 0.95, 0] },
      drop: 0.07,
    },
  },
  street_jab_2: {
    chamber: GUARD,
    strike: {
      joints: { ...GUARD.joints, spine: [0.18, -0.85, 0], hips: [0, -0.5, 0], lShoulder: [-1.55, 0.35, 0.05], lElbow: [-0.05, 0, 0], head: [0, 0.95, 0] },
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
      joints: { ...GUARD.joints, hips: [0, 1.1, 0], spine: [-0.35, 0.6, -0.3], head: [0.2, -1.0, 0], rHip: [-1.7, 0, -1.2], rKnee: [0.12, 0, 0], lKnee: [0.2, 0, 0], lHip: [0.05, 0, 0] },
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
