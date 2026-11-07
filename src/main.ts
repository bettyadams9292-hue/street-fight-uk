import './ui/styles.css';
import { Game } from './Game';

const gameRoot = document.getElementById('game');
const uiRoot = document.getElementById('ui');

if (!gameRoot || !uiRoot) {
  throw new Error('Missing #game or #ui container in index.html');
}

try {
  const game = new Game(gameRoot, uiRoot);
  // ?debug exposes the game to the console for testing.
  if (new URLSearchParams(location.search).has('debug')) (window as unknown as { sfuk: Game }).sfuk = game;
} catch (err) {
  // Most likely WebGL is unavailable.
  uiRoot.innerHTML = `<div class="fatal"><h2>Can't start the game</h2><p>${(err as Error).message}</p><p>Try a recent version of Chrome, Safari, Edge or Firefox with hardware acceleration turned on.</p></div>`;
  console.error(err);
}
