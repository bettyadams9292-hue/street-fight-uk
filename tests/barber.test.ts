/**
 * NeXo Cutz (src/barber/barber.ts): you pay only for what changes, line by line; paying changes your own look
 * and saves; no money, nothing on the chart, or no change means no cut; beards only where the creator allows them;
 * the shop is on the High Street with its door and Vinny's chair.
 */
import assert from 'node:assert/strict';
import { BEARDS, COLOUR_PRICE, GREYS, HAIRCUTS, cutOf, getCut, menuFor, quote } from '../src/barber/barber';
import { HAIR_COLOURS } from '../src/character/Appearance';
import { createCharacter, emptyAllocation } from '../src/character/Character';
import { defaultAppearance } from '../src/character/Appearance';
import { Progress, newSave } from '../src/progress/Progress';
import { LEVELS } from '../src/world/levels';

let passed = 0;
const ok = (name: string, fn: () => void) => { fn(); passed++; console.log(`  ok   ${name}`); };
const fresh = (body: 'male' | 'female' = 'male') => new Progress(newSave(createCharacter({ name: 'A', appearance: defaultAppearance(body), background: 'estate_scrapper', allocated: emptyAllocation() })));

ok('nothing changing costs nothing', () => {
  const p = fresh();
  const now = cutOf(p.save.character.appearance);
  assert.deepEqual(quote(now, now), { lines: [], total: 0 });
  p.save.cash.pocket = 500;
  const r = getCut(p, now);
  assert.equal(r.ok, false);
  assert.equal(p.save.cash.pocket, 500);
});

ok('the bill adds up each change at its price', () => {
  const p = fresh();
  const now = cutOf(p.save.character.appearance);
  const colour = HAIR_COLOURS.find((c) => c !== now.hairColour)!;
  const wanted = { ...now, hair: 'quiff' as const, facialHair: 'full_beard' as const, hairColour: colour, greying: GREYS[2].amount };
  const q = quote(now, wanted);
  assert.equal(q.lines.length, 4);
  assert.equal(q.total, HAIRCUTS.quiff.price + BEARDS.full_beard.price + COLOUR_PRICE + GREYS[2].price);
});

ok('paying changes your own look, pocket first then the tin', () => {
  const p = fresh();
  p.save.cash.pocket = 10;
  p.save.cash.bank = 100;
  const r = getCut(p, { ...cutOf(p.save.character.appearance), hair: 'cornrows' });
  assert.ok(r.ok);
  assert.equal(p.save.character.appearance.hair, 'cornrows');
  assert.equal(p.save.cash.pocket, 0);
  assert.equal(p.save.cash.bank, 110 - HAIRCUTS.cornrows.price);
  assert.equal(p.appearance().hair, 'cornrows', 'shows on the fighter');
});

ok('not enough money: no cut, nothing taken', () => {
  const p = fresh();
  p.save.cash.pocket = 5;
  p.save.cash.bank = 0;
  const before = p.save.character.appearance.hair;
  const r = getCut(p, { ...cutOf(p.save.character.appearance), hair: before === 'long' ? 'bob' : 'long' });
  assert.equal(r.ok, false);
  assert.equal(p.save.character.appearance.hair, before);
  assert.equal(p.save.cash.pocket, 5);
});

ok('grey only changes when you ask for it', () => {
  const p = fresh();
  p.save.character.appearance.greying = 0.1;
  p.save.cash.pocket = 100;
  assert.ok(getCut(p, { ...cutOf(p.save.character.appearance), hair: 'buzz' === p.save.character.appearance.hair ? 'crop' : 'buzz' }).ok);
  assert.equal(p.save.character.appearance.greying, 0.1, 'kept as it was');
  assert.ok(getCut(p, { ...cutOf(p.save.character.appearance), greying: 0.75 }).ok);
  assert.equal(p.save.character.appearance.greying, 0.75);
});

ok('beards on a male body only; colours only from the chart', () => {
  assert.equal(menuFor('female').beard.length, 0);
  assert.ok(menuFor('male').beard.length > 1);
  const f = fresh('female');
  f.save.cash.pocket = 100;
  assert.equal(getCut(f, { ...cutOf(f.save.character.appearance), facialHair: 'full_beard' }).ok, false);
  assert.equal(getCut(f, { ...cutOf(f.save.character.appearance), hairColour: '#00ff00' }).ok, false);
});

ok('NeXo Cutz is on the High Street, with Vinny in the chair', () => {
  const hs = LEVELS.high_street;
  const door = hs.exits.find((e) => e.to === 'barber_shop');
  assert.ok(door, 'a door from the High Street');
  assert.ok(hs.entries.some((e) => e.id === door!.toEntry || e.id === 'barber'));
  const shop = LEVELS.barber_shop;
  assert.ok(shop.exits.some((e) => e.to === 'high_street' && hs.entries.some((x) => x.id === e.toEntry)), 'and back out');
  assert.ok(shop.stations.some((s) => s.id === 'barber_chair' && s.npc?.name === 'Vinny'));
});

console.log(`${passed} passed, 0 failed`);
