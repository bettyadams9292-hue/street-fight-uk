/**
 * The boss-reward lock-up on Tanner Road Estate (the Estate King's `lockup_key` opens it): a garage of its own at the
 * end of the garage row, clear of the subway steps. The kit street leaves a gap in the frontage for it
 * (city/street.ts) and LevelView builds it there: brick piers, an up-and-over door that swings up and in when you
 * open it (while you're searching it), a lit inside with the reward on a crate. Container id `lockup` in
 * world/levels.ts; what's in it and that it's once only are the container's (`fixed`, World.containerKey).
 */
export const LOCKUP_ID = 'lockup';
/** Half its width: the gap in the frontage. Fills the garage row from the tower block (x 32) to the subway gap. */
export const LOCKUP_HALF = 2.0;
/** How far it runs back into the building, and its height. */
export const LOCKUP_DEPTH = 3.2;
export const LOCKUP_HEIGHT = 2.9;
/** The door opening. */
export const LOCKUP_DOOR_W = 2.6;
export const LOCKUP_DOOR_H = 2.15;
/** Seconds for the door to swing up and in. */
export const LOCKUP_OPEN_SECONDS = 1.3;
