import { BODY_HEIGHT, BODY_RADIUS } from '../core/constants';
import type { EventBus } from '../core/EventBus';
import type { GameEvents, HitInfo } from '../core/GameEvents';
import type { Rng } from '../core/Rng';
import type { Fighter } from '../fighter/Fighter';
import {
  BLOCK_CHIP_RATIO,
  BLOCK_STAMINA_RATIO,
  CLEAN_HIT_DAMAGE,
  CLEAN_HIT_POISE,
  computeDamage,
  repetitionMultiplier,
} from './Damage';
import { isActiveFrame, type ActiveMove } from './MoveData';

export interface HitSphere {
  x: number;
  y: number;
  z: number;
  r: number;
}

/** Where the attacking limb's hit sphere is this frame. */
export function hitSphereOf(f: Fighter, m: ActiveMove): HitSphere {
  return {
    x: f.pos.x + f.facing * m.data.reach,
    y: f.pos.y + m.data.hitY,
    z: f.pos.z,
    r: m.data.hitRadius,
  };
}

/**
 * Sphere vs the target's vertical body capsule in the X/Y plane,
 * plus a depth (Z) tolerance check for 2.5D lane alignment.
 */
export function sphereHitsFighter(s: HitSphere, target: Fighter, depthTolerance: number): boolean {
  if (Math.abs(s.z - target.pos.z) > depthTolerance) return false;
  const bottom = target.pos.y + 0.15;
  const top = target.pos.y + BODY_HEIGHT;
  const cy = Math.min(top, Math.max(bottom, s.y));
  const dx = s.x - target.pos.x;
  const dy = s.y - cy;
  const reach = s.r + BODY_RADIUS;
  return dx * dx + dy * dy <= reach * reach;
}

/** Check every attacker's active frames against every opponent and resolve hits. */
export function resolveCombat(fighters: Fighter[], frame: number, bus: EventBus<GameEvents>, rng: Rng): void {
  for (const attacker of fighters) {
    const m = attacker.move;
    if (!m || attacker.state !== 'attack' || attacker.hitstop > 0 || !isActiveFrame(m)) continue;
    const sphere = hitSphereOf(attacker, m);
    for (const target of fighters) {
      if (target === attacker || target.team === attacker.team) continue;
      if (target.isInvulnerable || m.hitTargets.has(target.id)) continue;
      if (!sphereHitsFighter(sphere, target, m.data.depthTolerance)) continue;
      m.hitTargets.add(target.id);
      m.connected = true;
      resolveHit(attacker, target, m, frame, bus, rng, sphere);
    }
  }
}

export function resolveHit(
  attacker: Fighter,
  target: Fighter,
  m: ActiveMove,
  frame: number,
  bus: EventBus<GameEvents>,
  rng: Rng,
  at: HitSphere,
): void {
  const move = m.data;
  const dir = Math.sign(target.pos.x - attacker.pos.x) || attacker.facing;
  const repeat = repetitionMultiplier(attacker.repeatCount);
  const baseDamage = computeDamage(move.damage, attacker.stats, target.stats, repeat);

  attacker.vitals.markCombat(frame);
  target.vitals.markCombat(frame);
  target.lastHitTakenFrame = frame;

  const info: HitInfo = {
    attacker,
    target,
    move,
    damage: 0,
    blocked: false,
    clean: false,
    reaction: 'flinch',
    comboHits: 0,
    x: at.x,
    y: at.y,
    z: at.z,
  };

  // ---- Blocked ---------------------------------------------------------------
  if (target.isBlocking && target.grounded && target.isFacing(attacker)) {
    const chip = baseDamage * BLOCK_CHIP_RATIO;
    const staminaCost = baseDamage * (1 - BLOCK_CHIP_RATIO) * BLOCK_STAMINA_RATIO * target.stats.blockStaminaMultiplier;
    const exhausted = target.stats.hasTag('state.exhausted');
    const broke = exhausted || staminaCost >= target.vitals.stamina;
    target.vitals.spendStamina(staminaCost, frame);
    target.vitals.takeDamage(chip, frame, true);
    info.blocked = true;
    info.damage = chip;
    target.knockVel = dir * move.knockback * 0.5;

    if (target.vitals.isKnockedOut) {
      target.knockOut();
      info.reaction = 'ko';
      bus.emit('hit:blocked', info);
      bus.emit('fighter:ko', { fighter: target, by: attacker });
      return;
    }
    if (broke) {
      target.enterGuardBreak();
      info.reaction = 'guardbreak';
      bus.emit('hit:blocked', info);
      bus.emit('guard:broken', { fighter: target, by: attacker });
    } else {
      target.enterBlockstun(move.blockstun);
      info.reaction = 'block';
      bus.emit('hit:blocked', info);
    }
    const stop = Math.max(2, move.hitstop - 1);
    attacker.hitstop = stop;
    target.hitstop = stop;
    return;
  }

  // ---- Clean hit -------------------------------------------------------------
  const clean = rng.chance(attacker.stats.cleanHitChance);
  const damage = baseDamage * (clean ? CLEAN_HIT_DAMAGE : 1);
  const poiseDamage = move.poiseDamage * attacker.stats.poiseDamageMultiplier * (clean ? CLEAN_HIT_POISE : 1);
  const wasReeling = target.isReeling;
  const wasStaggered = target.state === 'stagger' || target.state === 'guardbreak';
  const airborne = !target.grounded;

  target.poise -= poiseDamage;
  const poiseBroken = target.poise <= 0;

  let reaction: 'flinch' | 'stagger' | 'knockdown' = move.reaction;
  if (airborne) reaction = 'knockdown';
  else if (reaction === 'knockdown' && !poiseBroken && !wasStaggered) reaction = 'stagger';
  else if (reaction === 'flinch' && poiseBroken) reaction = 'stagger';

  target.vitals.takeDamage(damage, frame, false);
  attacker.comboHits = wasReeling ? attacker.comboHits + 1 : 1;

  const kbScale = reaction === 'knockdown' ? 1.6 : reaction === 'stagger' ? 1.3 : 1;
  target.knockVel = dir * move.knockback * kbScale;
  if (airborne) target.vel.y = Math.max(target.vel.y, 2);

  info.damage = damage;
  info.clean = clean;
  info.comboHits = attacker.comboHits;

  if (target.vitals.isKnockedOut) {
    target.knockOut();
    info.reaction = 'ko';
    attacker.hitstop = move.hitstop + 6;
    target.hitstop = move.hitstop + 6;
    bus.emit('hit:landed', info);
    bus.emit('fighter:ko', { fighter: target, by: attacker });
    return;
  }

  target.enterHitReaction(reaction, move.hitstun);
  info.reaction = reaction;
  attacker.hitstop = move.hitstop;
  target.hitstop = move.hitstop;
  bus.emit('hit:landed', info);
  if (reaction === 'knockdown') bus.emit('fighter:knockdown', { fighter: target });
}
