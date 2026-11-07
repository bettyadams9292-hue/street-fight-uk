import type { Rng } from '../core/Rng';
import type { Fighter } from '../fighter/Fighter';
import { emptyCommand, type CommandFrame } from '../input/Commands';

export type DummyMode = 'stand' | 'block';

/**
 * The training-ground sparring partner when you just want something to hit:
 * stands still, or keeps a guard up. Escapes grabs now and then so you can
 * practise holding on. Fighting back is done by FighterAI.
 */
export class DummyBrain {
  mode: DummyMode = 'stand';

  constructor(private readonly self: Fighter, private readonly rng: Rng) {}

  think(frame: number): CommandFrame {
    const cmd = emptyCommand();
    const me = this.self;
    if (me.isKO) return cmd;
    if (me.grapple?.role === 'held') {
      if (frame >= me.grapple.escapeReadyAt && this.rng.chance(0.03)) cmd.pressed.grab = true;
      return cmd;
    }
    if (this.mode === 'block') cmd.block = true;
    return cmd;
  }
}
