import { GRAVITY, INPUT_BUFFER_FRAMES, JUMP_VELOCITY, SIM_HZ } from '../core/constants';
import type { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/GameEvents';
import { cancelFrame, startMove, totalFrames, type ActiveMove, type MoveData } from '../combat/MoveData';
import { ATTACK_BUTTONS, type AttackButton, type CommandFrame } from '../input/Commands';
import { Stats, type Attributes } from '../stats/Stats';
import { defaultAppearance, type CharacterAppearance } from '../character/Appearance';
import { Vitals, type FatigueState } from '../stats/Vitals';

export type FighterState =
  | 'idle'
  | 'walk'
  | 'jump'
  | 'attack'
  | 'block'
  | 'blockstun'
  | 'hitstun'
  | 'stagger'
  | 'guardbreak'
  | 'knockdown'
  | 'getup'
  | 'ko';

export type Team = 'player' | 'enemy';

/** The moves a fighter can perform: a style's move table and its neutral starters. */
export interface MoveSet {
  moves: Record<string, MoveData>;
  starters: Record<AttackButton, string>;
}

export interface FighterConfig {
  id: number;
  name: string;
  team: Team;
  attributes: Attributes;
  level?: number;
  moveSet: MoveSet;
  x?: number;
  z?: number;
  /** How the fighter looks. Data only: the simulation never reads it. */
  appearance?: CharacterAppearance;
  /** Mastery rank per style id, e.g. { street: 2 }. Defaults to rank 1. */
  styleRanks?: Record<string, number>;
  inputBufferFrames?: number;
}

const WALK_SPEED = 2.6; // m/s
const DEPTH_SPEED = 2.0; // m/s
const KNOCKBACK_DECEL = 14; // m/s^2
const KNOCKDOWN_FRAMES = 60;
const GETUP_FRAMES = 28;
const QUICK_RISE_FROM = 18;
const POISE_REGEN_DELAY = 60;
const POISE_REGEN_PER_SECOND = 30;

/**
 * The one fighter class shared by the player and every enemy. It owns
 * movement, the action state machine and stats. Combat resolution between
 * fighters lives in CombatSystem; input arrives as CommandFrames.
 */
export class Fighter {
  readonly id: number;
  readonly name: string;
  readonly team: Team;
  readonly appearance: CharacterAppearance;
  styleRanks: Record<string, number>;
  readonly stats: Stats;
  readonly vitals: Vitals;
  moveSet: MoveSet;

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

  lastMoveId = '';
  repeatCount = 0;
  lastHitTakenFrame = -9999;

  private buffered: { button: AttackButton; expires: number } | null = null;
  private readonly bufferFrames: number;
  private lastFatigue: FatigueState = 'fresh';
  private spawn = { x: 0, z: 0 };

  constructor(cfg: FighterConfig) {
    this.id = cfg.id;
    this.name = cfg.name;
    this.team = cfg.team;
    this.appearance = cfg.appearance ?? defaultAppearance();
    this.styleRanks = { ...(cfg.styleRanks ?? {}) };
    this.stats = new Stats(cfg.attributes, cfg.level ?? 1);
    this.vitals = new Vitals(this.stats);
    this.moveSet = cfg.moveSet;
    this.poise = this.stats.maxPoise;
    this.bufferFrames = cfg.inputBufferFrames ?? INPUT_BUFFER_FRAMES;
    this.spawn = { x: cfg.x ?? 0, z: cfg.z ?? 0 };
    this.pos.x = this.spawn.x;
    this.pos.z = this.spawn.z;
  }

  // ---- queries -----------------------------------------------------------

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

  /** Cannot be hit: on the floor, getting up, or knocked out. */
  get isInvulnerable(): boolean {
    return this.state === 'knockdown' || this.state === 'getup' || this.state === 'ko';
  }

  /** Reeling from a hit: further hits count as a combo. */
  get isReeling(): boolean {
    return this.state === 'hitstun' || this.state === 'stagger' || this.state === 'guardbreak';
  }

  /** Damage bonus from style mastery: +5% per rank above 1. */
  masteryMultiplier(style: string): number {
    return 1 + 0.05 * Math.max(0, (this.styleRanks[style] ?? 1) - 1);
  }

  isFacing(other: Fighter): boolean {
    const dx = other.pos.x - this.pos.x;
    return dx === 0 || Math.sign(dx) === this.facing;
  }

  private get isFree(): boolean {
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
    this.vitals.reset();
    this.poise = this.stats.maxPoise;
    this.setState('idle');
  }

  // ---- per-frame update -----------------------------------------------------

  update(cmd: CommandFrame, frame: number, bus: EventBus<GameEvents>): void {
    // Remember attack presses so an early press still comes out.
    for (const b of ATTACK_BUTTONS) if (cmd.pressed[b]) this.buffered = { button: b, expires: frame + this.bufferFrames };
    if (this.buffered && frame > this.buffered.expires) this.buffered = null;

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

    switch (this.state) {
      case 'ko':
        break;

      case 'attack': {
        const m = this.move!;
        m.frame++;
        if (m.frame < m.startup && m.data.lunge > 0) this.pos.x += (this.facing * m.data.lunge) / m.startup;
        if (this.buffered && m.frame >= cancelFrame(m)) this.tryAttack(this.buffered.button, frame, bus);
        if (this.state === 'attack' && this.move === m && m.frame >= totalFrames(m) - 1) this.setState('idle');
        break;
      }

      case 'hitstun':
      case 'blockstun':
      case 'stagger':
      case 'guardbreak':
        if (this.stateFrame >= this.stateDuration) this.setState(cmd.block ? 'block' : 'idle');
        break;

      case 'knockdown': {
        const anyPress = cmd.pressed.lp || cmd.pressed.hp || cmd.pressed.lk || cmd.pressed.hk || cmd.pressed.jump;
        if (this.stateFrame >= this.stateDuration || (anyPress && this.stateFrame >= QUICK_RISE_FROM)) {
          this.setState('getup', Math.max(12, GETUP_FRAMES - this.stats.getUpSpeedBonusFrames));
        }
        break;
      }

      case 'getup':
        if (this.stateFrame >= this.stateDuration) {
          this.setState('idle');
          bus.emit('fighter:getup', { fighter: this });
        }
        break;

      case 'jump':
        // Limited air control.
        wantVX = cmd.moveX * WALK_SPEED * 0.6 * this.stats.moveSpeedMultiplier;
        break;

      case 'idle':
      case 'walk':
      case 'block': {
        if (this.buffered && this.tryAttack(this.buffered.button, frame, bus)) break;
        if (cmd.pressed.jump && this.grounded) {
          this.vel.y = JUMP_VELOCITY;
          this.pos.y = 0.001;
          this.setState('jump');
          bus.emit('fighter:jump', { fighter: this });
          wantVX = cmd.moveX * WALK_SPEED * this.stats.moveSpeedMultiplier;
          break;
        }
        if (cmd.block) {
          if (this.state !== 'block') this.setState('block');
          break;
        }
        wantVX = cmd.moveX * WALK_SPEED * this.stats.moveSpeedMultiplier;
        wantVZ = cmd.moveZ * DEPTH_SPEED * this.stats.depthSpeedMultiplier;
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

    this.pos.x += (this.vel.x + this.knockVel) * dt;
    this.pos.z += this.vel.z * dt;

    if (!this.grounded || this.vel.y > 0) {
      this.vel.y += GRAVITY * dt;
      this.pos.y += this.vel.y * dt;
      if (this.pos.y <= 0) {
        this.pos.y = 0;
        this.vel.y = 0;
        if (this.state === 'jump') {
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

  /** Start or chain an attack. Returns true if a move started (or the press was consumed). */
  private tryAttack(button: AttackButton, frame: number, bus: EventBus<GameEvents>): boolean {
    let moveId: string | undefined;
    if (this.state === 'attack' && this.move) {
      moveId = this.move.data.next[button];
      if (!moveId) return false; // no chain for this button; keep it buffered until the move ends
    } else {
      moveId = this.moveSet.starters[button];
    }
    const data = moveId ? this.moveSet.moves[moveId] : undefined;
    if (!data) return false;

    this.buffered = null;
    if (data.kind === 'heavy' && this.stats.hasTag('state.exhausted')) {
      bus.emit('action:refused', { fighter: this, reason: 'exhausted' });
      return true;
    }

    const chained = this.state === 'attack';
    this.vitals.spendStamina(data.staminaCost, frame);
    if (data.id === this.lastMoveId) this.repeatCount++;
    else this.repeatCount = 1;
    this.lastMoveId = data.id;
    if (!chained) this.comboHits = 0;

    this.setState('attack');
    this.move = startMove(data, this.stats.attackSpeed);
    bus.emit('move:started', { fighter: this, move: data });
    return true;
  }

  // ---- reactions (called by CombatSystem) ------------------------------------

  enterHitReaction(kind: 'flinch' | 'stagger' | 'knockdown', hitstun: number): void {
    if (kind === 'knockdown') {
      this.setState('knockdown', KNOCKDOWN_FRAMES);
      this.poise = this.stats.maxPoise;
    } else if (kind === 'stagger') {
      this.setState('stagger', Math.round(hitstun * 1.6));
      this.poise = this.stats.maxPoise;
    } else {
      this.setState('hitstun', hitstun);
    }
    this.buffered = null;
  }

  enterBlockstun(frames: number): void {
    this.setState('blockstun', frames);
  }

  enterGuardBreak(): void {
    this.setState('guardbreak', 50);
    this.poise = this.stats.maxPoise;
    this.buffered = null;
  }

  knockOut(): void {
    this.setState('ko');
    this.knockVel *= 1.4;
    this.buffered = null;
  }
}
