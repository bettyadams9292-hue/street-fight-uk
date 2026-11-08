import { WEAPONS, type WeaponClass, type WeaponData, type WeaponId } from './Weapons';
import type { MoveData } from './MoveData';

/**
 * Workshop upgrades on a weapon. Stored on the weapon's item stack, carried
 * into the fighter's hands, and applied to the real swing data: damage,
 * how long it lasts, how fast it comes out, and how much it tires you.
 */
export const MOD_KEYS = ['power', 'durability', 'speed', 'handling'] as const;
export type ModKey = (typeof MOD_KEYS)[number];
export type WeaponMods = Partial<Record<ModKey, number>>;

export const MOD_LABELS: Record<ModKey, { name: string; per: string }> = {
  power: { name: 'Damage', per: '+12% damage per level' },
  durability: { name: 'Durability', per: '+35% swings before it wears out per level' },
  speed: { name: 'Attack speed', per: '1 frame faster to start and 2 to recover per level' },
  handling: { name: 'Handling', per: '−15% stamina per swing and steadier hits per level' },
};

/** How far each kind of weapon can be taken. Things that smash can't be upgraded. */
export const MOD_LIMITS: Record<WeaponClass, Record<ModKey, number>> = {
  blade: { power: 3, durability: 2, speed: 3, handling: 2 },
  blunt: { power: 3, durability: 3, speed: 2, handling: 2 },
  heavy: { power: 3, durability: 3, speed: 1, handling: 3 },
  long: { power: 2, durability: 3, speed: 2, handling: 3 },
  improvised: { power: 2, durability: 2, speed: 1, handling: 1 },
  thrown: { power: 0, durability: 0, speed: 0, handling: 0 },
};

export function modLimit(id: WeaponId, key: ModKey): number {
  const w = WEAPONS[id];
  if (w.breaks) return 0;
  return MOD_LIMITS[w.cls][key];
}

export function cleanMods(raw: unknown, id: WeaponId | null): WeaponMods | undefined {
  if (!raw || typeof raw !== 'object' || !id) return undefined;
  const out: WeaponMods = {};
  for (const k of MOD_KEYS) {
    const v = (raw as Record<string, unknown>)[k];
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) out[k] = Math.min(modLimit(id, k), Math.floor(v));
    if (!out[k]) delete out[k];
  }
  return Object.keys(out).length ? out : undefined;
}

const cache = new Map<string, WeaponData>();

function upMove(m: MoveData, mods: WeaponMods): MoveData {
  const p = mods.power ?? 0;
  const sp = mods.speed ?? 0;
  const h = mods.handling ?? 0;
  return {
    ...m,
    damage: Math.round(m.damage * (1 + 0.12 * p) * 10) / 10,
    startup: Math.max(3, m.startup - sp),
    recovery: Math.max(6, m.recovery - 2 * sp),
    staminaCost: Math.round(m.staminaCost * Math.max(0.4, 1 - 0.15 * h) * 10) / 10,
    poiseDamage: m.poiseDamage !== undefined ? Math.round(m.poiseDamage * (1 + 0.08 * p + 0.05 * h)) : m.poiseDamage,
  };
}

/** The weapon's swing data with its upgrades applied (same object for no upgrades). */
export function upgradedWeapon(id: WeaponId, mods?: WeaponMods): WeaponData {
  const base = WEAPONS[id];
  if (!mods || !Object.keys(mods).length) return base;
  const key = `${id}|${MOD_KEYS.map((k) => mods[k] ?? 0).join(',')}`;
  let w = cache.get(key);
  if (!w) {
    w = {
      ...base,
      durability: Math.round(base.durability * (1 + 0.35 * (mods.durability ?? 0))),
      light: upMove(base.light, mods),
      heavy: upMove(base.heavy, mods),
    };
    cache.set(key, w);
  }
  return w;
}

export function maxDurability(id: WeaponId, mods?: WeaponMods): number {
  return upgradedWeapon(id, mods).durability;
}
