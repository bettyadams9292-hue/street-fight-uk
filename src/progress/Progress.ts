import { sanitiseCharacter, finalAttributes, BACKGROUNDS, type PlayerCharacter } from '../character/Character';
import { WEAPON_IDS, type WeaponId } from '../combat/Weapons';
import { STYLE_IDS, type StyleId } from '../styles/StyleData';
import type { Fighter, FighterConfig, Perk } from '../fighter/Fighter';
import { getStyle } from '../data/styles';
import {
  GEAR,
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

export const AREA_IDS = ['home', 'estate', 'high_street', 'alleys', 'industrial', 'subway', 'city', 'territory'] as const;
export type AreaId = (typeof AREA_IDS)[number];

/** Everything that persists between sessions. */
export interface GameSave {
  version: 2;
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
  weapons: WeaponId[];
  gear: GearId[];
  equipped: { weapon: WeaponId | null; gear: GearId | null };
  cosmetics: string[];
  /** Progress flags: bosses beaten, gates opened, one-time pickups and rewards claimed. */
  flags: Record<string, true>;
  /** Where to continue from. */
  area: AreaId;
  entry: string;
  /** "Full English" bonus for the next trip out. */
  mealBuff: boolean;
  stats: { kos: number; secrets: number; bosses: number; deaths: number };
  savedAt: string;
}

export function newSave(character: PlayerCharacter): GameSave {
  return {
    version: 2,
    character,
    cash: { pocket: 0, bank: character.money },
    xp: 0,
    level: 1,
    trainingPoints: 1,
    upgrades: { health: 0, stamina: 0, power: 0, speed: 0, toughness: 0, technique: 0 },
    moves: [],
    styles: { learned: ['street'], primary: 'street', secondary: null },
    weapons: [],
    gear: ['wraps'],
    equipped: { weapon: null, gear: 'wraps' },
    cosmetics: [],
    flags: {},
    area: 'home',
    entry: 'start',
    mealBuff: false,
    stats: { kos: 0, secrets: 0, bosses: 0, deaths: 0 },
    savedAt: new Date().toISOString(),
  };
}

const num = (v: unknown, fallback: number, min = 0, max = 1e9) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, Math.floor(v))) : fallback);
const list = <T extends string>(v: unknown, allowed: readonly T[]): T[] => (Array.isArray(v) ? [...new Set(v.filter((x): x is T => allowed.includes(x as T)))] : []);

/** Repair a loaded save. Returns null if it can't be used. */
export function sanitiseSave(raw: unknown): GameSave | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<GameSave>;
  const character = sanitiseCharacter(r.character);
  if (!character) return null;
  const base = newSave(character);
  const learned = list(r.styles?.learned, STYLE_IDS);
  if (!learned.includes('street')) learned.unshift('street');
  const primary = learned.includes(r.styles?.primary as StyleId) ? (r.styles!.primary as StyleId) : 'street';
  const secondary = r.styles?.secondary && learned.includes(r.styles.secondary) && r.styles.secondary !== primary ? r.styles.secondary : null;
  const upgrades = { ...base.upgrades };
  for (const id of UPGRADE_IDS) upgrades[id] = num(r.upgrades?.[id], 0, 0, UPGRADES[id].maxRank);
  const weapons = list(r.weapons, WEAPON_IDS);
  const gear = list(r.gear, GEAR_IDS);
  if (!gear.includes('wraps')) gear.unshift('wraps');
  const flags: Record<string, true> = {};
  if (r.flags && typeof r.flags === 'object') for (const [k, v] of Object.entries(r.flags)) if (v === true) flags[k] = true;
  return {
    ...base,
    cash: { pocket: num(r.cash?.pocket, 0), bank: num(r.cash?.bank, base.cash.bank) },
    xp: num(r.xp, 0),
    level: num(r.level, 1, 1, LEVEL_CAP),
    trainingPoints: num(r.trainingPoints, 1, 0, 99),
    upgrades,
    moves: list(r.moves, MOVE_UNLOCK_IDS),
    styles: { learned, primary, secondary },
    weapons,
    gear,
    equipped: {
      weapon: r.equipped?.weapon && weapons.includes(r.equipped.weapon) ? r.equipped.weapon : null,
      gear: r.equipped?.gear && gear.includes(r.equipped.gear) ? r.equipped.gear : null,
    },
    cosmetics: list(r.cosmetics, LOCKED_COSMETICS),
    flags,
    area: (AREA_IDS as readonly string[]).includes(r.area as string) ? (r.area as AreaId) : 'home',
    entry: typeof r.entry === 'string' ? r.entry : 'start',
    mealBuff: r.mealBuff === true,
    stats: { kos: num(r.stats?.kos, 0), secrets: num(r.stats?.secrets, 0), bosses: num(r.stats?.bosses, 0), deaths: num(r.stats?.deaths, 0) },
    savedAt: typeof r.savedAt === 'string' ? r.savedAt : base.savedAt,
  };
}

export type PurchaseResult = { ok: true } | { ok: false; reason: string };

/**
 * The one place progress changes. Rewards go through `claim` so a one-time
 * reward (boss, secret, encounter) can never be paid twice.
 */
export class Progress {
  constructor(public save: GameSave) {}

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
  addXp(amount: number): number {
    const s = this.save;
    s.xp += Math.max(0, Math.round(amount));
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

  // ---- finds ------------------------------------------------------------------------
  addWeapon(id: WeaponId): boolean {
    if (this.save.weapons.includes(id)) return false;
    this.save.weapons.push(id);
    return true;
  }

  addGear(id: GearId): boolean {
    if (this.save.gear.includes(id)) return false;
    this.save.gear.push(id);
    return true;
  }

  addCosmetic(id: string): boolean {
    if (this.save.cosmetics.includes(id)) return false;
    this.save.cosmetics.push(id);
    return true;
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
      appearance: c.appearance,
      styleRanks: c.styleRanks,
      perks,
      inputBufferFrames: touch ? 12 : undefined,
      grabProtectFrames: 150,
      weapon: s.equipped.weapon,
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
    if (s.equipped.gear) for (const m of GEAR[s.equipped.gear].modifiers) f.stats.addModifier({ ...m, id: `${m.id}_${s.equipped.gear}` });
    if (s.moves.includes('counter_mastery')) f.stats.addModifier({ id: 'counter_mastery', source: 'move', flat: 'parryFrames', add: 3 });
    if (s.moves.includes('iron_chin')) f.stats.addModifier({ id: 'iron_chin', source: 'move', flat: 'maxPoise', add: 30 });
    if (s.mealBuff) f.stats.addModifier({ id: 'meal', source: 'meal', flat: 'maxHealth', add: 25 });
    f.poise = f.stats.maxPoise;
  }
}
