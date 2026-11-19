import { resolveCombat } from '../combat/CombatSystem';
import { updateGrapples } from '../combat/Grapple';
import type { Fighter } from '../fighter/Fighter';
import { emptyCommand, type CommandFrame } from '../input/Commands';
import type { Arena } from '../world/Arena';
import { EventBus } from './EventBus';
import type { GameEvents } from './GameEvents';
import { Rng } from './Rng';

const PUSH_DISTANCE = 0.6;
const PUSH_DEPTH = 0.45;

/**
 * The fixed-step game world: fighters, the arena and combat. Contains no
 * rendering code, so it runs identically in the browser and in tests.
 */
export class Simulation {
  frame = 0;
  readonly fighters: Fighter[] = [];
  readonly bus = new EventBus<GameEvents>();
  readonly rng: Rng;

  constructor(public readonly arena: Arena, seed = 12345) {
    this.rng = new Rng(seed);
  }

  add(f: Fighter): Fighter {
    this.fighters.push(f);
    return f;
  }

  remove(f: Fighter): void {
    const i = this.fighters.indexOf(f);
    if (i >= 0) this.fighters.splice(i, 1);
  }

  /** Advance one 1/60 s step. Commands are keyed by fighter id. */
  step(commands: Map<number, CommandFrame>): void {
    this.frame++;
    for (const f of this.fighters) {
      const pt = f.preferredTarget;
      f.target = pt && !pt.isKO && pt.team !== f.team && pt.team !== 'neutral' && f.team !== 'neutral' && this.fighters.includes(pt) ? pt : this.nearestOpponent(f);
    }

    for (const f of this.fighters) f.update(commands.get(f.id) ?? emptyCommand(), this.frame, this.bus);

    updateGrapples(this.fighters, commands, this.frame, this.bus, this.rng, this.arena);
    this.separate();
    // Passers-by and shopkeepers aren't held inside a locked fight.
    for (const f of this.fighters) if (!f.anchored) this.arena.clamp(f.pos, undefined, f.team === 'neutral');

    resolveCombat(this.fighters, this.frame, this.bus, this.rng, this.arena);

    for (const f of this.fighters) f.updateVitals(this.frame, this.bus);
  }

  nearestOpponent(f: Fighter): Fighter | null {
    let best: Fighter | null = null;
    let bestD = Infinity;
    for (const o of this.fighters) {
      if (o === f || o.team === f.team || o.isKO || o.team === 'neutral' || f.team === 'neutral') continue;
      const d = Math.abs(o.pos.x - f.pos.x) + Math.abs(o.pos.z - f.pos.z) * 0.5;
      if (d < bestD) {
        bestD = d;
        best = o;
      }
    }
    return best;
  }

  /** Stop fighters walking through each other (only when lined up in depth). */
  private separate(): void {
    const list = this.fighters;
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        if (a.isKO || b.isKO || a.state === 'knockdown' || b.state === 'knockdown') continue;
        if (a.grapple?.partner === b) continue;
        if (a.anchored || b.anchored) continue;
        // You and your crew never shove each other about: they step round you instead. Crew mates keep apart.
        if (a.team === 'player' && b.team === 'player' && !(a.crew && b.crew)) continue;
        if (Math.abs(a.pos.y - b.pos.y) > 1.0) continue;
        // A passer-by and anyone else: round bodies, pushed apart along the line between them (so nobody walks
        // through anybody at an angle). The passer-by gives way; you and fighters are barely moved.
        if (a.team === 'neutral' || b.team === 'neutral') {
          const ex = b.pos.x - a.pos.x;
          const ez = b.pos.z - a.pos.z;
          const d = Math.hypot(ex, ez);
          const gap = PUSH_DISTANCE - d;
          if (gap <= 0) continue;
          const nx = d > 1e-4 ? ex / d : a.id < b.id ? 1 : -1;
          const nz = d > 1e-4 ? ez / d : 0;
          const wa = a.team === b.team ? 0.5 : a.team === 'neutral' ? 0.85 : 0.15;
          // Pushed apart a bit each step rather than all at once, so bumping reads as a nudge, not a teleport.
          const push = Math.min(gap, 0.12);
          a.pos.x -= nx * push * wa;
          a.pos.z -= nz * push * wa;
          b.pos.x += nx * push * (1 - wa);
          b.pos.z += nz * push * (1 - wa);
          continue;
        }
        if (Math.abs(a.pos.z - b.pos.z) > PUSH_DEPTH) continue;
        const dx = b.pos.x - a.pos.x;
        const overlap = PUSH_DISTANCE - Math.abs(dx);
        if (overlap <= 0) continue;
        const dir = dx === 0 ? (a.facing === 1 ? 1 : -1) : Math.sign(dx);
        a.pos.x -= (dir * overlap) / 2;
        b.pos.x += (dir * overlap) / 2;
      }
    }
  }
}
