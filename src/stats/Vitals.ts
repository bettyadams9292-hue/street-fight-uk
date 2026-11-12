import { OUT_OF_COMBAT_FRAMES, RECOVERABLE_DELAY_FRAMES, SIM_HZ } from '../core/constants';
import type { Stats } from './Stats';

export type FatigueState = 'fresh' | 'tired' | 'exhausted';

/** Delay after spending stamina before it starts to recover (0.8 s). */
const STAMINA_REGEN_DELAY = Math.round(0.8 * SIM_HZ);

/**
 * Current health and stamina for one fighter, with regeneration and fatigue.
 * Fatigue is applied to the fighter's Stats as modifiers so every system
 * (damage, speed, AI, HUD) reads the same state.
 */
export class Vitals {
  health: number;
  stamina: number;
  /** Chip damage taken through a block that can still refill. */
  recoverable = 0;
  fatigue: FatigueState = 'fresh';
  /** Ran the tank dry: no attacks until stamina is back to a quarter. */
  gassed = false;

  private lastStaminaSpendFrame = -9999;
  private lastCombatFrame = -9999;
  private lastHitTakenFrame = -9999;

  constructor(private readonly stats: Stats) {
    this.health = stats.maxHealth;
    this.stamina = stats.maxStamina;
  }

  get maxHealth(): number {
    return this.stats.maxHealth;
  }

  get maxStamina(): number {
    return this.stats.maxStamina;
  }

  get isKnockedOut(): boolean {
    return this.health <= 0;
  }

  reset(): void {
    this.health = this.maxHealth;
    this.stamina = this.maxStamina;
    this.gassed = false;
    this.recoverable = 0;
    this.lastCombatFrame = -9999;
    this.lastHitTakenFrame = -9999;
    this.lastStaminaSpendFrame = -9999;
    this.updateFatigue();
  }

  markCombat(frame: number): void {
    this.lastCombatFrame = frame;
  }

  isInCombat(frame: number): boolean {
    return frame - this.lastCombatFrame < OUT_OF_COMBAT_FRAMES;
  }

  /** Spend stamina (clamped at 0). Returns the amount actually spent. */
  spendStamina(amount: number, frame: number): number {
    const cost = Math.max(0, amount * this.stats.staminaCostMultiplier);
    const spent = Math.min(this.stamina, cost);
    this.stamina -= spent;
    if (this.stamina < 1) this.gassed = true;
    this.lastStaminaSpendFrame = frame;
    this.updateFatigue();
    return spent;
  }

  /** Apply health damage. `recoverable` marks blocked chip that can refill. */
  takeDamage(amount: number, frame: number, recoverable = false): void {
    const dmg = Math.max(0, amount);
    this.health = Math.max(0, this.health - dmg);
    if (recoverable) this.recoverable = Math.min(this.maxHealth - this.health, this.recoverable + dmg);
    else this.recoverable = Math.min(this.recoverable, this.maxHealth - this.health);
    this.lastHitTakenFrame = frame;
    this.markCombat(frame);
  }

  heal(amount: number): void {
    if (this.isKnockedOut) return;
    this.health = Math.min(this.maxHealth, this.health + amount);
    this.recoverable = Math.min(this.recoverable, this.maxHealth - this.health);
  }

  restoreStamina(amount: number): void {
    this.stamina = Math.min(this.maxStamina, this.stamina + amount);
    if (this.stamina >= this.maxStamina * 0.25) this.gassed = false;
    this.updateFatigue();
  }

  /**
   * Called once per simulation frame.
   * @param blocking  stamina recovers at half rate while holding block
   * @param attacking stamina does not recover during attack animations
   */
  update(frame: number, blocking: boolean, attacking: boolean): void {
    if (this.isKnockedOut) return;
    const dt = 1 / SIM_HZ;

    // Stamina recovery.
    if (!attacking && frame - this.lastStaminaSpendFrame >= STAMINA_REGEN_DELAY && this.stamina < this.maxStamina) {
      const rate = this.stats.staminaRegenPerSecond * (blocking ? 0.5 : 1);
      this.stamina = Math.min(this.maxStamina, this.stamina + rate * dt);
      if (this.gassed && this.stamina >= this.maxStamina * 0.25) this.gassed = false;
    }

    // Recoverable chip damage refills if not hit for a while.
    if (this.recoverable > 0 && frame - this.lastHitTakenFrame >= RECOVERABLE_DELAY_FRAMES) {
      const amount = Math.min(this.recoverable, 12 * dt);
      this.health = Math.min(this.maxHealth, this.health + amount);
      this.recoverable -= amount;
    }

    // Out-of-combat health regen: 2% per second, up to 50% of max.
    if (!this.isInCombat(frame)) {
      const cap = this.maxHealth * 0.5;
      if (this.health < cap) this.health = Math.min(cap, this.health + this.maxHealth * 0.02 * dt);
    }

    this.updateFatigue();
  }

  /** Thresholds: tired below 30%, exhausted below 10% (clears at 25%). */
  private updateFatigue(): void {
    const ratio = this.stamina / this.maxStamina;
    let next: FatigueState;
    if (this.fatigue === 'exhausted') next = ratio >= 0.25 ? (ratio >= 0.3 ? 'fresh' : 'tired') : 'exhausted';
    else if (ratio < 0.1) next = 'exhausted';
    else if (ratio < 0.3) next = 'tired';
    else next = 'fresh';
    if (next === this.fatigue) return;
    this.fatigue = next;
    this.stats.removeModifiersFrom('fatigue');
    if (next === 'tired') {
      this.stats.addModifier({ id: 'fatigue_dmg', source: 'fatigue', stat: 'damageMult', mul: 0.85, tags: ['state.tired'] });
      this.stats.addModifier({ id: 'fatigue_spd', source: 'fatigue', stat: 'attackSpeedMult', mul: 0.92 });
    } else if (next === 'exhausted') {
      this.stats.addModifier({ id: 'fatigue_dmg', source: 'fatigue', stat: 'damageMult', mul: 0.7, tags: ['state.exhausted'] });
      this.stats.addModifier({ id: 'fatigue_move', source: 'fatigue', stat: 'moveSpeedMult', mul: 0.75 });
      this.stats.addModifier({ id: 'fatigue_taken', source: 'fatigue', stat: 'damageTakenMult', mul: 1.2 });
      this.stats.addModifier({ id: 'fatigue_spd', source: 'fatigue', stat: 'attackSpeedMult', mul: 0.85 });
    }
  }
}
