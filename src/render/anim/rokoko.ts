/**
 * Fighting motion capture from Rokoko's free mocap pack (credits in public/anim/ROKOKO.md),
 * converted by tools/rokoko/convert.py into the same format as the CMU clips, so
 * araPose.ts plays both. This file says which clip stands in for what, and how a
 * clip is stretched to a move's own frames so a punch still lands on its first
 * active frame.
 *
 * Every clip is orthodox (left hand and left foot lead), like every fighter.
 * Anything without a clip keeps its hand-made key poses (poses.ts).
 *
 * No Three.js here: tests read it directly.
 */
import type { StyleId } from '../../styles/StyleData';
import { araMocapPose, mocapClip, registerMocap } from './araPose';
import type { Metrics } from './skeleton';
import type { Pose } from '../poses';

/** Strikes with a capture, keyed by `${anim}:${limb}`. A fighter cycles through the takes, one per throw. */
export const STRIKE_CLIPS: Record<string, string[]> = {
  'jab:leadHand': ['rk_jab', 'rk_jab_b'],
  'cross:rearHand': ['rk_cross', 'rk_cross_b', 'rk_cross_c'],
  'haymaker:rearHand': ['rk_cross_c', 'rk_cross'],
  'overhand:rearHand': ['rk_cross', 'rk_cross_c'],
  'body_shot:rearHand': ['rk_cross_b'],
  'front_kick:rearFoot': ['rk_front_kick'],
};

/** Guards: a striker bounces in a captured guard; grapplers keep their low hand-made crouch. */
export const GUARD_CLIPS = ['rk_guard_a', 'rk_guard_b'];
const GUARD_STYLES: ReadonlySet<StyleId> = new Set(['street', 'boxing', 'kickboxing', 'muay_thai', 'karate']);

export const REACTIONS = {
  head: 'rk_hit_head',
  body: 'rk_hit_body',
  stagger: 'rk_stagger',
  knockdown: 'rk_knockdown',
  ko: ['rk_ko', 'rk_ko_b'],
  getup: 'rk_getup',
} as const;

let loading: Promise<boolean> | null = null;
let ready = false;

/** Fetch the clips (about 180 KB). Resolves false, and the hand-made poses carry on, if they aren't there. */
export function loadRokoko(url = '/anim/rokoko_mocap.json'): Promise<boolean> {
  loading ??= fetch(url)
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${r.status}`))))
    .then((d) => {
      registerMocap(d);
      ready = true;
      return true;
    })
    .catch((e) => {
      console.warn('[anim] Rokoko motion capture not loaded', e);
      return false;
    });
  return loading;
}

/** For tests and tools that register the JSON themselves. */
export function markRokokoReady(): void {
  ready = true;
}

export function rokokoReady(): boolean {
  return ready && !!mocapClip(GUARD_CLIPS[0]);
}

/** The take for this strike, or null if it has none (or the clips aren't loaded). `seq` picks one of several. */
export function strikeClip(anim: string, limb: string, seq: number): string | null {
  if (!ready) return null;
  const list = STRIKE_CLIPS[`${anim}:${limb}`];
  if (!list) return null;
  const id = list[((seq % list.length) + list.length) % list.length];
  return mocapClip(id) ? id : null;
}

/**
 * Where in a strike's clip to be, given where the move is (frames at 60 a second).
 * The wind-up plays up to the impact as the startup runs out, the impact holds
 * through the active frames, and the rest of the clip is the recovery. The clip
 * is never sped up more than it has to be: a quick jab starts part-way into its
 * take rather than racing through the guard before it.
 */
export function strikeTime(clip: string, frame: number, startup: number, active: number, recovery: number): number {
  const c = mocapClip(clip);
  if (!c) return 0;
  const hit = c.hit ?? c.duration * 0.4;
  const startS = startup / 60;
  const t0 = Math.max(0, hit - Math.max(startS * 1.6, 0.08));
  if (frame < startup) return t0 + (hit - t0) * (frame / Math.max(1, startup));
  const hold = Math.min(0.05, (c.duration - hit) * 0.2);
  if (frame < startup + active) return hit + hold * ((frame - startup) / Math.max(1, active));
  const r = Math.min(1, (frame - startup - active) / Math.max(1, recovery));
  return hit + hold + (c.duration - hit - hold) * r;
}

export function strikePose(clip: string, frame: number, startup: number, active: number, recovery: number, m: Metrics): Pose | null {
  const p = araMocapPose(clip, strikeTime(clip, frame, startup, active, recovery), m);
  return p ? { ...p, ik: 1 } : null;
}

/** A striker's captured guard at this moment (each fighter on their own take and phase), or null. */
export function guardPose(style: StyleId, fighterId: number, time: number, m: Metrics): Pose | null {
  if (!ready || !GUARD_STYLES.has(style)) return null;
  const id = GUARD_CLIPS[fighterId % GUARD_CLIPS.length];
  const p = araMocapPose(id, time + (fighterId % 7) * 0.37, m);
  return p ? { ...p, ik: 1 } : null;
}

/** A reaction or fall at t seconds into it (one-shots hold their last frame). `planted`: keep the feet on the floor. */
export function reactionPose(id: string, t: number, m: Metrics, planted: boolean): Pose | null {
  if (!ready) return null;
  const p = araMocapPose(id, t, m);
  return p ? { ...p, ik: planted ? 1 : 0 } : null;
}

export function clipDuration(id: string): number {
  return mocapClip(id)?.duration ?? 0;
}
