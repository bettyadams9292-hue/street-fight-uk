import { setHumansEnabled } from './render/human/HumanRig';
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
import { HouseController } from './home/house';
import { attention } from './home/needs';
import type { Screen } from './ui/UIManager';
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
import { xpForNextLevel } from './progress/catalogue';
import { STARTER_ACCESSORIES, STARTER_BOTTOMS, STARTER_SHOES, STARTER_TOPS } from './character/Appearance';
import { ITEMS, RARITY_COLOURS } from './items/items';
import { clothesShopScreen, inventoryScreen, pawnScreen, storageScreen } from './ui/inventoryUI';
import { arrest, ARREST_HEAT, ROBBABLE, robShop } from './world/robbery';
import { World } from './world/World';
import { LEVELS } from './world/levels';
import type { Simulation as Sim } from './core/Simulation';
import { mapScreen } from './ui/mapUI';
import { profileScreen } from './ui/profileUI';
import { nextExit } from './map/worldMap';
import { barScreen, contactsScreen, rewardScreen, sofaScreen, storyPauseMenu, tinScreen } from './ui/hub';
import type { StationDef, StationId } from './world/LevelTypes';
import { h } from './ui/dom';
import { resolveLevel } from './property/levels';
import { BIKES, FURNITURE, ROOMS, bikeSpeedMult, type RoomId } from './property/catalogue';
import { STAIRWELL, checkPlacement, suggestSpot, wallZ } from './property/home';
import { mountBike, parkBike, placeFurniture, ridingBike, sellFurniture, storeBike, storeFurniture, type PlacedAt } from './property/state';
import { buildBikeModel } from './render/propModels';
import { EQUIPMENT, equipmentResale } from './business/catalogue';
import { checkEquipmentPlacement, equipmentWallZ, installEquipment, sellEquipment, suggestEquipmentSpot, uninstallEquipment } from './business/basement';
import { tickBusiness } from './business/production';
import { growShopScreen, terminalScreen } from './ui/businessUI';
import { coachBoardScreen, DrillGame, gymStoreScreen, RepGame, styleCoachScreen } from './ui/gymUI';
import { workshopScreen } from './ui/workshopUI';
import { recruitScreen } from './ui/companionUI';
import { computerScreen } from './ui/propertyUI';
import { COMPANIONS, COMPANION_WAITS_OUTSIDE, companionAvailable, companionRecover, crewState, followMe, relaxAtHome, winChallenge } from './companions/companions';
import { healOverTime, injuryName, treatInjury } from './condition/condition';
import { applyCrewModifiers } from './companions/crewFighter';
import { GYM_KIT, SPAR_FATIGUE, SPAR_TRAINS, canTrain, finishSession, recover, type RepGrade } from './training/gym';
import { FIGHT_GYMS, canDrill, drillSet, finishDrill, nextRankNeeds, styleRank, type FightGym } from './training/styleGyms';
import { themeProfile } from './render/themes';
import {
  bikeShopScreen,
  blackjackScreen,
  carDealerScreen,
  carScreen,
  cashierScreen,
  furnitureShopScreen,
  garageBikeScreen,
  plannerScreen,
  rouletteScreen,
  slotsScreen,
} from './ui/propertyUI';
import * as THREE from 'three';

type GameState = 'menu' | 'studio' | 'playing' | 'paused' | 'transition' | 'editing' | 'training';
const MAX_STEPS_PER_FRAME = 5;

/**
 * Top-level game: owns settings, input, audio, rendering and UI, and runs
 * the fixed 60 Hz simulation inside a variable-rate render loop.
 */
export class Game {
  private settings = new SettingsStore();
  private input = new InputManager();
  readonly audio: AudioManager;
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
  /** The house's activities: cooking, eating, washing, sleeping. */
  private house!: HouseController;
  private state: GameState = 'menu';
  private unsubscribe: (() => void)[] = [];
  private accumulator = 0;
  /** Slow motion: how fast game time runs (1 = normal), and how many real seconds of slowness are left. */
  private timeScale = 1;
  private slowLeft = 0;
  private slowScale = 1;
  private lastCleanNotice = -99;
  private last = 0;
  private time = 0;

  constructor(gameRoot: HTMLElement, private readonly uiRoot: HTMLElement) {
    const s = this.settings.get();
    this.audio = new AudioManager(s);
    this.renderer = new GameRenderer(gameRoot, s.quality, s.lighting);
    setHumansEnabled(s.quality !== 'low');
    this.renderer.onFootstep = () => this.audio.step();
    this.ui = new UIManager(uiRoot);
    this.house = new HouseController({
      world: () => this.world,
      progress: () => this.progress,
      fx: (key, spec) => this.renderer.house.set(key, spec),
      sound: (kind) => this.audio.house(kind),
      loop: (id, on) => this.audio.loop(id, on),
      toast: (text, kind) => this.hud.toast(text, kind ?? 'info'),
      say: (text) => this.world && this.hud.speech(this.world.player, '', text),
      panel: (make, closed) => this.housePanel(make, closed),
      refresh: () => {
        if (this.world && this.progress) this.progress.applyModifiers(this.world.player, this.world.difficulty);
      },
      save: () => this.saveGame(),
      restAtHome: () => this.restAtHome(),
    });
    this.ui.onNavigate = () => this.audio.uiMove();
    this.ui.onConfirm = () => this.audio.uiConfirm();

    this.hud = new Hud({
      setMode: (m) => this.setTrainingMode(m),
      nextOpponent: () => this.nextOpponent(),
      reset: () => this.resetPositions(),
      pause: () => this.pause(),
      map: () => {
        if (this.state === 'playing') this.openMap();
      },
      inventory: () => {
        if (this.state === 'playing' && this.world) this.openInventory();
      },
      character: () => {
        if (this.state === 'playing' && this.world) this.openProfile();
      },
    });
    this.hud.el.style.display = 'none';
    uiRoot.append(this.hud.el);

    this.touch = new TouchControls(this.input);
    uiRoot.append(this.touch.el);
    this.fadeEl = h('div', { class: 'fade' });
    uiRoot.append(this.fadeEl);

    this.input.onMenu((a, src, fightKey) => this.onMenuAction(a, src, fightKey));
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
    const isLocked = starterLocked;
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
          inventory: () => this.openInventory(),
          map: () => {
            this.state = 'playing';
            this.openMap();
          },
          character: () => {
            this.state = 'playing';
            this.openProfile();
          },
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
    this.world?.syncCompanion();
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
  private enterArea(area: AreaId, entry: string, opts: { carry?: { health: number; stamina: number } | null; at?: { x: number; z: number } } = {}): void {
    const p = this.progress!;
    this.house.abort();
    this.audio.stopLoops();
    const leaving = this.world ? { area: this.world.level.id, x: this.world.player.pos.x, z: this.world.player.pos.z } : null;
    // In or out of a building: the door goes.
    const indoors = (id: AreaId) => !!LEVELS[id] && !LEVELS[id].exits.some((x) => x.kind === 'edge');
    if (leaving && leaving.area !== area && (indoors(area) || indoors(leaving.area as AreaId))) this.audio.door();
    // Your companion's health and weapon go with them; anything you took in a fight left half-done still counts.
    this.world?.settleInjuries();
    this.world?.syncCompanion();
    this.bikeArrivals(area, leaving);
    const level = resolveLevel(area, p.save);
    this.unwire();
    this.leaveWorld();
    this.mode = null;
    this.studio = null;
    this.pending = null;
    const from = p.save.area;
    const carry = opts.carry ? { ...opts.carry } : null;
    // A till left open in a robbery doesn't stay open once you've gone.
    for (const k of Object.keys(p.save.flags)) if (k.endsWith('_robbable')) delete p.save.flags[k];
    // Moving between areas is the game's clock: heat dies down, shops reopen.
    if (area !== from) p.tick();
    // Home: the trip's meal is used up.
    if (area === 'home' && from !== 'home' && p.save.mealBuff) p.save.mealBuff = false;
    // Rebuilding the area you're in (after a menu) keeps this visit's finished side-fights finished.
    const keepCleared = leaving && leaving.area === area && this.world ? this.world.clearedOptional() : [];
    // Your crew: whoever's following you and fit comes along. Too hurt: they stay home resting until they're fit.
    const following = p.save.companions.following.map((id) => COMPANIONS[id]).filter(Boolean);
    const fit = following.filter((d) => companionAvailable(crewState(p, d.id)).ok);
    if (area !== from && area !== 'home' && !COMPANION_WAITS_OUTSIDE.has(area)) {
      for (const d of following) {
        const ok = companionAvailable(crewState(p, d.id));
        if (!ok.ok) this.hud.toast(`${d.nickname} is resting at home: ${ok.reason.toLowerCase()}`, 'warn');
      }
    }
    let companions: typeof fit = [];
    let home: { residents: typeof fit; arriving: typeof fit } | undefined;
    if (area === 'home') {
      // Everyone lives here. Those who came out with you walk in through the front door behind you;
      // the rest are already in, relaxing. (Rebuilding the house in place: everyone's already settled.)
      const arrivingNow = from !== 'home' && entry === 'door';
      const arriving = arrivingNow ? fit : [];
      const residents = p.save.companions.recruited.map((id) => COMPANIONS[id]).filter((d) => d && !arriving.includes(d));
      home = { residents, arriving };
    } else if (!COMPANION_WAITS_OUTSIDE.has(area)) companions = fit;
    const world = new World(level, p, { entry, touch: this.touchWanted(), carry, difficulty: this.settings.get().difficulty, at: opts.at, keepCleared, companions, home });
    this.world = world;
    p.save.area = area;
    p.save.entry = level.entries.some((e) => e.id === entry) ? entry : level.entries[0].id;
    this.saveGame();

    this.renderer.attachWorld(world);
    this.wire(world.sim);
    this.wireWorld(world);
    this.applyRiding();
    this.hud.setStory(true);
    this.hud.el.style.display = 'block';
    this.ui.replaceAll(null);
    this.state = 'playing';
    this.accumulator = 0;
    this.input.flush();
    this.updateTouchVisibility();
    if (area !== from || !opts.at) this.hud.showBanner(level.district, level.name);
    // First time here: one line pointing out what's on the street (the map has the rest).
    const firstVisit = !p.save.visited.includes(area);
    if (firstVisit) {
      p.save.visited.push(area);
      const doors = level.exits.filter((e) => e.kind === 'door' && e.to !== 'home' && LEVELS[e.to] && !LEVELS[e.to].exits.some((x) => x.kind === 'edge'));
      if (doors.length) this.hud.toast(`On this street: ${doors.map((e) => LEVELS[e.to].name).join(', ')}. M for the map.`, 'item');
    }
    // Arrived where the map's route was going.
    if (p.save.destination && (p.save.destination === area || (p.save.destination === 'basement' && area === 'home'))) {
      this.hud.toast(`You’ve arrived: ${LEVELS[area].name}`, 'cash');
      p.save.destination = null;
    }
    if (area === 'home' && p.save.cash.pocket > 0) this.hud.toast(`£${p.save.cash.pocket} in your pocket: put it in the biscuit tin (bedroom desk)`, 'cash');
  }

  private leaveWorld(): void {
    this.house.abort();
    this.audio.stopLoops();
    this.hud.setActivity(null);
    this.hud.clearBubbles();
    for (const off of this.worldUnsub) off();
    this.worldUnsub = [];
    this.world = null;
    this.pending = null;
  }

  /**
   * Walk over the line into the next district of the long street. The new district's world starts
   * with you exactly where you were, a step over the line, still moving, so there is no stop.
   */
  private crossSeam(w: World, to: AreaId, entry: string): void {
    const there = LEVELS[to].bounds;
    const pl = w.player;
    const x = entry === 'left' ? there.minX + 0.08 : there.maxX - 0.08;
    const z = Math.max(there.minZ, Math.min(there.maxZ, pl.pos.z));
    const facing = pl.facing;
    this.enterArea(to, entry, { carry: w.carry(), at: { x, z } });
    if (this.world) this.world.player.facing = facing;
  }

  /** Fade out, swap area, fade in. */
  private changeArea(area: AreaId, entry: string, carry: { health: number; stamina: number } | null): void {
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
        slots: { used: s.inventory.length, cap: this.progress!.inventoryCap },
        condition: w.player.weapon ? w.player.weapon.hits / w.player.weapon.data.durability : null,
        heat: s.heat,
        police: w.policeActive,
        route: this.routeHint(),
        fighting: !this.calm(),
      },
      dt,
    );
    this.hud.setActivity(this.house.status);
    this.hud.setNeeds(attention(s.needs).map((a) => ({ key: a.key, text: a.label.label, urgency: a.label.urgency })));
  }

  /** A house panel (fridge, recipe book, bed...): the world waits while it's open. */
  private housePanel(make: (close: () => void) => Screen, closed?: () => void): void {
    this.state = 'paused';
    this.touch.release();
    this.input.flush();
    this.updateTouchVisibility();
    const close = () => {
      this.ui.replaceAll(null);
      this.resume();
      closed?.();
    };
    this.ui.replaceAll(make(close));
  }

  /** The map's route, as a line for the HUD: which way, through which exit, how far. */
  private routeHint(): string | null {
    const w = this.world!;
    const p = this.progress!;
    const dest = p.save.destination;
    if (!dest) return null;
    const name = LEVELS[dest].name;
    const ex = nextExit(p, w.level.id, dest);
    if (!ex) return `${name}: no way through from here yet`;
    const dx = ex.x - w.player.pos.x;
    const m = Math.round(Math.abs(dx));
    if (ex.kind === 'door') return m < 2 ? `${name}: through this door (E) to ${LEVELS[ex.to].name}` : `${name}: door ${dx > 0 ? '→' : '←'} ${m} m (${LEVELS[ex.to].name})`;
    return `${name}: ${dx > 0 ? '→ east' : '← west'} ${m} m to ${LEVELS[ex.to].name}`;
  }

  private wireWorld(w: World): void {
    const ev = w.events;
    this.worldUnsub.push(
      ev.on('area:exit', ({ to, entry, seam }) => {
        // The basement is down a real flight of stairs: walk down (or up) them, then arrive.
        if ((w.level.id === 'home' && to === 'basement') || (w.level.id === 'basement' && to === 'home')) return this.walkStairs(w, to, entry);
        // The next district of the long street: no door, no fade, you just keep walking.
        if (seam) return this.crossSeam(w, to, entry);
        this.changeArea(to, entry, w.carry());
      }),
      ev.on('area:locked', ({ text }) => this.hud.toast(text, 'warn')),
      ev.on('duel:end', (e) => this.duelEnded(w, e)),
      ev.on('companion:up', ({ name }) => this.hud.toast(`${name}’s back on their feet`, 'item')),
      ev.on('injury', ({ who, name, injuries }) => {
        const list = injuries.map((i) => injuryName(i).toLowerCase()).join(', ');
        this.hud.toast(who === 'you' ? `You’re hurt: ${list}. Rest at home or use first aid (H to check).` : `${name} is hurt: ${list}.`, 'warn');
      }),
      ev.on('companion:level', ({ name, level }) => this.hud.toast(`${name} is level ${level} now`, 'item')),
      ev.on('crew:say', ({ fighter, name, text }) => this.hud.speech(fighter, name, text)),
      ev.on('enemy:say', ({ fighter, text }) => this.hud.speech(fighter, '', text)),
      // A real hit while riding knocks you off; the bike's left where you fell.
      w.sim.bus.on('hit:landed', ({ target }) => {
        if (target === w.player && this.progress?.save.property.riding && this.world === w) this.knockOff = true;
      }),
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
      ev.on('encounter:cleared', ({ cash, xp, optional, secondWind }) => {
        this.hud.notify('SORTED', 'big');
        if (secondWind) this.hud.toast('Second wind: back on your feet', 'info');
        if (cash || xp) this.hud.toast(`+£${cash}  +${xp} XP${optional ? '' : ''}`, 'cash');
        this.saveGame();
      }),
      ev.on('boss:phase', ({ phase }) => {
        this.hud.notify(phase.name.toUpperCase(), 'warn');
        this.hud.toast(`“${phase.line}”`, 'warn');
        if (this.settings.get().screenShake) this.renderer.cameraRig.addShake(0.2);
        this.audio.guardBreak();
      }),
      ev.on('boss:defeated', ({ boss, first, cash, xp, items }) => {
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
            if (items.length) lines.push({ text: `Took: ${items.join(', ')}` });
            if (next) lines.push({ text: `Unlocked: ${next}`, big: true });
            if (boss.flag === 'boss_dunc') lines.push({ text: 'Dunc\u2019s phone has one contact: THE BOSS. Hale House, past the Pit.', big: true });
            if (boss.flag === 'boss_final') lines.push({ text: 'That\u2019s the lot. The whole town is yours.', big: true });
            this.ui.replaceAll(
              rewardScreen('VICTORY', lines, [
                { label: 'Head home', sub: 'Bank your cash, train up, save', go: () => this.goHome(false) },
                { label: 'Stay and explore', go: () => this.resume() },
              ]),
            );
          },
        };
      }),
      ev.on('cash', ({ amount }) => {
        this.audio.coins();
        this.hud.toast(`+\u00a3${amount}`, 'cash');
      }),
      ev.on('item:picked', ({ name, qty, rarity, stolen }) => {
        this.audio.uiConfirm();
        this.hud.toast(`${name}${qty > 1 ? ` \u00d7${qty}` : ''}${stolen ? ' (stolen)' : ''}`, 'item', RARITY_COLOURS[rarity as keyof typeof RARITY_COLOURS]);
        this.saveGame();
      }),
      ev.on('item:held', ({ name }) => {
        this.audio.uiConfirm();
        this.hud.toast(`Holding: ${name}. Light/heavy to swing, Grab to throw or drop.`, 'item');
        this.saveGame();
      }),
      ev.on('item:full', ({ name }) => this.hud.toast(`Pockets full: no room for the ${name.toLowerCase()}. Open the inventory (I / RB / BAG) to make space.`, 'warn')),
      ev.on('searched', ({ label, found }) => {
        if (found.length) this.audio.uiConfirm();
        this.hud.toast(found.length ? `${label}: ${found.join(', ')}` : `${label}: nothing`, found.length ? 'item' : 'info');
        if (found.length) this.saveGame();
      }),
      ev.on('broken', ({ label }) => {
        this.audio.impact(0.8, false);
        this.hud.toast(label, 'info');
      }),
      ev.on('alarm', () => {
        this.hud.notify('ALARM!', 'warn');
        this.hud.toast('The alarm\u2019s going. Police on their way: get out or get ready.', 'warn');
      }),
      ev.on('police:arrive', ({ count }) => {
        this.hud.notify('POLICE!', 'big');
        this.hud.toast(`${count} officers. If they put you down, you\u2019re nicked: stolen gear seized and a fine.`, 'warn');
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
      ev.on('station', ({ id, station }) => this.openStation(id, station)),
      ev.on('player:defeated', ({ byPolice }) => {
        const p = this.progress!;
        if (byPolice || p.save.heat >= ARREST_HEAT) {
          const { fine, seized } = this.arrested();
          p.save.mealBuff = false;
          this.pending = {
            at: this.time + 0.4,
            show: () => {
              this.state = 'paused';
              this.touch.release();
              this.updateTouchVisibility();
              this.ui.replaceAll(
                rewardScreen('NICKED', [
                  { text: 'You\u2019re under arrest.', big: true },
                  { text: seized ? `They took ${seized} stolen item${seized === 1 ? '' : 's'} off you.` : 'Nothing stolen on you, at least.' },
                  { text: `Fined \u00a3${fine}. A night in the cells and they let you go.` },
                  { text: 'Your heat is back to nothing. Everything you\u2019ve beaten stays beaten.' },
                ], [{ label: 'Walk home', go: () => this.goHome(true) }]),
              );
            },
          };
          return;
        }
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
  private openStation(id: StationId, from?: StationDef): void {
    const w = this.world;
    const p = this.progress;
    if (!w || !p) return;
    const station = from ?? w.stations.find((s) => s.id === id);
    const at = station ? { x: w.player.pos.x, z: w.player.pos.z } : undefined;
    if (id === 'wardrobe') return this.openCreator('edit', 'home', at);
    if (id === 'mirror') return this.openSheet('home', at);
    if (id === 'clothes_counter' || id === 'changing') return this.openClothesShop();
    if (id === 'bike') return this.mountParkedBike();
    // The house: the fridge, the cooker, the bathroom, the bed... (they freeze nothing until a list opens).
    if (this.house.handles(id) && w.level.id === 'home') return this.house.open(id, station);
    this.state = 'paused';
    this.touch.release();
    this.input.flush();
    this.updateTouchVisibility();
    this.hubDirty = false;
    /** Changes that alter the player (look, stats, styles): rebuild on close. */
    const changed = () => {
      this.hubDirty = true;
      this.saveGame();
    };
    /** Changes to money and items only: just save. */
    const saved = () => {
      this.saveGame();
      // Keep the weapon in your hands in step with the save (repairs).
      const held = p.save.held;
      if (held && w.player.weapon && held.hits !== undefined) w.player.weapon.hits = held.hits;
    };
    const close = () => {
      this.ui.replaceAll(null);
      if (this.hubDirty) {
        // Rebuild the player with the new styles, upgrades and kit, right where they stood.
        this.enterArea(w.level.id, 'start', { at: { x: w.player.pos.x, z: w.player.pos.z }, carry: w.carry() });
        this.hud.toast('Kit updated', 'item');
      } else this.resume();
    };
    let screen;
    switch (id) {
      case 'gym':
        screen = coachBoardScreen(p, close, changed);
        break;
      case 'computer':
        screen = computerScreen(p, close, saved, (uid, room) => this.startPlacing(uid, room));
        break;
      case 'gym_counter':
        screen = gymStoreScreen(p, close, saved, station?.tab);
        break;
      case 'style_coach':
        screen = styleCoachScreen(p, close, changed, (station?.tab ?? 'boxing_gym') as FightGym['id']);
        break;
      case 'recruit':
        screen = recruitScreen(p, station?.tab ?? '', close, () => {
          saved();
          this.hubDirty = true;
        }, () => {
          this.ui.replaceAll(null);
          this.state = 'playing';
          const def = COMPANIONS[station?.tab ?? ''];
          if (station && def && w.startChallenge(station, def)) this.hud.toast(`${def.nickname} squares up. Beat them and they’ll join you.`, 'warn');
        });
        break;
      case 'train':
        this.state = 'playing';
        return this.startGymSession(station?.tab ?? '');
      case 'style_drill':
        this.state = 'playing';
        return this.startDrill((station?.tab ?? 'boxing_gym') as FightGym['id']);
      case 'sparring':
        this.state = 'playing';
        if (w.duel) {
          w.stopDuel();
          return;
        }
        {
          const can = canTrain(p, SPAR_TRAINS);
          if (!can.ok) return this.hud.toast(can.reason, 'warn');
        }
        if (w.startSpar()) this.hud.toast('Gloves up. Mo hits softly and it stops before anyone’s hurt. Walk away to stop.', 'item');
        return;
      case 'garage':
        screen = workshopScreen(p, close, () => {
          saved();
          // What's in your hands may have changed (repaired, upgraded): rebuild the fighter's weapon.
          const held = p.save.held;
          if (held) w.player.equipWeapon(ITEMS[held.id].weapon!, held.hits, held.mods);
        });
        break;
      case 'storage':
        screen = storageScreen(p, this.ui, changed, close);
        break;
      case 'sofa':
        // Sitting down to catch up is rest: fatigue drops, injuries ease, the crew recover.
        recover(p.save.gym, p.save.playTime, 25);
        this.hud.toast(this.restAtHome(), 'item');
        screen = sofaScreen(p, close, () => this.saveGame());
        break;
      case 'contacts':
        screen = contactsScreen(p, close, () => {
          this.ui.replaceAll(null);
          this.state = 'playing';
          this.openMap();
        }, () => {
          this.state = 'playing';
          this.openProfile('crew');
        });
        break;
      case 'tin':
        screen = tinScreen(p, close, saved);
        break;
      case 'pawn_counter':
        screen = pawnScreen(p, this.ui, saved, close, { rob: () => this.robShop('pawn', at ?? { x: 7.2, z: 0.6 }), priceMult: p.shop('pawn').priceMult });
        break;
      case 'bar':
        screen = barScreen(p, close, saved, () => this.robShop('pub', at ?? { x: 6.5, z: 0.6 }));
        break;
      case 'planner':
        screen = plannerScreen(p, close, saved, (uid, room) => this.startPlacing(uid, room));
        break;
      case 'furniture_counter':
        screen = furnitureShopScreen(p, close, saved);
        break;
      case 'car_counter':
        screen = carDealerScreen(p, close, saved);
        break;
      case 'bike_counter':
        screen = bikeShopScreen(p, close, saved);
        break;
      case 'bike_rack':
        screen = garageBikeScreen(p, () => {
          // The garage bays change when bikes come and go: rebuild the house.
          this.ui.replaceAll(null);
          this.enterArea(w.level.id, 'start', { at: { x: w.player.pos.x, z: w.player.pos.z }, carry: w.carry() });
        }, saved, () => {
          this.ui.replaceAll(null);
          this.enterArea(w.level.id, 'start', { at: { x: w.player.pos.x, z: w.player.pos.z }, carry: w.carry() });
          this.hud.toast('Bike’s out by the front door', 'item');
        });
        break;
      case 'car':
        screen = carScreen(p, close, saved, (area, entry) => {
          this.ui.replaceAll(null);
          this.state = 'playing';
          this.changeArea(area, entry, null);
        }, () => {
          this.ui.replaceAll(null);
          this.enterArea(w.level.id, 'start', { at: { x: w.player.pos.x, z: w.player.pos.z }, carry: w.carry() });
          this.hud.toast('Car swapped', 'item');
        });
        break;
      case 'terminal':
        screen = terminalScreen(p, close, saved, (uid) => this.startInstalling(uid), () => {
          this.ui.replaceAll(null);
          this.enterArea('basement', 'stairs', { at: { x: w.player.pos.x, z: w.player.pos.z }, carry: w.carry() });
        });
        break;
      case 'grow_counter':
      case 'grow_display':
        screen = growShopScreen(p, close, saved, station?.tab ?? 'room');
        break;
      case 'casino_slots':
        screen = slotsScreen(p, close, saved);
        break;
      case 'casino_roulette':
        screen = rouletteScreen(p, close, saved);
        break;
      case 'casino_blackjack':
        screen = blackjackScreen(p, close, saved);
        break;
      case 'casino_cashier':
        screen = cashierScreen(p, close, saved, () => this.hud.toast('Prize won: it’s waiting at home', 'cash'));
        break;
      default:
        this.resume();
        return;
    }
    this.ui.replaceAll(screen);
  }

  // ---- home gym training and fighting-gym drills -----------------------------------------

  private session: { game: RepGame | DrillGame; restore: { x: number; z: number; facing: 1 | -1 } } | null = null;

  /** Use a piece of home gym kit: the rep timing game while your fighter does the work. */
  private startGymSession(kitId: string): void {
    const w = this.world;
    const p = this.progress;
    if (!w || !p || this.session) return;
    const kit = GYM_KIT[kitId];
    if (!kit) return;
    if (!p.save.gym.owned.includes(kitId)) return this.hud.toast(`No ${kit.name.toLowerCase()} yet. Iron Temple in Leisure Park sells them.`, 'warn');
    const can = canTrain(p, kit.trains);
    if (!can.ok) return this.hud.toast(can.reason, 'warn');
    const f = w.player;
    const restore = { x: f.pos.x, z: f.pos.z, facing: f.facing };
    f.pos.x = kit.slot.x + kit.use.dx;
    f.pos.z = kit.slot.z + kit.use.dz;
    f.pos.y = kit.use.y ?? 0;
    f.facing = kit.use.facing;
    f.activity = kit.activity;
    const rank = p.save.upgrades[kit.trains];
    const game = new RepGame(kit, kit.name, kit.attribute, rank, 10, () => this.endTraining(), () => this.endTraining());
    this.session = { game, restore };
    this.state = 'training';
    this.uiRoot.append(game.el);
  }

  private endTraining(): void {
    const s = this.session;
    const w = this.world;
    const p = this.progress;
    if (!s || !w || !p) return;
    this.session = null;
    s.game.el.remove();
    const f = w.player;
    f.activity = null;
    f.pos = { x: s.restore.x, y: 0, z: s.restore.z };
    f.facing = s.restore.facing;
    this.state = 'playing';
    this.input.flush();
    if (s.game instanceof RepGame) {
      const kit = s.game.kit!;
      const r = finishSession(p, kit.trains, kit.perRep, kit.fatigue, s.game.grades);
      if (!r.ok) return;
      const perfect = s.game.grades.filter((g) => g === 'perfect').length;
      this.hud.toast(`${kit.attribute}: +${r.xp} XP (${perfect} perfect)${r.rankedUp ? ` — RANK ${r.rank}!` : ` · ${r.toNext}/${r.needed} to rank ${r.rank + 1}`} · fatigue ${r.fatigue}%`, r.rankedUp ? 'cash' : 'item');
      // Rank ups change your stats: rebuild the fighter in place.
      if (r.rankedUp) this.enterArea(w.level.id, 'start', { at: { x: f.pos.x, z: f.pos.z }, carry: w.carry() });
      else this.saveGame();
    } else {
      const g = s.game;
      const gymId = this.drillGym!;
      const gym = FIGHT_GYMS.find((x) => x.id === gymId)!;
      const style = this.drillStyle!;
      if (!g.results.length) return;
      const r = finishDrill(p, style, g.results);
      const clean = g.results.filter((x) => x.clean).length;
      const need = nextRankNeeds(p, style);
      this.hud.toast(`${STYLES[style].name} drill: ${clean}/${g.results.length} clean, +${r.xp} drill XP${need?.xp ? ` (${Math.min(r.total, need.xp)}/${need.xp} for rank ${need.rank})` : ''}. See ${gym.coach} to rank up.`, 'item');
      this.saveGame();
    }
  }

  private drillGym: FightGym['id'] | null = null;
  private drillStyle: StyleId | null = null;

  /** Pad work at a fighting gym: throw the style's real combinations on cue. */
  private startDrill(gymId: FightGym['id']): void {
    const w = this.world;
    const p = this.progress;
    if (!w || !p || this.session) return;
    const gym = FIGHT_GYMS.find((g) => g.id === gymId)!;
    // Drill your main style if it's taught here, otherwise the first one you know from this gym.
    const style = gym.styles.includes(p.save.styles.primary) && styleRank(p, p.save.styles.primary) > 0 ? p.save.styles.primary : gym.styles.find((st) => styleRank(p, st) > 0);
    if (!style) return this.hud.toast(`Learn ${gym.styles.map((st) => STYLES[st].name).join(' or ')} from ${gym.coach} first`, 'warn');
    const can = canDrill(p, style);
    if (!can.ok) return this.hud.toast(can.reason, 'warn');
    const combos = drillSet(style, styleRank(p, style), p.save.gym.sessions + (p.save.styleTraining[style]?.xp ?? 0));
    if (!combos.length) return;
    p.save.gym.sessions++;
    const f = w.player;
    const restore = { x: f.pos.x, z: f.pos.z, facing: f.facing };
    f.facing = 1;
    f.activity = 'bag';
    this.drillGym = gymId;
    this.drillStyle = style;
    const game = new DrillGame(combos, `${STYLES[style].name} pad drill`, () => this.endTraining());
    this.session = { game, restore };
    this.state = 'training';
    this.uiRoot.append(game.el);
  }

  private trainingKey(e: KeyboardEvent): void {
    const g = this.session?.game;
    if (!g) return;
    const k = e.code;
    if (k === 'Escape') g instanceof RepGame ? g.finish(true) : g.end();
    else if (g instanceof RepGame && (k === 'Space' || k === 'KeyE' || k === 'KeyU' || k === 'Enter')) g.press();
    else if (g instanceof DrillGame) {
      const map: Record<string, string> = { KeyJ: 'lp', KeyI: 'hp', KeyK: 'lk', KeyL: 'hk' };
      if (map[k]) g.input(map[k]);
      else return;
    } else return;
    e.preventDefault();
  }

  /** Sparring and challenge fights finishing. */
  private duelEnded(w: World, e: { kind: 'spar' | 'challenge'; id: string; won: boolean; stopped: boolean; landed: number; blocked: number; seconds: number }): void {
    const p = this.progress;
    if (!p) return;
    if (e.kind === 'spar') {
      // Defence training from what you landed and blocked, worth less the shorter it was.
      const reps = Math.min(10, Math.floor((e.landed + e.blocked * 1.5) / 2));
      const grades = Array.from({ length: Math.max(1, reps) }, (_, i) => (i < e.landed / 2 ? 'perfect' : 'good') as RepGrade);
      if (e.seconds < 8 || reps === 0) {
        this.hud.toast('Spar over. Too short to count for much: go a few rounds next time.', 'item');
        return;
      }
      const r = finishSession(p, SPAR_TRAINS, 9, SPAR_FATIGUE, grades);
      if (r.ok) {
        this.hud.toast(`Spar over (${e.landed} landed, ${e.blocked} blocked). Defence +${r.xp} XP${r.rankedUp ? ` — RANK ${r.rank}!` : ''} · fatigue ${r.fatigue}%`, r.rankedUp ? 'cash' : 'item');
        if (r.rankedUp) this.enterArea(w.level.id, 'start', { at: { x: w.player.pos.x, z: w.player.pos.z }, carry: w.carry() });
      }
      this.saveGame();
      return;
    }
    const def = COMPANIONS[e.id];
    if (e.won && def) {
      winChallenge(p, e.id);
      this.saveGame();
      this.hud.toast(`${def.nickname}: “Fair enough. I’m in.” Bring them along from your phone, or they’ll follow you now.`, 'cash');
      this.enterArea(w.level.id, 'start', { at: { x: w.player.pos.x, z: w.player.pos.z }, carry: w.carry() });
    } else if (def) this.hud.toast(e.stopped ? `You walked away from ${def.nickname}.` : `${def.nickname} put you down. Come back when you’re ready.`, 'warn');
  }

  // ---- the basement stairs ------------------------------------------------------------

  private stairAnim: { t: number; dur: number; from: { x: number; y: number; z: number }; to: { x: number; y: number; z: number }; done: () => void } | null = null;

  /** Walk down the garage stairwell (or up from the basement), fade, and arrive walking off the stairs. */
  private walkStairs(w: World, to: AreaId, entry: string): void {
    if (this.state === 'transition') return;
    this.state = 'transition';
    this.touch.release();
    const p = w.player;
    const carry = w.carry();
    const down = to === 'basement';
    const from = { x: p.pos.x, y: 0, z: p.pos.z };
    const target = down ? { x: STAIRWELL.x, y: -1.45, z: STAIRWELL.z - 0.75 } : { x: 0.75, y: 1.6, z: -2.0 };
    p.facing = target.x >= from.x ? 1 : -1;
    // Fade as you disappear down (or up) the stairs.
    window.setTimeout(() => this.fadeEl.classList.add('on'), 620);
    this.stairAnim = {
      t: 0, dur: 0.95, from, to: target,
      done: () => {
        window.setTimeout(() => {
          if (!this.progress) return;
          this.enterArea(to, entry, { carry });
          // Arrive on the stairs and step off them.
          const nw = this.world!;
          const q = nw.player;
          const land = { x: q.pos.x, y: 0, z: q.pos.z };
          const start = down ? { x: 0.8, y: 1.3, z: -1.75 } : { x: STAIRWELL.x, y: -1.3, z: STAIRWELL.z - 0.6 };
          q.pos.x = start.x;
          q.pos.z = start.z;
          q.pos.y = start.y;
          this.state = 'transition';
          this.stairAnim = { t: 0, dur: 0.8, from: start, to: land, done: () => (this.state = 'playing') };
          window.setTimeout(() => this.fadeEl.classList.remove('on'), 60);
        }, 260);
      },
    };
  }

  private updateStairs(dt: number): void {
    const a = this.stairAnim;
    const w = this.world;
    if (!a || !w) return;
    a.t += dt;
    const k = Math.min(1, a.t / a.dur);
    const e = k * k * (3 - 2 * k);
    const p = w.player;
    p.pos.x = a.from.x + (a.to.x - a.from.x) * e;
    p.pos.z = a.from.z + (a.to.z - a.from.z) * e;
    p.pos.y = a.from.y + (a.to.y - a.from.y) * e;
    if (k >= 1) {
      this.stairAnim = null;
      if (a.to.y === 0) p.pos.y = 0;
      a.done();
    }
  }

  // ---- bikes -------------------------------------------------------------------------

  /**
   * Riding into somewhere: home puts the bike away in the garage; any other
   * building means you leave it parked outside the door; streets you ride on.
   */
  private bikeArrivals(area: AreaId, leaving: { area: AreaId; x: number; z: number } | null): void {
    const p = this.progress!;
    const prop = p.save.property;
    if (!prop.riding || !prop.bikeOut) return;
    if (leaving && leaving.area === area) return;
    if (area === 'home') {
      storeBike(p);
      this.hud.toast('Bike put away in the garage', 'item');
    } else if (themeProfile(LEVELS[area].theme).interior || themeProfile(LEVELS[area].theme).roofed && LEVELS[area].theme !== 'subway') {
      if (leaving) {
        parkBike(p, leaving.area, leaving.x, leaving.z);
        this.hud.toast('Bike parked outside', 'item');
      } else storeBike(p);
    } else prop.bikeOut.area = area;
  }

  /** Put the player on the bike if they're riding: faster, no fighting. */
  private applyRiding(): void {
    const w = this.world;
    const p = this.progress;
    if (!w || !p) return;
    const ride = ridingBike(p);
    const view = this.renderer.viewOf(w.player);
    if (!ride) {
      view?.setMount(null);
      return;
    }
    w.player.stats.addModifier({ id: 'riding', source: 'bike', stat: 'moveSpeedMult', mul: bikeSpeedMult(ride.def) });
    if (view) {
      // The model's nose is +x; the rider faces local +z. Sit the seat under the hips.
      const holder = new THREE.Group();
      const bike = buildBikeModel(ride.owned.id, ride.owned.colour);
      bike.position.x = 0.3 * (ride.def.wheel / 0.37);
      holder.add(bike);
      holder.rotation.y = -Math.PI / 2;
      view.setMount(holder);
    }
  }

  /**
   * Get on the bike parked here. Done in place: the area is NOT rebuilt (rebuilding
   * re-armed the street's fights and, before the encounter fix, set one off under you).
   */
  private mountParkedBike(): void {
    const w = this.world;
    const p = this.progress;
    if (!w || !p) return;
    if (w.activeEncounter || w.locked) return this.hud.toast('Not with a fight on', 'warn');
    const r = mountBike(p, w.level.id);
    if (!r.ok) return this.hud.toast(r.reason, 'warn');
    w.removeStation('bike');
    this.renderer.setDynamicProp('parked_bike', null);
    this.hideLevelBike(w);
    // Stand on the bike's spot so you ride off from where it was.
    const out = p.save.property.bikeOut!;
    w.player.pos.x = out.x;
    w.player.pos.z = out.z;
    w.arena.clamp(w.player.pos);
    this.applyRiding();
    this.saveGame();
    this.hud.toast('On the bike. Interact (away from doors) to get off.', 'item');
  }

  /** The level's own parked-bike prop (built with the area) goes when you ride off. */
  private hideLevelBike(w: World): void {
    const prop = w.level.props.find((x) => x.kind === 'vehicle' && x.solid === false && BIKES[x.item ?? ''] && x.label !== 'podium');
    if (prop) this.renderer.hideLevelProp(prop);
  }

  /** Get off and leave the bike parked here, in place (no rebuild). */
  private dismount(reason?: string): void {
    const w = this.world;
    const p = this.progress;
    if (!w || !p || !p.save.property.riding) return;
    // Leave it somewhere it doesn't sit inside a bin or a wall: nearest clear spot along the street.
    const clear = (x: number, z: number) => {
      for (let dx = -0.95; dx <= 0.95; dx += 0.3) for (const dz of [-0.3, 0, 0.3]) if (w.arena.blocked(x + dx, z + dz, 0.02)) return false;
      const b = w.arena.bounds;
      return x - 0.95 > b.minX && x + 0.95 < b.maxX;
    };
    let spot = { x: w.player.pos.x, z: w.player.pos.z };
    search: for (let r = 0; r <= 6; r += 0.25) for (const sx of [1, -1]) for (const z of [spot.z, 0.3, 0.9, -0.3]) {
      if (clear(spot.x + sx * r, z)) {
        spot = { x: spot.x + sx * r, z };
        break search;
      }
    }
    parkBike(p, w.level.id, spot.x, spot.z);
    w.player.stats.removeModifier('riding');
    this.renderer.viewOf(w.player)?.setMount(null);
    const owned = p.save.property.bikes.find((b) => b.uid === p.save.property.bikeOut!.uid)!;
    w.removeStation('bike');
    w.addStation({ id: 'bike', x: spot.x, z: spot.z + 0.2, label: `Your ${BIKES[owned.id].name}: get on` });
    this.renderer.setDynamicProp('parked_bike', { kind: 'vehicle', item: owned.id, colour: owned.colour, x: spot.x, z: spot.z, size: [0.95, 0.3], solid: false });
    this.saveGame();
    if (reason) this.hud.toast(reason, 'warn');
  }

  // ---- placement editor (house furniture and basement equipment) ------------------------------------

  private editor: {
    space: 'home' | 'basement';
    uid: string;
    id: string;
    colour: string;
    at: { x: number; z: number; rot: number; room?: RoomId };
    prev: { x: number; z: number; rot: number; room?: RoomId } | null;
    bar: HTMLElement;
    status: HTMLElement;
  } | null = null;

  /** Lift a house piece (or take it out of its box) and move it about with a see-through preview. */
  private startPlacing(uid: string, room: RoomId): void {
    const p = this.progress;
    if (!p) return;
    const piece = p.save.property.furniture.find((f) => f.uid === uid);
    if (!piece) return;
    const def = FURNITURE[piece.id];
    const prev = piece.at ? { ...piece.at } : null;
    piece.at = null;
    const r = ROOMS[room];
    const at: PlacedAt =
      prev ?? suggestSpot(p.save.property, def, room, uid) ?? { room, x: Math.round(((r.x0 + r.x1) / 2) * 10) / 10, z: def.mount === 'wall' ? wallZ(def) : -1.2, rot: 0 };
    this.openEditor('home', uid, piece.id, piece.colour, def.name, def.mount === 'wall', Math.floor(def.price / 2), at, prev);
  }

  /** Same for a piece of basement equipment. */
  private startInstalling(uid: string): void {
    const p = this.progress;
    if (!p) return;
    const b = p.save.basement;
    const piece = b.equipment.find((e) => e.uid === uid);
    if (!piece) return;
    const def = EQUIPMENT[piece.id];
    const prev = piece.at ? { ...piece.at } : null;
    piece.at = null;
    const at = prev ?? suggestEquipmentSpot(b, def, uid) ?? { x: 4, z: def.mount === 'wall' ? equipmentWallZ(def) : -1.2, rot: 0 };
    this.openEditor('basement', uid, piece.id, '', def.name, def.mount === 'wall', piece.faulty ? Math.floor(equipmentResale(def.price) / 2) : equipmentResale(def.price), at, prev);
  }

  private openEditor(space: 'home' | 'basement', uid: string, id: string, colour: string, name: string, wall: boolean, resale: number, at: { x: number; z: number; rot: number; room?: RoomId }, prev: typeof at | null): void {
    this.ui.replaceAll(null);
    this.enterArea(space, space === 'home' ? 'start' : 'stairs', { at: { x: at.x, z: 1.0 } });
    this.state = 'editing';
    const status = h('div', { class: 'editor-status' });
    const btn = (label: string, fn: () => void, cls = '') => h('button', { class: `editor-btn ${cls}`, onclick: (e: Event) => (e.preventDefault(), fn()), text: label });
    const bar = h('div', { class: 'placement-bar' },
      h('div', { class: 'editor-title', text: `${space === 'home' ? 'Placing' : 'Installing'}: ${name}` }),
      status,
      h('div', { class: 'editor-pad' },
        btn('◀', () => this.nudge(-0.1, 0)),
        wall ? null : btn('▲', () => this.nudge(0, -0.1)),
        wall ? null : btn('▼', () => this.nudge(0, 0.1)),
        btn('▶', () => this.nudge(0.1, 0)),
        wall ? null : btn('⟲', () => this.turn(-1)),
        wall ? null : btn('⟳', () => this.turn(1)),
      ),
      h('div', { class: 'editor-pad' },
        btn(space === 'home' ? 'Place' : 'Install', () => this.confirmPlacing(), 'ok'),
        btn('Cancel', () => this.endPlacing('cancel')),
        btn('Store', () => this.endPlacing('store')),
        btn(`Sell £${resale}`, () => this.endPlacing('sell'), 'bad'),
      ),
      h('div', { class: 'editor-keys', text: 'Arrows/WASD move · Q/E turn · Shift = bigger steps · Enter place · Esc cancel · Delete store' }),
    );
    this.uiRoot.append(bar);
    this.editor = { space, uid, id, colour, at, prev, bar, status };
    this.refreshGhost();
  }

  private editorCheck(): { ok: true; room?: RoomId } | { ok: false; reason: string } {
    const ed = this.editor!;
    const p = this.progress!;
    if (ed.space === 'home') return checkPlacement(p.save.property, FURNITURE[ed.id], ed.at, ed.uid);
    return checkEquipmentPlacement(p.save.basement, EQUIPMENT[ed.id], ed.at, ed.uid);
  }

  private editorWall(): boolean {
    const ed = this.editor!;
    return (ed.space === 'home' ? FURNITURE[ed.id] : EQUIPMENT[ed.id]).mount === 'wall';
  }

  private refreshGhost(): void {
    const ed = this.editor;
    const w = this.world;
    if (!ed || !w) return;
    const chk = this.editorCheck();
    this.renderer.setGhost(ed.id, ed.colour, ed.at, chk.ok);
    ed.status.textContent = chk.ok ? (ed.space === 'home' && chk.room ? `Fits here (${ROOMS[chk.room].name})` : 'Fits here') : chk.reason;
    ed.status.className = `editor-status ${chk.ok ? 'ok' : 'bad'}`;
    // Keep the camera on it: the player stands in the walkway opposite.
    w.player.pos.x = Math.max(w.arena.bounds.minX + 0.4, Math.min(w.arena.bounds.maxX - 0.4, ed.at.x));
    w.player.pos.z = 1.0;
  }

  private nudge(dx: number, dz: number): void {
    const ed = this.editor;
    const w = this.world;
    if (!ed || !w) return;
    const b = w.level.bounds;
    const x = Math.max(b.minX + 0.1, Math.min(b.maxX - 0.1, Math.round((ed.at.x + dx) * 100) / 100));
    let z = ed.at.z;
    if (!this.editorWall()) z = Math.max(b.minZ - 0.7, Math.min(b.maxZ - 0.4, Math.round((ed.at.z + dz) * 100) / 100));
    const room = ed.space === 'home' ? (Object.keys(ROOMS) as RoomId[]).find((r) => x > ROOMS[r].x0 && x < ROOMS[r].x1) ?? ed.at.room : undefined;
    ed.at = { ...ed.at, x, z, room };
    this.refreshGhost();
  }

  private turn(d: number): void {
    const ed = this.editor;
    if (!ed || this.editorWall()) return;
    ed.at = { ...ed.at, rot: (ed.at.rot + d + 4) % 4 };
    this.refreshGhost();
  }

  private confirmPlacing(): void {
    const ed = this.editor;
    const p = this.progress;
    if (!ed || !p) return;
    const r = ed.space === 'home'
      ? placeFurniture(p, ed.uid, { ...ed.at, room: ed.at.room ?? 'living' })
      : installEquipment(p, ed.uid, ed.at);
    if (!r.ok) {
      this.hud.toast(r.reason, 'warn');
      return;
    }
    this.hud.toast(`${ed.space === 'home' ? FURNITURE[ed.id].name : EQUIPMENT[ed.id].name} ${ed.space === 'home' ? 'placed' : 'installed'}`, 'item');
    this.endPlacing('done');
  }

  /** Leave the editor: put the piece back where it was (cancel), in storage (store), sold, or where you placed it. */
  private endPlacing(how: 'done' | 'cancel' | 'store' | 'sell'): void {
    const ed = this.editor;
    const p = this.progress;
    if (!ed || !p) return;
    if (ed.space === 'home') {
      const piece = p.save.property.furniture.find((f) => f.uid === ed.uid);
      if (how === 'cancel' && piece && ed.prev) piece.at = { ...ed.prev, room: ed.prev.room ?? 'living' };
      if (how === 'store') storeFurniture(p, ed.uid);
      if (how === 'sell') {
        const r = sellFurniture(p, ed.uid);
        if (r.ok) this.hud.toast(`Sold for £${r.refund}`, 'cash');
      }
    } else {
      const piece = p.save.basement.equipment.find((e) => e.uid === ed.uid);
      if (how === 'cancel' && piece) piece.at = ed.prev ? { x: ed.prev.x, z: ed.prev.z, rot: ed.prev.rot } : null;
      if (how === 'store') uninstallEquipment(p, ed.uid);
      if (how === 'sell') {
        const r = sellEquipment(p, ed.uid);
        if (r.ok) this.hud.toast(`Sold for £${r.refund}`, 'cash');
      }
    }
    ed.bar.remove();
    this.editor = null;
    this.renderer.setGhost(null, '');
    const at = { x: this.world?.player.pos.x ?? ed.at.x, z: 1.0 };
    this.enterArea(ed.space, ed.space === 'home' ? 'start' : 'stairs', { at });
  }

  // ---- the basement business clock ----------------------------------------------------------------

  private bizTimer = 0;
  /** Set by a hit landing on you while riding; handled at the top of the next step. */
  private knockOff = false;

  /** Play time drives the business. Checked once a second; news comes up as toasts. */
  private businessClock(dt: number): void {
    const p = this.progress;
    if (!p) return;
    p.save.playTime += dt;
    this.bizTimer += dt;
    if (this.bizTimer < 1) return;
    const step = this.bizTimer;
    this.bizTimer = 0;
    this.conditionClock(step);
    const b = p.save.basement;
    if (!b.business.active) {
      b.business.lastTick = p.save.playTime;
      return;
    }
    for (const e of tickBusiness(b, p.save.playTime, p.save.heat)) this.hud.toast(`Basement: ${e.text}`, e.kind === 'storage_full' ? 'item' : 'warn');
  }

  /** Injuries heal with time (three times faster at home); your crew get their strength back. */
  private conditionClock(dt: number): void {
    const p = this.progress!;
    const w = this.world;
    this.house.tickNeeds(dt);
    const home = w?.level.id === 'home' || w?.level.id === 'basement';
    const healed = healOverTime(p.save.condition, dt, home ? 3 : 1);
    if (healed.length && w) {
      p.applyModifiers(w.player, w.difficulty);
      this.hud.toast(`Healed: ${healed.join(', ').toLowerCase()}`, 'item');
    }
    // Crew in the house: sat down rests best (health and fatigue), stood about less so.
    const resting = new Set(w?.restingIds() ?? []);
    for (const m of w?.crew ?? []) {
      if (!m.brain.home || m.f.isKO) continue;
      const rate = resting.has(m.def.id) ? 1 / 100 : 1 / 200;
      m.f.vitals.health = Math.min(m.f.vitals.maxHealth, m.f.vitals.health + m.f.vitals.maxHealth * rate * dt);
    }
    w?.syncCompanion();
    const out = new Set((w?.crew ?? []).filter((m) => !m.brain.home).map((m) => m.def.id));
    const inHouse = new Set((w?.crew ?? []).filter((m) => m.brain.home).map((m) => m.def.id));
    for (const id of p.save.companions.recruited) {
      const st = crewState(p, id);
      healOverTime(st.condition, dt, out.has(id) ? 1 : 3);
      // Out with you: health comes back in the fight's own time. At home (off-screen): resting.
      if (!out.has(id) && !inHouse.has(id)) companionRecover(st, dt, true);
      // Fatigue: sat on the sofa clears it quickest.
      const fatigueDrop = resting.has(id) ? 1.2 : inHouse.has(id) || !out.has(id) ? 0.5 : 0.12;
      const before = st.fatigue;
      st.fatigue = Math.max(0, st.fatigue - fatigueDrop * dt);
      if (before >= 50 !== st.fatigue >= 50 || (before >= 75) !== (st.fatigue >= 75)) {
        const m = w?.crew.find((c) => c.def.id === id);
        if (m) applyCrewModifiers(m.f, m.def, p);
      }
    }
  }

  /** A proper rest at home: every injury (yours and your crew's) down a level, crew back to full health. */
  private restAtHome(): string {
    const p = this.progress!;
    const fixed: string[] = [];
    for (const i of [...p.save.condition.injuries]) {
      const r = treatInjury(p.save.condition, i.part);
      if (r) fixed.push(r.name);
    }
    for (const id of p.save.companions.recruited) {
      const st = crewState(p, id);
      for (const i of [...st.condition.injuries]) treatInjury(st.condition, i.part);
      st.health = 1;
      st.fatigue = Math.max(0, st.fatigue - 50);
    }
    if (this.world) p.applyModifiers(this.world.player, this.world.difficulty);
    return fixed.length ? `Rested: ${fixed.join(', ').toLowerCase()} feel${fixed.length === 1 ? 's' : ''} better. The crew are rested too.` : 'Rested. The crew are fit and ready.';
  }

  private editorKey(e: KeyboardEvent): void {
    const big = e.shiftKey ? 5 : 1;
    const k = e.code;
    if (k === 'ArrowLeft' || k === 'KeyA') this.nudge(-0.1 * big, 0);
    else if (k === 'ArrowRight' || k === 'KeyD') this.nudge(0.1 * big, 0);
    else if (k === 'ArrowUp' || k === 'KeyW') this.nudge(0, -0.1 * big);
    else if (k === 'ArrowDown' || k === 'KeyS') this.nudge(0, 0.1 * big);
    else if (k === 'KeyQ') this.turn(-1);
    else if (k === 'KeyE') this.turn(1);
    else if (k === 'Enter' || k === 'Space') this.confirmPlacing();
    else if (k === 'Escape' || k === 'Backspace') this.endPlacing('cancel');
    else if (k === 'Delete') this.endPlacing('store');
    else return;
    e.preventDefault();
  }

  // ---- inventory ------------------------------------------------------------------

  /** Nothing going on: no fight, no police, not down. Cabs, heading home and the Tab / I shortcuts need it. */
  private calm(): boolean {
    const w = this.world;
    if (!w) return false;
    const p = w.player;
    if (w.activeEncounter || w.locked || w.policeActive || w.duel || p.isKO) return false;
    return !w.enemies.some((e) => !e.isKO && Math.abs(e.pos.x - p.pos.x) < 12);
  }

  /** The town map: see everything, set a route, take a cab or head home (with a confirm step). */
  private openMap(select?: AreaId): void {
    const w = this.world;
    const p = this.progress;
    if (!w || !p || (this.state !== 'playing' && this.state !== 'paused')) return;
    this.state = 'paused';
    this.touch.release();
    this.input.flush();
    this.updateTouchVisibility();
    const close = () => this.resume();
    this.ui.replaceAll(
      mapScreen({
        progress: p,
        here: { area: w.level.id, x: w.player.pos.x },
        calm: this.calm(),
        select,
        close,
        setDestination: (area) => {
          p.save.destination = area;
          this.saveGame();
        },
        travel: (area, opt) => {
          if (opt.kind === 'home') {
            this.ui.replaceAll(null);
            this.state = 'playing';
            if (p.save.property.riding) this.dismount();
            return this.goHome(false);
          }
          if (opt.kind !== 'cab' || !opt.entry) return;
          if (p.save.cash.bank < opt.cost) return this.hud.toast(`Need £${opt.cost} in the tin`, 'warn');
          p.save.cash.bank -= opt.cost;
          if (p.save.destination === area) p.save.destination = null;
          this.ui.replaceAll(null);
          this.state = 'playing';
          // The bike stays parked where you got off it.
          if (p.save.property.riding) this.dismount();
          this.hud.toast(`Dave’s Cabs: £${opt.cost}. ${LEVELS[area].name}, sorted.`, 'cash');
          this.changeArea(area, opt.entry, w.carry());
        },
      }),
    );
  }

  /**
   * Crew orders. Saved: 'follow' (comes out with you) and 'home' (stays home relaxing).
   * For now only: 'wait' (stay here), 'ready' (close and ready for a fight), 'callover' / 'relax' (at home).
   * Returns a line to show, and whether the area needs rebuilding (someone joins or leaves you).
   */
  private crewOrder(id: string, order: 'follow' | 'home' | 'wait' | 'ready' | 'callover' | 'relax'): { ok: boolean; text: string; rebuild?: boolean } {
    const p = this.progress!;
    const w = this.world;
    const def = COMPANIONS[id];
    const m = w?.crew.find((c) => c.def.id === id);
    switch (order) {
      case 'follow': {
        const r = followMe(p, id);
        if (!r.ok) return { ok: false, text: r.reason };
        if (m && !m.brain.home) {
          m.brain.setOrder('follow');
          return { ok: true, text: `${def.nickname}: “Right behind you.”` };
        }
        return { ok: true, text: `${def.nickname} will come out with you`, rebuild: !w?.homeLife };
      }
      case 'home': {
        const r = relaxAtHome(p, id);
        if (!r.ok) return { ok: false, text: r.reason };
        if (m?.brain.home) m.brain.home.following = false;
        return { ok: true, text: `${def.nickname} is staying home to relax`, rebuild: !!m && !m.brain.home };
      }
      case 'wait':
      case 'ready':
        if (!m || m.brain.home) return { ok: false, text: 'Only for someone out with you' };
        m.brain.setOrder(order);
        return { ok: true, text: order === 'wait' ? `${def.nickname} waits here` : `${def.nickname} stays close, ready for trouble` };
      case 'callover':
      case 'relax':
        if (!m?.brain.home) return { ok: false, text: 'Only at home' };
        m.brain.home.following = order === 'callover';
        return { ok: true, text: order === 'callover' ? `${def.nickname} gets up and comes with you` : `${def.nickname} goes back to relaxing` };
    }
  }

  /** G: quick orders for everyone with you: follow → wait here → ready → follow. At home: come with me / relax. */
  private quickCrewOrder(): void {
    const w = this.world;
    const p = this.progress;
    if (!w || !p) return;
    const out = w.crew.filter((m) => !m.brain.home && !m.waiting);
    if (out.length) {
      const now = out[0].brain.order;
      const next = now === 'follow' ? 'wait' : now === 'wait' ? 'ready' : 'follow';
      w.orderCrew(next);
      this.hud.toast(next === 'wait' ? 'Crew: wait here' : next === 'ready' ? 'Crew: stay close, ready for trouble' : 'Crew: follow me', 'item');
      return;
    }
    const mine = w.crew.filter((m) => m.brain.home && p.save.companions.following.includes(m.def.id));
    if (!mine.length) return this.hud.toast(p.save.companions.recruited.length ? 'Nobody’s with you. H → Crew to pick who follows you.' : 'No crew yet: fighters for hire at the Red Lion', 'item');
    const on = !mine[0].brain.home!.following;
    w.callHomeCrew(on, mine.map((m) => m.def.id));
    this.hud.toast(on ? 'Crew: up you get, come with me' : 'Crew: make yourselves at home', 'item');
  }

  /** Character & Crew (H): your numbers, condition and kit; your crew's. */
  private openProfile(tab: 'character' | 'crew' = 'character', crewId?: string): void {
    const w = this.world;
    const p = this.progress;
    if (!w || !p || (this.state !== 'playing' && this.state !== 'paused')) return;
    this.state = 'paused';
    this.touch.release();
    this.input.flush();
    this.updateTouchVisibility();
    w.syncCompanion();
    let crewDirty = false;
    this.ui.replaceAll(
      profileScreen({
        progress: p,
        player: w.player,
        liveCrew: w.crew.filter((m) => !m.waiting).map((m) => ({ id: m.def.id, f: m.f })),
        order: (id, order) => this.crewOrder(id, order),
        tab,
        crewId,
        crewChanged: () => {
          crewDirty = true;
        },
        saved: () => this.saveGame(),
        close: () => {
          this.ui.replaceAll(null);
          if (!crewDirty) return this.resume();
          if (!this.calm()) {
            this.hud.toast('Crew changes take effect once this fight’s over and you move on', 'item');
            return this.resume();
          }
          // Bring the new crew in (or send them home) right where you stand.
          this.enterArea(w.level.id, 'start', { at: { x: w.player.pos.x, z: w.player.pos.z }, carry: w.carry() });
        },
      }),
    );
  }

  private openInventory(): void {
    const w = this.world;
    const p = this.progress;
    if (!w || !p) return;
    this.state = 'paused';
    this.touch.release();
    this.input.flush();
    this.updateTouchVisibility();
    let lookChanged = false;
    const before = JSON.stringify(p.appearance()) + JSON.stringify(p.save.worn);
    const close = () => {
      this.ui.replaceAll(null);
      lookChanged = JSON.stringify(p.appearance()) + JSON.stringify(p.save.worn) !== before;
      if (lookChanged) {
        // New clothes or kit: rebuild the player model and stats where they stand.
        this.enterArea(w.level.id, 'start', { at: { x: w.player.pos.x, z: w.player.pos.z }, carry: w.carry() });
      } else this.resume();
    };
    this.ui.replaceAll(
      inventoryScreen(
        p,
        this.ui,
        {
          use: (uid) => {
            const r = w.useItem(uid);
            if (r.ok) this.audio.uiConfirm();
            return r;
          },
          hold: (uid) => w.holdFromInventory(uid),
          putAway: () => w.putAwayWeapon(),
          drop: (uid, qty) => w.dropFromInventory(uid, qty),
          changed: () => this.saveGame(),
          showOnMap: (area) => {
            close();
            this.openMap(area);
          },
        },
        close,
        { atHome: w.level.id === 'home' },
      ),
    );
  }

  // ---- shops ------------------------------------------------------------------------

  /** Threads: browse with your fighter on the studio set, then back into the shop. */
  private openClothesShop(): void {
    const w = this.world;
    const p = this.progress;
    if (!w || !p) return;
    const at = { x: w.player.pos.x, z: w.player.pos.z };
    const carry = w.carry();
    const area = w.level.id;
    const shop = p.shop('threads');
    this.enterStudio(p.appearance());
    this.renderer.setStudioFraming('full');
    let framing: StudioFraming = 'full';
    const back = () => this.enterArea(area, 'door', { at, carry });
    this.ui.replaceAll(
      clothesShopScreen(
        p,
        this.ui,
        {
          preview: (id) => {
            if (!this.studio) return;
            const look = p.appearance();
            const wear = id ? ITEMS[id]?.wear : undefined;
            if (wear) {
              if (wear.top) { look.top = wear.top; look.topColour = wear.colour ?? look.topColour; }
              if (wear.bottoms) { look.bottoms = wear.bottoms; look.bottomsColour = wear.colour ?? look.bottomsColour; }
              if (wear.shoes) { look.shoes = wear.shoes; look.shoesColour = wear.colour ?? look.shoesColour; }
              if (wear.accessory && !look.accessories.includes(wear.accessory)) look.accessories = [...look.accessories, wear.accessory];
              if (wear.chain) look.chainColour = wear.chain;
              if ((wear.slot === 'head' || wear.slot === 'face') && wear.colour) look.headColour = wear.colour;
            }
            this.studio.pending = look;
          },
          rotate: (d) => this.renderer.rotateStudio(d),
          zoom: () => {
            framing = framing === 'full' ? 'upper' : framing === 'upper' ? 'face' : 'full';
            if (this.studio) this.studio.framing = framing;
            this.renderer.setStudioFraming(framing);
          },
          changed: () => this.saveGame(),
          rob: () => this.robShop('threads', at),
          priceMult: shop.priceMult,
        },
        back,
      ),
    );
  }

  /**
   * Robbing Threads. Priya either empties the till or fights back; either
   * way the alarm goes, the police come, your heat goes up, the shop shuts
   * for a while and she charges you more afterwards. Each robbery pays less.
   */
  private robShop(shopId: 'threads' | 'pawn' | 'pub', at: { x: number; z: number }): void {
    const p = this.progress!;
    const spec = ROBBABLE[shopId];
    this.enterArea(spec.area, 'door', { at });
    const w = this.world!;
    const keeper = [...w.npcs.entries()].find(([st]) => st.id === spec.counter)?.[1] ?? null;
    const r = robShop(p, w, shopId, keeper);
    this.hud.notify('ROBBERY', 'big');
    this.audio.guardBreak();
    if (r.resisted) {
      this.hud.toast(shopId === 'pawn' ? '"Wrong shop, son." Mr Kaur reaches under the counter for a cosh.' : shopId === 'pub' ? '"In my pub?" Ray vaults the bar.' : '"Not again. Not in my shop." Priya comes over the counter.', 'warn');
      if (r.guard) this.hud.toast('A security guard steps out from the back.', 'warn');
    } else {
      this.hud.toast(`"Take it! Just take it!" ${spec.keeper} empties the till: £${r.till}.`, 'cash');
    }
    this.hud.toast(`Grabbed: ${r.grabbed.map((id) => ITEMS[id].name).join(', ')} (stolen)`, 'item');
    this.hud.toast(`Alarm going off. Police in ${Math.round(r.alarmIn / 60)} seconds.`, 'warn');
    this.saveGame();
  }

  /** Caught by the police: lose stolen goods, pay a fine, heat wiped. */
  private arrested(): { fine: number; seized: number } {
    const r = arrest(this.progress!);
    this.saveGame();
    return r;
  }

  // ---- input -----------------------------------------------------------------

  private onMenuAction(a: MenuAction, src: InputSource, fightKey = false): void {
    this.audio.unlock();
    if (this.ui.isOpen) {
      this.ui.handle(a, src);
      return;
    }
    // Doing something in the house: Esc stops it; opening a menu stops it first.
    if (this.state === 'playing' && this.house.active) {
      if (a === 'pause' || a === 'back') {
        this.house.cancel();
        return;
      }
      if (a === 'inventory' || a === 'map' || a === 'character' || a === 'crew') this.house.abort();
    }
    if (this.state === 'playing' && a === 'character' && this.world && !this.mode) {
      this.openProfile();
      return;
    }
    if (this.state === 'playing' && a === 'crew' && this.world && !this.mode) {
      this.quickCrewOrder();
      return;
    }
    if (this.state === 'playing' && (a === 'inventory' || a === 'map') && this.world) {
      // Tab and I are fight keys too (swap style, heavy punch): in a fight they stay that.
      if (fightKey && !this.calm()) return;
      if (fightKey) this.input.cancelPress(a === 'map' ? 'swap' : 'hp');
      if (a === 'map') this.openMap();
      else this.openInventory();
      return;
    }
    if (this.state === 'playing' && (a === 'pause' || (a === 'back' && src === 'keyboard'))) this.pause();
  }

  private onKey(e: KeyboardEvent): void {
    if (this.state === 'editing') return this.editorKey(e);
    if (this.state === 'training') return this.trainingKey(e);
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
    // Difficulty applies straight away, keeping the current health fraction.
    if (this.world && this.progress) {
      const v = this.world.player.vitals;
      const frac = v.health / v.maxHealth;
      this.progress.applyModifiers(this.world.player, s.difficulty);
      v.health = Math.max(1, Math.round(v.maxHealth * frac));
    }
    this.audio.applySettings(s);
    this.renderer.applyQuality(s.quality);
    setHumansEnabled(s.quality !== 'low');
    this.renderer.setLighting(s.lighting);
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
      bus.on('move:started', ({ fighter, move }) => {
        this.audio.swing(move.kind === 'heavy');
        // An enemy loading up a big, slow shot at you: a red flash on the fist or foot, early enough to block,
        // dodge or step out. Quick shots get none; reading those is down to you.
        const big = move.kind === 'heavy' || move.kind === 'special' || move.kind === 'finisher';
        if (big && move.startup >= 11 && !isPlayer(fighter) && fighter.team === 'enemy' && fighter.target && isPlayer(fighter.target)) {
          const foot = move.limb.endsWith('Foot') || move.limb === 'knee';
          this.renderer.fx.burst(fighter.pos.x + fighter.facing * (foot ? 0.25 : 0.32), fighter.pos.y + (foot ? 0.75 : 1.35), fighter.pos.z, fighter.facing, 'danger');
          this.audio.danger();
        }
      }),
      bus.on('hit:landed', (hit) => {
        const heavy = hit.move.kind === 'heavy';
        this.audio.impact(heavy ? 1 : hit.move.damage > 6 ? 0.45 : 0.15, hit.clean);
        this.renderer.fx.burst(hit.x, hit.y, hit.z, Math.sign(hit.target.pos.x - hit.attacker.pos.x) || 1, heavy ? 'heavy' : 'hit');
        this.renderer.viewOf(hit.target)?.flash();
        if (this.settings.get().screenShake) cam.addShake(0.03 + hit.damage * 0.007);
        floatAt(hit.x, hit.y + 0.25, hit.z, `${Math.round(hit.damage)}`, hit.clean ? 'clean' : 'dmg');
        // Big hits push the camera in for a moment: counters, and heavy shots that land clean.
        const big = hit.counter ? 0.9 : heavy && hit.clean ? 0.7 : heavy ? 0.35 : 0;
        if (big && this.settings.get().screenShake) cam.addPunch(big, hit.x);
        if (isPlayer(hit.attacker)) {
          this.hud.showCombo(hit.comboHits);
          this.input.rumble(heavy ? 0.5 : 0.15, heavy ? 0.3 : 0.25, heavy ? 90 : 45);
          if (hit.counter) this.hud.notify('COUNTER', 'warn');
          // A clean hit is worth calling out, but not every time: once in a while reads, every hit is noise.
          else if (hit.clean && this.time - this.lastCleanNotice > 3) {
            this.lastCleanNotice = this.time;
            this.hud.notify('CLEAN HIT', 'info');
          }
        }
        if (isPlayer(hit.target)) {
          const share = hit.damage / Math.max(1, hit.target.vitals.maxHealth);
          this.hud.hurt(Math.min(1, share * 6));
          this.input.rumble(0.35 + share * 4, 0.4, heavy ? 160 : 90);
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
        // The blow that wins the fight (or loses it) plays in slow motion, with the camera pushing in.
        const final = this.world?.isFinalBlow(fighter) ?? false;
        if (final || isPlayer(fighter)) {
          this.slowMo(final ? 0.75 : 0.6, final ? 0.22 : 0.35);
          cam.setCinematic(final ? 1 : 0.6, { x: fighter.pos.x, y: 1.1, z: fighter.pos.z });
        }
      }),
      bus.on('action:refused', ({ fighter }) => {
        if (isPlayer(fighter)) this.hud.notify('TOO TIRED', 'warn');
      }),
      bus.on('fighter:fatigue', ({ fighter, state }) => {
        if (isPlayer(fighter) && state === 'exhausted') this.hud.notify('EXHAUSTED — BACK OFF', 'warn');
      }),
      // An enemy getting ready to parry: a glint on their guard and a bright scrape, in time to see it.
      bus.on('fighter:tell', ({ fighter }) => {
        if (isPlayer(fighter)) return;
        this.audio.tell();
        this.renderer.fx.burst(fighter.pos.x + fighter.facing * 0.28, fighter.pos.y + 1.45, fighter.pos.z, fighter.facing, 'glint');
      }),
      bus.on('weapon:broken', ({ name, smashed }) => {
        if (smashed) this.audio.smash(/bottle|glass|jar/i.test(name));
      }),
      bus.on('hit:parried', ({ target }) => {
        this.audio.block();
        this.renderer.fx.burst(target.pos.x + target.facing * 0.4, target.pos.y + 1.4, target.pos.z, target.facing, 'block');
        if (isPlayer(target)) this.hud.notify('PARRY! COUNTER NOW', 'warn');
        else this.hud.notify('PARRIED', 'info');
      }),
      bus.on('fighter:finished', ({ by }) => {
        if (this.settings.get().screenShake) {
          cam.addShake(0.35);
          cam.addPunch(1, by.pos.x);
        }
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
    // Keys are marked ⟦…⟧ so the HUD can set them as key caps.
    const k = (key: string, pad: string, t: string) => `\u27e6${touch ? t : this.input.lastDevice === 'gamepad' ? pad : key}\u27e7`;
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
    if (this.house.active) text = '';
    else if (!text && it && p.isFree) {
      const locked = it.kind === 'exit' && it.locked;
      const done = it.kind === 'lever' && it.done;
      if (!done) {
        // House labels are "THING|What it does": FRIDGE  [E]  Open fridge.
        const [what, how] = it.label.includes('|') ? it.label.split('|') : [null, it.label];
        // "THING" on the plate, the key, then what it does; locked doors say so.
        text = `${what ? `${what}\u0001` : ''}${k('E', 'LB', 'GRAB')} ${how}${locked ? ' (locked)' : ''}`;
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

  /** Visual tests drive the clock themselves (see `advance`); the browser's own frames are then ignored. */
  manualClock = false;

  /** Run exactly n frames at 60 a second, whatever the real clock says. For the visual tests and debugging. */
  advance(n: number): void {
    for (let i = 0; i < n; i++) {
      // Every frame is simulated and animated; only the last two are drawn, which is all a picture needs.
      this.renderer.skipDraw = i < n - 2;
      this.last = this.manualTime;
      this.manualTime += 1000 / 60;
      this.frame(this.manualTime, true);
    }
  }

  private manualTime = 1000;

  /** Slow time to `scale` for `seconds` of real time (the visual tests keep normal speed). */
  private slowMo(seconds: number, scale: number): void {
    if (this.manualClock) return;
    // Already slowed: keep whichever is slower.
    this.slowScale = this.slowLeft > 0 ? Math.min(this.slowScale, scale) : scale;
    this.slowLeft = Math.max(this.slowLeft, seconds);
  }

  private frame(t: number, forced = false): void {
    if (this.manualClock && !forced) {
      requestAnimationFrame((n) => this.frame(n));
      return;
    }
    const realDt = this.last === 0 ? 1 / 60 : Math.max(0, Math.min(0.1, (t - this.last) / 1000));
    this.last = t;
    // Slow motion: hold the slow speed, then ease back to normal over about a third of a second.
    if (this.slowLeft > 0) {
      this.slowLeft -= realDt;
      this.timeScale = this.slowScale;
      if (this.slowLeft <= 0) this.renderer.cameraRig.setCinematic(0);
    } else this.timeScale = Math.min(1, this.timeScale + realDt * 2.5);
    // The fight and everything drawn run on game time; the HUD keeps real time.
    const dt = this.state === 'playing' ? realDt * this.timeScale : realDt;
    this.time += dt;

    const pad = this.input.pollGamepad();

    if (this.state === 'playing' && (this.mode || this.world)) {
      this.accumulator += dt;
      let steps = 0;
      while (this.accumulator >= DT && steps < MAX_STEPS_PER_FRAME && this.state === 'playing') {
        let cmd = this.input.sample(pad);
        if (this.world && this.progress?.save.property.riding) {
          // On a bike: no fighting. Interact away from anything gets you off. Only a real hit
          // knocks you off (see wireWorld), not a fight merely starting nearby.
          if (this.knockOff) {
            this.knockOff = false;
            this.dismount('Knocked off the bike');
          } else if (cmd.pressed.grab && !this.world.interactable) {
            this.dismount();
            break;
          }
          cmd = { ...cmd, special: false, block: false, pressed: { ...cmd.pressed, lp: false, hp: false, lk: false, hk: false, dodge: false, jump: false, swap: false } };
        }
        if (this.world) {
          if (this.house.active) cmd = this.house.command(cmd, DT);
          this.world.step(cmd);
          this.businessClock(DT);
        } else this.mode!.step(cmd);
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

    if (this.state === 'playing') this.house.update();
    const player = this.activePlayer;
    const inFight = (this.state === 'playing' || this.state === 'paused' || this.state === 'transition' || this.state === 'editing' || this.state === 'training') && !!player;
    this.updateStairs(dt);
    this.session?.game.update(dt);
    this.renderer.render(dt, this.time, inFight ? player : null);
    if (inFight && player) {
      const enemy = this.world ? this.world.focusEnemy : this.mode!.focusEnemy;
      // In story mode the boss has its own bar along the bottom.
      this.hud.update(realDt, player, this.world?.activeBoss && enemy === this.world.activeBoss ? null : enemy);
      this.hud.updateBubbles((x, y, z) => this.renderer.screenOf(x, y, z));
      if (this.world && this.progress) this.updateStoryHud(dt);
      this.updatePrompt();
    }

    if (!forced) requestAnimationFrame((n) => this.frame(n));
  }
}

/** Your own clothes are the basics; everything else is bought, found or stolen and worn from the inventory. */
function starterLocked(key: string): boolean {
  const [kind, v] = key.split(':');
  if (kind === 'top') return !(STARTER_TOPS as readonly string[]).includes(v);
  if (kind === 'bottoms') return !(STARTER_BOTTOMS as readonly string[]).includes(v);
  if (kind === 'shoes') return !(STARTER_SHOES as readonly string[]).includes(v);
  if (kind === 'acc') return !(STARTER_ACCESSORIES as readonly string[]).includes(v);
  return false;
}

/** New fighters start in their own clothes. */
function stripLocked(a: CharacterAppearance): CharacterAppearance {
  const out = { ...a, accessories: a.accessories.filter((x) => !starterLocked(`acc:${x}`)) };
  if (starterLocked(`top:${a.top}`)) out.top = 'hoodie';
  if (starterLocked(`bottoms:${a.bottoms}`)) out.bottoms = 'trackies';
  if (starterLocked(`shoes:${a.shoes}`)) out.shoes = 'trainers';
  return out;
}

function characterCreatorDefault(): CharacterAppearance {
  // A fresh random look each time you start a new fighter.
  return randomAppearance();
}
