import type { Accessory, BottomStyle, ShoeStyle, TopStyle } from '../character/Appearance';
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
export type WearSlot = 'top' | 'bottoms' | 'shoes' | 'head' | 'face' | 'neck' | 'wrist' | 'ears' | 'hands' | 'finger' | 'waist' | 'mouth';
export const WEAR_SLOTS: WearSlot[] = ['top', 'bottoms', 'shoes', 'head', 'face', 'neck', 'wrist', 'ears', 'hands', 'finger', 'waist', 'mouth'];
export const WEAR_SLOT_LABELS: Record<WearSlot, string> = {
  top: 'Top', bottoms: 'Bottoms', shoes: 'Footwear', head: 'Head', face: 'Face', neck: 'Neck', wrist: 'Wrist', ears: 'Ears', hands: 'Hands', finger: 'Ring', waist: 'Belt', mouth: 'Gumshield',
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
  | 'weapon' | 'top' | 'bottoms' | 'shoes' | 'cap' | 'beanie' | 'sunglasses' | 'snood' | 'chain' | 'watch' | 'smartwatch' | 'ring'
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
const top = (id: string, name: string, style: TopStyle, value: number, colour: string, text: string, rarity: Rarity = 'common', stats?: ItemStat[]) =>
  add({ id, name, text, category: 'clothing', rarity, value, icon: 'top', colour, wear: { slot: 'top', top: style, colour }, stats });
const bottoms = (id: string, name: string, style: BottomStyle, value: number, colour: string, text: string, rarity: Rarity = 'common') =>
  add({ id, name, text, category: 'clothing', rarity, value, icon: 'bottoms', colour, wear: { slot: 'bottoms', bottoms: style, colour } });
const shoes = (id: string, name: string, style: ShoeStyle, value: number, colour: string, text: string, rarity: Rarity = 'common', stats?: ItemStat[]) =>
  add({ id, name, text, category: 'clothing', rarity, value, icon: 'shoes', colour, wear: { slot: 'shoes', shoes: style, colour }, stats });

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
top('puffer_black', 'Black puffer jacket', 'puffer', 110, '#1b1d22', 'Quilted and warm. Takes the edge off a hit.', 'uncommon', [{ flat: 'maxPoise', add: 8, text: '+8 poise' }]);
top('puffer_red', 'Red puffer jacket', 'puffer', 110, '#7d1a1a', 'Quilted and warm. Takes the edge off a hit.', 'uncommon', [{ flat: 'maxPoise', add: 8, text: '+8 poise' }]);
top('leather_jacket', 'Leather jacket', 'leather', 160, '#1a1410', 'Thick leather. Tough, but you feel it on your shoulders.', 'rare', [
  { attr: 'defence', add: 3, text: '+3 Defence' },
  { attr: 'speed', add: -1, text: '−1 Speed' },
]);
top('denim_jacket', 'Denim jacket', 'denim', 60, '#2f5a8a', 'Stonewashed with brass buttons.');
top('long_coat', 'Long wool coat', 'coat', 120, '#2b2e35', 'Knee-length overcoat. Smart.', 'uncommon');
top('vest_white', 'White vest', 'vest', 8, '#e8e6e1', 'Ribbed vest.');
top('workwear_hivis', 'Hi-vis work jacket', 'workwear', 30, '#e8d000', 'Site jacket with reflective bands.');

bottoms('trackies_black', 'Black trackies', 'trackies', 25, '#1b1d22', 'Tracksuit bottoms with side stripes.');
bottoms('joggers_grey', 'Grey joggers', 'joggers', 25, '#6a6d74', 'Cuffed fleece joggers.');
bottoms('jeans_blue', 'Blue jeans', 'jeans', 40, '#2f4f7a', 'Straight-leg denim.');
bottoms('jeans_black', 'Black jeans', 'jeans', 40, '#1b1d22', 'Straight-leg denim.');
bottoms('cargos_khaki', 'Cargo trousers', 'cargos', 45, '#5b5a3a', 'Side pockets for everything.');
bottoms('shorts_black', 'Fight shorts', 'shorts', 20, '#1b1d22', 'Loose training shorts.');
bottoms('work_trousers', 'Work trousers', 'workwear', 30, '#2b2e35', 'Heavy canvas with knee pads.');

shoes('trainers_white', 'White trainers', 'trainers', 60, '#e8e6e1', 'Clean low-tops.');
shoes('runners', 'Running trainers', 'runners', 80, '#2f6fa8', 'Light and bouncy.', 'common', [{ stat: 'moveSpeedMult', mul: 1.04, text: '+4% move speed' }]);
shoes('hitops_black', 'High-tops', 'hitops', 75, '#1b1d22', 'Ankle-height basketball shoes.');
shoes('boots_work', 'Work boots', 'boots', 70, '#5b3a24', 'Lace-up leather boots.');
shoes('steel_toecaps', 'Steel toecap boots', 'boots', 90, '#151515', 'Kicks land heavier.', 'uncommon', [{ attr: 'strength', add: 2, text: '+2 Strength' }]);
shoes('rare_trainers_worn', 'Limited trainers', 'trainers', 220, '#d4a017', 'Limited run, still in good nick. Worth more boxed.', 'rare');

// ---- accessories --------------------------------------------------------------------
const acc = (id: string, name: string, slot: WearSlot, a: Accessory, value: number, icon: IconKind, colour: string, text: string, rarity: Rarity = 'common', stats?: ItemStat[], chain?: 'gold' | 'silver') =>
  add({ id, name, text, category: 'accessory', rarity, value, icon, colour, wear: { slot, accessory: a, colour, chain }, stats });
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
acc('snood', 'Face covering', 'face', 'snood', 12, 'snood', '#1b1d22', 'Neck snood pulled up over the face.');
acc('lucky_chain', 'Lucky gold chain', 'neck', 'chain', 120, 'chain', '#d4af37', 'Your nan’s. You fight smarter wearing it.', 'rare', [{ attr: 'technique', add: 3, text: '+3 Technique' }], 'gold');
acc('chain_silver', 'Silver chain', 'neck', 'chain', 60, 'chain', '#c9ccd2', 'Fine silver curb chain.', 'common', undefined, 'silver');
acc('chain_gold', 'Gold chain', 'neck', 'chain', 180, 'chain', '#d4af37', '9ct gold rope chain.', 'uncommon', undefined, 'gold');
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
food('chips', 'Chips', 25, 3, 'Salt and vinegar, wrapped in paper.', '#e8c060', 0, { fill: 25, diet: 20 });
food('kebab', 'Kebab', 40, 7, 'Doner with everything.', '#c88a4a', 0, { fill: 45, diet: 25 });
food('pasty', 'Pasty', 30, 3, 'Steak and potato, still warm.', '#d8a050', 0, { fill: 35, diet: 30 });
food('sausage_roll', 'Sausage roll', 30, 2, 'Flaky pastry, greasy bag.', '#d8a860', 0, { fill: 25, diet: 25 });
food('meal_deal', 'Meal deal', 35, 4, 'Sandwich, crisps and a drink.', '#4a9a5a', 10, { fill: 35, diet: 45, bladder: 8 });
food('bacon_butty', 'Bacon butty', 35, 3, 'Brown sauce, obviously.', '#c86040', 0, { fill: 30, diet: 35 });
food('curry', 'Curry', 45, 9, 'Chicken tikka and rice from the takeaway.', '#d88a2a', 0, { fill: 50, diet: 45 });
food('fry_up', 'Full English', 60, 10, 'Everything on one plate.', '#e8a040', 20, { fill: 60, diet: 45, energy: 10 });
food('protein_bar', 'Protein bar', 15, 2, 'Chewy. Tastes of chalk.', '#5a3a2a', 15, { fill: 12, diet: 60, energy: 5 });
drink('energy_drink', 'Energy drink', 60, 2, 'Can of something fizzy and bright.', '#3ad84a', 0, { fill: 0, diet: 10, energy: 15, bladder: 18 });
drink('can_of_pop', 'Can of pop', 30, 1, 'Fizzy and cold.', '#d82a2a', 5, { fill: 2, diet: 10, bladder: 15 });
drink('water', 'Bottle of water', 40, 1, 'Fresh and cold.', '#8ac8ff', 0, { fill: 0, diet: 70, bladder: 15 });
drink('flask_tea', 'Flask of tea', 35, 3, 'Strong, two sugars.', '#8a5a3a', 15, { fill: 2, diet: 40, energy: 6, bladder: 15 });

// ---- the kitchen: groceries, snacks and home-cooked meals (Stage 12) ----------------------------
/** A cooking ingredient: kept in the fridge or the cupboards, used by recipes (home/recipes.ts). */
const grocery = (id: string, name: string, store: 'fridge' | 'cupboard', value: number, colour: string, text: string) =>
  add({ id, name, text, category: 'misc', rarity: 'common', value, stack: 10, icon: 'grocery', colour, store, ingredient: true, unsellable: true });
grocery('g_bread', 'Loaf of bread', 'cupboard', 1, '#d8a860', 'Thick sliced white. A few slices per meal.');
grocery('g_butter', 'Butter', 'fridge', 2, '#f4dc70', 'Proper butter, not spread.');
grocery('g_cheese', 'Cheddar', 'fridge', 3, '#f0c040', 'Mature. Grates, slices, melts.');
grocery('g_ham', 'Sliced ham', 'fridge', 2, '#e89a9a', 'Pack of thick-cut ham.');
grocery('g_eggs', 'Eggs', 'fridge', 2, '#f4ecd8', 'Free range, half a dozen.');
grocery('g_milk', 'Milk', 'fridge', 1, '#f8f8f4', 'Semi-skimmed, two pints.');
grocery('g_cereal', 'Cereal', 'cupboard', 2, '#d84a2a', 'Big box of cornflakes.');
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
grocery('g_tomatoes', 'Tomatoes', 'fridge', 1, '#e04030', 'Vine tomatoes.');
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
add({ id: 'plasters', name: 'Plasters', text: 'A box of plasters.', category: 'consumable', rarity: 'common', value: 2, stack: 5, icon: 'medkit', colour: '#e8c8a0', use: { heal: 20, text: '+20 health' } });
add({ id: 'first_aid', name: 'First aid kit', text: 'Bandages, wipes, the lot.', category: 'consumable', rarity: 'uncommon', value: 15, stack: 3, icon: 'medkit', colour: '#d81e1e', use: { healPct: 0.6, text: 'Restores 60% of your health' } });

// ---- valuables (sell at the pawn shop) --------------------------------------------------------
const val = (id: string, name: string, icon: IconKind, rarity: Rarity, value: number, colour: string, text: string, stack = 1) =>
  add({ id, name, text, category: 'valuable', rarity, value, stack, icon, colour });
// jewellery
val('watch_diver', 'Prestige diver watch', 'watch', 'epic', 1800, '#c9ccd2', 'Swiss-made steel diver’s watch. Heavy, ticking smoothly. Probably real.');
val('watch_gold', 'Gold dress watch', 'watch', 'rare', 650, '#d4af37', 'Slim gold case, leather strap.');
val('watch_silver', 'Silver watch', 'watch', 'uncommon', 140, '#c9ccd2', 'Steel bracelet, quartz movement.');
val('watch_cheap', 'Fashion watch', 'watch', 'common', 25, '#a07850', 'Big face, small value.', 3);
val('chain_cuban', 'Cuban-link chain', 'chain', 'epic', 1200, '#d4af37', 'Thick gold Cuban links. Weighs a ton.');
val('chain_rope', 'Gold rope chain', 'chain', 'rare', 380, '#d4af37', '9ct gold rope chain.');
val('chain_cheap', 'Plated chain', 'chain', 'common', 15, '#c9a22a', 'Gold-plated. The plating is coming off.', 3);
val('bracelet_gold', 'Gold bracelet', 'bracelet', 'rare', 320, '#d4af37', 'Curb-link bracelet.');
val('bracelet_silver', 'Silver bracelet', 'bracelet', 'uncommon', 70, '#c9ccd2', 'Chunky silver links.', 3);
val('ring_gold', 'Gold ring', 'ring', 'uncommon', 120, '#d4af37', 'Plain gold band.', 3);
val('ring_diamond', 'Diamond-style ring', 'ring', 'epic', 900, '#e8f4ff', 'Big sparkly stone on white gold.');
val('earrings_diamond', 'Diamond studs', 'earring', 'rare', 420, '#e8f4ff', 'A pair of diamond-look studs.');
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

// ---- backpacks (carry capacity) ----------------------------------------------------------------
add({ id: 'bag_bumbag', name: 'Bum bag', text: '+4 inventory slots while you have it.', category: 'misc', rarity: 'common', value: 40, icon: 'bag', colour: '#1b1d22', unsellable: false });
add({ id: 'bag_rucksack', name: 'Rucksack', text: '+8 inventory slots while you have it.', category: 'misc', rarity: 'uncommon', value: 120, icon: 'bag', colour: '#2f4a2d' });
add({ id: 'bag_holdall', name: 'Gym holdall', text: '+12 inventory slots while you have it.', category: 'misc', rarity: 'rare', value: 260, icon: 'bag', colour: '#1f2a44' });

export const ITEMS: Record<string, ItemDef> = Object.fromEntries(defs.map((d) => [d.id, d]));
export const ITEM_LIST: readonly ItemDef[] = defs;

/** Bags add slots just by being carried (only the biggest counts). */
export const BAG_SLOTS: Record<string, number> = { bag_bumbag: 4, bag_rucksack: 8, bag_holdall: 12 };

export function itemDef(id: string): ItemDef | undefined {
  return ITEMS[id];
}

export function weaponItemId(w: WeaponId): string {
  return `w_${w}`;
}
