/**
 * The map overhaul (master directive Phase 2): districts as areas with their state, boundaries only where streets
 * really meet, and pins for the cash machines, the car mods and the lock-up, each saying what state it's in.
 */
import { defaultAppearance } from '../src/character/Appearance';
import { createCharacter, emptyAllocation } from '../src/character/Character';
import { newSave, Progress } from '../src/progress/Progress';
import { districtBorders, districts, roads, serviceMarkers, unlocked } from '../src/map/worldMap';
import { ATM_FLAG } from '../src/money/atm';

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
const progress = () => new Progress(newSave(createCharacter({ name: 'T', appearance: defaultAppearance(), background: 'estate_scrapper', allocated: emptyAllocation() })));

console.log('Map overhaul');

test('every street is in exactly one district, and a district is open when any of its streets is', () => {
  const p = progress();
  const ds = districts(p);
  const seen = new Set<string>();
  for (const d of ds) for (const a of d.areas) {
    assert(!seen.has(a), `${a} in two districts`);
    seen.add(a);
  }
  assert(seen.size === roads().length, 'a street with no district');
  for (const d of ds) {
    assert(d.open === d.areas.some((a) => unlocked(p, a)), `${d.name} open state`);
    assert(d.open || d.why, `${d.name} locked with no reason`);
  }
  assert(ds.some((d) => !d.open), 'a new game has locked districts');
});

test('district boundaries are only drawn where one district’s street runs into another’s', () => {
  const rs = roads();
  const b = districtBorders();
  assert(b.length > 0, 'no boundaries');
  for (const x of b) {
    assert(x.from !== x.to, 'a boundary inside a district');
    const ends = rs.some((r) => r.district === x.from && Math.hypot(r.pts[r.pts.length - 1].x - x.at.x, r.pts[r.pts.length - 1].y - x.at.y) < 0.01);
    const starts = rs.some((r) => r.district === x.to && Math.hypot(r.pts[0].x - x.at.x, r.pts[0].y - x.at.y) < 2);
    assert(ends && starts, `boundary ${x.from} → ${x.to} isn't at a real join`);
  }
});

test('cash machines are on the map, out of service until Sully’s beaten', () => {
  const p = progress();
  const before = serviceMarkers(p).filter((m) => m.kind === 'atm');
  assert(before.length === 4, `${before.length} cash machines`);
  assert(before.every((m) => /out of service/.test(m.label)), 'shown as working before Sully');
  assert(before.some((m) => /Califax/.test(m.label)) && before.some((m) => /Lloyd’s THC/.test(m.label)), 'both banks');
  p.set(ATM_FLAG);
  assert(serviceMarkers(p).filter((m) => m.kind === 'atm').every((m) => !/out of service/.test(m.label)), 'still out of service after Sully');
});

test('the lock-up and the car mods have pins that say what state they’re in', () => {
  const p = progress();
  const lk = () => serviceMarkers(p).find((m) => m.kind === 'lockup')!;
  assert(lk() && /padlocked/.test(lk().label), lk()?.label);
  p.set('has_lockup_key');
  assert(/got the key/.test(lk().label), lk().label);
  p.set(`searched:${lk().area}:lockup`);
  assert(/emptied/.test(lk().label), lk().label);
  assert(serviceMarkers(p).some((m) => m.kind === 'mods' && m.area === 'car_dealer'), 'no car mods pin');
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
