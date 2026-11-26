/**
 * The Scrap Yard fight club (fightclub/club.ts): shut till Sully's beaten; the ladder (buy-in, purse, one fight a
 * night, climbing); the title (the one-of-a-kind belt, once); defences every few nights for growing purses;
 * losing the title and winning it back; stripped for keeping a challenger waiting; the fight itself in a World
 * (to the stoppage, never a game over); old saves.
 */
import { defaultAppearance } from '../src/character/Appearance';
import { createCharacter, emptyAllocation } from '../src/character/Character';
import { emptyCommand } from '../src/input/Commands';
import { newSave, Progress, sanitiseSave } from '../src/progress/Progress';
import { LEVELS } from '../src/world/levels';
import { World } from '../src/world/World';
import { ITEMS } from '../src/items/items';
import { unlocked } from '../src/map/worldMap';
import {
  BELT, BUY_IN, CHAMPION, CLUB_FLAG, DEFENCE_TRIPS, LADDER, REMATCH_PURSE, STRIP_TRIPS, buyInOf, canFight, challenger, clubOpen, clubTick,
  defencePurse, enterBout, NIGHT_SECONDS, nextBout, sanitiseClub, settleBout,
} from '../src/fightclub/club';

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

const fresh = (cash = 20000) => {
  const p = new Progress(newSave(createCharacter({ name: 'T', appearance: defaultAppearance(), background: 'estate_scrapper', allocated: emptyAllocation() })));
  p.save.bank = 'califax';
  p.save.cash.pocket = cash;
  return p;
};
const open = (cash?: number) => {
  const p = fresh(cash);
  for (const f of ['boss_gaffer', CLUB_FLAG]) p.set(f);
  return p;
};
/** Fight the next bout on the card and win (or lose) it, then move on a night of play. */
const fight = (p: Progress, won: boolean) => {
  const b = nextBout(p)!;
  assert(enterBout(p, b), `couldn’t enter ${b.who.name}`);
  const r = settleBout(p, b, won);
  p.save.playTime += NIGHT_SECONDS;
  return { b, r };
};

test('shut till Sully’s beaten: the door, the map and the card', () => {
  const p = fresh();
  assert(!clubOpen(p), 'open before Sully');
  const door = LEVELS.industrial.exits.find((e) => e.to === 'fight_club');
  assert(door && door.requires === CLUB_FLAG, 'the cellar door under Kane’s needs Sully beaten');
  assert(!unlocked(p, 'fight_club'), 'on the map before Sully');
  const q = open();
  assert(clubOpen(q) && unlocked(q, 'fight_club'), 'not open after Sully');
  assert(LEVELS.fight_club.stations?.some((s) => s.id === 'fight_club'), 'Sully’s not running the card');
});

test('the ladder: buy-in in, purse out, up a rung, one fight a night (of play time, not a trip)', () => {
  const p = open(1000);
  const b = nextBout(p)!;
  assert(b.kind === 'ladder' && b.who.id === LADDER[0].id, 'first fight isn’t the bottom of the card');
  assert(buyInOf(b) === Math.round(LADDER[0].purse * BUY_IN), 'buy-in is a share of the purse');
  assert(enterBout(p, b), 'couldn’t enter');
  assert(p.save.cash.pocket === 1000 - buyInOf(b), 'buy-in not taken');
  assert(!canFight(p, nextBout(p)!).ok, 'two fights in one night');
  p.save.trips += 5;
  assert(!canFight(p, nextBout(p)!).ok, 'walking out and back in brought the next fight round');
  const r = settleBout(p, b, true);
  assert(r.won && r.purse === LADDER[0].purse && p.save.cash.pocket === 1000 - buyInOf(b) + LADDER[0].purse, 'purse not paid');
  assert(p.save.club.rank === 1 && nextBout(p)!.who.id === LADDER[1].id, 'didn’t move up');
  // Lose the next: buy-in gone, no purse, same rung.
  p.save.playTime += NIGHT_SECONDS;
  const before = p.save.cash.pocket;
  const { b: b2, r: r2 } = fight(p, false);
  assert(!r2.won && r2.purse === 0 && p.save.cash.pocket === before - buyInOf(b2), 'a loss paid out');
  assert(p.save.club.rank === 1 && p.save.club.losses === 1, 'a loss moved you');
  const skint = open(5);
  skint.save.cash.bank = 0;
  assert(!canFight(skint, nextBout(skint)!).ok, 'fought without the buy-in');
});

test('the title: a shot after the top contender, the belt once, then defences every few nights', () => {
  const p = open(50000);
  for (let i = 0; i < LADDER.length; i++) fight(p, true);
  const shot = nextBout(p)!;
  assert(shot.kind === 'title' && shot.who.id === CHAMPION.id, 'no title shot after the top contender');
  const { r } = fight(p, true);
  assert(r.crowned && r.belt && r.purse === CHAMPION.purse, 'title win didn’t crown you or pay');
  assert(p.save.club.champion && p.save.inventory.some((x) => x.id === BELT), 'no belt');
  const belt = ITEMS[BELT];
  assert(belt.rarity === 'legendary' && belt.unsellable && belt.wear?.slot === 'waist', 'the belt isn’t a one-of-a-kind wearable');
  // Between defences there's nothing on the card for you.
  assert(nextBout(p) === null, 'a defence straight away');
  p.save.playTime += NIGHT_SECONDS * (DEFENCE_TRIPS - 1);
  const d0 = nextBout(p)!;
  assert(d0.kind === 'defence' && buyInOf(d0) === 0, 'no defence when it’s due, or the champ pays to defend');
  const { r: r1 } = fight(p, true);
  assert(r1.purse === defencePurse(0) && p.save.club.defences === 1, 'first defence pay');
  p.save.playTime += NIGHT_SECONDS * DEFENCE_TRIPS;
  const { r: r2 } = fight(p, true);
  assert(r2.purse === defencePurse(1) && r2.purse > r1.purse, 'defences don’t pay more each time');
  assert(defencePurse(100) === defencePurse(1000), 'defence purse never tops out');
  // Challengers get harder.
  assert(challenger(5, 10).attr > challenger(0, 10).attr && challenger(0, 60).attr > challenger(0, 10).attr, 'challengers don’t get harder');
});

test('losing the title, the rematch, and no second belt', () => {
  const p = open(50000);
  for (let i = 0; i <= LADDER.length; i++) fight(p, true);
  p.save.playTime += NIGHT_SECONDS * DEFENCE_TRIPS;
  const { r } = fight(p, false);
  assert(r.lostTitle && !p.save.club.champion, 'kept the title after losing a defence');
  const re = nextBout(p)!;
  assert(re.kind === 'title' && re.rematch && re.who.purse === REMATCH_PURSE, 'no rematch for the belt');
  const belts = () => p.save.inventory.filter((x) => x.id === BELT).length;
  const had = belts();
  const { r: back } = fight(p, true);
  assert(back.crowned && !back.belt && belts() === had, 'a second belt');
});

test('stripped for keeping a challenger waiting', () => {
  const p = open(50000);
  for (let i = 0; i <= LADDER.length; i++) fight(p, true);
  p.save.playTime += NIGHT_SECONDS * (DEFENCE_TRIPS + STRIP_TRIPS - 2);
  assert(!clubTick(p).stripped && p.save.club.champion, 'stripped too soon');
  p.save.playTime += NIGHT_SECONDS * 2;
  assert(clubTick(p).stripped && !p.save.club.champion, 'not stripped');
  assert(nextBout(p)?.kind === 'title', 'no way to win it back');
});

test('the fight in the pit: to the stoppage, paid, never a game over', () => {
  const p = open(5000);
  const w = new World(LEVELS.fight_club, p, { entry: 'door', seed: 3 });
  assert(w.clubFoe && w.clubFoe.bout.who.id === LADDER[0].id, 'nobody waiting in the pit');
  const ends: { won: boolean; kind: string }[] = [];
  let defeated = false;
  w.events.on('duel:end', (e) => ends.push(e));
  w.events.on('player:defeated', () => (defeated = true));
  assert(w.startClubFight().ok && w.clubBout, 'the bell didn’t go');
  const foe = w.duel!.f;
  assert(foe.team === 'enemy' && w.enemies.includes(foe) && !foe.weapon, 'opponent isn’t fighting, or has a weapon');
  foe.vitals.health = 0;
  for (let i = 0; i < 10; i++) w.step(emptyCommand());
  assert(ends.length === 1 && ends[0].won && ends[0].kind === 'club' && !w.clubBout, 'putting them down didn’t win');
  assert(!w.enemies.includes(foe), 'the loser’s still on the fight list');
  // Going down yourself loses the fight, not the game.
  const q = open(5000);
  const w2 = new World(LEVELS.fight_club, q, { entry: 'door', seed: 4 });
  const ends2: { won: boolean }[] = [];
  w2.events.on('duel:end', (e) => ends2.push(e));
  w2.events.on('player:defeated', () => (defeated = true));
  assert(w2.startClubFight().ok, 'second bell');
  w2.player.vitals.health = 0;
  for (let i = 0; i < 60 * 4; i++) w2.step(emptyCommand());
  assert(ends2.length === 1 && !ends2[0].won, 'going down didn’t lose');
  assert(!defeated, 'going down in the pit was a game over');
  // Fought tonight: nobody waiting next time you come down.
  enterBout(q, nextBout(q)!);
  const w3 = new World(LEVELS.fight_club, q, { entry: 'door', seed: 5 });
  assert(!w3.clubFoe, 'a second opponent the same night');
});

test('old saves and junk', () => {
  const s = newSave(createCharacter({ name: 'T', appearance: defaultAppearance(), background: 'estate_scrapper', allocated: emptyAllocation() }));
  const raw = JSON.parse(JSON.stringify(s));
  delete raw.club;
  const old = sanitiseSave(raw);
  assert(old.club.rank === 0 && !old.club.champion, 'old save has a club record');
  const junk = sanitiseClub({ rank: 99, champion: 'yes', defences: -4, due: 'soon' });
  assert(junk.rank === LADDER.length && !junk.champion && junk.defences === 0 && junk.due === null, 'junk got through');
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
