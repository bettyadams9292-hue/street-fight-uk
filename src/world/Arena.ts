import { BODY_RADIUS } from '../core/constants';

/** Walkable bounds of a fighting area. X runs left/right, Z is depth (into the screen is negative). */
export interface ArenaBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/** A solid box on the ground plane (x/z). Fighters can't walk into it. */
export interface Obstacle extends ArenaBounds {
  id?: string;
  /** Closed gates and similar can be switched off. */
  solid?: boolean;
}

/**
 * The walkable space: outer bounds, solid obstacles (bins, cars, walls,
 * closed gates) and an optional encounter lock that keeps the fight on
 * screen until a group is beaten. Every fighter is resolved against this
 * each step, so enemies respect collision exactly as the player does.
 */
export class Arena {
  obstacles: Obstacle[] = [];
  /** While set, nobody can leave this x range (encounter boundaries). */
  lock: { minX: number; maxX: number } | null = null;

  constructor(public readonly bounds: ArenaBounds, public readonly name: string, obstacles: Obstacle[] = []) {
    this.obstacles = obstacles;
  }

  clamp(pos: { x: number; z: number }, radius = BODY_RADIUS): void {
    const b = this.bounds;
    // Push out of obstacles (two passes handles corners between neighbouring boxes).
    for (let pass = 0; pass < 2; pass++) {
      for (const o of this.obstacles) {
        if (o.solid === false) continue;
        pushOut(pos, o, radius);
      }
    }
    const minX = this.lock ? Math.max(b.minX, this.lock.minX) : b.minX;
    const maxX = this.lock ? Math.min(b.maxX, this.lock.maxX) : b.maxX;
    pos.x = Math.min(maxX, Math.max(minX, pos.x));
    pos.z = Math.min(b.maxZ, Math.max(b.minZ, pos.z));
  }

  /** Is this point inside a solid obstacle (grown by radius)? */
  blocked(x: number, z: number, radius = BODY_RADIUS): boolean {
    for (const o of this.obstacles) {
      if (o.solid === false) continue;
      if (x > o.minX - radius && x < o.maxX + radius && z > o.minZ - radius && z < o.maxZ + radius) return true;
    }
    return false;
  }

  /** Does the straight line between two points pass through a solid obstacle? Used so you can't interact through walls. */
  lineBlocked(ax: number, az: number, bx: number, bz: number): boolean {
    for (const o of this.obstacles) {
      if (o.solid === false) continue;
      if (segmentHitsBox(ax, az, bx, bz, o)) return true;
    }
    return false;
  }
}

/** Resolve a circle against an axis-aligned box in the x/z plane. */
export function pushOut(pos: { x: number; z: number }, o: ArenaBounds, r: number): void {
  const cx = Math.max(o.minX, Math.min(o.maxX, pos.x));
  const cz = Math.max(o.minZ, Math.min(o.maxZ, pos.z));
  const dx = pos.x - cx;
  const dz = pos.z - cz;
  const d2 = dx * dx + dz * dz;
  if (d2 > r * r) return;
  if (d2 > 1e-8) {
    const d = Math.sqrt(d2);
    pos.x = cx + (dx / d) * r;
    pos.z = cz + (dz / d) * r;
    return;
  }
  // Centre is inside the box: leave by the shortest way.
  const left = pos.x - o.minX;
  const right = o.maxX - pos.x;
  const front = o.maxZ - pos.z;
  const back = pos.z - o.minZ;
  const m = Math.min(left, right, front, back);
  if (m === left) pos.x = o.minX - r;
  else if (m === right) pos.x = o.maxX + r;
  else if (m === front) pos.z = o.maxZ + r;
  else pos.z = o.minZ - r;
}

/** Liang–Barsky segment vs box test in x/z. */
export function segmentHitsBox(ax: number, az: number, bx: number, bz: number, o: ArenaBounds): boolean {
  let t0 = 0;
  let t1 = 1;
  const dx = bx - ax;
  const dz = bz - az;
  const clip = (p: number, q: number): boolean => {
    if (p === 0) return q >= 0;
    const t = q / p;
    if (p < 0) {
      if (t > t1) return false;
      if (t > t0) t0 = t;
    } else {
      if (t < t0) return false;
      if (t < t1) t1 = t;
    }
    return true;
  };
  return clip(-dx, ax - o.minX) && clip(dx, o.maxX - ax) && clip(-dz, az - o.minZ) && clip(dz, o.maxZ - az) && t0 <= t1;
}

/** The back-alley training ground. 24 m wide, 4 m depth band. */
export function createTrainingArena(): Arena {
  return new Arena({ minX: -11, maxX: 11, minZ: -2, maxZ: 2 }, 'Back alley training ground');
}
