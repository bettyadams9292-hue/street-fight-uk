/**
 * Jobs (src/jobs): contacts in their places, boards that change every few trips, chains that open with standing,
 * and each kind of job run end to end in a real World: sort someone out, collect a debt (paid or fought for),
 * deliver a parcel, get something back, buy and sell. Failing (too slow, going down with the goods, dropping it)
 * costs standing; finishing pays cash, XP, items, standing and heat where it happened.
 */
import { defaultAppearance } from '../src/character/Appearance';
import { createCharacter, emptyAllocation } from '../src/character/Character';
import { emptyCommand } from '../src/input/Commands';
import { newSave, Progress, sanitiseSave } from '../src/progress/Progress';
import { LEVELS } from '../src/world/levels';
import { World } from '../src/world/World';
import {
  acceptJob, BOARD_TRIPS, spotIn, boardOf, chainJob, CHAINS, checkJob, completeJob, CONTACT_IDS, CONTACTS, contactOpen, failJob, jobPay,
  jobHeat, STANDING_DROP, STANDING_FAIL, STANDING_JOB, standingWith, streetJob, tierOf, type Job,
} from '../src/jobs/jobs';
import { ITEMS } from '../src/items/items';
import { TITLE_SLUGS } from '../src/ui/titles';

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
  p.save.bank = 'califax';
  p.save.visited = ['home', 'estate', 'residential', 'high_street', 'alleys', 'industrial', 'market'];
  p.save.cash.pocket = 2000;
  return p;
};

/** A job of a kind, on a street, made by hand (the fields the generator fills). */
function job(kind: Job['kind'], area: Job['area'], extra: Partial<Job> = {}): Job {
  const pay = jobPay(kind, 1, area, 1);
  return {
    id: `t_${kind}`, from: 'terry', giver: 'Terry Walsh', kind, title: 'Test job', brief: '', area, x: spotIn(area, () => 0.4), target: 'Kyle', body: 'male', seed: 5,
    mates: 1, cash: pay.cash, xp: pay.xp, items: [], heat: jobHeat(kind, false), owed: pay.owed, cost: pay.cost,
    item: kind === 'deliver' ? 'job_parcel' : kind === 'deal' ? 'job_package' : kind === 'recover' ? 'job_ring' : undefined,
    seconds: kind === 'deliver' || kind === 'deal' ? 200 : undefined, fights: false, ...extra,
  };
}

/** Into the target's street, stood next to whoever's at the end of the job. */
function arrive(p: Progress, area: Job['area']) {
  const w = new World(LEVELS[area], p, { entry: LEVELS[area].entries[0].id, seed: 2, civilians: false });
  const t = w.jobFolk.find((x) => x.role === 'target');
  assert(t, 'the target is there');
  w.player.pos.x = t.f.pos.x - 0.9;
  w.player.pos.z = t.f.pos.z + 0.3;
  return { w, t };
}

const run = (w: World, frames: number, use = false) => {
  for (let i = 0; i < frames; i++) w.step({ ...emptyCommand(), use: use && i === 0 });
};

console.log('Jobs');

test('every contact stands in their place, in a level that exists', () => {
  for (const id of CONTACT_IDS) {
    const c = CONTACTS[id];
    const st = (LEVELS[c.area].stations ?? []).filter((s) => s.id === 'contact' && s.tab === id);
    assert(st.length === 1, `${c.name} has one station in ${c.area}`);
    assert(st[0].npc?.name === c.name, `${c.name} stands there`);
    const w = new World(LEVELS[c.area], progress(), { entry: LEVELS[c.area].entries[0].id, seed: 1, civilians: false });
    const npc = [...w.npcs.entries()].find(([s]) => s.id === 'contact' && s.tab === id)?.[1];
    assert(npc && !w.arena.blocked(npc.pos.x, npc.pos.z, 0.05), `${c.name} isn't stood inside anything`);
    for (const step of CHAINS[id]) assert(LEVELS[step.area] && (!step.item || ITEMS[step.item]?.jobItem) && ITEMS[step.reward], `${c.name}: chain job "${step.title}" makes sense`);
  }
});

test('Del and Nails wait for the story; the others will talk to you from the start', () => {
  const p = progress();
  assert(contactOpen(p, 'terry') && contactOpen(p, 'bev') && contactOpen(p, 'kez'), 'Terry, Bev and Kez');
  assert(!contactOpen(p, 'del') && !contactOpen(p, 'nails'), 'not Del or Nails yet');
  p.set('boss_sully');
  p.set('boss_gaffer');
  assert(contactOpen(p, 'del') && contactOpen(p, 'nails'), 'open after the bosses');
});

test('a board holds two jobs of the contact’s kinds, on streets you’ve been to, and changes every few trips', () => {
  const p = progress();
  for (const id of CONTACT_IDS) {
    const b = boardOf(p, id);
    assert(b.length === 2, `${id}: two jobs`);
    for (const j of b) {
      assert(CONTACTS[id].kinds.includes(j.kind), `${id}: ${j.kind} is their kind of work`);
      assert(p.save.visited.includes(j.area), `${id}: ${j.area} is somewhere you've been`);
      assert(j.cash > 0 && j.xp > 0, 'pays');
      assert(j.x > LEVELS[j.area].bounds.minX + 5 && j.x < LEVELS[j.area].bounds.maxX - 5, 'clear of the ends of the street');
    }
  }
  const first = boardOf(p, 'terry').map((j) => j.id).join();
  p.save.trips += BOARD_TRIPS - 1;
  assert(boardOf(p, 'terry').map((j) => j.id).join() === first, 'the same jobs a trip or two later');
  p.save.trips += 1;
  assert(boardOf(p, 'terry').map((j) => j.id).join() !== first, 'new jobs after a few trips');
});

test('one job at a time; a deal costs the package price up front', () => {
  const p = progress();
  const before = p.save.cash.pocket;
  const d = job('deal', 'high_street');
  assert(acceptJob(p, d).ok, 'took the deal');
  assert(p.save.cash.pocket === before - d.cost!, 'paid for the package');
  assert(p.save.inventory.some((x) => x.id === 'job_package' && x.stolen), 'carrying it (the police would take it)');
  assert(!acceptJob(p, job('sort', 'estate')).ok, 'can’t take a second job');
  const broke = progress();
  broke.save.cash.pocket = 0;
  broke.save.cash.bank = 0;
  assert(!acceptJob(broke, job('deal', 'high_street')).ok, 'no money, no package');
});

test('sort someone out: they square up when you get close, put him down and go back for the money', () => {
  const p = progress();
  assert(acceptJob(p, job('sort', 'estate', { mates: 2 })).ok, 'took it');
  const { w, t } = arrive(p, 'estate');
  assert(w.jobFolk.length === 3, 'him and two mates');
  assert(t.f.team === 'neutral', 'stood about till you turn up');
  run(w, 5);
  assert(t.f.team === 'enemy' && w.enemies.includes(t.f), 'he squares up');
  t.f.knockOut();
  run(w, 5);
  assert(p.save.jobs.active?.stage === 'back', 'back to Terry');
  const cash = p.save.cash.pocket;
  const paid = completeJob(p)!;
  assert(paid && p.save.cash.pocket === cash + paid.cash, 'paid in cash');
  assert(standingWith(p, 'terry') === STANDING_JOB, 'standing up');
  assert(p.heatIn('Home Estate').street >= 5, 'heat where it happened');
});

test('collect a debt: he pays up (back to Bev with the money) or he fights for it', () => {
  const p = progress();
  assert(acceptJob(p, job('debt', 'estate', { from: 'bev', giver: 'Bev Okafor', fights: false })).ok, 'took it');
  let { w } = arrive(p, 'estate');
  run(w, 2, true);
  assert(p.save.jobs.active?.stage === 'back', 'paid up: take it back');
  failJob(p, 'dropped');
  const q = progress();
  assert(acceptJob(q, job('debt', 'estate', { from: 'bev', giver: 'Bev Okafor', fights: true })).ok, 'took the next');
  const a = arrive(q, 'estate');
  w = a.w;
  run(w, 2, true);
  assert(a.t.f.team === 'enemy', 'he’d rather fight');
  assert(q.save.jobs.active?.stage === 'go', 'not collected yet');
  a.t.f.knockOut();
  run(w, 5);
  assert(q.save.jobs.active?.stage === 'back', 'took it off him');
});

test('deliver a parcel: hand it over and you’re paid on the spot; too slow and it’s off', () => {
  const p = progress();
  assert(acceptJob(p, job('deliver', 'estate')).ok, 'took it');
  assert(p.save.inventory.some((x) => x.id === 'job_parcel'), 'carrying the parcel');
  const { w } = arrive(p, 'estate');
  const cash = p.save.cash.pocket;
  run(w, 2, true);
  assert(!p.save.jobs.active, 'done');
  assert(!p.save.inventory.some((x) => x.id === 'job_parcel'), 'parcel handed over');
  assert(p.save.cash.pocket > cash, 'paid');
  const q = progress();
  acceptJob(q, job('deliver', 'estate'));
  q.save.playTime += 500;
  assert(checkJob(q) !== null && !q.save.jobs.active, 'too slow: failed');
  assert(standingWith(q, 'terry') === 0 && q.save.jobs.failed === 1, 'counted as failed');
  assert(!q.save.inventory.some((x) => x.id === 'job_parcel'), 'the parcel’s gone');
});

test('get something back: he drops it when he’s down, and you take it back', () => {
  const p = progress();
  assert(acceptJob(p, job('recover', 'estate')).ok, 'took it');
  const { w, t } = arrive(p, 'estate');
  run(w, 5);
  t.f.knockOut();
  run(w, 5);
  const g = w.items.find((i) => i.stack.id === 'job_ring');
  assert(g, 'the ring’s on the floor');
  assert(w.pickUp(g), 'picked it up');
  run(w, 40);
  assert(p.save.jobs.active?.stage === 'back', 'take it back');
  const paid = completeJob(p);
  assert(paid && !p.save.inventory.some((x) => x.id === 'job_ring'), 'handed over and paid');
});

test('buy and sell: the buyer pays more than the package cost, unless he tries it on and you have to win it', () => {
  const p = progress();
  const d = job('deal', 'estate', { from: 'kez', giver: 'Kez' });
  const before = p.save.cash.pocket;
  assert(acceptJob(p, d).ok, 'bought the package');
  const { w } = arrive(p, 'estate');
  run(w, 2, true);
  assert(!p.save.jobs.active, 'sold');
  assert(p.save.cash.pocket - before === d.cash - d.cost!, `made £${d.cash - d.cost!}`);
  assert(d.cash > d.cost!, 'at a profit');
  assert(p.save.record.some((e) => e.crime === 'dealing'), 'on your record if they ever nick you');
  assert(p.heatIn('Home Estate').police >= 5, 'police heat');
  const q = progress();
  acceptJob(q, job('deal', 'estate', { from: 'kez', giver: 'Kez', fights: true, mates: 2 }));
  const a = arrive(q, 'estate');
  run(a.w, 2, true);
  assert(a.t.f.team === 'enemy' && q.save.jobs.active, 'he tries it on');
  a.t.f.knockOut();
  run(a.w, 5);
  assert(!q.save.jobs.active, 'win it and you’re paid');
});

test('dropping or failing costs standing; old saves and nonsense load clean', () => {
  const p = progress();
  p.save.jobs.standing.terry = 20;
  acceptJob(p, job('sort', 'estate'));
  failJob(p, 'dropped');
  assert(standingWith(p, 'terry') === 20 - STANDING_DROP, 'dropped');
  acceptJob(p, job('deliver', 'estate'));
  failJob(p, 'failed');
  assert(standingWith(p, 'terry') === 20 - STANDING_DROP - STANDING_FAIL, 'failed');
  const raw = JSON.parse(JSON.stringify(p.save));
  delete raw.jobs;
  assert(sanitiseSave(raw)?.jobs.active === null, 'an old save has no job on');
  raw.jobs = { standing: { terry: 999, nobody: 5 }, active: { id: 'x', kind: 'nonsense' }, board: { kez: [{ id: 1 }] } };
  const l = { save: sanitiseSave(raw)! };
  assert(l.save.jobs.standing.terry === 100 && l.save.jobs.active === null && (l.save.jobs.board.kez ?? []).length === 0, 'junk cleaned');
});

test('chain jobs open with standing, pay more, give their reward, and move on', () => {
  const p = progress();
  const first = chainJob(p, 'terry');
  assert(first.job && first.job.chain === 0, 'the first is there from the start');
  const ordinary = jobPay(first.job.kind, p.save.level, first.job.area, 1).cash;
  assert(first.job.cash > ordinary, 'pays more than an ordinary job');
  assert(acceptJob(p, first.job).ok, 'took it');
  p.save.jobs.active!.stage = 'back';
  const paid = completeJob(p)!;
  assert(paid.chain && paid.items.includes(CHAINS.terry[0].reward), 'gave its reward');
  assert((p.save.jobs.chain.terry ?? 0) === 1, 'on to the next');
  const second = chainJob(p, 'terry');
  assert(!second.job && second.locked, 'the next needs more standing');
  p.save.jobs.standing.terry = CHAINS.terry[1].needs;
  assert(chainJob(p, 'terry').job?.chain === 1, 'open now');
  assert(tierOf(30).name === 'Trusted' && tierOf(30).mult > 1, 'standing pays');
});

test('a passer-by’s job is the same for the same street and trip, and pays when it’s done', () => {
  const p = progress();
  const a = streetJob(p, 'high_street', 'Kyle');
  const b = streetJob(p, 'high_street', 'Kyle');
  assert(a.id === b.id && a.area === b.area && a.kind === b.kind, 'same job');
  assert(a.from === 'street' && a.area !== 'high_street', 'somewhere else');
  if (a.kind === 'sort') {
    acceptJob(p, a);
    const { w, t } = arrive(p, a.area);
    run(w, 5);
    t.f.knockOut();
    run(w, 5);
    assert(!p.save.jobs.active, 'paid on the spot: nobody to go back to');
  }
});

test('now and then someone on the street waves you over with a job; take it and they’re off', () => {
  const p = progress();
  p.save.tutorial.essentialDone = true;
  const lvl = LEVELS.high_street;
  let w: World | null = null;
  for (let trip = 0; trip < 40 && !w?.jobGiver; trip++) {
    p.save.trips = trip;
    w = new World(lvl, p, { entry: 'left', seed: 3 });
  }
  assert(w?.jobGiver, 'someone with a job turns up on some trips');
  const g = w.jobGiver.f;
  assert(!w.arena.blocked(g.pos.x, g.pos.z, 0.05), 'stood somewhere clear');
  for (const e of w.encounters) e.status = 'cleared';
  // Walk up to them from the front.
  w.player.pos.x = g.pos.x;
  w.player.pos.z = g.pos.z + 0.75;
  let offer: Job | null = null;
  w.events.on('job:offer', ({ job: j }) => (offer = j));
  run(w, 2, true);
  assert(offer, 'USE on them shows their job');
  const o = offer as Job;
  assert(o.from === 'street' && o.giver === g.name, 'their own job');
  assert(acceptJob(p, o).ok, 'took it');
  w.giverTook();
  assert(!w.jobGiver, 'they’re off');
  const again = new World(lvl, p, { entry: 'left', seed: 3 });
  assert(!again.jobGiver, 'not back on the same trip');
  p.save.tutorial.essentialDone = false;
  failJob(p, 'dropped');
  p.save.trips += 1;
  for (let i = 0; i < 40; i++, p.save.trips++) assert(!new World(lvl, p, { entry: 'left', seed: 3 }).jobGiver, 'nobody while you’re still learning');
});

test('the new buttons have painted titles', () => {
  for (const s of ['take-the-job', 'hand-it-over', 'drop-the-job', 'not-now']) assert(TITLE_SLUGS.has(s), s);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
