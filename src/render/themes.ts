import type { Theme } from '../world/LevelTypes';

export type GroundKind = 'paving' | 'hard' | 'tiles' | 'wood' | 'carpet' | 'concrete' | 'grass' | 'cobbles' | 'boards';

/** How each kind of area is lit, floored and enclosed. */
export interface ThemeProfile {
  /** A room: cutaway front edge, no sky, no road. */
  interior: boolean;
  /** Under a roof (subway, car park, mall): ceiling and no skyline. */
  roofed: boolean;
  ground: GroundKind;
  /** A road runs along the front. */
  road: boolean;
  /** Distant city on the skyline. */
  skyline: 'none' | 'low' | 'city';
  /** Scene background and fog density. */
  bg: number;
  fog: number;
  /** Graffiti spacing (0 = none). */
  graffiti: number;
  /** Neon tint for signs. */
  neon?: string;
}

const STREET = { interior: false, roofed: false, road: true, skyline: 'low' as const, bg: 0x0b0d14, fog: 0.018 };

export const THEMES: Record<Theme, ThemeProfile> = {
  home: { interior: true, roofed: true, ground: 'wood', road: false, skyline: 'none', bg: 0x07080b, fog: 0, graffiti: 0 },
  shop: { interior: true, roofed: true, ground: 'tiles', road: false, skyline: 'none', bg: 0x07080b, fog: 0, graffiti: 0 },
  pawn: { interior: true, roofed: true, ground: 'carpet', road: false, skyline: 'none', bg: 0x07080b, fog: 0, graffiti: 0 },
  pub: { interior: true, roofed: true, ground: 'boards', road: false, skyline: 'none', bg: 0x07080b, fog: 0, graffiti: 0 },
  estate: { ...STREET, ground: 'paving', graffiti: 10 },
  high_street: { ...STREET, ground: 'paving', graffiti: 16 },
  alleys: { ...STREET, road: false, ground: 'cobbles', graffiti: 7 },
  industrial: { ...STREET, ground: 'hard', graffiti: 10 },
  subway: { interior: false, roofed: true, ground: 'tiles', road: false, skyline: 'none', bg: 0x0c0d0e, fog: 0.03, graffiti: 7 },
  city: { ...STREET, ground: 'paving', skyline: 'city', graffiti: 16 },
  territory: { ...STREET, ground: 'hard', graffiti: 7 },
  residential: { ...STREET, ground: 'paving', graffiti: 20 },
  leisure: { ...STREET, ground: 'paving', graffiti: 12 },
  stadium: { ...STREET, ground: 'paving', skyline: 'city', graffiti: 14 },
  market: { ...STREET, road: false, ground: 'cobbles', graffiti: 12 },
  docks: { ...STREET, road: false, ground: 'concrete', bg: 0x0a0e14, fog: 0.026, graffiti: 12 },
  ind_estate: { ...STREET, ground: 'hard', graffiti: 10 },
  factory: { ...STREET, road: false, ground: 'hard', graffiti: 8 },
  precinct: { ...STREET, road: false, ground: 'paving', graffiti: 9 },
  mall: { interior: false, roofed: true, ground: 'tiles', road: false, skyline: 'none', bg: 0x0a0b0e, fog: 0.012, graffiti: 0 },
  car_park: { interior: false, roofed: true, ground: 'concrete', road: false, skyline: 'none', bg: 0x0a0b0c, fog: 0.028, graffiti: 6 },
  nightlife: { ...STREET, ground: 'paving', skyline: 'city', graffiti: 9, neon: '#ff4ac0' },
  underground: { interior: false, roofed: true, ground: 'concrete', road: false, skyline: 'none', bg: 0x080809, fog: 0.035, graffiti: 5 },
  hq: { ...STREET, road: false, ground: 'hard', skyline: 'city', graffiti: 0, neon: '#ff3a2a' },
};

export function themeProfile(t: Theme): ThemeProfile {
  return THEMES[t] ?? THEMES.estate;
}
