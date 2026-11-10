/**
 * Stage 11 tests: crew personalities and fighting styles (real stat and
 * behaviour differences, measured in fights), more than one follower, crew
 * orders, and home life (coming in through the front door, finding seats on
 * the furniture you own, sitting properly, not sharing seats, chatting,
 * resting), plus saves.
 */
import { defaultAppearance } from '../src/character/Appearance';
import { createCharacter, emptyAllocation } from '../src/character/Character';
import { newSave, Progress, sanitiseSave } from '../src/progress/Progress';
import { World } from '../src/world/World';
import { LEVELS } from '../src/world/levels';
import { emptyCommand } from '../src/input/Commands';
import { resolveLevel } from '../src/property/levels';
import { buyFurniture, placeFurniture } from '../src/property/state';
import { FURNITURE } from '../src/property/catalogue';
import { HOME_WALLS, suggestSpot } from '../src/property/home';
import { weaponItemId } from '../src/items/items';
import {
  COMPANIONS,
  COMPANION_LIST,
  activeSlots,
  crewState,
  followMe,
  hireCompanion,
  relaxAtHome,
  sanitiseCompanions,
  type CompanionDef,
} from '../src/companions/companions';
import { companionFighter } from '../src/companions/crewFighter';
import { FIGHT_STYLES, PERSONALITIES, lineFor, replyKind } from '../src/companions/personality';
import type { Fighter } from '../src/fighter/Fighter';

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
const steps = (w: World, n: number) => {
  for (let i = 0; i < n; i++) w.step(emptyCommand());
};

console.log('\nStage 11: personalities and fighting styles');

test('every companion has their own personality, and every personality type is somebody', () => {
  const pairs = new Set(COMPANION_LIST.map((c) => `${c.personality}/${c.fightStyle}`));
  assert(pairs.size === COMPANION_LIST.length, 'two companions share a personality and style');
  for (const id of Object.keys(PERSONALITIES)) assert(COMPANION_LIST.some((c) => c.personality === id), `nobody is a ${id}`);
  assert(new Set(COMPANION_LIST.map((c) => c.fightStyle)).size >= 9, 'at least nine fighting styles in use');
  for (const c of COMPANION_LIST) assert(c.strengths && c.weaknesses && PERSONALITIES[c.personality].text, `${c.id} profile`);
});

test('every fighting style has a real upside and a real downside (except MMA, which is even)', () => {
  for (const s of Object.values(FIGHT_STYLES)) {
    const m = s.mods;
    const ups = [m.attackSpeed > 1, m.damage > 1, m.move > 1, m.taken < 1, m.poise > 0, s.weaponMult > 1, s.counters].filter(Boolean).length;
    const downs = [m.attackSpeed < 1, m.damage < 1, m.move < 1, m.taken > 1, s.unarmedMult < 1, s.weaponMult < 1].filter(Boolean).length;
    if (s.id === 'mma') continue;
    assert(ups >= 1 && downs >= 1, `${s.id}: ${ups} up / ${downs} down`);
  }
});

test('styles change the actual fighter: heavy is slow and hard-hitting, fast is quick and light', () => {
  const p = fresh();
  const tank = companionFighter(p, COMPANIONS.tank);
  const mia = companionFighter(p, COMPANIONS.mia);
  const danny = companionFighter(p, COMPANIONS.danny);
  assert(tank.stats.attackSpeed < danny.stats.attackSpeed && danny.stats.attackSpeed > 1, 'heavy hitter slower');
  assert(tank.stats.maxPoise > mia.stats.maxPoise, 'heavy harder to stagger');
  assert(mia.stats.moveSpeedMultiplier > tank.stats.moveSpeedMultiplier, 'fast fighter quicker on her feet');
  assert(tank.style.id === 'boxing' && COMPANIONS.jonno && companionFighter(p, COMPANIONS.jonno).style.id === 'wrestling', 'move sets from the style');
});

test('the weapons specialist is better armed, worse unarmed', () => {
  const p = fresh();
  hireCompanion(p, 'dean');
  const bare = companionFighter(p, COMPANIONS.dean);
  p.giveItem(weaponItemId('baseball_bat'), 1);
  const bat = p.save.inventory.find((s) => s.id === weaponItemId('baseball_bat'))!;
  crewState(p, 'dean').weapon = bat;
  const armed = companionFighter(p, COMPANIONS.dean);
  const ratio = armed.stats.damageMultiplier / bare.stats.damageMultiplier;
  assert(ratio > 1.5, `bat in hand: ×${ratio.toFixed(2)} damage multiplier`);
  const other = companionFighter(p, COMPANIONS.paddy);
  assert(bare.stats.damageMultiplier < other.stats.damageMultiplier * 1.0, 'empty-handed he hits softer than a brawler');
});

/** Put a companion in a real fight and count what they throw. */
function measure(id: string, seconds = 40, seed = 11): { lp: number; hp: number; lk: number; hk: number; grabs: number; blocks: number; counters: number; pickedUp: boolean; leads: number; heavyLeads: number } {
  const p = fresh();
  hireCompanion(p, id);
  const def = COMPANIONS[id];
  const lvl = LEVELS.residential;
  const enc = lvl.encounters.find((e) => !e.optional)!;
  const w = new World(lvl, p, { entry: lvl.entries[0].id, at: { x: enc.triggerX - 1.5, z: 0 }, seed, companions: [def], civilians: false });
  const me = w.crew[0].f;
  const out = { lp: 0, hp: 0, lk: 0, hk: 0, grabs: 0, blocks: 0, counters: 0, pickedUp: false, leads: 0, heavyLeads: 0 };
  let lastBlock = -99;
  let lastMove = -99;
  w.sim.bus.on('move:started', ({ fighter, move }) => {
    if (fighter !== me) return;
    if (move.button in out) (out as unknown as Record<string, number>)[move.button]++;
    // The shot that opens an exchange (not a follow-up in a string, which the combo itself decides).
    if (w.sim.frame - lastMove > 50 && move.button in out) {
      out.leads++;
      if (move.button === 'hp' || move.button === 'hk') out.heavyLeads++;
    }
    lastMove = w.sim.frame;
    if (w.sim.frame - lastBlock < 30) out.counters++;
  });
  w.sim.bus.on('grapple:start', ({ holder }) => {
    if (holder === me) out.grabs++;
  });
  w.sim.bus.on('hit:blocked', ({ target }) => {
    if (target === me) {
      out.blocks++;
      lastBlock = w.sim.frame;
    }
  });
  // Drop a weapon by them so a specialist can go and get it.
  w.dropOnGround(p.newStack(weaponItemId('metal_bar'), 1), me.pos.x + 2.5, me.pos.z);
  for (let i = 0; i < 60; i++) {
    const c = emptyCommand();
    c.moveX = 1;
    w.step(c);
  }
  for (let i = 0; i < 60 * seconds; i++) {
    w.player.vitals.health = w.player.vitals.maxHealth;
    me.vitals.health = Math.max(me.vitals.health, me.vitals.maxHealth * 0.5);
    for (const e of w.enemies) e.vitals.health = Math.max(e.vitals.health, e.vitals.maxHealth * 0.6);
    w.step(emptyCommand());
    if (me.weapon) out.pickedUp = true;
  }
  return out;
}

test('fighting styles look different in a real fight (what they actually throw)', () => {
  const tank = measure('tank');
  const mia = measure('mia');
  const jonno = measure('jonno');
  const total = (o: ReturnType<typeof measure>) => o.lp + o.hp + o.lk + o.hk;
  assert(total(tank) > 5 && total(mia) > 5, `they fought (${total(tank)}, ${total(mia)})`);
  const heavyShare = (o: ReturnType<typeof measure>) => (o.hp + o.hk) / Math.max(1, total(o));
  const kickShare = (o: ReturnType<typeof measure>) => (o.lk + o.hk) / Math.max(1, total(o));
  console.log(JSON.stringify({tank, mia}));
  // What a fighter leads with in one 40-second scrap varies a lot, so the habit is measured over several fights,
  // against the other boxer (same moves, opposite habits: Tank loads up, Jabs picks his shots).
  const sum = (id: string) => [1, 2, 3, 4, 5, 6].map((sd) => measure(id, 40, sd)).reduce((a, o) => ({ heavy: a.heavy + o.heavyLeads, all: a.all + o.leads }), { heavy: 0, all: 0 });
  const th = sum('tank'), dh = sum('danny');
  assert(th.heavy / th.all > dh.heavy / dh.all + 0.15, `heavy boxer leads with heavy shots more than the technical one (${(th.heavy / th.all).toFixed(2)} vs ${(dh.heavy / dh.all).toFixed(2)} over ${th.all}/${dh.all} exchanges)`);
  assert(kickShare(tank) === 0, 'boxer never kicks');
  assert(kickShare(mia) > 0.25, `kickboxer kicks (${kickShare(mia).toFixed(2)})`);
  assert(jonno.grabs > tank.grabs, `wrestler grabs more (${jonno.grabs} vs ${tank.grabs})`);
  console.log(`       tank ${JSON.stringify(tank)}\n       mia ${JSON.stringify(mia)}\n       jonno ${JSON.stringify(jonno)}`);
});

test('the weapons specialist goes and picks up a weapon mid-fight; a counter-fighter answers blocks', () => {
  const dean = measure('dean', 20);
  assert(dean.pickedUp, 'Bats picked up the bar');
  const leah = measure('leah');
  assert(leah.counters > 0 || leah.blocks === 0, `counters after blocks (${leah.counters}/${leah.blocks})`);
});

test('personality decides who they go for: the loyal friend goes for whoever’s on you', () => {
  const p = fresh();
  hireCompanion(p, 'jonno');
  const lvl = LEVELS.residential;
  const enc = lvl.encounters.find((e) => !e.optional)!;
  const w = new World(lvl, p, { entry: lvl.entries[0].id, at: { x: enc.triggerX - 1.5, z: 0 }, seed: 5, companions: [COMPANIONS.jonno], civilians: false });
  for (let i = 0; i < 90; i++) {
    const c = emptyCommand();
    c.moveX = 1;
    w.step(c);
  }
  const me = w.crew[0].f;
  let checked = 0;
  let onYou = 0;
  for (let i = 0; i < 600; i++) {
    w.player.vitals.health = w.player.vitals.maxHealth;
    const live = w.enemies.filter((e) => !e.isKO);
    const nearestToYou = [...live].sort((a, b) => Math.abs(a.pos.x - w.player.pos.x) - Math.abs(b.pos.x - w.player.pos.x))[0];
    w.step(emptyCommand());
    if (live.length > 1 && me.preferredTarget) {
      checked++;
      if (me.preferredTarget === nearestToYou) onYou++;
    }
  }
  assert(checked > 10 && onYou / checked > 0.85, `went for whoever was on you ${onYou}/${checked} frames`);
});

test('lines by personality, and reactions to a joke differ', () => {
  assert(lineFor('joker', 'joke', 0.3) && lineFor('veteran', 'joke', 0.3) === null, 'only the joker tells jokes');
  assert(replyKind('veteran') === 'reply_ignore' && replyKind('aggressive') === 'reply_annoyed' && replyKind('loyal') === 'reply_join' && replyKind('heavy') === 'reply_laugh', 'reactions');
});

console.log('\nStage 11: crew of more than one, and orders');

test('one follower to start, two once Sully’s beaten; one slot swaps, two slots need a free place', () => {
  const p = fresh();
  delete p.save.flags.boss_sully;
  hireCompanion(p, 'shaz');
  hireCompanion(p, 'danny');
  assert(activeSlots(p) === 1 && p.save.companions.following.join() === 'shaz', 'one slot');
  assert(followMe(p, 'danny').ok && p.save.companions.following.join() === 'danny', 'swapped');
  p.save.flags.boss_sully = true;
  assert(activeSlots(p) === 2 && followMe(p, 'shaz').ok && p.save.companions.following.length === 2, 'two');
  hireCompanion(p, 'mia');
  assert(!followMe(p, 'mia').ok, 'full');
  assert(relaxAtHome(p, 'danny').ok && followMe(p, 'mia').ok, 'send one home, bring another');
});

test('two followers in the world: both follow, keep apart, and both fight', () => {
  const p = fresh();
  hireCompanion(p, 'tank');
  hireCompanion(p, 'mia');
  const lvl = LEVELS.high_street;
  const w = new World(lvl, p, { entry: lvl.entries[0].id, at: { x: 5, z: 0 }, seed: 2, companions: [COMPANIONS.tank, COMPANIONS.mia], civilians: false });
  assert(w.crew.length === 2, 'both here');
  for (let i = 0; i < 60 * 4; i++) {
    const c = emptyCommand();
    c.moveX = 1;
    w.step(c);
  }
  steps(w, 120);
  const [a, b] = w.crew.map((m) => m.f);
  assert(Math.hypot(a.pos.x - b.pos.x, a.pos.z - b.pos.z) > 0.3, 'not on top of each other');
  for (const f of [a, b]) assert(Math.abs(f.pos.x - w.player.pos.x) < 4.5, `kept up (${(f.pos.x - w.player.pos.x).toFixed(1)})`);
});

test('orders: wait stays put, ready stays close, follow comes again', () => {
  const p = fresh();
  hireCompanion(p, 'shaz');
  const lvl = LEVELS.high_street;
  const w = new World(lvl, p, { entry: lvl.entries[0].id, at: { x: 5, z: 0 }, seed: 2, companions: [COMPANIONS.shaz], civilians: false });
  steps(w, 60);
  const f = w.crew[0].f;
  w.orderCrew('wait');
  const at = f.pos.x;
  for (let i = 0; i < 60 * 4; i++) {
    const c = emptyCommand();
    c.moveX = 1;
    w.step(c);
  }
  assert(Math.abs(f.pos.x - at) < 0.8 && w.player.pos.x - f.pos.x > 5, 'waited');
  w.orderCrew('follow');
  steps(w, 60 * 5);
  assert(Math.abs(f.pos.x - w.player.pos.x) < 3, 'caught up');
});

console.log('\nStage 11: home life');

function furnishedHome(): Progress {
  const p = fresh();
  for (const id of ['sofa_3', 'armchair', 'tv_43']) {
    buyFurniture(p, id, FURNITURE[id].colours[0]);
    const piece = p.save.property.furniture[p.save.property.furniture.length - 1];
    const spot = suggestSpot(p.save.property, FURNITURE[id], 'living', piece.uid)!;
    assert(spot && placeFurniture(p, piece.uid, spot).ok, `placed ${id}`);
  }
  for (const id of ['shaz', 'danny', 'tank', 'reg']) hireCompanion(p, id);
  return p;
}

const inWall = (f: Fighter) => HOME_WALLS.some((w) => f.pos.x > w.minX - 0.05 && f.pos.x < w.maxX + 0.05 && f.pos.z > w.minZ && f.pos.z < w.maxZ);

test('at home: everyone already in settles straight onto different seats, sat properly on the furniture', () => {
  const p = furnishedHome();
  const level = resolveLevel('home', p.save);
  const defs = p.save.companions.recruited.map((id) => COMPANIONS[id]);
  const w = new World(level, p, { entry: 'start', seed: 3, civilians: false, home: { residents: defs, arriving: [] } });
  const life = w.homeLife!;
  assert(life.seats.length === 4, `four seats on a three-seater and an armchair (${life.seats.length})`);
  steps(w, 10);
  const seated = w.crew.filter((m) => m.f.anchored);
  assert(seated.length === 4, `${seated.length} sat down`);
  const keys = new Set(seated.map((m) => `${m.f.pos.x.toFixed(2)},${m.f.pos.z.toFixed(2)}`));
  assert(keys.size === 4, 'no two in the same seat');
  for (const m of seated) {
    const seat = life.seats.find((s) => Math.abs(s.x - m.f.pos.x) < 0.01 && Math.abs(s.z - m.f.pos.z) < 0.01);
    assert(seat && m.f.activity?.startsWith('sit') && m.f.yawOverride !== null && m.f.pos.y === 0, 'sat on a seat, facing out, on the floor level (not floating)');
  }
});

test('coming home with your crew: they come in through the front door, walk round the walls, find seats', () => {
  const p = furnishedHome();
  followMe(p, 'shaz');
  followMe(p, 'danny');
  const level = resolveLevel('home', p.save);
  const arriving = [COMPANIONS.shaz, COMPANIONS.danny];
  const residents = ['tank', 'reg'].map((id) => COMPANIONS[id]);
  const w = new World(level, p, { entry: 'door', seed: 4, civilians: false, home: { residents, arriving } });
  const door = level.exits.find((e) => e.kind === 'door' && e.to === 'estate')!;
  const comers = w.crew.filter((m) => arriving.includes(m.def));
  steps(w, 20);
  for (const m of comers) assert(!w.sim.fighters.includes(m.f), 'not in until they come through the door');
  let inside = 0;
  for (let i = 0; i < 60 * 30; i++) {
    w.step(emptyCommand());
    for (const m of comers) {
      if (!w.sim.fighters.includes(m.f)) continue;
      if (inside < comers.length && Math.abs(m.f.pos.x - door.x) < 1.2) inside++;
      assert(!inWall(m.f), `${m.def.id} walked through a wall at ${m.f.pos.x.toFixed(2)},${m.f.pos.z.toFixed(2)}`);
      assert(m.f.anchored || !w.arena.blocked(m.f.pos.x, m.f.pos.z, 0.05), `${m.def.id} inside furniture at ${m.f.pos.x.toFixed(2)},${m.f.pos.z.toFixed(2)}`);
    }
  }
  assert(inside >= 1, 'came in at the door');
  const busy = comers.filter((m) => m.brain.home!.available || m.f.anchored);
  assert(busy.length === 2, `both found something to do (${comers.map((m) => m.brain.home!.state).join(', ')})`);
  const sat = w.crew.filter((m) => m.f.anchored).map((m) => `${m.f.pos.x.toFixed(2)},${m.f.pos.z.toFixed(2)}`);
  assert(new Set(sat).size === sat.length, 'nobody sharing a seat');
});

test('home life over a few minutes: they get up, move about, chat, and sit back down', () => {
  const p = furnishedHome();
  const level = resolveLevel('home', p.save);
  const w = new World(level, p, { entry: 'start', seed: 8, civilians: false, home: { residents: p.save.companions.recruited.map((id) => COMPANIONS[id]), arriving: [] } });
  const said: string[] = [];
  w.events.on('crew:say', (e) => said.push(`${e.name}: ${e.text}`));
  const states = new Set<string>();
  const acts = new Set<string>();
  let stoodUp = 0;
  const was = new Map(w.crew.map((m) => [m.f, m.f.anchored]));
  for (let i = 0; i < 60 * 180; i++) {
    w.step(emptyCommand());
    for (const m of w.crew) {
      states.add(m.brain.home!.state);
      if (m.f.activity) acts.add(m.f.activity);
      if (was.get(m.f) && !m.f.anchored) stoodUp++;
      was.set(m.f, m.f.anchored);
      assert(!inWall(m.f), 'through a wall');
    }
    const sat = w.crew.filter((m) => m.f.anchored).map((m) => `${m.f.pos.x.toFixed(2)},${m.f.pos.z.toFixed(2)}`);
    assert(new Set(sat).size === sat.length, 'two on one seat');
  }
  assert(stoodUp >= 1, 'somebody got up');
  assert(states.has('walking') && states.has('seated'), `states seen: ${[...states].join(', ')}`);
  assert(acts.size >= 3, `activities seen: ${[...acts].join(', ')}`);
  assert(said.length >= 2, `conversation: ${said.join(' | ')}`);
  console.log(`       said: ${said.slice(0, 4).join(' | ')}`);
});

test('at home, "come with me" gets them up to follow you; "make yourself at home" sends them back', () => {
  const p = furnishedHome();
  const level = resolveLevel('home', p.save);
  const w = new World(level, p, { entry: 'start', seed: 3, civilians: false, home: { residents: [COMPANIONS.shaz], arriving: [] } });
  steps(w, 10);
  const f = w.crew[0].f;
  assert(f.anchored, 'sat');
  w.callHomeCrew(true);
  steps(w, 60);
  assert(!f.anchored && w.crew[0].brain.home!.state === 'following', 'got up');
  for (let i = 0; i < 60 * 6; i++) {
    const c = emptyCommand();
    c.moveX = -1;
    w.step(c);
  }
  assert(Math.abs(f.pos.x - w.player.pos.x) < 3.5, 'followed you');
  w.callHomeCrew(false);
  steps(w, 60 * 30);
  assert(w.crew[0].brain.home!.state !== 'following', 'back to relaxing');
});

test('resting at home: who’s sat down counts as resting', () => {
  const p = furnishedHome();
  const level = resolveLevel('home', p.save);
  const w = new World(level, p, { entry: 'start', seed: 3, civilians: false, home: { residents: [COMPANIONS.tank], arriving: [] } });
  steps(w, 10);
  assert(w.restingIds().includes('tank'), 'Tank is resting');
});

console.log('\nStage 11: saves');

test('the follow list and fatigue save; an old single "active" companion becomes the first follower', () => {
  const p = fresh();
  hireCompanion(p, 'shaz');
  hireCompanion(p, 'tank');
  followMe(p, 'tank');
  crewState(p, 'tank').fatigue = 40;
  const q = new Progress(sanitiseSave(JSON.parse(JSON.stringify(p.save)))!);
  assert(q.save.companions.following.join() === p.save.companions.following.join() && q.save.companions.state.tank.fatigue === 40, 'kept');
  const old = sanitiseCompanions({ recruited: ['shaz', 'danny'], active: 'danny' });
  assert(old.following.join() === 'danny' && old.state.danny.fatigue === 0, 'migrated');
  const junk = sanitiseCompanions({ recruited: ['shaz'], following: ['shaz', 'shaz', 'nobody', 'tank'] });
  assert(junk.following.join() === 'shaz', 'cleaned');
});

test('the Snug has room for everyone you can hire', () => {
  const pub = LEVELS.pub;
  for (const c of COMPANION_LIST) {
    const st = pub.stations!.find((s) => s.id === 'recruit' && s.tab === c.id)!;
    assert(st && st.x < pub.bounds.maxX - 0.4, `${c.id} in the room`);
  }
  const w = new World(pub, fresh(), { entry: 'door', seed: 1, civilians: false });
  for (const s of pub.stations!) assert(!w.arena.blocked(s.x, s.z, 0.05), `${s.label} reachable`);
});

void ({} as CompanionDef);
console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
