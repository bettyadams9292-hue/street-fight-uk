/**
 * Everything about how a fighter looks. Pure data: the renderer builds the
 * model from it, the save system stores it as-is, and (from Stage 4) shops
 * and equipment change it. Height and build are cosmetic only.
 */
import type { JewelCat, JewelLook } from '../items/jewellery';

export type BodyType = 'male' | 'female';

export const HAIR_STYLES = ['bald', 'buzz', 'crop', 'quiff', 'curly', 'afro', 'cornrows', 'mohawk', 'bun', 'ponytail', 'long', 'bob'] as const;
export type HairStyle = (typeof HAIR_STYLES)[number];

export const FACIAL_HAIR = ['none', 'stubble', 'moustache', 'goatee', 'short_beard', 'full_beard'] as const;
export type FacialHair = (typeof FACIAL_HAIR)[number];

export const TOP_STYLES = ['hoodie', 'designer_hoodie', 'tracksuit', 'tshirt', 'football', 'bomber', 'puffer', 'leather', 'denim', 'coat', 'workwear', 'vest', 'none'] as const;
export type TopStyle = (typeof TOP_STYLES)[number];

export const BOTTOM_STYLES = ['trackies', 'joggers', 'jeans', 'cargos', 'workwear', 'shorts'] as const;
export type BottomStyle = (typeof BOTTOM_STYLES)[number];

export const SHOE_STYLES = ['trainers', 'runners', 'hitops', 'boots'] as const;
export type ShoeStyle = (typeof SHOE_STYLES)[number];

export const TATTOO_SLOTS = ['leftUpperArm', 'rightUpperArm', 'leftForearm', 'rightForearm', 'chest', 'neck'] as const;
export type TattooSlot = (typeof TATTOO_SLOTS)[number];

export const TATTOO_DESIGNS = ['none', 'tribal', 'rose', 'swallow', 'crown', 'geometric', 'sleeve'] as const;
export type TattooDesign = (typeof TATTOO_DESIGNS)[number];

export const FACE_SCARS = ['none', 'brow', 'cheek', 'chin'] as const;
export type FaceScar = (typeof FACE_SCARS)[number];

export const ARM_SCARS = ['none', 'left', 'right', 'both'] as const;
export type ArmScar = (typeof ARM_SCARS)[number];

export const ACCESSORIES = ['wraps', 'chain', 'cap', 'beanie', 'watch', 'earring', 'headguard', 'sunglasses', 'snood', 'ring', 'belt', 'mouthguard'] as const;

/** What a new fighter can pick in the creator. Everything else is bought, found or stolen. */
export const STARTER_TOPS: readonly TopStyle[] = ['hoodie', 'tracksuit', 'tshirt', 'vest', 'none'];
export const STARTER_BOTTOMS: readonly BottomStyle[] = ['trackies', 'jeans', 'shorts'];
export const STARTER_SHOES: readonly ShoeStyle[] = ['trainers', 'hitops'];
export const STARTER_ACCESSORIES: readonly Accessory[] = ['wraps', 'watch', 'earring'];
export type Accessory = (typeof ACCESSORIES)[number];

export interface CharacterAppearance {
  version: 1;
  body: BodyType;
  /** 0..1 */
  muscle: number;
  /** 0..1 */
  weight: number;
  /** 0.93..1.07 (about 163-190 cm) */
  height: number;

  skinTone: string;
  face: {
    headWidth: number; // -1..1
    jaw: number; // -1..1
    nose: number; // -1..1
    brow: number; // -1..1
    eyeSpacing: number; // -1..1
    ears: number; // -1..1
  };

  hair: HairStyle;
  hairColour: string;
  /** 0 (none) .. 1 (fully grey) */
  greying: number;
  facialHair: FacialHair;

  tattoos: Record<TattooSlot, TattooDesign>;
  inkColour: string;
  faceScar: FaceScar;
  armScar: ArmScar;

  top: TopStyle;
  topColour: string;
  bottoms: BottomStyle;
  bottomsColour: string;
  shoes: ShoeStyle;
  shoesColour: string;
  accessories: Accessory[];
  chainColour: 'gold' | 'silver';
  /** Colour of a cap, beanie or face covering. */
  headColour?: string;
  /** Fine shaping from the creator's detail sliders (-1..1 each, see DETAIL_SLIDERS). Absent = average. */
  detail?: Partial<Record<DetailKey, number>>;
  /** Jewellery on (rings, watch, chain, grill), from the jewellery box. Never stored with the character's own look. */
  jewellery?: Partial<Record<JewelCat, JewelLook>>;
}

/** The creator's detail sliders: MakeHuman shape targets, by the creator section they appear in. */
export const DETAIL_SLIDERS = {
  face: [
    ['forehead-height', 'Forehead'],
    ['cheekbones', 'Cheekbones'],
    ['cheek-volume', 'Cheeks'],
    ['eye-bags', 'Eye bags'],
    ['nose-length', 'Nose length'],
    ['nose-hump', 'Nose bridge'],
    ['nose-tip', 'Nose tip'],
    ['mouth-width', 'Mouth width'],
    ['lip-upper', 'Upper lip'],
    ['lip-lower', 'Lower lip'],
    ['chin-height', 'Chin length'],
    ['chin-prominent', 'Chin'],
    ['ear-flap', 'Ears stick out'],
    ['head-fat', 'Face fullness'],
  ],
  body: [
    ['torso-vshape', 'Shoulders'],
    ['chest-muscle', 'Chest'],
    ['back-muscle', 'Back'],
    ['arm-muscle', 'Arms'],
    ['belly', 'Belly'],
    ['hip-width', 'Hips'],
    ['glutes', 'Backside'],
    ['neck-width', 'Neck'],
  ],
} as const;
export type DetailKey = (typeof DETAIL_SLIDERS)['face' | 'body'][number][0];
const DETAIL_KEYS: readonly string[] = [...DETAIL_SLIDERS.face, ...DETAIL_SLIDERS.body].map((x) => x[0]);

export const SKIN_TONES = [
  '#f6d7c3', '#eac0a2', '#e0ac87', '#cf9670', '#c68e6b', '#b07752',
  '#9a6440', '#8d5a3b', '#734a2e', '#5e3b24', '#4a2e1c', '#3a2416',
];

export const HAIR_COLOURS = [
  '#0e0b09', '#2a1c12', '#4a3020', '#6b4527', '#8c5a2e', '#a8713c',
  '#c99a5b', '#e0c48f', '#8e2a14', '#b84a1f', '#d9d6cf', '#1f2a5c',
];

export const CLOTHING_COLOURS = [
  '#1b1d22', '#2b2e35', '#4a4d55', '#8a8d93', '#e8e6e1', '#1f2a44',
  '#24324f', '#2f4a2d', '#5b2e8c', '#7d1a1a', '#b3121b', '#d4a017',
  '#c75b12', '#2f6fa8', '#5b3a24', '#a07850',
];

export const INK_COLOURS = ['#1a2230', '#0d0d0d', '#2a3d5c', '#5c1a1a', '#1f3d2a'];

export const DEFAULT_FACE = { headWidth: 0, jaw: 0, nose: 0, brow: 0, eyeSpacing: 0, ears: 0 };

export function noTattoos(): Record<TattooSlot, TattooDesign> {
  return { leftUpperArm: 'none', rightUpperArm: 'none', leftForearm: 'none', rightForearm: 'none', chest: 'none', neck: 'none' };
}

export function defaultAppearance(body: BodyType = 'male'): CharacterAppearance {
  return {
    version: 1,
    body,
    muscle: 0.45,
    weight: 0.3,
    height: body === 'male' ? 1.0 : 0.97,
    skinTone: SKIN_TONES[4],
    face: { ...DEFAULT_FACE },
    hair: body === 'male' ? 'crop' : 'ponytail',
    hairColour: HAIR_COLOURS[1],
    greying: 0,
    facialHair: body === 'male' ? 'stubble' : 'none',
    tattoos: noTattoos(),
    inkColour: INK_COLOURS[0],
    faceScar: 'none',
    armScar: 'none',
    top: 'hoodie',
    topColour: CLOTHING_COLOURS[1],
    bottoms: 'trackies',
    bottomsColour: CLOTHING_COLOURS[0],
    shoes: 'trainers',
    shoesColour: CLOTHING_COLOURS[4],
    accessories: ['wraps'],
    chainColour: 'gold',
  };
}

/** The training-ground sparring partner. */
export function sparringPartnerAppearance(): CharacterAppearance {
  return {
    ...defaultAppearance('male'),
    muscle: 0.6,
    weight: 0.45,
    height: 1.03,
    skinTone: SKIN_TONES[7],
    face: { headWidth: 0.3, jaw: 0.5, nose: 0.3, brow: 0.4, eyeSpacing: 0, ears: 0.2 },
    hair: 'buzz',
    hairColour: HAIR_COLOURS[0],
    facialHair: 'short_beard',
    top: 'vest',
    topColour: CLOTHING_COLOURS[9],
    bottoms: 'shorts',
    bottomsColour: CLOTHING_COLOURS[0],
    shoes: 'hitops',
    shoesColour: CLOTHING_COLOURS[0],
    accessories: ['wraps', 'headguard'],
  };
}

function pick<T>(list: readonly T[], rnd: () => number): T {
  return list[Math.floor(rnd() * list.length)];
}

export function randomAppearance(rnd: () => number = Math.random, body?: BodyType): CharacterAppearance {
  const b: BodyType = body ?? (rnd() < 0.5 ? 'male' : 'female');
  const r = (lo: number, hi: number) => lo + (hi - lo) * rnd();
  const maleHair: HairStyle[] = ['bald', 'buzz', 'crop', 'quiff', 'curly', 'afro', 'cornrows', 'mohawk'];
  const femaleHair: HairStyle[] = ['bun', 'ponytail', 'long', 'bob', 'curly', 'afro', 'cornrows', 'crop'];
  const tattoos = noTattoos();
  for (const slot of Object.keys(tattoos) as TattooSlot[]) {
    if (rnd() < 0.25) tattoos[slot] = pick(TATTOO_DESIGNS.filter((d) => d !== 'none' && (d !== 'sleeve' || slot.includes('Arm'))), rnd);
  }
  const accessories: Accessory[] = ['wraps'];
  if (rnd() < 0.3) accessories.push('chain');
  if (rnd() < 0.2) accessories.push('cap');
  if (rnd() < 0.3) accessories.push('watch');
  if (rnd() < 0.25) accessories.push('earring');
  return {
    version: 1,
    body: b,
    muscle: r(0.15, 0.9),
    weight: r(0.05, 0.7),
    height: b === 'male' ? r(0.96, 1.07) : r(0.93, 1.02),
    skinTone: pick(SKIN_TONES, rnd),
    face: { headWidth: r(-0.7, 0.7), jaw: r(-0.7, 0.7), nose: r(-0.7, 0.7), brow: r(-0.7, 0.7), eyeSpacing: r(-0.5, 0.5), ears: r(-0.6, 0.6) },
    hair: pick(b === 'male' ? maleHair : femaleHair, rnd),
    hairColour: pick(HAIR_COLOURS, rnd),
    greying: rnd() < 0.15 ? r(0.2, 0.8) : 0,
    facialHair: b === 'male' ? pick(FACIAL_HAIR, rnd) : 'none',
    tattoos,
    inkColour: pick(INK_COLOURS, rnd),
    faceScar: rnd() < 0.25 ? pick(FACE_SCARS.filter((s) => s !== 'none'), rnd) : 'none',
    armScar: rnd() < 0.15 ? pick(ARM_SCARS.filter((s) => s !== 'none'), rnd) : 'none',
    top: pick(TOP_STYLES.filter((t) => b === 'male' || t !== 'none'), rnd),
    topColour: pick(CLOTHING_COLOURS, rnd),
    bottoms: pick(BOTTOM_STYLES, rnd),
    bottomsColour: pick(CLOTHING_COLOURS, rnd),
    shoes: pick(SHOE_STYLES, rnd),
    shoesColour: pick(CLOTHING_COLOURS, rnd),
    accessories,
    chainColour: rnd() < 0.5 ? 'gold' : 'silver',
  };
}

const clamp = (v: unknown, lo: number, hi: number, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback);
const oneOf = <T extends string>(v: unknown, list: readonly T[], fallback: T): T => (list.includes(v as T) ? (v as T) : fallback);
const colour = (v: unknown, fallback: string) => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v : fallback);

/** Repair anything missing or out of range (old saves, hand-edited data). */
export function sanitiseAppearance(raw: unknown): CharacterAppearance {
  const a = (raw ?? {}) as Partial<CharacterAppearance>;
  const body = oneOf(a.body, ['male', 'female'] as const, 'male');
  const d = defaultAppearance(body);
  const f = (a.face ?? {}) as Partial<CharacterAppearance['face']>;
  const tattoos = noTattoos();
  for (const slot of TATTOO_SLOTS) tattoos[slot] = oneOf(a.tattoos?.[slot], TATTOO_DESIGNS, 'none');
  return {
    version: 1,
    body,
    muscle: clamp(a.muscle, 0, 1, d.muscle),
    weight: clamp(a.weight, 0, 1, d.weight),
    height: clamp(a.height, 0.93, 1.07, d.height),
    skinTone: colour(a.skinTone, d.skinTone),
    face: {
      headWidth: clamp(f.headWidth, -1, 1, 0),
      jaw: clamp(f.jaw, -1, 1, 0),
      nose: clamp(f.nose, -1, 1, 0),
      brow: clamp(f.brow, -1, 1, 0),
      eyeSpacing: clamp(f.eyeSpacing, -1, 1, 0),
      ears: clamp(f.ears, -1, 1, 0),
    },
    hair: oneOf(a.hair, HAIR_STYLES, d.hair),
    hairColour: colour(a.hairColour, d.hairColour),
    greying: clamp(a.greying, 0, 1, 0),
    facialHair: oneOf(a.facialHair, FACIAL_HAIR, 'none'),
    tattoos,
    inkColour: colour(a.inkColour, d.inkColour),
    faceScar: oneOf(a.faceScar, FACE_SCARS, 'none'),
    armScar: oneOf(a.armScar, ARM_SCARS, 'none'),
    top: oneOf(a.top, TOP_STYLES, d.top),
    topColour: colour(a.topColour, d.topColour),
    bottoms: oneOf(a.bottoms, BOTTOM_STYLES, d.bottoms),
    bottomsColour: colour(a.bottomsColour, d.bottomsColour),
    shoes: oneOf(a.shoes, SHOE_STYLES, d.shoes),
    shoesColour: colour(a.shoesColour, d.shoesColour),
    accessories: Array.isArray(a.accessories) ? (a.accessories.filter((x) => ACCESSORIES.includes(x as Accessory)) as Accessory[]) : d.accessories,
    chainColour: a.chainColour === 'silver' ? 'silver' : 'gold',
    headColour: typeof a.headColour === 'string' && /^#[0-9a-f]{6}$/i.test(a.headColour) ? a.headColour : undefined,
    detail: sanitiseDetail(a.detail),
  };
}

function sanitiseDetail(raw: unknown): CharacterAppearance['detail'] {
  if (!raw || typeof raw !== 'object') return undefined;
  const out: Partial<Record<DetailKey, number>> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!DETAIL_KEYS.includes(k) || typeof v !== 'number' || !Number.isFinite(v)) continue;
    const c = Math.max(-1, Math.min(1, v));
    if (Math.abs(c) > 0.001) out[k as DetailKey] = c;
  }
  return Object.keys(out).length ? out : undefined;
}

/** Display names for option lists. */
export const LABELS: Record<string, string> = {
  male: 'Male', female: 'Female',
  bald: 'Shaved', buzz: 'Buzz cut', crop: 'Short crop', quiff: 'Quiff', curly: 'Curly top', afro: 'Afro', cornrows: 'Cornrows',
  mohawk: 'Mohawk', bun: 'Bun', ponytail: 'Ponytail', long: 'Long', bob: 'Bob',
  none: 'None', stubble: 'Stubble', moustache: 'Moustache', goatee: 'Goatee', short_beard: 'Short beard', full_beard: 'Full beard',
  hoodie: 'Hoodie', designer_hoodie: 'Designer hoodie', tracksuit: 'Tracksuit top', tshirt: 'T-shirt', football: 'Football shirt', bomber: 'Bomber jacket',
  puffer: 'Puffer jacket', leather: 'Leather jacket', denim: 'Denim jacket', coat: 'Long coat', workwear: 'Workwear', vest: 'Vest',
  trackies: 'Trackies', joggers: 'Joggers', jeans: 'Jeans', cargos: 'Cargos', shorts: 'Fight shorts',
  trainers: 'Trainers', runners: 'Running trainers', hitops: 'High-tops', boots: 'Boots',
  tribal: 'Tribal', rose: 'Rose', swallow: 'Swallow', crown: 'Crown', geometric: 'Geometric', sleeve: 'Full sleeve',
  brow: 'Split eyebrow', cheek: 'Cheek slash', chin: 'Chin', left: 'Left arm', right: 'Right arm', both: 'Both arms',
  wraps: 'Hand wraps', chain: 'Chain', cap: 'Cap', beanie: 'Beanie', watch: 'Watch', earring: 'Earring', headguard: 'Head guard',
  sunglasses: 'Sunglasses', snood: 'Face covering', ring: 'Ring', belt: 'Belt', mouthguard: 'Gumshield',
  leftUpperArm: 'Left upper arm', rightUpperArm: 'Right upper arm', leftForearm: 'Left forearm', rightForearm: 'Right forearm',
  chest: 'Chest', neck: 'Neck',
};
