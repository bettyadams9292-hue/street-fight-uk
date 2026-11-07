import type { Modifier } from '../stats/Stats';
import type { StyleId } from '../styles/StyleData';

/**
 * Everything you can buy, learn or find: gym upgrades, moves, styles, gear
 * and cosmetics. Prices and requirements are tuning data.
 */

export const UPGRADE_IDS = ['health', 'stamina', 'power', 'speed', 'toughness', 'technique'] as const;
export type UpgradeId = (typeof UPGRADE_IDS)[number];

export interface UpgradeDef {
  id: UpgradeId;
  name: string;
  /** What one rank gives. */
  per: string;
  maxRank: number;
  /** Cost in banked cash for the next rank (rank is the current rank). */
  cost: (rank: number) => number;
  modifiers: (rank: number) => Modifier[];
}

export const UPGRADES: Record<UpgradeId, UpgradeDef> = {
  health: { id: 'health', name: 'Conditioning', per: '+15 max health', maxRank: 5, cost: (r) => 60 + 40 * r, modifiers: (r) => [{ id: 'up_health', source: 'upgrade', flat: 'maxHealth', add: 15 * r }] },
  stamina: { id: 'stamina', name: 'Roadwork', per: '+15 max stamina', maxRank: 5, cost: (r) => 60 + 40 * r, modifiers: (r) => [{ id: 'up_stamina', source: 'upgrade', flat: 'maxStamina', add: 15 * r }] },
  power: { id: 'power', name: 'Heavy bag', per: '+1 Strength', maxRank: 5, cost: (r) => 80 + 50 * r, modifiers: (r) => [{ id: 'up_power', source: 'upgrade', attribute: 'strength', add: r }] },
  speed: { id: 'speed', name: 'Skipping', per: '+1 Speed', maxRank: 5, cost: (r) => 80 + 50 * r, modifiers: (r) => [{ id: 'up_speed', source: 'upgrade', attribute: 'speed', add: r }] },
  toughness: { id: 'toughness', name: 'Sparring', per: '+1 Defence', maxRank: 5, cost: (r) => 80 + 50 * r, modifiers: (r) => [{ id: 'up_toughness', source: 'upgrade', attribute: 'defence', add: r }] },
  technique: { id: 'technique', name: 'Pad work', per: '+1 Technique', maxRank: 5, cost: (r) => 80 + 50 * r, modifiers: (r) => [{ id: 'up_technique', source: 'upgrade', attribute: 'technique', add: r }] },
};

export const MOVE_UNLOCK_IDS = ['specials', 'finishers', 'counter_mastery', 'iron_chin'] as const;
export type MoveUnlockId = (typeof MOVE_UNLOCK_IDS)[number];

export interface MoveUnlockDef {
  id: MoveUnlockId;
  name: string;
  text: string;
  cost: number;
  /** Progress flag needed before it can be bought. */
  requires?: string;
  requiresText?: string;
}

export const MOVE_UNLOCKS: Record<MoveUnlockId, MoveUnlockDef> = {
  specials: { id: 'specials', name: 'Special moves', text: 'Hold Special and attack for each style’s two specials.', cost: 80 },
  finishers: { id: 'finishers', name: 'Finishers', text: 'Special + heavy punch ends a beaten, reeling opponent.', cost: 150, requires: 'boss_gaffer', requiresText: 'Beat the Gaffer' },
  counter_mastery: { id: 'counter_mastery', name: 'Counter mastery', text: '+3 frames to parry in.', cost: 220, requires: 'boss_sully', requiresText: 'Beat Sully Kane' },
  iron_chin: { id: 'iron_chin', name: 'Iron chin', text: '+30 poise: much harder to stagger.', cost: 260, requires: 'boss_ratcatcher', requiresText: 'Beat the Ratcatcher' },
};

export interface StyleLesson {
  style: StyleId;
  cost: number;
  requires?: string;
  requiresText?: string;
  teacher: string;
}

/** Styles taught at the gym, opening up as the story goes on. */
export const STYLE_LESSONS: StyleLesson[] = [
  { style: 'boxing', cost: 100, teacher: 'Coach Del' },
  { style: 'kickboxing', cost: 150, requires: 'boss_gaffer', requiresText: 'Beat the Gaffer', teacher: 'Coach Del' },
  { style: 'muay_thai', cost: 200, requires: 'boss_gaffer', requiresText: 'Beat the Gaffer', teacher: 'Nok, a friend of Del’s' },
  { style: 'karate', cost: 200, requires: 'boss_sully', requiresText: 'Beat Sully Kane', teacher: 'Mrs Okafor from the leisure centre' },
  { style: 'wrestling', cost: 250, requires: 'boss_sully', requiresText: 'Beat Sully Kane', teacher: 'Big Kev from the club' },
  { style: 'bjj', cost: 300, requires: 'boss_ratcatcher', requiresText: 'Beat the Ratcatcher', teacher: 'Ana, who trains in the city' },
];

export const GEAR_IDS = ['wraps', 'mouthguard', 'steel_caps', 'leather_jacket', 'lucky_chain'] as const;
export type GearId = (typeof GEAR_IDS)[number];

export interface GearDef {
  id: GearId;
  name: string;
  text: string;
  modifiers: Modifier[];
}

export const GEAR: Record<GearId, GearDef> = {
  wraps: { id: 'wraps', name: 'Hand wraps', text: '+5% damage', modifiers: [{ id: 'gear', source: 'gear', stat: 'damageMult', mul: 1.05 }] },
  mouthguard: { id: 'mouthguard', name: 'Gum shield', text: '+20 poise, +10 max health', modifiers: [{ id: 'gear', source: 'gear', flat: 'maxPoise', add: 20 }, { id: 'gear_hp', source: 'gear', flat: 'maxHealth', add: 10 }] },
  steel_caps: { id: 'steel_caps', name: 'Steel toecaps', text: '+2 Strength', modifiers: [{ id: 'gear', source: 'gear', attribute: 'strength', add: 2 }] },
  leather_jacket: { id: 'leather_jacket', name: 'Leather jacket', text: '+3 Defence, −1 Speed', modifiers: [{ id: 'gear', source: 'gear', attribute: 'defence', add: 3 }, { id: 'gear_spd', source: 'gear', attribute: 'speed', add: -1 }] },
  lucky_chain: { id: 'lucky_chain', name: 'Lucky chain', text: '+3 Technique', modifiers: [{ id: 'gear', source: 'gear', attribute: 'technique', add: 3 }] },
};

/** Appearance options that start locked and are found or earned. */
export const COSMETIC_LABELS: Record<string, string> = {
  'top:bomber': 'Bomber jacket',
  'acc:chain': 'Chain',
  'acc:cap': 'Cap',
  'acc:headguard': 'Head guard',
  'top:tracksuit': 'Tracksuit top',
};
export const LOCKED_COSMETICS = Object.keys(COSMETIC_LABELS);

/** XP needed to reach the next level: 100 x level^1.5 (design doc). */
export function xpForNextLevel(level: number): number {
  return Math.round(100 * Math.pow(level, 1.5));
}
export const LEVEL_CAP = 30;
