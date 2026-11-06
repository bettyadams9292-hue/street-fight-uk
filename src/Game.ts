import { AudioManager } from './audio/AudioManager';
import { DT } from './core/constants';
import { TrainingMode } from './core/TrainingMode';
import type { DummyMode } from './ai/DummyBrain';
import { InputManager, type InputSource, type MenuAction } from './input/InputManager';
import { GameRenderer } from './render/GameRenderer';
import { SettingsStore, type Settings } from './save/Settings';
import { Hud } from './ui/Hud';
import { TouchControls } from './ui/TouchControls';
import { UIManager } from './ui/UIManager';
import { controlsScreen, mainMenu, pauseMenu, settingsScreen } from './ui/screens';

type GameState = 'menu' | 'playing' | 'paused';
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
      setMode: (m) => this.setDummyMode(m),
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

    // The alley sits behind the main menu.
    this.mode = new TrainingMode();
    this.renderer.attach(this.mode.sim);
    this.showMainMenu();

    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'playing') this.pause();
    });

    requestAnimationFrame((t) => this.frame(t));
  }

  // ---- flow ----------------------------------------------------------------

  private showMainMenu(): void {
    this.state = 'menu';
    this.hud.el.style.display = 'none';
    this.updateTouchVisibility();
    this.ui.replaceAll(
      mainMenu({
        start: () => this.startTraining(),
        settings: () => this.ui.push(settingsScreen(this.settings, this.ui)),
        controls: () => this.ui.push(controlsScreen(this.ui)),
      }),
    );
  }

  private startTraining(): void {
    this.audio.unlock();
    this.audio.startAmbience();
    this.unwire();
    this.mode = new TrainingMode({ touch: this.touchWanted() });
    this.renderer.attach(this.mode.sim);
    this.wire(this.mode);
    this.setDummyMode('stand');
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
    this.unwire();
    this.mode = new TrainingMode();
    this.renderer.attach(this.mode.sim);
    this.showMainMenu();
  }

  private setDummyMode(m: DummyMode): void {
    this.mode?.setDummyMode(m);
    this.hud.setMode(m);
  }

  private resetPositions(): void {
    if (!this.mode) return;
    this.mode.player.respawn();
    this.mode.dummy.respawn();
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
    if (e.code === 'Digit1') this.setDummyMode('stand');
    else if (e.code === 'Digit2') this.setDummyMode('block');
    else if (e.code === 'Digit3') this.setDummyMode('spar');
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
          if (hit.clean) this.hud.notify('CLEAN HIT', 'info');
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
      bus.on('fighter:respawn', ({ fighter }) => {
        this.hud.notify(isPlayer(fighter) ? 'BACK ON YOUR FEET' : 'PARTNER’S BACK UP', 'info');
      }),
    );
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
    } else {
      this.input.flush();
    }

    const inFight = this.state !== 'menu' && !!this.mode;
    this.renderer.render(dt, this.time, inFight ? this.mode!.player : null);
    if (inFight && this.mode) this.hud.update(dt, this.mode.player, this.mode.dummy);

    requestAnimationFrame((n) => this.frame(n));
  }
}
