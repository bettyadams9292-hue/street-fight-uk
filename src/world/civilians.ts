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

export type CivilianActivity = 'walk' | 'browse' | 'chat' | 'group' | 'sit' | 'flee';

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
 * One pedestrian's mind: walk the lane, stop at hotspots for a while, move
 * aside for obstacles, scatter when a fight starts.
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
  private stuckFrames = 0;
  private lastX = 0;
  private sidestep = 0;

  constructor(
    readonly self: Fighter,
    private readonly arena: Arena,
    private readonly rng: Rng,
    lanes: number[],
    start: CivilianActivity,
    /** Everyone else on the street, so it can step round people as well as things. */
    private readonly people: () => readonly Fighter[] = () => [],
  ) {
    this.activity = start;
    this.laneZ = lanes[Math.floor(rng.next() * lanes.length)];
    this.dir = rng.next() < 0.5 ? 1 : -1;
    this.lastX = self.pos.x;
  }

  /** Go to a hotspot and stay a while. */
  claim(spot: Hotspot, index: number, frame: number): void {
    this.spot = spot;
    spot.taken++;
    this.activity = spot.kind;
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

  /** The fight's over: back to a normal walk. */
  calm(): void {
    if (this.activity === 'flee') this.activity = 'walk';
  }

  flee(fromX: number): void {
    this.release();
    this.activity = 'flee';
    this.dir = this.self.pos.x < fromX ? -1 : 1;
  }

  /** Sat or chatting: the renderer reads this for the pose. */
  get pose(): 'sit' | 'talk' | 'browse' | null {
    if (!this.standAt) return null;
    const at = Math.abs(this.self.pos.x - this.standAt.x) < 0.2 && Math.abs(this.self.pos.z - this.standAt.z) < 0.2;
    if (!at) return null;
    return this.activity === 'sit' ? 'sit' : this.activity === 'browse' ? 'browse' : 'talk';
  }

  think(frame: number): CommandFrame {
    const cmd = emptyCommand();
    const me = this.self;
    if (this.standAt) {
      const dx = this.standAt.x - me.pos.x;
      const dz = this.standAt.z - me.pos.z;
      if (Math.abs(dx) > 0.12 || Math.abs(dz) > 0.12) {
        cmd.moveX = Math.abs(dx) > 0.12 ? Math.sign(dx) : 0;
        cmd.moveZ = Math.abs(dz) > 0.12 ? Math.sign(dz) * 0.8 : 0;
        this.avoid(cmd, frame);
        return cmd;
      }
      me.facing = this.standAt.face;
      if (frame >= this.until) {
        this.release();
        this.dir = this.rng.next() < 0.5 ? 1 : -1;
      }
      return cmd;
    }
    // Walking (or running away): along the lane, drifting back to it after sidesteps.
    cmd.moveX = this.dir;
    const dz = this.laneZ - me.pos.z;
    if (!this.sidestep && Math.abs(dz) > 0.08) cmd.moveZ = Math.sign(dz) * 0.6;
    // Someone in the way (another pedestrian coming the other way, you, a fighter): pass to one side.
    const ahead = this.people().find((o) => o !== me && !o.isKO && (o.pos.x - me.pos.x) * this.dir > 0 && Math.abs(o.pos.x - me.pos.x) < 1.1 && Math.abs(o.pos.z - me.pos.z) < 0.5);
    if (ahead) {
      const b = this.arena.bounds;
      let side = me.pos.z < ahead.pos.z ? -1 : me.pos.z > ahead.pos.z ? 1 : (me.id % 2 ? 1 : -1);
      const target = ahead.pos.z + side * 0.55;
      if (target < b.minZ + 0.2 || target > b.maxZ - 0.2 || this.arena.blocked(me.pos.x, target, 0.25)) side = -side;
      cmd.moveZ = side;
      cmd.moveX = this.dir * 0.4;
    }
    this.avoid(cmd, frame);
    return cmd;
  }

  /** Step round obstacles; turn back if there's no way through. */
  private avoid(cmd: CommandFrame, frame: number): void {
    const me = this.self;
    const sx = Math.sign(cmd.moveX);
    if (sx && this.arena.blocked(me.pos.x + sx * 0.55, me.pos.z, 0.25)) {
      if (!this.sidestep) {
        const up = !this.arena.blocked(me.pos.x + sx * 0.55, me.pos.z - 0.7, 0.25);
        const down = !this.arena.blocked(me.pos.x + sx * 0.55, me.pos.z + 0.7, 0.25);
        this.sidestep = up && down ? (this.rng.next() < 0.5 ? -1 : 1) : up ? -1 : down ? 1 : 0;
        if (!this.sidestep && !this.standAt) this.dir = (this.dir * -1) as 1 | -1;
      }
      cmd.moveZ = this.sidestep;
      cmd.moveX = sx * 0.25;
    } else if (this.sidestep && !this.arena.blocked(me.pos.x + sx * 0.4, me.pos.z - this.sidestep * 0.6, 0.25)) {
      this.sidestep = 0;
    }
    // Stuck (pushed into a corner by someone): try the other way.
    if (frame % 30 === 0) {
      if (Math.abs(me.pos.x - this.lastX) < 0.05 && cmd.moveX !== 0) this.stuckFrames++;
      else this.stuckFrames = 0;
      this.lastX = me.pos.x;
      if (this.stuckFrames >= 3) {
        this.stuckFrames = 0;
        if (this.standAt) this.release();
        this.dir = (this.dir * -1) as 1 | -1;
        this.sidestep = 0;
      }
    }
  }
}
