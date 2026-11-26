/**
 * Banking (src/money/banking.ts): a new game or an old save has no bank; picking one in CaliStore opens the account
 * there and puts that bank's app on the phone; your own bank's machines are free anywhere, the other bank's charge
 * `OTHER_BANK_FEE`; with no bank yet the old town/estate rule holds; the choice survives a save and junk doesn't.
 */
import assert from 'node:assert/strict';
import { defaultAppearance } from '../src/character/Appearance';
import { createCharacter, emptyAllocation } from '../src/character/Character';
import { Progress, newSave, sanitiseSave } from '../src/progress/Progress';
import { OTHER_BANK_FEE, PAY_FEE, atmFee, withdraw } from '../src/money/atm';
import { chooseBank, myBank } from '../src/money/banking';

let passed = 0;
const ok = (name: string, fn: () => void) => {
  fn();
  passed++;
  console.log(`  ok   ${name}`);
};
const fresh = () => new Progress(newSave(createCharacter({ name: 'A', appearance: defaultAppearance('male'), background: 'estate_scrapper', allocated: emptyAllocation() })));

ok('a new game has no bank, and an old save without one loads with none', () => {
  const p = fresh();
  assert.equal(p.save.bank, undefined);
  assert.equal(myBank(p), null);
  const raw = JSON.parse(JSON.stringify(p.save));
  delete raw.bank;
  assert.equal(sanitiseSave(raw).bank, undefined);
});

ok('picking a bank opens the account there, once; switching moves it', () => {
  const p = fresh();
  assert.equal(chooseBank(p, 'califax'), true);
  assert.equal(myBank(p)?.name, 'Califax');
  assert.equal(chooseBank(p, 'califax'), false, 'already yours');
  assert.equal(chooseBank(p, 'lloyds'), true);
  assert.equal(p.save.bank, 'lloyds');
  assert.ok(p.save.finance.ledger.some((l) => /moved to Lloyd/.test(l.what)));
});

ok('your own bank’s machines are free anywhere; the other bank’s charge', () => {
  const p = fresh();
  assert.equal(atmFee('Hollins', 'califax', undefined), PAY_FEE, 'no bank yet: the old rule');
  assert.equal(atmFee('High Street', 'califax', undefined), 0);
  chooseBank(p, 'califax');
  assert.equal(atmFee('Hollins', 'califax', p.save.bank), 0);
  assert.equal(atmFee('High Street', 'lloyds', p.save.bank), OTHER_BANK_FEE);
  p.save.cash.bank = 200;
  const r = withdraw(p, 100, 'City Centre', 'lloyds');
  assert.ok(r.ok && r.fee === OTHER_BANK_FEE);
  assert.equal(p.save.cash.bank, 100 - OTHER_BANK_FEE);
  const r2 = withdraw(p, 50, 'City Centre', 'califax');
  assert.ok(r2.ok && r2.fee === 0);
});

ok('the choice survives a save; junk doesn’t', () => {
  const p = fresh();
  chooseBank(p, 'lloyds');
  assert.equal(sanitiseSave(JSON.parse(JSON.stringify(p.save))).bank, 'lloyds');
  assert.equal(sanitiseSave({ ...JSON.parse(JSON.stringify(p.save)), bank: 'barclays' }).bank, undefined);
});

ok('the tin: money in and out only in the house, and it pays only there', () => {
  const p = fresh();
  p.save.cash.tin = 0;
  p.save.cash.pocket = 100;
  p.inHouse = false;
  assert.equal(p.toTin(100), 0, 'not from the street');
  assert.equal(p.fromTin(10), 0);
  p.inHouse = true;
  assert.equal(p.toTin(60), 60);
  assert.deepEqual([p.save.cash.pocket, p.save.cash.tin], [40, 60]);
  assert.equal(p.fromTin(500), 60, 'never more than is in it');
  p.toTin(100);
  p.inHouse = false;
  assert.equal(p.canAfford(50), false, 'the tin is at home');
  p.inHouse = true;
  assert.ok(p.pay(50), 'at home it pays');
  assert.equal(p.save.cash.tin, 50);
});

ok('paying: cash first, then the card; some things are cash only', () => {
  const p = fresh();
  p.save.cash.tin = 0;
  p.save.cash.pocket = 30;
  p.save.cash.bank = 500;
  assert.equal(p.pay(100), false, 'no account, no card');
  chooseBank(p, 'califax');
  assert.ok(p.pay(100));
  assert.deepEqual([p.save.cash.pocket, p.save.cash.bank], [0, 430]);
  assert.equal(p.pay(20, 'cash'), false, 'a bung is cash in hand');
  p.save.cash.pocket = 20;
  assert.ok(p.pay(20, 'cash'));
  assert.equal(p.save.cash.bank, 430, 'cash only never touches the card');
});

ok('nothing floats: the phone app moves nothing; rent and sales go to the account (the tin with none)', () => {
  const p = fresh();
  p.save.cash.tin = 0;
  p.credit(100);
  assert.equal(p.save.cash.tin, 100, 'no account: the tin');
  chooseBank(p, 'lloyds');
  p.credit(250);
  assert.equal(p.save.cash.bank, 250);
});

ok('saves from before the split keep their money in the tin', () => {
  const p = fresh();
  const raw = JSON.parse(JSON.stringify(p.save));
  raw.cash = { pocket: 12, bank: 3400 };
  const s = sanitiseSave(raw)!;
  assert.deepEqual(s.cash, { pocket: 12, bank: 0, tin: 3400 });
});

console.log(`banking: ${passed} passed, 0 failed`);
