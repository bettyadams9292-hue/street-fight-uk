/**
 * What your clothes and jewellery do for you.
 *
 * Clothes come in five tiers (their rarity): Basic, Branded, Designer, Luxury and Iconic. Every piece has a
 * line of stats set by its style (a tracksuit makes you quicker, boots hit harder, a puffer soaks up hits) and
 * scaled by its tier, so the same jacket is worth more in a better label. An outfit earns a buff on top: a whole
 * fit in one tier or better, or a matching set (`OUTFITS`).
 *
 * Jewellery gives an XP bonus (by how rare the piece is and what it's made of) and a buff by what it is (rings
 * hit harder, watches get your breath back, and so on) and by its stone. Wear enough of it and you're dripping:
 * a bit more XP again. The XP bonus is capped (`XP_BONUS_CAP`).
 *
 * Numbers only: Progress.applyModifiers puts them on the fighter, Progress.addXp applies the XP bonus, and the
 * screens read the words from here.
 */
import type { ItemDef, ItemStat, Rarity } from './items';
import type { BottomStyle, ShoeStyle, TopStyle } from '../character/Appearance';
import { FINISHES, JEWELS, JEWEL_CATS, type FinishId, type JewelCat, type JewelDef, type StoneKind } from './jewellery';

// ---- tiers ----------------------------------------------------------------------------------------------------

export const TIER_OF: Record<Rarity, number> = { common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 5 };
export const TIER_NAMES = ['', 'Basic', 'Branded', 'Designer', 'Luxury', 'Iconic'] as const;

export function tierOf(r: Rarity): number {
  return TIER_OF[r] ?? 1;
}
/** "Tier 3 · Designer" */
export function tierLabel(r: Rarity): string {
  const t = tierOf(r);
  return `Tier ${t} · ${TIER_NAMES[t]}`;
}

// ---- stat words -----------------------------------------------------------------------------------------------

const ATTR_WORD = { strength: 'Strength', speed: 'Speed', endurance: 'Endurance', agility: 'Agility', defence: 'Defence', technique: 'Technique' } as const;
const pct = (m: number) => `${m >= 1 ? '+' : '−'}${Math.round(Math.abs(m - 1) * 100)}%`;

const attr = (a: keyof typeof ATTR_WORD, n: number): ItemStat => ({ attr: a, add: n, text: `${n >= 0 ? '+' : '−'}${Math.abs(n)} ${ATTR_WORD[a]}` });
const flat = (f: 'maxHealth' | 'maxStamina' | 'maxPoise', n: number): ItemStat => ({ flat: f, add: n, text: `+${n} ${f === 'maxHealth' ? 'max health' : f === 'maxStamina' ? 'max stamina' : 'poise'}` });
const mult = (s: 'damageMult' | 'attackSpeedMult' | 'moveSpeedMult' | 'damageTakenMult' | 'staminaRegenMult' | 'staminaCostMult', m: number): ItemStat => {
  const word = { damageMult: 'damage', attackSpeedMult: 'attack speed', moveSpeedMult: 'move speed', damageTakenMult: 'damage taken', staminaRegenMult: 'stamina back', staminaCostMult: 'stamina used' }[s];
  return { stat: s, mul: Math.round(m * 1000) / 1000, text: `${pct(m)} ${word}` };
};

// ---- clothes: a line of stats for each style, scaled by tier ---------------------------------------------------

type Line = (t: number) => ItemStat[];

const TOP_LINES: Partial<Record<TopStyle, Line>> = {
  hoodie: (t) => [attr('endurance', t)],
  designer_hoodie: (t) => [attr('endurance', t), flat('maxStamina', 4 * t)],
  tracksuit: (t) => [attr('speed', t)],
  tshirt: (t) => [attr('agility', t)],
  vest: (t) => [attr('agility', t)],
  football: (t) => [mult('staminaRegenMult', 1 + 0.04 * t)],
  bomber: (t) => [attr('strength', t)],
  puffer: (t) => [flat('maxPoise', 4 + 4 * t)],
  // Tough, but you feel it on your shoulders.
  leather: (t) => [attr('defence', 1 + t), attr('speed', -1)],
  denim: (t) => [attr('defence', t)],
  coat: (t) => [flat('maxHealth', 6 * t)],
  workwear: (t) => [attr('strength', t)],
  polo: (t) => [attr('technique', t)],
  shirt: (t) => [attr('technique', t)],
  harrington: (t) => [attr('technique', t), flat('maxPoise', 2 * t)],
  jumper: (t) => [flat('maxStamina', 6 * t)],
  quarter_zip: (t) => [flat('maxStamina', 6 * t)],
  gilet: (t) => [flat('maxPoise', 3 * t)],
  windbreaker: (t) => [mult('moveSpeedMult', 1 + 0.02 * t)],
};

const BOTTOM_LINES: Record<BottomStyle, Line> = {
  trackies: (t) => [attr('speed', t)],
  joggers: (t) => [attr('speed', t)],
  jeans: (t) => [attr('defence', t)],
  chinos: (t) => [attr('defence', t)],
  cargos: (t) => [flat('maxHealth', 5 * t)],
  workwear: (t) => [flat('maxHealth', 5 * t)],
  cargo_shorts: (t) => [flat('maxHealth', 5 * t)],
  shorts: (t) => [attr('agility', t)],
  denim_shorts: (t) => [attr('agility', t)],
};

const SHOE_LINES: Record<ShoeStyle, Line> = {
  trainers: (t) => [attr('agility', t)],
  runners: (t) => [mult('moveSpeedMult', 1 + 0.03 * t)],
  hitops: (t) => [flat('maxPoise', 4 * t)],
  // Kicks land heavier.
  boots: (t) => [attr('strength', t)],
};

/** Hats, glasses, the snood and the belt: a small line each. Fight kit (wraps, gumshield, head guard) keeps its own. */
const ACC_LINES: Record<string, Line> = {
  cap: (t) => [attr('technique', t)],
  beanie: (t) => [attr('endurance', t)],
  bucket_hat: (t) => [attr('endurance', t)],
  flat_cap: (t) => [attr('defence', t)],
  glasses: (t) => [attr('technique', t)],
  sunglasses: (t) => [mult('damageTakenMult', 1 - 0.01 * t)],
  snood: (t) => [mult('staminaCostMult', 1 - 0.02 * t)],
  belt: (t) => [flat('maxHealth', 4 * t)],
};

/** A piece of clothing's stats: its style's line at its tier, then anything special to that piece. */
export function clothingStats(d: Pick<ItemDef, 'rarity' | 'wear' | 'stats'>, own?: ItemStat[]): ItemStat[] | undefined {
  const w = d.wear;
  if (!w) return own;
  const t = tierOf(d.rarity);
  const line = w.slot === 'top' && w.top ? TOP_LINES[w.top] : w.slot === 'bottoms' && w.bottoms ? BOTTOM_LINES[w.bottoms] : w.slot === 'shoes' && w.shoes ? SHOE_LINES[w.shoes] : w.accessory ? ACC_LINES[w.accessory] : undefined;
  if (!line) return own;
  return [...line(t), ...(own ?? [])];
}

// ---- outfits: a buff for the whole fit ------------------------------------------------------------------------

export interface Buff {
  id: string;
  name: string;
  text: string;
  stats: ItemStat[];
  /** Extra XP, as a fraction (jewellery only). */
  xp?: number;
}

/** What you've got on, as the bits the buffs care about. */
export interface WornClothes {
  top?: Pick<ItemDef, 'rarity' | 'wear'>;
  bottoms?: Pick<ItemDef, 'rarity' | 'wear'>;
  shoes?: Pick<ItemDef, 'rarity' | 'wear'>;
}

/** The fit, by the lowest tier of top, bottoms and shoes. */
const FIT: { at: number; name: string; text: string; stats: () => ItemStat[] }[] = [
  { at: 5, name: 'Iconic fit', text: 'Top to toe Iconic.', stats: () => [mult('damageMult', 1.12), mult('damageTakenMult', 0.9)] },
  { at: 4, name: 'Dripping', text: 'Top to toe Luxury or better.', stats: () => [mult('damageMult', 1.08), mult('damageTakenMult', 0.94)] },
  { at: 3, name: 'Dressed to kill', text: 'Top to toe Designer or better.', stats: () => [mult('damageMult', 1.05), mult('damageTakenMult', 0.97)] },
  { at: 2, name: 'Fresh', text: 'Top to toe Branded or better.', stats: () => [mult('damageMult', 1.03)] },
];

/** Matching sets: a top and bottoms (and shoes, for some) that go together. */
const OUTFITS: { id: string; name: string; text: string; top: TopStyle[]; bottoms: BottomStyle[]; shoes?: ShoeStyle[]; stats: ItemStat[] }[] = [
  { id: 'tracky', name: 'Full tracky', text: 'Tracksuit top and trackies or joggers.', top: ['tracksuit'], bottoms: ['trackies', 'joggers'], stats: [mult('moveSpeedMult', 1.05), mult('staminaRegenMult', 1.05)] },
  { id: 'site', name: 'On site', text: 'Hi-vis, work trousers and boots.', top: ['workwear'], bottoms: ['workwear'], shoes: ['boots'], stats: [flat('maxHealth', 20), attr('strength', 2)] },
  { id: 'smart', name: 'Smart casual', text: 'Shirt, polo, jumper, Harrington or coat with chinos or jeans.', top: ['shirt', 'polo', 'jumper', 'harrington', 'coat'], bottoms: ['chinos', 'jeans'], stats: [attr('technique', 2), mult('staminaCostMult', 0.96)] },
  { id: 'training', name: 'Training kit', text: 'T-shirt or vest, shorts and trainers or runners.', top: ['tshirt', 'vest'], bottoms: ['shorts'], shoes: ['trainers', 'runners'], stats: [mult('attackSpeedMult', 1.04), mult('staminaRegenMult', 1.06)] },
];

export function outfitBuffs(w: WornClothes): Buff[] {
  const out: Buff[] = [];
  const { top, bottoms, shoes } = w;
  if (top && bottoms && shoes) {
    const low = Math.min(tierOf(top.rarity), tierOf(bottoms.rarity), tierOf(shoes.rarity));
    const fit = FIT.find((f) => low >= f.at);
    if (fit) out.push({ id: `fit_${fit.at}`, name: fit.name, text: fit.text, stats: fit.stats() });
  }
  for (const o of OUTFITS) {
    const tt = top?.wear?.top;
    const bb = bottoms?.wear?.bottoms;
    const ss = shoes?.wear?.shoes;
    if (tt && bb && o.top.includes(tt) && o.bottoms.includes(bb) && (!o.shoes || (ss && o.shoes.includes(ss)))) out.push({ id: `set_${o.id}`, name: o.name, text: o.text, stats: o.stats });
  }
  return out;
}

/** Every outfit buff there is, for GraftWiki. */
export const OUTFIT_LIST: readonly { name: string; text: string; stats: string }[] = [
  ...FIT.slice().reverse().map((f) => ({ name: f.name, text: f.text, stats: f.stats().map((s) => s.text).join(', ') })),
  ...OUTFITS.map((o) => ({ name: o.name, text: o.text, stats: o.stats.map((s) => s.text).join(', ') })),
];

// ---- jewellery: an XP bonus and a buff ----------------------------------------------------------------------

/** XP from one piece, by rarity, before the metal. */
const JEWEL_XP: Record<Rarity, number> = { common: 0.02, uncommon: 0.03, rare: 0.05, epic: 0.07, legendary: 0.1 };
/** What the metal does to it: cheap metals a bit less, precious ones more. */
const METAL_XP: Record<FinishId, number> = { steel: 0.8, titanium: 0.8, black: 0.8, silver: 0.9, gold9: 1, twotone: 1, gold18: 1.15, rose: 1.15, white: 1.15, platinum: 1.25 };
/** The most XP all your jewellery can give together. */
export const XP_BONUS_CAP = 0.3;

/** A buff by what it is, scaled by tier. */
const CAT_BUFF: Record<JewelCat, { name: string; line: Line }> = {
  ring: { name: 'Heavy hands', line: (t) => [mult('damageMult', 1 + 0.01 * t)] },
  watch: { name: 'Good timing', line: (t) => [mult('staminaRegenMult', 1 + 0.02 * t)] },
  necklace: { name: 'Front', line: (t) => [flat('maxPoise', 3 * t)] },
  bracelet: { name: 'Quick wrists', line: (t) => [mult('attackSpeedMult', 1 + 0.01 * t)] },
  earring: { name: 'Sharp', line: (t) => [attr('technique', Math.ceil(t / 2))] },
  grill: { name: 'Gold teeth', line: (t) => [mult('damageTakenMult', 1 - 0.01 * t)] },
};
/** What the stone adds. */
const STONE_BUFF: Record<StoneKind, () => ItemStat[]> = {
  diamond: () => [],
  ruby: () => [mult('damageMult', 1.02)],
  sapphire: () => [attr('defence', 1)],
  emerald: () => [flat('maxHealth', 10)],
  onyx: () => [flat('maxPoise', 6)],
  amethyst: () => [flat('maxStamina', 10)],
};
/** A diamond adds XP on top. */
const DIAMOND_XP = 0.02;

export interface JewelBonus {
  xp: number;
  /** "+5% XP" */
  xpText: string;
  name: string;
  stats: ItemStat[];
}

const xpText = (x: number) => `+${Math.round(x * 100)}% XP`;

export function jewelBonus(d: JewelDef, finish: FinishId): JewelBonus {
  const t = tierOf(d.rarity);
  const xp = Math.round((JEWEL_XP[d.rarity] * (METAL_XP[finish] ?? 1) + (d.stone === 'diamond' ? DIAMOND_XP : 0)) * 1000) / 1000;
  const stats = [...CAT_BUFF[d.cat].line(t), ...(d.stone ? STONE_BUFF[d.stone]() : [])];
  return { xp, xpText: xpText(xp), name: CAT_BUFF[d.cat].name, stats };
}

/** "+5% XP · +2% damage, +6 poise" */
export function jewelBonusText(d: JewelDef, finish: FinishId): string {
  const b = jewelBonus(d, finish);
  return [b.xpText, ...b.stats.map((s) => s.text)].join(', ');
}

/** Drip: wearing several pieces at once. */
const DRIP: { at: number; name: string; xp: number }[] = [
  { at: 6, name: 'Iced out', xp: 0.08 },
  { at: 4, name: 'Dripping in it', xp: 0.04 },
];

/** What you've got on from the jewellery box, as pieces and their finishes. */
export type WornJewels = { id: string; finish: FinishId }[];

/** Each worn piece's buff, plus drip for wearing a lot of it. */
export function jewelBuffs(worn: WornJewels): Buff[] {
  const out: Buff[] = [];
  for (const w of worn) {
    const d = JEWELS[w.id];
    if (!d) continue;
    const b = jewelBonus(d, w.finish);
    out.push({ id: `jewel_${d.cat}`, name: `${b.name} (${d.name})`, text: `${FINISHES[w.finish]?.name ?? ''} ${d.name}`.trim(), stats: b.stats, xp: b.xp });
  }
  const drip = DRIP.find((x) => worn.length >= x.at);
  if (drip) out.push({ id: 'drip', name: drip.name, text: `${drip.at} or more pieces on at once.`, stats: [], xp: drip.xp });
  return out;
}

/** The whole XP bonus from what you're wearing (a fraction, capped). */
export function xpBonusOf(worn: WornJewels): number {
  const sum = jewelBuffs(worn).reduce((n, b) => n + (b.xp ?? 0), 0);
  return Math.min(XP_BONUS_CAP, Math.round(sum * 1000) / 1000);
}

/** Every kind's buff, for GraftWiki. */
export const JEWEL_BUFF_LIST: readonly { cat: JewelCat; name: string; text: string }[] = JEWEL_CATS.map((c) => ({
  cat: c,
  name: CAT_BUFF[c].name,
  text: `${CAT_BUFF[c].line(1).map((s) => s.text).join(', ')} at Tier 1, up to ${CAT_BUFF[c].line(5).map((s) => s.text).join(', ')} at Tier 5`,
}));
export const STONE_BUFF_LIST: readonly { stone: StoneKind; text: string }[] = (Object.keys(STONE_BUFF) as StoneKind[]).map((s) => ({
  stone: s,
  text: s === 'diamond' ? xpText(DIAMOND_XP) : STONE_BUFF[s]().map((x) => x.text).join(', '),
}));
export const DRIP_LIST = DRIP.slice().reverse();
