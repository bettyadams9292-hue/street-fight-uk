/**
 * Stage 10 tests: injuries and condition (from real hits, with real stat
 * effects, healing over time, at home, and with first aid), and the crew's
 * persistent state (health carried between fights, levels from fights,
 * injuries, recovery, weapons you give them, who can follow), plus saves.
 */
import { defaultAppearance } from '../src/character/Appearance';
import { createCharacter, emptyAllocation } from '../src/character/Character';
import { newSave, Progress, sanitiseSave } from '../src/progress/Progress';
import { World } from '../src/world/World';
import { LEVELS } from '../src/world/levels';
import { emptyCommand } from '../src/input/Commands';
import { Fighter } from '../src/fighter/Fighter';
import { weaponItemId } from '../src/items/items';
import {
  HEAL_TIME,
  HitLedger,
  addInjury,
  healOverTime,
  overallCondition,
  sanitiseCondition,
  treatInjury,
} from '../src/condition/condition';
import {
  COMPANIONS,
  companionAvailable,
  companionGainXp,
  companionRecover,
  crewState,
  dismissCompanion,
  firstAidCompanion,
  giveWeapon,
  hireCompanion,
  setActiveCompanion,
  takeWeapon,
} from '../src/companions/companions';
import { companionFighter } from '../src/companions/crewFighter';

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
function fresh(cash = 10000): Progress {
  const c = createCharacter({ name: 'Tester', appearance: defaultAppearance(), background: 'estate_scrapper', allocated: emptyAllocation() });
  const p = new Progress(newSave(c));
  p.save.cash.bank = cash;
  return p;
}
const you = (p: Progress) => {
  const f = new Fighter(p.fighterConfig(1, 0, 0, false));
  p.applyModifiers(f);
  return f;
};
const roundtrip = (p: Progress) => new Progress(sanitiseSave(JSON.parse(JSON.stringify(p.save)))!);

console.log('\nStage 10: injuries and condition');

test('hits are counted by where they land; a fight’s worth turns into injuries, KO makes the worst one worse', () => {
  const l = new HitLedger();
  l.record('high', 30, false); // head: 20% of 150, not enough on its own
  l.record('high', 40, false); // now 70/150 = 47%: an injury
  l.record('low', 20, false); // legs: 13%, nothing
  l.record('mid', 130, false); // body: 87%: two levels
  const c = { injuries: [] as ReturnType<typeof addInjury>[] };
  const hurt = l.settle(c, 150);
  const part = (x: string) => c.injuries.find((i) => i.part === x);
  assert(part('head')?.severity === 1 && part('body')?.severity === 2 && !part('leg'), `got ${JSON.stringify(c.injuries)}`);
  assert(hurt.length === c.injuries.length && part('bruising'), 'bruising from clean hits');
  const k = new HitLedger();
  k.record('low', 30, false);
  k.knockedOut = true;
  const c2 = { injuries: [] as ReturnType<typeof addInjury>[] };
  k.settle(c2, 150);
  assert(c2.injuries.find((i) => i.part === 'leg')?.severity === 1, 'KO: the most-hit part gets a level');
  const b = new HitLedger();
  b.record('high', 80, true);
  const c3 = { injuries: [] as ReturnType<typeof addInjury>[] };
  b.settle(c3, 150);
  assert(c3.injuries.length === 1 && c3.injuries[0].part === 'arm', 'heavy blocked blows land on the arms');
});

test('injuries really change your fighter: arm hits damage, leg slows you, body costs stamina, head makes hits hurt', () => {
  const p = fresh();
  const base = you(p);
  addInjury(p.save.condition, 'arm', 2);
  addInjury(p.save.condition, 'leg', 1);
  addInjury(p.save.condition, 'body', 1);
  addInjury(p.save.condition, 'head', 1);
  const hurt = you(p);
  assert(hurt.stats.damageMultiplier < base.stats.damageMultiplier * 0.9, 'arm: less damage');
  assert(hurt.stats.attackSpeed < base.stats.attackSpeed, 'arm: slower swings');
  assert(hurt.stats.moveSpeedMultiplier < base.stats.moveSpeedMultiplier, 'leg: slower');
  assert(hurt.stats.maxStamina === base.stats.maxStamina - 10 && hurt.stats.staminaRegenPerSecond < base.stats.staminaRegenPerSecond, 'body: stamina');
  assert(hurt.stats.damageTakenMultiplier > base.stats.damageTakenMultiplier, 'head: hits hurt more');
  p.save.gym.fatigue = 80;
  p.save.gym.fatigueAt = p.save.playTime;
  const tired = you(p);
  assert(tired.stats.staminaRegenPerSecond < hurt.stats.staminaRegenPerSecond, 'exhaustion slows stamina coming back');
});

test('healing: over play time a level at a time, three times faster at home; rest, first aid and plasters work', () => {
  const c = { injuries: [] as ReturnType<typeof addInjury>[] };
  addInjury(c, 'leg', 2);
  healOverTime(c, HEAL_TIME[2] - 1);
  assert(c.injuries[0].severity === 2, 'not yet');
  healOverTime(c, 2);
  assert(c.injuries[0].severity === 1, 'down a level');
  healOverTime(c, HEAL_TIME[1] / 3 + 1, 3);
  assert(c.injuries.length === 0, 'healed faster at home');
  const p = fresh();
  addInjury(p.save.condition, 'arm', 2);
  addInjury(p.save.condition, 'bruising', 1);
  p.giveItem('first_aid', 1);
  p.giveItem('plasters', 1);
  const kit = p.save.inventory.find((s) => s.id === 'first_aid')!;
  const r = p.use(kit.uid);
  assert(r.ok && r.treated && p.save.condition.injuries.find((i) => i.part === 'arm')!.severity === 1, 'first aid: worst injury down a level');
  const pl = p.save.inventory.find((s) => s.id === 'plasters')!;
  p.use(pl.uid);
  assert(!p.save.condition.injuries.some((i) => i.part === 'bruising'), 'plasters: bruising gone');
  assert(treatInjury(p.save.condition, 'arm')?.healed && !p.save.condition.injuries.length, 'treated to nothing');
});

test('overall condition reads health, injuries and fatigue, worst first', () => {
  const none = { injuries: [] };
  assert(overallCondition(1, none) === 'excellent', 'excellent');
  assert(overallCondition(0.8, none) === 'good', 'good');
  assert(overallCondition(1, none, 60) === 'tired', 'tired');
  const c = { injuries: [] as ReturnType<typeof addInjury>[] };
  addInjury(c, 'arm', 1);
  assert(overallCondition(1, c) === 'injured', 'injured');
  addInjury(c, 'arm', 1);
  assert(overallCondition(1, c) === 'badly_injured', 'badly injured');
  addInjury(c, 'arm', 1);
  assert(overallCondition(1, c) === 'critical' && overallCondition(0.1, none) === 'critical', 'critical');
});

test('a real fight leaves you hurt when you take a beating, and says so', () => {
  const p = fresh();
  const lvl = LEVELS.estate;
  const enc = lvl.encounters.find((e) => !e.optional)!;
  const w = new World(lvl, p, { entry: lvl.entries[0].id, at: { x: enc.triggerX - 1, z: 0 }, seed: 7, civilians: false });
  let hurt: string[] = [];
  w.events.on('injury', (e) => { if (e.who === 'you') hurt = e.injuries.map((i) => i.part); });
  for (let i = 0; i < 60; i++) {
    const c = emptyCommand();
    c.moveX = 1;
    w.step(c);
  }
  assert(w.activeEncounter, 'fight on');
  // Stand there and take it (kept on your feet), then the fight ends.
  for (let i = 0; i < 60 * 40; i++) {
    w.player.vitals.health = Math.max(w.player.vitals.health, 40);
    w.step(emptyCommand());
  }
  for (let n = 0; n < 6 && w.activeEncounter; n++) {
    for (const e of w.enemies) if (!e.isKO) e.knockOut();
    for (let i = 0; i < 90; i++) w.step(emptyCommand());
  }
  for (let i = 0; i < 30; i++) w.step(emptyCommand());
  assert(hurt.length > 0 && p.save.condition.injuries.length > 0, `no injuries after a beating (${JSON.stringify(p.save.condition)})`);
  // Your live fighter feels it straight away.
  const fresh2 = you(fresh());
  assert(w.player.stats.maxHealth <= fresh2.stats.maxHealth, 'modifiers applied to you in the world');
});

test('sparring with Mo never injures you', () => {
  const p = fresh();
  const home = LEVELS.home;
  const w = new World(home, p, { entry: 'start', seed: 2, civilians: false });
  const mo = w.sparPartner!;
  w.player.pos.x = mo.pos.x - 1;
  w.player.pos.z = mo.pos.z;
  w.startSpar();
  for (let i = 0; i < 60 * 20 && w.duel; i++) w.step(emptyCommand());
  if (w.duel) w.stopDuel();
  for (let i = 0; i < 30; i++) w.step(emptyCommand());
  assert(p.save.condition.injuries.length === 0, 'spar left an injury');
});

console.log('\nStage 10: the crew');

test('hiring creates their record; health carries over between fights; the screen and the fight agree', () => {
  const p = fresh();
  hireCompanion(p, 'danny');
  const st = crewState(p, 'danny');
  assert(st.level === 1 && st.health === 1 && !st.weapon, 'fresh hire');
  st.health = 0.5;
  const lvl = LEVELS.high_street;
  const w = new World(lvl, p, { entry: lvl.entries[0].id, seed: 2, companion: COMPANIONS.danny, civilians: false });
  const c = w.companion!;
  assert(Math.abs(c.vitals.health / c.vitals.maxHealth - 0.5) < 0.02, 'spawned at the health they had');
  const sheet = companionFighter(p, COMPANIONS.danny);
  assert(sheet.vitals.maxHealth === c.vitals.maxHealth && Math.abs(sheet.stats.damageMultiplier - c.stats.damageMultiplier) < 1e-9, 'crew screen shows the same numbers');
  c.vitals.health = c.vitals.maxHealth * 0.3;
  w.syncCompanion();
  assert(Math.abs(st.health - 0.3) < 0.01, 'damage taken is saved');
  assert(Math.abs(roundtrip(p).save.companions.state.danny.health - 0.3) < 0.01, 'and survives a reload');
});

test('companions level up from fights and hit harder for it', () => {
  const p = fresh();
  hireCompanion(p, 'shaz');
  const st = crewState(p, 'shaz');
  const before = companionFighter(p, COMPANIONS.shaz).stats.damageMultiplier;
  const gained = companionGainXp(st, 1000);
  assert(gained >= 3 && st.level >= 4, `levels ${st.level}`);
  const after = companionFighter(p, COMPANIONS.shaz);
  assert(after.stats.damageMultiplier > before && after.vitals.maxHealth > companionFighter(fresh(), COMPANIONS.shaz).vitals.maxHealth - 1, 'stronger');
  companionGainXp(st, 1e6);
  assert(st.level === 10 && st.xp === 0, 'capped at 10');
});

test('a KO in a real fight while they’re with you earns them XP', () => {
  const p = fresh();
  p.save.flags.boss_sully = true;
  hireCompanion(p, 'tank');
  const lvl = LEVELS.estate;
  const enc = lvl.encounters.find((e) => !e.optional)!;
  const w = new World(lvl, p, { entry: lvl.entries[0].id, at: { x: enc.triggerX - 1, z: 0 }, seed: 4, companion: COMPANIONS.tank, civilians: false });
  for (let i = 0; i < 60; i++) {
    const c = emptyCommand();
    c.moveX = 1;
    w.step(c);
  }
  // Soften them up and let the fight finish them properly.
  w.player.vitals.health = 1e6;
  for (let i = 0; i < 60 * 30 && w.enemies.some((e) => !e.isKO); i++) {
    for (const e of w.enemies) if (!e.isKO) e.vitals.health = Math.min(e.vitals.health, 2);
    const c = emptyCommand();
    const t = w.enemies.find((e) => !e.isKO);
    if (t) c.moveX = Math.abs(t.pos.x - w.player.pos.x) > 0.9 ? Math.sign(t.pos.x - w.player.pos.x) : 0;
    if (i % 12 === 0) c.pressed.lp = true;
    w.step(c);
  }
  assert(crewState(p, 'tank').xp > 0 || crewState(p, 'tank').level > 1, 'XP for the knockouts');
});

test('badly hurt companions can’t follow you until they recover; they recover resting; first aid helps', () => {
  const p = fresh();
  hireCompanion(p, 'shaz');
  hireCompanion(p, 'danny');
  const st = crewState(p, 'danny');
  addInjury(st.condition, 'leg', 3);
  assert(!companionAvailable(st).ok && !setActiveCompanion(p, 'danny').ok, 'severe injury: stays home');
  p.giveItem('first_aid', 1);
  assert(firstAidCompanion(p, 'danny').ok && st.condition.injuries[0].severity === 2, 'first aid: a level better');
  assert(!p.save.inventory.some((s) => s.id === 'first_aid'), 'kit used');
  assert(companionAvailable(st).ok && setActiveCompanion(p, 'danny').ok, 'fit enough now');
  st.health = 0.1;
  assert(!companionAvailable(st).ok, 'too beaten up');
  companionRecover(st, 60, true);
  assert(st.health > 0.25 && st.health < 1, 'getting better at home');
  companionRecover(st, 1000, true);
  assert(st.health === 1, 'full');
  assert(!firstAidCompanion(p, 'shaz').ok, 'nothing to patch up / no kit');
});

test('giving a companion a weapon: out of your pockets, in their hands in a fight, back when you take it or let them go', () => {
  const p = fresh();
  hireCompanion(p, 'danny');
  p.giveItem(weaponItemId('baseball_bat'), 1, { hits: 9 });
  const bat = p.save.inventory.find((s) => s.id === weaponItemId('baseball_bat'))!;
  assert(giveWeapon(p, 'danny', bat.uid).ok && !p.save.inventory.some((s) => s.uid === bat.uid), 'given');
  const lvl = LEVELS.high_street;
  const w = new World(lvl, p, { entry: lvl.entries[0].id, seed: 2, companion: COMPANIONS.danny, civilians: false });
  assert(w.companion!.weapon?.data.id === 'baseball_bat' && w.companion!.weapon.hits === 9, `holding it in the world (${w.companion!.weapon?.data.id} ${w.companion!.weapon?.hits})`);
  w.companion!.weapon!.hits = 5;
  w.syncCompanion();
  assert(crewState(p, 'danny').weapon!.hits === 5, 'wear is saved');
  const q = roundtrip(p);
  assert(q.save.companions.state.danny.weapon?.id === weaponItemId('baseball_bat'), 'saved with them');
  assert(takeWeapon(p, 'danny').ok && p.save.inventory.some((s) => s.uid === bat.uid && s.hits === 5), 'taken back');
  giveWeapon(p, 'danny', bat.uid);
  assert(dismissCompanion(p, 'danny').ok && p.save.inventory.some((s) => s.uid === bat.uid) && !p.save.companions.state.danny, 'let go: weapon returned, record gone');
  assert(!giveWeapon(p, 'danny', bat.uid).ok || true, 'no crash');
});

test('saves from before crew records load with everyone fit; junk is cleaned up', () => {
  const p = fresh();
  hireCompanion(p, 'shaz');
  addInjury(p.save.condition, 'head', 2);
  const raw = JSON.parse(JSON.stringify(p.save));
  delete raw.companions.state;
  delete raw.condition;
  const old = sanitiseSave(raw)!;
  assert(old.companions.state.shaz?.health === 1 && old.companions.state.shaz.level === 1, 'old crew: fit, level 1');
  assert(old.condition.injuries.length === 0, 'old save: no injuries');
  const junk = sanitiseCondition({ injuries: [{ part: 'nose', severity: 9 }, { part: 'arm', severity: 7, left: -5 }, { part: 'arm', severity: 1 }] });
  assert(junk.injuries.length === 1 && junk.injuries[0].severity === 3 && junk.injuries[0].left === 0, 'cleaned');
  const q = roundtrip(p);
  assert(q.save.condition.injuries[0].part === 'head' && q.save.condition.injuries[0].severity === 2, 'injuries saved');
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
