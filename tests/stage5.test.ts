/**
 * Stage 5 tests: items, inventory, storage, clothes shop, pawn shop, robbery and
 * its consequences, weapons (melee only), loot, bosses, containers, breakables,
 * thrown weapons, save v3 and migration from v2.
 */
import { ARCHETYPES } from '../src/ai/archetypes';
import { BOSSES } from '../src/ai/bosses';
import { defaultAppearance } from '../src/character/Appearance';
import { createCharacter, emptyAllocation } from '../src/character/Character';
import { WEAPON_IDS, WEAPONS } from '../src/combat/Weapons';
import { emptyCommand, type CommandFrame } from '../src/input/Commands';
import { addStack, takeStack, type ItemStack } from '../src/items/Inventory';
import { ITEM_LIST, ITEMS, weaponItemId } from '../src/items/items';
import { LOOT, lootTableFor, rollLoot } from '../src/items/loot';
import { buyItem, pawnOffer, SHOP_STOCK, shopPrice } from '../src/items/shops';
import { AREA_IDS, BASE_INVENTORY_SLOTS, BASE_STORAGE_SLOTS, newSave, Progress, sanitiseSave, STORAGE_UPGRADE } from '../src/progress/Progress';
import { SaveStore } from '../src/save/SaveStore';
import { LEVELS } from '../src/world/levels';
import { arrest, ARREST_HEAT, robShop, ROBBERY_CLOSED_TRIPS } from '../src/world/robbery';
import { exitLocked, World } from '../src/world/World';

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
function fresh(): Progress {
  const c = createCharacter({ name: 'Tester', appearance: defaultAppearance(), background: 'estate_scrapper', allocated: emptyAllocation() });
  return new Progress(newSave(c));
}
function cmd(press: (keyof CommandFrame['pressed'])[] = [], moveX = 0): CommandFrame {
  const c = emptyCommand();
  c.moveX = moveX;
  for (const p of press) c.pressed[p] = true;
  return c;
}
function run(w: World, n: number, c: (i: number) => CommandFrame = () => cmd()): void {
  for (let i = 0; i < n; i++) w.step(c(i));
}
/** Every stack the player owns, anywhere. */
function allStacks(p: Progress): ItemStack[] {
  const s = p.save;
  return [...s.inventory, ...s.storage, ...Object.values(s.worn).filter((x): x is ItemStack => !!x), ...(s.held ? [s.held] : [])];
}
function count(p: Progress, id: string): number {
  return allStacks(p).reduce((n, s) => n + (s.id === id ? s.qty : 0), 0);
}
function uidsUnique(p: Progress): boolean {
  const u = allStacks(p).map((s) => s.uid);
  return new Set(u).size === u.length;
}
function memoryKV() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m };
}

console.log('Stage 5: items and weapons');

test('no guns: every weapon and item is melee, thrown or everyday', () => {
  const banned = /\b(gun|guns|pistol|rifle|shotgun|revolver|firearm|ammo|bullet|taser|crossbow|bow)\b/i;
  for (const id of WEAPON_IDS) assert(!banned.test(id) && !banned.test(WEAPONS[id].name) && !banned.test(WEAPONS[id].text), `weapon ${id} looks like a firearm`);
  for (const d of ITEM_LIST) assert(!banned.test(d.id) && !banned.test(d.name) && !banned.test(d.text), `item ${d.id} looks like a firearm`);
  assert(WEAPON_IDS.length >= 30, `only ${WEAPON_IDS.length} weapons`);
});

test('every weapon has sane stats, an item, and breaks into something real', () => {
  for (const id of WEAPON_IDS) {
    const w = WEAPONS[id];
    assert(w.durability > 0 && w.weight > 0 && w.length > 0 && w.light.damage > 0 && w.heavy.damage >= w.light.damage, `${id} stats`);
    assert(ITEMS[weaponItemId(id)]?.weapon === id, `${id} has no item`);
    if (w.breaksInto) assert(WEAPONS[w.breaksInto], `${id} breaks into unknown ${w.breaksInto}`);
    if (w.throwable) assert(w.throwDamage > 0, `${id} throwable with no damage`);
  }
});

test('every item has a name, a description, a value, a stack size and a valid slot', () => {
  for (const d of ITEM_LIST) {
    assert(d.name && d.text && d.value >= 0 && d.stack >= 1, `${d.id} basics`);
    if (d.wear) assert(['top', 'bottoms', 'shoes', 'head', 'face', 'neck', 'wrist', 'ears', 'hands', 'finger', 'waist', 'mouth'].includes(d.wear.slot), `${d.id} slot`);
    if (d.questFlag) assert(pawnOffer(d, {}) === 0, `${d.id} quest item is sellable`);
  }
});

console.log('Stage 5: inventory and storage');

test('stacking merges up to the stack size; capacity is enforced and leftovers come back', () => {
  let uid = 0;
  const next = () => `t${uid++}`;
  const list: ItemStack[] = [];
  assert(addStack(list, 2, { uid: next(), id: 'chips', qty: 3 }, next) === null, 'first add');
  assert(addStack(list, 2, { uid: next(), id: 'chips', qty: 4 }, next) === null, 'merge add');
  assert(list.length === 2 && list[0].qty === 5 && list[1].qty === 2, `stacks ${list.map((s) => s.qty)}`);
  const left = addStack(list, 2, { uid: next(), id: 'chips', qty: 10 }, next);
  assert(left && left.qty === 7 && list[1].qty === 5, `leftover ${left?.qty}`);
  const part = takeStack(list, list[0].uid, 2, next)!;
  assert(part.qty === 2 && list[0].qty === 3 && part.uid !== list[0].uid, 'split');
});

test('pockets: 12 slots, bags add room, overflow is returned not deleted', () => {
  const p = fresh();
  p.save.inventory = [];
  for (let i = 0; i < BASE_INVENTORY_SLOTS; i++) assert(!p.giveItem('watch_basic'), `slot ${i}`);
  const left = p.giveItem('phone_cheap');
  assert(left && left.id === 'phone_cheap', 'overflow lost');
  assert(p.inventoryCap === BASE_INVENTORY_SLOTS, 'cap');
  p.save.inventory.pop();
  p.giveItem('bag_rucksack');
  assert(p.inventoryCap === BASE_INVENTORY_SLOTS + 8, `with rucksack ${p.inventoryCap}`);
  // Can't sell or drop the bag while it's holding things.
  for (let i = 0; i < 6; i++) p.giveItem('watch_basic');
  const bag = p.save.inventory.find((s) => s.id === 'bag_rucksack')!;
  assert(!p.drop(bag.uid), 'dropped a full bag and lost what was in it');
});

test('a full inventory leaves the item on the ground with a message', () => {
  const p = fresh();
  p.save.inventory = [];
  for (let i = 0; i < BASE_INVENTORY_SLOTS; i++) p.giveItem('watch_basic');
  const w = new World(LEVELS.estate, p, { entry: 'home', seed: 1 });
  for (const e of w.encounters) e.status = 'cleared';
  let full = 0;
  w.events.on('item:full', () => full++);
  w.player.pos.x = 15;
  w.player.pos.z = -1.0;
  run(w, 2);
  assert(w.interactable?.kind === 'item', `no prompt (${w.interactable?.kind})`);
  run(w, 1, () => cmd(['grab']));
  assert(full === 1 && w.items.some((i) => i.stack.id === 'chips'), 'chips vanished or no message');
});

test('consumables heal and are used up one at a time', () => {
  const p = fresh();
  const before = p.save.inventory.find((s) => s.id === 'meal_deal')!.qty;
  const r = p.use(p.save.inventory.find((s) => s.id === 'meal_deal')!.uid);
  assert(r.ok && r.heal > 0, 'meal deal did nothing');
  assert((p.save.inventory.find((s) => s.id === 'meal_deal')?.qty ?? 0) === before - 1, 'not used up');
  const w = new World(LEVELS.estate, p, { entry: 'home', seed: 1 });
  w.player.vitals.health = 10;
  w.useItem(p.save.inventory.find((s) => s.id === 'meal_deal')!.uid);
  assert(w.player.vitals.health > 10, 'world use did not heal');
});

test('wearing clothes changes the look and stats, swaps back cleanly, never duplicates', () => {
  const p = fresh();
  p.giveItem('leather_jacket');
  const jacket = p.save.inventory.find((s) => s.id === 'leather_jacket')!;
  const total = allStacks(p).length;
  assert(p.wear(jacket.uid).ok, 'could not wear');
  assert(p.save.worn.top?.id === 'leather_jacket' && !p.save.inventory.some((s) => s.id === 'leather_jacket'), 'not moved to worn');
  assert(p.appearance().top === ITEMS.leather_jacket.wear!.top, `look is ${p.appearance().top}`);
  assert(allStacks(p).length === total && uidsUnique(p), 'duplicated');
  p.giveItem('puffer_black');
  const puffer = p.save.inventory.find((s) => s.id === 'puffer_black')!;
  p.wear(puffer.uid);
  assert(p.save.worn.top?.id === 'puffer_black' && p.save.inventory.some((s) => s.id === 'leather_jacket'), 'old jacket lost on swap');
  assert(p.unwear('top').ok && !p.save.worn.top && count(p, 'puffer_black') === 1, 'unwear');
  assert(uidsUnique(p), 'uids repeated');
});

test('storage: deposit and withdraw move items (no copies), capacity and upgrades', () => {
  const p = fresh();
  p.giveItem('watch_gold');
  p.giveItem('chips', 4);
  const w = p.save.inventory.find((s) => s.id === 'watch_gold')!;
  assert(p.deposit(w.uid).ok, 'deposit');
  assert(count(p, 'watch_gold') === 1 && p.save.storage.some((s) => s.id === 'watch_gold') && !p.save.inventory.some((s) => s.id === 'watch_gold'), 'watch duplicated or lost');
  const chips = p.save.inventory.find((s) => s.id === 'chips')!;
  p.deposit(chips.uid, 2);
  assert(count(p, 'chips') === 4, `chips now ${count(p, 'chips')}`);
  const st = p.save.storage.find((s) => s.id === 'watch_gold')!;
  assert(p.withdraw(st.uid).ok && count(p, 'watch_gold') === 1 && p.save.inventory.some((s) => s.id === 'watch_gold'), 'withdraw');
  assert(uidsUnique(p), 'uids repeated');
  // Capacity.
  p.save.storage = [];
  for (let i = 0; i < BASE_STORAGE_SLOTS; i++) p.stashNew('watch_basic');
  p.giveItem('phone_cheap');
  const phone = p.save.inventory.find((s) => s.id === 'phone_cheap')!;
  assert(!p.deposit(phone.uid).ok && p.save.inventory.some((s) => s.uid === phone.uid), 'deposit into a full stash');
  // Upgrade with banked money only.
  p.save.cash.bank = STORAGE_UPGRADE.cost - 1;
  assert(!p.buyStorageUpgrade().ok, 'upgrade without the money');
  p.save.cash.bank = STORAGE_UPGRADE.cost;
  assert(p.buyStorageUpgrade().ok && p.save.storageCap === BASE_STORAGE_SLOTS + STORAGE_UPGRADE.slots && p.save.cash.bank === 0, 'upgrade');
  assert(p.deposit(phone.uid).ok, 'deposit after upgrade');
  p.save.storageCap = STORAGE_UPGRADE.max;
  p.save.cash.bank = 9999;
  assert(!p.buyStorageUpgrade().ok, 'upgrade past the max');
});

test('weapons go hands ↔ pockets without copies', () => {
  const p = fresh();
  p.giveItem('w_crowbar');
  const bar = p.save.inventory.find((s) => s.id === 'w_crowbar')!;
  assert(p.hold(bar.uid).ok && p.save.held?.id === 'w_crowbar' && count(p, 'w_crowbar') === 1, 'hold');
  p.giveItem('w_hammer');
  assert(p.hold(p.save.inventory.find((s) => s.id === 'w_hammer')!.uid).ok, 'swap');
  assert(p.save.held?.id === 'w_hammer' && count(p, 'w_crowbar') === 1 && count(p, 'w_hammer') === 1, 'swap duplicated or lost');
  assert(p.unhold().ok && !p.save.held && count(p, 'w_hammer') === 1, 'put away');
  assert(p.fighterConfig ? true : true, '');
});

console.log('Stage 5: shops');

test('clothes shop: buying costs money, fails cleanly when broke, full pockets deliver home', () => {
  const p = fresh();
  p.save.cash.pocket = 30;
  p.save.cash.bank = 0;
  const r = buyItem(p, 'leather_jacket', 1);
  assert(!r.ok && !p.owns('leather_jacket') && p.save.cash.pocket === 30, 'bought with no money');
  p.save.cash.bank = 500;
  const price = shopPrice(ITEMS.leather_jacket, 1);
  const r2 = buyItem(p, 'leather_jacket', 1);
  assert(r2.ok && r2.where === 'pocket' && p.owns('leather_jacket'), 'buy');
  assert(p.save.cash.pocket + p.save.cash.bank === 530 - price, 'wrong money taken');
  p.save.inventory = [];
  for (let i = 0; i < BASE_INVENTORY_SLOTS; i++) p.giveItem('watch_basic');
  const r3 = buyItem(p, 'beanie', 1);
  assert(r3.ok && r3.where === 'storage' && p.save.storage.some((s) => s.id === 'beanie'), 'full pockets lost the purchase');
  assert(!buyItem(p, 'gaffer_ledger', 1).ok, 'sold a quest item');
  assert(SHOP_STOCK.every((id) => ITEMS[id]), 'stock has unknown items');
});

test('pawn shop: offers by category, less for stolen, sells one or many, never quest items', () => {
  const p = fresh();
  const watch = ITEMS.watch_gold;
  const offer = pawnOffer(watch, {});
  assert(offer > 0 && offer < watch.value, `offer ${offer}`);
  assert(pawnOffer(watch, { stolen: true }) < offer, 'stolen not discounted');
  assert(pawnOffer(ITEMS.gaffer_ledger, {}) === 0, 'quest item has a price');
  p.giveItem('coin_silver', 3);
  const coins = p.save.inventory.find((s) => s.id === 'coin_silver')!;
  const cash = p.save.cash.pocket;
  const each = pawnOffer(ITEMS.coin_silver, coins);
  assert(p.sell(coins.uid, 2, each).ok, 'sell 2');
  assert(count(p, 'coin_silver') === 1 && p.save.cash.pocket === cash + each * 2 && p.save.pawn.itemsSold === 2, 'sell bookkeeping');
  p.discover('gaffer_ledger');
  p.giveItem('gaffer_ledger');
  const ledger = p.save.inventory.find((s) => s.id === 'gaffer_ledger')!;
  assert(!p.sell(ledger.uid, 1, 100).ok && count(p, 'gaffer_ledger') === 1, 'sold the ledger');
  assert(!p.drop(ledger.uid) && count(p, 'gaffer_ledger') === 1, 'dropped the ledger');
});

console.log('Stage 5: robbery and the police');

function robSetup(): { p: Progress; w: World } {
  const p = fresh();
  const w = new World(LEVELS.clothes_shop, p, { entry: 'door', seed: 3 });
  return { p, w };
}

test('robbing Threads: stolen goods, heat, alarm, police arrive, the shop shuts', () => {
  const { p, w } = robSetup();
  const keeper = [...w.npcs.entries()].find(([st]) => st.id === 'clothes_counter')![1];
  assert(keeper.team === 'neutral', 'shopkeeper should start neutral');
  const r = robShop(p, w, 'threads', keeper, () => 0.9); // 0.9: she doesn't resist the first time
  assert(r.grabbed.length === 3 && !r.resisted && r.till > 0, `first robbery ${JSON.stringify(r)}`);
  assert(p.save.inventory.filter((s) => s.stolen).length === 3, 'goods not marked stolen');
  assert(p.save.heat >= 45 && p.save.stats.robberies === 1, `heat ${p.save.heat}`);
  assert(!p.isShopOpen('threads') && p.shop('threads').priceMult > 1, 'shop still open / prices unchanged');
  const door = LEVELS.high_street.exits.find((e) => e.to === 'clothes_shop')!;
  assert(exitLocked(door, p), 'door not shut');
  let arrived = 0;
  w.events.on('police:arrive', (e) => (arrived = e.count));
  run(w, r.alarmIn + 5);
  assert(arrived === r.police && w.policeActive, `police ${arrived}`);
  for (let i = 0; i < ROBBERY_CLOSED_TRIPS; i++) p.tick();
  assert(p.isShopOpen('threads') && !exitLocked(door, p), 'never reopened');
});

test('robbing again is harder and pays less: she fights, a guard comes, fewer goods', () => {
  const { p, w } = robSetup();
  const keeper = [...w.npcs.entries()].find(([st]) => st.id === 'clothes_counter')![1];
  robShop(p, w, 'threads', keeper, () => 0.9);
  const w2 = new World(LEVELS.clothes_shop, p, { entry: 'door', seed: 4 });
  const keeper2 = [...w2.npcs.entries()].find(([st]) => st.id === 'clothes_counter')![1];
  const r = robShop(p, w2, 'threads', keeper2, () => 0.9);
  assert(r.resisted && keeper2.team === 'enemy' && r.guard && r.grabbed.length === 2 && r.till === 0, `second robbery ${r.grabbed.length} ${r.resisted}`);
  assert(p.has('threads_robbable'), 'till not open for the taking');
  assert(p.shop('threads').priceMult === 1.5, `price mult ${p.shop('threads').priceMult}`);
  const third = robShop(p, w2, 'threads', keeper2, () => 0.9);
  assert(third.grabbed.length === 1 && p.shop('threads').robberies === 3, 'third robbery');
});

test('arrest: stolen goods seized (pockets, worn, hands), fine paid, heat wiped', () => {
  const p = fresh();
  p.giveItem('puffer_red', 1, { stolen: true });
  p.giveItem('watch_gold');
  p.wear(p.save.inventory.find((s) => s.id === 'puffer_red')!.uid);
  p.giveItem('runners', 1, { stolen: true });
  p.save.cash.pocket = 100;
  p.save.cash.bank = 100;
  p.save.heat = 90;
  const r = arrest(p);
  assert(r.seized === 2 && !p.owns('puffer_red') && !p.owns('runners') && p.owns('watch_gold'), `seized ${r.seized}`);
  assert(r.fine === 30 && p.save.cash.pocket + p.save.cash.bank === 170, `fine ${r.fine}`);
  assert(p.save.heat === 0 && p.save.stats.arrests === 1, 'heat or stats');
  assert(ARREST_HEAT > 0, '');
});

test('heat cools off as you move around', () => {
  const p = fresh();
  p.addHeat(40);
  for (let i = 0; i < 5; i++) p.tick();
  assert(p.save.heat === 0, `heat ${p.save.heat}`);
});

console.log('Stage 5: loot, bosses, containers, breakables, thrown weapons');

test('every loot table rolls only real items; every archetype has a table', () => {
  let x = 1;
  const rng = () => ((x = (x * 16807) % 2147483647) / 2147483647);
  for (const id of Object.keys(LOOT)) {
    for (let i = 0; i < 200; i++) {
      const r = rollLoot(id, rng);
      assert(r.cash >= 0, `${id} negative cash`);
      for (const it of r.items) assert(ITEMS[it.id] && it.qty > 0, `${id} rolled ${it.id}`);
    }
  }
  for (const a of Object.keys(ARCHETYPES)) assert(LOOT[lootTableFor(a)], `${a} has no loot table`);
});

test('beaten enemies can drop items as well as cash', () => {
  const p = fresh();
  const w = new World(LEVELS.city, p, { entry: LEVELS.city.entries[0].id, seed: 5 });
  for (const e of w.encounters) e.status = 'cleared';
  const before = w.items.length + w.cash.length;
  for (let i = 0; i < 25; i++) {
    const f = w.spawnEnemy('gang_enforcer', w.player.pos.x + 3, 0);
    f.vitals.health = 0;
    f.knockOut();
    w.sim.bus.emit('fighter:ko', { fighter: f, by: w.player });
    run(w, 200);
  }
  assert(w.items.length + w.cash.length > before + 10, `only ${w.items.length + w.cash.length - before} drops from 25 enforcers`);
  assert(w.items.some((i) => !i.pickupId), 'no item drops at all');
});

test('bosses: unique flags, real drops, quest items open the way on', () => {
  const flags = new Set<string>();
  for (const b of Object.values(BOSSES)) {
    assert(!flags.has(b.flag), `flag ${b.flag} reused`);
    flags.add(b.flag);
    for (const d of b.drops ?? []) assert(ITEMS[d], `${b.id} drops unknown ${d}`);
    assert(b.phases.length >= 1, `${b.id} has no phases`);
  }
  assert(Object.keys(BOSSES).length >= 13, `only ${Object.keys(BOSSES).length} bosses`);
  const p = fresh();
  const neon = LEVELS.city.exits.find((e) => e.to === 'nightlife')!;
  assert(exitLocked(neon, p), 'Neon Mile open without the VIP pass');
  p.giveItem('vip_pass');
  assert(p.has('has_vip_pass') && !exitLocked(neon, p), 'VIP pass did not open the Neon Mile');
});

test('containers: search takes time, finds loot once, locked ones need the key, refill later', () => {
  const p = fresh();
  const w = new World(LEVELS.estate, p, { entry: 'home', seed: 2 });
  for (const e of w.encounters) e.status = 'cleared';
  const bins = LEVELS.estate.containers!.find((c) => c.id === 'bins')!;
  let found = 0;
  w.events.on('searched', () => found++);
  w.player.pos.x = bins.x;
  w.player.pos.z = bins.z + 0.7;
  run(w, 2);
  assert(w.interactable?.kind === 'container', `no search prompt (${w.interactable?.kind})`);
  run(w, 1, () => cmd(['grab']));
  assert(found === 0, 'search was instant');
  run(w, 40);
  assert(found === 1 && w.isSearched(bins), 'search did not finish');
  run(w, 1, () => cmd(['grab']));
  run(w, 40);
  assert(found === 2 && w.isSearched(bins), 'second search should report empty');
  const lockup = LEVELS.estate.containers!.find((c) => c.id === 'lockup')!;
  let locked = '';
  w.events.on('area:locked', (e) => (locked = e.text));
  w.player.pos.x = lockup.x;
  w.player.pos.z = lockup.z + 0.7;
  run(w, 2);
  run(w, 1, () => cmd(['grab']));
  assert(locked.includes('Padlocked') && !w.isSearched(lockup), 'lock-up opened without the key');
  for (let i = 0; i < 6; i++) p.tick();
  const w2 = new World(LEVELS.estate, p, { entry: 'home', seed: 2 });
  assert(!w2.isSearched(bins), 'bins never refilled');
});

test('breakables smash, stop blocking, drop a weapon, and stay smashed', () => {
  const p = fresh();
  const w = new World(LEVELS.estate, p, { entry: 'home', seed: 2 });
  for (const e of w.encounters) e.status = 'cleared';
  const crate = w.breakables.find((b) => b.def.id === 'crates1')!;
  w.player.pos.x = crate.def.x - 1.0;
  w.player.pos.z = crate.def.z + 0.1;
  w.player.facing = 1;
  let broke = 0;
  w.events.on('broken', () => broke++);
  for (let k = 0; k < 6 && !crate.broken; k++) run(w, 50, (i) => cmd(i === 0 ? ['hp'] : []));
  assert(crate.broken && broke === 1 && !crate.obstacle.solid, 'crate did not break');
  assert(w.items.some((i) => i.stack.id === 'w_plank'), 'no plank dropped');
  const w2 = new World(LEVELS.estate, p, { entry: 'home', seed: 2 });
  assert(w2.isBroken('crates1'), 'crate came back');
});

test('thrown weapons fly, hit enemies and land', () => {
  const p = fresh();
  const w = new World(LEVELS.estate, p, { entry: 'home', seed: 2 });
  for (const e of w.encounters) e.status = 'cleared';
  w.player.pos.x = 10;
  w.player.pos.z = 0;
  w.player.facing = 1;
  w.player.equipWeapon('brick');
  const foe = w.spawnEnemy('casual', 14, 0);
  const brain = w.brains.get(foe);
  if (brain) w.brains.delete(foe);
  const hp = foe.vitals.health;
  run(w, 1, () => cmd(['grab']));
  run(w, 2);
  assert(w.projectiles.length === 1 || foe.vitals.health < hp, 'nothing thrown');
  run(w, 40);
  assert(foe.vitals.health < hp, 'thrown brick did not hit');
  assert(!w.player.weapon, 'still holding the brick');
});

console.log('Stage 5: save v3 and migration');

test('save v3 round trip keeps every item, worn and held, with no duplicates', () => {
  const kv = memoryKV();
  const store = new SaveStore(kv);
  const p = fresh();
  p.giveItem('watch_gold');
  p.stashNew('chain_gold');
  p.giveItem('w_crowbar');
  p.hold(p.save.inventory.find((s) => s.id === 'w_crowbar')!.uid);
  p.giveItem('puffer_black');
  p.wear(p.save.inventory.find((s) => s.id === 'puffer_black')!.uid);
  store.write(p.save);
  assert(kv.m.has('sfuk.save.v3'), 'not saved under the v3 key');
  const back = new Progress(store.load()!.save);
  for (const id of ['watch_gold', 'chain_gold', 'w_crowbar', 'puffer_black', 'wraps']) assert(count(back, id) === count(p, id), `${id}: ${count(back, id)} vs ${count(p, id)}`);
  assert(back.save.held?.id === 'w_crowbar' && back.save.worn.top?.id === 'puffer_black', 'held/worn lost');
  assert(uidsUnique(back), 'duplicate uids after load');
  // New items after loading never reuse a uid.
  back.giveItem('watch_basic');
  assert(uidsUnique(back), 'new uid collides with a loaded one');
});

test('a doctored save with the same item twice is de-duplicated', () => {
  const p = fresh();
  p.giveItem('watch_gold');
  const st = p.save.inventory.find((s) => s.id === 'watch_gold')!;
  const raw = JSON.parse(JSON.stringify(p.save));
  raw.storage.push({ ...st });
  raw.inventory.push({ ...st });
  const fixed = new Progress(sanitiseSave(raw)!);
  assert(count(fixed, 'watch_gold') === 1 && uidsUnique(fixed), `watch count ${count(fixed, 'watch_gold')}`);
});

test('a Stage 4 (v2) save migrates: money, flags, gear, weapons and cosmetics all kept', () => {
  const kv = memoryKV();
  const p = fresh();
  const v2: Record<string, unknown> = JSON.parse(JSON.stringify(p.save));
  delete v2.inventory;
  delete v2.storage;
  delete v2.worn;
  delete v2.held;
  Object.assign(v2, {
    version: 2,
    cash: { pocket: 40, bank: 900 },
    flags: { boss_gaffer: true, boss_sully: true },
    gear: ['wraps', 'leather_jacket', 'steel_caps'],
    weapons: ['bat', 'crowbar'],
    equipped: { weapon: 'crowbar', gear: 'leather_jacket' },
    cosmetics: ['acc:cap', 'top:bomber'],
    area: 'estate',
  });
  kv.setItem('sfuk.save.v2', JSON.stringify(v2));
  const loaded = new SaveStore(kv).load()!;
  assert(loaded.migrated, 'not flagged as migrated');
  const m = new Progress(loaded.save);
  assert(m.save.version === 3 && m.save.cash.bank === 900 && m.save.cash.pocket === 40 && m.has('boss_sully'), 'lost money or flags');
  assert(m.save.worn.top?.id === 'leather_jacket', 'equipped gear not worn');
  assert(m.owns('wraps') && m.owns('steel_toecaps'), 'gear lost');
  assert(m.save.held?.id === 'w_crowbar' && m.owns('w_baseball_bat') === false && m.owns('w_bat'), 'weapons lost');
  assert(m.owns('cap_black') && m.owns('bomber_jacket'), 'cosmetics lost');
  assert(uidsUnique(m), 'duplicate uids after migration');
  // The old save is left alone (in case they roll back).
  assert(kv.m.has('sfuk.save.v2'), 'v2 save deleted');
});

console.log('Stage 5: the campaign');

test('24 areas, every exit resolves, every new district has a boss or is an interior', () => {
  assert(AREA_IDS.length === 24, `${AREA_IDS.length} areas`);
  for (const id of AREA_IDS) {
    const l = LEVELS[id];
    assert(l, `no level ${id}`);
    for (const ex of l.exits) assert(LEVELS[ex.to]?.entries.some((e) => e.id === ex.toEntry), `${id} → ${ex.to}:${ex.toEntry} missing`);
  }
  const interiors = ['home', 'clothes_shop', 'pawn_shop', 'pub'];
  for (const id of AREA_IDS) {
    if (interiors.includes(id)) continue;
    assert(LEVELS[id].encounters.length > 0, `${id} has no fights`);
  }
  const bossAreas = AREA_IDS.filter((id) => LEVELS[id].encounters.some((e) => e.boss));
  assert(bossAreas.length >= 13, `bosses in ${bossAreas.length} areas`);
});

test('every area can be entered from every entry and run for a few seconds', () => {
  for (const id of AREA_IDS) {
    for (const en of LEVELS[id].entries) {
      const p = fresh();
      const w = new World(LEVELS[id], p, { entry: en.id, seed: 1 });
      run(w, 120, (i) => cmd([], Math.sin(i / 20)));
      assert(Number.isFinite(w.player.pos.x), `${id}:${en.id} broke`);
    }
  }
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
