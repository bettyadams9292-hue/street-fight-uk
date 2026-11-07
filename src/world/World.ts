import { BODY_RADIUS } from '../core/constants';
import { ARCHETYPES, archetypeAppearance, type Archetype, type ArchetypeId } from '../ai/archetypes';
import { AttackTokens } from '../ai/AttackTokens';
import { BOSSES, type BossDef, type BossPhase } from '../ai/bosses';
import { DummyBrain } from '../ai/DummyBrain';
import { FighterAI } from '../ai/FighterAI';
import { randomAppearance, sparringPartnerAppearance, type CharacterAppearance, type TopStyle } from '../character/Appearance';
import { hitSphereOf, resolveHit } from '../combat/CombatSystem';
import { move, startMove } from '../combat/MoveData';
import type { WeaponData, WeaponId } from '../combat/Weapons';
import { SIM_HZ } from '../core/constants';
import { EventBus } from '../core/EventBus';
import { Rng } from '../core/Rng';
import { Simulation } from '../core/Simulation';
import { getStyle } from '../data/styles';
import { Fighter } from '../fighter/Fighter';
import type { CommandFrame } from '../input/Commands';
import type { ItemStack } from '../items/Inventory';
import { ITEMS, weaponItemId } from '../items/items';
import { lootTableFor, rollLoot } from '../items/loot';
import type { AreaId, Progress } from '../progress/Progress';
import { defaultAttributes } from '../stats/Stats';
import { Arena, type Obstacle } from './Arena';
import {
  propBox,
  type BreakableDef,
  type ContainerDef,
  type EncounterDef,
  type ExitDef,
  type GateDef,
  type LeverDef,
  type LevelDef,
  type PickupDef,
  type StationDef,
} from './LevelTypes';

export const PLAYER_ID = 1;
const INTERACT_RANGE = 1.35;
const CASH_RANGE = 0.75;
const ENEMY_CLEAR_FRAMES = 150;
const DEFEAT_DELAY = 150;
const SEARCH_FRAMES = 30;
/** Containers with random loot refill every this many trips. */
export const CONTAINER_REFILL_TRIPS = 6;
/** Max things lying about in one area; the oldest junk is cleared first. */
const MAX_GROUND_ITEMS = 40;

export interface WorldEvents {
  'area:exit': { to: AreaId; entry: string };
  'area:locked': { text: string };
  'encounter:start': { id: string; boss: BossDef | null };
  'encounter:wave': { id: string; wave: number; of: number };
  'encounter:cleared': { id: string; cash: number; xp: number; optional: boolean };
  'boss:phase': { boss: BossDef; phase: BossPhase };
  'boss:defeated': { boss: BossDef; first: boolean; cash: number; xp: number; items: string[] };
  cash: { amount: number };
  'item:picked': { name: string; qty: number; rarity: string; stolen: boolean };
  'item:full': { name: string };
  'item:held': { name: string };
  searched: { label: string; found: string[] };
  broken: { label: string };
  secret: { label: string };
  unlock: { text: string };
  'level:up': { level: number };
  'gate:opened': { label: string };
  station: { id: StationDef['id']; station: StationDef };
  'police:arrive': { count: number };
  'alarm': { shop: string };
  'player:defeated': { byPolice: boolean };
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

/** Anything lying on the ground: a weapon, food, a phone, a watch... */
export interface GroundItem {
  key: string;
  stack: ItemStack;
  x: number;
  z: number;
  /** Level pickup id (one-time pickups are remembered). */
  pickupId?: string;
  once?: boolean;
  /** Lands with a little bounce. */
  bornAt: number;
}

export interface CashPickup {
  key: string;
  x: number;
  z: number;
  amount: number;
  /** Level pickup id, for one-time cash. */
  def: PickupDef | null;
}

export interface SecretSpot {
  key: string;
  def: PickupDef;
  x: number;
  z: number;
}

export interface Projectile {
  key: string;
  weapon: WeaponData;
  hits: number;
  thrower: Fighter;
  x: number;
  y: number;
  z: number;
  vx: number;
  spin: number;
  life: number;
  stolen?: boolean;
}

interface BreakableState {
  def: BreakableDef;
  hp: number;
  broken: boolean;
  obstacle: Obstacle;
  lastHitBy: number;
}

export type Interactable =
  | { kind: 'exit'; x: number; z: number; label: string; exit: ExitDef; locked: boolean }
  | { kind: 'lever'; x: number; z: number; label: string; lever: LeverDef; done: boolean }
  | { kind: 'station'; x: number; z: number; label: string; station: StationDef; closed: boolean }
  | { kind: 'item'; x: number; z: number; label: string; item: GroundItem }
  | { kind: 'container'; x: number; z: number; label: string; container: ContainerDef; empty: boolean };

/**
 * One area of the world running live: the level's collision, the player,
 * encounters and bosses, loot, containers, breakables, weapons on the
 * ground, gates, levers, exits, shopkeepers and hub stations. Every change
 * to progress goes through Progress, so rewards are paid once, items are
 * never duplicated and everything survives saving.
 */
export class World {
  readonly sim: Simulation;
  readonly arena: Arena;
  readonly player: Fighter;
  readonly events = new EventBus<WorldEvents>();
  readonly tokens = new AttackTokens(2);
  readonly encounters: EncounterState[] = [];
  readonly items: GroundItem[] = [];
  readonly cash: CashPickup[] = [];
  readonly secrets: SecretSpot[] = [];
  readonly projectiles: Projectile[] = [];
  readonly breakables: BreakableState[] = [];
  /** Shopkeepers and other people standing at stations, by station id. */
  readonly npcs = new Map<StationDef, Fighter>();
  enemies: Fighter[] = [];
  /** What the player can interact with right now (for the prompt). */
  interactable: Interactable | null = null;
  /** Frames left of searching a container (the player stands still). */
  searching = 0;
  private searchTarget: ContainerDef | null = null;
  private brains = new Map<Fighter, FighterAI | DummyBrain>();
  private archetypeOf = new Map<Fighter, string>();
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
  private lootRng: Rng;
  /** Police arriving after an alarm: frame they turn up, how many. */
  private policeDue: { at: number; count: number } | null = null;
  private policeSpawned = false;
  readonly police: Fighter[] = [];

  constructor(
    readonly level: LevelDef,
    readonly progress: Progress,
    opts: { entry: string; touch?: boolean; carry?: { health: number; stamina: number } | null; seed?: number; difficulty?: 'easy' | 'normal' | 'hard' },
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
    for (const b of level.breakables ?? []) {
      const broken = progress.has(this.brokenKey(b));
      const o: Obstacle = { id: `brk_${b.id}`, minX: b.x - 0.4, maxX: b.x + 0.4, minZ: b.z - 0.35, maxZ: b.z + 0.35, solid: !broken };
      obstacles.push(o);
      this.breakables.push({ def: b, hp: b.hp, broken, obstacle: o, lastHitBy: -1 });
    }
    this.arena = new Arena({ ...level.bounds }, level.name, obstacles);
    const seed = opts.seed ?? (Date.now() & 0xffff);
    this.sim = new Simulation(this.arena, seed);
    this.lootRng = new Rng(seed * 31 + 7);

    const entry = level.entries.find((e) => e.id === opts.entry) ?? level.entries[0];
    const cfg = progress.fighterConfig(PLAYER_ID, entry.x, entry.z, !!opts.touch);
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
      const oneTime = p.kind === 'cash' || p.kind === 'secret' || p.once;
      if (oneTime && progress.has(this.pickupKey(p))) continue;
      // Everyday finds (chips, a bottle) come back, but only every few trips, so re-entering can't farm them.
      if (!oneTime && progress.has(this.restockKey(p))) continue;
      if (p.kind === 'cash') this.cash.push({ key: p.id, x: p.x, z: p.z, amount: p.amount ?? 0, def: p });
      else if (p.kind === 'secret') this.secrets.push({ key: p.id, def: p, x: p.x, z: p.z });
      else if (p.item && ITEMS[p.item]) {
        // A placeholder stack: it gets a real uid when it's picked up.
        this.items.push({ key: `lvl_${p.id}`, stack: { uid: '', id: p.item, qty: p.qty ?? 1 }, x: p.x, z: p.z, pickupId: p.id, once: p.once, bornAt: -999 });
      }
    }
    for (const s of level.stations ?? []) {
      if (s.id === 'sparring') this.spawnSparringPartner(s);
      if (s.npc) this.spawnNpc(s);
    }

    this.sim.bus.on('fighter:ko', ({ fighter }) => {
      if (fighter === this.player) return;
      this.koAt.set(fighter, this.sim.frame);
      this.tokens.release(fighter);
      if (fighter.team === 'enemy' && this.brains.get(fighter) instanceof FighterAI) progress.save.stats.kos++;
    });

    // Heat: if you're wanted, the police might be waiting for you on the street.
    const street = !['home', 'shop', 'pawn', 'pub'].includes(level.theme);
    if (street && progress.save.heat >= 40 && this.lootRng.next() < progress.save.heat / 120) {
      this.policeDue = { at: SIM_HZ * 6, count: progress.save.heat >= 75 ? 3 : 2 };
    }
  }

  private clearedKey(def: EncounterDef): string {
    return `cleared:${this.level.id}:${def.id}`;
  }

  private pickupKey(p: PickupDef): string {
    return `pickup:${this.level.id}:${p.id}`;
  }

  private brokenKey(b: BreakableDef): string {
    return `broken:${this.level.id}:${b.id}:${Math.floor(this.progress.save.trips / CONTAINER_REFILL_TRIPS)}`;
  }

  containerKey(c: ContainerDef): string {
    // Fixed finds are once ever; random loot refills every few trips.
    return c.fixed ? `searched:${this.level.id}:${c.id}` : `searched:${this.level.id}:${c.id}:${Math.floor(this.progress.save.trips / CONTAINER_REFILL_TRIPS)}`;
  }

  isSearched(c: ContainerDef): boolean {
    return this.progress.has(this.containerKey(c));
  }

  isBroken(id: string): boolean {
    return this.breakables.find((b) => b.def.id === id)?.broken ?? false;
  }

  /** The enemy to show in the top-right bar: whoever you're squaring up to, if they're close. */
  get focusEnemy(): Fighter | null {
    const p = this.player;
    const near = (f: Fighter) => !f.isKO && f.team === 'enemy' && Math.abs(f.pos.x - p.pos.x) < 6;
    const t = p.target;
    if (t && near(t)) return t;
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

  /** Police on the scene and still standing. */
  get policeActive(): boolean {
    return this.police.some((f) => !f.isKO);
  }

  /** What the HUD should say you're doing. */
  get objective(): string {
    if (this.policeActive) return 'Police! Leave the area or fight your way out';
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

    // Searching a container: stand still until it's done.
    if (this.searching > 0) {
      cmd = { ...cmd, moveX: 0, moveZ: 0, block: false, pressed: { ...cmd.pressed, lp: false, hp: false, lk: false, hk: false, grab: false, jump: false, dodge: false } };
      if (p.isKO || p.state === 'hitstun' || p.state === 'knockdown') this.searching = 0;
      else if (--this.searching === 0 && this.searchTarget) this.finishSearch(this.searchTarget);
    }

    // Interact: the grab button (or E) uses whatever's in front of you, unless an enemy is in grabbing range.
    this.interactable = p.isKO || this.enemyInGrabRange() || this.searching > 0 ? null : this.findInteractable();
    if (cmd.pressed.grab && this.interactable && p.isFree) {
      cmd = { ...cmd, pressed: { ...cmd.pressed, grab: false } };
      this.interact(this.interactable);
    }

    const commands = new Map<number, CommandFrame>();
    commands.set(PLAYER_ID, cmd);
    for (const [f, brain] of this.brains) commands.set(f.id, brain.think(frame));
    this.sim.step(commands);

    this.syncHeld();
    this.collectDroppedWeapons();
    this.launchThrown();
    this.updateProjectiles();
    this.checkBreakables();
    this.collectCash();
    this.checkSecrets();
    this.updateEncounters();
    this.updatePolice();
    this.cleanUpKOs();
    this.checkEdgeExits(cmd);

    if (p.isKO && !this.defeated) {
      if (this.defeatAt < 0) this.defeatAt = this.sim.frame;
      if (this.sim.frame - this.defeatAt >= DEFEAT_DELAY) {
        this.defeated = true;
        this.events.emit('player:defeated', { byPolice: this.policeActive });
      }
    }
  }

  // ---- the weapon in your hands ------------------------------------------------------

  /** Keep the save's held weapon in step with what the fighter is actually holding. */
  private syncHeld(): void {
    const s = this.progress.save;
    const w = this.player.weapon;
    if (!w) {
      s.held = null;
      return;
    }
    const id = weaponItemId(w.data.id);
    if (!s.held || s.held.id !== id) {
      // Picked up, or broke into something else (bottle -> broken bottle).
      const stolen = s.held?.stolen;
      s.held = this.progress.newStack(id, 1, { hits: w.hits, stolen });
    } else s.held.hits = w.hits;
  }

  private collectDroppedWeapons(): void {
    for (const f of this.sim.fighters) {
      if (!f.droppedWeapon) continue;
      const w = f.droppedWeapon;
      f.droppedWeapon = null;
      if (w.data.breaks && w.hits <= 1 && f !== this.player) continue; // nearly done anyway
      this.dropOnGround(this.progress.newStack(weaponItemId(w.data.id), 1, { hits: w.hits }), f.pos.x - f.facing * 0.4, f.pos.z);
    }
  }

  // ---- thrown weapons -----------------------------------------------------------------

  private launchThrown(): void {
    for (const f of this.sim.fighters) {
      if (!f.thrownWeapon) continue;
      const t = f.thrownWeapon;
      f.thrownWeapon = null;
      this.projectiles.push({ key: `p${this.itemSeq++}`, weapon: t.data, hits: t.hits, thrower: f, x: f.pos.x + f.facing * 0.4, y: 1.3, z: f.pos.z, vx: f.facing * 13, spin: 0, life: 50 });
    }
  }

  private updateProjectiles(): void {
    const dt = 1 / SIM_HZ;
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      pr.x += pr.vx * dt;
      pr.y = Math.max(0.15, pr.y - dt * 0.6);
      pr.spin += dt * 18;
      pr.life--;
      let hit: Fighter | null = null;
      for (const f of this.sim.fighters) {
        if (f === pr.thrower || f.team === pr.thrower.team || f.team === 'neutral' || f.isKO || f.isInvulnerable) continue;
        if (Math.abs(f.pos.x - pr.x) < 0.45 && Math.abs(f.pos.z - pr.z) < 0.55) {
          hit = f;
          break;
        }
      }
      const wallHit = this.arena.blocked(pr.x, pr.z, 0.1) || pr.x < this.arena.bounds.minX || pr.x > this.arena.bounds.maxX;
      if (hit) {
        const data = move({
          id: `${pr.weapon.id}_thrown`, name: `Thrown ${pr.weapon.name.toLowerCase()}`, style: 'weapon', button: 'hp', kind: 'heavy', anim: 'overhand',
          startup: 1, active: 1, recovery: 1, damage: pr.weapon.throwDamage, reaction: pr.weapon.weight >= 2 ? 'knockdown' : 'stagger',
          knockback: 3 + pr.weapon.weight * 0.4, poiseDamage: 40, hitstop: 8, hitstun: 26,
        });
        resolveHit(pr.thrower, hit, startMove(data, 1), this.sim.frame, this.sim.bus, this.sim.rng, { x: pr.x, y: pr.y, z: pr.z, r: 0.3 });
      }
      if (hit || wallHit || pr.life <= 0) {
        this.projectiles.splice(i, 1);
        // Fragile things smash; sturdy ones land and can be picked up again.
        const left = pr.hits - 1;
        if (!pr.weapon.breaks || left > 0) {
          const x = hit ? hit.pos.x - Math.sign(pr.vx) * 0.5 : Math.max(this.arena.bounds.minX + 0.3, Math.min(this.arena.bounds.maxX - 0.3, pr.x - Math.sign(pr.vx) * 0.3));
          if (pr.weapon.breaksInto && hit) continue;
          this.dropOnGround(this.progress.newStack(weaponItemId(pr.weapon.id), 1, { hits: Math.max(1, left), stolen: pr.stolen }), x, pr.z);
        }
      }
    }
  }

  // ---- breakables ---------------------------------------------------------------------

  private checkBreakables(): void {
    const p = this.player;
    const m = p.move;
    if (!m || m.frame < m.startup || m.frame >= m.startup + m.active) return;
    const sphere = hitSphereOf(p, m);
    for (const b of this.breakables) {
      if (b.broken || b.lastHitBy === this.sim.frame - m.frame) continue;
      const o = b.obstacle;
      const cx = Math.max(o.minX, Math.min(o.maxX, sphere.x));
      const cz = Math.max(o.minZ, Math.min(o.maxZ, sphere.z));
      if (Math.hypot(cx - sphere.x, cz - sphere.z) > sphere.r + 0.25 || sphere.y > 1.8) continue;
      // One hit per swing.
      b.lastHitBy = this.sim.frame - m.frame;
      b.hp -= m.data.kind === 'heavy' || m.data.kind === 'special' ? 2 : 1;
      if (b.hp > 0) continue;
      b.broken = true;
      o.solid = false;
      this.progress.set(this.brokenKey(b.def));
      const label = BREAK_LABELS[b.def.kind];
      if (b.def.drops) this.dropOnGround(this.progress.newStack(weaponItemId(b.def.drops)), b.def.x, b.def.z + 0.3);
      if (b.def.loot) this.spillLoot(b.def.loot, b.def.x, b.def.z + 0.3);
      this.events.emit('broken', { label });
    }
  }

  // ---- loot ---------------------------------------------------------------------------

  /** Leave something on the ground (drops, overflow, things you put down). */
  dropOnGround(stack: ItemStack, x: number, z: number): GroundItem {
    const b = this.arena.bounds;
    const pos = { x: Math.max(b.minX + 0.3, Math.min(b.maxX - 0.3, x)), z: Math.max(b.minZ + 0.1, Math.min(b.maxZ - 0.1, z)) };
    // Never inside furniture: push out of anything solid.
    this.arena.clamp(pos, 0.15);
    const g: GroundItem = { key: `g${this.itemSeq++}`, stack, x: pos.x, z: pos.z, bornAt: this.sim.frame };
    this.items.push(g);
    // Keep the area tidy: clear the cheapest old junk, never valuables or quest items.
    if (this.items.length > MAX_GROUND_ITEMS) {
      const junk = this.items.findIndex((it) => it !== g && ITEMS[it.stack.id].value <= 2 && !ITEMS[it.stack.id].questFlag && !it.pickupId);
      if (junk >= 0) this.items.splice(junk, 1);
    }
    return g;
  }

  private spillLoot(tableId: string, x: number, z: number): string[] {
    const roll = rollLoot(tableId, () => this.lootRng.next());
    const names: string[] = [];
    if (roll.cash > 0) {
      this.cash.push({ key: `c${this.itemSeq++}`, x, z, amount: roll.cash, def: null });
      names.push(`£${roll.cash}`);
    }
    roll.items.forEach((it, i) => {
      this.dropOnGround(this.progress.newStack(it.id, it.qty), x + (i - roll.items.length / 2) * 0.35, z + 0.15 * (i % 2));
      names.push(ITEMS[it.id].name);
    });
    return names;
  }

  private collectCash(): void {
    const p = this.player;
    if (p.isKO) return;
    for (let i = this.cash.length - 1; i >= 0; i--) {
      const c = this.cash[i];
      if (Math.hypot(c.x - p.pos.x, (c.z - p.pos.z) * 1.4) > CASH_RANGE) continue;
      this.cash.splice(i, 1);
      if (c.def) {
        if (!this.progress.claim(this.pickupKey(c.def))) continue;
        this.progress.set(this.pickupKey(c.def));
      }
      this.progress.addCash(c.amount);
      this.events.emit('cash', { amount: c.amount });
    }
  }

  private checkSecrets(): void {
    const p = this.player;
    if (p.isKO) return;
    for (let i = this.secrets.length - 1; i >= 0; i--) {
      const s = this.secrets[i];
      if (Math.hypot(s.x - p.pos.x, (s.z - p.pos.z) * 1.4) > CASH_RANGE) continue;
      this.secrets.splice(i, 1);
      if (!this.progress.claim(this.pickupKey(s.def))) continue;
      this.progress.set(this.pickupKey(s.def));
      this.progress.save.stats.secrets++;
      const r = s.def.reward ?? {};
      const parts: string[] = [];
      if (r.cash) {
        this.progress.addCash(r.cash);
        parts.push(`£${r.cash}`);
      }
      for (const id of r.items ?? []) {
        if (!ITEMS[id]) continue;
        const left = this.progress.giveItem(id);
        if (left) this.dropOnGround(left, s.x, s.z + 0.3);
        parts.push(ITEMS[id].name + (left ? ' (on the floor: pockets full)' : ''));
      }
      this.events.emit('secret', { label: `${s.def.label ?? 'Secret stash'}${parts.length ? `: ${parts.join(', ')}` : ''}` });
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
  private spawnX(e: EncounterState | null, i: number): number {
    const lo = e?.def.lock ? e.def.lock[0] + 0.8 : this.player.pos.x - 7;
    const hi = e?.def.lock ? e.def.lock[1] - 0.8 : this.player.pos.x + 7;
    const right = i % 2 === 0;
    const base = right ? hi : lo;
    let x = Math.max(this.arena.bounds.minX + 0.5, Math.min(this.arena.bounds.maxX - 0.5, base + (right ? -1 : 1) * Math.floor(i / 2) * 0.9));
    // Never spawn on top of the player.
    if (Math.abs(x - this.player.pos.x) < 2.5) x = this.player.pos.x + (right ? 3 : -3);
    return Math.max(this.arena.bounds.minX + 0.5, Math.min(this.arena.bounds.maxX - 0.5, x));
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
      const items: string[] = [];
      if (first) {
        this.progress.set(e.bossDef.flag);
        this.progress.save.stats.bosses++;
        cash += e.bossDef.reward.cash;
        xp += e.bossDef.reward.xp;
        // Unique drops: straight into your pockets, or at your feet if they're full.
        for (const id of e.bossDef.drops ?? []) {
          if (!ITEMS[id]) continue;
          const left = this.progress.giveItem(id);
          if (left) this.dropOnGround(left, e.boss!.pos.x, e.boss!.pos.z);
          items.push(ITEMS[id].name);
        }
      }
      this.pay(cash, xp);
      this.events.emit('boss:defeated', { boss: e.bossDef, first, cash, xp, items });
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
      weapon: def.weapon ?? null,
    });
    f.stats.addModifier({ id: 'boss_health', source: 'boss', flat: 'maxHealth', add: def.bonusHealth });
    f.vitals.reset();
    f.poise = f.stats.maxPoise;
    f.facing = -1;
    this.sim.add(f);
    this.enemies.push(f);
    const brain: Archetype = { ...def.brain, id: 'boss', name: def.name, description: def.title, look: () => ({}), boss: false };
    this.brains.set(f, new FighterAI(f, brain, this.sim.rng, this.tokens, this.arena));
    this.archetypeOf.set(f, 'boss');
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
      if (phase.weapon) boss.equipWeapon(phase.weapon);
      phase.summon?.forEach((s, i) => e.enemies.push(this.spawnEnemy(s.archetype, this.spawnX(e, i + 1), this.spawnZ(i + 1), s.weapon)));
      // A short dramatic pause: everyone freezes and the player is pushed back.
      const dir = Math.sign(this.player.pos.x - boss.pos.x) || 1;
      if (!this.player.grapple) this.player.knockVel = dir * 3;
      boss.hitstop = 24;
      this.events.emit('boss:phase', { boss: def, phase });
    }
  }

  /** Nearest spot to (x, z) where a body fits: nobody spawns inside a pub chair. */
  freeSpot(x: number, z: number): { x: number; z: number } {
    const b = this.arena.bounds;
    const ok = (px: number, pz: number) => px >= b.minX && px <= b.maxX && pz >= b.minZ && pz <= b.maxZ && !this.arena.blocked(px, pz, BODY_RADIUS);
    if (ok(x, z)) return { x, z };
    for (let r = 0.2; r <= 4; r += 0.2) {
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2;
        const px = x + Math.cos(a) * r;
        const pz = z + Math.sin(a) * r * 0.6;
        if (ok(px, pz)) return { x: px, z: pz };
      }
    }
    return { x, z };
  }

  spawnEnemy(id: ArchetypeId, x: number, z: number, weapon?: WeaponId): Fighter {
    ({ x, z } = this.freeSpot(x, z));
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
    this.archetypeOf.set(f, id);
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

  /** Shopkeepers and bar staff: they stand at their station and can't be hit unless things turn nasty. */
  private spawnNpc(s: StationDef): void {
    const n = s.npc!;
    const rng = new Rng(n.seed);
    const look: CharacterAppearance = { ...randomAppearance(() => rng.next(), n.body ?? 'male'), accessories: [] };
    if (n.top) look.top = n.top as TopStyle;
    if (n.topColour) look.topColour = n.topColour;
    const f = new Fighter({
      id: this.nextId++,
      name: n.name,
      team: 'neutral',
      attributes: defaultAttributes(7),
      style: getStyle('street'),
      x: s.x,
      z: s.z + (n.dz ?? -0.9),
      appearance: look,
    });
    f.facing = 1;
    this.sim.add(f);
    const brain = new DummyBrain(f, this.sim.rng);
    brain.mode = 'stand';
    this.brains.set(f, brain);
    this.npcs.set(s, f);
  }

  /** A shopkeeper who's had enough: they fight back. */
  turnHostile(f: Fighter, archetype: ArchetypeId = 'defender'): void {
    f.team = 'enemy';
    const a = ARCHETYPES[archetype];
    this.brains.set(f, new FighterAI(f, { ...a }, this.sim.rng, this.tokens, this.arena));
    this.archetypeOf.set(f, 'shopkeeper');
    this.enemies.push(f);
  }

  /** The alarm's gone off: police turn up after a delay. */
  raiseAlarm(shop: string, delayFrames: number, count: number): void {
    this.policeDue = { at: this.sim.frame + delayFrames, count };
    this.policeSpawned = false;
    this.events.emit('alarm', { shop });
  }

  private updatePolice(): void {
    if (!this.policeDue || this.policeSpawned || this.sim.frame < this.policeDue.at) return;
    this.policeSpawned = true;
    const n = this.policeDue.count;
    for (let i = 0; i < n; i++) {
      const f = this.spawnEnemy('police', this.spawnX(null, i), this.spawnZ(i));
      this.police.push(f);
    }
    this.events.emit('police:arrive', { count: n });
  }

  /** Remove beaten enemies after a moment, dropping loot. The sparring partner just gets up again. */
  private cleanUpKOs(): void {
    for (const [f, at] of this.koAt) {
      if (this.sim.frame - at < ENEMY_CLEAR_FRAMES) continue;
      this.koAt.delete(f);
      const brain = this.brains.get(f);
      if (brain instanceof DummyBrain && f.team !== 'neutral') {
        f.respawn();
        continue;
      }
      if (this.encounters.some((e) => e.boss === f)) continue;
      const arch = brain instanceof FighterAI ? brain.archetype : null;
      const kind = this.archetypeOf.get(f) ?? 'thug';
      if (kind !== 'shopkeeper') this.spillLoot(lootTableFor(kind), f.pos.x, f.pos.z);
      if (arch?.xp) this.pay(0, arch.xp);
      this.sim.remove(f);
      this.brains.delete(f);
      this.tokens.release(f);
      this.enemies = this.enemies.filter((e) => e !== f);
    }
  }

  // ---- interaction ------------------------------------------------------------------

  private enemyInGrabRange(): boolean {
    const p = this.player;
    return this.enemies.some((e) => !e.isKO && e.team === 'enemy' && Math.abs(e.pos.x - p.pos.x) < 0.95 && Math.abs(e.pos.z - p.pos.z) < 0.5 && !(this.brains.get(e) instanceof DummyBrain));
  }

  private findInteractable(): Interactable | null {
    const p = this.player;
    const options: Interactable[] = [];
    for (const ex of this.level.exits) {
      if (ex.kind !== 'door') continue;
      options.push({ kind: 'exit', x: ex.x, z: ex.z, label: ex.label, exit: ex, locked: exitLocked(ex, this.progress) });
    }
    for (const l of this.level.levers ?? []) options.push({ kind: 'lever', x: l.x, z: l.z, label: l.label, lever: l, done: this.progress.has(l.sets) });
    for (const s of this.level.stations ?? []) {
      if (s.id === 'sparring') continue;
      const npc = this.npcs.get(s);
      if (npc && (npc.team !== 'neutral' || npc.isKO)) continue;
      options.push({ kind: 'station', x: s.x, z: s.z, label: s.label, station: s, closed: !!s.shop && !this.progress.isShopOpen(s.shop) });
    }
    for (const it of this.items) {
      const d = ITEMS[it.stack.id];
      options.push({ kind: 'item', x: it.x, z: it.z, label: `Pick up ${d.name.toLowerCase()}${it.stack.qty > 1 ? ` ×${it.stack.qty}` : ''}`, item: it });
    }
    for (const c of this.level.containers ?? []) options.push({ kind: 'container', x: c.x, z: c.z, label: c.label, container: c, empty: this.isSearched(c) });
    let best: Interactable | null = null;
    let bestD = Infinity;
    for (const o of options) {
      // Things on the floor need you to be closer than things on walls.
      const range = o.kind === 'item' ? 0.95 : INTERACT_RANGE;
      let d = Math.hypot(o.x - p.pos.x, (o.z - p.pos.z) * 1.2);
      if (o.kind === 'container' && o.empty) d += 0.4; // prefer something useful
      if (d > range || d >= bestD) continue;
      // No using things through walls.
      if (this.arena.lineBlocked(p.pos.x, p.pos.z, o.x, o.z)) continue;
      best = o;
      bestD = d;
    }
    return best;
  }

  private interact(it: Interactable): void {
    switch (it.kind) {
      case 'exit':
        if (it.locked) {
          const shut = it.exit.shop && !this.progress.isShopOpen(it.exit.shop);
          this.events.emit('area:locked', { text: shut ? `Shutters down. Closed for ${this.progress.shop(it.exit.shop!).closedUntil - this.progress.save.trips} more trips after what happened.` : (it.exit.lockedText ?? 'Locked') });
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
        if (it.closed) {
          this.events.emit('area:locked', { text: 'Shutters are down. Closed for now.' });
          return;
        }
        this.events.emit('station', { id: it.station.id, station: it.station });
        return;
      case 'item':
        this.pickUp(it.item);
        return;
      case 'container':
        if (it.container.requires && !this.progress.has(it.container.requires)) {
          this.events.emit('area:locked', { text: it.container.lockedText ?? 'Locked' });
          return;
        }
        if (it.empty) {
          this.events.emit('searched', { label: it.container.label.replace(/^Search /, ''), found: [] });
          return;
        }
        this.searching = SEARCH_FRAMES;
        this.searchTarget = it.container;
        return;
    }
  }

  /** Weapons go in your hands; everything else in your pockets. */
  pickUp(g: GroundItem): boolean {
    const idx = this.items.indexOf(g);
    if (idx < 0) return false;
    const d = ITEMS[g.stack.id];
    const p = this.player;
    // Level pickups get a real stack the moment they're taken.
    const stack = g.stack.uid ? g.stack : this.progress.newStack(g.stack.id, g.stack.qty, {});
    if (d.weapon) {
      this.items.splice(idx, 1);
      if (p.weapon) {
        // Swap: the one you were holding goes in your pockets, or on the floor if they're full.
        const old = this.progress.save.held;
        this.progress.save.held = null;
        p.weapon = null;
        if (old) {
          const left = this.progress.pocket(old);
          if (left) this.dropOnGround(left, p.pos.x, p.pos.z);
        }
      }
      p.equipWeapon(d.weapon, stack.hits);
      this.progress.save.held = stack;
      this.markPickupTaken(g);
      this.events.emit('item:held', { name: d.name });
      return true;
    }
    if (this.progress.spaceFor(stack.id, stack) < 1) {
      this.events.emit('item:full', { name: d.name });
      return false;
    }
    this.items.splice(idx, 1);
    const qty = stack.qty;
    const left = this.progress.pocket(stack);
    if (left) this.items.splice(idx, 0, { ...g, stack: left });
    this.markPickupTaken(g);
    this.events.emit('item:picked', { name: d.name, qty: qty - (left?.qty ?? 0), rarity: d.rarity, stolen: !!stack.stolen });
    if (left) this.events.emit('item:full', { name: d.name });
    return true;
  }

  private markPickupTaken(g: GroundItem): void {
    if (!g.pickupId) return;
    const def = this.level.pickups.find((p) => p.id === g.pickupId);
    if (def) this.progress.set(g.once ? this.pickupKey(def) : this.restockKey(def));
  }

  /** Key for a repeatable pickup in the current restock window. */
  restockKey(p: PickupDef): string {
    return `restock:${this.level.id}:${p.id}:${Math.floor(this.progress.save.trips / CONTAINER_REFILL_TRIPS)}`;
  }

  private finishSearch(c: ContainerDef): void {
    this.searchTarget = null;
    if (this.isSearched(c)) return;
    this.progress.set(this.containerKey(c));
    const found: string[] = [];
    const give = (id: string, qty: number) => {
      if (!ITEMS[id]) return;
      const left = this.progress.giveItem(id, qty);
      if (left) this.dropOnGround(left, c.x, c.z + 0.4);
      found.push(`${ITEMS[id].name}${qty > 1 ? ` ×${qty}` : ''}${left ? ' (dropped: pockets full)' : ''}`);
    };
    if (c.cash) {
      this.progress.addCash(c.cash);
      found.push(`£${c.cash}`);
    }
    if (c.fixed) for (const f of c.fixed) give(f.id, f.qty ?? 1);
    if (c.loot) {
      const roll = rollLoot(c.loot, () => this.lootRng.next());
      if (roll.cash) {
        this.progress.addCash(roll.cash);
        found.push(`£${roll.cash}`);
      }
      for (const it of roll.items) give(it.id, it.qty);
    }
    this.events.emit('searched', { label: c.label.replace(/^Search /, ''), found });
  }

  private openGate(g: GateDef): void {
    const o = this.gateObstacles.get(g.id);
    if (o) o.solid = false;
    this.events.emit('gate:opened', { label: g.label });
  }

  isGateOpen(g: GateDef): boolean {
    return this.gateObstacles.get(g.id)?.solid === false;
  }

  /** Use a consumable from the inventory screen, applying it to the fighter. */
  useItem(uid: string): { ok: boolean; text: string } {
    const r = this.progress.use(uid);
    if (!r.ok) return { ok: false, text: r.reason };
    const v = this.player.vitals;
    const before = v.health;
    const heal = r.heal + r.healPct * v.maxHealth;
    if (heal > 0) v.heal(heal);
    if (r.stamina > 0) v.restoreStamina(r.stamina);
    const gained = Math.round(v.health - before);
    return { ok: true, text: `${r.name}${gained > 0 ? `: +${gained} health` : ''}${r.stamina > 0 ? `${gained > 0 ? ',' : ':'} +${r.stamina} stamina` : ''}` };
  }

  /** Put something down from the inventory screen. */
  dropFromInventory(uid: string, qty = Infinity): boolean {
    const st = this.progress.drop(uid, qty);
    if (!st) return false;
    this.dropOnGround(st, this.player.pos.x + this.player.facing * 0.4, this.player.pos.z);
    return true;
  }

  /** Equip a weapon from your pockets (inventory screen). */
  holdFromInventory(uid: string): boolean {
    const r = this.progress.hold(uid);
    if (!r.ok) return false;
    const st = this.progress.save.held!;
    this.player.equipWeapon(ITEMS[st.id].weapon!, st.hits);
    return true;
  }

  /** Put the weapon in your hands away (inventory screen). */
  putAwayWeapon(): boolean {
    const r = this.progress.unhold();
    if (!r.ok) return false;
    this.player.weapon = null;
    return true;
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
    if (exitLocked(ex, this.progress)) {
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

  /** Health and stamina to take into the next area (the weapon in your hands is in the save). */
  carry(): { health: number; stamina: number } {
    return { health: this.player.vitals.health, stamina: this.player.vitals.stamina };
  }
}

/** An exit you can't use yet. */
export function exitLocked(ex: ExitDef, progress: Progress): boolean {
  if (ex.shop && !progress.isShopOpen(ex.shop)) return true;
  if (ex.requires && !progress.has(ex.requires)) return true;
  return !!ex.requiresAll && ex.requiresAll.some((f) => !progress.has(f));
}

const BREAK_LABELS: Record<BreakableDef['kind'], string> = {
  crate: 'Crate smashed',
  pallet: 'Pallet smashed',
  chair: 'Chair smashed',
  table: 'Table smashed',
  tv: 'Telly smashed',
  boxes: 'Boxes knocked over',
  window: 'Window smashed',
  barrel: 'Barrel knocked over',
};
