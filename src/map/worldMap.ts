import { BOSSES } from '../ai/bosses';
import { COMPANION_LIST } from '../companions/companions';
import { ITEMS } from '../items/items';
import { AREA_IDS, type AreaId, type Progress } from '../progress/Progress';
import { SHOP_STOPS, TAXI_COST, TAXI_STOPS } from '../ui/hub';
import { DISTRICT_ORDER, LEVELS } from '../world/levels';
import type { ExitDef, LevelDef } from '../world/LevelTypes';
import { STRIP, stripLength, stripOffsets } from '../world/strip';

/**
 * The town map's data. Places, doors, links, locks, bosses, shops and people
 * all come from the game's own levels and progress; this file only adds
 * where each street sits on the drawn map (the streets are side-scrollers,
 * so each one is a road from its left end to its right end) and a line of
 * description for the info card.
 */

export type Pt = { x: number; y: number };

/** Map canvas size (SVG units). */
export const MAP_W = 2600;
export const MAP_H = 1700;

/** A street drawn as a road: the points it runs through, west end to east end. */
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
  subway: { tint: '#4a4f5c', road: 'main' },
  city: { tint: '#8a6a30', road: 'main' },
  docks: { tint: '#3a5a70', road: 'side' },
  precinct: { tint: '#6a5a7a', road: 'main' },
  mall: { tint: '#5a6a8a', road: 'main' },
  car_park: { tint: '#555a62', road: 'side' },
  nightlife: { tint: '#7a3a6a', road: 'main' },
  factory: { tint: '#4a4a4a', road: 'side' },
  underground: { tint: '#3a3a4a', road: 'side' },
  territory: { tint: '#6a3030', road: 'side' },
  hq: { tint: '#4a2a2a', road: 'main' },
};

/**
 * The town is one long street (world/strip.ts), so the map is one long road.
 * It is drawn folded into rows so it fits the sheet: west to east along the
 * top, round the bend, back along the middle, and east again along the bottom.
 */
const ROW_X0 = 260;
const ROW_X1 = MAP_W - 260;
const ROW_Y = [330, 850, 1370];
const ROW_LEN = ROW_X1 - ROW_X0;
const BEND_LEN = ROW_Y[1] - ROW_Y[0];
const SNAKE_LEN = ROW_LEN * ROW_Y.length + BEND_LEN * (ROW_Y.length - 1);

/** The corners of the folded road, in order, with how far along each one is. */
const SNAKE: { at: number; p: Pt }[] = (() => {
  const out: { at: number; p: Pt }[] = [];
  let at = 0;
  ROW_Y.forEach((y, row) => {
    const eastward = row % 2 === 0;
    out.push({ at, p: { x: eastward ? ROW_X0 : ROW_X1, y } });
    at += ROW_LEN;
    out.push({ at, p: { x: eastward ? ROW_X1 : ROW_X0, y } });
    at += BEND_LEN;
  });
  return out;
})();

function snakePoint(d: number): Pt {
  const t = Math.max(0, Math.min(SNAKE_LEN, d));
  for (let i = 1; i < SNAKE.length; i++) {
    if (t <= SNAKE[i].at) return lerp(SNAKE[i - 1].p, SNAKE[i].p, (t - SNAKE[i - 1].at) / Math.max(1e-6, SNAKE[i].at - SNAKE[i - 1].at));
  }
  return SNAKE[SNAKE.length - 1].p;
}

const LAYOUT: Partial<Record<AreaId, RoadLayout>> = (() => {
  const out: Partial<Record<AreaId, RoadLayout>> = {};
  const total = stripLength(LEVELS);
  const offs = stripOffsets(LEVELS);
  for (const id of STRIP) {
    const b = LEVELS[id].bounds;
    const d0 = (offs[id]! / total) * SNAKE_LEN;
    const d1 = ((offs[id]! + b.maxX - b.minX) / total) * SNAKE_LEN;
    const pts = [snakePoint(d0), ...SNAKE.filter((c) => c.at > d0 + 1 && c.at < d1 - 1).map((c) => c.p), snakePoint(d1)];
    out[id] = { pts, ...(TINTS[id] ?? { tint: '#5a5a5a', road: 'main' as const }) };
  }
  return out;
})();

/** One line for the info card. */
const BLURB: Record<AreaId, string> = {
  home: 'Your terrace on Tanner Road. Stash, kitchen, home gym, garage and the basement.',
  basement: 'Under the house. The business runs down here.',
  estate: 'Low-rise flats, garages and the playground. Where you grew up.',
  residential: 'Tower blocks, a parade of shops and the Estate King’s lads.',
  leisure: 'Five-a-side cages, the leisure centre, the skate park and Iron Temple.',
  stadium: 'Kirkgate Ground. The firm runs the terraces.',
  high_street: 'Bookies, kebab shop, Threads, Home & Hearth and the Red Lion.',
  alleys: 'Bins, back doors and shortcuts between the High Street and the canal.',
  market: 'Covered stalls and lock-ups. Maureen Doyle collects the rents.',
  industrial: 'Canal Side Works: yards, warehouses and Sully’s gym.',
  docks: 'Cranes, containers and Big Lenny’s crew.',
  ind_estate: 'Brackley Trading Estate: car and bike dealers, Green Fingers.',
  factory: 'Harrow & Lowe, shut for years. Somebody’s using it.',
  subway: 'Underpasses under the ring road. Mind the stairs.',
  underground: 'An old Deep Line tunnel nobody admits is there.',
  city: 'Market Square: Pawn & Gold, the Golden Lion casino, the Rat & Castle.',
  precinct: '60s concrete precinct. Dean Pryce takes a cut from every shop.',
  mall: 'Riverside Shopping Centre: food court, escalators, security.',
  car_park: 'The multi-storey. Top floor is where deals happen.',
  nightlife: 'The Neon Mile: clubs, takeaways and Velvet.',
  territory: 'The Pit. Big Dunc’s patch, past the city.',
  hq: 'Hale House. Where it ends.',
  clothes_shop: 'Clothes, shoes, accessories and bags. Priya runs it.',
  pawn_shop: 'Sell valuables and collectibles. Mr Kaur doesn’t ask questions.',
  pub: 'Food, drink and first aid at the bar. Fighters for hire in the Snug.',
  furniture_shop: 'Furniture, floors and walls for your house.',
  car_dealer: 'New and used cars.',
  bike_shop: 'Off-road bikes and kit.',
  casino: 'Slots, roulette, blackjack and prize motors.',
  grow_shop: 'Equipment and works for the basement business.',
  gym_store: 'Home gym kit: bags, weights, treadmill, bike and more.',
  boxing_gym: 'Coach Del teaches boxing and kickboxing. Drills and ranks.',
  karate_dojo: 'Mrs Okafor teaches karate and Muay Thai.',
  wrestling_club: 'Big Kev teaches wrestling and BJJ.',
};

export type MarkerKind =
  | 'home' | 'mission' | 'boss' | 'side' | 'shop' | 'clothes' | 'pawn' | 'gym' | 'pub' | 'casino'
  | 'cars' | 'bikes' | 'property' | 'contact' | 'street' | 'parked';

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
};

const INTERIOR_KIND: Partial<Record<AreaId, MarkerKind>> = {
  home: 'home', basement: 'property', clothes_shop: 'clothes', pawn_shop: 'pawn', pub: 'pub', furniture_shop: 'shop', car_dealer: 'cars',
  bike_shop: 'bikes', casino: 'casino', grow_shop: 'shop', gym_store: 'shop', boxing_gym: 'gym', karate_dojo: 'gym', wrestling_club: 'gym',
};

const STATION_ACTIVITY: Record<string, string> = {
  bar: 'Food and drink', pool: 'Pool', storage: 'Stash', kitchen: 'Kitchen', sofa: 'Save and story', contacts: 'Phone and crew', tin: 'Biscuit tin',
  wardrobe: 'Wardrobe', garage: 'Workbench', gym: 'Coach’s board', computer: 'Computer', train: 'Home gym', sparring: 'Sparring', shop_counter: 'Shop',
  furniture: 'Furniture', cars: 'Cars', bikes: 'Bikes', casino: 'Gambling', grow: 'Basement kit', terminal: 'Business terminal', gym_counter: 'Gym kit',
  style_coach: 'Style lessons', style_drill: 'Drills', recruit: 'Hire fighters', pawn: 'Sell valuables',
  clothes_counter: 'Buy clothes, shoes and bags', changing: 'Try things on', pawn_counter: 'Sell valuables and collectibles',
  furniture_counter: 'Buy furniture, floors and walls', car_counter: 'Buy and sell cars', bike_counter: 'Buy and sell bikes',
  casino_cashier: 'Chips and prizes', casino_slots: 'Slots', casino_roulette: 'Roulette', casino_blackjack: 'Blackjack',
  grow_counter: 'Buy basement equipment', grow_display: 'Look at the kit', mirror: 'Mirror', bike_rack: 'Bikes and cars',
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

/** Where an area's marker goes. */
export function placePoint(area: AreaId): Pt {
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
    blurb: BLURB[id],
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
  kind: 'cab' | 'home' | 'walk' | 'here';
  label: string;
  cost: number;
  entry?: string;
  ok: boolean;
  why?: string;
}

/** Can a cab drop you there? (Dave's Cabs go to the stops the phone lists.) */
export function cabStop(id: AreaId): { entry: string } | null {
  const s = SHOP_STOPS.find((x) => x.area === id) ?? TAXI_STOPS.find((x) => x.area === id);
  return s ? { entry: s.entry } : null;
}

/**
 * How you can get somewhere from where you are now.
 * `calm` is false in a fight, with the police on you, or while knocked down.
 */
export function travelOptions(p: Progress, here: AreaId, to: AreaId, calm: boolean): TravelOption[] {
  if (to === here || (to === 'basement' && here === 'home')) return [{ kind: 'here', label: 'You are here', cost: 0, ok: false }];
  const open = unlocked(p, to);
  const lock = open ? null : lockReason(p, to);
  const out: TravelOption[] = [];
  const busy = calm ? undefined : 'Not with a fight on';
  if (to === 'home' || to === 'basement') out.push({ kind: 'home', label: 'Head home', cost: 0, ok: calm, why: busy });
  const stop = cabStop(to);
  if (stop) {
    const shut = SHOP_STOPS.find((x) => x.area === to && x.shop && !p.isShopOpen(x.shop));
    const ok = open && calm && !shut && p.save.cash.bank >= TAXI_COST;
    const why = !open ? lock! : shut ? 'Shutters down after the robbery' : busy ?? (p.save.cash.bank < TAXI_COST ? `Need £${TAXI_COST} in the tin` : undefined);
    out.push({ kind: 'cab', label: `Dave’s Cabs (£${TAXI_COST} from the tin)`, cost: TAXI_COST, entry: stop.entry, ok, why });
  }
  const r = route(p, here, to);
  out.push({ kind: 'walk', label: r ? `Walk: ${r.length} stop${r.length > 1 ? 's' : ''} away` : 'Walk', cost: 0, ok: !!r, why: r ? undefined : lock ?? 'No way through from here yet' });
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
    else if (pl.id !== 'basement') out.push({ key: `place:${pl.id}`, kind: pl.kind, area: pl.id, at: pl.at, label: pl.name });
  }
  // The Snug's fighters for hire, next to the pub.
  const pub = placePoint('pub');
  out.push({ key: 'contact:snug', kind: 'contact', area: 'pub', at: { x: pub.x + 30, y: pub.y - 26 }, label: 'The Snug: fighters for hire' });
  if (p.save.basement && p.save.basement.equipment?.length) {
    const h = placePoint('home');
    out.push({ key: 'place:basement', kind: 'property', area: 'basement', at: { x: h.x + 30, y: h.y - 22 }, label: 'Your basement business' });
  }
  const bike = p.save.property.bikeOut;
  if (bike && !p.save.property.riding && LAYOUT[bike.area as AreaId]) {
    const at = streetPoint(bike.area as AreaId, bike.x);
    if (at) out.push({ key: 'parked', kind: 'parked', area: bike.area as AreaId, at: { x: at.x, y: at.y + 26 }, label: 'Where you left your bike' });
  }
  out.push(...bossMarkers(p));
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
  return BLURB[id];
}
