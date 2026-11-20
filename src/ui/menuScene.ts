/**
 * The start screen's moving picture: a slow loop of the painted streets, each with one of the fighters stood in the
 * foreground. Every shot is a camera slowly circling the fighter, so the street behind slides one way while the
 * fighter drifts the other, then it cuts (a crossfade) to the next pairing. 4 streets and 5 fighters step together,
 * so all 20 pairings come round before any repeats, and no shot reuses the last shot's street or fighter.
 */
import { h } from './dom';

const STREETS = 4;
const FIGHTERS = 5;
/** How long a shot holds, and the crossfade between shots (ms). */
const SHOT_MS = 9000;
const FADE_MS = 1400;

// Always the full-size art: phones have dense screens, and the street on an upright phone is shown far wider than
// the screen, so the old half-size copies (the -small files) were blown up past their pixels.
const small = () => false;
const streetSrc = (i: number) => `/art/menu/street-${i + 1}${small() ? '-small' : ''}.webp`;
const fighterSrc = (i: number) => `/art/menu/fighter-${i + 1}${small() ? '-small' : ''}.webp`;

/** The nth shot's pairing. Streets and fighters step together; 4 and 5 share no factor, so it takes 20 shots to repeat. */
export function pairing(n: number): { street: number; fighter: number; dir: 1 | -1 } {
  return { street: n % STREETS, fighter: (n * 2) % FIGHTERS, dir: n % 2 ? -1 : 1 };
}

function shot(n: number): HTMLElement {
  const p = pairing(n);
  const el = h('div', { class: `menu-shot dir-${p.dir > 0 ? 'r' : 'l'}` },
    h('div', { class: 'menu-street', style: `background-image:url('${streetSrc(p.street)}')` }),
    h('img', { class: 'menu-fighter', src: fighterSrc(p.fighter), alt: '', draggable: 'false' }),
  );
  el.style.setProperty('--shot-ms', `${SHOT_MS + FADE_MS}ms`);
  return el;
}

/** The scene, to go behind the main menu. It stops itself once the menu is closed. */
export function menuScene(): HTMLElement {
  const stage = h('div', { class: 'menu-stage', 'aria-hidden': 'true' });
  // Start somewhere different each visit, so the first picture isn't always the same.
  let n = Math.floor(Math.random() * STREETS * FIGHTERS);
  let current = shot(n);
  current.classList.add('on');
  stage.append(current);
  // Fetch the next shot's pictures ahead of the cut.
  const preload = (k: number) => {
    const p = pairing(k);
    for (const src of [streetSrc(p.street), fighterSrc(p.fighter)]) new Image().src = src;
  };
  preload(n + 1);
  const next = () => {
    if (!stage.isConnected) {
      // Not on screen yet (first frame) or closed: try again shortly, and give up once it's gone for good.
      if (stage.dataset.shown) return;
      setTimeout(next, 500);
      return;
    }
    stage.dataset.shown = '1';
    setTimeout(function cut() {
      if (!stage.isConnected) return;
      n++;
      const incoming = shot(n);
      stage.append(incoming);
      // Let the browser lay it out invisible, then fade it in over the old one.
      requestAnimationFrame(() => requestAnimationFrame(() => incoming.classList.add('on')));
      const old = current;
      current = incoming;
      setTimeout(() => old.remove(), FADE_MS + 100);
      preload(n + 1);
      setTimeout(cut, SHOT_MS);
    }, SHOT_MS);
  };
  setTimeout(next, 0);
  return stage;
}
