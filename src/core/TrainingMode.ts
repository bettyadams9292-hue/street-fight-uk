import { ARCHETYPES, archetypeAppearance, type ArchetypeId } from '../ai/archetypes';
import { AttackTokens } from '../ai/AttackTokens';
import { DummyBrain } from '../ai/DummyBrain';
import { FighterAI } from '../ai/FighterAI';
import { sparringPartnerAppearance } from '../character/Appearance';
import { BACKGROUNDS, finalAttributes, type PlayerCharacter } from '../character/Character';
import { STYLES, getStyle } from '../data/styles';
import { Fighter } from '../fighter/Fighter';
import type { CommandFrame } from '../input/Commands';
import { defaultAttributes } from '../stats/Stats';
import type { StyleId } from '../styles/StyleData';
import { createTrainingArena } from '../world/Arena';
import { SIM_HZ } from './constants';
import { Simulation } from './Simulation';

export const PLAYER_ID = 1;
const RESPAWN_FRAMES = 3 * SIM_HZ;

export type TrainingOpponent = 'stand' | 'block' | 'spar' | 'group';

export const TRAINING_MODE_LABELS: Record<TrainingOpponent, string> = {
  stand: 'Stand still',
  block: 'Always block',
  spar: 'Spar',
  group: 'Group',
};

/**
 * The back-alley training ground. Your fighter, plus a sparring partner who
 * stands, blocks, fights back as any of the eight enemy types, or turns up
 * with two mates. KO'd fighters get back up after 3 seconds.
 */
export class TrainingMode {
  readonly sim: Simulation;
  readonly player: Fighter;
  readonly tokens = new AttackTokens(2);
  mode: TrainingOpponent = 'stand';
  archetype: ArchetypeId = 'thug';
  enemies: Fighter[] = [];
  private brains = new Map<Fighter, DummyBrain | FighterAI>();
  private respawnAt = new Map<Fighter, number>();
  private nextId = 2;

  constructor(opts: { touch?: boolean; character?: PlayerCharacter | null; practice?: { primary: StyleId; secondary: StyleId | null } } = {}) {
    const c = opts.character ?? null;
    this.sim = new Simulation(createTrainingArena(), Date.now() & 0xffff);
    const bg = c ? BACKGROUNDS[c.background] : null;
    const perks = bg?.id === 'rugby' ? (['cheap_grabs'] as const) : bg?.id === 'dancer' ? (['dodge_frames'] as const) : [];

    this.player = this.sim.add(
      new Fighter({
        id: PLAYER_ID,
        name: c?.name ?? 'You',
        team: 'player',
        attributes: c ? finalAttributes(c.allocated, c.background) : defaultAttributes(5),
        level: c?.level ?? 1,
        style: STYLES.street,
        x: -2,
        z: 0,
        appearance: c?.appearance,
        styleRanks: c?.styleRanks,
        perks: [...perks],
        inputBufferFrames: opts.touch ? 12 : undefined,
      }),
    );
    if (opts.practice) this.setPracticeStyles(opts.practice.primary, opts.practice.secondary);

    this.sim.bus.on('fighter:ko', ({ fighter }) => {
      this.respawnAt.set(fighter, this.sim.frame + RESPAWN_FRAMES);
      if (fighter.team === 'enemy') this.tokens.release(fighter);
    });
    this.setMode('stand');
  }

  /** The opponent the HUD shows: whoever you're facing, else the first enemy. */
  get focusEnemy(): Fighter | null {
    const t = this.player.target;
    if (t && t.team === 'enemy') return t;
    return this.enemies[0] ?? null;
  }

  /** Try any style in training. Learning styles properly comes with trainers in Stage 5. */
  setPracticeStyles(primary: StyleId, secondary: StyleId | null): void {
    this.player.primaryStyle = getStyle(primary);
    this.player.secondaryStyle = secondary && secondary !== primary ? getStyle(secondary) : null;
    this.player.usingSecondary = false;
  }

  setMode(mode: TrainingOpponent): void {
    this.mode = mode;
    this.spawnEnemies();
  }

  setArchetype(id: ArchetypeId): void {
    this.archetype = id;
    if (this.mode === 'spar') this.spawnEnemies();
  }

  private spawnEnemies(): void {
    for (const e of this.enemies) {
      this.sim.remove(e);
      this.tokens.release(e);
      this.respawnAt.delete(e);
    }
    this.enemies = [];
    this.brains.clear();
    if (this.player.grapple) this.player.grapple = null;

    if (this.mode === 'stand' || this.mode === 'block') {
      const f = this.addEnemy('Sparring Partner', 'street', null, defaultAttributes(5), 1, sparringPartnerAppearance(), 2, 0);
      const brain = new DummyBrain(f, this.sim.rng);
      brain.mode = this.mode;
      this.brains.set(f, brain);
    } else if (this.mode === 'spar') {
      this.addAI(this.archetype, 2.2, 0);
    } else {
      this.addAI('thug', 2.5, 0);
      this.addAI('thug', 4, -1.2);
      this.addAI('hothead', 3.5, 1.2);
    }
  }

  private addAI(id: ArchetypeId, x: number, z: number): Fighter {
    const a = ARCHETYPES[id];
    const f = this.addEnemy(a.name, a.style, a.secondaryStyle ?? null, { ...a.attributes }, a.level, archetypeAppearance(a, this.nextId * 7919), x, z);
    this.brains.set(f, new FighterAI(f, a, this.sim.rng, this.tokens));
    return f;
  }

  private addEnemy(name: string, style: StyleId, secondary: StyleId | null, attributes: ReturnType<typeof defaultAttributes>, level: number, appearance: ReturnType<typeof sparringPartnerAppearance>, x: number, z: number): Fighter {
    const f = new Fighter({
      id: this.nextId++,
      name,
      team: 'enemy',
      attributes,
      level,
      style: getStyle(style),
      secondaryStyle: secondary ? getStyle(secondary) : null,
      x: this.player.pos.x + x,
      z,
      appearance,
    });
    f.facing = -1;
    this.sim.add(f);
    this.enemies.push(f);
    return f;
  }

  /** The AI for an enemy, if it has the full brain (for the HUD's boss phase etc.). */
  brainOf(f: Fighter): FighterAI | null {
    const b = this.brains.get(f);
    return b instanceof FighterAI ? b : null;
  }

  step(playerCommand: CommandFrame): void {
    const commands = new Map<number, CommandFrame>();
    commands.set(PLAYER_ID, playerCommand);
    for (const [f, brain] of this.brains) commands.set(f.id, brain.think(this.sim.frame));
    this.sim.step(commands);

    for (const [f, at] of this.respawnAt) {
      if (this.sim.frame >= at) {
        this.respawnAt.delete(f);
        f.respawn();
        if (f.team === 'enemy') {
          f.pos.x = Math.max(this.sim.arena.bounds.minX + 1, Math.min(this.sim.arena.bounds.maxX - 1, this.player.pos.x + (this.player.pos.x > 0 ? -3 : 3)));
          f.stats.removeModifiersFrom('enraged');
          const brain = this.brains.get(f);
          if (brain instanceof FighterAI) brain.enraged = false;
        }
        this.sim.bus.emit('fighter:respawn', { fighter: f });
      }
    }
  }
}
