import { BOSSES } from '../ai/bosses';
import { CONTACT_IDS, CONTACTS, contactOpen, objectiveOf, type ContactId } from '../jobs/jobs';
import { COMPANION_LIST } from '../companions/companions';
import { ITEMS } from '../items/items';
import { AREA_IDS, type AreaId, type Progress } from '../progress/Progress';
import { CAB_FLAG, CAB_MIN, CAB_PER_MILE, SHOP_STOPS, TAXI_STOPS } from '../ui/hub';
import { DISTRICT_ORDER, LEVELS } from '../world/levels';
import type { ExitDef, LevelDef } from '../world/LevelTypes';
import { STRIP } from '../world/strip';
import { GENERATED_TOWNS } from '../world/towns';
import { PROPERTIES } from '../realty/catalogue';
import { statusOf } from '../realty/portfolio';
import { CARS } from '../property/catalogue';
import { DRIVE_HOME, parkingSpot, type ParkingSpot } from '../property/parking';
import { journeyRisk, riskWord } from '../travel/onFoot';
import { atmOpen, bankOf } from '../money/atm';
import { LOCKUP_ID } from '../world/lockup';

/**
 * The town map's data. Places, doors, links, locks, bosses, shops and people
 * all come from the game's own levels and progress; this file only adds
 * where each street sits on the drawn map (each a road from its left end to
 * its right end, laid out as a real street plan: LAYOUT), the city round them
 * (FEATURES), and a line of description for the info card.
 */

export type Pt = { x: number; y: number };

/** Map canvas size (SVG units): the city on the left, the six towns out east along the A-roads. */
export const MAP_W = 4400;
export const MAP_H = 2200;

/** A street drawn as a road: the points it runs through, from its west (left-hand, x = minX) end. */
interface RoadLayout {
  pts: Pt[];
  /** District shading colour. */
  tint: string;
  /** Kind of road for drawing. */
  road: 'main' | 'side' | 'tunnel' | 'path';
}

const TINTS: Partial<Record<AreaId, { tint: string; road: RoadLayout['road'] }>> = {
  stadium: { tint: '#3d6a3a', road: 'main' },
  leisure: { tint: '#3f7a46', road: 'main' },
  residential: { tint: '#6b5a48', road: 'main' },
  estate: { tint: '#7a5a40', road: 'main' },
  high_street: { tint: '#8a4a3a', road: 'main' },
  alleys: { tint: '#5a5048', road: 'side' },
  industrial: { tint: '#5a5f66', road: 'main' },
  ind_estate: { tint: '#5a6068', road: 'main' },
  market: { tint: '#7a6a3a', road: 'side' },
  subway: { tint: '#4a4f5c', road: 'tunnel' },
  city: { tint: '#8a6a30', road: 'main' },
  docks: { tint: '#3a5a70', road: 'side' },
  precinct: { tint: '#6a5a7a', road: 'main' },
  mall: { tint: '#5a6a8a', road: 'main' },
  car_park: { tint: '#555a62', road: 'side' },
  nightlife: { tint: '#7a3a6a', road: 'main' },
  factory: { tint: '#4a4a4a', road: 'side' },
  underground: { tint: '#3a3a4a', road: 'tunnel' },
  territory: { tint: '#6a3030', road: 'side' },
  hq: { tint: '#4a2a2a', road: 'main' },
};

/**
 * The town as a real street plan. The game is one long street (world/strip.ts), and on the map it still is, each
 * street running on from the last, but it winds through a city the way real roads do: round corners, past the
 * canal and the railway, through the centre, with the back streets drawn round it. Each street is a run of moves on
 * a grid of CELL units (E, W, N, S and a number of cells), roughly as long as the street is in the game.
 */
const CELL = 60;
type Move = [dir: 'E' | 'W' | 'N' | 'S', cells: number];
const CITY_AT = { x: 150, y: 100 };
const CITY_START: Pt = { x: 2, y: 3 };
const CITY: [AreaId, Move[]][] = [
  ['stadium', [['E', 4], ['S', 1], ['E', 2]]],
  ['leisure', [['E', 3], ['N', 2], ['E', 2]]],
  ['residential', [['E', 2], ['S', 3], ['E', 2]]],
  ['estate', [['S', 3], ['E', 3]]],
  ['high_street', [['E', 8]]],
  ['alleys', [['N', 2], ['E', 2], ['N', 2]]],
  ['industrial', [['E', 6], ['S', 2]]],
  ['ind_estate', [['S', 4], ['E', 2], ['S', 2]]],
  ['market', [['W', 3], ['S', 3]]],
  ['subway', [['W', 6]]],
  ['city', [['W', 2], ['S', 2], ['W', 4]]],
  ['docks', [['S', 3], ['W', 5]]],
  ['precinct', [['W', 3], ['N', 3], ['W', 1]]],
  ['mall', [['W', 4], ['S', 4]]],
  ['car_park', [['S', 2], ['W', 3], ['S', 2]]],
  ['nightlife', [['E', 8]]],
  ['factory', [['E', 5], ['S', 2]]],
  ['underground', [['E', 7]]],
  ['territory', [['E', 3], ['N', 4]]],
  ['hq', [['E', 4], ['N', 2], ['E', 2]]],
];
/** Each other town: four streets knotted together, the same shape turned and placed (top-left cell of each). */
const TOWN: Move[][] = [
  [['E', 3], ['S', 2], ['E', 3]],
  [['S', 3], ['W', 2], ['S', 2]],
  [['E', 4], ['N', 2], ['E', 2]],
  [['N', 3], ['E', 2], ['N', 2]],
];
const TOWN_AT: Pt[] = [{ x: 2780, y: 160 }, { x: 3560, y: 160 }, { x: 2780, y: 800 }, { x: 3560, y: 800 }, { x: 2780, y: 1440 }, { x: 3560, y: 1440 }];

const STEP: Record<Move[0], Pt> = { E: { x: 1, y: 0 }, W: { x: -1, y: 0 }, N: { x: 0, y: -1 }, S: { x: 0, y: 1 } };
function walk(at: Pt, from: Pt, moves: Move[]): Pt[] {
  const out = [{ x: at.x + from.x * CELL, y: at.y + from.y * CELL }];
  let c = { ...from };
  for (const [d, n] of moves) {
    c = { x: c.x + STEP[d].x * n, y: c.y + STEP[d].y * n };
    out.push({ x: at.x + c.x * CELL, y: at.y + c.y * CELL });
  }
  return out;
}
const cityPt = (x: number, y: number): Pt => ({ x: CITY_AT.x + x * CELL, y: CITY_AT.y + y * CELL });

/**
 * Real streets aren't ruled lines: every road on the map is drawn through a gentle, smooth warp of the plane (the
 * same for everything, so what meets still meets) with its corners rounded off, like an old town's.
 */
function warp(q: Pt): Pt {
  const { x, y } = q;
  return {
    x: x + 34 * Math.sin(y / 260 + 0.7) + 20 * Math.sin((x + y) / 410 + 2.1) + 10 * Math.sin(y / 97 + x / 300),
    y: y + 30 * Math.sin(x / 300 + 1.3) + 18 * Math.sin((x - y) / 370 + 0.4) + 9 * Math.sin(x / 110 - y / 340),
  };
}
/** Corners rounded (Chaikin), the ends kept where they are, then every point put through the warp. */
function organic(line: Pt[], rounds = 3, r = 0.22): Pt[] {
  let pts = line;
  for (let n = 0; n < rounds; n++) {
    const out: Pt[] = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      if (i > 0) out.push(lerp(a, b, r));
      if (i < pts.length - 2) out.push(lerp(a, b, 1 - r));
    }
    out.push(pts[pts.length - 1]);
    pts = out;
  }
  // Long straights get points along them, so the warp can bend them too.
  const dense: Pt[] = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const n = Math.max(1, Math.ceil(Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y) / 30));
    for (let k = 1; k <= n; k++) dense.push(lerp(pts[i - 1], pts[i], k / n));
  }
  return dense.map(warp);
}
/** A smooth closed blob (a park, a lake) round a middle, its edge wandering by `wobble`. */
function blob(c: Pt, rx: number, ry: number, seed: number, wobble = 0.22): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    const k = 1 + wobble * (Math.sin(a * 3 + seed) * 0.6 + Math.sin(a * 5 + seed * 2.3) * 0.4);
    out.push(warp({ x: c.x + Math.cos(a) * rx * k, y: c.y + Math.sin(a) * ry * k }));
  }
  return out;
}

const LAYOUT: Partial<Record<AreaId, RoadLayout>> = (() => {
  const out: Partial<Record<AreaId, RoadLayout>> = {};
  const style = (id: AreaId) => TINTS[id] ?? { tint: '#5a5a5a', road: 'main' as const };
  let c = { ...CITY_START };
  for (const [id, moves] of CITY) {
    const pts = walk(CITY_AT, c, moves);
    c = { x: (pts[pts.length - 1].x - CITY_AT.x) / CELL, y: (pts[pts.length - 1].y - CITY_AT.y) / CELL };
    out[id] = { pts: organic(pts), ...style(id) };
  }
  // The generated towns, in the strip's order, four streets each.
  const rest = STRIP.filter((id) => !out[id]);
  rest.forEach((id, i) => {
    const town = Math.floor(i / 4);
    const at = TOWN_AT[town % TOWN_AT.length];
    let tc = { x: 0, y: 0 };
    for (let k = 0; k < i % 4; k++) for (const [d, n] of TOWN[k]) tc = { x: tc.x + STEP[d].x * n, y: tc.y + STEP[d].y * n };
    out[id] = { pts: organic(walk(at, tc, TOWN[i % 4])), ...style(id) };
  });
  return out;
})();

/**
 * The rest of the map, drawn round the streets you play, the way a city map looks: the river winding through the
 * middle and the canal, parks, the railway, the A-roads out to the other towns, a few through-roads, and the dense
 * web of back streets (a jittered lattice of junctions with most links built and a few diagonals, all through the
 * same warp, so blocks come out irregular).
 */
export interface MapFeatures {
  water: Pt[][];
  parks: Pt[][];
  rail: Pt[][];
  links: Pt[][];
  /** Through-roads: wider than the back streets, not streets you play. */
  arterial: Pt[][];
  minor: Pt[][];
  labels: { text: string; at: Pt; ang: number; kind: 'water' | 'park' | 'rail' | 'link' }[];
}
export const FEATURES: MapFeatures = (() => {
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const water = [
    // The River Brack, wide and winding through the middle, under the bridges, past the docks.
    organic([cityPt(-4, 21.4), cityPt(4, 19.6), cityPt(10, 23.2), cityPt(16, 21.6), cityPt(21, 21.4), cityPt(25.2, 19), cityPt(27.4, 14.6), cityPt(31.6, 13.6), cityPt(36, 16), cityPt(41, 14.4), { x: 2700, y: 1000 }, { x: 3200, y: 1230 }, { x: 3600, y: 1180 }, { x: 4400, y: 1300 }], 4, 0.25),
    // The Grand Union Canal, past Canal Side Works, down to meet the river.
    organic([cityPt(42, 2.6), cityPt(33, 4.5), cityPt(30.4, 6.4), cityPt(27.8, 9.6), cityPt(27.4, 14.4)], 3, 0.25),
  ];
  const parks = [
    blob(cityPt(4.4, 1.4), 150, 70, 1), blob(cityPt(9.7, 4.2), 60, 110, 2), blob(cityPt(16.6, 10.8), 140, 100, 3, 0.3),
    blob(cityPt(32.8, 18.4), 110, 70, 4), blob(cityPt(2.4, 14.6), 120, 110, 5, 0.3), blob(cityPt(21.6, 3.6), 70, 50, 6),
    blob(cityPt(12.4, 14.2), 50, 40, 7), blob(cityPt(37.6, 8.2), 60, 70, 8), blob(cityPt(25.6, 24.6), 90, 50, 9),
  ];
  const rail = [organic([cityPt(-3, 12.2), cityPt(12, 11.6), cityPt(22, 12.4), cityPt(31, 11.2), cityPt(42, 10.4), { x: 4300, y: 760 }], 2, 0.3)];
  // A-roads: Hale House out to Saltmere, and on from each town's last street to the next town's first.
  const links: Pt[][] = [];
  const order = STRIP.filter((id) => LAYOUT[id]);
  for (let i = 1; i < order.length; i++) {
    const a = LAYOUT[order[i - 1]]!.pts;
    const from = a[a.length - 1];
    const to = LAYOUT[order[i]]!.pts[0];
    if (Math.hypot(from.x - to.x, from.y - to.y) < 2) continue;
    const mid = { x: (from.x + to.x) / 2 + (rnd() - 0.5) * 120, y: (from.y + to.y) / 2 + (rnd() - 0.5) * 120 };
    links.push(organic([from, mid, to], 3, 0.3).map((q, j, all) => (j === 0 ? from : j === all.length - 1 ? to : q)));
  }
  // Through-roads radiating from the centre and a ring, as old towns grew.
  const mid = cityPt(20, 13);
  const arterial: Pt[][] = [];
  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * Math.PI * 2 + 0.5 + (rnd() - 0.5) * 0.4;
    const len = 1250 + rnd() * 250;
    const pts: Pt[] = [];
    // From the ring road outwards: the middle is the old town's own tangle.
    for (let t = 0.42; t <= 1.0001; t += 0.116) pts.push({ x: mid.x + Math.cos(ang + Math.sin(t * 3 + i) * 0.12) * len * t, y: mid.y + Math.sin(ang + Math.sin(t * 3 + i) * 0.12) * len * t * 0.72 });
    arterial.push(organic(pts, 2, 0.3));
  }
  const ring: Pt[] = [];
  for (let i = 0; i <= 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    ring.push({ x: mid.x + Math.cos(a) * 560 * (1 + 0.08 * Math.sin(a * 3)), y: mid.y + Math.sin(a) * 400 * (1 + 0.08 * Math.cos(a * 2)) });
  }
  arterial.push(organic(ring, 2, 0.3));
  // The back streets: a jittered lattice, each junction nudged, most links built, a few diagonals.
  const minor: Pt[][] = [];
  const web = (x0: number, y0: number, x1: number, y1: number, step: number) => {
    const nx = Math.ceil((x1 - x0) / step);
    const ny = Math.ceil((y1 - y0) / step);
    const node: Pt[][] = [];
    for (let i = 0; i <= nx; i++) {
      node.push([]);
      for (let j = 0; j <= ny; j++) node[i].push({ x: x0 + i * step + (rnd() - 0.5) * step * 0.55, y: y0 + j * step + (rnd() - 0.5) * step * 0.55 });
    }
    const add = (a: Pt, b: Pt) => {
      // A slight bow in each street.
      const m = lerp(a, b, 0.5);
      const bow = (rnd() - 0.5) * step * 0.25;
      const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      minor.push(organic([a, { x: m.x - ((b.y - a.y) / len) * bow, y: m.y + ((b.x - a.x) / len) * bow }, b], 1, 0.25));
    };
    for (let i = 0; i <= nx; i++) for (let j = 0; j <= ny; j++) {
      if (i < nx && rnd() < 0.8) add(node[i][j], node[i + 1][j]);
      if (j < ny && rnd() < 0.8) add(node[i][j], node[i][j + 1]);
      if (i < nx && j < ny && rnd() < 0.12) add(node[i][j], rnd() < 0.5 ? node[i + 1][j + 1] : node[i + 1][j]);
    }
  };
  web(CITY_AT.x - CELL * 3, CITY_AT.y - CELL * 3, CITY_AT.x + 42 * CELL, CITY_AT.y + 30 * CELL, 78);
  for (const t of TOWN_AT) web(t.x - CELL * 3, t.y - CELL * 3, t.x + CELL * 15, t.y + CELL * 10, 72);
  const labels: MapFeatures['labels'] = [
    { text: 'River Brack', at: warp(cityPt(13, 22.8)), ang: 8, kind: 'water' },
    { text: 'River Brack', at: warp(cityPt(33.8, 14.4)), ang: 22, kind: 'water' },
    { text: 'Grand Union Canal', at: warp(cityPt(31.4, 5.6)), ang: -32, kind: 'water' },
    { text: 'Kirkgate Park', at: warp(cityPt(4.4, 1.5)), ang: 0, kind: 'park' },
    { text: 'Hollins Rec', at: warp(cityPt(9.7, 4.2)), ang: -80, kind: 'park' },
    { text: 'Victoria Park', at: warp(cityPt(16.6, 10.9)), ang: 0, kind: 'park' },
    { text: 'Brackley Line', at: warp(cityPt(7, 11.5)), ang: -2, kind: 'rail' },
  ];
  return { water, parks, rail, links, arterial, minor, labels };
})();

/** The card text for a place: written by hand for the home town, made from the town's own facts for the generated ones. */
function blurbOf(id: AreaId): string {
  const own = BLURB[id];
  if (own) return own;
  const town = GENERATED_TOWNS.find((t) => t.districts.some((d) => d.id === id));
  if (!town) return LEVELS[id].objective;
  const last = town.districts[town.districts.length - 1].id === id;
  return last
    ? `The far end of ${town.name}. ${town.boss.name}, ${town.boss.title}, runs the town from here.`
    : `A stretch of ${town.name}, east of Hale House. ${town.boss.name}, ${town.boss.title}, runs the town.`;
}

/** One line for the info card. */
const BLURB: Record<AreaId, string> = {
  home: 'Your terrace on Tanner Road. Stash, kitchen, home gym, garage and the basement.',
  basement: 'Under the house. The business runs down here.',
  estate: 'Low-rise flats, garages and the playground. Where you grew up.',
  residential: 'Tower blocks, a parade of shops and the Estate King’s lads.',
  leisure: 'Five-a-side cages, Kirkgate Active, the skate park, PureGraft and Fists First.',
  stadium: 'Kirkgate Ground and Firm Direct, the club shop. The firm runs the terraces.',
  high_street: 'LadsBroke, The Codfather, Weatherspoons, Puff & Connect, JD Streets, Sofa So Good, Abra Kebabra, Peaky Barbers and The Dodgy Arms.',
  alleys: 'Bins, back doors and shortcuts between the High Street and the canal.',
  market: 'Covered stalls and lock-ups. Maureen Doyle collects the rents.',
  industrial: 'Canal Side Works: Bodgit & Sons, the yards and Hard Knocks, Sully’s gym.',
  docks: 'Cranes, containers, Ship Happens and Big Lenny’s crew.',
  ind_estate: 'Brackley Trading Estate: Halfrauds, CarpetWrong, B&THC, Bodgit & Scarper and Arnold Shark.',
  factory: 'Harrow & Lowe, shut for years. Somebody’s using it.',
  subway: 'Underpasses under the ring road. Mind the stairs.',
  underground: 'An old Deep Line tunnel nobody admits is there.',
  city: 'Market Square: Meridian Financial, Kirkgate Constabulary, After Hours, The Grand Gamble, Cash Degenerator and The Rat & Crown.',
  precinct: '60s concrete precinct: Booze & Bargains, PoundTown, Debt365, Nailed It, Cluckin’ Hell, Rough & Tumble. Dean Pryce takes a cut from every shop.',
  mall: 'Riverside Shopping Centre: Shorts Direct, Curruptys, H. Sterling, The Munch Box, Primeark and Debtenhams.',
  car_park: 'No Chance Parking, the multi-storey. Top floor is where deals happen.',
  nightlife: 'The Neon Mile: Last Orders, Doner Dynasty, Blackout, Booze Brothers and After Hours.',
  territory: 'The Pit. Big Dunc’s patch, past the city.',
  hq: 'Hale House. Where it ends.',
  clothes_shop: 'JD Streets: clothes, shoes, accessories and bags. Priya runs it.',
  barber_shop: 'Peaky Barbers: haircuts, beards shaped or shaved, colour. Vinny’s chair, walk-ins welcome.',
  tattoo_studio: 'Ink & Iron: tattoos on arms, chest and neck, laser removal, re-inking. Shaz does the work.',
  pawn_shop: 'Cash Degenerator: sell valuables and collectibles. Mr Kaur doesn’t ask questions.',
  police_station: 'The front counter: see what they’ve got on you and settle fines. Where you end up when you’re nicked.',
  fight_club: 'The Scrap Yard: bare-knuckle fights in the cellar under Hard Knocks. Fight for purses, then for the title.',
  pub: 'Weatherspoons: food, drink and first aid at the bar. Fighters for hire in The Firm.',
  furniture_shop: 'Sofa So Good: furniture, floors and walls for your house.',
  car_dealer: 'Arnold Shark: new and used cars.',
  bike_shop: 'Halfrauds: bicycles, e-bikes, scooters and motorbikes.',
  casino: 'The Grand Gamble: slots, roulette, blackjack and prize motors.',
  grow_shop: 'B&THC: equipment and works for the basement business.',
  gym_store: 'PureGraft: home gym kit, bags, weights, treadmill, bike and more.',
  boxing_gym: 'Punch & Crunch: Coach Del teaches boxing and kickboxing. Drills and ranks.',
  karate_dojo: 'Fists First: Mrs Okafor teaches karate and Muay Thai.',
  wrestling_club: 'Rough & Tumble: Big Kev teaches wrestling and BJJ.',
  jeweller: 'H. Sterling, fine jewellers: rings, watches, chains and grills. Marcus will sell you anything.',
  estate_agent: 'Wrongmove in Meridian Financial: buy, sell and let property. Fiona and Raj run your portfolio.',
  ashcombe: 'Ashcombe Park: a gated road of mansions, villas and penthouses off Leisure Park. Everything’s for sale.',
  property: 'Inside a property: on a viewing, or one of your own.',
};

export type MarkerKind =
  | 'home' | 'mission' | 'boss' | 'side' | 'shop' | 'clothes' | 'pawn' | 'gym' | 'pub' | 'casino'
  | 'cars' | 'bikes' | 'property' | 'contact' | 'street' | 'parked' | 'police'
  // Phase 2 (map overhaul): the cash machines, the car mod shop and the boss-reward lock-up have pins of their own.
  | 'atm' | 'mods' | 'lockup';

export const MARKER_LABELS: Record<MarkerKind, string> = {
  home: 'Home (safehouse)',
  mission: 'Main mission',
  boss: 'Boss beaten',
  side: 'Side boss',
  shop: 'Shop',
  clothes: 'Clothes shop',
  pawn: 'Pawn shop',
  gym: 'Fighting gym',
  pub: 'Pub',
  casino: 'Casino',
  cars: 'Car dealer',
  bikes: 'Bike dealer',
  property: 'Your property',
  contact: 'People to meet',
  street: 'Street',
  parked: 'Your bike',
  police: 'Police station',
  atm: 'Cash machine',
  mods: 'Car mods',
  lockup: 'Lock-up',
};

const INTERIOR_KIND: Partial<Record<AreaId, MarkerKind>> = {
  home: 'home', basement: 'property', clothes_shop: 'clothes', barber_shop: 'shop', tattoo_studio: 'shop', pawn_shop: 'pawn', police_station: 'police', fight_club: 'gym', pub: 'pub', furniture_shop: 'shop', car_dealer: 'cars',
  bike_shop: 'bikes', casino: 'casino', grow_shop: 'shop', gym_store: 'shop', boxing_gym: 'gym', karate_dojo: 'gym', wrestling_club: 'gym',
  jeweller: 'shop', estate_agent: 'property', ashcombe: 'property', property: 'property',
};

const STATION_ACTIVITY: Record<string, string> = {
  bar: 'Food and drink', pool: 'Pool', storage: 'Stash', kitchen: 'Kitchen', sofa: 'Save and story', contacts: 'Phone and crew', tin: 'Biscuit tin',
  wardrobe: 'Wardrobe', garage: 'Workbench', gym: 'Coach’s board', computer: 'Computer', train: 'Home gym', sparring: 'Sparring', shop_counter: 'Shop',
  furniture: 'Furniture', cars: 'Cars', bikes: 'Bikes', casino: 'Gambling', grow: 'Basement kit', terminal: 'Business terminal', gym_counter: 'Gym kit',
  style_coach: 'Style lessons', style_drill: 'Drills', recruit: 'Hire fighters', pawn: 'Sell valuables',
  clothes_counter: 'Buy clothes, shoes and bags', changing: 'Try things on', barber_chair: 'Haircuts and beards', tattoo_chair: 'Tattoos', atm: 'Cashpoint', pawn_counter: 'Sell valuables and collectibles',
  furniture_counter: 'Buy furniture, floors and walls', car_counter: 'Buy and sell cars', bike_counter: 'Buy and sell bikes',
  casino_cashier: 'Chips and prizes', casino_slots: 'Slots', casino_roulette: 'Roulette', casino_blackjack: 'Blackjack',
  grow_counter: 'Buy basement equipment', grow_display: 'Look at the kit', mirror: 'Mirror', bike_rack: 'Bikes and cars',
  jeweller_counter: 'Buy and sell back jewellery', jeweller_case: 'Rings, watches, chains and grills', agent_desk: 'Buy, sell and let property',
  agent_window: 'Property for sale', prop_info: 'Property details', prop_rest: 'Rest',
};

export interface MapPlace {
  id: AreaId;
  name: string;
  district: string;
  kind: MarkerKind;
  /** Street (a road on the map) or a place you go into. */
  street: boolean;
  /** Where its marker sits. */
  at: Pt;
  blurb: string;
  activities: string[];
  people: string[];
}

export interface MapRoad {
  id: AreaId;
  pts: Pt[];
  tint: string;
  road: RoadLayout['road'];
  name: string;
  district: string;
}

export interface MapMarker {
  key: string;
  kind: MarkerKind;
  area: AreaId;
  at: Pt;
  label: string;
}

// ---- geometry -------------------------------------------------------------------------------------

const roadCache = new Map<AreaId, Pt[]>();

function lerp(a: Pt, b: Pt, t: number): Pt {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

/** Point along a polyline at fraction t (by length). */
export function along(pts: Pt[], t: number): Pt {
  const segs = pts.slice(1).map((p, i) => Math.hypot(p.x - pts[i].x, p.y - pts[i].y));
  const total = segs.reduce((a, b) => a + b, 0);
  let d = Math.max(0, Math.min(1, t)) * total;
  for (let i = 0; i < segs.length; i++) {
    if (d <= segs[i] || i === segs.length - 1) return lerp(pts[i], pts[i + 1], segs[i] ? Math.min(1, d / segs[i]) : 0);
    d -= segs[i];
  }
  return pts[pts.length - 1];
}

/** A street's x (in game metres) as a point on its road. */
export function streetPoint(area: AreaId, x: number): Pt | null {
  const pts = roadPoints(area);
  if (!pts) return null;
  const b = LEVELS[area].bounds;
  return along(pts, (x - b.minX) / Math.max(1, b.maxX - b.minX));
}

export function roadPoints(area: AreaId): Pt[] | null {
  const hit = roadCache.get(area);
  if (hit) return hit;
  const l = LAYOUT[area];
  if (!l) return null;
  const pts = l.pts;
  roadCache.set(area, pts);
  return pts;
}

/** The street a place's front door is on, and where. */
export function doorOf(area: AreaId): { street: AreaId; x: number } | null {
  if (area === 'basement') return doorOf('home');
  for (const id of AREA_IDS) {
    if (!LAYOUT[id]) continue;
    const ex = LEVELS[id].exits.find((e) => e.to === area && e.kind === 'door');
    if (ex) return { street: id, x: ex.x };
  }
  return null;
}

/** Marker spots never move: worked out once each (the cab meter and the map ask for them over and over). */
const placeCache = new Map<AreaId, Pt>();

/** Where an area's marker goes. */
export function placePoint(area: AreaId): Pt {
  let pt = placeCache.get(area);
  if (!pt) placeCache.set(area, (pt = placePointOf(area)));
  return pt;
}

function placePointOf(area: AreaId): Pt {
  if (LAYOUT[area]) {
    const b = LEVELS[area].bounds;
    return streetPoint(area, (b.minX + b.maxX) / 2)!;
  }
  const d = doorOf(area)!;
  const p = streetPoint(d.street, d.x)!;
  // Places sit just off the road, alternating sides along the street so neighbours don't overlap.
  const doors = LEVELS[d.street].exits.filter((e) => e.kind === 'door' && !LAYOUT[e.to] && e.to !== 'basement').sort((a, b) => a.x - b.x);
  const i = Math.max(0, doors.findIndex((e) => e.to === area));
  const b = LEVELS[d.street].bounds;
  const span = Math.max(1, b.maxX - b.minX);
  const a1 = streetPoint(d.street, Math.max(b.minX, d.x - span * 0.02))!;
  const a2 = streetPoint(d.street, Math.min(b.maxX, d.x + span * 0.02))!;
  const len = Math.hypot(a2.x - a1.x, a2.y - a1.y) || 1;
  let nx = -(a2.y - a1.y) / len;
  let ny = (a2.x - a1.x) / len;
  if (ny > 0) {
    nx = -nx;
    ny = -ny;
  }
  const side = i % 2 === 0 ? 1 : -1;
  return { x: p.x + nx * 40 * side, y: p.y + ny * 40 * side };
}

export function roads(): MapRoad[] {
  return AREA_IDS.filter((id) => LAYOUT[id]).map((id) => ({ id, pts: roadPoints(id)!, tint: LAYOUT[id]!.tint, road: LAYOUT[id]!.road, name: LEVELS[id].name, district: LEVELS[id].district }));
}

/** Junctions where two streets meet end to end (drawn as roundabouts). */
export function junctions(): Pt[] {
  const out: Pt[] = [];
  for (const r of roads()) {
    for (const ex of LEVELS[r.id].exits) {
      if (ex.kind !== 'edge' || !LAYOUT[ex.to]) continue;
      const p = streetPoint(r.id, ex.x);
      if (p && !out.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < 30)) out.push(p);
    }
  }
  return out;
}

// ---- places ---------------------------------------------------------------------------------------

export function place(id: AreaId): MapPlace {
  const lvl = LEVELS[id];
  const street = !!LAYOUT[id];
  const acts = new Set<string>();
  for (const s of lvl.stations ?? []) if (STATION_ACTIVITY[s.id]) acts.add(STATION_ACTIVITY[s.id]);
  const side = lvl.encounters.filter((e) => e.optional && !e.boss).length;
  if (side) acts.add(`${side} side fight${side > 1 ? 's' : ''}`);
  const secrets = lvl.pickups.filter((p) => p.kind === 'secret').length;
  if (secrets) acts.add(`${secrets} hidden stash${secrets > 1 ? 'es' : ''}`);
  if ((lvl.containers ?? []).length) acts.add('Things to search');
  if (lvl.levers?.length) acts.add('A shortcut to open');
  const boss = lvl.encounters.find((e) => e.boss);
  if (boss) acts.add('A boss fight');
  const people = new Set<string>();
  for (const s of lvl.stations ?? []) {
    if (!s.npc) continue;
    if (s.id === 'recruit') continue;
    people.add(s.npc.name);
  }
  if (id === 'pub') people.add(`${COMPANION_LIST.length} fighters for hire`);
  return {
    id,
    name: lvl.name,
    district: lvl.district,
    kind: INTERIOR_KIND[id] ?? 'street',
    street,
    at: placePoint(id),
    blurb: blurbOf(id),
    activities: [...acts],
    people: [...people],
  };
}

export function places(): MapPlace[] {
  return AREA_IDS.map(place);
}

// ---- unlocks and routes ----------------------------------------------------------------------------

/** Plain-English requirement for a flag, from the game's own bosses and quest items. */
export function requirementText(flag: string): string {
  const boss = Object.values(BOSSES).find((b) => b.flag === flag);
  if (boss) return `Beat ${boss.name} (${boss.title}) first`;
  const item = Object.values(ITEMS).find((d) => d.questFlag === flag);
  if (item) return `Needs the ${item.name.toLowerCase()}`;
  if (flag === 'shortcut_subway') return 'Open the gate from the subway side first';
  return 'Not open yet';
}

function exitOpen(p: Progress, ex: ExitDef): boolean {
  if (ex.requires && !p.has(ex.requires)) return false;
  if (ex.requiresAll && !ex.requiresAll.every((f) => p.has(f))) return false;
  if (ex.shop && !p.isShopOpen(ex.shop)) return false;
  return true;
}

function exitBlock(p: Progress, ex: ExitDef): string {
  if (ex.shop && !p.isShopOpen(ex.shop)) return 'Shutters down after the robbery';
  if (ex.requires && !p.has(ex.requires)) return requirementText(ex.requires);
  // Several things needed: the level's own line says it best.
  if (ex.requiresAll?.some((x) => !p.has(x))) return ex.lockedText ?? requirementText(ex.requiresAll.find((x) => !p.has(x))!);
  return ex.lockedText ?? 'Not open yet';
}

/** Links between areas you can actually walk (or go through a door) between. Interior back doors home don't count. */
function links(lvl: LevelDef): ExitDef[] {
  return lvl.exits.filter((e) => !(e.to === 'home' && lvl.id !== 'basement' && lvl.id !== 'estate'));
}

/** Breadth-first search from `from`. With `p`, locked links are skipped. */
function search(from: AreaId, p: Progress | null): Map<AreaId, { prev: AreaId | null; exit: ExitDef | null }> {
  const seen = new Map<AreaId, { prev: AreaId | null; exit: ExitDef | null }>([[from, { prev: null, exit: null }]]);
  const q: AreaId[] = [from];
  while (q.length) {
    const a = q.shift()!;
    for (const ex of links(LEVELS[a])) {
      if (seen.has(ex.to)) continue;
      if (p && !exitOpen(p, ex)) continue;
      seen.set(ex.to, { prev: a, exit: ex });
      q.push(ex.to);
    }
  }
  return seen;
}

/** Is the place open to you yet (reachable from home without anything locked)? */
export function unlocked(p: Progress, id: AreaId): boolean {
  return search('home', p).has(id);
}

/** How hard a locked link is to open, for picking the lock to tell you about: story bosses first, in order. */
function lockCost(p: Progress, ex: ExitDef): number {
  if (exitOpen(p, ex)) return 0;
  const f = ex.requires ?? ex.requiresAll?.find((x) => !p.has(x));
  const i = f ? DISTRICT_ORDER.findIndex((d) => d.flag === f) : -1;
  if (i >= 0) return 1 + i * 0.01;
  if (f && Object.values(ITEMS).some((d) => d.questFlag === f)) return 2;
  return 6; // gates opened from the far side, closed shops
}

/** Why a place isn't open yet: the first lock on the easiest way there. */
export function lockReason(p: Progress, id: AreaId): string | null {
  if (unlocked(p, id)) return null;
  const dist = new Map<AreaId, number>([['home', 0]]);
  const via = new Map<AreaId, { prev: AreaId; exit: ExitDef }>();
  const open = new Set<AreaId>(['home']);
  while (open.size) {
    let a: AreaId | null = null;
    for (const x of open) if (a === null || dist.get(x)! < dist.get(a)!) a = x;
    open.delete(a!);
    for (const ex of links(LEVELS[a!])) {
      const d = dist.get(a!)! + lockCost(p, ex) + 0.001;
      if (d < (dist.get(ex.to) ?? Infinity)) {
        dist.set(ex.to, d);
        via.set(ex.to, { prev: a!, exit: ex });
        open.add(ex.to);
      }
    }
  }
  const path: ExitDef[] = [];
  let cur: AreaId = id;
  while (via.has(cur)) {
    path.unshift(via.get(cur)!.exit);
    cur = via.get(cur)!.prev;
  }
  for (const ex of path) if (!exitOpen(p, ex)) return exitBlock(p, ex);
  return 'Not open yet';
}

/** Areas to walk through from here to there (excluding here), or null if you can't get there. */
export function route(p: Progress, from: AreaId, to: AreaId): AreaId[] | null {
  const seen = search(from, p);
  if (!seen.has(to)) return null;
  const out: AreaId[] = [];
  let cur: AreaId | null = to;
  while (cur && cur !== from) {
    out.unshift(cur);
    cur = seen.get(cur)!.prev;
  }
  return out;
}

/** The exit to take in `from` for the next step towards `to`. */
export function nextExit(p: Progress, from: AreaId, to: AreaId): ExitDef | null {
  const r = route(p, from, to);
  if (!r || !r.length) return null;
  return links(LEVELS[from]).find((e) => e.to === r[0] && exitOpen(p, e)) ?? null;
}

// ---- cabs ----------------------------------------------------------------------------------------

export interface TravelOption {
  kind: 'cab' | 'drive' | 'home' | 'walk' | 'here';
  label: string;
  cost: number;
  /** A cab's distance in miles, for the meter. */
  miles?: number;
  entry?: string;
  /** On foot: the chance of being jumped somewhere on the way (travel/onFoot.ts). */
  risk?: number;
  /** Driving: where the car will be left (null: back on the drive at home). */
  park?: ParkingSpot | null;
  ok: boolean;
  why?: string;
}

/**
 * Your own car: free, no fights on the way, and it's left parked at the other end (property/parking.ts). You drive
 * it from where it is: on the drive at home, or wherever you last left it.
 */
export function driveOption(p: Progress, here: AreaId, to: AreaId, calm: boolean): TravelOption | null {
  const prop = p.save.property;
  const car = prop.cars.find((c) => c.uid === prop.activeCar);
  if (!car) return null;
  const def = CARS[car.id];
  const out = prop.carOut && prop.carOut.uid === car.uid ? prop.carOut : null;
  const carHere = out ? out.area === here : DRIVE_HOME.has(here);
  const label = `Drive the ${def.name}: free`;
  if (!carHere) return { kind: 'drive', label, cost: 0, ok: false, why: out ? `Your car’s parked in ${LEVELS[out.area].district}` : 'Your car’s on the drive at home' };
  if (!calm) return { kind: 'drive', label, cost: 0, ok: false, why: 'Not with a fight on' };
  if (!unlocked(p, to)) return { kind: 'drive', label, cost: 0, ok: false, why: lockReason(p, to) ?? 'Not yet' };
  if (DRIVE_HOME.has(to)) return { kind: 'drive', label, cost: 0, ok: true, park: null };
  const stop = cabStop(to);
  const park = stop ? parkingSpot(to, car.id, stop.entry) : null;
  if (!stop || !park) return { kind: 'drive', label, cost: 0, ok: false, why: 'Nowhere to park there' };
  const shut = SHOP_STOPS.find((x) => x.area === to && x.shop && !p.isShopOpen(x.shop));
  if (shut) return { kind: 'drive', label, cost: 0, ok: false, why: 'Shutters down after the robbery' };
  return { kind: 'drive', label, cost: 0, entry: stop.entry, park, ok: true };
}

/** Can a cab drop you there? (Duber go to the stops the phone lists.) */
export function cabStop(id: AreaId): { entry: string } | null {
  const s = SHOP_STOPS.find((x) => x.area === id) ?? TAXI_STOPS.find((x) => x.area === id);
  return s ? { entry: s.entry } : null;
}

/** Map units to a mile: the town is about five miles end to end. */
export const MAP_PER_MILE = 440;
/** Roads wind: a cab goes about 1.3 times the straight-line distance, the usual ratio for a British town. */
export const ROAD_FACTOR = 1.3;

/** Where you are on the map: your spot on the street if you're on one, else the place's marker. */
function startPoint(area: AreaId, x?: number): Pt {
  if (area === 'basement') area = 'home';
  return (x !== undefined && LAYOUT[area] && streetPoint(area, x)) || placePoint(area);
}

/** How far a cab drives you, in miles (to a tenth), from where you stand to the stop. */
export function cabMiles(from: AreaId, to: AreaId, x?: number): number {
  const a = startPoint(from, x);
  const b = placePoint(to === 'basement' ? 'home' : to);
  return Math.round((Math.hypot(b.x - a.x, b.y - a.y) / MAP_PER_MILE) * ROAD_FACTOR * 10) / 10;
}

/** The fare on the meter for that many miles: flag fall plus the mileage, rounded to the pound, never under the minimum. */
export function cabFare(miles: number): number {
  return Math.max(CAB_MIN, Math.round(CAB_FLAG + CAB_PER_MILE * miles));
}

/**
 * How you can get somewhere from where you are now. `x` is where you stand on the street, for the cab's meter.
 * `calm` is false in a fight, with the police on you, or while knocked down.
 */
export function travelOptions(p: Progress, here: AreaId, to: AreaId, calm: boolean, x?: number): TravelOption[] {
  if (to === here || (to === 'basement' && here === 'home')) return [{ kind: 'here', label: 'You are here', cost: 0, ok: false }];
  const open = unlocked(p, to);
  const lock = open ? null : lockReason(p, to);
  const out: TravelOption[] = [];
  const busy = calm ? undefined : 'Not with a fight on';
  if (to === 'home' || to === 'basement') out.push({ kind: 'home', label: 'Head home', cost: 0, ok: calm, why: busy });
  const drive = driveOption(p, here, to, calm);
  if (drive) out.push(drive);
  const stop = cabStop(to);
  if (stop) {
    const shut = SHOP_STOPS.find((x) => x.area === to && x.shop && !p.isShopOpen(x.shop));
    const miles = cabMiles(here, to, x);
    const fare = cabFare(miles);
    const ok = open && calm && !shut && p.save.cash.bank >= fare;
    const why = !open ? lock! : shut ? 'Shutters down after the robbery' : busy ?? (p.save.cash.bank < fare ? `Need £${fare} in the tin` : undefined);
    out.push({ kind: 'cab', label: `Duber: ${miles.toFixed(1)} miles, £${fare} from the tin`, cost: fare, miles, entry: stop.entry, ok, why });
  }
  const r = route(p, here, to);
  // On foot: free, along the streets, with a small chance of trouble on each one crossed (travel/onFoot.ts).
  // Rolled on each street crossed on the way (not where you start, and you stop as you reach the last).
  const risk = r ? journeyRisk(p, r.slice(0, -1)) : 0;
  out.push({ kind: 'walk', label: r ? `Walk: ${r.length} stop${r.length > 1 ? 's' : ''} away, free, ${riskWord(risk)}` : 'Walk', cost: 0, risk, ok: !!r, why: r ? undefined : lock ?? 'No way through from here yet' });
  return out;
}

// ---- markers ---------------------------------------------------------------------------------------

/** The story: the next main boss, side bosses, and the ones you've beaten. */
export function bossMarkers(p: Progress): MapMarker[] {
  const next = DISTRICT_ORDER.find((d) => !d.optional && !p.has(d.flag));
  const out: MapMarker[] = [];
  for (const d of DISTRICT_ORDER) {
    const boss = Object.values(BOSSES).find((b) => b.flag === d.flag);
    const enc = LEVELS[d.area].encounters.find((e) => e.boss);
    const at = streetPoint(d.area, enc?.triggerX ?? (LEVELS[d.area].bounds.maxX * 0.8)) ?? placePoint(d.area);
    const done = p.has(d.flag);
    const kind: MarkerKind = done ? 'boss' : d === next ? 'mission' : d.optional ? 'side' : 'boss';
    if (!done && kind === 'boss') continue; // future main bosses stay a surprise
    out.push({ key: `boss:${d.flag}`, kind, area: d.area, at: { x: at.x, y: at.y + 30 }, label: done ? `${boss?.name ?? 'Boss'}: beaten` : `${boss?.name ?? 'Boss'}: ${d.label}` });
  }
  return out;
}

export function markers(p: Progress): MapMarker[] {
  const out: MapMarker[] = [];
  for (const pl of places()) {
    if (pl.street) out.push({ key: `street:${pl.id}`, kind: 'street', area: pl.id, at: pl.at, label: pl.name });
    else if (pl.id !== 'basement' && pl.id !== 'property') out.push({ key: `place:${pl.id}`, kind: pl.kind, area: pl.id, at: pl.at, label: pl.name });
  }
  // Every property you own, at its front door.
  for (const hd of p.save.portfolio?.holdings ?? []) {
    const d = PROPERTIES[hd.id];
    const at = d ? (LAYOUT[d.area] ? streetPoint(d.area, d.x) : placePoint(d.area)) : null;
    if (!d || !at) continue;
    const st = statusOf(hd);
    out.push({ key: `own:${d.id}`, kind: 'property', area: d.area, at: { x: at.x, y: at.y - 24 }, label: `Yours: ${d.name} (${st === 'personal' ? 'lived in' : st === 'vacant' ? 'empty, to let' : `let to ${hd.tenant?.name ?? 'tenants'}`})` });
  }
  // The Firm's fighters for hire, next to the pub.
  const pub = placePoint('pub');
  out.push({ key: 'contact:snug', kind: 'contact', area: 'pub', at: { x: pub.x + 30, y: pub.y - 26 }, label: 'The Firm: fighters for hire' });
  // Contacts with work going (src/jobs), and where the job you're on takes you next.
  for (const id of CONTACT_IDS) {
    const c = CONTACTS[id];
    if (!contactOpen(p, id)) continue;
    const st = (LEVELS[c.area].stations ?? []).find((x) => x.id === 'contact' && x.tab === id);
    const at = LAYOUT[c.area] && st ? streetPoint(c.area, st.x) : placePoint(c.area);
    if (at) out.push({ key: `job:${id}`, kind: 'contact', area: c.area, at: { x: at.x - 18, y: at.y - 24 }, label: `${c.name}, ${c.role.toLowerCase()}: jobs` });
  }
  const job = p.save.jobs?.active;
  if (job) {
    const back = job.stage === 'back' && job.from !== 'street';
    const area = back ? CONTACTS[job.from as ContactId].area : job.area;
    const at = !back && LAYOUT[area] ? streetPoint(area, job.x) : LAYOUT[area] ? streetPoint(area, (LEVELS[area].stations ?? []).find((x) => x.id === 'contact' && x.tab === job.from)?.x ?? LEVELS[area].bounds.maxX / 2) : placePoint(area);
    if (at) out.push({ key: 'job:active', kind: 'side', area, at: { x: at.x, y: at.y + 22 }, label: `Job: ${objectiveOf(job)}` });
  }
  if (p.save.basement && p.save.basement.equipment?.length) {
    const h = placePoint('home');
    out.push({ key: 'place:basement', kind: 'property', area: 'basement', at: { x: h.x + 30, y: h.y - 22 }, label: 'Your basement business' });
  }
  const car = p.save.property.carOut;
  if (car && LAYOUT[car.area]) {
    const at = streetPoint(car.area, car.x);
    const def = CARS[p.save.property.cars.find((c) => c.uid === car.uid)?.id ?? ''];
    if (at) out.push({ key: 'parked:car', kind: 'parked', area: car.area, at: { x: at.x + 14, y: at.y + 26 }, label: `Where you left your ${def?.name ?? 'car'}` });
  }
  const bike = p.save.property.bikeOut;
  if (bike && !p.save.property.riding && LAYOUT[bike.area as AreaId]) {
    const at = streetPoint(bike.area as AreaId, bike.x);
    if (at) out.push({ key: 'parked', kind: 'parked', area: bike.area as AreaId, at: { x: at.x, y: at.y + 26 }, label: 'Where you left your bike' });
  }
  out.push(...bossMarkers(p));
  out.push(...serviceMarkers(p));
  return out;
}

/**
 * The cash machines (money/atm.ts: four in town, out of service till Sully's beaten), the car mod shop (Arnold
 * Shark's Mods tab) and the Estate King's lock-up, with what state each is in.
 */
export function serviceMarkers(p: Progress): MapMarker[] {
  const out: MapMarker[] = [];
  const open = atmOpen(p);
  for (const id of AREA_IDS) {
    const lvl = LEVELS[id];
    if (!lvl || !LAYOUT[id]) continue;
    for (const pr of lvl.props) {
      if (pr.kind !== 'atm') continue;
      const at = streetPoint(id, pr.x);
      if (!at) continue;
      const bank = bankOf(pr.label);
      out.push({ key: `atm:${id}:${pr.x}`, kind: 'atm', area: id, at: { x: at.x + 16, y: at.y - 30 }, label: open ? `${bank.name} cash machine` : `${bank.name} cash machine (out of service till Sully’s beaten)` });
    }
    for (const c of lvl.containers ?? []) {
      if (c.id !== LOCKUP_ID) continue;
      const at = streetPoint(id, c.x);
      if (!at) continue;
      const emptied = p.has(`searched:${id}:${c.id}`);
      const key = !!c.requires && p.has(c.requires);
      const state = emptied ? 'emptied' : key ? 'you’ve got the key' : 'padlocked: the Estate King has the key';
      out.push({ key: `lockup:${id}`, kind: 'lockup', area: id, at: { x: at.x - 16, y: at.y - 30 }, label: `The lock-up (${state})` });
    }
  }
  const dealer = placePoint('car_dealer');
  out.push({ key: 'mods:car_dealer', kind: 'mods', area: 'car_dealer', at: { x: dealer.x + 30, y: dealer.y - 24 }, label: 'Arnold Shark: car mods' });
  return out;
}

/** The district an area belongs to, as the map names it. */
export function districtOf(id: AreaId): string {
  return place(id).district;
}

/**
 * Each district as an area of the map: the roads in it (for its shaded band), where its name goes, whether you
 * can get there yet, and if not, what opens it. Built from the same roads the routes use, so a district is drawn
 * exactly where its streets are and nowhere else.
 */
export interface MapDistrict {
  name: string;
  roads: Pt[][];
  label: Pt;
  open: boolean;
  why: string | null;
  areas: AreaId[];
}
export function districts(p: Progress): MapDistrict[] {
  const by = new Map<string, MapDistrict>();
  for (const r of roads()) {
    const d = by.get(r.district) ?? { name: r.district, roads: [], label: { x: 0, y: 0 }, open: false, why: null, areas: [] };
    d.roads.push(r.pts);
    d.areas.push(r.id);
    by.set(r.district, d);
  }
  for (const d of by.values()) {
    const mids = d.roads.map((r) => along(r, 0.5));
    const minY = Math.min(...d.roads.flat().map((q) => q.y));
    d.label = { x: mids.reduce((n, q) => n + q.x, 0) / mids.length, y: minY - 70 };
    d.open = d.areas.some((a) => unlocked(p, a));
    d.why = d.open ? null : lockReason(p, d.areas[0]);
  }
  return [...by.values()];
}

/**
 * Where district meets district along the road: the points where one district's roads end and the next one's
 * begin, so the map can mark the boundary (and only where the streets really connect).
 */
export function districtBorders(): { at: Pt; ang: number; from: string; to: string }[] {
  const rs = roads();
  const out: { at: Pt; ang: number; from: string; to: string }[] = [];
  for (const a of rs) {
    for (const b of rs) {
      if (a === b || a.district === b.district) continue;
      const end = a.pts[a.pts.length - 1];
      const start = b.pts[0];
      if (Math.hypot(end.x - start.x, end.y - start.y) > 2) continue;
      const prev = a.pts[a.pts.length - 2] ?? end;
      out.push({ at: end, ang: Math.atan2(end.y - prev.y, end.x - prev.x), from: a.district, to: b.district });
    }
  }
  return out;
}

/** Where you are on the map. */
export function playerPoint(area: AreaId, x: number): Pt {
  if (LAYOUT[area]) return streetPoint(area, x)!;
  return placePoint(area);
}

/** Every area must be on the map: true when it is. */
export function onMap(id: AreaId): boolean {
  return !!LAYOUT[id] || !!doorOf(id);
}

export function blurb(id: AreaId): string {
  return blurbOf(id);
}
