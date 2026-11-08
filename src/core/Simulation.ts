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
    for (const f of this.fighters) f.target = this.nearestOpponent(f);

    for (const f of this.fighters) f.update(commands.get(f.id) ?? emptyCommand(), this.frame, this.bus);

    updateGrapples(this.fighters, commands, this.frame, this.bus, this.rng, this.arena);
    this.separate();
    // Passers-by and shopkeepers aren't held inside a locked fight.
    for (const f of this.fighters) this.arena.clamp(f.pos, undefined, f.team === 'neutral');

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
        // You and your companion never shove each other about: they step round you instead.
        if (a.team === 'player' && b.team === 'player') continue;
        if (Math.abs(a.pos.z - b.pos.z) > PUSH_DEPTH) continue;
        if (Math.abs(a.pos.y - b.pos.y) > 1.0) continue;
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
