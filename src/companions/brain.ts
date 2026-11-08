import { emptyCommand, type CommandFrame } from '../input/Commands';
import type { Fighter } from '../fighter/Fighter';
import type { Arena } from '../world/Arena';
import type { FighterAI } from '../ai/FighterAI';
import type { CompanionDef } from './companions';
import { FIGHT_STYLES, PERSONALITIES, type LineKind, type Personality, type FightStyle } from './personality';
import type { HomeBrain } from './home';

/**
 * A companion's mind out in the world.
 *
 * Fighting uses the same AI as everyone else, tuned by their fighting style,
 * and then shaped by it: a heavy boxer turns jabs into hooks, a kickboxer
 * kicks, a counter-fighter answers every block, a weapons specialist goes and
 * picks something up. Their personality decides who they go for (the nearest,
 * whoever's on you, the weakest), how far they'll go to join in, when they
 * back off behind you, whether they help a crew mate who's gone down, and
 * what they shout. Out of a fight they follow you (each at their own
 * distance), wait where you told them, or stay close and ready.
 *
 * At home a HomeBrain takes over (sofas, the kitchen, chatting).
 */

export type CrewOrder = 'follow' | 'wait' | 'ready';

export interface BrainHooks {
  /** Who it must never fight (the sparring partner, a challenger). */
  ignore: () => Fighter | null;
  /** Is there a fight on that it should join? */
  engaged: () => boolean;
  enemies: () => readonly Fighter[];
  /** Other crew members (not you). */
  crew: () => readonly Fighter[];
  /** A weapon lying about near (x, z), within r. */
  weaponNear: (x: number, z: number, r: number) => { x: number; z: number } | null;
  say: (kind: LineKind) => void;
  rng: () => number;
}

export class CompanionBrain {
  private lastPos = { x: 0, z: 0 };
  private stuck = 0;
  private detour = 0;
  private lastBlocked = -999;
  private counterSent = -999;
  private fighting = false;
  private retreatUntil = 0;
  private hurtSaid = false;
  readonly personality: Personality;
  readonly style: FightStyle;
  /** Set when it should come in from off-screen (after a long gap). */
  catchUp = false;
  order: CrewOrder = 'follow';
  waitAt: { x: number; z: number } | null = null;
  /** At home: the house brain does the thinking. */
  home: HomeBrain | null = null;

  constructor(
    readonly self: Fighter,
    readonly def: CompanionDef,
    private readonly leader: Fighter,
    private readonly fight: FighterAI,
    private readonly arena: Arena,
    private readonly hooks: BrainHooks,
  ) {
    this.lastPos = { x: self.pos.x, z: self.pos.z };
    this.personality = PERSONALITIES[def.personality];
    this.style = FIGHT_STYLES[def.fightStyle];
  }

  setOrder(o: CrewOrder): void {
    this.order = o;
    this.waitAt = o === 'wait' ? { x: this.self.pos.x, z: this.self.pos.z } : null;
  }

  /** It blocked or parried something: a counter-fighter hits straight back. */
  onBlocked(frame: number): void {
    this.lastBlocked = frame;
  }

  private range(): number {
    return this.personality.engageRange + (this.order === 'ready' ? 3 : 0) - (this.order === 'wait' ? 3 : 0);
  }

  /** Who it would rather fight, by personality. */
  private chooseTarget(): Fighter | null {
    const me = this.self;
    const L = this.leader;
    const ign = this.hooks.ignore();
    const r = this.range();
    const enemies = this.hooks.enemies().filter((e) => !e.isKO && e !== ign && e.team === 'enemy' && (Math.abs(e.pos.x - me.pos.x) < r || Math.abs(e.pos.x - L.pos.x) < r));
    if (!enemies.length) return null;
    // A crew mate's down or nearly: go and help them (loyal friends, veterans).
    if (this.personality.helpsCrew) {
      const mate = this.hooks.crew().find((c) => c !== me && (c.isKO || c.vitals.health < c.vitals.maxHealth * 0.3));
      if (mate) {
        const near = enemies.filter((e) => Math.abs(e.pos.x - mate.pos.x) < 3).sort((a, b) => Math.abs(a.pos.x - mate.pos.x) - Math.abs(b.pos.x - mate.pos.x))[0];
        if (near) {
          if (mate.isKO && this.hooks.rng() < 0.02) this.hooks.say('down');
          return near;
        }
      }
    }
    switch (this.personality.targeting) {
      case 'onPlayer':
        return enemies.sort((a, b) => Math.abs(a.pos.x - L.pos.x) - Math.abs(b.pos.x - L.pos.x))[0];
      case 'weakest':
        return enemies.filter((e) => Math.abs(e.pos.x - me.pos.x) < 6).sort((a, b) => a.vitals.health / a.vitals.maxHealth - b.vitals.health / b.vitals.maxHealth)[0] ?? null;
      default:
        return null; // the simulation's nearest
    }
  }

  /** The enemy it would fight now, if any. */
  foe(): Fighter | null {
    const me = this.self;
    const t = me.target;
    if (!t || t.isKO || t === this.hooks.ignore() || t.team !== 'enemy') return null;
    const r = this.range();
    const near = Math.abs(t.pos.x - me.pos.x) < r || Math.abs(t.pos.x - this.leader.pos.x) < r;
    return near && this.hooks.engaged() ? t : null;
  }

  think(frame: number): CommandFrame {
    const me = this.self;
    if (me.isKO) {
      this.fighting = false;
      return emptyCommand();
    }
    if (this.home) return this.home.think(frame);
    me.preferredTarget = this.chooseTarget();
    // Weapons specialist with nothing in hand: grab something lying about, even mid-fight, if nobody's right on them.
    if (this.style.weaponClasses && !me.weapon) {
      const w = this.hooks.weaponNear(me.pos.x, me.pos.z, 6);
      if (w && !this.hooks.enemies().some((e) => !e.isKO && Math.abs(e.pos.x - me.pos.x) < 1.6 && Math.abs(e.pos.z - me.pos.z) < 0.8)) return this.moveTo(w.x, w.z, frame, 0.15);
    }
    const foe = this.foe();
    if (foe) {
      if (!this.fighting) {
        this.fighting = true;
        this.hooks.say(this.personality.taunts && this.hooks.rng() < 0.5 ? 'taunt' : 'fight');
      }
      return this.fightCmd(frame, foe);
    }
    if (this.fighting) {
      this.fighting = false;
      this.hurtSaid = false;
      if (!this.hooks.enemies().some((e) => !e.isKO && Math.abs(e.pos.x - me.pos.x) < 12)) this.hooks.say('win');
    }
    if (this.order === 'wait' && this.waitAt) return this.moveTo(this.waitAt.x, this.waitAt.z, frame, 0.4);
    return this.followCmd(frame);
  }

  /** The fight AI's choice, shaped by their style and personality. */
  private fightCmd(frame: number, foe: Fighter): CommandFrame {
    const me = this.self;
    const rng = this.hooks.rng;
    // Hurt and careful: back off behind you for a bit, guard up.
    const frac = me.vitals.health / me.vitals.maxHealth;
    if (this.personality.retreatAt && frac < this.personality.retreatAt && Math.abs(foe.pos.x - me.pos.x) < 2.6 && frame > this.retreatUntil - 240) {
      if (!this.hurtSaid) {
        this.hurtSaid = true;
        this.hooks.say('hurt');
      }
      if (this.retreatUntil < frame) this.retreatUntil = frame + 120;
      const L = this.leader;
      const want = L.pos.x - Math.sign(foe.pos.x - L.pos.x || 1) * 1.6;
      const cmd = emptyCommand();
      cmd.moveX = Math.abs(want - me.pos.x) > 0.3 ? Math.sign(want - me.pos.x) : 0;
      cmd.block = true;
      return cmd;
    }
    const cmd = this.fight.think(frame);
    const p = cmd.pressed;
    const s = this.style;
    // Counter-fighters hit straight back after blocking or parrying.
    if (s.counters && frame - this.lastBlocked < 14 && frame - this.counterSent > 20 && me.isFree) {
      this.counterSent = frame;
      cmd.block = false;
      if (rng() < 0.5) p.lp = true;
      else p.hp = true;
    }
    // Kicks or no kicks (their starters and combos already follow their style's habits).
    if (s.kickBias < 0) {
      if (p.lk) [p.lk, p.lp] = [false, true];
      if (p.hk) [p.hk, p.hp] = [false, true];
    }
    // Taunts mid-fight.
    if (this.personality.taunts && (p.lp || p.hp) && rng() < 0.004) this.hooks.say('taunt');
    return cmd;
  }

  private moveTo(x: number, z: number, frame: number, near: number): CommandFrame {
    const cmd = emptyCommand();
    const me = this.self;
    const dx = x - me.pos.x;
    const dz = z - me.pos.z;
    if (Math.abs(dx) < near && Math.abs(dz) < near) return cmd;
    cmd.moveX = Math.abs(dx) > near ? Math.sign(dx) : 0;
    cmd.moveZ = Math.abs(dz) > near ? Math.sign(dz) * 0.8 : 0;
    return this.avoid(cmd, frame, dx);
  }

  private followCmd(frame: number): CommandFrame {
    const cmd = emptyCommand();
    const me = this.self;
    const L = this.leader;
    // Behind you and slightly deeper, each at their own distance, so they're not in your way or the camera's.
    const dist = this.order === 'ready' ? 0.95 : this.personality.followDist;
    const crew = this.hooks.crew();
    const slot = Math.max(0, crew.indexOf(me));
    const zOff = slot % 2 === 0 ? -0.45 : 0.45;
    const want = { x: L.pos.x - L.facing * (dist + slot * 0.6), z: Math.max(this.arena.bounds.minZ + 0.3, Math.min(this.arena.bounds.maxZ - 0.3, L.pos.z + zOff)) };
    const dx = want.x - me.pos.x;
    const dz = want.z - me.pos.z;
    const far = Math.abs(dx) > 0.5 || Math.abs(dz) > 0.35;
    if (!far) {
      me.facing = L.facing;
      this.stuck = 0;
      // Ready: guard up and facing the way you're going.
      if (this.order === 'ready') cmd.block = false;
      return cmd;
    }
    cmd.moveX = Math.abs(dx) > 0.5 ? Math.sign(dx) : 0;
    cmd.moveZ = Math.abs(dz) > 0.35 ? Math.sign(dz) * 0.8 : 0;
    // You're between it and where it wants to be: go round you, not through you.
    const between = cmd.moveX !== 0 && Math.sign(L.pos.x - me.pos.x) === cmd.moveX && Math.abs(L.pos.x - me.pos.x) < 1.2;
    if (between && Math.abs(L.pos.z - me.pos.z) < 0.75) {
      const side = me.pos.z <= L.pos.z ? -1 : 1;
      const z = L.pos.z + side * 0.8;
      const ok = z > this.arena.bounds.minZ + 0.25 && z < this.arena.bounds.maxZ - 0.25 && !this.arena.blocked(me.pos.x, z);
      cmd.moveZ = ok ? side : -side;
      cmd.moveX *= 0.35;
    }
    return this.avoid(cmd, frame, dx);
  }

  /** Round obstacles; if stuck for a second and a half, try the other side (or come in from off-screen). */
  private avoid(cmd: CommandFrame, frame: number, dx: number): CommandFrame {
    const me = this.self;
    const sx = Math.sign(cmd.moveX);
    if (sx && this.arena.blocked(me.pos.x + sx * 0.45, me.pos.z)) {
      if (!this.detour) {
        const up = !this.arena.blocked(me.pos.x + sx * 0.45, me.pos.z - 0.7);
        const down = !this.arena.blocked(me.pos.x + sx * 0.45, me.pos.z + 0.7);
        this.detour = up && down ? (this.leader.pos.z < me.pos.z ? -1 : 1) : up ? -1 : down ? 1 : me.pos.z > 0 ? -1 : 1;
      }
      cmd.moveZ = this.detour;
      cmd.moveX = sx * 0.3;
    } else this.detour = 0;
    if (frame % 30 === 0) {
      const moved = Math.abs(me.pos.x - this.lastPos.x) + Math.abs(me.pos.z - this.lastPos.z);
      this.stuck = moved < 0.1 ? this.stuck + 1 : 0;
      this.lastPos = { x: me.pos.x, z: me.pos.z };
      if (this.stuck >= 3) {
        this.detour = -this.detour || 1;
        this.stuck = 0;
        this.catchUp = Math.abs(dx) > 12;
      }
    }
    return cmd;
  }

  /** Follow logic only (used by the home brain when you call them over). */
  followOnly(frame: number): CommandFrame {
    return this.followCmd(frame);
  }
}
