/** The scenes the visual tests photograph. Kept apart from shots.ts so the test runner can read the names without loading the game. */
export const SHOT_NAMES = ['menu', 'stance', 'jab', 'cross', 'kick', 'blocked', 'spar', 'group', 'home', 'estate'] as const;
export type ShotName = (typeof SHOT_NAMES)[number];
