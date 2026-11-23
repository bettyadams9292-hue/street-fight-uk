/**
 * The hotbar (src/items/hotbar.ts, World.useHotbar): three slots, medical, food and weapon. Each uses the
 * next of its item from your pockets, works in a fight, and when its item runs out pulls in the next suitable
 * thing you carry. Changed from Pockets & bag; kept in the save; old saves start with "pick for me".
 */
import { defaultAppearance } from '../src/character/Appearance';
import { createCharacter, emptyAllocation } from '../src/character/Character';
import { emptyCommand } from '../src/input/Commands';
import { HOTBAR_KEYS, PAD, PAD_EXTRA, PAD_HOTBAR } from '../src/input/InputManager';
import { cycleHotbar, fitsSlot, HOTBAR_COOLDOWN, HOTBAR_SLOTS, hotbarChoices, hotbarView, sanitiseHotbar, setHotbar, slotFor } from '../src/items/hotbar';
import { ITEMS } from '../src/items/items';
import { newSave, Progress, sanitiseSave } from '../src/progress/Progress';
import { LEVELS } from '../src/world/levels';
import { World } from '../src/world/World';
import { SIM_HZ } from '../src/core/constants';
import { control } from '../src/tutorial/controls';

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
const street = LEVELS.high_street;
const wait = (w: World, seconds: number) => {
  for (let f = 0; f < Math.ceil(seconds * SIM_HZ); f++) w.step(emptyCommand());
};
const count = (p: Progress, id: string) => p.save.inventory.filter((s) => s.id === id).reduce((n, s) => n + s.qty, 0);

console.log('Hotbar');

test('items go in the right slot: medical kits, food and drink, weapons; never ingredients or clothes', () => {
  assert(slotFor(ITEMS.plasters) === 'medic' && slotFor(ITEMS.first_aid) === 'medic', 'plasters and first aid are medical');
  assert(slotFor(ITEMS.chips) === 'food' && slotFor(ITEMS.kebab) === 'food', 'takeaway food is food');
  assert(slotFor(ITEMS.w_baseball_bat) === 'weapon', 'a bat is a weapon');
  assert(slotFor(ITEMS.hoodie_grey) === null, 'a hoodie goes nowhere');
  for (const d of Object.values(ITEMS)) {
    if (d.ingredient) assert(!HOTBAR_SLOTS.some((s) => fitsSlot(s, d)), `ingredient ${d.id} is not hotbar food`);
    const fits = HOTBAR_SLOTS.filter((s) => fitsSlot(s, d));
    assert(fits.length <= 1, `${d.id} fits one slot at most (${fits.join(', ')})`);
  }
});

test('a slot with nothing chosen picks for you; one you chose sticks while you have it', () => {
  const p = progress();
  p.save.inventory = [];
  p.giveItem('plasters', 3);
  p.giveItem('first_aid', 1);
  assert(hotbarView(p.save, 'medic').stack?.id === 'plasters', 'most of first: plasters before the one first aid kit');
  setHotbar(p.save, 'first_aid');
  assert(hotbarView(p.save, 'medic').stack?.id === 'first_aid', 'your choice wins');
  assert(hotbarView(p.save, 'food').stack === null, 'no food on you: empty');
});

test('in a fight: patching up heals, uses one, and the slot keeps going until it runs out, then pulls in the next', () => {
  const p = progress();
  p.save.inventory = [];
  p.giveItem('first_aid', 1);
  p.giveItem('plasters', 2);
  setHotbar(p.save, 'first_aid');
  const w = new World(street, p, { entry: street.entries[0].id, seed: 4, civilians: false });
  w.spawnEnemy('thug', w.player.pos.x + 2.5, w.player.pos.z);
  w.step(emptyCommand());
  const v = w.player.vitals;
  v.health = v.maxHealth * 0.3;
  const before = v.health;
  const r = w.useHotbar('medic');
  assert(r.ok, `used it: ${r.text}`);
  assert(v.health > before + v.maxHealth * 0.5, `first aid healed (${before} -> ${v.health})`);
  assert(count(p, 'first_aid') === 0, 'the kit is gone');
  // The last kit's gone: the slot pulls in the plasters, for good.
  assert(r.next === 'plasters' && p.save.hotbar.medic === 'plasters', `next up: ${r.next}`);
  assert(hotbarView(p.save, 'medic').stack?.id === 'plasters', 'shows the plasters now');
  // Not straight away: a moment between uses.
  const again = w.useHotbar('medic');
  assert(!again.ok, 'can’t mash it');
  wait(w, HOTBAR_COOLDOWN + 0.1);
  v.health = v.maxHealth * 0.5;
  assert(w.useHotbar('medic').ok, 'plasters next');
  wait(w, HOTBAR_COOLDOWN + 0.1);
  assert(w.useHotbar('medic').ok, 'last plaster');
  assert(count(p, 'plasters') === 0, 'all used');
  wait(w, HOTBAR_COOLDOWN + 0.1);
  const none = w.useHotbar('medic');
  assert(!none.ok && /Nothing/.test(none.text), `nothing left says so: ${none.text}`);
});

test('food: eats one, fills you up and heals; when stuffed it says so and uses nothing', () => {
  const p = progress();
  p.save.inventory = [];
  p.giveItem('chips', 2);
  p.save.needs.hunger = 20;
  const w = new World(street, p, { entry: street.entries[0].id, seed: 4, civilians: false });
  w.step(emptyCommand());
  w.player.vitals.health = 40;
  assert(w.useHotbar('food').ok, 'ate');
  assert(count(p, 'chips') === 1 && p.save.needs.hunger > 20, 'one gone, less hungry');
  assert(w.player.vitals.health > 40, 'healed a little');
  wait(w, HOTBAR_COOLDOWN + 0.1);
  p.save.needs.hunger = 100;
  const r = w.useHotbar('food');
  assert(!r.ok && /stuffed/.test(r.text) && count(p, 'chips') === 1, `stuffed: ${r.text}`);
});

test('weapon: draws the slot’s weapon; when it breaks, the next weapon in your pockets is in the slot', () => {
  const p = progress();
  p.save.inventory = [];
  p.save.held = null;
  p.giveItem('w_baseball_bat', 1);
  p.giveItem('w_hammer', 1);
  const w = new World(street, p, { entry: street.entries[0].id, seed: 4, civilians: false });
  w.step(emptyCommand());
  w.player.weapon = null;
  assert(hotbarView(p.save, 'weapon').stack?.id === 'w_baseball_bat', 'best weapon first (the bat)');
  // Straight after patching up: a weapon never waits on the heal.
  p.giveItem('plasters', 1);
  w.player.vitals.health = 40;
  assert(w.useHotbar('medic').ok, 'patched up');
  assert(w.hotbarWait > 0.9, 'the wait has started');
  const r = w.useHotbar('weapon');
  assert(r.ok && w.player.weapon?.data.id === 'baseball_bat', `bat out straight after: ${r.text}`);
  assert(hotbarView(p.save, 'weapon').stack?.id === 'w_hammer', 'the hammer is next in the slot');
  // The bat breaks in the fight: the slot already holds the hammer, ready to draw.
  w.player.weapon = null;
  w.step(emptyCommand());
  assert(p.save.held === null, 'hands empty after it broke');
  wait(w, HOTBAR_COOLDOWN + 0.1);
  assert(w.useHotbar('weapon').ok && w.player.weapon?.data.id === 'hammer', 'hammer out');
  // Nothing else to draw: the slot puts the one in your hands away.
  wait(w, HOTBAR_COOLDOWN + 0.1);
  const away = w.useHotbar('weapon');
  assert(away.ok && !w.player.weapon && count(p, 'w_hammer') === 1, `put away: ${away.text}`);
});

test('drinks have their own slot: a can or energy drink mid-fight, refilled from your pockets; food leaves them alone', () => {
  assert(slotFor(ITEMS.energy_drink) === 'drink' && slotFor(ITEMS.can_of_pop) === 'drink' && slotFor(ITEMS.water) === 'drink' && slotFor(ITEMS.flask_tea) === 'drink', 'the four drinks');
  assert(!fitsSlot('food', ITEMS.energy_drink), 'not food');
  const p = progress();
  p.save.inventory = [];
  p.giveItem('energy_drink', 1);
  p.giveItem('water', 2);
  p.giveItem('chips', 1);
  setHotbar(p.save, 'energy_drink');
  assert(hotbarView(p.save, 'food').stack?.id === 'chips', 'food slot has the chips, not a drink');
  const w = new World(street, p, { entry: street.entries[0].id, seed: 4, civilians: false });
  w.spawnEnemy('thug', w.player.pos.x + 2.5, w.player.pos.z);
  w.step(emptyCommand());
  const v = w.player.vitals;
  v.stamina = 10;
  const r = w.useHotbar('drink');
  assert(r.ok && v.stamina > 50, `energy drink: ${r.text} (stamina ${v.stamina})`);
  assert(r.next === 'water' && hotbarView(p.save, 'drink').stack?.id === 'water', `water next: ${r.next}`);
  // Shares the wait with heals and food, so it can't be mashed either.
  assert(!w.useHotbar('drink').ok && !w.useHotbar('food').ok, 'waits');
  wait(w, HOTBAR_COOLDOWN + 0.1);
  assert(w.useHotbar('drink').ok, 'water');
});

test('changing a slot from Pockets & bag cycles through what you carry that fits', () => {
  const p = progress();
  p.save.inventory = [];
  p.giveItem('chips', 1);
  p.giveItem('kebab', 1);
  p.giveItem('pasty', 1);
  const ids = hotbarChoices(p.save, 'food');
  assert(ids.length === 3, `three choices: ${ids.join(', ')}`);
  const seen = new Set<string>();
  for (let i = 0; i < 3; i++) seen.add(cycleHotbar(p.save, 'food')!);
  assert(seen.size === 3, 'goes through every one');
  assert(setHotbar(p.save, 'hoodie_grey') === null, 'a hoodie can’t go on the hotbar');
});

test('saved and loaded; old saves and junk get "pick for me"', () => {
  const p = progress();
  setHotbar(p.save, 'first_aid');
  const back = sanitiseSave(JSON.parse(JSON.stringify(p.save)));
  assert(back?.hotbar.medic === 'first_aid', 'kept across a save');
  const old = JSON.parse(JSON.stringify(p.save));
  delete old.hotbar;
  const fromOld = sanitiseSave(old);
  assert(fromOld && HOTBAR_SLOTS.every((s) => fromOld.hotbar[s] === null), 'old save: nothing chosen');
  const junk = sanitiseHotbar({ medic: 'kebab', food: 42, weapon: 'no_such' });
  assert(junk.medic === null && junk.food === null && junk.weapon === null, 'wrong-slot and unknown ids dropped');
});

test('controls: 1–4; Back with X, Y, A, B on a pad; named in prompts for every device', () => {
  assert(HOTBAR_KEYS.map((k) => k[0]).join() === 'Digit1,Digit2,Digit3,Digit4', 'number keys');
  assert(PAD_EXTRA.hotbar === PAD.BACK && PAD_HOTBAR.join() === [PAD.X, PAD.Y, PAD.A, PAD.B].join(), 'pad combos');
  assert(HOTBAR_SLOTS.join() === 'medic,food,drink,weapon', 'slot order matches the keys');
  assert(control('hotbar', 'keyboard') === '1 / 2 / 3 / 4', control('hotbar', 'keyboard'));
  assert(/BACK/.test(control('hotbar', 'gamepad')), control('hotbar', 'gamepad'));
  assert(control('hotbar', 'touch').length > 0, 'touch');
});

console.log(`\nhotbar: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
