/**
 * Jobs: work from the people who run things round here, and the odd passer-by who needs a hand.
 *
 * Five fixed contacts stand in set places (CONTACTS). Each keeps a board of a couple of jobs that changes every few
 * trips, and a short chain of their own special jobs (CHAINS) that opens as your standing with them grows. Every so
 * often someone on the street has a one-off job too (World spawns them; `streetJob` writes the job).
 *
 * The kinds of work:
 * - sort: find a named lad and his mates in another district and put them down; go back for your money.
 * - debt: lean on someone who owes; they pay up or square up. Bring the money back, keep your cut.
 * - deliver: carry a parcel to someone across town before the time runs out; they pay on the doorstep.
 * - recover: take something back off the lad who nicked it, and bring it back.
 * - deal: buy a package off Kez and sell it on to a buyer for more. Sometimes the buyer tries it on.
 *
 * Everything here is numbers and save state (no Three.js, no DOM): World runs the people at the other end and
 * Game shows the screens. One job at a time (`save.jobs.active`).
 */
import type { AreaId, Progress } from '../progress/Progress';
import type { DistrictHeat } from '../progress/heat';
import { BOARD_SIZE, STANDING_MAX, type ActiveJob, type ContactId, type Job, type JobKind } from './save';
export * from './save';
export * from './contacts';
import { CHAINS, CONTACTS } from './contacts';
import { LEVELS } from '../world/levels';
import { onStrip, stripIndex, STRIP } from '../world/strip';
import { hash01 } from '../realty/catalogue';
import { Rng } from '../core/Rng';
import { GRUNT_NAMES } from '../ai/archetypes';
import { ITEMS } from '../items/items';

/** Standing with a contact: what they call you, and what it does for the pay. */
export const TIERS = [
  { at: 0, name: 'Nobody', mult: 1 },
  { at: 10, name: 'Known', mult: 1.15 },
  { at: 30, name: 'Trusted', mult: 1.3 },
  { at: 60, name: 'Inner circle', mult: 1.5 },
] as const;
/** A job done: standing gained (chain jobs give more). */
export const STANDING_JOB = 5;
export const STANDING_CHAIN = 12;
/** A job dropped or failed: standing lost. */
export const STANDING_DROP = 3;
export const STANDING_FAIL = 6;
/** The board changes every this many trips. */
export const BOARD_TRIPS = 4;
/** A street job: the chance someone's looking for help on a street you walk into (one a visit at most). */
export const STREET_CHANCE = 0.3;

export function tierOf(standing: number): { index: number; name: string; mult: number; next: number | null } {
  let i = 0;
  for (let k = 0; k < TIERS.length; k++) if (standing >= TIERS[k].at) i = k;
  return { index: i, name: TIERS[i].name, mult: TIERS[i].mult, next: TIERS[i + 1]?.at ?? null };
}

// ---- making jobs --------------------------------------------------------------------------------------------

const round5 = (n: number) => Math.max(5, Math.round(n / 5) * 5);

/** The streets you could be sent to: the ones on the long street you've been to, near where you're asked. */
export function jobAreas(p: Progress, near: AreaId): AreaId[] {
  const visited = new Set(p.save.visited);
  const home = onStrip(near) ? near : LEVELS[near] ? stripAreaOf(near) : 'estate';
  const centre = stripIndex(home);
  return STRIP.filter((a) => visited.has(a) && Math.abs(stripIndex(a) - centre) <= 4);
}

/** The street outside an interior (the pub's is the High Street). */
export function stripAreaOf(area: AreaId): AreaId {
  if (onStrip(area)) return area;
  const out = LEVELS[area]?.exits.find((e) => onStrip(e.to));
  return out ? out.to : 'estate';
}

/** Where along a street to put them: clear of its ends, its doors and the fights still to come. */
export function spotIn(area: AreaId, rng: () => number): number {
  const l = LEVELS[area];
  const lo = l.bounds.minX + 10;
  const hi = l.bounds.maxX - 10;
  let x = lo + rng() * Math.max(1, hi - lo);
  for (let tries = 0; tries < 8; tries++) {
    const near =
      l.encounters.some((e) => !e.optional && Math.abs(e.triggerX - x) < 7) ||
      l.exits.some((e) => e.kind === 'door' && Math.abs(e.x - x) < 2.5) ||
      (l.stations ?? []).some((s) => Math.abs(s.x - x) < 2.5);
    if (!near) break;
    x = lo + rng() * Math.max(1, hi - lo);
  }
  return Math.round(x * 10) / 10;
}

const DELIVERY_ITEMS = ['job_parcel'];
const RECOVER_ITEMS = ['job_phones', 'job_ledger', 'job_ring', 'job_keys'];

const BRIEFS: Record<JobKind, ((t: string, place: string) => string)[]> = {
  sort: [
    (t, w) => `${t}’s been mouthing off about people he shouldn’t. He’s in ${w} with his mates. Shut him up.`,
    (t, w) => `${t} put a friend of ours in hospital. He hangs about ${w}. Return the favour.`,
    (t, w) => `${t} and his lot have been selling on our patch in ${w}. Make them think again.`,
  ],
  debt: [
    (t, w) => `${t} owes and has stopped answering the phone. Try ${w}.`,
    (t, w) => `${t} borrowed for a car and says the cheque’s in the post. Go and get it in ${w}.`,
    (t, w) => `${t}’s three weeks late. Last seen in ${w}. Bring back every penny; keep your cut.`,
  ],
  deliver: [
    (t, w) => `A parcel for ${t} in ${w}. Don’t open it and don’t hang about.`,
    (t, w) => `${t} in ${w} is waiting on this. Get it there before they change their mind.`,
  ],
  recover: [
    (t, w) => `${t} walked off with something that isn’t his. He’s in ${w}. Take it back.`,
    (t, w) => `${t} nicked it and thinks nobody knows. He’s in ${w}. Bring it back here.`,
  ],
  deal: [
    (t, w) => `${t} in ${w} wants a package. Buy it off me, sell it to him, keep the difference.`,
    (t, w) => `Got a buyer, ${t}, waiting in ${w}. Cash on delivery. If he gets clever, you get cleverer.`,
  ],
};

const TITLES: Record<JobKind, string[]> = {
  sort: ['A word in his ear', 'Teach him some manners', 'Off our patch', 'Pay him a visit'],
  debt: ['Payday', 'Overdue', 'Pay up', 'Collection'],
  deliver: ['Special delivery', 'Drop-off', 'Parcel run'],
  recover: ['Finders keepers', 'Return to sender', 'Get it back'],
  deal: ['A bit of business', 'Cash on delivery', 'A sale'],
};

/** Archetypes for who you're up against, by job. */
export const TARGET_ARCH = { sort: ['thug', 'hothead', 'brawler', 'bruiser'], mate: ['thug', 'casual', 'hothead', 'brawler'] } as const;

function pick<T>(list: readonly T[], r: () => number): T {
  return list[Math.floor(r() * list.length) % list.length];
}

function itemName(id: string): string {
  return ITEMS[id]?.name.toLowerCase() ?? id;
}

/** What a job pays, from the kind, your level, how far east it is, and your standing with whoever's paying. */
export function jobPay(kind: JobKind, level: number, area: AreaId, mult: number): { cash: number; xp: number; owed?: number; cost?: number } {
  const t = 1 + 0.3 * (LEVELS[area]?.threat ?? 0);
  const xp = Math.round(({ sort: 160, debt: 110, deliver: 90, recover: 170, deal: 120 }[kind] + 12 * level) * t);
  if (kind === 'debt') {
    const owed = round5((120 + 30 * level) * t);
    return { owed, cash: round5((owed * 0.3 + 20) * mult), xp };
  }
  if (kind === 'deal') {
    const cost = round5((90 + 15 * level) * t);
    return { cost, cash: round5(cost * (1.55 + 0.25 * (mult - 1) * 2)), xp };
  }
  const base = { sort: 70, deliver: 50, recover: 80 }[kind];
  return { cash: round5((base + 9 * level) * t * mult), xp };
}

/** What doing it costs you in heat, in the district where it happens. */
export function jobHeat(kind: JobKind, fights: boolean): Partial<DistrictHeat> {
  switch (kind) {
    case 'sort':
      return { street: 6, gang: 8, police: 2 };
    case 'debt':
      return fights ? { street: 6, police: 3 } : { street: 3 };
    case 'deliver':
      return { police: 2 };
    case 'recover':
      return { street: 4, gang: 6 };
    case 'deal':
      return { police: 10, street: 3 };
  }
}

/** Seconds of play to get a parcel or a package there: more for further along the street. */
export function deliverySeconds(from: AreaId, to: AreaId): number {
  const hops = Math.abs(stripIndex(stripAreaOf(from)) - stripIndex(stripAreaOf(to)));
  return 180 + hops * 45;
}

interface MakeOpts {
  from: ContactId | 'street';
  giver: string;
  kind: JobKind;
  area: AreaId;
  near: AreaId;
  mult: number;
  rng: () => number;
  seq: number;
  rewards: readonly string[];
}

function makeJob(p: Progress, o: MakeOpts): Job {
  const r = o.rng;
  const female = o.kind !== 'sort' && o.kind !== 'recover' && r() < 0.25;
  const names = female ? GRUNT_NAMES.female : GRUNT_NAMES.male;
  const target = pick(names, r);
  const place = LEVELS[o.area].name;
  const pay = jobPay(o.kind, p.save.level, o.area, o.mult);
  const fights = o.kind === 'debt' ? r() < 0.45 : o.kind === 'deal' ? r() < 0.2 : true;
  const mates = o.kind === 'sort' || o.kind === 'recover' ? 1 + Math.floor(r() * (p.save.level >= 6 ? 3 : 2)) : fights ? Math.floor(r() * 2) + (o.kind === 'deal' ? 1 : 0) : 0;
  const item = o.kind === 'deliver' ? pick(DELIVERY_ITEMS, r) : o.kind === 'deal' ? 'job_package' : o.kind === 'recover' ? pick(RECOVER_ITEMS, r) : undefined;
  let brief = pick(BRIEFS[o.kind], r)(target, place);
  if (o.kind === 'recover' && item) brief = brief.replace('something that isn’t his', `${itemName(item)} that isn’t his`).replace('nicked it', `nicked ${itemName(item)}`);
  const items = o.rewards.length && r() < 0.35 ? [pick(o.rewards, r)] : [];
  return {
    id: `j${o.seq}`, from: o.from, giver: o.giver, kind: o.kind, title: pick(TITLES[o.kind], r), brief,
    area: o.area, x: spotIn(o.area, r), target, body: female ? 'female' : 'male', seed: Math.floor(r() * 1e6),
    mates, cash: pay.cash, xp: pay.xp, items, heat: jobHeat(o.kind, fights), item, owed: pay.owed, cost: pay.cost,
    seconds: o.kind === 'deliver' || o.kind === 'deal' ? deliverySeconds(o.near, o.area) : undefined, fights,
  };
}

export function standingWith(p: Progress, c: ContactId): number {
  return p.save.jobs.standing[c] ?? 0;
}

/** Will they deal with you yet? */
export function contactOpen(p: Progress, c: ContactId): boolean {
  const d = CONTACTS[c];
  return !d.requires || p.has(d.requires);
}

/** A contact's board: drawn up again every BOARD_TRIPS trips (or when it's empty). */
export function boardOf(p: Progress, c: ContactId): Job[] {
  const s = p.save.jobs;
  const trip = s.boardTrip[c];
  const list = s.board[c];
  if (list && trip !== undefined && p.save.trips - trip < BOARD_TRIPS) return list;
  const d = CONTACTS[c];
  const rng = new Rng(Math.floor(hash01(`board:${c}:${p.save.trips}:${s.seq}`) * 2 ** 31) + 1);
  const r = () => rng.next();
  const areas = jobAreas(p, d.area);
  const pool = areas.length ? areas : [stripAreaOf(d.area)];
  const mult = tierOf(standingWith(p, c)).mult;
  const out: Job[] = [];
  for (let i = 0; i < BOARD_SIZE; i++) {
    const kind = d.kinds[(i + Math.floor(r() * d.kinds.length)) % d.kinds.length];
    // Not the street they're stood on if anywhere else will do.
    const away = pool.filter((a) => a !== stripAreaOf(d.area));
    const area = pick(away.length ? away : pool, r);
    out.push(makeJob(p, { from: c, giver: d.name, kind, area, near: d.area, mult, rng: r, seq: s.seq++, rewards: d.rewards }));
  }
  s.board[c] = out;
  s.boardTrip[c] = p.save.trips;
  return out;
}

/** Their next chain job, if your standing's high enough and the place is somewhere you've been. */
export function chainJob(p: Progress, c: ContactId): { job: Job | null; locked: string | null } {
  const s = p.save.jobs;
  const step = s.chain[c] ?? 0;
  const st = CHAINS[c][step];
  if (!st) return { job: null, locked: null };
  if (standingWith(p, c) < st.needs) return { job: null, locked: `${CONTACTS[c].name.split(' ')[0]} has bigger work for someone ${tierOf(st.needs).name.toLowerCase()} (standing ${st.needs}).` };
  if (!p.save.visited.includes(st.area)) return { job: null, locked: `Their next job is in ${LEVELS[st.area].name}: get there first.` };
  const pay = jobPay(st.kind, p.save.level, st.area, tierOf(standingWith(p, c)).mult * st.mult);
  const r = new Rng(Math.floor(hash01(`chain:${c}:${step}`) * 2 ** 31) + 1);
  const fights = st.fights ?? (st.kind === 'sort' || st.kind === 'recover');
  return {
    job: {
      id: `chain:${c}:${step}`, from: c, giver: CONTACTS[c].name, kind: st.kind, title: st.title, brief: st.brief, area: st.area,
      x: spotIn(st.area, () => r.next()), target: st.target, body: st.body ?? 'male', seed: Math.floor(r.next() * 1e6), mates: st.mates,
      cash: st.kind === 'deal' ? pay.cash : pay.cash, xp: Math.round(pay.xp * 1.5), items: [st.reward], heat: jobHeat(st.kind, fights), item: st.item,
      owed: pay.owed, cost: pay.cost, seconds: st.kind === 'deliver' || st.kind === 'deal' ? deliverySeconds(CONTACTS[c].area, st.area) + 60 : undefined,
      chain: step, fights,
    },
    locked: null,
  };
}

/** A passer-by's one-off job, the same for the same street and trip. */
export function streetJob(p: Progress, area: AreaId, giver: string): Job {
  const s = p.save.jobs;
  const rng = new Rng(Math.floor(hash01(`street:${area}:${p.save.trips}`) * 2 ** 31) + 1);
  const r = () => rng.next();
  const kind = pick<JobKind>(['sort', 'recover', 'deliver', 'debt'], r);
  const areas = jobAreas(p, area).filter((a) => a !== area);
  const to = areas.length ? pick(areas, r) : area;
  const job = makeJob(p, { from: 'street', giver, kind, area: to, near: area, mult: 1, rng: r, seq: s.seq, rewards: ['plasters', 'first_aid', 'meal_deal', 'can_of_pop', 'chain_cheap'] });
  job.id = `street:${area}:${p.save.trips}`;
  const ask: Record<JobKind, string> = {
    sort: `${job.target} and his mates have been making my life hell. They’re in ${LEVELS[to].name}. I’ll pay you to sort it.`,
    recover: `${job.target} took my ${itemName(job.item!)}. He’s in ${LEVELS[to].name}. Get it back and it’s worth your while.`,
    deliver: `Can you drop this off with ${job.target} in ${LEVELS[to].name}? They’ll pay you when you get there.`,
    debt: `${job.target} owes me ${'£'}${job.owed} and laughs about it. ${LEVELS[to].name}. Get it, keep a share.`,
    deal: job.brief,
  };
  job.brief = ask[kind];
  // Street jobs pay a bit less, and they're paid when it's done (there's no going back to find them).
  job.cash = round5(job.cash * 0.85);
  return job;
}

// ---- taking, finishing and failing -------------------------------------------------------------------------------

export type JobResult = { ok: true; text?: string } | { ok: false; reason: string };

export function acceptJob(p: Progress, job: Job): JobResult {
  const s = p.save.jobs;
  if (s.active) return { ok: false, reason: `You’re already on a job: ${s.active.title}. Finish it or drop it first.` };
  if (job.item && (job.kind === 'deliver' || job.kind === 'deal') && p.spaceFor(job.item) < 1) return { ok: false, reason: 'No room in your pockets for it. Make some space first.' };
  if (job.kind === 'deal') {
    if (!p.pay(job.cost ?? 0, 'cash')) return { ok: false, reason: `The package is £${job.cost}, cash. You haven’t got it on you.` };
  }
  if (job.item && (job.kind === 'deliver' || job.kind === 'deal')) p.giveItem(job.item, 1, job.kind === 'deal' ? { stolen: true } : {});
  s.active = { ...job, stage: 'go', deadline: job.seconds ? p.save.playTime + job.seconds : undefined };
  if (job.from !== 'street') {
    const list = s.board[job.from];
    if (list) s.board[job.from] = list.filter((j) => j.id !== job.id);
  }
  return { ok: true, text: objectiveOf(s.active) };
}

/** The job's line for the objective plate and the phone. */
export function objectiveOf(j: ActiveJob): string {
  const where = LEVELS[j.area]?.name ?? 'somewhere';
  const back = j.from === 'street' ? '' : CONTACTS[j.from].name.split(' ')[0];
  if (j.stage === 'back') {
    if (j.kind === 'debt') return `Take the £${j.owed} back to ${back}`;
    if (j.kind === 'recover') return `Take the ${itemName(j.item!)} back to ${back}`;
    return `Go back to ${back} for your money`;
  }
  switch (j.kind) {
    case 'sort':
      return `Find ${j.target} in ${where} and sort him out`;
    case 'debt':
      return `Collect £${j.owed} off ${j.target} in ${where}`;
    case 'deliver':
      return `Take the parcel to ${j.target} in ${where}`;
    case 'recover':
      return `Get the ${itemName(j.item!)} off ${j.target} in ${where}`;
    case 'deal':
      return `Sell the package to ${j.target} in ${where}`;
  }
}

function dropJobItems(p: Progress, keep?: string): void {
  const s = p.save;
  s.inventory = s.inventory.filter((x) => !ITEMS[x.id]?.jobItem || x.id === keep);
}

export interface JobPaid {
  title: string;
  giver: string;
  cash: number;
  xp: number;
  items: string[];
  /** Rewards with no room in your pockets (to leave at your feet). */
  over: { id: string; qty: number }[];
  standing: number;
  tier: string | null;
  levels: number;
  chain: boolean;
}

/** Done: paid, standing up, heat where it happened, the chain moves on. */
export function completeJob(p: Progress): JobPaid | null {
  const s = p.save.jobs;
  const j = s.active;
  if (!j) return null;
  s.active = null;
  dropJobItems(p);
  s.done++;
  p.addCash(j.cash);
  const levels = p.addXp(j.xp);
  const over: { id: string; qty: number }[] = [];
  for (const id of j.items) {
    const left = p.giveItem(id);
    if (left) over.push({ id: left.id, qty: left.qty });
  }
  const district = LEVELS[j.area]?.district;
  if (district && Object.values(j.heat).some((n) => (n ?? 0) > 0)) p.addHeatOf({ ...j.heat }, district);
  if (j.kind === 'deal') p.logCrime('dealing', district);
  let standing = 0;
  let tier: string | null = null;
  if (j.from !== 'street') {
    const before = tierOf(standingWith(p, j.from));
    standing = j.chain !== undefined ? STANDING_CHAIN : STANDING_JOB;
    s.standing[j.from] = Math.min(STANDING_MAX, standingWith(p, j.from) + standing);
    const after = tierOf(standingWith(p, j.from));
    if (after.index > before.index) tier = after.name;
    if (j.chain !== undefined && (s.chain[j.from] ?? 0) === j.chain) s.chain[j.from] = j.chain + 1;
  }
  return { title: j.title, giver: j.giver, cash: j.cash, xp: j.xp, items: j.items, over, standing, tier, levels, chain: j.chain !== undefined };
}

/** Given up or gone wrong: whatever you were carrying for them is gone, and so is some of their trust. */
export function failJob(p: Progress, why: 'dropped' | 'failed'): ActiveJob | null {
  const s = p.save.jobs;
  const j = s.active;
  if (!j) return null;
  s.active = null;
  dropJobItems(p);
  s.failed++;
  if (j.from !== 'street') s.standing[j.from] = Math.max(0, standingWith(p, j.from) - (why === 'dropped' ? STANDING_DROP : STANDING_FAIL));
  return j;
}

/** The target's end is done: deliveries, deals and street jobs pay now; the rest go back to the contact. */
export function jobStep(p: Progress): 'back' | 'done' | null {
  const j = p.save.jobs.active;
  if (!j || j.stage !== 'go') return null;
  if (j.kind === 'deliver' || j.kind === 'deal' || j.from === 'street') return 'done';
  j.stage = 'back';
  return 'back';
}

/**
 * Is the job still on? Out of time, or the parcel, package or goods you were carrying are gone (taken at the police
 * station, or you went down and they took it off you). Returns why it failed, or null. Also clears up any job
 * things left in your pockets from a job that's over.
 */
export function checkJob(p: Progress): string | null {
  const j = p.save.jobs.active;
  if (!j) {
    if (p.save.inventory.some((x) => ITEMS[x.id]?.jobItem)) dropJobItems(p);
    return null;
  }
  dropJobItems(p, j.item);
  if (j.deadline !== undefined && j.stage === 'go' && p.save.playTime > j.deadline) {
    failJob(p, 'failed');
    return j.kind === 'deal' ? `Too slow: ${j.target} found another seller. ${j.giver.split(' ')[0]} wants the package money back off you another time.` : `Too slow: ${j.target} gave up waiting. ${j.giver.split(' ')[0]} won’t be pleased.`;
  }
  const carrying = j.item && (j.kind === 'deliver' || j.kind === 'deal' || (j.kind === 'recover' && j.stage === 'back'));
  if (carrying && !p.save.inventory.some((x) => x.id === j.item)) {
    failJob(p, 'failed');
    return `You lost the ${itemName(j.item!)}. The job’s off.`;
  }
  // Got it back: on your way.
  if (j.kind === 'recover' && j.stage === 'go' && p.save.inventory.some((x) => x.id === j.item)) jobStep(p);
  return null;
}

/** Seconds left on the clock, or null. */
export function timeLeft(p: Progress): number | null {
  const j = p.save.jobs.active;
  if (!j || j.deadline === undefined || j.stage !== 'go') return null;
  return Math.max(0, Math.round(j.deadline - p.save.playTime));
}

export function areaName(area: AreaId): string {
  return LEVELS[area]?.name ?? area;
}
