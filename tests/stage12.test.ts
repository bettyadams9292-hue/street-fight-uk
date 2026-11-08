/**
 * Stage 12 tests: the interactive house. Needs (hunger, energy, hygiene,
 * teeth, bladder, diet) and their effects; real ingredients in the fridge and
 * cupboards; every recipe; cooking as a sequence of real actions in the house
 * (fridge, worktop, hob or oven, plating up) that uses up the ingredients;
 * sitting down to eat, with the crew joining; the shower, the sinks, the
 * toilet, the bed and the telly; stopping any of them part way without
 * getting stuck; companions keeping clear; and saves.
 */
import { defaultAppearance } from '../src/character/Appearance';
import { createCharacter, emptyAllocation } from '../src/character/Character';
import { newSave, Progress, sanitiseSave } from '../src/progress/Progress';
import { World } from '../src/world/World';
import { emptyCommand, type CommandFrame } from '../src/input/Commands';
import { resolveLevel } from '../src/property/levels';
import { buyFurniture, placeFurniture } from '../src/property/state';
import { FURNITURE } from '../src/property/catalogue';
import { HOUSE_SPOTS, HOME_WALLS, suggestSpot } from '../src/property/home';
import { ITEMS } from '../src/items/items';
import { COMPANIONS, crewState, hireCompanion } from '../src/companions/companions';
import { HouseController, type HouseHost } from '../src/home/house';
import { RECIPES, RECIPE_BY_ID, STARTER_GROCERIES, have, missing, useIngredients, storeOf } from '../src/home/recipes';
import { NEED_RATES, attention, defaultNeeds, eat, hygieneLevel, needLabel, needsModifiers, sanitiseNeeds, tickNeeds } from '../src/home/needs';
import { activityPose } from '../src/render/activityPoses';
import { currentFatigue } from '../src/training/gym';
import { addInjury } from '../src/condition/condition';
import type { HouseFxSpec } from '../src/render/HouseFX';

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
function fresh(cash = 100000): Progress {
  const c = createCharacter({ name: 'Tester', appearance: defaultAppearance(), background: 'estate_scrapper', allocated: emptyAllocation() });
  const p = new Progress(newSave(c));
  p.save.cash.bank = cash;
  for (const f of ['boss_gaffer', 'boss_sully', 'boss_ratcatcher']) p.save.flags[f] = true;
  return p;
}
function place(p: Progress, id: string, room: 'living' | 'kitchen' | 'bedroom' | 'bathroom'): void {
  buyFurniture(p, id, FURNITURE[id].colours[0]);
  const piece = p.save.property.furniture[p.save.property.furniture.length - 1];
  const spot = suggestSpot(p.save.property, FURNITURE[id], room, piece.uid)!;
  assert(spot && placeFurniture(p, piece.uid, spot).ok, `placed ${id}`);
}

interface Log {
  fx: Map<string, HouseFxSpec>;
  fxSeen: Set<string>;
  sounds: string[];
  loops: Set<string>;
  loopsSeen: Set<string>;
  toasts: string[];
  panels: number;
  said: string[];
}

function house(p: Progress, crew: string[] = []): { w: World; h: HouseController; log: Log; run: (secs: number, input?: (t: number) => CommandFrame) => void; poses: Set<string> } {
  for (const id of crew) hireCompanion(p, id);
  const level = resolveLevel('home', p.save);
  const w = new World(level, p, { entry: 'start', seed: 5, civilians: false, home: { residents: crew.map((id) => COMPANIONS[id]), arriving: [] } });
  const log: Log = { fx: new Map(), fxSeen: new Set(), sounds: [], loops: new Set(), loopsSeen: new Set(), toasts: [], panels: 0, said: [] };
  const host: HouseHost = {
    world: () => w,
    progress: () => p,
    fx: (k, s) => {
      if (s) {
        log.fx.set(k, s);
        log.fxSeen.add(k);
      } else log.fx.delete(k);
    },
    sound: (k) => log.sounds.push(k),
    loop: (id, on) => {
      if (on) {
        log.loops.add(id);
        log.loopsSeen.add(id);
      } else log.loops.delete(id);
    },
    toast: (t) => log.toasts.push(t),
    say: (t) => log.said.push(t),
    panel: () => log.panels++,
    refresh: () => p.applyModifiers(w.player, w.difficulty),
    save: () => {},
    restAtHome: () => {
      for (const i of [...p.save.condition.injuries]) i.severity > 1 ? (i.severity = (i.severity - 1) as 1 | 2) : p.save.condition.injuries.splice(p.save.condition.injuries.indexOf(i), 1);
      return 'Rested.';
    },
  };
  const h = new HouseController(host);
  const poses = new Set<string>();
  let t = 0;
  const run = (secs: number, input?: (t: number) => CommandFrame) => {
    for (let i = 0; i < Math.round(secs * 60); i++) {
      t += 1 / 60;
      const real = input ? input(t) : emptyCommand();
      w.step(h.command(real, 1 / 60));
      h.update();
      if (w.player.activity) poses.add(w.player.activity);
    }
  };
  return { w, h, log, run, poses };
}

const standingFree = (w: World) => !w.player.anchored && w.player.activity === null && w.player.yawOverride === null && w.player.pos.y === 0;
const inWall = (x: number, z: number) => HOME_WALLS.some((wl) => x > wl.minX - 0.05 && x < wl.maxX + 0.05 && z > wl.minZ && z < wl.maxZ);

console.log('\nStage 12: needs');

test('needs: sensible starting values, decay over play time, slower at home, frozen asleep, faster in a fight', () => {
  const n = defaultNeeds();
  assert(n.hunger > 50 && n.energy > 50 && n.hygiene > 50 && n.bladder < 30, 'start comfortable');
  const out = defaultNeeds();
  tickNeeds(out, 600, { home: false, fighting: false });
  const home = defaultNeeds();
  tickNeeds(home, 600, { home: true, fighting: false });
  const fight = defaultNeeds();
  tickNeeds(fight, 600, { home: false, fighting: true });
  const asleep = defaultNeeds();
  tickNeeds(asleep, 600, { home: true, fighting: false, sleeping: true });
  assert(out.hunger < n.hunger && out.energy < n.energy && out.hygiene < n.hygiene && out.oral < n.oral && out.bladder > n.bladder, 'everything moves out and about');
  assert(home.hunger > out.hunger && home.energy > out.energy && home.hygiene > out.hygiene, 'slower at home');
  assert(fight.hygiene < out.hygiene && fight.energy < out.energy, 'fighting: sweaty and tiring');
  assert(JSON.stringify(asleep) === JSON.stringify(n), 'nothing moves while asleep');
  // Balanced: ten minutes out costs well under half your hunger.
  assert(n.hunger - out.hunger < 30 && n.hunger - out.hunger > 10, `hunger after 10 min out: ${out.hunger.toFixed(1)}`);
  assert(NEED_RATES.hunger * 2700 > 99 && NEED_RATES.hunger * 2700 < 101, 'full to empty in ~45 minutes out');
});

test('hygiene levels match the brief exactly (Excellent 90+, Good 70-89, Average 40-69, Poor 20-39, Very poor 0-19)', () => {
  const cases: [number, string][] = [[100, 'Excellent'], [90, 'Excellent'], [89, 'Good'], [70, 'Good'], [69, 'Average'], [40, 'Average'], [39, 'Poor'], [20, 'Poor'], [19, 'Very poor'], [0, 'Very poor']];
  for (const [v, l] of cases) assert(hygieneLevel(v) === l, `${v} -> ${hygieneLevel(v)}`);
  assert(needLabel('hygiene', 30).label.includes('needs a shower'), 'poor hygiene asks for a shower');
  assert(needLabel('hunger', 20).label === 'Hungry' && needLabel('bladder', 10).label === 'Comfortable', 'labels');
});

test('the HUD only shows needs that want attention', () => {
  const n = defaultNeeds();
  assert(attention(n).length === 0, 'nothing shown when comfortable');
  n.hunger = 15;
  n.bladder = 90;
  const a = attention(n);
  assert(a.length === 2 && a.every((x) => x.label.urgency === 2), 'hungry and bursting shown as urgent');
});

test('effects are mild: nothing when fine, a little slower stamina when hungry or tired, a bonus for eating well, never damage', () => {
  const n = defaultNeeds();
  assert(needsModifiers(n).length === 0, 'no effects at the start');
  n.hunger = 5;
  n.energy = 10;
  n.nutrition = 10;
  n.hygiene = 0;
  n.bladder = 100;
  n.oral = 0;
  const m = needsModifiers(n);
  for (const x of m) assert(x.stat === 'staminaRegenMult' || x.flat === 'maxStamina', `only stamina is touched (${x.id})`);
  const regen = m.filter((x) => x.stat === 'staminaRegenMult').reduce((a, x) => a * (x.mul ?? 1), 1);
  assert(regen > 0.65, `worst case still gives most of your stamina recovery (${regen.toFixed(2)})`);
  const good = { ...defaultNeeds(), nutrition: 80 };
  assert(needsModifiers(good).some((x) => x.flat === 'maxStamina' && (x.add ?? 0) > 0), 'eating well gives a bonus');
  // Applied to the real fighter.
  const p = fresh();
  p.save.needs.nutrition = 80;
  const w = new World(resolveLevel('home', p.save), p, { entry: 'start', seed: 1, civilians: false });
  const before = w.player.stats.maxStamina;
  p.save.needs.nutrition = 50;
  p.applyModifiers(w.player, w.difficulty);
  assert(w.player.stats.maxStamina === before - 8, `eating-well bonus on the fighter (${before} -> ${w.player.stats.maxStamina})`);
});

test('eating: fills hunger, moves diet towards the food, junk is hard on the teeth; drinks fill the bladder', () => {
  const n = { ...defaultNeeds(), hunger: 20, nutrition: 50, oral: 80, bladder: 10 };
  eat(n, { fill: 60, diet: 70 });
  assert(n.hunger === 80 && n.nutrition > 50 && n.oral < 80, 'healthy meal');
  const before = n.nutrition;
  eat(n, { fill: 30, diet: 10 });
  assert(n.nutrition < before, 'junk drags diet down');
  const p = fresh();
  p.giveItem('can_of_pop', 1);
  const b0 = p.save.needs.bladder;
  const r = p.use(p.save.inventory.find((s) => s.id === 'can_of_pop')!.uid);
  assert(r.ok && p.save.needs.bladder > b0, 'a can of pop fills the bladder');
  p.save.needs.hunger = 10;
  p.giveItem('kebab', 1);
  p.use(p.save.inventory.find((s) => s.id === 'kebab')!.uid);
  assert(p.save.needs.hunger > 40, 'a kebab from your pockets fills you up');
});

console.log('\nStage 12: ingredients and recipes');

test('every recipe in the brief exists, with ingredients, prep and cook time, nutrition, energy, hunger, quality and an icon', () => {
  const want = ['sandwich', 'toast', 'cereal', 'beans_toast', 'scrambled', 'full_english', 'sausage_mash', 'chicken_chips', 'steak', 'pasta', 'burgers', 'curry', 'crisps', 'chocolate', 'fruit', 'biscuits'];
  for (const id of want) assert(RECIPE_BY_ID[id], `missing recipe ${id}`);
  for (const r of RECIPES) {
    const out = ITEMS[r.makes];
    assert(out?.use?.needs && out.use.needs.fill > 0, `${r.id} makes something filling`);
    assert(out.icon === 'plate' || out.icon === 'grocery', `${r.id} has an icon`);
    assert(r.ingredients.length >= 1 && r.ingredients.every((g) => ITEMS[g.id]?.store), `${r.id}: real, storable ingredients`);
    assert(r.prep > 0 && r.quality >= 1 && r.quality <= 5, `${r.id}: prep and quality`);
    assert(r.cookAt === 'none' ? r.cook === 0 : r.cook > 0, `${r.id}: cook time`);
    assert(typeof out.use.needs.diet === 'number', `${r.id}: nutrition`);
  }
  assert(RECIPES.filter((r) => r.kind === 'cooked').every((r) => (ITEMS[r.makes].use!.needs!.energy ?? 0) > 0), 'cooked meals give energy');
  // Proper food beats junk for diet.
  assert(ITEMS.m_steak.use!.needs!.diet > ITEMS.s_crisps.use!.needs!.diet && ITEMS.m_curry.use!.needs!.diet > ITEMS.kebab.use!.needs!.diet, 'home cooking is healthier');
});

test('kitchen stores: a new game and an old save both come stocked; everything has a home in the fridge or the cupboards', () => {
  const p = fresh();
  assert(p.save.pantry.fridge.length > 3 && p.save.pantry.cupboard.length > 3, 'new game stocked');
  for (const s of p.save.pantry.fridge) assert(storeOf(s.id) === 'fridge', `${s.id} in the fridge`);
  for (const s of p.save.pantry.cupboard) assert(storeOf(s.id) === 'cupboard', `${s.id} in the cupboard`);
  // A save from before Stage 12 (no needs, no pantry) loads with both.
  const raw = JSON.parse(JSON.stringify(p.save));
  delete raw.pantry;
  delete raw.needs;
  const s2 = sanitiseSave(raw)!;
  assert(s2.pantry.fridge.length > 3 && s2.needs.hunger > 0, 'old save migrated with groceries and needs');
  const uids = [...s2.inventory, ...s2.storage, ...s2.pantry.fridge, ...s2.pantry.cupboard].map((x) => x.uid);
  assert(new Set(uids).size === uids.length, 'no duplicate item uids after migration');
  // Round trip keeps exactly what's in the kitchen, and the needs.
  p.save.needs.hygiene = 33;
  const s3 = sanitiseSave(JSON.parse(JSON.stringify(p.save)))!;
  assert(JSON.stringify(s3.pantry) === JSON.stringify(p.save.pantry) && s3.needs.hygiene === 33, 'saved and loaded unchanged');
  assert(sanitiseNeeds({ hunger: 'x', energy: 500 }).energy === 100, 'bad needs repaired');
  assert(STARTER_GROCERIES.every((g) => ITEMS[g.id]?.store), 'starter groceries are all real');
});

test('cooking uses real ingredients from the fridge, cupboards and pockets; nothing is taken if anything is missing', () => {
  const p = fresh();
  const s = p.save;
  const r = RECIPE_BY_ID.sandwich;
  const before = r.ingredients.map((g) => have(s.pantry, s.inventory, g.id));
  assert(useIngredients(r, s.pantry, s.inventory), 'made a sandwich');
  r.ingredients.forEach((g, i) => assert(have(s.pantry, s.inventory, g.id) === before[i] - g.qty, `${g.id} used`));
  const steak = RECIPE_BY_ID.steak;
  const snapshot = JSON.stringify(s.pantry);
  assert(missing(steak, s.pantry, s.inventory).some((m) => m.id === 'g_steak'), 'no steak in the starter shop');
  assert(!useIngredients(steak, s.pantry, s.inventory) && JSON.stringify(s.pantry) === snapshot, 'nothing taken when short');
  // Ingredients in your pockets count too.
  p.giveItem('g_steak', 1);
  assert(missing(steak, s.pantry, s.inventory).length === 0 && useIngredients(steak, s.pantry, s.inventory), 'steak from your pockets');
  assert(!s.inventory.some((x) => x.id === 'g_steak'), 'and it was used');
});

console.log('\nStage 12: the house');

test('every interaction point exists with a clear prompt, and none can be used through a wall', () => {
  const p = fresh();
  place(p, 'dining_table', 'kitchen');
  const level = resolveLevel('home', p.save);
  const ids = level.stations.map((s) => s.id);
  for (const id of ['fridge', 'cupboard', 'cooker', 'kitchen', 'sink', 'shower', 'toilet', 'basin', 'bed', 'tv', 'dining', 'wardrobe', 'sofa'] as const) assert(ids.includes(id), `no ${id} station`);
  for (const s of level.stations.filter((x) => ['fridge', 'cupboard', 'cooker', 'kitchen', 'sink', 'shower', 'toilet', 'basin', 'bed', 'tv', 'dining'].includes(x.id))) {
    assert(/^[A-Z ]+\|[A-Z][a-z]/.test(s.label), `${s.id} prompt reads "THING  [E]  Do it": ${s.label}`);
  }
  const w = new World(level, p, { entry: 'start', seed: 1, civilians: false });
  // The shower is behind the bathroom wall from the bedroom side.
  w.player.pos.x = -19.6;
  w.player.pos.z = -1.0;
  w.step(emptyCommand());
  assert(!(w.interactable?.kind === 'station' && ['shower', 'toilet', 'basin'].includes(w.interactable.station.id)), 'bathroom usable through the wall');
  for (const s of HOUSE_SPOTS) {
    w.player.pos.x = s.stand.x;
    w.player.pos.z = s.stand.z + 0.3;
    w.step(emptyCommand());
    assert(w.interactable?.kind === 'station' && w.interactable.station.id === s.id, `standing at the ${s.id} offers it (got ${w.interactable?.kind === 'station' ? w.interactable.station.id : w.interactable?.kind})`);
  }
});

test('new poses exist and differ from standing (open fridge, chop, stir, eat, shower, wash, brush, lie in bed)', () => {
  const stand = JSON.stringify(activityPose('nothing', 1));
  for (const a of ['reach', 'reach_low', 'chop', 'stir', 'plate', 'wait', 'eat', 'sit_drink', 'shower', 'wash_hands', 'wash_face', 'brush', 'lie', 'sit_edge']) {
    assert(JSON.stringify(activityPose(a, 1)) !== stand, `${a} is a real pose`);
  }
  const lie = activityPose('lie', 1);
  assert(Math.abs(lie.joints.hips![0] + Math.PI / 2) < 0.01, 'lying flat: hips turned a quarter');
  assert(JSON.stringify(activityPose('chop', 0.1)) !== JSON.stringify(activityPose('chop', 0.25)), 'chopping moves');
});

test('cooking a sandwich: fridge, cupboard, worktop, plate up — ingredients used, then you sit down and eat it', () => {
  const p = fresh();
  place(p, 'dining_table', 'kitchen');
  place(p, 'dining_chair', 'kitchen');
  p.save.needs.hunger = 20;
  const { w, h, log, run, poses } = house(p);
  w.player.pos.x = -1.2;
  w.player.pos.z = 0.3;
  const bread = have(p.save.pantry, p.save.inventory, 'g_bread');
  h.cook(RECIPE_BY_ID.sandwich);
  assert(h.active, 'started');
  let visitedFridge = false;
  let visitedWorktop = false;
  for (let i = 0; i < 60 * 25 && (h.active || !visitedWorktop); i++) {
    run(1 / 60);
    if (Math.abs(w.player.pos.x - 1.3) < 0.2 && w.player.activity === 'reach') visitedFridge = true;
    if (Math.abs(w.player.pos.x + 1.25) < 0.2 && w.player.activity === 'chop') visitedWorktop = true;
    assert(!inWall(w.player.pos.x, w.player.pos.z), 'walked through a wall');
  }
  assert(visitedFridge && visitedWorktop, `went to the fridge (${visitedFridge}) and the worktop (${visitedWorktop})`);
  assert(log.fxSeen.has('door_fridge') && log.fxSeen.has('board') && log.sounds.includes('fridge_open') && log.sounds.includes('chop'), 'fridge door, chopping board, sounds');
  assert(have(p.save.pantry, p.save.inventory, 'g_bread') === bread - 1 || p.save.inventory.some((s) => s.id === 'm_sandwich'), 'bread used');
  // Straight on to eating it.
  run(20);
  assert(!h.active, 'finished eating');
  assert(poses.has('eat') && poses.has('sit'), 'sat down and ate');
  assert(!p.save.inventory.some((s) => s.id === 'm_sandwich'), 'the sandwich is gone');
  assert(p.save.needs.hunger > 50, `hunger filled (${p.save.needs.hunger.toFixed(0)})`);
  assert(have(p.save.pantry, p.save.inventory, 'g_bread') === bread - 1, 'exactly one portion of bread used');
  assert(standingFree(w), 'standing and free afterwards');
  assert(log.fx.size === 0 && log.loops.size === 0, `effects and sounds tidied up (${[...log.fx.keys()]})`);
});

test('a cooked meal on the hob: steam, sizzle, servings for later in the fridge, and the crew come and eat', () => {
  const p = fresh();
  place(p, 'dining_table', 'kitchen');
  for (let i = 0; i < 3; i++) place(p, 'dining_chair', 'kitchen');
  const { w, h, log, run, poses } = house(p, ['shaz', 'danny']);
  run(2);
  w.player.pos.x = -2.0;
  w.player.pos.z = 0.4;
  h.cook(RECIPE_BY_ID.sausage_mash);
  let stirred = false;
  for (let i = 0; i < 60 * 45 && !(stirred && poses.has('eat')); i++) {
    run(1 / 60);
    if (w.player.activity === 'stir') {
      stirred = true;
      assert(log.fx.has('pan') && log.loops.has('sizzle'), 'pan and sizzle while cooking');
    }
  }
  assert(stirred, 'stirred the pan at the hob');
  assert(log.toasts.some((t) => /in the fridge/.test(t)), 'told about the leftovers');
  let crewAte = false;
  for (let i = 0; i < 60 * 20; i++) {
    run(1 / 60);
    if (w.crew.some((m) => m.f.activity === 'eat')) crewAte = true;
  }
  assert(crewAte, 'a companion sat down and ate with you');
  assert(!p.save.pantry.fridge.some((s) => s.id === 'm_sausage_mash'), 'the second serving went to the crew');
  assert(standingFree(w) && !h.active, 'done and free');
});

test('the oven: in, wait, out; the full English gives the meal bonus', () => {
  const p = fresh();
  p.stockKitchen([{ id: 'g_oven_chips', qty: 1 }, { id: 'g_chicken', qty: 1 }]);
  const { w, h, log, run, poses } = house(p);
  w.player.pos.x = -2;
  w.player.pos.z = 0.4;
  h.cook(RECIPE_BY_ID.chicken_chips);
  run(45);
  assert(poses.has('reach_low') && poses.has('wait') && log.fxSeen.has('oven') && log.loopsSeen.has('oven'), 'oven used');
  assert(!h.active || h.status, 'still going or finished');
  run(20);
  const q = fresh();
  q.save.needs.hunger = 10;
  const hq = house(q);
  hq.w.player.pos.x = -2;
  hq.w.player.pos.z = 0.4;
  hq.h.cook(RECIPE_BY_ID.full_english);
  hq.run(70);
  assert(!hq.h.active && q.save.mealBuff, 'ate the full English: +25 max health for the next trip');
});

test('stopping cooking: while prepping, ingredients go back; while cooking, the food is ruined; never stuck', () => {
  const p = fresh();
  const { w, h, log, run } = house(p);
  w.player.pos.x = -1.2;
  w.player.pos.z = 0.4;
  const snap = () => ['g_sausages', 'g_potatoes', 'g_butter', 'g_peas'].map((id) => have(p.save.pantry, p.save.inventory, id)).join(',');
  const before = snap();
  h.cook(RECIPE_BY_ID.sausage_mash);
  for (let i = 0; i < 60 * 30 && w.player.activity !== 'chop'; i++) run(1 / 60);
  run(1);
  assert(snap() !== before, 'ingredients taken when prep starts');
  assert(h.cancel(), 'Esc stops it');
  run(1.5);
  assert(!h.active && snap() === before, `put back (${snap()} vs ${before})`);
  assert(standingFree(w), 'free');
  h.cook(RECIPE_BY_ID.sausage_mash);
  for (let i = 0; i < 60 * 40 && w.player.activity !== 'stir'; i++) run(1 / 60);
  run(2);
  // Walking away (movement input) stops it.
  run(1, () => ({ ...emptyCommand(), moveZ: 1 }));
  run(1);
  assert(!h.active && log.toasts.some((t) => /ruined/.test(t)), 'left on the heat: ruined');
  assert(snap() !== before, 'and the ingredients are gone');
  assert(standingFree(w) && log.loops.size === 0 && log.fx.size === 0, 'free, quiet, tidy');
});

test('shower: step into the bath, curtain drawn, water and steam, hygiene up to excellent, step out', () => {
  const p = fresh();
  p.save.needs.hygiene = 15;
  const { w, h, log, run, poses } = house(p);
  w.player.pos.x = -22;
  w.player.pos.z = 0.5;
  h.open('shower');
  let inBath = false;
  for (let i = 0; i < 60 * 20 && h.active; i++) {
    run(1 / 60);
    if (w.player.activity === 'shower') {
      inBath = w.player.pos.x < -24.2 && w.player.pos.z < -1.6 && w.player.pos.y > 0.05;
      assert(log.fx.has('curtain') && log.fx.has('water') && log.fx.has('steam') && log.loops.has('shower'), 'curtain, water, steam, sound');
    }
  }
  assert(poses.has('shower') && inBath, 'showered stood in the bath');
  assert(hygieneLevel(p.save.needs.hygiene) === 'Excellent', `hygiene ${p.save.needs.hygiene}`);
  assert(standingFree(w) && w.player.pos.z > -1.6, 'stepped back out onto the floor');
  assert(log.fx.size === 0 && log.loops.size === 0, 'water off');
});

test('stopping a shower part way: partly clean, back out of the bath, nothing left running', () => {
  const p = fresh();
  p.save.needs.hygiene = 10;
  const { w, h, log, run } = house(p);
  w.player.pos.x = -22;
  w.player.pos.z = 0.5;
  h.open('shower');
  for (let i = 0; i < 60 * 20 && w.player.activity !== 'shower'; i++) run(1 / 60);
  run(4);
  h.cancel();
  run(1.5);
  assert(p.save.needs.hygiene > 20 && p.save.needs.hygiene < 100, `partly clean (${p.save.needs.hygiene.toFixed(0)})`);
  assert(standingFree(w) && w.player.pos.z > -1.6 && !h.active, 'out of the bath, free');
  assert(log.fx.size === 0 && log.loops.size === 0, 'nothing left running');
});

test('bathroom sink: brush teeth (fresh), wash face; kitchen sink: wash hands with the tap running', () => {
  const p = fresh();
  p.save.needs.oral = 10;
  p.save.needs.hygiene = 50;
  const { w, h, log, run, poses } = house(p);
  w.player.pos.x = -21;
  w.player.pos.z = 0.5;
  // The basin offers a list (wash hands / face / brush).
  h.open('basin');
  assert(log.panels === 1, 'basin opens its list');
  (h as unknown as { wash: (a: string, b: string) => void }).wash('teeth', 'basin');
  run(12);
  assert(poses.has('brush') && p.save.needs.oral === 100 && log.sounds.includes('brush'), 'teeth brushed');
  (h as unknown as { wash: (a: string, b: string) => void }).wash('face', 'basin');
  run(8);
  assert(poses.has('wash_face') && p.save.needs.hygiene > 50, 'face washed');
  w.player.pos.x = -1;
  w.player.pos.z = 0.4;
  h.open('sink');
  let tap = false;
  for (let i = 0; i < 60 * 10 && h.active; i++) {
    run(1 / 60);
    if (w.player.activity === 'wash_hands' && log.fx.has('tap') && log.loops.has('tap')) tap = true;
  }
  assert(tap && standingFree(w), 'hands washed under the tap');
});

test('toilet: sit (clothed), bladder emptied, flush; not needed when empty; can stop', () => {
  const p = fresh();
  p.save.needs.bladder = 85;
  const { w, h, log, run, poses } = house(p);
  w.player.pos.x = -22;
  w.player.pos.z = 0.5;
  h.open('toilet');
  run(15);
  assert(poses.has('sit') && p.save.needs.bladder < 5 && log.sounds.includes('flush') && standingFree(w), 'used the loo');
  h.open('toilet');
  assert(!h.active && log.toasts.some((t) => /Don.t need to go/.test(t)), 'not when you don’t need to');
  p.save.needs.bladder = 80;
  h.open('toilet');
  for (let i = 0; i < 60 * 10 && w.player.activity !== 'sit'; i++) run(1 / 60);
  run(1.5);
  h.cancel();
  run(1.5);
  assert(standingFree(w) && p.save.needs.bladder < 80 && p.save.needs.bladder > 0, 'stopped part way, free');
});

test('bed: sit, lie down, sleep, get up — energy full, fatigue gone, an injury eased, the clock not moved', () => {
  const p = fresh();
  p.save.needs.energy = 10;
  p.save.gym.fatigue = 80;
  addInjury(p.save.condition, 'arm', 2);
  const trips = p.save.trips;
  const { w, h, run, poses } = house(p);
  w.player.pos.x = -16;
  w.player.pos.z = 0.5;
  (h as unknown as { bed: (k: string) => void }).bed('sleep');
  let lying = false;
  for (let i = 0; i < 60 * 25 && h.active; i++) {
    run(1 / 60);
    if (w.player.activity === 'lie') {
      lying = true;
      assert(h.sleeping, 'asleep while lying down');
      const bed = p.save.property.furniture.find((f) => f.id === 'bed_double')!.at!;
      assert(Math.abs(w.player.pos.z - bed.z) < 1 && Math.abs(w.player.pos.x - bed.x) < 0.8, 'on the bed');
    }
  }
  assert(lying && poses.has('sit_edge'), 'sat on the edge and lay down');
  assert(p.save.needs.energy === 100 && currentFatigue(p.save.gym, p.save.playTime) < 1, 'rested');
  assert(p.save.condition.injuries.every((i) => i.severity < 2), 'injury eased');
  assert(p.save.trips === trips, 'sleeping doesn’t move the story clock');
  assert(standingFree(w), 'up and free');
});

test('telly: sit on the sofa facing it and rest; any key stops it', () => {
  const p = fresh();
  p.save.needs.energy = 30;
  const { w, h, run, poses } = house(p);
  w.player.pos.x = -9;
  w.player.pos.z = 0.5;
  h.open('tv');
  run(8);
  assert(poses.has('sit_back') && w.player.anchored, 'watching from the sofa');
  run(0.5, () => ({ ...emptyCommand(), pressed: { ...emptyCommand().pressed, grab: true } }));
  run(1);
  assert(!h.active && standingFree(w) && p.save.needs.energy > 30, 'stopped, a bit rested');
});

test('snacks come out of the cupboard and are eaten; nothing to eat says so', () => {
  const p = fresh();
  const { w, h, log, run } = house(p);
  w.player.pos.x = -1;
  w.player.pos.z = 0.4;
  const crisps = have(p.save.pantry, p.save.inventory, 's_crisps');
  p.save.needs.hunger = 30;
  h.cook(RECIPE_BY_ID.crisps);
  run(20);
  assert(have(p.save.pantry, p.save.inventory, 's_crisps') === crisps - 1 && p.save.needs.hunger > 30 && log.sounds.includes('cupboard'), 'crisps from the cupboard, eaten');
  // Empty everything: nothing to eat.
  p.save.inventory = p.save.inventory.filter((s) => !ITEMS[s.id].use?.needs);
  p.save.pantry.fridge = p.save.pantry.fridge.filter((s) => ITEMS[s.id].icon !== 'plate');
  h.open('dining');
  assert(!h.active && log.toasts.some((t) => /Nothing ready to eat/.test(t)), 'told to cook something');
});

test('leaving or being interrupted mid-activity never leaves you stuck', () => {
  const p = fresh();
  const { w, h, run } = house(p);
  w.player.pos.x = -22;
  w.player.pos.z = 0.5;
  h.open('shower');
  for (let i = 0; i < 60 * 20 && w.player.activity !== 'shower'; i++) run(1 / 60);
  h.abort();
  assert(!h.active && standingFree(w) && w.player.pos.z > -1.6, 'abort puts you back on the floor');
  run(2, () => ({ ...emptyCommand(), moveX: 1 }));
  assert(w.player.pos.x > -21.9, 'and you can walk');
});

test('companions keep clear of everything you use, and still have places to be', () => {
  const p = fresh();
  place(p, 'armchair', 'living');
  const { w } = house(p, ['shaz', 'danny', 'tank', 'reg']);
  const life = w.homeLife!;
  for (const sp of life.spots) for (const s of HOUSE_SPOTS) assert(Math.hypot(sp.x - s.stand.x, sp.z - s.stand.z) > 0.7, `spot ${sp.key} blocks the ${s.id}`);
  assert(life.spots.some((s) => s.use === 'kitchen'), 'still somewhere to stand in the kitchen');
  // Over a few minutes of home life nobody parks in front of the fridge, hob or loo.
  for (let i = 0; i < 60 * 120; i++) {
    w.step(emptyCommand());
    if (i % 30) continue;
    for (const m of w.crew) {
      if (m.brain.home?.state !== 'at_spot' && m.brain.home?.state !== 'seated') continue;
      for (const s of HOUSE_SPOTS) assert(Math.hypot(m.f.pos.x - s.stand.x, m.f.pos.z - s.stand.z) > 0.5, `${m.def.id} parked at the ${s.id}`);
    }
  }
});

test('the walk to every spot in the house gets there on foot (no teleporting) from the hallway', () => {
  const p = fresh();
  const { w, h, run } = house(p);
  for (const s of HOUSE_SPOTS) {
    w.player.pos.x = s.x + 1.5;
    w.player.pos.z = 0.9;
    const a = (h as unknown as { start: (k: string, t: string, steps: unknown[]) => void });
    a.start('wash', 'walk test', [{ kind: 'walk', x: s.stand.x, z: s.stand.z, label: 'walk' }]);
    const act = h.active!;
    run(10);
    assert(!h.active && act.forced === 0, `walking to the ${s.id} needed the safety net`);
    assert(Math.hypot(w.player.pos.x - s.stand.x, w.player.pos.z - s.stand.z) < 0.2, `arrived at the ${s.id}`);
  }
});

test('fridge and cupboards: opening them swings the door and opens the list; the crew’s state is saved', () => {
  const p = fresh();
  const { w, h, log, run } = house(p, ['shaz']);
  w.player.pos.x = 0.5;
  w.player.pos.z = 0.4;
  h.open('fridge');
  run(5);
  assert(log.panels === 1 && log.sounds.includes('fridge_open') && log.fxSeen.has('door_fridge'), 'door opens, list shows');
  assert(crewState(p, 'shaz') !== undefined, 'crew state still there');
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
