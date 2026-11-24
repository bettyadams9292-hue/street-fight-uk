import { newClub, sanitiseClub, type ClubSave } from '../fightclub/club';
import { sanitiseCharacter, finalAttributes, BACKGROUNDS, type PlayerCharacter } from '../character/Character';
import { newDealing, sanitiseDealing, type DealingSave } from '../business/dealing';
import { jewelBuffs, outfitBuffs, xpBonusOf, type Buff, type WornJewels } from '../items/gearBonus';
import { WEAPON_IDS, WEAPONS } from '../combat/Weapons';
import { addStack, defOf, sanitiseStack, spaceFor, takeStack, type ItemStack } from '../items/Inventory';
import { BAG_SLOTS, ITEMS, WEAR_SLOTS, weaponItemId, type WearSlot } from '../items/items';
import { JEWEL_ITEMS } from '../items/jewellery';
import { MAX_JEWELS } from '../items/jewelleryBox';
import type { CharacterAppearance } from '../character/Appearance';
import { STYLE_IDS, type StyleId } from '../styles/StyleData';
import type { Fighter, FighterConfig, Perk } from '../fighter/Fighter';
import { getStyle } from '../data/styles';
import { defaultProperty, sanitiseProperty, type PropertySave } from '../property/state';
import { defaultBasement, sanitiseBasement, type BasementSave } from '../business/basement';
import { defaultGym, sanitiseGym, type GymSave } from '../training/gym';
import { sanitiseStyleTraining, type StyleTraining } from '../training/styleGyms';
import { defaultCompanions, sanitiseCompanions, type CompanionSave } from '../companions/companions';
import { TOWN_AREA_IDS, type TownAreaId } from '../world/townIds';
import { DISTRICT_ORDER } from '../world/levels';
import { ageRecord, logCrime, sanitiseRecord, type Crime, type CrimeEntry } from './record';
import { defaultPolice, sanitisePolice, type PoliceSave } from './cops';
import { newTutorial, sanitiseTutorial, type TutorialSave } from '../tutorial/state';
import { newHotbar, sanitiseHotbar, type HotbarSave } from '../items/hotbar';
import { coolHeat, emptyHeat, HEAT, HEAT_COOL, HEAT_KINDS, sanitiseHeatMap, type DistrictHeat, type HeatKind, type HeatMap } from './heat';
import { defaultNeeds, eat, needsModifiers, sanitiseNeeds, type NeedsSave } from '../home/needs';
import { putInto, sanitisePantry, STARTER_GROCERIES, type PantrySave } from '../home/recipes';
import { conditionModifiers, defaultCondition, sanitiseCondition, treatInjury, type ConditionSave } from '../condition/condition';
import { currentFatigue } from '../training/gym';
import { applyJewellery, clearJewelForSlot, defaultJewellery, sanitiseJewellery, type JewellerySave } from '../items/jewelleryBox';
import { defaultFinance, sanitiseFinance, type FinanceSave } from './finance';
import { defaultPortfolio, sanitisePortfolio, type PortfolioSave } from '../realty/portfolio';
import { newJobs, sanitiseJobs, type JobsSave } from '../jobs/save';
import {
  GEAR_IDS,
  LEVEL_CAP,
  LOCKED_COSMETICS,
  MOVE_UNLOCKS,
  MOVE_UNLOCK_IDS,
  STYLE_LESSONS,
  UPGRADES,
  UPGRADE_IDS,
  xpForNextLevel,
  type GearId,
  type MoveUnlockId,
  type UpgradeId,
  DIFFICULTY,
  LEVEL_BONUS,
} from './catalogue';

/** The hand-built areas. */
export const CORE_AREA_IDS = [
  'home', 'estate', 'high_street', 'alleys', 'industrial', 'subway', 'city', 'territory',
  // Stage 5: interiors
  'clothes_shop', 'pawn_shop', 'pub', 'police_station',
  // NeXo Cutz, the barber on the High Street
  'barber_shop',
  // The Arches fight club, under Kane's Boxing
  'fight_club',
  // Stage 6: furniture shop, car dealer, bike shop, casino
  'furniture_shop', 'car_dealer', 'bike_shop', 'casino',
  // Stage 7: the basement and the grow shop
  'basement', 'grow_shop',
  // Jewellery and property: the jeweller, the estate agent, the inside of whichever property you're in, Ashcombe Park
  'jeweller', 'estate_agent', 'property', 'ashcombe',
  // Stage 8: gym equipment store and the fighting gyms
  'gym_store', 'boxing_gym', 'karate_dojo', 'wrestling_club',
  // Stage 5: districts
  'residential', 'leisure', 'stadium', 'market', 'docks', 'ind_estate', 'factory', 'precinct', 'mall', 'car_park', 'nightlife', 'underground', 'hq',
] as const;
/** Every area: the hand-built ones, then the districts of the generated towns east of Hale House. */
export type AreaId = (typeof CORE_AREA_IDS)[number] | TownAreaId;
export const AREA_IDS: readonly AreaId[] = [...CORE_AREA_IDS, ...TOWN_AREA_IDS];

export const SAVE_VERSION = 3;

/** Shopkeepers remember you. */
export interface ShopState {
  robberies: number;
  /** Shut until this many trips have passed (each area change is a trip). */
  closedUntil: number;
  /** Prices go up for you after you've robbed them. */
  priceMult: number;
}

/** Everything that persists between sessions. */
export interface GameSave {
  version: 3;
  character: PlayerCharacter;
  /** Cash on you is at risk; banked cash at home is safe and pays for upgrades. */
  cash: { pocket: number; bank: number };
  xp: number;
  level: number;
  /** Earned by levelling up; each gym upgrade needs one. */
  trainingPoints: number;
  upgrades: Record<UpgradeId, number>;
  moves: MoveUnlockId[];
  styles: { learned: StyleId[]; primary: StyleId; secondary: StyleId | null };
  /** What you're carrying. */
  inventory: ItemStack[];
  /** The stash at home. */
  storage: ItemStack[];
  storageCap: number;
  /** Clothes and accessories you have on. */
  worn: Partial<Record<WearSlot, ItemStack>>;
  /** The weapon in your hands. */
  held: ItemStack | null;
  /** Item ids you've ever had, for the collection book. */
  discovered: string[];
  /** Wanted level where you are now, 0..100: the police reading of `districtHeat` for this district. */
  heat: number;
  /** Police, street and gang heat, district by district (progress/heat.ts). */
  districtHeat: HeatMap;
  /** What the police have on you, newest last (`progress/record.ts`). */
  record: CrimeEntry[];
  /** Bent and straight cops you know, Kerrigan, what's in the property store, crew you owe, your phone at the desk (`progress/cops.ts`). */
  police: PoliceSave;
  /** The tutorial: lessons done and skipped, hints shown, an unfinished lesson (src/tutorial). */
  tutorial: TutorialSave;
  /** What's in the four hotbar slots (medical, food, drink, weapon), by item id; null picks for you (items/hotbar.ts). */
  hotbar: HotbarSave;
  /** Jobs: standing with each contact, their boards and chains, and the job you're on (src/jobs). */
  jobs: JobsSave;
  /** Dealing: the garage prep table, what's on it, and sales (business/dealing.ts). */
  dealing: DealingSave;
  /** The Arches fight club: your place on the card, the title (fightclub/club.ts). */
  club: ClubSave;
  /** Counts area changes: the game's clock for shop closures and heat. */
  trips: number;
  shops: Record<string, ShopState>;
  pawn: { itemsSold: number; earned: number };
  /** Next stack uid. */
  uidSeq: number;
  /** Progress flags: bosses beaten, gates opened, one-time pickups and rewards claimed. */
  flags: Record<string, true>;
  /** Where to continue from. */
  area: AreaId;
  entry: string;
  /** "Full English" bonus for the next trip out. */
  mealBuff: boolean;
  stats: { kos: number; secrets: number; bosses: number; deaths: number; robberies: number; arrests: number };
  /** The house's furniture and decor, your cars and bikes, the casino. */
  property: PropertySave;
  /** Home gym kit, training XP and fatigue. */
  gym: GymSave;
  /** Technique ranks in each style, from the fighting gyms. */
  styleTraining: StyleTraining;
  /** People you've hired to fight with you. */
  companions: CompanionSave;
  /** The basement and the business in it. */
  basement: BasementSave;
  /** Seconds actually spent playing in the world: the business's clock. */
  playTime: number;
  /** Places you've been (the map shows the rest as "not visited yet"). */
  visited: AreaId[];
  /** Where the map's route is set to, if anywhere. */
  destination: AreaId | null;
  /** Your injuries. */
  condition: ConditionSave;
  /** Hunger, energy, hygiene, teeth, bladder, diet. */
  needs: NeedsSave;
  /** The fridge and the kitchen cupboards. */
  pantry: PantrySave;
  /** Rings, watches, chains and grills you own, and what's on. Never in the inventory, never lost. */
  jewellery: JewellerySave;
  /** Houses, flats, apartments and mansions you own, and their tenants. */
  portfolio: PortfolioSave;
  /** The record of big money in and out (jewellery, property, rent). */
  finance: FinanceSave;
  /** Boss rewards that didn't fit in your pockets: they wait on the ground where they fell until you take them. */
  bossLoot: KeptLoot[];
  savedAt: string;
}

/** Something left on the ground that the save remembers (see GameSave.bossLoot). */
export interface KeptLoot {
  area: AreaId;
  x: number;
  z: number;
  stack: ItemStack;
}

/** Your pockets: a bag on your back adds its own slots (BAG_SLOTS). */
export const BASE_INVENTORY_SLOTS = 4;
export const BASE_STORAGE_SLOTS = 60;
export const STORAGE_UPGRADE = { slots: 30, cost: 250, max: 150 };

export function newSave(character: PlayerCharacter): GameSave {
  const s: GameSave = {
    version: 3,
    character,
    cash: { pocket: 0, bank: character.money },
    xp: 0,
    level: 1,
    trainingPoints: 1,
    upgrades: { health: 0, stamina: 0, power: 0, speed: 0, toughness: 0, technique: 0 },
    moves: [],
    styles: { learned: ['street'], primary: 'street', secondary: null },
    inventory: [],
    storage: [],
    storageCap: BASE_STORAGE_SLOTS,
    worn: {},
    held: null,
    discovered: [],
    heat: 0,
    districtHeat: {},
    record: [],
    police: defaultPolice(),
    tutorial: newTutorial(),
    hotbar: newHotbar(),
    jobs: newJobs(),
    dealing: newDealing(),
    club: newClub(),
    trips: 0,
    shops: {},
    pawn: { itemsSold: 0, earned: 0 },
    uidSeq: 1,
    flags: {},
    area: 'home',
    entry: 'start',
    mealBuff: false,
    stats: { kos: 0, secrets: 0, bosses: 0, deaths: 0, robberies: 0, arrests: 0 },
    property: defaultProperty(),
    gym: defaultGym(),
    styleTraining: {},
    companions: defaultCompanions(),
    basement: defaultBasement(),
    playTime: 0,
    visited: ['home', 'estate'],
    destination: null,
    condition: defaultCondition(),
    needs: defaultNeeds(),
    pantry: { fridge: [], cupboard: [] },
    jewellery: defaultJewellery(),
    portfolio: defaultPortfolio(),
    finance: defaultFinance(),
    bossLoot: [],
    savedAt: new Date().toISOString(),
  };
  // Starter kit: your hand wraps on, a couple of sandwiches in your pocket, food in the kitchen.
  const p = new Progress(s);
  p.wearNew('wraps');
  p.giveItem('meal_deal', 2);
  p.stockKitchen(STARTER_GROCERIES);
  return s;
}

const num = (v: unknown, fallback: number, min = 0, max = 1e9) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, Math.floor(v))) : fallback);
const list = <T extends string>(v: unknown, allowed: readonly T[]): T[] => (Array.isArray(v) ? [...new Set(v.filter((x): x is T => allowed.includes(x as T)))] : []);

/** Stage 4 gear and unlockable cosmetics become real items in Stage 5. */
const GEAR_TO_ITEM: Record<GearId, string> = { wraps: 'wraps', mouthguard: 'mouthguard', steel_caps: 'steel_toecaps', leather_jacket: 'leather_jacket', lucky_chain: 'lucky_chain' };
const COSMETIC_TO_ITEM: Record<string, string> = { 'top:bomber': 'bomber_jacket', 'acc:chain': 'chain_silver', 'acc:cap': 'cap_black', 'acc:headguard': 'headguard', 'top:tracksuit': 'tracksuit_top' };

/** Repair a loaded save, migrating a version 2 save. Returns null if it can't be used. */
function mergeRanks(base: Record<string, number>, gym: StyleTraining): Record<string, number> {
  const out = { ...base };
  for (const [k, v] of Object.entries(gym)) if (v && v.rank > 0) out[k] = Math.max(out[k] ?? 1, v.rank);
  return out;
}

export function sanitiseSave(raw: unknown): GameSave | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<GameSave> & Record<string, unknown>;
  const character = sanitiseCharacter(r.character);
  if (!character) return null;
  const base = newSave(character);
  const learned = list(r.styles?.learned, STYLE_IDS);
  if (!learned.includes('street')) learned.unshift('street');
  const primary = learned.includes(r.styles?.primary as StyleId) ? (r.styles!.primary as StyleId) : 'street';
  const secondary = r.styles?.secondary && learned.includes(r.styles.secondary) && r.styles.secondary !== primary ? r.styles.secondary : null;
  const upgrades = { ...base.upgrades };
  for (const id of UPGRADE_IDS) upgrades[id] = num(r.upgrades?.[id], 0, 0, UPGRADES[id].maxRank);
  const flags: Record<string, true> = {};
  if (r.flags && typeof r.flags === 'object') for (const [k, v] of Object.entries(r.flags)) if (v === true) flags[k] = true;
  const st = (r.stats ?? {}) as Partial<GameSave['stats']>;
  const out: GameSave = {
    ...base,
    cash: { pocket: num(r.cash?.pocket, 0), bank: num(r.cash?.bank, base.cash.bank) },
    xp: num(r.xp, 0),
    level: num(r.level, 1, 1, LEVEL_CAP),
    trainingPoints: num(r.trainingPoints, 1, 0, 99),
    upgrades,
    moves: list(r.moves, MOVE_UNLOCK_IDS),
    styles: { learned, primary, secondary },
    inventory: [],
    storage: [],
    worn: {},
    held: null,
    storageCap: num(r.storageCap, BASE_STORAGE_SLOTS, BASE_STORAGE_SLOTS, STORAGE_UPGRADE.max),
    discovered: Array.isArray(r.discovered) ? [...new Set(r.discovered.filter((x): x is string => typeof x === 'string' && !!ITEMS[x]))] : [],
    heat: num(r.heat, 0, 0, 100),
    districtHeat: sanitiseHeatMap(r.districtHeat),
    record: sanitiseRecord(r.record),
    police: defaultPolice(),
    tutorial: sanitiseTutorial(r.tutorial),
    hotbar: sanitiseHotbar(r.hotbar),
    jobs: sanitiseJobs(r.jobs, AREA_IDS),
    dealing: sanitiseDealing(r.dealing),
    club: sanitiseClub(r.club),
    trips: num(r.trips, 0),
    shops: sanitiseShops(r.shops),
    pawn: { itemsSold: num(r.pawn?.itemsSold, 0), earned: num(r.pawn?.earned, 0) },
    uidSeq: num(r.uidSeq, 1, 1),
    flags,
    area: (AREA_IDS as readonly string[]).includes(r.area as string) ? (r.area as AreaId) : 'home',
    entry: typeof r.entry === 'string' ? r.entry : 'start',
    mealBuff: r.mealBuff === true,
    stats: { kos: num(st.kos, 0), secrets: num(st.secrets, 0), bosses: num(st.bosses, 0), deaths: num(st.deaths, 0), robberies: num(st.robberies, 0), arrests: num(st.arrests, 0) },
    property: sanitiseProperty(r.property, AREA_IDS),
    gym: sanitiseGym(r.gym, typeof r.playTime === 'number' && Number.isFinite(r.playTime) && r.playTime >= 0 ? r.playTime : 0),
    styleTraining: sanitiseStyleTraining(r.styleTraining, learned, list(r.moves, MOVE_UNLOCK_IDS).includes('specials')),
    companions: sanitiseCompanions(r.companions),
    playTime: typeof r.playTime === 'number' && Number.isFinite(r.playTime) && r.playTime >= 0 ? r.playTime : 0,
    basement: sanitiseBasement(r.basement, typeof r.playTime === 'number' && Number.isFinite(r.playTime) && r.playTime >= 0 ? r.playTime : 0),
    visited: sanitiseVisited(r.visited, r.area, flags),
    destination: (AREA_IDS as readonly string[]).includes(r.destination as string) ? (r.destination as AreaId) : null,
    condition: sanitiseCondition(r.condition),
    needs: sanitiseNeeds(r.needs),
    pantry: { fridge: [], cupboard: [] },
    jewellery: sanitiseJewellery(r.jewellery),
    portfolio: sanitisePortfolio(r.portfolio, typeof r.playTime === 'number' && Number.isFinite(r.playTime) && r.playTime >= 0 ? r.playTime : 0),
    finance: sanitiseFinance(r.finance),
    bossLoot: [],
    savedAt: typeof r.savedAt === 'string' ? r.savedAt : base.savedAt,
  };
  let pantry: PantrySave | null = null;
  const p = new Progress(out);
  if (r.version === 3) {
    // Stacks: drop junk, never allow the same uid twice anywhere.
    const seen = new Set<string>();
    const stacks = (v: unknown, cap: number) => (Array.isArray(v) ? v.map((x) => sanitiseStack(x, seen)).filter((x): x is ItemStack => !!x).slice(0, cap) : []);
    // Never truncate: anything over capacity stays (you just can't add more until there's room).
    out.storage = stacks(r.storage, 999);
    const worn = (r.worn ?? {}) as Record<string, unknown>;
    for (const slot of WEAR_SLOTS) {
      const s = sanitiseStack(worn[slot], seen);
      if (s && ITEMS[s.id].wear?.slot === slot) out.worn[slot] = s;
    }
    const held = sanitiseStack(r.held, seen);
    out.held = held && ITEMS[held.id].weapon ? held : null;
    // Weapons you've handed to your crew are items too.
    out.companions = sanitiseCompanions(r.companions, (x) => sanitiseStack(x, seen));
    out.inventory = stacks(r.inventory, 99);
    // Bags used to count just by being carried: an old save puts its biggest one on its back.
    if (!out.worn.back) {
      const bags = out.inventory.filter((x) => BAG_SLOTS[x.id]).sort((a, b) => BAG_SLOTS[b.id] - BAG_SLOTS[a.id]);
      const big = bags[0];
      if (big) {
        if (big.qty > 1) {
          big.qty -= 1;
          out.worn.back = { ...big, uid: `${big.uid}b`, qty: 1 };
        } else {
          out.inventory.splice(out.inventory.indexOf(big), 1);
          out.worn.back = big;
        }
      }
    }
    out.police = sanitisePolice(r.police, (x) => sanitiseStack(x, seen));
    pantry = sanitisePantry(r.pantry, (x) => sanitiseStack(x, seen));
    if (pantry) out.pantry = pantry;
    // Boss rewards still on the ground. Read last, so a stack already in your pockets can never also be on the floor.
    if (Array.isArray(r.bossLoot)) {
      for (const k of r.bossLoot as Partial<KeptLoot>[]) {
        if (!k || !(AREA_IDS as readonly string[]).includes(k.area as string) || typeof k.x !== 'number' || typeof k.z !== 'number' || !Number.isFinite(k.x) || !Number.isFinite(k.z)) continue;
        const stack = sanitiseStack(k.stack, seen);
        if (stack) out.bossLoot.push({ area: k.area as AreaId, x: k.x, z: k.z, stack });
      }
    }
    // If the pockets hold more than fit (a bag was removed by hand), overflow goes to the stash.
    while (out.inventory.length > p.inventoryCap) {
      out.storage.push(out.inventory.pop()!);
    }
    // uidSeq must stay ahead of every uid in use.
    for (const id of seen) {
      const n = Number(id.replace(/^i/, '').split('.')[0]);
      if (Number.isFinite(n) && n >= out.uidSeq) out.uidSeq = n + 1;
    }
  } else {
    // ---- Stage 4 (v2) migration: gear, weapons and cosmetics become items. ----
    const gear = list(r.gear, GEAR_IDS);
    const equipped = (r.equipped ?? {}) as { weapon?: string; gear?: string };
    for (const g of gear) {
      const id = GEAR_TO_ITEM[g];
      if (equipped.gear === g) p.wearNew(id);
      else p.stashNew(id);
    }
    if (!gear.length) p.wearNew('wraps');
    for (const w of list(r.weapons, WEAPON_IDS)) {
      if (equipped.weapon === w) out.held = p.newStack(weaponItemId(w), 1);
      else p.stashNew(weaponItemId(w));
    }
    for (const c of list(r.cosmetics, LOCKED_COSMETICS)) if (COSMETIC_TO_ITEM[c]) p.stashNew(COSMETIC_TO_ITEM[c]);
  }
  // Saves from before the kitchen worked: the house comes stocked.
  if (!pantry) p.stockKitchen(STARTER_GROCERIES);
  return out;
}

function sanitiseShops(v: unknown): Record<string, ShopState> {
  const out: Record<string, ShopState> = {};
  if (!v || typeof v !== 'object') return out;
  for (const [k, raw] of Object.entries(v as Record<string, Partial<ShopState>>)) {
    out[k] = { robberies: num(raw?.robberies, 0, 0, 99), closedUntil: num(raw?.closedUntil, 0), priceMult: typeof raw?.priceMult === 'number' && raw.priceMult >= 1 && raw.priceMult <= 3 ? raw.priceMult : 1 };
  }
  return out;
}

export type PurchaseResult = { ok: true } | { ok: false; reason: string };

/**
 * The one place progress changes. Rewards go through `claim` so a one-time
 * reward (boss, secret, encounter) can never be paid twice.
 */
/** Hunger at or above this and you can't face any more food (drinks and medicine still work). */
export const STUFFED = 95;

export class Progress {
  constructor(public save: GameSave) {
    this.adoptLooseJewellery();
  }

  /**
   * Saves from before loot jewellery went in the jewellery box: any piece still sitting in your pockets or the
   * stash (not stolen) moves into the box, so it can be worn. Runs on every load; does nothing once done.
   */
  private adoptLooseJewellery(): void {
    for (const list of [this.save.inventory, this.save.storage]) {
      for (let i = list.length - 1; i >= 0; i--) {
        const st = list[i];
        if (!JEWEL_ITEMS[st.id] || st.stolen) continue;
        if (this.intoJewelleryBox(st)) list.splice(i, 1);
      }
    }
  }

  // ---- flags and one-time rewards -----------------------------------------------
  has(flag: string): boolean {
    return this.save.flags[flag] === true;
  }

  set(flag: string): void {
    this.save.flags[flag] = true;
  }

  /** Returns true the first time only. */
  claim(id: string): boolean {
    const key = `claimed:${id}`;
    if (this.has(key)) return false;
    this.set(key);
    return true;
  }

  // ---- cash and XP ----------------------------------------------------------------
  addCash(amount: number): void {
    this.save.cash.pocket += Math.max(0, Math.round(amount));
  }

  /** Pay pocket money into the tin at home. */
  bankAll(): number {
    const n = this.save.cash.pocket;
    this.save.cash.bank += n;
    this.save.cash.pocket = 0;
    return n;
  }

  /** Lose a share of the cash you're carrying (getting battered). */
  losePocket(fraction: number): number {
    const lost = Math.floor(this.save.cash.pocket * fraction);
    this.save.cash.pocket -= lost;
    return lost;
  }

  /** Add XP; returns how many levels were gained. */
  /** What you've got on from the jewellery box. */
  wornJewels(): WornJewels {
    const j = this.save.jewellery;
    return Object.values(j.worn)
      .map((uid) => j.owned.find((o) => o.uid === uid))
      .filter((o): o is NonNullable<typeof o> => !!o)
      .map((o) => ({ id: o.id, finish: o.finish }));
  }

  /** Extra XP from the jewellery you're wearing, as a fraction (gearBonus.ts). */
  get xpBonus(): number {
    return xpBonusOf(this.wornJewels());
  }

  /** Buffs from your outfit and your jewellery, for the screens. */
  buffs(): Buff[] {
    const w = this.save.worn;
    const def = (slot: 'top' | 'bottoms' | 'shoes') => (w[slot] ? ITEMS[w[slot]!.id] : undefined);
    return [...outfitBuffs({ top: def('top'), bottoms: def('bottoms'), shoes: def('shoes') }), ...jewelBuffs(this.wornJewels())];
  }

  /** XP earned: your jewellery's bonus on top (`raw` skips it, for XP that isn't earned, like a cheat or a refund). */
  addXp(amount: number, raw = false): number {
    const s = this.save;
    s.xp += Math.max(0, Math.round(amount * (raw ? 1 : 1 + this.xpBonus)));
    let gained = 0;
    while (s.level < LEVEL_CAP && s.xp >= xpForNextLevel(s.level)) {
      s.xp -= xpForNextLevel(s.level);
      s.level++;
      s.trainingPoints++;
      gained++;
    }
    return gained;
  }

  // ---- gym --------------------------------------------------------------------------
  buyUpgrade(id: UpgradeId): PurchaseResult {
    const def = UPGRADES[id];
    const rank = this.save.upgrades[id];
    if (rank >= def.maxRank) return { ok: false, reason: 'Maxed out' };
    if (this.save.trainingPoints < 1) return { ok: false, reason: 'Need a training point (level up)' };
    const cost = def.cost(rank);
    if (this.save.cash.bank < cost) return { ok: false, reason: `Need £${cost} in the bank` };
    this.save.cash.bank -= cost;
    this.save.trainingPoints--;
    this.save.upgrades[id] = rank + 1;
    return { ok: true };
  }

  buyMove(id: MoveUnlockId): PurchaseResult {
    const def = MOVE_UNLOCKS[id];
    if (this.save.moves.includes(id)) return { ok: false, reason: 'Already learned' };
    if (def.requires && !this.has(def.requires)) return { ok: false, reason: def.requiresText ?? 'Locked' };
    if (this.save.cash.bank < def.cost) return { ok: false, reason: `Need £${def.cost} in the bank` };
    this.save.cash.bank -= def.cost;
    this.save.moves.push(id);
    return { ok: true };
  }

  learnStyle(style: StyleId): PurchaseResult {
    const lesson = STYLE_LESSONS.find((l) => l.style === style);
    if (!lesson) return { ok: false, reason: 'Nobody teaches that here' };
    if (this.save.styles.learned.includes(style)) return { ok: false, reason: 'Already learned' };
    if (lesson.requires && !this.has(lesson.requires)) return { ok: false, reason: lesson.requiresText ?? 'Locked' };
    if (this.save.cash.bank < lesson.cost) return { ok: false, reason: `Need £${lesson.cost} in the bank` };
    this.save.cash.bank -= lesson.cost;
    this.save.styles.learned.push(style);
    return { ok: true };
  }

  setStyles(primary: StyleId, secondary: StyleId | null): void {
    const learned = this.save.styles.learned;
    if (!learned.includes(primary)) return;
    this.save.styles.primary = primary;
    this.save.styles.secondary = secondary && learned.includes(secondary) && secondary !== primary ? secondary : null;
  }

  // ---- kitchen ----------------------------------------------------------------------
  buyMeal(cost: number): PurchaseResult {
    if (this.save.mealBuff) return { ok: false, reason: 'Already full' };
    if (this.save.cash.bank < cost) return { ok: false, reason: `Need £${cost} in the bank` };
    this.save.cash.bank -= cost;
    this.save.mealBuff = true;
    return { ok: true };
  }

  // ---- items --------------------------------------------------------------------------
  newUid(): string {
    return `i${this.save.uidSeq++}`;
  }

  /** A fresh stack (weapons come at full durability). */
  newStack(id: string, qty = 1, extra: Partial<ItemStack> = {}): ItemStack {
    const d = ITEMS[id];
    const st: ItemStack = { uid: this.newUid(), id, qty: Math.max(1, qty), ...extra };
    if (d?.weapon && st.hits === undefined) st.hits = WEAPONS[d.weapon].durability;
    if (d?.wear?.colour && !st.colour) st.colour = d.wear.colour;
    this.discover(id);
    return st;
  }

  discover(id: string): void {
    const d = ITEMS[id];
    if (!d) return;
    if (!this.save.discovered.includes(id)) this.save.discovered.push(id);
    // Quest items open things up the moment you have them.
    if (d.questFlag) this.set(d.questFlag);
  }

  /** Carry space: 4 pockets, plus the bag you're wearing. */
  get inventoryCap(): number {
    const bag = this.save.worn.back;
    return BASE_INVENTORY_SLOTS + (bag ? BAG_SLOTS[bag.id] ?? 0 : 0);
  }

  spaceFor(id: string, extra: Partial<ItemStack> = {}): number {
    return spaceFor(this.save.inventory, this.inventoryCap, { id, ...extra });
  }

  /** Put a stack in your pockets. Returns whatever didn't fit (to leave on the floor). */
  pocket(stack: ItemStack): ItemStack | null {
    this.discover(stack.id);
    // Jewellery from the jeweller's range goes in the jewellery box, where you can wear it (stolen pieces don't:
    // they're hot, and only the pawn shop takes them).
    if (this.intoJewelleryBox(stack)) return null;
    return addStack(this.save.inventory, this.inventoryCap, stack, () => this.newUid());
  }

  /** Moves a loot jewellery stack (not stolen) into the jewellery box, as many as fit. True if none is left. */
  private intoJewelleryBox(stack: ItemStack): boolean {
    const look = JEWEL_ITEMS[stack.id];
    if (!look || stack.stolen) return false;
    const box = this.save.jewellery;
    while (stack.qty > 0 && box.owned.length < MAX_JEWELS) {
      const uid = `j${box.seq++}`;
      box.owned.push({ uid, id: look.id, finish: look.finish, paid: 0, at: Math.floor(this.save.playTime) });
      box.unseen.push(uid);
      stack.qty--;
    }
    return stack.qty <= 0;
  }

  /** Give new items. Returns what didn't fit. */
  giveItem(id: string, qty = 1, extra: Partial<ItemStack> = {}): ItemStack | null {
    if (!ITEMS[id]) return null;
    return this.pocket(this.newStack(id, qty, extra));
  }

  /** Groceries straight into the fridge and the cupboards (new games, deliveries). */
  stockKitchen(list: { id: string; qty: number }[]): void {
    for (const g of list) {
      const d = ITEMS[g.id];
      if (!d?.store) continue;
      putInto(d.store === 'fridge' ? this.save.pantry.fridge : this.save.pantry.cupboard, g.id, g.qty, () => this.newUid());
      this.discover(g.id);
    }
  }

  /** Straight into the stash at home (migration, rewards sent home). */
  stashNew(id: string, qty = 1): void {
    addStack(this.save.storage, this.save.storageCap, this.newStack(id, qty), () => this.newUid());
  }

  /** Put something on without it passing through your pockets (starting kit, migration). */
  wearNew(id: string): void {
    const d = ITEMS[id];
    if (!d?.wear) return;
    const prev = this.save.worn[d.wear.slot];
    if (prev) addStack(this.save.storage, this.save.storageCap, prev, () => this.newUid());
    this.save.worn[d.wear.slot] = this.newStack(id);
  }

  findCarried(uid: string): ItemStack | undefined {
    return this.save.inventory.find((s) => s.uid === uid);
  }

  owns(id: string): boolean {
    const s = this.save;
    return s.inventory.some((x) => x.id === id) || s.storage.some((x) => x.id === id) || Object.values(s.worn).some((x) => x?.id === id) || s.held?.id === id;
  }

  /** Move from pockets to the stash (at home). */
  deposit(uid: string, qty = Infinity): PurchaseResult {
    const s = this.save;
    const st = this.findCarried(uid);
    if (!st) return { ok: false, reason: 'Not carrying that' };
    const n = Math.min(qty, st.qty, spaceFor(s.storage, s.storageCap, st));
    if (n <= 0) return { ok: false, reason: 'The stash is full' };
    const part = takeStack(s.inventory, uid, n, () => this.newUid())!;
    const left = addStack(s.storage, s.storageCap, part, () => this.newUid());
    if (left) addStack(s.inventory, this.inventoryCap + 1, left, () => this.newUid());
    return { ok: true };
  }

  /** Move from the stash to your pockets. */
  withdraw(uid: string, qty = Infinity): PurchaseResult {
    const s = this.save;
    const st = s.storage.find((x) => x.uid === uid);
    if (!st) return { ok: false, reason: 'Not in the stash' };
    const room = spaceFor(s.inventory, this.inventoryCap, st);
    const n = Math.min(qty, st.qty, room);
    if (n <= 0) return { ok: false, reason: 'Your pockets are full' };
    const part = takeStack(s.storage, uid, n, () => this.newUid())!;
    const left = addStack(s.inventory, this.inventoryCap, part, () => this.newUid());
    if (left) addStack(s.storage, s.storageCap + 1, left, () => this.newUid());
    return { ok: true };
  }

  /** Bags are worn, not carried, so taking one out of your pockets never strands anything. */
  private bagRemovalOk(_uid: string): boolean {
    return true;
  }

  /** Put on a clothing item or accessory from your pockets (or the stash, at home). */
  wear(uid: string, fromStorage = false): PurchaseResult {
    const s = this.save;
    const src = fromStorage ? s.storage : s.inventory;
    const st = src.find((x) => x.uid === uid);
    const wear = st ? ITEMS[st.id].wear : undefined;
    if (!st || !wear) return { ok: false, reason: 'You can\u2019t wear that' };
    // Changing bags: whatever's in the old one has to fit in the new one (and your pockets).
    if (wear.slot === 'back' && !fromStorage) {
      const prevBag = s.worn.back;
      const newCap = BASE_INVENTORY_SLOTS + (BAG_SLOTS[st.id] ?? 0);
      // The new bag leaves the pockets (one slot fewer used, unless it's one of a stack); the old one goes in.
      const after = s.inventory.length - (st.qty === 1 ? 1 : 0) + (prevBag ? 1 : 0);
      if (after > newCap) return { ok: false, reason: `That bag holds ${newCap} with your pockets. Drop or stash ${after - newCap} thing${after - newCap > 1 ? 's' : ''} first.` };
    }
    // Only ever one comes off the stack: the removed part is what gets worn (no copies).
    const one = takeStack(src, uid, 1, () => this.newUid())!;
    // A chain from Threads takes the place of a chain from the jeweller, and so on.
    clearJewelForSlot(s, wear.slot);
    const prev = s.worn[wear.slot];
    s.worn[wear.slot] = one;
    // Whatever you had on goes where the new item came from (always room: a slot was just freed).
    if (prev) addStack(src, (fromStorage ? s.storageCap : this.inventoryCap) + 1, prev, () => this.newUid());
    return { ok: true };
  }

  /** Take something off, into your pockets (or the stash, at home). */
  unwear(slot: WearSlot, toStorage = false): PurchaseResult {
    const s = this.save;
    const st = s.worn[slot];
    if (!st) return { ok: false, reason: 'Nothing there' };
    const dest = toStorage ? s.storage : s.inventory;
    // Taking your bag off: what's in it has to fit in your pockets (with the bag itself, unless it goes in the stash).
    if (slot === 'back') {
      const need = s.inventory.length + (toStorage ? 0 : 1);
      if (need > BASE_INVENTORY_SLOTS) return { ok: false, reason: `Your pockets only hold ${BASE_INVENTORY_SLOTS}. Empty the bag first.` };
      delete s.worn[slot];
      addStack(dest, toStorage ? s.storageCap : BASE_INVENTORY_SLOTS, st, () => this.newUid());
      return { ok: true };
    }
    const cap = toStorage ? s.storageCap : this.inventoryCap;
    if (spaceFor(dest, cap, st) < 1) return { ok: false, reason: toStorage ? 'The stash is full' : 'Your pockets are full' };
    delete s.worn[slot];
    addStack(dest, cap, st, () => this.newUid());
    return { ok: true };
  }

  /** Take a weapon from your pockets into your hands. */
  hold(uid: string): PurchaseResult {
    const s = this.save;
    const st = this.findCarried(uid);
    if (!st || !ITEMS[st.id].weapon) return { ok: false, reason: 'That\u2019s not a weapon' };
    const one = takeStack(s.inventory, uid, 1, () => this.newUid())!;
    const prev = s.held;
    s.held = one;
    if (prev) addStack(s.inventory, this.inventoryCap + 1, prev, () => this.newUid());
    return { ok: true };
  }

  /** Put the weapon in your hands away. */
  unhold(): PurchaseResult {
    const s = this.save;
    if (!s.held) return { ok: false, reason: 'Hands are empty' };
    if (spaceFor(s.inventory, this.inventoryCap, s.held) < 1) return { ok: false, reason: 'Your pockets are full' };
    addStack(s.inventory, this.inventoryCap, s.held, () => this.newUid());
    s.held = null;
    return { ok: true };
  }

  /** Eat, drink or patch up. Returns what it does for the caller to apply. */
  use(uid: string): { ok: true; heal: number; healPct: number; stamina: number; name: string; treated: string | null } | { ok: false; reason: string } {
    const st = this.findCarried(uid);
    const use = st ? ITEMS[st.id].use : undefined;
    if (!st || !use) return { ok: false, reason: 'You can\u2019t use that' };
    // Food heals a little and fills you up; you can't eat when you're stuffed. Medicine works whenever.
    if (use.needs && use.needs.fill >= 10 && this.save.needs.hunger >= STUFFED) return { ok: false, reason: 'You\u2019re stuffed. Plasters or a first aid kit will still work.' };
    takeStack(this.save.inventory, uid, 1, () => this.newUid());
    // First aid patches up your worst injury by a level; plasters see to bruising.
    let treated: string | null = null;
    const c = this.save.condition;
    if (st.id === 'first_aid') {
      const target = c.injuries.filter((i) => i.part !== 'bruising').sort((a, b) => b.severity - a.severity)[0] ?? c.injuries[0];
      treated = target ? treatInjury(c, target.part)?.name ?? null : null;
    } else if (st.id === 'plasters') treated = treatInjury(c, 'bruising')?.name ?? null;
    if (use.needs) eat(this.save.needs, use.needs);
    // A home-cooked full English sets you up for the next trip, wherever you eat it.
    if (st.id === 'm_full_english') this.save.mealBuff = true;
    return { ok: true, heal: use.heal ?? 0, healPct: use.healPct ?? 0, stamina: use.stamina ?? 0, name: ITEMS[st.id].name, treated };
  }

  /** Remove from your pockets to leave on the ground. Quest items stay. */
  drop(uid: string, qty = Infinity): ItemStack | null {
    const st = this.findCarried(uid);
    if (!st || ITEMS[st.id].questFlag || !this.bagRemovalOk(uid)) return null;
    return takeStack(this.save.inventory, uid, qty, () => this.newUid());
  }

  /** Sell from your pockets at a price per item. */
  sell(uid: string, qty: number, priceEach: number): PurchaseResult {
    const st = this.findCarried(uid);
    if (!st) return { ok: false, reason: 'Not carrying that' };
    const d = defOf(st);
    if (d.unsellable || d.questFlag) return { ok: false, reason: 'They won\u2019t take that' };
    if (!this.bagRemovalOk(uid)) return { ok: false, reason: 'Empty the bag first' };
    const part = takeStack(this.save.inventory, uid, qty, () => this.newUid());
    if (!part) return { ok: false, reason: 'Not carrying that' };
    const total = Math.round(priceEach * part.qty);
    this.save.cash.pocket += total;
    this.save.pawn.itemsSold += part.qty;
    this.save.pawn.earned += total;
    return { ok: true };
  }

  /** Buy from a shop with pocket money first, then banked money. */
  pay(amount: number): boolean {
    const c = this.save.cash;
    if (c.pocket + c.bank < amount) return false;
    const fromPocket = Math.min(c.pocket, amount);
    c.pocket -= fromPocket;
    c.bank -= amount - fromPocket;
    return true;
  }

  buyStorageUpgrade(): PurchaseResult {
    const s = this.save;
    if (s.storageCap >= STORAGE_UPGRADE.max) return { ok: false, reason: 'No room for more shelving' };
    if (s.cash.bank < STORAGE_UPGRADE.cost) return { ok: false, reason: `Need \u00a3${STORAGE_UPGRADE.cost} in the tin` };
    s.cash.bank -= STORAGE_UPGRADE.cost;
    s.storageCap += STORAGE_UPGRADE.slots;
    return { ok: true };
  }

  /** The police take anything stolen from your pockets, hands and back. */
  confiscateStolen(): number {
    return this.takeStolen().reduce((n, x) => n + x.qty, 0);
  }

  /** Everything stolen you're carrying, wearing or holding, taken off you (the police put it in their property store). */
  takeStolen(): ItemStack[] {
    const s = this.save;
    const out: ItemStack[] = s.inventory.filter((x) => x.stolen);
    s.inventory = s.inventory.filter((x) => !x.stolen);
    for (const slot of WEAR_SLOTS) {
      const w = s.worn[slot];
      if (w?.stolen) {
        out.push(w);
        delete s.worn[slot];
      }
    }
    if (s.held?.stolen) {
      out.push(s.held);
      s.held = null;
    }
    return out;
  }

  // ---- heat and the clock --------------------------------------------------------------
  /** The district you're in (set by the World for its level): where heat lands. */
  here = '';

  /** You're in `district` now: `save.heat` reads its police heat. Old saves' one wanted level lands here once. */
  enterDistrict(district: string): void {
    this.here = district;
    const map = this.save.districtHeat;
    if (!Object.keys(map).length && this.save.heat > 0) map[district] = { ...emptyHeat(), police: this.save.heat };
    // Old saves' "they remember your face" (running with nothing): their crew's grudge.
    for (const k of Object.keys(this.save.flags)) {
      if (!k.startsWith('grudge:')) continue;
      const d = k.slice('grudge:'.length);
      if (this.gangOn(d)) {
        const h = (map[d] ??= emptyHeat());
        h.gang = Math.max(h.gang, HEAT.bailBroke.gang);
      }
      delete this.save.flags[k];
    }
    this.save.heat = this.heatIn(district).police;
  }

  heatIn(district = this.here): DistrictHeat {
    return this.save.districtHeat[district] ?? emptyHeat();
  }

  /** Police heat where you are (the wanted level). */
  addHeat(n: number): void {
    this.addHeatOf({ police: n });
  }

  /**
   * Whether a district's crew are involved with you at all: only once you've taken on their boss (gangProvoked),
   * and only until you beat them. Until then their gang heat can't rise, so the streets stay passable.
   */
  gangOn(district = this.here): boolean {
    return this.has(`gang:on:${district}`);
  }

  /** You've started on their boss: from now on the district's crew are watching you. */
  gangProvoked(district = this.here): void {
    if (this.gangOn(district)) return;
    this.set(`gang:on:${district}`);
    this.addHeatOf(HEAT.provoke, district);
  }

  /** Their boss is down: the crew are finished with you, heat and all. */
  gangDone(district = this.here): void {
    this.setHeat('gang', 0, district);
    delete this.save.flags[`gang:on:${district}`];
  }

  /** Change any of the three readings in a district (here by default). */
  addHeatOf(d: Partial<DistrictHeat>, district = this.here): DistrictHeat {
    // A crew that isn't involved yet doesn't get hotter (it can still cool).
    if ((d.gang ?? 0) > 0 && !this.gangOn(district)) d = { ...d, gang: 0 };
    const map = this.save.districtHeat;
    const h = (map[district] ??= emptyHeat());
    // Anything set straight on save.heat (tests, old code) is where the police reading starts.
    if (district === this.here && h.police !== this.save.heat) h.police = this.save.heat;
    for (const k of HEAT_KINDS) if (d[k]) h[k] = Math.max(0, Math.min(100, Math.round(h[k] + d[k]!)));
    if (!h.police && !h.street && !h.gang) delete map[district];
    if (district === this.here) this.save.heat = h.police;
    return h;
  }

  /** Set one reading outright (a boss beaten wipes their crew's grudge). */
  setHeat(kind: HeatKind, n: number, district = this.here): void {
    const h = this.heatIn(district);
    this.addHeatOf({ [kind]: n - (kind === 'police' && district === this.here ? this.save.heat : h[kind]) }, district);
  }

  /** Put a crime on your record, in the district you're in (or `district`). */
  logCrime(crime: Crime, district?: string): void {
    logCrime(this.save.record, crime, district ?? this.here ?? 'High Street', this.save.trips);
  }

  /** The highest police heat anywhere: how much the law knows about you (the basement's raid risk). */
  get wanted(): number {
    return Math.max(this.save.heat, ...Object.values(this.save.districtHeat).map((h) => h.police));
  }

  /** Call on every area change: the clock ticks and heat dies down. */
  tick(): void {
    this.save.trips++;
    if (this.here) {
      const h = this.save.districtHeat[this.here];
      if (h) h.police = this.save.heat;
      coolHeat(this.save.districtHeat, this.here);
      ageRecord(this.save.record, this.save.trips);
      this.save.heat = this.heatIn(this.here).police;
    } else if (this.save.heat > 0) this.save.heat = Math.max(0, this.save.heat - HEAT_COOL.police);
    // Forget searched-container and restock marks from past windows so the save doesn't grow forever.
    const win = Math.floor(this.save.trips / 6);
    for (const k of Object.keys(this.save.flags)) {
      if (!k.startsWith('restock:') && !k.startsWith('searched:')) continue;
      const last = Number(k.slice(k.lastIndexOf(':') + 1));
      if (Number.isInteger(last) && k.split(':').length === 4 && last < win) delete this.save.flags[k];
    }
  }

  shop(id: string): ShopState {
    return (this.save.shops[id] ??= { robberies: 0, closedUntil: 0, priceMult: 1 });
  }

  isShopOpen(id: string): boolean {
    return this.save.trips >= this.shop(id).closedUntil;
  }

  /** How you look right now: your own look, with whatever you're wearing on top. */
  appearance(): CharacterAppearance {
    const s = this.save;
    const a: CharacterAppearance = { ...s.character.appearance, accessories: [...s.character.appearance.accessories] };
    const takenSlots = new Set<string>();
    for (const slot of WEAR_SLOTS) {
      const st = s.worn[slot];
      if (!st) continue;
      const w = ITEMS[st.id].wear!;
      const colour = st.colour ?? w.colour;
      if (w.top) {
        a.top = w.top;
        if (colour) a.topColour = colour;
      }
      if (w.bottoms) {
        a.bottoms = w.bottoms;
        if (colour) a.bottomsColour = colour;
      }
      if (w.shoes) {
        a.shoes = w.shoes;
        if (colour) a.shoesColour = colour;
      }
      if (w.accessory) {
        takenSlots.add(slot);
        if (!a.accessories.includes(w.accessory)) a.accessories.push(w.accessory);
        if (w.chain) a.chainColour = w.chain;
        // The hat's colour (or a snood's, pulled up over the face). Glasses don't recolour a hat.
        if (colour && (slot === 'head' || (slot === 'face' && w.accessory === 'snood'))) a.headColour = colour;
      }
    }
    applyJewellery(a, s);
    return a;
  }

  // ---- building the player's fighter ------------------------------------------------
  /** Settings for the player's Fighter from the save. */
  fighterConfig(id: number, x: number, z: number, touch: boolean): FighterConfig {
    const s = this.save;
    const c = s.character;
    const bg = BACKGROUNDS[c.background];
    const perks: Perk[] = bg.id === 'rugby' ? ['cheap_grabs'] : bg.id === 'dancer' ? ['dodge_frames'] : [];
    return {
      id,
      name: c.name,
      team: 'player',
      attributes: finalAttributes(c.allocated, c.background),
      level: s.level,
      style: getStyle(s.styles.primary),
      secondaryStyle: s.styles.secondary ? getStyle(s.styles.secondary) : null,
      x,
      z,
      appearance: this.appearance(),
      // Gym ranks add to the background's style ranks (+5% damage a rank).
      styleRanks: mergeRanks(c.styleRanks, s.styleTraining),
      perks,
      inputBufferFrames: touch ? 12 : undefined,
      grabProtectFrames: 150,
      weapon: s.held ? ITEMS[s.held.id].weapon ?? null : null,
      weaponHits: s.held?.hits,
      weaponMods: s.held?.mods,
      styleLevels: Object.fromEntries(Object.entries(s.styleTraining).map(([k, v]) => [k, v?.rank ?? 0])),
      unlocks: { specials: s.moves.includes('specials'), finishers: s.moves.includes('finishers') },
    };
  }

  /** Apply upgrades, gear and buffs to a freshly built player fighter. */
  applyModifiers(f: Fighter, difficulty: keyof typeof DIFFICULTY = 'normal'): void {
    const s = this.save;
    f.stats.removeModifiersFrom('difficulty');
    f.stats.removeModifiersFrom('level');
    const d = DIFFICULTY[difficulty] ?? DIFFICULTY.normal;
    f.stats.addModifier({ id: 'diff_taken', source: 'difficulty', stat: 'damageTakenMult', mul: d.taken });
    f.stats.addModifier({ id: 'diff_dealt', source: 'difficulty', stat: 'damageMult', mul: d.dealt });
    const lv = Math.max(0, s.level - 1);
    if (lv > 0) {
      f.stats.addModifier({ id: 'lvl_dealt', source: 'level', stat: 'damageMult', mul: 1 + LEVEL_BONUS.dealt * lv });
      f.stats.addModifier({ id: 'lvl_taken', source: 'level', stat: 'damageTakenMult', mul: Math.max(0.5, 1 - LEVEL_BONUS.taken * lv) });
      f.stats.addModifier({ id: 'lvl_health', source: 'level', flat: 'maxHealth', add: LEVEL_BONUS.health * lv });
    }
    f.stats.removeModifiersFrom('upgrade');
    f.stats.removeModifiersFrom('gear');
    f.stats.removeModifiersFrom('move');
    f.stats.removeModifiersFrom('meal');
    for (const id of UPGRADE_IDS) if (s.upgrades[id] > 0) for (const m of UPGRADES[id].modifiers(s.upgrades[id])) f.stats.addModifier(m);
    // Stats from what you're wearing.
    for (const slot of WEAR_SLOTS) {
      const st = s.worn[slot];
      const stats = st ? ITEMS[st.id].stats : undefined;
      stats?.forEach((m, i) =>
        f.stats.addModifier({ id: `gear_${slot}_${i}`, source: 'gear', attribute: m.attr, stat: m.stat, flat: m.flat, add: m.add, mul: m.mul }),
      );
    }
    // Buffs: the outfit (a whole fit in one tier, or a matching set) and each piece of jewellery (gearBonus.ts).
    f.stats.removeModifiersFrom('buff');
    for (const b of this.buffs()) b.stats.forEach((m, i) => f.stats.addModifier({ id: `buff_${b.id}_${i}`, source: 'buff', attribute: m.attr, stat: m.stat, flat: m.flat, add: m.add, mul: m.mul }));
    if (s.moves.includes('counter_mastery')) f.stats.addModifier({ id: 'counter_mastery', source: 'move', flat: 'parryFrames', add: 3 });
    if (s.moves.includes('iron_chin')) f.stats.addModifier({ id: 'iron_chin', source: 'move', flat: 'maxPoise', add: 30 });
    if (s.mealBuff) f.stats.addModifier({ id: 'meal', source: 'meal', flat: 'maxHealth', add: 25 });
    // Cross-training: each style taken to rank 3 at a fighting gym is +1 Technique (up to 4).
    f.stats.removeModifiersFrom('cross');
    const cross = Math.min(4, Object.values(s.styleTraining).filter((v) => (v?.rank ?? 0) >= 3).length);
    if (cross) f.stats.addModifier({ id: 'cross_training', source: 'cross', attribute: 'technique', add: cross });
    // Injuries and training exhaustion.
    f.stats.removeModifiersFrom('injury');
    for (const m of conditionModifiers(s.condition, currentFatigue(s.gym, s.playTime))) f.stats.addModifier(m);
    // Hunger, tiredness and diet: small effects either way.
    f.stats.removeModifiersFrom('needs');
    for (const m of needsModifiers(s.needs)) f.stats.addModifier(m);
    f.poise = f.stats.maxPoise;
  }
}

/** Places you've been. Saves from before the map: home, the estate, where you are and every district you've won. */
function sanitiseVisited(raw: unknown, area: unknown, flags: Record<string, boolean>): AreaId[] {
  const ok = (x: unknown): x is AreaId => typeof x === 'string' && (AREA_IDS as readonly string[]).includes(x);
  const out = new Set<AreaId>(Array.isArray(raw) ? raw.filter(ok) : []);
  if (!Array.isArray(raw)) {
    for (const d of DISTRICT_ORDER) if (flags[d.flag]) out.add(d.area);
    if (ok(area)) out.add(area);
  }
  out.add('home');
  out.add('estate');
  return [...out];
}

