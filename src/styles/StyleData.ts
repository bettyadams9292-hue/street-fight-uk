import type { MoveData } from '../combat/MoveData';
import type { AttackButton } from '../input/Commands';

export const STYLE_IDS = ['street', 'boxing', 'kickboxing', 'muay_thai', 'karate', 'wrestling', 'bjj'] as const;
export type StyleId = (typeof STYLE_IDS)[number];

/** Each style's signature defensive option (see design doc). */
export type DefenceAbility = 'shove' | 'slip' | 'check' | 'teep' | 'blitz' | 'sprawl' | 'guard_pull';

/**
 * A fighting style: its moves, combo graph, specials, grappling options and
 * defensive identity. Styles change how you move and defend, not just which
 * animations play.
 */
export interface StyleData {
  id: StyleId;
  name: string;
  blurb: string;
  strengths: string[];
  weaknesses: string[];
  moves: Record<string, MoveData>;
  /** Move performed from neutral for each button. */
  starters: Record<AttackButton, string>;
  /** Special + button. */
  specials: Partial<Record<AttackButton, string>>;
  /** Moves available while holding someone in the clinch. */
  clinch: { strike: string; throw: string; power: string };
  /** Ground options once a takedown lands (wrestling and BJJ only). */
  ground?: { strike: string; submission: string };
  /** Attack thrown while getting up from a knockdown. */
  getupAttack: string;
  finisher: string;
  /** Jump attacks (punch buttons / kick buttons) and the forward heavy. Added to every style. */
  air: { punch: string; kick: string };
  dash: string;
  defence: DefenceAbility;
  defenceName: string;
  defenceText: string;
  /** Share of damage a block stops (rest is recoverable chip). */
  blockAbsorb: number;
  /** Walking speed multiplier for this style's stance. */
  walkMult: number;
  /** Strength in clinch contests (holding, escaping). */
  grappleSkill: number;
}
