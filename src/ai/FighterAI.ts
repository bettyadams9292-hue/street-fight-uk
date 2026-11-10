import type { Arena } from '../world/Arena';
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
  private detour = 0;
  /** 0 never trained .. 1 seasoned: decides how much of the craft below they use. */
  private skill = 0.5;
  /** Step back out of range until this frame (in and out, not stood in the pocket). */
  private outUntil = -1;
  /** My last attack, to see how it went once it's over. */
  private watched: ActiveMove | null = null;
  private foeHitSeq = 0;
  private myHitSeq = 0;
  /** Attacks of mine blocked in a row; hits I've taken lately. */
  private blockedStreak = 0;
  private rattled = 0;
  private lastStarters: AttackButton[] = [];
  private bob: number;

  constructor(
    readonly self: Fighter,
    readonly archetype: Archetype,
    private readonly rng: Rng,
    private readonly tokens: AttackTokens,
    private readonly arena: Arena | null = null,
  ) {
    this.hover = 2.2 + rng.next() * 0.8;
    this.bob = rng.next() * 6.28;
    this.skill = Math.max(0, Math.min(1, (self.stats.attr('technique') - 2) / 8));
    this.nextSwapAt = 300 + Math.floor(rng.next() * 300);
  }

  think(frame: number): CommandFrame {
    const cmd = this.decide(frame);
    if (this.arena) this.steer(cmd);
    return cmd;
  }

  /**
   * Walk round solid things instead of grinding into them: if the way ahead is
   * blocked, slide along it in depth toward whichever side is open.
   */
  private steer(cmd: CommandFrame): void {
    const me = this.self;
    if (!me.isFree || Math.abs(cmd.moveX) < 0.1) {
      this.detour = 0;
      return;
    }
    const arena = this.arena!;
    const sx = Math.sign(cmd.moveX);
    if (!arena.blocked(me.pos.x + sx * 0.3, me.pos.z)) {
      if (this.detour && !arena.blocked(me.pos.x + sx * 0.3, me.pos.z - this.detour * 0.5)) this.detour = 0;
      if (this.detour) cmd.moveZ = this.detour;
      return;
    }
    if (!this.detour) {
      const foeZ = me.target?.pos.z ?? 0;
      const up = !arena.blocked(me.pos.x + sx * 0.3, me.pos.z - 0.6);
      const down = !arena.blocked(me.pos.x + sx * 0.3, me.pos.z + 0.6);
      if (up && down) this.detour = foeZ < me.pos.z ? -1 : 1;
      else if (up) this.detour = -1;
      else if (down) this.detour = 1;
      else this.detour = me.pos.z > 0 ? -1 : 1;
    }
    cmd.moveZ = this.detour;
    // Keep a little forward pressure so it slides round the corner.
    cmd.moveX = sx * 0.3;
  }

  private decide(frame: number): CommandFrame {
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

    // ---- how's it going? -------------------------------------------------------------------
    // Taking hits rattles a fighter (more so a novice): they cover up more for a few seconds.
    if (me.hitSeq !== this.myHitSeq) {
      if (me.lastHit && !me.lastHit.blocked) this.rattled = Math.min(3, this.rattled + 1);
      this.myHitSeq = me.hitSeq;
    }
    if (frame % 90 === 0 && this.rattled > 0) this.rattled--;
    // My attack just finished: did it land, get blocked, or miss?
    if (this.watched && me.move !== this.watched) {
      const w = this.watched;
      this.watched = null;
      const strike = w.data.kind !== 'grab' && w.data.kind !== 'clinch' && !me.grapple;
      const landed = w.connected && foe.hitSeq !== this.foeHitSeq && !foe.lastHit?.blocked;
      const blocked = w.connected && !landed;
      this.blockedStreak = blocked ? this.blockedStreak + 1 : 0;
      // Hit and move: trained fighters step out after an exchange unless they've hurt you; brawlers stay in your face.
      const press = landed && (foe.isReeling || this.rng.chance(aggression));
      if (strike && !press && this.rng.chance(0.25 + this.skill * 0.6 - aggression * 0.25)) this.outUntil = frame + 14 + Math.floor(this.rng.next() * 22);
      // Missed completely: get out before the receipt arrives.
      if (strike && !w.connected && this.rng.chance(0.3 + this.skill * 0.5)) this.outUntil = frame + 18;
    }
    if (me.state === 'attack' && me.move && me.move !== this.watched) {
      this.watched = me.move;
      this.foeHitSeq = foe.hitSeq;
    }

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
        // Seen it coming and it's slow: just step back out of range and make it miss.
        const slow = fm.startup - fm.frame >= 8;
        if (!grab && slow && dist > fm.data.reach - 0.15 && this.rng.chance(this.skill * 0.35)) {
          this.outUntil = frame + (fm.startup - fm.frame) + fm.active + 2;
          cmd.moveX = -toward;
          this.mode = 'defend';
          return cmd;
        }
        if (!grab || me.style.defence === 'sprawl') {
          if (r < a.parryChance + a.dodgeChance + a.blockChance + this.rattled * 0.12) {
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
      // Prowl: drift up and down their lane and shuffle in and out while they wait their turn.
      const lane = ((me.id % 3) - 1) * 0.9 + 0.35 * Math.sin(frame * 0.021 + this.bob);
      if (Math.abs(me.pos.z - lane) > 0.2) cmd.moveZ = Math.sign(lane - me.pos.z) * 0.5;
      if (cmd.moveX === 0 && Math.sin(frame * 0.05 + this.bob * 2) > 0.92) cmd.moveX = toward * 0.4;
      return cmd;
    }

    // ---- spacing ------------------------------------------------------------------------------
    if (Math.abs(dz) > 0.22) cmd.moveZ = Math.sign(dz);
    // Stepping out after an exchange (or away from a swing): back to just outside their reach, hands up.
    if (frame <= this.outUntil) {
      this.mode = 'space';
      if (dist < a.range + 0.75) cmd.moveX = -toward;
      else if (this.skill > 0.4) cmd.block = foe.state === 'attack';
      return cmd;
    }
    // Whiff punish: they've swung and missed and are still recovering. Trained fighters make them pay.
    const fmNow = foe.state === 'attack' ? foe.move : null;
    const punish = !!fmNow && !fmNow.connected && fmNow.frame >= fmNow.startup + fmNow.active && dist < a.range + 0.45 && Math.abs(dz) < 0.35;
    if (punish && frame >= this.nextAttackAt - 40 && this.rng.chance(0.06 + this.skill * 0.3)) this.nextAttackAt = frame;
    // Hurt and not the brave sort: keep a bit more distance.
    const wary = !a.boss && me.vitals.health < me.vitals.maxHealth * 0.3 && aggression < 0.55 ? 0.25 : 0;
    const range = a.range + wary;
    if (dist > range + 0.3) {
      this.mode = 'approach';
      cmd.moveX = toward;
      // Untrained and keyed up: sometimes swings before they're close enough.
      const wild = this.skill < 0.3 && dist < range + 0.75 && frame >= this.nextAttackAt && Math.abs(dz) < 0.35 && this.rng.chance(0.02);
      if (!wild) return cmd;
    }
    if (dist < range - 0.35) {
      this.mode = 'space';
      cmd.moveX = -toward * 0.6;
    } else {
      this.mode = 'engage';
      // In range and waiting for the moment: small steps in and out, never flat-footed.
      if (this.skill > 0.25 && a.grabChance < 0.2) cmd.moveX = toward * 0.3 * Math.sin(frame * 0.09 + this.bob);
    }

    // ---- attack -------------------------------------------------------------------------------
    if (frame < this.nextAttackAt || Math.abs(dz) > 0.35) return cmd;
    this.nextAttackAt = frame + Math.round((55 + this.rng.next() * 75) / (aggression + 0.3));
    if (!this.rng.chance(aggression + 0.1)) {
      // Thought about it and didn't: a short hesitation, not a whole fresh wait.
      this.nextAttackAt = frame + 65 + Math.floor(this.rng.next() * 45);
      return cmd;
    }
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
    // Keep getting blocked? Change it up: grab them, or go to the legs.
    if (this.blockedStreak >= 2 && this.rng.chance(0.3 + this.skill * 0.4)) {
      this.blockedStreak = 0;
      const bias = a.buttonBias;
      if (dist < 0.85 && this.rng.chance(0.5)) cmd.pressed.grab = true;
      else if (bias && bias.kick < 0) cmd.pressed[this.rng.chance(bias.heavy) ? 'hp' : 'lp'] = true;
      else cmd.pressed.lk = true;
      return cmd;
    }
    let starter = this.pickStarter();
    // Don't lead with the same thing three times running.
    const ls = this.lastStarters;
    if (!a.buttonBias && ls.length >= 2 && ls[ls.length - 1] === starter && ls[ls.length - 2] === starter) starter = this.pickStarter();
    ls.push(starter);
    if (ls.length > 3) ls.shift();
    cmd.pressed[starter] = true;
    this.plan = this.planCombo(starter, a.comboLength - 1);
    return cmd;
  }

  private pickStarter(): AttackButton {
    const r = this.rng.next();
    const tired = this.self.stats.hasTag('state.tired') || this.self.stats.hasTag('state.exhausted');
    const bias = this.archetype.buttonBias;
    if (bias) {
      // A crew member's fighting style: their own mix of kicks and punches, heavy and light.
      const kick = bias.kick > 0 && this.rng.next() < bias.kick;
      // A heavy hitter keeps loading up when tired (less often); only being spent stops them.
      const spent = this.self.stats.hasTag('state.exhausted');
      const heavy = !spent && this.rng.next() < bias.heavy * (tired ? 0.75 : 1);
      return kick ? (heavy ? 'hk' : 'lk') : heavy ? 'hp' : 'lp';
    }
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
      let options = Object.keys(current.next) as AttackButton[];
      if (!options.length) break;
      const bias = this.archetype.buttonBias;
      if (bias) {
        // Follow-ups in their style: no kicks for a boxer; heavy hitters finish heavy, quick fighters keep it light.
        if (bias.kick < 0) options = options.filter((o) => o === 'lp' || o === 'hp');
        const heavy = this.rng.next() < bias.heavy;
        const pref = options.filter((o) => (o === 'hp' || o === 'hk') === heavy);
        if (pref.length) options = pref;
        if (!options.length) break;
      }
      const b = options[Math.floor(this.rng.next() * options.length)];
      plan.push(b);
      current = style.moves[current.next[b]!];
    }
    return plan;
  }
}
