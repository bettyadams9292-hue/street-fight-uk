/**
 * Fighters for hire in the Red Lion's snug leave their seat once hired (World justHired): they aren't drawn at
 * the bar again (on this visit's rebuild or any later one), they get up from where you hired them and come
 * over to you, and with no room in your crew they walk out of the door on their way home.
 */
import { defaultAppearance } from '../src/character/Appearance';
import { createCharacter, emptyAllocation } from '../src/character/Character';
import { COMPANIONS, hireCompanion } from '../src/companions/companions';
import { emptyCommand } from '../src/input/Commands';
import { newSave, Progress } from '../src/progress/Progress';
import { LEVELS } from '../src/world/levels';
import { World } from '../src/world/World';
import { SIM_HZ } from '../src/core/constants';

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
function assert(c: unknown, msg: string): asserts c {
  if (!c) throw new Error(msg);
}

const progress = () => {
  const p = new Progress(newSave(createCharacter({ name: 'T', appearance: defaultAppearance(), background: 'estate_scrapper', allocated: emptyAllocation() })));
  p.save.cash.pocket = 10_000;
  return p;
};
const pub = LEVELS.pub;
const seat = (id: string) => pub.stations!.find((s) => s.id === 'recruit' && s.tab === id)!;
const seatsIn = (w: World) => w.stations.filter((s) => s.id === 'recruit').map((s) => s.tab);
const nameAt = (w: World, name: string) => w.sim.fighters.filter((f) => f.name === name);

console.log('Hiring in the Red Lion');

test('before hiring, everyone for hire has a seat', () => {
  const w = new World(pub, progress(), { entry: 'door', seed: 1, civilians: false });
  for (const id of ['shaz', 'danny', 'paddy']) assert(seatsIn(w).includes(id), `${id} at the bar`);
});

test('hired and following: no seat, and they come over from where they sat', () => {
  const p = progress();
  const s = seat('shaz');
  assert(hireCompanion(p, 'shaz').ok, 'hired Shaz');
  assert(p.save.companions.following.includes('shaz'), 'Shaz follows (room in the crew)');
  // The bar rebuilt where you stand, by the seat.
  const w = new World(pub, p, { entry: 'door', seed: 1, civilians: false, at: { x: s.x, z: s.z }, companions: [COMPANIONS.shaz], justHired: 'shaz' });
  assert(!seatsIn(w).includes('shaz'), 'no Shaz station at the bar');
  assert(seatsIn(w).includes('danny'), 'the others are still for hire');
  const crew = w.crew.find((m) => m.def.id === 'shaz');
  assert(crew, 'Shaz is in your crew');
  assert(Math.abs(crew.f.pos.x - s.x) < 1.2, `got up from the seat (x ${crew.f.pos.x.toFixed(2)} vs seat ${s.x})`);
  // Only one Shaz in the room.
  assert(w.sim.fighters.filter((f) => f.name === crew.f.name).length === 1, 'one of her, not one at the bar too');
});

test('a later visit: still no seat for anyone you have hired', () => {
  const p = progress();
  hireCompanion(p, 'danny');
  const w = new World(pub, p, { entry: 'door', seed: 2, civilians: false });
  assert(!seatsIn(w).includes('danny'), 'Danny’s gone from the bar');
  assert(nameAt(w, 'Danny').length === 0 && !w.stations.some((s) => s.tab === 'danny'), 'nobody standing at his seat');
});

test('hired with the crew full: they walk out of the door and are gone', () => {
  const p = progress();
  hireCompanion(p, 'shaz');
  hireCompanion(p, 'paddy');
  assert(!p.save.companions.following.includes('paddy'), 'Paddy not following (one slot early on)');
  const s = seat('paddy');
  const w = new World(pub, p, { entry: 'door', seed: 3, civilians: false, at: { x: s.x, z: s.z }, companions: [COMPANIONS.shaz], justHired: 'paddy' });
  assert(!seatsIn(w).includes('paddy'), 'no Paddy station');
  const leaver = w.sim.fighters.find((f) => f.team === 'neutral' && Math.abs(f.pos.x - s.x) < 1.2 && !w.crew.some((m) => m.f === f) && !w.npcs.has(seat('shaz')));
  assert(leaver, 'Paddy gets up from his seat');
  const x0 = leaver.pos.x;
  const door = pub.exits[0].x;
  let gone = false;
  for (let i = 0; i < SIM_HZ * 40 && !gone; i++) {
    w.step(emptyCommand());
    gone = !w.sim.fighters.includes(leaver);
  }
  assert(gone, `he left (last x ${leaver.pos.x.toFixed(1)}, door ${door})`);
  assert(Math.abs(leaver.pos.x - door) < Math.abs(x0 - door), 'walking towards the door, not away');
});

console.log(`\nhiring: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
