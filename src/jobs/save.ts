/**
 * The jobs part of the save: types, a new save, and reading an old or damaged one back. Kept apart from jobs.ts
 * (which needs the levels) so Progress can load it without a cycle.
 */
import type { DistrictHeat } from '../progress/heat';
import { ITEMS } from '../items/items';
import type { AreaId } from '../progress/Progress';

/** Highest standing with a contact, and how many jobs a board holds. */
export const STANDING_MAX = 100;
export const BOARD_SIZE = 2;

export type JobKind = 'sort' | 'debt' | 'deliver' | 'recover' | 'deal';
export const JOB_KINDS: JobKind[] = ['sort', 'debt', 'deliver', 'recover', 'deal'];
export const JOB_KIND_NAME: Record<JobKind, string> = {
  sort: 'Sort someone out',
  debt: 'Collect a debt',
  deliver: 'Deliver a package',
  recover: 'Get something back',
  deal: 'Buy and sell',
};

export type ContactId = 'terry' | 'bev' | 'kez' | 'del' | 'nails';
export const CONTACT_IDS: ContactId[] = ['terry', 'bev', 'kez', 'del', 'nails'];

export interface ContactDef {
  id: ContactId;
  name: string;
  role: string;
  /** Where they are: their area, and the words for it. */
  area: AreaId;
  where: string;
  kinds: JobKind[];
  /** What they say when you walk up. */
  line: string;
  /** Needs this flag before they'll deal with you (their street is shut till then anyway). */
  requires?: string;
  /** How they look (spawned at their station). */
  look: { seed: number; body: 'male' | 'female'; top: string; topColour: string };
  /** What some of their jobs pay in, on top of the cash. */
  rewards: string[];
}

export interface Job {
  id: string;
  from: ContactId | 'street';
  /** Who gave it (a contact's name, or the passer-by's). */
  giver: string;
  kind: JobKind;
  title: string;
  brief: string;
  area: AreaId;
  /** Where along the street they are. */
  x: number;
  /** The one you're after: the lad to sort out, the debtor, the recipient, the buyer. */
  target: string;
  body: 'male' | 'female';
  seed: number;
  /** How many mates they have with them (if it comes to a fight). */
  mates: number;
  /** What it pays: on top of the cut for a debt; the sale price for a deal. */
  cash: number;
  xp: number;
  items: string[];
  heat: Partial<DistrictHeat>;
  /** The thing you carry: the parcel, the package, what you're getting back. */
  item?: string;
  /** A debt: what they owe (you keep `cash`, the rest goes to the contact). */
  owed?: number;
  /** A deal: what the package costs you. */
  cost?: number;
  /** Deliveries and deals: seconds of play to get it there. */
  seconds?: number;
  /** A chain job: its step (0, 1, 2). */
  chain?: number;
  /** Debts: they'd rather fight than pay. Deals: the buyer tries to rip you off. */
  fights?: boolean;
}

export interface ActiveJob extends Job {
  /** go: to the target. back: back to the contact with the money or the goods. */
  stage: 'go' | 'back';
  /** Play time it has to be done by (deliveries and deals). */
  deadline?: number;
}

export interface JobsSave {
  standing: Partial<Record<ContactId, number>>;
  board: Partial<Record<ContactId, Job[]>>;
  /** The trip each board was last drawn up on. */
  boardTrip: Partial<Record<ContactId, number>>;
  /** Chain jobs done, per contact. */
  chain: Partial<Record<ContactId, number>>;
  active: ActiveJob | null;
  done: number;
  failed: number;
  seq: number;
  /** Contacts you've met (their map pins and the phone list them). */
  met: ContactId[];
}

export function newJobs(): JobsSave {
  return { standing: {}, board: {}, boardTrip: {}, chain: {}, active: null, done: 0, failed: 0, seq: 1, met: [] };
}

const num = (v: unknown, d: number, lo = 0, hi = Infinity) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d);

function sanitiseJob(v: unknown, areas: readonly string[]): Job | null {
  if (!v || typeof v !== 'object') return null;
  const j = v as Partial<Job>;
  if (typeof j.id !== 'string' || !JOB_KINDS.includes(j.kind as JobKind) || !areas.includes(j.area as string)) return null;
  if (j.from !== 'street' && !CONTACT_IDS.includes(j.from as ContactId)) return null;
  if (j.item && !ITEMS[j.item]) return null;
  return {
    id: j.id, from: j.from as Job['from'], giver: String(j.giver ?? ''), kind: j.kind as JobKind, title: String(j.title ?? ''), brief: String(j.brief ?? ''),
    area: j.area as Job['area'], x: num(j.x, 20), target: String(j.target ?? 'Someone'), body: j.body === 'female' ? 'female' : 'male', seed: num(j.seed, 1),
    mates: num(j.mates, 0, 0, 4), cash: num(j.cash, 0), xp: num(j.xp, 0), items: Array.isArray(j.items) ? j.items.filter((x): x is string => typeof x === 'string' && !!ITEMS[x]) : [],
    heat: j.heat && typeof j.heat === 'object' ? { police: num(j.heat.police, 0, 0, 50), street: num(j.heat.street, 0, 0, 50), gang: num(j.heat.gang, 0, 0, 50) } : {},
    item: j.item, owed: j.owed === undefined ? undefined : num(j.owed, 0), cost: j.cost === undefined ? undefined : num(j.cost, 0),
    seconds: j.seconds === undefined ? undefined : num(j.seconds, 240, 30), chain: j.chain === undefined ? undefined : num(j.chain, 0, 0, 9), fights: j.fights === true,
  };
}

export function sanitiseJobs(r: unknown, areas: readonly string[]): JobsSave {
  const out = newJobs();
  if (!r || typeof r !== 'object') return out;
  const x = r as Partial<JobsSave>;
  for (const c of CONTACT_IDS) {
    if (x.standing?.[c] !== undefined) out.standing[c] = num(x.standing[c], 0, 0, STANDING_MAX);
    if (x.chain?.[c] !== undefined) out.chain[c] = num(x.chain[c], 0, 0, 9);
    if (x.boardTrip?.[c] !== undefined) out.boardTrip[c] = num(x.boardTrip[c], 0);
    const b = x.board?.[c];
    if (Array.isArray(b)) out.board[c] = b.map((v) => sanitiseJob(v, areas)).filter((j): j is Job => !!j).slice(0, BOARD_SIZE);
  }
  if (x.active) {
    const j = sanitiseJob(x.active, areas);
    const a = x.active as Partial<ActiveJob>;
    if (j) out.active = { ...j, stage: a.stage === 'back' ? 'back' : 'go', deadline: a.deadline === undefined ? undefined : num(a.deadline, 0) };
  }
  out.done = num(x.done, 0);
  out.failed = num(x.failed, 0);
  out.seq = num(x.seq, 1, 1);
  out.met = Array.isArray(x.met) ? [...new Set(x.met.filter((c): c is ContactId => CONTACT_IDS.includes(c as ContactId)))] : [];
  return out;
}

