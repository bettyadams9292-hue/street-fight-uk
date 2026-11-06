/** Walkable bounds of a fighting area. X runs left/right, Z is depth (into the screen is negative). */
export interface ArenaBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export class Arena {
  constructor(public readonly bounds: ArenaBounds, public readonly name: string) {}

  clamp(pos: { x: number; z: number }): void {
    const b = this.bounds;
    pos.x = Math.min(b.maxX, Math.max(b.minX, pos.x));
    pos.z = Math.min(b.maxZ, Math.max(b.minZ, pos.z));
  }
}

/** The Stage 1 test arena: a back alley behind a high street. 24 m wide, 4 m depth band. */
export function createTrainingArena(): Arena {
  return new Arena({ minX: -11, maxX: 11, minZ: -2, maxZ: 2 }, 'Back alley training ground');
}
