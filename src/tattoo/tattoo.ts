/**
 * Ink & Iron, the tattoo studio on Hollins Estate: a design on any of the six places (both upper arms, both
 * forearms, the chest, the neck), lasered off again, or everything re-inked in another colour. Pure rules
 * (prices, what's allowed, paying and applying it); the screen is ui/tattooUI.ts and the studio is
 * `tattoo_studio` in world/interiors.ts. The ink shows on the body itself (render/human/tattooSkin.ts), so it
 * shows wherever your clothes don't cover it.
 *
 * You pay for what changes. Prices are a walk-in studio's: small pieces £40–£80, a chest piece or a full sleeve
 * a few hundred.
 */
import { INK_COLOURS, LABELS, TATTOO_DESIGNS, TATTOO_SLOTS, type CharacterAppearance, type TattooDesign, type TattooSlot } from '../character/Appearance';
import type { Progress } from '../progress/Progress';

export const STUDIO = { shop: 'Ink & Iron', artist: 'Shaz' } as const;

/** Where you can have one, in the order the studio's board shows them. */
export const SLOT_NAMES: Record<TattooSlot, string> = {
  rightUpperArm: 'Right arm',
  leftUpperArm: 'Left arm',
  rightForearm: 'Right forearm',
  leftForearm: 'Left forearm',
  chest: 'Chest',
  neck: 'Neck',
};
export const SLOT_ORDER: readonly TattooSlot[] = ['rightUpperArm', 'leftUpperArm', 'rightForearm', 'leftForearm', 'chest', 'neck'];

/** A design's price before the place it's going (a bigger canvas costs more) and Shaz's line about it. */
export const DESIGNS: Record<Exclude<TattooDesign, 'none'>, { price: number; blurb: string }> = {
  swallow: { price: 50, blurb: 'Old-school swallow. One for every five thousand miles, sailors said.' },
  star: { price: 45, blurb: 'Nautical star, half filled. Always finds its way home.' },
  anchor: { price: 55, blurb: 'Anchor, bold lines. Something that keeps you steady.' },
  dagger: { price: 60, blurb: 'Dagger through a banner. Traditional, never dates.' },
  rose: { price: 65, blurb: 'A rose, linework and leaves. Softer than it looks.' },
  crown: { price: 60, blurb: 'A crown. Says who runs things.' },
  skull: { price: 70, blurb: 'Skull, blacked in. Nobody asks twice.' },
  tribal: { price: 55, blurb: 'Tribal swirls, solid black. A classic for a reason.' },
  geometric: { price: 70, blurb: 'Hexagon, triangle, dot. Clean and sharp.' },
  lettering: { price: 40, blurb: 'LOYALTY on a scroll. Spell-checked, twice.' },
  sleeve: { price: 260, blurb: 'Bands and swirls all the way round. Arms only; a long sitting.' },
};

/** How much a place adds: the chest is the biggest canvas, the neck hurts most. */
export const SLOT_MULT: Record<TattooSlot, number> = { rightUpperArm: 1, leftUpperArm: 1, rightForearm: 0.9, leftForearm: 0.9, chest: 1.6, neck: 1.3 };

/** Laser removal, a place. */
export const LASER_PRICE = 90;
/** Re-inking every piece you have in a new colour, per piece. */
export const REINK_PRICE = 25;
export const INK_NAMES = ['Blue-black', 'Black', 'Navy', 'Oxblood', 'Bottle green'] as const;

/** What can go where: the sleeve only on an arm, as in the creator. */
export function designsFor(slot: TattooSlot): Exclude<TattooDesign, 'none'>[] {
  return TATTOO_DESIGNS.filter((d): d is Exclude<TattooDesign, 'none'> => d !== 'none' && (d !== 'sleeve' || slot.includes('Arm')));
}

export function designPrice(design: Exclude<TattooDesign, 'none'>, slot: TattooSlot): number {
  return Math.round((DESIGNS[design].price * SLOT_MULT[slot]) / 5) * 5;
}

/** The part of how you look the studio can change. */
export interface Ink {
  tattoos: Record<TattooSlot, TattooDesign>;
  inkColour: string;
}

export function inkOf(a: Pick<CharacterAppearance, 'tattoos' | 'inkColour'>): Ink {
  return { tattoos: { ...a.tattoos }, inkColour: a.inkColour };
}

export interface QuoteLine {
  label: string;
  price: number;
}

/** What going from `now` to `wanted` costs, line by line. */
export function quote(now: Ink, wanted: Ink): { lines: QuoteLine[]; total: number } {
  const lines: QuoteLine[] = [];
  for (const slot of SLOT_ORDER) {
    const was = now.tattoos[slot];
    const want = wanted.tattoos[slot];
    if (want === was) continue;
    // Over something already there: lasered first, then the new one.
    if (was !== 'none') lines.push({ label: `${SLOT_NAMES[slot]}: laser off the ${(LABELS[was] ?? was).toLowerCase()}`, price: LASER_PRICE });
    if (want !== 'none') lines.push({ label: `${SLOT_NAMES[slot]}: ${LABELS[want] ?? want}`, price: designPrice(want, slot) });
  }
  if (wanted.inkColour.toLowerCase() !== now.inkColour.toLowerCase()) {
    const pieces = TATTOO_SLOTS.filter((s) => wanted.tattoos[s] !== 'none').length;
    if (pieces) lines.push({ label: `Re-ink ${pieces} piece${pieces === 1 ? '' : 's'}: ${inkName(wanted.inkColour)}`, price: REINK_PRICE * pieces });
  }
  return { lines, total: lines.reduce((n, l) => n + l.price, 0) };
}

export function inkName(colour: string): string {
  const i = INK_COLOURS.findIndex((c) => c.toLowerCase() === colour.toLowerCase());
  return INK_NAMES[i] ?? 'Custom';
}

export type InkResult = { ok: true; total: number } | { ok: false; reason: string };

/**
 * Pay and have it done: pocket money first, then the card. Written to your own look
 * (`save.character.appearance`) in place, so the fighter the game holds has it too.
 */
export function getInk(p: Progress, wanted: Ink): InkResult {
  const a = p.save.character.appearance;
  for (const slot of TATTOO_SLOTS) {
    const d = wanted.tattoos[slot];
    if (!(TATTOO_DESIGNS as readonly string[]).includes(d)) return { ok: false, reason: 'Shaz doesn’t do that one.' };
    if (d !== 'none' && !designsFor(slot).includes(d)) return { ok: false, reason: 'A sleeve goes on an arm.' };
  }
  if (!INK_COLOURS.some((c) => c.toLowerCase() === wanted.inkColour.toLowerCase())) return { ok: false, reason: 'She hasn’t got that ink.' };
  const now = inkOf(a);
  const q = quote(now, wanted);
  // An ink colour with nothing to re-ink: nothing to pay, and nothing would show.
  const sameWork = TATTOO_SLOTS.every((s) => now.tattoos[s] === wanted.tattoos[s]);
  if (!q.lines.length && sameWork) return { ok: false, reason: 'That’s what you’ve already got.' };
  if (!p.pay(q.total)) return { ok: false, reason: `That’s £${q.total}. Cash on you first, then your card.` };
  a.tattoos = { ...wanted.tattoos };
  a.inkColour = wanted.inkColour;
  return { ok: true, total: q.total };
}
