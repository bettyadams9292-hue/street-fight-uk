/**
 * The long street: every outdoor district joined end to end with no stops,
 * and the kit plan that draws it (pavement under the pavement, road under the
 * road, the right things inside each shop).
 */
import { readFileSync } from 'node:fs';
import { createCharacter, emptyAllocation } from '../src/character/Character';
import { defaultAppearance } from '../src/character/Appearance';
import { DISTRICTS, INTERIORS_FOR_TEST, KERB_Z, interiorFor, planStreet, surfaceAt, type StreetPlan } from '../src/city/street';
import { emptyCommand } from '../src/input/Commands';
import { Progress, newSave, type AreaId } from '../src/progress/Progress';
import { propHalf, type LevelDef } from '../src/world/LevelTypes';
import { LEVELS } from '../src/world/levels';
import { STRIP, onStrip, stripLength, stripNeighbours, stripOffsets } from '../src/world/strip';
import { World, exitLocked } from '../src/world/World';

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

const fresh = () => new Progress(newSave(createCharacter({ name: 'T', appearance: defaultAppearance('male'), background: 'estate_scrapper', allocated: emptyAllocation() })));
const L = LEVELS as Record<AreaId, LevelDef>;
const kit = JSON.parse(readFileSync('public/models/polyfork/kit.json', 'utf8')) as { models: Record<string, { min: number[]; max: number[] }> };
const plans = new Map<AreaId, StreetPlan>(STRIP.map((id) => [id, planStreet(L[id])]));

console.log('The long street');

test('every outdoor district is on the street, once, and the street is one line', () => {
  assert(new Set(STRIP).size === STRIP.length, 'a district appears twice');
  for (const id of STRIP) assert(L[id], `${id} is not a level`);
  assert(STRIP[0] === 'stadium' && STRIP[19] === 'hq' && STRIP[STRIP.length - 1] === 't6d4', 'the ends moved');
  assert(stripLength(L) > 1500, `the street is only ${stripLength(L)} m`);
  const offs = stripOffsets(L);
  let at = 0;
  for (const id of STRIP) {
    assert(offs[id] === at, `${id} does not start where the one before it ends`);
    at += L[id].bounds.maxX - L[id].bounds.minX;
  }
});

test('each end of a district leads straight into the next, and back again', () => {
  STRIP.forEach((id, i) => {
    const edges = L[id].exits.filter((e) => e.kind === 'edge');
    assert(edges.every((e) => e.seam), `${id} has an edge that is not a seam`);
    const right = edges.find((e) => e.side === 'right');
    const left = edges.find((e) => e.side === 'left');
    assert(!!right === i < STRIP.length - 1 && !!left === i > 0, `${id} has the wrong ends`);
    if (right) {
      assert(right.to === STRIP[i + 1] && right.toEntry === 'left' && right.x === L[id].bounds.maxX, `${id} east end`);
      assert(L[right.to].exits.some((e) => e.seam && e.to === id && e.side === 'left'), `${right.to} does not lead back to ${id}`);
    }
    assert(L[id].entries.some((e) => e.id === 'left') && L[id].entries.some((e) => e.id === 'right'), `${id} lacks a left or right entry`);
  });
});

test('no street leads to another street through a side door, except the subway short cut', () => {
  for (const id of STRIP) {
    for (const e of L[id].exits) {
      if (e.kind !== 'door' || !onStrip(e.to)) continue;
      assert(e.id === 'subway_steps' || e.id === 'estate_stairs', `${id} still has a street door to ${e.to}`);
    }
  }
});

test('walking off the end of a district carries on at once, with no push and no door', () => {
  const w = new World(L.estate, fresh(), { entry: 'right', seed: 1 });
  let out: { to: AreaId; entry: string; seam?: boolean } | null = null;
  w.events.on('area:exit', (e) => (out = e));
  let frames = 0;
  while (!out && frames++ < 600) w.step({ ...emptyCommand(), moveX: 1 });
  assert(out, 'never left the estate');
  assert(out!.to === 'high_street' && out!.entry === 'left' && out!.seam === true, `left as ${JSON.stringify(out)}`);
  // 2 m at walking pace; a 12-frame push at the edge would add to this.
  assert(frames < 150, `took ${frames} frames to walk 2 m and cross`);
  // Arriving a step over the line and still walking does not bounce you back.
  const b = L.high_street.bounds;
  const there = new World(L.high_street, fresh(), { entry: 'left', seed: 1, at: { x: b.minX + 0.08, z: 0 } });
  let back = false;
  there.events.on('area:exit', () => (back = true));
  for (let i = 0; i < 30; i++) there.step({ ...emptyCommand(), moveX: 1 });
  assert(!back && there.player.pos.x > b.minX + 0.5, 'bounced back over the seam');
});

test('a seam the story has shut stops you with a reason, and opens with its flag', () => {
  const p = fresh();
  const seam = L.high_street.exits.find((e) => e.seam && e.to === 'alleys')!;
  assert(exitLocked(seam, p) && /Gaffer/.test(seam.lockedText ?? ''), 'the alleys are open from the start');
  const w = new World(L.high_street, p, { entry: 'right', seed: 1 });
  // Clear the boss fight out of the way: this is about the seam, not the fight.
  let left = false;
  let told = '';
  w.events.on('area:exit', () => (left = true));
  w.events.on('area:locked', (e) => (told = e.text));
  w.player.pos.x = L.high_street.bounds.maxX - 0.3;
  for (let i = 0; i < 200 && !told && !left; i++) w.step({ ...emptyCommand(), moveX: 1 });
  assert(!left, 'walked through a locked seam');
  p.save.flags.boss_gaffer = true;
  assert(!exitLocked(seam, p), 'the Gaffer flag does not open it');
  // Walking home is never locked.
  assert(!L.alleys.exits.find((e) => e.seam && e.to === 'high_street')!.requires, 'the way back is locked');
});

test('the story still gates the street in order', () => {
  const need = (from: AreaId, to: AreaId) => L[from].exits.find((e) => e.seam && e.to === to)!;
  assert(need('industrial', 'ind_estate').requires === 'boss_sully', 'Sully');
  assert(need('city', 'docks').requires === 'boss_ratcatcher', 'Ratcatcher');
  assert(need('car_park', 'nightlife').requires === 'has_vip_pass', 'VIP pass');
  assert(need('leisure', 'stadium').requires === 'has_stadium_key', 'stadium key');
  assert((need('territory', 'hq').requiresAll ?? []).length === 5, 'Hale House');
  assert(stripNeighbours('estate').left === 'residential' && stripNeighbours('estate').right === 'high_street', 'home moved');
});

console.log('The street plan');

test('every district has a plan, and every model it names is in the pack', () => {
  for (const [id, plan] of plans) {
    assert(DISTRICTS[id], `${id} has no district entry`);
    assert(plan.placements.length > 40, `${id} is nearly empty`);
    for (const pl of plan.placements) assert(kit.models[pl.model], `${id}: ${pl.model} is not in kit.json`);
    for (const pl of plan.placements) assert(pl.sx > 0.2 && pl.sy > 0.2 && pl.sy < 2.1 && pl.sz > 0.2 && (pl.sx < 3.2 || /tile/.test(pl.model)), `${id}: ${pl.model} scaled ${pl.sx} × ${pl.sy}`);
  }
});

test('the plan is the same every time', () => {
  for (const id of STRIP) assert(JSON.stringify(planStreet(L[id])) === JSON.stringify(plans.get(id)), `${id} changed between two plans`);
});

test('where you can walk is paved: pavement behind the kerb, road in front of it, nothing bare', () => {
  for (const [id, plan] of plans) {
    const b = L[id].bounds;
    for (let x = b.minX + 0.25; x < b.maxX; x += 0.5) {
      for (let z = b.minZ; z <= b.maxZ + 0.001; z += 0.25) {
        const s = surfaceAt(plan, x, z);
        assert(s, `${id}: bare ground at ${x.toFixed(1)}, ${z.toFixed(2)}`);
        assert(s !== 'water' && s !== 'garden' && s !== 'shopfloor', `${id}: ${s} where you walk at ${x.toFixed(1)}, ${z.toFixed(2)}`);
        if (plan.kerbZ === null) assert(s !== 'road' && s !== 'kerb', `${id} has no road but ${s} at ${x.toFixed(1)}, ${z.toFixed(2)}`);
      }
    }
    if (plan.kerbZ !== null) {
      assert(plan.kerbZ === KERB_Z, `${id}: kerb at ${plan.kerbZ}`);
      // Against the buildings it is always pavement; out past the walkable edge it is always road.
      for (let x = plan.x0 + 0.5; x < plan.x1; x += 1) {
        assert(surfaceAt(plan, x, plan.back + 0.3) === 'pavement', `${id}: not pavement by the buildings at x ${x}`);
        assert(surfaceAt(plan, x, plan.front + 1.5) === 'road', `${id}: not road beyond the kerb at x ${x}`);
      }
    }
  }
});

test('vehicles stand on the road and street furniture stands on paving', () => {
  const VEHICLES = new Set(['car', 'van', 'bus', 'abandoned_car']);
  const FURNITURE = new Set(['bench', 'bin', 'planter', 'phonebox', 'busstop', 'vending', 'kiosk', 'bike_rack', 'bollard', 'postbox']);
  let cars = 0;
  for (const [id, plan] of plans) {
    for (const p of L[id].props) {
      const [hx, hz] = propHalf(p);
      const corners = [[p.x - hx * 0.8, p.z - hz * 0.8], [p.x + hx * 0.8, p.z - hz * 0.8], [p.x - hx * 0.8, p.z + hz * 0.8], [p.x + hx * 0.8, p.z + hz * 0.8], [p.x, p.z]];
      if (VEHICLES.has(p.kind) && plan.kerbZ !== null) {
        cars++;
        for (const [x, z] of corners) assert(surfaceAt(plan, x, z) === 'road', `${id}: a ${p.kind} at x ${p.x} has a wheel on ${surfaceAt(plan, x, z)}`);
      }
      if (FURNITURE.has(p.kind)) {
        for (const [x, z] of corners) {
          const s = surfaceAt(plan, Math.max(plan.x0, Math.min(plan.x1, x)), z);
          assert(s !== 'road' && s !== 'water', `${id}: a ${p.kind} at x ${p.x}, z ${p.z} stands on ${s}`);
        }
      }
    }
  }
  assert(cars >= 10, `only ${cars} vehicles checked`);
});

test('buildings fill the frontage edge to edge without overlapping', () => {
  for (const [id, plan] of plans) {
    const fronts: [number, number, string][] = [];
    for (const pl of plan.placements) {
      const m = kit.models[pl.model];
      const depth = m.max[2] - m.min[2];
      const tall = m.max[1] * pl.sy > 3.5 && depth > 3.5 && /bldg-|house|cottage|townhouse|storefront-unit|restaurant-unit|detached-garage|picnic-shelter/.test(pl.model);
      // Front row only: the skyline stands well back.
      if (!tall || pl.z < plan.back - 14) continue;
      fronts.push([pl.x + m.min[0] * pl.sx, pl.x + m.max[0] * pl.sx, pl.model]);
    }
    fronts.sort((a, b) => a[0] - b[0]);
    for (let i = 1; i < fronts.length; i++) {
      const overlap = fronts[i - 1][1] - fronts[i][0];
      assert(overlap < 1.0, `${id}: ${fronts[i - 1][2]} overlaps ${fronts[i][2]} by ${overlap.toFixed(2)} m at x ${fronts[i][0].toFixed(1)}`);
    }
    for (const f of L[id].facades) {
      if (f.kind === 'fence' || f.kind === 'hoarding' || f.x1 - f.x0 < 3) continue;
      const mid = (f.x0 + f.x1) / 2;
      assert(fronts.some((b) => b[0] <= mid + 0.01 && b[1] >= mid - 0.01), `${id}: nothing built at x ${mid} (${f.kind} ${f.label ?? ''})`);
    }
  }
});

test('a shop you can see into holds what its sign says', () => {
  const MUST: Record<string, RegExp> = {
    furniture: /sofa|table|chair/, pub: /back-bar|poseur|wine/, takeaway: /range|counter|menu/, bookies: /wall-display/, clothes: /coat-rack/,
    offlicence: /fridge|wine-bottle/, bikes: /bmx-bike/, cars: /car|coupe/, plants: /planter|olive|shrub|basket/, office: /desk|reception/, gym: /locker/,
  };
  const NEVER: Record<string, RegExp> = { furniture: /range|fridge|espresso|bmx/, clothes: /range|espresso|wine/, bookies: /range|sofa|bmx/, pub: /printer|server-rack|bmx/, bikes: /espresso|sofa|wine/ };
  let shops = 0;
  for (const [id, plan] of plans) {
    for (const s of plan.shopfronts) {
      shops++;
      assert(s.contents.length >= 5, `${id}: ${s.label} is nearly empty`);
      if (MUST[s.kind]) assert(s.contents.some((m) => MUST[s.kind].test(m)), `${id}: ${s.label} (${s.kind}) has none of ${MUST[s.kind]}`);
      if (NEVER[s.kind]) assert(!s.contents.some((m) => NEVER[s.kind].test(m)), `${id}: ${s.label} (${s.kind}) holds ${s.contents.find((m) => NEVER[s.kind].test(m))}`);
    }
  }
  assert(shops >= 30, `only ${shops} shops you can see into`);
  assert(interiorFor('shop', 'HOME & HEARTH') === 'furniture' && interiorFor('pub', 'THE RED LION') === 'pub' && interiorFor('casino', 'GOLDEN LION') === 'casino', 'a sign names the wrong kind of shop');
  for (const [kind, items] of Object.entries(INTERIORS_FOR_TEST)) {
    for (const it of items) assert(Math.abs(it.u) <= 3.4 && it.v >= 0.3 && it.v <= 7, `${kind}: ${it.m} stands outside the unit`);
  }
});

test('every door you can use has a doorway, and your house stands where its door is', () => {
  for (const [id, plan] of plans) {
    for (const e of L[id].exits) {
      if (e.kind !== 'door') continue;
      const f = L[id].facades.find((x) => e.x > x.x0 && e.x < x.x1);
      if (!f || !f.label || f.label === 'back') continue;
      const shop = plan.shopfronts.find((s) => e.x > s.x0 && e.x < s.x1);
      if (shop) assert(plan.doors.some((d) => Math.abs(d - e.x) < 0.01), `${id}: no gap in the glass for the door at x ${e.x} (${shop.label})`);
    }
  }
  const home = plans.get('estate')!;
  const door = L.estate.exits.find((e) => e.to === 'home')!;
  const house = home.placements.find((p) => p.model === 'hood/two-storey-family-house');
  assert(house && Math.abs(house.x - door.x) < 2.1, 'the house is not at its front door');
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
