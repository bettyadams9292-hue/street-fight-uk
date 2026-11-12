import { BOSSES, type BossDef, type BossPhase } from '../ai/bosses';
import type { ArchetypeId } from '../ai/archetypes';
import { registerDistrict, type District, type GroundKind } from '../city/street';
import type { WeaponId } from '../combat/Weapons';
import { Rng } from '../core/Rng';
import type { StyleId } from '../styles/StyleData';
import type { EncounterDef, FacadeDef, FacadeKind, LevelDef, LightDef, PropDef, PropKind, Theme } from './LevelTypes';
import { PROP_SIZE } from './LevelTypes';
import { DISTRICTS_PER_TOWN, TOWN_COUNT, townAreaId, townBossFlag, townBossId, type TownAreaId } from './townIds';

/**
 * The towns east of Hale House.
 *
 * Once Hale is beaten the street carries on. Each town is four districts,
 * generated from a fixed seed, so it is the same town every time you come
 * back and for every save: nothing about its layout needs storing. What you
 * do there (fights won, things found, the boss beaten) is saved the same way
 * as everywhere else, keyed by the district's id.
 *
 * A town is not a recolour of the last one. Each has its own kinds of street,
 * its own building stock, paving, lamps, weather and light, its own crowd of
 * enemies, and a boss with a fighting style and tricks of their own. Enemies
 * get a level stronger with every town (LevelDef.threat), and you only get
 * into a town by beating the boss of the one before it.
 */

/** One seed for the whole generated world. Changing it changes every town, so it never changes. */
const WORLD_SEED = 0x57f1c7;
const STREET = { minZ: -2, maxZ: 2 };

/** What a stretch of street is for. Each lays out its frontage, furniture and fights differently. */
type StreetKind = 'terraces' | 'high' | 'works' | 'quay' | 'plaza' | 'suburb' | 'towers' | 'strip' | 'civic';

interface Frontage {
  kind: FacadeKind;
  /** Narrowest and widest this kind of frontage is built, metres. */
  w: [number, number];
  /** Kinds of shop name it can carry; none means an unnamed building. */
  shops?: ShopKind[];
  weight: number;
}

type ShopKind = 'pub' | 'takeaway' | 'cafe' | 'bookies' | 'gadgets' | 'clothes' | 'furniture' | 'pawn' | 'offlicence' | 'bikes' | 'cars' | 'plants' | 'salon' | 'office' | 'gym' | 'club' | 'general';

interface StreetRecipe {
  ground: GroundKind;
  theme: Theme;
  frontage: Frontage[];
  /** Furniture along the foot of the buildings, most wanted first. */
  back: PropKind[];
  /** Things out by the road or the open side. */
  front: PropKind[];
  /** Metres between pieces of furniture, roughly. */
  spacing: number;
  nouns: string[];
}

const RECIPES: Record<StreetKind, StreetRecipe> = {
  terraces: {
    ground: 'street', theme: 'estate',
    frontage: [{ kind: 'terrace', w: [12, 20], weight: 5 }, { kind: 'shop', w: [9, 12], shops: ['offlicence', 'takeaway', 'general'], weight: 2 }, { kind: 'fence', w: [6, 9], weight: 1 }, { kind: 'pub', w: [9, 11], shops: ['pub'], weight: 1 }],
    back: ['bin', 'bin', 'bench', 'phonebox', 'bike_rack'], front: ['car', 'car', 'van', 'abandoned_car'], spacing: 9, nouns: ['Terrace', 'Row', 'Street', 'Road'],
  },
  high: {
    ground: 'street', theme: 'high_street',
    frontage: [
      { kind: 'shop', w: [8, 10], shops: ['takeaway', 'bookies', 'gadgets', 'clothes', 'furniture', 'pawn', 'offlicence', 'salon', 'general', 'cafe', 'plants'], weight: 7 },
      { kind: 'pub', w: [9, 11], shops: ['pub'], weight: 2 }, { kind: 'office', w: [9, 12], shops: ['office'], weight: 1 }, { kind: 'showroom', w: [9, 11], shops: ['bikes', 'cars'], weight: 1 },
    ],
    back: ['bench', 'bin', 'phonebox', 'planter', 'bike_rack', 'busstop', 'vending'], front: ['car', 'van', 'car', 'bus'], spacing: 8, nouns: ['High Street', 'Parade', 'Market Street', 'Broadway'],
  },
  works: {
    ground: 'yard', theme: 'industrial',
    frontage: [{ kind: 'warehouse', w: [12, 24], weight: 5 }, { kind: 'fence', w: [8, 14], weight: 2 }, { kind: 'hoarding', w: [8, 12], weight: 1 }, { kind: 'gym_front', w: [9, 11], shops: ['gym'], weight: 1 }],
    back: ['skip', 'pallets', 'drum', 'crates', 'dumpster', 'drum'], front: ['van', 'pallets', 'barrier', 'forklift', 'crates'], spacing: 8, nouns: ['Works', 'Yard', 'Sidings', 'Foundry Lane'],
  },
  quay: {
    ground: 'quay', theme: 'docks',
    frontage: [{ kind: 'dock', w: [12, 22], weight: 5 }, { kind: 'warehouse', w: [12, 16], weight: 2 }, { kind: 'pub', w: [9, 11], shops: ['pub'], weight: 1 }, { kind: 'fence', w: [6, 10], weight: 1 }],
    back: ['crates', 'drum', 'pallets', 'bin', 'bench'], front: ['bollard_dock', 'bollard_dock', 'crates', 'bollard_dock'], spacing: 9, nouns: ['Quay', 'Wharf', 'Harbour', 'Landing'],
  },
  plaza: {
    ground: 'plaza', theme: 'precinct',
    frontage: [
      { kind: 'precinct', w: [8, 10], shops: ['clothes', 'gadgets', 'takeaway', 'salon', 'bookies', 'cafe', 'furniture', 'general'], weight: 6 },
      { kind: 'mall', w: [14, 18], weight: 2 }, { kind: 'office', w: [9, 12], shops: ['office'], weight: 1 },
    ],
    back: ['bench', 'bin', 'planter', 'atm', 'vending'], front: ['mall_planter', 'kiosk', 'fountain', 'mall_planter', 'bench'], spacing: 9, nouns: ['Square', 'Precinct', 'Arcade', 'Centre'],
  },
  suburb: {
    ground: 'suburb', theme: 'residential',
    frontage: [{ kind: 'semi', w: [10, 14], weight: 6 }, { kind: 'fence', w: [6, 10], weight: 2 }, { kind: 'leisure', w: [18, 22], weight: 1 }, { kind: 'shop', w: [8, 10], shops: ['cafe', 'plants', 'general'], weight: 1 }],
    back: ['bin', 'bench', 'sign_post', 'bin'], front: ['car', 'car', 'van'], spacing: 11, nouns: ['Avenue', 'Gardens', 'Close', 'Drive'],
  },
  towers: {
    ground: 'street', theme: 'residential',
    frontage: [{ kind: 'tower', w: [14, 18], weight: 5 }, { kind: 'garages', w: [8, 16], weight: 2 }, { kind: 'fence', w: [6, 10], weight: 1 }, { kind: 'shop', w: [8, 10], shops: ['offlicence', 'takeaway', 'bookies'], weight: 1 }],
    back: ['bin', 'dumpster', 'bench', 'bike_rack', 'rubbish_bags'], front: ['car', 'abandoned_car', 'car', 'barrier'], spacing: 9, nouns: ['Estate', 'Court', 'Heights', 'Flats'],
  },
  strip: {
    ground: 'street', theme: 'nightlife',
    frontage: [{ kind: 'club', w: [9, 12], shops: ['club'], weight: 4 }, { kind: 'shop', w: [8, 10], shops: ['takeaway', 'offlicence', 'bookies'], weight: 3 }, { kind: 'pub', w: [9, 11], shops: ['pub'], weight: 2 }, { kind: 'casino', w: [14, 16], weight: 1 }],
    back: ['barrier', 'bin', 'phonebox', 'vending'], front: ['car', 'car', 'van'], spacing: 9, nouns: ['Mile', 'Strip', 'Lanes', 'Quarter'],
  },
  civic: {
    ground: 'plaza', theme: 'hq',
    frontage: [{ kind: 'fortress', w: [14, 22], weight: 4 }, { kind: 'office', w: [9, 12], shops: ['office'], weight: 3 }, { kind: 'office', w: [10, 18], weight: 2 }],
    back: ['planter', 'bench', 'bollard', 'bin'], front: ['mall_planter', 'bollard_row', 'fountain', 'car'], spacing: 10, nouns: ['Plaza', 'Exchange', 'Gate', 'Tower'],
  },
};

const SHOP_NAMES: Record<ShopKind, string[]> = {
  pub: ['THE {S} ARMS', 'THE {A} LION', 'THE {S} TAVERN', '{S}’S BAR', 'THE {A} CASTLE'],
  takeaway: ['{S}’S CHIPPY', '{A} KEBAB HOUSE', '{S} FRIED CHICKEN', '{A} BAKERY', '{S}’S FOOD COURT'],
  cafe: ['{S}’S CAFE', '{A} COFFEE', 'CAFE {S}'],
  bookies: ['{S} BOOKMAKERS', '{A} BOOKIES'],
  gadgets: ['{S} PHONE & VAPE', '{A} TECH ZONE', '{S} PHONE REPAIRS'],
  clothes: ['{S} FASHION', '{A} THREADS', '{S} SPORTS'],
  furniture: ['{S} FURNITURE', '{A} HEARTH & HOME', '{S} CARPET & FURNITURE'],
  pawn: ['{S} PAWN & GOLD', '{A} JEWELLERS'],
  offlicence: ['{S} OFF LICENCE', '{A} BOOZE'],
  bikes: ['{S} MOTO'],
  cars: ['{S} MOTORS'],
  plants: ['{S} GARDEN CENTRE', '{A} GREEN FINGERS'],
  salon: ['{S} HAIR & BEAUTY', '{A} NAILS'],
  office: ['{S} HOUSE', '{S} & {S2} SOLICITORS'],
  gym: ['{S}’S BOXING GYM', '{A} GYM'],
  club: ['{N}', 'CLUB {N}'],
  general: ['{A} POUND SHOP', '{S}’S STORES', '{S} HARDWARE'],
};
const SURNAMES = ['HARGREAVES', 'OKAFOR', 'PATEL', 'MCALLISTER', 'DOYLE', 'WHITTAKER', 'NOWAK', 'SINGH', 'BARLOW', 'FENWICK', 'ROSSI', 'ARMITAGE', 'KHAN', 'TREVOR', 'ODELL', 'PRITCHARD', 'LOMAX', 'YATES', 'GREAVES', 'MARLOWE', 'DUNNE', 'HOLROYD', 'ASHCROFT', 'BELL'];
const ADJECTIVES = ['GOLDEN', 'ROYAL', 'CROWN', 'STAR', 'CITY', 'CORNER', 'STATION', 'BRIDGE', 'HARBOUR', 'NORTHERN', 'SILVER', 'RED', 'WHITE', 'OLD', 'NEW', 'LUCKY'];
const CLUB_NAMES = ['MIRAGE', 'VOLT', 'HALO', 'EMBER', 'PRISM', 'ONYX', 'ECHO', 'NOVA', 'RUBY', 'TEMPO'];

interface BossSeed {
  name: string;
  title: string;
  intro: string;
  defeat: string;
  style: StyleId;
  second: StyleId;
  /** Which attributes this boss leans on: strength, speed, endurance, agility, defence, technique. */
  lean: [number, number, number, number, number, number];
  body: 'male' | 'female';
  colour: string;
  phases: { name: string; line: string; kind: 'summon' | 'swap' | 'weapon' | 'rage' | 'guard' | 'rush' }[];
  weapon?: WeaponId;
}

interface TownSeed {
  name: string;
  /** How its districts are named, e.g. "Saltmere Quay". */
  streets: [StreetKind, StreetKind, StreetKind, StreetKind];
  weather: NonNullable<LevelDef['weather']>;
  lamp: string;
  light: number;
  tints: string[];
  skyline: District['skyline'];
  trees: boolean;
  pavement?: string;
  shell?: string;
  solid: Partial<Record<FacadeKind, string[]>>;
  /** Who you fight here, weakest first. */
  enemies: ArchetypeId[];
  weapons: WeaponId[];
  boss: BossSeed;
}

/** The six towns, in the order you reach them. */
const TOWNS: TownSeed[] = [
  {
    name: 'Saltmere', streets: ['suburb', 'high', 'quay', 'strip'], weather: 'clear', lamp: 'nyc/prop-globe-lamp', light: 0xffe2b0,
    tints: ['#fff4e2', '#f6dcd0', '#dcecf0', '#f2ecc8', '#e2f0dc'], skyline: 'none', trees: true, pavement: 'cars/sidewalk-tile',
    solid: { semi: ['hood/porch-front-cottage', 'hood/single-storey-ranch-house', 'hood/porch-front-cottage', 'hood/split-level-house'], dock: ['nyc/bldg-auto-garage', 'nyc/bldg-firehouse', 'nyc/bldg-diner'], warehouse: ['nyc/bldg-auto-garage', 'nyc/bldg-firehouse'], leisure: ['hood/park-picnic-shelter', 'nyc/bldg-diner'] },
    enemies: ['hooded', 'casual', 'brawler', 'boxer', 'knifeman', 'bouncer'], weapons: ['bottle', 'pool_cue'],
    boss: {
      name: 'Morwenna Pike', title: 'The Harbourmaster', intro: 'Nothing lands in Saltmere without my say. Not fish, not cargo, not you.', defeat: 'Tide’s gone out on me. Take the harbour.',
      style: 'wrestling', second: 'boxing', lean: [3, 0, 3, 0, 2, 1], body: 'female', colour: '#1d4a5a',
      phases: [{ name: 'Deckhands', line: 'Two deckhands come up off the boats.', kind: 'summon' }, { name: 'Gloves off', line: 'Pike stops grappling and starts boxing.', kind: 'swap' }, { name: 'Boat hook', line: 'Pike pulls a pole off the harbour wall.', kind: 'weapon' }],
      weapon: 'pole',
    },
  },
  {
    name: 'Ashby Moor', streets: ['terraces', 'works', 'high', 'towers'], weather: 'rain', lamp: 'nyc/prop-street-lamp', light: 0xffb070,
    tints: ['#c9a08a', '#b88a74', '#a8826e', '#d2b49c', '#9c7a68'], skyline: 'low', trees: false,
    solid: { terrace: ['nyc/bldg-brownstone', 'nyc/bldg-walkup-infill'], warehouse: ['nyc/bldg-loft-warehouse', 'nyc/bldg-brick-church'], tower: ['nyc/bldg-prewar-apartment', 'nyc/bldg-tenement'], garages: ['hood/detached-garage'], shop: ['nyc/bldg-corner-shop', 'nyc/bldg-walkup-infill'], pub: ['nyc/bldg-brownstone', 'nyc/bldg-corner-shop'] },
    enemies: ['tooled', 'casual', 'docker', 'grappler', 'kickboxer', 'bruiser'], weapons: ['wrench', 'hammer', 'pipe'],
    boss: {
      name: 'Silas Crowther', title: 'The Millowner', intro: 'My grandfather built this town. I’m just collecting the rent on it.', defeat: 'Mill’s yours. See how you like running it.',
      style: 'boxing', second: 'kickboxing', lean: [2, 2, 2, 1, 2, 2], body: 'male', colour: '#3a2a22',
      phases: [{ name: 'Foremen', line: 'Crowther whistles and his foremen come running.', kind: 'summon' }, { name: 'Shirt sleeves', line: 'Crowther rolls his sleeves up and starts kicking.', kind: 'swap' }, { name: 'Seeing red', line: 'Crowther stops defending altogether.', kind: 'rage' }],
    },
  },
  {
    name: 'Northgate', streets: ['towers', 'plaza', 'high', 'civic'], weather: 'mist', lamp: 'hood/cobra-head-street-light', light: 0xe6f0ff,
    tints: ['#dfe4e6', '#c8d0d4', '#eceff0', '#b8c2c8', '#d6dcd8'], skyline: 'city', trees: true, shell: 'cafe/corner-restaurant-unit',
    solid: { tower: ['nyc/bldg-postwar-apartment', 'nyc/bldg-postwar-apartment', 'nyc/bldg-public-school'], mall: ['nyc/bldg-department-store', 'nyc/bldg-parking-garage'], fortress: ['nyc/bldg-setback-tower', 'nyc/bldg-office-tower', 'nyc/bldg-public-school'], office: ['nyc/bldg-office-tower', 'nyc/bldg-postwar-apartment'], garages: ['nyc/bldg-parking-garage'] },
    enemies: ['security', 'runner', 'boxer', 'bouncer', 'elite', 'defender'], weapons: ['torch', 'baseball_bat'],
    boss: {
      name: 'Dr Imogen Vale', title: 'The Planner', intro: 'Every street here was drawn on my desk. You are not on the drawing.', defeat: 'Then redraw it yourself.',
      style: 'karate', second: 'bjj', lean: [0, 3, 1, 3, 1, 3], body: 'female', colour: '#e8e8ec',
      phases: [{ name: 'Tightened guard', line: 'Vale stops giving you openings.', kind: 'guard' }, { name: 'Security detail', line: 'Vale’s security detail steps in.', kind: 'summon' }, { name: 'On the floor', line: 'Vale takes it to the ground.', kind: 'swap' }],
    },
  },
  {
    name: 'Kingsbarrow', streets: ['suburb', 'high', 'plaza', 'civic'], weather: 'clear', lamp: 'nyc/prop-globe-lamp', light: 0xfff0d0,
    tints: ['#f4efe4', '#e8e2d0', '#f8f4ec', '#dce4d4', '#efe6d8'], skyline: 'none', trees: true, pavement: 'hood/driveway-slab-tile',
    solid: { semi: ['hood/two-storey-family-house', 'hood/split-level-house', 'hood/two-storey-family-house', 'hood/single-storey-ranch-house'], fortress: ['nyc/bldg-bank', 'nyc/bldg-brick-church', 'nyc/bldg-bank'], office: ['nyc/bldg-bank', 'nyc/bldg-movie-palace'], mall: ['nyc/bldg-department-store'], leisure: ['nyc/bldg-brick-church', 'nyc/bldg-public-school'] },
    enemies: ['security', 'kickboxer', 'defender', 'elite', 'rival', 'bouncer'], weapons: ['pool_cue', 'baseball_bat'],
    boss: {
      name: 'Sir Edmund Lascelles', title: 'The Chairman', intro: 'I own the bank that owns the men you’ve been beating. Do sit down.', defeat: 'I’ll have my people speak to… no. No, I suppose I won’t.',
      style: 'muay_thai', second: 'boxing', lean: [2, 2, 2, 2, 3, 3], body: 'male', colour: '#22283a',
      phases: [{ name: 'Private security', line: 'Lascelles rings a bell. Private security.', kind: 'summon' }, { name: 'Jacket off', line: 'Lascelles folds his jacket and comes forward.', kind: 'rush' }, { name: 'The old school', line: 'Lascelles drops the elbows and boxes.', kind: 'swap' }],
    },
  },
  {
    name: 'Ironbridge', streets: ['works', 'terraces', 'quay', 'works'], weather: 'rain', lamp: 'hood/cobra-head-street-light', light: 0xff9858,
    tints: ['#8e8884', '#7a746e', '#9a9088', '#6e6864', '#a09488'], skyline: 'low', trees: false,
    solid: { warehouse: ['nyc/bldg-parking-garage', 'nyc/bldg-firehouse', 'nyc/bldg-public-school', 'nyc/bldg-auto-garage'], terrace: ['nyc/bldg-corner-tenement', 'hood/townhouse-row-unit', 'nyc/bldg-postwar-apartment'], dock: ['nyc/bldg-parking-garage', 'nyc/bldg-firehouse', 'nyc/bldg-auto-garage'], gym_front: ['nyc/bldg-firehouse'] },
    enemies: ['docker', 'tooled', 'bruiser', 'grappler', 'gang_enforcer', 'elite'], weapons: ['crowbar', 'chain', 'metal_bar', 'hammer'],
    boss: {
      name: 'Big Agnes Rudd', title: 'The Forgemaster', intro: 'I’ve bent steel all my life. You’ll be less work.', defeat: 'Forge is cold. Go on then.',
      style: 'wrestling', second: 'muay_thai', lean: [4, 0, 4, 0, 3, 1], body: 'female', colour: '#5a3a22',
      phases: [{ name: 'Iron bar', line: 'Rudd picks a bar off the rack.', kind: 'weapon' }, { name: 'The night shift', line: 'The night shift downs tools and wades in.', kind: 'summon' }, { name: 'White hot', line: 'Rudd throws the bar away and just hits you.', kind: 'rage' }],
      weapon: 'metal_bar',
    },
  },
  {
    name: 'Crown Heights', streets: ['high', 'strip', 'plaza', 'civic'], weather: 'rain', lamp: 'nyc/prop-street-lamp', light: 0xd0b0ff,
    tints: ['#c8ccd8', '#b4b8c8', '#d8d4e0', '#a8aec0', '#c0c8d0'], skyline: 'city', trees: false,
    solid: { fortress: ['nyc/bldg-setback-tower', 'nyc/bldg-office-tower', 'nyc/bldg-prewar-apartment'], office: ['nyc/bldg-office-tower', 'nyc/bldg-setback-tower'], mall: ['nyc/bldg-department-store', 'nyc/bldg-movie-palace'] },
    enemies: ['bouncer', 'elite', 'rival', 'gang_enforcer', 'kickboxer', 'defender'], weapons: ['baseball_bat', 'crowbar', 'machete'],
    boss: {
      name: 'Cassius Thorne', title: 'The Kingmaker', intro: 'Hale answered to me. Everyone you’ve met answered to me. Now it’s your turn.', defeat: 'No one left above me. No one left above you, either. Enjoy the view.',
      style: 'kickboxing', second: 'bjj', lean: [3, 3, 3, 3, 3, 3], body: 'male', colour: '#141418',
      phases: [{ name: 'The entourage', line: 'Thorne’s entourage closes in.', kind: 'summon' }, { name: 'No more distance', line: 'Thorne stops kicking and drags you down.', kind: 'swap' }, { name: 'Tightened guard', line: 'Thorne reads everything you throw.', kind: 'guard' }, { name: 'Last word', line: 'Thorne comes at you with everything.', kind: 'rage' }],
    },
  },
];

const THEME_LIGHT: Partial<Record<StreetKind, number>> = { strip: 0xff5ac8, quay: 0xbfd8ff };

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function weighted<T extends { weight: number }>(rng: Rng, list: T[]): T {
  const total = list.reduce((n, x) => n + x.weight, 0);
  let r = rng.next() * total;
  for (const x of list) {
    r -= x.weight;
    if (r <= 0) return x;
  }
  return list[list.length - 1];
}

/** Names already on a sign somewhere in the generated towns, so no two shops share one. */
const usedNames = new Set<string>();

function shopName(rng: Rng, kind: ShopKind): string {
  for (let tries = 0; tries < 40; tries++) {
    const pattern = SHOP_NAMES[kind][Math.floor(rng.next() * SHOP_NAMES[kind].length)];
    const pickFrom = (l: string[]): string => l[Math.floor(rng.next() * l.length)];
    const name = pattern.replace('{S2}', pickFrom(SURNAMES)).replace('{S}', pickFrom(SURNAMES)).replace('{A}', pickFrom(ADJECTIVES)).replace('{N}', pickFrom(CLUB_NAMES));
    if (!usedNames.has(name)) {
      usedNames.add(name);
      return name;
    }
  }
  return `${kind.toUpperCase()} ${usedNames.size}`;
}

/** Lay buildings along the whole frontage, never the same kind twice running and never two shops of a kind side by side. */
function frontages(rng: Rng, recipe: StreetRecipe, length: number, reserve: [number, number] | null): FacadeDef[] {
  const out: FacadeDef[] = [];
  let x = 0;
  let lastKind: FacadeKind | null = null;
  let lastShop: ShopKind | null = null;
  const recentShops: ShopKind[] = [];
  while (x < length - 0.01) {
    const left = length - x;
    const stale = (f: Frontage): boolean => !!f.shops && f.shops.every((s) => s === lastShop);
    let options = recipe.frontage.filter((f) => f.w[0] <= left && (f.kind !== lastKind || !!f.shops) && !stale(f));
    if (!options.length) options = recipe.frontage.filter((f) => f.w[0] <= left);
    // The last few metres: stretch the previous building rather than squeeze in a sliver.
    if (!options.length) {
      if (out.length) out[out.length - 1].x1 = length;
      break;
    }
    const f = weighted(rng, options);
    let w = Math.round(f.w[0] + rng.next() * (f.w[1] - f.w[0]));
    if (left - w < 6) w = left;
    const def: FacadeDef = { kind: f.kind, x0: x, x1: x + w };
    // A boss fights in front of plain buildings: shop glass behind a brawl of five is too busy to read.
    const inArena = reserve && def.x1 > reserve[0] && def.x0 < reserve[1];
    if (f.shops && !inArena) {
      const fresh = f.shops.filter((s) => s !== lastShop && !recentShops.includes(s));
      const kind = (fresh.length ? fresh : f.shops)[Math.floor(rng.next() * (fresh.length ? fresh : f.shops).length)];
      def.label = shopName(rng, kind);
      lastShop = kind;
      recentShops.push(kind);
      if (recentShops.length > 3) recentShops.shift();
    }
    out.push(def);
    lastKind = f.kind;
    x += w;
  }
  return out;
}

/** Street furniture and vehicles, each kind where it belongs, with a clear lane down the middle of the street. */
function furniture(rng: Rng, recipe: StreetRecipe, length: number, facades: FacadeDef[], keepClear: [number, number][]): PropDef[] {
  const props: PropDef[] = [];
  const blocked = (x: number, hx: number): boolean => keepClear.some(([a, b]) => x + hx > a - 0.8 && x - hx < b + 0.8) || x - hx < 3 || x + hx > length - 3;
  const overlaps = (x: number, z: number, hx: number, hz: number): boolean =>
    props.some((p) => {
      const [px, pz] = PROP_SIZE[p.kind];
      return Math.abs(p.x - x) < px + hx + 0.5 && Math.abs(p.z - z) < pz + hz + 0.2;
    });
  const place = (kind: PropKind, x: number, z: number): void => {
    const [hx, hz] = PROP_SIZE[kind];
    if (blocked(x, hx) || overlaps(x, z, hx, hz)) return;
    props.push({ kind, x: Math.round(x * 10) / 10, z });
  };
  // Along the foot of the buildings. Nothing in front of a shop window but a bin or a bench.
  let i = 0;
  let lastBack: PropKind | null = null;
  for (let x = 5 + rng.next() * 4; x < length - 4; x += recipe.spacing * (0.55 + rng.next() * 0.5)) {
    let kind = recipe.back[(i + Math.floor(rng.next() * 2)) % recipe.back.length];
    if (kind === lastBack) kind = recipe.back[(recipe.back.indexOf(kind) + 1) % recipe.back.length];
    i++;
    const shop = facades.find((f) => x >= f.x0 && x <= f.x1 && f.label);
    // In front of a shop window only something low goes: swap anything taller for a bin or a bench.
    if (shop && kind !== 'bin' && kind !== 'bench' && kind !== 'planter') kind = lastBack === 'bin' ? 'bench' : 'bin';
    const [, hz] = PROP_SIZE[kind];
    place(kind, x, Math.round((STREET.minZ + hz + 0.08) * 100) / 100);
    lastBack = kind;
  }
  // Out by the road, or the open side of a square or a yard.
  let j = 0;
  for (let x = 8 + rng.next() * 6; x < length - 6; x += recipe.spacing * (0.8 + rng.next() * 0.8)) {
    const kind = recipe.front[(j + Math.floor(rng.next() * 2)) % recipe.front.length];
    j++;
    const [, hz] = PROP_SIZE[kind];
    // Vehicles park against the kerb; everything else sits just inside the walkable edge.
    const vehicle = kind === 'car' || kind === 'van' || kind === 'bus' || kind === 'abandoned_car';
    place(kind, x, vehicle ? 1.3 : Math.round(Math.min(STREET.maxZ - hz - 0.1, 1.7) * 100) / 100);
  }
  return props;
}

function waves(rng: Rng, town: TownSeed, tier: number, count: number, size: number): EncounterDef['waves'] {
  const out: EncounterDef['waves'] = [];
  for (let w = 0; w < count; w++) {
    const enemies: EncounterDef['waves'][number]['enemies'] = [];
    for (let e = 0; e < size; e++) {
      // Later waves and later districts draw from further up the town's list.
      const reach = Math.min(town.enemies.length, 2 + tier + w);
      const archetype = town.enemies[Math.floor(rng.next() * reach)];
      const armed = rng.next() < 0.18 + tier * 0.06;
      enemies.push(armed ? { archetype, weapon: town.weapons[Math.floor(rng.next() * town.weapons.length)] } : { archetype });
    }
    out.push({ enemies });
  }
  return out;
}

function townBoss(index: number, seed: BossSeed, townName: string): BossDef {
  const hale = BOSSES.the_boss;
  // Hale is 12/10/12/9/11/12 at level 10. Each town's boss starts a step above the last and leans their own way.
  const base = [12, 10, 12, 9, 11, 12].map((v, i) => v + index + seed.lean[i]);
  const attributes = { strength: base[0], speed: base[1], endurance: base[2], agility: base[3], defence: base[4], technique: base[5] };
  const level = 10 + index;
  const helpers: ArchetypeId[][] = [['docker', 'bouncer'], ['gang_enforcer', 'tooled'], ['security', 'elite'], ['elite', 'bouncer'], ['docker', 'gang_enforcer'], ['rival', 'elite', 'gang_enforcer']];
  const steps = seed.phases.length;
  const phases: BossPhase[] = seed.phases.map((p, i) => {
    const below = Math.round((1 - (i + 1) / (steps + 1)) * 100) / 100;
    const common = { below, name: p.name, line: p.line };
    switch (p.kind) {
      case 'summon': return { ...common, summon: helpers[index - 1].map((archetype) => ({ archetype })) };
      case 'swap': return { ...common, swap: true, speedMult: 1.06 + index * 0.01 };
      case 'weapon': return { ...common, weapon: seed.weapon ?? 'crowbar', damageMult: 1.1 };
      case 'rage': return { ...common, aggression: 0.9, damageMult: 1.15 + index * 0.02, speedMult: 1.05 };
      case 'guard': return { ...common, parryBonus: 0.15 + index * 0.02, aggression: 0.5 };
      case 'rush': return { ...common, speedMult: 1.12, grabBonus: 0.1, aggression: 0.8 };
    }
  });
  const brain = {
    ...hale.brain,
    style: seed.style,
    attributes,
    level,
    aggression: Math.min(0.8, 0.6 + index * 0.025),
    blockChance: Math.min(0.62, 0.45 + index * 0.025),
    dodgeChance: Math.min(0.4, 0.2 + index * 0.02 + seed.lean[3] * 0.02),
    parryChance: Math.min(0.42, 0.2 + index * 0.025 + seed.lean[5] * 0.015),
    grabChance: seed.style === 'wrestling' || seed.style === 'bjj' ? 0.25 : 0.12,
    comboLength: Math.min(6, 4 + Math.floor(index / 2)),
    reactionFrames: Math.max(5, 9 - Math.ceil(index / 2)),
  };
  return {
    id: townBossId(index), name: seed.name, title: seed.title, district: townName, intro: seed.intro, defeat: seed.defeat,
    brain, style: seed.style, secondaryStyle: seed.second, attributes, level, bonusHealth: 170 + index * 45,
    appearance: { body: seed.body, muscle: 0.5 + seed.lean[0] * 0.1, weight: 0.35 + seed.lean[2] * 0.08, height: 1 + seed.lean[0] * 0.015, topColour: seed.colour, bottomsColour: '#1b1d22' },
    phases, reward: { cash: 1000 + index * 400, xp: 3000 + index * 1200 }, flag: townBossFlag(index),
  };
}

export interface GeneratedTown {
  index: number;
  name: string;
  districts: LevelDef[];
  boss: BossDef;
}

function generateTown(index: number): GeneratedTown {
  const town = TOWNS[index - 1];
  const districts: LevelDef[] = [];
  town.streets.forEach((kind, di) => {
    const id: TownAreaId = townAreaId(index, di + 1);
    const rng = new Rng((WORLD_SEED ^ hash(id)) >>> 0);
    const recipe = RECIPES[kind];
    const last = di === DISTRICTS_PER_TOWN - 1;
    // The town's last street is longer: it has the boss's ground at the far end as well as a fight on the way.
    const length = (last ? 100 : 72) + Math.floor(rng.next() * (last ? 4 : 9)) * 4;
    const noun = recipe.nouns[(index + di + Math.floor(rng.next() * 2)) % recipe.nouns.length];
    const name = `${town.name} ${noun}`;
    // Fights: one you must win part-way along, a side fight, and the boss at the far end of the town's last district.
    const mainX = Math.round(length * (0.3 + rng.next() * 0.12));
    const sideX = Math.round(length * (0.62 + rng.next() * 0.1));
    const tier = di;
    const size = Math.min(4, 2 + Math.floor((index + 1) / 2));
    const encounters: EncounterDef[] = [
      { id: 'main', triggerX: mainX, lock: [mainX - 11, mainX + 11], optional: false, waves: waves(rng, town, tier, 2, size), reward: { cash: 120 + index * 40 + di * 20, xp: 400 + index * 150 + di * 50 }, objective: `Fight your way along ${name}` },
    ];
    const bossZone: [number, number] | null = last ? [length - 28, length - 2] : null;
    if (last) {
      encounters.push({ id: 'boss', triggerX: length - 16, lock: bossZone!, optional: false, boss: townBossId(index), waves: [{ enemies: [{ archetype: town.enemies[town.enemies.length - 1] }] }], reward: { cash: 0, xp: 0 }, objective: `${town.boss.name} runs ${town.name} from the far end` });
    } else {
      encounters.push({ id: 'side', triggerX: sideX, optional: true, waves: waves(rng, town, tier, 1, Math.min(4, size + 1)), reward: { cash: 80 + index * 30, xp: 260 + index * 90 }, objective: `Fight your way along ${name}` });
    }
    const facades = frontages(rng, recipe, length, bossZone);
    const keepClear: [number, number][] = [[mainX - 11, mainX + 11], ...(bossZone ? [bossZone] : [])];
    const props = furniture(rng, recipe, length, facades, keepClear);
    const lights: LightDef[] = [];
    const colour = THEME_LIGHT[kind] ?? town.light;
    for (let x = 10 + rng.next() * 4; x < length - 4; x += 20 + rng.next() * 6) lights.push({ x: Math.round(x), y: 4.2, z: 0.5, colour, intensity: 13, range: 12 });
    // Something to find: a bin or a crate to search, a thing to smash and a snack, always clear of the fights' walls.
    const taken: [number, number][] = [];
    const spot = (lo: number, hi: number, z = 0): number => {
      const want = Math.round(length * (lo + rng.next() * (hi - lo)));
      // Step sideways until the spot is clear of furniture, vehicles and anything already put down.
      for (const off of [0, 1.5, -1.5, 3, -3, 4.5, -4.5, 6, -6, 8, -8]) {
        const x = want + off;
        const clear =
          x > 3 && x < length - 3 &&
          props.every((p) => Math.abs(p.x - x) > PROP_SIZE[p.kind][0] + 0.9 || Math.abs(p.z - z) > PROP_SIZE[p.kind][1] + 0.7) &&
          taken.every(([tx, tz]) => Math.abs(tx - x) > 1.6 || Math.abs(tz - z) > 0.9);
        if (clear) {
          taken.push([x, z]);
          return x;
        }
      }
      taken.push([want, z]);
      return want;
    };
    const yard = recipe.ground === 'yard' || recipe.ground === 'quay';
    districts.push({
      id, name, district: town.name, theme: recipe.theme,
      bounds: { minX: 0, maxX: length, ...STREET },
      entries: [{ id: 'left', x: 2, z: 0, facing: 1 }, { id: 'right', x: length - 2, z: 0, facing: -1 }],
      exits: [],
      facades, props,
      pickups: [
        { id: 'snack', kind: 'item', item: rng.next() < 0.5 ? 'kebab' : 'can_of_pop', x: spot(0.08, 0.2, -0.9), z: -0.9 },
        { id: 'stash', kind: 'cash', amount: 60 + index * 40 + di * 15, x: spot(0.44, 0.5, 0.4), z: 0.4, once: true },
      ],
      containers: [
        { id: 'search1', kind: yard ? 'crate' : 'bin', x: spot(0.14, 0.22, -0.6), z: -0.6, label: yard ? 'Search the crate' : 'Search the bin', loot: yard ? 'crate' : index >= 3 ? 'street_mid' : 'bin' },
        { id: 'search2', kind: yard ? 'skip' : 'dumpster', x: spot(0.6, 0.68, -0.6), z: -0.6, label: yard ? 'Search the skip' : 'Search the bins', loot: index >= 4 ? 'enforcer' : index >= 2 ? 'fighter' : 'street_mid' },
      ],
      breakables: [{ id: 'smash', kind: yard ? 'barrel' : 'boxes', x: spot(0.76, 0.8, 0.9), z: 0.9, hp: 1, loot: 'street_mid' }],
      encounters, lights, weather: town.weather, threat: index,
      objective: last ? `Find ${town.boss.name}` : `Head east through ${town.name}`,
    });
    registerDistrict(id, {
      ground: recipe.ground, tints: town.tints, skyline: recipe.ground === 'quay' ? 'none' : town.skyline, lamp: town.lamp, trees: town.trees && recipe.ground !== 'yard' && recipe.ground !== 'quay',
      pavement: recipe.ground === 'street' || recipe.ground === 'suburb' || recipe.ground === 'plaza' ? town.pavement : undefined, solid: town.solid, shell: town.shell,
    });
  });
  return { index, name: town.name, districts, boss: townBoss(index, town.boss, town.name) };
}

/** Every generated town, built once. The same on every run: nothing here is random at play time. */
export const GENERATED_TOWNS: GeneratedTown[] = (() => {
  const out: GeneratedTown[] = [];
  for (let i = 1; i <= TOWN_COUNT; i++) {
    const t = generateTown(i);
    (BOSSES as Record<string, BossDef>)[t.boss.id] = t.boss;
    out.push(t);
  }
  return out;
})();

/** Which flag opens a town: Hale for the first, then each town's boss for the next. */
export function townGate(index: number): { flag: string; text: string } {
  if (index === 1) return { flag: BOSSES.the_boss.flag, text: 'The road east is Hale’s. Nobody leaves town while he runs it.' };
  const prev = GENERATED_TOWNS[index - 2];
  return { flag: townBossFlag(index - 1), text: `${prev.boss.name} holds the road out of ${prev.name}. Beat ${prev.boss.title} first.` };
}
