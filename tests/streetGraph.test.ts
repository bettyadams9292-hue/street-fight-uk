/**
 * The town as a graph: the main road (the districts end to end), the side streets that leave it at junctions and
 * come back onto it somewhere else, the doors into places and the Metro's stairs. Every link must lead somewhere
 * real, streets must join both ways, side streets must make loops, and no side street may be a way round the story.
 */
import { defaultAppearance } from '../src/character/Appearance';
import { createCharacter, emptyAllocation } from '../src/character/Character';
import { AREA_IDS, newSave, Progress, sanitiseSave, type AreaId } from '../src/progress/Progress';
import { DISTRICT_ORDER, LEVELS } from '../src/world/levels';
import { isJunction, isSideStreet, SIDE_STREETS, junctionEntry, JUNCTION_GAP } from '../src/world/sideStreets';
import { onStrip, isSubwayStairs, SUBWAY_GAP } from '../src/world/strip';
import { exitLocked } from '../src/world/World';
import { route, nextExit, unlocked, roads } from '../src/map/worldMap';
import type { ExitDef } from '../src/world/LevelTypes';

let failed = 0;
function test(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`  ok   ${name}`);
  } catch (e) {
    failed++;
    console.log(`  FAIL ${name}\n       ${(e as Error).message}`);
  }
}
function assert(c: unknown, msg: string): asserts c {
  if (!c) throw new Error(msg);
}
function fresh(): Progress {
  const c = createCharacter({ name: 'Tester', appearance: defaultAppearance(), background: 'estate_scrapper', allocated: emptyAllocation() });
  return new Progress(newSave(c));
}

const outdoor = (id: AreaId) => onStrip(id) || isSideStreet(id);

/** Areas reachable from home through open exits, optionally ignoring side streets altogether. */
function reach(p: Progress, sides: boolean): Set<AreaId> {
  const seen = new Set<AreaId>(['home']);
  const q: AreaId[] = ['home'];
  while (q.length) {
    const a = q.shift()!;
    for (const ex of LEVELS[a].exits) {
      if (!sides && (isSideStreet(ex.to) || isSideStreet(a))) continue;
      if (exitLocked(ex, p) || seen.has(ex.to)) continue;
      seen.add(ex.to);
      q.push(ex.to);
    }
  }
  return seen;
}

console.log('Street graph');

test('every link leads somewhere real: its area exists and so does the spot you arrive at', () => {
  for (const id of AREA_IDS) {
    const lv = LEVELS[id];
    for (const ex of lv.exits) {
      const to = LEVELS[ex.to];
      assert(to, `${id}: ${ex.id} goes to ${ex.to}, which isn't an area`);
      // The property is built per visit and the Metro platforms arrive by their own rule.
      if (ex.to === 'property') continue;
      assert(to.entries.some((e) => e.id === ex.toEntry), `${id}: ${ex.id} arrives at "${ex.toEntry}" in ${ex.to}, which has no such spot`);
    }
  }
});

test('streets join both ways: every way from one street to another has a way back', () => {
  for (const id of AREA_IDS) {
    if (!outdoor(id)) continue;
    for (const ex of LEVELS[id].exits) {
      if (!outdoor(ex.to)) continue;
      const back = LEVELS[ex.to].exits.some((b) => b.to === id);
      assert(back, `${id} → ${ex.to} (${ex.id}) has no way back`);
    }
  }
});

test('a junction is a gap you turn into, with an arrival spot in front of it, clear of other doors and stairwells', () => {
  for (const [sid, s] of Object.entries(SIDE_STREETS)) {
    for (const side of ['left', 'right'] as const) {
      const host = LEVELS[s[side].street];
      const j = host.exits.find((e) => isJunction(e) && e.to === sid);
      assert(j, `${host.id} has no junction into ${sid}`);
      assert(j.label.startsWith('Turn into'), `junction label "${j.label}"`);
      const arrive = host.entries.find((e) => e.id === junctionEntry(sid));
      assert(arrive && Math.abs(arrive.x - j.x) < 0.5, `${host.id}: no arrival spot at the ${sid} junction`);
      const b = host.bounds;
      assert(j.x - JUNCTION_GAP > b.minX + 1 && j.x + JUNCTION_GAP < b.maxX - 1, `${host.id}: the ${sid} junction runs off the end of the street`);
      for (const o of host.exits) {
        if (o === j || o.kind !== 'door') continue;
        const half = isSubwayStairs(host, o) ? SUBWAY_GAP : isJunction(o) ? JUNCTION_GAP : 0.8;
        assert(Math.abs(o.x - j.x) > JUNCTION_GAP + half, `${host.id}: the ${sid} junction (x ${j.x}) overlaps ${o.id} (x ${o.x})`);
      }
      // Its own end comes out at that junction.
      const end = s.level.exits.find((e) => e.kind === 'edge' && e.side === side);
      assert(end && end.to === host.id && end.toEntry === junctionEntry(sid), `${sid}'s ${side} end doesn't come out at its junction`);
    }
  }
});

test('side streets make loops: each joins two streets that the main road joins too, so there are two ways round', () => {
  const p = fresh();
  for (const d of DISTRICT_ORDER) p.save.flags[d.flag] = true;
  for (const [sid, s] of Object.entries(SIDE_STREETS)) {
    const a = s.left.street;
    const b = s.right.street;
    assert(a !== b, `${sid} joins ${a} to itself`);
    // The way by the main road, without the side street.
    const seen = new Set<AreaId>([a]);
    const q: AreaId[] = [a];
    while (q.length) {
      const x = q.shift()!;
      for (const ex of LEVELS[x].exits) if (onStrip(ex.to) && onStrip(x) && !seen.has(ex.to)) seen.add(ex.to), q.push(ex.to);
    }
    assert(seen.has(b), `${a} and ${b} are joined only by ${sid}`);
    // And the side street itself is a way through.
    const r = route(p, a, b);
    assert(r && r.length >= 1, `no route from ${a} to ${b} with everything open`);
  }
});

test('no side street is a way round the story: at every stage, the same places are open with or without them', () => {
  const p = fresh();
  const stages: string[][] = [[]];
  for (const d of DISTRICT_ORDER) stages.push([...stages[stages.length - 1], d.flag]);
  for (const flags of stages) {
    p.save.flags = {};
    for (const f of flags) p.save.flags[f] = true;
    const without = reach(p, false);
    const withSides = reach(p, true);
    for (const id of withSides) {
      if (isSideStreet(id)) continue;
      assert(without.has(id), `after [${flags.join(', ') || 'nothing'}] ${id} is open only through a side street`);
    }
  }
});

test('the map shows every side street as a road, and the route finder uses them', () => {
  const ids = new Set(roads().map((r) => r.id));
  for (const sid of Object.keys(SIDE_STREETS)) assert(ids.has(sid as AreaId), `${sid} isn't on the map`);
  const p = fresh();
  for (const d of DISTRICT_ORDER) p.save.flags[d.flag] = true;
  // Hollins to the Back Alleys: through Mill Lane is one street between them; the main road is two.
  const r = route(p, 'residential', 'alleys');
  assert(r && r.length === 2 && r[0] === 'mill_lane', `route ${JSON.stringify(r)}`);
  const step = nextExit(p, 'residential', 'alleys') as ExitDef | null;
  assert(step && isJunction(step), `first step ${step?.id}`);
});

test('a locked end says why, and a new game can walk Mill Lane but not come out of it into the alleys', () => {
  const p = fresh();
  assert(unlocked(p, 'mill_lane' as AreaId), 'Mill Lane is shut on a new game');
  const out = SIDE_STREETS.mill_lane.level.exits.find((e) => e.to === 'alleys')!;
  assert(exitLocked(out, p) && /Gaffer/.test(out.lockedText ?? ''), 'the alleys end of Mill Lane should be locked until the Gaffer');
  assert(!exitLocked(SIDE_STREETS.mill_lane.level.exits.find((e) => e.to === 'residential')!, p), 'the Hollins end should be open');
});

test('a save on a side street loads there, and side streets count as places you have been', () => {
  const p = fresh();
  p.save.area = 'mill_lane' as AreaId;
  p.save.visited.push('mill_lane' as AreaId);
  const back = sanitiseSave(JSON.parse(JSON.stringify(p.save)))!;
  assert(back.area === 'mill_lane', `area ${back.area}`);
  assert(back.visited.includes('mill_lane' as AreaId), 'visited');
});

console.log(failed ? `${failed} failed` : 'all passed');
if (failed) process.exit(1);
