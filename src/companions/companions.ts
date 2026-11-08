import type { Progress, PurchaseResult } from '../progress/Progress';
import type { Attributes } from '../stats/Stats';
import type { StyleId } from '../styles/StyleData';
import type { CharacterAppearance } from '../character/Appearance';

/**
 * People you can hire to fight with you. Found in the snug at the back of
 * the Red Lion. One follows you at a time; they join fights, look after
 * themselves, never touch civilians, and get back up when a fight's over.
 */

export interface CompanionDef {
  id: string;
  name: string;
  nickname: string;
  role: string;
  style: StyleId;
  attributes: Attributes;
  /** Fee to hire (0 = earned another way). */
  fee: number;
  /** Story flag needed first. */
  requires?: string;
  requiresText?: string;
  /** Must be beaten in a fight in the pub before they'll join. */
  challenge?: boolean;
  /** AI tuning (same knobs as enemies). */
  ai: { aggression: number; blockChance: number; dodgeChance: number; parryChance: number; range: number; comboLength: number; grabChance: number; specialChance: number; reactionFrames: number };
  /** Share of normal damage they deal: help, not a carry. */
  damageMult: number;
  /** Extra max health. */
  health: number;
  strengths: string;
  weaknesses: string;
  look: Partial<CharacterAppearance>;
  seed: number;
  body: 'male' | 'female';
  line: string;
}

const A = (strength: number, speed: number, endurance: number, agility: number, defence: number, technique: number): Attributes => ({ strength, speed, endurance, agility, defence, technique });

export const COMPANION_LIST: CompanionDef[] = [
  {
    id: 'shaz', name: 'Shaz Patel', nickname: 'Shaz', role: 'Street fighter', style: 'street', attributes: A(6, 6, 6, 6, 5, 4), fee: 250,
    ai: { aggression: 0.45, blockChance: 0.3, dodgeChance: 0.1, parryChance: 0.03, range: 0.95, comboLength: 3, grabChance: 0.08, specialChance: 0.1, reactionFrames: 16 },
    damageMult: 0.7, health: 0, strengths: 'Cheap, game for anything', weaknesses: 'Nothing special', look: { top: 'hoodie', topColour: '#7a1414', bottoms: 'trackies' }, seed: 9101, body: 'female',
    line: 'Two-fifty and I’ve got your back. Can’t say fairer.',
  },
  {
    id: 'danny', name: 'Danny Moran', nickname: '“Jabs”', role: 'Boxing specialist', style: 'boxing', attributes: A(6, 8, 6, 6, 6, 7), fee: 450,
    ai: { aggression: 0.5, blockChance: 0.45, dodgeChance: 0.2, parryChance: 0.08, range: 1.0, comboLength: 4, grabChance: 0.02, specialChance: 0.15, reactionFrames: 12 },
    damageMult: 0.75, health: 10, strengths: 'Fast hands, long strings, slips punches', weaknesses: 'Kicks and grapplers trouble him', look: { top: 'tshirt', topColour: '#1f2a44', bottoms: 'shorts' }, seed: 9102, body: 'male',
    line: 'Ex-ABA. Point me at someone and keep out of my way.',
  },
  {
    id: 'mia', name: 'Mia Chen', nickname: 'Mia', role: 'Fast and agile fighter', style: 'kickboxing', attributes: A(5, 9, 6, 9, 5, 7), fee: 650, requires: 'boss_gaffer', requiresText: 'Beat the Gaffer first',
    ai: { aggression: 0.55, blockChance: 0.25, dodgeChance: 0.35, parryChance: 0.06, range: 1.15, comboLength: 4, grabChance: 0.02, specialChance: 0.2, reactionFrames: 10 },
    damageMult: 0.75, health: 0, strengths: 'Quick, dodges a lot, long kicks', weaknesses: 'Light: big hitters hurt her', look: { top: 'vest', topColour: '#e8e4dc', bottoms: 'shorts' }, seed: 9103, body: 'female',
    line: 'Heard you took the Gaffer down. I can work with that.',
  },
  {
    id: 'leah', name: 'Leah Grant', nickname: 'Leah', role: 'Defensive fighter', style: 'karate', attributes: A(5, 6, 8, 6, 9, 8), fee: 700, requires: 'boss_sully', requiresText: 'Beat Sully Kane first',
    ai: { aggression: 0.3, blockChance: 0.6, dodgeChance: 0.15, parryChance: 0.15, range: 1.2, comboLength: 2, grabChance: 0.02, specialChance: 0.1, reactionFrames: 10 },
    damageMult: 0.7, health: 30, strengths: 'Blocks and parries, very hard to put down', weaknesses: 'Doesn’t finish fights quickly', look: { top: 'tshirt', topColour: '#f0eee8', bottoms: 'trackies' }, seed: 9104, body: 'female',
    line: 'I don’t start fights. I just end them.',
  },
  {
    id: 'jonno', name: 'Jonno Price', nickname: 'Jonno', role: 'Wrestler', style: 'wrestling', attributes: A(8, 5, 8, 5, 6, 6), fee: 0, challenge: true,
    ai: { aggression: 0.45, blockChance: 0.3, dodgeChance: 0.05, parryChance: 0.03, range: 0.85, comboLength: 2, grabChance: 0.3, specialChance: 0.1, reactionFrames: 14 },
    damageMult: 0.75, health: 20, strengths: 'Takedowns, holds people for you', weaknesses: 'Slow on his feet', look: { top: 'vest', topColour: '#2a5a3a', bottoms: 'trackies' }, seed: 9105, body: 'male',
    line: 'Money? Nah. Put me on my back and I’m yours.',
  },
  {
    id: 'tank', name: 'Lee “Tank” Riley', nickname: 'Tank', role: 'Heavyweight brawler', style: 'street', attributes: A(10, 4, 9, 3, 7, 4), fee: 1200, requires: 'boss_sully', requiresText: 'Beat Sully Kane first',
    ai: { aggression: 0.5, blockChance: 0.2, dodgeChance: 0.0, parryChance: 0.0, range: 1.0, comboLength: 2, grabChance: 0.15, specialChance: 0.1, reactionFrames: 18 },
    damageMult: 0.85, health: 60, strengths: 'Hits like a lorry, soaks damage', weaknesses: 'Slow, easy to dodge', look: { top: 'puffer', topColour: '#1a1a1a', bottoms: 'jeans' }, seed: 9106, body: 'male',
    line: 'Twelve hundred. I’m worth every penny and every stitch.',
  },
  {
    id: 'reg', name: 'Reg Abbott', nickname: 'Old Reg', role: 'Experienced street fighter', style: 'boxing', attributes: A(7, 6, 7, 6, 8, 10), fee: 1800, requires: 'boss_ratcatcher', requiresText: 'Beat the Ratcatcher first',
    ai: { aggression: 0.4, blockChance: 0.5, dodgeChance: 0.2, parryChance: 0.2, range: 1.0, comboLength: 4, grabChance: 0.08, specialChance: 0.25, reactionFrames: 8 },
    damageMult: 0.85, health: 25, strengths: 'Reads fights, counters, never panics', weaknesses: 'Costs a fortune, not young', look: { top: 'coat', topColour: '#3a2a1a', bottoms: 'jeans' }, seed: 9107, body: 'male',
    line: 'Forty years on these streets, son. You’ll want me.',
  },
];
export const COMPANIONS: Record<string, CompanionDef> = Object.fromEntries(COMPANION_LIST.map((c) => [c.id, c]));

export interface CompanionSave {
  /** Hired (or won over). */
  recruited: string[];
  /** Who's following you (null = nobody). */
  active: string | null;
}

export function defaultCompanions(): CompanionSave {
  return { recruited: [], active: null };
}

export function sanitiseCompanions(raw: unknown): CompanionSave {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<CompanionSave>;
  const recruited = Array.isArray(r.recruited) ? [...new Set(r.recruited.filter((x): x is string => typeof x === 'string' && !!COMPANIONS[x]))] : [];
  const active = typeof r.active === 'string' && recruited.includes(r.active) ? r.active : null;
  return { recruited, active };
}

export function hireCompanion(p: Progress, id: string): PurchaseResult {
  const c = COMPANIONS[id];
  const s = p.save.companions;
  if (!c) return { ok: false, reason: 'Who?' };
  if (s.recruited.includes(id)) return { ok: false, reason: 'Already on your side' };
  if (c.requires && !p.has(c.requires)) return { ok: false, reason: c.requiresText ?? 'Not yet' };
  if (c.challenge) return { ok: false, reason: 'Beat them first' };
  if (!p.pay(c.fee)) return { ok: false, reason: `Not enough money: need £${c.fee}` };
  s.recruited.push(id);
  if (!s.active) s.active = id;
  return { ok: true };
}

/** Won the challenge fight: they join for free. */
export function winChallenge(p: Progress, id: string): void {
  const s = p.save.companions;
  if (!COMPANIONS[id] || s.recruited.includes(id)) return;
  s.recruited.push(id);
  if (!s.active) s.active = id;
}

export function setActiveCompanion(p: Progress, id: string | null): PurchaseResult {
  const s = p.save.companions;
  if (id && !s.recruited.includes(id)) return { ok: false, reason: 'Not hired' };
  s.active = id;
  return { ok: true };
}

/** Let someone go for good (no refund). */
export function dismissCompanion(p: Progress, id: string): PurchaseResult {
  const s = p.save.companions;
  const i = s.recruited.indexOf(id);
  if (i < 0) return { ok: false, reason: 'Not hired' };
  s.recruited.splice(i, 1);
  if (s.active === id) s.active = null;
  return { ok: true };
}

/** Areas a companion won't follow you into: they wait outside. */
export const COMPANION_WAITS_OUTSIDE = new Set(['home', 'basement']);
