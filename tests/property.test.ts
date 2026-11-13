/**
 * Jewellery and property: the jeweller's stock, buying, wearing and selling
 * back; the property market, buying, selling, letting, tenants and rent on the
 * play clock; every property's door on its street; the interiors; and all of
 * it surviving a save and reload.
 */
import { defaultAppearance } from '../src/character/Appearance';
import { createCharacter, emptyAllocation } from '../src/character/Character';
import { newSave, Progress, sanitiseSave, type GameSave } from '../src/progress/Progress';
import { FINISHES, JEWEL_CATS, JEWEL_LIST, JEWELS, LEGACY_LOOKS, jewelBuyback, jewelPrice } from '../src/items/jewellery';
import { buyJewel, isWorn, removeJewel, sellJewel, wearJewel, wornLooks } from '../src/items/jewelleryBox';
import {
  MONTH,
  PROP_CATS,
  PROPERTIES,
  PROPERTY_LIST,
  RENT_STEPS,
  marketIndex,
  marketRent,
  saleOffer,
  valueNow,
} from '../src/realty/catalogue';
import {
  access,
  askingRent,
  buyProperty,
  collectRent,
  holding,
  listForRent,
  sellProperty,
  setRent,
  settle,
  totals,
  unlist,
} from '../src/realty/portfolio';
import { buildPropertyInterior } from '../src/realty/world';
import { LEVELS } from '../src/world/levels';
import { resolveLevel } from '../src/property/levels';
import { FURNITURE } from '../src/property/catalogue';
import { propBox, propHalf } from '../src/world/LevelTypes';

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

function fresh(bank = 0, pocket = 0): Progress {
  const s = newSave(createCharacter({ name: 'Test', appearance: defaultAppearance('male'), background: 'estate_scrapper', allocated: emptyAllocation() }));
  s.cash.bank = bank;
  s.cash.pocket = pocket;
  return new Progress(s);
}
const reload = (p: Progress): Progress => new Progress(sanitiseSave(JSON.parse(JSON.stringify(p.save)) as GameSave)!);

console.log('The jeweller’s stock');
test('every kind of piece, plenty of each, unique names', () => {
  const names = new Set(JEWEL_LIST.map((d) => d.name));
  assert(names.size === JEWEL_LIST.length, 'duplicate product name');
  assert(new Set(JEWEL_LIST.map((d) => d.id)).size === JEWEL_LIST.length, 'duplicate id');
  for (const c of JEWEL_CATS) assert(JEWEL_LIST.filter((d) => d.cat === c).length >= 8, `${c}: too few`);
});
test('every piece has a price in each of its metals, a rarity and a shape', () => {
  for (const d of JEWEL_LIST) {
    assert(d.finishes.length >= 2, `${d.id}: no metal choice`);
    assert(d.shape.cat === d.cat, `${d.id}: shape doesn't match`);
    for (const f of d.finishes) {
      assert(FINISHES[f], `${d.id}: ${f}`);
      assert(jewelPrice(d, f) > 0 && jewelBuyback(d, f) < jewelPrice(d, f), `${d.id}/${f} price`);
    }
  }
});
test('the brief’s ranges are all there', () => {
  const has = (cat: string, test: (d: (typeof JEWEL_LIST)[number]) => boolean, what: string) => assert(JEWEL_LIST.some((d) => d.cat === cat && test(d)), what);
  has('ring', (d) => d.shape.cat === 'ring' && d.shape.style === 'signet', 'signet ring');
  has('ring', (d) => d.stone === 'diamond', 'diamond ring');
  has('ring', (d) => d.finishes.includes('silver'), 'silver ring');
  has('watch', (d) => d.shape.cat === 'watch' && d.shape.face === 'digital', 'digital watch');
  has('watch', (d) => d.shape.cat === 'watch' && d.shape.bezel === 'diamond', 'diamond watch');
  has('watch', (d) => d.shape.cat === 'watch' && d.shape.strap === 'rubber', 'sports watch');
  has('necklace', (d) => d.shape.cat === 'necklace' && d.shape.link === 'cuban', 'cuban link');
  has('necklace', (d) => d.shape.cat === 'necklace' && d.shape.link === 'rope', 'rope chain');
  has('necklace', (d) => d.shape.cat === 'necklace' && d.shape.pendant === 'cross', 'cross');
  has('grill', (d) => d.shape.cat === 'grill' && d.shape.cover === 'single', 'single tooth');
  has('grill', (d) => d.shape.cat === 'grill' && d.shape.cover === 'full', 'full set');
  has('grill', (d) => d.shape.cat === 'grill' && d.shape.style === 'diamond', 'diamond grill');
});
test('plain shop items worn in the same spots draw as real pieces', () => {
  for (const [item, look] of Object.entries(LEGACY_LOOKS)) assert(JEWELS[look.id]?.finishes.includes(look.finish), `${item}`);
});

console.log('Buying, wearing, selling back');
test('buying takes pocket money first, then the bank, and records it', () => {
  const p = fresh(1000, 100);
  const d = JEWELS.r_signet_oval;
  const price = jewelPrice(d, 'silver');
  const r = buyJewel(p, d.id, 'silver');
  assert(r.ok, 'bought');
  assert(p.save.cash.pocket === Math.max(0, 100 - price) && p.save.cash.pocket + p.save.cash.bank === 1100 - price, 'paid right');
  assert(p.save.jewellery.owned.length === 1, 'in the box');
  assert(p.save.finance.ledger.at(-1)?.amount === -price, 'on the statement');
  assert(p.save.inventory.every((s) => !s.id.startsWith('r_')), 'not in the pockets');
});
test('can’t afford it: told how much, nothing changes', () => {
  const p = fresh(10, 0);
  const r = buyJewel(p, 'w_iced', 'white');
  assert(!r.ok && /£/.test(r.reason), 'refused with a price');
  assert(p.save.jewellery.owned.length === 0 && p.save.cash.bank === 10, 'unchanged');
});
test('a metal it doesn’t come in is refused', () => {
  const p = fresh(100000);
  assert(!buyJewel(p, 'g_single', 'platinum').ok, 'refused');
});
test('own several of each kind, wear one of each, swap whenever', () => {
  const p = fresh(100000);
  const a = buyJewel(p, 'r_court_silver', 'silver').uid!;
  const b = buyJewel(p, 'r_halo', 'white').uid!;
  buyJewel(p, 'r_halo', 'rose');
  assert(p.save.jewellery.owned.filter((o) => JEWELS[o.id].cat === 'ring').length === 3, 'three rings');
  assert(wearJewel(p, a).ok && isWorn(p.save, a), 'wearing a');
  assert(wearJewel(p, b).ok && isWorn(p.save, b) && !isWorn(p.save, a), 'swapped to b');
  const w = buyJewel(p, 'w_chrono', 'steel').uid!;
  wearJewel(p, w);
  const looks = wornLooks(p.save);
  assert(looks.ring?.id === 'r_halo' && looks.watch?.id === 'w_chrono', 'both on');
  const app = p.appearance();
  assert(app.jewellery?.ring?.finish === 'white' && app.accessories.includes('ring') && app.accessories.includes('watch'), 'on the character');
  assert(removeJewel(p, 'ring').ok && !wornLooks(p.save).ring, 'took the ring off');
});
test('a grill takes the gumshield’s place, and the gumshield goes back in your pockets', () => {
  const p = fresh(100000);
  p.giveItem('mouthguard');
  const gum = p.save.inventory.find((s) => s.id === 'mouthguard')!;
  assert(p.wear(gum.uid).ok && p.save.worn.mouth, 'gumshield in');
  const g = buyJewel(p, 'g_top6', 'gold9').uid!;
  assert(wearJewel(p, g).ok, 'grill in');
  assert(!p.save.worn.mouth && p.save.inventory.some((s) => s.id === 'mouthguard'), 'gumshield back in pockets');
  // And back again: the gumshield takes the grill out.
  const again = p.save.inventory.find((s) => s.id === 'mouthguard')!;
  assert(p.wear(again.uid).ok && !p.save.jewellery.worn.grill, 'gumshield replaces the grill');
});
test('selling back: 45%, not while it’s on, recorded', () => {
  const p = fresh(100000);
  const uid = buyJewel(p, 'n_cuban_8', 'gold18').uid!;
  wearJewel(p, uid);
  assert(!sellJewel(p, uid).ok, 'not while worn');
  removeJewel(p, 'necklace');
  const before = p.save.cash.pocket;
  const r = sellJewel(p, uid);
  assert(r.ok && r.amount === jewelBuyback(JEWELS.n_cuban_8, 'gold18') && p.save.cash.pocket === before + r.amount, 'paid');
  assert(!p.save.jewellery.owned.length, 'gone');
});
test('jewellery survives a save and reload, worn and all, and losing a fight doesn’t touch it', () => {
  const p = fresh(100000, 500);
  const uid = buyJewel(p, 'w_gold_president', 'gold18').uid!;
  wearJewel(p, uid);
  p.losePocket(1);
  const q = reload(p);
  assert(q.save.jewellery.owned.length === 1 && q.save.jewellery.worn.watch === uid, 'kept');
  assert(q.appearance().jewellery?.watch?.id === 'w_gold_president', 'still on');
});
test('a junk jewellery box in a save is cleaned up', () => {
  const p = fresh();
  (p.save as unknown as { jewellery: unknown }).jewellery = { owned: [{ uid: 'j1', id: 'nope', finish: 'gold9' }, { uid: 'j2', id: 'g_single', finish: 'platinum' }, { uid: 'j3', id: 'g_top6', finish: 'gold9' }], worn: { grill: 'j3', ring: 'j3' }, seq: -4 };
  const q = reload(p);
  assert(q.save.jewellery.owned.length === 1 && q.save.jewellery.worn.grill === 'j3' && !q.save.jewellery.worn.ring, 'only the real grill');
  assert(q.save.jewellery.seq > 3, 'next uid can’t clash');
});

console.log('The property market');
test('twenty places: five each of houses, flats, apartments and mansions', () => {
  assert(PROPERTY_LIST.length === 20, `${PROPERTY_LIST.length}`);
  for (const c of PROP_CATS) assert(PROPERTY_LIST.filter((p) => p.cat === c).length === 5, c);
  assert(new Set(PROPERTY_LIST.map((p) => p.name)).size === 20, 'unique names');
});
test('dearer areas cost more: a mansion beats a flat, prime beats budget', () => {
  const avg = (f: (p: (typeof PROPERTY_LIST)[number]) => boolean) => {
    const l = PROPERTY_LIST.filter(f);
    return l.reduce((a, p) => a + p.price, 0) / l.length;
  };
  assert(avg((p) => p.cat === 'mansion') > avg((p) => p.cat === 'apartment') && avg((p) => p.cat === 'apartment') > avg((p) => p.cat === 'flat'), 'by kind');
  assert(avg((p) => p.tier === 'super') > avg((p) => p.tier === 'prime') && avg((p) => p.tier === 'prime') > avg((p) => p.tier === 'mid') && avg((p) => p.tier === 'mid') > avg((p) => p.tier === 'budget'), 'by area');
  const flat = PROPERTIES.f_lowry_3;
  const mansion = PROPERTIES.m_wyvern_hall;
  assert(marketRent(mansion, 0) > marketRent(PROPERTIES.a_bonded_4, 0) && marketRent(PROPERTIES.a_bonded_4, 0) > marketRent(PROPERTIES.h_hollins_27, 0) && marketRent(PROPERTIES.h_hollins_27, 0) > marketRent(flat, 0), 'rent by kind');
});
test('prices move a little month to month, the same for every save, within limits', () => {
  for (const tier of ['budget', 'mid', 'prime', 'super'] as const) {
    let moved = false;
    for (let m = 1; m < 400; m++) {
      const i = marketIndex(tier, m);
      assert(i >= 0.7 && i <= 2.4, `${tier} ${m}: ${i}`);
      if (Math.abs(i - marketIndex(tier, m - 1)) > 1e-9) moved = true;
      assert(Math.abs(i / marketIndex(tier, m - 1) - 1) < 0.05, 'no wild jumps');
    }
    assert(moved, `${tier} never moves`);
  }
  assert(valueNow(PROPERTIES.m_glasshouse, 50 * MONTH) === valueNow(PROPERTIES.m_glasshouse, 50 * MONTH + 1), 'one value per month');
});

console.log('Buying and selling');
test('can’t afford it: says how short you are, nothing changes', () => {
  const p = fresh(1000);
  const r = buyProperty(p, 'm_glasshouse');
  assert(!r.ok && /short/.test(r.reason), r.ok ? '' : r.reason);
  assert(p.save.cash.bank === 1000 && !p.save.portfolio.holdings.length, 'unchanged');
});
test('buying takes the price, adds it to the portfolio, and can’t be done twice', () => {
  const p = fresh(100000, 50);
  const price = valueNow(PROPERTIES.f_lowry_3, 0);
  assert(buyProperty(p, 'f_lowry_3').ok, 'bought');
  assert(p.save.cash.bank + p.save.cash.pocket === 100050 - price, 'paid');
  const h = holding(p.save, 'f_lowry_3')!;
  assert(h.paid === price && h.use === 'personal', 'owned, yours to use');
  assert(!buyProperty(p, 'f_lowry_3').ok, 'not twice');
  assert(p.save.finance.ledger.some((l) => l.kind === 'property' && l.amount === -price), 'recorded');
});
test('own several kinds at once', () => {
  const p = fresh(5000000);
  for (const id of ['f_lowry_3', 'h_tanner_9', 'a_bonded_4', 'm_kensington_lodge']) assert(buyProperty(p, id).ok, id);
  assert(totals(p.save).owned === 4, 'four');
});
test('selling: today’s value less the agent’s fee, profit or loss, gone from the portfolio', () => {
  const p = fresh(200000);
  buyProperty(p, 'h_hollins_27');
  p.save.playTime = 30 * MONTH;
  const offer = saleOffer(PROPERTIES.h_hollins_27, p.save.playTime);
  const bank = p.save.cash.bank;
  const paid = holding(p.save, 'h_hollins_27')!.paid;
  const r = sellProperty(p, 'h_hollins_27');
  assert(r.ok && r.net === offer.net && r.profit === offer.net - paid, 'sold for the offer, profit worked out');
  assert(p.save.cash.bank === bank + offer.net, 'paid into the bank');
  assert(!holding(p.save, 'h_hollins_27'), 'gone');
  assert(!sellProperty(p, 'h_hollins_27').ok, 'can’t sell what you don’t own');
  assert(buyProperty(p, 'h_hollins_27').ok, 'back on the market');
});

console.log('Letting and rent');
test('rent only comes in with tenants, a month at a time, on the play clock', () => {
  const p = fresh(100000);
  buyProperty(p, 'h_tanner_9');
  assert(listForRent(p, 'h_tanner_9').ok, 'listed');
  // No time played: nothing.
  settle(p.save, p.save.playTime);
  assert(holding(p.save, 'h_tanner_9')!.owed === 0, 'nothing yet');
  // Twelve months of play.
  p.save.playTime += 12 * MONTH;
  settle(p.save, p.save.playTime);
  const h = holding(p.save, 'h_tanner_9')!;
  const paid = h.history.filter((e) => e.kind === 'paid');
  assert(h.history.some((e) => e.kind === 'moved_in'), 'a tenant moved in');
  assert(paid.length >= 1 && paid.length <= 12, `${paid.length} rent payments`);
  assert(h.owed === paid.reduce((a, e) => a + (e.amount ?? 0), 0), 'owed is what was paid');
  const rent = askingRent(PROPERTIES.h_tanner_9, h, p.save.playTime);
  assert(h.owed <= rent * 12 * 1.2, 'no more than a year’s rent');
});
test('settling twice, or after a reload, pays nothing extra', () => {
  const p = fresh(100000);
  buyProperty(p, 'f_hollins_41');
  listForRent(p, 'f_hollins_41');
  p.save.playTime += 9 * MONTH;
  settle(p.save, p.save.playTime);
  const owed = holding(p.save, 'f_hollins_41')!.owed;
  settle(p.save, p.save.playTime);
  const q = reload(p);
  settle(q.save, q.save.playTime);
  assert(holding(q.save, 'f_hollins_41')!.owed === owed, `${holding(q.save, 'f_hollins_41')!.owed} vs ${owed}`);
});
test('the same history for the same save (tenants aren’t re-rolled)', () => {
  const run = () => {
    const p = fresh(100000);
    buyProperty(p, 'f_fairclough_12');
    listForRent(p, 'f_fairclough_12');
    for (let i = 0; i < 20; i++) {
      p.save.playTime += MONTH / 3;
      settle(p.save, p.save.playTime);
    }
    return JSON.stringify(holding(p.save, 'f_fairclough_12')!.history);
  };
  assert(run() === run(), 'same');
});
test('collecting puts rent in the bank and on the statement', () => {
  const p = fresh(100000);
  buyProperty(p, 'f_lowry_3');
  listForRent(p, 'f_lowry_3', 0);
  p.save.playTime += 14 * MONTH;
  settle(p.save, p.save.playTime);
  const owed = holding(p.save, 'f_lowry_3')!.owed;
  assert(owed > 0, 'some rent');
  const bank = p.save.cash.bank;
  assert(collectRent(p) === owed && p.save.cash.bank === bank + owed, 'collected');
  assert(holding(p.save, 'f_lowry_3')!.owed === 0 && p.save.finance.totals.rent.in === owed, 'recorded');
});
test('cheaper rent finds tenants sooner than premium rent, on average', () => {
  const fill = (step: number) => {
    let months = 0;
    for (const d of PROPERTY_LIST) {
      const p = fresh(10000000);
      buyProperty(p, d.id);
      listForRent(p, d.id, step);
      for (let m = 1; m <= 24; m++) {
        p.save.playTime = m * MONTH;
        settle(p.save, p.save.playTime);
        if (holding(p.save, d.id)!.tenant) months++;
      }
    }
    return months;
  };
  assert(fill(0) > fill(RENT_STEPS.length - 1), 'cheap fills more');
});
test('notice: tenants pay to the month end, then it’s yours; while they’re in you can’t walk in', () => {
  const p = fresh(1000000);
  assert(buyProperty(p, 'h_parkside_6').ok, 'bought');
  listForRent(p, 'h_parkside_6', 0);
  let m = 0;
  while (!holding(p.save, 'h_parkside_6')!.tenant && m < 40) {
    p.save.playTime += MONTH;
    settle(p.save, p.save.playTime);
    m++;
  }
  const h = holding(p.save, 'h_parkside_6')!;
  assert(h.tenant, 'got a tenant');
  assert(!access(p.save, 'h_parkside_6').ok, 'can’t walk into a tenant’s home');
  assert(unlist(p, 'h_parkside_6').notice === true, 'notice given');
  p.save.playTime += MONTH;
  settle(p.save, p.save.playTime);
  const after = holding(p.save, 'h_parkside_6')!;
  assert(!after.tenant && after.use === 'personal', 'moved out, yours');
  assert(access(p.save, 'h_parkside_6').ok, 'you can go in');
  assert(after.history.some((e) => e.kind === 'paid'), 'paid their last month');
});
test('changing the rent, and limits on what you can do', () => {
  const p = fresh(100000);
  buyProperty(p, 'f_kirkgate_58b');
  assert(!setRent(p, 'f_kirkgate_58b', 3).ok, 'not let yet');
  listForRent(p, 'f_kirkgate_58b');
  assert(setRent(p, 'f_kirkgate_58b', 4).ok && holding(p.save, 'f_kirkgate_58b')!.rentStep === 4, 'set');
  assert(setRent(p, 'f_kirkgate_58b', 99).ok && holding(p.save, 'f_kirkgate_58b')!.rentStep === RENT_STEPS.length - 1, 'clamped');
  assert(!listForRent(p, 'h_tanner_9').ok && !unlist(p, 'h_tanner_9').ok && !sellProperty(p, 'h_tanner_9').ok, 'nothing on what you don’t own');
});
test('selling a let place pays out the rent owed and ends the let', () => {
  const p = fresh(1000000);
  buyProperty(p, 'a_bonded_4');
  listForRent(p, 'a_bonded_4', 0);
  p.save.playTime += 10 * MONTH;
  const r = sellProperty(p, 'a_bonded_4');
  assert(r.ok && r.rent >= 0, 'sold');
  assert(!holding(p.save, 'a_bonded_4'), 'no more income from it');
});
test('the portfolio survives a save and reload', () => {
  const p = fresh(5000000);
  buyProperty(p, 'm_heathfield');
  buyProperty(p, 'f_lowry_3');
  listForRent(p, 'f_lowry_3');
  p.save.playTime += 5 * MONTH;
  settle(p.save, p.save.playTime);
  const q = reload(p);
  assert(JSON.stringify(q.save.portfolio.holdings) === JSON.stringify(p.save.portfolio.holdings), 'same');
});

console.log('On the streets');
test('every property door is on a building of the right kind, clear of other doors, inside the street', () => {
  for (const d of PROPERTY_LIST) {
    const l = LEVELS[d.area];
    assert(d.x > l.bounds.minX + 1 && d.x < l.bounds.maxX - 1, `${d.id} inside`);
    const fac = l.facades.find((f) => d.x > f.x0 && d.x < f.x1);
    assert(fac, `${d.id}: no building`);
    const ok = { house: ['terrace', 'semi', 'showroom', 'house_front'], flat: ['tower', 'terrace', 'precinct'], apartment: ['dock', 'office', 'tower'], mansion: ['mansion'] }[d.cat];
    assert(ok.includes(fac.kind), `${d.id} on a ${fac.kind}`);
    for (const e of l.exits) if (e.kind === 'door' && e.toEntry !== d.id) assert(Math.abs(e.x - d.x) >= 2.4, `${d.id} too close to ${e.id}`);
    // Nothing solid between the pavement and the door (the walkway in front of it is clear).
    for (const pr of l.props) {
      const b = propBox(pr);
      if (b) assert(!(d.x + 0.5 > b.minX && d.x - 0.5 < b.maxX && b.minZ < -0.6), `${d.id} blocked by ${pr.kind}`);
    }
  }
});
test('every door leads into the property and back out to the same spot', () => {
  for (const d of PROPERTY_LIST) {
    const l = LEVELS[d.area];
    const ex = l.exits.find((e) => e.to === 'property' && e.toEntry === d.id);
    assert(ex, `${d.id}: no door`);
    assert(LEVELS.property.entries.some((e) => e.id === d.id), `${d.id}: no way in`);
    const inside = buildPropertyInterior(d, 'viewing', false, '£1');
    const out = inside.exits.find((e) => e.kind === 'door')!;
    assert(out.to === d.area && LEVELS[d.area].entries.some((e) => e.id === out.toEntry), `${d.id}: no way out`);
  }
});
test('the jeweller, the agent and Ashcombe Park are reachable', () => {
  assert(LEVELS.mall.exits.some((e) => e.to === 'jeweller'), 'jeweller door');
  assert(LEVELS.city.exits.some((e) => e.to === 'estate_agent'), 'agent door');
  assert(LEVELS.leisure.exits.some((e) => e.to === 'ashcombe'), 'ashcombe road');
  assert(LEVELS.ashcombe.exits.some((e) => e.to === 'leisure'), 'and back');
});
test('a let place’s door is locked with a reason; a place for sale has a board', () => {
  const p = fresh(100000);
  const street = () => resolveLevel('estate', p.save);
  const door = () => street().exits.find((e) => e.toEntry === 'h_tanner_9')!;
  assert(street().props.some((q) => q.kind === 'agent_board' && q.label === 'FOR SALE'), 'for sale board');
  buyProperty(p, 'h_tanner_9');
  listForRent(p, 'h_tanner_9', 0);
  let n = 0;
  while (!holding(p.save, 'h_tanner_9')!.tenant && n++ < 40) {
    p.save.playTime += MONTH;
    settle(p.save, p.save.playTime);
  }
  assert(door().requires && door().lockedText, 'locked');
  assert(street().props.some((q) => q.kind === 'agent_board' && /LET/.test(q.label ?? '')), 'let board');
});

console.log('Inside');
test('rooms side by side with no gaps, furniture inside its room, a way out and a brochure', () => {
  for (const d of PROPERTY_LIST) {
    const l = buildPropertyInterior(d, 'viewing', false, '£1');
    assert(l.facades.length === d.rooms.length, `${d.id} rooms`);
    for (let i = 1; i < l.facades.length; i++) assert(Math.abs(l.facades[i].x0 - l.facades[i - 1].x1) < 1e-6, `${d.id} gap`);
    assert(l.facades.every((f) => f.floor && f.wall), `${d.id} finishes`);
    for (const pr of l.props) {
      const [hx] = propHalf(pr);
      const room = l.facades.find((f) => pr.x > f.x0 && pr.x < f.x1)!;
      assert(room, `${d.id}: ${pr.kind} outside`);
      if (pr.wallY === undefined && pr.kind !== 'staircase') assert(pr.x - hx >= room.x0 && pr.x + hx <= room.x1 + 1e-6, `${d.id}: ${pr.item ?? pr.kind} through a wall`);
      if (pr.item) assert(FURNITURE[pr.item], pr.item);
    }
    assert(l.stations?.some((s) => s.id === 'prop_info'), `${d.id} brochure`);
  }
});
test('a mansion is bigger and posher inside than a studio', () => {
  const studio = buildPropertyInterior(PROPERTIES.f_lowry_3, 'viewing', false, '£1');
  const mansion = buildPropertyInterior(PROPERTIES.m_ashcombe_manor, 'viewing', false, '£1');
  assert(mansion.bounds.maxX > studio.bounds.maxX * 4, 'bigger');
  assert(mansion.props.length > studio.props.length * 3, 'more in it');
  assert(mansion.props.some((q) => q.kind === 'staircase') && !studio.props.some((q) => q.kind === 'staircase'), 'stairs where they belong');
  assert(new Set(mansion.facades.map((f) => f.floor)).size > new Set(studio.facades.map((f) => f.floor)).size, 'more finishes');
});
test('your own place, lived in, has a bed to rest in; a viewing doesn’t', () => {
  const d = PROPERTIES.h_hollins_27;
  assert(buildPropertyInterior(d, 'owner', true, '£1').stations?.some((s) => s.id === 'prop_rest'), 'own bed');
  assert(!buildPropertyInterior(d, 'viewing', false, '£1').stations?.some((s) => s.id === 'prop_rest'), 'not on a viewing');
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
