import { SIM_HZ } from '../core/constants';
import type { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/GameEvents';
import type { Rng } from '../core/Rng';
import type { Fighter } from '../fighter/Fighter';
import type { CommandFrame } from '../input/Commands';
import type { Arena } from '../world/Arena';
import { computeDamage } from './Damage';
import type { MoveData } from './MoveData';

/**
 * Grappling: clinches, throws, takedowns, the ground game and submissions.
 * Both fighters share one link; the holder picks moves, the held fighter
 * tries to escape. Escapes are a contest of stamina, strength and grappling
 * skill, not button mashing: each attempt costs stamina and has a cooldown.
 */
export interface GrappleLink {
  partner: Fighter;
  role: 'holder' | 'held';
  phase: 'clinch' | 'ground';
  frames: number;
  /** 0..100 while a submission is being applied. */
  subProgress: number;
  submitting: boolean;
  escapeReadyAt: number;
}

const CLINCH_MAX_FRAMES = 150;
const GROUND_MAX_FRAMES = 300;
const CLINCH_DISTANCE = 0.48;
const GROUND_DISTANCE = 0.35;
const DRAIN_PER_SECOND = 4;
const ESCAPE_COST = 8;
const ESCAPE_COOLDOWN = 24;

export function startGrapple(holder: Fighter, held: Fighter, phase: 'clinch' | 'ground', frame: number, bus: EventBus<GameEvents>): void {
  holder.grapple = { partner: held, role: 'holder', phase, frames: 0, subProgress: 0, submitting: false, escapeReadyAt: 0 };
  held.grapple = { partner: holder, role: 'held', phase, frames: 0, subProgress: 0, submitting: false, escapeReadyAt: frame + 20 };
  holder.setState(phase === 'ground' ? 'ground_top' : 'clinch_hold');
  held.setState(phase === 'ground' ? 'ground_bottom' : 'clinched');
  held.knockVel = 0;
  holder.knockVel = 0;
  held.facing = holder.facing === 1 ? -1 : 1;
  holder.vitals.markCombat(frame);
  held.vitals.markCombat(frame);
  bus.emit('grapple:start', { holder, held, phase });
}

/** Break the link. `stagger` sends the held fighter (or both) reeling; `push` separates them. */
export function endGrapple(f: Fighter, bus: EventBus<GameEvents>, reason: 'escape' | 'release' | 'timeout' | 'throw' | 'hit' | 'submission'): void {
  const link = f.grapple;
  if (!link) return;
  const other = link.partner;
  const holder = link.role === 'holder' ? f : other;
  const held = link.role === 'holder' ? other : f;
  holder.grapple = null;
  held.grapple = null;
  const dir = Math.sign(held.pos.x - holder.pos.x) || holder.facing;
  if (reason === 'escape') {
    holder.enterParried(22);
    holder.knockVel = -dir * 1.6;
    held.setState('idle');
    held.knockVel = dir * 1.6;
  } else if (reason === 'release' || reason === 'timeout') {
    if (!holder.isKO && holder.state !== 'attack') holder.setState('idle');
    if (!held.isKO) held.setState('idle');
    held.knockVel = dir * 2;
  } else if (reason === 'hit') {
    if (holder.state === 'clinch_hold' || holder.state === 'ground_top') holder.setState('idle');
    if (held.state === 'clinched') held.setState('idle');
    if (held.state === 'ground_bottom') held.enterHitReaction('knockdown', 0);
  }
  // 'throw' and 'submission' set their own states.
  bus.emit('grapple:end', { holder, held, reason });
}

/** Called every frame by the simulation, after fighters update. */
export function updateGrapples(fighters: Fighter[], commands: Map<number, CommandFrame>, frame: number, bus: EventBus<GameEvents>, rng: Rng, arena: Arena): void {
  for (const holder of fighters) {
    const link = holder.grapple;
    if (!link || link.role !== 'holder') continue;
    const held = link.partner;
    if (holder.isKO || held.isKO) {
      endGrapple(holder, bus, 'release');
      continue;
    }
    if (holder.hitstop > 0 || held.hitstop > 0) continue;
    link.frames++;
    held.grapple!.frames = link.frames;

    // Keep the pair locked together.
    const gap = link.phase === 'ground' ? GROUND_DISTANCE : CLINCH_DISTANCE;
    held.pos.x = holder.pos.x + holder.facing * gap;
    held.pos.z = holder.pos.z;
    arena.clamp(held.pos);
    holder.pos.x = held.pos.x - holder.facing * gap;

    const drain = (DRAIN_PER_SECOND / SIM_HZ) * (link.phase === 'ground' ? 0.5 : 1);
    holder.vitals.spendStamina(drain, frame);
    held.vitals.spendStamina(drain, frame);

    const hc = commands.get(holder.id);
    const vc = commands.get(held.id);

    // ---- held fighter: escape attempts --------------------------------------
    const heldLink = held.grapple!;
    if (vc && (vc.pressed.grab || vc.pressed.dodge) && frame >= heldLink.escapeReadyAt) {
      heldLink.escapeReadyAt = frame + ESCAPE_COOLDOWN;
      held.vitals.spendStamina(ESCAPE_COST, frame);
      const chance = escapeChance(holder, held, link.phase);
      if (rng.chance(chance)) {
        bus.emit('grapple:escape', { holder, held });
        endGrapple(holder, bus, 'escape');
        continue;
      }
      bus.emit('grapple:escape_failed', { holder, held });
    }

    // ---- submissions --------------------------------------------------------
    if (link.submitting) {
      const pressure = 1.1 + 0.03 * holder.stats.attr('technique') + 0.35 * holder.style.grappleSkill + 0.4 * (holder.vitals.stamina / holder.vitals.maxStamina);
      const resist = vc?.block ? 0.6 + 0.4 * (held.vitals.stamina / held.vitals.maxStamina) + 0.2 * held.style.grappleSkill : 0.2;
      if (vc?.block) held.vitals.spendStamina(10 / SIM_HZ, frame);
      link.subProgress = Math.max(0, Math.min(100, link.subProgress + pressure - resist));
      heldLink.subProgress = link.subProgress;
      if (link.subProgress >= 100) {
        const dmg = held.vitals.maxHealth * 0.35;
        held.vitals.takeDamage(dmg, frame);
        bus.emit('submission', { holder, held, damage: dmg });
        endGrapple(holder, bus, 'submission');
        holder.setState('idle');
        if (held.vitals.isKnockedOut) {
          held.knockOut();
          bus.emit('fighter:ko', { fighter: held, by: holder });
        } else {
          held.enterHitReaction('knockdown', 0);
        }
        continue;
      }
      if (!hc?.pressed.hp && link.frames % 60 === 0 && link.subProgress < 5) link.submitting = false;
    }

    // ---- timeouts -------------------------------------------------------------
    if (link.frames >= (link.phase === 'ground' ? GROUND_MAX_FRAMES : CLINCH_MAX_FRAMES) && holder.state !== 'attack') {
      endGrapple(holder, bus, 'timeout');
      if (link.phase === 'ground') held.enterHitReaction('knockdown', 0);
      continue;
    }

    // ---- holder: pick a move --------------------------------------------------
    if (!hc || holder.state === 'attack') continue;
    if (hc.pressed.grab) {
      endGrapple(holder, bus, 'release');
      continue;
    }
    const style = holder.style;
    let moveId: string | undefined;
    if (link.phase === 'ground') {
      if (hc.pressed.lp || hc.pressed.lk) moveId = style.ground?.strike;
      else if (hc.pressed.hp || hc.pressed.hk) moveId = style.ground?.submission;
    } else {
      if (hc.pressed.lp || hc.pressed.hp) moveId = style.clinch.strike;
      else if (hc.pressed.lk) moveId = style.clinch.throw;
      else if (hc.pressed.hk) moveId = style.clinch.power;
    }
    const data = moveId ? style.moves[moveId] : undefined;
    if (data) holder.startMove(data, frame, bus);
  }
}

/** Chance an escape attempt works: stamina, strength and grappling skill. */
export function escapeChance(holder: Fighter, held: Fighter, phase: 'clinch' | 'ground'): number {
  const hs = held.vitals.stamina / held.vitals.maxStamina;
  const os = holder.vitals.stamina / holder.vitals.maxStamina;
  const c =
    (phase === 'ground' ? 0.18 : 0.3) +
    0.35 * hs -
    0.25 * os +
    0.25 * (held.style.grappleSkill - holder.style.grappleSkill) +
    0.015 * (held.stats.attr('strength') - holder.stats.attr('strength'));
  return Math.max(0.05, Math.min(0.85, c));
}

/**
 * A clinch or ground move reached its active frame: it lands on the partner
 * automatically. Returns true if handled.
 */
export function resolveGrappleMove(holder: Fighter, data: MoveData, frame: number, bus: EventBus<GameEvents>, arena: Arena): boolean {
  const link = holder.grapple;
  if (!link || link.role !== 'holder') return false;
  const held = link.partner;
  const base = computeDamage(data.damage, holder.stats, held.stats, 1, 1, holder.masteryMultiplier(holder.style.id));
  holder.vitals.markCombat(frame);
  held.vitals.markCombat(frame);
  held.lastHitTakenFrame = frame;

  if (data.anim === 'submission') {
    link.submitting = true;
    held.grapple!.submitting = true;
    bus.emit('submission:start', { holder, held });
    return true;
  }

  if (data.anim === 'takedown') {
    held.vitals.takeDamage(base, frame);
    link.phase = 'ground';
    link.frames = 0;
    held.grapple!.phase = 'ground';
    held.grapple!.frames = 0;
    held.setState('ground_bottom');
    bus.emit('grapple:takedown', { holder, held, damage: base });
    holder.hitstop = data.hitstop;
    held.hitstop = data.hitstop;
    return true;
  }

  if (data.anim === 'throw') {
    // Throws send them over: near the alley edge counts as a wall throw (+50%).
    const b = arena.bounds;
    const nearWall = held.pos.x - b.minX < 1.5 || b.maxX - held.pos.x < 1.5;
    const dmg = base * (nearWall ? 1.5 : 1);
    held.vitals.takeDamage(dmg, frame);
    endGrapple(holder, bus, 'throw');
    held.pos.x = holder.pos.x - holder.facing * 0.7;
    held.knockVel = -holder.facing * data.knockback;
    holder.hitstop = data.hitstop;
    held.hitstop = data.hitstop;
    if (held.vitals.isKnockedOut) {
      held.knockOut();
      bus.emit('fighter:ko', { fighter: held, by: holder });
    } else {
      held.enterHitReaction('knockdown', 0);
      bus.emit('fighter:knockdown', { fighter: held });
    }
    bus.emit('grapple:throw', { holder, held, damage: dmg, wall: nearWall });
    return true;
  }

  // Clinch / ground strikes.
  held.vitals.takeDamage(base, frame);
  held.poise -= data.poiseDamage * holder.stats.poiseDamageMultiplier;
  holder.hitstop = data.hitstop;
  held.hitstop = data.hitstop;
  bus.emit('hit:landed', {
    attacker: holder, target: held, move: data, damage: base, blocked: false, clean: false, counter: false,
    reaction: 'flinch', comboHits: ++holder.comboHits, x: held.pos.x, y: held.pos.y + (link.phase === 'ground' ? 0.3 : 1.2), z: held.pos.z,
  });
  if (held.vitals.isKnockedOut) {
    endGrapple(holder, bus, 'release');
    held.knockOut();
    bus.emit('fighter:ko', { fighter: held, by: holder });
  } else if (link.phase === 'clinch' && held.poise <= 0) {
    // Broken posture: they fall out of the clinch staggered.
    endGrapple(holder, bus, 'release');
    held.enterHitReaction('stagger', 20);
  }
  return true;
}
