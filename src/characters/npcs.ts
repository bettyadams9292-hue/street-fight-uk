/**
 * Who you see about town. Every generated person has a stable id (district +
 * number) and the same id always gives the same person: same body, face, skin,
 * hair and clothes. Each district dresses its people differently: office coats
 * in the City, hi-vis on the docks, trackies on the estate, football shirts by
 * the stadium, going-out clothes on the Mile.
 *
 * Pure data: nothing here draws anything. The renderer builds the body from the
 * CharacterAppearance (characters/human/fromAppearance.ts).
 */
import { Rng } from '../core/Rng';
import {
  HAIR_COLOURS,
  SKIN_TONES,
  noTattoos,
  type Accessory,
  type BodyType,
  type BottomStyle,
  type CharacterAppearance,
  type FacialHair,
  type HairStyle,
  type ShoeStyle,
  type TopStyle,
} from '../character/Appearance';

type Weights<T extends string> = Partial<Record<T, number>>;

export interface DistrictLook {
  /** Share of women. */
  female: number;
  /** Ages: young adult (0) .. pensioner (1), as [min, max] picked uniformly then skewed by `older`. */
  older: number;
  tops: Weights<TopStyle>;
  bottoms: Weights<BottomStyle>;
  shoes: Weights<ShoeStyle>;
  /** Clothing colours to draw from (bright ones are rarer). */
  colours: string[];
  /** Chance of each accessory. */
  extras: Partial<Record<Accessory, number>>;
  /** Heavier or lighter on average (-1..1). */
  build: number;
}

const DARK = ['#1b1d22', '#2b2e35', '#4a4d55', '#1f2a44', '#24324f', '#2f4a2d', '#5b3a24', '#3b3328'];
const LIGHT = ['#8a8d93', '#e8e6e1', '#a07850', '#c9c4b8'];
const BRIGHT = ['#7d1a1a', '#b3121b', '#d4a017', '#c75b12', '#2f6fa8', '#5b2e8c'];

const STREET: DistrictLook = {
  female: 0.45,
  older: 0.25,
  tops: { hoodie: 4, tracksuit: 2, tshirt: 2, puffer: 2, bomber: 1, denim: 1, coat: 1, football: 1 },
  bottoms: { jeans: 4, joggers: 2, trackies: 2, cargos: 1 },
  shoes: { trainers: 4, runners: 2, boots: 1, hitops: 1 },
  colours: [...DARK, ...DARK, ...LIGHT, ...BRIGHT],
  extras: { cap: 0.12, beanie: 0.1, watch: 0.2, chain: 0.06, sunglasses: 0.04, earring: 0.1 },
  build: 0,
};

/** District profiles (anything not listed uses STREET). */
export const DISTRICT_LOOKS: Record<string, DistrictLook> = {
  estate: {
    ...STREET,
    female: 0.4,
    older: 0.2,
    tops: { hoodie: 6, tracksuit: 4, puffer: 2, tshirt: 2, football: 1, vest: 1 },
    bottoms: { trackies: 5, joggers: 3, jeans: 2 },
    shoes: { trainers: 5, runners: 2, hitops: 2 },
    extras: { cap: 0.2, snood: 0.08, chain: 0.15, earring: 0.15, beanie: 0.12 },
  },
  alleys: { ...STREET, female: 0.25, tops: { hoodie: 6, puffer: 2, bomber: 2, leather: 1 }, bottoms: { trackies: 3, jeans: 3, cargos: 2 }, extras: { snood: 0.15, beanie: 0.2, cap: 0.15 } },
  city: {
    female: 0.5,
    older: 0.35,
    tops: { coat: 5, leather: 1, denim: 1, puffer: 2, tshirt: 1 },
    bottoms: { jeans: 3, workwear: 1, joggers: 1 },
    shoes: { boots: 3, trainers: 2, runners: 1 },
    colours: [...DARK, ...DARK, ...LIGHT],
    extras: { watch: 0.4, sunglasses: 0.05 },
    build: -0.1,
  },
  high_street: STREET,
  residential: { ...STREET, older: 0.55, tops: { coat: 3, puffer: 2, hoodie: 2, denim: 1, tshirt: 1 }, bottoms: { jeans: 4, joggers: 2, workwear: 1 }, shoes: { trainers: 2, boots: 3, runners: 1 }, extras: { watch: 0.3, cap: 0.1 } },
  market: { ...STREET, older: 0.5, tops: { puffer: 3, coat: 3, hoodie: 2, workwear: 1 }, bottoms: { jeans: 4, cargos: 1, workwear: 1 }, extras: { beanie: 0.25, cap: 0.15, watch: 0.2 } },
  nightlife: {
    female: 0.5,
    older: 0.1,
    tops: { tshirt: 3, leather: 2, bomber: 2, denim: 1, designer_hoodie: 1, vest: 1 },
    bottoms: { jeans: 5, cargos: 1, joggers: 1 },
    shoes: { trainers: 3, boots: 2, hitops: 2 },
    colours: [...DARK, ...BRIGHT, ...BRIGHT, '#e8e6e1'],
    extras: { chain: 0.3, earring: 0.3, watch: 0.3, sunglasses: 0.05 },
    build: 0,
  },
  precinct: { ...STREET, older: 0.1, tops: { tracksuit: 3, hoodie: 4, football: 2, puffer: 1 }, bottoms: { trackies: 4, joggers: 2, jeans: 2 }, extras: { cap: 0.25, chain: 0.1 } },
  leisure: { ...STREET, tops: { tracksuit: 3, tshirt: 3, hoodie: 2, vest: 1 }, bottoms: { joggers: 3, shorts: 2, trackies: 2 }, shoes: { runners: 4, trainers: 2 }, build: -0.1 },
  stadium: { ...STREET, female: 0.3, tops: { football: 7, hoodie: 2, bomber: 1, puffer: 1 }, bottoms: { jeans: 4, trackies: 2 }, extras: { cap: 0.15, beanie: 0.15 }, build: 0.2 },
  docks: { ...STREET, female: 0.15, older: 0.4, tops: { workwear: 6, puffer: 2, hoodie: 2 }, bottoms: { workwear: 5, cargos: 2, jeans: 2 }, shoes: { boots: 6, trainers: 1 }, extras: { beanie: 0.3, watch: 0.2 }, build: 0.25 },
  industrial: { ...STREET, female: 0.2, older: 0.4, tops: { workwear: 5, hoodie: 2, puffer: 2 }, bottoms: { workwear: 4, cargos: 3, jeans: 2 }, shoes: { boots: 5, trainers: 1 }, extras: { beanie: 0.2 }, build: 0.2 },
  ind_estate: { ...STREET, female: 0.25, older: 0.35, tops: { workwear: 4, hoodie: 3, puffer: 1 }, bottoms: { workwear: 3, cargos: 3, jeans: 2 }, shoes: { boots: 4, trainers: 2 }, build: 0.15 },
  car_park: STREET,
  underground: { ...STREET, tops: { coat: 2, hoodie: 3, puffer: 2, tshirt: 1 } },
  mall: { ...STREET, female: 0.55, tops: { tshirt: 3, hoodie: 2, denim: 2, puffer: 2, coat: 1 } },
};

function pickW<T extends string>(w: Weights<T>, r: () => number): T {
  const entries = Object.entries(w) as [T, number][];
  let total = 0;
  for (const [, n] of entries) total += n;
  let x = r() * total;
  for (const [k, n] of entries) if ((x -= n) <= 0) return k;
  return entries[entries.length - 1][0];
}

const pick = <T>(list: readonly T[], r: () => number): T => list[Math.floor(r() * list.length) % list.length];

/** FNV-1a: the same string always gives the same seed. */
export function seedOf(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export interface Npc {
  /** Stable: `<district>:<n>`. */
  id: string;
  district: string;
  seed: number;
  appearance: CharacterAppearance;
}

const cache = new Map<string, Npc>();

/** Forget generated people (tests: proves regeneration gives the same result). */
export function clearNpcCache(): void {
  cache.clear();
}

/** The person with this id (generated once, then cached). */
export function npc(district: string, n: number): Npc {
  const id = `${district}:${n}`;
  const hit = cache.get(id);
  if (hit) return hit;
  const made = makeNpc(id, district);
  if (cache.size > 2000) cache.clear();
  cache.set(id, made);
  return made;
}

function makeNpc(id: string, district: string): Npc {
  const seed = seedOf(id);
  const rng = new Rng(seed || 1);
  const r = () => rng.next();
  const look = DISTRICT_LOOKS[district] ?? STREET;
  const body: BodyType = r() < look.female ? 'female' : 'male';
  // Age: mostly young adults, more older people where the profile says so.
  const age = Math.pow(r(), 1.6 - look.older);
  const greying = age > 0.55 ? Math.min(1, (age - 0.55) * 2.2) : 0;
  const male = body === 'male';
  const hairM: Weights<HairStyle> = { crop: 5, buzz: 3, bald: age > 0.5 ? 4 : 1, quiff: 2, curly: 1, afro: 1, cornrows: 1 };
  const hairF: Weights<HairStyle> = { long: 4, ponytail: 3, bun: 3, bob: 3, crop: 1, curly: 1, afro: 1, cornrows: 1 };
  const beard: Weights<FacialHair> = { none: 4, stubble: 3, short_beard: 2, full_beard: age > 0.4 ? 2 : 1, moustache: age > 0.6 ? 2 : 0.3, goatee: 1 };
  let top = pickW(look.tops, r);
  if (top === 'vest' && !male && r() < 0.5) top = 'tshirt';
  const colours = look.colours;
  const accessories: Accessory[] = [];
  for (const [a, p] of Object.entries(look.extras) as [Accessory, number][]) if (r() < p) accessories.push(a);
  // A cap or a beanie, not both.
  if (accessories.includes('cap') && accessories.includes('beanie')) accessories.splice(accessories.indexOf('beanie'), 1);
  const build = look.build;
  const appearance: CharacterAppearance = {
    version: 1,
    body,
    muscle: Math.max(0, Math.min(1, 0.15 + r() * 0.55 + (male ? 0.1 : -0.05))),
    weight: Math.max(0, Math.min(1, 0.1 + r() * 0.55 + age * 0.2 + build * 0.25)),
    height: male ? 0.95 + r() * 0.12 : 0.93 + r() * 0.09,
    skinTone: pick(SKIN_TONES, r),
    face: { headWidth: r() * 1.4 - 0.7, jaw: r() * 1.4 - 0.7, nose: r() * 1.4 - 0.7, brow: r() * 1.4 - 0.7, eyeSpacing: r() - 0.5, ears: r() * 1.2 - 0.6 },
    hair: pickW(male ? hairM : hairF, r),
    hairColour: pick(HAIR_COLOURS.slice(0, 10), r),
    greying,
    facialHair: male ? pickW(beard, r) : 'none',
    tattoos: noTattoos(),
    inkColour: '#1a2230',
    faceScar: 'none',
    armScar: 'none',
    top,
    topColour: pick(colours, r),
    bottoms: pickW(look.bottoms, r),
    bottomsColour: pick(DARK, r),
    shoes: pickW(look.shoes, r),
    shoesColour: pick(['#1b1d22', '#e8e6e1', '#4a4d55', '#5b3a24'], r),
    accessories,
    chainColour: r() < 0.5 ? 'gold' : 'silver',
    headColour: pick(DARK, r),
  };
  if (top === 'workwear') appearance.topColour = r() < 0.7 ? '#e8a010' : '#c75b12';
  return { id, district, seed, appearance };
}

/** Distinct-enough check used by tests: a short signature of what makes two people look different. */
export function lookSignature(a: CharacterAppearance): string {
  return [a.body, a.skinTone, a.hair, a.hairColour, a.top, a.topColour, a.bottoms, a.facialHair, Math.round(a.weight * 4), Math.round(a.height * 40)].join('|');
}
