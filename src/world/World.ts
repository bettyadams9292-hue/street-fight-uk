import { BODY_RADIUS } from '../core/constants';
import { ARCHETYPES, archetypeAppearance, type Archetype, type ArchetypeId } from '../ai/archetypes';
import { AttackTokens } from '../ai/AttackTokens';
import { BOSSES, type BossDef, type BossPhase } from '../ai/bosses';
import { DummyBrain } from '../ai/DummyBrain';
import { FighterAI } from '../ai/FighterAI';
import { npc } from '../characters/npcs';
import { randomAppearance, sparringPartnerAppearance, type CharacterAppearance, type TopStyle } from '../character/Appearance';
import { CivilianBrain, CIVILIAN_DENSITY, DESPAWN, SPAWN_MAX, SPAWN_MIN, type Hotspot } from './civilians';
import { CompanionBrain } from '../companions/brain';
import { companionGainXp, crewState, type CompanionDef } from '../companions/companions';
import type { CrewOrder } from '../companions/brain';
import { HomeBrain, HomeLife } from '../companions/home';
import { FIGHT_STYLES, PERSONALITIES, lineFor, type LineKind } from '../companions/personality';
import { applyCrewModifiers, companionFighter } from '../companions/crewFighter';
import { HitLedger, type Injury } from '../condition/condition';
import type { WeaponMods } from '../combat/weaponMods';
import { SPAR_SPOT } from '../training/gym';
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
  /** A fight left someone hurt: `who` is 'you' or a companion id. */
  'injury': { who: string; name: string; injuries: Injury[] };
  /** A companion levelled up. */
  'companion:level': { id: string; name: string; level: number };
  'companion:up': { name: string };
  /** A crew member says something (shown over their head). */
  'crew:say': { fighter: Fighter; name: string; text: string };
  'duel:start': { kind: 'spar' | 'challenge'; name: string };
  'duel:end': { kind: 'spar' | 'challenge'; id: string; won: boolean; stopped: boolean; landed: number; blocked: number; seconds: number };
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
  private brains = new Map<Fighter, FighterAI | DummyBrain | CivilianBrain | CompanionBrain>();
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
  /** This visit's stations: the level's, plus things that come and go (a parked bike). */
  readonly stations: StationDef[];

  /** Optional fights finished on this visit (so rebuilding the area doesn't re-arm them). */
  clearedOptional(): string[] {
    return this.encounters.filter((e) => e.def.optional && e.status === 'cleared').map((e) => e.def.id);
  }

  addStation(s: StationDef): void {
    this.stations.push(s);
  }

  removeStation(id: string): void {
    for (let i = this.stations.length - 1; i >= 0; i--) if (this.stations[i].id === id) this.stations.splice(i, 1);
  }

  /** Mo, in the home gym. */
  sparPartner: Fighter | null = null;

  // ---- your crew ---------------------------------------------------------------------

  readonly crew: CrewMember[] = [];
  /** The house's side of home life (at home only). */
  homeLife: HomeLife | null = null;
  private crewRng = new Rng(4711);
  private lastSay = -999;
  /** At home: you've moved away from the front door since coming in (so heading back to it means going out). */
  private doorArmed = false;

  /** First crew member (older single-companion code and tests). */
  get companion(): Fighter | null {
    return this.crew[0]?.f ?? null;
  }
  get companionDef(): CompanionDef | null {
    return this.crew[0]?.def ?? null;
  }
  memberOf(f: Fighter): CrewMember | null {
    return this.crew.find((m) => m.f === f) ?? null;
  }

  /** Bring a crew member in: next to you, or (at home) through the door / already settled. */
  private spawnCrew(def: CompanionDef, how: 'beside' | 'door' | 'settled', index: number): void {
    const p = this.player;
    const spot = how === 'beside'
      ? this.freeSpot(p.pos.x - p.facing * (1.3 + index * 0.7), Math.max(this.arena.bounds.minZ + 0.3, p.pos.z + (index % 2 ? 0.45 : -0.4)))
      : { x: p.pos.x, z: p.pos.z };
    // Same build as the crew screen shows: look, style, level, injuries, health carried over, their weapon.
    const f = companionFighter(this.progress, def, this.nextId++, spot.x, spot.z);
    f.facing = p.facing;
    this.sim.add(f);
    const moves = FIGHT_STYLES[def.fightStyle];
    const a = { ...ARCHETYPES.boxer, ...def.ai, ...moves.ai, id: 'boxer' as const, name: def.nickname, style: moves.moves, attributes: def.attributes, retreatsWhenTired: true, look: () => ({}), buttonBias: { heavy: moves.heavyBias, kick: moves.kickBias } };
    const fight = new FighterAI(f, a, this.sim.rng, this.tokens, this.arena);
    const rng = () => this.crewRng.next();
    const brain = new CompanionBrain(f, def, p, fight, this.arena, {
      ignore: () => this.duel?.f ?? this.sparPartner,
      engaged: () => !!this.activeEncounter || this.enemies.some((e) => !e.isKO && Math.abs(e.pos.x - p.pos.x) < 9) || this.police.some((e) => !e.isKO),
      enemies: () => [...this.enemies, ...this.police],
      crew: () => this.crew.map((m) => m.f),
      weaponNear: (x, z, r) => {
        const g = this.items.find((it) => ITEMS[it.stack.id]?.weapon && Math.abs(it.x - x) < r && Math.abs(it.z - z) < r * 0.6);
        return g ? { x: g.x, z: g.z } : null;
      },
      say: (kind) => this.crewSay(m, kind),
      rng,
    });
    const m: CrewMember = { f, def, brain, downAt: -1, pocket: null, weaponId: f.weapon?.data.id ?? null };
    this.brains.set(f, brain);
    this.crew.push(m);
    if (this.homeLife) {
      const hb = new HomeBrain(f, def.personality, this.homeLife, this.arena, rng, (frame) => brain.followOnly(frame));
      brain.home = hb;
      if (how === 'door') {
        // Through the front door a step behind you, then into the house.
        const door = this.level.exits.find((e) => e.kind === 'door' && e.to !== 'basement') ?? { x: p.pos.x, z: p.pos.z };
        f.pos.x = door.x + (index + 1) * 0.35 * (index % 2 ? -1 : 1);
        f.pos.z = Math.max(this.arena.bounds.minZ + 0.25, door.z + 0.3);
        m.enterAt = this.sim.frame + 25 + index * 35;
        this.sim.remove(f); // added when they come through the door
        m.waiting = true;
        hb.enter({ x: door.x, z: door.z });
      } else hb.settle();
    }
  }

  /** A line from a crew member, if they're the talkative sort and nobody's just spoken. */
  private crewSay(m: CrewMember, kind: LineKind): void {
    const frame = this.sim.frame;
    if (frame - this.lastSay < SIM_HZ * 2.5 || frame - (m.saidAt ?? -999) < SIM_HZ * 7) return;
    if (kind !== 'down' && this.crewRng.next() > PERSONALITIES[m.def.personality].chatty) return;
    const text = lineFor(m.def.personality, kind, this.crewRng.next());
    if (!text) return;
    this.lastSay = frame;
    m.saidAt = frame;
    this.events.emit('crew:say', { fighter: m.f, name: m.def.nickname, text });
  }

  /** Give orders to everyone out with you: follow, wait here, or stay close and ready. */
  orderCrew(order: CrewOrder): number {
    let n = 0;
    for (const m of this.crew) {
      if (m.brain.home) continue;
      m.brain.setOrder(order);
      n++;
    }
    return n;
  }

  /** Call the crew at home to come with you round the house (or let them go back to relaxing). */
  callHomeCrew(on: boolean, ids?: string[]): void {
    for (const m of this.crew) if (m.brain.home && (!ids || ids.includes(m.def.id))) m.brain.home.following = on;
  }

  /** Who's sat down resting at home right now (for faster recovery). */
  restingIds(): string[] {
    return this.crew.filter((m) => m.brain.home?.resting).map((m) => m.def.id);
  }

  /** Their level and injuries, as stat modifiers. */
  private applyCompanionCondition(f: Fighter, def: CompanionDef): void {
    applyCrewModifiers(f, def, this.progress);
  }

  /** Write your crew's live health and weapons back to the save (called every second and on leaving). */
  syncCompanion(): void {
    for (const m of this.crew) {
      const f = m.f;
      const st = crewState(this.progress, m.def.id);
      if (!m.waiting) st.health = Math.max(0.05, Math.min(1, f.vitals.health / Math.max(1, f.vitals.maxHealth)));
      const held = f.weapon ?? m.pocket;
      if (st.weapon) {
        if (!held) st.weapon = null; // broke in the fight
        else if (weaponItemId(held.data.id) !== st.weapon.id) st.weapon = this.progress.newStack(weaponItemId(held.data.id), 1, { hits: held.hits, mods: held.mods });
        else st.weapon.hits = held.hits;
      } else if (held) {
        // Picked one up in a fight (weapons specialists do): theirs now.
        st.weapon = this.progress.newStack(weaponItemId(held.data.id), 1, { hits: held.hits, mods: held.mods });
      }
    }
  }

  // ---- injuries: counting what you and your crew take in a fight ----

  private ledgers = new Map<Fighter, HitLedger>();
  private fightWasOn = false;

  private ledgerFor(f: Fighter): HitLedger | null {
    if (f !== this.player && !this.memberOf(f)) return null;
    if (this.duel?.kind === 'spar') return null; // Mo pulls his punches
    let l = this.ledgers.get(f);
    if (!l) this.ledgers.set(f, (l = new HitLedger()));
    return l;
  }

  /** Is a fight going on around you? */
  private get fightOn(): boolean {
    const p = this.player;
    return !!this.activeEncounter || this.locked || (!!this.duel && this.duel.kind !== 'spar') || this.police.some((e) => !e.isKO) || this.enemies.some((e) => !e.isKO && Math.abs(e.pos.x - p.pos.x) < 9);
  }

  /** The fight's over (or you went down): turn hits taken into injuries. */
  settleInjuries(): void {
    for (const [f, l] of this.ledgers) {
      if (!l.total && !l.knockedOut) continue;
      if (f === this.player) {
        const hurt = l.settle(this.progress.save.condition, f.vitals.maxHealth);
        if (hurt.length) {
          this.progress.applyModifiers(f, this.difficulty);
          this.events.emit('injury', { who: 'you', name: 'You', injuries: hurt });
        }
        continue;
      }
      const m = this.memberOf(f);
      if (!m) continue;
      const st = crewState(this.progress, m.def.id);
      const hurt = l.settle(st.condition, f.vitals.maxHealth);
      st.fights++;
      // A fight takes it out of them: rest brings it back down.
      st.fatigue = Math.min(100, st.fatigue + 12 + Math.min(18, l.total / 10));
      this.applyCompanionCondition(f, m.def);
      if (hurt.length) this.events.emit('injury', { who: m.def.id, name: m.def.nickname, injuries: hurt });
    }
    this.ledgers.clear();
  }

  private updateInjuries(): void {
    const on = this.fightOn;
    if (this.fightWasOn && !on) this.settleInjuries();
    this.fightWasOn = on;
  }

  /** Back on their feet once the fight's over; walk in from the edge if left far behind; pick weapons up. */
  private updateCompanion(): void {
    const p = this.player;
    const fightOn = !!this.activeEncounter || this.enemies.some((e) => !e.isKO && Math.abs(e.pos.x - p.pos.x) < 9);
    if (this.homeLife) this.homeLife.update(1 / SIM_HZ, this.crew.map((m) => m.brain.home!).filter(Boolean));
    for (const m of this.crew) {
      const f = m.f;
      if (m.waiting) {
        // Coming through the front door behind you.
        if (this.sim.frame >= (m.enterAt ?? 0)) {
          m.waiting = false;
          this.sim.add(f);
        }
        continue;
      }
      if (f.isKO) {
        if (m.downAt < 0) m.downAt = this.sim.frame;
        if (!fightOn && this.sim.frame - m.downAt > SIM_HZ * 3) {
          const pos = { ...f.pos };
          f.respawn();
          f.pos = { x: pos.x, y: 0, z: pos.z };
          f.vitals.health = Math.round(f.vitals.maxHealth * 0.4);
          if (m.pocket) {
            f.equipWeapon(m.pocket.data.id, m.pocket.hits, m.pocket.mods);
            m.pocket = null;
          }
          m.downAt = -1;
          this.events.emit('companion:up', { name: f.name });
        }
        continue;
      }
      m.downAt = -1;
      // Weapons specialist: picks up whatever they walk onto.
      if (m.brain.style.weaponClasses && !f.weapon && f.isFree) {
        const i = this.items.findIndex((it) => ITEMS[it.stack.id]?.weapon && Math.abs(it.x - f.pos.x) < 0.5 && Math.abs(it.z - f.pos.z) < 0.4);
        if (i >= 0) {
          const it = this.items[i];
          this.items.splice(i, 1);
          f.equipWeapon(ITEMS[it.stack.id].weapon!, it.stack.hits, it.stack.mods);
          this.crewSay(m, 'win');
        }
      }
      // What's in their hands changed: their weapon skill applies to the new one.
      const wid = f.weapon?.data.id ?? null;
      if (wid !== m.weaponId) {
        m.weaponId = wid;
        this.applyCompanionCondition(f, m.def);
      }
      if (m.brain.home) {
        // Heading for the front door: the ones following you get up and come along.
        const door = this.level.exits.find((e) => e.kind === 'door' && e.to !== 'basement');
        const following = this.progress.save.companions.following.includes(m.def.id);
        // Only once you've been away from the door (not the moment you walk in through it).
        if (door && Math.abs(p.pos.x - door.x) > 2.5) this.doorArmed = true;
        if (door && this.doorArmed && following && Math.abs(p.pos.x - door.x) < 1.4 && p.pos.z < door.z + 0.9) m.brain.home.following = true;
        continue;
      }
      // Left a long way behind (pushed back by a crowd, a long run): come in from just off-screen.
      if (!fightOn && m.brain.order !== 'wait' && (m.brain.catchUp || Math.abs(f.pos.x - p.pos.x) > 16)) {
        const spot = this.freeSpot(p.pos.x - p.facing * 10, p.pos.z);
        f.pos.x = spot.x;
        f.pos.z = spot.z;
        m.brain.catchUp = false;
      }
    }
  }

  // ---- ambient pedestrians -------------------------------------------------------------

  /** Difficulty this world was built at (for re-applying your modifiers). */
  difficulty: 'easy' | 'normal' | 'hard' = 'normal';
  readonly civilians: { f: Fighter; brain: CivilianBrain }[] = [];
  private hotspots: Hotspot[] = [];
  private civLanes: number[] = [];
  private civCap = 0;

  private setUpCivilians(): void {
    const cap = CIVILIAN_DENSITY[this.level.id as AreaId] ?? 0;
    if (!cap) return;
    this.civCap = cap;
    const b = this.arena.bounds;
    this.civLanes = [b.minZ + 0.45, b.minZ + 1.0, b.maxZ - 0.4].filter((z) => z < b.maxZ - 0.1);
    const hs: Hotspot[] = [];
    for (const ex of this.level.exits) if (ex.kind === 'door') hs.push({ kind: 'browse', x: ex.x + 1.3, z: b.minZ + 0.35, facing: -1, slots: 1, taken: 0 });
    for (const f of this.level.facades) {
      if (f.kind === 'pub' || f.kind === 'club' || f.kind === 'casino') hs.push({ kind: 'group', x: (f.x0 + f.x1) / 2 + 2, z: b.minZ + 0.7, slots: 3, taken: 0 });
    }
    for (const pr of this.level.props) if (pr.kind === 'bench') hs.push({ kind: 'sit', x: pr.x, z: pr.z + 0.15, facing: 1, slots: 1, taken: 0 });
    for (let x = b.minX + 8; x < b.maxX - 6; x += 18) hs.push({ kind: 'chat', x: x + this.lootRng.next() * 6, z: b.minZ + 0.6, slots: 2, taken: 0 });
    // Hotspots must be standable.
    this.hotspots = hs.filter((h) => !this.arena.blocked(h.x, h.z, 0.3) && h.x > b.minX + 1 && h.x < b.maxX - 1);
    // A few people already about when you arrive (just off-screen).
    for (let i = 0; i < Math.ceil(cap / 2); i++) this.spawnCivilian();
  }

  private spawnCivilian(): void {
    const NPC_POOL = 400;
    const p = this.player;
    const b = this.arena.bounds;
    const rng = this.lootRng;
    // Sometimes they're stood at a hotspot already; otherwise walking in from either side.
    const free = this.hotspots.filter((h) => h.taken < h.slots && Math.abs(h.x - p.pos.x) > SPAWN_MIN && Math.abs(h.x - p.pos.x) < SPAWN_MAX + 4);
    let x: number;
    let z: number;
    const spot = free.length && rng.next() < 0.5 ? free[Math.floor(rng.next() * free.length)] : null;
    if (spot) {
      x = spot.x;
      z = spot.z;
    } else {
      const side = rng.next() < 0.5 ? -1 : 1;
      x = p.pos.x + side * (SPAWN_MIN + rng.next() * (SPAWN_MAX - SPAWN_MIN));
      if (x < b.minX + 0.5 || x > b.maxX - 0.5) x = p.pos.x - side * (SPAWN_MIN + rng.next() * (SPAWN_MAX - SPAWN_MIN));
      if (x < b.minX + 0.5 || x > b.maxX - 0.5) return;
      z = this.civLanes[Math.floor(rng.next() * this.civLanes.length)];
    }
    if (this.arena.blocked(x, z, 0.3)) return;
    if (this.sim.fighters.some((o) => Math.abs(o.pos.x - x) < 0.8 && Math.abs(o.pos.z - z) < 0.6)) return;
    const seed = Math.floor(rng.next() * 1e6);
    const r = new Rng(seed);
    // One of the district's regulars (a stable pool of people: the same one always looks the same).
    const look: CharacterAppearance = npc(this.level.id, seed % NPC_POOL).appearance;
    const f = new Fighter({ id: this.nextId++, name: 'Passer-by', team: 'neutral', attributes: defaultAttributes(4), style: getStyle('street'), x, z, appearance: look });
    f.stats.addModifier({ id: 'stroll', source: 'civilian', stat: 'moveSpeedMult', mul: 0.42 + r.next() * 0.3 });
    this.sim.add(f);
    const brain = new CivilianBrain(f, this.arena, r, this.civLanes, 'walk', () => this.sim.fighters);
    if (spot) brain.claim(spot, spot.taken, this.sim.frame);
    else brain.dir = x < p.pos.x ? 1 : -1;
    if (this.activeEncounter) brain.react(p.pos.x, this.sim.frame);
    this.brains.set(f, brain);
    this.civilians.push({ f, brain });
  }

  private removeCivilian(i: number): void {
    const c = this.civilians[i];
    c.brain.release();
    this.sim.remove(c.f);
    this.brains.delete(c.f);
    this.civilians.splice(i, 1);
  }

  private updateCivilians(): void {
    if (!this.civCap) return;
    const p = this.player;
    const frame = this.sim.frame;
    const calm = !this.activeEncounter && !this.locked && !this.enemies.some((e) => !e.isKO);
    for (const c of this.civilians) {
      if (calm) c.brain.calm(frame);
      c.f.ambientPose = c.brain.pose;
      // Walkers passing a free hotspot sometimes stop there.
      if (c.brain.activity === 'walk' && frame % 20 === c.f.id % 20) {
        const h = this.hotspots.find((s) => s.taken < s.slots && Math.abs(s.x - c.f.pos.x) < 0.6);
        if (h && this.lootRng.next() < 0.35 && !this.sim.fighters.some((o) => o !== c.f && Math.abs(o.pos.x - h.x) < 0.5 && Math.abs(o.pos.z - h.z) < 0.4 && !this.civilians.some((q) => q.f === o && q.brain.spot === h))) c.brain.claim(h, h.taken, frame);
      }
    }
    if (frame % 30 !== 0) return;
    for (let i = this.civilians.length - 1; i >= 0; i--) {
      const f = this.civilians[i].f;
      const b = this.arena.bounds;
      const gone = Math.abs(f.pos.x - p.pos.x) > DESPAWN || f.pos.x <= b.minX + 0.3 || f.pos.x >= b.maxX - 0.3;
      if (gone) this.removeCivilian(i);
    }
    if (!this.activeEncounter && !this.locked && this.civilians.length < this.civCap) this.spawnCivilian();
  }

  // ---- sparring and challenge fights -----------------------------------------------------

  duel: { f: Fighter; kind: 'spar' | 'challenge'; id: string; landed: number; blocked: number; started: number } | null = null;

  /** Mo puts his gloves up. He hits softly and stops before anyone gets hurt. */
  startSpar(): boolean {
    const f = this.sparPartner;
    if (!f || this.duel || this.activeEncounter) return false;
    f.team = 'enemy';
    f.stats.addModifier({ id: 'spar_soft', source: 'spar', stat: 'damageMult', mul: 0.35 });
    this.brains.set(f, new FighterAI(f, { ...ARCHETYPES.casual, aggression: 0.35, blockChance: 0.45, comboLength: 2, specialChance: 0, grabChance: 0.05 }, this.sim.rng, this.tokens, this.arena));
    this.duel = { f, kind: 'spar', id: 'mo', landed: 0, blocked: 0, started: this.sim.frame };
    this.events.emit('duel:start', { kind: 'spar', name: f.name });
    return true;
  }

  /** A pub regular wants a straightener before they'll join you. */
  startChallenge(station: StationDef, def: CompanionDef): boolean {
    const f = this.npcs.get(station);
    if (!f || this.duel || this.activeEncounter) return false;
    f.team = 'enemy';
    // A proper scrap: tougher than an ordinary regular.
    f.stats.addModifier({ id: 'challenger', source: 'challenge', flat: 'maxHealth', add: 40 });
    f.vitals.reset();
    const a = { ...ARCHETYPES.grappler, ...def.ai, style: def.style, look: () => ({}) };
    this.brains.set(f, new FighterAI(f, a, this.sim.rng, this.tokens, this.arena));
    this.duel = { f, kind: 'challenge', id: def.id, landed: 0, blocked: 0, started: this.sim.frame };
    this.events.emit('duel:start', { kind: 'challenge', name: def.nickname });
    return true;
  }

  /** Stop sparring (walk away or ask). */
  stopDuel(): void {
    if (this.duel) this.endDuel(false, true);
  }

  private updateDuel(): void {
    const d = this.duel;
    if (!d) return;
    const p = this.player;
    const them = d.f;
    const pLow = p.isKO || p.vitals.health <= p.vitals.maxHealth * 0.25;
    const tLow = them.isKO || them.vitals.health <= them.vitals.maxHealth * 0.2;
    // Walked well away: it's over.
    const walked = Math.abs(p.pos.x - them.pos.x) > 7;
    if (tLow) this.endDuel(true, false);
    else if (pLow) this.endDuel(false, false);
    else if (walked) this.endDuel(false, true);
  }

  private endDuel(won: boolean, stopped: boolean): void {
    const d = this.duel!;
    const p = this.player;
    const f = d.f;
    f.team = 'neutral';
    f.stats.removeModifier('spar_soft');
    const brain = new DummyBrain(f, this.sim.rng);
    brain.mode = 'stand';
    this.brains.set(f, brain);
    // Nobody leaves hurt: you both get patched up.
    for (const x of [p, f]) {
      if (x.isKO) {
        const pos = { ...x.pos };
        x.respawn();
        x.pos = { x: pos.x, y: 0, z: pos.z };
      }
      x.vitals.health = Math.max(x.vitals.health, Math.round(x.vitals.maxHealth * 0.6));
    }
    this.tokens.release(f);
    const frames = this.sim.frame - d.started;
    this.duel = null;
    this.events.emit('duel:end', { kind: d.kind, id: d.id, won, stopped, landed: d.landed, blocked: d.blocked, seconds: Math.round(frames / SIM_HZ) });
  }

  constructor(
    readonly level: LevelDef,
    readonly progress: Progress,
    opts: {
      entry: string;
      touch?: boolean;
      carry?: { health: number; stamina: number } | null;
      seed?: number;
      difficulty?: 'easy' | 'normal' | 'hard';
      /** Start here instead of at the entry (rebuilding the area around the player). */
      at?: { x: number; z: number };
      /** Optional fights already done on this visit (kept when the area is rebuilt in place). */
      keepCleared?: string[];
      /** Companion who follows you here. */
      companion?: CompanionDef | null;
      /** Everyone following you (newer than \`companion\`). */
      companions?: CompanionDef[];
      /** At home: the crew who live there (relaxing), and who's coming in with you through the door. */
      home?: { residents: CompanionDef[]; arriving: CompanionDef[] };
      /** Ambient pedestrians (off in tests unless asked for). */
      civilians?: boolean;
    },
  ) {
    this.stations = [...(level.stations ?? [])];
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
    this.difficulty = opts.difficulty ?? 'normal';
    progress.applyModifiers(this.player, this.difficulty);
    this.player.vitals.reset();
    if (opts.carry) {
      this.player.vitals.health = Math.max(1, Math.min(this.player.vitals.maxHealth, opts.carry.health));
      this.player.vitals.stamina = Math.min(this.player.vitals.maxStamina, opts.carry.stamina);
    }
    this.player.facing = entry.facing;
    if (opts.at) {
      this.player.pos.x = opts.at.x;
      this.player.pos.z = opts.at.z;
      this.arena.clamp(this.player.pos);
    }
    // Fights trigger when you cross their line. Start the line-check from where you
    // actually are, or a rebuild that puts you mid-street "crosses" every line on the way.
    this.lastX = this.player.pos.x;

    for (const def of level.encounters) {
      const cleared =
        (def.optional && !!opts.keepCleared?.includes(def.id)) ||
        (!def.optional && (progress.has(this.clearedKey(def)) || (def.boss ? progress.has(BOSSES[def.boss].flag) : false)));
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
    for (const s of this.stations) {
      if (s.id === 'sparring') this.spawnSparringPartner(s);
      if (s.npc) this.spawnNpc(s);
    }

    if (opts.home) {
      this.homeLife = new HomeLife(level, this.arena, () => this.crewRng.next(), (f, text) => {
        const m = this.memberOf(f);
        if (m) this.events.emit('crew:say', { fighter: f, name: m.def.nickname, text });
      });
      opts.home.residents.forEach((d, i) => this.spawnCrew(d, 'settled', i));
      opts.home.arriving.forEach((d, i) => this.spawnCrew(d, 'door', i));
    } else {
      const list = opts.companions ?? (opts.companion ? [opts.companion] : []);
      list.forEach((d, i) => this.spawnCrew(d, 'beside', i));
    }
    // Counter-fighters answer blocks and parries.
    this.sim.bus.on('hit:blocked', ({ target }) => this.memberOf(target)?.brain.onBlocked(this.sim.frame));
    this.sim.bus.on('hit:parried', ({ target }) => this.memberOf(target)?.brain.onBlocked(this.sim.frame));
    if (opts.civilians !== false) this.setUpCivilians();
    this.events.on('encounter:start', () => {
      for (const c of this.civilians) c.brain.react(this.player.pos.x, this.sim.frame);
    });
    // A punch thrown anywhere on the street turns heads, not just a scripted fight.
    this.sim.bus.on('hit:landed', ({ target }) => {
      for (const c of this.civilians) if (Math.abs(c.f.pos.x - target.pos.x) < 9) c.brain.react(target.pos.x, this.sim.frame);
    });
    // Duel bookkeeping: what you landed and blocked against your sparring partner or challenger.
    this.sim.bus.on('hit:landed', ({ attacker, target }) => {
      if (!this.duel) return;
      if (attacker === this.player && target === this.duel.f) this.duel.landed++;
    });
    this.sim.bus.on('hit:blocked', ({ attacker, target, move }) => {
      if (this.duel && target === this.player && attacker === this.duel.f) this.duel.blocked++;
      // Blocking a heavy blow still hurts the arms.
      if (move.damage >= 12) this.ledgerFor(target)?.record(move.height, move.damage * 0.4, true);
    });
    this.sim.bus.on('hit:landed', ({ target, move, damage }) => {
      this.ledgerFor(target)?.record(move.height, damage, false);
    });

    this.sim.bus.on('fighter:ko', ({ fighter, by }) => {
      const l = this.ledgerFor(fighter);
      if (l) l.knockedOut = true;
      // Your crew learn from every fight they're in.
      if (fighter.team === 'enemy') {
        for (const m of this.crew) {
          if (m.f.isKO || m.waiting) continue;
          const st = crewState(this.progress, m.def.id);
          if (by === m.f) st.kos++;
          const up = companionGainXp(st, by === m.f ? 25 : 12);
          if (up) {
            this.applyCompanionCondition(m.f, m.def);
            this.events.emit('companion:level', { id: m.def.id, name: m.def.nickname, level: st.level });
          }
          if (by === m.f) this.crewSay(m, 'win');
        }
      }
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
    this.updateCompanion();
    this.updateInjuries();
    this.updateCivilians();
    this.updateDuel();
    this.checkEdgeExits(cmd);

    if (p.isKO && !this.defeated && !this.duel) {
      if (this.defeatAt < 0) this.defeatAt = this.sim.frame;
      if (this.sim.frame - this.defeatAt >= DEFEAT_DELAY) {
        this.defeated = true;
        this.settleInjuries();
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
      s.held = this.progress.newStack(id, 1, { hits: w.hits, stolen, mods: w.mods });
    } else s.held.hits = w.hits;
  }

  private collectDroppedWeapons(): void {
    for (const f of this.sim.fighters) {
      if (!f.droppedWeapon) continue;
      const w = f.droppedWeapon;
      f.droppedWeapon = null;
      const member = this.memberOf(f);
      if (member && (crewState(this.progress, member.def.id).weapon || member.brain.style.weaponClasses)) {
        member.pocket = w;
        continue;
      }
      if (w.data.breaks && w.hits <= 1 && f !== this.player) continue; // nearly done anyway
      this.dropOnGround(this.progress.newStack(weaponItemId(w.data.id), 1, { hits: w.hits, mods: w.mods }), f.pos.x - f.facing * 0.4, f.pos.z);
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
      // Side fights are street-corner trouble you only meet on foot: ride past and they don't
      // start (they're still there when you come back walking). Story fights start either way.
      const ridingPast = e.def.optional && this.progress.save.property.riding;
      if (e.status === 'waiting' && crossed && !ridingPast && !this.activeEncounter && !p.isKO) this.startEncounter(e);
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

  /** Cousin Mo: stands on the gym mat, not a target, until you ask him to spar. */
  private spawnSparringPartner(s: StationDef): void {
    const f = new Fighter({
      id: this.nextId++,
      name: 'Cousin Mo',
      team: 'neutral',
      attributes: defaultAttributes(6),
      style: getStyle('street'),
      x: SPAR_SPOT.x,
      z: SPAR_SPOT.z,
      appearance: sparringPartnerAppearance(),
    });
    f.facing = -1;
    this.sim.add(f);
    const brain = new DummyBrain(f, this.sim.rng);
    brain.mode = 'stand';
    this.brains.set(f, brain);
    this.sparPartner = f;
    void s;
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
    for (const s of this.stations) {
      if (s.id === 'sparring' && (this.duel || !this.sparPartner)) continue;
      if (s.id === 'recruit' && this.duel) continue;
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
      p.equipWeapon(d.weapon, stack.hits, stack.mods);
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
    if (r.treated) this.progress.applyModifiers(this.player, this.difficulty);
    const v = this.player.vitals;
    const before = v.health;
    const heal = r.heal + r.healPct * v.maxHealth;
    if (heal > 0) v.heal(heal);
    if (r.stamina > 0) v.restoreStamina(r.stamina);
    const gained = Math.round(v.health - before);
    const treated = r.treated ? ` · treated: ${r.treated.toLowerCase()}` : '';
    return { ok: true, text: `${r.name}${gained > 0 ? `: +${gained} health` : ''}${r.stamina > 0 ? `${gained > 0 ? ',' : ':'} +${r.stamina} stamina` : ''}${treated}` };
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
    this.player.equipWeapon(ITEMS[st.id].weapon!, st.hits, st.mods);
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

/** One of your crew in this area. */
export interface CrewMember {
  f: Fighter;
  def: CompanionDef;
  brain: CompanionBrain;
  downAt: number;
  /** A weapon knocked out of their hand: they keep hold of it and pick it back up when they're up. */
  pocket: { data: WeaponData; hits: number; mods?: WeaponMods } | null;
  weaponId: string | null;
  /** Not in yet (coming through the door after you). */
  waiting?: boolean;
  enterAt?: number;
  saidAt?: number;
}
