import { emptyCommand, type CommandFrame } from '../input/Commands';
import type { Fighter } from '../fighter/Fighter';
import type { Arena } from '../world/Arena';

/**
 * Household activities: a short script the player's character acts out —
 * walk to the fridge, open it, take things out, walk to the worktop, chop,
 * walk to the hob, stir, plate up — while the house carries on around them.
 *
 * Walking uses the normal movement (so walls and furniture are respected,
 * along the hallway when there's no straight line), with a safety net: if
 * the way's blocked for too long the character is moved to the spot, so
 * nobody ever ends up stuck. Each action eases the character into place
 * (stepping into the shower, lying down on the bed, sitting at the table),
 * pins them there while it plays, and eases them back out to where they
 * stepped in from when it ends. Everything can be stopped at any point; the
 * character always ends up standing, free to move, on open floor.
 */

export interface ActStep {
  kind: 'act';
  /** Where to be while doing it (defaults: where you are). */
  x?: number;
  z?: number;
  /** Height off the floor (stood in the bath, lying on the bed). */
  y?: number;
  /** Which way to face: 0 towards the camera, PI towards the back wall. */
  yaw: number;
  /** FighterView activity pose. */
  pose: string;
  /** Seconds. */
  secs: number;
  label: string;
  /** Called every simulation step with the step's progress 0..1. */
  tick?: (dt: number, k: number) => void;
  /** Called once when the step starts / finishes properly (not if stopped). */
  start?: () => void;
  done?: () => void;
}

export interface WalkStep {
  kind: 'walk';
  x: number;
  z: number;
  label: string;
}

export type Step = ActStep | WalkStep;

/** The hallway that runs past every doorway. */
const LANE_Z = 0.95;
/** Ease in and out of places this fast. */
const SETTLE = 0.4;

export class HouseActivity {
  private index = -1;
  private t = 0;
  private path: { x: number; z: number }[] = [];
  private walkT = 0;
  private stuckT = 0;
  private lastPos = { x: 0, z: 0 };
  /** Easing into / out of a spot. */
  private tween: { t: number; from: { x: number; z: number; y: number }; to: { x: number; z: number; y: number }; out: boolean } | null = null;
  /** Where to step back out to (open floor). */
  private exit: { x: number; z: number } | null = null;
  finished = false;
  cancelled = false;
  /** Times the safety net had to move the character (the way was blocked). */
  forced = 0;
  /** Fires when each step begins (for sounds and effects). */
  onStep: ((s: Step, i: number) => void) | null = null;
  /** Fires once at the very end. */
  onEnd: ((cancelled: boolean, at: number) => void) | null = null;

  constructor(
    readonly title: string,
    readonly steps: Step[],
    private readonly f: Fighter,
    private readonly arena: Arena,
    /** Let go of whatever stops moving in the house (seats claimed, etc.) */
    readonly key = title,
  ) {}

  get current(): Step | null {
    return this.steps[this.index] ?? null;
  }

  get stepIndex(): number {
    return this.index;
  }

  /** For the progress bar: the current step's label and progress, and the whole thing's. */
  get progress(): { label: string; step: number; overall: number } {
    const s = this.current;
    if (!s) return { label: this.title, step: 1, overall: 1 };
    const total = this.steps.reduce((a, x) => a + (x.kind === 'act' ? x.secs : 1.5), 0);
    let done = 0;
    for (let i = 0; i < this.index; i++) done += this.steps[i].kind === 'act' ? (this.steps[i] as ActStep).secs : 1.5;
    const stepFrac = s.kind === 'act' ? Math.min(1, this.t / s.secs) : Math.min(1, this.walkT / 1.5);
    done += s.kind === 'act' ? s.secs * stepFrac : 1.5 * stepFrac;
    return { label: s.label, step: stepFrac, overall: Math.min(1, done / Math.max(0.01, total)) };
  }

  /** Stop now: ease out of wherever you are, then end. */
  cancel(): void {
    if (this.finished || this.cancelled) return;
    this.cancelled = true;
    this.beginExit();
  }

  /** One simulation step. Returns the player's command (movement when walking, nothing otherwise). */
  update(dt: number): CommandFrame {
    const f = this.f;
    if (this.finished) return emptyCommand();
    if (this.index < 0) this.next();
    // Easing in or out of a spot.
    if (this.tween) {
      const tw = this.tween;
      tw.t = Math.min(1, tw.t + dt / SETTLE);
      const k = tw.t * tw.t * (3 - 2 * tw.t);
      f.pos.x = tw.from.x + (tw.to.x - tw.from.x) * k;
      f.pos.z = tw.from.z + (tw.to.z - tw.from.z) * k;
      f.pos.y = tw.from.y + (tw.to.y - tw.from.y) * k;
      if (tw.t >= 1) {
        this.tween = null;
        if (tw.out) this.release();
      }
      return emptyCommand();
    }
    if (this.cancelled) {
      this.release();
      return emptyCommand();
    }
    const s = this.current;
    if (!s) return emptyCommand();
    if (s.kind === 'walk') return this.walk(s, dt);
    this.t += dt;
    s.tick?.(dt, Math.min(1, this.t / s.secs));
    if (this.t >= s.secs) {
      s.done?.();
      this.next();
    }
    return emptyCommand();
  }

  private next(): void {
    this.index++;
    this.t = 0;
    this.walkT = 0;
    const s = this.current;
    if (!s) {
      this.beginExit();
      return;
    }
    const f = this.f;
    if (s.kind === 'walk') {
      // Off whatever you were on first.
      if (f.anchored) {
        this.stepOut(() => this.planWalk(s));
        return;
      }
      this.planWalk(s);
    } else {
      f.activity = s.pose;
      f.yawOverride = s.yaw;
      const to = { x: s.x ?? f.pos.x, z: s.z ?? f.pos.z, y: s.y ?? (s.x === undefined && s.z === undefined ? f.pos.y : 0) };
      const moving = Math.hypot(to.x - f.pos.x, to.z - f.pos.z) > 0.03 || Math.abs(to.y - f.pos.y) > 0.01;
      // Pinned in place while doing it (nobody shoves you off the hob).
      if (!f.anchored) this.exit = { x: f.pos.x, z: f.pos.z };
      f.anchored = true;
      if (moving) this.tween = { t: 0, from: { x: f.pos.x, z: f.pos.z, y: f.pos.y }, to, out: false };
      s.start?.();
    }
    this.onStep?.(s, this.index);
  }

  /** Step back out of a spot to open floor, then carry on. */
  private stepOut(then: () => void): void {
    const f = this.f;
    const ex = this.exit ?? { x: f.pos.x, z: f.pos.z + 0.4 };
    this.exit = null;
    f.activity = null;
    if (Math.hypot(ex.x - f.pos.x, ex.z - f.pos.z) < 0.03 && f.pos.y < 0.01) {
      f.anchored = false;
      f.yawOverride = null;
      then();
      return;
    }
    this.tween = { t: 0, from: { x: f.pos.x, z: f.pos.z, y: f.pos.y }, to: { x: ex.x, z: ex.z, y: 0 }, out: false };
    // When the tween ends, let go and carry on.
    const tw = this.tween;
    const check = () => {
      if (this.tween === tw) return;
      f.anchored = false;
      f.yawOverride = null;
      then();
    };
    this.pendingAfterTween = check;
  }

  private pendingAfterTween: (() => void) | null = null;

  private planWalk(s: WalkStep): void {
    const f = this.f;
    f.activity = null;
    f.yawOverride = null;
    this.path = this.clearLine(f.pos.x, f.pos.z, s.x, s.z) ? [{ x: s.x, z: s.z }] : [{ x: f.pos.x, z: LANE_Z }, { x: s.x, z: LANE_Z }, { x: s.x, z: s.z }];
    this.stuckT = 0;
    this.lastPos = { x: f.pos.x, z: f.pos.z };
  }

  private clearLine(x0: number, z0: number, x1: number, z1: number): boolean {
    const n = Math.max(2, Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 0.2));
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      if (this.arena.blocked(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t, 0.2)) return false;
    }
    return true;
  }

  private walk(s: WalkStep, dt: number): CommandFrame {
    const f = this.f;
    if (this.pendingAfterTween) {
      const p = this.pendingAfterTween;
      this.pendingAfterTween = null;
      p();
    }
    this.walkT += dt;
    const cmd = emptyCommand();
    const target = this.path[0];
    if (!target) {
      this.next();
      return cmd;
    }
    const dx = target.x - f.pos.x;
    const dz = target.z - f.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.1) {
      this.path.shift();
      return cmd;
    }
    // Slow down for the last bit so you arrive on the spot.
    const sp = Math.min(1, 0.35 + d * 1.5);
    cmd.moveX = (dx / d) * sp;
    cmd.moveZ = (dz / d) * sp;
    if (Math.abs(dx) > 0.04) f.facing = dx > 0 ? 1 : -1;
    // Blocked (someone in the way): skip a waypoint; still stuck after a while, just get there.
    this.stuckT += dt;
    if (this.stuckT > 0.8) {
      const moved = Math.hypot(f.pos.x - this.lastPos.x, f.pos.z - this.lastPos.z);
      this.lastPos = { x: f.pos.x, z: f.pos.z };
      this.stuckT = 0;
      if (moved < 0.1) {
        if (this.path.length > 1) this.path.shift();
        else this.forceArrive(s);
      }
    }
    if (this.walkT > 9) this.forceArrive(s);
    return cmd;
  }

  private forceArrive(s: WalkStep): void {
    this.forced++;
    this.f.pos.x = s.x;
    this.f.pos.z = s.z;
    this.path = [];
  }

  private beginExit(): void {
    const f = this.f;
    this.pendingAfterTween = null;
    if (f.anchored) {
      const ex = this.exit ?? { x: f.pos.x, z: f.pos.z };
      this.exit = null;
      f.activity = null;
      if (Math.hypot(ex.x - f.pos.x, ex.z - f.pos.z) > 0.03 || f.pos.y > 0.01) {
        this.tween = { t: 0, from: { x: f.pos.x, z: f.pos.z, y: f.pos.y }, to: { x: ex.x, z: ex.z, y: 0 }, out: true };
        return;
      }
    }
    this.release();
  }

  /** Back to normal: standing, free, on the floor. */
  private release(): void {
    if (this.finished) return;
    const f = this.f;
    f.anchored = false;
    f.activity = null;
    f.yawOverride = null;
    f.pos.y = 0;
    this.finished = true;
    this.onEnd?.(this.cancelled, this.index);
  }

  /** Emergency stop (leaving the area, getting hit): straight back to standing where you are. */
  abort(): void {
    if (this.finished) return;
    this.cancelled = true;
    const f = this.f;
    if (f.anchored && this.exit) {
      f.pos.x = this.exit.x;
      f.pos.z = this.exit.z;
    }
    this.tween = null;
    this.release();
  }
}
