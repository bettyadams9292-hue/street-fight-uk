/**
 * Vehicle models: every car and bike in the catalogue has a model file in
 * public/models/vehicles, every listed file exists, and nothing is left over.
 */
import { existsSync, readdirSync } from 'fs';
import { BIKE_LIST, CAR_LIST } from '../src/property/catalogue';
import { BIKE_IDS, CAR_MODELS, VEHICLE_FILES } from '../src/render/props/vehicleFiles';

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
test('every bike has a model', () => {
  const missing = BIKE_LIST.filter((b) => !(BIKE_IDS as readonly string[]).includes(b.id)).map((b) => b.id);
  assert(!missing.length, `no model: ${missing.join(', ')}`);
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
