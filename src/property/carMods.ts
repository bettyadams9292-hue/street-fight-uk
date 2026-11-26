/**
 * Cosmetic car mods at Arnold Shark (ui/propertyUI.ts, the Mods tab): paint, finish, alloys, tints, spoilers, body
 * kits, ride height, calliper colour, exhausts, number plates and decals. Looks only: nothing changes how a car
 * drives or what it's worth. Saved on the owned car (`OwnedVehicle.mods`), drawn wherever it's parked
 * (render/props/carMods.ts over the car's own model), kept through saves, loads and drives.
 *
 * Every option has a price; the stock option is free (taking a mod off costs nothing and refunds nothing). Some
 * parts don't suit some cars (`fits`): no wing on an SUV or a pick-up, no slammed suspension on anything that goes
 * off road, a lift only on the off-roaders.
 */
import type { Progress } from '../progress/Progress';
import { CARS, type CarClass } from './catalogue';
import type { OwnedVehicle } from './state';

export interface CarMods {
  paint?: string;
  finish?: 'gloss' | 'metallic' | 'matte' | 'pearl';
  wheels?: 'stock' | 'chrome' | 'black' | 'gold' | 'bronze' | 'white';
  tint?: 'none' | 'light' | 'dark' | 'limo';
  spoiler?: 'none' | 'lip' | 'wing';
  kit?: 'stock' | 'sport';
  ride?: 'stock' | 'lowered' | 'slammed' | 'lifted';
  calliper?: 'stock' | 'red' | 'yellow' | 'blue' | 'green';
  exhaust?: 'stock' | 'twin' | 'quad';
  plate?: string;
  decal?: 'none' | 'stripe' | 'rally';
  decalColour?: string;
}

export type ModCat = keyof CarMods;

export interface ModOption {
  value: string;
  name: string;
  price: number;
  /** A colour to show on the swatch. */
  swatch?: string;
}

const OFF_ROAD: ReadonlySet<CarClass> = new Set(['suv', '4x4']);

/** The plates you can have made up (UK style, two letters, two numbers, three letters, or a private one). */
export const PLATES = ['GR4 FTY', 'H4 RDG', 'B055 MAN', 'L4D 5', 'K1 NGS', 'CAL 1B', 'GRAFT 1', 'N1 CKED', 'DO5 H', 'R3 DLN'];

export const MOD_CATS: { id: ModCat; name: string; options: (car: string) => ModOption[] }[] = [
  {
    id: 'paint', name: 'Paint',
    options: (car) => [
      ...CARS[car].colours.map((c, i) => ({ value: c, name: i === 0 ? 'Factory colour' : `Factory colour ${i + 1}`, price: i === 0 ? 0 : 250, swatch: c })),
      ...[['#c8102e', 'Post Box Red'], ['#0b3d91', 'Royal Blue'], ['#0f5132', 'Racing Green'], ['#f2c14e', 'Sunburst Yellow'], ['#ff6a13', 'Tango Orange'], ['#5b2a86', 'Grape Purple'], ['#111111', 'Jet Black'], ['#f4f4f0', 'Arctic White'], ['#7d8791', 'Gunmetal'], ['#3fb5a7', 'Teal']]
        .filter(([c]) => !CARS[car].colours.includes(c))
        .map(([c, n]) => ({ value: c, name: n, price: 400, swatch: c })),
    ],
  },
  {
    id: 'finish', name: 'Finish',
    options: () => [
      { value: 'gloss', name: 'Gloss (factory)', price: 0 },
      { value: 'metallic', name: 'Metallic flake', price: 300 },
      { value: 'matte', name: 'Satin matte', price: 450 },
      { value: 'pearl', name: 'Pearlescent', price: 650 },
    ],
  },
  {
    id: 'wheels', name: 'Alloys',
    options: () => [
      { value: 'stock', name: 'Factory wheels', price: 0 },
      { value: 'chrome', name: 'Chrome five-spoke', price: 650, swatch: '#d9dde2' },
      { value: 'black', name: 'Gloss black', price: 550, swatch: '#151515' },
      { value: 'gold', name: 'Gold mesh', price: 850, swatch: '#c9a227' },
      { value: 'bronze', name: 'Bronze split-spoke', price: 700, swatch: '#8c5a2b' },
      { value: 'white', name: 'White rally', price: 500, swatch: '#f2f2ee' },
    ],
  },
  {
    id: 'tint', name: 'Window tint',
    options: () => [
      { value: 'none', name: 'No tint', price: 0 },
      { value: 'light', name: 'Light (legal)', price: 120 },
      { value: 'dark', name: 'Dark', price: 180 },
      { value: 'limo', name: 'Limo black', price: 260 },
    ],
  },
  {
    id: 'spoiler', name: 'Spoiler',
    options: (car) => [
      { value: 'none', name: 'No spoiler', price: 0 },
      { value: 'lip', name: 'Boot lip', price: 220 },
      ...(OFF_ROAD.has(CARS[car].cls) ? [] : [{ value: 'wing', name: 'GT wing', price: 480 }]),
    ],
  },
  {
    id: 'kit', name: 'Body kit',
    options: () => [
      { value: 'stock', name: 'Factory body', price: 0 },
      { value: 'sport', name: 'Sport skirts and splitter', price: 750 },
    ],
  },
  {
    id: 'ride', name: 'Ride height',
    options: (car) => [
      { value: 'stock', name: 'Factory height', price: 0 },
      ...(OFF_ROAD.has(CARS[car].cls)
        ? [{ value: 'lifted', name: 'Lifted', price: 380 }]
        : [{ value: 'lowered', name: 'Lowered', price: 320 }, { value: 'slammed', name: 'Slammed', price: 520 }]),
    ],
  },
  {
    id: 'calliper', name: 'Brake callipers',
    options: () => [
      { value: 'stock', name: 'Factory grey', price: 0 },
      { value: 'red', name: 'Red', price: 150, swatch: '#d0201a' },
      { value: 'yellow', name: 'Yellow', price: 150, swatch: '#f2c200' },
      { value: 'blue', name: 'Blue', price: 150, swatch: '#1f5fd0' },
      { value: 'green', name: 'Green', price: 150, swatch: '#2c9a46' },
    ],
  },
  {
    id: 'exhaust', name: 'Exhaust',
    options: () => [
      { value: 'stock', name: 'Factory', price: 0 },
      { value: 'twin', name: 'Twin tips', price: 180 },
      { value: 'quad', name: 'Quad tips', price: 320 },
    ],
  },
  {
    id: 'plate', name: 'Number plate',
    options: () => [{ value: '', name: 'Factory plate', price: 0 }, ...PLATES.map((t) => ({ value: t, name: t, price: 250 }))],
  },
  {
    id: 'decal', name: 'Decals',
    options: () => [
      { value: 'none', name: 'No decals', price: 0 },
      { value: 'stripe', name: 'Side stripe', price: 200 },
      { value: 'rally', name: 'Rally stripes', price: 350 },
    ],
  },
  {
    id: 'decalColour', name: 'Decal colour',
    options: () => [
      { value: '#f4f4f0', name: 'White', price: 0, swatch: '#f4f4f0' },
      { value: '#111111', name: 'Black', price: 60, swatch: '#111111' },
      { value: '#c8102e', name: 'Red', price: 60, swatch: '#c8102e' },
      { value: '#c9a227', name: 'Gold', price: 60, swatch: '#c9a227' },
      { value: '#0b3d91', name: 'Blue', price: 60, swatch: '#0b3d91' },
    ],
  },
];

/** What a car has fitted for one category (its stock option if nothing). */
export function fitted(car: OwnedVehicle, cat: ModCat): string {
  if (cat === 'paint') return car.mods?.paint ?? car.colour;
  const v = car.mods?.[cat];
  return typeof v === 'string' ? v : MOD_CATS.find((c) => c.id === cat)!.options(car.id)[0].value;
}

/** The paint the car shows. */
export function paintOf(car: OwnedVehicle): string {
  return car.mods?.paint ?? car.colour;
}

export function optionFor(carId: string, cat: ModCat, value: string): ModOption | null {
  return MOD_CATS.find((c) => c.id === cat)?.options(carId).find((o) => o.value === value) ?? null;
}

export type ModResult = { ok: true; price: number } | { ok: false; reason: string };

/** Fit one option: paid once (pocket, then bank), only if it suits the car and isn't already on. */
export function fitMod(p: Progress, uid: string, cat: ModCat, value: string): ModResult {
  const car = p.save.property.cars.find((c) => c.uid === uid);
  if (!car) return { ok: false, reason: 'That’s not your car.' };
  const opt = optionFor(car.id, cat, value);
  if (!opt) return { ok: false, reason: 'That doesn’t fit this car.' };
  if (fitted(car, cat) === value) return { ok: false, reason: 'Already fitted.' };
  if (opt.price > 0 && !p.pay(opt.price)) return { ok: false, reason: `Need £${opt.price.toLocaleString('en-GB')}` };
  const mods: CarMods = { ...(car.mods ?? {}) };
  (mods as Record<string, string>)[cat] = value;
  car.mods = mods;
  return { ok: true, price: opt.price };
}

/** Repair a saved car's mods: anything unknown or that no longer suits the car is dropped. */
export function sanitiseMods(carId: string, raw: unknown): CarMods | undefined {
  if (!raw || typeof raw !== 'object' || !CARS[carId]) return undefined;
  const out: CarMods = {};
  for (const c of MOD_CATS) {
    const v = (raw as Record<string, unknown>)[c.id];
    if (typeof v === 'string' && c.options(carId).some((o) => o.value === v)) (out as Record<string, string>)[c.id] = v;
  }
  return Object.keys(out).length ? out : undefined;
}
