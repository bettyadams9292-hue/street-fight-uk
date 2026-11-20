import { BAIL_BASE, COURT_FINE_SHARE } from '../../progress/record';
import type { StyleData } from '../../styles/StyleData';
import { h } from '../dom';
import { movesKey, styleSection, type Device } from '../moveList';
import { BAIL_MAX, BAIL_MIN } from '../../world/World';
import { BASE_INVENTORY_SLOTS } from '../../progress/Progress';
import { FINISHER_COOLDOWN } from '../../fighter/Fighter';

/**
 * GraftWiki, the phone's how-to: a pocket encyclopedia in the look of a wiki. A contents page with a search box,
 * and articles (Controls, Moves, Fighting, Pockets and bags) with a title, the "From GraftWiki" line, a short lead,
 * an infobox and sections. Controls are shown for the controller in hand, with tabs for the others.
 */

export type WikiPage = 'index' | 'controls' | 'moves' | 'fighting' | 'heat' | 'police' | 'pockets';

export interface WikiDeps {
  device: () => Device;
  styles: () => StyleData[];
  tech: (style: string) => number;
}

const ARTICLES: { id: Exclude<WikiPage, 'index'>; title: string; blurb: string }[] = [
  { id: 'controls', title: 'Controls', blurb: 'Every button: moving, fighting, getting about.' },
  { id: 'moves', title: 'Moves', blurb: 'Your styles: single hits, specials, combos, the finisher.' },
  { id: 'fighting', title: 'Fighting', blurb: 'Blocking, parries, staggers, finishers and pussying out.' },
  { id: 'heat', title: 'Heat', blurb: 'How much trouble you’re in with the police, the locals and the gangs, and how to cool off.' },
  { id: 'police', title: 'Getting nicked', blurb: 'Your record, the charge sheet, bail, a night in the cells, and the front counter.' },
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
        ['Mugging', 'Raises your heat, more with people watching'],
      ]),
      sec('Blocking and parrying'),
      p('Hold BLOCK to guard. Tap it just before a hit lands to parry: they’re left open, and a quick hit back lands as a counter.'),
      sec('Staggers and finishers'),
      p(`Heavy hits stagger. When someone is nearly out (under 15% health) and staggered right in front of you, SPECIAL + HARD punch finishes them in one go, and it can’t be blocked. Then it needs ${Math.round(FINISHER_COOLDOWN / 60)} seconds to recharge, so you can’t finish a whole crowd with it.`),
      sec('Pussying out'),
      p(`In a fight that’s going wrong, PUSSY OUT throws down some of the cash on you (somewhere between ${Math.round(BAIL_MIN * 100)}% and ${Math.round(BAIL_MAX * 100)}%, different every fight; the button tells you how much before you press it) and you leg it off the screen. They go for the money instead of you. If you’ve taken on that part of town’s boss, their gang won’t forget it: running makes them angrier, and running with no cash to throw down makes them much angrier (see Heat). You can’t pussy out of a boss fight, from the police or from a duel.`),
      sec('Mugging'),
      p(`Walk up to anyone on the street and USE says MUG: what you can see they’re wearing (a chain, a watch, a ring) is what you’re after, plus their wallet and maybe a phone. The nervy hand it all over and leg it, and it lands at their feet. Others square up and fight for it: put them down and it’s on the floor. Either way it’s stolen (the pawn shop pays less, the police take it if they nick you). The bigger the prize, the more likely they fight for it; the more of a name you are, the more likely they just hand it over.`),
      p('What it costs you is heat with the police and the locals: see Heat.'),
      sec('Weapons'),
      p('Pick a weapon up with GRAB when nobody’s in reach. It wears out with every hit; the workbench at home mends it.'),
    );
  }

  if (page === 'heat') {
    const list = (items: string[]) => h('ul', {}, ...items.map((t) => h('li', { text: t })));
    return article('Heat', 'Heat is how much trouble you’re in. Every part of town keeps its own: what the police, the people on the street and the local gang think of you. Open the Heat app on your phone to see yours. Each bar runs from Cold, through Simmering, Warm and Hot, up to Red hot.',
      infobox('In short', [
        ['Police', 'When their bar is Hot, losing any fight gets you nicked'],
        ['Locals', 'Once their bar is Warm, people start recognising you'],
        ['Gang', 'They leave you alone until you go after their boss'],
        ['Cooling off', 'Lie low somewhere else and it dies down'],
      ]),
      sec('The police'),
      p('Crime makes it worse: robbing a shop, mugging someone, and battering someone who was only defending themselves. Mugging in front of people is worse, since every one of them can describe you.'),
      list([
        'Once the bar is Warm, the police may already be waiting for you when you arrive.',
        'Mug someone with people watching and somebody may ring 999. Officers turn up about half a minute later, quicker if you’re already wanted. Leave the area before they get there and you’re away.',
        'Once it’s Hot, lose any fight here, not just against the police, and you’re nicked: see Getting nicked. The police there wipe the slate clean, but the rest of town still remembers you.',
      ]),
      sec('The locals'),
      p('What the people on the street think of you. Mugging them, battering them and robbing their shops all make it worse.'),
      list([
        'Once their bar is Warm, people start recognising you. The nervous ones cross the road when you come near, so the only people left to mug are the ones who’ll fight back.',
        'The worse it gets, the more often someone steps in to stop you, and the more often someone calls the police.',
      ]),
      sec('The gang'),
      p('Every part of town has a crew, and they don’t care about you until you take on their boss. Before that, nothing you do bothers them, so you can get about freely.'),
      list([
        'Start a fight with their boss and they’re after you straight away: their lads hit harder and take more punishment.',
        'Running from their fights makes it worse, much worse if you leg it with no cash to throw down. Beating their lads while they’re after you calms it down a little.',
        'Let their bar climb past halfway and they’ll send lads after you when you walk onto their streets. Put down the lads they send and they back off a bit.',
        'Beat their boss and they’re done with you for good.',
      ]),
      sec('Cooling off'),
      p('Heat dies down a little every time you move from one area to another. The police forget quickest and the gangs slowest. It fades twice as fast in the parts of town you’re not in, so the quickest way out is to lie low somewhere else. If the police are Hot on you somewhere, keep away for about eight trips and they’ll cool off.'),
      p('Your basement grow is raided more often the hotter the police are anywhere in town.'),
    );
  }

  if (page === 'police') {
    const list = (items: string[]) => h('ul', {}, ...items.map((t) => h('li', { text: t })));
    return article('Getting nicked', 'Lose to the police, or lose any fight while the police are Hot on you, and you’re nicked. You’re booked in at Central Police Station in the City Centre, on Market Square.',
      infobox('Bail', [
        ['Mugging', `£${BAIL_BASE[1]}`],
        ['Assault', `£${BAIL_BASE[2]}`],
        ['Robbing a shop', `£${BAIL_BASE[3]}`],
        ['Putting a copper down', `£${BAIL_BASE[4]}`],
        ['Night in the cells', `${Math.round(COURT_FINE_SHARE * 100)}% of bail, as a fine`],
      ]),
      sec('Your record'),
      p('Every mugging, assault and robbery goes on your record, along with any copper you put down. They’re forgotten after a while, so a crime from long ago won’t be held against you.'),
      sec('The charge sheet'),
      list([
        'They charge you with what you did where they caught you. If you did nothing there, they use the worst things you’ve done anywhere.',
        'Anything stolen on you is taken.',
        'The worst charge sets the bail. Every other charge adds half again, every time you’ve been nicked before makes it dearer, and stolen goods add a bit on top.',
      ]),
      sec('Bail or the cells'),
      list([
        'Pay bail from the cash on you and the tin, and you walk out of the station.',
        'Or spend the night in the cells: keep the bail money, but the court fines you in the morning, and time passes. The police cool off a bit everywhere while you’re inside.',
        'Either way, those charges are dealt with and the police where you were caught forget you.',
      ]),
      sec('The front counter'),
      p('Walk into the station any time and Sgt Hollis will pull up your file. You can settle up a part of town early: pay the fines and its police heat and record are wiped.'),
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
