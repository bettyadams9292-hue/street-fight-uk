import { ATTRIBUTE_NAMES, defaultAttributes, type AttributeName, type Attributes } from '../stats/Stats';
import { sanitiseAppearance, type CharacterAppearance } from './Appearance';

/** Rules for spending points at character creation (see design doc). */
export const CREATION_BASE = 5;
export const CREATION_POINTS = 10;
export const CREATION_CAP = 10;

export type BackgroundId = 'estate_scrapper' | 'amateur_boxer' | 'rugby' | 'dancer' | 'doorman';

export interface Perk {
  text: string;
  /** Stage the perk starts working in. Perks whose system isn't built yet say so in the UI. */
  activeFromStage: number;
}

export interface Background {
  id: BackgroundId;
  name: string;
  blurb: string;
  bonus: Partial<Attributes>;
  perk: Perk;
  startingMoney: number;
  /** Starting rank in styles, e.g. Street Fighting rank 2. */
  styleRanks: Record<string, number>;
}

export const BACKGROUNDS: Record<BackgroundId, Background> = {
  estate_scrapper: {
    id: 'estate_scrapper',
    name: 'Estate scrapper',
    blurb: 'Grew up settling things behind the garages. Hits hard, keeps going.',
    bonus: { strength: 2, endurance: 2 },
    perk: { text: 'Street Fighting starts at rank 2 (+5% damage with Street Fighting moves)', activeFromStage: 2 },
    startingMoney: 40,
    styleRanks: { street: 2 },
  },
  amateur_boxer: {
    id: 'amateur_boxer',
    name: 'Ex-amateur boxer',
    blurb: 'A few years of club boxing before life got in the way. Quick hands, good guard.',
    bonus: { speed: 2, defence: 2 },
    perk: { text: 'Boxing trainer offers lessons at half price', activeFromStage: 5 },
    startingMoney: 60,
    styleRanks: { street: 1 },
  },
  rugby: {
    id: 'rugby',
    name: 'Rugby player',
    blurb: 'Front row forward. Used to contact and hard to move.',
    bonus: { strength: 2, defence: 2 },
    perk: { text: 'Grabs and takedowns cost 20% less stamina', activeFromStage: 3 },
    startingMoney: 60,
    styleRanks: { street: 1 },
  },
  dancer: {
    id: 'dancer',
    name: 'Dancer',
    blurb: 'Years of training: balance, footwork and timing.',
    bonus: { agility: 2, speed: 2 },
    perk: { text: 'Dodges are invulnerable for 2 extra frames', activeFromStage: 3 },
    startingMoney: 50,
    styleRanks: { street: 1 },
  },
  doorman: {
    id: 'doorman',
    name: 'Door supervisor',
    blurb: 'Worked the doors in town. Reads trouble before it starts.',
    bonus: { defence: 2, technique: 2 },
    perk: { text: 'Starts with £200 and better standing with the clubs', activeFromStage: 2 },
    startingMoney: 200,
    styleRanks: { street: 1 },
  },
};

export const BACKGROUND_IDS = Object.keys(BACKGROUNDS) as BackgroundId[];

export interface PlayerCharacter {
  version: 1;
  name: string;
  appearance: CharacterAppearance;
  background: BackgroundId;
  /** Points the player spent at creation, on top of CREATION_BASE. */
  allocated: Attributes;
  level: number;
  money: number;
  styleRanks: Record<string, number>;
  createdAt: string;
}

export function emptyAllocation(): Attributes {
  return defaultAttributes(0);
}

export function pointsSpent(allocated: Attributes): number {
  return ATTRIBUTE_NAMES.reduce((sum, a) => sum + allocated[a], 0);
}

export function pointsLeft(allocated: Attributes): number {
  return CREATION_POINTS - pointsSpent(allocated);
}

/** Can one more point go into this attribute? */
export function canAdd(allocated: Attributes, attr: AttributeName): boolean {
  return pointsLeft(allocated) > 0 && CREATION_BASE + allocated[attr] < CREATION_CAP;
}

export function canRemove(allocated: Attributes, attr: AttributeName): boolean {
  return allocated[attr] > 0;
}

/** Final attributes: base + allocation + background bonus. The bonus may take an attribute past the creation cap. */
export function finalAttributes(allocated: Attributes, background: BackgroundId): Attributes {
  const bonus = BACKGROUNDS[background].bonus;
  const out = defaultAttributes(CREATION_BASE);
  for (const a of ATTRIBUTE_NAMES) out[a] = CREATION_BASE + allocated[a] + (bonus[a] ?? 0);
  return out;
}

export function isAllocationValid(allocated: Attributes): boolean {
  return ATTRIBUTE_NAMES.every((a) => allocated[a] >= 0 && CREATION_BASE + allocated[a] <= CREATION_CAP) && pointsSpent(allocated) <= CREATION_POINTS;
}

export function cleanName(raw: string): string {
  const name = raw.replace(/[^\p{L}\p{N} '\-.]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 16);
  return name || 'Unknown';
}

export function createCharacter(opts: { name: string; appearance: CharacterAppearance; background: BackgroundId; allocated: Attributes }): PlayerCharacter {
  if (!isAllocationValid(opts.allocated)) throw new Error('Invalid attribute allocation');
  const bg = BACKGROUNDS[opts.background];
  return {
    version: 1,
    name: cleanName(opts.name),
    appearance: sanitiseAppearance(opts.appearance),
    background: bg.id,
    allocated: { ...opts.allocated },
    level: 1,
    money: bg.startingMoney,
    styleRanks: { ...bg.styleRanks },
    createdAt: new Date().toISOString(),
  };
}

/** Validate a loaded character; returns null if it can't be repaired. */
export function sanitiseCharacter(raw: unknown): PlayerCharacter | null {
  if (!raw || typeof raw !== 'object') return null;
  const c = raw as Partial<PlayerCharacter>;
  const background = BACKGROUND_IDS.includes(c.background as BackgroundId) ? (c.background as BackgroundId) : null;
  if (!background) return null;
  const allocated = emptyAllocation();
  for (const a of ATTRIBUTE_NAMES) {
    const v = c.allocated?.[a];
    allocated[a] = typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(CREATION_CAP - CREATION_BASE, Math.round(v))) : 0;
  }
  if (!isAllocationValid(allocated)) return null;
  return {
    version: 1,
    name: cleanName(typeof c.name === 'string' ? c.name : ''),
    appearance: sanitiseAppearance(c.appearance),
    background,
    allocated,
    level: typeof c.level === 'number' && c.level >= 1 ? Math.floor(c.level) : 1,
    money: typeof c.money === 'number' && c.money >= 0 ? Math.floor(c.money) : BACKGROUNDS[background].startingMoney,
    styleRanks: c.styleRanks && typeof c.styleRanks === 'object' ? { ...c.styleRanks } : { ...BACKGROUNDS[background].styleRanks },
    createdAt: typeof c.createdAt === 'string' ? c.createdAt : new Date().toISOString(),
  };
}
