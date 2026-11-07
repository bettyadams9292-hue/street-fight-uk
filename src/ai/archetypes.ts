import { randomAppearance, type CharacterAppearance } from '../character/Appearance';
import { Rng } from '../core/Rng';
import type { Attributes } from '../stats/Stats';
import type { StyleId } from '../styles/StyleData';

/**
 * Enemy archetypes. Each is a set of numbers the AI brain reads, so the same
 * code produces very different opponents. Tuning starts here.
 */
export interface Archetype {
  id: ArchetypeId;
  name: string;
  description: string;
  style: StyleId;
  secondaryStyle?: StyleId;
  attributes: Attributes;
  level: number;
  /** 0..1: how readily it attacks. */
  aggression: number;
  /** Chances to defend against an incoming attack it can see. */
  blockChance: number;
  dodgeChance: number;
  parryChance: number;
  /** Preferred distance to the target (m). */
  range: number;
  /** Max hits it tries to chain. */
  comboLength: number;
  grabChance: number;
  specialChance: number;
  /** Backs off to recover when tired. */
  retreatsWhenTired: boolean;
  /** Frames between decisions: lower = sharper reactions. */
  reactionFrames: number;
  boss?: boolean;
  look: (rnd: () => number) => Partial<CharacterAppearance>;
}

export const ARCHETYPE_IDS = ['thug', 'hothead', 'bruiser', 'boxer', 'kickboxer', 'grappler', 'rival', 'boss'] as const;
export type ArchetypeId = (typeof ARCHETYPE_IDS)[number];

const attrs = (strength: number, speed: number, endurance: number, agility: number, defence: number, technique: number): Attributes => ({
  strength, speed, endurance, agility, defence, technique,
});

export const ARCHETYPES: Record<ArchetypeId, Archetype> = {
  thug: {
    id: 'thug', name: 'Street Thug', description: 'Swings wild, gives up when it goes wrong.',
    style: 'street', attributes: attrs(6, 5, 5, 4, 4, 3), level: 1,
    aggression: 0.5, blockChance: 0.2, dodgeChance: 0.05, parryChance: 0, range: 0.95, comboLength: 2,
    grabChance: 0.06, specialChance: 0.05, retreatsWhenTired: false, reactionFrames: 22,
    look: () => ({ top: 'hoodie', bottoms: 'trackies' }),
  },
  hothead: {
    id: 'hothead', name: 'Hothead', description: 'Fast and aggressive. Never stops coming.',
    style: 'street', secondaryStyle: 'kickboxing', attributes: attrs(5, 9, 6, 8, 3, 4), level: 2,
    aggression: 0.85, blockChance: 0.1, dodgeChance: 0.2, parryChance: 0.02, range: 0.9, comboLength: 3,
    grabChance: 0.03, specialChance: 0.12, retreatsWhenTired: false, reactionFrames: 14,
    look: () => ({ muscle: 0.3, weight: 0.1, top: 'tracksuit', bottoms: 'trackies' }),
  },
  bruiser: {
    id: 'bruiser', name: 'Heavy Bruiser', description: 'Slow, huge, hits like a bus. Hard to put down.',
    style: 'street', attributes: attrs(12, 3, 10, 2, 9, 4), level: 3,
    aggression: 0.45, blockChance: 0.25, dodgeChance: 0, parryChance: 0, range: 0.85, comboLength: 2,
    grabChance: 0.18, specialChance: 0.2, retreatsWhenTired: false, reactionFrames: 26,
    look: () => ({ muscle: 0.8, weight: 0.9, height: 1.07, top: 'vest', bottoms: 'jeans', hair: 'bald' }),
  },
  boxer: {
    id: 'boxer', name: 'Skilled Boxer', description: 'Tight guard, slips punches, punishes mistakes.',
    style: 'boxing', attributes: attrs(7, 9, 8, 7, 8, 8), level: 4,
    aggression: 0.6, blockChance: 0.45, dodgeChance: 0.3, parryChance: 0.15, range: 0.85, comboLength: 4,
    grabChance: 0, specialChance: 0.15, retreatsWhenTired: true, reactionFrames: 10,
    look: () => ({ top: 'vest', bottoms: 'shorts', accessories: ['wraps'] }),
  },
  kickboxer: {
    id: 'kickboxer', name: 'Kickboxer', description: 'Keeps you at the end of their legs.',
    style: 'kickboxing', attributes: attrs(7, 8, 8, 8, 6, 7), level: 4,
    aggression: 0.6, blockChance: 0.35, dodgeChance: 0.2, parryChance: 0.08, range: 1.15, comboLength: 3,
    grabChance: 0.02, specialChance: 0.15, retreatsWhenTired: true, reactionFrames: 12,
    look: () => ({ top: 'none', bottoms: 'shorts', muscle: 0.7, weight: 0.2 }),
  },
  grappler: {
    id: 'grappler', name: 'Grappler', description: 'Shoots for your legs and keeps you on the floor.',
    style: 'wrestling', secondaryStyle: 'bjj', attributes: attrs(9, 6, 9, 6, 7, 7), level: 4,
    aggression: 0.55, blockChance: 0.35, dodgeChance: 0.05, parryChance: 0.03, range: 0.95, comboLength: 2,
    grabChance: 0.4, specialChance: 0.1, retreatsWhenTired: true, reactionFrames: 14,
    look: () => ({ top: 'tshirt', bottoms: 'shorts', muscle: 0.75, weight: 0.5, hair: 'buzz' }),
  },
  rival: {
    id: 'rival', name: 'Rival', description: 'Muay Thai and boxing. Switches stance, reads you, counters.',
    style: 'muay_thai', secondaryStyle: 'boxing', attributes: attrs(10, 9, 10, 8, 9, 10), level: 6,
    aggression: 0.65, blockChance: 0.45, dodgeChance: 0.25, parryChance: 0.25, range: 0.95, comboLength: 4,
    grabChance: 0.15, specialChance: 0.2, retreatsWhenTired: true, reactionFrames: 8,
    look: () => ({ top: 'bomber', bottoms: 'trackies', accessories: ['wraps', 'chain'] }),
  },
  boss: {
    id: 'boss', name: 'Big Dunc', description: 'Runs the fight club. Goes berserk when hurt.',
    style: 'muay_thai', secondaryStyle: 'wrestling', attributes: attrs(14, 7, 14, 6, 12, 10), level: 8,
    aggression: 0.6, blockChance: 0.4, dodgeChance: 0.1, parryChance: 0.2, range: 0.9, comboLength: 3,
    grabChance: 0.25, specialChance: 0.25, retreatsWhenTired: false, reactionFrames: 9, boss: true,
    look: () => ({ muscle: 0.9, weight: 0.75, height: 1.07, top: 'none', bottoms: 'jeans', hair: 'bald', facialHair: 'full_beard', accessories: ['wraps', 'chain'], tattoos: { leftUpperArm: 'sleeve', rightUpperArm: 'sleeve', leftForearm: 'tribal', rightForearm: 'tribal', chest: 'crown', neck: 'none' } }),
  },
};

/** A random look that fits the archetype. Same seed = same face. */
export function archetypeAppearance(a: Archetype, seed: number): CharacterAppearance {
  const rng = new Rng(seed);
  const rnd = () => rng.next();
  const base = randomAppearance(rnd, 'male');
  const extra = a.look(rnd);
  return { ...base, ...extra, accessories: extra.accessories ?? base.accessories.filter((x) => x !== 'cap') };
}
