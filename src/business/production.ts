import type { Progress, PurchaseResult } from '../progress/Progress';
import {
  BASE_STORAGE,
  BASE_SUPPLY,
  DEFAULT_STRAIN,
  DRY_WEEKS,
  EQUIPMENT,
  HPS_CFM_PER_W,
  IMPROVEMENT,
  KW_PER_CFM,
  LIGHT_KINDS,
  STRAIN,
  TURNAROUND_WEEKS,
  WEEK,
  type LightKind,
  type StrainDef,
  type StrainId,
  LEVEL_UNITS,
  OWED_LIMIT,
  STARTUP_FEE,
  UNIT_VALUE,
} from './catalogue';
import { logLedger, type BasementSave, type BusinessEvent } from './basement';

/**
 * The business as numbers. Everything runs on the save's play-time clock
 * (seconds actually spent in the game world), so closing the game or
 * changing the computer's clock produces nothing, and loading a save twice
 * can't pay twice. Event rolls are seeded from the save, so reloading
 * doesn't re-roll them.
 */

export interface BusinessStats {
  /** Plants the tents hold. */
  capacity: number;
  /** Plants the lamps can light, for this strain. */
  light: number;
  /** Plants the extraction can air (all of them once the fans keep up). */
  air: number;
  /** Lamp watts, the air the tents need and the air the fans move (CFM). */
  watts: number;
  needCfm: number;
  cfm: number;
  /** Lamp heat and what extraction and air con take out, kW. */
  heat: number;
  cooling: number;
  /** Tents, and clip fans in them. */
  tents: number;
  clipFans: number;
  /** Plants actually growing. */
  effective: number;
  /** What's holding it back, if anything. */
  bottleneck: 'none' | 'capacity' | 'light' | 'air';
  efficiency: number;
  automation: number;
  cycleSeconds: number;
  unitsPerCycle: number;
  storage: number;
  security: number;
  power: number;
  supply: number;
  /** £ per in-game hour while running. */
  opPerHour: number;
  level: number;
  unitValue: number;
  /** Estimated profit per hour of play, £. */
  profitPerHour: number;
  /** Can it run at all? */
  ready: boolean;
  missing: string[];
  /** Things costing yield, in words ("no clip fan in 1 tent", "too hot"). */
  warnings: string[];
  strain: StrainDef;
  /** The crop's timetable, weeks. */
  weeks: { veg: number; flower: number; dry: number; turnaround: number };
}

export function businessLevel(unitsSold: number): number {
  let l = 1;
  for (let i = 0; i < LEVEL_UNITS.length; i++) if (unitsSold >= LEVEL_UNITS[i]) l = i + 1;
  return l;
}

export function strainOf(b: BasementSave): StrainDef {
  return STRAIN[b.business.strain] ?? STRAIN[DEFAULT_STRAIN];
}

export function businessStats(b: BasementSave): BusinessStats {
  const placed = b.equipment.filter((e) => e.at);
  const installed = placed.map((e) => EQUIPMENT[e.id]);
  const strain = strainOf(b);
  // Broken kit limps on at half its plants, watts, air and storage, and adds nothing else until repaired.
  const halfKeys = new Set(['plants', 'watts', 'cfm', 'storage', 'cool']);
  const sum = (k: 'plants' | 'needCfm' | 'watts' | 'cfm' | 'circ' | 'cool' | 'eff' | 'auto' | 'sec' | 'storage') =>
    placed.reduce((n, e) => {
      const v = EQUIPMENT[e.id][k] ?? 0;
      if (!e.faulty || k === 'needCfm') return n + v;
      return n + (halfKeys.has(k) ? Math.floor(v / 2) : 0);
    }, 0);
  const capacity = sum('plants');
  const tents = installed.filter((d) => d.plants).length;
  const clipFans = sum('circ');
  // Light: watts by lamp kind, each kind growing its own amount a watt; a strain grows better under the lamps it likes.
  const byKind: Record<LightKind, number> = { led: 0, cmh: 0, hps: 0 };
  for (const e of placed) {
    const d = EQUIPMENT[e.id];
    if (d.watts && d.lamp) byKind[d.lamp] += e.faulty ? Math.floor(d.watts / 2) : d.watts;
  }
  const watts = byKind.led + byKind.cmh + byKind.hps;
  const light = Math.floor(watts / strain.wpp + 1e-9);
  const kinds = Object.keys(byKind) as LightKind[];
  const lampQuality = watts ? kinds.reduce((n, k) => n + byKind[k] * LIGHT_KINDS[k].yield * (strain.likes.includes(k) ? 1.1 : 1), 0) / watts : 0;
  // Air: the tents need their air changed, more with hot HPS lamps; fans short of that air only some of the plants.
  const needCfm = Math.round(sum('needCfm') + byKind.hps * HPS_CFM_PER_W);
  const cfm = sum('cfm');
  const air = needCfm > 0 ? Math.floor(capacity * Math.min(1, cfm / needCfm) + 1e-9) : 0;
  const limit = Math.min(capacity, light, air);
  const bottleneck = capacity === 0 ? 'capacity' : limit === capacity ? 'none' : light <= air ? 'light' : 'air';
  // Heat: lamp heat out through the extraction and any air con; too hot and the crop suffers.
  const heat = Math.round(kinds.reduce((n, k) => n + byKind[k] * LIGHT_KINDS[k].heat, 0) / 10) / 100;
  const cooling = Math.round((cfm * KW_PER_CFM + sum('cool')) * 100) / 100;
  const heatFactor = heat > cooling ? Math.max(0.6, cooling / heat) : 1;
  const circFactor = tents > clipFans ? 1 - (0.1 * (tents - clipFans)) / tents : 1;
  const warnings: string[] = [];
  if (tents > clipFans) warnings.push(`no clip fan in ${tents - clipFans} tent${tents - clipFans > 1 ? 's' : ''}: bud rot (−${Math.round((1 - circFactor) * 100)}%)`);
  if (heatFactor < 1) warnings.push(`too hot: ${heat} kW of lamp heat, ${cooling} kW taken out (−${Math.round((1 - heatFactor) * 100)}%)`);
  if (byKind.hps && !strain.likes.includes('hps') && strain.type === 'Autoflower') warnings.push('autos stress under hot HPS');
  const effective = limit;
  const impEff = b.improvements.reduce((n, i) => n + (IMPROVEMENT[i]?.eff ?? 0), 0);
  const level = businessLevel(b.business.unitsSold);
  const efficiency = Math.round((1 + Math.min(0.4, sum('eff')) + 0.08 * b.upgrades.efficiency + 0.1 * b.upgrades.capacity + impEff) * lampQuality * heatFactor * circFactor * 1000) / 1000;
  const automation = Math.min(4, sum('auto') + b.upgrades.automation);
  // The timetable: veg (autos have none), flower, dry and cure, then clean down and replant; timers and drippers cut the turnaround.
  const weeks = { veg: strain.veg, flower: strain.flower, dry: DRY_WEEKS, turnaround: Math.max(0, TURNAROUND_WEEKS - 0.5 * automation) };
  const cycleSeconds = Math.round((weeks.veg + weeks.flower + weeks.dry + weeks.turnaround) * WEEK);
  const unitsPerCycle = Math.floor(effective * strain.yield * efficiency + 1e-9);
  const storage = BASE_STORAGE + sum('storage') + 25 * b.upgrades.storage;
  const security = Math.min(100, sum('sec') + 10 * b.upgrades.security + b.improvements.reduce((n, i) => n + (IMPROVEMENT[i]?.sec ?? 0), 0));
  const power = Math.round(installed.reduce((n, d) => n + d.power, 0) * 100) / 100;
  const supply = Math.max(BASE_SUPPLY, ...b.improvements.map((i) => IMPROVEMENT[i]?.supply ?? 0));
  const opPerHour = installed.reduce((n, d) => n + d.op, 0) + 5;
  const unitValue = Math.round(UNIT_VALUE * strain.value * (1 + 0.04 * (level - 1)) * 100) / 100;
  const missing: string[] = [];
  if (capacity === 0) missing.push('a grow tent');
  if (light === 0) missing.push(watts ? `more light (${strain.name} needs ${strain.wpp} W a plant)` : 'a grow light');
  if (air === 0) missing.push(cfm ? `a bigger extractor (${cfm} of ${needCfm} CFM)` : 'an extractor fan and carbon filter');
  if (power > supply) missing.push(`more power (${power} of ${supply} kW): electrical upgrade or less kit`);
  const ready = missing.length === 0 && unitsPerCycle > 0;
  const profitPerHour = ready ? Math.round((3600 / cycleSeconds) * unitsPerCycle * unitValue - opPerHour) : 0;
  return { capacity, light, air, watts, needCfm, cfm, heat, cooling, tents, clipFans, effective, bottleneck, efficiency, automation, cycleSeconds, unitsPerCycle, storage, security, power, supply, opPerHour, level, unitValue, profitPerHour, ready, missing, warnings, strain, weeks };
}

export type BusinessStatus = 'not_started' | 'not_ready' | 'running' | 'paused' | 'down' | 'unpaid' | 'full';

export function businessStatus(b: BasementSave, now: number, st = businessStats(b)): BusinessStatus {
  const bs = b.business;
  if (!bs.active) return 'not_started';
  if (!st.ready) return 'not_ready';
  if (bs.paused) return 'paused';
  if (now < bs.downUntil) return 'down';
  if (bs.owed > OWED_LIMIT) return 'unpaid';
  if (bs.stock >= st.storage) return 'full';
  return 'running';
}

export const STATUS_TEXT: Record<BusinessStatus, string> = {
  not_started: 'Not started',
  not_ready: 'Not ready: equipment missing',
  running: 'Running',
  paused: 'Paused',
  down: 'Down (temporary)',
  unpaid: 'Cut off: bills unpaid',
  full: 'Storage full: sell stock',
};

/** Deterministic roll in [0, 1) for a given cycle. */
function roll(seed: number, n: number, salt: number): number {
  let h = (seed ^ Math.imul(n + 1, 0x9e3779b1) ^ Math.imul(salt + 7, 0x85ebca6b)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Chance of trouble at the end of a cycle, given security (0..100) and your wanted level. */
export function eventChance(security: number, heat: number): number {
  return Math.max(0.01, 0.1 * (1 - security / 125) * (1 + heat / 150));
}

/** Longest gap the clock will ever catch up in one go (safeguard). */
export const MAX_CATCHUP = 900;

/**
 * Bring the business up to `now` (play-time seconds). Returns what happened
 * so the game can tell you. Safe to call as often as you like.
 */
export function tickBusiness(b: BasementSave, now: number, heat = 0): BusinessEvent[] {
  const bs = b.business;
  const happened: BusinessEvent[] = [];
  let dt = Math.max(0, Math.min(MAX_CATCHUP, now - bs.lastTick));
  bs.lastTick = Math.max(bs.lastTick, now);
  let t = now - dt;
  const log = (e: BusinessEvent) => {
    happened.push(e);
    bs.events.push(e);
    if (bs.events.length > 12) bs.events.splice(0, bs.events.length - 12);
  };
  while (dt > 0) {
    const st = businessStats(b);
    const status = businessStatus(b, t, st);
    if (status === 'down') {
      const wait = Math.min(dt, bs.downUntil - t);
      dt -= wait;
      t += wait;
      continue;
    }
    if (status !== 'running') {
      if (status === 'full' && !bs.events.some((e) => e.kind === 'storage_full' && e.t >= t - 600)) log({ t: Math.floor(t), kind: 'storage_full', text: 'Storage is full. Production has stopped until you sell stock.' });
      if (status === 'unpaid' && !bs.events.some((e) => e.kind === 'unpaid' && e.t >= t - 600)) log({ t: Math.floor(t), kind: 'unpaid', text: `Bills of £${bs.owed} unpaid. The power's off until you pay.` });
      break;
    }
    const step = Math.min(dt, st.cycleSeconds - bs.cycle);
    // Running costs accrue every second it's on, paid from the business's own money when it has any.
    bs.owedFrac += (st.opPerHour * step) / 3600;
    const whole = Math.floor(bs.owedFrac);
    if (whole > 0) {
      bs.owedFrac -= whole;
      bs.owed += whole;
      bs.totalCosts += whole;
    }
    if (bs.owed > 0 && bs.balance > 0) {
      const paid = Math.min(bs.owed, bs.balance);
      bs.owed -= paid;
      bs.balance -= paid;
    }
    bs.cycle += step;
    dt -= step;
    t += step;
    if (bs.cycle >= st.cycleSeconds - 1e-6) {
      bs.cycle = 0;
      const n = bs.cyclesDone++;
      bs.stock = Math.min(st.storage, bs.stock + st.unitsPerCycle);
      if (roll(b.seed, n, 1) < eventChance(st.security, heat) * (st.strain.id === 'skunk' ? 1.25 : 1)) {
        const kind = roll(b.seed, n, 2);
        if (kind < 0.35) {
          bs.downUntil = t + 120;
          bs.owed += 40;
          bs.totalCosts += 40;
          log({ t: Math.floor(t), kind: 'power', text: 'Power trip. Down for a couple of minutes, £40 call-out.' });
        } else if (kind < 0.6) {
          const kit = b.equipment.filter((e) => e.at && !e.faulty && EQUIPMENT[e.id].power > 0);
          if (kit.length) {
            const broken = kit[Math.floor(roll(b.seed, n, 3) * kit.length)];
            broken.faulty = true;
            log({ t: Math.floor(t), kind: 'fault', text: `${EQUIPMENT[broken.id].name} is playing up (half power). Repair it at the terminal.` });
          }
        } else if (kind < 0.85) {
          const locked = b.equipment.some((e) => e.at && EQUIPMENT[e.id].lockable);
          const share = locked ? 0.15 : 0.4;
          const lost = Math.floor(bs.stock * share);
          bs.stock -= lost;
          log({ t: Math.floor(t), kind: 'theft', text: `Someone got in and took ${lost} units${locked ? ' (the locked storage saved the rest)' : ''}.` });
        } else {
          bs.downUntil = t + 300;
          log({ t: Math.floor(t), kind: 'inspection', text: 'Neighbours asking questions. Lying low for five minutes.' });
        }
      }
    }
  }
  return happened;
}

/** Start the business: needs the kit installed and the startup fee. */
export function startBusiness(p: Progress): PurchaseResult {
  const b = p.save.basement;
  if (b.business.active) return { ok: false, reason: 'Already running' };
  const st = businessStats(b);
  if (!st.ready) return { ok: false, reason: `Needs ${st.missing.join(', ')}` };
  if (!p.pay(STARTUP_FEE)) return { ok: false, reason: `Not enough money: need £${STARTUP_FEE}` };
  b.business.active = true;
  b.business.paused = false;
  b.business.lastTick = p.save.playTime;
  b.business.cycle = 0;
  logLedger(p, 'Startup supplies', -STARTUP_FEE);
  return { ok: true };
}

/** Where the crop is in its timetable: the stage, and the week of it. */
export function growStage(b: BasementSave, st = businessStats(b)): { stage: string; week: number; of: number } {
  const wk = b.business.cycle / WEEK;
  const w = st.weeks;
  const at = (start: number, len: number, stage: string) => ({ stage, week: Math.min(len, Math.floor(wk - start) + 1), of: Math.max(1, Math.ceil(len)) });
  if (w.veg && wk < w.veg) return at(0, w.veg, wk < 1 ? 'Seedlings (18/6 light)' : 'Veg (18/6 light)');
  if (wk < w.veg + w.flower) return at(w.veg, w.flower, st.strain.type === 'Autoflower' ? 'Growing and flowering (18/6)' : 'Flowering (12/12 light)');
  if (wk < w.veg + w.flower + w.dry) return at(w.veg + w.flower, w.dry, 'Drying and curing');
  return at(w.veg + w.flower + w.dry, w.turnaround, 'Cleaning down and replanting');
}

/** Plant a different strain. Pulls whatever's growing (the crop is lost) and starts again from seed. */
export function setStrain(p: Progress, id: StrainId): { ok: true } | { ok: false; reason: string } {
  const b = p.save.basement;
  const s = STRAIN[id];
  if (!s) return { ok: false, reason: 'No such seeds' };
  if (businessLevel(b.business.unitsSold) < s.level) return { ok: false, reason: `Seeds unlock at business level ${s.level}` };
  if (b.business.strain === id) return { ok: false, reason: 'Already growing' };
  b.business.strain = id;
  b.business.cycle = 0;
  return { ok: true };
}

export function setPaused(p: Progress, paused: boolean): void {
  const b = p.save.basement;
  tickBusiness(b, p.save.playTime, p.wanted);
  b.business.paused = paused;
}

/** Sell all stock: the money goes into the business balance (bills come out first). */
export function sellStock(p: Progress): { ok: true; units: number; value: number } | { ok: false; reason: string } {
  const b = p.save.basement;
  tickBusiness(b, p.save.playTime, p.wanted);
  const units = b.business.stock;
  if (units <= 0) return { ok: false, reason: 'No stock to sell' };
  const value = Math.floor(units * businessStats(b).unitValue);
  b.business.stock = 0;
  b.business.unitsSold += units;
  b.business.totalEarned += value;
  b.business.balance += value;
  const paid = Math.min(b.business.owed, b.business.balance);
  b.business.owed -= paid;
  b.business.balance -= paid;
  logLedger(p, `Sold ${units} units`, value);
  return { ok: true, units, value };
}

/** Take the business's money: cash into your pocket, or paid into your account (the tin with no account). */
export function withdraw(p: Progress, to: 'pocket' | 'bank'): { ok: true; amount: number } | { ok: false; reason: string } {
  const b = p.save.basement;
  tickBusiness(b, p.save.playTime, p.wanted);
  const amount = b.business.balance;
  if (amount <= 0) return { ok: false, reason: 'Nothing to take' };
  b.business.balance = 0;
  if (to === 'bank') p.credit(amount);
  else p.save.cash.pocket += amount;
  logLedger(p, `Took earnings (${to === 'pocket' ? 'cash' : p.save.bank ? 'paid into your account' : 'tin'})`, amount);
  return { ok: true, amount };
}

/** Settle unpaid bills from your own money. */
export function payBills(p: Progress): PurchaseResult {
  const b = p.save.basement;
  const owed = b.business.owed;
  if (owed <= 0) return { ok: false, reason: 'Nothing owed' };
  if (!p.pay(owed)) return { ok: false, reason: `Not enough money: need £${owed}` };
  b.business.owed = 0;
  logLedger(p, 'Paid the bills', -owed);
  return { ok: true };
}
