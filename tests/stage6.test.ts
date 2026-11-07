/**
 * Stage 6 tests: house customisation (buy, place, rotate, move, store, sell,
 * recolour, finishes, placement rules), the furniture shop, car dealer, bike
 * shop, garage, the drive, riding, the casino and its prize motors, saving
 * and loading all of it, and the new buildings in the world.
 */
import { defaultAppearance } from '../src/character/Appearance';
import { createCharacter, emptyAllocation } from '../src/character/Character';
import { AREA_IDS, newSave, Progress, sanitiseSave } from '../src/progress/Progress';
import {
  BIKES,
  BIKE_LIST,
  CARS,
  CAR_CLASSES,
  CAR_LIST,
  BIKE_CLASSES,
  FINISHES,
  FURNITURE,
  FURNITURE_LIST,
  GARAGE_SPACES,
  ROOMS,
  ROOM_IDS,
  allowedRooms,
  resale,
} from '../src/property/catalogue';
import { BACK_Z, FRONT_DOOR_X, HOME_FIXTURES, LANE_Z, buildHomeLevel, checkPlacement, footprint, suggestSpot } from '../src/property/home';
import {
  BIKE_HOME_SPOT,
  DRIVEWAY,
  buyBike,
  buyCar,
  buyFinish,
  buyFurniture,
  defaultProperty,
  mountBike,
  parkBike,
  placeFurniture,
  recolourFurniture,
  sellBike,
  sellCar,
  sellFurniture,
  setActiveCar,
  storeBike,
  storeFurniture,
  takeOutBike,
} from '../src/property/state';
import {
  COMP_ODDS,
  COMP_TICKET,
  DRAW_TICKET,
  compPrize,
  dealBlackjack,
  doubleDown,
  handValue,
  hit,
  playCompetition,
  playPrizeDraw,
  playRoulette,
  playSlots,
  rouletteReturn,
  slotMultiplier,
  stand,
  type Card,
} from '../src/property/casino';
import { resolveLevel } from '../src/property/levels';
import { HOME_BASE, LEVELS } from '../src/world/levels';
import { propBox } from '../src/world/LevelTypes';
import { exitLocked, World } from '../src/world/World';
import { SHOP_STOPS } from '../src/ui/hub';

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
function fresh(cash = 500000): Progress {
  const c = createCharacter({ name: 'Tester', appearance: defaultAppearance(), background: 'estate_scrapper', allocated: emptyAllocation() });
  const p = new Progress(newSave(c));
  p.save.cash.bank = cash;
  p.save.cash.pocket = 0;
  return p;
}
const wallet = (p: Progress) => p.save.cash.pocket + p.save.cash.bank;
/** A deterministic rng from a list of values. */
const seq = (...v: number[]) => {
  let i = 0;
  return () => v[i++ % v.length];
};
const roundtrip = (p: Progress) => new Progress(sanitiseSave(JSON.parse(JSON.stringify(p.save)))!);

console.log('\nStage 6: house');

test('the house as it comes is a valid layout (bed, sofa, table, telly all fit)', () => {
  const prop = defaultProperty();
  for (const f of prop.furniture) assert(checkPlacement(prop, FURNITURE[f.id], f.at!, f.uid).ok, `${f.id} doesn't fit: ${JSON.stringify(checkPlacement(prop, FURNITURE[f.id], f.at!, f.uid))}`);
});

test('every catalogue piece fits somewhere it is allowed in an empty house', () => {
  const prop = { ...defaultProperty(), furniture: [] };
  for (const def of FURNITURE_LIST) {
    const ok = allowedRooms(def).some((r) => suggestSpot(prop, def, r));
    assert(ok, `${def.id} has nowhere to go`);
  }
});

test('buying furniture takes the right money and delivers it unplaced; buy several at once', () => {
  const p = fresh(1000);
  const before = wallet(p);
  const r = buyFurniture(p, 'armchair', FURNITURE.armchair.colours[2], 3);
  assert(r.ok, 'bought');
  assert(wallet(p) === before - FURNITURE.armchair.price * 3, 'charged 3x price');
  const chairs = p.save.property.furniture.filter((f) => f.id === 'armchair');
  assert(chairs.length === 3 && chairs.every((c) => c.at === null && c.colour === FURNITURE.armchair.colours[2]), 'three in their boxes, in the colour picked');
  assert(new Set(p.save.property.furniture.map((f) => f.uid)).size === p.save.property.furniture.length, 'unique uids');
  const poor = fresh(10);
  assert(!buyFurniture(poor, 'sofa_3', FURNITURE.sofa_3.colours[0]).ok && wallet(poor) === 10, 'cannot buy without the money, nothing taken');
});

test('place, rotate, move, store and sell a piece', () => {
  const p = fresh(1000);
  buyFurniture(p, 'drawers', FURNITURE.drawers.colours[0]);
  const piece = p.save.property.furniture.at(-1)!;
  const spot = suggestSpot(p.save.property, FURNITURE.drawers, 'bedroom', piece.uid)!;
  assert(spot, 'found a spot');
  assert(placeFurniture(p, piece.uid, spot).ok && piece.at?.room === 'bedroom', 'placed');
  // Turn it a quarter: footprint swaps.
  const turned = { ...spot, rot: 1 };
  const box0 = footprint(FURNITURE.drawers, spot);
  const box1 = footprint(FURNITURE.drawers, turned);
  assert(Math.abs(box0.maxX - box0.minX - (box1.maxZ - box1.minZ)) < 1e-9, 'rotation swaps width and depth');
  // Move it along the wall.
  const moved = suggestSpot(p.save.property, FURNITURE.drawers, 'kitchen', piece.uid) ?? suggestSpot(p.save.property, FURNITURE.drawers, 'living', piece.uid)!;
  assert(placeFurniture(p, piece.uid, moved).ok && piece.at!.room === moved.room, 'moved to another room');
  assert(storeFurniture(p, piece.uid).ok && piece.at === null, 'stored back in its box');
  const before = p.save.cash.pocket;
  const s = sellFurniture(p, piece.uid);
  assert(s.ok && p.save.cash.pocket === before + resale(FURNITURE.drawers.price), 'sold for half');
  assert(!p.save.property.furniture.some((f) => f.uid === piece.uid), 'gone');
});

test('recolouring only allows the catalogue colours', () => {
  const p = fresh();
  const sofa = p.save.property.furniture.find((f) => f.id === 'sofa_3')!;
  assert(recolourFurniture(p, sofa.uid, FURNITURE.sofa_3.colours[1]).ok && sofa.colour === FURNITURE.sofa_3.colours[1], 'recoloured');
  assert(!recolourFurniture(p, sofa.uid, '#123456').ok, 'off-catalogue colour refused');
});

test('placement rules: no overlap, no clipping walls or fittings, no blocking the door, stations or walkway, no floating', () => {
  const p = fresh();
  const prop = p.save.property;
  const sofa = prop.furniture.find((f) => f.id === 'sofa_3')!;
  const table = FURNITURE.coffee_table;
  // Right on top of the sofa.
  assert(!checkPlacement(prop, table, { room: 'living', x: sofa.at!.x, z: sofa.at!.z, rot: 0 }).ok, 'overlap refused');
  // Through the back wall.
  assert(!checkPlacement(prop, table, { room: 'living', x: -6.5, z: BACK_Z, rot: 0 }).ok, 'clipping the wall refused');
  // Into the walkway.
  assert(!checkPlacement(prop, table, { room: 'living', x: -6.5, z: LANE_Z, rot: 0 }).ok, 'walkway refused');
  // In front of the front door.
  assert(!checkPlacement(prop, table, { room: 'living', x: FRONT_DOOR_X, z: -1.5, rot: 0 }).ok, 'front door refused');
  // Over the hall table with the phone (a fixture with a station).
  assert(!checkPlacement(prop, table, { room: 'living', x: -5.3, z: -1.3, rot: 0 }).ok, 'fixture refused');
  // Straddling the wall between living room and kitchen.
  assert(!checkPlacement(prop, table, { room: 'living', x: -4.0, z: -1.5, rot: 0 }).ok, 'room divider refused');
  // Bathroom pieces stay in the bathroom.
  assert(!checkPlacement(prop, FURNITURE.bath_tower, { room: 'living', x: -6.5, z: -2.1, rot: 0 }).ok, 'bathroom piece in the lounge refused');
  // Wall art over a window, or where another picture hangs.
  const win = ROOMS.living.window;
  assert(!checkPlacement(prop, FURNITURE.painting, { room: 'living', x: win, z: 0, rot: 0 }).ok, 'painting over the window refused');
  // Tall pieces can't stand in front of a window.
  assert(!checkPlacement({ ...prop, furniture: [] }, FURNITURE.bookcase, { room: 'living', x: win, z: BACK_Z + 0.18, rot: 0 }).ok, 'bookcase in front of the window refused');
  // Rugs can go under furniture (they're on the floor, not solid).
  assert(checkPlacement(prop, FURNITURE.rug_round, { room: 'living', x: sofa.at!.x, z: -0.9, rot: 0 }).ok, 'rug under the coffee table is fine');
  // A valid spot is valid.
  assert(checkPlacement(prop, table, { room: 'kitchen', x: -2.6, z: -0.25, rot: 0 }).ok, 'free kitchen spot accepted');
});

test('the house level is built from the save: solid furniture collides, rugs and wall pieces do not', () => {
  const p = fresh();
  buyFurniture(p, 'rug_round', FURNITURE.rug_round.colours[0]);
  const rug = p.save.property.furniture.at(-1)!;
  placeFurniture(p, rug.uid, { room: 'living', x: -11.3, z: -0.9, rot: 0 });
  const lvl = buildHomeLevel(HOME_BASE, p.save.property);
  const furn = lvl.props.filter((x) => x.kind === 'furniture' && x.item !== 'bedside');
  assert(furn.length === 5, `5 placed pieces (got ${furn.length})`);
  assert(propBox(furn.find((x) => x.item === 'sofa_3')!) !== null, 'sofa solid');
  assert(propBox(furn.find((x) => x.item === 'rug_round')!) === null, 'rug walk-over');
  assert(!lvl.props.some((x) => x.kind === 'homecar'), 'no car in the garage');
  const w = new World(lvl, p, { entry: 'start', seed: 3 });
  assert(w.arena.blocked(-11.3, -1.85, 0.1), 'cannot walk through the sofa');
  assert(!w.arena.blocked(-11.3, 1.0, 0.3), 'walkway clear');
  // Every station is reachable from the walkway (nothing placed on top of one).
  for (const st of lvl.stations ?? []) assert(!w.arena.blocked(st.x, st.z, 0.05), `station ${st.id} not buried`);
});

test('sofa station follows the sofa, and a floor cushion stands in when there is none', () => {
  const p = fresh();
  const sofa = p.save.property.furniture.find((f) => f.id === 'sofa_3')!;
  let st = buildHomeLevel(HOME_BASE, p.save.property).stations!.find((s) => s.id === 'sofa')!;
  assert(Math.abs(st.x - sofa.at!.x) < 1e-9, 'at the sofa');
  storeFurniture(p, sofa.uid);
  st = buildHomeLevel(HOME_BASE, p.save.property).stations!.find((s) => s.id === 'sofa')!;
  assert(st && st.label.includes('cushion'), 'still somewhere to save');
});

test('floors and walls: per room, charged, saved', () => {
  const p = fresh(1000);
  const before = wallet(p);
  assert(buyFinish(p, 'bedroom', 'f_oak').ok && p.save.property.finishes.bedroom.floor === 'f_oak', 'bedroom floor');
  assert(buyFinish(p, 'bedroom', 'w_navy').ok && p.save.property.finishes.bedroom.wall === 'w_navy', 'bedroom walls');
  assert(p.save.property.finishes.living.floor !== 'f_oak', 'other rooms untouched');
  assert(wallet(p) === before - FINISHES.f_oak.price - FINISHES.w_navy.price, 'charged');
  assert(!buyFinish(p, 'bedroom', 'f_oak').ok, 'not charged twice for the same');
  const lvl = buildHomeLevel(HOME_BASE, p.save.property);
  const bed = lvl.facades.find((f) => f.label === 'Bedroom')!;
  assert(bed.floor === 'f_oak' && bed.wall === 'w_navy', 'level uses the finishes');
});

console.log('\nStage 6: cars, bikes, garage');

test('car dealer: all six classes stocked, each car priced with stats', () => {
  for (const c of CAR_CLASSES) assert(CAR_LIST.some((x) => x.cls === c.id), `${c.id} stocked`);
  for (const c of CAR_LIST) assert(c.price > 0 && c.topSpeed > 0 && c.zeroSixty > 0 && c.handling > 0, `${c.id} stats`);
});

test('buying a car charges the price and parks it on the drive outside the house, not in the garage', () => {
  const p = fresh(50000);
  const before = wallet(p);
  assert(buyCar(p, 'corvo', '#7a1414').ok, 'bought');
  assert(wallet(p) === before - CARS.corvo.price, 'charged');
  const car = p.save.property.cars[0];
  assert(p.save.property.activeCar === car.uid, 'on the drive');
  const estate = resolveLevel('estate', p.save);
  const parked = estate.props.find((x) => x.kind === 'vehicle');
  assert(parked && parked.item === 'corvo' && parked.x === DRIVEWAY.x && parked.z === DRIVEWAY.z && parked.colour === '#7a1414', 'parked on the drive');
  const box = propBox(parked)!;
  assert(box.maxX < -6.8, 'clear of the front door');
  assert(estate.stations!.some((s) => s.id === 'car'), 'can use it');
  const w = new World(estate, p, { entry: 'home', seed: 1 });
  assert(w.arena.blocked(DRIVEWAY.x, DRIVEWAY.z, 0.1), 'it has collision');
  const home = resolveLevel('home', p.save);
  assert(!home.props.some((x) => x.kind === 'vehicle' && CARS[x.item!]), 'no car in the garage');
});

test('several cars: only the active one is on the drive; swap and sell', () => {
  const p = fresh(100000);
  buyCar(p, 'corvo', '#c8c8c8');
  buyCar(p, 'vixen', '#e8c020');
  const [a, b] = p.save.property.cars;
  assert(p.save.property.activeCar === a.uid, 'first stays on the drive');
  assert(setActiveCar(p, b.uid).ok, 'swap');
  const parked = resolveLevel('estate', p.save).props.filter((x) => x.kind === 'vehicle');
  assert(parked.length === 1 && parked[0].item === 'vixen', 'only the active car shown');
  const pocket = p.save.cash.pocket;
  assert(sellCar(p, b.uid).ok && p.save.cash.pocket === pocket + resale(CARS.vixen.price), 'sold for half');
  assert(p.save.property.activeCar === a.uid, 'the other goes on the drive');
});

test('bike shop: all five classes stocked with the six stats', () => {
  for (const c of BIKE_CLASSES) assert(BIKE_LIST.some((x) => x.cls === c.id), `${c.id} stocked`);
  for (const b of BIKE_LIST) for (const k of ['price', 'topSpeed', 'accel', 'handling', 'braking', 'suspension'] as const) assert(b[k] > 0, `${b.id} ${k}`);
});

test('bikes go in the garage, up to its space; take out, ride, park, store', () => {
  const p = fresh(100000);
  const before = wallet(p);
  assert(buyBike(p, 'mx250', '#1f4fa8').ok && wallet(p) === before - BIKES.mx250.price, 'bought and charged');
  for (let i = 1; i < GARAGE_SPACES; i++) assert(buyBike(p, 'pup85', '#3a9a3a').ok, 'room for more');
  assert(!buyBike(p, 'pup85', '#3a9a3a').ok, 'garage full refused');
  const home = resolveLevel('home', p.save);
  assert(home.props.filter((x) => x.kind === 'vehicle').length === GARAGE_SPACES, 'all shown in the garage');
  const bike = p.save.property.bikes[0];
  assert(takeOutBike(p, bike.uid).ok, 'taken out');
  assert(resolveLevel('home', p.save).props.filter((x) => x.kind === 'vehicle').length === GARAGE_SPACES - 1, 'gone from its bay');
  const estate = resolveLevel('estate', p.save);
  const outside = estate.props.find((x) => x.kind === 'vehicle' && x.item === 'mx250');
  assert(outside && outside.x === BIKE_HOME_SPOT.x, 'waiting outside the house');
  assert(estate.stations!.some((s) => s.id === 'bike'), 'can get on');
  assert(!takeOutBike(p, p.save.property.bikes[1].uid).ok, 'one out at a time');
  assert(mountBike(p, 'estate').ok && p.save.property.riding, 'riding');
  assert(!resolveLevel('estate', p.save).props.some((x) => x.kind === 'vehicle' && x.item === 'mx250'), 'not parked while you ride it');
  assert(parkBike(p, 'high_street', 20, 0.5).ok, 'parked');
  const hs = resolveLevel('high_street', p.save);
  assert(hs.props.some((x) => x.kind === 'vehicle' && x.x === 20), 'parked where you left it');
  assert(storeBike(p).ok && !p.save.property.bikeOut, 'back in the garage');
  assert(!sellBike(p, 'nope').ok, 'cannot sell what you do not own');
});

console.log('\nStage 6: casino');

test('slots pay what the table says and take the stake', () => {
  assert(slotMultiplier(['7', '7', '7']) === 50 && slotMultiplier(['🍒', '🍒', '🔔']) === 2 && slotMultiplier(['🍋', '🔔', '7']) === 0, 'pay table');
  const p = fresh(100);
  const r = playSlots(p, 10, seq(0.99, 0.99, 0.99));
  assert(r.ok && r.detail.reels.every((x) => x === '💎') && r.win === 1000, 'three diamonds pays 100x');
  assert(wallet(p) === 100 - 10 + 1000, 'wallet right');
  const lose = playSlots(p, 10, seq(0.0, 0.5, 0.9));
  assert(lose.ok && wallet(p) === 1090 - 10 + lose.win, 'losing spin');
  assert(!playSlots(fresh(0), 10).ok, 'no money no spin');
});

test('roulette: single zero, correct payouts', () => {
  assert(rouletteReturn({ kind: 'red' }, 1, 10) === 20 && rouletteReturn({ kind: 'red' }, 2, 10) === 0, 'red');
  assert(rouletteReturn({ kind: 'red' }, 0, 10) === 0 && rouletteReturn({ kind: 'even' }, 0, 10) === 0, 'zero loses evens');
  assert(rouletteReturn({ kind: 'dozen', dozen: 2 }, 13, 10) === 30, 'dozen 2:1');
  assert(rouletteReturn({ kind: 'number', number: 17 }, 17, 10) === 360, 'straight 35:1');
  const p = fresh(100);
  const r = playRoulette(p, { kind: 'number', number: 0 }, 10, seq(0));
  assert(r.ok && r.detail.number === 0 && wallet(p) === 100 - 10 + 360, 'zero hit pays');
});

test('blackjack: deal, hit, stand, double, blackjack pays 3:2', () => {
  const C = (rank: Card['rank']): Card => ({ rank, suit: '♠' });
  assert(handValue([C('A'), C('K')]).total === 21 && handValue([C('A'), C('A'), C('9')]).total === 21 && handValue([C('K'), C('Q'), C('5')]).total === 25, 'hand values');
  // Deck pops from the end: player, player, dealer, dealer, then hits.
  let p = fresh(1000);
  let r = dealBlackjack(p, 100, Math.random, [C('2'), C('6'), C('K'), C('K'), C('A')]);
  assert(r.ok && r.detail.done && r.detail.outcome === 'blackjack' && r.win === 250, 'natural pays 3:2');
  assert(wallet(p) === 1000 - 100 + 250, 'wallet after blackjack');
  p = fresh(1000);
  r = dealBlackjack(p, 100, Math.random, [C('9'), C('7'), C('K'), C('5'), C('9')]);
  assert(r.ok && !r.detail.done, 'hand in play (player 14, dealer 17)');
  hit(p, r.detail);
  assert(r.detail.done && r.detail.outcome === 'bust', '14 + 9 busts');
  assert(wallet(p) === 900, 'lost the stake');
  p = fresh(1000);
  r = dealBlackjack(p, 100, Math.random, [C('8'), C('9'), C('7'), C('9'), C('5'), C('6')]);
  assert(r.ok, 'dealt (player 11, dealer 16)');
  const d = doubleDown(p, r.detail);
  assert(d.ok && d.hand.done && d.hand.bet === 200, 'doubled');
  // Player 11 + 9 = 20, dealer 16 + 8 = 24 bust.
  assert(d.hand.outcome === 'win' && wallet(p) === 1000 - 200 + 400, `double win paid (${d.hand.outcome}, ${wallet(p)})`);
  p = fresh(1000);
  r = dealBlackjack(p, 100, Math.random, [C('8'), C('K'), C('8'), C('K')]);
  stand(p, r.ok ? r.detail : (null as never));
  assert(r.ok && r.detail.outcome === 'push' && wallet(p) === 1000, 'push returns the stake');
});

test('prize draw and the motor competition; a won car parks outside the house like a bought one', () => {
  const p = fresh(1000);
  const d = playPrizeDraw(p, seq(0));
  assert(d.ok && d.win === 250 && wallet(p) === 1000 - DRAW_TICKET + 250, 'top prize');
  const lose = playCompetition(p, seq(0.5));
  assert(lose.ok && !lose.detail.won && wallet(p) === 1240 - COMP_TICKET, 'losing ticket');
  p.save.trips = 0;
  const prize = compPrize(0);
  assert(prize.kind === 'car', 'a car this week');
  const win = playCompetition(p, seq(0.1 / COMP_ODDS));
  assert(win.ok && win.detail.won && !win.detail.cashInstead, 'won');
  const car = p.save.property.cars.find((c) => c.id === prize.id);
  assert(car && car.from === 'won' && p.save.property.activeCar === car.uid, 'in the collection, on the drive');
  assert(resolveLevel('estate', p.save).props.some((x) => x.kind === 'vehicle' && x.item === prize.id), 'parked outside');
  assert(p.save.property.casino.prizes.includes(prize.id), 'recorded');
  // Bike weeks put the bike in the garage.
  p.save.trips = 5;
  const bikePrize = compPrize(5);
  assert(bikePrize.kind === 'bike', 'a bike week');
  assert(playCompetition(p, seq(0)).ok && p.save.property.bikes.some((b) => b.id === bikePrize.id), 'bike in the garage');
  assert(resolveLevel('casino', p.save).props.some((x) => x.kind === 'vehicle' && x.label === 'podium'), 'the prize is on the podium');
});

test('casino stats add up', () => {
  const p = fresh(1000);
  playSlots(p, 5, seq(0.0, 0.5, 0.9));
  playPrizeDraw(p, seq(0.99));
  const c = p.save.property.casino;
  assert(c.plays === 2 && c.staked === 5 + DRAW_TICKET, 'stakes counted');
});

console.log('\nStage 6: saving');

test('everything persists through save and load', () => {
  const p = fresh(500000);
  buyFurniture(p, 'painting', FURNITURE.painting.colours[1]);
  const art = p.save.property.furniture.at(-1)!;
  const spot = suggestSpot(p.save.property, FURNITURE.painting, 'bedroom', art.uid)!;
  placeFurniture(p, art.uid, spot);
  buyFinish(p, 'kitchen', 'f_check_tiles');
  buyCar(p, 'regent', '#1a1a1a');
  buyCar(p, 'warden', '#3a4a2a');
  setActiveCar(p, p.save.property.cars[1].uid);
  buyBike(p, 'enduro300', '#1f2a44');
  takeOutBike(p, p.save.property.bikes[0].uid);
  parkBike(p, 'high_street', 12.5, 0.4);
  playSlots(p, 5, seq(0.99, 0.99, 0.99));
  const q = roundtrip(p);
  const a = p.save.property;
  const b = q.save.property;
  assert(JSON.stringify(a.furniture) === JSON.stringify(b.furniture), 'furniture, positions, rotations, colours');
  assert(JSON.stringify(a.finishes) === JSON.stringify(b.finishes), 'finishes');
  assert(JSON.stringify(a.cars) === JSON.stringify(b.cars) && a.activeCar === b.activeCar, 'cars and the active one');
  assert(JSON.stringify(a.bikes) === JSON.stringify(b.bikes) && JSON.stringify(a.bikeOut) === JSON.stringify(b.bikeOut), 'bikes and where the one out is');
  assert(JSON.stringify(a.casino) === JSON.stringify(b.casino), 'casino');
  assert(q.save.cash.pocket === p.save.cash.pocket && q.save.cash.bank === p.save.cash.bank, 'money');
  // New pieces after loading never reuse a uid.
  buyFurniture(q, 'vase', FURNITURE.vase.colours[0]);
  assert(new Set(q.save.property.furniture.map((f) => f.uid)).size === q.save.property.furniture.length, 'uids stay unique');
});

test('older saves (no property) load with the house as it came; junk is repaired, never lost', () => {
  const p = fresh();
  const raw = JSON.parse(JSON.stringify(p.save));
  delete raw.property;
  const q = sanitiseSave(raw)!;
  assert(q && q.property.furniture.length === 4 && q.property.cars.length === 0, 'default house');
  raw.property = {
    furniture: [
      { uid: 'f1', id: 'sofa_3', colour: '#4a5a3a', at: { room: 'living', x: -8, z: -1.5, rot: 0 } }, // over the front door
      { uid: 'f1', id: 'armchair', colour: '#4a5a3a', at: null }, // duplicate uid
      { uid: 'f9', id: 'not_a_thing', colour: '#000000', at: null },
    ],
    cars: [{ uid: 'c1', id: 'corvo', colour: 'red' }],
    activeCar: 'c99',
    bikes: [],
    bikeOut: { uid: 'b7', area: 'estate', x: 0, z: 0 },
    finishes: { living: { floor: 'w_navy', wall: 'f_oak' } },
  };
  const r = sanitiseSave(raw)!.property;
  assert(r.furniture.length === 1 && r.furniture[0].at === null, 'misplaced sofa back in its box, dupes and junk dropped');
  assert(r.cars.length === 1 && r.activeCar === r.cars[0].uid && r.cars[0].colour === CARS.corvo.colours[0], 'car repaired and put on the drive');
  assert(r.bikeOut === null, 'unknown bike dropped');
  assert(FINISHES[r.finishes.living.floor].kind === 'floor' && FINISHES[r.finishes.living.wall].kind === 'wall', 'mixed-up finishes repaired');
});

console.log('\nStage 6: the world');

test('new buildings: doors on the streets lead inside and back out to the same spot', () => {
  for (const area of ['furniture_shop', 'car_dealer', 'bike_shop', 'casino'] as const) {
    assert(AREA_IDS.includes(area), `${area} is an area`);
    const lvl = LEVELS[area];
    const out = lvl.exits.find((e) => e.id === 'out')!;
    const street = LEVELS[out.to];
    assert(street.entries.some((e) => e.id === out.toEntry), `${area} returns to a real entry`);
    const door = street.exits.find((e) => e.to === area);
    assert(door && street.facades.some((f) => door.x >= f.x0 && door.x <= f.x1 && (f.kind === 'showroom' || f.kind === 'casino')), `${area} has a shopfront with a door`);
    assert(lvl.entries.some((e) => e.id === door!.toEntry), `${area} door lands somewhere real`);
    assert(SHOP_STOPS.some((s) => s.area === area), `${area} reachable by cab`);
    assert(lvl.stations!.some((s) => s.npc), `${area} has staff`);
    const p = fresh();
    const w = new World(resolveLevel(area, p.save), p, { entry: 'door', seed: 2 });
    assert(!exitLocked(out, p), 'way out is open');
    for (const st of lvl.stations ?? []) assert(!w.arena.blocked(st.x, st.z, 0.05), `${area}: ${st.id} reachable`);
  }
});

test('every level still builds a world, and no new door is blocked by a prop', () => {
  const p = fresh();
  for (const id of AREA_IDS) {
    const lvl = resolveLevel(id, p.save);
    const w = new World(lvl, p, { entry: lvl.entries[0].id, seed: 4 });
    assert(w.player, `${id} built`);
    for (const ex of lvl.exits) if (ex.kind === 'door') assert(!w.arena.blocked(ex.x, Math.min(lvl.bounds.maxZ, ex.z + 0.5), 0.2), `${id}: door ${ex.id} reachable`);
  }
});

test('the house fittings never overlap each other', () => {
  const boxes = HOME_FIXTURES.map((f) => propBox(f)).filter((b): b is NonNullable<typeof b> => !!b);
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i];
    const b = boxes[j];
    assert(!(a.minX < b.maxX && a.maxX > b.minX && a.minZ < b.maxZ && a.maxZ > b.minZ), `fixtures ${i} and ${j} overlap`);
  }
  for (const r of ROOM_IDS) assert(ROOMS[r].x1 > ROOMS[r].x0, 'rooms');
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
