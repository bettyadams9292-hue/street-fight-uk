import { move, type MoveData } from './MoveData';

export const WEAPON_IDS = ['bottle', 'bat', 'pipe'] as const;
export type WeaponId = (typeof WEAPON_IDS)[number];

/**
 * Pick-up weapons. While held, the punch and kick buttons swing it instead
 * (no combos). Each hit wears it down; bottles smash. A knockdown makes you
 * drop it.
 */
export interface WeaponData {
  id: WeaponId;
  name: string;
  /** Hits before it breaks or is worn out. */
  durability: number;
  breaks: boolean;
  light: MoveData;
  heavy: MoveData;
  /** For the renderer. */
  colour: string;
  length: number;
}

const swing = (id: string, name: string, kind: 'light' | 'heavy', damage: number, startup: number, recovery: number, reach: number, extra: Partial<MoveData> = {}): MoveData =>
  move({
    id, name, style: 'weapon', button: kind === 'light' ? 'lp' : 'hp', kind, anim: kind === 'light' ? 'hook' : 'overhand', limb: 'rearHand',
    startup, active: 4, recovery, damage, staminaCost: kind === 'light' ? 9 : 15, reach, hitRadius: 0.28, hitY: kind === 'light' ? 1.35 : 1.55,
    depthTolerance: 0.6, hitstun: kind === 'light' ? 22 : 28, knockback: kind === 'light' ? 2.4 : 4, poiseDamage: kind === 'light' ? 26 : 50,
    reaction: kind === 'light' ? 'flinch' : 'knockdown', hitstop: kind === 'light' ? 6 : 9, lunge: 0.12, ...extra,
  });

export const WEAPONS: Record<WeaponId, WeaponData> = {
  bottle: {
    id: 'bottle', name: 'Bottle', durability: 2, breaks: true, colour: '#2f6b3a', length: 0.3,
    light: swing('bottle_swing', 'Bottle swing', 'light', 10, 6, 14, 0.75),
    heavy: swing('bottle_smash', 'Bottle smash', 'heavy', 18, 11, 22, 0.75),
  },
  bat: {
    id: 'bat', name: 'Cricket bat', durability: 8, breaks: false, colour: '#c9a46a', length: 0.85,
    light: swing('bat_swing', 'Bat swing', 'light', 12, 8, 16, 1.05),
    heavy: swing('bat_overhead', 'Overhead', 'heavy', 22, 15, 26, 1.05),
  },
  pipe: {
    id: 'pipe', name: 'Lead pipe', durability: 10, breaks: false, colour: '#7c8088', length: 0.75,
    light: swing('pipe_swing', 'Pipe swing', 'light', 14, 9, 18, 0.95),
    heavy: swing('pipe_overhead', 'Pipe overhead', 'heavy', 24, 16, 28, 0.95),
  },
};

export function isWeaponMove(m: MoveData): boolean {
  return m.style === 'weapon';
}
