/** Fixed simulation rate. Combat timing is authored in frames at this rate. */
export const SIM_HZ = 60;
export const DT = 1 / SIM_HZ;

/** How long an early attack press is remembered (frames). */
export const INPUT_BUFFER_FRAMES = 9;
/** Touch screens get a slightly longer buffer to make up for no physical buttons. */
export const TOUCH_INPUT_BUFFER_FRAMES = 12;

/** Gravity in m/s^2 for jumps. */
export const GRAVITY = -18;
export const JUMP_VELOCITY = 5.2;

/** Frames without dealing or taking damage before out-of-combat rules apply. */
export const OUT_OF_COMBAT_FRAMES = 8 * SIM_HZ;
/** Frames without being hit before recoverable (blocked chip) health refills. */
export const RECOVERABLE_DELAY_FRAMES = 4 * SIM_HZ;

/** Fighter body size used for hurtboxes and pushing. */
export const BODY_RADIUS = 0.28;
export const BODY_HEIGHT = 1.78;
