import type { StyleData } from '../../styles/StyleData';
import { h } from '../dom';
import { movesKey, styleSection, type Device } from '../moveList';
import { BAIL_SHARE } from '../../world/World';
import { BASE_INVENTORY_SLOTS } from '../../progress/Progress';
import { FINISHER_COOLDOWN } from '../../fighter/Fighter';

/**
 * GraftWiki, the phone's how-to: a pocket encyclopedia in the look of a wiki. A contents page with a search box,
 * and articles (Controls, Moves, Fighting, Pockets and bags) with a title, the "From GraftWiki" line, a short lead,
 * an infobox and sections. Controls are shown for the controller in hand, with tabs for the others.
 */

export type WikiPage = 'index' | 'controls' | 'moves' | 'fighting' | 'pockets';

export interface WikiDeps {
  device: () => Device;
  styles: () => StyleData[];
  tech: (style: string) => number;
}

const ARTICLES: { id: Exclude<WikiPage, 'index'>; title: string; blurb: string }[] = [
  { id: 'controls', title: 'Controls', blurb: 'Every button: moving, fighting, getting about.' },
  { id: 'moves', title: 'Moves', blurb: 'Your styles: single hits, specials, combos, the finisher.' },
  { id: 'fighting', title: 'Fighting', blurb: 'Blocking, parries, staggers, finishers and pussying out.' },
  { id: 'pockets', title: 'Pockets and bags', blurb: 'What you can carry, and how to carry more.' },
];

type Row = [string, string, string, string];
const CONTROLS: { title: string; rows: Row[] }[] = [
  {
    title: 'Moving',
    rows: [
      ['Walk left and right', 'A / D', 'Left stick', 'Stick'],
      ['Walk in and out of the screen', 'W / S', 'Left stick', 'Stick'],
      ['Sprint', 'Double-tap A / D and hold', 'Stick all the way', 'Stick to the edge'],
      ['Jump', 'C', 'L3', 'JUMP'],
    ],
  },
  {
    title: 'Fighting',
    rows: [
      ['Punch', 'J', 'X', 'PUNCH'],
      ['Hard punch', 'I', 'Y', 'HARD (punch)'],
      ['Kick', 'K', 'A', 'KICK'],
      ['Hard kick', 'L', 'B', 'HARD (kick)'],
      ['Block (hold) · parry (tap just before a hit)', 'Space', 'RT', 'BLOCK'],
      ['Dodge (with up/down to sidestep)', 'Shift', 'LT', 'DODGE'],
      ['Grab · break free · let go', 'U', 'LB', 'GRAB'],
      ['Special (hold, then a button)', 'O', 'RB', 'SPECIAL'],
      ['Finisher', 'O + I', 'RB + Y', 'SPECIAL + HARD punch'],
      ['Swap style', 'Tab', 'Back', 'STYLE'],
      ['Pussy out', 'X', '—', 'PUSSY OUT'],
    ],
  },
  {
    title: 'Getting about',
    rows: [
      ['Use (doors, shops, things at home, pick up)', 'E', 'LB', 'USE'],
      ['Phone', 'P', 'R3', 'Phone button'],
      ['Pockets and bag', 'B', '—', 'Bag button'],
      ['Map', 'M', 'Phone → Maps', 'Phone → Maps'],
      ['Room view (indoors)', 'Z', '—', 'ROOM'],
      ['Crew orders', 'G', '—', 'Phone → Crew'],
      ['Pause', 'Esc', 'Start', 'Pause button'],
    ],
  },
];
const COL: Record<Device, number> = { keyboard: 1, gamepad: 2, touch: 3 };
const DEVICE_NAME: Record<Device, string> = { touch: 'Touch', keyboard: 'Keyboard', gamepad: 'Controller' };

export function wikiApp(d: WikiDeps, page: WikiPage, go: (p: WikiPage) => void, state: { device?: Device; q?: string }): HTMLElement {
  const link = (p: WikiPage, text: string) => h('a', { class: 'wk-link', href: '#', onclick: (e: Event) => (e.preventDefault(), go(p)) }, text);
  const masthead = h('div', { class: 'wk-mast' },
    h('button', { class: 'wk-logo', onclick: () => go('index'), 'aria-label': 'GraftWiki contents' }, h('b', { text: 'G' }), h('span', {}, h('b', { text: 'GraftWiki' }), h('small', { text: 'The street encyclopedia' }))),
  );
  const article = (title: string, lead: string, ...body: (HTMLElement | string | null)[]) =>
    h('article', { class: 'wk' }, masthead, h('h1', { text: title }), h('p', { class: 'wk-from', text: 'From GraftWiki, the street encyclopedia' }), h('p', { class: 'wk-lead', text: lead }), ...body.filter(Boolean) as HTMLElement[],
      h('p', { class: 'wk-foot' }, link('index', '← All articles')));
  const sec = (t: string) => h('h2', { class: 'wk-h2', text: t });
  const p = (t: string) => h('p', { text: t });
  const infobox = (title: string, rows: [string, string][]) => h('table', { class: 'wk-info' }, h('caption', { text: title }), h('tbody', {}, ...rows.map(([k, v]) => h('tr', {}, h('th', { text: k }), h('td', { text: v })))));

  if (page === 'index') {
    const q = (state.q ?? '').toLowerCase();
    const hits = ARTICLES.filter((a) => !q || `${a.title} ${a.blurb}`.toLowerCase().includes(q));
    const input = h('input', { class: 'wk-search', type: 'search', placeholder: 'Search GraftWiki', value: state.q ?? '' }) as HTMLInputElement;
    input.addEventListener('input', () => {
      state.q = input.value;
      const list = input.parentElement!.parentElement!.querySelector('.wk-list')!;
      const qq = input.value.toLowerCase();
      list.replaceChildren(...ARTICLES.filter((a) => !qq || `${a.title} ${a.blurb}`.toLowerCase().includes(qq)).map((a) => h('li', {}, link(a.id, a.title), h('span', { text: a.blurb }))));
    });
    return h('article', { class: 'wk' }, masthead,
      h('div', { class: 'wk-searchbar' }, input),
      h('h1', { text: 'Welcome to GraftWiki' }),
      h('p', { class: 'wk-lead', text: 'How to fight, get about and get by. Tap an article.' }),
      h('ul', { class: 'wk-list' }, ...hits.map((a) => h('li', {}, link(a.id, a.title), h('span', { text: a.blurb })))),
    );
  }

  if (page === 'controls') {
    const dev = state.device ?? d.device();
    const tabs = h('div', { class: 'wk-tabs', role: 'tablist' }, ...(['touch', 'keyboard', 'gamepad'] as Device[]).map((x) =>
      h('button', { class: `wk-tab${x === dev ? ' on' : ''}`, role: 'tab', 'aria-selected': String(x === dev), onclick: () => ((state.device = x), go('controls')) }, DEVICE_NAME[x])));
    return article('Controls', `The buttons for ${DEVICE_NAME[dev].toLowerCase()}. Pick another above to see its buttons.`,
      tabs,
      ...CONTROLS.flatMap((g) => [
        sec(g.title),
        h('table', { class: 'wk-table' }, h('tbody', {}, ...g.rows.map((r) => h('tr', {}, h('td', { text: r[0] }), h('td', {}, r[COL[dev]] === '—' ? h('span', { class: 'wk-none', text: 'not on this' }) : h('kbd', { text: r[COL[dev]] })))))),
      ]),
      sec('Chaining'),
      p('Press the next button as the last hit lands to chain a combo; a press a moment early is remembered. See ' ), link('moves', 'Moves'),
    );
  }

  if (page === 'moves') {
    const styles = d.styles();
    return article('Moves', `Your fighting style${styles.length > 1 ? 's' : ''}: what each button does, how fast it comes out and how hard it hits.`,
      movesKey(),
      ...styles.map((s) => styleSection(s, d.device(), d.tech(s.id))),
    );
  }

  if (page === 'fighting') {
    return article('Fighting', 'Most fights are won by blocking more than you get hit, and hitting back when they miss.',
      infobox('Fighting', [
        ['Finisher', `under 15% health and staggered · ${Math.round(FINISHER_COOLDOWN / 60)} s to recharge`],
        ['Pussying out', `drops ${Math.round(BAIL_SHARE * 100)}% of the cash on you`],
        ['No running from', 'bosses, the police, a duel'],
      ]),
      sec('Blocking and parrying'),
      p('Hold BLOCK to guard. Tap it just before a hit lands to parry: they’re left open, and a quick hit back lands as a counter.'),
      sec('Staggers and finishers'),
      p(`Heavy hits stagger. When someone is nearly out (under 15% health) and staggered right in front of you, SPECIAL + HARD punch finishes them in one go, and it can’t be blocked. Then it needs ${Math.round(FINISHER_COOLDOWN / 60)} seconds to recharge, so you can’t finish a whole crowd with it.`),
      sec('Pussying out'),
      p(`In a fight that’s going wrong, PUSSY OUT throws down ${Math.round(BAIL_SHARE * 100)}% of the cash on you and you leg it off the screen. They go for the money instead of you. With nothing on you they let you go, but the district remembers your face: its next fight comes at you twice as hard (hit twice as hard, take half the damage) until you beat it. You can’t pussy out of a boss fight, from the police or from a duel.`),
      sec('Weapons'),
      p('Pick a weapon up with GRAB when nobody’s in reach. It wears out with every hit; the workbench at home mends it.'),
    );
  }

  return article('Pockets and bags', `You’ve got ${BASE_INVENTORY_SLOTS} pockets. A bag on your back carries more.`,
    infobox('Bags', [
      ['Pockets', `${BASE_INVENTORY_SLOTS} slots`],
      ['Bum bag', '+4 (8 in all)'],
      ['Rucksack', '+8 (12)'],
      ['Gym holdall', '+12 (16)'],
      ['Big rucksack', '+20 (24)'],
    ]),
    sec('Wearing a bag'),
    p('You wear one bag at a time and see it on you. Threads sells them. Buying a bigger one puts it straight on; the old one goes in your pockets or home to the stash.'),
    sec('Taking it off'),
    p('A bag won’t come off while what’s in it wouldn’t fit in your pockets: drop or stash things first.'),
    sec('Jewellery'),
    p('Jewellery lives in its own box and never takes a pocket. Open Pockets and bag → Jewellery box and tap a part of you to choose what to wear there.'),
  );
}
