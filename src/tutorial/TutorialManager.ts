/**
 * Runs the tutorial (docs/TUTORIAL.md): the essential chapters on a new game, one-off hints later on, and
 * replays from Pause → Tutorials.
 *
 * - It listens to the game's own events (the simulation's bus and the world's), boiled down to TutEvents, and
 *   checks each step against them or against the state each frame. A step only completes on what really
 *   happened: a punch that misses doesn't count as landing one.
 * - Mo's part in a lesson is World.startLesson (the real combat engine, his choices scripted).
 * - It keeps its place in `save.tutorial`, so a reload carries on where it was.
 * - It never blocks play: every step can be skipped, and so can the lot.
 */
import type { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/GameEvents';
import type { InputSource } from '../input/InputManager';
import type { Progress } from '../progress/Progress';
import type { World } from '../world/World';
import { control, controlTarget, type Action } from './controls';
import { CHAPTERS, GUIDES, HINTS, type ChapterDef, type Ctx, type HintDef, type StepDef, type TutEvent } from './lessons';
import { LessonOverlay, type LessonView } from './overlay';
import { ALL_HINTS, type TutorialSave } from './state';

export interface TutorialHost {
  progress(): Progress | null;
  world(): World | null;
  /** Playing (not paused, no screen open over the game). */
  playing(): boolean;
  device(): InputSource;
  /** Contextual hints are on (Settings → Tutorial hints). */
  hintsOn(): boolean;
  save(): void;
  sound(kind: 'step' | 'done' | 'chapter'): void;
  /** Where you are across the screen, 0 (left) to 1 (right), or null if not on it. */
  playerScreenX(): number | null;
}

/** A hint card stays this long unless you dismiss it first. */
const HINT_SECONDS = 14;
/** A step you read stays up at least this long before Next does anything (no skipping it by mashing). */
const READ_MIN = 0.4;

export class TutorialManager {
  private overlay: LessonOverlay;
  /** The chapter being replayed from the library (not the save's own run). */
  private replay: { chapter: string; step: number } | null = null;
  private stepStarted = 0;
  private walked = 0;
  private stepped = 0;
  private ran = 0;
  private last: { x: number; z: number } | null = null;
  private time = 0;
  private hint: { def: HintDef; until: number } | null = null;
  private hintQueue: HintDef[] = [];
  private pollAt = 0;
  private side: 'left' | 'right' = 'left';

  constructor(private readonly host: TutorialHost, slot: HTMLElement) {
    this.overlay = new LessonOverlay(slot, { next: () => this.next(), skip: () => this.skipStep() });
  }

  // ---- state -------------------------------------------------------------------------------

  private get save(): TutorialSave | null {
    return this.host.progress()?.save.tutorial ?? null;
  }

  /** The chapter and step running now (a replay first, then the save's own run), or null. */
  private current(): { chapter: ChapterDef; step: StepDef; index: number } | null {
    const at = this.replay ?? this.save?.active ?? this.save?.guide ?? null;
    if (!at) return null;
    const chapter = CHAPTERS.find((c) => c.id === at.chapter) ?? GUIDES.find((c) => c.id === at.chapter);
    const step = chapter?.steps[at.step];
    return chapter && step ? { chapter, step, index: at.step } : null;
  }

  /** Running an essential chapter or a replay. */
  get active(): boolean {
    return !!this.current();
  }

  /** The step on screen is one you read (Enter, A on a pad, or the button moves on). */
  get wantsNext(): boolean {
    const c = this.current();
    return !!(c && 'read' in c.step.done) || !!this.hint;
  }

  // ---- the game's events, boiled down --------------------------------------------------------

  /** Listen to a world and its simulation. Returns the unsubscribers (Game drops them when the world goes). */
  attach(w: World, bus: EventBus<GameEvents>): (() => void)[] {
    const me = () => w.player;
    const mo = () => w.sparringPartner;
    const ev = w.events;
    return [
      bus.on('fighter:jump', ({ fighter }) => fighter === me() && this.feed({ type: 'jump' })),
      bus.on('hit:landed', ({ attacker, target, move, comboHits }) => {
        if (attacker === me()) this.feed({ type: 'hit', button: move.button, kind: move.kind, combo: comboHits, onMo: target === mo() });
      }),
      bus.on('hit:blocked', ({ target }) => target === me() && this.feed({ type: 'blocked' })),
      bus.on('hit:parried', ({ target }) => target === me() && this.feed({ type: 'parried' })),
      bus.on('fighter:dodge', ({ fighter }) => {
        if (fighter !== me()) return;
        // Dodging something: an opponent close by is mid-swing.
        const underAttack = w.sim.fighters.some((f) => f !== fighter && f.team === 'enemy' && f.state === 'attack' && Math.abs(f.pos.x - fighter.pos.x) < 2.2);
        this.feed({ type: 'dodge', underAttack });
      }),
      bus.on('grapple:start', ({ holder }) => holder === me() && this.feed({ type: 'grabbed' })),
      bus.on('grapple:escape', ({ held }) => held === me() && this.feed({ type: 'escaped' })),
      bus.on('move:started', ({ fighter, move }) => fighter === me() && move.kind === 'special' && this.feed({ type: 'special' })),
      bus.on('fighter:finished', ({ by }) => by === me() && this.feed({ type: 'finished' })),
      bus.on('style:swapped', ({ fighter }) => fighter === me() && this.feed({ type: 'swapped' })),
      ev.on('station', ({ id }) => this.feed({ type: 'station', id })),
      ev.on('encounter:cleared', ({ id, cash, xp, optional }) => this.feed({ type: 'cleared', id, cash, xp, optional })),
      ev.on('item:picked', () => this.feed({ type: 'picked' })),
      ev.on('item:held', () => this.feed({ type: 'held' })),
      ev.on('injury', ({ who }) => who === 'you' && this.feed({ type: 'injury' })),
      ev.on('level:up', () => this.feed({ type: 'levelup' })),
      ev.on('police:arrive', () => this.feed({ type: 'police' })),
      ev.on('hotbar:used', () => this.feed({ type: 'hotbar' })),
      ev.on('job:step', () => this.feed({ type: 'job', stage: 'step' })),
      ev.on('job:done', () => this.feed({ type: 'job', stage: 'done' })),
      ev.on('job:failed', () => this.feed({ type: 'job', stage: 'failed' })),
    ];
  }

  /** Something happened (the bridge above, or Game for the phone, pause and screens). */
  feed(e: TutEvent): void {
    const c = this.current();
    const ctx = this.ctx();
    if (c && ctx && 'on' in c.step.done && c.step.done.on === e.type && this.ready(c.step, ctx) && (!c.step.done.test || c.step.done.test(e, ctx))) this.complete();
    else if (!c) for (const g of GUIDES) if (g.start && 'on' in g.start && g.start.on === e.type && (!g.start.test || g.start.test(e)) && this.startGuide(g.id, false)) break;
    this.offerHints(e);
  }

  /**
   * Start a guide: on its own the first time you meet its thing (once the first-run lessons are done, hints on, and
   * not already done or skipped), or from Pause → Tutorials (`asked`). False if it didn't start.
   */
  startGuide(id: string, asked: boolean): boolean {
    const s = this.save;
    const g = GUIDES.find((x) => x.id === id);
    if (!s || !g) return false;
    if (!asked && (!s.essentialDone || s.active || s.guide || this.replay || !this.host.hintsOn() || s.completed.includes(id) || s.skipped.includes(id))) return false;
    if (asked && (s.active || this.replay)) return false;
    s.guide = { chapter: id, step: 0 };
    this.hint = null;
    this.resetStep();
    this.host.save();
    return true;
  }

  // ---- each frame --------------------------------------------------------------------------

  /** Call every frame (dt in seconds). Polls state-based steps and keeps Mo and the card in step. */
  update(dt: number): void {
    this.time += dt;
    const ctx = this.ctx();
    if (!ctx) {
      this.overlay.show(null);
      return;
    }
    const playing = this.host.playing();
    // How you've moved since the step began.
    const p = ctx.player.pos;
    if (this.last && playing) {
      this.walked += Math.abs(p.x - this.last.x);
      this.stepped += Math.abs(p.z - this.last.z);
      if (ctx.player.running) this.ran += dt;
    }
    this.last = { x: p.x, z: p.z };
    const c = this.current();
    if (c) {
      this.direct(c, ctx);
      if (playing && 'poll' in c.step.done && this.ready(c.step, ctx) && c.step.done.poll({ ...ctx, walked: this.walked, stepped: this.stepped, ran: this.ran })) this.complete();
    } else if (playing) {
      this.pollHints(ctx);
    }
    // The card keeps off your fighter: on the right while you're on the left of the screen.
    const sx = this.host.playerScreenX();
    if (sx !== null) this.side = sx < 0.45 ? 'right' : sx > 0.55 ? 'left' : this.side;
    this.overlay.show(playing ? this.view(ctx) : null, this.side);
  }

  /** Mo's part, and passing over what can't be done here. */
  private direct(c: { chapter: ChapterDef; step: StepDef }, ctx: Ctx): void {
    const w = ctx.world;
    const at = c.step.at;
    const there = !at || (w.level.id === at.area && (at.x === undefined || Math.abs(ctx.player.pos.x - at.x) < 3.5));
    if (c.step.mo) {
      // Mo should be on the mat at home: if he isn't, the lesson can't run, so it's passed over.
      if (w.level.id === 'home' && !w.sparringPartner) return this.skipStep();
      if (there && w.level.id === 'home' && w.sparringPartner && !w.activeEncounter) w.startLesson(c.step.mo);
    } else if (w.inLesson && c.chapter.id !== 'learning-to-fight') w.stopDuel();
  }

  /** You're where the step needs you (otherwise it waits, with a pointer). */
  private ready(step: StepDef, ctx: Ctx): boolean {
    // A step with Mo counts once you're in the lesson with him, wherever on the mat the fight has taken you.
    if (step.mo) return ctx.world.inLesson;
    if (!step.at) return true;
    if (ctx.world.level.id !== step.at.area) return false;
    return step.at.x === undefined || Math.abs(ctx.player.pos.x - step.at.x) < 3.5;
  }

  private ctx(): Ctx | null {
    const world = this.host.world();
    const progress = this.host.progress();
    if (!world || !progress) return null;
    return { world, progress, player: world.player, device: this.host.device(), walked: this.walked, stepped: this.stepped, ran: this.ran };
  }

  // ---- moving on ---------------------------------------------------------------------------

  /** Next (a step you read, or a hint card). */
  next(): void {
    if (this.hint) {
      this.hint = null;
      return;
    }
    const c = this.current();
    if (c && 'read' in c.step.done && this.time - this.stepStarted >= READ_MIN) this.complete();
  }

  /** Skip the step on screen. On the very first card it's the whole tutorial. */
  skipStep(): void {
    const c = this.current();
    if (!c) return;
    if (!this.replay && c.chapter.id === 'first-steps' && c.index === 0) return this.skipAll();
    // A guide's first card: not now, thanks (it's in Pause → Tutorials if you want it later).
    const s = this.save;
    if (!this.replay && s?.guide?.chapter === c.chapter.id && c.index === 0) {
      if (!s.skipped.includes(c.chapter.id)) s.skipped.push(c.chapter.id);
      s.guide = null;
      this.resetStep();
      this.overlay.clear();
      this.host.save();
      return;
    }
    this.advance(false);
  }

  private complete(): void {
    this.overlay.flash();
    this.host.sound('done');
    this.advance(true);
  }

  private advance(done: boolean): void {
    const c = this.current();
    if (!c) return;
    const at = this.replay ?? this.save!.active ?? this.save!.guide!;
    const s = this.save!;
    const id = `${c.chapter.id}/${c.step.id}`;
    if (!this.replay) (done ? s.completed : s.skipped).includes(id) || (done ? s.completed : s.skipped).push(id);
    at.step++;
    this.resetStep();
    if (at.step < c.chapter.steps.length) {
      this.host.save();
      return;
    }
    // The chapter's done.
    this.host.sound('chapter');
    this.endChapter(c.chapter);
  }

  private endChapter(ch: ChapterDef): void {
    const w = this.host.world();
    if (w?.inLesson) w.stopDuel();
    const p = this.host.progress();
    if (this.replay) {
      this.replay = null;
      return;
    }
    const s = this.save!;
    if (!s.completed.includes(ch.id)) s.completed.push(ch.id);
    // A guide: done, and play carries on (nothing follows it).
    if (s.guide?.chapter === ch.id) {
      s.guide = null;
      this.host.save();
      return;
    }
    // The old first-fight prompts aren't needed once Mo's taught you.
    if (ch.id === 'learning-to-fight') p?.set('coach:done');
    const i = CHAPTERS.findIndex((c) => c.id === ch.id);
    let next = CHAPTERS[i + 1];
    while (next && p && next.already?.(p)) {
      if (!s.completed.includes(next.id)) s.completed.push(next.id);
      next = CHAPTERS[CHAPTERS.indexOf(next) + 1];
    }
    if (next) s.active = { chapter: next.id, step: 0 };
    else this.finishEssential();
    this.host.save();
  }

  private finishEssential(): void {
    const s = this.save!;
    s.active = null;
    s.essentialDone = true;
    this.host.progress()?.set('coach:done');
  }

  /** Skip the whole tutorial (the first card, or Pause → Tutorials). Nothing's left half set up. */
  skipAll(): void {
    const s = this.save;
    if (!s) return;
    const w = this.host.world();
    if (w?.inLesson) w.stopDuel();
    this.replay = null;
    for (const ch of CHAPTERS) if (!s.completed.includes(ch.id) && !s.skipped.includes(ch.id)) s.skipped.push(ch.id);
    this.finishEssential();
    this.resetStep();
    this.overlay.clear();
    this.host.save();
  }

  /** Pick the essential lessons back up where they were (or from the start, if they were skipped). */
  resumeAll(): void {
    const s = this.save;
    if (!s) return;
    const first = CHAPTERS.find((c) => !s.completed.includes(c.id)) ?? CHAPTERS[0];
    s.skipped = s.skipped.filter((id) => !CHAPTERS.some((c) => c.id === id));
    s.essentialDone = false;
    s.active = { chapter: first.id, step: 0 };
    this.replay = null;
    this.resetStep();
    this.host.save();
  }

  /** Go through a chapter again (from Pause → Tutorials). Replays never pay anything and change nothing kept. */
  replayChapter(id: string): void {
    if (!CHAPTERS.some((c) => c.id === id) && !GUIDES.some((c) => c.id === id)) return;
    this.replay = { chapter: id, step: 0 };
    this.resetStep();
  }

  /** Show a hint again (from Pause → Tutorials). */
  showHint(id: string): void {
    const def = HINTS.find((h) => h.id === id);
    if (def) this.hint = { def, until: this.time + HINT_SECONDS };
  }

  private resetStep(): void {
    this.stepStarted = this.time;
    this.walked = 0;
    this.stepped = 0;
    this.ran = 0;
    if (this.current()) this.host.sound('step');
  }

  // ---- hints ---------------------------------------------------------------------------------

  private seen(id: string): boolean {
    const s = this.save;
    return !s || s.hints.includes(ALL_HINTS) || s.hints.includes(id);
  }

  private queue(def: HintDef): void {
    if (this.seen(def.id) || this.hintQueue.includes(def) || this.hint?.def === def) return;
    this.save!.hints.push(def.id);
    this.hintQueue.push(def);
  }

  private offerHints(e: TutEvent): void {
    if (!this.save || !this.host.hintsOn()) return;
    for (const def of HINTS) if ('on' in def.when && def.when.on === e.type && (!def.when.test || def.when.test(e))) this.queue(def);
  }

  private pollHints(ctx: Ctx): void {
    // Hints wait until the essentials are done: a new player meets one thing at a time.
    if (this.time < this.pollAt) return;
    this.pollAt = this.time + 1;
    const s = this.save;
    if (!s || !s.essentialDone || !this.host.hintsOn()) return;
    // A guide whose moment has come (never in a fight: it waits till it's over).
    if (!ctx.world.fightOn && !this.hint) for (const g of GUIDES) if (g.start && 'poll' in g.start && !s.completed.includes(g.id) && !s.skipped.includes(g.id) && g.start.poll(ctx.progress, ctx.world) && this.startGuide(g.id, false)) return;
    for (const def of HINTS) if ('poll' in def.when && !this.seen(def.id) && def.when.poll(ctx.progress, ctx.world)) this.queue(def);
    if (!this.hint && this.hintQueue.length && !ctx.world.fightOn) {
      const def = this.hintQueue.shift()!;
      this.hint = { def, until: this.time + HINT_SECONDS };
      this.host.sound('step');
      this.host.save();
    }
    if (this.hint && this.time > this.hint.until) this.hint = null;
  }

  // ---- what the card shows ---------------------------------------------------------------------

  private keys(actions: Action[] | undefined, device: InputSource): string[] {
    return (actions ?? []).map((a) => control(a, device));
  }

  private targets(actions: Action[] | undefined, device: InputSource): string[] {
    return (actions ?? []).map((a) => controlTarget(a, device)).filter((x): x is string => !!x);
  }

  private view(ctx: Ctx): LessonView | null {
    const c = this.current();
    const device = ctx.device;
    if (c) {
      const s = c.step;
      const text = typeof s.text === 'function' ? s.text(ctx) : s.text;
      const why = typeof s.why === 'function' ? s.why(ctx) : s.why;
      const read = 'read' in s.done;
      const first = !this.replay && c.chapter.id === 'first-steps' && c.index === 0;
      const guideFirst = !this.replay && this.save?.guide?.chapter === c.chapter.id && c.index === 0;
      return {
        kind: 'step',
        head: `${c.chapter.num} · ${c.chapter.title}${this.replay ? ' (replay)' : ''}`,
        text,
        why,
        keys: this.keys(s.keys, device),
        progress: { at: c.index + 1, of: c.chapter.steps.length },
        pointer: this.pointer(s, ctx),
        next: read ? (first ? 'Start' : c.index === c.chapter.steps.length - 1 ? 'Done' : 'Next') : null,
        skip: !read || first || guideFirst ? (first ? 'Skip the tutorial' : guideFirst ? 'Not now' : 'Skip') : null,
        focus: [...(s.focus ?? []), ...this.targets(s.keys, device)],
      };
    }
    if (this.hint) {
      const d = this.hint.def;
      return { kind: 'hint', head: d.title, text: d.text, why: d.why, keys: this.keys(d.keys, device), next: 'Got it', skip: null, focus: [...(d.focus ?? []), ...this.targets(d.keys, device)] };
    }
    return null;
  }

  /** Where to go first, if you're not there: the way, and roughly how far. */
  private pointer(step: StepDef, ctx: Ctx): string | undefined {
    const at = step.at;
    if (!at) return undefined;
    if (ctx.world.level.id !== at.area) return at.area === 'home' ? 'Head home first: Cabs on your phone will take you.' : `Head to ${at.label}.`;
    if (at.x === undefined || Math.abs(ctx.player.pos.x - at.x) < 3.5 || (step.mo && ctx.world.inLesson)) return undefined;
    const dx = at.x - ctx.player.pos.x;
    return `${dx > 0 ? '→' : '←'} ${at.label}, ${Math.round(Math.abs(dx))} m`;
  }

  /** Leaving the game (back to the menu): drop everything on screen. */
  stop(): void {
    this.replay = null;
    this.hint = null;
    this.hintQueue = [];
    this.overlay.clear();
  }
}
