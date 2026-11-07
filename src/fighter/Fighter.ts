import { GRAVITY, INPUT_BUFFER_FRAMES, JUMP_VELOCITY, SIM_HZ } from '../core/constants';
import type { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/GameEvents';
import { cancelFrame, startMove, totalFrames, type ActiveMove, type MoveData } from '../combat/MoveData';
import type { GrappleLink } from '../combat/Grapple';
import { ATTACK_BUTTONS, type AttackButton, type CommandFrame } from '../input/Commands';
import { Stats, type Attributes } from '../stats/Stats';
import { Vitals, type FatigueState } from '../stats/Vitals';
import { defaultAppearance, type CharacterAppearance } from '../character/Appearance';
import type { StyleData } from '../styles/StyleData';
import { WEAPONS, type WeaponData, type WeaponId } from '../combat/Weapons';

export type FighterState =
  | 'idle'
  | 'walk'
  | 'jump'
  | 'attack'
  | 'block'
  | 'blockstun'
  | 'dodge'
  | 'parried'
  | 'hitstun'
  | 'stagger'
  | 'guardbreak'
  | 'knockdown'
  | 'getup'
  | 'clinch_hold'
  | 'clinched'
  | 'ground_top'
  | 'ground_bottom'
  | 'ko';

export type Team = 'player' | 'enemy';

/** Perks granted by backgrounds (see character/Character.ts). */
export type Perk = 'cheap_grabs' | 'dodge_frames';

export interface FighterConfig {
  id: number;
  name: string;
  team: Team;
  attributes: Attributes;
  level?: number;
  /** Main style; sets stance, movement and moves. */
  style: StyleData;
  /** Second style available with a stance swap. */
  secondaryStyle?: StyleData | null;
  x?: number;
  z?: number;
  /** How the fighter looks. Data only: the simulation never reads it. */
  appearance?: CharacterAppearance;
  /** Mastery rank per style id, e.g. { street: 2 }. Defaults to rank 1. */
  styleRanks?: Record<string, number>;
  perks?: Perk[];
  inputBufferFrames?: number;
  /** After being let go from a hold, can't be grabbed again for this long (story-mode player). */
  grabProtectFrames?: number;
  /** Start holding a weapon. */
  weapon?: WeaponId | null;
  /** Moves bought at the gym (story mode). Leave out to allow everything. */
  unlocks?: { specials: boolean; finishers: boolean };
}

const WALK_SPEED = 2.6; // m/s
const DEPTH_SPEED = 2.0; // m/s
const KNOCKBACK_DECEL = 14; // m/s^2
const KNOCKDOWN_FRAMES = 60;
const GETUP_FRAMES = 28;
const QUICK_RISE_FROM = 18;
const POISE_REGEN_DELAY = 60;
const POISE_REGEN_PER_SECOND = 30;
const DODGE_COST = 15;
const SWAP_COST = 10;
const SWAP_COOLDOWN = 120;
export const PARRY_WINDOW = 6;
export const COUNTER_WINDOW = 30;
export const FINISH_HEALTH = 0.15;

/**
 * The one fighter class shared by the player and every enemy. It owns
 * movement, the action state machine and stats. Combat resolution between
 * fighters lives in CombatSystem and Grapple; input arrives as CommandFrames.
 */
export class Fighter {
  readonly id: number;
  readonly name: string;
  readonly team: Team;
  readonly appearance: CharacterAppearance;
  readonly stats: Stats;
  readonly vitals: Vitals;
  styleRanks: Record<string, number>;
  readonly perks: Set<Perk>;
  readonly grabProtectFrames: number;
  /** Frame until which grabs on this fighter whiff. */
  grabProtectUntil = 0;
  private wasHeld = false;

  primaryStyle: StyleData;
  secondaryStyle: StyleData | null;
  usingSecondary = false;

  pos = { x: 0, y: 0, z: 0 };
  vel = { x: 0, y: 0, z: 0 };
  /** Knockback velocity along x, decays over time. */
  knockVel = 0;
  facing: 1 | -1 = 1;

  state: FighterState = 'idle';
  stateFrame = 0;
  stateDuration = 0;
  move: ActiveMove | null = null;

  /** Frames frozen by hitstop. */
  hitstop = 0;
  poise: number;
  comboHits = 0;
  target: Fighter | null = null;
  /** Set while in a clinch or on the ground with someone. */
  grapple: GrappleLink | null = null;

  lastMoveId = '';
  repeatCount = 0;
  lastHitTakenFrame = -9999;
  /** Frame block was last pressed (for parries). */
  lastBlockPressFrame = -9999;
  /** Counter hits are possible until this frame (after a parry). */
  counterUntil = -1;
  /** Movement slowed by leg kicks until this frame. */
  slowUntil = -1;
  swapReadyAt = 0;
  /** Weapon in hand, with hits left before it breaks. */
  weapon: { data: WeaponData; hits: number } | null = null;
  /** A weapon this fighter just dropped; the world turns it into a pickup. */
  droppedWeapon: WeaponData | null = null;
  unlocks: { specials: boolean; finishers: boolean };
  private airAttackUsed = false;
  private airVX = 0;

  // Dodge / roll movement.
  private dodgeVel = { x: 0, z: 0 };
  private dodgeInvulnFrames = 0;
  private pendingGetupAttack = false;
  private wasBlockHeld = false;

  private buffered: { button: AttackButton; special: boolean; toward: boolean; expires: number } | null = null;
  private readonly bufferFrames: number;
  private lastFatigue: FatigueState = 'fresh';
  private spawn = { x: 0, z: 0 };

  constructor(cfg: FighterConfig) {
    this.id = cfg.id;
    this.name = cfg.name;
    this.team = cfg.team;
    this.appearance = cfg.appearance ?? defaultAppearance();
    this.styleRanks = { ...(cfg.styleRanks ?? {}) };
    this.perks = new Set(cfg.perks ?? []);
    this.grabProtectFrames = cfg.grabProtectFrames ?? 0;
    this.primaryStyle = cfg.style;
    this.secondaryStyle = cfg.secondaryStyle ?? null;
    this.stats = new Stats(cfg.attributes, cfg.level ?? 1);
    this.vitals = new Vitals(this.stats);
    this.poise = this.stats.maxPoise;
    this.bufferFrames = cfg.inputBufferFrames ?? INPUT_BUFFER_FRAMES;
    this.unlocks = cfg.unlocks ?? { specials: true, finishers: true };
    if (cfg.weapon) this.equipWeapon(cfg.weapon);
    this.spawn = { x: cfg.x ?? 0, z: cfg.z ?? 0 };
    this.pos.x = this.spawn.x;
    this.pos.z = this.spawn.z;
  }

  // ---- queries -----------------------------------------------------------

  /** The style currently in use (primary, or secondary after a stance swap). */
  get style(): StyleData {
    return this.usingSecondary && this.secondaryStyle ? this.secondaryStyle : this.primaryStyle;
  }

  get grounded(): boolean {
    return this.pos.y <= 0.0001;
  }

  get isKO(): boolean {
    return this.state === 'ko';
  }

  get isAttacking(): boolean {
    return this.state === 'attack';
  }

  get isBlocking(): boolean {
    return this.state === 'block' || this.state === 'blockstun';
  }

  /** Cannot be hit: on the floor, getting up, knocked out, or inside a dodge's invulnerable frames. */
  get isInvulnerable(): boolean {
    if (this.state === 'knockdown' || this.state === 'getup' || this.state === 'ko' || this.state === 'ground_bottom' || this.state === 'ground_top') return true;
    return this.state === 'dodge' && this.stateFrame <= this.dodgeInvulnFrames;
  }

  /** Reeling from a hit: further hits count as a combo. */
  get isReeling(): boolean {
    return this.state === 'hitstun' || this.state === 'stagger' || this.state === 'guardbreak' || this.state === 'parried';
  }

  get parryWindow(): number {
    return PARRY_WINDOW + Math.floor(this.stats.attr('technique') / 5) + this.stats.flat('parryFrames');
  }

  equipWeapon(id: WeaponId): void {
    const data = WEAPONS[id];
    this.weapon = { data, hits: data.durability };
  }

  /** Let go of the weapon (it lands as a pickup unless it broke). */
  dropWeapon(): void {
    if (!this.weapon) return;
    this.droppedWeapon = this.weapon.data;
    this.weapon = null;
  }

  isFacing(other: Fighter): boolean {
    const dx = other.pos.x - this.pos.x;
    return dx === 0 || Math.sign(dx) === this.facing;
  }

  /** Damage bonus from style mastery: +5% per rank above 1. */
  masteryMultiplier(style: string): number {
    return 1 + 0.05 * Math.max(0, (this.styleRanks[style] ?? 1) - 1);
  }

  /** A finisher is available: opponent below 15% health, reeling, close and in front. */
  canFinish(t: Fighter | null = this.target): boolean {
    if (!t || t.isKO || t.grapple || !this.isFree || !this.unlocks.finishers || this.weapon) return false;
    return (
      t.vitals.health / t.vitals.maxHealth < FINISH_HEALTH &&
      (t.state === 'stagger' || t.state === 'guardbreak') &&
      Math.abs(t.pos.x - this.pos.x) < 1.3 &&
      Math.abs(t.pos.z - this.pos.z) < 0.6 &&
      this.isFacing(t)
    );
  }

  get isFree(): boolean {
    return this.state === 'idle' || this.state === 'walk' || this.state === 'block';
  }

  // ---- state changes ------------------------------------------------------

  setState(state: FighterState, duration = 0): void {
    this.state = state;
    this.stateFrame = 0;
    this.stateDuration = duration;
    if (state !== 'attack') this.move = null;
  }

  /** Put back at the spawn point with full health and stamina. */
  respawn(): void {
    this.pos = { x: this.spawn.x, y: 0, z: this.spawn.z };
    this.vel = { x: 0, y: 0, z: 0 };
    this.knockVel = 0;
    this.hitstop = 0;
    this.comboHits = 0;
    this.buffered = null;
    this.grapple = null;
    this.weapon = null;
    this.droppedWeapon = null;
    this.counterUntil = -1;
    this.slowUntil = -1;
    this.stats.removeModifier('leg_slow');
    this.vitals.reset();
    this.poise = this.stats.maxPoise;
    this.setState('idle');
  }

  // ---- per-frame update -----------------------------------------------------

  update(cmd: CommandFrame, frame: number, bus: EventBus<GameEvents>): void {
    const held = this.grapple?.role === 'held';
    if (this.wasHeld && !held && this.grabProtectFrames) this.grabProtectUntil = frame + this.grabProtectFrames;
    this.wasHeld = held;
    // Remember attack presses so an early press still comes out.
    for (const b of ATTACK_BUTTONS) {
      if (cmd.pressed[b]) this.buffered = { button: b, special: cmd.special, toward: cmd.moveX * this.facing > 0.5, expires: frame + this.bufferFrames };
    }
    if (this.buffered && frame > this.buffered.expires) this.buffered = null;

    // Block presses (not holds) are what parry.
    if (cmd.block && !this.wasBlockHeld) this.lastBlockPressFrame = frame;
    this.wasBlockHeld = cmd.block;

    if (frame > this.slowUntil && this.stats.hasModifier('leg_slow')) this.stats.removeModifier('leg_slow');

    if (this.hitstop > 0) {
      // Time is frozen for this fighter, so a buffered press shouldn't expire either.
      if (this.buffered) this.buffered.expires++;
      this.hitstop--;
      return;
    }

    this.stateFrame++;
    const dt = 1 / SIM_HZ;
    let wantVX = 0;
    let wantVZ = 0;
    const walk = WALK_SPEED * this.style.walkMult * this.stats.moveSpeedMultiplier;

    switch (this.state) {
      case 'ko':
        break;

      // Grapple states are driven by Grapple.updateGrapples.
      case 'clinch_hold':
      case 'clinched':
      case 'ground_top':
      case 'ground_bottom':
        break;

      case 'attack': {
        const m = this.move!;
        m.frame++;
        if (m.frame < m.startup && m.data.lunge > 0) this.pos.x += (this.facing * m.data.lunge) / m.startup;
        if (!this.grounded) wantVX = this.airVX;
        if (this.buffered && m.frame >= cancelFrame(m) && !this.grapple && this.grounded) this.tryAttack(this.buffered.button, this.buffered.special, frame, bus);
        if (this.state === 'attack' && this.move === m && m.frame >= totalFrames(m) - 1) {
          this.setState(this.grapple ? (this.grapple.phase === 'ground' ? 'ground_top' : 'clinch_hold') : 'idle');
        }
        break;
      }

      case 'dodge':
        this.pos.x += this.dodgeVel.x * dt;
        this.pos.z += this.dodgeVel.z * dt;
        if (this.stateFrame >= this.stateDuration) this.setState('idle');
        break;

      case 'hitstun':
      case 'blockstun':
      case 'stagger':
      case 'guardbreak':
      case 'parried':
        if (this.stateFrame >= this.stateDuration) this.setState(cmd.block ? 'block' : 'idle');
        break;

      case 'knockdown':
        this.updateKnockdown(cmd, bus);
        break;

      case 'getup':
        this.pos.x += this.dodgeVel.x * dt;
        this.pos.z += this.dodgeVel.z * dt;
        if (this.stateFrame >= this.stateDuration) {
          this.dodgeVel = { x: 0, z: 0 };
          this.setState('idle');
          bus.emit('fighter:getup', { fighter: this });
          if (this.pendingGetupAttack) {
            this.pendingGetupAttack = false;
            this.startMoveById(this.style.getupAttack, frame, bus);
          }
        }
        break;

      case 'jump':
        // Limited air control; one attack per jump.
        wantVX = cmd.moveX * walk * 0.6;
        this.airVX = wantVX;
        if (this.buffered && !this.airAttackUsed && this.pos.y > 0.15) {
          const kick = this.buffered.button === 'lk' || this.buffered.button === 'hk';
          this.buffered = null;
          this.airAttackUsed = true;
          this.startMoveById(kick ? this.style.air.kick : this.style.air.punch, frame, bus);
        }
        break;

      case 'idle':
      case 'walk':
      case 'block': {
        if (cmd.pressed.swap && this.trySwap(frame, bus)) break;
        if (cmd.pressed.grab && this.weapon) {
          this.dropWeapon();
          break;
        }
        if (cmd.pressed.grab && this.tryGrab(frame, bus)) break;
        if (cmd.pressed.dodge && this.tryDodge(cmd, frame, bus)) break;
        if (this.buffered && this.tryAttack(this.buffered.button, this.buffered.special, frame, bus)) break;
        if (cmd.pressed.jump && this.grounded) {
          this.vel.y = JUMP_VELOCITY;
          this.pos.y = 0.001;
          this.airAttackUsed = false;
          this.setState('jump');
          bus.emit('fighter:jump', { fighter: this });
          wantVX = cmd.moveX * walk;
          break;
        }
        if (cmd.block) {
          if (this.state !== 'block') this.setState('block');
          break;
        }
        wantVX = cmd.moveX * walk;
        wantVZ = cmd.moveZ * DEPTH_SPEED * this.stats.depthSpeedMultiplier * this.style.walkMult;
        const moving = Math.abs(cmd.moveX) > 0.1 || Math.abs(cmd.moveZ) > 0.1;
        const next = moving ? 'walk' : 'idle';
        if (this.state !== next) this.setState(next);
        break;
      }
    }

    // Facing: turn toward the soft-locked target, or the way you're walking.
    if (this.isFree || (this.state === 'jump' && this.stateFrame === 1)) {
      if (this.target && !this.target.isKO) {
        const dx = this.target.pos.x - this.pos.x;
        if (Math.abs(dx) > 0.05) this.facing = dx > 0 ? 1 : -1;
      } else if (Math.abs(cmd.moveX) > 0.1) {
        this.facing = cmd.moveX > 0 ? 1 : -1;
      }
    }

    // Integrate movement.
    this.vel.x = wantVX;
    this.vel.z = wantVZ;

    if (this.knockVel !== 0) {
      const s = Math.sign(this.knockVel);
      this.knockVel -= s * KNOCKBACK_DECEL * dt;
      if (Math.sign(this.knockVel) !== s) this.knockVel = 0;
    }

    if (!this.grapple) {
      this.pos.x += (this.vel.x + this.knockVel) * dt;
      this.pos.z += this.vel.z * dt;
    }

    if (!this.grounded || this.vel.y > 0) {
      this.vel.y += GRAVITY * dt;
      this.pos.y += this.vel.y * dt;
      if (this.pos.y <= 0) {
        this.pos.y = 0;
        this.vel.y = 0;
        if (this.state === 'jump' || (this.state === 'attack' && this.move && (this.move.data.id === this.style.air.punch || this.move.data.id === this.style.air.kick))) {
          this.setState('idle');
          bus.emit('fighter:land', { fighter: this });
        }
      }
    }

    // Poise recovers when not being hit.
    if (frame - this.lastHitTakenFrame > POISE_REGEN_DELAY) {
      this.poise = Math.min(this.stats.maxPoise, this.poise + POISE_REGEN_PER_SECOND * dt);
    }
  }

  /** Called by the simulation after update; handles stamina/health regen and fatigue events. */
  updateVitals(frame: number, bus: EventBus<GameEvents>): void {
    this.vitals.update(frame, this.isBlocking, this.isAttacking);
    if (this.vitals.fatigue !== this.lastFatigue) {
      this.lastFatigue = this.vitals.fatigue;
      bus.emit('fighter:fatigue', { fighter: this, state: this.lastFatigue });
    }
  }

  // ---- actions ---------------------------------------------------------------

  /** Start or chain an attack. Returns true if the press was consumed. */
  private tryAttack(button: AttackButton, special: boolean, frame: number, bus: EventBus<GameEvents>): boolean {
    const style = this.style;
    const toward = this.buffered?.toward ?? false;
    if (!this.unlocks.specials) special = special && button === 'hp' && this.canFinish();
    // A weapon in hand replaces punches and kicks with swings (no combos).
    if (this.weapon && !(special && button === 'hp' && this.canFinish())) {
      if (this.state === 'attack') return false;
      this.buffered = null;
      return this.startMove(button === 'lp' || button === 'lk' ? this.weapon.data.light : this.weapon.data.heavy, frame, bus);
    }
    let moveId: string | undefined;
    if (!special && button === 'hp' && toward && this.state !== 'attack') {
      moveId = style.dash;
    } else if (special && button === 'hp' && this.state !== 'attack' && this.canFinish()) {
      moveId = style.finisher;
    } else if (this.state === 'attack' && this.move) {
      moveId = special ? style.specials[button] : this.move.data.next[button];
      if (!moveId) return false; // no chain for this button; keep it buffered until the move ends
    } else {
      moveId = (special ? style.specials[button] : undefined) ?? style.starters[button];
    }
    const data = moveId ? style.moves[moveId] : undefined;
    if (!data) return false;
    this.buffered = null;
    return this.startMove(data, frame, bus);
  }

  startMoveById(id: string, frame: number, bus: EventBus<GameEvents>): boolean {
    const data = this.style.moves[id];
    return data ? this.startMove(data, frame, bus) : false;
  }

  /** Begin a move (used by attacks, grabs, clinch moves and the get-up attack). */
  startMove(data: MoveData, frame: number, bus: EventBus<GameEvents>): boolean {
    if ((data.kind === 'heavy' || data.kind === 'special') && this.stats.hasTag('state.exhausted')) {
      bus.emit('action:refused', { fighter: this, reason: 'exhausted' });
      return true;
    }
    const chained = this.state === 'attack';
    const grappleCost = (data.kind === 'grab' || data.kind === 'clinch') && this.perks.has('cheap_grabs') ? 0.8 : 1;
    this.vitals.spendStamina(data.staminaCost * grappleCost, frame);
    if (data.id === this.lastMoveId) this.repeatCount++;
    else this.repeatCount = 1;
    this.lastMoveId = data.id;
    if (!chained && data.kind !== 'clinch') this.comboHits = 0;

    this.setState('attack');
    this.move = startMove(data, this.stats.attackSpeed);
    bus.emit('move:started', { fighter: this, move: data });
    return true;
  }

  private tryGrab(frame: number, bus: EventBus<GameEvents>): boolean {
    const id = `${this.style.id}_grab`;
    return this.startMoveById(id, frame, bus);
  }

  private trySwap(frame: number, bus: EventBus<GameEvents>): boolean {
    if (!this.secondaryStyle || frame < this.swapReadyAt) return false;
    this.vitals.spendStamina(SWAP_COST, frame);
    this.usingSecondary = !this.usingSecondary;
    this.swapReadyAt = frame + SWAP_COOLDOWN;
    bus.emit('style:swapped', { fighter: this, style: this.style });
    return true;
  }

  /**
   * Dodge. Holding up/down sidesteps into or out of the screen; otherwise a
   * back-step. Boxers slip in place; karateka blitz a long way.
   */
  private tryDodge(cmd: CommandFrame, frame: number, bus: EventBus<GameEvents>): boolean {
    if (!this.grounded) return false;
    const ability = this.style.defence;
    const slip = ability === 'slip';
    this.vitals.spendStamina(slip ? 10 : DODGE_COST, frame);
    let iframes = 8 + Math.floor(this.stats.attr('agility') / 4) + (this.perks.has('dodge_frames') ? 2 : 0);
    if (slip) iframes += 2;
    if (this.stats.hasTag('state.exhausted')) iframes = Math.floor(iframes / 2);
    let duration = 14;
    let vx = 0;
    let vz = 0;
    const away = this.target ? -Math.sign(this.target.pos.x - this.pos.x) || -this.facing : -this.facing;
    if (slip) {
      duration = 16;
    } else if (ability === 'blitz') {
      duration = 12;
      const dir = Math.abs(cmd.moveX) > 0.2 ? Math.sign(cmd.moveX) : away;
      vx = (dir * 1.5) / (duration / SIM_HZ);
      if (Math.abs(cmd.moveZ) > 0.2) vz = (Math.sign(cmd.moveZ) * 0.9) / (duration / SIM_HZ);
    } else if (Math.abs(cmd.moveZ) > 0.2) {
      vz = (Math.sign(cmd.moveZ) * 1.0) / (duration / SIM_HZ);
    } else {
      vx = (away * 0.8) / (duration / SIM_HZ);
    }
    this.dodgeVel = { x: vx, z: vz };
    this.dodgeInvulnFrames = iframes;
    this.setState('dodge', duration);
    bus.emit('fighter:dodge', { fighter: this, kind: slip ? 'slip' : vz !== 0 ? 'sidestep' : ability === 'blitz' ? 'blitz' : 'backstep' });
    return true;
  }

  /** Knocked down: stay down, quick rise, roll, get-up attack, or (BJJ) sweep. */
  private updateKnockdown(cmd: CommandFrame, bus: EventBus<GameEvents>): void {
    const getup = Math.max(12, GETUP_FRAMES - this.stats.getUpSpeedBonusFrames);
    if (this.stateFrame >= this.stateDuration) {
      this.dodgeVel = { x: 0, z: 0 };
      this.setState('getup', getup);
      return;
    }
    if (this.stateFrame < QUICK_RISE_FROM) return;
    const t = this.target;
    const attack = cmd.pressed.lp || cmd.pressed.hp || cmd.pressed.lk || cmd.pressed.hk;

    if (cmd.pressed.grab && this.style.defence === 'guard_pull' && t && !t.isInvulnerable && !t.grapple && t.grounded && Math.abs(t.pos.x - this.pos.x) < 1.2 && Math.abs(t.pos.z - this.pos.z) < 0.6) {
      t.enterHitReaction('knockdown', 0);
      t.knockVel = Math.sign(t.pos.x - this.pos.x) * 1.5;
      this.dodgeVel = { x: 0, z: 0 };
      this.setState('getup', 14);
      bus.emit('fighter:sweep', { fighter: this, target: t });
      bus.emit('fighter:knockdown', { fighter: t });
      return;
    }
    if (attack) {
      this.pendingGetupAttack = true;
      this.dodgeVel = { x: 0, z: 0 };
      this.setState('getup', getup);
      return;
    }
    const rollTime = getup / SIM_HZ;
    if (Math.abs(cmd.moveZ) > 0.3) {
      this.dodgeVel = { x: 0, z: (Math.sign(cmd.moveZ) * 1.1) / rollTime };
      this.setState('getup', getup);
      return;
    }
    const awayDir = t ? -Math.sign(t.pos.x - this.pos.x) : 0;
    if (Math.abs(cmd.moveX) > 0.3 && awayDir !== 0 && Math.sign(cmd.moveX) === awayDir) {
      this.dodgeVel = { x: (awayDir * 1.2) / rollTime, z: 0 };
      this.setState('getup', getup);
      return;
    }
    if (cmd.pressed.jump || cmd.pressed.dodge) {
      this.dodgeVel = { x: 0, z: 0 };
      this.setState('getup', getup);
    }
  }

  // ---- reactions (called by CombatSystem / Grapple) ------------------------------

  enterHitReaction(kind: 'flinch' | 'stagger' | 'knockdown', hitstun: number): void {
    if (kind === 'knockdown') {
      this.dropWeapon();
      this.setState('knockdown', KNOCKDOWN_FRAMES);
      this.poise = this.stats.maxPoise;
    } else if (kind === 'stagger') {
      this.setState('stagger', Math.round(hitstun * 1.6));
      this.poise = this.stats.maxPoise;
    } else {
      this.setState('hitstun', hitstun);
    }
    this.buffered = null;
    this.pendingGetupAttack = false;
  }

  enterBlockstun(frames: number): void {
    this.setState('blockstun', frames);
  }

  enterGuardBreak(): void {
    this.setState('guardbreak', 50);
    this.poise = this.stats.maxPoise;
    this.buffered = null;
  }

  enterParried(frames: number): void {
    this.setState('parried', frames);
    this.buffered = null;
  }

  /** Leg kicks: slower movement for a while. */
  applySlow(frames: number, frame: number): void {
    this.slowUntil = Math.max(this.slowUntil, frame + frames);
    this.stats.addModifier({ id: 'leg_slow', source: 'leg_kick', stat: 'moveSpeedMult', mul: 0.8 });
  }

  knockOut(): void {
    this.dropWeapon();
    this.setState('ko');
    this.knockVel *= 1.4;
    this.buffered = null;
  }
}
