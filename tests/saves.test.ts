/**
 * Save protection (src/save/SaveStore.ts): three slots with slot 1 where every older version saved, a checksum
 * beside each save, a backup and a timed snapshot, no write that would replace a good save with a bad one, and
 * export files that are checked before anything is written.
 */
import assert from 'node:assert/strict';
import { defaultAppearance } from '../src/character/Appearance';
import { createCharacter, emptyAllocation } from '../src/character/Character';
import { newSave, Progress, type GameSave } from '../src/progress/Progress';
import { checksum, parseImport, SaveStore } from '../src/save/SaveStore';

let passed = 0;
function ok(name: string, fn: () => void): void {
  fn();
  passed++;
  console.log(`  ok   ${name}`);
}
const kvOf = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m };
};
const fighter = (name: string): GameSave => new Progress(newSave(createCharacter({ name, appearance: defaultAppearance('male'), background: 'estate_scrapper', allocated: emptyAllocation() }))).save;

ok('an existing player is already in slot 1: an old-version save loads with nothing to migrate', () => {
  const kv = kvOf();
  const old = fighter('Old Timer');
  kv.setItem('sfuk.save.v3', JSON.stringify(old));
  const s = new SaveStore(kv);
  assert.equal(s.slot, 1);
  assert.equal(s.load()?.save.character.name, 'Old Timer');
  assert.equal(s.slots()[0].name, 'Old Timer');
});

ok('three slots, kept apart; the slot in use is remembered', () => {
  const kv = kvOf();
  const s = new SaveStore(kv);
  assert.ok(s.write(fighter('One')));
  s.slot = 2;
  assert.ok(s.write(fighter('Two')));
  assert.equal(new SaveStore(kv).slot, 2, 'remembered');
  assert.equal(s.load(1)?.save.character.name, 'One');
  assert.equal(s.load(2)?.save.character.name, 'Two');
  assert.equal(s.load(3), null);
  assert.deepEqual(s.slots().map((x) => x.name), ['One', 'Two', '']);
  s.clearSlot(2);
  assert.equal(s.load(2), null);
  assert.equal(s.load(1)?.save.character.name, 'One', 'clearing one slot leaves the others');
});

ok('a save that would not load is never written over a good one', () => {
  const kv = kvOf();
  const s = new SaveStore(kv);
  const good = fighter('Good');
  assert.ok(s.write(good));
  const before = kv.getItem('sfuk.save.v3');
  const bad = { ...good, character: null } as unknown as GameSave;
  assert.equal(s.write(bad), false);
  assert.equal(s.lastError, 'invalid');
  assert.equal(kv.getItem('sfuk.save.v3'), before, 'the good save is untouched');
});

ok('storage that refuses the write (full, blocked) is reported, and the old save stays', () => {
  const kv = kvOf();
  const s = new SaveStore(kv);
  assert.ok(s.write(fighter('Here')));
  const full = { ...kv, setItem: () => { throw new Error('QuotaExceededError'); } };
  const s2 = new SaveStore(full);
  assert.equal(s2.write(fighter('There')), false);
  assert.equal(s2.lastError, 'storage');
  assert.equal(new SaveStore(kv).load()?.save.character.name, 'Here');
});

ok('damage is caught by the checksum and the backup, then the snapshot, is used', () => {
  const kv = kvOf();
  const s = new SaveStore(kv);
  const p = fighter('Saver');
  p.level = 3;
  assert.ok(s.write(p));
  p.level = 4;
  assert.ok(s.write(p));
  // A snapshot was taken on the second write (none before), holding level 3.
  assert.ok(kv.getItem('sfuk.save.v3.snap'));
  kv.setItem('sfuk.save.v3', kv.getItem('sfuk.save.v3')!.replace('"level":4', '"level":9'));
  const r = s.load()!;
  assert.ok(r.recovered && r.from === 'backup' && r.save.level === 3, `backup (${r.from}, ${r.save.level})`);
  kv.setItem('sfuk.save.v3.backup', '{"cut off');
  const r2 = s.load()!;
  assert.ok(r2.recovered && r2.from === 'snapshot', 'then the snapshot');
  assert.ok(s.slots()[0].damaged, 'the saves screen says the slot was damaged');
});

ok('export files carry a checksum and are checked before anything is written; old raw exports still load', () => {
  const kv = kvOf();
  const s = new SaveStore(kv);
  assert.equal(s.exportSlot(1), null, 'nothing to export from an empty slot');
  assert.ok(s.write(fighter('Exported')));
  const file = s.exportSlot(1)!;
  const env = JSON.parse(file);
  assert.equal(env.game, 'hard-graft-save');
  assert.equal(env.sum, checksum(env.save));
  const back = parseImport(file);
  assert.ok(back.ok && back.save.character.name === 'Exported');
  assert.ok(!parseImport('not json').ok);
  assert.ok(!parseImport(JSON.stringify({ ...env, sum: '00000000' })).ok, 'a damaged file');
  assert.ok(!parseImport(JSON.stringify({ ...env, game: 'other-game' })).ok, 'another game');
  assert.ok(!parseImport(JSON.stringify({ ...env, format: 99 })).ok, 'a newer version');
  assert.ok(!parseImport(JSON.stringify({ hello: 1 })).ok, 'no fighter');
  assert.ok(parseImport(JSON.stringify(fighter('Raw'))).ok, 'a plain save (copied out of storage)');
  // Importing keeps what was in the slot as its backup.
  assert.ok(s.importInto((parseImport(JSON.stringify(fighter('New'))) as { save: GameSave }).save, 1));
  assert.equal(s.load(1)?.save.character.name, 'New');
  assert.ok(kv.getItem('sfuk.save.v3.backup')!.includes('Exported'));
});

console.log(`saves: ${passed} passed, 0 failed`);
