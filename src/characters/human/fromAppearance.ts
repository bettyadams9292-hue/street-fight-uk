/**
 * Turns the game's CharacterAppearance (what the creator, saves, NPC
 * generators and shops all use) into a MakeHuman character spec: body shape,
 * skin, hair, clothes. Pure and deterministic: the same appearance always gives
 * the same character.
 */
import type { CharacterAppearance, TopStyle, BottomStyle, HairStyle } from '../../character/Appearance';
import { DEFAULT_SHAPE, type BodyShape } from './body';
import type { GarmentKind } from './garments';

export interface SpecItem {
  id: string;
  colour?: string;
}
export interface SpecGarment {
  kind: GarmentKind;
  colour: string;
  trim?: string;
}
export interface HumanSpecData {
  shape: BodyShape;
  /** Skin texture id, chosen from `skins` by tone and sex. */
  skin: string;
  /** The exact skin colour asked for (the texture is tinted to it). */
  skinColour: string;
  browColour: string;
  browWeight: number;
  eyeColour: string;
  items: SpecItem[];
  garments: SpecGarment[];
}

export interface SkinChoice {
  id: string;
  gender: string;
  tone: number;
  tags?: string[];
}

const clamp = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));

function hexRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  const lin = (c: number) => Math.pow(c / 255, 2.2);
  return [lin((n >> 16) & 255), lin((n >> 8) & 255), lin(n & 255)];
}
const lum = (hex: string) => {
  const [r, g, b] = hexRgb(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** 0 = palest .. 1 = darkest, on the same scale as the skin pack's tone values. */
export function toneOf(hex: string): number {
  const light = lum('#f6d7c3');
  const dark = lum('#3a2416');
  return clamp(0.05 + 0.9 * ((light - lum(hex)) / (light - dark)));
}

function mixHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (s: number) => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t);
  return '#' + ((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0');
}

const TOPS: Record<TopStyle, GarmentKind | 'tee' | 'none'> = {
  hoodie: 'hoodie',
  designer_hoodie: 'hoodie',
  tracksuit: 'tracksuit_top',
  tshirt: 'tee',
  football: 'football',
  bomber: 'bomber',
  puffer: 'puffer',
  leather: 'leather',
  denim: 'denim_jacket',
  coat: 'coat',
  workwear: 'hivis',
  vest: 'vest',
  none: 'none',
};

const BOTTOMS: Record<BottomStyle, GarmentKind | 'cargo'> = {
  trackies: 'trackies',
  joggers: 'joggers',
  jeans: 'jeans',
  cargos: 'cargo',
  workwear: 'work_trousers',
  shorts: 'fight_shorts',
};

const HAIR: Record<HairStyle, { m: string | null; f: string | null }> = {
  bald: { m: null, f: null },
  buzz: { m: 'hair_crop', f: 'hair_crop' },
  crop: { m: 'hair_crop', f: 'hair_bobcut' },
  quiff: { m: 'hair_swept', f: 'hair_bobcut' },
  curly: { m: 'hair_short_messy', f: 'hair_shaggy' },
  afro: { m: 'hair_short_messy', f: 'hair_shaggy' },
  cornrows: { m: 'hair_crop', f: 'hair_braid' },
  mohawk: { m: 'hair_swept', f: 'hair_swept' },
  bun: { m: 'hair_bun', f: 'hair_bun' },
  ponytail: { m: 'hair_braid', f: 'hair_braid' },
  long: { m: 'hair_long', f: 'hair_long' },
  bob: { m: 'hair_bob', f: 'hair_bob_bangs' },
};

/** Pick a skin texture: the nearest tone for the sex, else the nearest of any. */
export function chooseSkin(skins: readonly SkinChoice[], female: boolean, tone: number, tattooed: boolean, older: boolean): string {
  const usable = skins.filter((s) => s.id !== 'uniform');
  const want = female ? 'female' : 'male';
  const score = (s: SkinChoice) => {
    let d = Math.abs(s.tone - tone);
    if (s.gender !== want) d += 0.25;
    if (s.id.includes('tattooed') !== tattooed) d += 0.4;
    if (s.id.includes('old') !== older) d += 0.15;
    return d;
  };
  let best = usable[0];
  for (const s of usable) if (score(s) < score(best)) best = s;
  return best?.id ?? 'm_light';
}

export function appearanceToHuman(a: CharacterAppearance, skins: readonly SkinChoice[]): HumanSpecData {
  const female = a.body === 'female';
  const tone = toneOf(a.skinTone);
  const inked = Object.values(a.tattoos).filter((t) => t !== 'none').length;
  const older = a.greying > 0.45;
  const african = clamp((tone - 0.5) / 0.3);
  const sliders: Record<string, number> = {
    'head-width': a.face.headWidth * 0.6,
    'chin-width': a.face.jaw * 0.6,
    'chin-prominent': a.face.jaw * 0.3,
    'nose-width': a.face.nose * 0.6,
    'brow-angle': a.face.brow * 0.5,
    'eye-size': a.face.eyeSpacing * 0.4,
    'ear-size': a.face.ears * 0.6,
  };
  if (a.muscle > 0.6) {
    sliders['arm-muscle'] = (a.muscle - 0.6) * 1.5;
    sliders['chest-muscle'] = (a.muscle - 0.6) * 1.5;
  }
  // The creator's detail sliders add on top.
  for (const [k, v] of Object.entries(a.detail ?? {})) sliders[k] = Math.max(-1, Math.min(1, (sliders[k] ?? 0) + (v ?? 0)));
  const shape: BodyShape = {
    ...DEFAULT_SHAPE,
    gender: female ? 0 : 1,
    age: clamp(0.05 + a.greying * 0.75),
    muscle: clamp(0.2 + a.muscle * 0.7),
    weight: clamp(0.3 + a.weight * 0.6),
    height: clamp(0.5 + ((a.height - 1) / 0.07) * 0.5),
    african,
    asian: 0,
    caucasian: 1 - african,
    sliders,
  };
  const hairColour = mixHex(a.hairColour, '#cfccc6', a.greying);
  const items: SpecItem[] = [];
  const garments: SpecGarment[] = [];
  const top = TOPS[a.top];
  if (top === 'tee') items.push({ id: female ? 'tee_female' : 'tee_male', colour: a.topColour });
  else if (top === 'vest' && female) items.push({ id: 'camisole', colour: a.topColour });
  else if (top !== 'none') garments.push({ kind: top, colour: a.topColour, trim: a.top === 'designer_hoodie' ? '#c9a24a' : undefined });
  else if (female) items.push({ id: 'camisole', colour: '#1b1d22' });
  const bottom = BOTTOMS[a.bottoms];
  if (bottom === 'cargo') items.push({ id: 'cargo_trousers', colour: a.bottomsColour });
  else garments.push({ kind: bottom, colour: a.bottomsColour });
  const shoe = a.shoes === 'boots' || a.shoes === 'hitops' ? (female ? 'ankle_boots_f' : 'ankle_boots_m') : 'plimsolls';
  items.push({ id: shoe, colour: a.shoesColour });
  if (a.bottoms === 'shorts') items.push({ id: 'socks_low', colour: '#e8e6e1' });
  const hair = HAIR[a.hair][female ? 'f' : 'm'];
  if (hair && !a.accessories.includes('headguard')) items.push({ id: hair, colour: hairColour });
  if (!female) {
    if (a.facialHair === 'moustache') items.push({ id: 'moustache_viking', colour: hairColour });
    else if (a.facialHair === 'goatee' || a.facialHair === 'short_beard') items.push({ id: 'beard_scruffy', colour: hairColour });
    else if (a.facialHair === 'full_beard') items.push({ id: 'beard_viking', colour: hairColour });
  }
  if (a.accessories.includes('wraps')) items.push({ id: 'fight_gloves', colour: '#d8d2c4' });
  if (a.accessories.includes('cap') || a.accessories.includes('beanie')) items.push({ id: 'flat_cap', colour: a.headColour ?? '#2b2e35' });
  if (a.accessories.includes('sunglasses')) items.push({ id: 'glasses_frames', colour: '#101012' });
  if (a.accessories.includes('snood')) items.push({ id: 'face_mask', colour: a.headColour ?? '#1b1d22' });
  const browColour = mixHex(mixHex(a.hairColour, '#1a120c', 0.35), '#bdb8b0', a.greying * 0.7);
  const browWeight = Math.max(0, Math.min(1, (female ? 0.3 : 0.65) + a.face.brow * 0.3));
  // Eye colour: browns for darker skin, otherwise picked steadily from the face (same face, same eyes).
  const pickEye = Math.abs(Math.sin((a.face.headWidth + 2) * 12.9898 + (a.face.nose + 2) * 78.233 + (a.face.jaw + 2) * 37.719)) % 1;
  const eyeColour = tone > 0.55 ? (pickEye < 0.7 ? '#3a2416' : '#5a3a22') : ['#3a2416', '#5a3a22', '#6a5a2a', '#3d6a8a', '#5a7da0', '#4a6a4a', '#6a7078'][Math.floor(pickEye * 7)];
  return { shape, eyeColour, skin: chooseSkin(skins, female, tone, inked >= 3 && !female, older), skinColour: a.skinTone, browColour, browWeight, items, garments };
}
