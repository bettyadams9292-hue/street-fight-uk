/**
 * The jeweller's stock: rings, watches, necklaces and teeth grills, as data.
 *
 * A product is a design (its shape, stones and character); a finish is the
 * metal it's made in, which sets the colour and the price. Every piece you buy
 * is yours for good: it lives in your jewellery box (the save), not in your
 * pockets, so it never takes an inventory slot and never gets lost in a fight.
 *
 * Brand names are made up.
 */
import type { Rarity, WearSlot } from './items';

export type JewelCat = 'ring' | 'watch' | 'necklace' | 'grill';
export const JEWEL_CATS: JewelCat[] = ['ring', 'watch', 'necklace', 'grill'];
export const JEWEL_CAT_LABELS: Record<JewelCat, string> = { ring: 'Rings', watch: 'Watches', necklace: 'Necklaces', grill: 'Grills' };
export const JEWEL_CAT_ONE: Record<JewelCat, string> = { ring: 'Ring', watch: 'Watch', necklace: 'Necklace', grill: 'Grill' };
/** Where each kind is worn (the same slots as the rest of your kit, so two things never share a finger). */
export const JEWEL_SLOT: Record<JewelCat, WearSlot> = { ring: 'finger', watch: 'wrist', necklace: 'neck', grill: 'mouth' };

export type FinishId = 'gold9' | 'gold18' | 'white' | 'rose' | 'silver' | 'platinum' | 'black' | 'steel' | 'titanium' | 'twotone';

export interface Finish {
  id: FinishId;
  name: string;
  /** Hallmark line for the product card. */
  quality: string;
  /** Metal colour (linear-ish sRGB hex). */
  metal: string;
  /** Second metal for two-tone pieces. */
  metal2?: string;
  roughness: number;
  /** Price multiplier on the design's base price. */
  mult: number;
}

export const FINISHES: Record<FinishId, Finish> = {
  gold9: { id: 'gold9', name: 'Yellow gold', quality: '9ct yellow gold', metal: '#d8b04a', roughness: 0.22, mult: 1 },
  gold18: { id: 'gold18', name: 'Rich yellow gold', quality: '18ct yellow gold', metal: '#e8b830', roughness: 0.16, mult: 1.9 },
  white: { id: 'white', name: 'White gold', quality: '18ct white gold', metal: '#e4e6ea', roughness: 0.14, mult: 2 },
  rose: { id: 'rose', name: 'Rose gold', quality: '18ct rose gold', metal: '#e0a08a', roughness: 0.18, mult: 1.9 },
  silver: { id: 'silver', name: 'Silver', quality: '925 sterling silver', metal: '#cfd2d8', roughness: 0.24, mult: 0.35 },
  platinum: { id: 'platinum', name: 'Platinum', quality: '950 platinum', metal: '#e8e8e6', roughness: 0.12, mult: 2.6 },
  black: { id: 'black', name: 'Black', quality: 'Black rhodium plate', metal: '#2c2c31', roughness: 0.3, mult: 1.2 },
  steel: { id: 'steel', name: 'Steel', quality: '316L stainless steel', metal: '#b9bdc4', roughness: 0.28, mult: 0.3 },
  titanium: { id: 'titanium', name: 'Titanium', quality: 'Grade 5 titanium', metal: '#8f9298', roughness: 0.34, mult: 0.55 },
  twotone: { id: 'twotone', name: 'Two-tone', quality: '18ct gold and steel', metal: '#c4c7cd', metal2: '#e2b23a', roughness: 0.2, mult: 1.1 },
};

export type StoneKind = 'diamond' | 'ruby' | 'sapphire' | 'emerald' | 'onyx' | 'amethyst';
export const STONES: Record<StoneKind, { name: string; colour: string }> = {
  diamond: { name: 'Diamond', colour: '#f4fbff' },
  ruby: { name: 'Ruby', colour: '#c8102e' },
  sapphire: { name: 'Sapphire', colour: '#1f4fbf' },
  emerald: { name: 'Emerald', colour: '#1a8a4a' },
  onyx: { name: 'Onyx', colour: '#111114' },
  amethyst: { name: 'Amethyst', colour: '#7b3fb0' },
};

export type RingStyle = 'band' | 'court' | 'signet' | 'solitaire' | 'halo' | 'eternity' | 'sovereign' | 'statement' | 'designer' | 'cluster';
export type WatchFace = 'round' | 'square' | 'tonneau' | 'digital';
export type WatchStrap = 'bracelet' | 'leather' | 'rubber' | 'nato' | 'iced';
export type ChainLink = 'curb' | 'cuban' | 'rope' | 'figaro' | 'box' | 'ball' | 'tennis' | 'snake';
export type ChainLength = 'choker' | 'collar' | 'chest' | 'long';
export type Pendant = 'cross' | 'crucifix' | 'medallion' | 'heart' | 'diamond' | 'dogtag' | 'initial' | 'boxing_glove';
export type GrillCover = 'single' | 'fangs' | 'top6' | 'top8' | 'full';
export type GrillStyle = 'plain' | 'diamond' | 'outline' | 'twotone' | 'cutout';

/** Shape of each kind of piece, read by the 3D builder (render/jewellery.ts). */
export type JewelShape =
  | { cat: 'ring'; style: RingStyle; /** Band width, mm. */ width: number }
  | { cat: 'watch'; face: WatchFace; strap: WatchStrap; /** Case diameter, mm. */ size: number; dial: string; bezel: 'plain' | 'diamond' | 'coloured' | 'tachy'; bezelColour?: string }
  | { cat: 'necklace'; link: ChainLink; /** Chain thickness, mm. */ gauge: number; length: ChainLength; pendant?: Pendant }
  | { cat: 'grill'; cover: GrillCover; style: GrillStyle };

export interface JewelDef {
  id: string;
  name: string;
  cat: JewelCat;
  /** Price in the cheapest listed finish is base × that finish's multiplier. */
  base: number;
  rarity: Rarity;
  finishes: FinishId[];
  stone?: StoneKind;
  shape: JewelShape;
  /** One line under the name. */
  blurb: string;
  /** Short spec, e.g. "6 mm court band". */
  spec: string;
}

const LIST: JewelDef[] = [];
const ring = (id: string, name: string, base: number, rarity: Rarity, style: RingStyle, width: number, finishes: FinishId[], spec: string, blurb: string, stone?: StoneKind) =>
  LIST.push({ id, name, cat: 'ring', base, rarity, finishes, stone, shape: { cat: 'ring', style, width }, spec, blurb });
const watch = (id: string, name: string, base: number, rarity: Rarity, face: WatchFace, strap: WatchStrap, size: number, dial: string, bezel: 'plain' | 'diamond' | 'coloured' | 'tachy', finishes: FinishId[], spec: string, blurb: string, stone?: StoneKind, bezelColour?: string) =>
  LIST.push({ id, name, cat: 'watch', base, rarity, finishes, stone, shape: { cat: 'watch', face, strap, size, dial, bezel, bezelColour }, spec, blurb });
const chain = (id: string, name: string, base: number, rarity: Rarity, link: ChainLink, gauge: number, length: ChainLength, finishes: FinishId[], spec: string, blurb: string, pendant?: Pendant, stone?: StoneKind) =>
  LIST.push({ id, name, cat: 'necklace', base, rarity, finishes, stone, shape: { cat: 'necklace', link, gauge, length, pendant }, spec, blurb });
const grill = (id: string, name: string, base: number, rarity: Rarity, cover: GrillCover, style: GrillStyle, finishes: FinishId[], spec: string, blurb: string, stone?: StoneKind) =>
  LIST.push({ id, name, cat: 'grill', base, rarity, finishes, stone, shape: { cat: 'grill', cover, style }, spec, blurb });

const GOLDS: FinishId[] = ['gold9', 'gold18', 'white', 'rose'];
const ALL_METALS: FinishId[] = ['silver', 'gold9', 'gold18', 'white', 'rose', 'platinum'];

// ---- rings ------------------------------------------------------------------------------------
ring('r_court_silver', 'Ashworth Court Band', 60, 'common', 'court', 4, ['silver', 'titanium', 'black'], '4 mm court band', 'Plain, comfortable, goes with everything.');
ring('r_flat_gold', 'Kingsley Flat Band', 220, 'common', 'band', 6, GOLDS, '6 mm flat band', 'A wide flat band with a brushed centre stripe.');
ring('r_signet_oval', 'Oval Signet', 380, 'uncommon', 'signet', 9, ['gold9', 'gold18', 'silver', 'rose'], 'Oval signet, plain face', 'Heavy oval signet. Old money, or wants you to think so.');
ring('r_signet_onyx', 'Halden Onyx Signet', 620, 'rare', 'signet', 10, ['gold9', 'gold18', 'white'], 'Signet with onyx inlay', 'Black onyx set flush in a chunky signet.', 'onyx');
ring('r_sovereign', 'Full Sovereign Ring', 900, 'rare', 'sovereign', 12, ['gold9', 'gold18'], 'Sovereign coin mount', 'A full sovereign in a rope-edge mount. A classic round here.');
ring('r_solitaire', 'Velloni Solitaire', 1400, 'rare', 'solitaire', 3, ['white', 'platinum', 'gold18', 'rose'], '0.5 ct round brilliant', 'One proper diamond, four claws, no fuss.', 'diamond');
ring('r_halo', 'Marchetti Halo', 2600, 'epic', 'halo', 3, ['white', 'platinum', 'rose'], '1 ct centre, pavé halo', 'A big centre stone ringed with tiny diamonds.', 'diamond');
ring('r_eternity', 'Eternity Band', 1800, 'epic', 'eternity', 4, ['white', 'platinum', 'gold18'], 'Full eternity, 2 ct total', 'Diamonds all the way round.', 'diamond');
ring('r_ruby_cluster', 'Crane Ruby Cluster', 1500, 'rare', 'cluster', 5, ['gold18', 'white', 'rose'], 'Ruby centre, diamond cluster', 'A Victorian-style cluster with a deep red ruby.', 'ruby');
ring('r_sapphire_cluster', 'Crane Sapphire Cluster', 1500, 'rare', 'cluster', 5, ['white', 'platinum', 'gold18'], 'Sapphire centre, diamond cluster', 'Royal blue sapphire, very proper.', 'sapphire');
ring('r_statement', 'Ostrander Statement Ring', 3200, 'epic', 'statement', 14, ['gold18', 'white', 'black'], 'Iced dome, 3 ct pavé', 'A dome of diamonds the size of a knuckle.', 'diamond');
ring('r_designer', 'Montague Link Ring', 950, 'rare', 'designer', 8, ['gold18', 'white', 'rose', 'silver'], 'Interlocking link design', 'Two bands that twist round each other. Very designer.');
ring('r_champion', 'Champion’s Ring', 5200, 'legendary', 'statement', 16, ['gold18', 'white'], 'Belt-buckle top, 5 ct', 'Made to look like a title belt. Proper flex.', 'diamond');

// ---- watches ----------------------------------------------------------------------------------
watch('w_digital', 'Kasio Digital', 25, 'common', 'digital', 'rubber', 38, '#9aa79a', 'plain', ['black', 'steel'], 'Resin case, LCD', 'Alarm, stopwatch, backlight. Lasts forever.');
watch('w_sport', 'Halden Sport Diver', 320, 'uncommon', 'round', 'rubber', 42, '#14233d', 'coloured', ['steel', 'titanium', 'black'], '200 m water resistant', 'Rotating dive bezel and a chunky rubber strap.', undefined, '#1f3f8a');
watch('w_chrono', 'Ashworth Chronograph', 680, 'uncommon', 'round', 'bracelet', 42, '#e9e7e0', 'tachy', ['steel', 'twotone', 'black'], 'Chronograph, tachymeter bezel', 'Three sub-dials and a racing bezel.');
watch('w_dress_leather', 'Kingsley Dress Watch', 540, 'uncommon', 'round', 'leather', 39, '#f2efe6', 'plain', ['steel', 'gold9', 'rose'], 'Slim case, leather strap', 'Thin, smart, sits under a cuff.');
watch('w_square', 'Montague Tank', 1250, 'rare', 'square', 'leather', 34, '#f4f1ea', 'plain', ['gold18', 'white', 'steel'], 'Rectangular case, Roman dial', 'Art-deco rectangle on a black strap.');
watch('w_gold_president', 'Velloni Presidente', 4800, 'epic', 'round', 'bracelet', 40, '#d8b04a', 'plain', ['gold18', 'white', 'rose'], 'Solid gold, day-date', 'Solid gold case and bracelet. The weight says it all.');
watch('w_silver_bracelet', 'Crane Oyster-style', 860, 'rare', 'round', 'bracelet', 40, '#1a1a1e', 'plain', ['steel', 'silver', 'twotone'], 'Oyster bracelet, black dial', 'Everyday steel bracelet watch with a black dial.');
watch('w_diamond_bezel', 'Marchetti Diamond Bezel', 6400, 'epic', 'round', 'bracelet', 41, '#f4f4f4', 'diamond', ['gold18', 'white', 'steel'], 'Factory diamond bezel', 'A ring of diamonds round the dial.', 'diamond');
watch('w_iced', 'Fully Iced Ostrander', 12500, 'legendary', 'round', 'iced', 44, '#f4fbff', 'diamond', ['white', 'gold18', 'rose'], 'Pavé case, dial and bracelet', 'Diamonds on every surface. You’ll see it from across the street.', 'diamond');
watch('w_tonneau', 'Ostrander Tonneau Skeleton', 7900, 'epic', 'tonneau', 'rubber', 44, '#3a3a40', 'plain', ['titanium', 'rose', 'black'], 'Skeleton movement, rubber strap', 'Barrel case, see-through dial, very expensive rubber.');
watch('w_nato', 'Field Watch', 140, 'common', 'round', 'nato', 38, '#1c2a1c', 'plain', ['steel', 'black'], 'Canvas NATO strap', 'Army-style field watch. Tough and cheap.');
watch('w_square_digital', 'Smart Square', 260, 'uncommon', 'digital', 'rubber', 42, '#101014', 'plain', ['black', 'steel', 'rose'], 'Smartwatch, OLED', 'Counts your steps and your punches.');

// ---- necklaces --------------------------------------------------------------------------------
chain('n_curb_silver', 'Silver Curb Chain', 70, 'common', 'curb', 3, 'collar', ['silver', 'steel'], '3 mm curb, 20"', 'A fine silver curb chain. Everyday wear.');
chain('n_curb_gold', 'Gold Curb Chain', 420, 'uncommon', 'curb', 4, 'collar', GOLDS, '4 mm curb, 20"', 'Classic gold curb chain.');
chain('n_cuban_8', 'Cuban Link 8 mm', 1600, 'rare', 'cuban', 8, 'collar', ['gold9', 'gold18', 'white', 'silver'], '8 mm Miami Cuban, 20"', 'Thick, flat, heavy Cuban links.');
chain('n_cuban_14', 'Cuban Link 14 mm', 4400, 'epic', 'cuban', 14, 'chest', ['gold9', 'gold18', 'white'], '14 mm Miami Cuban, 22"', 'A proper statement Cuban. Heavy as a padlock.');
chain('n_cuban_iced', 'Iced Cuban', 9800, 'legendary', 'cuban', 12, 'collar', ['white', 'gold18', 'rose'], '12 mm Cuban, fully set', 'Every link set with stones.', undefined, 'diamond');
chain('n_rope_3', 'Fine Rope Chain', 260, 'uncommon', 'rope', 3, 'collar', ['gold9', 'silver', 'rose'], '3 mm rope, 20"', 'Twisted rope chain that catches the light.');
chain('n_rope_6', 'Chunky Rope Chain', 1200, 'rare', 'rope', 6, 'chest', ['gold9', 'gold18', 'silver'], '6 mm rope, 24"', 'Old-school chunky rope.');
chain('n_figaro', 'Figaro Chain', 380, 'uncommon', 'figaro', 4, 'collar', ['gold9', 'silver', 'white'], '4 mm figaro, 22"', 'Three short links and a long one, repeated.');
chain('n_box', 'Box Chain', 150, 'common', 'box', 2, 'choker', ['silver', 'steel', 'gold9'], '2 mm box, 18"', 'Neat square links, close to the neck.');
chain('n_tennis', 'Tennis Necklace', 5600, 'epic', 'tennis', 5, 'collar', ['white', 'platinum', 'gold18'], '5 mm, 10 ct diamonds', 'One line of diamonds all the way round.', undefined, 'diamond');
chain('n_cross', 'Cross Pendant', 280, 'uncommon', 'curb', 3, 'chest', ['gold9', 'silver', 'white'], 'Cross on a 3 mm curb, 22"', 'A plain cross on a fine chain.', 'cross');
chain('n_crucifix', 'Crucifix on Rope', 900, 'rare', 'rope', 4, 'long', ['gold9', 'gold18'], 'Crucifix on 4 mm rope, 26"', 'Large crucifix hanging low on a rope chain.', 'crucifix');
chain('n_medallion', 'Sovereign Medallion', 1500, 'rare', 'curb', 5, 'chest', ['gold9', 'gold18'], 'Full sovereign, 5 mm curb', 'A gold coin mounted as a pendant.', 'medallion');
chain('n_heart', 'Heart Locket', 340, 'uncommon', 'box', 2, 'collar', ['rose', 'silver', 'gold9'], 'Locket on a 2 mm box chain', 'Opens up for a tiny photo.', 'heart');
chain('n_diamond_pendant', 'Solitaire Pendant', 2200, 'epic', 'snake', 2, 'collar', ['white', 'platinum', 'rose'], '1 ct pendant, snake chain', 'A single diamond on a smooth snake chain.', 'diamond', 'diamond');
chain('n_dogtag', 'Dog Tag', 120, 'common', 'ball', 2, 'chest', ['steel', 'silver', 'black'], 'Engraved tag on ball chain', 'Your name stamped in steel.', 'dogtag');
chain('n_glove', 'Gold Boxing Glove', 1100, 'rare', 'rope', 4, 'chest', ['gold9', 'gold18', 'white'], 'Glove pendant, 4 mm rope', 'A pair of tiny gold gloves. Every fighter wants one.', 'boxing_glove');
chain('n_initial', 'Initial Pendant', 460, 'uncommon', 'figaro', 3, 'chest', ['gold9', 'silver', 'rose'], 'Letter pendant, figaro chain', 'Your initial, in solid metal.', 'initial');

// ---- grills -----------------------------------------------------------------------------------
grill('g_single', 'Single Cap', 120, 'common', 'single', 'plain', ['gold9', 'silver', 'gold18'], 'One canine cap', 'One gold tooth. Subtle. Ish.');
grill('g_fangs', 'Fang Caps', 260, 'uncommon', 'fangs', 'plain', ['gold9', 'silver', 'white'], 'Two canine caps', 'A cap on each canine.');
grill('g_top6', 'Top Six', 680, 'uncommon', 'top6', 'plain', ALL_METALS, 'Six upper teeth', 'The classic: six top teeth in solid metal.');
grill('g_top6_outline', 'Open-Face Top Six', 820, 'rare', 'top6', 'outline', ['gold9', 'gold18', 'white'], 'Six upper, open-face', 'Gold outlines with your real teeth showing through.');
grill('g_top8_diamond', 'Iced Top Eight', 3400, 'epic', 'top8', 'diamond', ['white', 'gold18', 'rose'], 'Eight upper, pavé set', 'Eight teeth set with diamonds. Smile carefully.', 'diamond');
grill('g_full', 'Full Set', 1900, 'rare', 'full', 'plain', ['gold9', 'gold18', 'silver', 'white'], 'Top and bottom eight', 'Top and bottom, wall to wall.');
grill('g_full_twotone', 'Two-Tone Full Set', 2300, 'rare', 'full', 'twotone', ['gold9', 'white', 'rose'], 'Top and bottom, alternating', 'Alternating gold and white teeth, top and bottom.');
grill('g_cutout', 'Cut-Out Stars', 1400, 'rare', 'top6', 'cutout', ['gold18', 'white'], 'Six upper, star cut-outs', 'Solid caps with little stars cut through.');
grill('g_full_iced', 'Fully Iced Set', 8800, 'legendary', 'full', 'diamond', ['white', 'gold18', 'platinum'], 'Top and bottom, VVS pavé', 'Every tooth covered in stones. The dentist cried.', 'diamond');

export const JEWEL_LIST: readonly JewelDef[] = LIST;
export const JEWELS: Readonly<Record<string, JewelDef>> = Object.fromEntries(LIST.map((d) => [d.id, d]));

/** What one piece costs in one finish, in pounds (rounded to a fiver, or a pound under £100). */
export function jewelPrice(d: JewelDef, finish: FinishId): number {
  const raw = d.base * FINISHES[finish].mult;
  return raw < 100 ? Math.max(5, Math.round(raw)) : Math.round(raw / 5) * 5;
}

/** What the jeweller pays back for a piece: 45% of what it costs new today. */
export function jewelBuyback(d: JewelDef, finish: FinishId): number {
  return Math.floor(jewelPrice(d, finish) * 0.45);
}

/** How a piece is worn, for the 3D builder: the design plus the metal. */
export interface JewelLook {
  id: string;
  finish: FinishId;
}

export function lookOk(l: unknown): l is JewelLook {
  if (!l || typeof l !== 'object') return false;
  const x = l as JewelLook;
  const d = JEWELS[x.id];
  return !!d && d.finishes.includes(x.finish);
}

/**
 * The plain pieces sold elsewhere (Threads, the pawn shop) drawn the same way when worn,
 * so a gold chain from Threads shows on the new characters too.
 */
export const LEGACY_LOOKS: Readonly<Record<string, JewelLook>> = {
  chain_silver: { id: 'n_curb_silver', finish: 'silver' },
  chain_gold: { id: 'n_rope_3', finish: 'gold9' },
  lucky_chain: { id: 'n_curb_gold', finish: 'gold9' },
  watch_basic: { id: 'w_digital', finish: 'black' },
  ring_signet: { id: 'r_signet_oval', finish: 'gold9' },
};
