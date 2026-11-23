import type { Accessory, BottomStyle, ShoeStyle, TopStyle } from '../character/Appearance';
import { clothingStats } from './gearBonus';
import { WEAPONS, WEAPON_IDS, type WeaponId } from '../combat/Weapons';
import type { AttributeName, DerivedStatName, FlatStatName } from '../stats/Stats';

/**
 * Every item in the game, as data. An item in the world (carried, stored,
 * worn, held) is an ItemStack pointing at one of these by id.
 */

export type ItemCategory = 'weapon' | 'clothing' | 'accessory' | 'consumable' | 'collectible' | 'valuable' | 'quest' | 'misc';
export const ITEM_CATEGORIES: ItemCategory[] = ['weapon', 'clothing', 'accessory', 'consumable', 'collectible', 'valuable', 'quest', 'misc'];
export const CATEGORY_LABELS: Record<ItemCategory, string> = {
  weapon: 'Weapons',
  clothing: 'Clothing',
  accessory: 'Accessories',
  consumable: 'Consumables',
  collectible: 'Collectibles',
  valuable: 'Valuables',
  quest: 'Quest items',
  misc: 'Miscellaneous',
};

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
export const RARITY_COLOURS: Record<Rarity, string> = { common: '#b8b8b0', uncommon: '#6ad04a', rare: '#4aa8ff', epic: '#c070ff', legendary: '#ffb020' };
export const RARITY_LABELS: Record<Rarity, string> = { common: 'Common', uncommon: 'Uncommon', rare: 'Rare', epic: 'Epic', legendary: 'Legendary' };

/** Where worn things go. One item per slot. */
export type WearSlot = 'top' | 'bottoms' | 'shoes' | 'head' | 'face' | 'neck' | 'wrist' | 'bracelet' | 'ears' | 'hands' | 'finger' | 'waist' | 'mouth' | 'back';
export const WEAR_SLOTS: WearSlot[] = ['back', 'top', 'bottoms', 'shoes', 'head', 'face', 'neck', 'wrist', 'bracelet', 'ears', 'hands', 'finger', 'waist', 'mouth'];
export const WEAR_SLOT_LABELS: Record<WearSlot, string> = {
  top: 'Top', bottoms: 'Bottoms', shoes: 'Footwear', head: 'Head', face: 'Face', neck: 'Neck', wrist: 'Wrist', bracelet: 'Bracelet', ears: 'Ears', hands: 'Hands', finger: 'Ring', waist: 'Belt', mouth: 'Gumshield', back: 'Bag',
};

export interface ItemStat {
  attr?: AttributeName;
  stat?: DerivedStatName;
  flat?: FlatStatName;
  add?: number;
  mul?: number;
  text: string;
}

export interface WearSpec {
  slot: WearSlot;
  top?: TopStyle;
  bottoms?: BottomStyle;
  shoes?: ShoeStyle;
  accessory?: Accessory;
  chain?: 'gold' | 'silver';
  /** Default colour when bought or found. */
  colour?: string;
}

export interface UseSpec {
  /** What it does for hunger, energy, diet and bladder (see home/needs.ts). */
  needs?: { fill: number; diet: number; energy?: number; bladder?: number };
  heal?: number;
  stamina?: number;
  /** Fraction of max health. */
  healPct?: number;
  text: string;
}

/** Drawn by the icon painter. */
export type IconKind =
  | 'weapon' | 'top' | 'bottoms' | 'shoes' | 'cap' | 'beanie' | 'bucket_hat' | 'flat_cap' | 'glasses' | 'sunglasses' | 'snood' | 'chain' | 'watch' | 'smartwatch' | 'ring'
  | 'earring' | 'bracelet' | 'belt' | 'wraps' | 'gumshield' | 'headguard' | 'food' | 'drink' | 'medkit' | 'phone' | 'tablet'
  | 'headphones' | 'console' | 'handheld' | 'camera' | 'coin' | 'cash' | 'wallet_hw' | 'handbag' | 'trainers' | 'shirt_signed'
  | 'programme' | 'antique' | 'vinyl' | 'key' | 'document' | 'scrap' | 'bag' | 'card' | 'football' | 'grocery' | 'plate';

export interface ItemDef {
  id: string;
  name: string;
  text: string;
  category: ItemCategory;
  rarity: Rarity;
  /** Full value in pounds. Shops charge around this; the pawn shop offers less. */
  value: number;
  /** How many fit in one inventory slot. */
  stack: number;
  /** For the icon and pickup model. */
  icon: IconKind;
  colour: string;
  weapon?: WeaponId;
  wear?: WearSpec;
  use?: UseSpec;
  stats?: ItemStat[];
  /** Quest items can't be sold or dropped. */
  questFlag?: string;
  /** Pawn shop won't take it (worthless, or a quest item). */
  unsellable?: boolean;
  /** Food that keeps in the kitchen: which of the fridge or the cupboards it lives in. */
  store?: 'fridge' | 'cupboard';
  /** A cooking ingredient (not eaten on its own). */
  ingredient?: boolean;
  /** Carried for a job (src/jobs): can't be sold, dropped or stashed, and goes when the job does. */
  jobItem?: boolean;
  /** Drugs for dealing (business/dealing.ts): always stolen, so the police take it; the pawn shop won't. */
  contraband?: boolean;
}

const defs: ItemDef[] = [];
const add = (d: Omit<ItemDef, 'stack'> & { stack?: number }) => defs.push({ stack: 1, ...d });

// ---- weapons -------------------------------------------------------------------------
for (const id of WEAPON_IDS) {
  const w = WEAPONS[id];
  add({
    id: `w_${id}`,
    name: w.name,
    text: w.text,
    category: 'weapon',
    rarity: w.value >= 30 ? 'uncommon' : 'common',
    value: w.value,
    icon: 'weapon',
    colour: w.colour,
    weapon: id,
    unsellable: w.value <= 0,
  });
}

// ---- clothing ------------------------------------------------------------------------
// Every piece's stats come from its style and its tier (its rarity): gearBonus.ts.
const clothes = (d: Omit<ItemDef, 'stack'>) => add({ ...d, stats: clothingStats(d) });
const top = (id: string, name: string, style: TopStyle, value: number, colour: string, text: string, rarity: Rarity = 'common') =>
  clothes({ id, name, text, category: 'clothing', rarity, value, icon: 'top', colour, wear: { slot: 'top', top: style, colour } });
const bottoms = (id: string, name: string, style: BottomStyle, value: number, colour: string, text: string, rarity: Rarity = 'common') =>
  clothes({ id, name, text, category: 'clothing', rarity, value, icon: 'bottoms', colour, wear: { slot: 'bottoms', bottoms: style, colour } });
const shoes = (id: string, name: string, style: ShoeStyle, value: number, colour: string, text: string, rarity: Rarity = 'common') =>
  clothes({ id, name, text, category: 'clothing', rarity, value, icon: 'shoes', colour, wear: { slot: 'shoes', shoes: style, colour } });

top('hoodie_grey', 'Grey hoodie', 'hoodie', 25, '#6a6d74', 'Plain pullover hoodie, kangaroo pocket.');
top('hoodie_black', 'Black hoodie', 'hoodie', 25, '#1b1d22', 'Plain pullover hoodie, kangaroo pocket.');
top('designer_hoodie', 'Designer hoodie', 'designer_hoodie', 140, '#e8e6e1', 'Heavy cotton, big chest logo, priced to match.', 'rare');
top('tracksuit_top', 'Tracksuit top', 'tracksuit', 45, '#1f2a44', 'Zip-up with stripes down the arms.');
top('tracksuit_top_red', 'Red tracksuit top', 'tracksuit', 45, '#b3121b', 'Zip-up with stripes down the arms.');
top('tshirt_white', 'White T-shirt', 'tshirt', 12, '#e8e6e1', 'Crew neck, short sleeves.');
top('tshirt_black', 'Black T-shirt', 'tshirt', 12, '#1b1d22', 'Crew neck, short sleeves.');
top('football_home', 'Football shirt (home)', 'football', 55, '#b3121b', 'Local club, this season’s home kit.');
top('football_away', 'Football shirt (away)', 'football', 55, '#e8e6e1', 'Local club, this season’s away kit.');
top('bomber_jacket', 'Bomber jacket', 'bomber', 70, '#2f4a2d', 'Satin shell, ribbed cuffs, orange lining.', 'uncommon');
top('puffer_black', 'Black puffer jacket', 'puffer', 110, '#1b1d22', 'Quilted and warm. Takes the edge off a hit.', 'uncommon');
top('puffer_red', 'Red puffer jacket', 'puffer', 110, '#7d1a1a', 'Quilted and warm. Takes the edge off a hit.', 'uncommon');
top('leather_jacket', 'Leather jacket', 'leather', 160, '#1a1410', 'Thick leather. Tough, but you feel it on your shoulders.', 'rare');
top('denim_jacket', 'Denim jacket', 'denim', 60, '#2f5a8a', 'Stonewashed with brass buttons.');
top('long_coat', 'Long wool coat', 'coat', 120, '#2b2e35', 'Knee-length overcoat. Smart.', 'uncommon');
top('vest_white', 'White vest', 'vest', 8, '#e8e6e1', 'Ribbed vest.');
top('workwear_hivis', 'Hi-vis work jacket', 'workwear', 30, '#e8d000', 'Site jacket with reflective bands.');
top('hoodie_navy', 'Navy hoodie', 'hoodie', 25, '#1f2a44', 'Plain pullover hoodie, kangaroo pocket.');
top('tshirt_grey', 'Grey marl T-shirt', 'tshirt', 12, '#8a8c90', 'Crew neck, short sleeves.');
top('tracksuit_top_grey', 'Grey tracksuit top', 'tracksuit', 45, '#55585e', 'Zip-up with stripes down the arms.');
top('puffer_navy', 'Navy puffer jacket', 'puffer', 110, '#1f2a44', 'Quilted and warm. Takes the edge off a hit.', 'uncommon');
top('polo_navy', 'Navy polo shirt', 'polo', 30, '#1f2a44', 'Piqué cotton, two-button placket, ribbed collar.');
top('polo_white', 'White polo shirt', 'polo', 30, '#e8e6e1', 'Piqué cotton, two-button placket, ribbed collar.');
top('polo_bottle', 'Bottle green polo', 'polo', 30, '#1d3b2a', 'Piqué cotton, two-button placket, ribbed collar.');
top('shirt_oxford', 'Oxford shirt', 'shirt', 35, '#c9d4e6', 'Pale blue button-down, worn untucked.');
top('shirt_check', 'Check overshirt', 'shirt', 38, '#7a2a24', 'Brushed cotton flannel, full button front.');
top('jumper_navy', 'Crew-neck jumper', 'jumper', 40, '#1f2a44', 'Lambswool knit with ribbed cuffs and hem.');
top('jumper_oat', 'Oatmeal jumper', 'jumper', 40, '#b9a888', 'Lambswool knit with ribbed cuffs and hem.');
top('quarter_zip_black', 'Quarter-zip top', 'quarter_zip', 45, '#1b1d22', 'Fleece pullover, half zip at the neck.');
top('quarter_zip_grey', 'Grey quarter-zip', 'quarter_zip', 45, '#55585e', 'Fleece pullover, half zip at the neck.');
top('gilet_black', 'Black gilet', 'gilet', 65, '#1b1d22', 'Quilted body warmer, no sleeves. Arms stay free.', 'common');
top('gilet_olive', 'Olive gilet', 'gilet', 65, '#3d4a2a', 'Quilted body warmer, no sleeves. Arms stay free.', 'common');
top('windbreaker', 'Windbreaker', 'windbreaker', 55, '#2f6fa8', 'Packable nylon shell with a hood and a chest panel.');
top('windbreaker_retro', 'Retro windbreaker', 'windbreaker', 60, '#6b2a6a', 'Nineties colour-block nylon shell.');
top('harrington_stone', 'Harrington jacket', 'harrington', 75, '#b9a27a', 'Cotton jacket with a check lining and ribbed cuffs.', 'uncommon');
top('harrington_black', 'Black Harrington', 'harrington', 75, '#1b1d22', 'Cotton jacket with a check lining and ribbed cuffs.', 'uncommon');

// The top of the range: Luxury (epic) and Iconic (legendary) labels.
top('designer_tracksuit_top', 'Designer tracksuit top', 'tracksuit', 420, '#141414', 'Heavy jersey, gold zip, embroidered crest. Built for speed and for being seen.', 'epic');
top('luxury_puffer', 'Luxury puffer', 'puffer', 650, '#0e1a2e', 'Goose down, glossy shell, fur-trim hood. Takes a hit like a duvet.', 'epic');
top('luxury_leather', 'Luxury leather jacket', 'leather', 780, '#2a1410', 'Lambskin, quilted shoulders. Barely weighs a thing for leather.', 'epic');
top('iconic_hoodie', 'Iconic hoodie', 'designer_hoodie', 1100, '#d8c49a', 'Numbered run of 50, signed tag. People ask where you got it.', 'legendary');
top('iconic_puffer', 'Iconic puffer', 'puffer', 1600, '#b3121b', 'The one from the music videos. Waiting list, or you know someone.', 'legendary');
bottoms('designer_trackies', 'Designer trackies', 'trackies', 360, '#141414', 'Matching jersey with a gold stripe.', 'epic');
bottoms('luxury_jeans', 'Selvedge jeans', 'jeans', 420, '#1b2a44', 'Japanese selvedge denim, raw indigo.', 'epic');
bottoms('iconic_joggers', 'Iconic joggers', 'joggers', 950, '#d8c49a', 'From the same numbered run as the hoodie.', 'legendary');
shoes('designer_trainers', 'Designer trainers', 'trainers', 480, '#f2efe8', 'Italian leather low-tops, gold heel tab.', 'epic');
shoes('luxury_runners', 'Carbon runners', 'runners', 520, '#101014', 'Carbon plate, super-foam. Banned from some races.', 'epic');
shoes('grail_trainers', 'Grail trainers', 'trainers', 1800, '#d4a017', 'Deadstock, never on general release. The ones everyone wants.', 'legendary');
shoes('iconic_boots', 'Iconic boots', 'boots', 1250, '#1a1410', 'Hand-welted, steel shank. Every kick lands like a brick.', 'legendary');

bottoms('trackies_black', 'Black trackies', 'trackies', 25, '#1b1d22', 'Tracksuit bottoms with side stripes.');
bottoms('joggers_grey', 'Grey joggers', 'joggers', 25, '#6a6d74', 'Cuffed fleece joggers.');
bottoms('jeans_blue', 'Blue jeans', 'jeans', 40, '#2f4f7a', 'Straight-leg denim.');
bottoms('jeans_black', 'Black jeans', 'jeans', 40, '#1b1d22', 'Straight-leg denim.');
bottoms('cargos_khaki', 'Cargo trousers', 'cargos', 45, '#5b5a3a', 'Side pockets for everything.');
bottoms('shorts_black', 'Fight shorts', 'shorts', 20, '#1b1d22', 'Loose training shorts.');
bottoms('work_trousers', 'Work trousers', 'workwear', 30, '#2b2e35', 'Heavy canvas with knee pads.');
bottoms('trackies_navy', 'Navy trackies', 'trackies', 25, '#1f2a44', 'Tracksuit bottoms with side stripes.');
bottoms('joggers_black', 'Black joggers', 'joggers', 25, '#1b1d22', 'Cuffed fleece joggers.');
bottoms('jeans_light', 'Light-wash jeans', 'jeans', 40, '#5a7da0', 'Straight-leg denim, faded.');
bottoms('chinos_stone', 'Stone chinos', 'chinos', 35, '#b9a27a', 'Cotton twill, tapered leg.');
bottoms('chinos_navy', 'Navy chinos', 'chinos', 35, '#1f2a44', 'Cotton twill, tapered leg.');
bottoms('cargo_shorts', 'Cargo shorts', 'cargo_shorts', 28, '#5b5a3a', 'Knee-length with side pockets.');
bottoms('denim_shorts', 'Denim shorts', 'denim_shorts', 25, '#5a7da0', 'Cut-off denim, rolled hems.');

shoes('trainers_white', 'White trainers', 'trainers', 60, '#e8e6e1', 'Clean low-tops.');
shoes('runners', 'Running trainers', 'runners', 80, '#2f6fa8', 'Light and bouncy.', 'common');
shoes('hitops_black', 'High-tops', 'hitops', 75, '#1b1d22', 'Ankle-height basketball shoes.');
shoes('boots_work', 'Work boots', 'boots', 70, '#5b3a24', 'Lace-up leather boots.');
shoes('steel_toecaps', 'Steel toecap boots', 'boots', 90, '#151515', 'Kicks land heavier.', 'uncommon');
shoes('rare_trainers_worn', 'Limited trainers', 'trainers', 220, '#d4a017', 'Limited run, still in good nick. Worth more boxed.', 'rare');
shoes('trainers_black', 'Black trainers', 'trainers', 60, '#1b1d22', 'All-black low-tops.');
shoes('trainers_navy', 'Navy trainers', 'trainers', 60, '#1f2a44', 'Suede low-tops, gum-white sole.');
shoes('runners_red', 'Red running trainers', 'runners', 80, '#b3121b', 'Light and bouncy.', 'common');
shoes('hitops_white', 'White high-tops', 'hitops', 75, '#e8e6e1', 'Ankle-height basketball shoes.');

// ---- accessories --------------------------------------------------------------------
const acc = (id: string, name: string, slot: WearSlot, a: Accessory, value: number, icon: IconKind, colour: string, text: string, rarity: Rarity = 'common', stats?: ItemStat[], chain?: 'gold' | 'silver') => {
  const d = { id, name, text, category: 'accessory' as const, rarity, value, icon, colour, wear: { slot, accessory: a, colour, chain } };
  add({ ...d, stats: clothingStats(d, stats) });
};
acc('wraps', 'Hand wraps', 'hands', 'wraps', 8, 'wraps', '#e2ddd2', 'Protect the knuckles.', 'common', [{ stat: 'damageMult', mul: 1.05, text: '+5% damage' }]);
acc('mouthguard', 'Gumshield', 'mouth', 'mouthguard', 15, 'gumshield', '#3a7ab0', 'Hard to rattle with one in.', 'common', [
  { flat: 'maxPoise', add: 20, text: '+20 poise' },
  { flat: 'maxHealth', add: 10, text: '+10 max health' },
]);
acc('headguard', 'Head guard', 'head', 'headguard', 45, 'headguard', '#9b1c1c', 'Sparring head guard.', 'uncommon', [{ stat: 'damageTakenMult', mul: 0.95, text: '−5% damage taken' }]);
acc('cap_black', 'Black cap', 'head', 'cap', 18, 'cap', '#1b1d22', 'Flat brim, plain.');
acc('cap_red', 'Red cap', 'head', 'cap', 18, 'cap', '#b3121b', 'Flat brim, plain.');
acc('beanie', 'Beanie', 'head', 'beanie', 14, 'beanie', '#2b2e35', 'Ribbed knit hat.');
acc('sunglasses', 'Sunglasses', 'face', 'sunglasses', 25, 'sunglasses', '#101012', 'Dark lenses.');
acc('cap_navy', 'Navy cap', 'head', 'cap', 18, 'cap', '#1f2a44', 'Curved peak, six panels.');
acc('cap_white', 'White cap', 'head', 'cap', 18, 'cap', '#e8e6e1', 'Curved peak, six panels.');
acc('beanie_red', 'Red beanie', 'head', 'beanie', 14, 'beanie', '#b3121b', 'Ribbed knit hat.');
acc('beanie_grey', 'Grey beanie', 'head', 'beanie', 14, 'beanie', '#6a6d74', 'Ribbed knit hat.');
acc('bucket_hat', 'Bucket hat', 'head', 'bucket_hat', 22, 'bucket_hat', '#5b5a3a', 'Canvas, stitched brim all the way round.');
acc('bucket_hat_black', 'Black bucket hat', 'head', 'bucket_hat', 22, 'bucket_hat', '#1b1d22', 'Canvas, stitched brim all the way round.');
acc('flat_cap', 'Flat cap', 'head', 'flat_cap', 30, 'flat_cap', '#4a4038', 'Wool tweed. Your grandad would approve.');
acc('glasses', 'Glasses', 'face', 'glasses', 30, 'glasses', '#2a2420', 'Clear lenses in dark frames.');
acc('snood', 'Face covering', 'face', 'snood', 12, 'snood', '#1b1d22', 'Neck snood pulled up over the face.');
acc('lucky_chain', 'Lucky gold chain', 'neck', 'chain', 120, 'chain', '#d4af37', 'Your nan’s. You fight smarter wearing it.', 'rare', [{ attr: 'technique', add: 3, text: '+3 Technique' }], 'gold');
acc('chain_silver', 'Silver chain', 'neck', 'chain', 60, 'chain', '#c9ccd2', 'Fine silver curb chain.', 'common', undefined, 'silver');
acc('chain_gold', 'Gold chain', 'neck', 'chain', 180, 'chain', '#d4af37', 'Thin 9ct gold chain from Threads.', 'uncommon', undefined, 'gold');
acc('watch_basic', 'Digital watch', 'wrist', 'watch', 20, 'watch', '#1b1d22', 'Does the job.');
acc('earring_silver', 'Silver earring', 'ears', 'earring', 25, 'earring', '#c9ccd2', 'Small hoop.');
acc('ring_signet', 'Signet ring', 'finger', 'ring', 90, 'ring', '#d4af37', 'Heavy gold signet. Adds weight to a punch.', 'uncommon', [{ stat: 'damageMult', mul: 1.03, text: '+3% damage' }]);
acc('belt_leather', 'Leather belt', 'waist', 'belt', 20, 'belt', '#3a2414', 'Brown leather, brass buckle.');

// ---- consumables -------------------------------------------------------------------------
const needsText = (n: UseSpec['needs']) => (n ? `, fills ${n.fill}% hunger` : '');
const food = (id: string, name: string, heal: number, value: number, text: string, colour: string, stamina = 0, needs?: UseSpec['needs']) => {
  const n = needs ?? { fill: Math.round(heal * 0.9), diet: 30 };
  add({ id, name, text, category: 'consumable', rarity: 'common', value, stack: 5, icon: 'food', colour, use: { heal, stamina, needs: n, text: `+${heal} health${stamina ? `, +${stamina} stamina` : ''}${needsText(n)}` } });
};
const drink = (id: string, name: string, stamina: number, value: number, text: string, colour: string, heal = 0, needs?: UseSpec['needs']) => {
  const n = needs ?? { fill: 3, diet: 40, bladder: 15 };
  add({ id, name, text, category: 'consumable', rarity: 'common', value, stack: 5, icon: 'drink', colour, store: 'fridge', use: { stamina, heal, needs: n, text: `+${stamina} stamina${heal ? `, +${heal} health` : ''}` } });
};
food('chips', 'Chips', 15, 3, 'Salt and vinegar, wrapped in paper.', '#e8c060', 0, { fill: 25, diet: 20 });
food('kebab', 'Kebab', 28, 7, 'Doner with everything.', '#c88a4a', 0, { fill: 45, diet: 25 });
food('pasty', 'Pasty', 20, 3, 'Steak and potato, still warm.', '#d8a050', 0, { fill: 35, diet: 30 });
food('sausage_roll', 'Sausage roll', 15, 2, 'Flaky pastry, greasy bag.', '#d8a860', 0, { fill: 25, diet: 25 });
food('meal_deal', 'Meal deal', 22, 4, 'Sandwich, crisps and a drink.', '#4a9a5a', 10, { fill: 35, diet: 45, bladder: 8 });
food('bacon_butty', 'Bacon butty', 20, 3, 'Brown sauce, obviously.', '#c86040', 0, { fill: 30, diet: 35 });
food('curry', 'Curry', 30, 9, 'Chicken tikka and rice from the takeaway.', '#d88a2a', 0, { fill: 50, diet: 45 });
food('fry_up', 'Full English', 40, 10, 'Everything on one plate.', '#e8a040', 20, { fill: 60, diet: 45, energy: 10 });
food('protein_bar', 'Protein bar', 10, 2, 'Chewy. Tastes of chalk.', '#5a3a2a', 15, { fill: 12, diet: 60, energy: 5 });
drink('energy_drink', 'Energy drink', 60, 2, 'Can of something fizzy and bright.', '#3ad84a', 0, { fill: 0, diet: 10, energy: 15, bladder: 18 });
drink('can_of_pop', 'Can of pop', 30, 1, 'Fizzy and cold.', '#d82a2a', 5, { fill: 2, diet: 10, bladder: 15 });
drink('water', 'Bottle of water', 40, 1, 'Fresh and cold.', '#8ac8ff', 0, { fill: 0, diet: 70, bladder: 15 });
drink('flask_tea', 'Flask of tea', 35, 3, 'Strong, two sugars.', '#8a5a3a', 15, { fill: 2, diet: 40, energy: 6, bladder: 15 });

// ---- the kitchen: groceries, snacks and home-cooked meals (Stage 12) ----------------------------
/** A cooking ingredient: kept in the fridge or the cupboards, used by recipes (home/recipes.ts). */
/** Kitchen groceries: ingredients for cooking. The ones you'd have cold (milk, cheese, ham...) can be eaten as they are too. */
const grocery = (id: string, name: string, store: 'fridge' | 'cupboard', value: number, colour: string, text: string, cold?: UseSpec) =>
  add({ id, name, text, category: 'misc', rarity: 'common', value, stack: 10, icon: 'grocery', colour, store, ingredient: true, unsellable: true, use: cold });
grocery('g_bread', 'Loaf of bread', 'cupboard', 1, '#d8a860', 'Thick sliced white. A few slices per meal.', { text: 'A couple of slices', needs: { fill: 10, diet: 25 }, heal: 2 });
grocery('g_butter', 'Butter', 'fridge', 2, '#f4dc70', 'Proper butter, not spread.');
grocery('g_cheese', 'Cheddar', 'fridge', 3, '#f0c040', 'Mature. Grates, slices, melts.', { text: 'A few slices of cheese', needs: { fill: 12, diet: 30 }, heal: 3 });
grocery('g_ham', 'Sliced ham', 'fridge', 2, '#e89a9a', 'Pack of thick-cut ham.', { text: 'A few slices of ham', needs: { fill: 12, diet: 35 }, heal: 3 });
grocery('g_eggs', 'Eggs', 'fridge', 2, '#f4ecd8', 'Free range, half a dozen.');
grocery('g_milk', 'Milk', 'fridge', 1, '#f8f8f4', 'Semi-skimmed, two pints.', { text: 'A big glass of milk', needs: { fill: 6, diet: 50, bladder: 8 }, stamina: 8 });
grocery('g_cereal', 'Cereal', 'cupboard', 2, '#d84a2a', 'Big box of cornflakes.', { text: 'A handful, dry', needs: { fill: 8, diet: 30 }, heal: 2 });
grocery('g_beans', 'Baked beans', 'cupboard', 1, '#3a7ad8', 'Tin of beans in tomato sauce.');
grocery('g_bacon', 'Bacon', 'fridge', 3, '#d86a5a', 'Back bacon, smoked.');
grocery('g_sausages', 'Sausages', 'fridge', 3, '#c87a5a', 'Pork bangers from the butcher.');
grocery('g_potatoes', 'Potatoes', 'cupboard', 1, '#b8945a', 'Bag of Maris Pipers.');
grocery('g_chicken', 'Chicken breasts', 'fridge', 4, '#f0d0b8', 'Two chicken breasts.');
grocery('g_steak', 'Sirloin steak', 'fridge', 7, '#a8303a', 'A proper bit of steak.');
grocery('g_pasta', 'Pasta', 'cupboard', 1, '#e8d080', 'Bag of penne.');
grocery('g_sauce', 'Pasta sauce', 'cupboard', 2, '#c83a2a', 'Jar of tomato and basil.');
grocery('g_mince', 'Beef mince', 'fridge', 4, '#a8484a', 'Lean steak mince.');
grocery('g_buns', 'Burger buns', 'cupboard', 1, '#d89a50', 'Sesame seed buns.');
grocery('g_curry_sauce', 'Curry sauce', 'cupboard', 2, '#d88a2a', 'Jar of tikka masala.');
grocery('g_rice', 'Rice', 'cupboard', 1, '#f4f0e6', 'Basmati.');
grocery('g_onions', 'Onions', 'cupboard', 1, '#c8a060', 'A net of onions.');
grocery('g_mushrooms', 'Mushrooms', 'fridge', 1, '#c8b8a0', 'Punnet of chestnut mushrooms.');
grocery('g_tomatoes', 'Tomatoes', 'fridge', 1, '#e04030', 'Vine tomatoes.', { text: 'Eat one like an apple', needs: { fill: 5, diet: 80 }, heal: 2 });
grocery('g_peas', 'Frozen peas', 'fridge', 1, '#5ab040', 'From the freezer drawer.');
grocery('g_oven_chips', 'Oven chips', 'fridge', 2, '#e8c060', 'Freezer bag of crinkle cuts.');

/** Snacks: straight from the cupboard. */
const snack = (id: string, name: string, value: number, colour: string, text: string, needs: NonNullable<UseSpec['needs']>, stamina = 0) =>
  add({ id, name, text, category: 'consumable', rarity: 'common', value, stack: 10, icon: 'grocery', colour, store: 'cupboard', use: { stamina, needs, text: `Fills ${needs.fill}% hunger${stamina ? `, +${stamina} stamina` : ''}` } });
snack('s_crisps', 'Crisps', 1, '#3a6ad8', 'Ready salted. Gone in a minute.', { fill: 10, diet: 15 });
snack('s_chocolate', 'Chocolate bar', 1, '#6a3a20', 'A quick sugar hit.', { fill: 10, diet: 10, energy: 8 }, 10);
snack('s_fruit', 'Apple', 1, '#5ab040', 'Crisp and green. Good for you.', { fill: 10, diet: 85 });
snack('s_biscuits', 'Biscuits', 1, '#c88a40', 'Chocolate digestives. One more won\u2019t hurt.', { fill: 12, diet: 15 });

/** Home-cooked meals (what the recipes make). Leftovers keep in the fridge. */
const meal = (id: string, name: string, colour: string, text: string, heal: number, needs: NonNullable<UseSpec['needs']>, stamina = 0) =>
  add({ id, name, text, category: 'consumable', rarity: 'common', value: 0, stack: 4, icon: 'plate', colour, store: 'fridge', unsellable: true, use: { heal, stamina, needs, text: `+${heal} health, fills ${needs.fill}% hunger` } });
meal('m_sandwich', 'Ham and cheese sandwich', '#e8c070', 'Made it yourself. Cut into triangles.', 20, { fill: 35, diet: 50 });
meal('m_toast', 'Buttered toast', '#d89a50', 'Two slices, plenty of butter.', 12, { fill: 20, diet: 35 });
meal('m_cereal', 'Bowl of cereal', '#e8a040', 'Cornflakes and cold milk.', 12, { fill: 25, diet: 55 });
meal('m_beans_toast', 'Beans on toast', '#e05a2a', 'A British classic.', 25, { fill: 40, diet: 60 });
meal('m_scrambled', 'Scrambled eggs on toast', '#f4d050', 'Soft and buttery.', 25, { fill: 40, diet: 65, energy: 4 });
meal('m_full_english', 'Home-cooked full English', '#e8a040', 'Bacon, sausage, egg, beans, mushrooms, tomato, toast. Keeps you going all trip.', 60, { fill: 75, diet: 50, energy: 15 }, 20);
meal('m_sausage_mash', 'Sausage and mash', '#c87a5a', 'Bangers, buttery mash, peas.', 45, { fill: 65, diet: 60, energy: 8 });
meal('m_chicken_chips', 'Chicken and chips', '#e8c060', 'Oven-baked chicken breast and crinkle chips.', 45, { fill: 65, diet: 55, energy: 8 });
meal('m_steak', 'Steak and potatoes', '#a8303a', 'Sirloin, roast potatoes, mushrooms.', 55, { fill: 70, diet: 72, energy: 12 }, 10);
meal('m_pasta', 'Pasta bake', '#c83a2a', 'Penne in tomato sauce under melted cheddar.', 40, { fill: 60, diet: 65, energy: 6 });
meal('m_burger', 'Homemade cheeseburger', '#a8484a', 'Smash burger, onions, cheese.', 45, { fill: 60, diet: 42, energy: 6 });
meal('m_curry', 'Chicken curry and rice', '#d88a2a', 'Tikka masala with basmati.', 50, { fill: 70, diet: 70, energy: 10 });
add({ id: 'plasters', name: 'Plasters', text: 'A box of plasters. Sees to bruising, and works however full you are.', category: 'consumable', rarity: 'common', value: 3, stack: 10, icon: 'medkit', colour: '#e8c8a0', use: { heal: 35, text: '+35 health, treats bruising' } });
add({ id: 'first_aid', name: 'First aid kit', text: 'Bandages, wipes, the lot. Patches up your worst injury too.', category: 'consumable', rarity: 'uncommon', value: 10, stack: 5, icon: 'medkit', colour: '#d81e1e', use: { healPct: 0.6, text: 'Restores 60% of your health, treats your worst injury' } });

// ---- valuables (sell at the pawn shop) --------------------------------------------------------
const val = (id: string, name: string, icon: IconKind, rarity: Rarity, value: number, colour: string, text: string, stack = 1) =>
  add({ id, name, text, category: 'valuable', rarity, value, stack, icon, colour });
// jewellery
val('watch_diver', 'Marchetti Diamond Bezel (steel)', 'watch', 'epic', 1920, '#c9ccd2', 'Steel case, a ring of diamonds round the dial. Goes straight in your jewellery box, unless it’s stolen.');
val('watch_gold', 'Kingsley Dress Watch (9ct gold)', 'watch', 'rare', 540, '#d4af37', 'Slim gold case, leather strap. Goes straight in your jewellery box, unless it’s stolen.');
val('watch_silver', 'Crane Oyster-style (steel)', 'watch', 'uncommon', 260, '#c9ccd2', 'Steel bracelet, black dial. Goes straight in your jewellery box, unless it’s stolen.');
val('watch_cheap', 'Kasio Digital (black)', 'watch', 'common', 30, '#2c2c31', 'Alarm, stopwatch, backlight. Goes straight in your jewellery box, unless it’s stolen.', 3);
val('chain_cuban', 'Cuban Link 8 mm (9ct gold)', 'chain', 'epic', 1600, '#d4af37', 'Thick gold Cuban links. Weighs a ton. Goes straight in your jewellery box, unless it’s stolen.');
val('chain_rope', 'Fine Rope Chain (9ct gold)', 'chain', 'rare', 260, '#d4af37', 'Twisted 3 mm rope that catches the light. Goes straight in your jewellery box, unless it’s stolen.');
val('chain_cheap', 'Box Chain (steel)', 'chain', 'common', 45, '#b9bdc4', 'Neat square links. Goes straight in your jewellery box, unless it’s stolen.', 3);
val('bracelet_gold', 'Curb Bracelet (9ct gold)', 'bracelet', 'rare', 200, '#d4af37', 'Chunky curb links. Goes straight in your jewellery box, unless it’s stolen.');
val('bracelet_silver', 'Curb Bracelet (silver)', 'bracelet', 'uncommon', 70, '#c9ccd2', 'Chunky silver links. Goes straight in your jewellery box, unless it’s stolen.', 3);
val('ring_gold', 'Kingsley Flat Band (9ct gold)', 'ring', 'uncommon', 220, '#d4af37', 'A wide flat gold band. Goes straight in your jewellery box, unless it’s stolen.', 3);
val('ring_diamond', 'Velloni Solitaire (white gold)', 'ring', 'epic', 2800, '#e8f4ff', 'One proper diamond on white gold. Goes straight in your jewellery box, unless it’s stolen.');
val('earrings_diamond', 'Diamond Studs (white gold)', 'earring', 'rare', 840, '#e8f4ff', 'A proper diamond in each ear. Goes straight in your jewellery box, unless it’s stolen.');
// electronics
val('phone_flagship', 'Flagship smartphone', 'phone', 'rare', 380, '#2a2d33', 'This year’s model, barely a scratch.');
val('phone_cheap', 'Budget smartphone', 'phone', 'common', 35, '#3a3d44', 'Cracked screen. Still turns on.', 3);
val('tablet', 'Tablet', 'tablet', 'uncommon', 160, '#c9ccd2', 'Ten-inch tablet with a case.');
val('headphones', 'Wireless headphones', 'headphones', 'uncommon', 120, '#1b1d22', 'Noise-cancelling over-ears.');
val('console', 'Games console', 'console', 'rare', 280, '#1b1d22', 'Current-gen console, no box.');
val('handheld', 'Handheld console', 'handheld', 'uncommon', 150, '#d81e1e', 'Switch-sized handheld with a cartridge in.');
val('smartwatch', 'Smartwatch', 'smartwatch', 'uncommon', 110, '#2a2d33', 'Fitness-tracking smartwatch.');
val('camera', 'Digital camera', 'camera', 'rare', 300, '#1b1d22', 'Mirrorless camera with a decent lens.');
// money
val('coin_sovereign', 'Gold sovereign', 'coin', 'rare', 450, '#d4af37', 'Full gold sovereign coin.', 10);
val('coin_silver', 'Silver coin', 'coin', 'uncommon', 25, '#c9ccd2', 'One-ounce silver bullion coin.', 10);
val('coin_rare', 'Rare 50p', 'coin', 'uncommon', 60, '#b8b8b0', 'Error coin. Collectors pay silly money.', 10);
val('old_fiver', 'Old white fiver', 'cash', 'rare', 220, '#e8e4d8', 'Pre-decimal five pound note. Collectible.', 5);
val('cash_bundle', 'Bundle of cash', 'cash', 'uncommon', 150, '#6a9a5a', 'Rolled twenties with an elastic band.', 10);
val('crypto_wallet', 'Hardware crypto wallet', 'wallet_hw', 'epic', 1400, '#1b1d22', 'Cold-storage wallet. The PIN’s taped to the back.');
// other
val('sunglasses_designer', 'Designer sunglasses', 'sunglasses', 'uncommon', 180, '#1b1d22', 'Big-name frames in a hard case.');
val('handbag_designer', 'Designer handbag', 'handbag', 'rare', 650, '#7a1a1a', 'Monogrammed leather handbag.');
val('trainers_boxed', 'Rare trainers (boxed)', 'trainers', 'epic', 900, '#d4a017', 'Deadstock limited release, never worn.');

// ---- collectibles (also sell, worth more as a set) -------------------------------------------
const col = (id: string, name: string, icon: IconKind, rarity: Rarity, value: number, colour: string, text: string) =>
  add({ id, name, text, category: 'collectible', rarity, value, icon, colour });
col('signed_shirt', 'Signed football shirt', 'shirt_signed', 'epic', 750, '#b3121b', 'Signed by the whole cup-winning squad.');
col('programme_1966', '1966 final programme', 'programme', 'legendary', 1500, '#e8e4d8', 'Original programme from the 1966 final.');
col('vintage_football', 'Vintage match ball', 'football', 'rare', 320, '#8a5a32', 'Laced leather ball, signed.');
col('pocket_watch', 'Antique pocket watch', 'antique', 'rare', 480, '#d4af37', 'Victorian silver hunter, engraved.');
col('toby_jug', 'Toby jug', 'antique', 'uncommon', 90, '#8a5a3a', 'Glazed character jug. Someone’s gran will want it.');
col('candlestick', 'Silver candlestick', 'antique', 'rare', 260, '#c9ccd2', 'Hallmarked sterling silver.');
col('vinyl_rare', 'Rare vinyl record', 'vinyl', 'rare', 300, '#1b1d22', 'First pressing of a Mancunian classic.');
col('match_ticket', 'Old match ticket', 'card', 'uncommon', 45, '#e8c060', 'Ticket stub from a famous derby.');

// ---- quest items -----------------------------------------------------------------------------
const quest = (id: string, name: string, icon: IconKind, text: string, flag: string) =>
  add({ id, name, text, category: 'quest', rarity: 'rare', value: 0, icon, colour: '#ffd23d', questFlag: flag, unsellable: true });
quest('gaffer_ledger', 'The Gaffer’s ledger', 'document', 'Who owes the Gaffer money. Someone in the precinct would pay to see this.', 'has_ledger');
quest('lockup_key', 'Lock-up key', 'key', 'Opens a garage lock-up on the estate.', 'has_lockup_key');
quest('vip_pass', 'VIP pass', 'card', 'Gets you past the door of the Neon Mile clubs.', 'has_vip_pass');
quest('dunc_phone', 'Dunc’s burner phone', 'phone', 'One contact saved: "THE BOSS". Big Dunc wasn’t at the top.', 'has_dunc_phone');
quest('stadium_key', 'Stadium service key', 'key', 'Opens the service tunnel under the football ground.', 'has_stadium_key');

// ---- carried for a job (src/jobs): `questFlag` keeps them out of shops, the floor and the stash ------------
const job = (id: string, name: string, icon: IconKind, colour: string, text: string) =>
  add({ id, name, text, category: 'quest', rarity: 'uncommon', value: 0, icon, colour, questFlag: 'job_item', unsellable: true, jobItem: true });
job('job_parcel', 'Taped-up parcel', 'bag', '#b08a5a', 'Brown paper and a lot of tape. Don’t shake it, don’t open it, don’t be late.');
job('job_package', 'Wrapped package', 'bag', '#3a3a3a', 'Bought off Kez to sell on. If the police find it on you, it’s gone and so are you.');
job('job_phones', 'Box of phones', 'phone', '#2a2a2e', 'A box of brand-new phones, still sealed. Not yours.');
job('job_ledger', 'Little black book', 'document', '#1b1b1b', 'Names, numbers and amounts. Someone would very much like it back.');
job('job_ring', 'Gold ring', 'ring', '#d4af37', 'An old gold band, worn thin. It means a lot to someone.');
job('job_keys', 'Van keys', 'key', '#c9ccd2', 'Keys to a van that somebody wants back, with whatever’s in it.');

// ---- dealing (business/dealing.ts): bulk from Kez, deals bagged up in the garage ------------------------------
// Contraband: the pawn shop won't touch it and the police take it (it's always given as stolen).
const gear = (id: string, name: string, icon: IconKind, colour: string, stack: number, text: string) =>
  add({ id, name, text, category: 'misc', rarity: 'uncommon', value: 0, stack, icon, colour, unsellable: true, contraband: true });
gear('bulk_weed', 'Bulk bag of weed', 'bag', '#4a6a2a', 3, 'Vacuum-packed and heavy. Bag it up at the prep table in your garage: 20 deals.');
gear('bulk_coke', 'Block of cocaine', 'bag', '#e8e6e1', 3, 'Wrapped tight in cling film. Bag it up at the prep table in your garage: 28 wraps.');
gear('bulk_pills', 'Bag of pills', 'bag', '#c070ff', 3, 'Hundreds of them in a freezer bag. Bag them up at the prep table in your garage: 50 to sell.');
gear('deal_weed', 'Bag of weed', 'grocery', '#4a6a2a', 40, 'A deal, bagged up. Sell it to a punter on the street.');
gear('deal_coke', 'Wrap of cocaine', 'grocery', '#e8e6e1', 40, 'A wrap, ready to go. Sell it to a punter on the street.');
gear('deal_pills', 'Pill', 'grocery', '#c070ff', 60, 'One pill, bagged. Sell it to a punter on the street.');

// ---- misc ------------------------------------------------------------------------------------
add({ id: 'scrap_metal', name: 'Scrap metal', text: 'Copper pipe and bits. The pawn shop takes it by weight.', category: 'misc', rarity: 'common', value: 6, stack: 10, icon: 'scrap', colour: '#b87333' });
// Workshop materials (the garage workbench).
add({ id: 'duct_tape', name: 'Duct tape', text: 'Fixes most things. Workbench material.', category: 'misc', rarity: 'common', value: 3, stack: 10, icon: 'scrap', colour: '#8a8e94' });
add({ id: 'bolts', name: 'Nuts and bolts', text: 'A tub of mixed fixings. Workbench material.', category: 'misc', rarity: 'common', value: 4, stack: 10, icon: 'scrap', colour: '#c8c8c8' });
add({ id: 'leather_strip', name: 'Leather strip', text: 'For grips and wraps. Workbench material.', category: 'misc', rarity: 'uncommon', value: 10, stack: 10, icon: 'scrap', colour: '#6a4028' });
add({ id: 'steel_bar', name: 'Steel bar stock', text: 'Proper steel. Workbench material.', category: 'misc', rarity: 'uncommon', value: 18, stack: 10, icon: 'scrap', colour: '#6a6e74' });
add({ id: 'spring_steel', name: 'Spring steel', text: 'Hard, whippy, valuable. Workbench material.', category: 'misc', rarity: 'rare', value: 40, stack: 5, icon: 'scrap', colour: '#3a4a5a' });
add({ id: 'carbon_fibre', name: 'Carbon fibre sheet', text: 'Light and stupidly strong. Workbench material.', category: 'misc', rarity: 'epic', value: 90, stack: 5, icon: 'scrap', colour: '#1a1a1c' });
add({ id: 'lighter', name: 'Zippo lighter', text: 'Engraved steel lighter. Sells for a few quid.', category: 'misc', rarity: 'common', value: 12, stack: 3, icon: 'scrap', colour: '#c9ccd2' });
add({ id: 'bus_pass', name: 'Bus pass', text: 'Somebody’s. Dave’s Cabs take it as a free ride.', category: 'misc', rarity: 'common', value: 0, stack: 5, icon: 'card', colour: '#2f6fa8', unsellable: true });

// ---- bags (carry space) --------------------------------------------------------------------------
// You have 4 pockets. A bag is worn (one at a time, slot 'back') and adds its own slots; you see it on you.
add({ id: 'bag_bumbag', name: 'Bum bag', text: 'Round the waist. 4 more slots: 8 with your pockets.', category: 'misc', rarity: 'common', value: 40, icon: 'bag', colour: '#1b1d22', unsellable: false, wear: { slot: 'back' } });
add({ id: 'bag_rucksack', name: 'Rucksack', text: 'On your back. 8 more slots: 12 with your pockets.', category: 'misc', rarity: 'uncommon', value: 120, icon: 'bag', colour: '#2f4a2d', wear: { slot: 'back' } });
add({ id: 'bag_holdall', name: 'Gym holdall', text: 'Over the shoulder. 12 more slots: 16 with your pockets.', category: 'misc', rarity: 'rare', value: 260, icon: 'bag', colour: '#1f2a44', wear: { slot: 'back' } });
add({ id: 'bag_hiking', name: 'Big rucksack', text: 'A 65-litre hiking pack. 20 more slots: 24 with your pockets.', category: 'misc', rarity: 'epic', value: 520, icon: 'bag', colour: '#3a2f22', wear: { slot: 'back' } });

export const ITEMS: Record<string, ItemDef> = Object.fromEntries(defs.map((d) => [d.id, d]));
export const ITEM_LIST: readonly ItemDef[] = defs;

/** What each bag adds to your 4 pockets while you wear it. */
export const BAG_SLOTS: Record<string, number> = { bag_bumbag: 4, bag_rucksack: 8, bag_holdall: 12, bag_hiking: 20 };

export function itemDef(id: string): ItemDef | undefined {
  return ITEMS[id];
}

export function weaponItemId(w: WeaponId): string {
  return `w_${w}`;
}
