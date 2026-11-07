import './ui/styles.css';
import { Game } from './Game';
import { loadCharacterModels } from './render/characterModels';

const gameRoot = document.getElementById('game');
const uiRoot = document.getElementById('ui');

if (!gameRoot || !uiRoot) {
  throw new Error('Missing #game or #ui container in index.html');
}

const start = (): void => {
  try {
    const game = new Game(gameRoot, uiRoot);
    // ?debug exposes the game to the console for testing.
    if (new URLSearchParams(location.search).has('debug')) (window as unknown as { sfuk: Game }).sfuk = game;
  } catch (err) {
  // Most likely WebGL is unavailable.
    uiRoot.innerHTML = `<div class="fatal"><h2>Can't start the game</h2><p>${(err as Error).message}</p><p>Try a recent version of Chrome, Safari, Edge or Firefox with hardware acceleration turned on.</p></div>`;
    console.error(err);
  }
};

// Load the character models first (about 1 MB), but never hold the game up for long: without them fighters use the classic rig.
void Promise.race([loadCharacterModels(), new Promise((r) => setTimeout(r, 6000))]).then(start);
