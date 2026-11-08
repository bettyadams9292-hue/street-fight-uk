import type { Progress, PurchaseResult } from '../progress/Progress';
import type { PropDef, StationDef } from '../world/LevelTypes';
import type { UpgradeId } from '../progress/catalogue';

/**
 * The home gym: kit you buy at Iron Temple (Leisure Park) and train on. Each
 * piece trains one of the existing upgrade tracks (Conditioning, Roadwork,
 * Heavy bag, Skipping, Sparring, Pad work), so training feeds the same stat
 * modifiers the game already uses. Progress is earned rep by rep: training
 * costs fatigue, higher ranks need much more work, and nothing is bought.
 */

export interface GymKitDef {
  id: string;
  name: string;
  price: number;
  /** Which upgrade track it trains. */
  trains: UpgradeId;
  /** Shown to the player. */
  attribute: string;
  /** Training XP per perfect rep. */
  perRep: number;
  /** Fatigue a full session costs. */
  fatigue: number;
  /** Where it lives in the gym, and how big it is (half extents). */
  slot: { x: number; z: number };
  size: [number, number];
  solid: boolean;
  /** Animation the player performs. */
  activity: TrainingActivity;
  /** Where the player stands to use it (relative to the slot). */
  use: { dx: number; dz: number; facing: 1 | -1; y?: number };
  blurb: string;
}

export type TrainingActivity = 'bag' | 'curl' | 'press' | 'run' | 'cycle' | 'speedball' | 'skip';

export const GYM_KIT_LIST: GymKitDef[] = [
  { id: 'dumbbells', name: 'Dumbbell rack', price: 120, trains: 'power', attribute: 'Strength', perRep: 6, fatigue: 16, slot: { x: 3.45, z: -1.85 }, size: [0.45, 0.3], solid: true, activity: 'curl', use: { dx: 0, dz: 1.0, facing: 1 }, blurb: 'Curls and rows. Steady strength work.' },
  { id: 'barbell', name: 'Barbell & squat rack', price: 450, trains: 'power', attribute: 'Strength', perRep: 10, fatigue: 24, slot: { x: 5.0, z: -1.75 }, size: [0.75, 0.4], solid: true, activity: 'press', use: { dx: 0, dz: 0.85, facing: 1 }, blurb: 'Heavy compound lifts. The fastest way to get strong, and the most tiring.' },
  { id: 'treadmill', name: 'Treadmill', price: 900, trains: 'stamina', attribute: 'Stamina', perRep: 9, fatigue: 22, slot: { x: 6.9, z: -1.7 }, size: [0.9, 0.4], solid: true, activity: 'run', use: { dx: -0.1, dz: 0, facing: 1, y: 0.18 }, blurb: 'Roadwork without the rain. Builds stamina.' },
  { id: 'exercise_bike', name: 'Exercise bike', price: 600, trains: 'health', attribute: 'Conditioning', perRep: 9, fatigue: 20, slot: { x: 8.65, z: -1.8 }, size: [0.6, 0.3], solid: true, activity: 'cycle', use: { dx: -0.05, dz: 0, facing: 1, y: 0.12 }, blurb: 'Intervals on the bike. Builds endurance and health.' },
  { id: 'speed_ball', name: 'Speed ball platform', price: 220, trains: 'technique', attribute: 'Technique', perRep: 8, fatigue: 14, slot: { x: 9.75, z: -2.05 }, size: [0.3, 0.2], solid: false, activity: 'speedball', use: { dx: -0.2, dz: 1.05, facing: 1 }, blurb: 'Rhythm and timing. Sharpens technique.' },
  { id: 'bag', name: 'Heavy punch bag', price: 180, trains: 'power', attribute: 'Punch power', perRep: 8, fatigue: 18, slot: { x: 10.9, z: -1.55 }, size: [0.3, 0.3], solid: true, activity: 'bag', use: { dx: -0.75, dz: 0.4, facing: 1 }, blurb: 'Power shots on the heavy bag.' },
  { id: 'mat', name: 'Training mat', price: 150, trains: 'speed', attribute: 'Agility', perRep: 8, fatigue: 16, slot: { x: 11.15, z: -0.4 }, size: [0.75, 0.8], solid: false, activity: 'skip', use: { dx: -0.2, dz: 0, facing: 1 }, blurb: 'Skipping, footwork and stretching. Builds speed and agility. Mo spars on it too.' },
];
export const GYM_KIT: Record<string, GymKitDef> = Object.fromEntries(GYM_KIT_LIST.map((k) => [k.id, k]));

/** The heavy bag was always there, and so were the dumbbells: you start with them. */
export const STARTER_KIT = ['bag', 'dumbbells'];

/** Sparring with Mo trains Defence (the old "Sparring" track). */
export const SPAR_TRAINS: UpgradeId = 'toughness';
export const SPAR_FATIGUE = 20;
export const SPAR_SPOT = { x: 11.15, z: -0.55 };

/** Ranks per track: the first five as before, five more that count for half. */
export const MAX_TRAINING_RANK = 10;

/** XP to go from rank r to r+1. Each rank is a third harder than the last. */
export function xpForRank(r: number): number {
  return Math.round(120 * Math.pow(1.32, r));
}

/** Can't start a session above this. */
export const FATIGUE_LIMIT = 85;
/** Seconds of play to recover one point of fatigue. */
export const FATIGUE_RECOVERY_S = 8;

export interface GymSave {
  owned: string[];
  /** XP toward the next rank, per track. */
  xp: Partial<Record<UpgradeId, number>>;
  fatigue: number;
  /** Play time fatigue was last brought up to date. */
  fatigueAt: number;
  sessions: number;
}

export function defaultGym(): GymSave {
  return { owned: [...STARTER_KIT], xp: {}, fatigue: 0, fatigueAt: 0, sessions: 0 };
}

const num = (v: unknown, d: number, min = 0, max = 1e9) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : d);

export function sanitiseGym(raw: unknown, playTime: number): GymSave {
  const d = defaultGym();
  if (!raw || typeof raw !== 'object') return { ...d, fatigueAt: playTime };
  const r = raw as Partial<GymSave>;
  const owned = Array.isArray(r.owned) ? [...new Set(r.owned.filter((x): x is string => typeof x === 'string' && !!GYM_KIT[x]))] : [...STARTER_KIT];
  for (const k of STARTER_KIT) if (!owned.includes(k)) owned.push(k);
  const xp: GymSave['xp'] = {};
  for (const [k, v] of Object.entries(r.xp ?? {})) if (['health', 'stamina', 'power', 'speed', 'toughness', 'technique'].includes(k)) xp[k as UpgradeId] = Math.floor(num(v, 0, 0, 1e6));
  return { owned, xp, fatigue: num(r.fatigue, 0, 0, 100), fatigueAt: Math.min(num(r.fatigueAt, playTime), playTime), sessions: Math.floor(num(r.sessions, 0)) };
}

/** Fatigue now, recovered for play time since it was last checked. */
export function currentFatigue(g: GymSave, playTime: number): number {
  const rec = Math.max(0, playTime - g.fatigueAt) / FATIGUE_RECOVERY_S;
  g.fatigue = Math.max(0, g.fatigue - rec);
  g.fatigueAt = playTime;
  return g.fatigue;
}

/** Rest (sofa) or a meal knocks fatigue down. */
export function recover(g: GymSave, playTime: number, amount: number): void {
  currentFatigue(g, playTime);
  g.fatigue = Math.max(0, g.fatigue - amount);
}

export function buyGymKit(p: Progress, id: string): PurchaseResult {
  const def = GYM_KIT[id];
  const g = p.save.gym;
  if (!def) return { ok: false, reason: 'Not stocked' };
  if (g.owned.includes(id)) return { ok: false, reason: 'You’ve already got one in the gym' };
  if (!p.pay(def.price)) return { ok: false, reason: `Not enough money: need £${def.price}` };
  g.owned.push(id);
  return { ok: true };
}

export function sellGymKit(p: Progress, id: string): { ok: true; refund: number } | { ok: false; reason: string } {
  const g = p.save.gym;
  const i = g.owned.indexOf(id);
  if (i < 0) return { ok: false, reason: 'Not yours' };
  const refund = Math.floor(GYM_KIT[id].price / 2);
  g.owned.splice(i, 1);
  p.save.cash.pocket += refund;
  return { ok: true, refund };
}

/** One rep's grade in the training mini-game. */
export type RepGrade = 'perfect' | 'good' | 'miss';
const GRADE_VALUE: Record<RepGrade, number> = { perfect: 1, good: 0.6, miss: 0 };

/** Fatigue scales what a session is worth: fresh is full value, wiped out is a tenth. */
export function fatigueFactor(fatigue: number): number {
  return Math.max(0.1, 1 - fatigue / 100);
}

export interface SessionResult {
  ok: true;
  xp: number;
  rankedUp: number;
  rank: number;
  toNext: number;
  needed: number;
  fatigue: number;
}

/**
 * Apply a finished training session: XP from the reps (scaled by fatigue),
 * ranks gained at the thresholds, fatigue added. Max rank stops it.
 */
export function finishSession(p: Progress, track: UpgradeId, perRep: number, fatigueCost: number, grades: RepGrade[]): SessionResult | { ok: false; reason: string } {
  const g = p.save.gym;
  const f = currentFatigue(g, p.save.playTime);
  if (!grades.length) return { ok: false, reason: 'No reps done' };
  let rank = p.save.upgrades[track];
  if (rank >= MAX_TRAINING_RANK) return { ok: false, reason: 'Already at the top rank' };
  const raw = grades.reduce((n, gr) => n + GRADE_VALUE[gr] * perRep, 0);
  const xp = Math.round(raw * fatigueFactor(f));
  let pool = (g.xp[track] ?? 0) + xp;
  let rankedUp = 0;
  while (rank < MAX_TRAINING_RANK && pool >= xpForRank(rank)) {
    pool -= xpForRank(rank);
    rank++;
    rankedUp++;
  }
  if (rank >= MAX_TRAINING_RANK) pool = 0;
  p.save.upgrades[track] = rank;
  g.xp[track] = pool;
  // A short session costs less fatigue than a full one.
  g.fatigue = Math.min(100, f + fatigueCost * Math.min(1, grades.length / 10));
  g.sessions++;
  return { ok: true, xp, rankedUp, rank, toNext: pool, needed: rank < MAX_TRAINING_RANK ? xpForRank(rank) : 0, fatigue: Math.round(g.fatigue) };
}

/** Can a session start now? */
export function canTrain(p: Progress, track: UpgradeId): { ok: true } | { ok: false; reason: string } {
  if (p.save.upgrades[track] >= MAX_TRAINING_RANK) return { ok: false, reason: 'You’re at the top rank for this' };
  const f = currentFatigue(p.save.gym, p.save.playTime);
  if (f >= FATIGUE_LIMIT) return { ok: false, reason: `Too tired (${Math.round(f)}% fatigue). Rest on the sofa, eat, or come back later.` };
  return { ok: true };
}

// ---- in the house ---------------------------------------------------------------------------------

/** Kit props for the home gym. */
export function gymProps(g: GymSave): PropDef[] {
  return GYM_KIT_LIST.filter((k) => g.owned.includes(k.id)).map((k) => ({
    kind: 'gym_kit', item: k.id, x: k.slot.x, z: k.slot.z, size: k.size, solid: k.solid,
  }));
}

/** A station at every piece of kit you own, an empty-space prompt where you don't, and Mo on the mat. */
export function gymStations(g?: GymSave): StationDef[] {
  const owned = g?.owned ?? STARTER_KIT;
  const out: StationDef[] = [];
  for (const k of GYM_KIT_LIST) {
    const at = k.id === 'mat' ? { x: k.slot.x - 0.75, z: 0.55 } : { x: k.slot.x, z: Math.max(-1.0, Math.min(0.55, k.slot.z + k.size[1] + 0.45)) };
    out.push(owned.includes(k.id)
      ? { id: 'train', x: at.x, z: at.z, label: `${k.name}: train ${k.attribute.toLowerCase()}`, tab: k.id }
      : { id: 'train', x: at.x, z: at.z, label: `Space for a ${k.name.toLowerCase()} (Iron Temple, Leisure Park)`, tab: k.id });
  }
  out.push({ id: 'sparring', x: SPAR_SPOT.x + 0.4, z: 0.55, label: 'Spar with Mo (practice: he won’t really hurt you)' });
  return out;
}
