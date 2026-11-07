import { DummyBrain, type DummyMode } from '../ai/DummyBrain';
import { sparringPartnerAppearance } from '../character/Appearance';
import { finalAttributes, type PlayerCharacter } from '../character/Character';
import { STREET_MOVES, STREET_STARTERS } from '../data/moves/street';
import { Fighter } from '../fighter/Fighter';
import type { CommandFrame } from '../input/Commands';
import { defaultAttributes } from '../stats/Stats';
import { createTrainingArena } from '../world/Arena';
import { SIM_HZ } from './constants';
import { Simulation } from './Simulation';

export const PLAYER_ID = 1;
export const DUMMY_ID = 2;
const RESPAWN_FRAMES = 3 * SIM_HZ;

/**
 * Stage 1 game mode: the back-alley training ground. One player, one
 * sparring partner. KO'd fighters get back up after 3 seconds.
 */
export class TrainingMode {
  readonly sim: Simulation;
  readonly player: Fighter;
  readonly dummy: Fighter;
  readonly dummyBrain: DummyBrain;
  private respawnAt = new Map<Fighter, number>();

  constructor(opts: { touch?: boolean; character?: PlayerCharacter | null } = {}) {
    const c = opts.character ?? null;
    this.sim = new Simulation(createTrainingArena(), Date.now() & 0xffff);
    const moveSet = { moves: STREET_MOVES, starters: STREET_STARTERS };

    this.player = this.sim.add(
      new Fighter({
        id: PLAYER_ID,
        name: c?.name ?? 'You',
        team: 'player',
        attributes: c ? finalAttributes(c.allocated, c.background) : defaultAttributes(5),
        level: c?.level ?? 1,
        moveSet,
        x: -2,
        z: 0,
        appearance: c?.appearance,
        styleRanks: c?.styleRanks,
        inputBufferFrames: opts.touch ? 12 : undefined,
      }),
    );
    this.dummy = this.sim.add(
      new Fighter({
        id: DUMMY_ID,
        name: 'Sparring Partner',
        team: 'enemy',
        attributes: defaultAttributes(5),
        moveSet,
        x: 2,
        z: 0,
        appearance: sparringPartnerAppearance(),
      }),
    );
    this.dummy.facing = -1;
    this.dummyBrain = new DummyBrain(this.dummy, this.sim.rng);

    this.sim.bus.on('fighter:ko', ({ fighter }) => {
      this.respawnAt.set(fighter, this.sim.frame + RESPAWN_FRAMES);
    });
  }

  setDummyMode(mode: DummyMode): void {
    this.dummyBrain.mode = mode;
  }

  step(playerCommand: CommandFrame): void {
    const commands = new Map<number, CommandFrame>();
    commands.set(PLAYER_ID, playerCommand);
    commands.set(DUMMY_ID, this.dummyBrain.think(this.sim.frame));
    this.sim.step(commands);

    for (const [f, at] of this.respawnAt) {
      if (this.sim.frame >= at) {
        this.respawnAt.delete(f);
        f.respawn();
        this.sim.bus.emit('fighter:respawn', { fighter: f });
      }
    }
  }
}
