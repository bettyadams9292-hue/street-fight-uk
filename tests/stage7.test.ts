/**
 * Stage 7 tests: the basement, the grow shop, equipment placement, the
 * abstract business (production, costs, events, collection), upgrades and
 * basement works, saving/loading, and that nothing else broke.
 */
import { defaultAppearance } from '../src/character/Appearance';
import { createCharacter, emptyAllocation } from '../src/character/Character';
import { AREA_IDS, newSave, Progress, sanitiseSave } from '../src/progress/Progress';
import { BUSINESS_UPGRADES, EQUIPMENT, EQUIPMENT_LIST, IMPROVEMENTS, STARTUP_FEE, TIERS, equipmentResale } from '../src/business/catalogue';
import {
  B_LANE_Z,
  buildBasementLevel,
  buyEquipment,
  buyImprovement,
  buyTier,
  buyUpgrade,
  checkEquipmentPlacement,
  installEquipment,
  repairEquipment,
  sellEquipment,
  suggestEquipmentSpot,
  uninstallEquipment,
} from '../src/business/basement';
import { MAX_CATCHUP, businessStats, businessStatus, eventChance, payBills, sellStock, setPaused, startBusiness, tickBusiness, withdraw } from '../src/business/production';
import { resolveLevel } from '../src/property/levels';
import { LEVELS } from '../src/world/levels';
import { exitLocked, World } from '../src/world/World';
import { SHOP_STOPS } from '../src/ui/hub';

let passed = 0;
let failed = 0;
function test(name: string, fn: () => void): void {
  try {
    fn();
    passed++;
    console.log(`  ok   ${name}`);
  } catch (e) {
    failed++;
    console.log(`  FAIL ${name}\n       ${(e as Error).message}`);
  }
}
function assert(cond: unknown, msg: string): void {
  if (!cond) throw new Error(msg);
}
function fresh(cash = 200000): Progress {
  const c = createCharacter({ name: 'Tester', appearance: defaultAppearance(), background: 'estate_scrapper', allocated: emptyAllocation() });
  const p = new Progress(newSave(c));
  p.save.cash.bank = cash;
  p.save.cash.pocket = 0;
  p.save.basement.seed = 12345;
  return p;
}
const wallet = (p: Progress) => p.save.cash.pocket + p.save.cash.bank;
const roundtrip = (p: Progress) => new Progress(sanitiseSave(JSON.parse(JSON.stringify(p.save)))!);
/** Buy and install one of each id at the first free spot. */
function kit(p: Progress, ...ids: string[]): void {
  for (const id of ids) {
    assert(buyEquipment(p, id).ok, `buy ${id}`);
    const piece = p.save.basement.equipment.at(-1)!;
    const spot = suggestEquipmentSpot(p.save.basement, EQUIPMENT[id], piece.uid);
    assert(spot, `room for ${id}`);
    assert(installEquipment(p, piece.uid, spot!).ok, `install ${id}`);
  }
}
/** Play for `s` seconds (in the ticks the game uses). */
function play(p: Progress, s: number): void {
  for (let i = 0; i < s; i++) {
    p.save.playTime += 1;
    tickBusiness(p.save.basement, p.save.playTime, p.save.heat);
  }
}

console.log('\nStage 7: basement and grow shop');

test('house has a basement door; the basement has stairs back up, a terminal, walls and lights', () => {
  const p = fresh();
  const home = resolveLevel('home', p.save);
  const door = home.exits.find((e) => e.to === 'basement');
  assert(door && home.entries.some((e) => e.id === 'basement'), 'door down and somewhere to arrive back');
  const base = resolveLevel('basement', p.save);
  assert(base.entries.some((e) => e.id === door!.toEntry), 'arrive at the foot of the stairs');
  assert(base.exits.some((e) => e.to === 'home' && e.toEntry === 'basement'), 'stairs back up');
  assert(base.stations!.some((s) => s.id === 'terminal'), 'terminal');
  assert(base.facades[0].kind === 'basement' && base.lights!.length > 0, 'walls and lights');
  assert(base.props.some((x) => x.kind === 'junk'), 'starts full of junk');
  const w = new World(base, p, { entry: 'stairs', seed: 1 });
  assert(!w.arena.blocked(5, 1.0, 0.3), 'can walk about');
  for (const s of base.stations!) assert(!w.arena.blocked(s.x, s.z, 0.05), `${s.id} reachable`);
  const hw = new World(home, p, { entry: 'start', seed: 1 });
  assert(!hw.arena.blocked(door!.x, door!.z + 0.6, 0.2), 'cellar door reachable at home');
});

test('grow shop: a real shop on the trading estate with a door, staff, product displays and a cab stop', () => {
  const shop = LEVELS.grow_shop;
  const street = LEVELS.ind_estate;
  const door = street.exits.find((e) => e.to === 'grow_shop');
  assert(door && street.facades.some((f) => f.kind === 'showroom' && door.x >= f.x0 && door.x <= f.x1), 'shopfront with a door');
  assert(shop.exits.some((e) => e.to === 'ind_estate' && street.entries.some((x) => x.id === e.toEntry)), 'way back out');
  assert(shop.stations!.some((s) => s.id === 'grow_counter' && s.npc), 'cashier');
  assert(shop.stations!.filter((s) => s.id === 'grow_display').map((s) => s.tab).join() === 'room,environment,room,environment,security', 'product displays open their own section');
  assert(SHOP_STOPS.some((s) => s.area === 'grow_shop'), 'Dave’s Cabs goes there');
  const p = fresh();
  const w = new World(resolveLevel('grow_shop', p.save), p, { entry: 'door', seed: 2 });
  for (const s of shop.stations!) assert(!w.arena.blocked(s.x, s.z, 0.05), `${s.label} reachable`);
  assert(!exitLocked(shop.exits[0], p), 'can leave');
});

test('catalogue: every product has a name, price, description, category and tier; all four categories stocked', () => {
  for (const e of EQUIPMENT_LIST) assert(e.name && e.price > 0 && e.blurb && e.cat && e.tier >= 1 && e.tier <= 3, e.id);
  for (const c of ['room', 'environment', 'security']) assert(EQUIPMENT_LIST.some((e) => e.cat === c), c);
  assert(Object.keys(BUSINESS_UPGRADES).length === 5, 'five business upgrades');
});

test('buying takes the right money; not enough money takes nothing; buy several; sell from storage for half', () => {
  const p = fresh(1000);
  assert(buyEquipment(p, 'tent_s', 2).ok && wallet(p) === 1000 - 700, 'two tents');
  assert(p.save.basement.equipment.length === 2 && p.save.basement.equipment.every((e) => e.at === null), 'in storage');
  const r = buyEquipment(p, 'module');
  assert(!r.ok && r.reason.includes('Not enough') && wallet(p) === 300 && p.save.basement.equipment.length === 2, 'refused, nothing taken');
  const s = sellEquipment(p, p.save.basement.equipment[0].uid);
  assert(s.ok && s.refund === equipmentResale(350) && p.save.cash.pocket === 175, 'sold for half');
});

test('placement: install, rotate, move, store; no overlaps, walls, stairs, terminal, walkway or junk', () => {
  const p = fresh();
  const b = p.save.basement;
  buyEquipment(p, 'tent_d');
  const tent = b.equipment[0];
  const def = EQUIPMENT.tent_d;
  assert(!checkEquipmentPlacement(b, def, { x: 1.0, z: -1.5, rot: 0 }).ok, 'not on the stairs');
  assert(!checkEquipmentPlacement(b, def, { x: 3.0, z: -1.5, rot: 0 }).ok, 'not over the terminal');
  assert(!checkEquipmentPlacement(b, def, { x: 6, z: B_LANE_Z, rot: 0 }).ok, 'not in the walkway');
  assert(!checkEquipmentPlacement(b, def, { x: 13.5, z: -1.5, rot: 0 }).ok, 'not through the end wall');
  assert(!checkEquipmentPlacement(b, def, { x: 8.6, z: -1.5, rot: 0 }).ok, 'not on the junk');
  assert(installEquipment(p, tent.uid, { x: 5.5, z: -1.55, rot: 0 }).ok, 'installed');
  buyEquipment(p, 'tent_s');
  const t2 = b.equipment[1];
  assert(!installEquipment(p, t2.uid, { x: 5.5, z: -1.55, rot: 0 }).ok, 'cannot overlap');
  assert(installEquipment(p, tent.uid, { x: 5.0, z: -1.1, rot: 1 }).ok && tent.at!.rot === 1, 'moved and rotated');
  assert(uninstallEquipment(p, tent.uid).ok && tent.at === null, 'stored');
  const lvl = buildBasementLevel(b);
  assert(!lvl.props.some((x) => x.kind === 'equipment'), 'stored kit is not in the room');
  installEquipment(p, tent.uid, { x: 5.5, z: -1.55, rot: 0 });
  const w = new World(buildBasementLevel(b), p, { entry: 'stairs', seed: 3 });
  assert(w.arena.blocked(5.5, -1.55, 0.1), 'installed kit has collision');
});

test('business: needs a grow unit, light and air; startup fee; runs on play time; capacity limited by light and air', () => {
  const p = fresh();
  kit(p, 'tent_s');
  assert(!startBusiness(p).ok, 'cannot start with just a tent');
  kit(p, 'led_rig', 'fan');
  const st = businessStats(p.save.basement);
  assert(st.ready && st.effective === 4 && st.unitsPerCycle === 4, `starter makes 4 a cycle (${st.unitsPerCycle})`);
  const before = wallet(p);
  assert(startBusiness(p).ok && wallet(p) === before - STARTUP_FEE, 'started, fee taken');
  assert(businessStatus(p.save.basement, p.save.playTime) === 'running', 'running');
  play(p, st.cycleSeconds - 1);
  assert(p.save.basement.business.stock === 0, 'nothing until the cycle completes');
  play(p, 1);
  assert(p.save.basement.business.stock === 4, `one cycle, 4 units (${p.save.basement.business.stock})`);
  // Add a second tent without more light: light is the bottleneck.
  kit(p, 'tent_s');
  assert(businessStats(p.save.basement).bottleneck === 'light' && businessStats(p.save.basement).effective === 6, 'held back by light');
});

test('leaving and coming back: only time actually played counts; the clock can’t be gamed', () => {
  const p = fresh();
  kit(p, 'tent_s', 'led_rig', 'fan');
  startBusiness(p);
  const b = p.save.basement;
  // Time away from the game (no play time) produces nothing.
  tickBusiness(b, p.save.playTime, 0);
  assert(b.business.stock === 0, 'no play, no stock');
  // A huge jump is capped.
  const t0 = p.save.playTime;
  p.save.playTime += 100000;
  tickBusiness(b, p.save.playTime, 0);
  const cycles = b.business.cyclesDone;
  assert(cycles <= Math.ceil(MAX_CATCHUP / businessStats(b).cycleSeconds), `catch-up capped (${cycles} cycles)`);
  // Ticking again at the same time does nothing more.
  const stock = b.business.stock;
  tickBusiness(b, p.save.playTime, 0);
  tickBusiness(b, p.save.playTime - 50, 0);
  assert(b.business.stock === stock && b.business.lastTick === p.save.playTime && t0 < p.save.playTime, 'no double counting, no going back');
});

test('storage caps stock; selling, bills and collecting into pocket or tin', () => {
  const p = fresh();
  kit(p, 'tent_s', 'led_rig', 'fan');
  startBusiness(p);
  const b = p.save.basement;
  const st = businessStats(b);
  for (let i = 0; i < 60 && businessStatus(b, p.save.playTime) !== 'full'; i++) {
    play(p, st.cycleSeconds);
    if (b.business.owed > 200) payBills(p);
    for (const e of b.equipment) if (e.faulty) repairEquipment(p, e.uid);
  }
  assert(b.business.stock === st.storage, `stops at storage (${b.business.stock}/${st.storage})`);
  assert(businessStatus(b, p.save.playTime) === 'full', 'full status');
  assert(b.business.owed > 0 || b.business.totalCosts > 0, 'bills built up');
  const r = sellStock(p);
  assert(r.ok && r.units === st.storage && r.value === Math.floor(st.storage * st.unitValue), 'sold at unit value');
  assert(b.business.owed === 0 && b.business.balance <= r.value, 'bills paid out of the takings');
  const bal = b.business.balance;
  const pocket = p.save.cash.pocket;
  assert(withdraw(p, 'pocket').ok && p.save.cash.pocket === pocket + bal && b.business.balance === 0, 'into the pocket');
  assert(!withdraw(p, 'bank').ok, 'nothing left to take');
});

test('unpaid bills cut the power until paid; switching off stops production', () => {
  const p = fresh();
  kit(p, 'tent_s', 'led_rig', 'fan');
  startBusiness(p);
  const b = p.save.basement;
  b.business.owed = 400;
  play(p, 600);
  assert(businessStatus(b, p.save.playTime) === 'unpaid' && b.business.stock === 0, 'cut off');
  assert(payBills(p).ok && b.business.owed === 0, 'paid');
  setPaused(p, true);
  play(p, 2000);
  assert(b.business.stock === 0 && businessStatus(b, p.save.playTime) === 'paused', 'switched off');
  setPaused(p, false);
  play(p, businessStats(b).cycleSeconds);
  assert(b.business.stock > 0, 'back on');
});

test('power supply limits kit until the electrics are upgraded', () => {
  const p = fresh();
  kit(p, 'tent_s', 'led_rig', 'fan', 'cooler', 'cooler', 'cooler', 'cooler');
  const st = businessStats(p.save.basement);
  assert(!st.ready && st.missing.some((m) => m.includes('power')), `over the supply (${st.power}/${st.supply})`);
  buyTier(p);
  assert(buyImprovement(p, 'electrics').ok && businessStats(p.save.basement).ready, 'rewired: runs');
});

test('risk: events happen, security lowers the chance, they are seeded (no reroll on reload) and never ruin you', () => {
  assert(eventChance(100, 0) < eventChance(0, 0) && eventChance(0, 100) > eventChance(0, 0), 'security helps, heat hurts');
  const runA = fresh();
  kit(runA, 'tent_s', 'led_rig', 'fan');
  startBusiness(runA);
  const runB = roundtrip(runA);
  for (const p of [runA, runB]) for (let i = 0; i < 40; i++) {
    play(p, businessStats(p.save.basement).cycleSeconds + 300);
    sellStock(p);
    for (const e of p.save.basement.equipment) if (e.faulty) repairEquipment(p, e.uid);
    if (p.save.basement.business.owed > 0) payBills(p);
  }
  const a = runA.save.basement.business;
  const b = runB.save.basement.business;
  assert(a.events.length > 0, 'something happened in 40 cycles');
  assert(JSON.stringify(a.events) === JSON.stringify(b.events) && a.unitsSold === b.unitsSold, 'same save, same events');
  assert(a.unitsSold > 0 && a.totalEarned > a.totalCosts, 'still profitable');
});

test('upgrades and basement works cost the right amounts and change the numbers and the room', () => {
  const p = fresh(100000);
  kit(p, 'tent_s', 'led_rig', 'fan');
  const st0 = businessStats(p.save.basement);
  let w = wallet(p);
  assert(buyUpgrade(p, 'automation').ok && wallet(p) === w - BUSINESS_UPGRADES.automation.cost[0], 'automation charged');
  assert(businessStats(p.save.basement).cycleSeconds < st0.cycleSeconds, 'faster cycles');
  w = wallet(p);
  assert(buyUpgrade(p, 'storage').ok && businessStats(p.save.basement).storage === st0.storage + 25 && wallet(p) === w - BUSINESS_UPGRADES.storage.cost[0], 'storage');
  assert(!buyImprovement(p, 'tiled_walls').ok, 'needs the right tier');
  w = wallet(p);
  assert(buyTier(p).ok && wallet(p) === w - TIERS[1].price, 'renovated');
  assert(!buildBasementLevel(p.save.basement).props.some((x) => x.kind === 'junk'), 'junk cleared');
  buyTier(p);
  assert(buildBasementLevel(p.save.basement).bounds.maxX === TIERS[2].width, 'expanded');
  for (const imp of IMPROVEMENTS.filter((i) => i.needsTier <= 2)) assert(buyImprovement(p, imp.id).ok, imp.id);
  assert(buildBasementLevel(p.save.basement).facades[0].flags!.includes('tiled_walls'), 'the walls show it');
  assert(!buyImprovement(p, 'tiled_walls').ok, 'not twice');
});

test('balance: starter pays back in a few hours of play; professional earns well but is capped by storage', () => {
  const p = fresh(1e6);
  kit(p, 'tent_s', 'led_rig', 'fan');
  const starter = businessStats(p.save.basement);
  const starterCost = 350 + 250 + 200 + STARTUP_FEE;
  assert(starter.profitPerHour > 150 && starter.profitPerHour < 600, `starter £${starter.profitPerHour}/hr`);
  console.log(`       (starter £${starter.profitPerHour}/hr)`);
  assert(starterCost / starter.profitPerHour < 4, 'pays back within 4 hours');
  const q = fresh(1e6);
  buyTier(q); buyTier(q); buyTier(q);
  buyImprovement(q, 'electrics'); buyImprovement(q, 'three_phase');
  kit(q, 'module', 'module', 'light_bars', 'light_bars', 'air_system', 'air_system', 'climate', 'control', 'pallet_rack');
  for (const k of ['capacity', 'automation', 'efficiency'] as const) for (let i = 0; i < 3; i++) buyUpgrade(q, k);
  const pro = businessStats(q.save.basement);
  assert(pro.ready, `pro runs (${pro.missing.join()})`);
  console.log(`       (pro £${pro.profitPerHour}/hr, ${pro.unitsPerCycle}/cycle, storage ${pro.storage})`);
  assert(pro.profitPerHour > starter.profitPerHour * 10 && pro.profitPerHour < 20000, `pro £${pro.profitPerHour}/hr`);
  assert(pro.storage / pro.unitsPerCycle < 4, 'storage fills within a few cycles: you have to come back');
});

test('save and reload: basement, equipment and positions, business, upgrades, ledger all persist; old saves load safely', () => {
  const p = fresh();
  kit(p, 'tent_s', 'led_rig', 'fan', 'cctv');
  startBusiness(p);
  buyUpgrade(p, 'security');
  buyTier(p);
  buyImprovement(p, 'epoxy_floor');
  play(p, 1000);
  const q = roundtrip(p);
  const a = p.save.basement;
  const b = q.save.basement;
  for (const k of ['tier', 'improvements', 'equipment', 'upgrades', 'business', 'ledger', 'seed'] as const) assert(JSON.stringify(a[k]) === JSON.stringify(b[k]), `${k} kept`);
  assert(q.save.playTime === p.save.playTime, 'clock kept');
  // Loading twice doesn't pay twice.
  const r = roundtrip(q);
  tickBusiness(r.save.basement, r.save.playTime, 0);
  assert(r.save.basement.business.stock === a.business.stock, 'no income from loading');
  // Older save without a basement.
  const raw = JSON.parse(JSON.stringify(p.save));
  delete raw.basement;
  delete raw.playTime;
  const old = sanitiseSave(raw)!;
  assert(old.basement.tier === 0 && old.basement.equipment.length === 0 && old.playTime === 0, 'fresh basement');
  assert(old.property.furniture.length > 0 && old.cash.bank === p.save.cash.bank, 'nothing else lost');
  // Junk and impossible values are repaired.
  raw.basement = { tier: 99, equipment: [{ uid: 'e1', id: 'tent_s', at: { x: 1, z: 0, rot: 0 } }, { uid: 'e1', id: 'tent_s' }, { uid: 'e2', id: 'nope' }], business: { lastTick: 1e12, stock: -5 } };
  raw.playTime = 50;
  const fixed = sanitiseSave(raw)!.basement;
  assert(fixed.tier === TIERS.length - 1 && fixed.equipment.length === 1 && fixed.equipment[0].at === null, 'misplaced kit back in storage, dupes and junk gone');
  assert(fixed.business.lastTick === 50 && fixed.business.stock === 0, 'clock from the future reset, negative stock fixed');
});

test('every area still builds, and all 34 areas are reachable data', () => {
  const p = fresh();
  assert(AREA_IDS.length === 34, `${AREA_IDS.length} areas`);
  for (const id of AREA_IDS) {
    const lvl = resolveLevel(id, p.save);
    const w = new World(lvl, p, { entry: lvl.entries[0].id, seed: 4 });
    assert(w.player, id);
    for (const ex of lvl.exits) assert(LEVELS[ex.to] && LEVELS[ex.to].entries.some((e) => e.id === ex.toEntry), `${id}:${ex.id} leads somewhere real`);
  }
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
