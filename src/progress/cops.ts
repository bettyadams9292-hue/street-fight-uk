/**
 * Police step 2 (docs/POLICE_PLAN.md): straight cops and bent ones, bungs, the bent custody sergeant, ringing
 * your crew for bail, and your phone held at the desk while you're in custody.
 *
 * - Every district has its own few officers (`roster`), the same faces every time, about one in six bent: more in
 *   the rough districts, fewer in the City Centre. You can't tell which is which until you've tried one.
 * - When they turn up you can have a word and offer a bung (`bungPrice`). A bent one takes it and walks off,
 *   and the district's police heat drops. A straight one nicks the idea: bribery goes on your record, more heat,
 *   and they come at you harder. Either way you remember (`known`), and the next time it's on the screen.
 * - In custody, Sgt Kerrigan is on the desk some nights (`sargeOnDuty`). For half the bail the paperwork goes
 *   missing, and after that he's your contact on the phone's Heat app: he cools a district down and gets your
 *   seized gear back out of the property store, for a price. Now and then he's caught (`CAUGHT_CHANCE`), and
 *   the police everywhere come down on you.
 * - Ring one of your crew from custody and they pay the bail; you owe them a bit on top (`OWE_INTEREST`), paid
 *   back from the tin when you get home, and they won't come out with you till it is.
 * - Booked in, your phone goes in a bag at the desk (`custody`): no cabs, no maps, until you walk out.
 */
import type { ItemStack } from '../items/Inventory';

export interface PoliceSave {
  /** Officers you've tried a bung on: 'bent' took it, 'straight' didn't. */
  known: Record<string, 'bent' | 'straight'>;
  /** Sgt Kerrigan's your contact (you paid him to lose the paperwork). */
  contact: boolean;
  /** He was caught: he's gone for good. */
  burned: boolean;
  /** What they took off you last time you were nicked, in the property store. */
  seized: ItemStack[];
  /** One of your crew paid your bail: who, and what you still owe them. */
  owed: { id: string; left: number } | null;
  /** Booked in and not out of the station yet: they've got your phone. */
  custody: boolean;
}

export function defaultPolice(): PoliceSave {
  return { known: {}, contact: false, burned: false, seized: [], owed: null, custody: false };
}

// ---- the officers --------------------------------------------------------------------------------

/** The bent ones' share, by district: rough streets more, the City Centre fewer, about 1 in 6 elsewhere. */
export const BENT_BASE = 1 / 6;
export const ROUGH_DISTRICTS: ReadonlySet<string> = new Set(['Back Alleys', 'Kingsway', 'Canal Docks', 'Hollins', 'Abandoned Factory', 'Industrial Quarter', 'Dunc’s Territory']);
export const CLEAN_DISTRICTS: ReadonlySet<string> = new Set(['City Centre', 'Ashcombe Park', 'Riverside Centre']);
export function bentChance(district: string): number {
  return ROUGH_DISTRICTS.has(district) ? 0.3 : CLEAN_DISTRICTS.has(district) ? 0.08 : BENT_BASE;
}

/** Officers each district has: the ones you meet there, in turn. */
export const ROSTER_SIZE = 6;
const SURNAMES = [
  'Dawson', 'Pritchard', 'Okafor', 'Harland', 'Mercer', 'Bains', 'Whitlock', 'Gallagher', 'Kowalski', 'Fenwick',
  'Ashworth', 'McBride', 'Achebe', 'Sutcliffe', 'Royle', 'Hussain', 'Tate', 'Brennan', 'Lister', 'Odukoya',
  'Carver', 'Stokes', 'Nolan', 'Fairclough', 'Mistry', 'Holroyd', 'Quinn', 'Varley', 'Doyle', 'Pearce',
];

export interface Cop {
  name: string;
  bent: boolean;
}

/** A small, steady hash of a string (the same district gives the same officers every game). */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
const unit = (n: number): number => (Math.imul(n ^ (n >>> 15), 2246822507) >>> 0) / 4294967296;

/**
 * A district's officers. At least one is bent wherever the odds give any chance at all, so a bung is always worth
 * a try somewhere, and the order is fixed by the district so you keep meeting the same faces.
 */
export function roster(district: string): Cop[] {
  const h = hash(district);
  const chance = bentChance(district);
  const used = new Set<number>();
  const out: Cop[] = [];
  for (let i = 0; out.length < ROSTER_SIZE; i++) {
    const k = (h + i * 7919) % SURNAMES.length;
    if (used.has(k)) continue;
    used.add(k);
    out.push({ name: `PC ${SURNAMES[k]}`, bent: unit(h + i * 104729) < chance });
  }
  if (!out.some((c) => c.bent)) out[h % ROSTER_SIZE].bent = true;
  return out;
}

/** The `n`th officer to turn up in a district. */
export function copFor(district: string, n: number): Cop {
  const r = roster(district);
  return r[((n % r.length) + r.length) % r.length];
}

// ---- bungs ---------------------------------------------------------------------------------------

/** A bung to look the other way: more the hotter they are for you, half again for each officer past the first. */
export function bungPrice(policeHeat: number, officers: number): number {
  const base = 40 + 2.5 * Math.max(0, policeHeat);
  return Math.round((base * (1 + 0.5 * Math.max(0, officers - 1))) / 5) * 5;
}
/** Police heat a taken bung knocks off the district. */
export const BUNG_COOL = 30;
/** Police heat on top of the bribery charge when a straight cop knocks it back. */
export const BRIBERY_HEAT = 15;
/** A straight cop you tried to bribe hits this much harder, and takes this much less. */
export const REFUSED_DEALT = 1.25;
export const REFUSED_TAKEN = 0.85;

// ---- the custody sergeant ------------------------------------------------------------------------

export const BENT_SARGE = 'Sgt Kerrigan';
export const STRAIGHT_SARGE = 'Sgt Okonjo';
/** Share of nights Kerrigan has the custody desk. */
export const SARGE_SHARE = 0.4;
/** Kerrigan's on the desk tonight? Fixed by how many trips and arrests you've had, so a reload doesn't change it. Never once he's been caught. */
export function sargeOnDuty(trips: number, arrests: number, burned: boolean): boolean {
  return !burned && unit(trips * 31 + arrests * 977 + 13) < SARGE_SHARE;
}
/** Losing the paperwork: half the bail, never under £50. */
export const PAPERWORK_SHARE = 0.5;
export function paperworkPrice(bail: number): number {
  return Math.max(50, Math.round((bail * PAPERWORK_SHARE) / 5) * 5);
}

// ---- Kerrigan as a contact -----------------------------------------------------------------------

/** Cooling a district down: per point of its police heat (the front counter charges £8 and the record too). */
export const COOL_PER_HEAT = 5;
export function coolPrice(policeHeat: number): number {
  return Math.max(50, Math.round((policeHeat * COOL_PER_HEAT) / 5) * 5);
}
/** Getting seized gear back out of the property store: a share of what it's worth. */
export const GEAR_BACK_SHARE = 0.3;
export function gearBackPrice(value: number): number {
  return Math.max(40, Math.round((value * GEAR_BACK_SHARE) / 5) * 5);
}
/** Each favour he does you, the chance he's caught doing it. */
export const CAUGHT_CHANCE = 0.06;
/** Police heat everywhere when he's caught (he talks). */
export const CAUGHT_HEAT = 25;
/** When the police would be waiting for you on arrival and he's your contact: this long before they come. */
export const TIPOFF_SECONDS = 25;

// ---- ringing your crew ---------------------------------------------------------------------------

/** What you owe on top of the bail they paid. */
export const OWE_INTEREST = 0.25;
export function owedFor(bail: number): number {
  return Math.round((bail * (1 + OWE_INTEREST)) / 5) * 5;
}

/** Load a save's police state, dropping junk. Seized stacks go through the caller's own item check. */
export function sanitisePolice(raw: unknown, stack: (s: unknown) => ItemStack | null): PoliceSave {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<PoliceSave>;
  const known: Record<string, 'bent' | 'straight'> = {};
  if (r.known && typeof r.known === 'object') for (const [k, v] of Object.entries(r.known)) if (v === 'bent' || v === 'straight') known[k] = v;
  const o = r.owed as { id?: unknown; left?: unknown } | null | undefined;
  const owed = o && typeof o.id === 'string' && typeof o.left === 'number' && Number.isFinite(o.left) && o.left > 0 ? { id: o.id, left: Math.round(o.left) } : null;
  return {
    known,
    contact: r.contact === true && r.burned !== true,
    burned: r.burned === true,
    seized: Array.isArray(r.seized) ? r.seized.map(stack).filter((x): x is ItemStack => !!x).slice(0, 40) : [],
    owed,
    custody: r.custody === true,
  };
}
