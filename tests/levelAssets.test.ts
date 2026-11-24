/**
 * Each level's model list (src/performance/levelAssets.generated.ts) matches what building the level asks
 * for today, so a new piece of furniture can't be left out of what a location waits for; the lists only name
 * real pieces; levels built from the save wait for everything.
 */
import assert from 'node:assert/strict';
import { recordLevelDeps } from '../tools/assets/levelDeps';
import { LEVEL_MODELS } from '../src/performance/levelAssets.generated';
import { DYNAMIC_LEVELS, levelModels, levelReady, recordLevel } from '../src/performance/levelAssets';
import { LevelView } from '../src/render/LevelView';
import { resolveLevel } from '../src/property/levels';
import { Progress, newSave } from '../src/progress/Progress';
import { createCharacter, emptyAllocation } from '../src/character/Character';
import { defaultAppearance } from '../src/character/Appearance';
import { SETS } from '../src/render/props/modelSet';

const now = await recordLevelDeps();
assert.deepEqual(LEVEL_MODELS, now, 'levelAssets.generated.ts is stale: run npx tsx tools/assets/levelDeps.ts');
for (const [level, deps] of Object.entries(LEVEL_MODELS)) {
  for (const [set, ids] of Object.entries(deps)) {
    const s = SETS.get(set);
    assert.ok(s, `${level}: no model set ${set}`);
    for (const id of ids) assert.ok(s!.ids.includes(id), `${level}: ${set} has no ${id}`);
  }
}
for (const id of DYNAMIC_LEVELS) {
  assert.equal(levelModels(id), null, `${id} (arriving, not yet recorded) waits for every set`);
  if (LEVEL_MODELS[id]) assert.equal(levelModels(id, true), LEVEL_MODELS[id], `${id} streamed next door uses its plain definition`);
}
// Home, the basement and the estate are listed in the game from this visit's version (Game.enterArea).
const p = new Progress(newSave(createCharacter({ name: 'A', appearance: defaultAppearance('male'), background: 'estate_scrapper', allocated: emptyAllocation() })));
for (const id of ['home', 'basement', 'estate'] as const) {
  recordLevel(id, () => new LevelView(resolveLevel(id, p.save), p).dispose());
  const deps = levelModels(id);
  assert.ok(deps, `${id} recorded`);
  for (const [set, ids] of Object.entries(deps!)) for (const m of ids) assert.ok(SETS.get(set)!.ids.includes(m as never), `${id}: ${set}/${m}`);
}
assert.ok(Object.keys(levelModels('home')!).length > 0, 'home asks for some models');
assert.equal(levelModels('property'), null, 'a property interior waits for every set');
// Nothing has loaded in Node: a level with models isn't ready, one with none is.
const withModels = Object.keys(LEVEL_MODELS).find((k) => Object.keys(LEVEL_MODELS[k]).length)!;
const without = Object.keys(LEVEL_MODELS).find((k) => !Object.keys(LEVEL_MODELS[k]).length);
assert.equal(levelReady(withModels), false);
if (without) assert.equal(levelReady(without), true);
console.log(`levelAssets: ${Object.keys(LEVEL_MODELS).length} levels' model lists up to date`);
process.exit(0);
