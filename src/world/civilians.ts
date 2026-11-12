import { emptyCommand, type CommandFrame } from '../input/Commands';
import type { Fighter } from '../fighter/Fighter';
import type { Arena } from './Arena';
import type { Rng } from '../core/Rng';
import type { AreaId } from '../progress/Progress';

/**
 * Ambient pedestrians. Neutral fighters (they can't be hit and nobody
 * targets them) that walk the pavements, browse shop windows, chat in pairs,
 * hang about outside pubs and sit on benches. Only a handful exist at once,
 * spawned just off-screen around the player and removed once well behind,
 * so the street feels busy without the cost of a crowd.
 */

export type CivilianActivity = 'walk' | 'browse' | 'chat' | 'group' | 'sit' | 'flee' | 'watch' | 'wait';

/** How someone takes trouble: runs from it, stops to watch it, or just gives it a wide berth. */
export type Temper = 'nervy' | 'nosy' | 'steady';

/** How busy each street is (max pedestrians alive near you). Not listed = nobody about. */
export const CIVILIAN_DENSITY: Partial<Record<AreaId, number>> = {
  estate: 5, high_street: 9, city: 9, residential: 6, leisure: 6, stadium: 6, market: 7, mall: 8, precinct: 7, nightlife: 8,
  ind_estate: 4, docks: 2, car_park: 2, underground: 5, alleys: 2, industrial: 3,
};

/** Spawn and despawn distances from the player (m). The camera shows about ±9 m. */
export const SPAWN_MIN = 11;
export const SPAWN_MAX = 17;
export const DESPAWN = 22;

/** A place people stop: a shop window, a pub doorway, a bench. */
export interface Hotspot {
  kind: 'browse' | 'chat' | 'group' | 'sit';
  x: number;
  z: number;
  /** For benches: which way they face. */
  facing?: 1 | -1;
  /** How many it holds. */
  slots: number;
  taken: number;
}

/**
 * One pedestrian's mind.
 *
 * Walking: keeps to a lane of their own, and deals with whoever is ahead the
 * way people do. Oncoming or standing: pick a side once (everyone keeps to
 * the same hand, so two people never mirror each other) and commit to it
 * until past. Slower walker in front: overtake if there's room, otherwise
 * drop to their pace. No room at all: wait, and only turn back when patience
 * runs out.
 *
 * Trouble: each person has a temper. The nervy run, the nosy back off and
 * watch, the steady turn away from it and carry on.
 */
export class CivilianBrain {
  activity: CivilianActivity;
  /** Lane depth to walk along. */
  laneZ: number;
  dir: 1 | -1;
  /** Frame to move on from a stop. */
  until = 0;
  spot: Hotspot | null = null;
  /** Where to stand at the spot (offset for pairs and groups). */
  standAt: { x: number; z: number; face: 1 | -1 } | null = null;
  readonly temper: Temper;
  /** How much room they like around them (m). */
  readonly space: number;
  /** How long they'll stand blocked before giving up and turning back (frames). */
  readonly patience: number;

  /** The person being passed, and the side chosen. Kept until they're behind us. */
  private pass: { id: number; side: 1 | -1; until: number; z: number; forced?: boolean } | null = null;
  private sidestep = 0;
  private blockedFrames = 0;
  private waitUntil = 0;
  private stuck = 0;
  private lastX = 0;
  private lastZ = 0;
  private wanted = false;
  /** Where the trouble is, while there is some. */
  private danger: number | null = null;
  private reactedAt = -9999;

  constructor(
    readonly self: Fighter,
    private readonly arena: Arena,
    private readonly rng: Rng,
    lanes: number[],
    start: CivilianActivity,
    /** Everyone else on the street, so it can step round people as well as things. */
    private readonly people: () => readonly Fighter[] = () => [],
    /** The furthest out they'll walk: the kerb, on streets with a road (pedestrians stay on the pavement). */
    private readonly walkMaxZ = Infinity,
  ) {
    this.activity = start;
    this.dir = rng.next() < 0.5 ? 1 : -1;
    // Nobody walks an identical line: each has their own offset within the lane.
    const b = arena.bounds;
    const lane = lanes[Math.floor(rng.next() * lanes.length)] + (rng.next() - 0.5) * 0.3;
    this.laneZ = Math.min(Math.min(this.zMax, walkMaxZ) - 0.2, Math.max(b.minZ + 0.25, lane));
    const t = rng.next();
    this.temper = t < 0.38 ? 'nervy' : t < 0.68 ? 'nosy' : 'steady';
    this.space = 0.42 + rng.next() * 0.3;
    this.patience = Math.round(150 + rng.next() * 210);
    this.lastX = self.pos.x;
    this.lastZ = self.pos.z;
  }

  /** Go to a hotspot and stay a while. */
  claim(spot: Hotspot, index: number, frame: number): void {
    this.spot = spot;
    spot.taken++;
    this.activity = spot.kind;
    this.pass = null;
    const spread = spot.kind === 'chat' ? [-0.45, 0.45] : spot.kind === 'group' ? [-0.6, 0.05, 0.65] : [0];
    const dx = spread[index % spread.length];
    const face: 1 | -1 = spot.kind === 'chat' || spot.kind === 'group' ? (dx < 0 ? 1 : -1) : spot.facing ?? 1;
    this.standAt = { x: spot.x + dx, z: spot.z + (spot.kind === 'group' ? (index === 1 ? -0.35 : 0.1) : 0), face };
    this.until = frame + 60 * (spot.kind === 'sit' ? 30 + this.rng.next() * 40 : spot.kind === 'browse' ? 5 + this.rng.next() * 8 : 15 + this.rng.next() * 30);
  }

  release(): void {
    if (this.spot) this.spot.taken = Math.max(0, this.spot.taken - 1);
    this.spot = null;
    this.standAt = null;
    this.activity = 'walk';
  }

  /** The trouble's over: back to a normal walk. */
  calm(frame = Infinity): void {
    if (this.danger === null && this.activity !== 'flee' && this.activity !== 'watch') return;
    // People don't forget a punch-up the instant it stops.
    if (frame - this.reactedAt < 240) return;
    this.danger = null;
    if (this.self.stats.hasModifier('civ_hurry')) this.self.stats.removeModifier('civ_hurry');
    if (this.activity === 'flee' || this.activity === 'watch') this.activity = this.standAt ? this.spot?.kind ?? 'walk' : 'walk';
  }

  /** Run from something at x. */
  flee(fromX: number): void {
    this.release();
    this.activity = 'flee';
    this.danger = fromX;
    this.pass = null;
    this.dir = this.self.pos.x < fromX ? -1 : 1;
    this.hurry(1.9);
  }

  private hurry(mul: number): void {
    if (this.self.stats.hasModifier('civ_hurry')) this.self.stats.removeModifier('civ_hurry');
    this.self.stats.addModifier({ id: 'civ_hurry', source: 'civilian', stat: 'moveSpeedMult', mul });
  }

  /**
   * Something kicked off at x. What this person does about it depends on who
   * they are and how close it is; far enough away, nothing.
   */
  react(fromX: number, frame: number): void {
    const dist = Math.abs(this.self.pos.x - fromX);
    if (dist > 13) return;
    if (this.activity === 'flee') return;
    if (frame - this.reactedAt < 90 && this.danger !== null) {
      this.danger = fromX;
      return;
    }
    this.reactedAt = frame;
    // Right on top of it, nearly everyone gets out of the way first.
    const temper: Temper = dist < 2.2 && this.temper !== 'nosy' ? 'nervy' : this.temper;
    if (temper === 'nervy') {
      this.flee(fromX);
    } else if (temper === 'nosy') {
      this.release();
      this.activity = 'watch';
      this.danger = fromX;
      this.pass = null;
    } else {
      // Steady: stay sat or chatting unless it's close; a walker heading into it turns round and walks on briskly.
      this.danger = fromX;
      if (this.standAt && dist > 5) return;
      this.release();
      if ((fromX - this.self.pos.x) * this.dir > 0) this.dir = (this.dir * -1) as 1 | -1;
      this.hurry(1.25);
    }
  }

  /** Sat or chatting: the renderer reads this for the pose. */
  get pose(): 'sit' | 'talk' | 'browse' | 'watch' | null {
    // Stood watching a fight from a safe distance: filming it, pointing, cheering.
    if (this.activity === 'watch' && this.danger !== null && Math.abs(this.self.pos.x - this.danger) >= 4.6) return 'watch';
    if (!this.standAt) return null;
    const at = Math.abs(this.self.pos.x - this.standAt.x) < 0.2 && Math.abs(this.self.pos.z - this.standAt.z) < 0.2;
    if (!at) return null;
    return this.activity === 'sit' ? 'sit' : this.activity === 'browse' ? 'browse' : 'talk';
  }

  /** Front edge of where they walk: the street's own edge, or the kerb if that's nearer. */
  private get zMax(): number {
    return Math.min(this.arena.bounds.maxZ, this.walkMaxZ);
  }

  think(frame: number): CommandFrame {
    const cmd = this.decide(frame);
    // Never step off the kerb: anyone over it (pushed, or spawned there) heads back to the pavement.
    if (this.walkMaxZ < Infinity) {
      const z = this.self.pos.z;
      if (z > this.walkMaxZ - 0.05 && cmd.moveZ > 0) cmd.moveZ = 0;
      if (z > this.walkMaxZ) cmd.moveZ = -1;
    }
    return cmd;
  }

  private decide(frame: number): CommandFrame {
    const cmd = emptyCommand();
    const me = this.self;

    if (this.activity === 'watch' && this.danger !== null) {
      // Far enough to be safe, near enough to see.
      const away = me.pos.x - this.danger;
      const d = Math.abs(away);
      const out: 1 | -1 = away >= 0 ? 1 : -1;
      if (d < 4.6) {
        this.dir = out;
        cmd.moveX = out;
        this.steer(cmd, frame);
      } else {
        me.facing = (out * -1) as 1 | -1;
        const dz = this.laneZ - me.pos.z;
        if (Math.abs(dz) > 0.1) cmd.moveZ = Math.sign(dz) * 0.5;
      }
      this.track(cmd, frame);
      return cmd;
    }

    if (this.standAt) {
      const dx = this.standAt.x - me.pos.x;
      const dz = this.standAt.z - me.pos.z;
      if (Math.abs(dx) > 0.12 || Math.abs(dz) > 0.12) {
        // Someone's standing where we meant to: don't shove in, give the spot up.
        const taken = this.people().some((o) => o !== me && !o.isKO && Math.abs(o.pos.x - this.standAt!.x) < 0.3 && Math.abs(o.pos.z - this.standAt!.z) < 0.3);
        if (taken) {
          this.release();
        } else {
          cmd.moveX = Math.abs(dx) > 0.12 ? Math.sign(dx) : 0;
          cmd.moveZ = Math.abs(dz) > 0.12 ? Math.sign(dz) * 0.8 : 0;
          this.avoidScenery(cmd, frame);
          this.track(cmd, frame);
          return cmd;
        }
      } else {
        me.facing = this.danger !== null ? (this.danger > me.pos.x ? 1 : -1) : this.standAt.face;
        if (frame >= this.until) {
          this.release();
          this.dir = this.rng.next() < 0.5 ? 1 : -1;
        }
        return cmd;
      }
    }

    // Stood waiting for a gap.
    if (frame < this.waitUntil) {
      this.activity = this.activity === 'flee' ? 'flee' : 'wait';
      return cmd;
    }
    if (this.activity === 'wait') this.activity = 'walk';

    cmd.moveX = this.dir;
    this.steer(cmd, frame);
    this.track(cmd, frame);
    return cmd;
  }

  /** Deal with whoever and whatever is ahead. */
  private steer(cmd: CommandFrame, frame: number): void {
    const me = this.self;
    const dir = this.dir;
    const b = this.arena.bounds;

    // Finish a pass already begun.
    if (this.pass) {
      const o = this.people().find((p) => p.id === this.pass!.id);
      const along = o ? (o.pos.x - me.pos.x) * dir : -9;
      // Scenery in the way of the pass: drop it and deal with the scenery first.
      const walled = this.arena.blocked(me.pos.x + dir * 0.55, me.pos.z, 0.25) || this.arena.blocked(me.pos.x, this.pass.z, 0.25);
      if (!o || o.isKO || along < -0.45 || along > 3 || frame > this.pass.until || walled) this.pass = null;
      else {
        // They had no choice but to come onto our line (a wall on their other side): give it to them and take the one they left.
        if (!this.pass.forced && along > 0.4 && Math.abs(o.pos.z - this.pass.z) < 0.35) {
          const alt = o.pos.z - this.pass.side * (this.space + 0.3);
          if (alt > b.minZ + 0.15 && alt < this.zMax - 0.15 && !this.arena.blocked(me.pos.x + dir * 0.4, alt, 0.25)) {
            this.pass.side = (this.pass.side * -1) as 1 | -1;
            this.pass.z = alt;
            this.pass.forced = true;
          }
        }
        // The line to walk was fixed when we chose the side, so we never chase someone who drifts.
        const dz = this.pass.z - me.pos.z;
        if (Math.abs(dz) > 0.06) cmd.moveZ = Math.sign(dz);
        // Only ease off while our bodies would actually touch.
        if (along < 0.7 && Math.abs(o.pos.z - me.pos.z) < 0.32 && Math.abs(dz) > 0.06) cmd.moveX = dir * 0.25;
        this.avoidScenery(cmd, frame);
        return;
      }
    }

    // Nearest person in our path.
    let near: Fighter | null = null;
    let nearAlong = 2.4;
    for (const o of this.people()) {
      if (o === me || o.isKO) continue;
      const along = (o.pos.x - me.pos.x) * dir;
      if (along <= 0.05 || along >= nearAlong) continue;
      if (Math.abs(o.pos.z - me.pos.z) > this.space + 0.12) continue;
      near = o;
      nearAlong = along;
    }

    if (near) {
      const theirPace = near.vel.x * dir;
      const myPace = Math.max(0.3, Math.abs(me.vel.x));
      const sameWay = theirPace > 0.25;
      if (sameWay && theirPace >= myPace * 0.92) {
        // They're as quick as us: just don't tread on their heels.
        if (nearAlong < 0.8) cmd.moveX = dir * 0.5;
      } else {
        // Oncoming and standing people are passed on our own left; slower walkers are overtaken on the other side.
        const pref: 1 | -1 = sameWay ? ((dir * -1) as 1 | -1) : dir;
        const side = this.freeSide(near, pref);
        if (side) {
          this.pass = { id: near.id, side, forced: side !== pref, until: frame + 300, z: Math.min(this.zMax - 0.15, Math.max(b.minZ + 0.15, near.pos.z + side * (this.space + 0.3))) };
          this.blockedFrames = 0;
          cmd.moveZ = side;
          if (nearAlong < 0.9) cmd.moveX = dir * 0.3;
        } else if (sameWay) {
          // No room to overtake: fall in behind at their pace.
          cmd.moveX = nearAlong < 1.1 ? dir * Math.min(1, Math.max(0.15, theirPace / myPace) * 0.9) : dir;
        } else if (nearAlong < 1.3) {
          // No way round here. Is another part of the pavement clear? Cross to it.
          const lane = this.clearLane(near);
          if (lane !== null) {
            this.laneZ = lane;
            this.pass = { id: near.id, side: lane > near.pos.z ? 1 : -1, until: frame + 360, z: lane };
            this.blockedFrames = 0;
            cmd.moveX = 0;
            cmd.moveZ = Math.sign(lane - me.pos.z);
            this.avoidScenery(cmd, frame);
            return;
          }
          // Truly boxed in: stand and wait for a gap, and only turn back when patience runs out.
          cmd.moveX = 0;
          this.blockedFrames++;
          if (this.blockedFrames > this.patience) {
            this.blockedFrames = 0;
            this.dir = (dir * -1) as 1 | -1;
          }
        }
      }
    } else {
      this.blockedFrames = Math.max(0, this.blockedFrames - 2);
      // Nothing in the way: drift back to our own lane.
      const dz = this.laneZ - me.pos.z;
      if (!this.sidestep && Math.abs(dz) > 0.08) cmd.moveZ = Math.sign(dz) * 0.55;
    }
    this.avoidScenery(cmd, frame);
  }

  /** Which side of someone is open: the preferred one if it is, else the other, else neither (0). */
  private freeSide(o: Fighter, pref: 1 | -1): 1 | -1 | 0 {
    const me = this.self;
    const b = this.arena.bounds;
    for (const side of [pref, (pref * -1) as 1 | -1]) {
      const tz = o.pos.z + side * (this.space + 0.3);
      if (tz < b.minZ + 0.15 || tz > this.zMax - 0.15) continue;
      if (this.arena.blocked(o.pos.x, tz, 0.25) || this.arena.blocked((o.pos.x + me.pos.x) / 2, tz, 0.25)) continue;
      // Somebody else already in that gap?
      const crowded = this.people().some((q) => q !== me && q !== o && !q.isKO && Math.abs(q.pos.x - o.pos.x) < 0.9 && Math.abs(q.pos.z - tz) < 0.4);
      if (crowded) continue;
      return side;
    }
    return 0;
  }

  /** A line across the pavement that is open for the next few steps past whoever is blocking us, nearest first. */
  private clearLane(o: Fighter): number | null {
    const me = this.self;
    const b = this.arena.bounds;
    let best: number | null = null;
    for (let z = b.minZ + 0.3; z <= this.zMax - 0.25; z += 0.3) {
      if (Math.abs(z - o.pos.z) < this.space + 0.3) continue;
      let open = true;
      for (const step of [0, 0.6, 1.2, 1.8]) {
        const x = me.pos.x + this.dir * step;
        if (this.arena.blocked(x, z, 0.25)) open = false;
      }
      // The way across to it must be open too.
      for (let k = 1; open && k <= 3; k++) if (this.arena.blocked(me.pos.x, me.pos.z + ((z - me.pos.z) * k) / 3, 0.25)) open = false;
      if (open && this.people().some((q) => q !== me && !q.isKO && Math.abs(q.pos.x - (me.pos.x + this.dir * 0.8)) < 1.2 && Math.abs(q.pos.z - z) < 0.4)) open = false;
      if (open && (best === null || Math.abs(z - me.pos.z) < Math.abs(best - me.pos.z))) best = z;
    }
    return best;
  }

  /** Step round scenery; if there's no way through, wait a moment, then turn back. */
  private avoidScenery(cmd: CommandFrame, frame: number): void {
    const me = this.self;
    const sx = Math.sign(cmd.moveX);
    if (sx && this.arena.blocked(me.pos.x + sx * 0.55, me.pos.z, 0.25)) {
      if (!this.sidestep) {
        const b = this.arena.bounds;
        const up = me.pos.z - 0.7 > b.minZ && !this.arena.blocked(me.pos.x + sx * 0.55, me.pos.z - 0.7, 0.25);
        const down = me.pos.z + 0.7 < this.zMax && !this.arena.blocked(me.pos.x + sx * 0.55, me.pos.z + 0.7, 0.25);
        // Prefer the side our lane is on, so we don't wander across the street for a bin.
        const laneSide = this.laneZ < me.pos.z ? -1 : 1;
        this.sidestep = up && down ? laneSide : up ? -1 : down ? 1 : 0;
        if (!this.sidestep) {
          if (this.standAt) this.release();
          this.waitUntil = frame + 30 + Math.floor(this.rng.next() * 40);
          this.dir = (this.dir * -1) as 1 | -1;
        }
      }
      cmd.moveZ = this.sidestep;
      cmd.moveX = sx * 0.25;
    } else if (this.sidestep && !this.arena.blocked(me.pos.x + sx * 0.4, me.pos.z - this.sidestep * 0.6, 0.25)) {
      this.sidestep = 0;
    }
  }

  /**
   * Notice when we mean to move and aren't getting anywhere, and recover in
   * steps: try the other side, then wait for it to clear, then turn back.
   */
  private track(cmd: CommandFrame, frame: number): void {
    if (cmd.moveX !== 0 || cmd.moveZ !== 0) this.wanted = true;
    if (frame % 45 !== 0) return;
    const me = this.self;
    const moved = Math.hypot(me.pos.x - this.lastX, me.pos.z - this.lastZ);
    this.lastX = me.pos.x;
    this.lastZ = me.pos.z;
    const wanted = this.wanted;
    this.wanted = false;
    if (!wanted || moved > 0.12) {
      this.stuck = 0;
      return;
    }
    this.stuck++;
    if (this.stuck === 1) {
      if (this.pass) {
        // The side we chose isn't working: go round the other way.
        const b = this.arena.bounds;
        const o = this.people().find((q) => q.id === this.pass!.id);
        this.pass.side = (this.pass.side * -1) as 1 | -1;
        if (o) this.pass.z = Math.min(this.zMax - 0.15, Math.max(b.minZ + 0.15, o.pos.z + this.pass.side * (this.space + 0.3)));
      }
      this.sidestep = this.sidestep ? -this.sidestep : 0;
    } else if (this.stuck === 2) {
      this.pass = null;
      this.sidestep = 0;
      this.waitUntil = frame + 50 + Math.floor(this.rng.next() * 60);
    } else {
      this.stuck = 0;
      this.pass = null;
      this.sidestep = 0;
      if (this.standAt) this.release();
      this.dir = (this.dir * -1) as 1 | -1;
    }
  }
}
