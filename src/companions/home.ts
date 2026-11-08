import { emptyCommand, type CommandFrame } from '../input/Commands';
import type { Fighter } from '../fighter/Fighter';
import type { Arena } from '../world/Arena';
import type { LevelDef, PropDef } from '../world/LevelTypes';
import { FURNITURE } from '../property/catalogue';
import { ROOMS } from '../property/catalogue';
import { PERSONALITIES, lineFor, replyKind, type HomeActivity, type LineKind, type PersonalityId } from './personality';

/**
 * Home life: your crew living in your house.
 *
 * HomeLife is the house's side of it: the places to sit (worked out from the
 * furniture you've actually placed, through each piece's seat points), the
 * places to stand (kitchen counter, fridge, windows, the gym floor), who has
 * claimed what, and conversations between crew members.
 *
 * HomeBrain is one companion's side: a small state machine that walks them
 * through the house (along the hallway that runs past every room's doorway,
 * so they never cut through walls or furniture), sits them down properly
 * (walk to the front of the seat, turn, lower onto it), picks things to do by
 * personality, chats, stands up again, and comes with you when you head out.
 */

export interface Seat {
  key: string;
  /** Where they sit (inside the furniture's footprint) and which way they face. */
  x: number;
  z: number;
  yaw: number;
  /** Where they stand before sitting down / after getting up. */
  ax: number;
  az: number;
  room: string;
  /** Furniture id (sofa_3, armchair, …). */
  kind: string;
  /** A telly in the room to watch. */
  tv: number | null;
}

export interface Spot {
  key: string;
  x: number;
  z: number;
  yaw: number;
  activity: string;
  /** What this place is for. */
  use: HomeActivity;
}

/** Seat points per piece of furniture, in its own space (x across, z forwards; +z is the way you face sat on it). */
const SEAT_POINTS: Record<string, { x: number; z: number }[]> = {
  sofa_3: [{ x: -0.7, z: -0.06 }, { x: 0, z: -0.06 }, { x: 0.7, z: -0.06 }],
  sofa_2: [{ x: -0.38, z: -0.05 }, { x: 0.38, z: -0.05 }],
  armchair: [{ x: 0, z: -0.05 }],
  dining_chair: [{ x: 0, z: 0 }],
};
/** Breakfast-bar stools: sat facing the island from its front. */
const ISLAND_STOOLS = [{ x: -0.35, z: 0.42 }, { x: 0.35, z: 0.42 }];

/** Things the player uses in the house: the crew keep out of the way of these. */
const PLAYER_STATIONS = new Set<string>(['kitchen', 'cooker', 'cupboard', 'sink', 'fridge', 'shower', 'toilet', 'basin', 'bed', 'bath_cabinet', 'tv', 'dining']);

/** The hallway: clear from end to end in front of every room's doorway. */
const LANE_Z = 0.95;
const TV_IDS = new Set(['tv_43', 'tv_65']);

function rotate(lx: number, lz: number, rot: number): { x: number; z: number; yaw: number } {
  const t = -rot * (Math.PI / 2);
  return { x: lx * Math.cos(t) + lz * Math.sin(t), z: -lx * Math.sin(t) + lz * Math.cos(t), yaw: t };
}

const roomOf = (x: number) => Object.entries(ROOMS).find(([, r]) => x > r.x0 && x < r.x1)?.[0] ?? 'other';

export class HomeLife {
  readonly seats: Seat[] = [];
  readonly spots: Spot[] = [];
  private claims = new Map<string, Fighter>();
  /** Conversations in progress. */
  private chats: { a: HomeBrain; b: HomeBrain; t: number; stage: number }[] = [];
  private nextChat = 6;
  private time = 0;

  constructor(level: LevelDef, private arena: Arena, private rng: () => number, readonly say: (f: Fighter, text: string) => void) {
    const tvs = level.props.filter((p) => p.kind === 'furniture' && TV_IDS.has(p.item ?? ''));
    for (const p of level.props) this.addSeats(p, tvs);
    // Places to stand about.
    // Never stand about where you need to be to use something (the hob, the fridge, the sink, the loo...).
    const keepClear = (level.stations ?? []).filter((st) => PLAYER_STATIONS.has(st.id));
    const add = (key: string, x: number, z: number, yaw: number, activity: string, use: HomeActivity) => {
      if (this.arena.blocked(x, z, 0.25)) return;
      if (keepClear.some((st) => Math.abs(st.x - x) < 0.75 && z < st.z + 0.75)) return;
      this.spots.push({ key, x, z, yaw, activity, use });
    };
    add('kitchen_mid', 0.5, 0.45, Math.PI * 0.75, 'drink', 'kitchen');
    add('kitchen_door', -3.4, 0.5, Math.PI * 0.6, 'lean', 'kitchen');
    for (const [id, r] of Object.entries(ROOMS)) if (id !== 'bathroom') add(`window_${id}`, r.window + 0.4, -1.3, Math.PI, 'look', 'stand');
    add('living_corner', -12.2, 0.2, Math.PI * 0.6, 'arms', 'stand');
    add('gym_floor', 6.2, 0.5, 0, 'stretch', 'stretch');
    add('gym_floor2', 8.0, 0.6, 0, 'stretch', 'stretch');
    add('hall_phone', -9.6, 0.4, 0.3, 'phone', 'phone');
    add('kitchen_phone', -2.4, 0.6, -0.3, 'phone', 'phone');
  }

  private addSeats(p: PropDef, tvs: PropDef[]): void {
    if (p.kind !== 'furniture' || !p.item) return;
    const def = FURNITURE[p.item];
    if (!def) return;
    const pts = p.item === 'island' ? ISLAND_STOOLS : SEAT_POINTS[p.item];
    if (!pts) return;
    const rot = p.rot ?? 0;
    const [hx, hz] = def.size;
    pts.forEach((pt, i) => {
      // Seat points are a share of the piece's half-size, so they fit whatever the model's size.
      const lx = (pt.x / (p.item === 'island' ? 0.7 : Math.max(0.45, def.size[0]))) * hx;
      const lz = pt.z * (p.item === 'island' ? 1 : hz / 0.45);
      const s = rotate(lx, lz, rot);
      const island = p.item === 'island';
      const yaw = island ? s.yaw + Math.PI : s.yaw;
      const fwd = { x: Math.sin(yaw), z: Math.cos(yaw) };
      const seat = { x: p.x + s.x, z: p.z + s.z };
      // Stand in front of it (out of the footprint), a little further for deep pieces.
      const reach = island ? 0.45 : hz + 0.32;
      let ax = p.x + s.x + fwd.x * (island ? 0.35 : 0) + fwd.x * reach * (island ? 0 : 1);
      let az = p.z + s.z + fwd.z * reach;
      if (island) {
        ax = seat.x;
        az = seat.z + 0.35;
      }
      // Reachable: a clear way down from the hallway to where you stand.
      const fromLane = (x: number, z: number) => {
        for (let zz = z; zz < LANE_Z; zz += 0.15) if (this.arena.blocked(x, zz, 0.2)) return false;
        return true;
      };
      if (this.arena.blocked(ax, az, 0.2) || !fromLane(ax, az)) {
        // Something in front (a coffee table): step in from a little further out, or from the side.
        const side = { x: Math.cos(yaw), z: -Math.sin(yaw) };
        const tries: [number, number][] = [[0, 0.25], [0.45, 0], [-0.45, 0], [0.75, 0], [-0.75, 0], [1.05, 0], [-1.05, 0], [0.75, 0.25], [-0.75, 0.25]];
        const ok = tries.map(([l, f]) => ({ x: ax + side.x * l + fwd.x * f, z: az + side.z * l + fwd.z * f })).find((c) => !this.arena.blocked(c.x, c.z, 0.2) && fromLane(c.x, c.z) && this.clearPath(c.x, c.z, seat.x, seat.z, p));
        if (!ok) return; // boxed in: not usable
        ax = ok.x;
        az = ok.z;
      }
      const tv = tvs.find((t) => roomOf(t.x) === roomOf(seat.x));
      this.seats.push({ key: `${p.item}@${p.x.toFixed(2)},${p.z.toFixed(2)}#${i}`, x: seat.x, z: seat.z, yaw, ax, az, room: roomOf(seat.x), kind: p.item!, tv: tv ? tv.x : null });
    });
  }

  /** From where you stand to the seat, nothing in the way but the piece you're sitting on. */
  private clearPath(x0: number, z0: number, x1: number, z1: number, piece: PropDef): boolean {
    const def = FURNITURE[piece.item ?? ''];
    const [hx, hz] = def ? ((piece.rot ?? 0) % 2 === 1 ? [def.size[1], def.size[0]] : def.size) : [0, 0];
    const n = 8;
    for (let i = 1; i < n; i++) {
      const x = x0 + ((x1 - x0) * i) / n;
      const z = z0 + ((z1 - z0) * i) / n;
      const onPiece = Math.abs(x - piece.x) < hx + 0.3 && Math.abs(z - piece.z) < hz + 0.3;
      if (!onPiece && this.arena.blocked(x, z, 0.12)) return false;
    }
    return true;
  }

  claim(key: string, f: Fighter): boolean {
    const c = this.claims.get(key);
    if (c && c !== f) return false;
    this.claims.set(key, f);
    return true;
  }

  release(f: Fighter, key?: string): void {
    for (const [k, v] of this.claims) if (v === f && (!key || k === key)) this.claims.delete(k);
  }

  isFree(key: string, f?: Fighter): boolean {
    const c = this.claims.get(key);
    return !c || c === f;
  }

  /** A free seat, preferring the living room and seats near someone they could talk to. */
  freeSeat(f: Fighter, prefer?: (s: Seat) => number): Seat | null {
    const free = this.seats.filter((s) => this.isFree(s.key, f));
    if (!free.length) return null;
    const score = (s: Seat) => (s.room === 'living' ? 2 : 0) + (prefer?.(s) ?? 0) + this.rng() * 1.5;
    return free.sort((a, b) => score(b) - score(a))[0];
  }

  freeSpot(f: Fighter, use: HomeActivity): Spot | null {
    const free = this.spots.filter((s) => s.use === use && this.isFree(s.key, f));
    return free.length ? free[Math.floor(this.rng() * free.length)] : null;
  }

  // ---- conversations ----

  /** Someone at a loose end: maybe start a chat with someone else who is. */
  update(dt: number, members: HomeBrain[]): void {
    this.time += dt;
    for (let i = this.chats.length - 1; i >= 0; i--) {
      const c = this.chats[i];
      c.t += dt;
      if (!c.a.available || !c.b.available) {
        this.endChat(c);
        continue;
      }
      if (c.stage === 0 && c.t > 0.6) {
        c.stage = 1;
        const kind: LineKind = c.a.personality === 'joker' ? 'joke' : this.rng() < 0.5 ? 'story' : 'home';
        c.a.speak(kind);
        c.a.talking(true);
      } else if (c.stage === 1 && c.t > 3.2) {
        c.stage = 2;
        c.a.talking(false);
        const rk = replyKind(c.b.personality);
        const said = rk ? c.b.speak(rk) : false;
        if (rk === 'reply_laugh' || rk === 'reply_join') c.b.laugh(2);
        else if (said) c.b.talking(true);
        if (rk === 'reply_annoyed' && c.a.personality === 'joker') c.a.laugh(1.5);
      } else if (c.stage === 2 && c.t > 6.5) {
        this.endChat(c);
      }
    }
    this.nextChat -= dt;
    if (this.nextChat > 0) return;
    this.nextChat = 9 + this.rng() * 12;
    const idle = members.filter((m) => m.canChat);
    if (idle.length < 2) return;
    // The chattiest starts it, with someone nearby.
    const a = idle.sort((x, y) => PERSONALITIES[y.personality].chatty - PERSONALITIES[x.personality].chatty + (this.rng() - 0.5) * 0.4)[0];
    if (this.rng() > PERSONALITIES[a.personality].chatty + 0.2) return;
    const others = idle.filter((m) => m !== a).sort((x, y) => Math.abs(x.self.pos.x - a.self.pos.x) - Math.abs(y.self.pos.x - a.self.pos.x));
    const b = others[0];
    if (!b || Math.abs(b.self.pos.x - a.self.pos.x) > 6) return;
    this.chats.push({ a, b, t: 0, stage: 0 });
    a.startChat(b);
    b.startChat(a);
  }

  private endChat(c: { a: HomeBrain; b: HomeBrain }): void {
    this.chats = this.chats.filter((x) => x !== c);
    c.a.endChat();
    c.b.endChat();
  }

  chatting(m: HomeBrain): boolean {
    return this.chats.some((c) => c.a === m || c.b === m);
  }
}

// ---------------------------------------------------------------------------------------------------

type State = 'entering' | 'idle' | 'walking' | 'sitting_down' | 'seated' | 'standing_up' | 'at_spot' | 'following';

export class HomeBrain {
  state: State = 'idle';
  private path: { x: number; z: number }[] = [];
  private goal: { seat?: Seat; spot?: Spot; then?: HomeActivity } | null = null;
  private seat: Seat | null = null;
  private spot: Spot | null = null;
  private timer = 0;
  private tween = 0;
  private from = { x: 0, z: 0 };
  private variantTimer = 0;
  private stuckT = 0;
  private walkT = 0;
  private lastPos = { x: 0, z: 0 };
  private chatWith: HomeBrain | null = null;
  private laughT = 0;
  private talkingNow = false;
  /** Asked to follow you round the house (or gathering to go out). */
  following = false;
  /** Sat down for a meal: seconds of eating left (counts down once they're seated). */
  eatT = 0;

  constructor(
    readonly self: Fighter,
    readonly personality: PersonalityId,
    private readonly life: HomeLife,
    private readonly arena: Arena,
    private readonly rng: () => number,
    /** Follow logic (the companion's normal brain) for when they're with you. */
    private readonly follow: (frame: number) => CommandFrame,
  ) {
    this.lastPos = { x: self.pos.x, z: self.pos.z };
  }

  /** Arrive through a door: walk into the house first. */
  enter(door: { x: number; z: number }): void {
    this.state = 'entering';
    this.path = [{ x: door.x, z: Math.min(LANE_Z, door.z + 1.4) }];
  }

  /** Already at home when you arrive: settle straight into a seat or a spot. */
  settle(): void {
    const seat = this.life.freeSeat(this.self);
    if (seat && this.life.claim(seat.key, this.self)) {
      this.seat = seat;
      this.sitNow(seat);
      return;
    }
    const spot = this.pickSpot();
    if (spot && this.life.claim(spot.key, this.self)) {
      this.spot = spot;
      this.self.pos.x = spot.x;
      this.self.pos.z = spot.z;
      this.atSpot(spot);
    }
  }

  get available(): boolean {
    return !this.following && (this.state === 'seated' || this.state === 'at_spot');
  }

  get canChat(): boolean {
    return this.available && !this.life.chatting(this) && this.laughT <= 0;
  }

  get resting(): boolean {
    return this.state === 'seated';
  }

  /**
   * Come and eat: head for a free seat, preferring the dining table and
   * places near `near`, and eat for a while once sat down.
   */
  joinMeal(near: { x: number; z: number }, seconds: number): boolean {
    if (this.following) return false;
    const pref = (st: Seat) => (st.kind === 'dining_chair' || st.kind === 'island' ? 4 : 0) - Math.abs(st.x - near.x) * 0.4;
    // Already sat at the table: just tuck in.
    if (this.seat && this.state === 'seated' && (this.seat.kind === 'dining_chair' || this.seat.kind === 'island' || Math.abs(this.seat.x - near.x) < 3)) {
      this.eatT = seconds;
      this.timer = Math.max(this.timer, seconds + 2);
      return true;
    }
    const seat = this.life.freeSeat(this.self, pref);
    if (!seat) return false;
    this.eatT = seconds;
    this.goTo({ seat });
    return true;
  }

  // ---- chat hooks (driven by HomeLife) ----

  startChat(other: HomeBrain): void {
    this.chatWith = other;
    this.timer = Math.max(this.timer, 8);
  }

  endChat(): void {
    this.chatWith = null;
    this.talking(false);
  }

  talking(on: boolean): void {
    this.talkingNow = on;
  }

  laugh(seconds: number): void {
    this.laughT = seconds;
  }

  speak(kind: LineKind): boolean {
    const text = lineFor(this.personality, kind, this.rng());
    if (!text) return false;
    this.life.say(this.self, text);
    return true;
  }

  // ---- the state machine ----

  think(frame: number, dt = 1 / 60): CommandFrame {
    const me = this.self;
    if (this.following) {
      if (this.seat || this.spot || me.anchored) this.leaveFurniture();
      if (this.state === 'standing_up') return this.stepStandUp(dt);
      this.state = 'following';
      me.activity = null;
      me.yawOverride = null;
      return this.follow(frame);
    }
    if (this.state === 'following') this.state = 'idle';
    this.laughT = Math.max(0, this.laughT - dt);
    switch (this.state) {
      case 'entering':
      case 'walking':
        return this.walk(dt);
      case 'sitting_down':
        return this.stepSitDown(dt);
      case 'standing_up':
        return this.stepStandUp(dt);
      case 'seated':
        if (this.eatT > 0) {
          this.eatT = Math.max(0, this.eatT - dt);
          this.self.activity = 'eat';
          if (this.seat) this.self.yawOverride = this.seat.yaw;
          this.timer = Math.max(this.timer, 3);
          return emptyCommand();
        }
        this.seatedPose(dt);
        if ((this.timer -= dt) <= 0 && !this.life.chatting(this)) this.chooseNext();
        return emptyCommand();
      case 'at_spot':
        this.spotPose();
        if ((this.timer -= dt) <= 0 && !this.life.chatting(this)) this.chooseNext();
        return emptyCommand();
      default:
        this.chooseNext();
        return emptyCommand();
    }
  }

  /** Pick the next thing to do, by personality. */
  private chooseNext(): void {
    const weights = PERSONALITIES[this.personality].home;
    const total = Object.values(weights).reduce((a, b) => a + (b ?? 0), 0);
    let r = this.rng() * total;
    let pick: HomeActivity = 'sit';
    for (const [k, w] of Object.entries(weights) as [HomeActivity, number][]) {
      r -= w;
      if (r <= 0) {
        pick = k;
        break;
      }
    }
    // Chatting means going to sit or stand near someone: in practice, settle somewhere and let HomeLife pair people up.
    if (pick === 'chat' || pick === 'tv' || pick === 'phone') pick = this.rng() < 0.75 ? 'sit' : pick === 'phone' ? 'phone' : 'stand';
    if (pick === 'sit') {
      // Stay put if already sat down: change how they're sitting.
      if (this.state === 'seated' && this.rng() < 0.5) {
        this.timer = 15 + this.rng() * 25;
        this.variantTimer = 0;
        return;
      }
      const seat = this.life.freeSeat(this.self, (s) => (s.key === this.seat?.key ? -3 : 0) + (s.tv !== null ? 0.6 : 0));
      if (seat) return this.goTo({ seat });
      pick = 'stand';
    }
    const spot = this.pickSpot(pick);
    if (spot) return this.goTo({ spot });
    this.timer = 6;
  }

  private pickSpot(use?: HomeActivity): Spot | null {
    const wanted = use === 'pace' ? 'stand' : use;
    return (wanted ? this.life.freeSpot(this.self, wanted) : null) ?? this.life.freeSpot(this.self, 'stand') ?? this.life.freeSpot(this.self, 'kitchen');
  }

  /** Head off somewhere: claim it first so nobody else heads for the same place. */
  private goTo(goal: { seat?: Seat; spot?: Spot }): void {
    const key = goal.seat?.key ?? goal.spot!.key;
    // Already there: stay put.
    if ((this.seat && this.seat.key === key) || (this.spot && this.spot.key === key)) {
      this.timer = 10 + this.rng() * 15;
      return;
    }
    if (!this.life.claim(key, this.self)) {
      this.timer = 2;
      return;
    }
    if (this.seat || this.spot) this.leaveFurniture(goal);
    this.goal = goal;
    if (this.state !== 'standing_up') this.plan();
  }

  private leaveFurniture(next?: { seat?: Seat; spot?: Spot }): void {
    const old = this.seat ?? this.spot;
    if (this.seat && this.self.anchored) {
      this.state = 'standing_up';
      this.tween = 0;
      this.from = { x: this.self.pos.x, z: this.self.pos.z };
    }
    if (old) this.life.release(this.self, old.key);
    this.seat = null;
    this.spot = null;
    this.self.activity = null;
    if (!next) this.goal = null;
  }

  /** Route: out to the hallway, along it, and in to the target (unless there's a clear straight line). */
  private plan(): void {
    const me = this.self;
    const t = this.goal?.seat ? { x: this.goal.seat.ax, z: this.goal.seat.az } : this.goal?.spot ? { x: this.goal.spot.x, z: this.goal.spot.z } : null;
    if (!t) return;
    this.path = this.clearLine(me.pos.x, me.pos.z, t.x, t.z) ? [t] : [{ x: me.pos.x, z: LANE_Z }, { x: t.x, z: LANE_Z }, t];
    this.state = 'walking';
    this.stuckT = 0;
    this.walkT = 0;
  }

  private clearLine(x0: number, z0: number, x1: number, z1: number): boolean {
    const n = Math.max(2, Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 0.2));
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      if (this.arena.blocked(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t, 0.22)) return false;
    }
    return true;
  }

  private walk(dt: number): CommandFrame {
    const me = this.self;
    me.activity = null;
    me.yawOverride = null;
    const cmd = emptyCommand();
    const next = this.path[0];
    if (!next) {
      if (this.state === 'entering') {
        this.state = 'idle';
        this.chooseNext();
        return cmd;
      }
      return this.arrive();
    }
    const dx = next.x - me.pos.x;
    const dz = next.z - me.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.14) {
      this.path.shift();
      return cmd;
    }
    cmd.moveX = dx / d;
    cmd.moveZ = dz / d;
    if (Math.abs(dx) > 0.05) me.facing = dx > 0 ? 1 : -1;
    // Can't get there at all: give up on it and do something else.
    this.walkT += dt;
    if (this.walkT > 12 && this.state === 'walking') {
      const g = this.goal;
      if (g) this.life.release(me, g.seat?.key ?? g.spot?.key);
      this.goal = null;
      this.path = [];
      this.eatT = 0;
      this.state = 'idle';
      this.timer = 2;
      return cmd;
    }
    // Not getting anywhere (someone in the way): wait a moment, then skip to the hallway and replan.
    this.stuckT += dt;
    if (this.stuckT > 1.2) {
      const moved = Math.hypot(me.pos.x - this.lastPos.x, me.pos.z - this.lastPos.z);
      this.lastPos = { x: me.pos.x, z: me.pos.z };
      this.stuckT = 0;
      if (moved < 0.15) {
        if (this.path.length > 1) this.path.shift();
        else this.path.unshift({ x: me.pos.x, z: LANE_Z });
      }
    }
    return cmd;
  }

  private arrive(): CommandFrame {
    const g = this.goal;
    this.goal = null;
    if (g?.seat) {
      this.seat = g.seat;
      this.state = 'sitting_down';
      this.tween = 0;
      this.from = { x: this.self.pos.x, z: this.self.pos.z };
      this.self.yawOverride = g.seat.yaw;
      this.self.activity = 'sit';
      this.self.anchored = true;
    } else if (g?.spot) {
      this.spot = g.spot;
      this.atSpot(g.spot);
    } else this.state = 'idle';
    return emptyCommand();
  }

  /** Lower onto the seat (half a second; the pose blends from standing to sitting as they go). */
  private stepSitDown(dt: number): CommandFrame {
    const s = this.seat!;
    this.tween = Math.min(1, this.tween + dt / 0.5);
    const k = this.tween * this.tween * (3 - 2 * this.tween);
    this.self.pos.x = this.from.x + (s.x - this.from.x) * k;
    this.self.pos.z = this.from.z + (s.z - this.from.z) * k;
    if (this.tween >= 1) {
      this.state = 'seated';
      this.timer = 20 + this.rng() * 40;
      this.variantTimer = 0;
    }
    return emptyCommand();
  }

  private stepStandUp(dt: number): CommandFrame {
    const me = this.self;
    if (!me.anchored) {
      this.state = 'idle';
      if (this.goal) this.plan();
      return emptyCommand();
    }
    // Back out to the front of the seat.
    const target = this.seatFront();
    this.tween = Math.min(1, this.tween + dt / 0.45);
    const k = this.tween * this.tween * (3 - 2 * this.tween);
    me.pos.x = this.from.x + (target.x - this.from.x) * k;
    me.pos.z = this.from.z + (target.z - this.from.z) * k;
    me.activity = null;
    if (this.tween >= 1) {
      me.anchored = false;
      me.yawOverride = null;
      this.state = 'idle';
      if (this.goal) this.plan();
    }
    return emptyCommand();
  }

  private lastSeatFront: { x: number; z: number } | null = null;
  private seatFront(): { x: number; z: number } {
    return this.lastSeatFront ?? { x: this.from.x, z: this.from.z + 0.5 };
  }

  private sitNow(seat: Seat): void {
    const me = this.self;
    me.pos.x = seat.x;
    me.pos.z = seat.z;
    me.anchored = true;
    me.yawOverride = seat.yaw;
    me.activity = 'sit';
    this.lastSeatFront = { x: seat.ax, z: seat.az };
    this.state = 'seated';
    this.timer = 15 + this.rng() * 40;
  }

  private atSpot(spot: Spot): void {
    this.state = 'at_spot';
    this.timer = 12 + this.rng() * 20;
    this.self.yawOverride = spot.yaw;
    this.self.activity = spot.activity;
  }

  /** How they sit: varies now and then, by personality, and while talking or laughing. */
  private seatedPose(dt: number): void {
    const me = this.self;
    const s = this.seat;
    if (s) this.lastSeatFront = { x: s.ax, z: s.az };
    // Turn a little towards whoever they're talking to, or the telly.
    const look = this.chatWith ? Math.sign(this.chatWith.self.pos.x - me.pos.x) * 0.45 : s?.tv !== null && s?.tv !== undefined ? Math.sign(s.tv - me.pos.x) * 0.35 : 0;
    if (s) me.yawOverride = s.yaw + look;
    if (this.laughT > 0) return void (me.activity = 'sit_talk');
    if (this.talkingNow) return void (me.activity = 'sit_talk');
    this.variantTimer -= dt;
    if (this.variantTimer > 0 && me.activity && me.activity.startsWith('sit')) return;
    this.variantTimer = 8 + this.rng() * 12;
    const p = this.personality;
    const options = s?.tv !== null && s?.tv !== undefined ? ['sit_back', 'sit_back', 'sit', 'sit_arms'] : ['sit', 'sit_back', 'sit_phone', 'sit_arms'];
    if (p === 'professional' || p === 'fast') options.push('sit_phone');
    if (p === 'heavy' || p === 'veteran') options.push('sit_back', 'sit_arms');
    me.activity = options[Math.floor(this.rng() * options.length)];
  }

  private spotPose(): void {
    const me = this.self;
    if (this.laughT > 0) return void (me.activity = 'laugh');
    if (this.talkingNow) {
      me.activity = 'talk';
      if (this.chatWith) me.yawOverride = Math.atan2(this.chatWith.self.pos.x - me.pos.x, this.chatWith.self.pos.z - me.pos.z);
      return;
    }
    if (this.spot) {
      me.activity = this.personality === 'hothead' && this.spot.use === 'stand' ? 'look' : this.spot.activity;
      me.yawOverride = this.chatWith ? Math.atan2(this.chatWith.self.pos.x - me.pos.x, this.chatWith.self.pos.z - me.pos.z) : this.spot.yaw;
    }
  }

  /** Leaving the house or the world being torn down: give everything back. */
  dispose(): void {
    this.life.release(this.self);
    this.self.anchored = false;
    this.self.yawOverride = null;
    this.self.activity = null;
  }
}
