import type { StyleData } from '../../styles/StyleData';
import { h } from '../dom';
import { movesKey, styleSection, type Device } from '../moveList';
import { BAIL_MAX, BAIL_MIN, MUG_HEAT } from '../../world/World';
import { GANG_GRUDGE, GANG_HUNT, HEAT, HEAT_COOL, KNOWN_FACE_HEAT } from '../../progress/heat';
import { ARREST_HEAT } from '../../world/robbery';
import { BASE_INVENTORY_SLOTS } from '../../progress/Progress';
import { FINISHER_COOLDOWN } from '../../fighter/Fighter';

/**
 * GraftWiki, the phone's how-to: a pocket encyclopedia in the look of a wiki. A contents page with a search box,
 * and articles (Controls, Moves, Fighting, Pockets and bags) with a title, the "From GraftWiki" line, a short lead,
 * an infobox and sections. Controls are shown for the controller in hand, with tabs for the others.
 */

export type WikiPage = 'index' | 'controls' | 'moves' | 'fighting' | 'heat' | 'pockets';

export interface WikiDeps {
  device: () => Device;
  styles: () => StyleData[];
  tech: (style: string) => number;
}

const ARTICLES: { id: Exclude<WikiPage, 'index'>; title: string; blurb: string }[] = [
  { id: 'controls', title: 'Controls', blurb: 'Every button: moving, fighting, getting about.' },
  { id: 'moves', title: 'Moves', blurb: 'Your styles: single hits, specials, combos, the finisher.' },
  { id: 'fighting', title: 'Fighting', blurb: 'Blocking, parries, staggers, finishers and pussying out.' },
  { id: 'heat', title: 'Heat', blurb: 'What the police, the locals and the gangs think of you, district by district.' },
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
        ['Pussying out', `drops ${Math.round(BAIL_MIN * 100)}–${Math.round(BAIL_MAX * 100)}% of the cash on you (the button says how much)`],
        ['No running from', 'bosses, the police, a duel'],
        ['Mugging', `+${MUG_HEAT} heat, more with witnesses; police, heroes, a known face`],
      ]),
      sec('Blocking and parrying'),
      p('Hold BLOCK to guard. Tap it just before a hit lands to parry: they’re left open, and a quick hit back lands as a counter.'),
      sec('Staggers and finishers'),
      p(`Heavy hits stagger. When someone is nearly out (under 15% health) and staggered right in front of you, SPECIAL + HARD punch finishes them in one go, and it can’t be blocked. Then it needs ${Math.round(FINISHER_COOLDOWN / 60)} seconds to recharge, so you can’t finish a whole crowd with it.`),
      sec('Pussying out'),
      p(`In a fight that’s going wrong, PUSSY OUT throws down some of the cash on you (somewhere between ${Math.round(BAIL_MIN * 100)}% and ${Math.round(BAIL_MAX * 100)}%, different every fight; the button tells you how much before you press it) and you leg it off the screen. They go for the money instead of you. Their crew don't forget it: a little gang heat for running, a lot (+${HEAT.bailBroke.gang}) for running with nothing on you (see Heat). You can’t pussy out of a boss fight, from the police or from a duel.`),
      sec('Mugging'),
      p(`Walk up to anyone on the street and USE says MUG: what you can see they’re wearing (a chain, a watch, a ring) is what you’re after, plus their wallet and maybe a phone. The nervy hand it all over and leg it, and it lands at their feet. Others square up and fight for it: put them down and it’s on the floor. Either way it’s stolen (the pawn shop pays less, the police take it if they nick you). The bigger the prize, the more likely they fight for it; the more of a name you are, the more likely they just hand it over.`),
      p('What it costs you is heat with the police and the locals: see Heat.'),
      sec('Weapons'),
      p('Pick a weapon up with GRAB when nobody’s in reach. It wears out with every hit; the workbench at home mends it.'),
    );
  }

  if (page === 'heat') {
    return article('Heat', 'Every district keeps three readings of you, 0 to 100. They all cool off as you move between areas; the district you’re in cools at half the rate.',
      infobox('Heat', [
        ['Police', `crimes · nicked if you lose a fight at ${ARREST_HEAT}+`],
        ['Locals', `muggings, assault · known face at ${KNOWN_FACE_HEAT}+`],
        ['Gang', `only once you take on their boss · harder from ${GANG_GRUDGE}, hunting you from ${GANG_HUNT}`],
        ['See yours', 'Heat app on the phone'],
      ]),
      sec('Police'),
      p(`Robbing a shop, mugging (+${HEAT.mug.police}, +${HEAT.witness.police} a witness) and assault (+${HEAT.assault.police}: putting down someone who was only defending themselves or someone else). From 40 the police may be waiting when you walk in; with witnesses about someone may ring 999 and officers turn up in 20–35 seconds, 12 if you’re already wanted. At ${ARREST_HEAT} or more, losing any fight there gets you nicked: stolen gear taken, a fine, and that district’s police heat wiped. Leave before they arrive and they’ve missed you.`),
      sec('Locals'),
      p(`What the people on the street think of you. Muggings (+${HEAT.mug.street}, +${HEAT.witness.street} a witness), assault (+${HEAT.assault.street}) and robbing their shops (+${HEAT.robbery.street}). From ${KNOWN_FACE_HEAT} they know your face: the nervy cross the road when you come near, so the only ones left to mug are the ones likely to fight back. The higher it is, the more have-a-go heroes step in and the more people ring 999.`),
      sec('Gang'),
      p(`Each district’s crew. They leave you alone until you take on their boss: before that, nothing you do raises gang heat, so you can get about. Once you’ve started on the boss their crew are involved (+${HEAT.provoke.gang}) until you beat them. Beating one of their fights when they weren’t bothered (+${HEAT.beatCrew.gang}), pussying out (+${HEAT.bail.gang}, or +${HEAT.bailBroke.gang} with nothing on you). From ${GANG_GRUDGE} their fights come at you harder: up to twice as hard and taking half the damage at 100. Beat a fight while they’re after you and some of it settles (-15). From ${GANG_HUNT} they come looking for you a few seconds after you walk in; put the lads they send down and it eases (${HEAT.beatHunters.gang}). Beat their boss and they’re finished with you: back to nothing.`),
      sec('Cooling off'),
      p(`Every time you move between areas, police heat drops ${HEAT_COOL.police}, locals ${HEAT_COOL.street} and gang ${HEAT_COOL.gang}. The basement business’s raid risk goes by the highest police heat anywhere.`),
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
