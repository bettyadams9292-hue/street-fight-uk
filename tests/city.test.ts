/**
 * City builder: the building catalogue, the kit pieces it relies on, and the
 * plans it makes for every real frontage in the game.
 */
import { readFileSync } from 'node:fs';
import { DESIGNS, KIT_KINDS, compositionKey, type Category } from '../src/city/catalogue';
import { PIECES, type PieceId } from '../src/city/pieces';
import { hashString, planFacade } from '../src/city/compose';
import { LEVELS } from '../src/world/levels';
import type { LevelDef } from '../src/world/LevelTypes';

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

const kit = JSON.parse(readFileSync('public/models/city/kit.json', 'utf8')) as { pieces: Record<string, { min: number[]; max: number[] }> };
const levels = Object.values(LEVELS as Record<string, LevelDef>);

/** Every kit frontage in the game, planned the way LevelView plans it. */
function planAll() {
  const out: { level: string; kind: string; x0: number; x1: number; doors: number[]; plan: ReturnType<typeof planFacade> }[] = [];
  for (const lvl of levels) {
    let recent: string[] = [];
    for (const f of [...lvl.facades].sort((a, b) => a.x0 - b.x0)) {
      if (!KIT_KINDS.has(f.kind)) continue;
      const doors = lvl.exits.filter((e) => e.kind === 'door' && e.x >= f.x0 && e.x <= f.x1).map((e) => e.x);
      const plan = planFacade({ kind: f.kind, x0: f.x0, x1: f.x1, label: f.label, theme: lvl.theme, seed: hashString(`${lvl.id}:${f.x0}`), doors, recent });
      recent = [...recent, ...plan.buildings.map((b) => b.design.id)].slice(-2);
      out.push({ level: lvl.id, kind: f.kind, x0: f.x0, x1: f.x1, doors, plan });
    }
  }
  return out;
}

console.log('City builder');

test('the catalogue meets its targets by category', () => {
  const want: Record<Category, number> = { residential: 15, commercial: 15, office: 10, industrial: 10, entertainment: 10, civic: 10 };
  for (const [cat, n] of Object.entries(want)) {
    const have = DESIGNS.filter((d) => d.category === cat).length;
    assert(have >= n, `${cat}: ${have} designs, target ${n}`);
  }
  assert(new Set(DESIGNS.map((d) => d.id)).size === DESIGNS.length, 'duplicate design id');
});

test('no two designs share a composition (a recolour is not a new design)', () => {
  const seen = new Map<string, string>();
  for (const d of DESIGNS) {
    const k = compositionKey(d);
    assert(!seen.has(k), `${d.id} has the same composition as ${seen.get(k)}`);
    seen.set(k, d.id);
  }
});

test('every piece the builder uses is in the kit file, at the width the builder expects', () => {
  for (const [id, info] of Object.entries(PIECES) as [PieceId, { w: number }][]) {
    const p = kit.pieces[id];
    assert(p, `${id} is missing from kit.json`);
    const w = p.max[0] - p.min[0];
    assert(Math.abs(w - info.w) < 0.06, `${id}: kit width ${w.toFixed(2)}, builder expects ${info.w}`);
  }
  for (const d of DESIGNS) for (const u of d.upper) assert(u in PIECES, `${d.id} uses unknown piece ${u}`);
});

test('every kit frontage kind has at least two designs to choose from', () => {
  for (const k of KIT_KINDS) {
    if (k === 'market' || k === 'house_front') continue; // landmarks: one bespoke design is right
    const n = DESIGNS.filter((d) => d.kinds.includes(k) && d.weight! > 0).length;
    assert(n >= 2, `${k} has ${n} design(s)`);
  }
});

const all = planAll();

test('plans are deterministic', () => {
  const again = planAll();
  assert(JSON.stringify(all.map((a) => a.plan.placements)) === JSON.stringify(again.map((a) => a.plan.placements)), 'two runs differed');
});

test('every frontage is covered end to end, with no gaps or overlapping buildings', () => {
  assert(all.length >= 40, `only ${all.length} kit frontages found`);
  for (const a of all) {
    const bs = a.plan.buildings;
    assert(bs.length >= 1, `${a.level} ${a.kind}: no buildings`);
    assert(Math.abs(bs[0].x0 - a.x0) < 1e-6 && Math.abs(bs[bs.length - 1].x1 - a.x1) < 1e-6, `${a.level} ${a.kind}: does not span ${a.x0}..${a.x1}`);
    for (let i = 1; i < bs.length; i++) assert(Math.abs(bs[i].x0 - bs[i - 1].x1) < 1e-6, `${a.level} ${a.kind}: gap or overlap at ${bs[i].x0}`);
  }
});

test('pieces are never stretched or squashed by more than 15%', () => {
  for (const a of all) for (const p of a.plan.placements) assert(p.sx >= 0.85 && p.sx <= 1.15, `${a.level} ${a.kind}: ${p.piece} scaled ${p.sx.toFixed(2)}`);
});

test('neighbouring buildings are never the same design when there is a choice', () => {
  for (const a of all) {
    const ids = a.plan.buildings.map((b) => b.design.id);
    for (let i = 1; i < ids.length; i++) assert(ids[i] !== ids[i - 1] || a.kind === 'terrace', `${a.level} ${a.kind}: ${ids[i]} twice in a row`);
  }
});

test('doors the game needs are where the game expects them', () => {
  for (const a of all)
    for (const d of a.doors) {
      const near = a.plan.buildings.flatMap((b) => b.doors).some((x) => Math.abs(x - d) <= 1.2);
      assert(near, `${a.level} ${a.kind}: no doorway near the exit at x=${d}`);
    }
});

test('the city uses many designs, and each district its own mix', () => {
  const used = new Set(all.flatMap((a) => a.plan.buildings.map((b) => b.design.id)));
  assert(used.size >= 30, `only ${used.size} distinct designs appear in the game`);
  const byLevel = new Map<string, Set<string>>();
  for (const a of all) for (const b of a.plan.buildings) (byLevel.get(a.level) ?? byLevel.set(a.level, new Set()).get(a.level)!).add(b.design.category);
  assert(byLevel.get('industrial')?.has('industrial') && byLevel.get('city')?.has('office') && byLevel.get('estate')?.has('residential'), 'districts lost their character');
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
