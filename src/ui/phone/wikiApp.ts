import { CAB_FLAG, CAB_PER_MILE } from '../hub';
import { BUY_IN, CHAMPION, DEFENCE_TRIPS, LADDER, NIGHT_SECONDS, STRIP_TRIPS, defencePurse } from '../../fightclub/club';
import { BARBER, BEARDS, COLOUR_PRICE, GREYS, HAIRCUTS } from '../../barber/barber';
import { DESIGNS, LASER_PRICE, REINK_PRICE, SLOT_NAMES, SLOT_ORDER, STUDIO, designPrice } from '../../tattoo/tattoo';
import { ATM_MAX, OTHER_BANK_FEE } from '../../money/atm';
import { CORNER_BONUS, CORNER_TRIPS, RIVAL_CUT, TRADE_SHARE } from '../../business/streetDealers';
import { BAIL_BASE, COURT_FINE_SHARE } from '../../progress/record';
import { STRAINS, WEEK } from '../../business/catalogue';
import { BAG_PACK, BAG_PACK_PRICE, BULK_BUYBACK, bulkWorth, DRUG_DEFS, DRUGS, GROW_PER_BULK, TABLES } from '../../business/dealing';
import { DRIP_LIST, JEWEL_BUFF_LIST, OUTFIT_LIST, STONE_BUFF_LIST, TIER_NAMES, XP_BONUS_CAP } from '../../items/gearBonus';
import { BOARD_TRIPS, CONTACT_IDS, CONTACTS } from '../../jobs/jobs';
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

export type WikiPage = 'index' | 'controls' | 'moves' | 'fighting' | 'heat' | 'police' | 'pockets' | 'jobs' | 'gear' | 'dealing' | 'grow' | 'club' | 'barber' | 'tattoo' | 'cash' | 'travel';

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
  { id: 'dealing', title: 'Dealing', blurb: 'Bulk, the prep table in your garage, punters, prices and the risks.' },
  { id: 'grow', title: 'The grow', blurb: 'The basement: tents, lights, extraction, heat, strains and how a crop runs.' },
  { id: 'club', title: 'The Scrap Yard', blurb: 'The fight club under Hard Knocks: the card, the title and defending it.' },
  { id: 'barber', title: 'The barber', blurb: 'Peaky Barbers on the High Street: haircuts, beards and colour, and what they cost.' },
  { id: 'tattoo', title: 'Tattoos', blurb: 'Ink & Iron on Hollins Estate: designs, where they go, laser removal and re-inking.' },
  { id: 'travel', title: 'Getting about', blurb: 'Running there on foot, Duber cabs, and driving your own car.' },
  { id: 'cash', title: 'Money', blurb: 'Cash, the tin, your bank account and card, branches and cash machines.' },
  { id: 'gear', title: 'Clothes and jewellery', blurb: 'Tiers, what each kind of clothing does, outfit buffs, and jewellery’s XP bonus.' },
  { id: 'jobs', title: 'Jobs', blurb: 'Who gives out work, the kinds of job, standing, and what goes wrong.' },
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
      ['Swap style', 'Tab', 'Back (let go)', 'STYLE'],
      ['Pussy out', 'X', '—', 'PUSSY OUT'],
    ],
  },
  {
    title: 'Getting about',
    rows: [
      ['Use (doors, shops, things at home, pick up)', 'E', 'LB', 'USE'],
      ['Phone', 'P', 'R3', 'Phone button'],
      ['Pockets and bag', 'B', '—', 'Bag button'],
      ['Hotbar: medical, food and drink, stamina, weapon (in a fight too)', '1 / 2 / 3 / 4', 'Hold Back + X / Y / A / B', 'Hotbar slots'],
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
      p(`Walk up to anyone on the street and USE says MUG. You don’t know what’s in their pockets till you try: usually a wallet with a few quid, sometimes a phone, now and then nothing at all. Jewellery they’re wearing hardly ever comes off. The nervy hand it over and leg it, and it lands at their feet. Others square up and fight for it: put them down and it’s on the floor. Either way it’s stolen (the pawn shop pays less, the police take it if they nick you). Someone wearing something worth having is likelier to fight.`),
      p(`Work the same street and it soon dries up: people keep their wallets in, more of them have nothing on them, and every mugging there brings more heat than the last. It’s a few quid when you’re desperate, not a living.`),
      p('What it costs you is heat with the police and the locals: see Heat.'),
      sec('Weapons'),
      p('Pick a weapon up with GRAB when nobody’s in reach. It wears out with every hit; the workbench at home mends it.'),
    );
  }

  if (page === 'grow') {
    const list = (items: string[]) => h('ul', {}, ...items.map((t) => h('li', { text: t })));
    return article('The grow', 'The basement under your house can grow. Kit comes from B&THC Hydroponics on the trading estate and goes in from the terminal by the stairs.',
      infobox('Strains', STRAINS.map((sd) => [sd.name, `${sd.type}: ${sd.veg ? `${sd.veg} + ${sd.flower}` : sd.flower} weeks, ${sd.wpp} W a plant${sd.level > 1 ? `, level ${sd.level}` : ''}`] as [string, string])),
      sec('What a grow needs'),
      list([
        'A tent. Its floor sets the plants: a 2×2 holds 2, a 3×3 4, a 4×4 6, a 5×5 9, the twin tent 10 and the walk-in room 24.',
        'Light, in watts: about 100 W a plant (75 W for an autoflower, 130 W for a haze). LED gives the most per watt and runs cool; HPS is cheap and hot; CMH sits between. Each strain does 10% better under the lamps it likes.',
        'Extraction through a carbon filter, in CFM: a 2×2 needs 60, a 4×4 200, more again for every HPS lamp. Short on air and only some plants grow.',
        'A clip fan in every tent, or the buds rot (10% less).',
        'Lamp heat out of the room: the extraction carries some, air con the rest. Too hot and the crop suffers.',
        'Power: the house gives 4 kW until the electrics are upgraded.',
      ]),
      sec('A crop'),
      p(`Seedlings and veg under 18 hours of light, then flowering under 12/12 (autos flower on their own), a week drying and curing, then clean down and replant. A grow week is ${WEEK} seconds of play, and it only grows while you play. Timers and drippers cut the turnaround. Changing strain pulls the crop and starts again.`),
      p('Stock goes on your shelves: sell it from the terminal into the business account, or bring it up for the prep table as bulk weed. Better security keeps thieves and raids off it; Skunk #1 smells, so raids are likelier.'),
    );
  }

  if (page === 'dealing') {
    const list = (items: string[]) => h('ul', {}, ...items.map((t) => h('li', { text: t })));
    return article('Dealing', `Once you’ve dealt with the Ratcatcher, Kez has a connect. Buy in bulk, break it down and bag it up at a prep table in your garage, and sell it on the street.`,
      infobox('Bulk from Kez', DRUGS.map((d) => [DRUG_DEFS[d].bulkName, `£${DRUG_DEFS[d].bulkPrice}: ${DRUG_DEFS[d].deals} deals at about £${DRUG_DEFS[d].street}`] as [string, string])),
      sec('The prep table'),
      p(`Set it up on the garage floor (£${TABLES[0].price}). Put bulk on it and it bags up a batch at a time while you’re out, one bag per deal (a pack of ${BAG_PACK} is £${BAG_PACK_PRICE}). ${TABLES.slice(1).map((t) => `${t.name} (£${t.price}): ${t.text.toLowerCase()}`).join(' ')}`),
      p(`Your grow in the basement links in: bring its stock up as bulk weed, ${GROW_PER_BULK} units to a bag. Sold by the unit that’s about £140; bagged up and sold on the street it’s about £${bulkWorth('weed')}.`),
      sec('Selling'),
      list([
        'Carry deals out on the streets and punters show a green £ over their head. Walk up and USE.',
        'Weed sells most; coke sells better and for more the further east you go; pills are cheap and quick.',
        'Every sale in a district on one trip knocks the price there down a little: spread it about.',
        `Kez buys bulk back at ${Math.round(BULK_BUYBACK * 100)}% if you change your mind.`,
        `On rough streets someone else may be dealing (a purple £): your price there is ${Math.round((1 - RIVAL_CUT) * 100)}% lower till you run him off. Buy off him at ${Math.round(TRADE_SHARE * 100)}% of street price, tax him for a cut, or run him off: then the corner’s yours for ${CORNER_TRIPS} trips and pays ${Math.round((CORNER_BONUS - 1) * 100)}% more.`,
      ]),
      sec('The risks'),
      list([
        'Every sale is police heat where you are, and dealing goes on your record.',
        'Now and then a punter is plain clothes: more often where police heat is high. Then they’re on their way.',
        'Get nicked with bulk or deals on you and the police take the lot.',
      ]),
    );
  }

  if (page === 'club') {
    const list = (items: string[]) => h('ul', {}, ...items.map((t) => h('li', { text: t })));
    return article('The Scrap Yard', 'An unlicensed fight club in the cellar under Hard Knocks, Canal Side Works. Once you’ve beaten Sully Kane he runs the card for you: one fight a night, for money, all the way up to the title.',
      infobox('The card', [...LADDER.map((f, i) => [`No. ${LADDER.length - i}`, `${f.name}: £${f.purse}`] as [string, string]).reverse(), ['Champion', `${CHAMPION.name}: £${CHAMPION.purse}`]]),
      sec('Fighting'),
      list([
        `Talk to Sully and take tonight’s fight. You pay a buy-in (${Math.round(BUY_IN * 100)}% of the purse) and win the purse if you put them down.`,
        'To the stoppage, one on one in the pit: no weapons, no crew. Go down and it’s over. Walk out of the pit and you lose.',
        `One fight a night, win or lose (a night is about ${NIGHT_SECONDS / 60} minutes of play). Win and you take their place on the card.`,
      ]),
      sec('The title'),
      p(`Beat the number one contender and you get a shot at ${CHAMPION.name}. Win and you’re the champion: a £${CHAMPION.purse} purse and the Scrap Yard title belt, a one-of-a-kind belt (+8% damage, +40 max health, +20 poise) you can’t buy anywhere.`),
      sec('Defending it'),
      list([
        `Every ${DEFENCE_TRIPS} nights a challenger wants your belt. No buy-in for the champ, and the purse grows every time you keep it: £${defencePurse(0)} for the first, up to £${defencePurse(99)}.`,
        'Each challenger is harder than the last, and keeps up with you as you level.',
        'Lose and the challenger takes the title. Get it back in a rematch.',
        `Keep a challenger waiting ${STRIP_TRIPS} nights past the date and you’re stripped.`,
      ]),
    );
  }

  if (page === 'barber') {
    const list = (items: string[]) => h('ul', {}, ...items.map((t) => h('li', { text: t })));
    return article('The barber', `${BARBER.shop}, between the Kebab House and the Dodgy Arms on the High Street. ${BARBER.barber} cuts hair, shapes or shaves beards, and does colour. Sit in his chair and every look is tried on you before you pay.`,
      infobox('Prices', [
        ['Haircuts', `£${Math.min(...Object.values(HAIRCUTS).map((j) => j.price))}–£${Math.max(...Object.values(HAIRCUTS).map((j) => j.price))}`],
        ['Beards', `£${Math.min(...Object.values(BEARDS).map((j) => j.price))}–£${Math.max(...Object.values(BEARDS).map((j) => j.price))}`],
        ['Colour', `£${COLOUR_PRICE}`],
        ['Grey', `£${GREYS[0].price}`],
      ]),
      sec('Getting a cut'),
      list([
        'Pick a haircut, a beard and a colour: each one shows on you as you tap it. Turn and Zoom to look from every side.',
        'The bill only counts what’s changing. Picking what you’ve already got is free.',
        'Pay with cash first, then your card, like any shop. Keep my look puts you back how you came in.',
        'Hats come off in the chair. The cut is your own hair, so it stays whatever you wear on top.',
      ]),
    );
  }

  if (page === 'tattoo') {
    const list = (items: string[]) => h('ul', {}, ...items.map((t) => h('li', { text: t })));
    const prices = Object.entries(DESIGNS).map(([, d]) => d.price);
    return article('Tattoos', `${STUDIO.shop}, on Hollins Estate next to the garages, where Kez stands (Duber stops at the door). ${STUDIO.artist} does the work: pick a design for any place and it’s drawn on you before you pay.`,
      infobox('Prices', [
        ['Designs', `£${Math.min(...prices)}–£${Math.max(...prices)}, more on the chest and neck`],
        ['Full sleeve', `£${designPrice('sleeve', 'rightUpperArm')} an arm`],
        ['Laser removal', `£${LASER_PRICE} a piece`],
        ['Re-inking', `£${REINK_PRICE} a piece`],
      ]),
      sec('Where'),
      p(`${SLOT_ORDER.map((s) => SLOT_NAMES[s]).join(', ')}. A full sleeve goes on an arm only.`),
      sec('Getting one'),
      list([
        'Your top comes off on the set, and you turn to show the place you’re looking at. Turn and Zoom to see the rest.',
        'Over something already there? It’s lasered off first, and the bill says so.',
        'The Ink tab redoes every piece in a new colour. A colour picked with nothing to re-ink comes free with your next piece.',
        'It’s your own skin: the ink shows wherever your clothes don’t cover it, so a vest or a bare chest shows the most.',
      ]),
    );
  }

  if (page === 'travel') {
    const list = (items: string[]) => h('ul', {}, ...items.map((t) => h('li', { text: t })));
    return article('Getting about', 'Pick a place on Maps and choose how to get there.',
      infobox('Ways to travel', [
        ['On foot', 'Free, any time'],
        ['Duber', `£${CAB_FLAG.toFixed(2)} + £${CAB_PER_MILE.toFixed(2)} a mile`],
        ['Your own car', 'Free once you own one'],
      ]),
      list([
        'Run there: your fighter runs the real streets on their own, through the doors and round the corners. Move or press anything to take over; pick Run there again to carry on.',
        'On foot you can get jumped. Each street you cross is a small chance, more in rough districts and where a gang is after you, less in the City Centre. Short trips are safer than long ones. Win the fight and you’re straight back on your way.',
        'Duber drops you at the door for a fare from your bank. No trouble on the way.',
        'Your own car is free and nobody jumps you. You drive it from wherever it’s parked: on the drive at home, or where you last left it. It’s left parked in the road when you get there, and shows on Maps.',
      ]),
    );
  }

  if (page === 'cash') {
    const list = (items: string[]) => h('ul', {}, ...items.map((t) => h('li', { text: t })));
    return article('Money', 'Your money lives in three places, and it only moves between them where it would in real life.',
      infobox('Where it moves', [
        ['Cash on you', 'Pays anywhere. Mugged, battered and seized with you.'],
        ['The biscuit tin', 'At home. In and out only in the house. Nobody touches it.'],
        ['Bank account', 'Pay in at your branch. Take out there or at a machine.'],
        ['Bank app', 'Balance and statement only'],
        ['Your machines', 'Free'],
        ['The other bank’s', `£${OTHER_BANK_FEE} a withdrawal`],
        ['Most at once', `£${ATM_MAX} from a machine`],
      ]),
      list([
        'Pick a bank in CaliStore on your phone: Califax (branch on the High Street) or Lloyd’s THC (branch on Market Square). Switch any time, for nothing.',
        'Shops, cabs and the barber take your cash first, then your card. At home, the tin pays before the card. Bungs, dealers and fight club buy-ins are cash in hand.',
        'Rent, property sales and the business pay into your account (into the tin until you have one). Fight purses, job pay and anything you sell to a shop are cash.',
        'Cash machines are out of service until you’ve dealt with Sully; the branch counters are open from the start. Machines don’t take deposits.',
        `Withdrawals come in £10 notes, up to £${ATM_MAX} at a time, at Califax and Lloyd’s THC machines on the High Street, in the City Centre, on Kingsway and in the Riverside Centre.`,
      ]),
    );
  }

  if (page === 'gear') {
    const list = (items: string[]) => h('ul', {}, ...items.map((t) => h('li', { text: t })));
    return article('Clothes and jewellery', 'What you wear isn’t just for show. Every piece of clothing has stats, and better labels have more. Jewellery makes you learn faster and gives a buff of its own.',
      infobox('Tiers', TIER_NAMES.slice(1).map((n, i) => [`Tier ${i + 1}`, `${n} (${['common', 'uncommon', 'rare', 'epic', 'legendary'][i]})`] as [string, string])),
      sec('Clothes'),
      p('Each kind of clothing does one thing, and its tier sets how much: the same thing in a Designer label does three times what a Basic one does.'),
      list([
        'Tracksuits, trackies and joggers: Speed. Runners and windbreakers: move speed.',
        'Hoodies, beanies and bucket hats: Endurance. Jumpers and quarter-zips: max stamina.',
        'T-shirts, vests, shorts and trainers: Agility.',
        'Leather, denim, jeans, chinos and flat caps: Defence (leather costs a point of Speed).',
        'Bombers, workwear and boots: Strength.',
        'Polos, shirts, Harringtons, caps and glasses: Technique.',
        'Puffers, gilets and high-tops: poise. Coats, cargos and belts: max health.',
        'Football shirts: stamina back. Sunglasses: less damage taken. Face coverings: less stamina used.',
      ]),
      sec('Outfit buffs'),
      p('Wear a whole fit (top, bottoms and shoes) and you get a buff for its lowest tier. Matching sets add their own.'),
      list(OUTFIT_LIST.map((o) => `${o.name}: ${o.text} ${o.stats}.`)),
      sec('Jewellery'),
      p(`Every piece you wear gives extra XP: more for rarer pieces and precious metals (platinum and 18ct gold best, steel and titanium least), and more again for a diamond. Together it’s capped at ${Math.round(XP_BONUS_CAP * 100)}%. ${DRIP_LIST.map((d) => `${d.at} pieces on at once: ${d.name}, +${Math.round(d.xp * 100)}% more.`).join(' ')}`),
      list([...JEWEL_BUFF_LIST.map((j) => `${j.cat[0].toUpperCase()}${j.cat.slice(1)}s, ${j.name}: ${j.text}.`), ...STONE_BUFF_LIST.map((x) => `${x.stone[0].toUpperCase()}${x.stone.slice(1)}: ${x.text}.`)]),
      p('Your Me screen lists the buffs you’ve got on and your XP bonus.'),
    );
  }

  if (page === 'jobs') {
    const list = (items: string[]) => h('ul', {}, ...items.map((t) => h('li', { text: t })));
    return article('Jobs', 'People round here have work for someone who can handle themselves. Walk up to a contact and press USE to see what they’ve got. You do one job at a time; the Jobs app on your phone shows what you’re on, how long you’ve got, and gives you directions.',
      infobox('Contacts', CONTACT_IDS.map((id) => [`${CONTACTS[id].name}`, `${CONTACTS[id].role}. ${CONTACTS[id].where}`] as [string, string])),
      sec('The work'),
      list([
        'Sort someone out: find the lad in another part of town and put him down (his mates join in). Then go back for your money.',
        'Collect a debt: lean on whoever owes. They pay up, or they’d rather fight for it. Take the money back and keep your cut.',
        'Deliver a package: get the parcel to someone before the time runs out. They pay you on the doorstep.',
        'Get something back: take it off the lad who nicked it. He drops it when he goes down; pick it up and take it back.',
        'Buy and sell: buy a package off Kez and sell it to a buyer for more. Now and then the buyer tries to rip you off, and you have to win the money. It’s police heat, and it goes on your record.',
      ]),
      sec('Standing'),
      p(`Every job you finish for a contact raises your standing with them: Known, then Trusted, then Inner circle. The higher it is, the more their work pays (up to half as much again). Each contact also has three jobs of their own, a story, that open as your standing grows; they pay more and come with something extra. Their boards change every ${BOARD_TRIPS} trips.`),
      sec('When it goes wrong'),
      list([
        'Too slow with a parcel or a package and the job’s off.',
        'Go down while you’re carrying the parcel, the package, the goods or the money, and it’s gone, and so is the job.',
        'Get nicked with a package and the police take it.',
        'Dropping a job, or failing one, costs you some standing.',
      ]),
      sec('Odd jobs'),
      p('Now and then someone on the street has a yellow mark over their head: they need a hand. Their jobs are one-offs, paid when it’s done.'),
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
    return article('Getting nicked', 'Lose to the police, or lose any fight while the police are Hot on you, and you’re nicked. You’re booked in at Kirkgate Constabulary in the City Centre, on Market Square. When it’s sorted, the door takes you straight home.',
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
        'Anything stolen on you is taken, into the property store.',
        'Your phone goes in a bag at the custody desk. No cabs and no maps till you walk out of the station.',
        'The worst charge sets the bail. Every other charge adds half again, every time you’ve been nicked before makes it dearer, and stolen goods add a bit on top.',
      ]),
      sec('Bail or the cells'),
      list([
        'Pay bail from the cash on you and the tin, and you walk out of the station.',
        'Or ring one of your crew. They pay it, and you owe them a quarter on top. It comes out of the tin when you get home, and they won’t come out with you till you’re square.',
        'Some nights Sgt Kerrigan has the custody desk. For half the bail, your paperwork goes missing.',
        'Or spend the night in the cells: keep the bail money, but the court fines you in the morning, and time passes. The police cool off a bit everywhere while you’re inside.',
        'Either way, those charges are dealt with and the police where you were caught forget you.',
      ]),
      sec('Bent coppers'),
      list([
        'When the police turn up you get a moment. Offer a bung, come quietly, or have it out.',
        'Some officers are bent: more on the rough estates, hardly any in the City Centre. You can’t tell till you try. A bent one pockets it and they walk off, and the police there cool down.',
        'A straight one won’t have it. That’s bribery on your record, more heat, and they come at you harder.',
        'Each part of town has its own officers, so you’ll meet the same faces. Once you’ve tried one, you know.',
        'Pay Kerrigan off once and he’s your contact, in the Heat app. He rings ahead when they’re waiting for you, cools a part of town down, and gets seized gear back out of the property store. Every favour’s a risk: if he’s caught, he talks, and the police everywhere come after you.',
      ]),
      sec('The front counter'),
      p('Walk into the station any time and Sgt Hollis will pull up your file. You can settle up a part of town early: pay the fines and its police heat and record are wiped.'),
    );
  }

  return article('Pockets and bags', `You’ve got ${BASE_INVENTORY_SLOTS} pockets. A bag on your back carries more.`,
    infobox('Bags', [
      ['Pockets', `${BASE_INVENTORY_SLOTS} slots`],
      ['Bum bag', '+8 (12 in all)'],
      ['Rucksack', '+16 (20)'],
      ['Gym holdall', '+24 (28)'],
      ['Big rucksack', '+36 (40)'],
    ]),
    sec('Wearing a bag'),
    p('You wear one bag at a time and see it on you. JD Streets sells them. Buying a bigger one puts it straight on; the old one goes in your pockets or home to the stash.'),
    sec('Taking it off'),
    p('A bag won’t come off while what’s in it wouldn’t fit in your pockets: drop or stash things first.'),
    sec('The hotbar'),
    p('Four slots at the bottom of the screen (beside the stick on a phone): medical, food and drink, stamina, and a weapon. Press 1, 2, 3 or 4, hold Back and press X, Y, A or B on a controller, or tap the slot. They work in a fight too, with a moment between uses (never before drawing a weapon). The stamina slot takes boosters: energy drinks, gels, stamina shots and electrolyte drinks, ordered to the house from the home computer’s Supplements tab.'),
    p('Each slot uses the next of its item from your pockets. When that runs out, the next suitable thing you’re carrying takes its place: the medical, food and drink or booster you’ve most of, or your best weapon. To choose, open Pockets and bag and tap a hotbar slot to move it on, or pick an item and put it on the hotbar.'),
    sec('Jewellery'),
    p('Jewellery lives in its own box and never takes a pocket. Open Pockets and bag → Jewellery box and tap a part of you to choose what to wear there.'),
  );
}
