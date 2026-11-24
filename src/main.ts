import { loadAssetQueue, type AssetTask } from './performance/AssetQueue';
import './ui/styles.css';
import './ui/theme.css';
import { Game } from './Game';
import { loadCharacterModels } from './render/characterModels';
import { loadCityKit } from './render/city/CityKit';
import { loadProps } from './render/props/PropLibrary';
import { loadPickups } from './render/props/pickups';
import { preloadAllHumans } from './render/human/HumanBuilder';
import { loadAraMocap } from './render/anim/araPose';
import { loadRokoko } from './render/anim/rokoko';
import { loadGym } from './render/props/GymLibrary';
import { loadShop } from './render/props/ShopLibrary';
import { loadHydro } from './render/props/HydroLibrary';
import { loadSecurity } from './render/props/SecurityLibrary';
import { loadVehicles } from './render/props/VehicleLibrary';
import { loadProperty } from './render/props/PropertyLibrary';
import { loadDoors } from './render/props/DoorLibrary';
import { loadFlooring } from './render/street/Flooring';
import { loadKenney } from './render/props/KenneyLibrary';
import { loadPolyKit } from './render/kit/PolyKit';
import { loadTextureFiles } from './render/textureFiles';

const gameRoot = document.getElementById('game');
const uiRoot = document.getElementById('ui');

if (!gameRoot || !uiRoot) {
  throw new Error('Missing #game or #ui container in index.html');
}

const query = new URLSearchParams(location.search);
/** `?shot=<scene>`: draw one fixed scene for the visual tests (debug/shots.ts). */
const shot = query.get('shot');

// The loading screen (in index.html, so it shows before any script has run).
const boot = document.getElementById('boot');
const bootBar = document.getElementById('boot-bar');
const bootText = document.getElementById('boot-text');
const hideBoot = (): void => {
  if (!boot) return;
  boot.style.opacity = '0';
  setTimeout(() => boot.remove(), shot ? 0 : 280);
};

const start = (assets: { ready: Promise<unknown>; progress: () => number }): void => {
  try {
    const game = new Game(gameRoot, uiRoot);
    game.assets = assets;
    // The old blocky character models are only for Low graphics (8 MB): fetched only if that's the setting.
    if (game.lowGraphics) void loadCharacterModels();
    // Recorded sound effects load in the background; until they arrive, sounds are synthesised.
    if (query.get('assets') !== 'builtin') void import('./audio/recorded').then((m) => m.loadRecordedSounds(game.audio));
    // ?debug exposes the game to the console for testing.
    if (query.has('debug') || shot) (window as unknown as { sfuk: Game }).sfuk = game;
    // ?debug also offers the end-of-fight screens, for checking them without playing a fight out.
    if (query.has('debug')) void Promise.all([import('./ui/hub'), import('./ui/jewelleryUI')]).then(([m, j]) => ((window as unknown as { sfukUi: unknown }).sfukUi = { rewardScreen: m.rewardScreen, jewellerScreen: j.jewellerScreen }));
    hideBoot();
    // Set before the browser draws its first frame, so not one frame runs on the real clock.
    if (shot) game.manualClock = true;
    if (shot) void import('./debug/shots').then((m) => m.runShot(game, shot));
  } catch (err) {
    // Most likely WebGL is unavailable.
    hideBoot();
    uiRoot.innerHTML = `<div class="fatal"><h2>Can't start the game</h2><p>${(err as Error).message}</p><p>Try a recent version of Chrome, Safari, Edge or Firefox with hardware acceleration turned on.</p></div>`;
    console.error(err);
    if (shot) (window as unknown as { __shot: unknown }).__shot = { ready: true, error: (err as Error).message };
  }
};

const begin = async (): Promise<void> => {
  // The character line-up draws on its own stage, without the game.
  if (shot === 'humans' || shot === 'anims' || shot === 'jewels') {
    hideBoot();
    await (await import('./debug/deterministic')).makeDeterministic();
    void import('./debug/humanShot').then((m) => m.runHumanShot(gameRoot, shot));
    return;
  }
  // The visual tests need every run to be identical: fixed random numbers and a fixed clock.
  if (shot) (await import('./debug/deterministic')).makeDeterministic();
  // Everything 3D loads in the background: the menu (painted art) shows at once, and starting play waits for it
  // with a loading bar (Game.whenLoaded). One loader per line, so packages adding a loader don't conflict.
  const loaders: AssetTask[] = [
    // The city kit (about 3 MB): without it streets keep their built-in frontages.
    () => query.get('city') === 'classic' ? Promise.resolve(null) : loadCityKit(),
    () => loadProps(),
    () => query.get('humans') === 'off' ? Promise.resolve(false) : preloadAllHumans(),
    () => loadAraMocap(),
    () => loadRokoko(),
    () => import('./render/anim/ual').then((u) => u.loadUal()),
    () => loadFlooring(),
    () => loadKenney(),
    // The low-poly street kits: without them the streets keep their older look.
    () => query.get('world') === 'classic' ? Promise.resolve(false) : loadPolyKit(),
    () => loadPickups(),
    () => loadTextureFiles(),
  ];
  // The model sets (gym, shop, grow, security, cars, doors, property) aren't waited for here: each location
  // loads what it uses before it's built (performance/levelAssets.ts, Game.enterArea), and the rest come in
  // behind everything else. One request limit covers all of it (performance/requests.ts).
  const sets: AssetTask[] = [
    () => loadGym(),
    () => loadShop(),
    () => loadHydro(),
    () => loadSecurity(),
    () => loadVehicles(),
    () => loadDoors(),
    () => loadProperty(),
  ];
  const { ready, progress } = loadAssetQueue(loaders, loaders.length);
  const everything = loadAssetQueue(sets, sets.length).ready;
  if (shot) {
    // The visual tests wait for however long it takes, so their pictures don't depend on the network.
    if (bootText) bootText.textContent = 'Loading';
    const tick = setInterval(() => bootBar && (bootBar.style.width = `${Math.round(4 + progress() * 96)}%`), 150);
    await Promise.all([ready, everything]);
    clearInterval(tick);
  }
  start({ ready, progress });
};

void begin();
