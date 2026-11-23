/**
 * The fridge and cupboards: what you'd have cold (milk, cheese, ham, tomatoes, bread, cereal) can be eaten or
 * drunk as it is, from the fridge or from your pockets; raw ingredients stay for cooking. Every recipe still
 * uses them, and the hotbar's food slot still leaves groceries alone.
 */
import { defaultAppearance } from '../src/character/Appearance';
import { createCharacter, emptyAllocation } from '../src/character/Character';
import { fitsSlot } from '../src/items/hotbar';
import { ITEMS } from '../src/items/items';
import { RECIPES, STARTER_GROCERIES } from '../src/home/recipes';
import { newSave, Progress } from '../src/progress/Progress';

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

const progress = () => new Progress(newSave(createCharacter({ name: 'T', appearance: defaultAppearance(), background: 'estate_scrapper', allocated: emptyAllocation() })));
const COLD = ['g_milk', 'g_cheese', 'g_ham', 'g_tomatoes', 'g_bread', 'g_cereal'];
const RAW = ['g_bacon', 'g_sausages', 'g_chicken', 'g_eggs', 'g_mince', 'g_steak', 'g_potatoes', 'g_peas', 'g_oven_chips', 'g_butter', 'g_rice', 'g_pasta'];

console.log('Fridge');

test('cold groceries can be had as they are; raw ones can’t', () => {
  for (const id of COLD) assert(ITEMS[id].use?.needs && ITEMS[id].use!.needs!.fill > 0, `${id} edible`);
  for (const id of RAW) assert(!ITEMS[id].use, `${id} stays raw`);
});

test('a new house’s fridge has something to eat or drink straight away', () => {
  const fridgeOnes = STARTER_GROCERIES.filter((g) => ITEMS[g.id]?.store === 'fridge' && ITEMS[g.id].use?.needs);
  assert(fridgeOnes.length >= 3, `edible in the starter fridge: ${fridgeOnes.map((g) => g.id).join(', ')}`);
});

test('still ingredients: every recipe that used them still can, and they stay off the hotbar', () => {
  for (const id of COLD) {
    assert(ITEMS[id].ingredient, `${id} is still an ingredient`);
    assert(!fitsSlot('food', ITEMS[id]), `${id} not on the food slot`);
  }
  const used = new Set(RECIPES.flatMap((r) => r.ingredients.map((g) => g.id)));
  assert(COLD.some((id) => used.has(id)), 'recipes use them');
});

test('from your pockets: drinking milk fills you a little and uses one', () => {
  const p = progress();
  p.save.inventory = [];
  p.giveItem('g_milk', 2);
  p.save.needs.hunger = 30;
  const uid = p.save.inventory[0].uid;
  const r = p.use(uid);
  assert(r.ok, r.ok ? '' : r.reason);
  assert(p.save.needs.hunger > 30, 'less hungry');
  assert(p.save.inventory.reduce((n, s) => n + (s.id === 'g_milk' ? s.qty : 0), 0) === 1, 'one left');
});

console.log(`\nfridge: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
