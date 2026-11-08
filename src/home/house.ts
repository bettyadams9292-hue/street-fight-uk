import { emptyCommand, type CommandFrame } from '../input/Commands';
import { ITEMS } from '../items/items';
import type { Progress } from '../progress/Progress';
import { FURNITURE } from '../property/catalogue';
import { HOUSE_SPOT_BY_ID, WORKTOP_STAND, pieceLocal } from '../property/home';
import type { StationDef } from '../world/LevelTypes';
import type { World } from '../world/World';
import type { Seat } from '../companions/home';
import { crewState } from '../companions/companions';
import { recover } from '../training/gym';
import { treatInjury } from '../condition/condition';
import type { HouseFxSpec } from '../render/HouseFX';
import type { Screen } from '../ui/UIManager';
import { choiceScreen, recipeScreen, storeScreen } from '../ui/kitchenUI';
import { HouseActivity, type Step } from './activity';
import { attention, eat, needLabel, needsModifierKey, tickNeeds, type NeedKey } from './needs';
import { missing, takeFrom, useIngredients, putInto, type Recipe } from './recipes';

/** Everything the house needs from the game. */
export interface HouseHost {
  world(): World | null;
  progress(): Progress | null;
  fx(key: string, spec: HouseFxSpec | null): void;
  sound(kind: Parameters<import('../audio/AudioManager').AudioManager['house']>[0]): void;
  loop(id: 'shower' | 'tap' | 'sizzle' | 'oven', on: boolean): void;
  toast(text: string, kind?: 'cash' | 'item' | 'info' | 'warn'): void;
  say(text: string): void;
  /** Open a panel (the world waits); `closed` runs when it's shut. */
  panel(make: (close: () => void) => Screen, closed?: () => void): void;
  /** The player's stats changed (meal bonus, needs effects). */
  refresh(): void;
  save(): void;
  /** A proper rest: injuries down a level, the crew rested. */
  restAtHome(): string;
}

const FRIDGE = { x: 1.3, z: -1.1, w: 0.78, h: 1.15, y: 1.25 };
const CUPBOARD = { x: -2.05, z: -1.1, w: 0.42, h: 0.6, y: 0.42 };
const HOB = { x: -3.3, y: 0.9, z: -1.38 };
const OVEN = { x: -3.2, y: 0.45, z: -1.085 };
const BOARD = { x: -1.3, y: 0.93, z: -1.32 };
const KITCHEN_TAP = { x: -0.5, y: 1.05, z: -1.42 };
const BASIN_TAP = { x: -22.1, y: 0.98, z: -2.15 };
/** Standing under the shower, in the bath (feet on its floor: hidden by the side). */
const SHOWER_AT = { x: -25.2, z: -1.92, y: 0.12 };

type Kind = 'store' | 'cook' | 'eat' | 'wash' | 'shower' | 'toilet' | 'sleep' | 'tv' | 'freshen';

export class HouseController {
  active: HouseActivity | null = null;
  private kind: Kind | null = null;
  /** Keys of effects to take down when the activity ends. */
  private fxKeys = new Set<string>();
  private loops = new Set<'shower' | 'tap' | 'sizzle' | 'oven'>();
  private claimedSeat: string | null = null;
  private modKey = '';
  private warned = new Set<string>();
  private zzzT = 0;
  /** Seconds since the activity started (a stray key press right at the start shouldn't stop it). */
  private age = 0;

  constructor(private readonly host: HouseHost) {}

  get sleeping(): boolean {
    return this.kind === 'sleep' && !!this.active && !this.active.finished && this.active.current?.kind === 'act' && this.active.current.pose === 'lie';
  }

  /** The stations this handles. */
  handles(id: StationDef['id']): boolean {
    return ['fridge', 'cupboard', 'cooker', 'kitchen', 'sink', 'dining', 'tv', 'shower', 'toilet', 'basin', 'bed', 'bath_cabinet'].includes(id);
  }

  open(id: StationDef['id'], station?: StationDef): void {
    const p = this.host.progress();
    const w = this.host.world();
    if (!p || !w || this.active) return;
    switch (id) {
      case 'fridge':
      case 'cupboard':
        return this.openStore(id);
      case 'kitchen':
      case 'cooker':
        return this.host.panel((close) => recipeScreen(p, close, (r) => {
          close();
          this.cook(r);
        }, id === 'cooker' ? 'stove' : undefined));
      case 'sink':
        return this.wash('hands', 'sink');
      case 'basin':
        return this.host.panel((close) => choiceScreen('Bathroom sink', p, close, 'A wash and a brush. Esc or walking off stops.', [
          { name: 'Wash hands', text: '+4 hygiene', button: 'Wash', go: () => (close(), this.wash('hands', 'basin')) },
          { name: 'Wash face', text: '+6 hygiene, wakes you up a bit', button: 'Wash', go: () => (close(), this.wash('face', 'basin')) },
          { name: 'Brush teeth', text: `Teeth: ${needLabel('oral', p.save.needs.oral).label.toLowerCase()}. Back to fresh.`, button: 'Brush', go: () => (close(), this.wash('teeth', 'basin')) },
        ]));
      case 'shower':
        return this.shower();
      case 'toilet':
        return this.toilet();
      case 'dining':
        return this.sitAndEat();
      case 'tv':
        return this.watchTv();
      case 'bed':
        return this.host.panel((close) => choiceScreen('Bed', p, close, `Energy: ${needLabel('energy', p.save.needs.energy).label.toLowerCase()}. Sleeping doesn’t move the clock on: nothing you’re in the middle of is missed.`, [
          { name: 'Sleep', text: 'Wake up rested: full energy, training fatigue gone, injuries a level better, crew rested.', button: 'Sleep', go: () => (close(), this.bed('sleep', station)) },
          { name: 'Have a lie down', text: '+35 energy, takes the edge off fatigue, a bit of health back.', button: 'Lie down', go: () => (close(), this.bed('nap', station)) },
        ]));
      case 'bath_cabinet':
        return this.freshen(station);
    }
  }

  // ---- running -----------------------------------------------------------------------

  /** One simulation step: the player's command while doing something (or the real one if not). */
  command(real: CommandFrame, dt: number): CommandFrame {
    const a = this.active;
    if (!a) return real;
    this.age += dt;
    if (!a.cancelled && this.age > 0.35 && (Math.hypot(real.moveX, real.moveZ) > 0.5 || real.pressed.grab || real.pressed.jump)) a.cancel();
    const cmd = a.update(dt);
    if (this.sleeping) {
      this.zzzT -= dt;
      if (this.zzzT <= 0) {
        this.zzzT = 3.2;
        this.host.say('Zzz…');
      }
    }
    return a.finished ? emptyCommand() : cmd;
  }

  /** Esc: stop what you're doing (easing out of it). */
  cancel(): boolean {
    if (!this.active || this.active.cancelled) return !!this.active;
    this.active.cancel();
    return true;
  }

  /** Leaving the house, a cutscene, anything abrupt: stop dead and tidy up. */
  abort(): void {
    this.active?.abort();
    this.cleanup();
  }

  /** For the HUD. */
  get status(): { title: string; label: string; frac: number; sleeping: boolean } | null {
    const a = this.active;
    if (!a || a.finished) return null;
    const pr = a.progress;
    return { title: a.title, label: a.cancelled ? 'Stopping…' : pr.label, frac: pr.overall, sleeping: this.sleeping };
  }

  private start(kind: Kind, title: string, steps: Step[], end?: (cancelled: boolean, at: number) => void): void {
    const w = this.host.world()!;
    this.cleanup();
    const a = new HouseActivity(title, steps, w.player, w.arena);
    this.active = a;
    this.kind = kind;
    this.age = 0;
    this.zzzT = 1.5;
    a.onEnd = (cancelled, at) => {
      end?.(cancelled, at);
      this.cleanup();
      this.active = null;
      this.kind = null;
      this.host.save();
    };
  }

  private cleanup(): void {
    for (const k of this.fxKeys) this.host.fx(k, null);
    this.fxKeys.clear();
    for (const l of this.loops) this.host.loop(l, false);
    this.loops.clear();
    const w = this.host.world();
    if (this.claimedSeat && w?.homeLife) w.homeLife.release(w.player, this.claimedSeat);
    this.claimedSeat = null;
  }

  private fx(key: string, spec: HouseFxSpec | null): void {
    this.host.fx(key, spec);
    if (spec) this.fxKeys.add(key);
    else this.fxKeys.delete(key);
  }

  private loop(id: 'shower' | 'tap' | 'sizzle' | 'oven', on: boolean): void {
    this.host.loop(id, on);
    if (on) this.loops.add(id);
    else this.loops.delete(id);
  }

  private walkTo(id: StationDef['id'], label: string): Step {
    const s = HOUSE_SPOT_BY_ID[id]!.stand;
    return { kind: 'walk', x: s.x, z: s.z, label };
  }

  // ---- the fridge and the cupboards --------------------------------------------------

  private doorFx(which: 'fridge' | 'cupboard'): void {
    const d = which === 'fridge' ? FRIDGE : CUPBOARD;
    this.host.fx(`door_${which}`, { kind: 'door', x: d.x, y: d.y, z: d.z, w: d.w, h: d.h, hinge: which === 'fridge' ? 'right' : 'left', colour: which === 'fridge' ? '#e8e8e4' : '#e8e4d8', light: which === 'fridge' });
    this.host.sound(which === 'fridge' ? 'fridge_open' : 'cupboard');
  }

  private closeDoor(which: 'fridge' | 'cupboard'): void {
    this.host.fx(`door_${which}`, null);
    this.host.sound(which === 'fridge' ? 'fridge_close' : 'cupboard');
  }

  private openStore(which: 'fridge' | 'cupboard'): void {
    const p = this.host.progress()!;
    const spot = HOUSE_SPOT_BY_ID[which]!;
    this.start('store', which === 'fridge' ? 'Fridge' : 'Cupboards', [
      { kind: 'walk', x: spot.stand.x, z: spot.stand.z, label: 'Walking over' },
      { kind: 'act', yaw: spot.stand.yaw, pose: which === 'fridge' ? 'reach' : 'reach_low', secs: 0.55, label: which === 'fridge' ? 'Opening the fridge' : 'Opening the cupboard', start: () => this.doorFx(which) },
    ], (cancelled) => {
      if (cancelled) return this.closeDoor(which);
      const w = this.host.world()!;
      // Stand looking in while the list is open.
      w.player.yawOverride = spot.stand.yaw;
      w.player.activity = which === 'fridge' ? 'reach' : 'reach_low';
      this.host.panel((close) => storeScreen(which, p, close, () => this.host.save()), () => {
        w.player.activity = null;
        w.player.yawOverride = null;
        this.closeDoor(which);
      });
    });
  }

  // ---- cooking -------------------------------------------------------------------------

  cook(r: Recipe): void {
    const p = this.host.progress()!;
    const s = p.save;
    if (missing(r, s.pantry, s.inventory).length) return this.host.toast(`Missing ingredients for ${r.name.toLowerCase()}`, 'warn');
    const meal = ITEMS[r.makes];
    const fromFridge = r.ingredients.some((g) => s.pantry.fridge.some((x) => x.id === g.id));
    const fromCupboard = r.ingredients.some((g) => s.pantry.cupboard.some((x) => x.id === g.id));
    if (r.kind === 'snack') return this.eatFlow(r.makes);
    let used = false;
    let cooked = false;
    const steps: Step[] = [];
    if (fromFridge) {
      steps.push(this.walkTo('fridge', 'To the fridge'), {
        kind: 'act', yaw: Math.PI, pose: 'reach', secs: 1.4, label: 'Getting things out of the fridge',
        start: () => this.doorFx('fridge'), done: () => this.closeDoor('fridge'),
      });
    }
    if (fromCupboard) {
      steps.push(this.walkTo('cupboard', 'To the cupboards'), {
        kind: 'act', yaw: Math.PI, pose: 'reach_low', secs: 1.1, label: 'Getting things out of the cupboard',
        start: () => this.doorFx('cupboard'), done: () => this.closeDoor('cupboard'),
      });
    }
    let chopT = 0;
    steps.push(
      { kind: 'walk', x: WORKTOP_STAND.x, z: WORKTOP_STAND.z, label: 'To the worktop' },
      {
        kind: 'act', yaw: Math.PI, pose: r.prep > 3 ? 'chop' : 'plate', secs: r.prep, label: r.cookAt === 'none' ? `Making ${r.name.toLowerCase()}` : 'Preparing',
        start: () => {
          used = useIngredients(r, s.pantry, s.inventory);
          if (!used) {
            this.host.toast('Something’s gone missing from the kitchen', 'warn');
            this.active?.cancel();
            return;
          }
          this.fx('board', { kind: 'board', ...BOARD, colour: meal.colour });
        },
        tick: (dt) => {
          if (r.prep <= 3) return;
          chopT -= dt;
          if (chopT <= 0) {
            chopT = 0.28;
            this.host.sound('chop');
          }
        },
        done: () => this.fx('board', null),
      },
    );
    if (r.cookAt === 'hob') {
      steps.push(this.walkTo('cooker', 'To the hob'), {
        kind: 'act', yaw: Math.PI, pose: 'stir', secs: r.cook, label: 'Cooking on the hob',
        start: () => {
          this.fx('pan', { kind: 'pan', ...HOB, colour: meal.colour });
          this.loop('sizzle', true);
          this.host.sound('switch');
        },
        done: () => {
          cooked = true;
          this.loop('sizzle', false);
        },
      });
    } else if (r.cookAt === 'oven' || r.cookAt === 'toaster') {
      const grill = r.cookAt === 'toaster';
      steps.push(
        this.walkTo('cooker', grill ? 'To the grill' : 'To the oven'),
        { kind: 'act', yaw: Math.PI, pose: grill ? 'reach' : 'reach_low', secs: 1, label: grill ? 'Under the grill' : 'Into the oven', start: () => this.host.sound('switch') },
        {
          kind: 'act', yaw: Math.PI, pose: 'wait', secs: r.cook - 2, label: grill ? 'Toasting' : 'In the oven',
          start: () => {
            this.fx('oven', { kind: 'oven', ...OVEN });
            this.loop('oven', true);
          },
        },
        {
          kind: 'act', yaw: Math.PI, pose: grill ? 'reach' : 'reach_low', secs: 1, label: 'Taking it out',
          done: () => {
            cooked = true;
            this.fx('oven', null);
            this.loop('oven', false);
          },
        },
      );
    } else cooked = true;
    steps.push({
      kind: 'act', x: r.cookAt === 'none' ? undefined : WORKTOP_STAND.x, z: r.cookAt === 'none' ? undefined : WORKTOP_STAND.z, yaw: Math.PI, pose: 'plate', secs: 1.2, label: 'Plating up',
      start: () => {
        this.fx('pan', null);
        this.fx('plate_up', { kind: 'plate', x: BOARD.x, y: BOARD.y, z: BOARD.z, colour: meal.colour });
        this.host.sound('clink');
      },
    });
    let servedUid = false;
    const prepAt = steps.findIndex((x) => x.label === 'Preparing' || x.label.startsWith('Making'));
    this.start('cook', `Cooking: ${r.name}`, steps, (cancelled, at) => {
      if (cancelled) {
        if (!used) return this.host.toast('Stopped. Nothing used.', 'info');
        if (!cooked && at <= prepAt) {
          // Stopped while still prepping: it all goes back.
          for (const g of r.ingredients) p.stockKitchen([{ id: g.id, qty: g.qty }]);
          return this.host.toast('Stopped. Ingredients put back.', 'info');
        }
        if (!cooked) return this.host.toast(`Left it on the heat. The ${r.name.toLowerCase()} is ruined.`, 'warn');
      }
      // Served: one plate to eat now, the rest in the fridge.
      const extra = r.servings - 1;
      if (p.spaceFor(r.makes) >= 1) {
        p.giveItem(r.makes, 1);
        servedUid = true;
      } else putInto(s.pantry.fridge, r.makes, 1, () => p.newUid());
      if (extra > 0) putInto(s.pantry.fridge, r.makes, extra, () => p.newUid());
      p.discover(r.makes);
      this.host.toast(`${meal.name} ready${extra > 0 ? ` — ${extra} more in the fridge for later (or the crew)` : ''}.${servedUid ? ' Sit down to eat it.' : ''}`, 'item');
      if (!cancelled && servedUid) this.queue = () => this.eatFlow(r.makes);
    });
  }

  /** Something to start once the current activity has finished. */
  private queue: (() => void) | null = null;

  /** Call once a frame: starts anything queued. */
  update(): void {
    if (!this.active && this.queue) {
      const q = this.queue;
      this.queue = null;
      q();
    }
  }

  // ---- eating ---------------------------------------------------------------------------

  /** The best thing to eat from your pockets (a home-cooked plate first). */
  private pickFood(): string | null {
    const p = this.host.progress()!;
    const food = p.save.inventory.map((s) => ITEMS[s.id]).filter((d) => d?.use?.needs && d.use.needs.fill > 0);
    food.sort((a, b) => (b.icon === 'plate' ? 100 : 0) + b.use!.needs!.fill - ((a.icon === 'plate' ? 100 : 0) + a.use!.needs!.fill));
    return food[0]?.id ?? null;
  }

  private sitAndEat(): void {
    const p = this.host.progress()!;
    const id = this.pickFood();
    if (id) return this.eatFlow(id);
    // Leftovers in the fridge?
    const left = p.save.pantry.fridge.find((s) => ITEMS[s.id]?.icon === 'plate');
    if (left) return this.eatFlow(left.id);
    this.host.toast('Nothing ready to eat. Cook something at the worktop or cooker, or grab a snack from the cupboards.', 'warn');
  }

  /** Where to sit to eat: the dining table first, then the sofa. */
  private seatToEat(): Seat | null {
    const w = this.host.world()!;
    const life = w.homeLife;
    if (!life) return null;
    const free = life.seats.filter((s) => life.isFree(s.key, w.player));
    const score = (s: Seat) => (s.kind === 'dining_chair' || s.kind === 'island' ? 10 : s.room === 'kitchen' ? 5 : 0) - Math.abs(s.x - w.player.pos.x) * 0.2;
    return free.sort((a, b) => score(b) - score(a))[0] ?? null;
  }

  /** Go and get it if it's in the kitchen, sit down, eat. */
  eatFlow(id: string): void {
    const p = this.host.progress()!;
    const w = this.host.world()!;
    const d = ITEMS[id];
    const needs = d.use?.needs;
    if (!needs) return;
    const snack = d.icon !== 'plate';
    const steps: Step[] = [];
    // Fetch it from the fridge or cupboard if it isn't in your pockets.
    const inPockets = () => p.save.inventory.some((s) => s.id === id);
    if (!inPockets() && d.store) {
      const which = p.save.pantry.fridge.some((s) => s.id === id) ? 'fridge' : 'cupboard';
      steps.push(this.walkTo(which, `To the ${which === 'fridge' ? 'fridge' : 'cupboards'}`), {
        kind: 'act', yaw: Math.PI, pose: which === 'fridge' ? 'reach' : 'reach_low', secs: 0.9, label: `Getting the ${d.name.toLowerCase()}`,
        start: () => this.doorFx(which),
        done: () => {
          this.closeDoor(which);
          const store = which === 'fridge' ? p.save.pantry.fridge : p.save.pantry.cupboard;
          if (takeFrom(store, id, 1)) p.giveItem(id, 1);
        },
      });
    }
    const seat = this.seatToEat();
    const secs = snack ? 4 : 9;
    let frac = 0;
    let started = false;
    let crunch = 0;
    const atTable = seat && (seat.kind === 'dining_chair' || seat.kind === 'island');
    if (seat) {
      w.homeLife!.claim(seat.key, w.player);
      this.claimedSeat = seat.key;
      const fwd = { x: Math.sin(seat.yaw), z: Math.cos(seat.yaw) };
      const plate: HouseFxSpec = { kind: 'plate', x: seat.x + fwd.x * (atTable ? 0.42 : 0.28), y: atTable ? (seat.kind === 'island' ? 0.93 : 0.78) : 0.62, z: seat.z + fwd.z * (atTable ? 0.42 : 0.28), colour: d.colour };
      steps.push(
        { kind: 'walk', x: seat.ax, z: seat.az, label: atTable ? 'To the table' : 'To sit down' },
        { kind: 'act', x: seat.x, z: seat.z, yaw: seat.yaw, pose: 'sit', secs: 0.45, label: 'Sitting down', done: () => (!snack ? this.fx('plate', plate) : undefined) },
      );
    }
    steps.push({
      kind: 'act', yaw: seat ? seat.yaw : Math.PI, pose: seat ? 'eat' : 'drink', secs, label: `Eating ${d.name.toLowerCase()}`,
      start: () => {
        if (!takeFrom(p.save.inventory, id, 1)) {
          this.host.toast('It’s gone. Nothing to eat.', 'warn');
          this.active?.cancel();
          return;
        }
        started = true;
        if (!snack) this.inviteCrew(seat ?? { x: w.player.pos.x, z: w.player.pos.z }, id, secs);
      },
      tick: (dt, k) => {
        if (!started) return;
        frac = k;
        crunch -= dt;
        if (crunch <= 0) {
          crunch = 1.4;
          this.host.sound('eat');
        }
      },
    });
    if (!snack && seat) steps.push({ kind: 'act', yaw: seat.yaw, pose: 'sit_drink', secs: 2, label: 'A drink with it', start: () => this.fx('plate', null) });
    this.start('eat', `Eating: ${d.name}`, steps, (cancelled) => {
      if (!started) return;
      const k = cancelled ? Math.max(0.25, frac) : 1;
      this.finishMeal(id, k, !cancelled && !!seat);
      if (cancelled) this.host.toast(`Left the rest of the ${d.name.toLowerCase()}.`, 'info');
    });
  }

  /** What a meal does. `k` = how much of it you ate; a proper sit-down meal does a bit more. */
  private finishMeal(id: string, k: number, satDown: boolean): void {
    const p = this.host.progress()!;
    const w = this.host.world()!;
    const d = ITEMS[id];
    const u = d.use!;
    const n = u.needs!;
    eat(p.save.needs, { fill: n.fill * k, diet: n.diet, energy: (n.energy ?? 0) * k + (satDown ? 5 : 0), bladder: n.bladder });
    const v = w.player.vitals;
    v.health = Math.min(v.maxHealth, v.health + (u.heal ?? 0) * k + (u.healPct ?? 0) * v.maxHealth * k);
    v.stamina = Math.min(v.maxStamina, v.stamina + (u.stamina ?? 0) * k);
    const lines: string[] = [`${needLabel('hunger', p.save.needs.hunger).label}`];
    if (satDown) {
      recover(p.save.gym, p.save.playTime, 10);
      // A good home-cooked meal sees off bruising.
      if (d.icon === 'plate' && n.diet >= 50 && treatInjury(p.save.condition, 'bruising')) lines.push('bruising eased');
    }
    if (id === 'm_full_english' && k >= 0.99 && !p.save.mealBuff) {
      p.save.mealBuff = true;
      lines.push('+25 max health for your next trip out');
    }
    this.host.refresh();
    this.host.toast(`Ate ${d.name.toLowerCase()}. ${lines.join(', ')}.`, 'item');
  }

  /** Crew at home come and eat too, while there are servings in the fridge. */
  private inviteCrew(near: { x: number; z: number }, mealId: string, secs: number): void {
    const w = this.host.world()!;
    const p = this.host.progress()!;
    const fridge = p.save.pantry.fridge;
    for (const m of w.crew) {
      const hb = m.brain.home;
      if (!hb || hb.following || m.f.isKO) continue;
      // The same meal first, any leftovers otherwise.
      const serving = fridge.find((s) => s.id === mealId) ?? fridge.find((s) => ITEMS[s.id]?.icon === 'plate');
      if (!serving) break;
      if (!hb.joinMeal(near, secs + 4)) continue;
      takeFrom(fridge, serving.id, 1);
      const st = crewState(p, m.def.id);
      st.fatigue = Math.max(0, st.fatigue - 15);
      m.f.vitals.health = Math.min(m.f.vitals.maxHealth, m.f.vitals.health + m.f.vitals.maxHealth * 0.25);
      w.events.emit('crew:say', { fighter: m.f, name: m.def.nickname, text: ['Smells good, that.', 'Go on then, I’ll have some.', 'Proper food. Cheers.', 'Better than a kebab.'][Math.floor(Math.random() * 4)] });
    }
  }

  // ---- washing ---------------------------------------------------------------------------

  private wash(what: 'hands' | 'face' | 'teeth', where: 'sink' | 'basin'): void {
    const p = this.host.progress()!;
    const n = p.save.needs;
    const spot = HOUSE_SPOT_BY_ID[where]!;
    const tap = where === 'sink' ? KITCHEN_TAP : BASIN_TAP;
    const secs = what === 'hands' ? 3 : what === 'face' ? 4 : 6;
    const from = what === 'teeth' ? n.oral : n.hygiene;
    const to = what === 'teeth' ? 100 : Math.min(100, n.hygiene + (what === 'hands' ? 4 : 6));
    let brushT = 0;
    this.start('wash', what === 'teeth' ? 'Brushing teeth' : what === 'face' ? 'Washing face' : 'Washing hands', [
      { kind: 'walk', x: spot.stand.x, z: spot.stand.z, label: 'Walking over' },
      {
        kind: 'act', yaw: spot.stand.yaw, pose: what === 'teeth' ? 'brush' : what === 'face' ? 'wash_face' : 'wash_hands', secs, label: what === 'teeth' ? 'Brushing' : 'Washing',
        start: () => {
          this.host.sound('tap_on');
          if (what !== 'teeth') {
            this.fx('tap', { kind: 'tap', ...tap });
            this.loop('tap', true);
          }
        },
        tick: (dt, k) => {
          if (what === 'teeth') {
            n.oral = Math.max(n.oral, from + (to - from) * k);
            brushT -= dt;
            if (brushT <= 0) {
              brushT = 0.5;
              this.host.sound('brush');
            }
            // A rinse at the end.
            if (k > 0.8 && !this.fxKeys.has('tap')) {
              this.fx('tap', { kind: 'tap', ...tap });
              this.loop('tap', true);
            }
          } else n.hygiene = Math.max(n.hygiene, from + (to - from) * k);
        },
      },
    ], (cancelled) => {
      if (!cancelled) {
        if (what === 'face') n.energy = Math.min(100, n.energy + 3);
        this.host.toast(what === 'teeth' ? 'Teeth brushed. Minty.' : `Hygiene: ${needLabel('hygiene', n.hygiene).label.toLowerCase()}`, 'item');
      }
    });
  }

  private shower(): void {
    const p = this.host.progress()!;
    const n = p.save.needs;
    const spot = HOUSE_SPOT_BY_ID.shower!;
    const from = n.hygiene;
    this.start('shower', 'Shower', [
      { kind: 'walk', x: spot.stand.x, z: spot.stand.z, label: 'To the shower' },
      {
        kind: 'act', x: SHOWER_AT.x, z: SHOWER_AT.z, y: SHOWER_AT.y, yaw: 0.35, pose: 'look', secs: 0.6, label: 'Stepping in',
        done: () => {
          this.fx('curtain', { kind: 'curtain', x0: -25.72, x1: -24.08, z: -1.46, y0: 0.6, y1: 2.0, colour: '#d8e8f0' });
          this.host.sound('tap_on');
        },
      },
      {
        kind: 'act', yaw: 0.35, pose: 'shower', secs: 10, label: 'Showering',
        start: () => {
          this.fx('water', { kind: 'water', x: -25.38, z: -2.05, top: 1.86, bottom: 0.56, spread: 0.32 });
          this.fx('steam', { kind: 'steam', x: -24.9, y: 1.2, z: -1.8, spread: 1.4, amount: 50 });
          this.loop('shower', true);
        },
        tick: (_dt, k) => (n.hygiene = Math.max(n.hygiene, from + (100 - from) * k)),
        done: () => {
          this.fx('water', null);
          this.loop('shower', false);
          this.host.sound('tap_on');
        },
      },
      { kind: 'act', yaw: 0.35, pose: 'arms', secs: 1.2, label: 'Drying off' },
    ], (cancelled) => {
      if (!cancelled) {
        n.energy = Math.min(100, n.energy + 5);
        this.host.toast(`Showered. Hygiene: ${needLabel('hygiene', n.hygiene).label.toLowerCase()}.`, 'item');
      }
    });
  }

  private toilet(): void {
    const p = this.host.progress()!;
    const n = p.save.needs;
    if (n.bladder < 10) return this.host.toast('Don’t need to go.', 'info');
    const spot = HOUSE_SPOT_BY_ID.toilet!;
    const from = n.bladder;
    this.start('toilet', 'Toilet', [
      { kind: 'walk', x: spot.stand.x, z: spot.stand.z, label: 'To the loo' },
      { kind: 'act', x: -23.2, z: -1.92, yaw: 0, pose: 'sit', secs: 4, label: 'On the loo', tick: (_dt, k) => (n.bladder = Math.min(n.bladder, from * (1 - k))) },
      { kind: 'act', x: spot.stand.x, z: spot.stand.z, yaw: Math.PI, pose: 'reach', secs: 0.8, label: 'Flushing', start: () => this.host.sound('flush') },
    ], (cancelled) => {
      if (!cancelled) this.host.toast('Better. Wash your hands!', 'info');
    });
  }

  private freshen(station?: StationDef): void {
    const p = this.host.progress()!;
    const n = p.save.needs;
    const x = station?.x ?? -22.1;
    this.start('freshen', 'Freshening up', [
      { kind: 'walk', x, z: -1.45, label: 'To the cabinet' },
      { kind: 'act', yaw: Math.PI, pose: 'reach', secs: 1, label: 'Deodorant and mouthwash', start: () => this.host.sound('cupboard') },
      { kind: 'act', yaw: Math.PI, pose: 'brush', secs: 1.6, label: 'Freshening up' },
    ], (cancelled) => {
      if (cancelled) return;
      n.hygiene = Math.min(100, n.hygiene + 8);
      n.oral = Math.min(100, n.oral + 10);
      this.host.toast('Fresher. Not a substitute for a shower.', 'item');
    });
  }

  // ---- rest --------------------------------------------------------------------------------

  private watchTv(): void {
    const p = this.host.progress()!;
    const w = this.host.world()!;
    const life = w.homeLife;
    const seat = life?.seats.filter((s) => s.tv !== null && life.isFree(s.key, w.player)).sort((a, b) => Math.abs(a.x - (a.tv ?? 0)) - Math.abs(b.x - (b.tv ?? 0)))[0];
    if (!seat) return this.host.toast('Nowhere free to sit and watch. Get a sofa facing the telly.', 'warn');
    life!.claim(seat.key, w.player);
    this.claimedSeat = seat.key;
    const n = p.save.needs;
    const look = Math.sign((seat.tv ?? seat.x) - seat.x) * 0.35;
    this.start('tv', 'Watching telly', [
      { kind: 'walk', x: seat.ax, z: seat.az, label: 'To the sofa' },
      { kind: 'act', x: seat.x, z: seat.z, yaw: seat.yaw, pose: 'sit', secs: 0.45, label: 'Sitting down', done: () => this.host.sound('switch') },
      {
        kind: 'act', yaw: seat.yaw + look, pose: 'sit_back', secs: 14, label: 'Watching telly',
        tick: (dt) => {
          n.energy = Math.min(100, n.energy + 0.8 * dt);
          recover(p.save.gym, p.save.playTime, 0.6 * dt);
        },
      },
    ], (cancelled) => {
      if (!cancelled) this.host.toast('Feet up for a bit. Energy and fatigue a little better.', 'item');
    });
  }

  private bed(how: 'sleep' | 'nap', station?: StationDef): void {
    const p = this.host.progress()!;
    const w = this.host.world()!;
    const placed = p.save.property.furniture.find((f) => (f.id === 'bed_double' || f.id === 'bed_single') && f.at);
    if (!placed?.at) return;
    const def = FURNITURE[placed.id];
    const [, hz] = def.size;
    const side = placed.id === 'bed_double' ? def.size[0] * 0.48 : 0;
    const at = placed.at;
    const stand = pieceLocal(at, side, hz + 0.35);
    const edge = pieceLocal(at, side, hz - 0.22);
    const lie = pieceLocal(at, side, -hz + 0.78);
    const n = p.save.needs;
    const secs = how === 'sleep' ? 10 : 5;
    const from = n.energy;
    const target = how === 'sleep' ? 100 : Math.min(100, from + 35);
    void station;
    this.start('sleep', how === 'sleep' ? 'Sleeping' : 'Lying down', [
      { kind: 'walk', x: stand.x, z: stand.z, label: 'To bed' },
      { kind: 'act', x: edge.x, z: edge.z, y: 0.1, yaw: edge.yaw, pose: 'sit_edge', secs: 0.9, label: 'Sitting on the bed', start: () => this.host.sound('bed') },
      {
        kind: 'act', x: lie.x, z: lie.z, y: 0, yaw: lie.yaw, pose: 'lie', secs, label: how === 'sleep' ? 'Asleep' : 'Resting',
        tick: (dt, k) => {
          n.energy = Math.max(n.energy, from + (target - from) * k);
          recover(p.save.gym, p.save.playTime, (how === 'sleep' ? 12 : 4) * dt);
        },
      },
      { kind: 'act', x: edge.x, z: edge.z, y: 0.1, yaw: edge.yaw, pose: 'sit_edge', secs: 0.9, label: 'Getting up', start: () => this.host.sound('bed') },
    ], (cancelled) => {
      if (cancelled) return this.host.toast('Up again.', 'info');
      const v = w.player.vitals;
      if (how === 'sleep') {
        n.energy = 100;
        recover(p.save.gym, p.save.playTime, 100);
        const rested = this.host.restAtHome();
        v.health = v.maxHealth;
        v.stamina = v.maxStamina;
        // A night's sleep: you wake up hungry, needing the loo, wanting a brush.
        n.hunger = Math.max(5, n.hunger - 12);
        n.bladder = Math.min(100, n.bladder + 20);
        n.oral = Math.max(0, n.oral - 12);
        n.hygiene = Math.max(0, n.hygiene - 4);
        this.host.toast(`Slept well. Fully rested. ${rested}`, 'item');
      } else {
        recover(p.save.gym, p.save.playTime, 30);
        v.health = Math.min(v.maxHealth, v.health + v.maxHealth * 0.25);
        this.host.toast(`Had a lie down. Energy: ${needLabel('energy', n.energy).label.toLowerCase()}.`, 'item');
      }
      this.host.refresh();
    });
  }

  // ---- needs over time ------------------------------------------------------------------

  /** Once a second or so: needs move on, effects update, the odd nudge. */
  tickNeeds(dt: number): void {
    const p = this.host.progress();
    const w = this.host.world();
    if (!p || !w) return;
    const home = w.level.id === 'home' || w.level.id === 'basement';
    tickNeeds(p.save.needs, dt, { home, fighting: !!w.activeEncounter || w.enemies.some((e) => !e.isKO && Math.abs(e.pos.x - w.player.pos.x) < 6), sleeping: this.sleeping });
    const key = needsModifierKey(p.save.needs);
    if (key !== this.modKey) {
      const first = this.modKey === '' && key === '';
      this.modKey = key;
      if (!first) this.host.refresh();
    }
    // A nudge the first time something gets urgent (and again after it's been sorted).
    const urgent = new Set(attention(p.save.needs).filter((a) => a.label.urgency === 2).map((a) => a.key));
    for (const k of urgent) {
      if (this.warned.has(k)) continue;
      this.warned.add(k);
      this.host.toast(NUDGES[k], 'warn');
    }
    for (const k of [...this.warned]) if (!urgent.has(k as NeedKey)) this.warned.delete(k);
  }
}

const NUDGES: Record<NeedKey, string> = {
  hunger: 'You’re starving. Get something to eat (stamina comes back slower).',
  energy: 'You’re exhausted. Get some sleep at home.',
  hygiene: 'You could do with a shower.',
  oral: 'Your teeth want brushing.',
  bladder: 'You’re bursting. Find a loo.',
  nutrition: 'All that junk food’s catching up with you. Cook something proper.',
};
