/**
 * Fixed scenes for the visual tests. `?shot=<name>` builds one of these, runs
 * it for an exact number of frames on a fixed clock with fixed random numbers,
 * then sets `window.__shot.ready` so the test runner can take its picture.
 *
 * Nothing here runs in a normal game, and a shot page uses a blank in-memory
 * save (see deterministic.ts), so it can't touch a real one.
 */
import type { Game } from '../Game';
import { createCharacter, emptyAllocation, type PlayerCharacter } from '../character/Character';
import { defaultAppearance } from '../character/Appearance';
import { Progress, newSave, type AreaId } from '../progress/Progress';
import type { TrainingMode, TrainingOpponent } from '../core/TrainingMode';
import type { GameButton } from '../input/InputManager';
import { reseed } from './deterministic';
import { LEVELS } from '../world/levels';
import type { ShotName } from './shotList';

/** The private parts of Game the scenes drive. Kept here so Game itself stays closed to everything else. */
interface Internals {
  character: PlayerCharacter | null;
  progress: Progress | null;
  mode: TrainingMode | null;
  training: { mode: TrainingOpponent; archetype: string; primary: string; secondary: string | null };
  input: { pressFromTouch(b: GameButton): void };
  showMainMenu(): void;
  startTraining(): void;
  enterArea(area: AreaId, entry: string): void;
  world: { player: { pos: { x: number; z: number }; equipWeapon(id: string): void }; items: { key: string; stack: { uid: string; id: string; qty: number }; x: number; z: number; bornAt: number }[] } | null;
}

type SceneFn = (game: Game, g: Internals) => void;

function hero(g: Internals): PlayerCharacter {
  const c = createCharacter({ name: 'Shot', appearance: defaultAppearance('male'), background: 'estate_scrapper', allocated: emptyAllocation() });
  g.character = c;
  return c;
}

function training(game: Game, g: Internals, opponent: TrainingOpponent, settle = 90): void {
  hero(g);
  g.training.mode = opponent;
  g.startTraining();
  game.advance(settle);
}

function press(game: Game, g: Internals, b: GameButton, frames: number): void {
  g.input.pressFromTouch(b);
  game.advance(frames);
}

function story(game: Game, g: Internals, area: AreaId, entry: string, frames = 120): void {
  g.progress = new Progress(newSave(hero(g)));
  g.enterArea(area, entry);
  game.advance(frames);
}

function district(game: Game, g: Internals, area: string): void {
  const lvl = (LEVELS as Record<string, { entries: { id: string }[] }>)[area];
  if (!lvl) throw new Error(`no area ${area}`);
  story(game, g, area as AreaId, lvl.entries[0].id, 150);
}

export const SHOTS: Record<ShotName, SceneFn> = {
  menu: (game, g) => {
    g.showMainMenu();
    game.advance(60);
  },
  stance: (game, g) => training(game, g, 'stand'),
  jab: (game, g) => {
    training(game, g, 'stand');
    press(game, g, 'lp', 7);
  },
  cross: (game, g) => {
    training(game, g, 'stand');
    press(game, g, 'hp', 12);
  },
  kick: (game, g) => {
    training(game, g, 'stand');
    press(game, g, 'hk', 14);
  },
  blocked: (game, g) => {
    training(game, g, 'block');
    press(game, g, 'hp', 14);
  },
  spar: (game, g) => training(game, g, 'spar', 300),
  group: (game, g) => training(game, g, 'group', 240),
  home: (game, g) => story(game, g, 'home', 'start'),
  estate: (game, g) => story(game, g, 'estate', 'home'),
  // The rest of the phase 3 street: terrace, the first fight under the tower, the garages, the boxing club.
  estate_terrace: (game, g) => {
    story(game, g, 'estate', 'home', 10);
    if (g.world) g.world.player.pos.x = 9;
    game.advance(240);
  },
  estate_fight: (game, g) => {
    story(game, g, 'estate', 'home', 10);
    if (g.world) g.world.player.pos.x = 20;
    game.advance(260);
  },
  estate_garages: (game, g) => story(game, g, 'estate', 'subway'),
  estate_gym: (game, g) => story(game, g, 'estate', 'boxing'),
  // One picture per district, from its first entrance, for the city rebuild.
  high_street: (game, g) => district(game, g, 'high_street'),
  city: (game, g) => district(game, g, 'city'),
  industrial: (game, g) => district(game, g, 'industrial'),
  residential: (game, g) => district(game, g, 'residential'),
  precinct: (game, g) => district(game, g, 'precinct'),
  nightlife: (game, g) => district(game, g, 'nightlife'),
  docks: (game, g) => district(game, g, 'docks'),
  market: (game, g) => district(game, g, 'market'),
  ind_estate: (game, g) => district(game, g, 'ind_estate'),
  alleys: (game, g) => district(game, g, 'alleys'),
  // Every modelled prop: weapons and loot on the ground, a crowbar in hand, the estate dumpster behind.
  props: (game, g) => {
    story(game, g, 'residential', 'right', 10);
    const w = g.world;
    if (!w) return;
    w.player.pos.x = 70;
    w.player.equipWeapon('crowbar');
    const lay = ['w_hammer', 'w_crowbar', 'w_wrench', 'w_baseball_bat', 'w_pipe', 'watch_gold', 'sunglasses', 'phone_cheap', 'lockup_key'];
    lay.forEach((id, i) => w.items.push({ key: `shot_${i}`, stack: { uid: '', id, qty: 1 }, x: 66 + i * 0.85, z: 0.9, bornAt: -999 }));
    game.advance(120);
  },
};

interface ShotState {
  ready: boolean;
  scene: string;
  error?: string;
}

export function runShot(game: Game, name: string): void {
  const out: ShotState = { ready: false, scene: name };
  (window as unknown as { __shot: ShotState }).__shot = out;
  const scene = (SHOTS as Record<string, SceneFn | undefined>)[name];
  try {
    if (!scene) throw new Error(`No such shot: ${name}. Known: ${Object.keys(SHOTS).join(', ')}`);
    reseed();
    scene(game, game as unknown as Internals);
  } catch (e) {
    out.error = (e as Error).message;
    console.error(e);
  }
  // Fonts change the menus' layout; wait for them so every picture has the same text.
  void document.fonts.ready.then(() => {
    game.advance(1);
    out.ready = true;
  });
}
