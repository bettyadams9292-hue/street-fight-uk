/**
 * Attributes, derived stats and the effects/modifier system shared by every
 * fighter (player and enemies alike). Equipment, fatigue, buffs and debuffs
 * all go through modifiers here, so stacking and removal are always correct.
 */

export const ATTRIBUTE_NAMES = ['strength', 'speed', 'endurance', 'agility', 'defence', 'technique'] as const;
export type AttributeName = (typeof ATTRIBUTE_NAMES)[number];
export type Attributes = Record<AttributeName, number>;

/** Multipliers applied on top of attribute-derived values. All default to 1. */
export const DERIVED_STAT_NAMES = [
  'damageMult',
  'attackSpeedMult',
  'moveSpeedMult',
  'damageTakenMult',
  'staminaRegenMult',
  'staminaCostMult',
] as const;
export type DerivedStatName = (typeof DERIVED_STAT_NAMES)[number];

/** Flat additions (upgrades, gear, buffs). */
export type FlatStatName = 'maxHealth' | 'maxStamina' | 'maxPoise' | 'parryFrames';

export interface Modifier {
  /** Unique id; adding a modifier with an existing id replaces it. */
  id: string;
  /** What applied it, e.g. 'fatigue', 'item_hand_wraps'. */
  source: string;
  attribute?: AttributeName;
  stat?: DerivedStatName;
  /** Flat bonus to a derived value, e.g. +20 max health. Uses `add`. */
  flat?: FlatStatName;
  /** Flat amount added (attributes) before multipliers. */
  add?: number;
  /** Multiplier applied after adds. */
  mul?: number;
  /** Tags granted while this modifier is active, e.g. 'state.exhausted'. */
  tags?: string[];
}

export const ATTRIBUTE_CAP = 50;

export function defaultAttributes(value = 5): Attributes {
  return { strength: value, speed: value, endurance: value, agility: value, defence: value, technique: value };
}

export class Stats {
  readonly base: Attributes;
  level: number;
  private modifiers = new Map<string, Modifier>();

  constructor(base: Attributes = defaultAttributes(), level = 1) {
    this.base = { ...base };
    this.level = level;
  }

  // ---- modifiers -------------------------------------------------------

  addModifier(mod: Modifier): void {
    this.modifiers.set(mod.id, mod);
  }

  removeModifier(id: string): void {
    this.modifiers.delete(id);
  }

  removeModifiersFrom(source: string): void {
    for (const [id, mod] of this.modifiers) if (mod.source === source) this.modifiers.delete(id);
  }

  hasModifier(id: string): boolean {
    return this.modifiers.has(id);
  }

  hasTag(tag: string): boolean {
    for (const mod of this.modifiers.values()) if (mod.tags?.includes(tag)) return true;
    return false;
  }

  // ---- attributes ------------------------------------------------------

  attr(name: AttributeName): number {
    let add = 0;
    let mul = 1;
    for (const mod of this.modifiers.values()) {
      if (mod.attribute !== name) continue;
      add += mod.add ?? 0;
      mul *= mod.mul ?? 1;
    }
    return Math.max(0, Math.min(ATTRIBUTE_CAP, (this.base[name] + add) * mul));
  }

  flat(name: FlatStatName): number {
    let add = 0;
    for (const mod of this.modifiers.values()) if (mod.flat === name) add += mod.add ?? 0;
    return add;
  }

  derived(name: DerivedStatName): number {
    let mul = 1;
    for (const mod of this.modifiers.values()) if (mod.stat === name) mul *= mod.mul ?? 1;
    return mul;
  }

  // ---- derived gameplay values (see design doc: "What each attribute does") ----

  get maxHealth(): number {
    return 80 + 4 * this.attr('defence') + 4 * this.attr('endurance') + 5 * this.level + this.flat('maxHealth');
  }

  get maxStamina(): number {
    return 100 + 8 * this.attr('endurance') + this.flat('maxStamina');
  }

  /** Stamina recovered per second once the regen delay has passed. */
  get staminaRegenPerSecond(): number {
    return 22 * (1 + 0.015 * this.attr('endurance')) * this.derived('staminaRegenMult');
  }

  /** Outgoing damage multiplier: Strength plus any damage effects (fatigue, gear). */
  get damageMultiplier(): number {
    return (1 + 0.03 * this.attr('strength')) * this.derived('damageMult');
  }

  get poiseDamageMultiplier(): number {
    return 1 + 0.03 * this.attr('strength');
  }

  /** Attack animation speed; Speed gives +1.5% per point, capped at +25%. */
  get attackSpeed(): number {
    return Math.min(1.25, 1 + 0.015 * this.attr('speed')) * this.derived('attackSpeedMult');
  }

  get moveSpeedMultiplier(): number {
    return (1 + 0.01 * this.attr('speed')) * this.derived('moveSpeedMult');
  }

  /** Agility speeds up movement into and out of the screen. */
  get depthSpeedMultiplier(): number {
    return (1 + 0.02 * this.attr('agility')) * this.derived('moveSpeedMult');
  }

  /** Fraction of incoming damage removed by Defence (diminishing returns). */
  get defenceReduction(): number {
    const d = this.attr('defence');
    return d / (d + 40);
  }

  get damageTakenMultiplier(): number {
    return this.derived('damageTakenMult');
  }

  /** Multiplier on stamina lost when a hit is blocked; -2% per Defence point. */
  get blockStaminaMultiplier(): number {
    return Math.max(0.4, 1 - 0.02 * this.attr('defence'));
  }

  get staminaCostMultiplier(): number {
    return this.derived('staminaCostMult');
  }

  /** Chance of a clean hit (x1.3 damage, extra poise damage). */
  get cleanHitChance(): number {
    return 0.01 * this.attr('technique');
  }

  get maxPoise(): number {
    return 45 + 1.5 * this.attr('defence') + this.flat('maxPoise');
  }

  /** Frames shaved off getting up from a knockdown. */
  get getUpSpeedBonusFrames(): number {
    return Math.floor(this.attr('agility') / 2);
  }
}
