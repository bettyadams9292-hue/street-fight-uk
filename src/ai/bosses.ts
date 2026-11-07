import type { CharacterAppearance } from '../character/Appearance';
import type { WeaponId } from '../combat/Weapons';
import type { Attributes } from '../stats/Stats';
import type { StyleId } from '../styles/StyleData';
import type { Archetype, ArchetypeId } from './archetypes';

export type BossId =
  | 'gaffer' | 'sully' | 'ratcatcher' | 'dunc'
  | 'estate_king' | 'market_boss' | 'dock_bruiser' | 'industrial_enforcer' | 'precinct_enforcer' | 'nightclub_owner' | 'football_firm' | 'underground_king' | 'the_boss';

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
  /** Pulls out a weapon. */
  weapon?: WeaponId;
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
  /** Unique items handed over the first time you win. */
  drops?: string[];
  /** Starts the fight holding this. */
  weapon?: WeaponId;
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
    reward: { cash: 150, xp: 400 }, flag: 'boss_gaffer', drops: ['gaffer_ledger', 'watch_gold'],
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
    reward: { cash: 250, xp: 700 }, flag: 'boss_sully', drops: ['headguard', 'old_fiver'],
  },
  ratcatcher: {
    id: 'ratcatcher', name: 'Vince Rourke', title: 'The Ratcatcher', district: 'City Centre',
    intro: 'Everyone ends up on the floor with me. Everyone.',
    defeat: 'Can’t... get a grip...',
    brain: { ...baseBrain, style: 'wrestling', attributes: attrs(12, 7, 12, 7, 10, 10), level: 7, aggression: 0.55, blockChance: 0.4, grabChance: 0.28, comboLength: 2, reactionFrames: 10 },
    style: 'wrestling', secondaryStyle: 'bjj', attributes: attrs(12, 7, 12, 7, 10, 10), level: 7, bonusHealth: 150,
    appearance: { body: 'male', muscle: 0.85, weight: 0.55, height: 1.03, hair: 'cornrows', hairColour: '#0e0b09', facialHair: 'goatee', top: 'tracksuit', topColour: '#2f4a2d', bottoms: 'trackies', bottomsColour: '#2f4a2d', accessories: ['wraps', 'chain'], skinTone: '#8d5a3b', tattoos: { leftUpperArm: 'none', rightUpperArm: 'none', leftForearm: 'none', rightForearm: 'none', chest: 'none', neck: 'geometric' } },
    phases: [
      { below: 0.6, name: 'Rats', line: 'The Ratcatcher calls his crew!', summon: [{ archetype: 'tooled', weapon: 'pipe' }] },
      { below: 0.3, name: 'Ground and pound', line: 'He switches to jiu-jitsu!', swap: true, grabBonus: 0.12, aggression: 0.7 },
    ],
    reward: { cash: 350, xp: 1000 }, flag: 'boss_ratcatcher', drops: ['chain_rope', 'phone_flagship'],
  },
  dunc: {
    id: 'dunc', name: 'Big Dunc', title: 'Runs The Pit', district: 'The Pit',
    intro: 'Took you long enough. Let’s see what all the fuss is about.',
    defeat: 'Nobody... nobody beats me in my own house...',
    brain: { ...baseBrain, style: 'muay_thai', attributes: attrs(13, 8, 13, 7, 11, 11), level: 9, aggression: 0.6, blockChance: 0.4, parryChance: 0.15, grabChance: 0.25, comboLength: 3, reactionFrames: 8 },
    style: 'muay_thai', secondaryStyle: 'wrestling', attributes: attrs(13, 8, 13, 7, 11, 11), level: 9, bonusHealth: 120,
    appearance: { body: 'male', muscle: 0.9, weight: 0.75, height: 1.07, top: 'none', bottoms: 'jeans', bottomsColour: '#1b1d22', hair: 'bald', facialHair: 'full_beard', hairColour: '#2a1c12', accessories: ['wraps', 'chain'], skinTone: '#c68e6b', tattoos: { leftUpperArm: 'sleeve', rightUpperArm: 'sleeve', leftForearm: 'tribal', rightForearm: 'tribal', chest: 'crown', neck: 'none' } },
    phases: [
      { below: 0.7, name: 'Warming up', line: 'Big Dunc stops playing.', aggression: 0.7, speedMult: 1.08 },
      { below: 0.45, name: 'The Pit', line: 'The crowd pours in to help Dunc!', summon: [{ archetype: 'elite' }], swap: true },
      { below: 0.2, name: 'Berserk', line: 'Big Dunc goes berserk!', damageMult: 1.2, speedMult: 1.1, aggression: 0.85 },
    ],
    reward: { cash: 600, xp: 1800 }, flag: 'boss_dunc', drops: ['dunc_phone', 'chain_cuban'],
  },
  // ---- Stage 5 bosses -----------------------------------------------------------------------
  estate_king: {
    id: 'estate_king', name: 'Tyrone Fairclough', title: 'The Estate King', district: 'Hollins Estate',
    intro: 'Hollins is mine. Every door, every stairwell. Who let you in?',
    defeat: 'Alright... alright. Hollins is yours. For now.',
    brain: { ...baseBrain, style: 'street', attributes: attrs(8, 7, 8, 7, 7, 7), level: 3, aggression: 0.55, blockChance: 0.28, dodgeChance: 0.15, comboLength: 3, reactionFrames: 15 },
    style: 'street', secondaryStyle: 'boxing', attributes: attrs(8, 7, 8, 7, 7, 7), level: 3, bonusHealth: 60,
    appearance: { body: 'male', muscle: 0.6, weight: 0.3, height: 1.02, hair: 'cornrows', hairColour: '#0e0b09', facialHair: 'goatee', top: 'puffer', topColour: '#e8e6e1', bottoms: 'joggers', bottomsColour: '#1b1d22', shoes: 'trainers', shoesColour: '#e8e6e1', accessories: ['chain', 'ring', 'earring'], chainColour: 'gold', skinTone: '#5e3b24', faceScar: 'brow' },
    phases: [
      { below: 0.6, name: 'Stairwell crew', line: 'He whistles and his lads come running.', summon: [{ archetype: 'hooded' }] },
      { below: 0.25, name: 'Out comes the blade', line: 'The King pulls a machete from his coat!', weapon: 'machete', aggression: 0.7 },
    ],
    reward: { cash: 120, xp: 300 }, flag: 'boss_estate_king', drops: ['chain_gold', 'lockup_key'],
  },
  market_boss: {
    id: 'market_boss', name: 'Maureen Doyle', title: 'The Market Boss', district: 'Old Market',
    intro: 'Forty years I’ve run this market. You think you’re the first hard lad through here?',
    defeat: 'Fine. Take your stall. Take the lot.',
    brain: { ...baseBrain, style: 'karate', attributes: attrs(8, 8, 9, 8, 9, 10), level: 5, aggression: 0.5, blockChance: 0.45, parryChance: 0.22, comboLength: 3, reactionFrames: 10 },
    style: 'karate', secondaryStyle: 'street', attributes: attrs(8, 8, 9, 8, 9, 10), level: 5, bonusHealth: 120,
    appearance: { body: 'female', muscle: 0.5, weight: 0.45, height: 0.98, hair: 'bob', hairColour: '#d9d6cf', greying: 0.7, top: 'coat', topColour: '#5b2e8c', bottoms: 'jeans', shoes: 'boots', accessories: ['chain', 'ring', 'watch', 'earring'], chainColour: 'gold', skinTone: '#eac0a2' },
    phases: [
      { below: 0.65, name: 'Market traders', line: 'The traders down tools and pile in!', summon: [{ archetype: 'brawler' }, { archetype: 'tooled', weapon: 'shovel' }] },
      { below: 0.35, name: 'Iron fist', line: 'Maureen drops into a proper karate stance.', parryBonus: 0.15, damageMult: 1.15, speedMult: 1.08 },
    ],
    reward: { cash: 220, xp: 600 }, flag: 'boss_market', drops: ['stadium_key', 'pocket_watch'],
  },
  dock_bruiser: {
    id: 'dock_bruiser', name: 'Big Lenny Shaw', title: 'The Dockyard Bruiser', district: 'Canal Docks',
    intro: 'I lift containers for a living. What d’you think I’ll do to you?',
    defeat: 'Never... been put down... in my life...',
    brain: { ...baseBrain, style: 'wrestling', attributes: attrs(15, 4, 14, 3, 10, 6), level: 6, aggression: 0.5, blockChance: 0.3, grabChance: 0.3, comboLength: 2, reactionFrames: 16 },
    style: 'wrestling', secondaryStyle: 'street', attributes: attrs(15, 4, 14, 3, 10, 6), level: 6, bonusHealth: 200,
    appearance: { body: 'male', muscle: 0.95, weight: 0.95, height: 1.07, hair: 'buzz', hairColour: '#c99a5b', facialHair: 'full_beard', top: 'workwear', topColour: '#e8d000', bottoms: 'workwear', bottomsColour: '#1f2a44', shoes: 'boots', accessories: ['beanie'], headColour: '#7d1a1a', skinTone: '#e0ac87', tattoos: { leftUpperArm: 'swallow', rightUpperArm: 'rose', leftForearm: 'none', rightForearm: 'none', chest: 'none', neck: 'none' } },
    weapon: 'chain',
    phases: [
      { below: 0.7, name: 'Shift change', line: 'The night shift turns up with hooks and bars!', summon: [{ archetype: 'docker' }, { archetype: 'docker', weapon: 'metal_bar' }] },
      { below: 0.4, name: 'Hands on', line: 'Lenny drops the chain and goes for a hold!', swap: true, grabBonus: 0.2, aggression: 0.65 },
    ],
    reward: { cash: 300, xp: 800 }, flag: 'boss_docks', drops: ['camera', 'watch_diver'],
  },
  industrial_enforcer: {
    id: 'industrial_enforcer', name: 'Kasia Nowak', title: 'The Industrial Enforcer', district: 'Abandoned Factory',
    intro: 'Nobody comes into this factory without permission. Nobody leaves without paying.',
    defeat: 'You’re faster than you look.',
    brain: { ...baseBrain, style: 'muay_thai', attributes: attrs(10, 10, 10, 10, 8, 10), level: 7, aggression: 0.65, blockChance: 0.35, dodgeChance: 0.25, parryChance: 0.15, comboLength: 4, reactionFrames: 8 },
    style: 'muay_thai', secondaryStyle: 'kickboxing', attributes: attrs(10, 10, 10, 10, 8, 10), level: 7, bonusHealth: 150,
    appearance: { body: 'female', muscle: 0.75, weight: 0.2, height: 1.0, hair: 'ponytail', hairColour: '#c99a5b', top: 'vest', topColour: '#1b1d22', bottoms: 'cargos', bottomsColour: '#3a3d2a', shoes: 'boots', accessories: ['wraps'], skinTone: '#f6d7c3', tattoos: { leftUpperArm: 'geometric', rightUpperArm: 'none', leftForearm: 'none', rightForearm: 'geometric', chest: 'none', neck: 'none' } },
    phases: [
      { below: 0.6, name: 'Elbows and knees', line: 'Kasia closes the distance: clinch range!', aggression: 0.75, speedMult: 1.1 },
      { below: 0.3, name: 'Wrench', line: 'She grabs a pipe wrench off the line!', weapon: 'wrench', summon: [{ archetype: 'gang_enforcer' }] },
    ],
    reward: { cash: 380, xp: 1100 }, flag: 'boss_factory', drops: ['crypto_wallet'],
  },
  precinct_enforcer: {
    id: 'precinct_enforcer', name: 'Dean "Ledger" Pryce', title: 'The Precinct Enforcer', district: 'Kingsway Precinct',
    intro: 'Every shop in this precinct pays me. You owe me for walking in.',
    defeat: 'Take the pass. Just... take it.',
    brain: { ...baseBrain, style: 'boxing', attributes: attrs(10, 9, 9, 8, 9, 9), level: 6, aggression: 0.6, blockChance: 0.45, dodgeChance: 0.2, parryChance: 0.15, comboLength: 4, reactionFrames: 11 },
    style: 'boxing', secondaryStyle: 'street', attributes: attrs(10, 9, 9, 8, 9, 9), level: 6, bonusHealth: 115,
    appearance: { body: 'male', muscle: 0.7, weight: 0.35, height: 1.0, hair: 'quiff', hairColour: '#2a1c12', facialHair: 'stubble', top: 'designer_hoodie', topColour: '#e8e6e1', bottoms: 'joggers', bottomsColour: '#2b2e35', shoes: 'hitops', accessories: ['chain', 'watch', 'sunglasses'], headColour: '#101012', chainColour: 'gold', skinTone: '#c68e6b' },
    phases: [
      { below: 0.6, name: 'Security on his payroll', line: 'Precinct security comes running — for him.', summon: [{ archetype: 'security' }, { archetype: 'security' }] },
      { below: 0.3, name: 'Knuckle up', line: 'Pryce slips the sunglasses off. He’s serious now.', damageMult: 1.2, parryBonus: 0.1 },
    ],
    reward: { cash: 320, xp: 900 }, flag: 'boss_precinct', drops: ['vip_pass', 'earrings_diamond'],
  },
  nightclub_owner: {
    id: 'nightclub_owner', name: 'Simone Achebe', title: 'Owner of Velvet', district: 'Neon Mile',
    intro: 'You’ve caused a lot of trouble in my clubs. Let’s settle it on the dance floor.',
    defeat: 'Out. Get out of my club.',
    brain: { ...baseBrain, style: 'kickboxing', attributes: attrs(8, 10, 8, 10, 8, 10), level: 7, aggression: 0.55, blockChance: 0.3, dodgeChance: 0.28, parryChance: 0.15, comboLength: 3, reactionFrames: 11 },
    style: 'kickboxing', secondaryStyle: 'karate', attributes: attrs(8, 10, 8, 10, 8, 10), level: 7, bonusHealth: 115,
    appearance: { body: 'female', muscle: 0.55, weight: 0.15, height: 1.02, hair: 'long', hairColour: '#0e0b09', top: 'leather', topColour: '#4a0e2a', bottoms: 'jeans', bottomsColour: '#1b1d22', shoes: 'boots', accessories: ['earring', 'chain', 'ring'], chainColour: 'silver', skinTone: '#4a2e1c' },
    phases: [
      { below: 0.65, name: 'Door staff', line: 'Simone snaps her fingers. The bouncers move in.', summon: [{ archetype: 'bouncer' }] },
      { below: 0.3, name: 'Lights out', line: 'She switches to karate: sharp, fast, precise.', swap: true, speedMult: 1.12, aggression: 0.7 },
    ],
    reward: { cash: 450, xp: 1200 }, flag: 'boss_nightclub', drops: ['handbag_designer', 'ring_diamond'],
  },
  football_firm: {
    id: 'football_firm', name: 'Carl Briggs', title: 'Top Boy of the Firm', district: 'Kirkgate Ground',
    intro: 'Matchday. My firm, my ground. You picked the wrong Saturday.',
    defeat: 'You’re alright, you. For an away fan.',
    brain: { ...baseBrain, style: 'street', attributes: attrs(11, 8, 11, 7, 8, 7), level: 6, aggression: 0.7, blockChance: 0.3, grabChance: 0.15, comboLength: 3, reactionFrames: 11 },
    style: 'street', secondaryStyle: 'boxing', attributes: attrs(11, 8, 11, 7, 8, 7), level: 6, bonusHealth: 170,
    appearance: { body: 'male', muscle: 0.7, weight: 0.5, height: 1.0, hair: 'crop', hairColour: '#6b4527', facialHair: 'stubble', top: 'bomber', topColour: '#1f2a44', bottoms: 'jeans', shoes: 'trainers', shoesColour: '#e8e6e1', accessories: ['cap'], headColour: '#e8e6e1', skinTone: '#e0ac87', faceScar: 'cheek' },
    phases: [
      { below: 0.7, name: 'The firm', line: 'The rest of the firm pours out of the stand!', summon: [{ archetype: 'casual' }, { archetype: 'casual' }, { archetype: 'brawler' }] },
      { below: 0.35, name: 'Flare up', line: 'Briggs grabs a corner flag pole!', weapon: 'pole', aggression: 0.75 },
    ],
    reward: { cash: 400, xp: 1100 }, flag: 'boss_stadium', drops: ['signed_shirt', 'programme_1966'],
  },
  underground_king: {
    id: 'underground_king', name: 'Silas Crane', title: 'The Underground King', district: 'Deep Line',
    intro: 'Down here there’s no daylight and no rules. Just me.',
    defeat: 'The tunnels... are yours...',
    brain: { ...baseBrain, style: 'bjj', attributes: attrs(10, 8, 11, 9, 9, 12), level: 8, aggression: 0.5, blockChance: 0.4, dodgeChance: 0.15, parryChance: 0.2, grabChance: 0.3, comboLength: 3, reactionFrames: 9 },
    style: 'bjj', secondaryStyle: 'muay_thai', attributes: attrs(10, 8, 11, 9, 9, 12), level: 8, bonusHealth: 180,
    appearance: { body: 'male', muscle: 0.65, weight: 0.25, height: 1.04, hair: 'long', hairColour: '#2a1c12', greying: 0.4, facialHair: 'full_beard', top: 'coat', topColour: '#2b2e35', bottoms: 'cargos', bottomsColour: '#1b1d22', shoes: 'boots', accessories: ['chain', 'ring'], chainColour: 'silver', skinTone: '#cf9670' },
    phases: [
      { below: 0.65, name: 'Tunnel rats', line: 'Figures drop out of the service hatches!', summon: [{ archetype: 'hooded' }, { archetype: 'knifeman' }] },
      { below: 0.35, name: 'The king stands', line: 'Crane switches to Muay Thai and stops grappling.', swap: true, damageMult: 1.15, aggression: 0.7 },
    ],
    reward: { cash: 500, xp: 1500 }, flag: 'boss_underground', drops: ['coin_sovereign', 'trainers_boxed'],
  },
  the_boss: {
    id: 'the_boss', name: 'Victor Hale', title: 'The Boss', district: 'Hale House',
    intro: 'Dunc worked for me. They all worked for me. You’ve been fighting my staff.',
    defeat: 'Then it’s yours. All of it. Every street.',
    brain: { ...baseBrain, style: 'boxing', attributes: attrs(12, 10, 12, 9, 11, 12), level: 10, aggression: 0.6, blockChance: 0.45, dodgeChance: 0.2, parryChance: 0.2, grabChance: 0.12, comboLength: 4, reactionFrames: 9 },
    style: 'boxing', secondaryStyle: 'muay_thai', attributes: attrs(12, 10, 12, 9, 11, 12), level: 10, bonusHealth: 170,
    appearance: { body: 'male', muscle: 0.75, weight: 0.4, height: 1.05, hair: 'quiff', hairColour: '#4a3020', greying: 0.6, facialHair: 'short_beard', top: 'coat', topColour: '#1b1d22', bottoms: 'jeans', bottomsColour: '#1b1d22', shoes: 'boots', accessories: ['watch', 'ring'], skinTone: '#eac0a2', faceScar: 'chin' },
    phases: [
      { below: 0.75, name: 'The inner circle', line: 'Hale’s inner circle steps out of the shadows.', summon: [{ archetype: 'gang_enforcer' }] },
      { below: 0.5, name: 'Coat off', line: 'Hale takes his coat off. Muay Thai.', swap: true, speedMult: 1.08 },
      { below: 0.25, name: 'Everything he’s got', line: 'Hale picks up a crowbar. No more rules.', weapon: 'crowbar', damageMult: 1.15, aggression: 0.8 },
    ],
    reward: { cash: 1000, xp: 3000 }, flag: 'boss_final', drops: ['watch_diver', 'chain_cuban'],
  },
};
