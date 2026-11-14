import { araMocapPose, araPose, mocapClip, mocapStride } from './araPose';
import { REACTIONS, clipDuration, guardPose, reactionPose, strikeClip, strikePose } from './rokoko';
import type { Fighter, FighterState } from '../../fighter/Fighter';
import { isActiveFrame, type ActiveMove } from '../../combat/MoveData';
import { activityPose } from '../activityPoses';
import { STATE_CLIPS, activityClipPose, ualDuration, ualPose, ualStrikeClip } from './ual';
import {
  BLOCK, BLOCK_LOW, CLINCHED, CLINCH_HOLD, CROUCH_UP, DODGE_BACK, DODGE_SIDE, FALL_BACK, FALL_FRONT, GUARD, GUARD_BREAK, HIT_HIGH, HIT_LOW, HIT_MID,
  JOINTS, JUMP, JUMP_FALL, LAND_BACK, LYING, LYING_FRONT, LYING_KO, MOUNT, PARRIED, PUSH_UP, RELAXED, SIT_UP, SLIP, STAGGER, STAGGER_MID, STANCES,
  animPoses, easeIn, easeInOut, easeOut, lerpPose, lerpPoseChain, type FootSpec, type JointName, type Pose, type Vec3,
} from '../poses';
import { add, apply, euler, lerp3, mul, solveBody, solveLimb, sub, toEuler, transpose, type M3, type Metrics, type Side } from './skeleton';

/** Ara clips standing in for the simple ambient poses (several per pose, picked by fighter id). */
const AMBIENT_CLIPS: Record<string, string[]> = {
  talk: ['talk_gestures', 'laugh', 'talk', 'talk_gestures'],
  browse: ['look_around', 'texting', 'phone_call'],
  watch: ['texting', 'point', 'clap', 'cheer', 'look_around'],
  phone: ['phone_call'],
  laugh: ['laugh'],
};

/**
 * Turns what a fighter is doing into a pose, every frame.
 *
 *  1. Picks the key poses for the state (stance, strike, reaction, fall...) and
 *     moves between them on curves timed to the move's own frames, so a punch
 *     lands on its first active frame and follows through.
 *  2. Blends out of whatever came before (no snapping when the state changes).
 *  3. Adds what's alive on top: breathing, a boxer's bounce, the head tracking
 *     the opponent, and the snap, fold or buckle of taking a hit (springs).
 *  4. Plants the feet. Each foot is locked to the floor where it stands and
 *     only moves by taking a step, so walking, backing off, sidestepping,
 *     lunging and being knocked back never slide a foot. Hips are lowered if a
 *     leg can't reach, and the trailing heel lifts.
 *  5. Aims the striking hand or foot at the opponent with IK, so hits land on
 *     the body instead of beside or through it.
 *
 * No Three.js in here: it's all numbers, so it can be tested without a browser.
 */
export interface AnimOutput {
  joints: Record<JointName, Vec3>;
  /** Hips position in the fighter's frame (x left, y up, z forward). */
  hips: Vec3;
  /** Whole-body pitch about the feet. */
  pitch: number;
  /** Which way the fighter is turned (radians about y). */
  yaw: number;
}

export interface Traits {
  /** 0 novice .. 1 expert: tight guard and tucked chin, or low hands and a high chin. */
  skill: number;
  /** 0..1 heavy or muscular build: arms carried wider so they clear the body. */
  bulk: number;
  /** Per-fighter variety, 0..1. */
  seed: number;
}

interface Foot {
  side: Side;
  /** World position of the planted foot. */
  x: number;
  z: number;
  /** World yaw of the toes. */
  yaw: number;
  planted: boolean;
  /** 0 in the air (leg as posed) .. 1 on the floor (IK). */
  w: number;
  step: { fx: number; fz: number; t: number; dur: number; lift: number } | null;
  /** Height of the ankle above its standing height this frame (step lift). */
  lift: number;
  /** Toe pitch from the step this frame. */
  roll: number;
  heel: number;
  /** How fast a foot coming down from the air settles onto the floor (1/s). */
  rate: number;
}

class Spring {
  x = 0;
  v = 0;
  constructor(private w: number, private z: number, private limit: number) {}
  kick(v: number): void {
    this.v += v;
  }
  tick(dt: number): number {
    this.v += (-this.w * this.w * this.x - 2 * this.z * this.w * this.v) * dt;
    this.x += this.v * dt;
    if (this.x > this.limit) {
      this.x = this.limit;
      this.v = Math.min(0, this.v);
    } else if (this.x < -this.limit) {
      this.x = -this.limit;
      this.v = Math.max(0, this.v);
    }
    return this.x;
  }
  reset(): void {
    this.x = 0;
    this.v = 0;
  }
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const clamp01 = (v: number) => clamp(v, 0, 1);
const wrap = (a: number) => {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
};
const J3 = (v: Vec3 | undefined): Vec3 => (v ? [v[0], v[1], v[2]] : [0, 0, 0]);

/** Styles that bounce on their toes. */
const BOUNCE: Record<string, number> = { boxing: 1, kickboxing: 0.7, muay_thai: 0.45, karate: 0.8, street: 0.25, wrestling: 0.15, bjj: 0.15 };
const STRIKE_LIMBS: Record<string, { side: Side; kind: 'hand' | 'foot' } | undefined> = {
  leadHand: { side: 'l', kind: 'hand' },
  rearHand: { side: 'r', kind: 'hand' },
  leadFoot: { side: 'l', kind: 'foot' },
  rearFoot: { side: 'r', kind: 'foot' },
};
/** Moves whose pose does the work (no reaching hand or foot). */
const NO_AIM = new Set(['knee', 'clinch_knee', 'elbow', 'clinch_elbow', 'headbutt', 'clinch_headbutt', 'shove', 'grab', 'shoot', 'takedown', 'throw', 'submission', 'ground_punch', 'clinch_uppercut']);

export class FighterAnimator {
  yaw: number;
  /** A foot landed from a walking step (footstep sounds). */
  onStep: (() => void) | null = null;
  /** For tests and debugging: where the feet are planted (world), and the last solved body. */
  readonly feet: Record<Side, Foot>;

  private lastX: number;
  private lastZ: number;
  private vx = 0;
  private vz = 0;
  private combat = 0;
  private combatHold = 0;
  private walkYaw: number | null = null;
  private key = '';
  /** Blending out of the previous pose. */
  private offset: Pose | null = null;
  private offsetT = 1;
  private offsetDur = 0.1;
  private lastTarget: Pose = GUARD;
  private lastShown: Pose = GUARD;
  private hitSeq: number;
  private wasGrounded = true;
  private pelvisY: number;
  private swing = 0;
  private run = 0;
  private lean = 0;
  // Reactions to being hit.
  private sPitch = new Spring(15, 0.5, 0.5);
  private sRoll = new Spring(13, 0.5, 0.35);
  private sYaw = new Spring(13, 0.55, 0.5);
  private hPitch = new Spring(19, 0.45, 0.55);
  private hYaw = new Spring(17, 0.5, 0.55);
  private hRoll = new Spring(17, 0.5, 0.3);
  private sDrop = new Spring(14, 0.6, 0.22);
  private sBack = new Spring(11, 0.7, 0.2);
  private sGuard = new Spring(16, 0.55, 0.6);

  private strollW = 0;
  private strollPhase = 0;

  /**
   * Follow a different Fighter (the same person carried into the next district of the street): the
   * pose, feet and blends carry on, only the position is shifted by how far the new one moved.
   */
  retarget(f: Fighter): void {
    const dx = f.pos.x - this.f.pos.x;
    const dz = f.pos.z - this.f.pos.z;
    this.f = f;
    this.lastX += dx;
    this.lastZ += dz;
    this.hitSeq = f.hitSeq;
    for (const foot of [this.feet.l, this.feet.r]) {
      foot.x += dx;
      foot.z += dz;
      if (foot.step) {
        foot.step.fx += dx;
        foot.step.fz += dz;
      }
    }
  }

  constructor(private f: Fighter, private m: Metrics, private traits: Traits, private scale = 1) {
    this.yaw = f.yawOverride ?? (f.facing * Math.PI) / 2;
    this.lastX = f.pos.x;
    this.lastZ = f.pos.z;
    this.hitSeq = f.hitSeq;
    this.pelvisY = m.hipsY;
    const mk = (side: Side): Foot => ({ side, x: f.pos.x, z: f.pos.z, yaw: this.yaw, planted: false, w: 0, step: null, lift: 0, roll: 0, heel: 0, rate: 12 });
    this.feet = { l: mk('l'), r: mk('r') };
  }

  setMetrics(m: Metrics, traits: Traits, scale: number): void {
    this.m = m;
    this.traits = traits;
    this.scale = scale;
  }

  /** In a fighting stance (1) or relaxed (0). */
  get combatLevel(): number {
    return this.combat;
  }

  // ---- frames ------------------------------------------------------------------------------

  private toLocal(wx: number, wz: number): [number, number] {
    const dx = (wx - this.f.pos.x) / this.scale;
    const dz = (wz - this.f.pos.z) / this.scale;
    const c = Math.cos(this.yaw), s = Math.sin(this.yaw);
    return [dx * c - dz * s, dx * s + dz * c];
  }

  private toWorld(lx: number, lz: number): [number, number] {
    const c = Math.cos(this.yaw), s = Math.sin(this.yaw);
    return [this.f.pos.x + (lx * c + lz * s) * this.scale, this.f.pos.z + (-lx * s + lz * c) * this.scale];
  }

  // ---- the frame ---------------------------------------------------------------------------

  /** `override`: a pose to use as it is (riding a bike). */
  update(dt: number, time: number, override: Pose | null = null): AnimOutput {
    const f = this.f;
    dt = Math.min(0.05, Math.max(1e-4, dt));

    // How fast the body is really moving (walking, lunging, being knocked back).
    const rawX = (f.pos.x - this.lastX) / dt;
    const rawZ = (f.pos.z - this.lastZ) / dt;
    const jumped = Math.hypot(f.pos.x - this.lastX, f.pos.z - this.lastZ) > 1.2;
    this.lastX = f.pos.x;
    this.lastZ = f.pos.z;
    const k = 1 - Math.exp(-28 * dt);
    this.vx += ((jumped ? 0 : rawX) - this.vx) * k;
    this.vz += ((jumped ? 0 : rawZ) - this.vz) * k;
    const speed = Math.hypot(this.vx, this.vz) / this.scale;

    // Fighting or just stood about?
    const foe = f.target;
    const near = !!foe && !foe.isKO && Math.hypot(foe.pos.x - f.pos.x, foe.pos.z - f.pos.z) < 7;
    const busy = f.state !== 'idle' && f.state !== 'walk' && f.state !== 'jump';
    // Sprinting drops the guard and runs properly, even mid-fight; the stance snaps back when they stop.
    if (f.running) this.combatHold = 0;
    else if (near || busy || f.weapon) this.combatHold = 1.2;
    else this.combatHold = Math.max(0, this.combatHold - dt);
    const wantCombat = f.team !== 'neutral' && this.combatHold > 0 ? 1 : 0;
    this.combat += (wantCombat - this.combat) * (1 - Math.exp(-(wantCombat ? 14 : f.running ? 12 : 5) * dt));

    this.turn(dt, speed);

    const passthrough = override ?? this.activity(time) ?? this.stroll(dt, speed);
    if (passthrough) {
      // Sat down, on gym kit, cooking, on a bike: the pose is used as it is.
      this.blendTo('act', passthrough, 0.18);
      const shown = this.blended(passthrough, dt);
      for (const s of ['l', 'r'] as Side[]) {
        this.feet[s].planted = false;
        this.feet[s].w = 0;
        this.feet[s].step = null;
      }
      this.pelvisY = this.m.hipsY - (shown.drop ?? 0);
      return this.finish(shown, [0, this.pelvisY, 0], shown.joints as Record<JointName, Vec3>);
    }

    // 1-2. Key pose for the state, blended out of the last one.
    this.now = time;
    const { key, pose: target, blend } = this.target();
    this.blendTo(key, target, blend);
    const base = this.blended(target, dt);

    // 3. Life on top.
    const pose = this.layers(base, dt, time, speed);

    // 4-5. Feet on the floor, hands and feet on target.
    return this.solve(pose, dt, speed, jumped);
  }

  private activity(time: number): Pose | null {
    const f = this.f;
    const still = Math.hypot(this.vx, this.vz) < 0.15;
    const act = f.activity ?? (still && f.isFree ? f.ambientPose : null);
    if (!act || f.isKO) return null;
    // People about town: Ara 3D Gen's everyday clips and emotes, a different one per person.
    const ara = AMBIENT_CLIPS[act];
    if (ara && !f.activity) {
      const id = ara[f.id % ara.length];
      const p = araPose(id, time + (f.id % 11) * 0.53, this.m);
      if (p) return p;
    }
    const p = activityPose(act, time + (f.id % 7) * 0.37);
    // Captured (UAL) where there's a clip for it; the keyed pose otherwise.
    return activityClipPose(act, time + (f.id % 7) * 0.37, this.m, p) ?? { ...p, ik: 0 };
  }

  /**
   * Walking about (not fighting): Ara's motion-captured walk, or run when hurrying, with the cycle
   * driven by the distance actually covered so the feet don't slide.
   */
  private stroll(dt: number, speed: number): Pose | null {
    const f = this.f;
    if (this.combat > 0.3 || (f.weapon && !f.running) || f.isKO || (f.state !== 'walk' && f.state !== 'idle') || f.activity) {
      this.strollW = 0;
      return null;
    }
    const want = speed > 0.35 ? 1 : 0;
    this.strollW += (want - this.strollW) * (1 - Math.exp(-10 * dt));
    if (this.strollW < 0.02) return null;
    const clip = speed > 2.6 ? 'run' : f.id % 5 === 0 ? 'walk_slouch' : 'walk';
    const stride = mocapStride(clip, this.m);
    this.strollPhase = (this.strollPhase + (speed * dt) / Math.max(0.3, stride)) % 1;
    const c = mocapClip(clip);
    if (!c) return null;
    return araMocapPose(clip, this.strollPhase * c.duration, this.m);
  }

  private turn(dt: number, speed: number): void {
    const f = this.f;
    let want = f.yawOverride ?? (f.facing * Math.PI) / 2;
    let rate = f.yawOverride !== null ? 9 : 24;
    if (f.yawOverride === null && this.combat < 0.5 && (f.state === 'idle' || f.state === 'walk')) {
      // Not fighting: turn to face the way you're walking, in any direction.
      if (speed > 0.5) this.walkYaw = Math.atan2(this.vx, this.vz);
      if (this.walkYaw !== null && Math.sign(Math.sin(this.walkYaw)) !== f.facing && Math.abs(Math.sin(this.walkYaw)) > 0.35) this.walkYaw = null;
      if (this.walkYaw !== null) want = this.walkYaw;
      rate = 11;
    } else this.walkYaw = null;
    this.yaw += wrap(want - this.yaw) * (1 - Math.exp(-rate * dt));
    this.yaw = wrap(this.yaw);
  }

  // ---- 1. key poses ------------------------------------------------------------------------

  private stance(): Pose {
    const f = this.f;
    // Strikers stand in a captured guard (Rokoko mocap); grapplers and anyone without the clips keep the hand-made one.
    const style = guardPose(f.style.id, f.id, this.now, this.m) ?? STANCES[f.style.id] ?? GUARD;
    const t = this.traits;
    // How this fighter carries the stance: novices drop their hands and lift their chin; big lads carry their arms wider.
    const loose = (1 - t.skill) * 0.9 + (f.vitals.fatigue === 'exhausted' ? 0.9 : f.vitals.fatigue === 'tired' ? 0.4 : 0);
    const wide = 0.05 + t.bulk * 0.16;
    const j = style.joints;
    const tweak = (v: Vec3 | undefined, d: Vec3): Vec3 => add(J3(v), d);
    const pose: Pose = {
      ...style,
      joints: {
        ...j,
        head: tweak(j.head, [-0.07 * loose, 0, 0]),
        spine: tweak(j.spine, [-0.04 * loose + (t.seed - 0.5) * 0.05, 0, 0]),
        lShoulder: tweak(j.lShoulder, [0.22 * loose, 0.1 * loose, wide + 0.08 * loose]),
        rShoulder: tweak(j.rShoulder, [0.2 * loose, -0.1 * loose, -wide - 0.08 * loose]),
        lElbow: tweak(j.lElbow, [0.3 * loose, 0, 0]),
        rElbow: tweak(j.rElbow, [0.32 * loose, 0, 0]),
      },
      drop: (style.drop ?? 0) * (0.85 + t.seed * 0.3) + (f.vitals.fatigue === 'exhausted' ? 0.03 : 0),
    };
    if (this.combat > 0.995) return pose;
    // Stood about: a captured idle (UAL), each person on their own phase.
    const relaxed = ualPose(STATE_CLIPS.RELAXED, this.now + (f.id % 7) * 0.37, this.m, 1) ?? RELAXED;
    return lerpPose(relaxed, pose, easeInOut(this.combat));
  }

  private target(): { key: string; pose: Pose; blend: number } {
    const f = this.f;
    const stance = this.stance();
    const hit = f.lastHit;
    const u = f.stateDuration > 0 ? clamp01(f.stateFrame / f.stateDuration) : 0;
    const state: FighterState = f.state;
    switch (state) {
      case 'idle':
      case 'walk':
        return { key: 'stand', pose: stance, blend: 0.16 };

      case 'block': {
        // Hands go where the attack is coming: up for the head, elbows down for the body and legs.
        const fm = f.target?.state === 'attack' ? f.target.move : null;
        if (fm) this.blockLow = fm.data.height !== 'high';
        return { key: this.blockLow ? 'block_low' : 'block', pose: this.blockLow ? BLOCK_LOW : BLOCK, blend: 0.07 };
      }
      case 'blockstun':
        if (hit) this.blockLow = hit.height !== 'high';
        return { key: this.blockLow ? 'block_low' : 'block', pose: this.blockLow ? BLOCK_LOW : BLOCK, blend: 0.05 };

      case 'jump':
        return { key: 'jump', pose: lerpPose(JUMP, ualPose(STATE_CLIPS.JUMP_FALL, this.now, this.m) ?? JUMP_FALL, clamp01(0.5 - f.vel.y / 6)), blend: 0.08 };

      case 'dodge': {
        const pose = f.style.defence === 'slip' ? SLIP : Math.abs(f.vel.z) > 0.01 || Math.abs(this.vz) > Math.abs(this.vx) ? DODGE_SIDE : DODGE_BACK;
        // Out of it again over the last third.
        return { key: 'dodge', pose: u > 0.65 ? lerpPose(pose, stance, easeInOut((u - 0.65) / 0.35)) : pose, blend: 0.09 };
      }

      case 'hitstun': {
        // Captured reactions: the head snapping back, or folding over a body shot. Played as far as the stun lasts.
        const clip = !hit || hit.height === 'high' ? REACTIONS.head : REACTIONS.body;
        const cap = reactionPose(clip, u * Math.min(clipDuration(clip), 0.25 + f.stateDuration / 60), this.m, true);
        const full = cap ?? (!hit || hit.height === 'high' ? HIT_HIGH : hit.height === 'mid' ? HIT_MID : HIT_LOW);
        // A jab moves you a little, a heavy shot a lot.
        const pose = lerpPose(stance, full, clamp((hit?.power ?? 0.6) * 1.1 - 0.1, 0.35, 1));
        // Rocked, then gathering themselves: guard comes back before they can act.
        return { key: `hit${f.hitSeq}`, pose: u > 0.55 ? lerpPose(pose, stance, easeInOut((u - 0.55) / 0.45)) : pose, blend: 0.075 };
      }
      case 'stagger': {
        const cap = reactionPose(REACTIONS.stagger, u * clipDuration(REACTIONS.stagger), this.m, true);
        if (cap) return { key: `stagger${f.hitSeq}`, pose: u > 0.8 ? lerpPose(cap, stance, easeInOut((u - 0.8) / 0.2)) : cap, blend: 0.07 };
        const pose = hit?.height === 'mid' ? STAGGER_MID : STAGGER;
        // Unsteady: swaying over the feet, then pulling it back together.
        const sway = Math.sin(f.stateFrame * 0.13 + f.id);
        const p: Pose = { ...pose, joints: { ...pose.joints, spine: add(J3(pose.joints.spine), [0.05 * sway, 0, 0.07 * sway]), head: add(J3(pose.joints.head), [0.04 * sway, 0, -0.06 * sway]) }, shift: [(pose.shift?.[0] ?? 0) + 0.035 * sway, pose.shift?.[1] ?? 0] };
        return { key: `stagger${f.hitSeq}`, pose: u > 0.7 ? lerpPose(p, stance, easeInOut((u - 0.7) / 0.3)) : p, blend: 0.07 };
      }
      case 'guardbreak': {
        // Captured (UAL): knocked back with the arms flung open, played across the state.
        const gb = ualPose(STATE_CLIPS.GUARD_BREAK, u * ualDuration(STATE_CLIPS.GUARD_BREAK) * 0.7, this.m, 1) ?? GUARD_BREAK;
        return { key: 'guardbreak', pose: u > 0.6 ? lerpPose(gb, stance, easeInOut((u - 0.6) / 0.4)) : gb, blend: 0.06 };
      }
      case 'parried': {
        const pr = ualPose(STATE_CLIPS.PARRIED, u * ualDuration(STATE_CLIPS.PARRIED) * 0.6, this.m, 1) ?? PARRIED;
        return { key: 'parried', pose: u > 0.5 ? lerpPose(pr, stance, easeInOut((u - 0.5) / 0.5)) : pr, blend: 0.05 };
      }

      case 'knockdown':
      case 'ko': {
        // Down: knees go, arms come out to break the fall, hit the floor, settle.
        const front = hit?.dir === -1;
        const t = f.stateFrame / 60;
        // Going down backwards is captured (Rokoko): knocked flat, or a knockout crumpling. Face-first falls stay hand-made.
        if (!front) {
          const clip = state === 'ko' ? REACTIONS.ko[f.id % REACTIONS.ko.length] : REACTIONS.knockdown;
          // Knocked flat: the Rokoko take or UAL's knockback, turn about; either stands in for the other.
          const ual = state === 'ko' ? null : ualPose(STATE_CLIPS.FALL_BACK, t, this.m);
          const cap = (ual && (f.id + f.hitSeq) % 2 === 1 ? ual : null) ?? reactionPose(clip, t, this.m, false) ?? ual;
          if (cap) return { key: `down${f.hitSeq}${state === 'ko' ? '' : 'k'}`, pose: cap, blend: 0.06 };
        }
        const fallT = state === 'ko' ? 0.5 : 0.42;
        const lying = front ? LYING_FRONT : state === 'ko' ? LYING_KO : LYING;
        const mid = front ? FALL_FRONT : FALL_BACK;
        const land = front ? LYING_FRONT : LAND_BACK;
        let pose: Pose;
        if (t < fallT) {
          const a = t / fallT;
          pose = a < 0.5 ? lerpPose(this.fallFrom ?? stance, mid, easeOut(a / 0.5)) : lerpPose(mid, land, (a - 0.5) / 0.5);
          // Gravity: slow off the vertical, fast into the floor.
          pose = { ...pose, pitch: (front ? 1 : -1) * (Math.PI / 2) * Math.pow(a, 2.1) };
        } else pose = lerpPose(land, lying, easeInOut(clamp01((t - fallT) / 0.35)));
        return { key: `down${f.hitSeq}${state === 'ko' ? '' : 'k'}`, pose, blend: 0.06 };
      }
      case 'getup': {
        // Up: sit or push up, get the feet under, stand into the stance.
        const front = hit?.dir === -1;
        const from = front ? LYING_FRONT : LYING;
        const mid = front ? PUSH_UP : SIT_UP;
        let pose: Pose;
        // Up off the back: UAL's captured lie-to-stand, stretched over the get-up, settling into the stance.
        const lay = front ? null : ualPose(STATE_CLIPS.GETUP_BACK, Math.min(u / 0.9, 1) * ualDuration(STATE_CLIPS.GETUP_BACK), this.m);
        if (lay) return { key: 'getup', pose: u > 0.9 ? lerpPose(lay, stance, easeInOut((u - 0.9) / 0.1)) : lay, blend: 0.08 };
        const rise = u >= 0.45 ? reactionPose(REACTIONS.getup, ((u - 0.45) / 0.55) * clipDuration(REACTIONS.getup), this.m, true) : null;
        if (u < 0.33) pose = lerpPose(from, mid, easeInOut(u / 0.33));
        else if (rise) pose = u < 0.55 ? lerpPose(CROUCH_UP, rise, easeInOut((u - 0.45) / 0.1)) : u > 0.9 ? lerpPose(rise, stance, easeInOut((u - 0.9) / 0.1)) : rise;
        else if (u < 0.78) pose = lerpPose(mid, CROUCH_UP, easeInOut((u - 0.33) / 0.45));
        else pose = lerpPose(CROUCH_UP, stance, easeInOut((u - 0.78) / 0.22));
        return { key: 'getup', pose, blend: 0.08 };
      }

      case 'clinch_hold':
        return { key: 'clinch_hold', pose: CLINCH_HOLD, blend: 0.12 };
      case 'clinched':
        return { key: 'clinched', pose: CLINCHED, blend: 0.1 };
      case 'ground_top':
        return { key: 'mount', pose: MOUNT, blend: 0.15 };
      case 'ground_bottom':
        return { key: 'bottom', pose: ualPose(STATE_CLIPS.FALL_BACK, 99, this.m) ?? LYING, blend: 0.15 };

      case 'attack': {
        const m = f.move;
        if (!m) return { key: 'stand', pose: stance, blend: 0.1 };
        return { key: `atk${f.moveSeq}`, pose: this.attackPose(m, stance), blend: clamp(m.startup / 60 / 2, 0.035, 0.09) };
      }
    }
    return { key: 'stand', pose: stance, blend: 0.15 };
  }

  private blockLow = false;
  /** Seconds, for the captured guard's loop. */
  private now = 0;
  private first = true;
  private sinceStep = 1;
  /** What the body was doing when it started to fall. */
  private fallFrom: Pose | null = null;

  /** Where in the move we are: 0 at the start, 1 on the first active frame. */
  private attackPose(m: ActiveMove, stance: Pose): Pose {
    const f = this.f;
    // A captured take for this strike (Rokoko): stretched so it lands on the move's first active frame.
    if (!f.grapple) {
      const clip = strikeClip(m.data.anim, m.data.limb, f.moveSeq) ?? ualStrikeClip(m.data.anim, m.data.limb);
      const cap = clip ? strikePose(clip, m.frame, m.startup, m.active, m.recovery, this.m) : null;
      if (cap) return cap;
    }
    const anim = animPoses(m.data.anim, m.data.limb);
    if (!anim) return stance;
    const rest = f.grapple ? (f.grapple.phase === 'ground' ? MOUNT : CLINCH_HOLD) : stance;
    const heavy = m.data.kind !== 'light';
    // Hitstop holds the frame; nothing to interpolate.
    const fr = m.frame;
    if (fr < m.startup) {
      const t = fr / m.startup;
      // Wind up (weight back, hip loaded), then accelerate into the target.
      const split = heavy ? 0.55 : 0.4;
      if (t < split) return lerpPose(rest, anim.chamber, easeInOut(t / split));
      // Hips first, then the trunk, and the limb whips out last.
      return lerpPoseChain(anim.chamber, anim.strike, (t - split) / (1 - split), easeIn, heavy ? 1 : 0.7);
    }
    // Through the target: the hips and shoulders keep turning a little past the strike pose.
    const over = this.followThrough(anim.chamber, anim.strike, heavy ? 0.14 : 0.07);
    if (fr < m.startup + m.active) return lerpPose(anim.strike, over, easeOut((fr - m.startup + 1) / m.active));
    const t = (fr - m.startup - m.active) / Math.max(1, m.recovery);
    // Recover: snap the limb back first, then settle into the stance.
    return lerpPose(over, rest, easeInOut(clamp01(t * 1.08)));
  }

  private followThrough(chamber: Pose, strike: Pose, amount: number): Pose {
    const joints = { ...strike.joints };
    for (const j of ['hips', 'spine'] as JointName[]) {
      const a = J3(chamber.joints[j]);
      const b = J3(strike.joints[j]);
      joints[j] = [b[0] + (b[0] - a[0]) * amount, b[1] + (b[1] - a[1]) * amount, b[2] + (b[2] - a[2]) * amount];
    }
    const sa = chamber.shift ?? [0, 0];
    const sb = strike.shift ?? [0, 0];
    return { ...strike, joints, shift: [sb[0] + (sb[0] - sa[0]) * amount, sb[1] + (sb[1] - sa[1]) * amount] };
  }

  // ---- 2. blending between sources -----------------------------------------------------------

  private blendTo(key: string, target: Pose, dur: number): void {
    if (key === this.key) return;
    if (key.startsWith('down')) this.fallFrom = this.lastShown;
    this.key = key;
    // Carry the difference between what was on screen and the new pose, and let it die away.
    const d = lerpPose(target, this.lastShown, 1);
    const joints: Partial<Record<JointName, Vec3>> = {};
    for (const j of JOINTS) joints[j] = sub(J3(d.joints[j]), J3(target.joints[j]));
    this.offset = {
      joints,
      drop: (d.drop ?? 0) - (target.drop ?? 0),
      pitch: (d.pitch ?? 0) - (target.pitch ?? 0),
      shift: [(d.shift?.[0] ?? 0) - (target.shift?.[0] ?? 0), (d.shift?.[1] ?? 0) - (target.shift?.[1] ?? 0)],
      ik: (d.ik ?? 1) - (target.ik ?? 1),
    };
    this.offsetT = 0;
    this.offsetDur = Math.max(0.02, dur);
  }

  private blended(target: Pose, dt: number): Pose {
    this.lastTarget = target;
    let out = target;
    if (this.offset && this.offsetT < 1) {
      this.offsetT = Math.min(1, this.offsetT + dt / this.offsetDur);
      const t = this.offsetT;
      // Smooth decay to zero, flat at both ends.
      const w = 1 - t * t * t * (t * (t * 6 - 15) + 10);
      const o = this.offset;
      const joints: Partial<Record<JointName, Vec3>> = {};
      for (const j of JOINTS) {
        const a = J3(target.joints[j]);
        const b = J3(o.joints[j]);
        joints[j] = [a[0] + b[0] * w, a[1] + b[1] * w, a[2] + b[2] * w];
      }
      out = {
        ...target,
        joints,
        drop: (target.drop ?? 0) + (o.drop ?? 0) * w,
        pitch: (target.pitch ?? 0) + (o.pitch ?? 0) * w,
        shift: [(target.shift?.[0] ?? 0) + (o.shift?.[0] ?? 0) * w, (target.shift?.[1] ?? 0) + (o.shift?.[1] ?? 0) * w],
        ik: clamp01((target.ik ?? 1) + (o.ik ?? 0) * w),
      };
    }
    this.lastShown = out;
    return out;
  }

  // ---- 3. layers -----------------------------------------------------------------------------

  private layers(base: Pose, dt: number, time: number, speed: number): Pose {
    const f = this.f;
    const j: Record<string, Vec3> = {};
    for (const n of JOINTS) j[n] = J3(base.joints[n]);
    let drop = base.drop ?? 0;
    const shift: [number, number] = [base.shift?.[0] ?? 0, base.shift?.[1] ?? 0];
    const standing = (f.state === 'idle' || f.state === 'walk' || f.state === 'block') && f.grounded;
    const ph = f.id * 1.7;

    // New hit: the body takes it.
    if (f.hitSeq !== this.hitSeq) {
      this.hitSeq = f.hitSeq;
      const h = f.lastHit;
      if (h) {
        const p = h.power * (h.blocked ? 0.38 : 1);
        const d = h.dir;
        if (h.height === 'high') {
          this.hPitch.kick(-11 * p * d);
          this.sPitch.kick(-5.5 * p * d);
          this.hYaw.kick(-9 * p * h.side);
          this.sYaw.kick(-5 * p * h.side);
          this.hRoll.kick(4 * p * h.side);
          this.sBack.kick(-0.9 * p * d);
        } else if (h.height === 'mid') {
          this.sPitch.kick(8 * p * d);
          this.hPitch.kick(5 * p * d);
          this.sRoll.kick(-4 * p * h.side);
          this.sDrop.kick(1.3 * p);
          this.sBack.kick(-1.1 * p * d);
        } else {
          this.sDrop.kick(2.0 * p);
          this.sPitch.kick(3.5 * p);
          this.sRoll.kick(3 * p * (h.side || 1));
          this.sBack.kick(-0.8 * p * d);
        }
        if (h.blocked) this.sGuard.kick(7 * h.power);
      }
    }
    const sp = this.sPitch.tick(dt), sr = this.sRoll.tick(dt), sy = this.sYaw.tick(dt);
    const hp = this.hPitch.tick(dt), hy = this.hYaw.tick(dt), hr = this.hRoll.tick(dt);
    const lying = Math.abs(base.pitch ?? 0) > 0.4;
    const rk = lying ? 0.25 : 1;
    j.spine = add(j.spine, [sp * rk, sy * rk, sr * rk]);
    j.head = add(j.head, [hp * rk, hy * rk, hr * rk]);
    drop += Math.max(0, this.sDrop.tick(dt)) * rk;
    shift[1] += this.sBack.tick(dt) * rk;
    // A blocked shot drives the gloves back into the face.
    const gk = this.sGuard.tick(dt);
    if (Math.abs(gk) > 1e-3) {
      j.lShoulder = add(j.lShoulder, [0.25 * gk, 0, 0]);
      j.rShoulder = add(j.rShoulder, [0.25 * gk, 0, 0]);
      j.lElbow = add(j.lElbow, [-0.2 * gk, 0, 0]);
      j.rElbow = add(j.rElbow, [-0.2 * gk, 0, 0]);
      j.spine = add(j.spine, [-0.12 * gk, 0, 0]);
    }

    if (standing) {
      // Breathing, and a bounce on the toes for the styles that have one.
      const breath = Math.sin(time * 1.9 + ph);
      const heavy = f.vitals.fatigue === 'exhausted' ? 2.6 : f.vitals.fatigue === 'tired' ? 1.7 : 1;
      j.spine = add(j.spine, [0.014 * heavy * breath, 0, 0]);
      j.lShoulder = add(j.lShoulder, [0, 0, 0.012 * heavy * breath]);
      j.rShoulder = add(j.rShoulder, [0, 0, -0.012 * heavy * breath]);
      const bounce = (BOUNCE[f.style.id] ?? 0.3) * this.combat * (f.state === 'block' ? 0.3 : 1) * (heavy > 2 ? 0.2 : 1);
      const rate = 5.2 + this.traits.seed * 1.6;
      drop += bounce * 0.013 * (1 + Math.sin(time * rate + ph));
      j.lShoulder = add(j.lShoulder, [0.03 * bounce * Math.sin(time * rate + ph + 0.8), 0, 0]);
      j.rShoulder = add(j.rShoulder, [0.03 * bounce * Math.sin(time * rate + ph + 2.2), 0, 0]);
      // Not fighting: weight shifts from foot to foot, the head has a look about.
      const idle = (1 - this.combat) * clamp01(1 - speed);
      shift[0] += idle * 0.022 * Math.sin(time * 0.55 + ph);
      j.hips = add(j.hips, [0, 0, idle * 0.025 * Math.sin(time * 0.55 + ph)]);
      j.head = add(j.head, [idle * 0.03 * Math.sin(time * 0.31 + ph), idle * 0.22 * Math.sin(time * 0.23 + ph * 2), 0]);

      // Walking and running: arms swing against the legs, the body leans into it.
      const [, lzL] = this.toLocal(this.feet.l.x, this.feet.l.z);
      const [, lzR] = this.toLocal(this.feet.r.x, this.feet.r.z);
      const moving = clamp01(speed / 0.8);
      const sw = clamp((lzR - lzL) / 0.55, -1.2, 1.2) * moving;
      this.swing += (sw - this.swing) * (1 - Math.exp(-16 * dt));
      this.run += (clamp01((speed - 1.5) / 1.0) - this.run) * (1 - Math.exp(-6 * dt));
      const fwd = (this.vx * Math.sin(this.yaw) + this.vz * Math.cos(this.yaw)) / this.scale;
      this.lean += (clamp(fwd / 2.6, -1, 1) - this.lean) * (1 - Math.exp(-7 * dt));
      const relaxed = 1 - this.combat;
      const s = this.swing;
      const amp = relaxed * (0.42 + 0.3 * this.run) + this.combat * 0.05;
      j.lShoulder = add(j.lShoulder, [-amp * s - relaxed * this.run * 0.15, 0, 0]);
      j.rShoulder = add(j.rShoulder, [amp * s - relaxed * this.run * 0.15, 0, 0]);
      const bend = relaxed * moving * (0.15 + 1.15 * this.run);
      j.lElbow = add(j.lElbow, [-bend - relaxed * 0.2 * Math.max(0, s), 0, 0]);
      j.rElbow = add(j.rElbow, [-bend - relaxed * 0.2 * Math.max(0, -s), 0, 0]);
      j.spine = add(j.spine, [this.lean * (0.05 + 0.1 * this.run) * (0.4 + 0.6 * relaxed), -0.1 * s * relaxed, 0]);
      j.hips = add(j.hips, [0, 0.07 * s * relaxed, 0]);
      j.head = add(j.head, [-this.lean * 0.05 * this.run, 0.04 * s * relaxed, 0]);
      drop += moving * (0.012 + 0.02 * this.run);
    } else {
      this.swing *= 0.8;
    }

    // Eyes on the opponent.
    const foe = f.target;
    if (foe && this.combat > 0.3 && !lying && f.state !== 'attack') {
      const [tx, tz] = this.toLocal(foe.pos.x, foe.pos.z);
      if (tz > 0.2) j.head = add(j.head, [0, clamp(Math.atan2(tx, tz), -0.5, 0.5) * 0.8 * this.combat, 0]);
    }
    // Necks have limits.
    const base0 = J3(base.joints.head);
    j.head = [clamp(j.head[0], base0[0] - 0.6, base0[0] + 0.6), clamp(j.head[1], -1.75, 1.75), clamp(j.head[2], -0.4, 0.4)];
    j.lElbow[0] = clamp(j.lElbow[0], -2.6, -0.03);
    j.rElbow[0] = clamp(j.rElbow[0], -2.6, -0.03);

    return { ...base, joints: j as Pose['joints'], drop, shift };
  }

  // ---- 4. feet -----------------------------------------------------------------------------

  private solve(pose: Pose, dt: number, speed: number, jumped: boolean): AnimOutput {
    const f = this.f;
    const m = this.m;
    const pitch = pose.pitch ?? 0;
    const ikW = clamp01(pose.ik ?? 1) * clamp01(1 - Math.abs(pitch) / 0.45);
    const fkBody = solveBody(pose, m);
    const grounded = f.grounded && !f.anchored;
    const joints = {} as Record<JointName, Vec3>;
    for (const n of JOINTS) joints[n] = J3(pose.joints[n]);

    // Where each foot wants to be, and whether it's on the floor at all.
    const homes: Record<Side, { x: number; z: number; yaw: number; heel: number; air: boolean }> = { l: { x: 0, z: 0, yaw: 0, heel: 0, air: true }, r: { x: 0, z: 0, yaw: 0, heel: 0, air: true } };
    const anyListed = !!(pose.feet?.l || pose.feet?.r);
    for (const s of ['l', 'r'] as Side[]) {
      const spec: FootSpec | undefined = pose.feet?.[s];
      const a = fkBody.ankle[s];
      const h = homes[s];
      if (spec) {
        const sx = s === 'l' ? 1 : -1;
        const width = 1 + (this.traits.seed - 0.5) * 0.12 + this.traits.bulk * 0.1;
        h.x = spec[0] * (Math.sign(spec[0]) === sx ? width : 1);
        h.z = spec[1];
        h.yaw = spec[2];
        h.heel = spec[3] ?? 0;
        h.air = false;
      } else {
        h.x = a[0];
        h.z = a[2];
        h.yaw = Math.atan2(fkBody.thighR[s][2], fkBody.thighR[s][8]);
        // A foot the pose doesn't plant is in the air if the pose plants the other one, or if the leg holds it up.
        h.air = anyListed || a[1] > m.ankleH + 0.14;
      }
      if (!grounded || ikW < 0.05) h.air = true;
    }

    // Walking, or being moved (a back-step, a lunge, knocked back): the feet keep up with the body either way.
    const moving = speed > 0.35;
    const vdx = speed > 0.05 ? this.vx / (speed * this.scale) : 0;
    const vdz = speed > 0.05 ? this.vz / (speed * this.scale) : 0;
    // Faster than a run (a back-step, a blitz, a big knockback) is a hop: both feet go, close together.
    const hop = speed > 2.9;
    const thr = hop ? 0.14 : moving ? clamp(0.1 + 0.075 * speed, 0.1, 0.32) : f.state === 'attack' ? 0.2 : 0.13;
    // Faster body, quicker feet: a foot is never in the air long enough to be left behind.
    const stepDur = moving ? clamp(Math.min(0.26 - 0.025 * speed, 0.44 / Math.max(0.1, speed)), 0.09, 0.26) : 0.15;
    this.sinceStep += dt;
    const order: Side[] = ['l', 'r'];
    const errOf = (s: Side) => {
      const [hx, hz] = this.toWorld(homes[s].x, homes[s].z);
      return Math.hypot(hx - this.feet[s].x, hz - this.feet[s].z) / this.scale;
    };
    if (errOf('r') > errOf('l')) order.reverse();

    for (const s of order) {
      const ft = this.feet[s];
      const other = this.feet[s === 'l' ? 'r' : 'l'];
      const h = homes[s];
      const [hx, hz] = this.toWorld(h.x, h.z);
      const homeYaw = this.yaw + h.yaw;
      ft.lift = 0;
      ft.roll = 0;
      if (h.air) {
        ft.planted = false;
        ft.step = null;
        ft.w = Math.max(0, ft.w - dt / 0.07);
        continue;
      }
      if (!ft.planted || jumped) {
        // Touching down (landing, a kick coming back, getting up): the foot goes where the pose puts it.
        ft.planted = true;
        ft.step = null;
        ft.x = hx;
        ft.z = hz;
        ft.yaw = homeYaw;
        // A leg coming down from a kick takes as long as it has far to travel.
        const a = fkBody.ankle[s];
        const far = Math.hypot(a[0] - h.x, a[1] - m.ankleH, a[2] - h.z);
        ft.rate = 1 / clamp(far / 3.2, 0.08, 0.26);
      }
      ft.w = this.first ? 1 : Math.min(1, ft.w + dt * ft.rate);
      ft.heel += (h.heel - ft.heel) * (1 - Math.exp(-18 * dt));
      // Toes pivot on the spot (the foot turns as the hips turn through a punch); the foot itself stays put.
      ft.yaw += wrap(homeYaw - ft.yaw) * (1 - Math.exp(-(ft.step ? 30 : 14) * dt));
      const ex = hx - ft.x;
      const ez = hz - ft.z;
      const err = Math.hypot(ex, ez) / this.scale;
      if (err > 1.4) {
        ft.x = hx;
        ft.z = hz;
        ft.step = null;
        continue;
      }
      if (ft.step) {
        const st = ft.step;
        st.t = Math.min(1, st.t + dt / st.dur);
        // Land where the body will be, a little ahead in the direction of travel.
        const remain = (1 - st.t) * st.dur;
        const lead = moving ? thr * 0.9 * this.scale : 0;
        const tx = hx + this.vx * remain + vdx * lead;
        const tz = hz + this.vz * remain + vdz * lead;
        const e = easeInOut(st.t);
        ft.x = st.fx + (tx - st.fx) * e;
        ft.z = st.fz + (tz - st.fz) * e;
        ft.lift = Math.sin(Math.PI * st.t) * st.lift;
        // Toes down pushing off, up coming in to land; never so far that toe or heel would dip into the floor.
        const roll = 0.28 * Math.sin(2 * Math.PI * st.t) * (moving ? 1 : 0.4);
        ft.roll = clamp(roll, -Math.asin(Math.min(0.9, ft.lift / this.m.footBack)), Math.asin(Math.min(0.9, ft.lift / this.m.footFwd)));
        this.sinceStep = 0;
        if (st.t >= 1) {
          ft.step = null;
          if (moving && (f.state === 'walk' || f.state === 'idle')) this.onStep?.();
        }
      } else {
        // Setting off from a standstill, one foot goes early (a short first step); otherwise both would be left behind together.
        const first = moving && this.sinceStep > 0.3 && s === order[0] && !other.step;
        if (err > thr * (first ? 0.35 : 1)) {
          // Walking, one foot at a time. At a jog the next foot leaves as the other is coming down. Never left far behind.
          const overlap = !moving ? 0.9 : hop ? 0 : speed > 1.7 ? 0.5 : 0.9;
          const otherBusy = other.step !== null && other.step.t < overlap && err < 0.42;
          const otherUp = !other.planted && err < 0.5;
          if (!otherBusy && !otherUp) ft.step = { fx: ft.x, fz: ft.z, t: 0, dur: stepDur * (err > thr * 1.8 ? 0.8 : 1), lift: moving ? 0.045 + 0.03 * speed : 0.04 };
        }
      }
    }

    // Hips: over the feet, as high as the pose asks, no higher than the legs can reach.
    const fl = this.feet.l, fr = this.feet.r;
    const local = (ft: Foot): Vec3 => {
      const [lx, lz] = this.toLocal(ft.x, ft.z);
      return [lx, m.ankleH + ft.lift + ft.heel * 0.75, lz];
    };
    this.first = false;
    const aim: Record<Side, Vec3> = { l: lerp3(fkBody.ankle.l, local(fl), fl.w), r: lerp3(fkBody.ankle.r, local(fr), fr.w) };
    // Nothing goes through the floor, planted or not.
    const upright = ikW > 0.05 && f.pos.y < 0.02;
    if (upright) for (const s of ['l', 'r'] as Side[]) aim[s][1] = Math.max(aim[s][1], m.ankleH);
    const pelvis: Vec3 = [fkBody.hips[0], fkBody.hips[1], fkBody.hips[2]];
    // Standing on one leg: the weight goes over it.
    const one = fl.w * (1 - fr.w) - fr.w * (1 - fl.w);
    if (Math.abs(one) > 0.01) {
      const sup = one > 0 ? aim.l : aim.r;
      const kk = Math.abs(one) * 0.5;
      pelvis[0] += (sup[0] - pelvis[0]) * kk;
      pelvis[2] += (sup[2] - pelvis[2]) * kk * 0.6;
    }
    const maxLeg = (m.thigh + m.shin) * 0.992;
    let wantY = pelvis[1];
    for (const s of ['l', 'r'] as Side[]) {
      const ft = this.feet[s];
      if (ft.w < 0.01) continue;
      const hj = add(pelvis, apply(fkBody.hipsR, s === 'l' ? m.hip : [-m.hip[0], m.hip[1], m.hip[2]]));
      const hd = Math.hypot(aim[s][0] - hj[0], aim[s][2] - hj[2]);
      if (hd > maxLeg * 0.97) {
        // Out of reach altogether (shoved a long way mid-step): bring the foot along rather than tear the leg.
        const kx = (maxLeg * 0.97) / hd;
        aim[s] = [hj[0] + (aim[s][0] - hj[0]) * kx, aim[s][1], hj[2] + (aim[s][2] - hj[2]) * kx];
      }
      const hd2 = Math.min(hd, maxLeg * 0.97);
      const reachY = aim[s][1] + Math.sqrt(maxLeg * maxLeg - hd2 * hd2) - (hj[1] - pelvis[1]);
      wantY = Math.min(wantY, pelvis[1] + (reachY - pelvis[1]) * ft.w);
    }
    // The hips don't jolt when a leg runs out of reach: they sink smoothly and rise smoothly.
    const settle = ikW > 0.05 && grounded ? 1 - Math.exp(-30 * dt) : 1;
    this.pelvisY += (Math.min(wantY, pelvis[1]) - this.pelvisY) * settle;
    if (this.pelvisY > pelvis[1]) this.pelvisY = pelvis[1];
    if (grounded && !this.wasGrounded) this.sDrop.kick(1.6); // landing: knees take it
    this.wasGrounded = grounded || f.anchored;
    pelvis[1] = ikW > 0.05 && grounded ? this.pelvisY : pelvis[1];

    const free: Side[] = [];
    for (const s of ['l', 'r'] as Side[]) {
      const ft = this.feet[s];
      const hipN = `${s}Hip` as JointName, kneeN = `${s}Knee` as JointName, footN = `${s}Foot` as JointName;
      // A leg swinging low (a kick on its way out or back) is kept clear of the floor.
      const fkAnkleY = fkBody.ankle[s][1] + (pelvis[1] - fkBody.hips[1]);
      const scrape = upright && ft.w < 1 && fkAnkleY < m.ankleH;
      const posedFoot: Vec3 = pose.joints[footN] ? J3(pose.joints[footN]) : [grounded ? 0.15 : 0.3, 0, 0];
      const hj = add(pelvis, apply(fkBody.hipsR, s === 'l' ? m.hip : [-m.hip[0], m.hip[1], m.hip[2]]));
      const yawL = wrap(ft.yaw - this.yaw);
      if (ft.w < 0.01 && !scrape) {
        // In the air: the leg is as posed. Toes are kept off the floor when the foot passes low.
        joints[footN] = posedFoot;
        free.push(s);
        continue;
      }
      // The foot's target is already blended between where the pose swings it and where it's planted, so the
      // leg is solved outright; the knee points the way the pose had it while the foot is coming down.
      const inv = transpose(fkBody.hipsR);
      const kneeFk = sub(fkBody.knee[s], fkBody.hipJoint[s]);
      const kneePlanted: Vec3 = [Math.sin(yawL), 0.1, Math.cos(yawL)];
      const sol = solveLimb(apply(inv, sub(aim[s], hj)), apply(inv, lerp3(kneeFk, kneePlanted, ft.w)), m.thigh, m.shin, 1);
      joints[hipN] = sol.root;
      joints[kneeN] = [sol.hinge, 0, 0];
      // Sole flat on the floor, toes where they were planted; heel up by as much as the pose (or the step) asks.
      const shinR = mul(mul(fkBody.hipsR, euler(sol.root)), euler([sol.hinge, 0, 0]));
      const clear = Math.max(0, aim[s][1] - m.ankleH - ft.heel * 0.75);
      const roll = clamp(ft.roll, -Math.asin(Math.min(0.9, clear / m.footBack)), Math.asin(Math.min(0.9, clear / m.footFwd)));
      const tip = Math.asin(clamp((ft.heel * 0.75) / m.footFwd, -0.9, 0.9)) + roll;
      const flat = toEuler(mul(transpose(shinR), mul(euler([0, yawL, 0]), euler([tip, 0, 0]))));
      joints[footN] = ft.w >= 1 ? flat : mixAngles(posedFoot, flat, Math.max(ft.w, scrape ? 1 : 0, upright ? clamp01((m.ankleH + 0.2 - aim[s][1]) / 0.2) : 0));
    }

    // 5. The striking hand or foot goes to the target.
    this.aimStrike(pose, joints, pelvis, fkBody.hipsR);

    // A foot in the air that passes low over the floor levels out, so toes never dig in.
    if (upright) {
      for (const s of free) {
        const sx = s === 'l' ? 1 : -1;
        const thighR = mul(fkBody.hipsR, euler(joints[`${s}Hip` as JointName]));
        const shinR = mul(thighR, euler(joints[`${s}Knee` as JointName]));
        const hj = add(pelvis, apply(fkBody.hipsR, [m.hip[0] * sx, m.hip[1], m.hip[2]]));
        const ankle = add(add(hj, apply(thighR, [0, -m.thigh, 0])), apply(shinR, [0, -m.shin, 0]));
        const low = clamp01((m.ankleH + 0.2 - ankle[1]) / 0.2);
        if (low <= 0) continue;
        const footN = `${s}Foot` as JointName;
        const toeYaw = Math.atan2(thighR[2], thighR[8]);
        joints[footN] = mixAngles(joints[footN], toEuler(mul(transpose(shinR), euler([0, toeYaw, 0]))), low);
      }
    }

    return this.finish(pose, pelvis, joints);
  }

  // ---- 5. strikes on target ------------------------------------------------------------------

  /** How much the striking limb is on its way to the target (0..1). */
  strikeWeight(m: ActiveMove): number {
    const heavy = m.data.kind !== 'light';
    const split = heavy ? 0.55 : 0.4;
    if (m.frame < m.startup) {
      const t = m.frame / m.startup;
      return t < split ? 0 : easeIn((t - split) / (1 - split));
    }
    if (isActiveFrame(m)) return 1;
    const t = (m.frame - m.startup - m.active) / Math.max(1, m.recovery);
    return clamp01(1 - easeOut(clamp01(t * 2.4)));
  }

  /** Where the strike is aimed, in the fighter's frame. */
  strikePoint(m: ActiveMove): Vec3 {
    const f = this.f;
    const d = m.data;
    const foot = d.limb === 'leadFoot' || d.limb === 'rearFoot';
    let z = d.reach - (foot ? 0.12 : 0.06);
    let x = 0;
    let y = d.hitY / this.scale;
    const foe = f.target;
    if (foe && !foe.isKO && !f.grapple) {
      const [tx, tz] = this.toLocal(foe.pos.x, foe.pos.z);
      if (tz > 0.25 && tz < d.reach + 0.8 && Math.abs(tx) < d.depthTolerance + 0.3) {
        // The surface of the opponent, not their middle and not thin air.
        z = clamp(tz - (foot ? 0.24 : 0.2), d.reach - 0.4, d.reach + 0.1);
        x = clamp(tx, -0.3, 0.3) * 0.85;
        if (d.height === 'high') y = clamp((1.5 * (foe.appearance.height ?? 1) + foe.pos.y - f.pos.y) / this.scale, y - 0.2, y + 0.2);
      }
    }
    return [x, y, z];
  }

  private aimStrike(pose: Pose, joints: Record<JointName, Vec3>, pelvis: Vec3, hipsR: M3): void {
    const f = this.f;
    const mv = f.state === 'attack' ? f.move : null;
    if (!mv || NO_AIM.has(mv.data.anim) || (pose.ik ?? 1) < 0.5 || f.grapple) return;
    const limb = STRIKE_LIMBS[mv.data.limb];
    if (!limb) return;
    const w = this.strikeWeight(mv);
    if (w <= 0.001) return;
    const m = this.m;
    const goal = this.strikePoint(mv);
    const sx = limb.side === 'l' ? 1 : -1;
    if (limb.kind === 'hand') {
      const spineR = mul(hipsR, euler(joints.spine));
      const sh = add(add(pelvis, apply(hipsR, m.spine)), apply(spineR, [m.shoulder[0] * sx, m.shoulder[1], m.shoulder[2]]));
      const shN = `${limb.side}Shoulder` as JointName, elN = `${limb.side}Elbow` as JointName;
      const armR = mul(spineR, euler(joints[shN]));
      const elbow = add(sh, apply(armR, [0, -m.upperArm, 0]));
      const hand = add(elbow, apply(mul(armR, euler(joints[elN])), [0, -m.foreArm, 0]));
      const to = lerp3(hand, goal, w);
      const inv = transpose(spineR);
      const sol = solveLimb(apply(inv, sub(to, sh)), apply(inv, sub(elbow, sh)), m.upperArm, m.foreArm, -1);
      joints[shN] = sol.root;
      joints[elN] = [sol.hinge, 0, 0];
    } else {
      // Only a foot that's off the floor is a kick.
      if (this.feet[limb.side].w > 0.5) return;
      const hpN = `${limb.side}Hip` as JointName, knN = `${limb.side}Knee` as JointName;
      const hj = add(pelvis, apply(hipsR, [m.hip[0] * sx, m.hip[1], m.hip[2]]));
      const thighR = mul(hipsR, euler(joints[hpN]));
      const knee = add(hj, apply(thighR, [0, -m.thigh, 0]));
      const ankle = add(knee, apply(mul(thighR, euler(joints[knN])), [0, -m.shin, 0]));
      const to = lerp3(ankle, goal, w * 0.9);
      const inv = transpose(hipsR);
      const sol = solveLimb(apply(inv, sub(to, hj)), apply(inv, sub(knee, hj)), m.thigh, m.shin, 1);
      joints[hpN] = sol.root;
      joints[knN] = [sol.hinge, 0, 0];
    }
  }

  private finish(pose: Pose, pelvis: Vec3, joints: Record<JointName, Vec3>): AnimOutput {
    const out = {} as Record<JointName, Vec3>;
    for (const n of JOINTS) out[n] = J3(joints[n]);
    return { joints: out, hips: pelvis, pitch: pose.pitch ?? 0, yaw: this.yaw };
  }

  /** The pose before foot planting (tests). */
  get shown(): Pose {
    return this.lastShown;
  }

  get targetPose(): Pose {
    return this.lastTarget;
  }
}

/** Blend two sets of joint angles the short way round. */
function mixAngles(a: Vec3, b: Vec3, t: number): Vec3 {
  return [a[0] + wrap(b[0] - a[0]) * t, a[1] + wrap(b[1] - a[1]) * t, a[2] + wrap(b[2] - a[2]) * t];
}
