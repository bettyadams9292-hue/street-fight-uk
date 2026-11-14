/**
 * Quaternius' Universal Animation Library 1 and 2 (CC0), converted by tools/ual/convert.py into
 * the same mocap JSON as the Rokoko and CMU clips, so araPose.ts plays it on our rig. Credits in
 * public/anim/UAL.md.
 *
 * This file says which clip stands in for which hand-keyed pose (activityPoses.ts, poses.ts).
 * Everything returns null when the clips aren't loaded (or a pose has no clip), and the
 * caller carries on with its keyed pose: that is the fallback, and it is never removed.
 *
 * No Three.js here: tests read it directly.
 */
import type { JointName, Pose, Vec3 } from '../poses';
import { araMocapPose, mocapClip, registerMocap } from './araPose';
import type { Metrics } from './skeleton';

interface ActClip {
  /** The clip for the whole body. */
  clip: string;
  /** A second clip for the top half (spine, head, arms), e.g. folded arms over a sitting clip. */
  upper?: string;
  /** Joints kept from the keyed pose (e.g. a head glancing about over a captured idle). */
  keyed?: JointName[];
  /** Playback rate. */
  speed?: number;
  /** Use the keyed pose's hip height, so the body sits on the game's seats and lies on its beds. */
  keyedDrop?: boolean;
}

const UPPER: JointName[] = ['spine', 'head', 'lShoulder', 'lElbow', 'rShoulder', 'rElbow'];

/** Activities (Game ids of "Animations: everyday") that play a capture, and which. */
export const ACTIVITY_CLIPS: Record<string, ActClip> = {
  arms: { clip: 'ual_fold_arms' },
  wait: { clip: 'ual_fold_arms', keyed: ['head'] },
  talk: { clip: 'ual_talk' },
  phone: { clip: 'ual_phone' },
  lean: { clip: 'ual_lean' },
  look: { clip: 'ual_idle', keyed: ['head', 'spine'] },
  browse: { clip: 'ual_idle', keyed: ['head'] },
  drink: { clip: 'ual_drink', speed: 0.7 },
  reach: { clip: 'ual_reach' },
  reach_low: { clip: 'ual_reach_low', speed: 0.45 },
  plate: { clip: 'ual_idle', upper: 'ual_carry' },
  bag: { clip: 'ual_bag', speed: 1.1 },
  sit_edge: { clip: 'ual_sit', keyedDrop: true },
  sit_talk: { clip: 'ual_sit_talk', keyedDrop: true },
  sit_arms: { clip: 'ual_sit', upper: 'ual_fold_arms', keyedDrop: true },
  sit_phone: { clip: 'ual_sit', upper: 'ual_phone', keyedDrop: true },
  sit_drink: { clip: 'ual_sit', upper: 'ual_drink', speed: 0.7, keyedDrop: true },
  eat: { clip: 'ual_sit', upper: 'ual_drink', speed: 1.1, keyedDrop: true },
  // Exercise bike: the captured seated reach to the handlebars; the pedalling legs stay keyed.
  cycle: { clip: 'ual_drive', keyed: ['hips', 'lHip', 'lKnee', 'rHip', 'rKnee', 'lFoot', 'rFoot'], keyedDrop: true },
  lie: { clip: 'ual_fall_back', keyedDrop: true },
};

/** Strikes with a UAL take, keyed by `${anim}:${limb}` (Rokoko's STRIKE_CLIPS win where both have one). */
export const STRIKE_CLIPS: Record<string, string> = {
  'finisher:rearHand': 'ual_cross',
};

/** Reactions and stances (Game ids of "Animations: reactions & stances") with a capture. */
export const STATE_CLIPS = {
  RELAXED: 'ual_idle',
  GUARD_BREAK: 'ual_guard_break',
  PARRIED: 'ual_parried',
  JUMP_FALL: 'ual_jump_fall',
  /** Knocked flat on the back: FALL_BACK, LAND_BACK, and its last frame is LYING. */
  FALL_BACK: 'ual_fall_back',
  /** Up off the back: LYING → SIT_UP → CROUCH_UP → standing. */
  GETUP_BACK: 'ual_lay_to_idle',
} as const;

let loading: Promise<boolean> | null = null;
let ready = false;

/** Fetch the clips (about 240 KB). Resolves false, and the keyed poses carry on, if they aren't there. */
export function loadUal(url = '/anim/ual_mocap.json'): Promise<boolean> {
  loading ??= fetch(url)
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${r.status}`))))
    .then((d) => {
      registerMocap(d);
      ready = true;
      return true;
    })
    .catch((e) => {
      console.warn('[anim] UAL animation clips not loaded', e);
      return false;
    });
  return loading;
}

/** For tests and tools that register the JSON themselves. */
export function markUalReady(): void {
  ready = true;
}

function has(id: string): boolean {
  return ready && !!mocapClip(id);
}

export function ualDuration(id: string): number {
  return mocapClip(id)?.duration ?? 0;
}

/** A clip as a pose at t seconds (loops wrap, one-shots hold their last frame), or null. */
export function ualPose(id: string, t: number, m: Metrics, ik = 0): Pose | null {
  if (!has(id)) return null;
  const p = araMocapPose(id, t, m);
  return p ? { ...p, ik } : null;
}

/** An everyday activity from capture, or null (no clip for it, or not loaded). `keyed` is its hand-made pose. */
export function activityClipPose(act: string, t: number, m: Metrics, keyed: Pose): Pose | null {
  const a = ACTIVITY_CLIPS[act];
  if (!a || !has(a.clip) || (a.upper && !has(a.upper))) return null;
  const tt = t * (a.speed ?? 1);
  const base = araMocapPose(a.clip, tt, m);
  if (!base) return null;
  const joints = { ...base.joints } as Record<JointName, Vec3>;
  if (a.upper) {
    const up = araMocapPose(a.upper, tt, m);
    if (up) for (const j of UPPER) joints[j] = up.joints[j] as Vec3;
  }
  for (const j of a.keyed ?? []) if (keyed.joints[j]) joints[j] = keyed.joints[j] as Vec3;
  const drop = a.keyedDrop ? keyed.drop ?? 0 : base.drop;
  return { joints, drop, shift: a.keyedDrop ? [0, 0] : base.shift, pitch: a.keyedDrop ? keyed.pitch ?? 0 : 0, ik: 0 };
}

/** The UAL take for a strike, or null. */
export function ualStrikeClip(anim: string, limb: string): string | null {
  const id = STRIKE_CLIPS[`${anim}:${limb}`];
  return id && has(id) ? id : null;
}
