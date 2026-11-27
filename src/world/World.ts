import { CELL } from './interiors';
import { metroVisit } from '../travel/metro';
import { STAIRS_X } from './metroLevels';
import { streetSolids } from '../city/street';
import { atmOpen, bankOf } from '../money/atm';
import { doorX } from '../city/doorSpots';
import { BODY_RADIUS } from '../core/constants';
import { BOSS_DAMAGE_TAKEN, ENEMY_DAMAGE_TAKEN, fightStrength, SECOND_WIND } from './fightTuning';
import { JEWEL_ITEMS } from '../items/jewellery';
import { ARCHETYPES, GRUNT_NAMES, NAMED_GRUNTS, archetypeAppearance, type Archetype, type ArchetypeId } from '../ai/archetypes';
import { AttackTokens } from '../ai/AttackTokens';
import { BOSSES, type BossDef, type BossPhase } from '../ai/bosses';
import { DummyBrain } from '../ai/DummyBrain';
import { FighterAI } from '../ai/FighterAI';
import { npc } from '../characters/npcs';
import { kerbFor } from '../city/street';
import { randomAppearance, sparringPartnerAppearance, type CharacterAppearance, type HairStyle, type TopStyle } from '../character/Appearance';
import { CivilianBrain, CIVILIAN_DENSITY, DESPAWN, SPAWN_MAX, SPAWN_MIN, type Hotspot } from './civilians';
import { CompanionBrain } from '../companions/brain';
import { COMPANIONS, companionGainXp, crewState, type CompanionDef } from '../companions/companions';
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
import { clubTick, foughtTonight, nextBout, type Bout } from '../fightclub/club';
import { PIT, PIT_CORNERS, PIT_WAIT } from './interiors';
import { gangMods, HEAT, huntChance, KNOWN_FACE_HEAT } from '../progress/heat';
import { BRIBERY_HEAT, BUNG_COOL, bungPrice, copFor, REFUSED_DEALT, REFUSED_TAKEN, TIPOFF_SECONDS, type Cop } from '../progress/cops';
import { ARREST_HEAT } from './robbery';
import { Simulation } from '../core/Simulation';
import { getStyle } from '../data/styles';
import { Fighter } from '../fighter/Fighter';
import { emptyCommand, type CommandFrame } from '../input/Commands';
import { TutorialBrain, type LessonMode } from '../ai/TutorialBrain';
import type { ItemStack } from '../items/Inventory';
import { ITEMS, weaponItemId } from '../items/items';
import { hash01 } from '../realty/catalogue';
import { competition, dealerIn, rivalIn, takeCorner, taxOffer, type Dealer } from '../business/streetDealers';
import { DRUG_DEFS, DRUGS, dealingOpen, dealsOnYou, recordSale, SALE_HEAT, streetPrice, takeFromPockets, undercoverChance, type Drug } from '../business/dealing';
import { stripAreaOf } from '../jobs/jobs';
import { checkJob, completeJob, jobStep, objectiveOf, spotIn, streetJob, STREET_CHANCE, TARGET_ARCH, timeLeft, type ActiveJob, type Job, type JobPaid } from '../jobs/jobs';
import { isSubwayStairs, onStrip, stripIndex } from './strip';
import { BOOST_COOLDOWN, BOOSTS_PER_BOSS, BOOSTS_PER_FIGHT, HOTBAR_COOLDOWN, hotbarView, refillHotbar, type HotbarSlot } from '../items/hotbar';
import { bossDropValue, lootTableFor, rollLoot } from '../items/loot';
import type { AreaId, Progress } from '../progress/Progress';
import { defaultAttributes } from '../stats/Stats';
import { Arena, type Obstacle } from './Arena';
import { gateNeeds, lockedMessage } from './gates';
import {
  propBox,
  propHalf,
  type PropDef,
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
  /** `seam`: you walked over the line into the next district; there is no door and no fade (see strip.ts). */
  'area:exit': { to: AreaId; entry: string; seam?: boolean };
  'area:locked': { text: string };
  'encounter:start': { id: string; boss: BossDef | null };
  /** You pussied out: `dropped` thrown down (0 = none on you, so they'll remember you). */
  bail: { dropped: number; grudge: boolean };
  'hotbar:used': { slot: HotbarSlot };
  /** A district you ran from with nothing on you: this fight comes at you twice as hard. */
  grudge: { district: string };
  'encounter:wave': { id: string; wave: number; of: number };
  'encounter:cleared': { id: string; cash: number; xp: number; optional: boolean; secondWind?: boolean };
  'boss:phase': { boss: BossDef; phase: BossPhase };
  /** `items`: what went in your pockets (or, for jewellery, your jewellery box); `worth`: what all the drops would sell for. */
  'boss:defeated': { boss: BossDef; first: boolean; cash: number; xp: number; items: string[]; left: string[]; worth: number };
  cash: { amount: number };
  'item:picked': { name: string; qty: number; rarity: string; stolen: boolean; jewel?: boolean };
  'item:full': { name: string };
  'item:held': { name: string };
  searched: { label: string; found: string[] };
  broken: { label: string };
  secret: { label: string };
  unlock: { text: string };
  'level:up': { level: number };
  'gate:opened': { label: string };
  station: { id: StationDef['id']; station: StationDef };
  /** Officers turned up: the one you'd talk to, whether you know him (from a bung before), and whether there's time for a word. */
  'police:arrive': { count: number; lead: string; known: 'bent' | 'straight' | null; talk: boolean };
  /** Kerrigan's tipped you off: the police are waiting here, and you've this long to clear off. */
  'police:tipoff': { seconds: number };
  'alarm': { shop: string };
  'player:defeated': { byPolice: boolean };
  /** A fight left someone hurt: `who` is 'you' or a companion id. */
  'injury': { who: string; name: string; injuries: Injury[] };
  /** A companion levelled up. */
  'companion:level': { id: string; name: string; level: number };
  'companion:up': { name: string };
  /** A crew member says something (shown over their head). */
  'crew:say': { fighter: Fighter; name: string; text: string };
  /** An enemy shouts: a taunt, or the warning before jumping in. */
  'enemy:say': { fighter: Fighter; text: string; kind: 'taunt' | 'warn' };
  /** You mugged a passer-by: they handed it over and ran, or squared up. */
  mug: { name: string; resisted: boolean; items: string[]; cash: number; heat: number; witnesses: number; hero: string | null; police: number | null; known: boolean };
  /** You put down someone who was only defending themselves or someone else. */
  assault: { name: string; heat: number };
  /** The district's crew have come looking for you (gang heat). */
  'gang:hunt': { district: string; count: number; gang: number };
  /** You put down the lads they sent. */
  'gang:beaten': { district: string; gang: number };
  /** You walked into a district where people know your face from muggings. */
  'known:face': { district: string };
  /** Someone on the street has a job for you (src/jobs): Game shows what it is. */
  'job:offer': { job: Job; name: string };
  /** The job's moved on: you've done the hard part, now go back (`back`), or it's on the clock. */
  'job:step': { job: ActiveJob; text: string };
  /** Done and paid where it happened (a delivery, a deal, a street job). */
  'job:done': { paid: JobPaid; text: string };
  'job:failed': { text: string };
  /** A deal sold on the street (business/dealing.ts); `undercover`: the punter was police. */
  'deal:sold': { drug: Drug; qty: number; price: number; undercover: boolean };
  /** USE on a street dealer (business/streetDealers.ts): Game shows what you can do. */
  'dealer:talk': { name: string; district: string };
  /** You've put the street dealer down: his stash is on the floor and the corner's yours. */
  'dealer:down': { name: string; district: string };
  'duel:start': { kind: 'spar' | 'challenge' | 'club'; name: string };
  'duel:end': { kind: 'spar' | 'challenge' | 'club'; id: string; won: boolean; stopped: boolean; landed: number; blocked: number; seconds: number };
}

interface EncounterState {
  def: EncounterDef;
  /** After you pussy out, it doesn't start again until this frame (they're busy with your money). */
  retryAt?: number;
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
  /** A boss reward the save remembers (save.bossLoot): it is still here when you come back. */
  kept?: boolean;
}

export interface CashPickup {
  key: string;
  x: number;
  z: number;
  amount: number;
  /** Level pickup id, for one-time cash. */
  def: PickupDef | null;
  /** Thrown down when you pussied out: it's theirs now, you can't pick it back up. */
  bait?: boolean;
}

/** Pussying out of a fight (World.bailOut): what it cost you. */
export type BailResult = { ok: true; dropped: number; grudge: boolean; share: number } | { ok: false; reason: string };
/**
 * Share of the cash on you that you throw down to get away: rolled once per fight between these (so the button
 * can tell you what it'll cost), never the same twice in a row.
 */
export const BAIL_MIN = 0.25;
export const BAIL_MAX = 0.6;

/** Police heat for mugging someone in the street (handed over or not); street heat is HEAT.mug.street. */
export const MUG_HEAT = HEAT.mug.police;
/** More police heat for each person who saw it (they'll describe you). */
export const MUG_WITNESS_HEAT = HEAT.witness.police;
/** Putting down someone who only fought for their own stuff, or stepped in to help: assault. */
export const ASSAULT_HEAT = HEAT.assault.police;

/**
 * The chance someone rings the police: more witnesses, and the worse the locals think of you (street heat), the
 * likelier; once the police already want you here (ARREST_HEAT) it's certain.
 */
export function policeCallChance(witnesses: number, street: number, police: number): number {
  if (police >= ARREST_HEAT) return 1;
  return Math.min(0.9, (witnesses > 0 ? 0.12 + witnesses * 0.14 : 0.04) + street / 250);
}

/** Someone steady on the street stepping in to help: likelier the worse the locals think of you. */
export function heroChance(street: number): number {
  return Math.min(0.65, 0.3 + street / 250);
}

/** What a passer-by is seen wearing that's worth anything (it raises the odds they'll fight for it). */
export function valuablesOf(a: CharacterAppearance): string[] {
  const out: string[] = [];
  if (a.accessories.includes('chain')) out.push(a.chainColour === 'gold' ? 'chain_gold' : 'chain_silver');
  if (a.accessories.includes('watch')) out.push('watch_basic');
  if (a.accessories.includes('ring')) out.push('ring_signet');
  if (a.accessories.includes('earring')) out.push('earring_silver');
  return out;
}

/**
 * What you actually get off someone you mug: a roll for each pocket, not everything they own. Most have a wallet
 * with a few quid in it; some a phone; worn jewellery almost never comes off (one cheap piece at most, gold
 * rarely). And a street that's just been worked (`streak`: muggings here in the last MUG_MEMORY seconds) gives up
 * less: people keep their wallets in, more of them have nothing on them. So mugging is a desperate few quid,
 * never a way to fund the game (docs/ECONOMY.md).
 */
export function mugHaul(next: () => number, a: CharacterAppearance, streak: number): { items: string[]; cash: number } {
  const fall = 1 / (1 + 0.6 * streak);
  if (next() < Math.min(0.75, 0.12 + 0.18 * streak)) return { items: [], cash: next() < 0.5 ? Math.round(1 + next() * 3) : 0 };
  const items: string[] = [];
  const cash = next() < 0.8 ? Math.round((3 + next() * 22) * fall) : 0;
  if (next() < 0.25 * fall) items.push('phone_cheap');
  const worn = valuablesOf(a).sort((x, y) => (ITEMS[x]?.value ?? 0) - (ITEMS[y]?.value ?? 0))[0];
  if (worn && next() < (worn === 'chain_gold' || worn === 'ring_signet' ? 0.05 : 0.12) * fall) items.push(worn);
  return { items, cash };
}

/**
 * Whether someone you're mugging fights for it, 0–1: by temper (the nervy hand it over, the steady won't), a bit
 * more for a man, more for something worth fighting for, less once you're a known face (your level).
 */
export function mugResistChance(temper: 'nervy' | 'nosy' | 'steady', male: boolean, worth: number, level: number): number {
  const base = temper === 'nervy' ? 0.12 : temper === 'nosy' ? 0.38 : 0.6;
  const v = base + (male ? 0.1 : -0.12) + Math.min(0.15, worth / 1200) - Math.min(0.2, Math.max(0, level - 3) * 0.02);
  return Math.max(0.05, Math.min(0.85, v));
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
  | { kind: 'container'; x: number; z: number; label: string; container: ContainerDef; empty: boolean }
  | { kind: 'mug'; x: number; z: number; label: string; target: Fighter }
  /** The passer-by with a job, or the person at the far end of yours (the debtor, the recipient, the buyer). */
  | { kind: 'job'; x: number; z: number; label: string; f: Fighter; role: 'giver' | 'target' }
  | { kind: 'dealer'; x: number; z: number; label: string; f: Fighter }
  /** A punter who'll buy deals off you (business/dealing.ts). */
  | { kind: 'deal'; x: number; z: number; label: string; target: Fighter; drug: Drug; qty: number; price: number };

/**
 * One area of the world running live: the level's collision, the player,
 * encounters and bosses, loot, containers, breakables, weapons on the
 * ground, gates, levers, exits, shopkeepers and hub stations. Every change
 * to progress goes through Progress, so rewards are paid once, items are
 * never duplicated and everything survives saving.
 */
/**
 * Is an optional fight with a `chance` on this trip? Rolled from the area, the fight and the trip number (not
 * the fight's own RNG), so a rebuild mid-visit keeps the answer and the next visit rolls again.
 */
export function fightIsOn(def: EncounterDef, area: string, trips: number): boolean {
  if (!def.optional || def.chance === undefined) return true;
  return hash01(`fight:${area}:${def.id}:${trips}`) < def.chance;
}

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
  private brains = new Map<Fighter, FighterAI | DummyBrain | CivilianBrain | CompanionBrain | LeaveBrain | TutorialBrain>();
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
  /** Each officer's name and whether he's bent (progress/cops.ts). */
  private readonly copOf = new Map<Fighter, Cop>();
  /** Bunged officers walking off: removed when they're out of sight. */
  private readonly leaving = new Map<Fighter, number>();
  /** Kerrigan's tip-off, waiting for the first frame to be told. */
  private tipoff = 0;
  /** This visit's stations: the level's, plus things that come and go (a parked bike). */
  readonly stations: StationDef[];

  /** Optional fights finished on this visit (so rebuilding the area doesn't re-arm them). */
  clearedOptional(): string[] {
    return this.encounters.filter((e) => e.def.optional && e.status === 'cleared').map((e) => e.def.id);
  }

  addStation(s: StationDef): void {
    this.stations.push(s);
  }

  /**
   * Something set down where someone may be standing (your bike as you get off it): not solid till nobody's in it,
   * then solid like anything else. `id` replaces an earlier one of the same id.
   */
  settleObstacle(id: string, x: number, z: number, hx: number, hz: number): void {
    this.clearObstacle(id);
    const o: Obstacle = { id, minX: x - hx, maxX: x + hx, minZ: z - hz, maxZ: z + hz, solid: false };
    this.arena.obstacles.push(o);
    this.settling.push(o);
  }

  clearObstacle(id: string): void {
    this.arena.obstacles = this.arena.obstacles.filter((o) => o.id !== id);
    this.settling = this.settling.filter((o) => o.id !== id);
  }

  private settling: Obstacle[] = [];

  /** Settle what nobody's standing in any more. */
  private settleObstacles(): void {
    for (let i = this.settling.length - 1; i >= 0; i--) {
      const o = this.settling[i];
      const r = BODY_RADIUS + 0.05;
      if (this.sim.fighters.some((f) => f.pos.x > o.minX - r && f.pos.x < o.maxX + r && f.pos.z > o.minZ - r && f.pos.z < o.maxZ + r)) continue;
      o.solid = true;
      this.settling.splice(i, 1);
    }
  }

  removeStation(id: string): void {
    for (let i = this.stations.length - 1; i >= 0; i--) if (this.stations[i].id === id) this.stations.splice(i, 1);
  }

  /** Mo, in the home gym. */
  sparPartner: Fighter | null = null;

  // ---- jobs (src/jobs) ----------------------------------------------------------------------------------------

  /** Who's at the far end of the job you're on, here: the one you're after and their mates. */
  readonly jobFolk: { f: Fighter; role: 'target' | 'mate'; arch: ArchetypeId; hostile: boolean }[] = [];
  /** Someone on the street with a job for you (and whether they've said hello yet). */
  jobGiver: { f: Fighter; said: boolean } | null = null;
  private jobDone = false;
  private jobCheckAt = 0;

  /** Somewhere to stand along the back of the street, clear of what's there. */
  private standSpot(x: number, i: number): { x: number; z: number } {
    const b = this.arena.bounds;
    return this.freeSpot(x + (i === 0 ? 0 : (i % 2 ? 1 : -1) * (0.8 + Math.floor((i - 1) / 2) * 0.8)), b.minZ + 0.45 + (i ? 0.25 : 0));
  }

  /** Someone stood waiting: neutral, still, not in the fight (yet). */
  private standStill(f: Fighter): void {
    f.team = 'neutral';
    this.enemies = this.enemies.filter((e) => e !== f);
    this.tokens.release(f);
    const brain = new DummyBrain(f, this.sim.rng);
    brain.mode = 'stand';
    this.brains.set(f, brain);
  }

  /** The job you're on is here and not done: put them where they're meant to be. */
  setUpJob(): void {
    const j = this.progress.save.jobs.active;
    if (!j || j.stage !== 'go' || j.area !== this.level.id || this.jobFolk.length) return;
    this.jobDone = false;
    const rng = new Rng(j.seed);
    const pick = <T,>(l: readonly T[]) => l[Math.floor(rng.next() * l.length) % l.length];
    const fighter = j.kind === 'sort' || j.kind === 'recover';
    const arch: ArchetypeId = fighter ? pick(TARGET_ARCH.sort) : j.kind === 'deliver' ? 'casual' : 'thug';
    const spot = this.standSpot(j.x, 0);
    const look = j.body === 'female' || !fighter ? { ...randomAppearance(() => rng.next(), j.body), accessories: [] } : undefined;
    const t = this.spawnEnemy(arch, spot.x, spot.z, undefined, j.target, look);
    t.tag = j.kind === 'deliver' ? 'Waiting for a parcel' : j.kind === 'deal' ? 'Buyer' : j.kind === 'debt' ? `Owes £${j.owed}` : 'Your target';
    this.standStill(t);
    t.facing = t.pos.x > this.player.pos.x ? -1 : 1;
    this.jobFolk.push({ f: t, role: 'target', arch, hostile: false });
    if (j.kind === 'deliver') return;
    for (let i = 0; i < j.mates; i++) {
      const a = pick(TARGET_ARCH.mate);
      const sp = this.standSpot(j.x, i + 1);
      const m = this.spawnEnemy(a, sp.x, sp.z);
      this.standStill(m);
      m.facing = t.facing;
      this.jobFolk.push({ f: m, role: 'mate', arch: a, hostile: false });
    }
  }

  /** On a street (not inside, not home), sometimes: someone with a job, stood against the wall, waving you over. */
  private setUpStreetGiver(): void {
    const id = this.level.id;
    const p = this.progress;
    if (!onStrip(id) || this.level.deep || p.save.jobs.active || p.has(`streetjob:${id}:${p.save.trips}`)) return;
    // Not while you're still learning the ropes.
    if (!p.save.tutorial.essentialDone) return;
    if (hash01(`streetgiver:${id}:${p.save.trips}`) >= STREET_CHANCE) return;
    const r = new Rng(Math.floor(hash01(`giverlook:${id}:${p.save.trips}`) * 1e6) + 3);
    const body = r.next() < 0.4 ? 'female' : 'male';
    const names = body === 'female' ? GRUNT_NAMES.female : GRUNT_NAMES.male;
    const name = names[Math.floor(r.next() * names.length) % names.length];
    const spot = this.standSpot(spotIn(id, () => r.next()), 0);
    const look: CharacterAppearance = { ...randomAppearance(() => r.next(), body), accessories: [] };
    const f = new Fighter({ id: this.nextId++, name, team: 'neutral', attributes: defaultAttributes(5), style: getStyle('street'), x: spot.x, z: spot.z, appearance: look });
    f.tag = 'Needs a hand';
    f.facing = f.pos.x > this.player.pos.x ? -1 : 1;
    this.sim.add(f);
    this.standStill(f);
    this.jobGiver = { f, said: false };
  }

  /** Who to put a badge over: someone with a job, and who you're after (till they're down or it's done). */
  jobMarks(): { f: Fighter; kind: 'giver' | 'target' | 'punter' | 'dealer' }[] {
    const out: { f: Fighter; kind: 'giver' | 'target' | 'punter' | 'dealer' }[] = this.punters().map((f) => ({ f, kind: 'punter' as const }));
    const r = this.rival;
    if (r && !r.f.isKO && !this.leaving.has(r.f)) out.push({ f: r.f, kind: 'dealer' });
    const g = this.jobGiver;
    if (g && !this.leaving.has(g.f) && !g.f.isKO) out.push({ f: g.f, kind: 'giver' });
    const t = this.jobFolk.find((x) => x.role === 'target');
    if (t && !this.jobDone && !t.f.isKO && !this.leaving.has(t.f) && this.progress.save.jobs.active) out.push({ f: t.f, kind: 'target' });
    return out;
  }

  /** The people in a job you can talk to right now. */
  private jobOptions(): Interactable[] {
    const out: Interactable[] = [];
    const r = this.rival;
    if (r && !r.hostile && !r.f.isKO && r.f.team === 'neutral' && !this.leaving.has(r.f) && !this.inFight) out.push({ kind: 'dealer', x: r.f.pos.x, z: r.f.pos.z, label: `Talk to ${r.f.name}: deals on this corner`, f: r.f });
    const g = this.jobGiver;
    if (g && !g.f.isKO && g.f.team === 'neutral' && !this.leaving.has(g.f)) out.push({ kind: 'job', x: g.f.pos.x, z: g.f.pos.z, label: `Talk to ${g.f.name}: needs a hand`, f: g.f, role: 'giver' });
    const j = this.progress.save.jobs.active;
    const t = this.jobFolk.find((x) => x.role === 'target');
    if (j && t && !t.hostile && !t.f.isKO && !this.jobDone && !this.leaving.has(t.f)) {
      const label = j.kind === 'debt' ? `Lean on ${j.target}: owes £${j.owed}` : j.kind === 'deliver' ? `Hand ${j.target} the parcel` : j.kind === 'deal' ? `Sell ${j.target} the package: £${j.cash}` : null;
      if (label) out.push({ kind: 'job', x: t.f.pos.x, z: t.f.pos.z, label, f: t.f, role: 'target' });
    }
    return out;
  }

  private say(f: Fighter, lines: readonly string[]): void {
    this.events.emit('enemy:say', { fighter: f, text: lines[Math.floor(this.lootRng.next() * lines.length) % lines.length], kind: 'taunt' });
  }

  /** They've had enough talking: everyone at the far end of the job squares up. */
  private jobSquareUp(): void {
    for (const x of this.jobFolk) {
      if (x.hostile || x.f.isKO) continue;
      x.hostile = true;
      x.f.team = 'enemy';
      this.brains.set(x.f, this.enemyBrain(x.f, { ...ARCHETYPES[x.arch] }));
      this.archetypeOf.set(x.f, x.arch);
      this.enemies.push(x.f);
      if (x.role === 'target') x.f.tag = 'Your target';
    }
    for (const c of this.civilians) c.brain.react(this.player.pos.x, this.sim.frame);
  }

  private talkJob(f: Fighter, role: 'giver' | 'target'): void {
    const p = this.progress;
    if (role === 'giver') {
      this.events.emit('job:offer', { job: streetJob(p, this.level.id, f.name), name: f.name });
      return;
    }
    const j = p.save.jobs.active;
    if (!j || this.jobDone) return;
    f.facing = this.player.pos.x < f.pos.x ? -1 : 1;
    if (j.kind === 'deliver') {
      this.say(f, ['About time. Here, for your trouble.', 'Lovely. Nobody followed you?', 'Cheers. Now forget my face.']);
      this.finishJob();
      this.walkOff(f);
      return;
    }
    if (j.kind === 'debt') {
      if (j.fights) {
        this.say(f, ['I’m not paying a penny. Lads!', 'You and whose army?', 'Tell Bev she can whistle for it.', 'Get him!']);
        this.jobSquareUp();
        return;
      }
      this.say(f, ['Alright, alright! Here, it’s all there.', 'I was going to pay, honest! Take it.', 'Don’t hurt me. Here.']);
      this.collected();
      this.walkOff(f);
      return;
    }
    if (j.kind === 'deal') {
      if (j.fights) {
        this.say(f, ['Tell you what: I’ll have it for free.', 'Nice. Now hand it over, and you walk away.', 'Lads, he’s on his own.']);
        this.jobSquareUp();
        return;
      }
      this.say(f, ['Sound. Pleasure doing business.', 'Cash is all there. Count it if you like.', 'Same again next week, yeah?']);
      this.finishJob();
      this.walkOff(f);
    }
  }

  /** The debt's in your hand: back to whoever's owed it (or paid now, for a street job). */
  private collected(): void {
    const j = this.progress.save.jobs.active;
    if (!j) return;
    this.jobDone = true;
    if (jobStep(this.progress) === 'back') this.events.emit('job:step', { job: j, text: `Got the £${j.owed}. Take it back to ${j.giver.split(' ')[0]}.` });
    else this.finishJob();
  }

  /** Paid where it happened. Anything you've no room for is left at your feet. */
  private finishJob(): void {
    const p = this.progress;
    const j = p.save.jobs.active;
    if (!j) return;
    this.jobDone = true;
    const paid = completeJob(p);
    if (!paid) return;
    for (const o of paid.over) this.dropOnGround(p.newStack(o.id, o.qty), this.player.pos.x, this.player.pos.z + 0.2);
    if (paid.levels > 0) {
      this.player.stats.level = p.save.level;
      this.events.emit('level:up', { level: p.save.level });
    }
    this.events.emit('job:done', { paid, text: `${paid.title}: done. £${paid.cash} and ${paid.xp} XP${paid.items.length ? `, plus ${paid.items.map((id) => ITEMS[id]?.name ?? id).join(', ')}` : ''}.` });
  }

  /** A street job taken: they're off, and they won't be back on this trip. */
  giverTook(): void {
    const g = this.jobGiver;
    this.progress.set(`streetjob:${this.level.id}:${this.progress.save.trips}`);
    if (g) {
      this.say(g.f, ['Cheers. I owe you one.', 'Nice one. Don’t let me down.', 'Brilliant. I’ll be waiting.']);
      this.walkOff(g.f);
    }
    this.jobGiver = null;
    this.setUpJob();
  }

  /** Every frame: the job's people react to you, and what happens to them moves the job on. */
  private updateJob(): void {
    const p = this.player;
    const g = this.jobGiver;
    if (g && !g.said && !this.inFight && Math.abs(g.f.pos.x - p.pos.x) < 6) {
      g.said = true;
      g.f.facing = p.pos.x < g.f.pos.x ? -1 : 1;
      this.say(g.f, ['Oi! You look like you can handle yourself.', 'Here, mate. Got a minute? I’ll pay.', 'Excuse me! You look like you could help me out.']);
    }
    const frame = this.sim.frame;
    if (frame >= this.jobCheckAt) {
      this.jobCheckAt = frame + 30;
      const before = this.progress.save.jobs.active;
      const stage = before?.stage;
      const failed = checkJob(this.progress);
      if (failed) this.events.emit('job:failed', { text: failed });
      const j = this.progress.save.jobs.active;
      // Picked up what you came for: back you go (or paid, for a street job).
      if (j && stage === 'go' && j.stage === 'back') this.events.emit('job:step', { job: j, text: `Got the ${ITEMS[j.item!]?.name.toLowerCase()}. Take it back to ${j.giver.split(' ')[0]}.` });
      if (j && j.kind === 'recover' && j.from === 'street' && p && this.progress.save.inventory.some((x) => x.id === j.item)) this.finishJob();
    }
    const j = this.progress.save.jobs.active;
    if (!j || !this.jobFolk.length || this.jobDone) return;
    const t = this.jobFolk.find((x) => x.role === 'target');
    if (!t) return;
    // Sorting someone out, or taking something off them: they see you coming.
    if ((j.kind === 'sort' || j.kind === 'recover') && !t.hostile && !p.isKO && Math.abs(t.f.pos.x - p.pos.x) < 5.5 && Math.abs(t.f.pos.z - p.pos.z) < 3) {
      this.say(t.f, j.kind === 'sort' ? ['Who sent you? Come on then!', 'You’ve got the wrong street, pal.', 'Here he is. Get him, lads!'] : ['It’s mine now. Want it? Come and get it.', 'Finders keepers, mate.', 'Not a chance. Lads!']);
      this.jobSquareUp();
    }
    if (!t.f.isKO || !t.hostile) return;
    this.jobDone = true;
    if (j.kind === 'sort') {
      if (jobStep(this.progress) === 'back') this.events.emit('job:step', { job: j, text: `${j.target}’s sorted. Go back to ${j.giver.split(' ')[0]} for your money.` });
      else this.finishJob();
    } else if (j.kind === 'recover' && j.item) {
      this.dropOnGround(this.progress.newStack(j.item, 1), t.f.pos.x, t.f.pos.z + 0.3);
      this.events.emit('job:step', { job: j, text: `${j.target} dropped the ${ITEMS[j.item]?.name.toLowerCase()}. Pick it up.` });
    } else if (j.kind === 'debt') this.collected();
    else if (j.kind === 'deal') this.finishJob();
  }

  // ---- street dealers (business/streetDealers.ts) ------------------------------------------------------------

  /** Whoever's dealing on this street: him, his mates once he's called them, and how it's going. */
  rival: { f: Fighter; d: Dealer; mates: { f: Fighter; arch: ArchetypeId }[]; hostile: boolean; done: boolean } | null = null;

  /** A rough street with a rival dealer working it: he stands against a wall, a purple £ over his head. */
  private setUpDealer(): void {
    const id = this.level.id;
    const p = this.progress;
    if (!onStrip(id) || this.level.deep || !p.save.tutorial.essentialDone || !rivalIn(p, this.level.district)) return;
    const d = dealerIn(p, this.level.district);
    const r = new Rng(Math.floor(hash01(`dealerlook:${this.level.district}:${p.save.trips >> 2}`) * 1e6) + 11);
    let x = spotIn(id, () => r.next());
    // Not on top of someone with a job.
    if (this.jobGiver && Math.abs(this.jobGiver.f.pos.x - x) < 4) x += x > this.jobGiver.f.pos.x ? 4 : -4;
    const spot = this.standSpot(x, 0);
    const look: CharacterAppearance = { ...randomAppearance(() => r.next(), 'male'), top: r.next() < 0.6 ? 'hoodie' : 'puffer', topColour: r.next() < 0.5 ? '#1b1d22' : '#2b2e35', accessories: r.next() < 0.6 ? ['cap'] : [] };
    const f = new Fighter({ id: this.nextId++, name: d.name, team: 'neutral', attributes: defaultAttributes(Math.min(14, 4 + Math.floor(p.save.level / 2))), style: getStyle('street'), x: spot.x, z: spot.z, appearance: look });
    f.tag = 'Dealer';
    f.facing = f.pos.x > this.player.pos.x ? -1 : 1;
    this.sim.add(f);
    this.standStill(f);
    this.rival = { f, d, mates: [], hostile: false, done: false };
  }

  /** Lean on him: he pays a cut, or squares up. */
  taxDealer(): { paid: number } | { fights: true } | null {
    const r = this.rival;
    if (!r || r.hostile || r.f.isKO) return null;
    const out = taxOffer(this.progress, this.level.district, this.lootRng.next());
    if ('paid' in out) {
      this.say(r.f, ['Alright, alright. Here. Now leave it.', 'Fine. Same time next week, yeah?', 'Take it. Don’t make a habit of it.']);
      this.events.emit('cash', { amount: out.paid });
    } else this.dealerSquareUp(['Tax? From me? Lads!', 'You’re having a laugh. Get him.', 'Wrong corner, mate.']);
    return out;
  }

  /** Run him off: he and his mates have it out with you. */
  runOffDealer(): void {
    const r = this.rival;
    if (!r || r.hostile || r.f.isKO) return;
    this.progress.addHeatOf({ street: 2 });
    this.dealerSquareUp(['My corner. Always has been. Lads!', 'Come on then!', 'You want it? Take it off me.']);
  }

  private dealerSquareUp(lines: readonly string[]): void {
    const r = this.rival;
    if (!r || r.hostile) return;
    r.hostile = true;
    this.say(r.f, lines);
    const arches: ArchetypeId[] = ['thug', 'hooded', 'runner'];
    for (let i = 0; i < r.d.mates; i++) {
      const sp = this.standSpot(r.f.pos.x + (i ? 1.4 : -1.4), i + 1);
      // His mates come out of the doorway behind him.
      const m = this.spawnEnemy(arches[i % arches.length], sp.x, sp.z);
      r.mates.push({ f: m, arch: arches[i % arches.length] });
    }
    r.f.team = 'enemy';
    this.brains.set(r.f, this.enemyBrain(r.f, { ...ARCHETYPES.brawler }));
    this.archetypeOf.set(r.f, 'brawler');
    this.enemies.push(r.f);
    for (const c of this.civilians) c.brain.react(this.player.pos.x, this.sim.frame);
  }

  /** He's down: the stash and his cash on the floor, the corner yours. */
  private updateDealer(): void {
    const r = this.rival;
    if (!r || !r.hostile || r.done || !r.f.isKO) return;
    r.done = true;
    const at = r.f.pos;
    let k = 0;
    for (const drug of DRUGS) {
      const n = r.d.stock[drug];
      if (n > 0) this.dropOnGround(this.progress.newStack(DRUG_DEFS[drug].dealItem, n, { stolen: true }), at.x + (k++ - 1) * 0.35, at.z + 0.2);
    }
    this.cash.push({ key: `c${this.itemSeq++}`, x: at.x, z: at.z - 0.15, amount: r.d.cash, def: null });
    takeCorner(this.progress, this.level.district);
    this.progress.logCrime('assault');
    this.events.emit('dealer:down', { name: r.f.name, district: this.level.district });
  }

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
  private spawnCrew(def: CompanionDef, how: 'beside' | 'door' | 'settled', index: number, from?: { x: number; z: number }): void {
    const p = this.player;
    const spot = from ? this.freeSpot(from.x, from.z) : how === 'beside'
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
      engaged: () => !!this.activeEncounter || this.enemies.some((e) => !e.isKO && !this.bail?.crew.has(e) && Math.abs(e.pos.x - p.pos.x) < 9) || this.police.some((e) => !e.isKO),
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
  get fightOn(): boolean {
    const p = this.player;
    return !!this.activeEncounter || this.locked || (!!this.duel && this.duel.kind !== 'spar') || this.police.some((e) => !e.isKO) || this.enemies.some((e) => !e.isKO && !this.bail?.crew.has(e) && Math.abs(e.pos.x - p.pos.x) < 9);
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
    const fightOn = !!this.activeEncounter || this.enemies.some((e) => !e.isKO && !this.bail?.crew.has(e) && Math.abs(e.pos.x - p.pos.x) < 9);
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
        const i = this.items.findIndex((it) => !it.kept && ITEMS[it.stack.id]?.weapon && Math.abs(it.x - f.pos.x) < 0.5 && Math.abs(it.z - f.pos.z) < 0.4);
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
    // On streets with a road, people keep to the pavement behind the kerb.
    const kerb = kerbFor(this.level);
    this.civMaxZ = kerb === null ? Infinity : kerb - 0.15;
    const edge = Math.min(b.maxZ, this.civMaxZ);
    if (kerb === null) {
      this.civLanes = [b.minZ + 0.45, b.minZ + 1.0, b.maxZ - 0.4].filter((z) => z < b.maxZ - 0.1);
    } else {
      // A pavement is narrower than the whole street: lanes spread evenly across it, and a few
      // fewer people so it doesn't jam.
      // Clear of the shop doorways and benches where people stand (the back 0.7 m).
      const z0 = b.minZ + 0.75;
      const z1 = edge - 0.25;
      const n = z1 > z0 ? Math.min(3, Math.floor((z1 - z0) / 0.4) + 1) : 1;
      this.civLanes = n > 1 ? Array.from({ length: n }, (_, i) => z0 + ((z1 - z0) * i) / (n - 1)) : [(z0 + Math.max(z0, z1)) / 2];
      this.civCap = Math.max(1, Math.round(cap * 0.7));
    }
    const hs: Hotspot[] = [];
    // Shop doors on the street are somewhere to stop and look. Not someone's front door, and not inside the
    // shopping centre, where the whole glass frontage is the window and shoppers already mill about the units.
    if (this.level.theme !== 'mall')
      for (const ex of this.level.exits) if (ex.kind === 'door' && ex.to !== 'property') hs.push({ kind: 'browse', x: ex.x + 1.3, z: b.minZ + 0.35, facing: -1, slots: 1, taken: 0 });
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

  /** Pedestrians' front limit (the kerb on streets with a road). */
  private civMaxZ = Infinity;

  private spawnCivilian(): void {
    /**
     * How many regulars a district has. Every new look is a person built from scratch (morphing the body and
     * cutting their clothes: a stall of a tenth of a second or more on a phone), and built people are kept
     * (HumanBuilder's templates), so a district's crowd stops costing anything once you've seen them all.
     */
    const NPC_POOL = 28;
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
    f.background = true;
    f.stats.addModifier({ id: 'stroll', source: 'civilian', stat: 'moveSpeedMult', mul: 0.42 + r.next() * 0.3 });
    this.sim.add(f);
    const brain = new CivilianBrain(f, this.arena, r, this.civLanes, 'walk', () => this.sim.fighters, this.civMaxZ);
    if (spot) brain.claim(spot, spot.taken, this.sim.frame);
    else brain.dir = x < p.pos.x ? 1 : -1;
    if (this.activeEncounter) brain.react(p.pos.x, this.sim.frame);
    this.brains.set(f, brain);
    this.civilians.push({ f, brain });
  }

  // ---- the Metro ---------------------------------------------------------------------------------------------

  /** Doing time: you stay in the cell (its barred front is shut) till it's up. */
  private holdInCell(): void {
    if (this.level.id !== 'police_station' || !this.progress.save.police.serving) return;
    const p = this.player;
    const x0 = CELL.x - CELL.hw + 0.35;
    const x1 = CELL.x + CELL.hw - 0.35;
    const z1 = CELL.z + CELL.hd - 0.35;
    p.pos.x = Math.min(x1, Math.max(x0, p.pos.x));
    if (p.pos.z > z1) p.pos.z = z1;
  }

  /** Set while a scripted move carries the player (stairs). */
  stairAnim = false;

  /**
   * People using the stairs, the way you do at home (Game.walkStairs): on a street with a station, now and then a
   * passer-by at the stairwell turns in and walks down out of sight; in a station, passengers come down from the
   * street and walk off along the hall, and some walk up and out. Each is carried along its path by hand
   * (anchored, so the walkway bounds don't hold them), with the walk playing from the movement.
   */
  private stairGoers: { f: Fighter; path: { x: number; y: number; z: number }[]; leg: number; at: number; gone: boolean; brain?: CivilianBrain }[] = [];
  private stairClock = 0;

  private stairwells(): { x: number; down: boolean }[] {
    if (this.level.theme === 'metro') return [{ x: STAIRS_X, down: false }];
    return this.level.exits.filter((e) => isSubwayStairs(this.level, e)).map((e) => ({ x: e.x, down: true }));
  }

  private updateStairGoers(): void {
    const dt = 1 / 60;
    const wells = this.stairwells();
    if (!wells.length || !this.civCap) return;
    const back = this.arena.bounds.minZ;
    // Carry everyone already on the stairs.
    for (const g of this.stairGoers) {
      const a = g.path[g.leg];
      const b = g.path[g.leg + 1];
      if (!b) {
        g.gone = true;
        continue;
      }
      const len = Math.max(0.01, Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z));
      g.at += (1.05 * dt) / len;
      const t = Math.min(1, g.at);
      g.f.pos.x = a.x + (b.x - a.x) * t;
      g.f.pos.y = a.y + (b.y - a.y) * t;
      g.f.pos.z = a.z + (b.z - a.z) * t;
      g.f.vel.x = g.f.vel.z = 0;
      if (Math.abs(b.x - a.x) > 0.05) g.f.facing = b.x > a.x ? 1 : -1;
      if (t >= 1) {
        g.leg++;
        g.at = 0;
      }
    }
    for (const g of this.stairGoers.filter((x) => x.gone)) {
      if (g.brain) {
        // Down off the street stairs into the station: hand them back to walking about.
        g.f.anchored = false;
        g.f.pos.y = 0;
        this.brains.set(g.f, g.brain);
        g.brain.dir = 1;
      } else {
        this.sim.remove(g.f);
        const i = this.civilians.findIndex((c) => c.f === g.f);
        if (i >= 0) this.civilians.splice(i, 1);
      }
    }
    this.stairGoers = this.stairGoers.filter((g) => !g.gone);
    if (this.activeEncounter || this.locked) return;
    this.stairClock += dt;
    if (this.stairClock < 1.5) return;
    this.stairClock = 0;
    const rng = this.lootRng;
    for (const w of wells) {
      if (w.down) {
        // A passer-by walking past the top of the stairs turns in and goes down.
        const c = this.civilians.find((c) => this.brains.has(c.f) && Math.abs(c.f.pos.x - w.x) < 0.9 && !c.f.isKO && c.f.team === 'neutral');
        if (!c || rng.next() > 0.45) continue;
        this.brains.delete(c.f);
        c.brain.release();
        c.f.anchored = true;
        const top = { x: w.x, y: 0, z: back - 0.1 };
        this.stairGoers.push({ f: c.f, path: [{ ...c.f.pos }, { x: w.x, y: 0, z: back + 0.2 }, top, { x: w.x, y: -3.0, z: back - 5.2 }], leg: 0, at: 0, gone: false });
      } else {
        // In the station: someone comes down from the street, or a passenger by the stairs walks up and out.
        const leaving = this.civilians.find((c) => this.brains.has(c.f) && Math.abs(c.f.pos.x - w.x) < 1.6 && !c.f.isKO && c.f.team === 'neutral');
        if (leaving && rng.next() < 0.5) {
          this.brains.delete(leaving.f);
          leaving.brain.release();
          leaving.f.anchored = true;
          const foot = { x: w.x, y: 0, z: back + 0.15 };
          this.stairGoers.push({ f: leaving.f, path: [{ ...leaving.f.pos }, foot, { x: w.x, y: 3.3, z: back - 4.8 }], leg: 0, at: 0, gone: false });
        } else if (this.civilians.length < this.civCap && rng.next() < 0.55) {
          this.spawnCivilian();
          const c = this.civilians[this.civilians.length - 1];
          if (!c || this.stairGoers.some((g) => g.f === c.f)) continue;
          const brain = c.brain;
          this.brains.delete(c.f);
          c.f.anchored = true;
          const top = { x: w.x, y: 3.3, z: back - 4.8 };
          c.f.pos.x = top.x;
          c.f.pos.y = top.y;
          c.f.pos.z = top.z;
          this.stairGoers.push({ f: c.f, path: [top, { x: w.x, y: 0, z: back + 0.15 }, { x: w.x + 1.2, y: 0, z: back + 0.9 }], leg: 0, at: 0, gone: false, brain });
        }
      }
    }
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
    const calm = !this.activeEncounter && !this.locked && !this.enemies.some((e) => !e.isKO && !this.bail?.crew.has(e));
    // A known face round here: the nervy and the nosy cross the road when you get close (the steady don't).
    const known = this.progress.heatIn().street >= KNOWN_FACE_HEAT;
    if (known && !this.knownSaid && this.civilians.length) {
      this.knownSaid = true;
      this.events.emit('known:face', { district: this.level.district });
    }
    for (const c of this.civilians) {
      if (calm) c.brain.calm(frame);
      if (known && calm && frame % 15 === c.f.id % 15 && c.brain.temper !== 'steady' && c.brain.activity !== 'flee' && Math.abs(c.f.pos.x - p.pos.x) < 2.4 && Math.abs(c.f.pos.z - p.pos.z) < 1.6) c.brain.react(p.pos.x, frame);
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

  duel: { f: Fighter; kind: 'spar' | 'challenge' | 'club'; id: string; landed: number; blocked: number; started: number } | null = null;

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

  /**
   * A tutorial lesson with Mo (src/tutorial): sparring, with his choices scripted by TutorialBrain. His hits
   * barely land and he never goes down, so a lesson can't be lost; walk away and it stops like any spar.
   */
  startLesson(mode: LessonMode): boolean {
    const f = this.sparPartner;
    if (!f || this.activeEncounter) return false;
    if (this.duel && this.duel.id !== 'lesson') return false;
    if (!this.duel) {
      f.team = 'enemy';
      f.stats.addModifier({ id: 'spar_soft', source: 'spar', stat: 'damageMult', mul: 0.02 });
      this.duel = { f, kind: 'spar', id: 'lesson', landed: 0, blocked: 0, started: this.sim.frame };
      this.events.emit('duel:start', { kind: 'spar', name: f.name });
    }
    let brain = this.brains.get(f);
    if (!(brain instanceof TutorialBrain)) {
      brain = new TutorialBrain(f);
      this.brains.set(f, brain);
    }
    brain.setMode(mode, this.sim.frame);
    return true;
  }

  /** Mo, in a lesson or not (the tutorial checks he's there before asking for him). */
  get sparringPartner(): Fighter | null {
    return this.sparPartner ?? null;
  }

  /** In a tutorial lesson with Mo now. */
  get inLesson(): boolean {
    return this.duel?.id === 'lesson';
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
    // A lesson can't be lost or won: both of you stay on your feet (only walking away ends it).
    if (d.id === 'lesson') {
      for (const x of [p, them]) if (!x.isKO) x.vitals.health = Math.max(x.vitals.health, x.vitals.maxHealth * 0.6);
      if (Math.abs(p.pos.x - them.pos.x) > 7) this.endDuel(false, true);
      return;
    }
    // The Scrap Yard: to the stoppage. Down and out (or walk out of the pit) loses; put them down to win.
    if (d.kind === 'club') {
      if (them.isKO || them.vitals.health <= 0) this.endDuel(true, false);
      else if (p.isKO || p.vitals.health <= 0) {
        if (this.clubDownAt < 0) this.clubDownAt = this.sim.frame;
        // Let the knockdown land before the doctor's in.
        if (this.sim.frame - this.clubDownAt > SIM_HZ * 1.5) this.endDuel(false, false);
      } else if (Math.abs(p.pos.x - PIT.x) > PIT.w / 2 + 3) this.endDuel(false, true);
      return;
    }
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
    // The Scrap Yard: their fight's over, they're off out of the pit (and off the fight list).
    if (d.kind === 'club') {
      this.clubDownAt = -1;
      this.enemies = this.enemies.filter((e) => e !== f);
      this.koAt.delete(f);
      this.clubFoe = null;
    }
    const frames = this.sim.frame - d.started;
    this.duel = null;
    this.events.emit('duel:end', { kind: d.kind, id: d.id, won, stopped, landed: d.landed, blocked: d.blocked, seconds: Math.round(frames / SIM_HZ) });
  }

  // ---- the Scrap Yard fight club (fightclub/club.ts) -----------------------------------------

  /** The next opponent, waiting at the side of the pit (not in the fight list till the bell). */
  clubFoe: { f: Fighter; bout: Bout } | null = null;
  private clubDownAt = -1;
  /** The crowd round the pit. */
  private clubCrowd: Fighter[] = [];

  /** The fight's on in the pit now. */
  get clubBout(): boolean {
    return this.duel?.kind === 'club';
  }

  /** Into the Scrap Yard: the crowd round the pit, and tonight's opponent if you've a fight to have. */
  private setUpClub(): void {
    if (this.level.id !== 'fight_club') return;
    const p = this.progress;
    const r = new Rng(31 + p.save.trips * 7);
    // The crowd: along the back wall and either end of the pit, never on it.
    const spots = [
      { x: 8.4, z: -1.0 }, { x: 10.0, z: -1.15 }, { x: 11.7, z: -1.0 }, { x: 13.4, z: -1.15 }, { x: 15.1, z: -1.0 }, { x: 16.7, z: -1.1 },
      { x: PIT.x - PIT.w / 2 - 0.9, z: PIT.z + 0.6 }, { x: PIT.x - PIT.w / 2 - 1.1, z: PIT.z + 1.8 }, { x: PIT.x + PIT.w / 2 + 0.9, z: PIT.z + 1.4 },
    ];
    for (const sp of spots) {
      const body = r.next() < 0.25 ? 'female' : 'male';
      const look: CharacterAppearance = { ...randomAppearance(() => r.next(), body), accessories: [] };
      const f = new Fighter({ id: this.nextId++, name: '', team: 'neutral', attributes: defaultAttributes(5), style: getStyle('street'), x: sp.x, z: sp.z, appearance: look });
      f.facing = sp.x < PIT.x ? 1 : -1;
      f.background = true;
      this.sim.add(f);
      const brain = new DummyBrain(f, this.sim.rng);
      brain.mode = 'stand';
      this.brains.set(f, brain);
      this.clubCrowd.push(f);
    }
    clubTick(p);
    const bout = nextBout(p);
    if (!bout || foughtTonight(p)) return;
    const who = bout.who;
    const rr = new Rng(Math.floor(hash01(`club:${who.id}`) * 1e6) + 5);
    const a = ARCHETYPES[who.arch];
    const look: CharacterAppearance = { ...archetypeAppearance(a, Math.floor(rr.next() * 1e6)), body: who.body, accessories: ['wraps'] };
    if (who.body === 'female') Object.assign(look, randomAppearance(() => rr.next(), 'female'), { top: 'vest', bottoms: 'shorts', accessories: ['wraps'] });
    const f = new Fighter({
      id: this.nextId++,
      name: who.name,
      team: 'neutral',
      attributes: { strength: who.attr, speed: who.attr, endurance: who.attr, agility: who.attr, defence: who.attr, technique: who.attr },
      level: Math.max(1, who.attr - 5),
      style: getStyle(who.style),
      x: PIT_WAIT.x,
      z: PIT_WAIT.z,
      appearance: look,
      weapon: null,
    });
    f.tag = bout.kind === 'defence' ? 'Wants your belt' : bout.kind === 'title' ? (bout.rematch ? 'Has your belt' : 'Champion') : `“${who.nick}”`;
    f.facing = -1;
    this.sim.add(f);
    const brain = new DummyBrain(f, this.sim.rng);
    brain.mode = 'stand';
    this.brains.set(f, brain);
    this.clubFoe = { f, bout };
  }

  /**
   * The bell: you and them to your corners, and it's on. No weapons in the pit (yours goes in your pocket), no
   * crew (they watch). The buy-in's already paid (club.ts enterBout).
   */
  startClubFight(): { ok: boolean; reason?: string } {
    const c = this.clubFoe;
    if (!c || this.duel || this.activeEncounter) return { ok: false, reason: 'Nobody to fight' };
    if (this.player.weapon && !this.putAwayWeapon()) return { ok: false, reason: 'No weapons in the pit, and your pockets are full' };
    const { f, bout } = c;
    const who = bout.who;
    const p = this.player;
    p.pos = { x: PIT_CORNERS.you.x, y: 0, z: PIT_CORNERS.you.z };
    p.facing = 1;
    p.vitals.reset();
    f.pos = { x: PIT_CORNERS.them.x, y: 0, z: PIT_CORNERS.them.z };
    f.facing = -1;
    f.team = 'enemy';
    f.stats.addModifier({ id: 'club_health', source: 'club', flat: 'maxHealth', add: who.health });
    f.vitals.reset();
    const base = ARCHETYPES[who.arch];
    const a: Archetype = {
      ...base,
      style: who.style,
      weapon: undefined,
      cashDrop: 0,
      xp: 0,
      reactionFrames: Math.max(6, base.reactionFrames - Math.max(0, who.attr - 9)),
      blockChance: Math.min(0.6, base.blockChance + (who.attr - 9) * 0.02),
      aggression: Math.min(0.85, base.aggression + 0.1),
      // Champions and challengers fight like bosses: their whole bag of tricks.
      comboLength: Math.min(5, base.comboLength + (bout.kind === 'ladder' ? 0 : 1)),
    };
    this.enemies.push(f);
    this.brains.set(f, this.enemyBrain(f, a));
    this.duel = { f, kind: 'club', id: bout.kind === 'ladder' ? `ladder:${bout.rank}` : bout.kind, landed: 0, blocked: 0, started: this.sim.frame };
    this.clubDownAt = -1;
    this.say(f, [who.line]);
    this.events.emit('duel:start', { kind: 'club', name: who.name });
    return { ok: true };
  }

  /** XP from the fight club, levelling you up like any other (World.pay). */
  clubXp(xp: number): void {
    this.pay(0, xp);
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
      /**
       * Someone just hired (or won over) at their seat in the bar: they get up from there and walk over to you,
       * or, with no room in your crew, walk out of the door on their way home.
       */
      justHired?: string | null;
    },
  ) {
    progress.enterDistrict(level.district);
    // The tin's on the bedroom desk: in reach anywhere in your own house.
    progress.inHouse = level.id === 'home' || level.id === 'basement';
    // Fighters for hire wait at their seats only until they're on your side: then they're with you, or at home.
    const hired = new Set(progress.save.companions.recruited);
    const seats = (level.stations ?? []).filter((st) => st.id === 'recruit' && !!st.tab && hired.has(st.tab));
    this.stations = (level.stations ?? []).filter((st) => !seats.includes(st));
    // Every cashpoint is a cashpoint (money/atm.ts): stand in front of it to use it. The street ones are set into the
    // wall (not solid), so passers-by walk past them as they would the wall.
    // The machine's bank (Califax or Lloyd's THC) rides on the station's tab; before the second boss they're all out of service.
    for (const pr of level.props)
      if (pr.kind === 'atm') {
        const bank = bankOf(pr.label);
        this.stations.push({ id: 'atm', x: pr.x, z: Math.min(level.bounds.maxZ - 0.3, pr.z + 0.6), label: atmOpen(progress) ? `Use the ${bank.name} cash machine` : `${bank.name} cash machine (out of service)`, tab: bank.id });
      } else if (pr.kind === 'bank_front') {
        // The branch: its counter is through the door at the left end of the front (LevelView bank_front), where
        // you pay in and take out (money/banking.ts). Open from the start, unlike the machines.
        const bank = bankOf(pr.label);
        this.stations.push({ id: 'bank_counter', x: pr.x - propHalf(pr)[0] + 0.9, z: Math.min(level.bounds.maxZ - 0.3, pr.z + 0.6), label: `Into ${bank.name}`, tab: bank.id });
      }
    const obstacles: Obstacle[] = [];
    // On a kit street, what's drawn can be bigger than a prop's box (a kit car, a skip): collide with what you see.
    const drawn = streetSolids(level);
    const settle: PropDef[] = [];
    level.props.forEach((p, i) => {
      if (p.settle) settle.push(p);
      const box = propBox(p);
      if (!box) return;
      for (const d of drawn) if (d.prop === i) {
        box.minX = Math.min(box.minX, d.x0);
        box.maxX = Math.max(box.maxX, d.x1);
        box.minZ = Math.min(box.minZ, d.z0);
        box.maxZ = Math.max(box.maxZ, d.z1);
      }
      obstacles.push(box);
    });
    // Lamp columns at the kerb.
    for (const d of drawn) if (d.prop < 0) obstacles.push({ minX: d.x0, maxX: d.x1, minZ: d.z0, maxZ: d.z1 });
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
    for (const p of settle) {
      const [hx, hz] = propHalf(p);
      this.settleObstacle(`settle:${p.x}:${p.z}`, p.x, p.z, hx, hz);
    }
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
        (def.optional && !fightIsOn(def, level.id, progress.save.trips)) ||
        (!def.optional && (progress.has(this.clearedKey(def)) || (def.boss ? progress.has(BOSSES[def.boss].flag) : false)));
      this.encounters.push({ def, status: cleared ? 'cleared' : 'waiting', wave: 0, enemies: [], boss: null, bossDef: null, phasesDone: 0 });
    }
    // Boss rewards you had no room for are still where they fell.
    for (const k of progress.save.bossLoot) {
      if (k.area === level.id) this.items.push({ key: `g${this.itemSeq++}`, stack: k.stack, x: k.x, z: k.z, bornAt: -999, kept: true });
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
    // Jobs: the people at the far end of the one you're on, and maybe someone on the street with one for you.
    this.setUpJob();
    this.setUpClub();
    if (opts.civilians !== false) {
      this.setUpStreetGiver();
      this.setUpDealer();
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
      // Just hired: up from their seat (where you hired them), not out of thin air beside you.
      const seat = opts.justHired ? seats.find((st) => st.tab === opts.justHired) : undefined;
      const seatSpot = seat ? { x: seat.x, z: seat.z + (seat.npc?.dz ?? -0.9) } : undefined;
      list.forEach((d, i) => this.spawnCrew(d, 'beside', i, d.id === opts.justHired ? seatSpot : undefined));
      // No room in your crew: they finish their drink and head home, out of the door.
      if (seat && seatSpot && opts.justHired && !list.some((d) => d.id === opts.justHired)) {
        const def = COMPANIONS[opts.justHired];
        if (def) this.headHome(def, seatSpot);
      }
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
      // Putting an officer down goes on your record, whoever gets the last hit in.
      if (this.police.includes(fighter)) progress.logCrime('assault_police');
      if (this.mugLoot.has(fighter) && !this.assaulted.has(fighter)) {
        this.assaulted.add(fighter);
        progress.addHeatOf(HEAT.assault);
        progress.logCrime('assault');
        this.events.emit('assault', { name: fighter.name, heat: ASSAULT_HEAT });
      }
      this.koAt.set(fighter, this.sim.frame);
      this.tokens.release(fighter);
      if (fighter.team === 'enemy' && this.brains.get(fighter) instanceof FighterAI) progress.save.stats.kos++;
    });

    // Heat: if you're wanted, the police might be waiting for you on the street.
    // Not down the Scrap Yard: the police don't know it's there.
    const street = !['home', 'shop', 'pawn', 'pub'].includes(level.theme) && level.id !== 'fight_club';
    if (street && progress.save.heat >= 40 && this.lootRng.next() < progress.save.heat / 120) {
      // Kerrigan rings ahead: they'll be a while, and you know they're coming.
      const tipped = progress.save.police.contact;
      this.policeDue = { at: SIM_HZ * (tipped ? TIPOFF_SECONDS : 6), count: progress.save.heat >= 75 ? 3 : 2 };
      if (tipped) this.tipoff = TIPOFF_SECONDS;
    }
    // Gang heat: their crew may come looking for you a few seconds after you walk in (once a visit).
    const gang = progress.heatIn().gang;
    if (street && !level.deep && level.encounters.length && huntChance(gang) > 0 && this.lootRng.next() < huntChance(gang)) this.huntDue = SIM_HZ * (6 + this.lootRng.next() * 6);
  }

  /** Frame the district's crew turn up looking for you (gang heat), or null. */
  private huntDue: number | null = null;
  /** The lads they sent: put them all down and their grudge eases (HEAT.beatHunters). */
  private hunters: Fighter[] = [];

  /** Their crew's grudge on one of their lads (progress/heat.ts gangMods). */
  private applyGrudge(f: Fighter, g: { dealt: number; taken: number }): void {
    f.stats.addModifier({ id: 'grudge_dealt', source: 'grudge', stat: 'damageMult', mul: g.dealt });
    f.stats.addModifier({ id: 'grudge_taken', source: 'grudge', stat: 'damageTakenMult', mul: g.taken });
  }

  private updateHunt(): void {
    const frame = this.sim.frame;
    if (this.hunters.length && this.hunters.every((f) => f.isKO || !this.enemies.includes(f))) {
      if (this.hunters.some((f) => f.isKO)) {
        this.progress.addHeatOf(HEAT.beatHunters);
        this.events.emit('gang:beaten', { district: this.level.district, gang: this.progress.heatIn().gang });
      }
      this.hunters = [];
    }
    if (this.huntDue === null || frame < this.huntDue) return;
    // Not into the middle of something else: they wait.
    if (this.activeEncounter || this.locked || this.duel || this.player.isKO || this.progress.save.property.riding) {
      this.huntDue = frame + SIM_HZ * 3;
      return;
    }
    this.huntDue = null;
    const gang = this.progress.heatIn().gang;
    const n = gang >= 80 ? 3 : 2;
    const g = gangMods(gang);
    const p = this.player;
    const side = this.lootRng.next() < 0.5 ? -1 : 1;
    const ids: ArchetypeId[] = ['hothead', 'thug', 'brawler'];
    for (let i = 0; i < n; i++) {
      const f = this.spawnEnemy(ids[i % ids.length], this.spawnX(null, i) , this.spawnZ(i));
      // From off-screen, one side or both.
      f.pos.x = Math.max(this.arena.bounds.minX + 0.5, Math.min(this.arena.bounds.maxX - 0.5, p.pos.x + (i % 2 ? -side : side) * (9 + i)));
      if (g) this.applyGrudge(f, g);
      this.hunters.push(f);
    }
    this.events.emit('enemy:say', { fighter: this.hunters[0], text: ['There he is!', 'That’s him. Get him!', 'You’ve got some front coming back here.', 'Remember us?'][Math.floor(this.lootRng.next() * 4)], kind: 'taunt' });
    for (const c of this.civilians) c.brain.react(p.pos.x, frame);
    this.events.emit('gang:hunt', { district: this.level.district, count: n, gang });
  }

  /**
   * Jumped on the way somewhere (the run-there autopilot, travel/onFoot.ts): a few lads off the street come at you
   * from one side, an ordinary street fight. False if something's already going on.
   */
  ambush(n: number): boolean {
    const p = this.player;
    if (this.activeEncounter || this.locked || this.duel || p.isKO || this.policeActive || this.progress.save.property.riding) return false;
    if (this.enemies.some((e) => !e.isKO)) return false;
    const side = this.lootRng.next() < 0.5 ? -1 : 1;
    const ids: ArchetypeId[] = ['hooded', 'thug', 'runner'];
    const out: Fighter[] = [];
    for (let i = 0; i < n; i++) {
      const f = this.spawnEnemy(ids[i % ids.length], this.spawnX(null, i), this.spawnZ(i));
      f.pos.x = Math.max(this.arena.bounds.minX + 0.5, Math.min(this.arena.bounds.maxX - 0.5, p.pos.x + side * (7 + i * 1.4)));
      out.push(f);
    }
    this.events.emit('enemy:say', { fighter: out[0], text: ['Oi! Where d’you think you’re going?', 'Empty your pockets, mate.', 'Wrong street, pal.', 'You lost or something?'][Math.floor(this.lootRng.next() * 4)], kind: 'taunt' });
    for (const c of this.civilians) c.brain.react(p.pos.x, this.sim.frame);
    return true;
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

  /** The container being searched right now (the lock-up's door lifts while you open it). */
  get searchingId(): string | null {
    return this.searching > 0 ? this.searchTarget?.id ?? null : null;
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

  /** Is knocking out `f` the blow that wins the current fight? (The last one standing in the last wave, or the boss.) */
  isFinalBlow(f: Fighter): boolean {
    const e = this.activeEncounter;
    if (!e || !e.enemies.includes(f)) return false;
    if (e.boss) return f === e.boss;
    return e.wave >= e.def.waves.length - 1 && e.enemies.every((x) => x === f || x.isKO);
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
    // On a job: that's what you're doing (the phone's Jobs app still shows the story).
    const job = this.progress.save.jobs.active;
    if (job) {
      const t = timeLeft(this.progress);
      return `${objectiveOf(job)}${t !== null ? ` (${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')})` : ''}`;
    }
    const next = this.encounters.find((e) => e.status === 'waiting' && !e.def.optional && e.def.objective);
    if (next) return next.def.objective!;
    // Every fight here is won. If the way on needs more than that, say what, instead of the old "beat the boss" line.
    if (this.encounters.every((e) => e.def.optional || e.status === 'cleared')) {
      const shut = this.level.exits.find((e) => e.kind === 'edge' && e.requiresAll && exitLocked(e, this.progress));
      const need = shut ? gateNeeds(shut, this.progress, this.level.id)[0] : null;
      if (shut && need) return `${shut.label ?? 'The way on'} is locked: ${need.label}`;
      const on = this.level.exits.find((e) => e.kind === 'edge' && e.requiresAll && !exitLocked(e, this.progress));
      if (on) return `${on.label ?? 'The way on'} is open: head ${on.side === 'left' ? 'west' : 'east'}`;
    }
    return this.level.objective;
  }

  // ---- getting round things ----------------------------------------------------

  /** Which way (in depth) each fighter is going round the thing in front of them, and until when. */
  private detours = new Map<Fighter, { side: number; until: number }>();

  /**
   * Walking (or backing) straight into a bin, bench or car: rather than stop dead against it, step round it.
   * Finds the nearest clear line in depth (either side, up to 1.6 m) and adds the sideways step to the
   * command; the forward push stays, so you carry on the moment you're past. Only when you aren't already
   * steering in depth yourself, and nothing changes if there's no way round (a wall, a closed gate).
   */
  private steerAround(f: Fighter, cmd: CommandFrame, frame: number): CommandFrame {
    if (!f.isFree || f.anchored || !f.grounded || Math.abs(cmd.moveX) < 0.3 || Math.abs(cmd.moveZ) > 0.3) {
      this.detours.delete(f);
      return cmd;
    }
    const a = this.arena;
    const dir = Math.sign(cmd.moveX);
    const ahead = f.pos.x + dir * 0.15;
    const r = BODY_RADIUS;
    if (!a.blocked(ahead, f.pos.z, r)) {
      this.detours.delete(f);
      return cmd;
    }
    const b = a.bounds;
    const lo = b.minZ + r;
    const hi = b.maxZ - r;
    // Keep going round the way you started, so you don't dither at the corner.
    const held = this.detours.get(f);
    if (held && held.until > frame) return { ...cmd, moveZ: held.side };
    const clearRun = (z: number) => {
      if (z < lo || z > hi || a.blocked(ahead, z, r)) return false;
      for (let k = 1; k <= 4; k++) if (a.blocked(f.pos.x, f.pos.z + ((z - f.pos.z) * k) / 4, r * 0.9)) return false;
      return true;
    };
    for (let step = 0.1; step <= 1.6; step += 0.1) {
      const up = clearRun(f.pos.z - step);
      const down = clearRun(f.pos.z + step);
      if (!up && !down) continue;
      // Both open: go towards the middle of the pavement.
      const side = up && down ? (f.pos.z > (lo + hi) / 2 ? -1 : 1) : up ? -1 : 1;
      this.detours.set(f, { side, until: frame + 20 });
      return { ...cmd, moveZ: side };
    }
    return cmd;
  }

  // ---- per-frame update -------------------------------------------------------

  step(input: CommandFrame): void {
    if (this.settling.length) this.settleObstacles();
    const frame = this.sim.frame;
    let cmd = input;
    const p = this.player;

    // Searching a container: stand still until it's done.
    if (this.searching > 0) {
      cmd = { ...cmd, moveX: 0, moveZ: 0, block: false, pressed: { ...cmd.pressed, lp: false, hp: false, lk: false, hk: false, grab: false, jump: false, dodge: false } };
      if (p.isKO || p.state === 'hitstun' || p.state === 'knockdown') this.searching = 0;
      else if (--this.searching === 0 && this.searchTarget) this.finishSearch(this.searchTarget);
    }

    // USE and GRAB are separate. Out of a fight USE (E, the touch USE button, LB on a pad) uses what's in front of
    // you and nothing grabs. In a fight (sparring too) nothing is used: GRAB grabs, or, with nobody in reach, picks up
    // a weapon or item lying at your feet. (LB on a pad sends both; which one counts follows the same rule.)
    const fighting = this.fightOn || !!this.duel;
    if (fighting) {
      this.interactable = null;
      cmd = { ...cmd, use: false };
      if (cmd.pressed.grab && p.isFree && !p.isKO && this.searching <= 0 && !this.enemyInGrabRange()) {
        const it = this.findInteractable();
        if (it?.kind === 'item') {
          cmd = { ...cmd, pressed: { ...cmd.pressed, grab: false } };
          this.interact(it);
        }
      }
    } else {
      cmd = { ...cmd, pressed: { ...cmd.pressed, grab: false } };
      this.interactable = p.isKO || this.searching > 0 ? null : this.findInteractable();
      if (cmd.use && this.interactable && p.isFree) this.interact(this.interactable);
    }

    const commands = new Map<number, CommandFrame>();
    // Pussied out: you're off, flat out, whatever you press.
    if (this.bail && frame < this.bail.until) cmd = { ...emptyCommand(), moveX: this.bail.dir, run: true };
    else if (this.bail && this.bail.until > 0) {
      this.player.stats.removeModifier('bail_run');
      this.bail.until = 0;
    }
    commands.set(PLAYER_ID, this.steerAround(p, cmd, frame));
    // Passers-by find their own way round things (CivilianBrain); everyone else gets the same help as you.
    for (const [f, brain] of this.brains) {
      const grab = this.scrambleCommand(f, frame);
      commands.set(f.id, grab ?? (f.team === 'neutral' ? brain.think(frame) : this.steerAround(f, brain.think(frame), frame)));
    }
    this.endScramble(frame);
    this.sim.step(commands);
    this.holdInCell();
    this.updateStairGoers();

    this.syncHeld();
    this.collectDroppedWeapons();
    this.launchThrown();
    this.updateProjectiles();
    this.checkBreakables();
    this.collectCash();
    this.checkSecrets();
    this.updateEncounters();
    this.updatePolice();
    this.updateHunt();
    this.updateJob();
    this.updateDealer();
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
      const junk = this.items.findIndex((it) => it !== g && ITEMS[it.stack.id].value <= 2 && !ITEMS[it.stack.id].questFlag && !it.pickupId && !it.kept);
      if (junk >= 0) this.items.splice(junk, 1);
    }
    return g;
  }

  /** Leave a boss reward on the ground and remember it in the save until it is picked up. */
  private keepOnGround(stack: ItemStack, x: number, z: number): void {
    const g = this.dropOnGround(stack, x, z);
    g.kept = true;
    this.progress.save.bossLoot.push({ area: this.level.id, x: g.x, z: g.z, stack });
  }

  /** A kept reward was taken (all of it, or all but `rest`): bring the save's record in line. */
  private keptTaken(uid: string, rest: ItemStack | null): void {
    const list = this.progress.save.bossLoot;
    const i = list.findIndex((k) => k.stack.uid === uid);
    if (i < 0) return;
    if (rest) list[i] = { ...list[i], stack: rest };
    else list.splice(i, 1);
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
      if (c.bait) continue;
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

  /** Pussying out: you sprint off, they go for the money you threw down, then drift off. */
  bail: { dir: number; until: number; crew: Set<Fighter>; doneAt: number } | null = null;

  /** Can you pussy out right now? Not from a boss, the police, a duel or a spar; not on the floor or held. */
  canBail(): { ok: true; cost: number; share: number } | { ok: false; reason: string } {
    const p = this.player;
    if (!this.inFight) {
      // A new fight rolls a new price for running from it.
      this.bailShare = null;
      return { ok: false, reason: 'There’s nobody to run from' };
    }
    if (this.activeBoss || this.encounters.some((e) => e.status === 'active' && e.boss)) return { ok: false, reason: 'No running from a boss. Stand and fight.' };
    if (this.duel) return { ok: false, reason: 'You agreed to this one: see it through' };
    if (this.police.some((e) => !e.isKO)) return { ok: false, reason: 'You can’t pay off the police' };
    if (p.isKO || !p.isFree) return { ok: false, reason: 'Get up first' };
    const pocket = this.progress.save.cash.pocket;
    if (this.bailShare === null) {
      let share = this.lastBailShare;
      // Never the same as last time (to the nearest 5%), so it's a gamble every time.
      for (let i = 0; i < 6 && Math.abs(share - this.lastBailShare) < 0.05; i++) share = Math.round((BAIL_MIN + this.bailRng.next() * (BAIL_MAX - BAIL_MIN)) * 100) / 100;
      this.bailShare = this.lastBailShare = share;
    }
    const share = this.bailShare;
    return { ok: true, share, cost: pocket > 0 ? Math.max(1, Math.round(pocket * share)) : 0 };
  }

  /** This fight's price for running (a share of the cash on you), rolled the first time it's asked for. */
  private bailShare: number | null = null;
  private lastBailShare = 0;
  /** Its own dice, so running away never changes what fights drop. */
  private readonly bailRng = new Rng(0x5eed);

  get inFight(): boolean {
    const p = this.player;
    return !!this.activeEncounter || this.enemies.some((e) => !e.isKO && !this.bail?.crew.has(e) && Math.abs(e.pos.x - p.pos.x) < 9);
  }

  /**
   * Pussy out: throw down a share of the cash on you (BAIL_MIN–BAIL_MAX, rolled per fight) and leg it. They go for the money instead of
   * you, and you sprint off the screen. With nothing on you they let you go, but the district remembers: its next
   * fight comes at you twice as hard (grudgeKey). The fight is called off and starts again when you come back.
   */
  bailOut(): BailResult {
    const can = this.canBail();
    if (!can.ok) return can;
    const p = this.player;
    const frame = this.sim.frame;
    const e = this.activeEncounter;
    const crew = new Set<Fighter>(this.enemies.filter((f) => !f.isKO && (e?.enemies.includes(f) || Math.abs(f.pos.x - p.pos.x) < 9)));
    // Run away from them: from the middle of the crowd, or towards the open side if they're all one way.
    const mid = [...crew].reduce((a, f) => a + f.pos.x, 0) / Math.max(1, crew.size);
    const b = this.arena.bounds;
    let dir = p.pos.x >= mid ? 1 : -1;
    if ((dir > 0 && b.maxX - p.pos.x < 3) || (dir < 0 && p.pos.x - b.minX < 3)) dir = -dir;
    const dropped = can.cost;
    if (dropped > 0) {
      this.progress.save.cash.pocket -= dropped;
      // Scattered behind you, between you and them: notes and coins, out of your reach.
      const piles = Math.min(6, Math.max(2, Math.ceil(dropped / 15)));
      let left = dropped;
      for (let i = 0; i < piles; i++) {
        const amount = i === piles - 1 ? left : Math.max(1, Math.round(dropped / piles));
        left -= amount;
        if (amount <= 0) continue;
        const x = Math.max(b.minX + 0.3, Math.min(b.maxX - 0.3, p.pos.x - dir * (1.1 + i * 0.35) + (this.lootRng.next() - 0.5) * 0.4));
        const z = Math.max(b.minZ + 0.2, Math.min(b.maxZ - 0.2, p.pos.z + (this.lootRng.next() - 0.5) * 1.2));
        this.cash.push({ key: `c${this.itemSeq++}`, x, z, amount, def: null, bait: true });
      }
    }
    // Their crew don't forget it: a bit for running, a lot for running with nothing for them.
    this.progress.addHeatOf(dropped > 0 ? HEAT.bail : HEAT.bailBroke);
    // The fight's off; it'll be waiting when you come back (after they've finished with your money).
    if (e) {
      e.status = 'waiting';
      e.wave = 0;
      e.enemies = [];
      e.retryAt = frame + 8 * SIM_HZ;
    }
    this.arena.lock = null;
    for (const f of crew) this.tokens.release(f);
    p.stats.removeModifier('bail_run');
    p.stats.addModifier({ id: 'bail_run', source: 'bail', stat: 'moveSpeedMult', mul: 1.7 });
    this.bail = { dir, until: frame + Math.round(2.6 * SIM_HZ), crew, doneAt: frame + 7 * SIM_HZ };
    this.events.emit('bail', { dropped, grudge: dropped === 0 });
    const share = can.share;
    this.bailShare = null;
    return { ok: true, dropped, grudge: dropped === 0, share };
  }

  /** One of the crew you ran from: after the nearest of your money, then wandering off the other way. */
  private scrambleCommand(f: Fighter, frame: number): CommandFrame | null {
    if (!this.bail || !this.bail.crew.has(f) || f.isKO) return null;
    let best: CashPickup | null = null;
    let bd = Infinity;
    for (const c of this.cash) {
      if (!c.bait) continue;
      const d = Math.hypot(c.x - f.pos.x, c.z - f.pos.z);
      if (d < bd) {
        bd = d;
        best = c;
      }
    }
    if (best && bd < 0.45) {
      // Pocketed: gone.
      this.cash.splice(this.cash.indexOf(best), 1);
      return emptyCommand();
    }
    if (best) {
      const dx = best.x - f.pos.x;
      const dz = best.z - f.pos.z;
      const n = Math.max(1e-6, Math.hypot(dx, dz));
      return { ...emptyCommand(), moveX: dx / n, moveZ: dz / n, run: bd > 1.2 };
    }
    // Money's gone: off they go, away from where you ran.
    return frame < this.bail.doneAt ? { ...emptyCommand(), moveX: -this.bail.dir } : emptyCommand();
  }

  /** Once they've had the money and wandered off, they're gone (no loot: you didn't beat them). */
  private endScramble(frame: number): void {
    const b = this.bail;
    if (!b || frame < b.doneAt) return;
    for (const f of b.crew) {
      this.mugLoot.delete(f);
      this.sim.remove(f);
      this.brains.delete(f);
      this.tokens.release(f);
      this.enemies = this.enemies.filter((x) => x !== f);
    }
    // Whatever they didn't get to is swept up with them.
    for (let i = this.cash.length - 1; i >= 0; i--) if (this.cash[i].bait) this.cash.splice(i, 1);
    this.player.stats.removeModifier('bail_run');
    this.bail = null;
  }

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
      if (e.status === 'waiting' && crossed && !ridingPast && !this.activeEncounter && !p.isKO && this.sim.frame >= (e.retryAt ?? 0)) this.startEncounter(e);
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
      // You've taken on their boss: their crew are involved now (gang heat can rise) until you beat them.
      if (!this.progress.has(def.flag)) this.progress.gangProvoked();
      this.tune(e.boss, e, true);
      e.enemies.push(e.boss);
    }
    this.spawnWave(e);
    this.events.emit('encounter:start', { id: e.def.id, boss: e.bossDef });
    if (gangMods(this.progress.heatIn().gang)) this.events.emit('grudge', { district: this.level.district });
  }

  private spawnWave(e: EncounterState): void {
    const wave = e.def.waves[e.wave];
    if (!wave) return;
    const grudge = gangMods(this.progress.heatIn().gang);
    wave.enemies.forEach((spec, i) => {
      const f = this.spawnEnemy(spec.archetype, this.spawnX(e, i), this.spawnZ(i), spec.weapon);
      this.tune(f, e, false);
      if (grudge) this.applyGrudge(f, grudge);
      e.enemies.push(f);
    });
  }

  /** Main fights are tuned per fight (see fightTuning.ts); optional scraps keep their own numbers. */
  private tune(f: Fighter, e: EncounterState, boss: boolean): void {
    if (e.def.optional) return;
    const s = fightStrength(this.level.id, e.def.id);
    f.stats.addModifier({ id: 'tune_taken', source: 'tuning', stat: 'damageTakenMult', mul: (boss ? BOSS_DAMAGE_TAKEN : ENEMY_DAMAGE_TAKEN) / s });
    if (s !== 1) f.stats.addModifier({ id: 'tune_dealt', source: 'tuning', stat: 'damageMult', mul: s });
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
    // Their crew: beat their boss and they're finished with you; beat them while they're after you and some of
    // that settles; pick fights when they weren't bothered and they start to be.
    if (e.bossDef) this.progress.gangDone();
    else this.progress.addHeatOf(gangMods(this.progress.heatIn().gang) ? { gang: -15 } : HEAT.beatCrew);
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
      const left: string[] = [];
      if (first) {
        this.progress.set(e.bossDef.flag);
        this.progress.save.stats.bosses++;
        cash += e.bossDef.reward.cash;
        xp += e.bossDef.reward.xp;
        // Unique drops: straight into your pockets. If they're full, the reward lands by the boss
        // and the save remembers it, so it is never lost by leaving, going home or closing the game.
        (e.bossDef.drops ?? []).forEach((id, i) => {
          if (!ITEMS[id]) return;
          const over = this.progress.giveItem(id);
          if (over) {
            this.keepOnGround(over, e.boss!.pos.x + (i - 0.5) * 0.7, e.boss!.pos.z + 0.35);
            left.push(ITEMS[id].name);
          } else items.push(`${ITEMS[id].name}${JEWEL_ITEMS[id] ? ' (in your jewellery box)' : ''}`);
        });
      }
      this.pay(cash, xp);
      const worth = first ? bossDropValue(e.bossDef.drops ?? []) : 0;
      this.events.emit('boss:defeated', { boss: e.bossDef, first, cash, xp, items, left, worth });
      return;
    }
    this.pay(cash, xp);
    // Second wind: winning a main fight gets you back up to at least half health for the next one.
    let secondWind = false;
    const v = this.player.vitals;
    if (!def.optional && !this.player.isKO && v.health < v.maxHealth * SECOND_WIND) {
      v.health = Math.round(v.maxHealth * SECOND_WIND);
      secondWind = true;
    }
    this.events.emit('encounter:cleared', { id: def.id, cash, xp, optional: def.optional, secondWind });
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
    this.brains.set(f, this.enemyBrain(f, brain));
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
      phase.summon?.forEach((s, i) => {
        const f = this.spawnEnemy(s.archetype, this.spawnX(e, i + 1), this.spawnZ(i + 1), s.weapon);
        this.tune(f, e, false);
        e.enemies.push(f);
      });
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

  /**
   * Enemies in the towns past Hale House: the same kinds of fighter, but each town out they are
   * stronger all round, quicker to react, readier to block and they throw longer combinations.
   */
  private toughened(a: Archetype, id: ArchetypeId): Archetype {
    const t = this.level.threat ?? 0;
    if (!t || id === 'police') return a;
    const up = (n: number): number => n + t;
    const at = a.attributes;
    return {
      ...a,
      level: a.level + t,
      attributes: { strength: up(at.strength), speed: up(at.speed), endurance: up(at.endurance), agility: up(at.agility), defence: up(at.defence), technique: up(at.technique) },
      reactionFrames: Math.max(6, a.reactionFrames - t * 2),
      blockChance: Math.min(0.6, a.blockChance + t * 0.03),
      aggression: Math.min(0.85, a.aggression + t * 0.03),
      comboLength: Math.min(5, a.comboLength + (t >= 3 ? 1 : 0)),
    };
  }

  spawnEnemy(id: ArchetypeId, x: number, z: number, weapon?: WeaponId, name?: string, look?: CharacterAppearance): Fighter {
    ({ x, z } = this.freeSpot(x, z));
    const a = this.toughened(ARCHETYPES[id], id);
    // Grunts get a first name (picked from their id, so the same fight names the same lads), with
    // their type under the bar; bosses and the rest keep the archetype's name.
    const named = NAMED_GRUNTS.has(id);
    const first = GRUNT_NAMES.male[(this.nextId * 7 + this.level.id.length * 3) % GRUNT_NAMES.male.length];
    const f = new Fighter({
      id: this.nextId++,
      name: name ?? (named ? first : a.name),
      team: 'enemy',
      attributes: { ...a.attributes },
      level: a.level,
      style: getStyle(a.style),
      secondaryStyle: a.secondaryStyle ? getStyle(a.secondaryStyle) : null,
      x,
      z,
      appearance: look ?? archetypeAppearance(a, this.nextId * 7919 + this.level.id.length),
      weapon: weapon ?? a.weapon ?? null,
    });
    if (named) f.tag = a.name;
    f.facing = x > this.player.pos.x ? -1 : 1;
    this.sim.add(f);
    this.enemies.push(f);
    this.brains.set(f, this.enemyBrain(f, { ...a }));
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
    if (n.skinTone) look.skinTone = n.skinTone;
    if (n.hair) look.hair = n.hair as HairStyle;
    if (n.hairColour) look.hairColour = n.hairColour;
    if (n.tattoos) look.tattoos = { ...look.tattoos, ...(n.tattoos as Partial<CharacterAppearance['tattoos']>) };
    // Sully runs the Scrap Yard: he looks like himself, not a stranger with his name.
    if (s.id === 'fight_club') Object.assign(look, BOSSES.sully.appearance);
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
    // Behind a counter or in a corner: background people, except someone you might hire (they'll fight beside you).
    f.background = s.id !== 'recruit' && !n.tattoos;
    this.sim.add(f);
    const brain = new DummyBrain(f, this.sim.rng);
    brain.mode = 'stand';
    this.brains.set(f, brain);
    this.npcs.set(s, f);
  }

  private lastEnemySay = -9999;

  /** An enemy's brain, with its shouts going to speech bubbles (rationed so a crowd doesn't chatter). */
  private enemyBrain(f: Fighter, a: Archetype): FighterAI {
    const brain = new FighterAI(f, a, this.sim.rng, this.tokens, this.arena);
    brain.onSay = (text, kind) => {
      // A jump-in warning always gets through quickly: it's how you know to turn round.
      const gap = kind === 'warn' ? 45 : 200;
      if (this.sim.frame - this.lastEnemySay < gap) return;
      this.lastEnemySay = this.sim.frame;
      this.events.emit('enemy:say', { fighter: f, text, kind });
    };
    return brain;
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
    if (this.tipoff) {
      this.events.emit('police:tipoff', { seconds: this.tipoff });
      this.tipoff = 0;
    }
    this.updateLeaving();
    if (!this.policeDue || this.policeSpawned || this.sim.frame < this.policeDue.at) return;
    this.policeSpawned = true;
    const n = this.policeDue.count;
    // The district's own officers, in turn: you keep meeting the same faces.
    const district = this.level.district;
    const first = this.progress.save.trips * 2 + this.police.length;
    let lead: Cop | null = null;
    for (let i = 0; i < n; i++) {
      const cop = copFor(district, first + i);
      const f = this.spawnEnemy('police', this.spawnX(null, i), this.spawnZ(i), undefined, cop.name);
      f.tag = 'Police';
      this.copOf.set(f, cop);
      this.police.push(f);
      lead ??= cop;
    }
    const talk = !this.duel && !this.activeEncounter && !this.player.isKO;
    this.events.emit('police:arrive', { count: n, lead: lead!.name, known: this.progress.save.police.known[lead!.name] ?? null, talk });
  }

  /** The officers on the street now, still standing. */
  private standingPolice(): Fighter[] {
    return this.police.filter((f) => !f.isKO && !this.leaving.has(f));
  }

  /** What a bung costs the officers here now. */
  bungPrice(): number {
    return bungPrice(this.progress.save.heat, Math.max(1, this.standingPolice().length));
  }

  /**
   * Have a word: offer the lead officer a bung. A bent one takes it, they all walk off and the district cools; a
   * straight one won't have it (bribery on your record, more heat, and they come at you harder). 'broke': you
   * haven't got it on you in cash (nothing happens).
   */
  bung(): 'taken' | 'refused' | 'broke' {
    const cops = this.standingPolice();
    const lead = cops[0];
    const cop = lead ? this.copOf.get(lead) : undefined;
    if (!lead || !cop) return 'refused';
    const p = this.progress;
    const price = this.bungPrice();
    // A bung is cash in hand.
    if (!p.canAfford(price, 'cash')) return 'broke';
    p.save.police.known[cop.name] = cop.bent ? 'bent' : 'straight';
    if (cop.bent) {
      p.pay(price, 'cash');
      p.setHeat('police', Math.max(0, p.heatIn().police - BUNG_COOL), this.level.district);
      for (const f of cops) this.walkOff(f);
      this.policeDue = null;
      return 'taken';
    }
    p.logCrime('bribery');
    p.addHeatOf({ police: BRIBERY_HEAT });
    for (const f of cops) {
      f.stats.addModifier({ id: 'bribed_dealt', source: 'bribery', stat: 'damageMult', mul: REFUSED_DEALT });
      f.stats.addModifier({ id: 'bribed_taken', source: 'bribery', stat: 'damageTakenMult', mul: REFUSED_TAKEN });
    }
    return 'refused';
  }

  /** Hired with no room in your crew: they get up and walk out of the door, home, and are gone. */
  private headHome(def: CompanionDef, from: { x: number; z: number }): void {
    const door = this.level.exits.find((e) => e.kind === 'door') ?? this.level.exits[0];
    const f = companionFighter(this.progress, def, this.nextId++, from.x, from.z);
    f.team = 'neutral';
    const doorX = door ? door.x : this.arena.bounds.minX;
    const dir = doorX < from.x ? -1 : 1;
    f.facing = dir;
    this.sim.add(f);
    this.brains.set(f, new LeaveBrain(dir));
    // Gone at the door, or after long enough to have got there.
    this.leaving.set(f, this.sim.frame + Math.ceil(SIM_HZ * (Math.abs(doorX - from.x) / 1.2 + 2)));
    this.exitAt.set(f, doorX);
  }

  /** Where someone walking out is heading (they go when they reach it). */
  private readonly exitAt = new Map<Fighter, number>();

  /** Off they go, the way they're facing away from you, and out of the fight. */
  private walkOff(f: Fighter): void {
    const dir = f.pos.x >= this.player.pos.x ? 1 : -1;
    this.brains.set(f, new LeaveBrain(dir));
    this.tokens.release(f);
    this.enemies = this.enemies.filter((x) => x !== f);
    const i = this.police.indexOf(f);
    if (i >= 0) this.police.splice(i, 1);
    f.team = 'neutral';
    this.leaving.set(f, this.sim.frame + SIM_HZ * 5);
  }

  private updateLeaving(): void {
    for (const [f, until] of this.leaving) {
      const door = this.exitAt.get(f);
      const there = door !== undefined && Math.abs(f.pos.x - door) < 0.7;
      if (this.sim.frame < until && !there) continue;
      this.leaving.delete(f);
      this.exitAt.delete(f);
      this.brains.delete(f);
      this.sim.remove(f);
    }
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
      const mugged = this.mugLoot.get(f);
      if (mugged) {
        // Whoever you mugged fought for it and lost: it's all on the floor, hot.
        this.mugLoot.delete(f);
        mugged.items.forEach((id, k) => this.dropOnGround(this.progress.newStack(id, 1, { stolen: true }), f.pos.x + (k - mugged.items.length / 2) * 0.35, f.pos.z + 0.15 * (k % 2)));
        if (mugged.cash > 0) this.cash.push({ key: `c${this.itemSeq++}`, x: f.pos.x, z: f.pos.z - 0.15, amount: mugged.cash, def: null });
      } else if (kind !== 'shopkeeper') this.spillLoot(lootTableFor(kind), f.pos.x, f.pos.z);
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
      // On the door you can see: the kit may draw it a little along from the exit's own spot.
      options.push({ kind: 'exit', x: doorX(this.level, ex.x), z: ex.z, label: ex.label, exit: ex, locked: exitLocked(ex, this.progress) });
    }
    for (const l of this.level.levers ?? []) options.push({ kind: 'lever', x: l.x, z: l.z, label: l.label, lever: l, done: this.progress.has(l.sets) });
    for (const s of this.stations) {
      if (s.id === 'sparring' && (this.duel || !this.sparPartner)) continue;
      if (s.id === 'recruit' && this.duel) continue;
      // The Metro: the train's doors only while one's in; the board otherwise.
      if (s.id === 'metro_train' || s.id === 'metro_board') {
        const v = metroVisit();
        const train = !!v?.train && !v.arrived;
        if (s.id === 'metro_train' && !train) continue;
        if (s.id === 'metro_board' && train) continue;
      }
      const npc = this.npcs.get(s);
      if (npc && (npc.team !== 'neutral' || npc.isKO)) continue;
      options.push({ kind: 'station', x: s.x, z: s.z, label: s.label, station: s, closed: !!s.shop && !this.progress.isShopOpen(s.shop) });
    }
    for (const o of this.jobOptions()) options.push(o);
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
      // A door is drawn on the wall behind its exit spot: anywhere in front of it, from the wall out to the spot, counts.
      const ox = o.kind === 'exit' ? Math.max(o.x - 0.55, Math.min(o.x + 0.55, p.pos.x)) : o.x;
      const oz = o.kind === 'exit' ? Math.max(this.arena.bounds.minZ, Math.min(o.z, p.pos.z)) : o.z;
      let d = Math.hypot(ox - p.pos.x, (oz - p.pos.z) * 1.2);
      if (o.kind === 'container' && o.empty) d += 0.4; // prefer something useful
      if (o.kind === 'job') d -= 0.25; // the person you came to see, over a door behind them
      if (d > range || d >= bestD) continue;
      // No using things through walls.
      if (d > 0.05 && this.arena.lineBlocked(p.pos.x, p.pos.z, ox, oz)) continue;
      best = o;
      bestD = d;
    }
    return best ?? this.findPunter() ?? this.findMuggable();
  }

  // ---- dealing (business/dealing.ts) ---------------------------------------------------------------------------

  /** About this share of passers-by are punters, when you've got something to sell. */
  static readonly PUNTER_SHARE = 0.3;
  private served = new WeakSet<Fighter>();
  private soldHere = false;

  /** Is this passer-by after something, and what? Fixed for the person and the trip. */
  private punterWants(f: Fighter, have: Record<Drug, number>): { drug: Drug; qty: number } | null {
    if (this.served.has(f) || this.mugged.has(f)) return null;
    const h = (salt: string) => hash01(`punter:${f.id}:${this.progress.save.trips}:${salt}`);
    if (h('is') >= World.PUNTER_SHARE) return null;
    const east = this.east();
    // What they're after: weed most, pills next, coke more the further east you are.
    const weights: Record<Drug, number> = { weed: 0.5, pills: 0.3, coke: 0.2 + 0.04 * east };
    const want = DRUGS.filter((d) => have[d] > 0);
    if (!want.length) return null;
    const total = want.reduce((n, d) => n + weights[d], 0);
    let r = h('drug') * total;
    let drug = want[0];
    for (const d of want) {
      if (r < weights[d]) {
        drug = d;
        break;
      }
      r -= weights[d];
    }
    return { drug, qty: Math.min(have[drug], 1 + Math.floor(h('qty') * 3)) };
  }

  /** How far east this street is (strip steps past the estate). */
  private east(): number {
    return Math.max(0, stripIndex(stripAreaOf(this.level.id)) - stripIndex('estate'));
  }

  /** Punters about (for the badges over their heads). */
  punters(): Fighter[] {
    if (!dealingOpen(this.progress) || this.inFight || this.level.deep) return [];
    const have = dealsOnYou(this.progress);
    if (!DRUGS.some((d) => have[d] > 0)) return [];
    return this.civilians.filter((c) => c.brain.activity !== 'flee' && !c.f.isKO && this.punterWants(c.f, have)).map((c) => c.f);
  }

  /** A punter close enough to sell to, when you're carrying something they want. */
  private findPunter(): Interactable | null {
    const p = this.player;
    if (!dealingOpen(this.progress) || this.inFight || this.duel || this.locked || this.progress.save.property.riding) return null;
    const have = dealsOnYou(this.progress);
    if (!DRUGS.some((d) => have[d] > 0)) return null;
    let best: { f: Fighter; drug: Drug; qty: number } | null = null;
    let bd = 1.1;
    for (const c of this.civilians) {
      if (c.brain.activity === 'flee' || c.f.isKO) continue;
      const d = Math.hypot(c.f.pos.x - p.pos.x, (c.f.pos.z - p.pos.z) * 1.2);
      if (d >= bd || this.arena.lineBlocked(p.pos.x, p.pos.z, c.f.pos.x, c.f.pos.z)) continue;
      const w = this.punterWants(c.f, have);
      if (!w) continue;
      best = { f: c.f, ...w };
      bd = d;
    }
    if (!best) return null;
    const each = streetPrice(this.progress, best.drug, this.level.district, this.east(), competition(this.progress, this.level.district));
    const dd = DRUG_DEFS[best.drug];
    const what = best.qty > 1 ? `${best.qty} ${dd.dealPlural}` : dd.dealName.toLowerCase();
    return { kind: 'deal', x: best.f.pos.x, z: best.f.pos.z, label: `Sell: ${what} £${each * best.qty}`, target: best.f, drug: best.drug, qty: best.qty, price: each * best.qty };
  }

  /** Sell to a punter: the money, a bit of XP, heat, and now and then it's the police. */
  private sellTo(it: Extract<Interactable, { kind: 'deal' }>): void {
    const p = this.progress;
    const c = this.civilians.find((x) => x.f === it.target);
    if (!c || this.served.has(it.target)) return;
    if (!takeFromPockets(p, DRUG_DEFS[it.drug].dealItem, it.qty)) return;
    this.served.add(it.target);
    const h = p.heatIn();
    const undercover = this.lootRng.next() < undercoverChance(h.police);
    p.addHeatOf({ police: SALE_HEAT.police * it.qty, street: SALE_HEAT.street * it.qty }, this.level.district);
    if (!this.soldHere || undercover) p.logCrime('dealing', this.level.district);
    this.soldHere = true;
    if (undercover) {
      // Plain clothes: the money's evidence, and the van's round the corner.
      this.say(it.target, ['Police! Stay where you are!', 'You’re nicked, son. Hands where I can see them.', 'Wrong customer, mate. Police!']);
      p.addHeatOf({ police: 25 }, this.level.district);
      this.policeDue = { at: this.sim.frame + 3 * SIM_HZ, count: 2 };
      this.policeSpawned = false;
      c.brain.bolt(this.player.pos.x, this.sim.frame);
    } else {
      p.addCash(it.price);
      recordSale(p, it.drug, it.qty, it.price, this.level.district);
      const levels = p.addXp(2 * it.qty);
      if (levels > 0) {
        this.player.stats.level = p.save.level;
        this.events.emit('level:up', { level: p.save.level });
      }
      this.say(it.target, ['Cheers, mate.', 'Sound. Same again next week?', 'Nice one.', 'Lovely. Keep it quiet, yeah?']);
    }
    this.events.emit('deal:sold', { drug: it.drug, qty: it.qty, price: undercover ? 0 : it.price, undercover });
  }

  /** People you've already mugged (they're running, or they've had their go). */
  private mugged = new WeakSet<Fighter>();
  /** What a passer-by who fought back had on them: dropped when you put them down. */
  private mugLoot = new Map<Fighter, { items: string[]; cash: number }>();
  private assaulted = new WeakSet<Fighter>();
  private knownSaid = false;

  /**
   * Someone close enough to mug, when there's nothing else to use: out of a fight, on foot, and only people
   * walking about or stood (not anyone already running from trouble).
   */
  private findMuggable(): Interactable | null {
    const p = this.player;
    if (this.inFight || this.duel || this.locked || this.progress.save.property.riding) return null;
    let best: Fighter | null = null;
    let bd = 1.05;
    for (const c of this.civilians) {
      if (this.mugged.has(c.f) || c.brain.activity === 'flee' || c.f.isKO) continue;
      const d = Math.hypot(c.f.pos.x - p.pos.x, (c.f.pos.z - p.pos.z) * 1.2);
      if (d >= bd || this.arena.lineBlocked(p.pos.x, p.pos.z, c.f.pos.x, c.f.pos.z)) continue;
      best = c.f;
      bd = d;
    }
    if (!best) return null;
    const a = best.appearance;
    const him = a.body === 'female' ? 'her' : 'him';
    // You don't know what's in their pockets till you try.
    const label = `Mug ${him}`;
    return { kind: 'mug', x: best.pos.x, z: best.pos.z, label, target: best };
  }

  /**
   * Mug a passer-by. They either hand it all over and leg it (what they're wearing and their wallet, dropped at
   * their feet, marked stolen), or square up and fight for it, and you get it off them when they're down. Either
   * way it's heat (MUG_HEAT), and everyone about sees it.
   */
  mug(target: Fighter): { resisted: boolean; items: string[]; cash: number } | null {
    const i = this.civilians.findIndex((c) => c.f === target);
    if (i < 0 || this.mugged.has(target)) return null;
    const c = this.civilians[i];
    const p = this.player;
    const rng = this.lootRng;
    const a = target.appearance;
    const male = a.body !== 'female';
    const streak = this.progress.mugStreak(this.level.district);
    const { items, cash } = mugHaul(() => rng.next(), a, streak);
    this.progress.noteMugging(this.level.district);
    // What they're seen wearing makes them likelier to fight, whatever they'd actually hand over.
    const worth = valuablesOf(a).reduce((t, id) => t + (ITEMS[id]?.value ?? 0), 0) + cash;
    const resisted = rng.next() < mugResistChance(c.brain.temper, male, worth, this.progress.save.level);
    this.mugged.add(target);
    // Who saw it (before they scatter): each one is someone who'll describe you.
    const witnesses = this.civilians.filter((o) => o !== c && !o.f.isKO && Math.abs(o.f.pos.x - target.pos.x) < 9);
    const wasKnown = this.progress.heatIn().street >= KNOWN_FACE_HEAT;
    // A street that's just been worked notices quicker: each mugging here in a while adds half again.
    const again = 1 + 0.5 * streak;
    const heat = Math.round((HEAT.mug.police + witnesses.length * HEAT.witness.police) * again);
    const h = this.progress.addHeatOf({ police: heat, street: Math.round((HEAT.mug.street + witnesses.length * HEAT.witness.street) * again) });
    this.progress.logCrime('mugging');
    target.facing = p.pos.x < target.pos.x ? -1 : 1;
    const say = (f: Fighter, lines: string[]) => this.events.emit('enemy:say', { fighter: f, text: lines[Math.floor(rng.next() * lines.length)], kind: 'taunt' });
    if (resisted) {
      this.squareUp(c, c.brain.temper === 'steady' && male ? 'brawler' : 'thug', { items, cash });
      say(target, male ? ['You what? Come on then!', 'Try it, pal.', 'Not a chance. Come on!', 'You picked the wrong one.'] : ['Get your hands off me!', 'Try it. Go on.', 'Not a chance!']);
    } else {
      // Handed over: dropped at their feet, and they're off.
      const dir = target.pos.x >= p.pos.x ? 1 : -1;
      items.forEach((id, k) => this.dropOnGround(this.progress.newStack(id, 1, { stolen: true }), target.pos.x - dir * 0.35 + (k - items.length / 2) * 0.3, target.pos.z + 0.12 * (k % 2)));
      this.cash.push({ key: `c${this.itemSeq++}`, x: target.pos.x - dir * 0.2, z: target.pos.z - 0.1, amount: cash, def: null });
      c.brain.bolt(p.pos.x, this.sim.frame);
      say(target, ['Alright! Take it, take it!', 'Don’t hurt me, here!', 'Have it! Just have it!', 'Fine! It’s yours!']);
    }
    // A have-a-go hero: someone steady and close by won't just stand and watch.
    const hero = witnesses.find((o) => o.brain.temper === 'steady' && o.f.appearance.body !== 'female' && !this.mugged.has(o.f) && Math.abs(o.f.pos.x - p.pos.x) < 7);
    let stepped: Fighter | null = null;
    if (hero && rng.next() < heroChance(h.street)) {
      stepped = hero.f;
      this.mugged.add(hero.f);
      this.squareUp(hero, 'brawler', { items: [], cash: Math.round(5 + rng.next() * 20) });
      say(hero.f, ['Oi! Leave them alone!', 'Pick on someone your own size!', 'Not on my street, pal.', 'Right, you. Come here.']);
    }
    // Someone rings the police.
    let police: number | null = null;
    if (!this.policeDue && rng.next() < policeCallChance(witnesses.length, h.street, h.police)) {
      const wanted = h.police >= ARREST_HEAT;
      police = Math.round(wanted ? 12 : 20 + rng.next() * 15);
      this.policeDue = { at: this.sim.frame + police * SIM_HZ, count: wanted ? 3 : 2 };
      this.policeSpawned = false;
    }
    for (const o of this.civilians) if (Math.abs(o.f.pos.x - target.pos.x) < 9) o.brain.react(target.pos.x, this.sim.frame);
    this.events.emit('mug', { name: target.name, resisted, items, cash, heat, witnesses: witnesses.length, hero: stepped?.name ?? null, police, known: !wasKnown && h.street >= KNOWN_FACE_HEAT });
    return { resisted, items, cash };
  }

  /** A passer-by off the street and into a fight: their walking pace goes, they fight at full speed, with a name. */
  private squareUp(c: { f: Fighter; brain: CivilianBrain }, arch: ArchetypeId, loot: { items: string[]; cash: number }): void {
    const f = c.f;
    c.brain.release();
    const i = this.civilians.indexOf(c);
    if (i >= 0) this.civilians.splice(i, 1);
    f.stats.removeModifier('stroll');
    f.stats.removeModifier('civ_hurry');
    this.turnHostile(f, arch);
    this.archetypeOf.set(f, 'mugged');
    this.mugLoot.set(f, loot);
    const names = f.appearance.body === 'female' ? GRUNT_NAMES.female : GRUNT_NAMES.male;
    (f as { name: string }).name = names[f.id % names.length];
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
      case 'mug':
        this.mug(it.target);
        return;
      case 'job':
        this.talkJob(it.f, it.role);
        return;
      case 'dealer':
        it.f.facing = this.player.pos.x < it.f.pos.x ? -1 : 1;
        this.events.emit('dealer:talk', { name: it.f.name, district: this.level.district });
        return;
      case 'deal':
        this.sellTo(it);
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
      if (g.kept) this.keptTaken(stack.uid, null);
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
    const uid = stack.uid;
    const left = this.progress.pocket(stack);
    if (left) this.items.splice(idx, 0, { ...g, stack: left });
    if (g.kept) this.keptTaken(uid, left);
    this.markPickupTaken(g);
    this.events.emit('item:picked', { name: d.name, qty: qty - (left?.qty ?? 0), rarity: d.rarity, stolen: !!stack.stolen, jewel: !!JEWEL_ITEMS[d.id] && !stack.stolen });
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
  /** Sim frame of the last stamina booster, and how many this fight (see BOOSTS_PER_FIGHT). */
  private boostAt = -Infinity;
  private boostsThisFight = 0;
  private boostFighting = false;

  /** The booster cap for the fight you're in: how many more you can take (null out of a fight). */
  get boostsLeft(): number | null {
    this.syncBoostFight();
    if (!this.boostFighting) return null;
    const cap = this.activeBoss || this.encounters.some((e) => e.status === 'active' && e.boss) ? BOOSTS_PER_BOSS : BOOSTS_PER_FIGHT;
    return Math.max(0, cap - this.boostsThisFight);
  }

  /** The wait after a booster, 1 just taken .. 0 ready. */
  get boostWait(): number {
    return Math.max(0, 1 - (this.sim.frame - this.boostAt) / (BOOST_COOLDOWN * SIM_HZ));
  }

  /** A new fight starts the count again. */
  private syncBoostFight(): void {
    const now = this.inFight;
    if (now && !this.boostFighting) this.boostsThisFight = 0;
    this.boostFighting = now;
  }

  useItem(uid: string): { ok: boolean; text: string } {
    const st = this.progress.save.inventory.find((x) => x.uid === uid);
    const boost = !!(st && ITEMS[st.id]?.boost);
    if (boost) {
      const left = this.boostsLeft;
      if (left === 0) return { ok: false, text: this.activeBoss ? `No more boosters this fight (${BOOSTS_PER_BOSS} against a boss)` : `No more boosters this fight (${BOOSTS_PER_FIGHT} a fight)` };
      if (this.boostWait > 0) return { ok: false, text: `Booster in ${Math.ceil((this.boostWait * BOOST_COOLDOWN))} s` };
    }
    const r = this.progress.use(uid);
    if (r.ok && boost) {
      this.boostAt = this.sim.frame;
      if (this.boostFighting) this.boostsThisFight++;
    }
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

  /** Sim frame of the last medical or food use from the hotbar: a short wait between them, so healing is a choice in a fight, not a button to mash. */
  private hotbarAt = -Infinity;

  /** How much of the wait after a medical or food use is left, 1 just used .. 0 ready. */
  get hotbarWait(): number {
    return Math.max(0, 1 - (this.sim.frame - this.hotbarAt) / (HOTBAR_COOLDOWN * SIM_HZ));
  }

  /**
   * Use a hotbar slot (items/hotbar.ts), in or out of a fight: patch up, eat or drink the slot's item, or draw
   * its weapon (put it away when it's the one in your hands and there's no other). Afterwards the slot keeps its
   * item, or pulls in the next suitable thing from your pockets when that was the last of it.
   */
  useHotbar(slot: HotbarSlot): { ok: boolean; text: string; next?: string | null } {
    const p = this.player;
    if (p.vitals.health <= 0 || !p.isFree) return { ok: false, text: 'Not now' };
    // The wait is for patching up and eating; drawing or putting away a weapon never waits on it.
    if (slot !== 'weapon' && this.sim.frame - this.hotbarAt < HOTBAR_COOLDOWN * SIM_HZ) return { ok: false, text: 'Hang on' };
    const s = this.progress.save;
    const v = hotbarView(s, slot);
    let r: { ok: boolean; text: string };
    if (slot === 'weapon') {
      if (v.stack) {
        const name = ITEMS[v.stack.id].name;
        r = this.holdFromInventory(v.stack.uid) ? { ok: true, text: `${name} out` } : { ok: false, text: 'Can’t right now' };
      } else if (v.inHand) {
        const name = ITEMS[v.inHand.id].name;
        r = this.putAwayWeapon() ? { ok: true, text: `${name} away` } : { ok: false, text: 'Your pockets are full' };
      } else r = { ok: false, text: 'No weapon on you' };
    } else if (!v.stack) {
      r = { ok: false, text: slot === 'medic' ? 'Nothing to patch up with' : slot === 'stamina' ? 'Nothing to get your legs back' : 'Nothing to eat or drink' };
    } else r = this.useItem(v.stack.uid);
    if (!r.ok) return r;
    if (slot !== 'weapon') this.hotbarAt = this.sim.frame;
    const next = refillHotbar(s, slot);
    this.events.emit('hotbar:used', { slot });
    return { ...r, next };
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
    // The next district on the long street: keep walking, there is nothing to push against.
    if (ex.seam && !exitLocked(ex, this.progress)) return this.requestExit(ex);
    this.edgePush++;
    if (this.edgePush < 12) return;
    if (exitLocked(ex, this.progress)) {
      if (this.sim.frame - this.lockedMsgAt > 2 * SIM_HZ) {
        this.lockedMsgAt = this.sim.frame;
        this.events.emit('area:locked', { text: lockedMessage(ex, this.progress, this.level.id) });
      }
      return;
    }
    this.requestExit(ex);
  }

  private requestExit(ex: ExitDef): void {
    if (this.exitRequested) return;
    this.exitRequested = true;
    this.events.emit('area:exit', { to: ex.to, entry: ex.toEntry, seam: ex.seam === true });
  }

  /** Health and stamina to take into the next area (the weapon in your hands is in the save). */
  carry(): { health: number; stamina: number } {
    return { health: this.player.vitals.health, stamina: this.player.vitals.stamina };
  }
}

/** An exit you can't use yet. */
export function exitLocked(ex: ExitDef, progress: Progress): boolean {
  if (ex.custody && progress.save.police.serving) return true;
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

/** A bunged officer strolling off down the street. */
class LeaveBrain {
  constructor(private readonly dir: number) {}
  think(): CommandFrame {
    return { ...emptyCommand(), moveX: this.dir };
  }
}
