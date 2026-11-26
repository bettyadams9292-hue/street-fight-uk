import { priceTier, SHOP_TIER_NAMES, tierLockFor, type ShopTier } from '../items/shopTiers';
import type { AreaId, Progress } from '../progress/Progress';
import {
  BIKES,
  BIKE_CLASSES,
  BIKE_LIST,
  CARS,
  CAR_CLASSES,
  CAR_LIST,
  FINISH_LIST,
  FINISHES,
  FURNITURE,
  FURNITURE_CATEGORIES,
  FURNITURE_LIST,
  GARAGE_SPACES,
  MAX_CARS,
  ROOMS,
  ROOM_IDS,
  allowedRooms,
  resale,
  type BikeClass,
  type BikeDef,
  type CarClass,
  type FurnitureCategory,
  type RoomId,
} from '../property/catalogue';
import {
  buyBike,
  buyCar,
  buyFinish,
  buyFurniture,
  recolourFurniture,
  sellBike,
  sellCar,
  sellFurniture,
  furnitureValue,
  setActiveCar,
  storeBike,
  storeFurniture,
  takeOutBike,
} from '../property/state';
import {
  compOdds,
  COMP_TICKET,
  DRAW_PRIZES,
  DRAW_TICKET,
  SLOT_BETS,
  SLOT_PAYS,
  SLOT_SYMBOLS,
  TABLE_BETS,
  compPrize,
  dealBlackjack,
  doubleDown,
  handValue,
  hit,
  playCompetition,
  playPrizeDraw,
  playRoulette,
  playSlots,
  prizeName,
  stand,
  type BlackjackHand,
  type Card,
  type RouletteBet,
} from '../property/casino';
import { driveOption, type TravelOption } from '../map/worldMap';
import { MOD_CATS, fitMod, fitted, paintOf, type CarMods, type ModCat } from '../property/carMods';
import { LEVELS } from '../world/levels';
import { menuButton } from './controls';
import { h } from './dom';
import { SHOP_STOPS, TAXI_STOPS, panelScreen, result, shopRow } from './hub';
import { previewCanvas } from './propPreview';
import type { Screen } from './UIManager';

/**
 * Screens for the house, the furniture shop, the car dealer, the bike shop,
 * the garage, the drive and the casino. Every button goes through
 * property/state.ts or property/casino.ts, which take the money and change the save.
 */

const money = (n: number) => `£${n.toLocaleString('en-GB')}`;

function tabs<T extends string>(items: { id: T; name: string }[], current: T, pick: (id: T) => void): HTMLElement {
  return h('div', { class: 'prop-tabs' }, ...items.map((it) => {
    const b = h('button', { class: `prop-tab${it.id === current ? ' on' : ''}`, 'data-nav': true, text: it.name, onclick: () => pick(it.id) });
    return b;
  }));
}

function swatches(colours: string[], current: string, pick: (c: string) => void): HTMLElement {
  return h('div', { class: 'swatches' }, ...colours.map((c) => {
    const b = h('button', { class: `swatch${c === current ? ' on' : ''}`, 'data-nav': true, 'aria-label': c, onclick: () => pick(c) });
    b.style.background = c;
    return b;
  }));
}

function statBar(label: string, value: number, max: number, compare?: number): HTMLElement {
  const bar = h('div', { class: 'stat-bar' }, h('i', {}));
  (bar.firstChild as HTMLElement).style.width = `${Math.round((value / max) * 100)}%`;
  if (compare !== undefined) {
    const c = h('b', {});
    c.style.left = `${Math.round((compare / max) * 100)}%`;
    bar.append(c);
  }
  return h('div', { class: 'stat-row' }, h('span', { text: label }), bar, h('em', { text: String(value) }));
}

// ---- furniture shop -------------------------------------------------------------------------------

/** A locked piece's line in a shop list, and the note in place of its Buy button (items/shopTiers.ts). */
const soonTag = (lock: string | null) => (lock ? ' · SOON' : '');
function lockedBuy(tier: ShopTier, lock: string, msg: (t: string, bad?: boolean) => void): HTMLElement {
  return h('div', { class: 'tier-lock' },
    h('p', { class: 'hint', text: `${SHOP_TIER_NAMES[tier]}: ${lock}` }),
    menuButton('SOON', () => msg(lock, true), undefined, 'small'));
}

export function furnitureShopBody(progress: Progress, saved: () => void) {
  let cat: FurnitureCategory | 'finishes' = 'living';
  let sel = FURNITURE_LIST.find((f) => f.cat === cat)!.id;
  let colour = FURNITURE[sel].colours[0];
  let qty = 1;
  let room: RoomId = 'living';
  return (msg: (t: string, bad?: boolean) => void, rebuild: () => void): HTMLElement[] => {
    const prop = progress.save.property;
    const owned = (id: string) => prop.furniture.filter((f) => f.id === id).length;
    const rows: HTMLElement[] = [
      h('p', { class: 'hint', text: 'Everything you buy is delivered to your house. Place it with the home planner (by the front door).' }),
      tabs([...FURNITURE_CATEGORIES, { id: 'finishes' as const, name: 'Floors & walls' }], cat, (id) => {
        cat = id;
        if (id !== 'finishes') {
          sel = FURNITURE_LIST.find((f) => f.cat === id)!.id;
          colour = FURNITURE[sel].colours[0];
          qty = 1;
        }
        rebuild();
      }),
    ];
    if (cat === 'finishes') {
      rows.push(finishesBlock(progress, room, (r) => ((room = r), rebuild()), msg, saved));
      return rows;
    }
    const def = FURNITURE[sel];
    const list = h('div', { class: 'prop-list' }, ...FURNITURE_LIST.filter((f) => f.cat === cat).map((f) => {
      const n = owned(f.id);
      const b = h('button', { class: `prop-item${f.id === sel ? ' on' : ''}`, 'data-nav': true, onclick: () => ((sel = f.id), (colour = f.colours[0]), (qty = 1), rebuild()) },
        h('b', { text: f.name }), h('span', { text: `${money(f.price)}${n ? ` · own ${n}` : ''}${soonTag(tierLockFor(progress, priceTier('furniture', f.price)))}` }));
      return b;
    }));
    const total = def.price * qty;
    const fTier = priceTier('furniture', def.price);
    const fLock = tierLockFor(progress, fTier);
    const detail = h('div', { class: 'prop-detail' },
      previewCanvas(def.id, colour),
      h('h3', { text: def.name }),
      h('p', { class: 'hint', text: `${def.blurb} ${def.mount === 'wall' ? 'Hangs on the wall.' : def.mount === 'rug' ? 'Lies on the floor (walk over it).' : ''} Goes in: ${allowedRooms(def).map((r) => ROOMS[r].name).join(', ')}.` }),
      swatches(def.colours, colour, (c) => ((colour = c), rebuild())),
      h('div', { class: 'qty-row' },
        menuButton('−', () => ((qty = Math.max(1, qty - 1)), rebuild()), undefined, 'small'),
        h('span', { text: `× ${qty}` }),
        menuButton('+', () => ((qty = Math.min(10, qty + 1)), rebuild()), undefined, 'small'),
        fLock ? lockedBuy(fTier, fLock, msg) : menuButton(`Buy ${money(total)}`, () => result(buyFurniture(progress, def.id, colour, qty), `${qty > 1 ? `${qty} × ` : ''}${def.name} on the van to Tanner Road`, msg, saved)),
      ),
    );
    rows.push(h('div', { class: 'prop-shop' }, list, detail));
    return rows;
  };
}

export function furnitureShopScreen(progress: Progress, close: () => void, saved: () => void): Screen {
  return panelScreen('Sofa So Good', progress, furnitureShopBody(progress, saved), close);
}

function finishesBlock(progress: Progress, room: RoomId, pickRoom: (r: RoomId) => void, msg: (t: string, bad?: boolean) => void, saved: () => void): HTMLElement {
  const cur = progress.save.property.finishes[room];
  const row = (id: string) => {
    const f = FINISHES[id];
    const on = cur[f.kind] === id;
    const sw = h('i', { class: 'finish-swatch' });
    sw.style.background = f.colour2 ? `linear-gradient(135deg, ${f.colour} 50%, ${f.colour2} 50%)` : f.colour;
    const b = menuButton(on ? 'Done' : money(f.price), () => result(buyFinish(progress, room, id), `${f.name} in the ${ROOMS[room].name.toLowerCase()}`, msg, saved));
    if (on) b.setAttribute('disabled', '');
    return h('div', { class: `shop-row${on ? ' owned' : ''}` }, h('div', { class: 'what' }, h('b', {}, sw, f.name), h('span', { text: f.kind === 'floor' ? 'Flooring, fitted' : 'Walls, decorated' })), b);
  };
  return h('div', {},
    tabs(ROOM_IDS.map((r) => ({ id: r, name: ROOMS[r].name })), room, pickRoom),
    h('p', { class: 'hint', text: `Now: ${FINISHES[cur.floor].name} floor, ${FINISHES[cur.wall].name.toLowerCase()} walls. Fitted straight away.` }),
    h('h3', { text: 'Floors' }), ...FINISH_LIST.filter((f) => f.kind === 'floor').map((f) => row(f.id)),
    h('h3', { text: 'Walls' }), ...FINISH_LIST.filter((f) => f.kind === 'wall').map((f) => row(f.id)),
  );
}

// ---- home planner -----------------------------------------------------------------------------------

/**
 * Everything you own for the house, room by room. `place` starts the
 * placement editor for a piece (moving it if it's already placed).
 */
export function plannerBody(progress: Progress, saved: () => void, place: (uid: string, room: RoomId) => void, startRoom: RoomId = 'living') {
  let room: RoomId = startRoom;
  let recolour: string | null = null;
  let tab: 'furniture' | 'decor' = 'furniture';
  return (msg: (t: string, bad?: boolean) => void, rebuild: () => void): HTMLElement[] => {
    const prop = progress.save.property;
    const rows: HTMLElement[] = [
      tabs(ROOM_IDS.map((r) => ({ id: r, name: ROOMS[r].name })), room, (r) => ((room = r), rebuild())),
      tabs([{ id: 'furniture' as const, name: 'Furniture' }, { id: 'decor' as const, name: 'Floor & walls' }], tab, (t) => ((tab = t), rebuild())),
    ];
    if (tab === 'decor') {
      rows.push(finishesBlock(progress, room, (r) => ((room = r), rebuild()), msg, saved));
      return rows;
    }
    const here = prop.furniture.filter((f) => f.at?.room === room);
    const boxed = prop.furniture.filter((f) => !f.at && allowedRooms(FURNITURE[f.id]).includes(room));
    rows.push(h('p', { class: 'hint', text: 'Move picks a piece up: slide it with the arrows, turn it, then Place to set it down. Colour repaints it; Store boxes it up.' }));
    rows.push(h('h3', { text: `In the ${ROOMS[room].name.toLowerCase()} (${here.length})` }));
    if (!here.length) rows.push(h('p', { class: 'hint', text: 'Nothing here yet.' }));
    for (const f of here) {
      const def = FURNITURE[f.id];
      const actions = h('div', { class: 'row-actions' },
        menuButton('Move', () => place(f.uid, room), undefined, 'small'),
        menuButton('Colour', () => ((recolour = recolour === f.uid ? null : f.uid), rebuild()), undefined, 'small'),
        menuButton('Store', () => result(storeFurniture(progress, f.uid), `${def.name} put away`, msg, saved), undefined, 'small'),
        menuButton(f.free ? 'Get rid of it' : `Sell ${money(furnitureValue(f))}`, () => {
          const r = sellFurniture(progress, f.uid);
          if (r.ok) {
            saved();
            msg(f.free ? `Got rid of the ${def.name.toLowerCase()} (it came with the house, so there’s nothing for it)` : `Sold the ${def.name.toLowerCase()} for ${money(r.refund)}`);
          } else msg(r.reason, true);
        }, undefined, 'small'),
      );
      const sw = h('i', { class: 'finish-swatch' });
      sw.style.background = f.colour;
      rows.push(h('div', { class: 'shop-row' }, h('div', { class: 'what' }, h('b', {}, sw, def.name), h('span', { text: def.mount === 'wall' ? 'On the wall' : `Turned ${f.at!.rot * 90}°` })), actions));
      if (recolour === f.uid) rows.push(swatches(def.colours, f.colour, (c) => result(recolourFurniture(progress, f.uid, c), `${def.name} recoloured`, msg, saved)));
    }
    rows.push(h('h3', { text: `Not placed yet (${boxed.length})` }));
    if (!boxed.length) rows.push(h('p', { class: 'hint', text: 'Buy more at Sofa So Good on the High Street.' }));
    for (const f of boxed) {
      const def = FURNITURE[f.id];
      rows.push(
        h('div', { class: 'shop-row' }, h('div', { class: 'what' }, h('b', { text: def.name }), h('span', { text: 'In its box' })),
          h('div', { class: 'row-actions' },
            menuButton('Place', () => place(f.uid, room), undefined, 'small'),
            menuButton(f.free ? 'Get rid of it' : `Sell ${money(furnitureValue(f))}`, () => {
              const r = sellFurniture(progress, f.uid);
              if (r.ok) {
                saved();
                msg(f.free ? 'Got rid of it' : `Sold for ${money(r.refund)}`);
              } else msg(r.reason, true);
            }, undefined, 'small'),
          )),
      );
    }
    return rows;
  };
}

export function plannerScreen(progress: Progress, close: () => void, saved: () => void, place: (uid: string, room: RoomId) => void, startRoom: RoomId = 'living', title = 'Home planner'): Screen {
  return panelScreen(title, progress, plannerBody(progress, saved, place, startRoom), close);
}

// ---- car dealer ------------------------------------------------------------------------------------

export function carDealerScreen(progress: Progress, close: () => void, saved: () => void): Screen {
  let cls: CarClass = 'hatchback';
  let sel = CAR_LIST[0].id;
  let colour = CARS[sel].colours[0];
  let mode: 'forecourt' | 'mods' = 'forecourt';
  const mods: ModsState = { uid: null, cat: 'paint', pick: null, armed: false };
  return panelScreen('Arnold Shark', progress, (msg, rebuild) => {
    const prop = progress.save.property;
    const modeTabs = prop.cars.length ? tabs([{ id: 'forecourt' as const, name: 'Forecourt' }, { id: 'mods' as const, name: 'Mods' }], mode, (m) => ((mode = m), rebuild())) : null;
    if (mode === 'mods' && prop.cars.length) return [modeTabs!, ...modsBody(progress, mods, msg, rebuild, saved)];
    const def = CARS[sel];
    const rows: HTMLElement[] = [
      ...(modeTabs ? [modeTabs] : []),
      h('p', { class: 'hint', text: `Bought cars are parked on your drive at 14 Tanner Road (${prop.cars.length}/${MAX_CARS} owned). Swap which one's on the drive from the car itself.` }),
      tabs(CAR_CLASSES, cls, (c) => {
        cls = c;
        sel = CAR_LIST.find((x) => x.cls === c)!.id;
        colour = CARS[sel].colours[0];
        rebuild();
      }),
    ];
    const list = h('div', { class: 'prop-list' }, ...CAR_LIST.filter((c) => c.cls === cls).map((c) =>
      h('button', { class: `prop-item${c.id === sel ? ' on' : ''}`, 'data-nav': true, onclick: () => ((sel = c.id), (colour = c.colours[0]), rebuild()) },
        h('b', { text: c.name }), h('span', { text: `${money(c.price)}${prop.cars.some((o) => o.id === c.id) ? ' · owned' : ''}${soonTag(tierLockFor(progress, priceTier('cars', c.price)))}` }))));
    const detail = h('div', { class: 'prop-detail' },
      previewCanvas(def.id, colour),
      h('h3', { text: `${def.name} — ${money(def.price)}` }),
      h('p', { class: 'hint', text: def.blurb }),
      statBar('Top speed (mph)', def.topSpeed, 215),
      statBar('0-60 (s, lower is quicker)', def.zeroSixty, 15),
      statBar('Handling', def.handling, 10),
      statBar('Seats', def.seats, 7),
      swatches(def.colours, colour, (c) => ((colour = c), rebuild())),
      (() => {
        const t = priceTier('cars', def.price);
        const lock = tierLockFor(progress, t);
        return lock ? lockedBuy(t, lock, msg) : menuButton(`Buy ${money(def.price)}`, () => result(buyCar(progress, def.id, colour), `${def.name} is on your drive`, msg, saved));
      })(),
    );
    rows.push(h('div', { class: 'prop-shop' }, list, detail));
    if (prop.cars.length) {
      rows.push(h('h3', { text: 'Your cars' }));
      for (const c of prop.cars) {
        const cd = CARS[c.id];
        rows.push(shopRow(cd.name, `${c.uid === prop.activeCar ? 'On the drive' : 'In the lock-up'}${c.from === 'won' ? ' · casino prize' : ''}`, `Sell ${money(resale(cd.price))}`, () => {
          const r = sellCar(progress, c.uid);
          if (r.ok) {
            saved();
            msg(`Sold the ${cd.name} for ${money(r.refund)}`);
          } else msg(r.reason, true);
        }));
      }
    }
    return rows;
  }, close);
}

// ---- bike shop ----------------------------------------------------------------------------------

export function bikeShopScreen(progress: Progress, close: () => void, saved: () => void): Screen {
  let cls: BikeClass = 'bicycle';
  let sel = BIKE_LIST[0].id;
  let colour = BIKES[sel].colours[0];
  let compare: string | null = null;
  return panelScreen('Halfrauds', progress, (msg, rebuild) => {
    const prop = progress.save.property;
    const def = BIKES[sel];
    const cmp: BikeDef | null = compare && compare !== sel ? BIKES[compare] : null;
    const rows: HTMLElement[] = [
      h('p', { class: 'hint', text: `Bikes and scooters are delivered to your garage (${prop.bikes.length}/${GARAGE_SPACES} spaces). Take one out from the bike store in the garage.` }),
      tabs(BIKE_CLASSES, cls, (c) => {
        cls = c;
        sel = BIKE_LIST.find((x) => x.cls === c)!.id;
        colour = BIKES[sel].colours[0];
        rebuild();
      }),
    ];
    const list = h('div', { class: 'prop-list' }, ...BIKE_LIST.filter((b) => b.cls === cls).map((b) =>
      h('button', { class: `prop-item${b.id === sel ? ' on' : ''}`, 'data-nav': true, onclick: () => ((sel = b.id), (colour = b.colours[0]), rebuild()) },
        h('b', { text: b.name }), h('span', { text: `${money(b.price)} · ${b.cc ? `${b.cc}cc` : b.electric ? 'electric' : 'pedal'}${prop.bikes.some((o) => o.id === b.id) ? ' · owned' : ''}${soonTag(tierLockFor(progress, priceTier('bikes', b.price)))}` }))));
    const detail = h('div', { class: 'prop-detail' },
      previewCanvas(def.id, colour),
      h('h3', { text: `${def.name} — ${money(def.price)}` }),
      h('p', { class: 'hint', text: `${def.blurb}${cmp ? ` Marker shows the ${cmp.name}.` : ''}` }),
      statBar('Top speed (mph)', def.topSpeed, 120, cmp?.topSpeed),
      statBar('Acceleration', def.accel, 10, cmp?.accel),
      statBar('Handling', def.handling, 10, cmp?.handling),
      statBar('Braking', def.braking, 10, cmp?.braking),
      statBar('Suspension', def.suspension, 10, cmp?.suspension),
      swatches(def.colours, colour, (c) => ((colour = c), rebuild())),
      h('div', { class: 'row-actions' },
        menuButton(compare === sel ? 'Comparing…' : 'Compare with this', () => ((compare = compare === sel ? null : sel), rebuild()), compare && compare !== sel ? `vs ${BIKES[compare].name}` : 'then pick another', 'small'),
        (() => {
          const t = priceTier('bikes', def.price);
          const lock = tierLockFor(progress, t);
          return lock ? lockedBuy(t, lock, msg) : menuButton(`Buy ${money(def.price)}`, () => result(buyBike(progress, def.id, colour), `${def.name} delivered to your garage`, msg, saved));
        })(),
      ),
    );
    rows.push(h('div', { class: 'prop-shop' }, list, detail));
    if (prop.bikes.length) {
      rows.push(h('h3', { text: 'Your bikes' }));
      for (const b of prop.bikes) {
        const bd = BIKES[b.id];
        rows.push(shopRow(bd.name, prop.bikeOut?.uid === b.uid ? 'Out and about' : 'In the garage', `Sell ${money(resale(bd.price))}`, () => {
          const r = sellBike(progress, b.uid);
          if (r.ok) {
            saved();
            msg(`Sold the ${bd.name} for ${money(r.refund)}`);
          } else msg(r.reason, true);
        }));
      }
    }
    return rows;
  }, close);
}

// ---- garage bike store ---------------------------------------------------------------------------

export function garageBikeScreen(progress: Progress, close: () => void, saved: () => void, takenOut: () => void): Screen {
  return panelScreen('Bike store', progress, (msg) => {
    const prop = progress.save.property;
    const rows: HTMLElement[] = [h('p', { class: 'hint', text: `${prop.bikes.length}/${GARAGE_SPACES} bays used. A bike you take out is left by the front door; ride it with the interact button, get off with interact again.` })];
    if (!prop.bikes.length) rows.push(h('p', { text: 'No bikes yet. Halfrauds on the Brackley Trading Estate sells them (Duber can drop you there).' }));
    const out = prop.bikeOut;
    if (out) {
      const b = prop.bikes.find((x) => x.uid === out.uid)!;
      rows.push(shopRow(BIKES[b.id].name, `Out: ${prop.riding ? 'you’re on it' : `parked at ${LEVELS[out.area].name}`}`, 'Bring it back', () => result(storeBike(progress), `${BIKES[b.id].name} back in the garage`, msg, saved)));
    }
    for (const b of prop.bikes) {
      if (out?.uid === b.uid) continue;
      const def = BIKES[b.id];
      rows.push(shopRow(def.name, `${def.cc}cc · ${def.topSpeed} mph${b.from === 'won' ? ' · casino prize' : ''}`, out ? 'One out already' : 'Take it out', out ? null : () => {
        const r = takeOutBike(progress, b.uid);
        if (r.ok) {
          saved();
          takenOut();
        } else msg(r.reason, true);
      }));
    }
    return rows;
  }, close);
}

// ---- cosmetic mods (property/carMods.ts) ------------------------------------------------------------

interface ModsState {
  uid: string | null;
  cat: ModCat;
  /** The option being looked at (previewed, not bought yet). */
  pick: string | null;
  /** The fit button's been pressed once: the next press pays. */
  armed: boolean;
}

/** The Mods tab: your car, what's fitted, every option with its price, a live preview, and a fit that asks first. */
function modsBody(progress: Progress, st: ModsState, msg: (t: string, bad?: boolean) => void, rebuild: () => void, saved: () => void): HTMLElement[] {
  const prop = progress.save.property;
  const car = prop.cars.find((c) => c.uid === st.uid) ?? prop.cars.find((c) => c.uid === prop.activeCar) ?? prop.cars[0];
  st.uid = car.uid;
  const def = CARS[car.id];
  const cat = MOD_CATS.find((c) => c.id === st.cat)!;
  const opts = cat.options(car.id);
  const on = fitted(car, st.cat);
  const pick = opts.find((o) => o.value === st.pick) ?? opts.find((o) => o.value === on) ?? opts[0];
  const draft: CarMods = { ...(car.mods ?? {}), [st.cat]: pick.value };
  const paint = st.cat === 'paint' ? pick.value : paintOf(car);
  const reset = () => ((st.pick = null), (st.armed = false));
  const rows: HTMLElement[] = [
    h('p', { class: 'hint', text: 'Looks only: nothing changes how it drives. Pick a part to see it on the car, then fit it. Mods stay on the car wherever you park it.' }),
  ];
  if (prop.cars.length > 1) rows.push(tabs(prop.cars.map((c) => ({ id: c.uid, name: CARS[c.id].name })), car.uid, (u) => ((st.uid = u), reset(), rebuild())));
  rows.push(tabs(MOD_CATS.map((c) => ({ id: c.id, name: c.name })), st.cat, (c) => ((st.cat = c), reset(), rebuild())));
  const list = h('div', { class: 'prop-list' }, ...opts.map((o) => {
    const b = h('button', { class: `prop-item${o.value === pick.value ? ' on' : ''}`, 'data-nav': true, onclick: () => ((st.pick = o.value), (st.armed = false), rebuild()) },
      h('b', { text: `${o.value === on ? '✓ ' : ''}${o.name}` }), h('span', { text: o.value === on ? 'Fitted' : o.price ? money(o.price) : 'Free' }));
    if (o.swatch) b.style.borderLeft = `10px solid ${o.swatch}`;
    return b;
  }));
  const fittedNow = pick.value === on;
  const btn = fittedNow
    ? h('p', { class: 'hint', text: 'Fitted on your car.' })
    : menuButton(st.armed ? `Confirm: fit for ${pick.price ? money(pick.price) : 'free'}` : `Fit ${pick.name}${pick.price ? ` (${money(pick.price)})` : ''}`, () => {
        if (!st.armed) {
          st.armed = true;
          return rebuild();
        }
        st.armed = false;
        const r = fitMod(progress, car.uid, st.cat, pick.value);
        if (!r.ok) return msg(r.reason, true);
        saved();
        msg(`${pick.name} fitted to your ${def.name}${r.price ? ` for ${money(r.price)}` : ''}.`);
      }, st.armed ? 'Pays from your pocket, then the bank' : 'Press again to confirm', 'primary');
  rows.push(h('div', { class: 'prop-shop' }, list, h('div', { class: 'prop-detail' }, previewCanvas(car.id, paint, draft), h('h3', { text: `${def.name}: ${cat.name}` }), btn)));
  return rows;
}

// ---- the car on the drive ----------------------------------------------------------------------------

export function carScreen(progress: Progress, here: AreaId, calm: boolean, close: () => void, saved: () => void, travel: (area: AreaId, opt: TravelOption) => void, swapped: () => void): Screen {
  return panelScreen('Your car', progress, (msg) => {
    const prop = progress.save.property;
    const active = prop.cars.find((c) => c.uid === prop.activeCar);
    const rows: HTMLElement[] = [];
    if (active) {
      const d = CARS[active.id];
      rows.push(h('p', { class: 'hint', text: `${d.name}: ${d.topSpeed} mph, 0-60 in ${d.zeroSixty}s. Driving is free and nobody jumps you on the way; it’s left parked at the other end. Or pick a place on the map and choose Drive.` }));
    }
    rows.push(h('h3', { text: 'Drive to' }));
    const stops: { area: AreaId; name: string }[] = [
      ...(prop.carOut ? [{ area: 'home' as AreaId, name: 'Home (back on the drive)' }] : []),
      ...SHOP_STOPS.map((s) => ({ area: s.area, name: LEVELS[s.area].name })),
      ...TAXI_STOPS.map((s) => ({ area: s.area, name: LEVELS[s.area].district })),
    ];
    for (const s of stops) {
      const opt = driveOption(progress, here, s.area, calm);
      if (!opt || s.area === here) continue;
      rows.push(shopRow(s.name, opt.ok ? LEVELS[s.area].name : opt.why ?? 'Not yet', opt.ok ? 'Drive' : 'Locked', opt.ok ? () => travel(s.area, opt) : null));
    }
    if (prop.cars.length > 1 && !prop.carOut) {
      rows.push(h('h3', { text: 'On the drive' }));
      for (const c of prop.cars) {
        const d = CARS[c.id];
        const on = c.uid === prop.activeCar;
        rows.push(shopRow(d.name, on ? 'On the drive now' : 'In the lock-up', on ? 'Parked' : 'Swap in', on ? null : () => {
          const r = setActiveCar(progress, c.uid);
          if (r.ok) {
            saved();
            swapped();
          } else msg(r.reason, true);
        }, on));
      }
    }
    return rows;
  }, close);
}

// ---- casino -------------------------------------------------------------------------------------------

const RESPONSIBLY = 'Game money only. Set yourself a limit; the house always wins in the end.';

export function slotsScreen(progress: Progress, close: () => void, saved: () => void): Screen {
  let bet = SLOT_BETS[0];
  let reels: string[] = ['7', '7', '7'];
  let last = '';
  return panelScreen('Slots', progress, (msg, rebuild) => {
    const rows: HTMLElement[] = [
      h('p', { class: 'hint', text: `Three of a kind pays: ${SLOT_SYMBOLS.map((s) => `${s}×${SLOT_PAYS[s]}`).join('  ')}. Any two cherries pays ×2. ${RESPONSIBLY}` }),
      h('div', { class: 'reels' }, ...reels.map((r) => h('span', { text: r }))),
      h('p', { class: 'casino-result', text: last }),
      tabs(SLOT_BETS.map((b) => ({ id: String(b), name: money(b) })), String(bet), (b) => ((bet = Number(b)), rebuild())),
      menuButton(`Spin (${money(bet)})`, () => {
        const r = playSlots(progress, bet);
        if (!r.ok) return msg(r.reason, true);
        reels = r.detail.reels;
        last = r.win ? `Winner! ${money(r.win)}` : 'No luck.';
        saved();
        rebuild();
      }),
    ];
    return rows;
  }, close);
}

export function rouletteScreen(progress: Progress, close: () => void, saved: () => void): Screen {
  let bet = TABLE_BETS[0];
  let kind: string = 'red';
  let number = 17;
  let last = '';
  let history: { n: number; c: string }[] = [];
  return panelScreen('Roulette', progress, (msg, rebuild) => {
    const opts: { id: string; name: string }[] = [
      { id: 'red', name: 'Red' }, { id: 'black', name: 'Black' }, { id: 'odd', name: 'Odd' }, { id: 'even', name: 'Even' },
      { id: 'low', name: '1-18' }, { id: 'high', name: '19-36' }, { id: 'd1', name: '1st 12' }, { id: 'd2', name: '2nd 12' }, { id: 'd3', name: '3rd 12' }, { id: 'num', name: 'Single number' },
    ];
    const toBet = (): RouletteBet =>
      kind === 'num' ? { kind: 'number', number } : kind.startsWith('d') ? { kind: 'dozen', dozen: Number(kind[1]) as 1 | 2 | 3 } : { kind: kind as 'red' };
    const rows: HTMLElement[] = [
      h('p', { class: 'hint', text: `Single zero. Evens pay 1:1, dozens 2:1, a single number 35:1. ${RESPONSIBLY}` }),
      h('div', { class: 'roulette-history' }, ...history.map((x) => h('span', { class: `rh ${x.c}`, text: String(x.n) }))),
      h('p', { class: 'casino-result', text: last }),
      h('h3', { text: 'Your bet' }),
      tabs(opts, kind, (k) => ((kind = k), rebuild())),
    ];
    if (kind === 'num') {
      rows.push(h('div', { class: 'qty-row' },
        menuButton('−', () => ((number = (number + 36) % 37), rebuild()), undefined, 'small'),
        h('span', { text: `Number ${number}` }),
        menuButton('+', () => ((number = (number + 1) % 37), rebuild()), undefined, 'small')));
    }
    rows.push(
      h('h3', { text: 'Stake' }),
      tabs(TABLE_BETS.map((b) => ({ id: String(b), name: money(b) })), String(bet), (b) => ((bet = Number(b)), rebuild())),
      menuButton(`Spin (${money(bet)})`, () => {
        const r = playRoulette(progress, toBet(), bet);
        if (!r.ok) return msg(r.reason, true);
        history = [{ n: r.detail.number, c: r.detail.colour }, ...history].slice(0, 12);
        last = `${r.detail.number} ${r.detail.colour}. ${r.win ? `You win ${money(r.win)} back.` : 'The house takes it.'}`;
        saved();
        rebuild();
      }),
    );
    return rows;
  }, close);
}

const cardEl = (c: Card | null) => h('span', { class: `card${c && (c.suit === '♥' || c.suit === '♦') ? ' red' : ''}${c ? '' : ' back'}`, text: c ? `${c.rank}${c.suit}` : '' });

export function blackjackScreen(progress: Progress, close: () => void, saved: () => void): Screen {
  let bet = TABLE_BETS[0];
  let hand: BlackjackHand | null = null;
  const outcomeText: Record<string, string> = { blackjack: 'Blackjack! Pays 3 to 2.', win: 'You win.', push: 'Push: stake back.', lose: 'Dealer wins.', bust: 'Bust.' };
  return panelScreen('Blackjack', progress, (msg, rebuild) => {
    const rows: HTMLElement[] = [h('p', { class: 'hint', text: `Dealer stands on 17. Blackjack pays 3:2. Double down on your first two cards. ${RESPONSIBLY}` })];
    if (hand) {
      const hideHole = !hand.done;
      rows.push(
        h('h3', { text: `Dealer${hideHole ? '' : ` — ${handValue(hand.dealer).total}`}` }),
        h('div', { class: 'cards' }, ...hand.dealer.map((c, i) => cardEl(hideHole && i === 1 ? null : c))),
        h('h3', { text: `You — ${handValue(hand.player).total}${hand.doubled ? ' (doubled)' : ''}` }),
        h('div', { class: 'cards' }, ...hand.player.map((c) => cardEl(c))),
        h('p', { class: 'casino-result', text: hand.done ? `${outcomeText[hand.outcome!]} ${hand.win ? `Paid ${money(hand.win)}.` : ''}` : `Stake ${money(hand.bet)}` }),
      );
    }
    if (!hand || hand.done) {
      rows.push(
        tabs(TABLE_BETS.map((b) => ({ id: String(b), name: money(b) })), String(bet), (b) => ((bet = Number(b)), rebuild())),
        menuButton(`Deal (${money(bet)})`, () => {
          const r = dealBlackjack(progress, bet);
          if (!r.ok) return msg(r.reason, true);
          hand = r.detail;
          saved();
          rebuild();
        }),
      );
    } else {
      const hd = hand;
      rows.push(h('div', { class: 'row-actions' },
        menuButton('Hit', () => (hit(progress, hd), saved(), rebuild())),
        menuButton('Stand', () => (stand(progress, hd), saved(), rebuild())),
        hd.player.length === 2 ? menuButton(`Double (+${money(hd.bet)})`, () => {
          const r = doubleDown(progress, hd);
          if (!r.ok) return msg(r.reason, true);
          saved();
          rebuild();
        }) : null,
      ));
    }
    return rows;
  }, close);
}

export function cashierScreen(progress: Progress, close: () => void, saved: () => void, won: () => void): Screen {
  let last = '';
  return panelScreen('Cashier', progress, (msg, rebuild) => {
    const c = progress.save.property.casino;
    const prize = compPrize(progress.save.trips);
    const draws = DRAW_PRIZES.map((d) => `${money(d.cash)} (${d.weight}%)`).join(', ');
    const rows: HTMLElement[] = [
      h('p', { class: 'hint', text: RESPONSIBLY }),
      h('div', { class: 'prop-detail' }, previewCanvas(prize.id, prize.colour)),
      h('h3', { text: `Win the ${prizeName(prize)}` }),
      h('p', { class: 'hint', text: `${money(COMP_TICKET)} a ticket, 1 in ${compOdds(prize).toLocaleString('en-GB')} wins. ${prize.kind === 'car' ? 'Cars are parked on your drive.' : 'Bikes go in your garage.'} The motor on the podium changes every few trips.` }),
      h('p', { class: 'casino-result', text: last }),
      menuButton(`Competition ticket (${money(COMP_TICKET)})`, () => {
        const r = playCompetition(progress);
        if (!r.ok) return msg(r.reason, true);
        saved();
        if (r.detail.won) {
          last = r.detail.cashInstead ? `You won the ${r.detail.prize}! No room for it, so here's ${money(r.win)} cash.` : `YOU WON THE ${r.detail.prize.toUpperCase()}!`;
          if (!r.detail.cashInstead) won();
        } else last = 'Not this time.';
        rebuild();
      }),
      h('h3', { text: 'Prize draw' }),
      h('p', { class: 'hint', text: `${money(DRAW_TICKET)} a ticket. Prizes: ${draws}.` }),
      menuButton(`Prize draw ticket (${money(DRAW_TICKET)})`, () => {
        const r = playPrizeDraw(progress);
        if (!r.ok) return msg(r.reason, true);
        last = r.win ? `Prize draw: you won ${money(r.win)}!` : 'Prize draw: no prize.';
        saved();
        rebuild();
      }),
      h('h3', { text: 'Your night so far' }),
      h('p', { text: `Staked ${money(c.staked)} · won ${money(c.won)} · ${c.plays} plays · biggest win ${money(c.biggestWin)}${c.prizes.length ? ` · motors won: ${c.prizes.map((id) => (CARS[id] ?? BIKES[id]).name).join(', ')}` : ''}` }),
    ];
    return rows;
  }, close);
}


// ---- the house computer -------------------------------------------------------------------------

/**
 * The PC in the living room: the one place to run the house. Shop for
 * furniture (delivered straight away), arrange what you own (place, move,
 * turn, store, sell, recolour), redo floors and walls.
 */
export function computerScreen(progress: Progress, close: () => void, saved: () => void, place: (uid: string, room: RoomId) => void, extraTabs: { id: string; name: string; body: (msg: (t: string, bad?: boolean) => void, rebuild: () => void) => HTMLElement[] }[] = []): Screen {
  let tab = 'mine';
  const shop = furnitureShopBody(progress, saved);
  const mine = plannerBody(progress, saved, place);
  return panelScreen('Home computer', progress, (msg, rebuild) => {
    const all = [{ id: 'mine', name: 'My furniture' }, { id: 'shop', name: 'Shop online' }, ...extraTabs.map((t) => ({ id: t.id, name: t.name }))];
    const owned = progress.save.property.furniture;
    const rows: HTMLElement[] = [
      h('p', { class: 'hint', text: `${owned.filter((f) => f.at).length} pieces placed, ${owned.filter((f) => !f.at).length} in boxes. Buy here and it’s delivered at once; then place it from “My furniture”.` }),
      tabs(all, tab, (t) => ((tab = t), rebuild())),
    ];
    if (tab === 'shop') rows.push(...shop(msg, rebuild));
    else if (tab === 'mine') rows.push(...mine(msg, rebuild));
    else rows.push(...(extraTabs.find((t) => t.id === tab)?.body(msg, rebuild) ?? []));
    return rows;
  }, close);
}
