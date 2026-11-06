/**
 * The command interface every fighter is driven by. The player's input
 * devices and the AI both produce a CommandFrame per simulation step, so
 * enemies follow exactly the same rules as the player.
 */
export type AttackButton = 'lp' | 'hp' | 'lk' | 'hk';
export const ATTACK_BUTTONS: readonly AttackButton[] = ['lp', 'hp', 'lk', 'hk'];

export interface CommandFrame {
  /** -1 (left) .. 1 (right) */
  moveX: number;
  /** -1 (into the screen) .. 1 (towards the camera) */
  moveZ: number;
  /** Held */
  block: boolean;
  /** Pressed this frame */
  pressed: Record<AttackButton | 'jump', boolean>;
}

export function emptyCommand(): CommandFrame {
  return { moveX: 0, moveZ: 0, block: false, pressed: { lp: false, hp: false, lk: false, hk: false, jump: false } };
}
