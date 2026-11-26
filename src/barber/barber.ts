/**
 * Peaky Barbers, the barber on the High Street: a new hairstyle, a beard shaped, trimmed or shaved off,
 * a colour, the grey covered or put in. Pure rules (prices, what's allowed, paying and applying it);
 * the screen is ui/barberUI.ts and the shop is `barber_shop` in world/interiors.ts.
 *
 * You pay for what changes: picking what you've already got costs nothing. Prices are a real
 * barber's, about £10–£45 a job, so a fresh look is pocket money once the first fights are won.
 */
import { FACIAL_HAIR, HAIR_COLOURS, HAIR_STYLES, LABELS, type BodyType, type CharacterAppearance, type FacialHair, type HairStyle } from '../character/Appearance';
import type { Progress } from '../progress/Progress';

export const BARBER = { shop: 'Peaky Barbers', barber: 'Vinny' } as const;

/** What a cut costs, and the line Vinny says about it. */
export interface Job {
  price: number;
  blurb: string;
}

export const HAIRCUTS: Record<HairStyle, Job> = {
  bald: { price: 10, blurb: 'Clippers off, then the razor. Smooth as a cue ball.' },
  buzz: { price: 12, blurb: 'Number two all over. In and out in ten minutes.' },
  crop: { price: 16, blurb: 'Short back and sides, a bit left on top.' },
  quiff: { price: 22, blurb: 'Skin fade, length on top, swept up and back.' },
  curly: { price: 22, blurb: 'Tight on the sides, curls left loose on top.' },
  afro: { price: 26, blurb: 'Shaped and picked out, line-up at the front.' },
  cornrows: { price: 45, blurb: 'Braided straight back. Takes a while; worth it.' },
  mohawk: { price: 22, blurb: 'Sides shaved off, a strip left down the middle.' },
  bun: { price: 24, blurb: 'Grown long and tied up on top.' },
  ponytail: { price: 24, blurb: 'Long, pulled back and tied.' },
  long: { price: 30, blurb: 'Past the shoulders. Vinny swears it’s all yours.' },
  bob: { price: 28, blurb: 'Cut to the jaw, blunt at the ends.' },
};

export const BEARDS: Record<FacialHair, Job> = {
  none: { price: 10, blurb: 'Hot towel and a cut-throat shave. Baby-faced.' },
  stubble: { price: 8, blurb: 'Trimmed right down to a shadow.' },
  moustache: { price: 10, blurb: 'Everything off but the top lip.' },
  goatee: { price: 12, blurb: 'Chin and lip, cheeks shaved clean.' },
  short_beard: { price: 15, blurb: 'Kept short and tidy, sharp line on the cheek.' },
  full_beard: { price: 18, blurb: 'Full and shaped, oiled to finish.' },
};

/** The colour chart's names, in the order of HAIR_COLOURS. */
export const COLOUR_NAMES = ['Jet black', 'Dark brown', 'Brown', 'Chestnut', 'Light brown', 'Caramel', 'Dark blonde', 'Blonde', 'Auburn', 'Ginger', 'Platinum', 'Midnight blue'] as const;

/** Any colour from the chart. */
export const COLOUR_PRICE = 30;

/** Grey: covered, a touch at the sides, or silver all over. */
export const GREYS = [
  { id: 'none', name: 'No grey', amount: 0, price: 20 },
  { id: 'touch', name: 'Touch of grey', amount: 0.35, price: 20 },
  { id: 'silver', name: 'Silver fox', amount: 0.75, price: 20 },
] as const;

/** The part of how you look the barber can change. */
export interface Cut {
  hair: HairStyle;
  facialHair: FacialHair;
  hairColour: string;
  greying: number;
}

export function cutOf(a: Pick<CharacterAppearance, 'hair' | 'facialHair' | 'hairColour' | 'greying'>): Cut {
  return { hair: a.hair, facialHair: a.facialHair, hairColour: a.hairColour, greying: a.greying };
}

/** Which grey setting a greying amount is closest to. */
export function greyOf(amount: number): (typeof GREYS)[number] {
  return GREYS.reduce((best, g) => (Math.abs(g.amount - amount) < Math.abs(best.amount - amount) ? g : best), GREYS[0]);
}

const sameGrey = (a: number, b: number): boolean => greyOf(a).id === greyOf(b).id;

/** What's for sale to this fighter: beards only for a male body (as in the creator). */
export function menuFor(body: BodyType): { hair: readonly HairStyle[]; beard: readonly FacialHair[]; colours: readonly string[] } {
  return { hair: HAIR_STYLES, beard: body === 'male' ? FACIAL_HAIR : [], colours: HAIR_COLOURS };
}

export interface QuoteLine {
  label: string;
  price: number;
}

/** What going from `now` to `wanted` costs, line by line. Nothing that stays the same is charged. */
export function quote(now: Cut, wanted: Cut): { lines: QuoteLine[]; total: number } {
  const lines: QuoteLine[] = [];
  if (wanted.hair !== now.hair) lines.push({ label: LABELS[wanted.hair] ?? wanted.hair, price: HAIRCUTS[wanted.hair].price });
  if (wanted.facialHair !== now.facialHair) {
    lines.push({ label: wanted.facialHair === 'none' ? 'Clean shave' : LABELS[wanted.facialHair] ?? wanted.facialHair, price: BEARDS[wanted.facialHair].price });
  }
  if (wanted.hairColour.toLowerCase() !== now.hairColour.toLowerCase()) lines.push({ label: 'New colour', price: COLOUR_PRICE });
  if (!sameGrey(wanted.greying, now.greying)) {
    const g = greyOf(wanted.greying);
    lines.push({ label: g.id === 'none' ? 'Cover the grey' : g.name, price: g.price });
  }
  return { lines, total: lines.reduce((n, l) => n + l.price, 0) };
}

export type CutResult = { ok: true; total: number } | { ok: false; reason: string };

/**
 * Pay and have it done: pocket money first, then the tin (as every shop). The change is to your own look
 * (`save.character.appearance`), so it lasts, under whatever you're wearing.
 */
export function getCut(p: Progress, wanted: Cut): CutResult {
  const a = p.save.character.appearance;
  const menu = menuFor(a.body);
  if (!menu.hair.includes(wanted.hair)) return { ok: false, reason: 'Vinny doesn’t do that one.' };
  if (wanted.facialHair !== 'none' && !menu.beard.includes(wanted.facialHair)) return { ok: false, reason: 'Nothing there to shape.' };
  if (!menu.colours.some((c) => c.toLowerCase() === wanted.hairColour.toLowerCase())) return { ok: false, reason: 'That’s not on the colour chart.' };
  const now = cutOf(a);
  const q = quote(now, wanted);
  if (!q.lines.length) return { ok: false, reason: 'That’s what you’ve already got.' };
  if (!p.pay(q.total)) return { ok: false, reason: `That’s £${q.total}. Pocket money first, then the tin at home.` };
  // In place: the save and the fighter the game holds share this object.
  a.hair = wanted.hair;
  a.facialHair = wanted.facialHair;
  a.hairColour = wanted.hairColour;
  if (!sameGrey(wanted.greying, now.greying)) a.greying = greyOf(wanted.greying).amount;
  return { ok: true, total: q.total };
}
