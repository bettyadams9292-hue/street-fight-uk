import type { ActiveMove } from '../combat/MoveData';
import type { Rng } from '../core/Rng';
import type { Fighter } from '../fighter/Fighter';
import { emptyCommand, type AttackButton, type CommandFrame } from '../input/Commands';
import type { Archetype } from './archetypes';
import type { AttackTokens } from './AttackTokens';

export type AIMode = 'approach' | 'space' | 'engage' | 'defend' | 'recover' | 'wait' | 'grapple' | 'down';

/**
 * Enemy brain. Reads the fight like a player would (positions, what the
 * opponent is doing, its own stamina) and presses the same buttons a player
 * presses, through a CommandFrame. Archetype numbers shape its personality.
 */
export class FighterAI {
  mode: AIMode = 'approach';
  /** Bosses go berserk below half health. */
  enraged = false;

  private plan: AttackButton[] = [];
  private nextAttackAt = 0;
  private blockUntil = -1;
  private parryAt = -1;
  private decided: ActiveMove | null = null;
  private knockdownChoice = -1;
  private grappleActAt = 0;
  private nextSwapAt = 0;
  private hover: number;

  constructor(
    readonly self: Fighter,
    readonly archetype: Archetype,
    private readonly rng: Rng,
    private readonly tokens: AttackTokens,
  ) {
    this.hover = 2.2 + rng.next() * 0.8;
    this.nextSwapAt = 300 + Math.floor(rng.next() * 300);
  }

  think(frame: number): CommandFrame {
    const cmd = emptyCommand();
    const me = this.self;
    const foe = me.target;
    const a = this.archetype;

    // Boss phase two.
    if (a.boss && !this.enraged && !me.isKO && me.vitals.health < me.vitals.maxHealth * 0.5) {
      this.enraged = true;
      me.stats.addModifier({ id: 'enraged_dmg', source: 'enraged', stat: 'damageMult', mul: 1.2 });
      me.stats.addModifier({ id: 'enraged_spd', source: 'enraged', stat: 'attackSpeedMult', mul: 1.1 });
    }

    if (me.isKO || !foe || foe.isKO) {
      this.tokens.release(me);
      return cmd;
    }
    const aggression = Math.min(1, a.aggression + (this.enraged ? 0.25 : 0));

    // ---- on the floor ----------------------------------------------------------------
    if (me.state === 'knockdown') {
      this.mode = 'down';
      this.tokens.release(me);
      if (me.stateFrame >= 18 && this.knockdownChoice < 0) this.knockdownChoice = this.rng.next();
      if (this.knockdownChoice >= 0 && me.stateFrame >= 20) {
        const r = this.knockdownChoice;
        const close = Math.abs(foe.pos.x - me.pos.x) < 1.1;
        if (me.style.defence === 'guard_pull' && close && r < 0.5) cmd.pressed.grab = true;
        else if (r < 0.35) cmd.pressed.jump = true;
        else if (r < 0.6) cmd.moveZ = me.pos.z > 0 ? -1 : 1;
        else if (r < 0.8 && close) cmd.pressed.lk = true;
        // otherwise stay down and get up when the timer runs out
      }
      return cmd;
    }
    this.knockdownChoice = -1;

    // ---- grappling ------------------------------------------------------------------
    if (me.grapple) {
      this.mode = 'grapple';
      this.plan = [];
      const link = me.grapple;
      if (link.role === 'held') {
        if (link.submitting) cmd.block = true;
        if (frame >= link.escapeReadyAt && this.rng.chance(0.25)) cmd.pressed.grab = true;
        return cmd;
      }
      if (me.state === 'attack' || frame < this.grappleActAt) return cmd;
      this.grappleActAt = frame + 18 + Math.floor(this.rng.next() * 20);
      const r = this.rng.next();
      if (link.phase === 'ground') {
        const foeTired = foe.vitals.stamina / foe.vitals.maxStamina < 0.5;
        if (!link.submitting && (foeTired || r < 0.35)) cmd.pressed.hp = true;
        else if (!link.submitting) cmd.pressed.lp = true;
      } else if (me.vitals.stamina / me.vitals.maxStamina < 0.2) {
        cmd.pressed.grab = true; // let go
      } else if (r < 0.5) cmd.pressed.lp = true;
      else if (r < 0.75) cmd.pressed.lk = true;
      else cmd.pressed.hk = true;
      return cmd;
    }

    const dx = foe.pos.x - me.pos.x;
    const dz = foe.pos.z - me.pos.z;
    const dist = Math.abs(dx);
    const toward = Math.sign(dx) || me.facing;

    // ---- keep a planned combo going ----------------------------------------------------
    if (me.state === 'attack' && me.move) {
      const m = me.move;
      if (this.plan.length && m.frame >= m.startup + m.active - 1) {
        if (m.connected || this.rng.chance(0.3)) cmd.pressed[this.plan.shift()!] = true;
        else this.plan = [];
      }
      return cmd;
    }
    if (!me.isFree) return cmd;

    // ---- defend: react to what the opponent is throwing ----------------------------------
    if (frame <= this.blockUntil) {
      cmd.block = true;
      this.mode = 'defend';
      return cmd;
    }
    if (this.parryAt >= 0) {
      if (frame >= this.parryAt) {
        cmd.block = true;
        this.blockUntil = frame + 8;
        this.parryAt = -1;
      }
      this.mode = 'defend';
      return cmd;
    }
    const fm = foe.state === 'attack' ? foe.move : null;
    if (fm && fm !== this.decided && fm.frame >= Math.min(fm.startup - 1, Math.round(a.reactionFrames * 0.4)) && fm.frame < fm.startup) {
      this.decided = fm;
      const threat = dist < fm.data.reach + 0.6 && Math.abs(dz) < fm.data.depthTolerance + 0.3 && foe.isFacing(me);
      if (threat) {
        const r = this.rng.next();
        const grab = fm.data.kind === 'grab';
        if (!grab && r < a.parryChance) {
          this.parryAt = frame + Math.max(0, fm.startup - fm.frame - 3);
          this.mode = 'defend';
          return cmd;
        }
        if (r < a.parryChance + a.dodgeChance || (grab && r < 0.5)) {
          cmd.pressed.dodge = true;
          if (me.style.defence !== 'slip') cmd.moveZ = me.pos.z > 0.5 ? -1 : 1;
          this.mode = 'defend';
          return cmd;
        }
        if (!grab || me.style.defence === 'sprawl') {
          if (r < a.parryChance + a.dodgeChance + a.blockChance) {
            this.blockUntil = frame + (fm.startup - fm.frame) + fm.active + 4;
            cmd.block = true;
            this.mode = 'defend';
            return cmd;
          }
        }
      }
    }

    // ---- exhausted: back off --------------------------------------------------------------
    const stamina = me.vitals.stamina / me.vitals.maxStamina;
    if (a.retreatsWhenTired && (me.stats.hasTag('state.exhausted') || (this.mode === 'recover' && stamina < 0.45))) {
      this.mode = 'recover';
      this.tokens.release(me);
      if (dist < 2.8) cmd.moveX = -toward;
      if (Math.abs(dz) < 0.6) cmd.moveZ = me.pos.z >= 0 ? 0.6 : -0.6;
      return cmd;
    }

    // ---- stance swap (rivals and the boss) ------------------------------------------------
    if (me.secondaryStyle && frame >= this.nextSwapAt && stamina > 0.4) {
      this.nextSwapAt = frame + 360 + Math.floor(this.rng.next() * 360);
      cmd.pressed.swap = true;
      return cmd;
    }

    // ---- only a couple attack at once; the rest hover ---------------------------------------
    if (!this.tokens.request(me, foe)) {
      this.mode = 'wait';
      const want = this.hover;
      if (dist < want - 0.3) cmd.moveX = -toward;
      else if (dist > want + 0.5) cmd.moveX = toward * 0.6;
      const lane = ((me.id % 3) - 1) * 0.9;
      if (Math.abs(me.pos.z - lane) > 0.2) cmd.moveZ = Math.sign(lane - me.pos.z) * 0.6;
      return cmd;
    }

    // ---- spacing ------------------------------------------------------------------------------
    if (Math.abs(dz) > 0.22) cmd.moveZ = Math.sign(dz);
    const range = a.range;
    if (dist > range + 0.3) {
      this.mode = 'approach';
      cmd.moveX = toward;
      return cmd;
    }
    if (dist < range - 0.35) {
      this.mode = 'space';
      cmd.moveX = -toward * 0.6;
    } else {
      this.mode = 'engage';
    }

    // ---- attack -------------------------------------------------------------------------------
    if (frame < this.nextAttackAt || Math.abs(dz) > 0.35) return cmd;
    this.nextAttackAt = frame + Math.round((30 + this.rng.next() * 50) / (aggression + 0.3));
    if (!this.rng.chance(aggression + 0.2)) return cmd;
    cmd.moveX = 0;

    if (me.canFinish(foe)) {
      cmd.special = true;
      cmd.pressed.hp = true;
      return cmd;
    }
    const style = me.style;
    if (this.rng.chance(a.grabChance)) {
      const shoot = style.moves[style.starters.lk]?.kind === 'grab';
      if (shoot && dist < 1.2) cmd.pressed.lk = true;
      else if (dist < 0.8) cmd.pressed.grab = true;
      else cmd.moveX = toward;
      return cmd;
    }
    const specials = Object.keys(style.specials) as AttackButton[];
    if (specials.length && this.rng.chance(a.specialChance + (this.enraged ? 0.15 : 0)) && stamina > 0.3) {
      cmd.special = true;
      cmd.pressed[specials[Math.floor(this.rng.next() * specials.length)]] = true;
      return cmd;
    }
    const starter = this.pickStarter();
    cmd.pressed[starter] = true;
    this.plan = this.planCombo(starter, a.comboLength - 1);
    return cmd;
  }

  private pickStarter(): AttackButton {
    const r = this.rng.next();
    const tired = this.self.stats.hasTag('state.tired') || this.self.stats.hasTag('state.exhausted');
    if (r < 0.42) return 'lp';
    if (r < 0.67) return 'lk';
    if (r < 0.85) return tired ? 'lp' : 'hp';
    return tired ? 'lk' : 'hk';
  }

  /** Follow the style's combo graph from a starter. */
  private planCombo(starter: AttackButton, length: number): AttackButton[] {
    const style = this.self.style;
    const plan: AttackButton[] = [];
    let current = style.moves[style.starters[starter]];
    for (let i = 0; i < length && current; i++) {
      const options = Object.keys(current.next) as AttackButton[];
      if (!options.length) break;
      const b = options[Math.floor(this.rng.next() * options.length)];
      plan.push(b);
      current = style.moves[current.next[b]!];
    }
    return plan;
  }
}
