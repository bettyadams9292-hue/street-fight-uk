import type { CharacterAppearance } from '../character/Appearance';
import type { WeaponId } from '../combat/Weapons';
import type { Attributes } from '../stats/Stats';
import type { StyleId } from '../styles/StyleData';
import type { Archetype, ArchetypeId } from './archetypes';

export type BossId = 'gaffer' | 'sully' | 'ratcatcher' | 'dunc';

export interface BossPhase {
  /** Starts when health drops below this fraction. */
  below: number;
  name: string;
  /** Shown on the HUD when the phase starts. */
  line: string;
  aggression?: number;
  damageMult?: number;
  speedMult?: number;
  parryBonus?: number;
  grabBonus?: number;
  /** Calls in help. */
  summon?: { archetype: ArchetypeId; weapon?: WeaponId }[];
  /** Switches to the secondary style. */
  swap?: boolean;
}

export interface BossDef {
  id: BossId;
  name: string;
  title: string;
  district: string;
  intro: string;
  defeat: string;
  /** Behaviour settings, as for normal enemies. */
  brain: Omit<Archetype, 'id' | 'look' | 'name' | 'description'>;
  style: StyleId;
  secondaryStyle?: StyleId;
  attributes: Attributes;
  level: number;
  /** Extra max health on top of attributes. */
  bonusHealth: number;
  appearance: Partial<CharacterAppearance>;
  phases: BossPhase[];
  reward: { cash: number; xp: number };
  /** Flag set when beaten; unlocks the next district. */
  flag: string;
}

const attrs = (strength: number, speed: number, endurance: number, agility: number, defence: number, technique: number): Attributes => ({
  strength, speed, endurance, agility, defence, technique,
});

const baseBrain = {
  aggression: 0.5, blockChance: 0.3, dodgeChance: 0.1, parryChance: 0.1, range: 0.9, comboLength: 3,
  grabChance: 0.1, specialChance: 0.2, retreatsWhenTired: false, reactionFrames: 12,
} as const;

export const BOSSES: Record<BossId, BossDef> = {
  gaffer: {
    id: 'gaffer', name: 'Gaz Mullins', title: 'The Gaffer', district: 'High Street',
    intro: 'This is my street, son. You pay to walk it.',
    defeat: 'Alright... alright. The street’s yours.',
    brain: { ...baseBrain, style: 'street', attributes: attrs(11, 4, 10, 3, 8, 4), level: 3, aggression: 0.45, blockChance: 0.25, grabChance: 0.2, comboLength: 2, reactionFrames: 18 },
    style: 'street', attributes: attrs(11, 4, 10, 3, 8, 4), level: 3, bonusHealth: 90,
    appearance: { body: 'male', muscle: 0.7, weight: 0.85, height: 1.06, hair: 'bald', facialHair: 'short_beard', top: 'tshirt', topColour: '#e8e6e1', bottoms: 'jeans', bottomsColour: '#24324f', shoes: 'boots', accessories: ['chain'], skinTone: '#e0ac87' },
    phases: [
      { below: 0.55, name: 'Lads!', line: 'Gaz shouts for backup!', summon: [{ archetype: 'thug' }, { archetype: 'thug', weapon: 'bottle' }] },
      { below: 0.25, name: 'Seeing red', line: 'Gaz is seeing red!', aggression: 0.75, damageMult: 1.2 },
    ],
    reward: { cash: 150, xp: 400 }, flag: 'boss_gaffer',
  },
  sully: {
    id: 'sully', name: 'Sully Kane', title: 'Former Champ', district: 'Industrial Quarter',
    intro: 'Twelve rounds with the best in the country. You won’t last three.',
    defeat: 'Good hands, kid. Better than mine ever were.',
    brain: { ...baseBrain, style: 'boxing', attributes: attrs(10, 11, 11, 9, 10, 11), level: 5, aggression: 0.6, blockChance: 0.5, dodgeChance: 0.35, parryChance: 0.2, comboLength: 4, reactionFrames: 9 },
    style: 'boxing', attributes: attrs(10, 11, 11, 9, 10, 11), level: 5, bonusHealth: 120,
    appearance: { body: 'male', muscle: 0.75, weight: 0.3, height: 1.0, hair: 'crop', hairColour: '#d9d6cf', greying: 0.7, facialHair: 'stubble', top: 'vest', topColour: '#b3121b', bottoms: 'shorts', bottomsColour: '#e8e6e1', shoes: 'hitops', accessories: ['wraps'], skinTone: '#734a2e', faceScar: 'brow' },
    phases: [
      { below: 0.6, name: 'Second wind', line: 'Sully finds his rhythm.', speedMult: 1.12, aggression: 0.7 },
      { below: 0.3, name: 'Championship rounds', line: 'Sully goes for the knockout!', damageMult: 1.25, parryBonus: 0.15, aggression: 0.8 },
    ],
    reward: { cash: 250, xp: 700 }, flag: 'boss_sully',
  },
  ratcatcher: {
    id: 'ratcatcher', name: 'Vince Rourke', title: 'The Ratcatcher', district: 'City Centre',
    intro: 'Everyone ends up on the floor with me. Everyone.',
    defeat: 'Can’t... get a grip...',
    brain: { ...baseBrain, style: 'wrestling', attributes: attrs(12, 7, 12, 7, 10, 10), level: 7, aggression: 0.55, blockChance: 0.4, grabChance: 0.4, comboLength: 2, reactionFrames: 10 },
    style: 'wrestling', secondaryStyle: 'bjj', attributes: attrs(12, 7, 12, 7, 10, 10), level: 7, bonusHealth: 150,
    appearance: { body: 'male', muscle: 0.85, weight: 0.55, height: 1.03, hair: 'cornrows', hairColour: '#0e0b09', facialHair: 'goatee', top: 'tracksuit', topColour: '#2f4a2d', bottoms: 'trackies', bottomsColour: '#2f4a2d', accessories: ['wraps', 'chain'], skinTone: '#8d5a3b', tattoos: { leftUpperArm: 'none', rightUpperArm: 'none', leftForearm: 'none', rightForearm: 'none', chest: 'none', neck: 'geometric' } },
    phases: [
      { below: 0.6, name: 'Rats', line: 'The Ratcatcher calls his crew!', summon: [{ archetype: 'tooled', weapon: 'pipe' }, { archetype: 'hothead' }] },
      { below: 0.3, name: 'Ground and pound', line: 'He switches to jiu-jitsu!', swap: true, grabBonus: 0.25, aggression: 0.7 },
    ],
    reward: { cash: 350, xp: 1000 }, flag: 'boss_ratcatcher',
  },
  dunc: {
    id: 'dunc', name: 'Big Dunc', title: 'Runs The Pit', district: 'The Pit',
    intro: 'Took you long enough. Let’s see what all the fuss is about.',
    defeat: 'Nobody... nobody beats me in my own house...',
    brain: { ...baseBrain, style: 'muay_thai', attributes: attrs(15, 8, 15, 7, 13, 12), level: 9, aggression: 0.6, blockChance: 0.45, parryChance: 0.2, grabChance: 0.25, comboLength: 3, reactionFrames: 8 },
    style: 'muay_thai', secondaryStyle: 'wrestling', attributes: attrs(15, 8, 15, 7, 13, 12), level: 9, bonusHealth: 220,
    appearance: { body: 'male', muscle: 0.9, weight: 0.75, height: 1.07, top: 'none', bottoms: 'jeans', bottomsColour: '#1b1d22', hair: 'bald', facialHair: 'full_beard', hairColour: '#2a1c12', accessories: ['wraps', 'chain'], skinTone: '#c68e6b', tattoos: { leftUpperArm: 'sleeve', rightUpperArm: 'sleeve', leftForearm: 'tribal', rightForearm: 'tribal', chest: 'crown', neck: 'none' } },
    phases: [
      { below: 0.7, name: 'Warming up', line: 'Big Dunc stops playing.', aggression: 0.7, speedMult: 1.08 },
      { below: 0.45, name: 'The Pit', line: 'The crowd pours in to help Dunc!', summon: [{ archetype: 'elite' }, { archetype: 'tooled', weapon: 'bat' }], swap: true },
      { below: 0.2, name: 'Berserk', line: 'Big Dunc goes berserk!', damageMult: 1.3, speedMult: 1.12, aggression: 0.85 },
    ],
    reward: { cash: 600, xp: 1800 }, flag: 'boss_dunc',
  },
};
