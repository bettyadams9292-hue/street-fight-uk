/**
 * The game's candidate looks. A look is everything that sits on top of the
 * scene without touching a single model: the light the world reflects, the
 * glow around bright things, and the final colour grade.
 *
 * Sodium Night was signed off in phase 2 and is the default. The others stay
 * selectable with `?look=<id>`; `?look=off` or the Display setting gives the
 * plain picture, as does low quality.
 *
 * Pure data, no Three.js, so it can be tested and read by tools.
 */

export type RGB = readonly [number, number, number];

/** A glowing panel in the reflected environment: a street lamp, a lit window, a strip light. */
export interface EnvPanel {
  /** Where it sits around the viewer, in metres. */
  pos: readonly [number, number, number];
  size: readonly [number, number];
  color: RGB;
  /** Brightness; above 1 makes hard glints on wet surfaces. */
  power: number;
}

export interface EnvSpec {
  sky: RGB;
  horizon: RGB;
  ground: RGB;
  panels: readonly EnvPanel[];
  /** How strongly the environment lights the scene (0 = not at all). */
  intensity: number;
}

export interface GradeSpec {
  /** 1 = unchanged. */
  exposure: number;
  contrast: number;
  saturation: number;
  /** Colour pushed into the darks and the brights; mid grey (0.5) pushes nothing. */
  shadowTint: RGB;
  highlightTint: RGB;
  tintAmount: number;
  /** Raises the black level (a faded, filmic floor) with this colour. */
  lift: RGB;
  /** 0 = none; darkens the corners. */
  vignette: number;
  /** 0 = none; film grain. */
  grain: number;
  /** 0 = none; dark ink lines where brightness changes sharply. */
  edges: number;
  /** 0 = off; otherwise the number of tone steps (a printed, poster look). */
  posterize: number;
}

export interface BloomSpec {
  strength: number;
  radius: number;
  /** Only things brighter than this glow. */
  threshold: number;
}

export interface Look {
  id: string;
  name: string;
  /** One line a person can judge the look against. */
  intent: string;
  outdoors: EnvSpec;
  indoors: EnvSpec;
  bloom: BloomSpec;
  grade: GradeSpec;
}

const SODIUM: RGB = [1.0, 0.56, 0.16];
const COOL_WINDOW: RGB = [0.62, 0.78, 1.0];
const WARM_BULB: RGB = [1.0, 0.8, 0.56];

export const LOOKS: readonly Look[] = [
  {
    id: 'sodium',
    name: 'Sodium Night',
    intent: 'Wet streets under orange lamps: teal shadows, amber light, lamps and windows that glow.',
    outdoors: {
      sky: [0.012, 0.02, 0.04],
      horizon: [0.16, 0.1, 0.07],
      ground: [0.02, 0.018, 0.018],
      panels: [
        { pos: [-7, 6, 3], size: [1.4, 1.4], color: SODIUM, power: 9 },
        { pos: [8, 6, -2], size: [1.4, 1.4], color: SODIUM, power: 9 },
        { pos: [1, 2.4, -9], size: [5, 2], color: COOL_WINDOW, power: 1.4 },
      ],
      intensity: 1.0,
    },
    indoors: {
      sky: [0.1, 0.085, 0.07],
      horizon: [0.09, 0.075, 0.065],
      ground: [0.04, 0.032, 0.03],
      panels: [
        { pos: [0, 5, 0], size: [1.2, 1.2], color: WARM_BULB, power: 7 },
        { pos: [-6, 2, -6], size: [2.4, 2], color: [0.2, 0.32, 0.6], power: 1.2 },
      ],
      intensity: 0.5,
    },
    // Only real light sources bloom (lamps, neon, lit windows); white paint under a room light doesn't.
    bloom: { strength: 0.4, radius: 0.6, threshold: 0.97 },
    grade: {
      exposure: 1.15,
      contrast: 1.06,
      saturation: 1.1,
      shadowTint: [0.4, 0.52, 0.58],
      highlightTint: [0.6, 0.52, 0.4],
      tintAmount: 0.22,
      lift: [0.004, 0.012, 0.02],
      vignette: 0.36,
      grain: 0.035,
      edges: 0,
      posterize: 0,
    },
  },
  {
    id: 'overcast',
    name: 'Kitchen Sink',
    intent: 'British social-realist film: drained colour, flat grey light, soft blacks, visible grain.',
    outdoors: {
      sky: [0.08, 0.09, 0.1],
      horizon: [0.1, 0.1, 0.1],
      ground: [0.03, 0.03, 0.03],
      panels: [
        { pos: [-7, 6, 3], size: [1.2, 1.2], color: [1.0, 0.7, 0.4], power: 4 },
        { pos: [0, 9, 0], size: [10, 10], color: [0.5, 0.56, 0.62], power: 0.5 },
      ],
      intensity: 0.7,
    },
    indoors: {
      sky: [0.12, 0.115, 0.105],
      horizon: [0.1, 0.095, 0.09],
      ground: [0.04, 0.04, 0.038],
      panels: [{ pos: [0, 5, 0], size: [1.6, 1.6], color: [1.0, 0.9, 0.76], power: 4 }],
      intensity: 0.6,
    },
    bloom: { strength: 0.22, radius: 0.9, threshold: 0.9 },
    grade: {
      exposure: 1.04,
      contrast: 0.94,
      saturation: 0.62,
      shadowTint: [0.46, 0.52, 0.5],
      highlightTint: [0.54, 0.52, 0.47],
      tintAmount: 0.18,
      lift: [0.03, 0.034, 0.036],
      vignette: 0.3,
      grain: 0.075,
      edges: 0,
      posterize: 0,
    },
  },
  {
    id: 'ink',
    name: 'Back-Page Ink',
    intent: 'A printed comic: inked outlines, crushed blacks, a few loud colours. Hides low-detail models best.',
    outdoors: {
      sky: [0.02, 0.02, 0.05],
      horizon: [0.1, 0.05, 0.08],
      ground: [0.015, 0.012, 0.02],
      panels: [
        { pos: [-7, 6, 3], size: [1.4, 1.4], color: [1.0, 0.5, 0.12], power: 7 },
        { pos: [8, 5, -3], size: [1.6, 1.6], color: [0.3, 0.6, 1.0], power: 4 },
      ],
      intensity: 0.9,
    },
    indoors: {
      sky: [0.1, 0.08, 0.07],
      horizon: [0.08, 0.07, 0.07],
      ground: [0.03, 0.025, 0.03],
      panels: [{ pos: [0, 5, 0], size: [1.2, 1.2], color: WARM_BULB, power: 6 }],
      intensity: 0.45,
    },
    bloom: { strength: 0.3, radius: 0.5, threshold: 0.88 },
    grade: {
      exposure: 1.5,
      contrast: 1.14,
      saturation: 1.3,
      shadowTint: [0.44, 0.44, 0.6],
      highlightTint: [0.6, 0.54, 0.42],
      tintAmount: 0.16,
      lift: [0, 0, 0],
      vignette: 0.34,
      grain: 0.02,
      edges: 0.7,
      posterize: 8,
    },
  },
];

export const LOOK_BY_ID: Readonly<Record<string, Look>> = Object.fromEntries(LOOKS.map((l) => [l.id, l]));

/** The look signed off in phase 2. It is on by default at medium and high quality. */
export const DEFAULT_LOOK_ID = 'sodium';

/**
 * Which look to draw with.
 *   `?look=off`     the plain picture, whatever the setting says
 *   `?look=<id>`    that look (for comparing candidates)
 *   otherwise       the signed-off look if the player's setting is on, else the plain picture
 */
export function resolveLook(search: string, settingOn: boolean): Look | null {
  const id = new URLSearchParams(search).get('look');
  if (id === 'off') return null;
  if (id && LOOK_BY_ID[id]) return LOOK_BY_ID[id];
  return settingOn ? LOOK_BY_ID[DEFAULT_LOOK_ID] : null;
}
