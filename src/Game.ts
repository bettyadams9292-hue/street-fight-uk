import { AudioManager } from './audio/AudioManager';
import { DT } from './core/constants';
import { TrainingMode } from './core/TrainingMode';
import { ARCHETYPE_IDS, type ArchetypeId } from './ai/archetypes';
import type { TrainingOpponent } from './core/TrainingMode';
import type { StyleId } from './styles/StyleData';
import { practiceScreen } from './ui/PracticeScreen';
import { InputManager, type InputSource, type MenuAction } from './input/InputManager';
import { GameRenderer } from './render/GameRenderer';
import { SettingsStore, type Settings } from './save/Settings';
import { Hud } from './ui/Hud';
import { TouchControls } from './ui/TouchControls';
import { UIManager } from './ui/UIManager';
import { controlsScreen, mainMenu, pauseMenu, settingsScreen } from './ui/screens';
import { characterCreator } from './ui/CharacterCreator';
import { characterSheet, confirmScreen } from './ui/CharacterSheet';
import { CharacterStore } from './save/CharacterStore';
import type { PlayerCharacter } from './character/Character';
import { randomAppearance, type CharacterAppearance } from './character/Appearance';
import { Simulation } from './core/Simulation';
import { Fighter } from './fighter/Fighter';
import { Arena } from './world/Arena';
import { STYLES } from './data/styles';
import { defaultAttributes } from './stats/Stats';
import { emptyCommand, type AttackButton } from './input/Commands';
import type { StudioFraming } from './render/StudioView';

type GameState = 'menu' | 'studio' | 'playing' | 'paused';
const MAX_STEPS_PER_FRAME = 5;

/**
 * Top-level game: owns settings, input, audio, rendering and UI, and runs
 * the fixed 60 Hz simulation inside a variable-rate render loop.
 */
export class Game {
  private settings = new SettingsStore();
  private input = new InputManager();
  private audio: AudioManager;
  private renderer: GameRenderer;
  private ui: UIManager;
  private hud: Hud;
  private touch: TouchControls;
  private mode: TrainingMode | null = null;
  /** Training-ground choices, kept for the session. */
  private training: { mode: TrainingOpponent; archetype: ArchetypeId; primary: StyleId; secondary: StyleId | null } = {
    mode: 'stand',
    archetype: 'thug',
    primary: 'street',
    secondary: null,
  };
  private characters = new CharacterStore();
  private character: PlayerCharacter | null = null;
  /** Character creator / sheet preview: a one-fighter simulation on the studio set. */
  private studio: { sim: Simulation; fighter: Fighter; framing: StudioFraming; nextDemo: number; pending: CharacterAppearance | null } | null = null;
  private state: GameState = 'menu';
  private unsubscribe: (() => void)[] = [];
  private accumulator = 0;
  private last = 0;
  private time = 0;

  constructor(gameRoot: HTMLElement, private readonly uiRoot: HTMLElement) {
    const s = this.settings.get();
    this.audio = new AudioManager(s);
    this.renderer = new GameRenderer(gameRoot, s.quality);
    this.renderer.onFootstep = () => this.audio.step();
    this.ui = new UIManager(uiRoot);
    this.ui.onNavigate = () => this.audio.uiMove();
    this.ui.onConfirm = () => this.audio.uiConfirm();

    this.hud = new Hud({
      setMode: (m) => this.setTrainingMode(m),
      nextOpponent: () => this.nextOpponent(),
      reset: () => this.resetPositions(),
      pause: () => this.pause(),
    });
    this.hud.el.style.display = 'none';
    uiRoot.append(this.hud.el);

    this.touch = new TouchControls(this.input);
    uiRoot.append(this.touch.el);

    this.input.onMenu((a, src) => this.onMenuAction(a, src));
    window.addEventListener('keydown', (e) => this.onKey(e));

    // Audio can only start after a user gesture.
    const unlock = () => {
      this.audio.unlock();
      this.audio.startAmbience();
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);

    this.settings.onChange((next) => this.applySettings(next));
    this.applySettings(s);

    this.character = this.characters.load();
    window.addEventListener('resize', () => this.updateStudioPanel());
    this.showMainMenu();

    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'playing') this.pause();
    });

    requestAnimationFrame((t) => this.frame(t));
  }

  // ---- flow ----------------------------------------------------------------

  private showMainMenu(): void {
    this.state = 'menu';
    this.studio = null;
    this.unwire();
    // The alley, with your fighter in it, sits behind the main menu.
    this.mode = new TrainingMode({ character: this.character });
    this.renderer.attach(this.mode.sim);
    this.hud.el.style.display = 'none';
    this.updateTouchVisibility();
    this.ui.replaceAll(
      mainMenu(!!this.character, {
        newGame: () => this.newGame(),
        continue: () => this.startTraining(),
        character: () => this.openSheet(),
        settings: () => this.ui.push(settingsScreen(this.settings, this.ui)),
        controls: () => this.ui.push(controlsScreen(this.ui)),
      }),
    );
  }

  private newGame(): void {
    if (!this.character) {
      this.openCreator('new');
      return;
    }
    this.ui.push(
      confirmScreen(
        'Start again?',
        `This replaces ${this.character.name}. Your current fighter will be lost.`,
        'Start a new fighter',
        'Keep my fighter',
        () => this.openCreator('new'),
        () => this.ui.pop(),
      ),
    );
  }

  // ---- studio: character creator and sheet ------------------------------------

  private enterStudio(appearance: CharacterAppearance): void {
    const sim = new Simulation(new Arena({ minX: -0.5, maxX: 0.5, minZ: -0.3, maxZ: 0.3 }, 'Studio'), 99);
    const fighter = sim.add(
      new Fighter({
        id: 1,
        name: 'Preview',
        team: 'player',
        attributes: defaultAttributes(5),
        style: STYLES.street,
        appearance,
      }),
    );
    fighter.facing = 1;
    this.mode = null;
    this.unwire();
    this.renderer.attachStudio(sim);
    this.studio = { sim, fighter, framing: 'full', nextDemo: 120, pending: null };
    this.state = 'studio';
    this.hud.el.style.display = 'none';
    this.updateTouchVisibility();
    this.updateStudioPanel();
  }

  private updateStudioPanel(): void {
    if (!this.studio) return;
    const portrait = window.innerHeight > window.innerWidth && window.innerWidth < 760;
    this.renderer.setStudioPanel(portrait ? 'bottom' : 'left');
  }

  private openCreator(mode: 'new' | 'edit'): void {
    const existing = mode === 'edit' ? this.character ?? undefined : undefined;
    const startLook = existing?.appearance ?? characterCreatorDefault();
    this.enterStudio(startLook);
    const screen = characterCreator(
      mode,
      {
        preview: (a) => {
          // Batch rebuilds to once per frame while sliders are dragged.
          if (this.studio) this.studio.pending = a;
        },
        frame: (f) => {
          if (!this.studio) return;
          this.studio.framing = f;
          this.renderer.setStudioFraming(f);
        },
        rotate: (d) => this.renderer.rotateStudio(d),
        done: ({ character, appearance }) => {
          if (mode === 'new' && character) {
            this.character = character;
          } else if (this.character) {
            this.character = { ...this.character, appearance };
          }
          if (this.character && !this.characters.save(this.character)) {
            this.hud.notify('Couldn\u2019t save: your browser blocked storage', 'warn');
          }
          if (mode === 'new') this.startTraining();
          else this.openSheet();
        },
        cancel: () => (mode === 'edit' ? this.openSheet() : this.showMainMenu()),
      },
      existing,
      startLook,
    );
    this.ui.replaceAll(screen);
  }

  private openSheet(): void {
    if (!this.character) return this.showMainMenu();
    this.enterStudio(this.character.appearance);
    this.renderer.setStudioFraming('full');
    this.ui.replaceAll(characterSheet(this.character, { editLook: () => this.openCreator('edit'), back: () => this.showMainMenu() }));
  }

  /** Scripted shadow-boxing for the preview model, so you see your fighter move. */
  private stepStudio(dt: number): void {
    const st = this.studio;
    if (!st) return;
    if (st.pending) {
      this.renderer.setPreviewAppearance(st.fighter, st.pending);
      st.pending = null;
    }
    this.accumulator += dt;
    let steps = 0;
    while (this.accumulator >= DT && steps < MAX_STEPS_PER_FRAME) {
      const cmd = emptyCommand();
      if (st.sim.frame >= st.nextDemo) {
        st.nextDemo = st.sim.frame + 150 + Math.floor(Math.random() * 90);
        if (st.framing === 'full') {
          const buttons: AttackButton[] = ['lp', 'lp', 'hp', 'lk', 'hk'];
          cmd.pressed[buttons[Math.floor(Math.random() * buttons.length)]] = true;
        }
      }
      st.sim.step(new Map([[st.fighter.id, cmd]]));
      st.fighter.vitals.reset();
      st.fighter.pos.x = 0;
      st.fighter.pos.z = 0;
      this.accumulator -= DT;
      steps++;
    }
    if (steps === MAX_STEPS_PER_FRAME) this.accumulator = 0;
  }

  private startTraining(): void {
    this.audio.unlock();
    this.audio.startAmbience();
    this.unwire();
    this.studio = null;
    const t = this.training;
    this.mode = new TrainingMode({ touch: this.touchWanted(), character: this.character, practice: { primary: t.primary, secondary: t.secondary } });
    this.mode.archetype = t.archetype;
    this.mode.setMode(t.mode);
    this.renderer.attach(this.mode.sim);
    this.wire(this.mode);
    this.hud.setMode(t.mode, t.archetype);
    this.ui.replaceAll(null);
    this.hud.el.style.display = 'block';
    this.state = 'playing';
    this.accumulator = 0;
    this.input.flush();
    this.updateTouchVisibility();
    this.hud.notify('TRAINING GROUND', 'big');
  }

  private pause(): void {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.input.flush();
    this.touch.release();
    this.updateTouchVisibility();
    this.ui.replaceAll(
      pauseMenu({
        resume: () => this.resume(),
        settings: () => this.ui.push(settingsScreen(this.settings, this.ui)),
        controls: () => this.ui.push(controlsScreen(this.ui)),
        practice: () =>
          this.ui.push(
            practiceScreen(this.training.primary, this.training.secondary, this.ui, (primary, secondary) => {
              this.training.primary = primary;
              this.training.secondary = secondary;
              this.mode?.setPracticeStyles(primary, secondary);
            }),
          ),
        quit: () => this.quitToMenu(),
      }),
    );
  }

  private resume(): void {
    if (this.state !== 'paused') return;
    this.ui.replaceAll(null);
    this.state = 'playing';
    this.accumulator = 0;
    this.input.flush();
    this.updateTouchVisibility();
  }

  private quitToMenu(): void {
    this.showMainMenu();
  }

  private setTrainingMode(m: TrainingOpponent): void {
    this.training.mode = m;
    this.mode?.setMode(m);
    this.renderer.syncFighters();
    this.hud.setMode(m, this.training.archetype);
    this.hud.notify(m === 'spar' ? this.mode?.enemies[0]?.name.toUpperCase() ?? 'SPAR' : m === 'group' ? 'THREE OF THEM' : 'TRAINING', 'info');
  }

  private nextOpponent(): void {
    const i = ARCHETYPE_IDS.indexOf(this.training.archetype);
    this.training.archetype = ARCHETYPE_IDS[(i + 1) % ARCHETYPE_IDS.length];
    if (this.mode) this.mode.archetype = this.training.archetype;
    this.setTrainingMode('spar');
  }

  private resetPositions(): void {
    if (!this.mode) return;
    this.mode.player.respawn();
    this.mode.setMode(this.mode.mode);
    this.renderer.syncFighters();
    this.hud.notify('RESET', 'info');
  }

  // ---- input -----------------------------------------------------------------

  private onMenuAction(a: MenuAction, src: InputSource): void {
    this.audio.unlock();
    if (this.ui.isOpen) {
      this.ui.handle(a, src);
      return;
    }
    if (this.state === 'playing' && (a === 'pause' || (a === 'back' && src === 'keyboard'))) this.pause();
  }

  private onKey(e: KeyboardEvent): void {
    if (e.code === 'F1') {
      e.preventDefault();
      this.settings.update({ showHitboxes: !this.settings.get().showHitboxes });
      return;
    }
    if (this.state !== 'playing' || e.repeat) return;
    if (e.code === 'Digit1') this.setTrainingMode('stand');
    else if (e.code === 'Digit2') this.setTrainingMode('block');
    else if (e.code === 'Digit3') this.setTrainingMode('spar');
    else if (e.code === 'Digit4') this.setTrainingMode('group');
    else if (e.code === 'KeyN') this.nextOpponent();
    else if (e.code === 'KeyR') this.resetPositions();
  }

  // ---- settings ------------------------------------------------------------

  private applySettings(s: Settings): void {
    this.audio.applySettings(s);
    this.renderer.applyQuality(s.quality);
    this.renderer.hitboxes.visible = s.showHitboxes;
    this.hud.setFpsVisible(s.showFps);
    this.updateTouchVisibility();
  }

  private touchWanted(): boolean {
    const mode = this.settings.get().touchControls;
    if (mode === 'on') return true;
    if (mode === 'off') return false;
    return window.matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in window;
  }

  private updateTouchVisibility(): void {
    document.body.classList.toggle('in-fight', this.state === 'playing' || this.state === 'paused');
    this.touch.visible = this.state === 'playing' && this.touchWanted();
    this.uiRoot.classList.toggle('touch-ui', this.touchWanted());
  }

  // ---- events from the fight -----------------------------------------------------

  private wire(mode: TrainingMode): void {
    const bus = mode.sim.bus;
    const isPlayer = (f: { team: string }) => f.team === 'player';
    const cam = this.renderer.cameraRig;
    const floatAt = (x: number, y: number, z: number, text: string, kind: 'dmg' | 'clean' | 'block') => {
      const c = this.renderer.canvas;
      const p = cam.project(x, y, z, c.clientWidth, c.clientHeight);
      if (p.visible) this.hud.floater(p.x, p.y, text, kind);
    };

    this.unsubscribe.push(
      bus.on('move:started', ({ move }) => this.audio.swing(move.kind === 'heavy')),
      bus.on('hit:landed', (hit) => {
        const heavy = hit.move.kind === 'heavy';
        this.audio.impact(heavy ? 1 : hit.move.damage > 6 ? 0.45 : 0.15, hit.clean);
        this.renderer.fx.burst(hit.x, hit.y, hit.z, Math.sign(hit.target.pos.x - hit.attacker.pos.x) || 1, heavy ? 'heavy' : 'hit');
        this.renderer.viewOf(hit.target)?.flash();
        if (this.settings.get().screenShake) cam.addShake(0.03 + hit.damage * 0.007);
        floatAt(hit.x, hit.y + 0.25, hit.z, `${Math.round(hit.damage)}`, hit.clean ? 'clean' : 'dmg');
        if (isPlayer(hit.attacker)) {
          this.hud.showCombo(hit.comboHits);
          if (hit.counter) this.hud.notify('COUNTER', 'warn');
          else if (hit.clean) this.hud.notify('CLEAN HIT', 'info');
        }
      }),
      bus.on('hit:blocked', (hit) => {
        this.audio.block();
        this.renderer.fx.burst(hit.x, hit.y, hit.z, Math.sign(hit.target.pos.x - hit.attacker.pos.x) || 1, 'block');
        floatAt(hit.x, hit.y + 0.25, hit.z, hit.damage >= 0.5 ? `${Math.round(hit.damage)}` : 'BLOCK', 'block');
      }),
      bus.on('guard:broken', () => {
        this.audio.guardBreak();
        this.hud.notify('GUARD BREAK', 'warn');
        if (this.settings.get().screenShake) cam.addShake(0.12);
      }),
      bus.on('fighter:knockdown', () => {
        this.audio.knockdown();
        this.hud.notify('KNOCKDOWN', 'info');
      }),
      bus.on('fighter:ko', ({ fighter }) => {
        this.audio.ko();
        this.hud.notify(isPlayer(fighter) ? 'YOU’RE DOWN' : 'K.O.', 'big');
        if (this.settings.get().screenShake) cam.addShake(0.25);
      }),
      bus.on('action:refused', ({ fighter }) => {
        if (isPlayer(fighter)) this.hud.notify('TOO TIRED', 'warn');
      }),
      bus.on('fighter:fatigue', ({ fighter, state }) => {
        if (isPlayer(fighter) && state === 'exhausted') this.hud.notify('EXHAUSTED — BACK OFF', 'warn');
      }),
      bus.on('hit:parried', ({ target }) => {
        this.audio.block();
        this.renderer.fx.burst(target.pos.x + target.facing * 0.4, target.pos.y + 1.4, target.pos.z, target.facing, 'block');
        if (isPlayer(target)) this.hud.notify('PARRY! COUNTER NOW', 'warn');
        else this.hud.notify('PARRIED', 'info');
      }),
      bus.on('fighter:finished', ({ by }) => {
        if (this.settings.get().screenShake) cam.addShake(0.35);
        this.hud.notify(isPlayer(by) ? 'FINISHED!' : 'FINISHED', 'big');
      }),
      bus.on('grapple:start', ({ holder, phase }) => {
        this.audio.impact(0.3, false);
        if (phase === 'ground') this.hud.notify(isPlayer(holder) ? 'TAKEDOWN' : 'TAKEN DOWN', 'info');
      }),
      bus.on('grapple:takedown', () => {
        this.audio.knockdown();
        this.hud.notify('TAKEDOWN', 'info');
      }),
      bus.on('grapple:throw', ({ wall }) => {
        this.audio.knockdown();
        if (this.settings.get().screenShake) cam.addShake(0.15);
        this.hud.notify(wall ? 'INTO THE WALL!' : 'THROWN', 'warn');
      }),
      bus.on('grapple:escape', ({ held }) => this.hud.notify(isPlayer(held) ? 'BROKE FREE' : 'THEY BROKE FREE', 'info')),
      bus.on('grapple:sprawl', ({ defender }) => this.hud.notify(isPlayer(defender) ? 'SPRAWL!' : 'SPRAWLED', 'warn')),
      bus.on('submission', ({ holder }) => {
        this.audio.ko();
        this.hud.notify(isPlayer(holder) ? 'TAPPED OUT' : 'YOU TAPPED', 'big');
      }),
      bus.on('fighter:sweep', ({ fighter }) => this.hud.notify(isPlayer(fighter) ? 'SWEEP!' : 'SWEPT', 'warn')),
      bus.on('style:swapped', ({ fighter, style }) => {
        if (isPlayer(fighter)) this.hud.notify(style.name.toUpperCase(), 'info');
      }),
      bus.on('fighter:respawn', ({ fighter }) => {
        this.hud.notify(isPlayer(fighter) ? 'BACK ON YOUR FEET' : 'PARTNER’S BACK UP', 'info');
      }),
    );
  }

  /** Context help: grapple options, escapes, submissions, finishers. */
  private updatePrompt(): void {
    const p = this.mode!.player;
    const touch = this.touchWanted();
    const k = (key: string, pad: string, t: string) => (touch ? t : this.input.lastDevice === 'gamepad' ? pad : key);
    const link = p.grapple;
    let text = '';
    let sub: number | null = null;
    if (link?.role === 'holder') {
      const s = p.style;
      if (link.phase === 'ground') {
        text = s.ground
          ? `${k('J', 'X', 'LP')} ground strikes \u00b7 ${k('I', 'Y', 'HP')} ${s.moves[s.ground.submission].name} \u00b7 ${k('U', 'LB', 'GRAB')} let go`
          : `${k('U', 'LB', 'GRAB')} let go`;
        if (link.submitting) sub = link.subProgress;
      } else {
        text = `${k('J', 'X', 'LP')} ${s.moves[s.clinch.strike].name} \u00b7 ${k('K', 'A', 'LK')} ${s.moves[s.clinch.throw].name} \u00b7 ${k('L', 'B', 'HK')} ${s.moves[s.clinch.power].name} \u00b7 ${k('U', 'LB', 'GRAB')} let go`;
      }
    } else if (link?.role === 'held') {
      text = link.submitting ? `SUBMISSION! Hold ${k('Space', 'RT', 'BLOCK')} to resist \u00b7 ${k('U', 'LB', 'GRAB')} to escape` : `${k('U', 'LB', 'GRAB')} to break free`;
      if (link.submitting) sub = link.subProgress;
    } else if (p.canFinish()) {
      text = `FINISH IT: ${k('O + I', 'RB + Y', 'SP then HP')}`;
    } else if (p.state === 'knockdown' && p.stateFrame > 10) {
      text = `Get up: ${k('C', 'L3', 'JUMP')} quick \u00b7 ${k('W/S', 'up/down', 'stick up/down')} roll \u00b7 attack to get up swinging${p.style.defence === 'guard_pull' ? ` \u00b7 ${k('U', 'LB', 'GRAB')} sweep` : ''}`;
    }
    this.hud.setPrompt(text, sub);
  }

  private unwire(): void {
    for (const off of this.unsubscribe) off();
    this.unsubscribe = [];
  }

  // ---- main loop -------------------------------------------------------------

  private frame(t: number): void {
    const dt = this.last === 0 ? 1 / 60 : Math.min(0.1, (t - this.last) / 1000);
    this.last = t;
    this.time += dt;

    const pad = this.input.pollGamepad();

    if (this.state === 'playing' && this.mode) {
      this.accumulator += dt;
      let steps = 0;
      while (this.accumulator >= DT && steps < MAX_STEPS_PER_FRAME) {
        this.mode.step(this.input.sample(pad));
        this.accumulator -= DT;
        steps++;
      }
      if (steps === MAX_STEPS_PER_FRAME) this.accumulator = 0;
    } else if (this.state === 'studio') {
      this.input.flush();
      this.stepStudio(dt);
    } else {
      this.input.flush();
    }

    const inFight = (this.state === 'playing' || this.state === 'paused') && !!this.mode;
    this.renderer.render(dt, this.time, inFight ? this.mode!.player : null);
    if (inFight && this.mode) {
      this.hud.update(dt, this.mode.player, this.mode.focusEnemy);
      this.updatePrompt();
    }

    requestAnimationFrame((n) => this.frame(n));
  }
}

function characterCreatorDefault(): CharacterAppearance {
  // A fresh random look each time you start a new fighter.
  return randomAppearance();
}
