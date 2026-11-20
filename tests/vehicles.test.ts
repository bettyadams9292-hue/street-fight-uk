/**
 * Vehicle models: every car has a model file in public/models/vehicles, every listed file exists, and nothing is
 * left over. Bikes and scooters are the 30 approved models: each one is ridden properly (hands on the grips, feet on
 * the pedals, pegs or deck), handles like itself, and old saves' bikes become new ones.
 */
import { existsSync, readdirSync } from 'fs';
import { BIKE_LIST, CAR_LIST } from '../src/property/catalogue';
import { CAR_MODELS, VEHICLE_FILES } from '../src/render/props/vehicleFiles';
import { APPROVED_IDS } from '../src/render/approved/registry';
import { bikeFit, riddenBike } from '../src/render/props/bikes';
import { ridePose } from '../src/render/anim/ridePose';
import { MODEL_METRICS as M, solveBody } from '../src/render/anim/skeleton';
import { BIKES, OLD_BIKE_IDS, bikeHandling } from '../src/property/catalogue';
import { Fighter } from '../src/fighter/Fighter';
import { STYLES } from '../src/data/styles';
import { defaultAttributes } from '../src/stats/Stats';
import { emptyCommand, type CommandFrame } from '../src/input/Commands';
import { Simulation } from '../src/core/Simulation';
import { Arena } from '../src/world/Arena';
import { createCharacter, emptyAllocation } from '../src/character/Character';
import { defaultAppearance } from '../src/character/Appearance';
import { newSave, sanitiseSave } from '../src/progress/Progress';
import { resolveLevel } from '../src/property/levels';
import { LEVELS } from '../src/world/levels';

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
function assert(c: unknown, msg: string): void {
  if (!c) throw new Error(msg);
}

const DIR = 'public/models/vehicles/';

test('every car has a model', () => {
  const missing = CAR_LIST.filter((c) => !CAR_MODELS[c.id]).map((c) => c.id);
  assert(!missing.length, `no model: ${missing.join(', ')}`);
});
test('every bike and scooter is an approved model, and no old bike files are left', () => {
  assert(BIKE_LIST.length === 30, `${BIKE_LIST.length} bikes`);
  const missing = BIKE_LIST.filter((b) => !(APPROVED_IDS as readonly string[]).includes(b.id)).map((b) => b.id);
  assert(!missing.length, `not approved: ${missing.join(', ')}`);
  assert(!readdirSync(DIR).some((f) => f.startsWith('bike-')), 'old bike models still in the folder');
});
test('the rider fits every bike: hands on the grips, feet on the pedals, pegs or deck, all the way round the cranks', () => {
  for (const b of BIKE_LIST) {
    const f = bikeFit(b.id);
    for (const crank of [0, 1.6, 3.1, 4.7]) {
      const p = ridePose(f, M, { crank, speed: 4, on: 1 });
      for (const v of Object.values(p.joints)) for (const x of v!) assert(Number.isFinite(x), `${b.id}: non-finite joint`);
      const body = solveBody(p, M);
      for (const s of ['l', 'r'] as const) {
        const h = body.hand[s];
        assert(Math.hypot(h[2] - (f.bars.x - f.seat.x), h[1] - f.bars.y) < 0.04, `${b.id}: ${s} hand ${h[2].toFixed(2)},${h[1].toFixed(2)} off the bars`);
      }
      if (f.pedal) {
        const a = body.ankle.l;
        const want = [f.pedal.x + Math.cos(crank) * f.pedal.crank - f.seat.x, f.pedal.y + Math.sin(crank) * f.pedal.crank + M.ankleH + 0.02];
        assert(Math.hypot(a[2] - want[0], a[1] - want[1]) < 0.04, `${b.id}: left foot off its pedal at crank ${crank}`);
      }
      // Nothing below the floor.
      assert(Math.min(body.ankle.l[1], body.ankle.r[1]) > M.ankleH - 0.02, `${b.id}: a foot through the floor`);
    }
    for (const on of [0, 0.3, 0.6]) {
      const p = ridePose(f, M, { crank: 0, speed: 0, on });
      for (const v of Object.values(p.joints)) for (const x of v!) assert(Number.isFinite(x), `${b.id}: getting on at ${on}`);
    }
    const r = riddenBike(b.id);
    assert(r.group.children.length === 3, `${b.id}: body and two wheels`);
    r.spin(1);
  }
});

function rider(id: string) {
  // A long empty road, so nothing but the bike decides the speed.
  const sim = new Simulation(new Arena({ minX: -2000, maxX: 2000, minZ: -2, maxZ: 2 }, 'road'), 3);
  const f = sim.add(new Fighter({ id: 1, name: 'P', team: 'player', attributes: defaultAttributes(6), style: STYLES.kickboxing, x: 0, z: 0 }));
  f.vehicle = bikeHandling(BIKES[id]);
  f.facing = 1;
  return Object.assign(f, { sim });
}
function drive(f: ReturnType<typeof rider>, frames: number, set: (c: CommandFrame) => void): void {
  for (let i = 0; i < frames; i++) {
    const c = emptyCommand();
    set(c);
    f.sim.step(new Map([[1, c]]));
  }
}
test('riding has weight: it picks up speed, coasts, brakes harder than it coasts, and turns round only when stopped', () => {
  for (const id of ['b07_road_racer', 'b29_standup_escooter', 'b28_delivery_moped', 'b26_sportbike']) {
    const f = rider(id);
    const h = f.vehicle!;
    drive(f, 6, (c) => (c.moveX = 1));
    assert(f.rideSpeed > 0 && f.rideSpeed < h.top * 0.5, `${id}: no instant top speed (${f.rideSpeed.toFixed(2)} after 0.1 s)`);
    drive(f, 360, (c) => (c.moveX = 1));
    assert(f.rideSpeed > h.top * 0.9 && f.rideSpeed <= h.top * 1.1, `${id}: reaches its top speed (${f.rideSpeed.toFixed(2)} / ${h.top.toFixed(2)})`);
    const coast = rider(id);
    coast.rideSpeed = f.rideSpeed;
    drive(coast, 30, () => {});
    drive(f, 30, (c) => (c.moveX = -1));
    assert(coast.rideSpeed > 0.2, `${id}: lets go and rolls on`);
    assert(f.rideSpeed < coast.rideSpeed, `${id}: braking stops it quicker than coasting`);
    assert(f.facing === 1, `${id}: no spinning round at speed`);
    drive(f, 240, (c) => (c.moveX = -1));
    assert(f.facing === -1, `${id}: turns round once it's stopped`);
  }
});
test('lane changes are slow at walking pace and quicker at speed', () => {
  const slow = rider('b26_sportbike');
  drive(slow, 20, (c) => (c.moveZ = 1));
  const fast = rider('b26_sportbike');
  fast.rideSpeed = fast.vehicle!.top;
  drive(fast, 20, (c) => ((c.moveZ = 1), (c.moveX = 1)));
  assert(Math.abs(fast.vel.z) > Math.abs(slow.vel.z), `fast ${fast.vel.z.toFixed(2)} vs slow ${slow.vel.z.toFixed(2)}`);
});
test("an old save's bikes become the nearest new ones, out on the street too", () => {
  const save = newSave(createCharacter({ name: 'T', appearance: defaultAppearance(), background: 'estate_scrapper', allocated: emptyAllocation() }));
  const raw = JSON.parse(JSON.stringify(save));
  raw.property.bikes = Object.keys(OLD_BIKE_IDS).slice(0, 3).map((id, i) => ({ uid: `u${i}`, id, colour: '#123456', from: 'bought' }));
  raw.property.bikeOut = { uid: 'u1', area: 'estate', x: 3, z: -1 };
  const s = sanitiseSave(raw)!;
  assert(s.property.bikes.length === 3, `${s.property.bikes.length} bikes kept`);
  for (const b of s.property.bikes) assert(BIKES[b.id], `${b.id} is a new bike`);
  assert(s.property.bikeOut?.uid === 'u1', 'the bike left out is still out');
});
test('bikes and scooters are parked across the world, never at a door, never indoors', () => {
  const save = newSave(createCharacter({ name: 'T', appearance: defaultAppearance(), background: 'estate_scrapper', allocated: emptyAllocation() }));
  let n = 0;
  const kinds = new Set<string>();
  for (const area of Object.keys(LEVELS) as (keyof typeof LEVELS)[]) {
    const base = LEVELS[area];
    const lv = resolveLevel(area, save);
    const added = lv.props.filter((p) => p.kind === 'vehicle' && BIKES[p.item!] && !base.props.includes(p));
    if (base.deep) assert(!added.length, `${area}: bikes parked indoors`);
    for (const p of added) {
      n++;
      kinds.add(BIKES[p.item!].cls);
      assert(p.solid === false, `${area}: a parked bike blocks the way`);
      for (const e of lv.exits) if (e.kind === 'door') assert(Math.abs(e.x - p.x) > 0.9, `${area}: ${p.item} at the door ${e.id}`);
    }
  }
  assert(n >= 12, `only ${n} bikes out in the world`);
  for (const c of ['bicycle', 'ebike', 'scooter']) assert(kinds.has(c), `no ${c}s out in the world`);
});
test('every listed file exists, and every file is listed', () => {
  const absent = VEHICLE_FILES.filter((f) => !existsSync(`${DIR}${f}.glb`));
  assert(!absent.length, `missing: ${absent.join(', ')}`);
  const extra = readdirSync(DIR).filter((f) => f.endsWith('.glb') && !(VEHICLE_FILES as readonly string[]).includes(f.replace(/\.glb$/, '')));
  assert(!extra.length, `not listed: ${extra.join(', ')}`);
  assert(existsSync(`${DIR}Textures/colormap.png`), 'shared colormap');
});
test('car models only point at listed files', () => {
  for (const [id, m] of Object.entries(CAR_MODELS)) assert((VEHICLE_FILES as readonly string[]).includes(m.file), `${id} -> ${m.file}`);
});

console.log(`vehicles: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
