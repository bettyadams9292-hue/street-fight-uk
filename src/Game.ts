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
import { SaveStore } from './save/SaveStore';
import { newSave, Progress, type AreaId } from './progress/Progress';
import { LOCKED_COSMETICS, xpForNextLevel } from './progress/catalogue';
import { World } from './world/World';
import { LEVELS } from './world/levels';
import type { Simulation as Sim } from './core/Simulation';
import { contactsScreen, garageScreen, gymScreen, kitchenScreen, rewardScreen, sofaScreen, storyPauseMenu, tinScreen } from './ui/hub';
import type { StationId } from './world/LevelTypes';
import { h } from './ui/dom';

type GameState = 'menu' | 'studio' | 'playing' | 'paused' | 'transition';
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
  private store = new SaveStore();
  private progress: Progress | null = null;
  private world: World | null = null;
  private worldUnsub: (() => void)[] = [];
  private fadeEl: HTMLElement;
  /** Scheduled end-of-fight screens (shown a moment after the KO). */
  private pending: { at: number; show: () => void } | null = null;
  /** Hub panel changed the save: rebuild the player when it closes. */
  private hubDirty = false;
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
    this.fadeEl = h('div', { class: 'fade' });
    uiRoot.append(this.fadeEl);

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

    // Story save (falls back to the backup, or migrates a Stage 1-3 fighter).
    const loaded = this.store.load();
    if (loaded) {
      this.progress = new Progress(loaded.save);
      this.character = loaded.save.character;
    } else {
      this.character = this.characters.load();
    }
    window.addEventListener('resize', () => this.updateStudioPanel());
    this.showMainMenu();
    if (loaded?.recovered) this.hud.notify('Save restored from backup', 'warn');

    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'playing') this.pause();
    });
    // Closing the tab mid-trip: keep the save current (area and entry were saved on arrival).
    window.addEventListener('pagehide', () => {
      if (this.progress) this.saveGame();
    });

    requestAnimationFrame((t) => this.frame(t));
  }

  // ---- flow ----------------------------------------------------------------

  private showMainMenu(): void {
    this.state = 'menu';
    this.studio = null;
    this.leaveWorld();
    this.unwire();
    // The alley, with your fighter in it, sits behind the main menu.
    this.mode = new TrainingMode({ character: this.character });
    this.renderer.attach(this.mode.sim);
    this.hud.el.style.display = 'none';
    this.updateTouchVisibility();
    const p = this.progress;
    const cont = p ? `${p.save.character.name} \u00b7 level ${p.save.level} \u00b7 ${LEVELS[p.save.area].district}` : null;
    this.ui.replaceAll(
      mainMenu(!!this.character, cont, {
        newGame: () => this.newGame(),
        continue: () => this.continueStory(),
        training: () => this.startTraining(),
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
        `This replaces ${this.character.name} and all story progress.`,
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
    this.leaveWorld();
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

  /** @param back where 'edit' returns to: the character sheet, or home (the wardrobe). */
  private openCreator(mode: 'new' | 'edit', back: 'sheet' | 'home' = 'sheet', at?: { x: number; z: number }): void {
    const existing = mode === 'edit' ? this.character ?? undefined : undefined;
    const startLook = existing?.appearance ?? stripLocked(characterCreatorDefault());
    const owned = mode === 'edit' && this.progress ? this.progress.save.cosmetics : [];
    const isLocked = (key: string) => LOCKED_COSMETICS.includes(key) && !owned.includes(key);
    const returnTo = () => (back === 'home' ? this.enterArea('home', 'start', { at }) : this.openSheet());
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
            this.progress = new Progress(newSave(character));
          } else if (this.character) {
            this.character = { ...this.character, appearance };
            if (this.progress) this.progress.save.character = this.character;
          }
          // The training ground still reads the Stage 1-3 store.
          if (this.character) this.characters.save(this.character);
          if (this.progress && !this.saveGame()) this.hud.notify('Couldn\u2019t save: your browser blocked storage', 'warn');
          if (mode === 'new') this.startStory(true);
          else returnTo();
        },
        cancel: () => (mode === 'edit' ? returnTo() : this.showMainMenu()),
      },
      existing,
      startLook,
      isLocked,
    );
    this.ui.replaceAll(screen);
  }

  private openSheet(back: 'menu' | 'home' = 'menu', at?: { x: number; z: number }): void {
    if (!this.character) return this.showMainMenu();
    this.enterStudio(this.character.appearance);
    this.renderer.setStudioFraming('full');
    this.ui.replaceAll(
      characterSheet(this.character, {
        editLook: () => this.openCreator('edit', back === 'home' ? 'home' : 'sheet', at),
        back: () => (back === 'home' ? this.enterArea('home', 'start', { at }) : this.showMainMenu()),
      }),
    );
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
    this.leaveWorld();
    this.studio = null;
    const t = this.training;
    this.mode = new TrainingMode({ touch: this.touchWanted(), character: this.character, practice: { primary: t.primary, secondary: t.secondary } });
    this.mode.archetype = t.archetype;
    this.mode.setMode(t.mode);
    this.renderer.attach(this.mode.sim);
    this.wire(this.mode.sim);
    this.hud.setStory(false);
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
    if (this.world) {
      const w = this.world;
      const atHome = w.level.id === 'home';
      this.ui.replaceAll(
        storyPauseMenu({
          resume: () => this.resume(),
          home: atHome || w.locked || w.player.isKO ? null : () => this.goHome(false),
          homeWhy: atHome ? '' : 'Can\u2019t head home in the middle of a fight',
          save: () => {
            this.hud.notify(this.saveGame() ? 'SAVED' : 'COULDN\u2019T SAVE', 'info');
            this.resume();
          },
          settings: () => this.ui.push(settingsScreen(this.settings, this.ui)),
          controls: () => this.ui.push(controlsScreen(this.ui)),
          quit: () => {
            this.saveGame();
            this.showMainMenu();
          },
        }),
      );
      return;
    }
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


  // ---- story mode ---------------------------------------------------------------

  private get activePlayer(): Fighter | null {
    return this.world?.player ?? this.mode?.player ?? null;
  }

  private saveGame(): boolean {
    if (!this.progress) return false;
    this.progress.save.savedAt = new Date().toISOString();
    return this.store.write(this.progress.save);
  }

  private continueStory(): void {
    if (!this.progress) return this.newGame();
    this.startStory(false);
  }

  private startStory(fresh: boolean): void {
    const p = this.progress!;
    this.audio.unlock();
    this.audio.startAmbience();
    if (fresh) {
      this.enterArea('home', 'start');
      this.hud.toast('Have a look round the house. The front door’s in the living room.', 'info');
      return;
    }
    this.enterArea(p.save.area, p.save.entry);
  }

  /** Build an area and drop the player in. Saves where you are so a closed tab resumes here. */
  private enterArea(area: AreaId, entry: string, opts: { carry?: { health: number; stamina: number; weapon: import('./combat/Weapons').WeaponId | null } | null; at?: { x: number; z: number } } = {}): void {
    const p = this.progress!;
    const level = LEVELS[area];
    this.unwire();
    this.leaveWorld();
    this.mode = null;
    this.studio = null;
    this.pending = null;
    const from = p.save.area;
    const carry = opts.carry ? { ...opts.carry } : null;
    if (area === 'home') {
      // Home: the garage always has your chosen weapon; the trip's meal is used up.
      if (carry) carry.weapon = p.save.equipped.weapon;
      if (from !== 'home' && p.save.mealBuff) p.save.mealBuff = false;
    }
    const world = new World(level, p, { entry, touch: this.touchWanted(), carry });
    if (opts.at) {
      world.player.pos.x = opts.at.x;
      world.player.pos.z = opts.at.z;
      world.arena.clamp(world.player.pos);
    }
    this.world = world;
    p.save.area = area;
    p.save.entry = level.entries.some((e) => e.id === entry) ? entry : level.entries[0].id;
    this.saveGame();

    this.renderer.attachWorld(world);
    this.wire(world.sim);
    this.wireWorld(world);
    this.hud.setStory(true);
    this.hud.el.style.display = 'block';
    this.ui.replaceAll(null);
    this.state = 'playing';
    this.accumulator = 0;
    this.input.flush();
    this.updateTouchVisibility();
    if (area !== from || !opts.at) this.hud.showBanner(level.district, level.name);
    if (area === 'home' && p.save.cash.pocket > 0) this.hud.toast(`£${p.save.cash.pocket} in your pocket: put it in the biscuit tin (bedroom desk)`, 'cash');
  }

  private leaveWorld(): void {
    for (const off of this.worldUnsub) off();
    this.worldUnsub = [];
    this.world = null;
    this.pending = null;
  }

  /** Fade out, swap area, fade in. */
  private changeArea(area: AreaId, entry: string, carry: { health: number; stamina: number; weapon: import('./combat/Weapons').WeaponId | null } | null): void {
    if (this.state === 'transition') return;
    this.state = 'transition';
    this.touch.release();
    this.fadeEl.classList.add('on');
    window.setTimeout(() => {
      if (!this.progress) return;
      this.enterArea(area, entry, { carry });
      window.setTimeout(() => this.fadeEl.classList.remove('on'), 60);
    }, 380);
  }

  private goHome(fullHealth: boolean): void {
    const w = this.world;
    const carry = w && !fullHealth ? w.carry() : null;
    this.changeArea('home', 'door', carry);
  }

  private updateStoryHud(dt: number): void {
    const w = this.world!;
    const s = this.progress!.save;
    const boss = w.activeBoss;
    const def = w.activeEncounter?.bossDef ?? null;
    let objective = w.objective;
    if (w.level.id === 'home' && s.cash.pocket > 0) objective = `Bank your £${s.cash.pocket} in the biscuit tin`;
    this.hud.updateStory(
      {
        pocket: s.cash.pocket,
        bank: s.cash.bank,
        level: s.level,
        xp: s.xp,
        xpNext: xpForNextLevel(s.level),
        objective,
        weapon: w.player.weapon ? `${w.player.weapon.data.name} (${w.player.weapon.hits})` : null,
        boss: boss && def ? { name: def.name, title: def.title, health: boss.vitals.health, max: boss.vitals.maxHealth } : null,
      },
      dt,
    );
  }

  private wireWorld(w: World): void {
    const ev = w.events;
    this.worldUnsub.push(
      ev.on('area:exit', ({ to, entry }) => this.changeArea(to, entry, w.carry())),
      ev.on('area:locked', ({ text }) => this.hud.toast(text, 'warn')),
      ev.on('encounter:start', ({ boss }) => {
        if (boss) {
          this.hud.notify(boss.name.toUpperCase(), 'big');
          this.hud.toast(`“${boss.intro}”`, 'warn');
          if (this.settings.get().screenShake) this.renderer.cameraRig.addShake(0.15);
        } else {
          this.hud.notify('FIGHT!', 'big');
        }
        this.audio.guardBreak();
      }),
      ev.on('encounter:wave', ({ wave, of }) => this.hud.notify(`MORE OF THEM — ${wave}/${of}`, 'warn')),
      ev.on('encounter:cleared', ({ cash, xp, optional }) => {
        this.hud.notify('SORTED', 'big');
        if (cash || xp) this.hud.toast(`+£${cash}  +${xp} XP${optional ? '' : ''}`, 'cash');
        this.saveGame();
      }),
      ev.on('boss:phase', ({ phase }) => {
        this.hud.notify(phase.name.toUpperCase(), 'warn');
        this.hud.toast(`“${phase.line}”`, 'warn');
        if (this.settings.get().screenShake) this.renderer.cameraRig.addShake(0.2);
        this.audio.guardBreak();
      }),
      ev.on('boss:defeated', ({ boss, first, cash, xp }) => {
        this.saveGame();
        this.hud.notify(`${boss.name.toUpperCase()} IS DONE`, 'big');
        const next = first ? this.unlockedBy(boss.flag) : null;
        this.pending = {
          at: this.time + 2.6,
          show: () => {
            this.state = 'paused';
            this.touch.release();
            this.updateTouchVisibility();
            const lines = [
              { text: `${boss.name} — ${boss.title} — beaten`, big: true },
              { text: `“${boss.defeat}”` },
              { text: `+£${cash} (in your pocket: bank it at home)` },
              { text: `+${xp} XP · level ${this.progress!.save.level}` },
            ];
            if (next) lines.push({ text: `Unlocked: ${next}`, big: true });
            if (boss.flag === 'boss_dunc') lines.push({ text: 'That’s the lot. The neighbourhood is yours.', big: true });
            this.ui.replaceAll(
              rewardScreen('VICTORY', lines, [
                { label: 'Head home', sub: 'Bank your cash, train up, save', go: () => this.goHome(false) },
                { label: 'Stay and explore', go: () => this.resume() },
              ]),
            );
          },
        };
      }),
      ev.on('pickup', ({ kind, label }) => {
        this.audio.uiConfirm();
        this.hud.toast(kind === 'cash' || kind === 'drop' ? `+${label}` : kind === 'food' ? `${label}: health up` : `Picked up: ${label}`, kind === 'cash' || kind === 'drop' ? 'cash' : 'item');
      }),
      ev.on('secret', ({ label }) => {
        this.audio.uiConfirm();
        this.hud.notify('SECRET FOUND', 'warn');
        this.hud.toast(label, 'item');
        this.saveGame();
      }),
      ev.on('unlock', ({ text }) => {
        this.hud.toast(text, 'item');
        this.saveGame();
      }),
      ev.on('gate:opened', ({ label }) => this.hud.toast(`${label} open`, 'item')),
      ev.on('level:up', ({ level }) => {
        this.hud.notify(`LEVEL ${level}`, 'big');
        this.hud.toast('+1 training point: spend it at the gym', 'item');
      }),
      ev.on('station', ({ id }) => this.openStation(id)),
      ev.on('player:defeated', () => {
        const p = this.progress!;
        const lost = p.losePocket(0.25);
        p.save.stats.deaths++;
        p.save.mealBuff = false;
        this.saveGame();
        this.pending = {
          at: this.time + 0.4,
          show: () => {
            this.state = 'paused';
            this.touch.release();
            this.updateTouchVisibility();
            this.ui.replaceAll(
              rewardScreen('BATTERED', [{ text: 'You got done in.', big: true }, { text: lost > 0 ? `Someone went through your pockets: −£${lost}` : 'Nothing on you worth taking, at least.' }, { text: 'Anything you’ve already beaten stays beaten.' }], [{ label: 'Wake up at home', go: () => this.goHome(true) }]),
            );
          },
        };
      }),
    );
  }

  private unlockedBy(flag: string): string | null {
    for (const l of Object.values(LEVELS)) for (const ex of l.exits) if (ex.requires === flag) return `the way from ${l.district} to ${LEVELS[ex.to].district}`;
    return null;
  }

  /** Hub rooms: freeze the world and open the room's panel. */
  private openStation(id: StationId): void {
    const w = this.world;
    const p = this.progress;
    if (!w || !p) return;
    const station = w.level.stations?.find((s) => s.id === id);
    const at = station ? { x: w.player.pos.x, z: w.player.pos.z } : undefined;
    if (id === 'wardrobe') return this.openCreator('edit', 'home', at);
    if (id === 'mirror') return this.openSheet('home', at);
    this.state = 'paused';
    this.touch.release();
    this.input.flush();
    this.updateTouchVisibility();
    this.hubDirty = false;
    const changed = () => {
      this.hubDirty = true;
      this.saveGame();
    };
    const close = () => {
      this.ui.replaceAll(null);
      if (this.hubDirty) {
        // Rebuild the player with the new styles, upgrades and kit, right where they stood.
        const carry = w.carry();
        carry.weapon = p.save.equipped.weapon;
        this.enterArea('home', 'start', { at: { x: w.player.pos.x, z: w.player.pos.z }, carry });
        this.hud.toast('Kit updated', 'item');
      } else this.resume();
    };
    let screen;
    switch (id) {
      case 'gym':
        screen = gymScreen(p, close, changed);
        break;
      case 'kitchen':
        screen = kitchenScreen(p, close, () => {
          const v = w.player.vitals;
          const before = v.health;
          v.health = v.maxHealth;
          v.stamina = v.maxStamina;
          return Math.round(v.health - before);
        }, changed);
        break;
      case 'garage':
        screen = garageScreen(p, close, changed);
        break;
      case 'sofa':
        screen = sofaScreen(p, close, () => this.saveGame());
        break;
      case 'contacts':
        screen = contactsScreen(p, close, (area, entry) => {
          this.ui.replaceAll(null);
          this.state = 'playing';
          this.changeArea(area, entry, null);
        }, changed);
        break;
      case 'tin':
        screen = tinScreen(p, close, changed);
        break;
      default:
        this.resume();
        return;
    }
    this.ui.replaceAll(screen);
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
    if (this.state !== 'playing' || e.repeat || this.world) return;
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
    document.body.classList.toggle('in-fight', this.state === 'playing' || this.state === 'paused' || this.state === 'transition');
    this.touch.visible = this.state === 'playing' && this.touchWanted();
    this.uiRoot.classList.toggle('touch-ui', this.touchWanted());
  }

  // ---- events from the fight -----------------------------------------------------

  private wire(sim: Sim): void {
    const bus = sim.bus;
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
    const p = this.activePlayer!;
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
    let interact = false;
    const it = this.world?.interactable;
    if (!text && it && p.isFree) {
      const locked = it.kind === 'exit' && it.locked;
      const done = it.kind === 'lever' && it.done;
      if (!done) {
        text = `${k('E', 'LB', 'GRAB')}  ${it.label}${locked ? ' \u2014 locked' : ''}`;
        interact = true;
      }
    }
    this.hud.setPrompt(text, sub, interact);
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

    if (this.state === 'playing' && (this.mode || this.world)) {
      this.accumulator += dt;
      let steps = 0;
      while (this.accumulator >= DT && steps < MAX_STEPS_PER_FRAME && this.state === 'playing') {
        const cmd = this.input.sample(pad);
        if (this.world) this.world.step(cmd);
        else this.mode!.step(cmd);
        this.accumulator -= DT;
        steps++;
      }
      if (steps === MAX_STEPS_PER_FRAME) this.accumulator = 0;
      if (this.pending && this.time >= this.pending.at && this.state === 'playing') {
        const show = this.pending.show;
        this.pending = null;
        show();
      }
    } else if (this.state === 'studio') {
      this.input.flush();
      this.stepStudio(dt);
    } else {
      this.input.flush();
    }

    const player = this.activePlayer;
    const inFight = (this.state === 'playing' || this.state === 'paused' || this.state === 'transition') && !!player;
    this.renderer.render(dt, this.time, inFight ? player : null);
    if (inFight && player) {
      const enemy = this.world ? this.world.focusEnemy : this.mode!.focusEnemy;
      // In story mode the boss has its own bar along the bottom.
      this.hud.update(dt, player, this.world?.activeBoss && enemy === this.world.activeBoss ? null : enemy);
      if (this.world && this.progress) this.updateStoryHud(dt);
      this.updatePrompt();
    }

    requestAnimationFrame((n) => this.frame(n));
  }
}

/** New fighters start without the clothes you find in the story. */
function stripLocked(a: CharacterAppearance): CharacterAppearance {
  const out = { ...a, accessories: a.accessories.filter((x) => !LOCKED_COSMETICS.includes(`acc:${x}`)) };
  if (LOCKED_COSMETICS.includes(`top:${a.top}`)) out.top = 'hoodie';
  return out;
}

function characterCreatorDefault(): CharacterAppearance {
  // A fresh random look each time you start a new fighter.
  return randomAppearance();
}
