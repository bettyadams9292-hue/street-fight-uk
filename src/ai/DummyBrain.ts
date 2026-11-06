import type { Rng } from '../core/Rng';
import type { Fighter } from '../fighter/Fighter';
import { emptyCommand, type AttackButton, type CommandFrame } from '../input/Commands';

export type DummyMode = 'stand' | 'block' | 'spar';

export const DUMMY_MODE_LABELS: Record<DummyMode, string> = {
  stand: 'Stand still',
  block: 'Always block',
  spar: 'Spar back',
};

/**
 * Brain for the Stage 1 sparring partner. It drives its fighter through the
 * same CommandFrame the player uses. Stage 3 replaces this with the full AI
 * (state machine, archetypes, attack tokens); "spar" mode is an early version.
 */
export class DummyBrain {
  mode: DummyMode = 'stand';
  private nextDecision = 0;
  private holdBlockUntil = 0;
  private retreatUntil = 0;
  private plannedCombo: AttackButton[] = [];

  constructor(private readonly self: Fighter, private readonly rng: Rng) {}

  think(frame: number): CommandFrame {
    const cmd = emptyCommand();
    const me = this.self;
    const foe = me.target;
    if (me.isKO || !foe || foe.isKO) return cmd;

    if (this.mode === 'stand') return cmd;

    if (this.mode === 'block') {
      cmd.block = true;
      return cmd;
    }

    // ---- spar ----
    const dx = foe.pos.x - me.pos.x;
    const dz = foe.pos.z - me.pos.z;
    const dist = Math.abs(dx);
    const tired = me.stats.hasTag('state.exhausted') || me.stats.hasTag('state.tired');

    // Keep pressing a planned combo while it's connecting.
    if (this.plannedCombo.length > 0 && me.state === 'attack') {
      const btn = this.plannedCombo[0];
      if (me.move && me.move.frame >= me.move.startup + me.move.active) {
        cmd.pressed[btn] = true;
        this.plannedCombo.shift();
      }
      return cmd;
    }

    // React to the player's attacks by blocking sometimes.
    if (frame < this.holdBlockUntil) {
      cmd.block = true;
      return cmd;
    }
    if (foe.state === 'attack' && dist < 1.6 && me.state !== 'attack' && this.rng.chance(0.06)) {
      this.holdBlockUntil = frame + 24;
      cmd.block = true;
      return cmd;
    }

    // Exhausted: back off to recover stamina.
    if (me.stats.hasTag('state.exhausted') && frame >= this.retreatUntil) this.retreatUntil = frame + 90;
    if (frame < this.retreatUntil) {
      cmd.moveX = -Math.sign(dx);
      return cmd;
    }

    // Line up in depth.
    if (Math.abs(dz) > 0.25) cmd.moveZ = Math.sign(dz);

    if (dist > 1.1) {
      cmd.moveX = Math.sign(dx);
    } else if (dist < 0.75) {
      cmd.moveX = -Math.sign(dx) * 0.5;
    } else if (frame >= this.nextDecision && Math.abs(dz) < 0.35) {
      this.nextDecision = frame + Math.round(this.rng.range(35, 80) * (tired ? 1.6 : 1));
      const roll = this.rng.next();
      if (roll < 0.45) {
        cmd.pressed.lp = true;
        this.plannedCombo = this.rng.chance(0.5) ? ['lp'] : [];
      } else if (roll < 0.7) {
        cmd.pressed.lk = true;
      } else if (roll < 0.85 && !tired) {
        cmd.pressed.hp = true;
      } else {
        this.holdBlockUntil = frame + 30;
        cmd.block = true;
      }
    }
    return cmd;
  }
}
