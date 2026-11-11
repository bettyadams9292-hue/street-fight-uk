import './ui/styles.css';
import { Game } from './Game';
import { loadCharacterModels } from './render/characterModels';

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
    // ?debug exposes the game to the console for testing.
    if (query.has('debug') || shot) (window as unknown as { sfuk: Game }).sfuk = game;
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
  // The visual tests need every run to be identical: fixed random numbers and a fixed clock.
  if (shot) (await import('./debug/deterministic')).makeDeterministic();
  const models = loadCharacterModels((p) => {
    if (bootBar) bootBar.style.width = `${Math.round(4 + p.fraction * 96)}%`;
    if (bootText) bootText.textContent = p.done < p.total ? 'LOADING CHARACTERS' : 'READY';
  });
  // Load the character models first, but never hold the game up for long: without them fighters use the
  // classic rig. (The visual tests wait for however long it takes, so their pictures don't depend on the network.)
  await (shot ? models : Promise.race([models, new Promise((r) => setTimeout(r, 6000))]));
  start();
};

void begin();
