import type { Progress, PurchaseResult } from '../progress/Progress';
import type { LevelDef, LightDef, PropDef, StationDef } from '../world/LevelTypes';
import { propHalf } from '../world/LevelTypes';
import {
  BUSINESS_UPGRADES,
  EQUIPMENT,
  IMPROVEMENT,
  MAX_UPGRADE,
  TIERS,
  UPGRADE_KEYS,
  equipmentResale,
  type EquipmentDef,
  type UpgradeKey,
} from './catalogue';

/**
 * The basement under 14 Tanner Road: its save data, the rules for placing
 * equipment, and the level built from the save. Production lives in production.ts.
 */

export interface PlacedEquipment {
  uid: string;
  id: string;
  /** Null = owned but not installed. */
  at: { x: number; z: number; rot: number } | null;
  /** Broken by an event: doesn't count until repaired. */
  faulty?: boolean;
}

export interface BusinessEvent {
  /** Play time it happened (seconds). */
  t: number;
  kind: 'power' | 'fault' | 'theft' | 'inspection' | 'storage_full' | 'unpaid';
  text: string;
}

export interface LedgerEntry {
  t: number;
  what: string;
  /** Negative = money out. */
  amount: number;
}

export interface BusinessState {
  /** Started (startup fee paid). */
  active: boolean;
  /** Switched off by the player. */
  paused: boolean;
  /** Play-time clock reading the business was last brought up to date at. */
  lastTick: number;
  /** Seconds into the current cycle. */
  cycle: number;
  cyclesDone: number;
  stock: number;
  /** Money from sales, held in the business until you take it. */
  balance: number;
  /** Running costs not yet paid. */
  owed: number;
  /** Fractional pounds of running cost not yet added to owed. */
  owedFrac: number;
  /** Shut down until this play time (power cut, inspection). */
  downUntil: number;
  unitsSold: number;
  totalEarned: number;
  totalCosts: number;
  events: BusinessEvent[];
}

export interface BasementSave {
  tier: number;
  improvements: string[];
  equipment: PlacedEquipment[];
  upgrades: Record<UpgradeKey, number>;
  business: BusinessState;
  ledger: LedgerEntry[];
  seq: number;
  /** Seed for event rolls (stops reload-rerolling). */
  seed: number;
}

export function defaultBasement(): BasementSave {
  return {
    tier: 0,
    improvements: [],
    equipment: [],
    upgrades: { capacity: 0, automation: 0, efficiency: 0, storage: 0, security: 0 },
    business: {
      active: false, paused: false, lastTick: 0, cycle: 0, cyclesDone: 0, stock: 0, balance: 0, owed: 0, owedFrac: 0, downUntil: 0,
      unitsSold: 0, totalEarned: 0, totalCosts: 0, events: [],
    },
    ledger: [],
    seq: 1,
    seed: Math.floor(Math.random() * 1e9),
  };
}

const num = (v: unknown, d: number, min = 0, max = 1e12) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : d);

/** Repair the basement part of a save; older saves get an untouched basement. */
export function sanitiseBasement(raw: unknown, playTime: number): BasementSave {
  const base = defaultBasement();
  if (!raw || typeof raw !== 'object') {
    base.business.lastTick = playTime;
    return base;
  }
  const r = raw as Partial<BasementSave>;
  const out: BasementSave = { ...base, equipment: [] };
  out.tier = Math.floor(num(r.tier, 0, 0, TIERS.length - 1));
  out.improvements = Array.isArray(r.improvements) ? [...new Set(r.improvements.filter((i): i is string => typeof i === 'string' && !!IMPROVEMENT[i] && IMPROVEMENT[i].needsTier <= out.tier))] : [];
  for (const k of UPGRADE_KEYS) out.upgrades[k] = Math.floor(num(r.upgrades?.[k], 0, 0, MAX_UPGRADE));
  const uids = new Set<string>();
  if (Array.isArray(r.equipment)) {
    for (const e of r.equipment.slice(0, 200)) {
      if (!e || !EQUIPMENT[e.id] || typeof e.uid !== 'string' || uids.has(e.uid)) continue;
      uids.add(e.uid);
      const piece: PlacedEquipment = { uid: e.uid, id: e.id, at: null, faulty: e.faulty === true || undefined };
      if (e.at && typeof e.at.x === 'number' && typeof e.at.z === 'number') {
        const at = { x: num(e.at.x, 0, -5, 40), z: num(e.at.z, 0, -3, 2), rot: Math.floor(num(e.at.rot, 0, 0, 3)) };
        // Doesn't fit any more? Back in storage, never lost.
        if (checkEquipmentPlacement(out, EQUIPMENT[e.id], at).ok) piece.at = at;
      }
      out.equipment.push(piece);
    }
  }
  const b = (r.business ?? {}) as Partial<BusinessState>;
  out.business = {
    active: b.active === true,
    paused: b.paused === true,
    // A clock from the future (edited save) is brought back to now: no free production.
    lastTick: Math.min(num(b.lastTick, playTime), playTime),
    cycle: num(b.cycle, 0, 0, 1e5),
    cyclesDone: Math.floor(num(b.cyclesDone, 0)),
    stock: Math.floor(num(b.stock, 0, 0, 1e6)),
    balance: Math.floor(num(b.balance, 0)),
    owed: Math.floor(num(b.owed, 0)),
    owedFrac: num(b.owedFrac, 0, 0, 1),
    downUntil: Math.min(num(b.downUntil, 0), playTime + 600),
    unitsSold: Math.floor(num(b.unitsSold, 0)),
    totalEarned: Math.floor(num(b.totalEarned, 0)),
    totalCosts: Math.floor(num(b.totalCosts, 0)),
    events: Array.isArray(b.events) ? b.events.filter((e) => e && typeof e.text === 'string').slice(-12) : [],
  };
  out.ledger = Array.isArray(r.ledger) ? r.ledger.filter((l) => l && typeof l.what === 'string' && typeof l.amount === 'number').slice(-40) : [];
  let seq = Math.floor(num(r.seq, 1, 1));
  for (const u of uids) {
    const n = Number(u.replace(/^[a-z]+/, ''));
    if (Number.isFinite(n) && n >= seq) seq = n + 1;
  }
  out.seq = seq;
  out.seed = Math.floor(num(r.seed, base.seed));
  return out;
}

// ---- layout --------------------------------------------------------------------------------------

export const BASEMENT_DEPTH = { minZ: -1.6, maxZ: 1.4 };
export const B_BACK_Z = -2.1;
export const B_LANE_Z = 0.55;
/** Nothing goes on the stairs. */
export const STAIRS_X = 1.9;

export const width = (b: BasementSave) => TIERS[b.tier].width;

/** Fixed fittings: the stairs, the terminal desk, structural pillars after knocking through. */
export function basementFixtures(b: BasementSave): PropDef[] {
  const f: PropDef[] = [
    { kind: 'basement_stairs', x: 0.75, z: -1.4, size: [0.75, 0.75] },
    { kind: 'terminal_desk', x: 3.0, z: -1.8, size: [0.7, 0.32] },
  ];
  if (b.tier >= 2) f.push({ kind: 'pillar', x: 14, z: -1.9 });
  if (b.tier >= 3) f.push({ kind: 'pillar', x: 22, z: -1.9 });
  if (b.tier === 0) {
    // Years of junk: has to go before the room's any use.
    f.push({ kind: 'junk', x: 8.6, z: -1.5, size: [0.9, 0.55], label: 'boxes' });
    f.push({ kind: 'junk', x: 10.8, z: -1.6, size: [0.8, 0.45], label: 'mattress' });
    f.push({ kind: 'junk', x: 12.7, z: -1.45, size: [0.6, 0.6], label: 'tins' });
  }
  return f;
}

type Box = { minX: number; maxX: number; minZ: number; maxZ: number };
const overlap = (a: Box, b: Box, gap = 0.02) => a.minX < b.maxX + gap && a.maxX > b.minX - gap && a.minZ < b.maxZ + gap && a.maxZ > b.minZ - gap;

export function equipmentFootprint(def: EquipmentDef, at: { x: number; z: number; rot: number }): Box {
  let [hx, hz] = def.size;
  if (def.mount !== 'wall' && at.rot % 2 === 1) [hx, hz] = [hz, hx];
  return { minX: at.x - hx, maxX: at.x + hx, minZ: at.z - hz, maxZ: at.z + hz };
}

export const equipmentWallZ = (def: EquipmentDef) => B_BACK_Z - 0.03 + def.size[1];

export type BasementCheck = { ok: true } | { ok: false; reason: string };

/** Can this piece of equipment go here? */
export function checkEquipmentPlacement(b: BasementSave, def: EquipmentDef, at: { x: number; z: number; rot: number }, ignoreUid?: string): BasementCheck {
  const box = equipmentFootprint(def, at);
  const W = width(b);
  if (box.minX < STAIRS_X) return { ok: false, reason: 'That’s the stairs' };
  if (box.maxX > W - 0.15) return { ok: false, reason: 'Hits the wall' };
  const others = b.equipment.filter((e) => e.uid !== ignoreUid && e.at && EQUIPMENT[e.id]);
  if (def.mount === 'wall') {
    if (Math.abs(at.x - 4.4) < 0.35 + def.size[0]) return { ok: false, reason: 'That’s the fuse box' };
    for (const o of others) {
      const od = EQUIPMENT[o.id];
      if (od.mount !== 'wall') continue;
      if (Math.abs(o.at!.x - at.x) < od.size[0] + def.size[0] + 0.05 && Math.abs((od.wallY ?? 1.6) - (def.wallY ?? 1.6)) < 0.5) return { ok: false, reason: `Overlaps the ${od.name.toLowerCase()}` };
    }
    return { ok: true };
  }
  if (box.minZ < B_BACK_Z - 0.001) return { ok: false, reason: 'Hits the wall' };
  if (box.maxZ > B_LANE_Z + 0.001) return { ok: false, reason: 'Blocks the walkway' };
  // The terminal must stay reachable.
  if (overlap(box, { minX: 2.55, maxX: 3.45, minZ: -1.45, maxZ: 1.4 })) return { ok: false, reason: 'Blocks the terminal' };
  for (const f of basementFixtures(b)) {
    const [hx, hz] = propHalf(f);
    if (overlap(box, { minX: f.x - hx, maxX: f.x + hx, minZ: f.z - hz, maxZ: f.z + hz })) return { ok: false, reason: f.kind === 'junk' ? 'Clear the junk first (renovate)' : 'Clips into the fittings' };
  }
  for (const o of others) {
    const od = EQUIPMENT[o.id];
    if (od.mount !== 'floor') continue;
    if (overlap(box, equipmentFootprint(od, o.at!))) return { ok: false, reason: `Overlaps the ${od.name.toLowerCase()}` };
  }
  return { ok: true };
}

/** First free spot along the back wall, then further forward. */
export function suggestEquipmentSpot(b: BasementSave, def: EquipmentDef, ignoreUid?: string): { x: number; z: number; rot: number } | null {
  for (const rot of def.mount === 'wall' ? [0] : [0, 1]) {
    let [hx, hz] = def.size;
    if (rot === 1) [hx, hz] = [hz, hx];
    const zs = def.mount === 'wall' ? [equipmentWallZ(def)] : [B_BACK_Z + hz, B_BACK_Z + hz + 0.5, B_LANE_Z - hz];
    for (const z of zs) for (let x = STAIRS_X + hx + 0.05; x <= width(b) - 0.15 - hx; x += 0.1) {
      const at = { x: Math.round(x * 10) / 10, z: Math.round(z * 100) / 100, rot };
      if (checkEquipmentPlacement(b, def, at, ignoreUid).ok) return at;
    }
  }
  return null;
}

// ---- the level -----------------------------------------------------------------------------------

export const BASEMENT_BASE: LevelDef = {
  id: 'basement',
  name: 'The Basement',
  district: '14 Tanner Road',
  theme: 'basement',
  bounds: { minX: 0, maxX: 14, ...BASEMENT_DEPTH },
  entries: [{ id: 'stairs', x: 2.0, z: 0.4, facing: 1 }],
  exits: [{ id: 'upstairs', kind: 'door', x: 0.9, z: -0.35, to: 'home', toEntry: 'basement', label: 'Back up the stairs' }],
  facades: [],
  props: [],
  pickups: [],
  encounters: [],
  weather: 'indoors',
  lights: [],
  objective: 'Your basement. The terminal by the stairs runs the business.',
};

/** Basement as it is for this save: size, finish, junk, fittings, your installed equipment. */
export function buildBasementLevel(b: BasementSave): LevelDef {
  const W = width(b);
  const has = (i: string) => b.improvements.includes(i);
  const props: PropDef[] = [...basementFixtures(b)];
  const storageCap = Math.max(1, b.equipment.reduce((n, e) => n + (e.at ? EQUIPMENT[e.id].storage ?? 0 : 0), 0));
  const fill = Math.min(1, b.business.stock / storageCap);
  for (const e of b.equipment) {
    if (!e.at) continue;
    const def = EQUIPMENT[e.id];
    props.push({
      kind: 'equipment', item: e.id, x: e.at.x, z: e.at.z, rot: e.at.rot, size: def.size, solid: def.mount === 'floor', wallY: def.mount === 'wall' ? def.wallY : undefined,
      label: `${e.faulty ? 'faulty' : 'ok'}|${def.storage ? fill.toFixed(2) : '0'}|${b.business.active && !b.business.paused ? 'on' : 'off'}`,
    });
  }
  const flags = [`tier${b.tier}`, ...b.improvements];
  const lights: LightDef[] = [];
  if (b.tier === 0 && !has('led_lighting')) {
    lights.push({ x: 4, y: 2.4, z: -0.4, colour: 0xffc880, intensity: 4, range: 8 });
    lights.push({ x: 10, y: 2.4, z: -0.4, colour: 0xffc880, intensity: 2.5, range: 6 });
  } else {
    const bright = has('led_lighting') ? 9 : 6;
    for (let x = 3; x < W; x += 6) lights.push({ x, y: 2.5, z: -0.3, colour: has('led_lighting') ? 0xf4f8ff : 0xfff0d8, intensity: bright, range: 8 });
  }
  const stations: StationDef[] = [{ id: 'terminal', x: 3.0, z: -1.1, label: 'Business terminal: manage the operation' }];
  return {
    ...BASEMENT_BASE,
    bounds: { minX: 0, maxX: W, ...BASEMENT_DEPTH },
    facades: [{ kind: 'basement', x0: 0, x1: W, label: TIERS[b.tier].name.toUpperCase(), flags }],
    props,
    stations,
    lights,
  };
}

// ---- buying and installing --------------------------------------------------------------------------

const B = (p: Progress) => p.save.basement;
const fail = (reason: string): PurchaseResult => ({ ok: false, reason });

export function logLedger(p: Progress, what: string, amount: number): void {
  const b = B(p);
  b.ledger.push({ t: Math.floor(p.save.playTime), what, amount: Math.round(amount) });
  if (b.ledger.length > 40) b.ledger.splice(0, b.ledger.length - 40);
}

export function buyEquipment(p: Progress, id: string, qty = 1): PurchaseResult {
  const def = EQUIPMENT[id];
  if (!def) return fail('Not stocked');
  const n = Math.max(1, Math.min(10, Math.floor(qty)));
  const total = def.price * n;
  if (B(p).equipment.length + n > 200) return fail('No more room in the basement');
  if (!p.pay(total)) return fail(`Not enough money: need £${total.toLocaleString('en-GB')}`);
  for (let i = 0; i < n; i++) B(p).equipment.push({ uid: `e${B(p).seq++}`, id, at: null });
  logLedger(p, `Bought ${n > 1 ? `${n} × ` : ''}${def.name}`, -total);
  return { ok: true };
}

export function installEquipment(p: Progress, uid: string, at: { x: number; z: number; rot: number }): PurchaseResult {
  const piece = B(p).equipment.find((e) => e.uid === uid);
  if (!piece) return fail('You don’t own that');
  const chk = checkEquipmentPlacement(B(p), EQUIPMENT[piece.id], at, uid);
  if (!chk.ok) return fail(chk.reason);
  piece.at = { x: Math.round(at.x * 100) / 100, z: Math.round(at.z * 100) / 100, rot: ((Math.floor(at.rot) % 4) + 4) % 4 };
  return { ok: true };
}

export function uninstallEquipment(p: Progress, uid: string): PurchaseResult {
  const piece = B(p).equipment.find((e) => e.uid === uid);
  if (!piece) return fail('You don’t own that');
  piece.at = null;
  return { ok: true };
}

export function sellEquipment(p: Progress, uid: string): { ok: true; refund: number } | { ok: false; reason: string } {
  const list = B(p).equipment;
  const i = list.findIndex((e) => e.uid === uid);
  if (i < 0) return { ok: false, reason: 'You don’t own that' };
  const def = EQUIPMENT[list[i].id];
  const refund = list[i].faulty ? Math.floor(equipmentResale(def.price) / 2) : equipmentResale(def.price);
  list.splice(i, 1);
  p.save.cash.pocket += refund;
  logLedger(p, `Sold ${def.name}`, refund);
  return { ok: true, refund };
}

export function repairCost(id: string): number {
  return Math.ceil(EQUIPMENT[id].price * 0.25);
}

export function repairEquipment(p: Progress, uid: string): PurchaseResult {
  const piece = B(p).equipment.find((e) => e.uid === uid);
  if (!piece || !piece.faulty) return fail('Nothing to fix');
  const cost = repairCost(piece.id);
  if (!p.pay(cost)) return fail(`Not enough money: need £${cost}`);
  piece.faulty = undefined;
  logLedger(p, `Repaired ${EQUIPMENT[piece.id].name}`, -cost);
  return { ok: true };
}

export function buyUpgrade(p: Progress, key: UpgradeKey): PurchaseResult {
  const b = B(p);
  const lvl = b.upgrades[key];
  if (lvl >= MAX_UPGRADE) return fail('Maxed out');
  const cost = BUSINESS_UPGRADES[key].cost[lvl];
  if (!p.pay(cost)) return fail(`Not enough money: need £${cost.toLocaleString('en-GB')}`);
  b.upgrades[key] = lvl + 1;
  logLedger(p, `${BUSINESS_UPGRADES[key].name} level ${lvl + 1}`, -cost);
  return { ok: true };
}

export function buyTier(p: Progress): PurchaseResult {
  const b = B(p);
  if (b.tier >= TIERS.length - 1) return fail('Fully done');
  const next = TIERS[b.tier + 1];
  if (!p.pay(next.price)) return fail(`Not enough money: need £${next.price.toLocaleString('en-GB')}`);
  b.tier++;
  logLedger(p, next.name, -next.price);
  return { ok: true };
}

export function buyImprovement(p: Progress, id: string): PurchaseResult {
  const b = B(p);
  const def = IMPROVEMENT[id];
  if (!def) return fail('Not available');
  if (b.improvements.includes(id)) return fail('Already done');
  if (b.tier < def.needsTier) return fail(`Needs the ${TIERS[def.needsTier].name.toLowerCase()} first`);
  if (!p.pay(def.price)) return fail(`Not enough money: need £${def.price.toLocaleString('en-GB')}`);
  b.improvements.push(id);
  logLedger(p, def.name, -def.price);
  return { ok: true };
}
