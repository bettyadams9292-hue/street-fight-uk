import { move, type MoveData, type Reaction } from './MoveData';

/**
 * Melee weapons and improvised weapons. No firearms, ever: everything here is
 * swung, jabbed or thrown.
 *
 * While held, the punch and kick buttons swing it (light / heavy, no combos).
 * Each connecting swing wears it down; some smash. Grab throws a throwable
 * weapon and drops anything else. Knockdowns make you drop what you hold.
 */
export const WEAPON_IDS = [
  // conventional
  'bottle', 'broken_bottle', 'bat', 'baseball_bat', 'pipe', 'metal_bar', 'crowbar', 'hammer', 'machete', 'knife',
  'chain', 'wrench', 'club', 'pool_cue', 'pole', 'torch',
  // improvised
  'mop', 'broom', 'road_sign', 'cone', 'plank', 'chair_leg', 'table_leg', 'chair', 'tv', 'monitor', 'skateboard',
  'umbrella', 'shelf_bar', 'shovel', 'garden_fork', 'rake', 'brick', 'frying_pan', 'golf_club', 'dustbin_lid',
] as const;
export type WeaponId = (typeof WEAPON_IDS)[number];

export type WeaponClass = 'blunt' | 'blade' | 'heavy' | 'long' | 'improvised' | 'thrown';

export interface WeaponData {
  id: WeaponId;
  name: string;
  /** Short line for the inventory. */
  text: string;
  cls: WeaponClass;
  /** Swings before it breaks or is worn out. */
  durability: number;
  /** Smashes on its last hit (no leftover pickup). */
  breaks: boolean;
  /** Turns into another weapon when it breaks (a bottle becomes a broken bottle). */
  breaksInto?: WeaponId;
  /** kg: heavier is slower to swing and costs more stamina. */
  weight: number;
  throwable: boolean;
  throwDamage: number;
  /** Shop/pawn value in pounds. */
  value: number;
  light: MoveData;
  heavy: MoveData;
  /** For the renderer. */
  colour: string;
  length: number;
}

interface Spec {
  name: string;
  text: string;
  cls: WeaponClass;
  durability: number;
  breaks?: boolean;
  breaksInto?: WeaponId;
  weight: number;
  /** Light / heavy damage. */
  dmg: [number, number];
  /** Light / heavy startup frames. */
  startup: [number, number];
  /** Light / heavy recovery frames. */
  recovery: [number, number];
  reach: number;
  /** Heavy-swing reaction. */
  heavyReaction?: Reaction;
  knock?: [number, number];
  throwable?: boolean;
  throwDamage?: number;
  value: number;
  colour: string;
  length: number;
}

function build(id: WeaponId, s: Spec): WeaponData {
  const stam = 0.7 + s.weight * 0.25;
  const swing = (kind: 'light' | 'heavy'): MoveData => {
    const i = kind === 'light' ? 0 : 1;
    const light = kind === 'light';
    const blade = s.cls === 'blade';
    return move({
      id: `${id}_${kind}`,
      name: `${s.name} ${light ? (blade ? 'slash' : 'swing') : s.cls === 'long' ? 'thrust' : 'overhead'}`,
      style: 'weapon',
      button: light ? 'lp' : 'hp',
      kind,
      anim: light ? 'hook' : s.cls === 'long' ? 'cross' : 'overhand',
      limb: 'rearHand',
      startup: s.startup[i],
      active: light ? 4 : 5,
      recovery: s.recovery[i],
      damage: s.dmg[i],
      staminaCost: Math.round((light ? 8 : 14) * stam),
      reach: s.reach,
      hitRadius: s.cls === 'heavy' ? 0.36 : 0.28,
      hitY: light ? 1.35 : 1.5,
      depthTolerance: s.cls === 'heavy' ? 0.75 : 0.6,
      hitstun: light ? 20 + Math.round(s.weight * 2) : 26 + Math.round(s.weight * 2),
      blockstun: light ? 12 : 18,
      knockback: (s.knock ?? [2.2, 3.8])[i],
      poiseDamage: Math.round((light ? 22 : 44) * (0.7 + s.weight * 0.2)),
      reaction: light ? (s.weight >= 4 ? 'stagger' : 'flinch') : s.heavyReaction ?? 'knockdown',
      hitstop: light ? 5 + Math.round(s.weight) : 8 + Math.round(s.weight),
      lunge: s.cls === 'long' ? 0.2 : 0.12,
    });
  };
  return {
    id,
    name: s.name,
    text: s.text,
    cls: s.cls,
    durability: s.durability,
    breaks: !!s.breaks,
    breaksInto: s.breaksInto,
    weight: s.weight,
    throwable: !!s.throwable,
    throwDamage: s.throwDamage ?? 0,
    value: s.value,
    light: swing('light'),
    heavy: swing('heavy'),
    colour: s.colour,
    length: s.length,
  };
}

const SPECS: Record<WeaponId, Spec> = {
  // ---- conventional -----------------------------------------------------------------
  bottle: { name: 'Glass bottle', text: 'Smashes on the second hit, leaving a broken bottle. Throwable.', cls: 'thrown', durability: 2, breaks: true, breaksInto: 'broken_bottle', weight: 0.6, dmg: [10, 18], startup: [6, 11], recovery: [14, 22], reach: 0.75, throwable: true, throwDamage: 16, value: 1, colour: '#2f6b3a', length: 0.3 },
  broken_bottle: { name: 'Broken bottle', text: 'Quick, nasty and short-lived.', cls: 'blade', durability: 4, breaks: true, weight: 0.4, dmg: [12, 17], startup: [5, 9], recovery: [12, 18], reach: 0.7, heavyReaction: 'stagger', value: 0, colour: '#2f6b3a', length: 0.2 },
  bat: { name: 'Cricket bat', text: 'Wide, heavy face. Dependable.', cls: 'blunt', durability: 10, weight: 1.2, dmg: [12, 22], startup: [8, 15], recovery: [16, 26], reach: 1.05, value: 25, colour: '#c9a46a', length: 0.85 },
  baseball_bat: { name: 'Baseball bat', text: 'Long reach and a big heavy swing.', cls: 'blunt', durability: 12, weight: 1.0, dmg: [13, 24], startup: [8, 15], recovery: [16, 26], reach: 1.1, value: 30, colour: '#8a5a32', length: 0.86 },
  pipe: { name: 'Lead pipe', text: 'Heavy and hard to break.', cls: 'blunt', durability: 14, weight: 2.0, dmg: [14, 24], startup: [9, 16], recovery: [18, 28], reach: 0.95, value: 8, colour: '#7c8088', length: 0.75 },
  metal_bar: { name: 'Metal bar', text: 'Rebar off a building site. Slow, solid hits.', cls: 'blunt', durability: 16, weight: 2.5, dmg: [15, 26], startup: [10, 17], recovery: [19, 29], reach: 1.0, value: 5, colour: '#6b4a3a', length: 0.9 },
  crowbar: { name: 'Crowbar', text: 'Hooked end bites on the heavy swing.', cls: 'blunt', durability: 18, weight: 1.8, dmg: [14, 25], startup: [9, 15], recovery: [17, 26], reach: 0.9, value: 15, colour: '#b3121b', length: 0.75 },
  hammer: { name: 'Claw hammer', text: 'Short but hits like a brick.', cls: 'blunt', durability: 14, weight: 0.8, dmg: [12, 22], startup: [6, 12], recovery: [13, 22], reach: 0.72, value: 12, colour: '#3a3a3a', length: 0.34 },
  machete: { name: 'Machete', text: 'Fast, wide slashes. Dulls with use.', cls: 'blade', durability: 12, weight: 0.7, dmg: [15, 25], startup: [6, 12], recovery: [13, 22], reach: 0.95, heavyReaction: 'stagger', value: 35, colour: '#c0c4c8', length: 0.62 },
  knife: { name: 'Kitchen knife', text: 'Fastest thing going, very short reach.', cls: 'blade', durability: 10, weight: 0.3, dmg: [11, 18], startup: [4, 8], recovery: [10, 16], reach: 0.62, heavyReaction: 'stagger', value: 10, colour: '#d0d4d8', length: 0.3 },
  chain: { name: 'Bike chain', text: 'Whips past guards with long reach.', cls: 'long', durability: 15, weight: 1.2, dmg: [11, 20], startup: [8, 14], recovery: [16, 24], reach: 1.2, heavyReaction: 'stagger', value: 6, colour: '#5a5e64', length: 0.9 },
  wrench: { name: 'Pipe wrench', text: 'Heavy head, short handle.', cls: 'blunt', durability: 18, weight: 2.0, dmg: [14, 24], startup: [9, 15], recovery: [17, 26], reach: 0.82, value: 18, colour: '#a01818', length: 0.45 },
  club: { name: 'Wooden club', text: 'A chunk of hardwood. Simple and effective.', cls: 'blunt', durability: 10, weight: 1.3, dmg: [13, 22], startup: [8, 14], recovery: [16, 25], reach: 0.9, value: 8, colour: '#6a4a2a', length: 0.7 },
  pool_cue: { name: 'Pool cue', text: 'Long, quick pokes. Snaps eventually.', cls: 'long', durability: 6, breaks: true, weight: 0.5, dmg: [10, 17], startup: [6, 11], recovery: [12, 20], reach: 1.35, heavyReaction: 'stagger', value: 15, colour: '#d8b070', length: 1.45 },
  pole: { name: 'Scaffold pole', text: 'Enormous reach, enormous effort.', cls: 'long', durability: 20, weight: 4.0, dmg: [14, 26], startup: [12, 20], recovery: [22, 32], reach: 1.5, knock: [3, 5], value: 4, colour: '#8a9098', length: 1.7 },
  torch: { name: 'Heavy torch', text: 'Steel-cased torch. Weighted end.', cls: 'blunt', durability: 14, weight: 0.9, dmg: [11, 19], startup: [6, 12], recovery: [13, 21], reach: 0.72, value: 20, colour: '#202226', length: 0.38 },
  // ---- improvised -----------------------------------------------------------------
  mop: { name: 'Mop', text: 'Wet head, long handle. Pushes people back.', cls: 'improvised', durability: 6, breaks: true, weight: 1.2, dmg: [8, 15], startup: [8, 14], recovery: [15, 24], reach: 1.3, heavyReaction: 'stagger', knock: [3, 4.5], value: 3, colour: '#4a7ab0', length: 1.3 },
  broom: { name: 'Broom', text: 'Long, light, breaks fast.', cls: 'improvised', durability: 5, breaks: true, weight: 0.8, dmg: [8, 14], startup: [7, 12], recovery: [13, 22], reach: 1.3, heavyReaction: 'stagger', value: 3, colour: '#2a5a2a', length: 1.3 },
  road_sign: { name: 'Road sign', text: 'A whole sign on a post. Huge, slow, devastating.', cls: 'heavy', durability: 8, weight: 5.0, dmg: [16, 30], startup: [14, 22], recovery: [24, 34], reach: 1.4, knock: [3.5, 6], value: 2, colour: '#d81e1e', length: 1.5 },
  cone: { name: 'Traffic cone', text: 'Mostly embarrassing for whoever gets hit. Throwable.', cls: 'improvised', durability: 6, breaks: true, weight: 1.0, dmg: [6, 11], startup: [6, 11], recovery: [12, 20], reach: 0.8, heavyReaction: 'stagger', throwable: true, throwDamage: 8, value: 1, colour: '#ff5a1a', length: 0.7 },
  plank: { name: 'Wooden plank', text: 'Splinters eventually. Good reach.', cls: 'improvised', durability: 7, breaks: true, weight: 1.6, dmg: [12, 21], startup: [9, 15], recovery: [17, 26], reach: 1.15, value: 1, colour: '#b08a5a', length: 1.1 },
  chair_leg: { name: 'Chair leg', text: 'Short club off a broken chair.', cls: 'improvised', durability: 6, breaks: true, weight: 0.6, dmg: [10, 17], startup: [6, 11], recovery: [12, 20], reach: 0.75, value: 1, colour: '#7a5a3a', length: 0.45 },
  table_leg: { name: 'Table leg', text: 'Thick turned leg. Decent club.', cls: 'improvised', durability: 8, breaks: true, weight: 1.1, dmg: [11, 20], startup: [8, 14], recovery: [15, 24], reach: 0.88, value: 1, colour: '#6a4a2a', length: 0.7 },
  chair: { name: 'Pub chair', text: 'Breaks over someone, leaves a chair leg. Throwable.', cls: 'heavy', durability: 2, breaks: true, breaksInto: 'chair_leg', weight: 4.0, dmg: [14, 28], startup: [12, 18], recovery: [20, 30], reach: 1.0, knock: [3, 5.5], throwable: true, throwDamage: 22, value: 5, colour: '#5a3a20', length: 0.9 },
  tv: { name: 'Old telly', text: 'One almighty hit then it’s scrap. Throwable.', cls: 'heavy', durability: 1, breaks: true, weight: 6.0, dmg: [20, 34], startup: [16, 22], recovery: [24, 34], reach: 0.95, knock: [4, 6], throwable: true, throwDamage: 30, value: 10, colour: '#2a2a2a', length: 0.55 },
  monitor: { name: 'Computer monitor', text: 'Flat panel. Shatters on the second hit. Throwable.', cls: 'heavy', durability: 2, breaks: true, weight: 3.0, dmg: [14, 26], startup: [11, 17], recovery: [19, 28], reach: 0.9, throwable: true, throwDamage: 20, value: 15, colour: '#18191c', length: 0.6 },
  skateboard: { name: 'Skateboard', text: 'Light, quick, and the wheels sting.', cls: 'improvised', durability: 9, breaks: true, weight: 1.8, dmg: [11, 20], startup: [7, 13], recovery: [14, 23], reach: 0.95, throwable: true, throwDamage: 14, value: 25, colour: '#d83a2a', length: 0.8 },
  umbrella: { name: 'Golf umbrella', text: 'Surprisingly sturdy. Long jabs.', cls: 'long', durability: 8, breaks: true, weight: 0.7, dmg: [8, 14], startup: [6, 10], recovery: [12, 19], reach: 1.15, heavyReaction: 'stagger', value: 8, colour: '#1f2a44', length: 1.0 },
  shelf_bar: { name: 'Shelving upright', text: 'Slotted steel off a shop shelf.', cls: 'blunt', durability: 12, weight: 1.6, dmg: [12, 22], startup: [9, 15], recovery: [17, 26], reach: 1.05, value: 2, colour: '#9aa0a8', length: 1.0 },
  shovel: { name: 'Shovel', text: 'The flat of the blade rings heads.', cls: 'heavy', durability: 16, weight: 2.2, dmg: [15, 27], startup: [11, 18], recovery: [19, 29], reach: 1.2, knock: [3, 5], value: 12, colour: '#5a6a5a', length: 1.15 },
  garden_fork: { name: 'Garden fork', text: 'Long reach, jabs from a distance.', cls: 'long', durability: 12, weight: 1.9, dmg: [13, 22], startup: [9, 15], recovery: [17, 26], reach: 1.3, heavyReaction: 'stagger', value: 10, colour: '#3a5a2a', length: 1.15 },
  rake: { name: 'Garden rake', text: 'Long, awkward, keeps people off you.', cls: 'long', durability: 8, breaks: true, weight: 1.4, dmg: [10, 17], startup: [9, 14], recovery: [16, 24], reach: 1.35, heavyReaction: 'stagger', knock: [3, 4.5], value: 6, colour: '#8a6a3a', length: 1.4 },
  brick: { name: 'Half brick', text: 'Throw it. Or hit with it, if you must.', cls: 'thrown', durability: 4, breaks: true, weight: 1.8, dmg: [12, 19], startup: [7, 12], recovery: [14, 22], reach: 0.65, throwable: true, throwDamage: 20, value: 0, colour: '#9a4a32', length: 0.2 },
  frying_pan: { name: 'Frying pan', text: 'Cast iron. Makes a lovely noise.', cls: 'blunt', durability: 16, weight: 2.0, dmg: [13, 23], startup: [8, 14], recovery: [16, 25], reach: 0.8, value: 15, colour: '#1a1a1a', length: 0.5 },
  golf_club: { name: 'Golf club', text: 'A 7-iron. Whippy and fast.', cls: 'blunt', durability: 10, weight: 0.4, dmg: [11, 20], startup: [7, 12], recovery: [14, 22], reach: 1.1, value: 40, colour: '#c0c4c8', length: 0.95 },
  dustbin_lid: { name: 'Bin lid', text: 'A dented metal lid. Bash and bang.', cls: 'improvised', durability: 10, breaks: true, weight: 1.5, dmg: [9, 17], startup: [7, 12], recovery: [14, 22], reach: 0.75, heavyReaction: 'stagger', throwable: true, throwDamage: 14, value: 3, colour: '#8a8d93', length: 0.55 },
};

export const WEAPONS = Object.fromEntries(WEAPON_IDS.map((id) => [id, build(id, SPECS[id])])) as Record<WeaponId, WeaponData>;

export function isWeaponMove(m: MoveData): boolean {
  return m.style === 'weapon';
}

export function isWeaponId(x: unknown): x is WeaponId {
  return typeof x === 'string' && (WEAPON_IDS as readonly string[]).includes(x);
}
