/**
 * Stage 9 tests: the town map's data and travel rules (every place on the
 * map, markers tied to real areas, locks matching the level links, routes
 * that follow real exits, cab rules), visited places and destination in the
 * save, and the inventory's tabs.
 */
import { defaultAppearance } from '../src/character/Appearance';
import { createCharacter, emptyAllocation } from '../src/character/Character';
import { AREA_IDS, newSave, Progress, sanitiseSave, type AreaId } from '../src/progress/Progress';
import { LEVELS, DISTRICT_ORDER } from '../src/world/levels';
import { SHOP_STOPS, TAXI_COST, TAXI_STOPS } from '../src/ui/hub';
import {
  MAP_H,
  MAP_W,
  cabStop,
  lockReason,
  markers,
  nextExit,
  onMap,
  place,
  placePoint,
  playerPoint,
  roads,
  route,
  travelOptions,
  unlocked,
} from '../src/map/worldMap';
import { ITEM_LIST } from '../src/items/items';
import { groupOf } from '../src/ui/inventoryUI';
import { KEY_BINDINGS } from '../src/input/InputManager';

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
function fresh(cash = 1000): Progress {
  const c = createCharacter({ name: 'Tester', appearance: defaultAppearance(), background: 'estate_scrapper', allocated: emptyAllocation() });
  const p = new Progress(newSave(c));
  p.save.cash.bank = cash;
  return p;
}
const allFlags = (p: Progress) => {
  for (const d of DISTRICT_ORDER) p.save.flags[d.flag] = true;
  p.save.flags.shortcut_subway = true;
  p.save.flags.has_vip_pass = true;
  p.save.flags.has_stadium_key = true;
  p.save.flags.has_dunc_phone = true;
};

console.log('\nStage 9: the map');

test('every area in the game is on the map, inside the map, and has a description', () => {
  for (const id of AREA_IDS) {
    assert(onMap(id), `${id} isn’t on the map`);
    const pt = placePoint(id);
    assert(pt.x > 0 && pt.x < MAP_W && pt.y > 0 && pt.y < MAP_H, `${id} is off the edge (${Math.round(pt.x)}, ${Math.round(pt.y)})`);
    const pl = place(id);
    assert(pl.name === LEVELS[id].name && pl.blurb && pl.blurb.length > 10, `${id} card`);
  }
});

test('streets that join end to end meet on the map; places sit by their own front door', () => {
  for (const r of roads()) {
    const lvl = LEVELS[r.id];
    for (const ex of lvl.exits) {
      if (ex.kind !== 'edge') continue;
      const a = playerPoint(r.id, ex.x);
      const back = LEVELS[ex.to].exits.find((e) => e.to === r.id && e.kind === 'edge');
      if (!back) continue;
      const b = playerPoint(ex.to, back.x);
      assert(Math.hypot(a.x - b.x, a.y - b.y) < 30, `${r.id} → ${ex.to} don’t meet (${Math.round(Math.hypot(a.x - b.x, a.y - b.y))})`);
    }
  }
  const pub = placePoint('pub');
  const door = LEVELS.high_street.exits.find((e) => e.to === 'pub')!;
  const at = playerPoint('high_street', door.x);
  assert(Math.hypot(pub.x - at.x, pub.y - at.y) < 50, 'the Red Lion is by its door on the High Street');
});

test('markers point at real areas, and every shop, gym, pub and home has one', () => {
  const p = fresh();
  const ms = markers(p);
  for (const m of ms) assert((AREA_IDS as readonly string[]).includes(m.area), `${m.key} points nowhere`);
  for (const id of ['home', 'pub', 'clothes_shop', 'pawn_shop', 'casino', 'car_dealer', 'bike_shop', 'boxing_gym', 'karate_dojo', 'wrestling_club', 'gym_store', 'grow_shop', 'furniture_shop'] as AreaId[]) {
    assert(ms.some((m) => m.area === id && m.kind !== 'street'), `${id} has no marker`);
  }
  assert(ms.filter((m) => m.kind === 'mission').length === 1, 'exactly one main mission');
  const mission = ms.find((m) => m.kind === 'mission')!;
  assert(mission.area === DISTRICT_ORDER.find((d) => !d.optional && !p.has(d.flag))!.area, 'the mission is the next story boss');
  assert(ms.some((m) => m.kind === 'contact' && m.area === 'pub'), 'the Snug’s fighters for hire');
});

test('locked and unlocked match the game: a new save can’t reach past the Gaffer, and says why', () => {
  const p = fresh();
  for (const id of ['home', 'estate', 'high_street', 'pub', 'clothes_shop', 'residential', 'leisure', 'boxing_gym'] as AreaId[]) assert(unlocked(p, id), `${id} should be open`);
  assert(!unlocked(p, 'alleys') && lockReason(p, 'alleys')!.includes('Gaz Mullins'), 'alleys locked behind the Gaffer');
  assert(lockReason(p, 'city')!.includes('Gaz Mullins'), 'the city’s first lock is the Gaffer too');
  assert(!unlocked(p, 'stadium') && /stadium/i.test(lockReason(p, 'stadium')!), 'stadium needs its key');
  p.save.flags.boss_gaffer = true;
  assert(unlocked(p, 'alleys') && unlocked(p, 'market'), 'the Gaffer opens the alleys and the market');
  const q = fresh();
  allFlags(q);
  for (const id of AREA_IDS) assert(unlocked(q, id), `${id} still locked with everything done`);
});

test('a route follows real exits, one step at a time, and only through open ones', () => {
  const p = fresh();
  allFlags(p);
  for (const to of AREA_IDS) {
    const r = route(p, 'home', to);
    if (to === 'home') continue;
    assert(r && r.length, `no route to ${to}`);
    let cur: AreaId = 'home';
    for (const step of r!) {
      assert(LEVELS[cur].exits.some((e) => e.to === step), `${cur} has no exit to ${step}`);
      cur = step;
    }
  }
  const ex = nextExit(p, 'estate', 'pub');
  assert(ex && ex.to === 'high_street', 'from the estate to the Red Lion: head for the High Street');
  const locked = fresh();
  assert(route(locked, 'home', 'city') === null && nextExit(locked, 'estate', 'city') === null, 'no route through a locked street');
});

test('cabs: only to the stops Dave’s Cabs already serve, never in a fight, never locked, paid from the tin', () => {
  const p = fresh(100);
  const stops = new Set([...SHOP_STOPS.map((s) => s.area), ...TAXI_STOPS.map((s) => s.area)]);
  for (const id of AREA_IDS) assert(!!cabStop(id) === stops.has(id), `cab stop mismatch for ${id}`);
  const cab = travelOptions(p, 'estate', 'pub', true).find((t) => t.kind === 'cab')!;
  assert(cab.ok && cab.cost === TAXI_COST && cab.entry === 'door', 'cab to the pub');
  assert(!travelOptions(p, 'estate', 'pub', false).find((t) => t.kind === 'cab')!.ok, 'not in a fight');
  const locked = travelOptions(p, 'estate', 'pawn_shop', true).find((t) => t.kind === 'cab')!;
  assert(!locked.ok && locked.why!.includes('Gaz'), 'no cab to somewhere still locked');
  const poor = fresh(2);
  assert(!travelOptions(poor, 'estate', 'pub', true).find((t) => t.kind === 'cab')!.ok, 'not without the fare');
  assert(travelOptions(p, 'pub', 'pub', true)[0].kind === 'here', 'already here');
  const home = travelOptions(p, 'high_street', 'home', true).find((t) => t.kind === 'home')!;
  assert(home.ok && home.cost === 0, 'head home');
  assert(!travelOptions(p, 'high_street', 'factory', true).some((t) => t.kind === 'cab'), 'no cab to places Dave doesn’t go');
  p.shop('threads').closedUntil = p.save.trips + 3;
  const shut = travelOptions(p, 'estate', 'clothes_shop', true).find((t) => t.kind === 'cab')!;
  assert(!shut.ok && /robbery/.test(shut.why!), 'no cab to a shop that’s shut after a robbery');
});

test('visited places and the destination are saved; old saves get sensible visited places', () => {
  const p = fresh();
  p.save.visited.push('high_street');
  p.save.destination = 'pub';
  const q = new Progress(sanitiseSave(JSON.parse(JSON.stringify(p.save)))!);
  assert(q.save.visited.includes('high_street') && q.save.destination === 'pub', 'kept');
  const raw = JSON.parse(JSON.stringify(p.save));
  delete raw.visited;
  delete raw.destination;
  raw.flags = { boss_gaffer: true, boss_sully: true };
  raw.area = 'docks';
  const old = sanitiseSave(raw)!;
  for (const a of ['home', 'estate', 'high_street', 'industrial', 'docks']) assert(old.visited.includes(a as AreaId), `old save should have visited ${a}`);
  assert(old.destination === null, 'no route');
  raw.destination = 'nowhere';
  assert(sanitiseSave(raw)!.destination === null, 'junk destination dropped');
});

console.log('\nStage 9: inventory and keys');

test('every item lands in one of the inventory tabs, and materials and bags get their own', () => {
  const groups = new Set<string>();
  for (const d of ITEM_LIST) groups.add(groupOf(d));
  for (const g of ['weapons', 'clothing', 'equipment', 'consumables', 'materials', 'valuables', 'other']) assert(groups.has(g), `nothing in ${g}`);
  assert(groupOf(ITEM_LIST.find((d) => d.id === 'duct_tape')!) === 'materials', 'tape is a material');
  assert(groupOf(ITEM_LIST.find((d) => d.id === 'bag_rucksack')!) === 'equipment', 'a rucksack is equipment');
});

test('M opens the map; Tab and I keep their fight jobs (swap style, heavy punch)', () => {
  assert(KEY_BINDINGS.map.includes('KeyM' as never), 'M is the map');
  assert(KEY_BINDINGS.swap.includes('Tab' as never) && KEY_BINDINGS.hp.includes('KeyI' as never), 'fight keys unchanged');
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
