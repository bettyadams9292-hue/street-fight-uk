import type { Modifier } from '../stats/Stats';

/**
 * Everyday needs: food, sleep, washing, teeth, the loo, and how well you've
 * been eating. All 0..100. For hunger, energy, hygiene and teeth, high is good
 * (100 = full, rested, clean); for the bladder, 0 is comfortable.
 *
 * Balanced to be part of the life, not a chore: a long session out needs a
 * meal and a wash afterwards, the effects of letting things slide are small
 * (a little slower stamina back, a bit less of it), and nothing ever hurts you
 * or stops you playing. Eating well gives a small bonus.
 */
export interface NeedsSave {
  hunger: number;
  energy: number;
  hygiene: number;
  oral: number;
  bladder: number;
  /** Diet quality: a running average of how good the food's been. */
  nutrition: number;
}

export type NeedKey = keyof NeedsSave;
export const NEED_KEYS: NeedKey[] = ['hunger', 'energy', 'hygiene', 'oral', 'bladder', 'nutrition'];
export const NEED_NAMES: Record<NeedKey, string> = { hunger: 'Hunger', energy: 'Energy', hygiene: 'Hygiene', oral: 'Teeth', bladder: 'Bladder', nutrition: 'Diet' };

/** Per second of play. */
export const NEED_RATES = {
  /** Full to empty in about 45 minutes out and about; slower sat at home. */
  hunger: 100 / 2700,
  /** Rested to shattered in about an hour and a half out; much slower at home. */
  energy: 100 / 5400,
  /** Clean to grubby: about an hour out, three at home; fighting makes you sweat. */
  hygieneOut: 100 / 3600,
  hygieneHome: 100 / 10800,
  hygieneFight: 100 / 900,
  /** Teeth want brushing every couple of hours of play. */
  oral: 100 / 7200,
  /** Needs the loo every 40 minutes or so; drinks speed it up. */
  bladder: 100 / 2400,
};

export function defaultNeeds(): NeedsSave {
  return { hunger: 80, energy: 90, hygiene: 85, oral: 80, bladder: 10, nutrition: 60 };
}

const clamp = (v: number) => Math.max(0, Math.min(100, v));

export function sanitiseNeeds(raw: unknown): NeedsSave {
  const base = defaultNeeds();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<NeedsSave>;
  const out = { ...base };
  for (const k of NEED_KEYS) if (typeof r[k] === 'number' && Number.isFinite(r[k])) out[k] = clamp(r[k] as number);
  return out;
}

export interface NeedsContext {
  /** In the house (or the basement). */
  home: boolean;
  /** A fight going on. */
  fighting: boolean;
  /** Asleep: needs barely move. */
  sleeping?: boolean;
}

/** Time passing. */
export function tickNeeds(n: NeedsSave, dt: number, ctx: NeedsContext): void {
  if (ctx.sleeping) return;
  const homeK = ctx.home ? 0.6 : 1;
  n.hunger = clamp(n.hunger - NEED_RATES.hunger * dt * homeK * (ctx.fighting ? 1.5 : 1));
  n.energy = clamp(n.energy - NEED_RATES.energy * dt * (ctx.home ? 0.4 : 1) * (ctx.fighting ? 2 : 1));
  n.hygiene = clamp(n.hygiene - (ctx.home ? NEED_RATES.hygieneHome : NEED_RATES.hygieneOut) * dt - (ctx.fighting ? NEED_RATES.hygieneFight * dt : 0));
  n.oral = clamp(n.oral - NEED_RATES.oral * dt);
  n.bladder = clamp(n.bladder + NEED_RATES.bladder * dt);
}

/** What eating something does. */
export interface FoodValue {
  /** Hunger filled. */
  fill: number;
  /** Diet quality of this food, 0..100. */
  diet: number;
  /** Energy boost. */
  energy?: number;
  /** Drinks fill the bladder. */
  bladder?: number;
}

/** Eat or drink: hunger fills, diet quality moves towards the food's, teeth get a little worse. */
export function eat(n: NeedsSave, f: FoodValue): void {
  n.hunger = clamp(n.hunger + f.fill);
  if (f.energy) n.energy = clamp(n.energy + f.energy);
  if (f.bladder) n.bladder = clamp(n.bladder + f.bladder);
  if (f.fill > 0) {
    // Bigger meals count for more of your diet.
    const w = Math.min(0.35, f.fill / 200);
    n.nutrition = clamp(n.nutrition + (f.diet - n.nutrition) * w);
    n.oral = clamp(n.oral - Math.min(6, f.fill / 10) * (f.diet < 30 ? 1.5 : 1));
  }
}

// ---- labels ------------------------------------------------------------------------------

export type HygieneLevel = 'Excellent' | 'Good' | 'Average' | 'Poor' | 'Very poor';
export function hygieneLevel(v: number): HygieneLevel {
  if (v >= 90) return 'Excellent';
  if (v >= 70) return 'Good';
  if (v >= 40) return 'Average';
  if (v >= 20) return 'Poor';
  return 'Very poor';
}

export interface NeedLabel {
  label: string;
  /** 0 fine, 1 worth doing something about, 2 needs it now. */
  urgency: 0 | 1 | 2;
  /** 0..1 bar, full is good. */
  bar: number;
  colour: string;
}

const COL = ['#6ad04a', '#e8c040', '#e05a3a'];

export function needLabel(k: NeedKey, v: number): NeedLabel {
  const L = (label: string, urgency: 0 | 1 | 2, bar = v / 100): NeedLabel => ({ label, urgency, bar, colour: COL[urgency] });
  switch (k) {
    case 'hunger':
      return v >= 75 ? L('Full', 0) : v >= 45 ? L('Satisfied', 0) : v >= 25 ? L('Peckish', 1) : v >= 10 ? L('Hungry', 2) : L('Starving', 2);
    case 'energy':
      return v >= 70 ? L('Rested', 0) : v >= 40 ? L('Fine', 0) : v >= 20 ? L('Tired', 1) : L('Exhausted', 2);
    case 'hygiene': {
      const lv = hygieneLevel(v);
      return v >= 40 ? L(lv, 0) : v >= 20 ? L(`${lv} — needs a shower`, 1) : L(`${lv} — needs a shower`, 2);
    }
    case 'oral':
      return v >= 60 ? L('Fresh', 0) : v >= 30 ? L('Could brush', 1) : L('Needs brushing', 2);
    case 'bladder':
      return v <= 50 ? L('Comfortable', 0, 1 - v / 100) : v <= 80 ? L('Needs the loo', 1, 1 - v / 100) : L('Bursting', 2, 1 - v / 100);
    case 'nutrition':
      return v >= 75 ? L('Eating well', 0) : v >= 45 ? L('Balanced', 0) : v >= 25 ? L('Poor diet', 1) : L('Junk food diet', 2);
  }
}

/** The needs that want attention, most urgent first (for the HUD). */
export function attention(n: NeedsSave): { key: NeedKey; label: NeedLabel }[] {
  return NEED_KEYS.map((key) => ({ key, label: needLabel(key, n[key]) }))
    .filter((x) => x.label.urgency > 0)
    .sort((a, b) => b.label.urgency - a.label.urgency);
}

/** "Comfortable" overall, or what's worst. */
export function overallNeeds(n: NeedsSave): string {
  const a = attention(n);
  if (!a.length) return 'Comfortable';
  return a[0].label.label;
}

/**
 * Small, gentle effects. Hungry or exhausted: stamina comes back a bit slower.
 * Starving: a little less stamina. A poor diet over time: slightly slower
 * recovery; a good one: a little more stamina. Hygiene, teeth and the loo
 * never touch your fighting.
 */
export function needsModifiers(n: NeedsSave): Modifier[] {
  const out: Modifier[] = [];
  if (n.hunger < 25) out.push({ id: 'need_hungry', source: 'needs', stat: 'staminaRegenMult', mul: n.hunger < 10 ? 0.85 : 0.93 });
  if (n.hunger < 10) out.push({ id: 'need_starving', source: 'needs', flat: 'maxStamina', add: -10 });
  if (n.energy < 20) out.push({ id: 'need_tired', source: 'needs', stat: 'staminaRegenMult', mul: 0.92 });
  if (n.nutrition < 25) out.push({ id: 'need_diet', source: 'needs', stat: 'staminaRegenMult', mul: 0.95 });
  else if (n.nutrition >= 75) out.push({ id: 'need_eating_well', source: 'needs', flat: 'maxStamina', add: 8 });
  return out;
}

/** One line per effect, for the character screen. */
export function needsEffects(n: NeedsSave): string[] {
  const out: string[] = [];
  if (n.hunger < 10) out.push('Starving: −15% stamina recovery, −10 max stamina');
  else if (n.hunger < 25) out.push('Hungry: −7% stamina recovery');
  if (n.energy < 20) out.push('Tired: −8% stamina recovery');
  if (n.nutrition < 25) out.push('Poor diet: −5% stamina recovery');
  else if (n.nutrition >= 75) out.push('Eating well: +8 max stamina');
  return out;
}

/** A key that changes when the modifiers would (so the fighter is only rebuilt then). */
export function needsModifierKey(n: NeedsSave): string {
  return needsModifiers(n)
    .map((m) => `${m.id}:${m.mul ?? m.add}`)
    .join('|');
}
