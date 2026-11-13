import { BODY_RADIUS } from '../core/constants';
import type { Arena } from '../world/Arena';
import type { ActiveMove } from '../combat/MoveData';
import type { Rng } from '../core/Rng';
import type { Fighter } from '../fighter/Fighter';
import { emptyCommand, type AttackButton, type CommandFrame } from '../input/Commands';
import type { Archetype } from './archetypes';
import type { AttackTokens } from './AttackTokens';

/** What waiting enemies shout. Kept short so a bubble reads at a glance. */
const TAUNTS = ['Come on then!', "That all you've got?", 'Go on, swing!', 'Is that it?', 'Bring it, pal.', "You're done, mate.", 'Have it!', "Look at the state of you."];
/** Shouted as they jump in on you: the warning to turn round. */
const JUMP_IN = ['Oi!', 'My turn!', 'Have some of this!', 'Oi, over here!'];
/** When you hit the floor. */
const GLOAT = ['Stay down!', 'Get up then!', "He's going nowhere."];

/** Frames between an enemy's parry tell and the hit landing: enough to see it. */
const TELL_FRAMES = 8;

export type AIMode = 'approach' | 'space' | 'engage' | 'defend' | 'recover' | 'wait' | 'grapple' | 'down';

/**
 * Enemy brain. Reads the fight like a player would (positions, what the
 * opponent is doing, its own stamina) and presses the same buttons a player
 * presses, through a CommandFrame. Archetype numbers shape its personality.
 */
export class FighterAI {
  mode: AIMode = 'approach';
  /** Lets the world show what this fighter shouts (a taunt, or the warning before a jump-in). */
  onSay?: (text: string, kind: 'taunt' | 'warn') => void;
  /** Bosses go berserk below half health. */
  enraged = false;

  private plan: AttackButton[] = [];
  private nextAttackAt = 0;
  private blockUntil = -1;
  private parryAt = -1;
  private parryPressFrame = -1;
  private foeMove: ActiveMove | null = null;
  /** The opponent's attack I just blocked, and the last opening I decided about. */
  private blockedMove: ActiveMove | null = null;
  private punishDecided: ActiveMove | null = null;
  /** Waiting: which side of the target I hold (+1 right, -1 left), and when to think about it again. */
  private side = 0;
  private sideUntil = 0;
  private feintUntil = -1;
  private nextFeintAt: number;
  /** Jumping in on a busy target: attack without waiting for a turn until this frame. */
  private jumpInUntil = -1;
  private jumpDecided: ActiveMove | null = null;
  private gloated: Fighter | null = null;
  /** Clean hits taken in a row (a combo on me), and when the last one landed. */
  private hitsInRow = 0;
  private lastHurtFrame = -999;
  private foeAttackFrame = -999;
  private chainedMove: ActiveMove | null = null;
  /** Going in to punish an opening that's a step away: press when in reach, give up at `until`. */
  private punishing: { move: ActiveMove; button: AttackButton; reach: number; until: number } | null = null;
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
    this.nextFeintAt = 90 + Math.floor(rng.next() * 240);
  }

  private say(lines: readonly string[], kind: 'taunt' | 'warn'): void {
    this.onSay?.(lines[Math.floor(this.rng.next() * lines.length)], kind);
  }

  think(frame: number): CommandFrame {
    const foe = this.self.target;
    const cmd = this.decide(frame);
    if (this.arena) this.steer(cmd);
    // An enemy's every block is a plain guard except its one deliberate parry press, so a late
    // block never turns into a perfect parry by accident. Your side (crew, and the bots that stand
    // in for a player in tests) keep the player's rule: a block pressed just in time parries.
    if (cmd.block && frame !== this.parryPressFrame && this.self.team === 'enemy') cmd.guard = true;
    // Remember when the opponent was last mid-swing, to tell a fresh attack from a combo's next hit:
    // a new swing that starts straight out of the last one is a chain.
    if (foe?.state === 'attack' && foe.move) {
      if (foe.move !== this.foeMove && this.foeAttackFrame >= frame - 2) this.chainedMove = foe.move;
      this.foeMove = foe.move;
      this.foeAttackFrame = frame;
    }
    return cmd;
  }

  /** A fresh, readable attack worth a parry: slow enough to see coming, and not the next hit of a string. */
  private parryable(fm: ActiveMove): boolean {
    const readable = fm.startup >= 10 || fm.data.kind === 'heavy' || fm.data.kind === 'special' || fm.data.kind === 'finisher';
    // Time to show the tell before it lands.
    const visible = fm.startup - fm.frame >= TELL_FRAMES;
    return readable && visible && fm !== this.chainedMove;
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
        // A get-up kick, unless they're a boxer who never kicks: they roll up instead.
        else if (r < 0.8 && close) {
          if (a.buttonBias && a.buttonBias.kick < 0) cmd.pressed.jump = true;
          else cmd.pressed.lk = true;
        }
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
      if (me.lastHit && !me.lastHit.blocked) {
        this.rattled = Math.min(3, this.rattled + 1);
        this.hitsInRow = frame - this.lastHurtFrame < 45 ? this.hitsInRow + 1 : 1;
        this.lastHurtFrame = frame;
      }
      if (me.lastHit?.blocked && foe.state === 'attack') this.blockedMove = foe.move;
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

    // ---- cover up: just came out of a beating ----------------------------------------------
    // Free again after eating a string: get the guard up before the next one lands. A brawler
    // might just swing back; a trained fighter shells up. Mashing into that guard gets blocked,
    // and blocked strings get punished.
    if (this.hitsInRow >= 2 && frame - this.lastHurtFrame < 40) {
      const covers = this.rng.chance(Math.min(0.85, 0.2 + this.skill * 0.4 + this.hitsInRow * 0.08 + this.rattled * 0.05));
      this.hitsInRow = 0;
      if (covers && dist < 2.2) {
        this.blockUntil = frame + 16 + Math.floor(this.rng.next() * 14);
        cmd.block = true;
        this.mode = 'defend';
        return cmd;
      }
    }

    // ---- defend: react to what the opponent is throwing ----------------------------------
    if (frame <= this.blockUntil) {
      cmd.block = true;
      this.mode = 'defend';
      return cmd;
    }
    if (this.parryAt >= 0) {
      if (frame >= this.parryAt) {
        cmd.block = true;
        this.parryPressFrame = frame;
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
        if (!grab && r < a.parryChance && this.parryable(fm)) {
          this.parryAt = frame + Math.max(0, fm.startup - fm.frame - 3);
          // The tell: the guard comes up with a glint, early enough to see.
          me.pendingTell = 'parry';
          this.mode = 'defend';
          return cmd;
        }
        // A good defender who can't parry this one just covers up.
        if (!grab && r < a.parryChance) {
          this.blockUntil = frame + (fm.startup - fm.frame) + fm.active + 4;
          cmd.block = true;
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

    // ---- punish: they've swung and are stuck recovering --------------------------------------
    // A missed swing or a blocked heavy leaves the attacker open. Anyone close enough can make them pay
    // (no waiting for a turn), and the more trained the fighter, the more surely they do. This is what
    // makes careful play beat mashing: whatever you throw carelessly comes back at you.
    const p = this.punishing;
    if (p) {
      if (frame > p.until || foe.state !== 'attack' || foe.move !== p.move) this.punishing = null;
      else {
        this.mode = 'engage';
        if (Math.abs(dz) > 0.2) cmd.moveZ = Math.sign(dz);
        if (dist > p.reach) {
          cmd.moveX = toward;
          return cmd;
        }
        this.punishing = null;
        cmd.pressed[p.button] = true;
        this.plan = this.planCombo(p.button, Math.max(1, a.comboLength - 1));
        this.nextAttackAt = frame + 30;
        return cmd;
      }
    }
    const open = this.opening(dist, dz);
    if (open) {
      this.punishDecided = open.move;
      const whiff = !open.move.connected;
      // Seeing the opening takes quick eyes as well as training: slow reactions miss most of them.
      const eyes = Math.max(0.15, Math.min(1, 1.5 - a.reactionFrames / 24));
      // Even the best let some go: a punish is a threat to respect, not a certainty.
      const chance = Math.min(0.7, (whiff ? 0.25 + this.skill * 0.5 : 0.3 + this.skill * 0.45) * eyes);
      if (me.vitals.stamina > 12 && this.rng.chance(chance)) {
        this.mode = 'engage';
        if (open.steps > 0) {
          // A step away: close in, then let it go.
          this.punishing = { move: open.move, button: open.button, reach: open.reach, until: frame + open.steps + 4 };
          cmd.moveX = toward;
          return cmd;
        }
        cmd.pressed[open.button] = true;
        this.plan = this.planCombo(open.button, Math.max(1, a.comboLength - 1));
        this.nextAttackAt = frame + 30;
        return cmd;
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

    // ---- they're on the floor: a word while they're down ------------------------------------
    if (foe.state === 'knockdown' && this.gloated !== foe && dist < 4 && this.rng.chance(0.02)) {
      this.gloated = foe;
      this.say(GLOAT, 'taunt');
    }
    if (foe.state !== 'knockdown' && this.gloated === foe) this.gloated = null;

    // ---- only a couple attack at once; the rest prowl ----------------------------------------
    if (frame > this.jumpInUntil && !this.tokens.request(me, foe)) {
      if (!this.tryJumpIn(frame, dist)) {
        this.prowl(cmd, frame, dist, toward);
        return cmd;
      }
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
    // Hurt and not the brave sort: keep a bit more distance.
    const wary = !a.boss && me.vitals.health < me.vitals.maxHealth * 0.3 && aggression < 0.55 ? 0.25 : 0;
    const range = a.range + wary;
    if (dist > range + 0.3) {
      this.mode = 'approach';
      cmd.moveX = toward;
      // A long way off: run in rather than stroll over.
      if (dist > 4.5 && Math.abs(dz) < 1.2) cmd.run = true;
      // Untrained and keyed up: sometimes swings before they're close enough.
      const wild = this.skill < 0.3 && dist < range + 0.75 && frame >= this.nextAttackAt && Math.abs(dz) < 0.35 && this.rng.chance(0.02);
      if (!wild) return cmd;
    }
    if (dist < range - 0.35) {
      this.mode = 'space';
      cmd.moveX = -toward * 0.6;
    } else {
      this.mode = 'engage';
      // In range and waiting for the moment: never flat-footed. Trained fighters bounce in and out
      // on quick small steps; brawlers sway and swagger, slower and wider; grapplers stalk forward.
      const t = frame * (0.055 + this.skill * 0.05) + this.bob;
      if (a.grabChance >= 0.2) cmd.moveX = toward * (0.12 + 0.18 * Math.max(0, Math.sin(t)));
      else cmd.moveX = toward * (0.2 + this.skill * 0.15) * Math.sin(t);
      // Circle a little too, so they're not stuck on a rail.
      if (Math.abs(dz) <= 0.22) cmd.moveZ = (0.18 + (1 - this.skill) * 0.12) * Math.sin(frame * 0.027 + this.bob * 1.7);
    }

    // ---- attack -------------------------------------------------------------------------------
    if (frame < this.nextAttackAt || Math.abs(dz) > 0.35) return cmd;
    this.nextAttackAt = frame + Math.round((42 + this.rng.next() * 62) / (aggression + 0.3));
    // Jumping in means it: no second thoughts.
    if (frame > this.jumpInUntil && !this.rng.chance(aggression + 0.1)) {
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

  /**
   * The target is busy laying into someone else with their back (or side) to me: shout and jump in,
   * without waiting for a turn. Rationed per target, and the shout is the warning.
   */
  private tryJumpIn(frame: number, dist: number): boolean {
    const me = this.self;
    const foe = me.target!;
    const fm = foe.state === 'attack' ? foe.move : null;
    if (!fm || fm === this.jumpDecided || dist > 3.2) return false;
    this.jumpDecided = fm;
    const busyElsewhere = foe.target !== me && (!foe.isFacing(me) || Math.abs(foe.pos.z - me.pos.z) > 0.6);
    if (!busyElsewhere || !this.rng.chance(0.3 + this.skill * 0.35)) return false;
    if (!this.tokens.jumpIn(foe, frame)) return false;
    this.jumpInUntil = frame + 80;
    // A beat between the shout and the swing, so there's time to turn round.
    this.nextAttackAt = frame + 14;
    this.say(JUMP_IN, 'warn');
    return true;
  }

  /**
   * Waiting for a turn, but never stood like a lamppost: hold a spot around the target (some go round
   * the back), drift up and down, shuffle in and out, and now and then dart in to make them flinch.
   */
  private prowl(cmd: CommandFrame, frame: number, dist: number, toward: number): void {
    const me = this.self;
    const foe = me.target!;
    this.mode = 'wait';
    const here = Math.sign(me.pos.x - foe.pos.x) || 1;
    if (!this.side || frame >= this.sideUntil) {
      // About a third of them work round to the far side, so a crowd surrounds rather than queues.
      this.side = me.id % 3 === 0 && this.rng.chance(0.7) ? -here : here;
      this.sideUntil = frame + 300 + Math.floor(this.rng.next() * 240);
    }
    const want = this.hover;
    const tx = foe.pos.x + this.side * want;
    const crossing = Math.sign(me.pos.x - foe.pos.x) !== this.side && dist < want + 0.4;
    // Going round: swing wide in depth instead of walking through them.
    const lane = crossing
      ? foe.pos.z + (me.pos.z >= foe.pos.z ? 1.3 : -1.3)
      : ((me.id % 3) - 1) * 0.9 + 0.45 * Math.sin(frame * 0.018 + this.bob);
    const ex = tx - me.pos.x;
    const ez = lane - me.pos.z;
    if (frame <= this.feintUntil) {
      // The dart in: quick and committed, then back to the spot.
      cmd.moveX = toward;
      return;
    }
    if (Math.abs(ex) > 0.35) cmd.moveX = Math.sign(ex) * Math.min(1, 0.45 + Math.abs(ex) * 0.4);
    else cmd.moveX = 0.32 * Math.sin(frame * 0.045 + this.bob * 2);
    if (Math.abs(ez) > 0.15) cmd.moveZ = Math.sign(ez) * Math.min(0.7, 0.3 + Math.abs(ez) * 0.5);
    if (frame >= this.nextFeintAt && !crossing && Math.abs(dist - want) < 0.8) {
      this.nextFeintAt = frame + 150 + Math.floor(this.rng.next() * 210);
      this.feintUntil = frame + 10 + Math.floor(this.rng.next() * 6);
      if (this.rng.chance(0.35)) this.say(TAUNTS, 'taunt');
    }
  }

  /**
   * Is the opponent open to a punish right now? Their swing has finished its active frames (it missed,
   * or I blocked it), they're in reach, and they'll still be recovering when my quickest starter lands.
   */
  private opening(dist: number, dz: number): { move: ActiveMove; button: AttackButton; reach: number; steps: number } | null {
    const foe = this.self.target!;
    const fm = foe.state === 'attack' ? foe.move : null;
    if (!fm || fm === this.punishDecided || fm.data.kind === 'grab' || fm.data.kind === 'clinch') return null;
    if (fm.frame < fm.startup + fm.active) return null;
    const blockedIt = fm.connected && this.blockedMove === fm;
    if (fm.connected && !blockedIt) return null;
    const quick = this.quickestStarter();
    if (!quick) return null;
    const left = fm.startup + fm.active + fm.recovery - fm.frame;
    if (Math.abs(dz) > 0.35) return null;
    // Out of reach? Walking in costs frames: only go if they'll still be stuck when it lands.
    const me = this.self;
    const speed = (2.6 * me.style.walkMult * me.stats.moveSpeedMultiplier) / 60;
    // Reach is measured from the body's edge: centre to centre, a strike lands from reach plus both bodies.
    const lands = quick.reach + BODY_RADIUS * 2 - 0.12;
    const steps = Math.max(0, Math.ceil((dist - lands) / speed));
    if (steps > 24 || left <= quick.startup + steps + 1) return null;
    return { move: fm, button: quick.button, reach: lands, steps };
  }

  /**
   * What I'd punish with: a quick strike from neutral, in my own style. A kicker uses a kick when one is
   * nearly as quick as the fastest punch; a boxer never kicks.
   */
  private quickestStarter(): { button: AttackButton; startup: number; reach: number } | null {
    const style = this.self.style;
    const bias = this.archetype.buttonBias;
    const options: { button: AttackButton; startup: number; reach: number }[] = [];
    for (const b of ['lp', 'hp', 'lk', 'hk'] as AttackButton[]) {
      const d = style.moves[style.starters[b]];
      if (!d || d.kind === 'grab' || d.kind === 'clinch' || d.damage <= 0) continue;
      if (bias && bias.kick < 0 && (b === 'lk' || b === 'hk')) continue;
      options.push({ button: b, startup: d.startup, reach: d.reach });
    }
    if (!options.length) return null;
    const fastest = Math.min(...options.map((o) => o.startup));
    const quick = options.filter((o) => o.startup <= fastest + 3);
    const kicks = quick.filter((o) => o.button === 'lk' || o.button === 'hk');
    const pool = bias && bias.kick > 0 && kicks.length && this.rng.next() < bias.kick ? kicks : quick;
    pool.sort((x, y) => x.startup - y.startup || y.reach - x.reach);
    return pool[0];
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
