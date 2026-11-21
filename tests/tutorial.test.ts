/**
 * The tutorial (src/tutorial, docs/TUTORIAL.md): new games get it and old saves don't, steps complete only on
 * what really happened in the game, in order, survive a save and load, can be skipped and replayed without
 * paying out, never trap you, and tidy up their listeners. Mo's lessons run on the real combat engine.
 */
// The tutorial card is DOM: a stand-in document, enough for it to build and update under Node.
class FakeEl {
  children: FakeEl[] = [];
  className = '';
  textContent = '';
  isConnected = true;
  attrs: Record<string, string> = {};
  classList = {
    set: new Set<string>(),
    add: (...c: string[]) => c.forEach((x) => this.classList.set.add(x)),
    remove: (...c: string[]) => c.forEach((x) => this.classList.set.delete(x)),
    toggle: (c: string, on?: boolean) => ((on ?? !this.classList.set.has(c)) ? this.classList.set.add(c) : this.classList.set.delete(c)),
    contains: (c: string) => this.classList.set.has(c),
  };
  append(...c: (FakeEl | string)[]) { for (const x of c) if (typeof x !== 'string') this.children.push(x); }
  replaceChildren(...c: (FakeEl | string)[]) { this.children = []; this.append(...c); }
  setAttribute(k: string, v: string) { this.attrs[k] = v; }
  addEventListener() {}
  remove() { this.isConnected = false; }
  removeChild() {}
  get firstChild() { return null; }
}
(globalThis as { document?: unknown }).document = { createElement: () => new FakeEl(), querySelectorAll: () => [], querySelector: () => null };

import { defaultAppearance } from '../src/character/Appearance';
import { createCharacter, emptyAllocation } from '../src/character/Character';
import { emptyCommand } from '../src/input/Commands';
import { newSave, Progress, sanitiseSave } from '../src/progress/Progress';
import { resolveLevel } from '../src/property/levels';
import { control } from '../src/tutorial/controls';
import { CHAPTERS, HINTS } from '../src/tutorial/lessons';
import { ESSENTIAL_CHAPTERS } from '../src/tutorial/state';
import { TutorialManager, type TutorialHost } from '../src/tutorial/TutorialManager';
import { World } from '../src/world/World';
import { LEVELS } from '../src/world/levels';

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

const fresh = (): Progress => new Progress(newSave(createCharacter({ name: 'T', appearance: defaultAppearance('male'), background: 'estate_scrapper', allocated: emptyAllocation() })));

/** A tutorial over a real World, as Game runs it: `dt` a frame, the world stepped alongside. */
function rig(p: Progress, area: 'home' | 'estate' = 'home', entry = 'start') {
  let world = new World(resolveLevel(area as never, p.save), p, { entry });
  let saves = 0;
  let device: 'keyboard' | 'gamepad' | 'touch' = 'keyboard';
  const host: TutorialHost = {
    progress: () => p,
    world: () => world,
    playing: () => true,
    device: () => device,
    hintsOn: () => true,
    save: () => saves++,
    sound: () => {},
    playerScreenX: () => 0.5,
  };
  const t = new TutorialManager(host, new FakeEl() as unknown as HTMLElement);
  let offs = t.attach(world, world.sim.bus);
  const at = () => { const a = p.save.tutorial.active; return a ? `${a.chapter}/${CHAPTERS.find((c) => c.id === a.chapter)!.steps[a.step]?.id}` : 'none'; };
  const frames = (n: number, cmd = emptyCommand) => { for (let i = 0; i < n; i++) { world.step(cmd()); t.update(1 / 60); } };
  /** A step you read: wait the moment it insists on, then Next. */
  const read = () => { frames(30); t.next(); frames(1); };
  return {
    t, p, at, frames, read,
    get world() { return world; },
    saves: () => saves,
    setDevice: (d: typeof device) => (device = d),
    /** Somewhere else (the old world's listeners dropped, as Game does). */
    move(to: 'home' | 'estate', e = 'start') { for (const o of offs) o(); world = new World(resolveLevel(to as never, p.save), p, { entry: e }); offs = t.attach(world, world.sim.bus); },
    drop() { for (const o of offs) o(); offs = []; },
  };
}

/** Put the run at a given chapter and step, as if the ones before were done. */
function goTo(p: Progress, chapter: string, step: string): void {
  const c = CHAPTERS.find((x) => x.id === chapter)!;
  p.save.tutorial.active = { chapter, step: c.steps.findIndex((s) => s.id === step) };
}

test('a new game starts the tutorial; an old save doesn’t, and keeps every hint quiet', () => {
  const p = fresh();
  assert(!p.save.tutorial.essentialDone && p.save.tutorial.active?.chapter === 'first-steps' && p.save.tutorial.active.step === 0, JSON.stringify(p.save.tutorial));
  const old = JSON.parse(JSON.stringify(p.save));
  delete old.tutorial;
  const back = sanitiseSave(old)!;
  assert(back.tutorial.essentialDone && !back.tutorial.active && back.tutorial.hints.includes('*'), JSON.stringify(back.tutorial));
});

test('the lessons line up: chapter list, unique ids, every hint and step has its words', () => {
  assert(JSON.stringify(CHAPTERS.map((c) => c.id)) === JSON.stringify(ESSENTIAL_CHAPTERS), 'chapter lists differ');
  for (const c of CHAPTERS) assert(new Set(c.steps.map((s) => s.id)).size === c.steps.length, `${c.id}: duplicate step`);
  assert(new Set(HINTS.map((h) => h.id)).size === HINTS.length, 'duplicate hint');
});

test('steps go in order, and doing the wrong thing doesn’t tick one off', () => {
  const r = rig(fresh());
  assert(r.at() === 'first-steps/intro', r.at());
  r.t.feed({ type: 'jump' });
  assert(r.at() === 'first-steps/intro', 'a jump ticked off the intro');
  r.read();
  assert(r.at() === 'first-steps/walk', r.at());
  // Jumping isn't walking.
  r.t.feed({ type: 'jump' });
  r.frames(10);
  assert(r.at() === 'first-steps/walk', r.at());
  // Walking is: really walking, in the world.
  r.frames(120, () => ({ ...emptyCommand(), moveX: 1 }));
  assert(r.at() !== 'first-steps/walk', `still on walk at x ${r.world.player.pos.x}`);
});

test('reading steps can’t be mashed through: Next does nothing for the first moment', () => {
  const r = rig(fresh());
  r.t.next();
  assert(r.at() === 'first-steps/intro', 'skipped by mashing');
  r.read();
  assert(r.at() === 'first-steps/walk', r.at());
});

test('combat steps want the real thing: a punch that lands on Mo, not a kick, not a whiff', () => {
  const p = fresh();
  const r = rig(p);
  goTo(p, 'learning-to-fight', 'lp');
  r.t.feed({ type: 'hit', button: 'lk', kind: 'normal', combo: 1, onMo: true });
  r.t.feed({ type: 'hit', button: 'lp', kind: 'normal', combo: 1, onMo: false });
  assert(r.at() === 'learning-to-fight/lp', 'wrong hit counted');
});

test('Mo’s lesson runs on the real fight engine: you really punch him, and his swing really gets blocked', () => {
  const p = fresh();
  const r = rig(p);
  goTo(p, 'learning-to-fight', 'lp');
  const mo = r.world.sparringPartner!;
  assert(mo, 'no Mo at home');
  // Walk up to Mo: the lesson starts when you're there.
  r.world.player.pos.x = mo.pos.x - 0.9;
  r.world.player.pos.z = mo.pos.z;
  r.frames(5);
  assert(r.world.inLesson, 'no lesson started beside Mo');
  for (let i = 0; i < 60 && r.at() === 'learning-to-fight/lp'; i++) r.frames(i % 20 === 0 ? 1 : 1, () => ({ ...emptyCommand(), pressed: { ...emptyCommand().pressed, lp: i % 20 === 0 } }));
  assert(r.at() === 'learning-to-fight/hp', `a landed punch didn't count: ${r.at()}`);
  // Block: hold block while he swings, until the game says it was blocked.
  goTo(p, 'learning-to-fight', 'block');
  for (let i = 0; i < 60 * 8 && r.at() === 'learning-to-fight/block'; i++) r.frames(1, () => ({ ...emptyCommand(), block: true }));
  assert(r.at() === 'learning-to-fight/parry', `no block registered: ${r.at()}`);
  // He can't hurt you in a lesson, and he never goes down.
  assert(r.world.player.vitals.health > r.world.player.vitals.maxHealth * 0.5 && !mo.isKO, 'lesson hurt someone');
});

test('a grab lesson: Mo grabs you for real, and breaking free counts', () => {
  const p = fresh();
  const r = rig(p);
  goTo(p, 'learning-to-fight', 'escape');
  const mo = r.world.sparringPartner!;
  r.world.player.pos.x = mo.pos.x - 0.9;
  r.world.player.pos.z = mo.pos.z;
  let held = false;
  for (let i = 0; i < 60 * 10 && r.at() === 'learning-to-fight/escape'; i++) {
    held ||= r.world.player.grapple?.role === 'held';
    r.frames(1, () => ({ ...emptyCommand(), pressed: { ...emptyCommand().pressed, grab: r.world.player.grapple?.role === 'held' && i % 6 === 0 } }));
  }
  assert(held, 'Mo never grabbed you');
  assert(r.at() === 'learning-to-fight/stamina', `break-free didn't count: ${r.at()}`);
});

test('parry and dodge on the real engine: tapped in time against Mo’s swing, the game itself says so', () => {
  for (const [step, next, press] of [['parry', 'dodge', 'block'], ['dodge', 'grab', 'dodge']] as const) {
    const p = fresh();
    const r = rig(p);
    goTo(p, 'learning-to-fight', step);
    const mo = r.world.sparringPartner!;
    r.world.player.pos.x = mo.pos.x - 0.9;
    r.world.player.pos.z = mo.pos.z;
    // Each swing, press a frame later than the last time: somewhere in there is the timing a player would learn.
    let started = -1;
    let offset = 0;
    r.world.sim.bus.on('move:started', ({ fighter }) => { if (fighter === mo) { started = r.world.sim.frame; offset++; } });
    for (let i = 0; i < 60 * 40 && r.at() === `learning-to-fight/${step}`; i++) {
      const tap = started >= 0 && r.world.sim.frame === started + offset;
      r.frames(1, () => (press === 'block' ? { ...emptyCommand(), block: tap } : { ...emptyCommand(), pressed: { ...emptyCommand().pressed, dodge: tap } }));
    }
    assert(r.at() === `learning-to-fight/${next}`, `${step} never registered (tried ${offset} timings, at ${r.at()})`);
  }
});

test('prompts follow the device in hand and the real bindings', () => {
  assert(control('lp', 'keyboard') === 'J' && control('lp', 'gamepad') === 'X' && control('lp', 'touch') === 'PUNCH', `${control('lp', 'keyboard')} ${control('lp', 'gamepad')} ${control('lp', 'touch')}`);
  assert(control('block', 'gamepad') === 'hold RT' && control('jump', 'keyboard') === 'C' && control('phone', 'keyboard') === 'P', 'bindings');
  // Nothing on a touch screen asks for a key.
  for (const a of ['move', 'depth', 'run', 'jump', 'use', 'lp', 'hp', 'lk', 'hk', 'block', 'parry', 'dodge', 'grab', 'special', 'swap', 'phone', 'pause', 'bag', 'map', 'me'] as const) {
    assert(!/^[A-Z]$|Shift|Space|Esc/.test(control(a, 'touch')), `touch ${a}: ${control(a, 'touch')}`);
  }
});

test('progress survives a save and load, mid-lesson', () => {
  const p = fresh();
  const r = rig(p);
  r.read();
  r.t.skipStep();
  const back = sanitiseSave(JSON.parse(JSON.stringify(p.save)))!;
  assert(back.tutorial.active?.chapter === 'first-steps' && back.tutorial.active.step === 2, JSON.stringify(back.tutorial.active));
  assert(back.tutorial.completed.includes('first-steps/intro') && back.tutorial.skipped.includes('first-steps/walk'), 'done and skipped lost');
  assert(r.saves() > 0, 'never saved');
});

test('skipping the lot leaves things sound: no lesson running, the old coach quiet, nothing half set up', () => {
  const p = fresh();
  const r = rig(p);
  goTo(p, 'learning-to-fight', 'block');
  const mo = r.world.sparringPartner!;
  r.world.player.pos.x = mo.pos.x - 0.9;
  r.frames(5);
  assert(r.world.inLesson, 'no lesson');
  r.t.skipAll();
  r.frames(2);
  assert(!r.world.inLesson && p.save.tutorial.essentialDone && !p.save.tutorial.active, 'lesson left running');
  assert(CHAPTERS.every((c) => p.save.tutorial.skipped.includes(c.id) || p.save.tutorial.completed.includes(c.id)), 'chapters unaccounted');
  assert(p.has('coach:done'), 'old coach still on');
  // And it comes back from the library.
  r.t.resumeAll();
  assert(p.save.tutorial.active?.chapter === 'first-steps' && !p.save.tutorial.essentialDone, 'resume');
});

test('a replay never pays, and leaves what you’ve done alone', () => {
  const p = fresh();
  p.save.tutorial = { ...p.save.tutorial, essentialDone: true, active: null, completed: ['first-steps'] };
  const cash = p.save.cash.pocket;
  const xp = p.save.xp;
  const r = rig(p);
  r.t.replayChapter('first-steps');
  assert(r.t.active, 'replay didn’t start');
  r.read();
  r.t.skipStep();
  assert(p.save.tutorial.completed.length === 1 && !p.save.tutorial.skipped.length && !p.save.tutorial.active, 'replay changed the save');
  assert(p.save.cash.pocket === cash && p.save.xp === xp, 'replay paid out');
});

test('nothing traps you: a step needing Mo waits off the street with a way on, and every step can be skipped', () => {
  const p = fresh();
  const r = rig(p, 'estate', 'start');
  goTo(p, 'learning-to-fight', 'lp');
  r.frames(30);
  r.t.feed({ type: 'hit', button: 'lp', kind: 'normal', combo: 1, onMo: true });
  assert(r.at() === 'learning-to-fight/lp', 'completed away from Mo');
  r.t.skipStep();
  assert(r.at() === 'learning-to-fight/hp', 'skip didn’t move on');
  for (let i = 0; i < 60 && p.save.tutorial.active; i++) r.t.skipStep();
  assert(!p.save.tutorial.active && p.save.tutorial.essentialDone, 'couldn’t skip to the end');
});

test('a fight you’ve already won is passed over', () => {
  const p = fresh();
  p.set('cleared:estate:lads');
  const r = rig(p);
  goTo(p, 'styles', 'more');
  r.read();
  assert(p.save.tutorial.active?.chapter === 'building' && p.save.tutorial.completed.includes('first-scrap'), JSON.stringify(p.save.tutorial));
});

test('listeners go when the world goes', () => {
  const p = fresh();
  const r = rig(p);
  goTo(p, 'first-steps', 'jump');
  const old = r.world;
  r.drop();
  old.sim.bus.emit('fighter:jump', { fighter: old.player });
  assert(r.at() === 'first-steps/jump', 'heard a world it had let go of');
});

test('hints come once, after the basics, and respect what you’ve seen', () => {
  const p = fresh();
  p.save.tutorial = { ...p.save.tutorial, essentialDone: true, active: null };
  const r = rig(p);
  r.t.feed({ type: 'picked' });
  r.frames(70);
  assert(p.save.tutorial.hints.includes('pockets') && r.t.wantsNext, 'no pockets hint');
  r.t.next();
  r.t.feed({ type: 'picked' });
  r.frames(70);
  assert(p.save.tutorial.hints.filter((h) => h === 'pockets').length === 1 && !r.t.wantsNext, 'hint came twice');
});

void LEVELS;
console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
