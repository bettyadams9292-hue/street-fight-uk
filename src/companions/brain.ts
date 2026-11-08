import { emptyCommand, type CommandFrame } from '../input/Commands';
import type { Fighter } from '../fighter/Fighter';
import type { Arena } from '../world/Arena';
import type { FighterAI } from '../ai/FighterAI';

/**
 * A companion's mind. With an enemy close by it fights (using the same AI as
 * everyone else, tuned per companion); otherwise it follows you: a couple of
 * metres behind, a little to one side, stepping round obstacles. If it's ever
 * left far behind (off-screen) it catches up by walking in from the edge.
 */
export class CompanionBrain {
  private lastPos = { x: 0, z: 0 };
  private stuck = 0;
  private detour = 0;
  /** Set when it should come in from off-screen (after a long gap). */
  catchUp = false;

  constructor(
    readonly self: Fighter,
    private readonly leader: Fighter,
    private readonly fight: FighterAI,
    private readonly arena: Arena,
    /** Who it must never fight (the sparring partner, a challenger). */
    private readonly ignore: () => Fighter | null,
    /** Is there a fight on that it should join? */
    private readonly engaged: () => boolean,
  ) {
    this.lastPos = { x: self.pos.x, z: self.pos.z };
  }

  /** The enemy it would fight now, if any. */
  foe(): Fighter | null {
    const me = this.self;
    const t = me.target;
    if (!t || t.isKO || t === this.ignore() || t.team !== 'enemy') return null;
    // Only real fights: an enemy near you or near it.
    const near = Math.abs(t.pos.x - me.pos.x) < 8 || Math.abs(t.pos.x - this.leader.pos.x) < 8;
    return near && this.engaged() ? t : null;
  }

  think(frame: number): CommandFrame {
    const me = this.self;
    if (me.isKO) return emptyCommand();
    if (this.foe()) return this.fight.think(frame);
    return this.follow(frame);
  }

  private follow(frame: number): CommandFrame {
    const cmd = emptyCommand();
    const me = this.self;
    const L = this.leader;
    // Behind you and slightly deeper, so it's not in your way or the camera's.
    const want = { x: L.pos.x - L.facing * 1.4, z: Math.max(this.arena.bounds.minZ + 0.3, Math.min(this.arena.bounds.maxZ - 0.3, L.pos.z - 0.45)) };
    const dx = want.x - me.pos.x;
    const dz = want.z - me.pos.z;
    const far = Math.abs(dx) > 0.5 || Math.abs(dz) > 0.35;
    if (!far) {
      me.facing = L.facing;
      this.stuck = 0;
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
    // Round obstacles.
    const sx = Math.sign(cmd.moveX);
    if (sx && this.arena.blocked(me.pos.x + sx * 0.45, me.pos.z)) {
      if (!this.detour) {
        const up = !this.arena.blocked(me.pos.x + sx * 0.45, me.pos.z - 0.7);
        const down = !this.arena.blocked(me.pos.x + sx * 0.45, me.pos.z + 0.7);
        this.detour = up && down ? (L.pos.z < me.pos.z ? -1 : 1) : up ? -1 : down ? 1 : me.pos.z > 0 ? -1 : 1;
      }
      cmd.moveZ = this.detour;
      cmd.moveX = sx * 0.3;
    } else this.detour = 0;
    // Stuck for a second and a half: try the other side.
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
}
