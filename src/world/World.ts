import { ARCHETYPES, archetypeAppearance, type Archetype, type ArchetypeId } from '../ai/archetypes';
import { AttackTokens } from '../ai/AttackTokens';
import { BOSSES, type BossDef, type BossPhase } from '../ai/bosses';
import { DummyBrain } from '../ai/DummyBrain';
import { FighterAI } from '../ai/FighterAI';
import { sparringPartnerAppearance } from '../character/Appearance';
import { WEAPONS, type WeaponData, type WeaponId } from '../combat/Weapons';
import { SIM_HZ } from '../core/constants';
import { EventBus } from '../core/EventBus';
import { Simulation } from '../core/Simulation';
import { getStyle } from '../data/styles';
import { Fighter } from '../fighter/Fighter';
import type { CommandFrame } from '../input/Commands';
import { GEAR, COSMETIC_LABELS } from '../progress/catalogue';
import type { AreaId, Progress } from '../progress/Progress';
import { defaultAttributes } from '../stats/Stats';
import { Arena, type Obstacle } from './Arena';
import { propBox, type EncounterDef, type ExitDef, type GateDef, type LeverDef, type LevelDef, type PickupDef, type StationDef } from './LevelTypes';

export const PLAYER_ID = 1;
const INTERACT_RANGE = 1.35;
const PICKUP_RANGE = 0.75;
const ENEMY_CLEAR_FRAMES = 150;
const DEFEAT_DELAY = 150;

export interface WorldEvents {
  'area:exit': { to: AreaId; entry: string };
  'area:locked': { text: string };
  'encounter:start': { id: string; boss: BossDef | null };
  'encounter:wave': { id: string; wave: number; of: number };
  'encounter:cleared': { id: string; cash: number; xp: number; optional: boolean };
  'boss:phase': { boss: BossDef; phase: BossPhase };
  'boss:defeated': { boss: BossDef; first: boolean; cash: number; xp: number };
  pickup: { kind: PickupDef['kind'] | 'drop'; label: string; amount: number };
  secret: { label: string };
  unlock: { text: string };
  'level:up': { level: number };
  'gate:opened': { label: string };
  station: { id: StationDef['id'] };
  'player:defeated': Record<string, never>;
}

interface EncounterState {
  def: EncounterDef;
  status: 'waiting' | 'active' | 'cleared';
  wave: number;
  enemies: Fighter[];
  boss: Fighter | null;
  bossDef: BossDef | null;
  phasesDone: number;
}

export interface GroundItem {
  key: string;
  weapon: WeaponData;
  x: number;
  z: number;
  /** Level pickup id, if it came from the level data. */
  pickupId?: string;
}

export interface LivePickup {
  key: string;
  def: PickupDef | null;
  kind: PickupDef['kind'] | 'drop';
  x: number;
  z: number;
  amount: number;
  label: string;
}

export type Interactable =
  | { kind: 'exit'; x: number; z: number; label: string; exit: ExitDef; locked: boolean }
  | { kind: 'lever'; x: number; z: number; label: string; lever: LeverDef; done: boolean }
  | { kind: 'station'; x: number; z: number; label: string; station: StationDef }
  | { kind: 'weapon'; x: number; z: number; label: string; item: GroundItem };

/**
 * One area of the world running live: the level's collision, the player,
 * encounters and bosses, pickups, weapons on the ground, gates, levers,
 * exits and (at home) hub stations. Progress changes go through Progress so
 * rewards are paid once and survive saving.
 */
export class World {
  readonly sim: Simulation;
  readonly arena: Arena;
  readonly player: Fighter;
  readonly events = new EventBus<WorldEvents>();
  readonly tokens = new AttackTokens(2);
  readonly encounters: EncounterState[] = [];
  readonly items: GroundItem[] = [];
  readonly pickups: LivePickup[] = [];
  enemies: Fighter[] = [];
  /** What the player can interact with right now (for the prompt). */
  interactable: Interactable | null = null;
  /** Message shown when an exit is locked, with a timer. */
  private brains = new Map<Fighter, FighterAI | DummyBrain>();
  private koAt = new Map<Fighter, number>();
  private gateObstacles = new Map<string, Obstacle>();
  private nextId = 2;
  private exitRequested = false;
  private defeated = false;
  private defeatAt = -1;
  private edgePush = 0;
  private lockedMsgAt = -999;
  private itemSeq = 0;
  private lastX: number;

  constructor(
    readonly level: LevelDef,
    readonly progress: Progress,
    opts: { entry: string; touch?: boolean; carry?: { health: number; stamina: number; weapon: WeaponId | null } | null; seed?: number; difficulty?: 'easy' | 'normal' | 'hard' },
  ) {
    const obstacles: Obstacle[] = [];
    for (const p of level.props) {
      const box = propBox(p);
      if (box) obstacles.push(box);
    }
    for (const w of level.walls ?? []) obstacles.push({ ...w });
    for (const g of level.gates ?? []) {
      const o: Obstacle = { id: g.id, minX: g.x - 0.12, maxX: g.x + 0.12, minZ: g.z0, maxZ: g.z1, solid: !progress.has(g.openFlag) };
      this.gateObstacles.set(g.id, o);
      obstacles.push(o);
    }
    this.arena = new Arena({ ...level.bounds }, level.name, obstacles);
    this.sim = new Simulation(this.arena, opts.seed ?? (Date.now() & 0xffff));

    const entry = level.entries.find((e) => e.id === opts.entry) ?? level.entries[0];
    const cfg = progress.fighterConfig(PLAYER_ID, entry.x, entry.z, !!opts.touch);
    if (opts.carry) cfg.weapon = opts.carry.weapon;
    this.player = this.sim.add(new Fighter(cfg));
    progress.applyModifiers(this.player, opts.difficulty ?? 'normal');
    this.player.vitals.reset();
    if (opts.carry) {
      this.player.vitals.health = Math.max(1, Math.min(this.player.vitals.maxHealth, opts.carry.health));
      this.player.vitals.stamina = Math.min(this.player.vitals.maxStamina, opts.carry.stamina);
    }
    this.player.facing = entry.facing;
    this.lastX = entry.x;

    for (const def of level.encounters) {
      const cleared = !def.optional && (progress.has(this.clearedKey(def)) || (def.boss ? progress.has(BOSSES[def.boss].flag) : false));
      this.encounters.push({ def, status: cleared ? 'cleared' : 'waiting', wave: 0, enemies: [], boss: null, bossDef: null, phasesDone: 0 });
    }
    for (const p of level.pickups) {
      // Cash and secrets are one-time; food and weapons are back each visit.
      if ((p.kind === 'cash' || p.kind === 'secret') && progress.has(this.pickupKey(p))) continue;
      if (p.kind === 'weapon' && p.weapon) this.items.push({ key: `lvl_${p.id}`, weapon: WEAPONS[p.weapon], x: p.x, z: p.z, pickupId: p.id });
      else this.pickups.push({ key: p.id, def: p, kind: p.kind, x: p.x, z: p.z, amount: p.amount ?? 0, label: p.label ?? defaultLabel(p) });
    }
    if (level.stations?.some((s) => s.id === 'sparring')) this.spawnSparringPartner(level.stations.find((s) => s.id === 'sparring')!);

    this.sim.bus.on('fighter:ko', ({ fighter }) => {
      if (fighter !== this.player) {
        this.koAt.set(fighter, this.sim.frame);
        this.tokens.release(fighter);
        if (fighter.team === 'enemy' && this.brains.get(fighter) instanceof FighterAI) progress.save.stats.kos++;
      }
    });
  }

  private clearedKey(def: EncounterDef): string {
    return `cleared:${this.level.id}:${def.id}`;
  }

  private pickupKey(p: PickupDef): string {
    return `pickup:${this.level.id}:${p.id}`;
  }

  /** The enemy to show in the top-right bar: whoever you're squaring up to, if they're close. */
  get focusEnemy(): Fighter | null {
    const p = this.player;
    const near = (f: Fighter) => !f.isKO && Math.abs(f.pos.x - p.pos.x) < 6;
    const t = p.target;
    if (t && t.team === 'enemy' && near(t)) return t;
    const boss = this.activeBoss;
    if (boss && !boss.isKO) return boss;
    return this.enemies.find(near) ?? null;
  }

  get activeEncounter(): EncounterState | null {
    return this.encounters.find((e) => e.status === 'active') ?? null;
  }

  get activeBoss(): Fighter | null {
    return this.activeEncounter?.boss ?? null;
  }

  /** True while walled into a fight (no leaving, no going home). */
  get locked(): boolean {
    return this.arena.lock !== null;
  }

  /** What the HUD should say you're doing. */
  get objective(): string {
    const a = this.activeEncounter;
    if (a) {
      if (a.bossDef) return `Beat ${a.bossDef.name}`;
      return a.def.lock ? 'Clear the area' : 'Deal with them';
    }
    const next = this.encounters.find((e) => e.status === 'waiting' && !e.def.optional && e.def.objective);
    return next?.def.objective ?? this.level.objective;
  }

  // ---- per-frame update -------------------------------------------------------

  step(input: CommandFrame): void {
    const frame = this.sim.frame;
    let cmd = input;
    const p = this.player;

    // Interact: the grab button (or E) uses whatever's in front of you, unless an enemy is in grabbing range.
    // Someone in grabbing range: the button grabs them instead.
    this.interactable = p.isKO || this.enemyInGrabRange() ? null : this.findInteractable();
    if (cmd.pressed.grab && this.interactable && p.isFree) {
      cmd = { ...cmd, pressed: { ...cmd.pressed, grab: false } };
      this.interact(this.interactable);
    }

    const commands = new Map<number, CommandFrame>();
    commands.set(PLAYER_ID, cmd);
    for (const [f, brain] of this.brains) commands.set(f.id, brain.think(frame));
    this.sim.step(commands);

    this.collectDroppedWeapons();
    this.collectPickups();
    this.updateEncounters();
    this.cleanUpKOs();
    this.checkEdgeExits(cmd);

    if (p.isKO && !this.defeated) {
      if (this.defeatAt < 0) this.defeatAt = this.sim.frame;
      if (this.sim.frame - this.defeatAt >= DEFEAT_DELAY) {
        this.defeated = true;
        this.events.emit('player:defeated', {});
      }
    }
  }

  // ---- encounters and bosses ------------------------------------------------------

  private updateEncounters(): void {
    const p = this.player;
    const x0 = this.lastX;
    const x1 = p.pos.x;
    this.lastX = x1;
    for (const e of this.encounters) {
      // Fights start when you cross their line, from either direction.
      const t = e.def.triggerX;
      const crossed = (x0 < t && x1 >= t) || (x0 > t && x1 <= t);
      if (e.status === 'waiting' && crossed && !this.activeEncounter && !p.isKO) this.startEncounter(e);
      if (e.status !== 'active') continue;
      if (e.boss) this.updateBossPhases(e);
      const alive = e.enemies.filter((f) => !f.isKO);
      if (alive.length === 0) {
        if (e.wave + 1 < e.def.waves.length) {
          e.wave++;
          this.spawnWave(e);
          this.events.emit('encounter:wave', { id: e.def.id, wave: e.wave + 1, of: e.def.waves.length });
        } else {
          this.finishEncounter(e);
        }
      }
    }
  }

  private startEncounter(e: EncounterState): void {
    e.status = 'active';
    e.wave = 0;
    if (e.def.lock) this.arena.lock = { minX: e.def.lock[0], maxX: e.def.lock[1] };
    if (e.def.boss) {
      const def = BOSSES[e.def.boss];
      e.bossDef = def;
      e.boss = this.spawnBoss(def, e);
      e.enemies.push(e.boss);
    }
    this.spawnWave(e);
    this.events.emit('encounter:start', { id: e.def.id, boss: e.bossDef });
  }

  private spawnWave(e: EncounterState): void {
    const wave = e.def.waves[e.wave];
    if (!wave) return;
    wave.enemies.forEach((spec, i) => {
      const f = this.spawnEnemy(spec.archetype, this.spawnX(e, i), this.spawnZ(i), spec.weapon);
      e.enemies.push(f);
    });
  }

  /** Enemies come in from the edges of the fight, alternating sides. */
  private spawnX(e: EncounterState, i: number): number {
    const lo = e.def.lock ? e.def.lock[0] + 0.8 : this.player.pos.x - 7;
    const hi = e.def.lock ? e.def.lock[1] - 0.8 : this.player.pos.x + 7;
    const right = i % 2 === 0;
    const base = right ? hi : lo;
    let x = Math.max(this.arena.bounds.minX + 0.5, Math.min(this.arena.bounds.maxX - 0.5, base + (right ? -1 : 1) * Math.floor(i / 2) * 0.9));
    // Never spawn on top of the player.
    if (Math.abs(x - this.player.pos.x) < 2.5) x = this.player.pos.x + (right ? 3 : -3);
    return x;
  }

  private spawnZ(i: number): number {
    const b = this.arena.bounds;
    const lanes = [0, b.minZ + 0.7, b.maxZ - 0.6, -0.8, 0.8];
    return lanes[i % lanes.length];
  }

  private finishEncounter(e: EncounterState): void {
    e.status = 'cleared';
    this.arena.lock = null;
    const def = e.def;
    let cash = def.reward.cash;
    let xp = def.reward.xp;
    if (!def.optional) {
      this.progress.set(this.clearedKey(def));
      // Mandatory fights pay once.
      if (!this.progress.claim(`enc:${this.level.id}:${def.id}`)) {
        cash = 0;
        xp = 0;
      }
    } else {
      // Optional fights come back each visit, so they pay less.
      cash = Math.round(cash * 0.5);
      xp = Math.round(xp * 0.5);
    }
    if (e.bossDef) {
      const first = this.progress.claim(`boss:${e.bossDef.id}`);
      if (first) {
        this.progress.set(e.bossDef.flag);
        this.progress.save.stats.bosses++;
        cash += e.bossDef.reward.cash;
        xp += e.bossDef.reward.xp;
      }
      this.pay(cash, xp);
      this.events.emit('boss:defeated', { boss: e.bossDef, first, cash, xp });
      return;
    }
    this.pay(cash, xp);
    this.events.emit('encounter:cleared', { id: def.id, cash, xp, optional: def.optional });
  }

  private pay(cash: number, xp: number): void {
    if (cash > 0) this.progress.addCash(cash);
    if (xp > 0) {
      const levels = this.progress.addXp(xp);
      if (levels > 0) {
        this.player.stats.level = this.progress.save.level;
        this.events.emit('level:up', { level: this.progress.save.level });
      }
    }
  }

  private spawnBoss(def: BossDef, e: EncounterState): Fighter {
    const x = e.def.lock ? e.def.lock[1] - 2 : this.player.pos.x + 5;
    const f = new Fighter({
      id: this.nextId++,
      name: def.name,
      team: 'enemy',
      attributes: { ...def.attributes },
      level: def.level,
      style: getStyle(def.style),
      secondaryStyle: def.secondaryStyle ? getStyle(def.secondaryStyle) : null,
      x,
      z: 0,
      appearance: { ...sparringPartnerAppearance(), accessories: [], ...def.appearance },
    });
    f.stats.addModifier({ id: 'boss_health', source: 'boss', flat: 'maxHealth', add: def.bonusHealth });
    f.vitals.reset();
    f.poise = f.stats.maxPoise;
    f.facing = -1;
    this.sim.add(f);
    this.enemies.push(f);
    const brain: Archetype = { ...def.brain, id: 'boss', name: def.name, description: def.title, look: () => ({}), boss: false };
    this.brains.set(f, new FighterAI(f, brain, this.sim.rng, this.tokens, this.arena));
    return f;
  }

  private updateBossPhases(e: EncounterState): void {
    const boss = e.boss!;
    const def = e.bossDef!;
    if (boss.isKO) return;
    const frac = boss.vitals.health / boss.vitals.maxHealth;
    while (e.phasesDone < def.phases.length && frac < def.phases[e.phasesDone].below) {
      const phase = def.phases[e.phasesDone++];
      const brain = this.brains.get(boss);
      if (brain instanceof FighterAI) {
        const a = brain.archetype;
        if (phase.aggression !== undefined) a.aggression = phase.aggression;
        if (phase.parryBonus) a.parryChance += phase.parryBonus;
        if (phase.grabBonus) a.grabChance += phase.grabBonus;
      }
      if (phase.damageMult) boss.stats.addModifier({ id: `phase_dmg_${e.phasesDone}`, source: 'boss_phase', stat: 'damageMult', mul: phase.damageMult });
      if (phase.speedMult) {
        boss.stats.addModifier({ id: `phase_spd_${e.phasesDone}`, source: 'boss_phase', stat: 'attackSpeedMult', mul: phase.speedMult });
        boss.stats.addModifier({ id: `phase_move_${e.phasesDone}`, source: 'boss_phase', stat: 'moveSpeedMult', mul: phase.speedMult });
      }
      if (phase.swap && boss.secondaryStyle) boss.usingSecondary = !boss.usingSecondary;
      phase.summon?.forEach((s, i) => e.enemies.push(this.spawnEnemy(s.archetype, this.spawnX(e, i + 1), this.spawnZ(i + 1), s.weapon)));
      // A short dramatic pause: everyone freezes and the player is pushed back.
      const dir = Math.sign(this.player.pos.x - boss.pos.x) || 1;
      if (!this.player.grapple) this.player.knockVel = dir * 3;
      boss.hitstop = 24;
      this.events.emit('boss:phase', { boss: def, phase });
    }
  }

  spawnEnemy(id: ArchetypeId, x: number, z: number, weapon?: WeaponId): Fighter {
    const a = ARCHETYPES[id];
    const f = new Fighter({
      id: this.nextId++,
      name: a.name,
      team: 'enemy',
      attributes: { ...a.attributes },
      level: a.level,
      style: getStyle(a.style),
      secondaryStyle: a.secondaryStyle ? getStyle(a.secondaryStyle) : null,
      x,
      z,
      appearance: archetypeAppearance(a, this.nextId * 7919 + this.level.id.length),
      weapon: weapon ?? a.weapon ?? null,
    });
    f.facing = x > this.player.pos.x ? -1 : 1;
    this.sim.add(f);
    this.enemies.push(f);
    this.brains.set(f, new FighterAI(f, { ...a }, this.sim.rng, this.tokens, this.arena));
    return f;
  }

  private spawnSparringPartner(s: StationDef): void {
    const f = new Fighter({
      id: this.nextId++,
      name: 'Cousin Mo',
      team: 'enemy',
      attributes: defaultAttributes(6),
      style: getStyle('street'),
      x: s.x,
      z: s.z - 0.6,
      appearance: sparringPartnerAppearance(),
    });
    f.facing = -1;
    this.sim.add(f);
    this.enemies.push(f);
    const brain = new DummyBrain(f, this.sim.rng);
    brain.mode = 'block';
    this.brains.set(f, brain);
  }

  /** Remove beaten enemies after a moment, dropping cash. The sparring partner just gets up again. */
  private cleanUpKOs(): void {
    for (const [f, at] of this.koAt) {
      if (this.sim.frame - at < ENEMY_CLEAR_FRAMES) continue;
      this.koAt.delete(f);
      const brain = this.brains.get(f);
      if (brain instanceof DummyBrain) {
        f.respawn();
        continue;
      }
      if (this.encounters.some((e) => e.boss === f)) continue;
      const arch = brain instanceof FighterAI ? brain.archetype : null;
      if (arch?.cashDrop) this.pickups.push({ key: `drop_${this.itemSeq++}`, def: null, kind: 'drop', x: f.pos.x, z: f.pos.z, amount: arch.cashDrop, label: `£${arch.cashDrop}` });
      if (arch?.xp) this.pay(0, arch.xp);
      this.sim.remove(f);
      this.brains.delete(f);
      this.tokens.release(f);
      this.enemies = this.enemies.filter((e) => e !== f);
    }
  }

  // ---- pickups, weapons, interaction ----------------------------------------------

  private collectDroppedWeapons(): void {
    for (const f of this.sim.fighters) {
      if (!f.droppedWeapon) continue;
      const w = f.droppedWeapon;
      f.droppedWeapon = null;
      if (w.breaks && f !== this.player) continue; // smashed bottles don't survive
      this.items.push({ key: `w_${this.itemSeq++}`, weapon: w, x: f.pos.x + f.facing * -0.4, z: f.pos.z });
    }
  }

  private collectPickups(): void {
    const p = this.player;
    if (p.isKO) return;
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const it = this.pickups[i];
      if (Math.hypot(it.x - p.pos.x, (it.z - p.pos.z) * 1.4) > PICKUP_RANGE) continue;
      if (it.kind === 'food' && p.vitals.health >= p.vitals.maxHealth) continue; // leave it for later
      this.pickups.splice(i, 1);
      if (it.def && (it.kind === 'cash' || it.kind === 'secret')) {
        if (!this.progress.claim(`pickup:${this.level.id}:${it.def.id}`)) continue;
        this.progress.set(this.pickupKey(it.def));
      }
      if (it.kind === 'cash' || it.kind === 'drop') {
        this.progress.addCash(it.amount);
        this.events.emit('pickup', { kind: it.kind, label: `£${it.amount}`, amount: it.amount });
      } else if (it.kind === 'food') {
        p.vitals.heal(it.amount);
        this.events.emit('pickup', { kind: 'food', label: it.label, amount: it.amount });
      } else if (it.kind === 'secret') {
        this.progress.save.stats.secrets++;
        const r = it.def?.reward ?? {};
        const parts: string[] = [];
        if (r.cash) {
          this.progress.addCash(r.cash);
          parts.push(`£${r.cash}`);
        }
        if (r.gear && this.progress.addGear(r.gear)) parts.push(GEAR[r.gear].name);
        if (r.cosmetic && this.progress.addCosmetic(r.cosmetic)) parts.push(COSMETIC_LABELS[r.cosmetic] ?? r.cosmetic);
        this.events.emit('secret', { label: `${it.label}${parts.length ? `: ${parts.join(', ')}` : ''}` });
      }
    }
  }

  private enemyInGrabRange(): boolean {
    const p = this.player;
    return this.enemies.some((e) => !e.isKO && Math.abs(e.pos.x - p.pos.x) < 0.95 && Math.abs(e.pos.z - p.pos.z) < 0.5 && !(this.brains.get(e) instanceof DummyBrain));
  }

  private findInteractable(): Interactable | null {
    const p = this.player;
    const options: Interactable[] = [];
    for (const ex of this.level.exits) {
      if (ex.kind !== 'door') continue;
      options.push({ kind: 'exit', x: ex.x, z: ex.z, label: ex.label, exit: ex, locked: !!ex.requires && !this.progress.has(ex.requires) });
    }
    for (const l of this.level.levers ?? []) options.push({ kind: 'lever', x: l.x, z: l.z, label: l.label, lever: l, done: this.progress.has(l.sets) });
    for (const s of this.level.stations ?? []) if (s.id !== 'sparring') options.push({ kind: 'station', x: s.x, z: s.z, label: s.label, station: s });
    for (const it of this.items) options.push({ kind: 'weapon', x: it.x, z: it.z, label: `Pick up ${it.weapon.name.toLowerCase()}`, item: it });
    let best: Interactable | null = null;
    let bestD = Infinity;
    for (const o of options) {
      const d = Math.hypot(o.x - p.pos.x, (o.z - p.pos.z) * 1.2);
      if (d > INTERACT_RANGE || d >= bestD) continue;
      // No using things through walls.
      if (this.arena.lineBlocked(p.pos.x, p.pos.z, o.x, o.z)) continue;
      best = o;
      bestD = d;
    }
    return best;
  }

  private interact(it: Interactable): void {
    const p = this.player;
    switch (it.kind) {
      case 'exit':
        if (it.locked) {
          this.events.emit('area:locked', { text: it.exit.lockedText ?? 'Locked' });
          return;
        }
        if (this.locked) {
          this.events.emit('area:locked', { text: 'Not while there’s a fight on' });
          return;
        }
        this.requestExit(it.exit);
        return;
      case 'lever':
        if (it.done) return;
        this.progress.set(it.lever.sets);
        for (const g of this.level.gates ?? []) if (g.openFlag === it.lever.sets) this.openGate(g);
        this.events.emit('unlock', { text: it.lever.doneText });
        return;
      case 'station':
        this.events.emit('station', { id: it.station.id });
        return;
      case 'weapon': {
        const idx = this.items.indexOf(it.item);
        if (idx < 0) return;
        this.items.splice(idx, 1);
        if (p.weapon) {
          // Swap: put down what you're holding.
          this.items.push({ key: `w_${this.itemSeq++}`, weapon: p.weapon.data, x: p.pos.x, z: p.pos.z });
          p.weapon = null;
        }
        p.equipWeapon(it.item.weapon.id);
        if (this.progress.addWeapon(it.item.weapon.id)) this.events.emit('unlock', { text: `${it.item.weapon.name} added to your garage` });
        this.events.emit('pickup', { kind: 'weapon', label: it.item.weapon.name, amount: 0 });
        return;
      }
    }
  }

  private openGate(g: GateDef): void {
    const o = this.gateObstacles.get(g.id);
    if (o) o.solid = false;
    this.events.emit('gate:opened', { label: g.label });
  }

  isGateOpen(g: GateDef): boolean {
    return this.gateObstacles.get(g.id)?.solid === false;
  }

  // ---- exits ----------------------------------------------------------------------

  private checkEdgeExits(cmd: CommandFrame): void {
    const p = this.player;
    if (!p.isFree || this.exitRequested) return;
    const b = this.arena.bounds;
    let pushing: 'left' | 'right' | null = null;
    if (p.pos.x <= b.minX + 0.05 && cmd.moveX < -0.5) pushing = 'left';
    else if (p.pos.x >= b.maxX - 0.05 && cmd.moveX > 0.5) pushing = 'right';
    if (!pushing) {
      this.edgePush = 0;
      return;
    }
    const ex = this.level.exits.find((e) => e.kind === 'edge' && e.side === pushing);
    if (!ex) return;
    this.edgePush++;
    if (this.edgePush < 12) return;
    if (ex.requires && !this.progress.has(ex.requires)) {
      if (this.sim.frame - this.lockedMsgAt > 2 * SIM_HZ) {
        this.lockedMsgAt = this.sim.frame;
        this.events.emit('area:locked', { text: ex.lockedText ?? 'Can’t go that way yet' });
      }
      return;
    }
    this.requestExit(ex);
  }

  private requestExit(ex: ExitDef): void {
    if (this.exitRequested) return;
    this.exitRequested = true;
    this.events.emit('area:exit', { to: ex.to, entry: ex.toEntry });
  }

  /** Health, stamina and weapon to take into the next area. */
  carry(): { health: number; stamina: number; weapon: WeaponId | null } {
    return { health: this.player.vitals.health, stamina: this.player.vitals.stamina, weapon: this.player.weapon?.data.id ?? null };
  }
}

function defaultLabel(p: PickupDef): string {
  if (p.kind === 'cash') return `£${p.amount ?? 0}`;
  if (p.kind === 'food') return 'Food';
  if (p.kind === 'secret') return 'Secret';
  return 'Weapon';
}
