import type { Fighter } from '../fighter/Fighter';
import { emptyCommand, type CommandFrame } from '../input/Commands';

/**
 * Cousin Mo in a tutorial lesson (src/tutorial): the real fighter and the real combat engine, with his
 * choices scripted so a beginner can read them.
 *
 * - stand: hands down, lets you hit him (the attack lessons).
 * - swing: walks into range and throws one slow, telegraphed hard punch every few seconds (block, parry, dodge).
 * - grab: walks in and grabs you, again after you break free (breaking a grab).
 * - hold: stands still and lets you grab him (grabbing).
 */
export type LessonMode = 'stand' | 'swing' | 'grab' | 'hold';

/** Seconds between Mo's swings: time to read it, act, and see what happened. */
export const LESSON_SWING_GAP = 2.6;
const SIM_HZ = 60;

export class TutorialBrain {
  mode: LessonMode = 'stand';
  private nextAt = 0;

  constructor(private readonly self: Fighter) {}

  /** Change what Mo's doing; his next swing or grab waits a beat so it never comes out of nowhere. */
  setMode(mode: LessonMode, frame: number): void {
    // Asked again for what he's already doing (the tutorial asks every frame): carry on as he is.
    if (mode === this.mode && this.nextAt > 0) return;
    this.mode = mode;
    this.nextAt = frame + SIM_HZ * 1.2;
  }

  think(frame: number): CommandFrame {
    const cmd = emptyCommand();
    const me = this.self;
    const foe = me.target;
    if (me.isKO || !foe) return cmd;
    // Held: let go after a moment, so he never pins you for long.
    if (me.grapple?.role === 'held') {
      if (frame % 90 === 0) cmd.pressed.grab = true;
      return cmd;
    }
    const dx = foe.pos.x - me.pos.x;
    const dz = foe.pos.z - me.pos.z;
    const dist = Math.hypot(dx, dz);
    // Never stood on top of you: he steps back to a distance your hits can land from.
    if (dist < 0.6 && me.isFree && !foe.grapple) {
      cmd.moveX = -Math.sign(dx || 1) * 0.6;
      return cmd;
    }
    if (this.mode === 'stand' || this.mode === 'hold') return cmd;
    if (foe.grapple) return cmd;
    // Into range: close enough to reach you, not so close he's on top of you.
    if (dist > 1.05) {
      cmd.moveX = Math.sign(dx) * Math.min(1, Math.abs(dx));
      cmd.moveZ = Math.max(-1, Math.min(1, dz * 2));
      return cmd;
    }
    if (frame < this.nextAt || !me.isFree) return cmd;
    this.nextAt = frame + SIM_HZ * LESSON_SWING_GAP;
    if (this.mode === 'swing') cmd.pressed.hp = true;
    else cmd.pressed.grab = true;
    return cmd;
  }
}
