import { BODY_HEIGHT, BODY_RADIUS } from '../core/constants';
import type { EventBus } from '../core/EventBus';
import type { GameEvents, HitInfo } from '../core/GameEvents';
import type { Rng } from '../core/Rng';
import { COUNTER_WINDOW, type Fighter } from '../fighter/Fighter';
import type { Arena } from '../world/Arena';
import { BLOCK_STAMINA_RATIO, CLEAN_HIT_DAMAGE, CLEAN_HIT_POISE, computeDamage, repetitionMultiplier } from './Damage';
import { endGrapple, resolveGrappleMove, startGrapple } from './Grapple';
import { isActiveFrame, type ActiveMove } from './MoveData';
import { isWeaponMove } from './Weapons';

/** Weapons wear down with every hit, blocked or not. */
function wearWeapon(attacker: Fighter, m: ActiveMove, bus: EventBus<GameEvents>): void {
  if (!attacker.weapon || !isWeaponMove(m.data)) return;
  attacker.weapon.hits--;
  if (attacker.weapon.hits <= 0) {
    const w = attacker.weapon.data;
    attacker.weapon = null;
    bus.emit('weapon:broken', { fighter: attacker, name: w.name, smashed: w.breaks });
  }
}

export interface HitSphere {
  x: number;
  y: number;
  z: number;
  r: number;
}

export const COUNTER_MULTIPLIER = 1.5;

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
export function resolveCombat(fighters: Fighter[], frame: number, bus: EventBus<GameEvents>, rng: Rng, arena: Arena): void {
  for (const attacker of fighters) {
    const m = attacker.move;
    if (!m || attacker.state !== 'attack' || attacker.hitstop > 0 || !isActiveFrame(m)) continue;

    // Clinch and ground moves land on the partner automatically.
    if (m.data.kind === 'clinch') {
      if (!m.connected && attacker.grapple?.role === 'holder') {
        m.connected = true;
        resolveGrappleMove(attacker, m.data, frame, bus, arena);
      }
      continue;
    }
    if (attacker.grapple) continue;

    const sphere = hitSphereOf(attacker, m);
    for (const target of fighters) {
      if (target === attacker || target.team === attacker.team) continue;
      if (target.isInvulnerable || m.hitTargets.has(target.id)) continue;
      if (!sphereHitsFighter(sphere, target, m.data.depthTolerance)) continue;
      m.hitTargets.add(target.id);
      m.connected = true;
      if (m.data.kind === 'grab') resolveGrab(attacker, target, m, frame, bus);
      else {
        resolveHit(attacker, target, m, frame, bus, rng, sphere);
        wearWeapon(attacker, m, bus);
      }
      if (m.data.kind === 'grab') break;
    }
  }
}

function resolveGrab(attacker: Fighter, target: Fighter, m: ActiveMove, frame: number, bus: EventBus<GameEvents>): void {
  if (target.grapple || !target.grounded) return;
  // Sprawl: a blocking wrestler can't be grabbed.
  if (target.style.defence === 'sprawl' && target.isBlocking) {
    attacker.enterParried(36);
    attacker.knockVel = -attacker.facing * 1.2;
    bus.emit('grapple:sprawl', { attacker, defender: target });
    return;
  }
  attacker.hitstop = m.data.hitstop;
  target.hitstop = m.data.hitstop;
  startGrapple(attacker, target, m.data.anim === 'shoot' ? 'ground' : 'clinch', frame, bus);
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

  attacker.vitals.markCombat(frame);
  target.vitals.markCombat(frame);
  target.lastHitTakenFrame = frame;

  // Hitting someone held by somebody else breaks the hold.
  if (target.grapple) endGrapple(target, bus, 'hit');

  // ---- Finisher ------------------------------------------------------------------
  if (move.kind === 'finisher') {
    const dmg = target.vitals.health;
    target.vitals.takeDamage(dmg, frame);
    target.knockVel = dir * move.knockback;
    target.knockOut();
    attacker.hitstop = move.hitstop;
    target.hitstop = move.hitstop;
    bus.emit('hit:landed', baseInfo(attacker, target, move, at, { damage: dmg, reaction: 'ko', comboHits: attacker.comboHits + 1 }));
    bus.emit('fighter:finished', { fighter: target, by: attacker, move });
    bus.emit('fighter:ko', { fighter: target, by: attacker });
    return;
  }

  const canDefend = !move.unblockable && target.grounded && target.isFacing(attacker);

  // ---- Parry: block pressed just before impact ----------------------------------
  const parryState = target.state === 'block' || target.state === 'idle' || target.state === 'walk' || target.state === 'blockstun';
  if (canDefend && parryState && frame - target.lastBlockPressFrame <= target.parryWindow) {
    attacker.enterParried(26);
    attacker.knockVel = -dir * 1.5;
    target.counterUntil = frame + COUNTER_WINDOW + (target.style.id === 'karate' ? 15 : 0);
    target.setState('block');
    attacker.hitstop = 6;
    target.hitstop = 6;
    bus.emit('hit:parried', { attacker, target, move });
    return;
  }

  const repeat = repetitionMultiplier(attacker.repeatCount);
  const counter = attacker.counterUntil >= frame;
  const baseDamage = computeDamage(move.damage, attacker.stats, target.stats, repeat, counter ? COUNTER_MULTIPLIER : 1, attacker.masteryMultiplier(move.style));

  // ---- Blocked ---------------------------------------------------------------
  if (canDefend && target.isBlocking) {
    const absorb = target.style.blockAbsorb;
    const kick = move.limb === 'leadFoot' || move.limb === 'rearFoot';
    const checked = kick && target.style.defence === 'check';
    const chip = checked ? 0 : baseDamage * (1 - absorb);
    const staminaCost = baseDamage * absorb * BLOCK_STAMINA_RATIO * target.stats.blockStaminaMultiplier;
    const exhausted = target.stats.hasTag('state.exhausted');
    const broke = exhausted || staminaCost >= target.vitals.stamina;
    target.vitals.spendStamina(staminaCost, frame);
    target.vitals.takeDamage(chip, frame, true);
    target.knockVel = dir * move.knockback * 0.5;
    if (checked && attacker.move) attacker.move.recovery += 10;
    const info = baseInfo(attacker, target, move, at, { damage: chip, blocked: true, reaction: checked ? 'check' : 'block' });

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
  const poiseDamage = move.poiseDamage * attacker.stats.poiseDamageMultiplier * (clean ? CLEAN_HIT_POISE : 1) * (counter ? 1.5 : 1);
  const wasReeling = target.isReeling;
  const wasStaggered = target.state === 'stagger' || target.state === 'guardbreak';
  const airborne = !target.grounded;

  target.poise -= poiseDamage;
  const poiseBroken = target.poise <= 0;

  let reaction: 'flinch' | 'stagger' | 'knockdown' = move.reaction;
  if (airborne) reaction = 'knockdown';
  else if (reaction === 'knockdown' && !poiseBroken && !wasStaggered) reaction = 'stagger';
  else if (reaction === 'flinch' && (poiseBroken || counter)) reaction = 'stagger';
  if (counter) attacker.counterUntil = -1;

  target.vitals.takeDamage(damage, frame, false);
  if (move.staminaDamage) target.vitals.spendStamina(move.staminaDamage * (clean ? 1.3 : 1), frame);
  if (move.slowFrames) target.applySlow(move.slowFrames, frame);
  attacker.comboHits = wasReeling ? attacker.comboHits + 1 : 1;

  const kbScale = reaction === 'knockdown' ? 1.6 : reaction === 'stagger' ? 1.3 : 1;
  target.knockVel = dir * move.knockback * kbScale;
  if (airborne) target.vel.y = Math.max(target.vel.y, 2);

  const info = baseInfo(attacker, target, move, at, { damage, clean, counter, comboHits: attacker.comboHits });

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
  attacker.hitstop = move.hitstop + (counter ? 3 : 0);
  target.hitstop = move.hitstop + (counter ? 3 : 0);
  bus.emit('hit:landed', info);
  if (reaction === 'knockdown') bus.emit('fighter:knockdown', { fighter: target });
}

function baseInfo(attacker: Fighter, target: Fighter, move: HitInfo['move'], at: HitSphere, extra: Partial<HitInfo>): HitInfo {
  return {
    attacker,
    target,
    move,
    damage: 0,
    blocked: false,
    clean: false,
    counter: false,
    reaction: 'flinch',
    comboHits: 0,
    x: at.x,
    y: at.y,
    z: at.z,
    ...extra,
  };
}
