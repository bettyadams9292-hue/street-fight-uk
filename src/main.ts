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
import { loadDoors } from './render/props/DoorLibrary';
import { loadFlooring } from './render/street/Flooring';
import { loadKenney } from './render/props/KenneyLibrary';
import { loadPolyKit } from './render/kit/PolyKit';

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

const start = (): void => {
  try {
    const game = new Game(gameRoot, uiRoot);
    // Recorded sound effects load in the background; until they arrive, sounds are synthesised.
    if (query.get('assets') !== 'builtin') void import('./audio/recorded').then((m) => m.loadRecordedSounds(game.audio));
    // ?debug exposes the game to the console for testing.
    if (query.has('debug') || shot) (window as unknown as { sfuk: Game }).sfuk = game;
    // ?debug also offers the end-of-fight screens, for checking them without playing a fight out.
    if (query.has('debug')) void import('./ui/hub').then((m) => ((window as unknown as { sfukUi: unknown }).sfukUi = { rewardScreen: m.rewardScreen }));
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
  // The city kit loads alongside the characters (about 3 MB); without it streets keep their built-in frontages.
  const kit = new URLSearchParams(location.search).get('city') === 'classic' ? Promise.resolve(null) : loadCityKit();
  const models = loadCharacterModels((p) => {
    if (bootBar) bootBar.style.width = `${Math.round(4 + p.fraction * 96)}%`;
    if (bootText) bootText.textContent = p.done < p.total ? 'Loading characters' : 'Ready';
  });
  // Load the character models first, but never hold the game up for long: without them fighters use the
  // classic rig. (The visual tests wait for however long it takes, so their pictures don't depend on the network.)
  const humans = query.get('humans') === 'off' ? Promise.resolve(false) : preloadAllHumans();
  // The low-poly street kits (about 2 MB over the wire): without them the streets keep their older look.
  const polyKit = query.get('world') === 'classic' ? Promise.resolve(false) : loadPolyKit();
  const assets = Promise.all([models, kit, loadProps(), humans, loadAraMocap(), loadRokoko(), loadFlooring(), loadKenney(), loadGym(), loadShop(), loadHydro(), loadSecurity(), loadDoors(), polyKit, loadPickups()]);
  await (shot ? assets : Promise.race([assets, new Promise((r) => setTimeout(r, 6000))]));
  start();
};

void begin();
