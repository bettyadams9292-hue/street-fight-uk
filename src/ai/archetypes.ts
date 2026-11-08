import { randomAppearance, type CharacterAppearance } from '../character/Appearance';
import { Rng } from '../core/Rng';
import type { Attributes } from '../stats/Stats';
import type { StyleId } from '../styles/StyleData';
import type { WeaponId } from '../combat/Weapons';

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
  /** Button habits (crew fighting styles): chance a punch or kick is the heavy one, and a strike is a kick (−1: never kicks). */
  buttonBias?: { heavy: number; kick: number };
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
  /** Starts with this weapon in hand. */
  weapon?: WeaponId;
  /** Cash dropped when beaten. */
  cashDrop?: number;
  xp?: number;
  look: (rnd: () => number) => Partial<CharacterAppearance>;
}

export const ARCHETYPE_IDS = [
  'thug', 'hothead', 'bruiser', 'defender', 'tooled', 'boxer', 'kickboxer', 'grappler', 'elite', 'rival', 'boss',
  'hooded', 'runner', 'knifeman', 'brawler', 'casual', 'gang_enforcer', 'docker', 'bouncer', 'security', 'police',
] as const;
export type ArchetypeId = (typeof ARCHETYPE_IDS)[number];

const attrs = (strength: number, speed: number, endurance: number, agility: number, defence: number, technique: number): Attributes => ({
  strength, speed, endurance, agility, defence, technique,
});

export const ARCHETYPES: Record<ArchetypeId, Archetype> = {
  thug: {
    id: 'thug', name: 'Street Thug', description: 'Swings wild, gives up when it goes wrong.',
    style: 'street', attributes: attrs(6, 5, 5, 4, 4, 3), level: 1,
    aggression: 0.35, blockChance: 0.15, dodgeChance: 0.05, parryChance: 0, range: 0.95, comboLength: 2,
    grabChance: 0.06, specialChance: 0.05, retreatsWhenTired: false, reactionFrames: 22, cashDrop: 6, xp: 25,
    look: () => ({ top: 'hoodie', bottoms: 'trackies' }),
  },
  hothead: {
    id: 'hothead', name: 'Hothead', description: 'Fast and aggressive. Never stops coming.',
    style: 'street', secondaryStyle: 'kickboxing', attributes: attrs(5, 9, 6, 8, 3, 4), level: 2,
    aggression: 0.7, blockChance: 0.1, dodgeChance: 0.2, parryChance: 0.02, range: 0.9, comboLength: 3,
    grabChance: 0.03, specialChance: 0.12, retreatsWhenTired: false, reactionFrames: 14, cashDrop: 8, xp: 35,
    look: () => ({ muscle: 0.3, weight: 0.1, top: 'tracksuit', bottoms: 'trackies' }),
  },
  bruiser: {
    id: 'bruiser', name: 'Heavy Bruiser', description: 'Slow, huge, hits like a bus. Hard to put down.',
    style: 'street', attributes: attrs(12, 3, 10, 2, 9, 4), level: 3,
    aggression: 0.45, blockChance: 0.25, dodgeChance: 0, parryChance: 0, range: 0.85, comboLength: 2,
    grabChance: 0.18, specialChance: 0.2, retreatsWhenTired: false, reactionFrames: 26, cashDrop: 12, xp: 50,
    look: () => ({ muscle: 0.8, weight: 0.9, height: 1.07, top: 'vest', bottoms: 'jeans', hair: 'bald' }),
  },
  defender: {
    id: 'defender', name: 'Doorman', description: 'Keeps his guard up and punishes mistakes. Be patient.',
    style: 'kickboxing', attributes: attrs(7, 5, 9, 5, 11, 7), level: 3,
    aggression: 0.3, blockChance: 0.6, dodgeChance: 0.05, parryChance: 0.22, range: 1.0, comboLength: 2,
    grabChance: 0.05, specialChance: 0.1, retreatsWhenTired: true, reactionFrames: 10, cashDrop: 12, xp: 45,
    look: () => ({ top: 'bomber', topColour: '#1b1d22', bottoms: 'trackies', bottomsColour: '#1b1d22', hair: 'buzz', muscle: 0.7, weight: 0.6 }),
  },
  tooled: {
    id: 'tooled', name: 'Tooled-up Lad', description: 'Carries a weapon and isn’t afraid to use it. Disarm him with a knockdown.',
    style: 'street', attributes: attrs(7, 6, 6, 5, 5, 4), level: 2,
    aggression: 0.45, blockChance: 0.15, dodgeChance: 0.1, parryChance: 0, range: 1.05, comboLength: 1,
    grabChance: 0.02, specialChance: 0, retreatsWhenTired: false, reactionFrames: 16, weapon: 'bat', cashDrop: 10, xp: 35,
    look: () => ({ top: 'hoodie', topColour: '#4a4d55', bottoms: 'trackies', accessories: ['cap'] }),
  },
  boxer: {
    id: 'boxer', name: 'Skilled Boxer', description: 'Tight guard, slips punches, punishes mistakes.',
    style: 'boxing', attributes: attrs(7, 9, 8, 7, 8, 8), level: 4,
    aggression: 0.6, blockChance: 0.45, dodgeChance: 0.3, parryChance: 0.15, range: 0.85, comboLength: 4,
    grabChance: 0, specialChance: 0.15, retreatsWhenTired: true, reactionFrames: 10, cashDrop: 14, xp: 60,
    look: () => ({ top: 'vest', bottoms: 'shorts', accessories: ['wraps'] }),
  },
  kickboxer: {
    id: 'kickboxer', name: 'Kickboxer', description: 'Keeps you at the end of their legs.',
    style: 'kickboxing', attributes: attrs(7, 8, 8, 8, 6, 7), level: 4,
    aggression: 0.6, blockChance: 0.35, dodgeChance: 0.2, parryChance: 0.08, range: 1.15, comboLength: 3,
    grabChance: 0.02, specialChance: 0.15, retreatsWhenTired: true, reactionFrames: 12, cashDrop: 14, xp: 60,
    look: () => ({ top: 'none', bottoms: 'shorts', muscle: 0.7, weight: 0.2 }),
  },
  grappler: {
    id: 'grappler', name: 'Grappler', description: 'Shoots for your legs and keeps you on the floor.',
    style: 'wrestling', secondaryStyle: 'bjj', attributes: attrs(9, 6, 9, 6, 7, 7), level: 4,
    aggression: 0.55, blockChance: 0.35, dodgeChance: 0.05, parryChance: 0.03, range: 0.95, comboLength: 2,
    grabChance: 0.4, specialChance: 0.1, retreatsWhenTired: true, reactionFrames: 14, cashDrop: 14, xp: 60,
    look: () => ({ top: 'tshirt', bottoms: 'shorts', muscle: 0.75, weight: 0.5, hair: 'buzz' }),
  },
  elite: {
    id: 'elite', name: 'Enforcer', description: 'Dunc’s best. Fast, hard and clever.',
    style: 'kickboxing', secondaryStyle: 'muay_thai', attributes: attrs(10, 9, 10, 8, 9, 9), level: 6,
    aggression: 0.6, blockChance: 0.45, dodgeChance: 0.25, parryChance: 0.18, range: 1.0, comboLength: 3,
    grabChance: 0.12, specialChance: 0.2, retreatsWhenTired: true, reactionFrames: 9, cashDrop: 25, xp: 90,
    look: () => ({ top: 'tshirt', topColour: '#1b1d22', bottoms: 'trackies', bottomsColour: '#1b1d22', muscle: 0.75, accessories: ['wraps'] }),
  },
  rival: {
    id: 'rival', name: 'Rival', description: 'Muay Thai and boxing. Switches stance, reads you, counters.',
    style: 'muay_thai', secondaryStyle: 'boxing', attributes: attrs(10, 9, 10, 8, 9, 10), level: 6,
    aggression: 0.65, blockChance: 0.45, dodgeChance: 0.25, parryChance: 0.25, range: 0.95, comboLength: 4,
    grabChance: 0.15, specialChance: 0.2, retreatsWhenTired: true, reactionFrames: 8, cashDrop: 30, xp: 120,
    look: () => ({ top: 'bomber', bottoms: 'trackies', accessories: ['wraps', 'chain'] }),
  },
  // ---- Stage 5 -------------------------------------------------------------------------
  hooded: {
    id: 'hooded', name: 'Hooded Fighter', description: 'Quick hands, hood up. Hits and slips back out.',
    style: 'street', secondaryStyle: 'boxing', attributes: attrs(6, 9, 6, 9, 5, 6), level: 3,
    aggression: 0.55, blockChance: 0.2, dodgeChance: 0.35, parryChance: 0.05, range: 0.95, comboLength: 3,
    grabChance: 0.02, specialChance: 0.1, retreatsWhenTired: true, reactionFrames: 12, cashDrop: 9, xp: 40,
    look: (r) => ({ top: 'hoodie', topColour: ['#1b1d22', '#2b2e35', '#4a4d55'][Math.floor(r() * 3)], bottoms: 'joggers', bottomsColour: '#1b1d22', accessories: ['snood'], headColour: '#1b1d22', muscle: 0.35, weight: 0.15 }),
  },
  runner: {
    id: 'runner', name: 'Runner', description: 'Fast and agile. Darts in, dodges everything, never stands still.',
    style: 'kickboxing', attributes: attrs(5, 11, 6, 11, 4, 6), level: 3,
    aggression: 0.6, blockChance: 0.05, dodgeChance: 0.35, parryChance: 0.02, range: 1.1, comboLength: 2,
    grabChance: 0, specialChance: 0.15, retreatsWhenTired: true, reactionFrames: 10, cashDrop: 8, xp: 40,
    look: () => ({ top: 'tracksuit', topColour: '#2f6fa8', bottoms: 'joggers', shoes: 'runners', muscle: 0.25, weight: 0.05, height: 0.98 }),
  },
  knifeman: {
    id: 'knifeman', name: 'Blade Merchant', description: 'Carries a knife. Fast and nasty: knock it out of his hand.',
    style: 'street', attributes: attrs(6, 9, 6, 8, 4, 6), level: 3,
    aggression: 0.5, blockChance: 0.1, dodgeChance: 0.25, parryChance: 0, range: 0.8, comboLength: 1,
    grabChance: 0, specialChance: 0, retreatsWhenTired: true, reactionFrames: 12, weapon: 'knife', cashDrop: 10, xp: 45,
    look: () => ({ top: 'puffer', topColour: '#1b1d22', bottoms: 'trackies', accessories: ['beanie'], headColour: '#2b2e35' }),
  },
  brawler: {
    id: 'brawler', name: 'Pub Brawler', description: 'Big wild haymakers. Runs at you swinging.',
    style: 'street', attributes: attrs(10, 5, 8, 4, 5, 3), level: 3,
    aggression: 0.8, blockChance: 0.05, dodgeChance: 0, parryChance: 0, range: 0.85, comboLength: 3,
    grabChance: 0.15, specialChance: 0.25, retreatsWhenTired: false, reactionFrames: 18, cashDrop: 10, xp: 45,
    look: () => ({ top: 'football', topColour: '#b3121b', bottoms: 'jeans', weight: 0.8, muscle: 0.5, hair: 'buzz' }),
  },
  casual: {
    id: 'casual', name: 'Football Casual', description: 'Comes in a firm. Smartly dressed, works the angles with his mates.',
    style: 'street', secondaryStyle: 'boxing', attributes: attrs(8, 7, 8, 6, 6, 6), level: 4,
    aggression: 0.55, blockChance: 0.3, dodgeChance: 0.15, parryChance: 0.08, range: 0.9, comboLength: 3,
    grabChance: 0.08, specialChance: 0.12, retreatsWhenTired: true, reactionFrames: 12, cashDrop: 14, xp: 55,
    look: (r) => ({ top: r() < 0.5 ? 'bomber' : 'denim', topColour: r() < 0.5 ? '#1f2a44' : '#2f4a2d', bottoms: 'jeans', shoes: 'trainers', shoesColour: '#e8e6e1', accessories: ['cap'], headColour: '#e8e6e1' }),
  },
  gang_enforcer: {
    id: 'gang_enforcer', name: 'Gang Enforcer', description: 'The firm’s muscle. Heavy hitter who can grapple too.',
    style: 'muay_thai', secondaryStyle: 'wrestling', attributes: attrs(11, 8, 10, 7, 9, 8), level: 6,
    aggression: 0.6, blockChance: 0.4, dodgeChance: 0.15, parryChance: 0.15, range: 0.95, comboLength: 3,
    grabChance: 0.18, specialChance: 0.2, retreatsWhenTired: false, reactionFrames: 10, cashDrop: 28, xp: 100,
    look: () => ({ top: 'leather', topColour: '#1a1410', bottoms: 'jeans', bottomsColour: '#1b1d22', muscle: 0.85, weight: 0.5, accessories: ['chain', 'ring'], chainColour: 'gold' }),
  },
  docker: {
    id: 'docker', name: 'Dock Worker', description: 'Huge forearms from lifting all day. Grabs and throws.',
    style: 'wrestling', attributes: attrs(12, 4, 11, 3, 8, 5), level: 4,
    aggression: 0.45, blockChance: 0.25, dodgeChance: 0, parryChance: 0, range: 0.85, comboLength: 2,
    grabChance: 0.35, specialChance: 0.1, retreatsWhenTired: false, reactionFrames: 20, cashDrop: 12, xp: 55,
    look: () => ({ top: 'workwear', topColour: '#e8d000', bottoms: 'workwear', shoes: 'boots', accessories: ['beanie'], headColour: '#1f2a44', muscle: 0.85, weight: 0.75 }),
  },
  bouncer: {
    id: 'bouncer', name: 'Bouncer', description: 'Massive doorman. Blocks everything, then throws you out.',
    style: 'boxing', secondaryStyle: 'wrestling', attributes: attrs(11, 5, 11, 4, 12, 7), level: 5,
    aggression: 0.35, blockChance: 0.6, dodgeChance: 0, parryChance: 0.2, range: 0.9, comboLength: 2,
    grabChance: 0.25, specialChance: 0.1, retreatsWhenTired: false, reactionFrames: 12, cashDrop: 18, xp: 70,
    look: () => ({ top: 'coat', topColour: '#1b1d22', bottoms: 'jeans', bottomsColour: '#1b1d22', hair: 'bald', muscle: 0.9, weight: 0.7, height: 1.06, accessories: ['earring'] }),
  },
  security: {
    id: 'security', name: 'Security Guard', description: 'Shop security. Holds you until the police arrive.',
    style: 'street', secondaryStyle: 'wrestling', attributes: attrs(8, 5, 8, 5, 8, 5), level: 3,
    aggression: 0.4, blockChance: 0.4, dodgeChance: 0, parryChance: 0.05, range: 0.9, comboLength: 2,
    grabChance: 0.3, specialChance: 0, retreatsWhenTired: false, reactionFrames: 14, cashDrop: 0, xp: 30,
    look: () => ({ top: 'coat', topColour: '#1b1d22', bottoms: 'workwear', bottomsColour: '#1b1d22', accessories: ['watch'] }),
  },
  police: {
    id: 'police', name: 'Police Officer', description: 'Wants to arrest you. Grabs, holds and doesn’t give up.',
    style: 'wrestling', secondaryStyle: 'boxing', attributes: attrs(9, 7, 10, 6, 9, 7), level: 5,
    aggression: 0.55, blockChance: 0.45, dodgeChance: 0.05, parryChance: 0.1, range: 0.9, comboLength: 2,
    grabChance: 0.4, specialChance: 0, retreatsWhenTired: false, reactionFrames: 12, cashDrop: 0, xp: 20,
    look: () => ({ top: 'workwear', topColour: '#1b1d22', bottoms: 'workwear', bottomsColour: '#1b1d22', shoes: 'boots', shoesColour: '#101012', accessories: ['cap'], headColour: '#101418' }),
  },
  boss: {
    id: 'boss', name: 'Big Dunc', description: 'Runs the fight club. Goes berserk when hurt.',
    style: 'muay_thai', secondaryStyle: 'wrestling', attributes: attrs(14, 7, 14, 6, 12, 10), level: 8,
    aggression: 0.6, blockChance: 0.4, dodgeChance: 0.1, parryChance: 0.2, range: 0.9, comboLength: 3,
    grabChance: 0.25, specialChance: 0.25, retreatsWhenTired: false, reactionFrames: 9, cashDrop: 60, xp: 250, boss: true,
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
