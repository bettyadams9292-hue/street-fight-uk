/**
 * The approved asset library (src/render/approved): the in-game copies match the approved originals, every
 * registered model builds, nothing unapproved or security-related is registered, and the streets use them.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { APPROVED, APPROVED_IDS } from '../src/render/approved/registry';
import { prototype } from '../src/render/approved/prototype';
import { planStreet } from '../src/city/street';
import { LEVELS } from '../src/world/levels';
import { kitStreet } from '../src/city/street';
import { PROP_SIZE } from '../src/world/LevelTypes';
// @ts-expect-error plain JavaScript tool
import { HEADER, SOURCES } from '../tools/assets/syncApproved.mjs';

// The police sets letter their signs on a canvas: under Node, a stand-in canvas that draws nothing.
const g = globalThis as { document?: unknown };
if (!g.document) {
  const ctx = new Proxy({}, { get: (_t, k) => (k === 'measureText' ? () => ({ width: 10 }) : String(k).startsWith('create') ? () => ({ addColorStop() {} }) : () => {}), set: () => true });
  g.document = { createElement: () => ({ getContext: () => ctx, width: 0, height: 0 }) };
}

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

test('every in-game copy is its approved original, unchanged (run tools/assets/syncApproved.mjs after an original changes)', () => {
  for (const [to, from] of Object.entries(SOURCES as Record<string, string>)) {
    const copy = readFileSync(`src/render/approved/sources/${to}`, 'utf8');
    assert(copy === HEADER + readFileSync(from, 'utf8'), `${to} differs from ${from}`);
  }
  const files = readdirSync('src/render/approved/sources').sort();
  assert(JSON.stringify(files) === JSON.stringify(Object.keys(SOURCES).sort()), `unexpected files in sources: ${files}`);
});

test('every approved model builds, stands on the ground at real size, and ids are unique', () => {
  assert(new Set(APPROVED_IDS).size === APPROVED_IDS.length, 'duplicate ids');
  assert(APPROVED_IDS.length === 337, `${APPROVED_IDS.length} approved models`);
  for (const id of APPROVED_IDS) {
    const p = prototype(id);
    assert(p.triangles > 0 && p.parts.length > 0 && p.parts.length <= 5, `${id}: ${p.parts.length} parts`);
    const h = p.box.max.y - p.box.min.y;
    assert(h > 0.05 && h < 5, `${id}: ${h.toFixed(2)} m tall`);
  }
});

test('nothing unapproved or security-related is registered', () => {
  // Safes, palisade and chain-link fences came in with the owner-approved expansion (20 Nov); cameras and alarms never.
  const banned = /cctv|camera|alarm|globeStreetLight/i;
  for (const id of APPROVED_IDS) assert(!banned.test(id), `${id} should not be registered`);
  const batch06 = readFileSync('streetassettesting/batch06.ts', 'utf8');
  for (const m of batch06.matchAll(/id:\s*['"]([a-zA-Z0-9]+)['"]/g)) if (APPROVED[m[1]]) assert(APPROVED[m[1]].batch !== ('B06' as never), `${m[1]} from Batch 06`);
  for (const a of Object.values(APPROVED)) for (const k of a.replaces ?? []) assert(k in PROP_SIZE, `${a.id} replaces unknown prop ${k}`);
});

test('the kit streets draw British street furniture from the approved library, at each prop’s own spot', () => {
  let n = 0;
  const used = new Set<string>();
  for (const L of Object.values(LEVELS)) {
    if (!kitStreet(L)) continue;
    const plan = planStreet(L);
    for (const a of plan.approved) {
      assert(APPROVED[a.id], `${L.id}: ${a.id} not approved`);
      used.add(a.id);
      n++;
    }
    // The old US kit pieces are gone where an approved one replaced them.
    for (const p of plan.placements) assert(!/phone-booth|prop-bus-shelter|prop-bench$|bus-tub-trolley|prop-manhole/.test(p.model), `${L.id}: still draws ${p.model}`);
  }
  assert(n > 200, `only ${n} approved pieces on the streets`);
  for (const id of ['telephoneBox', 'pillarPostBox', 'busShelter', 'streetLamp', 'parkBench']) assert(used.has(id), `${id} never used`);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
