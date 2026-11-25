/**
 * The lessons, as data (docs/TUTORIAL.md has the coverage matrix they come from).
 *
 * Essential chapters (1–5) run in order on a new game, at home and in the game's first fight. Each step says
 * what to do, why it matters, what to press, what to light up on screen, and what real event or state
 * completes it. Hints are one-off cards the first time you meet something, later on.
 */
import type { LessonMode } from '../ai/TutorialBrain';
import type { Fighter } from '../fighter/Fighter';
import type { InputSource } from '../input/InputManager';
import type { Progress } from '../progress/Progress';
import type { World } from '../world/World';
import { STYLES } from '../data/styles';
import { SPAR_SPOT } from '../training/gym';
import type { Action } from './controls';
import { ITEMS } from '../items/items';
import { slotFor } from '../items/hotbar';

/** What the tutorial hears about, boiled down from the game's own events (TutorialManager's bridge). */
export type TutEvent =
  | { type: 'jump' }
  | { type: 'station'; id: string }
  | { type: 'hit'; button: string; kind: string; combo: number; onMo: boolean }
  | { type: 'blocked' }
  | { type: 'parried' }
  | { type: 'dodge'; underAttack: boolean }
  | { type: 'grabbed' }
  | { type: 'escaped' }
  | { type: 'special' }
  | { type: 'finished' }
  | { type: 'swapped' }
  | { type: 'cleared'; id: string; cash: number; xp: number; optional: boolean }
  | { type: 'phone'; open: boolean }
  | { type: 'pause'; open: boolean }
  | { type: 'screen'; name: 'me' | 'bag' | 'map' }
  | { type: 'picked' }
  | { type: 'held' }
  | { type: 'injury' }
  | { type: 'police' }
  | { type: 'levelup' }
  /** A job (src/jobs): taken, its hard part done (`step`: go back for your money), paid, or gone wrong. */
  | { type: 'job'; stage: 'taken' | 'step' | 'done' | 'failed' }
  /** A hotbar slot used. */
  | { type: 'hotbar' }
  /** A deal sold on the street (business/dealing.ts). */
  | { type: 'deal' };

/** What a check can look at. */
export interface Ctx {
  world: World;
  progress: Progress;
  player: Fighter;
  device: InputSource;
  /** Since the step began: how far you've walked (x) and stepped in or out (z), and seconds spent running. */
  walked: number;
  stepped: number;
  ran: number;
}

export type Check =
  | { on: TutEvent['type']; test?: (e: TutEvent, c: Ctx) => boolean }
  | { poll: (c: Ctx) => boolean }
  | { read: true };

export interface StepDef {
  /** Unique within its chapter. */
  id: string;
  /** What to do: short, in the game's voice. A function when it depends on the save. */
  text: string | ((c: Ctx) => string);
  /** Why it matters, in a line. */
  why?: string | ((c: Ctx) => string);
  /** What to press (shown for the device in hand). */
  keys?: Action[];
  /** HUD elements to light up (CSS selectors on the real HUD). */
  focus?: string[];
  /** Mo's part, if the step needs him (home gym only). */
  mo?: LessonMode;
  /** Where you have to be: the step waits, with a pointer, until you are. */
  at?: { area: 'home' | 'estate'; x?: number; label: string };
  done: Check;
}

export interface ChapterDef {
  id: string;
  /** "01" … */
  num: string;
  title: string;
  /** For the library. */
  category: Category;
  blurb: string;
  steps: StepDef[];
  /** Done already, so the chapter can be passed over (an old save, or a fight already won). */
  already?: (p: Progress) => boolean;
  /**
   * Guides only (GUIDES): what starts it, the first time you meet the thing, once the first-run lessons are done
   * and with Settings → Tutorial hints on. An event, or a check made every so often (never in a fight).
   */
  start?: { on: TutEvent['type']; test?: (e: TutEvent) => boolean } | { poll: (p: Progress, w: World) => boolean };
}

export type Category = 'Getting started' | 'Combat' | 'Fighting styles' | 'Progression' | 'Inventory' | 'Exploration' | 'Gyms' | 'Money and survival' | 'Police and crime' | 'Crew' | 'Advanced';

const MO = SPAR_SPOT.x;
const atGym = { area: 'home' as const, x: MO, label: 'the gym at the far end of the house' };
const hitMo = (button: string) => (e: TutEvent) => e.type === 'hit' && e.onMo && e.button === button;

export const CHAPTERS: readonly ChapterDef[] = [
  {
    id: 'first-steps', num: '01', title: 'First steps', category: 'Getting started',
    blurb: 'Moving about, using things, what the HUD tells you, the phone and pause.',
    steps: [
      { id: 'intro', text: 'Every reputation starts somewhere. This one starts here, at 14 Tanner Road.', why: 'A few minutes to learn the basics. You can skip any of it.', done: { read: true } },
      { id: 'walk', text: 'Walk about.', keys: ['move'], why: 'Left and right takes you along the street.', done: { poll: (c) => c.walked >= 1.2 } },
      { id: 'depth', text: 'Step towards the back wall, and back out.', keys: ['depth'], why: 'You can move in and out as well: it’s how you get round people.', done: { poll: (c) => c.stepped >= 0.5 } },
      { id: 'run', text: 'Break into a run.', keys: ['run'], why: 'Running gets you about quicker. In a fight it costs stamina.', done: { poll: (c) => c.ran >= 0.3 } },
      { id: 'jump', text: 'Jump.', keys: ['jump'], done: { on: 'jump' } },
      { id: 'use', text: 'Use the biscuit tin on the desk.', keys: ['use'], why: 'Stand at something and its name comes up. That’s your money tin: cash in it is safe.', at: { area: 'home', x: -13.9, label: 'the desk in the bedroom' }, done: { on: 'station', test: (e) => e.type === 'station' && e.id === 'tin' } },
      { id: 'health', text: 'Health: the red bar. Hits take it; food and rest bring it back.', why: 'At nothing, you’re done in and someone goes through your pockets.', focus: ['.hud-top .fighter-panel.left .bar.health'], done: { read: true } },
      { id: 'stamina', text: 'Stamina: the blue bar. Attacking, blocking and running use it.', why: 'Let it come back between flurries, or you’ll be too tired to fight.', focus: ['.hud-top .fighter-panel.left .bar.stamina'], done: { read: true } },
      { id: 'level', text: 'Your level, the cash on you, and the XP bar under them.', why: 'Fights pay cash and XP. A full bar is a level up, and a level up is a training point.', focus: ['.story-row .lvl', '.story-row .money', '.xp-bar'], done: { read: true } },
      { id: 'objective', text: 'What to do next is always here. Tap it to read all of it.', why: 'Badges beside your money are needs, like hunger: tap one to see what it wants.', focus: ['.objective', '.needs-chips'], done: { read: true } },
      { id: 'phone', text: 'Get your phone out.', keys: ['phone'], why: 'Maps, cabs, your bank, messages and GraftWiki are all on it.', focus: ['.phone-btn'], done: { on: 'phone', test: (e) => e.type === 'phone' && e.open } },
      { id: 'phone-away', text: 'Have a look round, then put it away.', keys: ['phone'], done: { on: 'phone', test: (e) => e.type === 'phone' && !e.open } },
      { id: 'pause', text: 'Pause the game.', keys: ['pause'], why: 'Pause has Moves, Settings, Controls and Tutorials, where every lesson is.', focus: ['.pause-btn'], done: { on: 'pause', test: (e) => e.type === 'pause' && e.open } },
      { id: 'resume', text: 'Now carry on.', done: { on: 'pause', test: (e) => e.type === 'pause' && !e.open } },
    ],
  },
  {
    id: 'learning-to-fight', num: '02', title: 'Learning to fight', category: 'Combat',
    blurb: 'Cousin Mo on the gym mat at home: punches, kicks, combos, blocking, parrying, dodging and grabs.',
    steps: [
      { id: 'to-mo', text: 'Cousin Mo’s in the gym at the other end of the house. Go and see him.', why: 'He’ll show you how to look after yourself. He won’t hurt you.', at: atGym, done: { poll: (c) => Math.abs(c.player.pos.x - MO) < 2.2 } },
      { id: 'lp', text: 'Throw a punch at Mo. Make it land.', keys: ['lp'], mo: 'stand', why: 'Quick and cheap: your bread and butter.', at: atGym, done: { on: 'hit', test: hitMo('lp') } },
      { id: 'hp', text: 'Now a hard punch.', keys: ['hp'], mo: 'stand', why: 'Slower to come out, but it hurts.', at: atGym, done: { on: 'hit', test: hitMo('hp') } },
      { id: 'lk', text: 'A kick.', keys: ['lk'], mo: 'stand', why: 'Kicks reach further than punches.', at: atGym, done: { on: 'hit', test: hitMo('lk') } },
      { id: 'hk', text: 'A hard kick.', keys: ['hk'], mo: 'stand', at: atGym, done: { on: 'hit', test: hitMo('hk') } },
      { id: 'combo', text: 'Chain three hits together before he recovers.', keys: ['lp', 'lp', 'hp'], mo: 'stand', why: 'Press the next button while the last hit is landing. Pause → Moves lists every combo.', at: atGym, done: { on: 'hit', test: (e) => e.type === 'hit' && e.onMo && e.combo >= 3 } },
      { id: 'block', text: 'Mo’s going to swing at you. Block it.', keys: ['block'], mo: 'swing', why: 'Watch him wind up, and get your guard up in time. Blocking costs a little stamina.', at: atGym, done: { on: 'blocked' } },
      { id: 'parry', text: 'Now parry: tap block just before his punch lands.', keys: ['parry'], mo: 'swing', why: 'A parry leaves him wide open for a moment. It’s all timing: keep trying.', at: atGym, done: { on: 'parried' } },
      { id: 'dodge', text: 'Dodge his next swing.', keys: ['dodge'], mo: 'swing', why: 'Dodge as he swings and it misses. Dodge while stepping in or out to sidestep.', at: atGym, done: { on: 'dodge', test: (e) => e.type === 'dodge' && e.underAttack } },
      { id: 'grab', text: 'Get hold of him.', keys: ['grab'], mo: 'hold', why: 'Up close, a grab gets past a guard. Then punch, kick or throw.', at: atGym, done: { on: 'grabbed' } },
      { id: 'escape', text: 'Now he’ll grab you. Break free.', keys: ['grab'], mo: 'grab', why: 'Press grab when you’re held. The longer you leave it, the worse it gets.', at: atGym, done: { on: 'escaped' } },
      { id: 'stamina', text: 'Everything you just did used stamina.', why: 'Run it dry and you slow right down. Step back and let it fill.', focus: ['.hud-top .fighter-panel.left .bar.stamina'], mo: 'stand', at: atGym, done: { read: true } },
      { id: 'done', text: 'That’ll do. Walk off the mat whenever you’re ready.', why: 'You can spar with Mo any time: stand by the mat and use it.', done: { read: true } },
    ],
  },
  {
    id: 'styles', num: '03', title: 'Fighting styles', category: 'Fighting styles',
    blurb: 'Your style, what it’s good and bad at, and how you learn and swap others.',
    steps: [
      { id: 'yours', text: (c) => `You fight ${STYLES[c.progress.save.styles.primary].name}: ${STYLES[c.progress.save.styles.primary].blurb}`, why: (c) => { const s = STYLES[c.progress.save.styles.primary]; return `Good at: ${s.strengths.join(', ').toLowerCase()}. Weak at: ${s.weaknesses.join(', ').toLowerCase()}.`; }, done: { read: true } },
      { id: 'more', text: (c) => (c.progress.save.styles.secondary ? 'You know a second style. Swap to it in a fight.' : 'The fighting gyms teach other styles: boxing, kickboxing, wrestling and more.'), keys: [], why: (c) => (c.progress.save.styles.secondary ? 'Each style has its own moves. Swap when one isn’t working.' : 'Learn a second and you can swap between them mid-fight. You’ll be shown how then.'), done: { read: true } },
    ],
  },
  {
    id: 'first-scrap', num: '04', title: 'Your first proper scrap', category: 'Combat',
    blurb: 'Out the front door and onto the estate, where there’s a fight waiting.',
    already: (p) => p.has('cleared:estate:lads'),
    steps: [
      { id: 'out', text: 'Out the front door. The front door’s in the living room.', keys: ['use'], why: 'There are lads on the estate who don’t like the look of you.', done: { poll: (c) => c.world.level.id === 'estate' } },
      { id: 'fight', text: 'Win the fight. Use what Mo showed you.', at: { area: 'estate', label: 'the estate, out the front door' }, why: 'Mix your hits, block what you see coming, and don’t stand there empty.', done: { on: 'cleared', test: (e) => e.type === 'cleared' && !e.optional } },
      { id: 'rewards', text: 'Fights pay: cash in your pocket, and XP towards your next level.', why: 'Cash on you can be taken if you get battered. Put it in the tin at home.', focus: ['.story-row .money', '.xp-bar'], done: { read: true } },
    ],
  },
  {
    id: 'building', num: '05', title: 'Building your fighter', category: 'Progression',
    blurb: 'XP, levels, training points and where your fighter’s numbers live.',
    steps: [
      { id: 'me', text: 'Open your fighter’s page: Me.', keys: ['me'], why: 'Your attributes, styles, injuries and training points.', done: { on: 'screen', test: (e) => e.type === 'screen' && e.name === 'me' } },
      { id: 'points', text: (c) => (c.progress.save.trainingPoints > 0 ? `You’ve ${c.progress.save.trainingPoints} training point${c.progress.save.trainingPoints === 1 ? '' : 's'} to spend.` : 'Every level up gives you a training point.'), why: 'Spend them on ranks at a fighting gym’s coach. Kit in your home gym trains your body for nothing.', done: { read: true } },
      { id: 'end', text: 'That’s the basics. The rest, you’ll pick up as you go.', why: 'Pause → Tutorials has every lesson, if you want one again.', done: { read: true } },
    ],
  },
];

export const ESSENTIAL: readonly string[] = CHAPTERS.map((c) => c.id);

/** Something to heal with in your pockets (the hotbar's medical, food or drink slots would take it). */
const canHeal = (p: Progress) => p.save.inventory.some((st) => { const d = ITEMS[st.id]; const s = d ? slotFor(d) : null; return s === 'medic' || s === 'food' || s === 'drink'; });

/**
 * Guides: short lessons for things you meet later, run on real events like the chapters. Each starts itself the
 * first time you meet its thing (`start`), once the first-run lessons are done, and every one is in Pause →
 * Tutorials to start or replay. Skip any step, or the lot.
 */
export const GUIDES: readonly ChapterDef[] = [
  {
    id: 'jobs', num: '06', title: 'Jobs', category: 'Money and survival',
    blurb: 'Contacts and their work: taking a job, doing it, getting paid, and standing.',
    start: { on: 'station', test: (e) => e.type === 'station' && e.id === 'contact' },
    steps: [
      { id: 'contacts', text: 'That’s a contact. They’ve always got work for someone who can handle themselves.', why: 'Sorting people out, collecting debts, deliveries, getting things back, buying and selling. There are five of them about town.', done: { read: true } },
      { id: 'board', text: 'Their board shows what’s going: each card says where, what it pays, and what could go wrong.', why: 'Their own special job is at the top. One job at a time.', done: { read: true } },
      // A poll, not the event: the guide starts as their screen opens, so you may have taken one already.
      { id: 'take', text: 'Use them again and take a job.', keys: ['use'], why: 'A deal costs you the package up front. A delivery is against the clock.', done: { poll: (c) => !!c.progress.save.jobs.active } },
      { id: 'objective', text: 'The job’s your objective now, with a clock if it’s against time.', why: 'Who you’re after has a red mark over their head when you get there.', focus: ['.objective'], done: { read: true } },
      { id: 'phone', text: 'Jobs on your phone has Directions: it puts the route on your map.', keys: ['phone'], why: 'You can drop a job there too, but they’ll trust you less.', focus: ['.phone-btn'], done: { read: true } },
      { id: 'do', text: 'Go and do it.', why: 'Some square up when you get close. A debtor might pay, or might fight. Deliveries pay on the doorstep.', done: { poll: (c) => { const j = c.progress.save.jobs.active; return !j || j.stage === 'back'; } } },
      { id: 'back', text: (c) => { const j = c.progress.save.jobs.active; return j ? `Take it back to ${j.giver.split(' ')[0]} and hand it over.` : 'That’s the job done.'; }, why: 'Go down on the way with the money or the goods and they’re gone, and so is the job.', done: { poll: (c) => !c.progress.save.jobs.active } },
      { id: 'standing', text: 'Every job done raises your standing with whoever gave it.', why: 'Known, Trusted, then Inner circle: better pay, and their own special jobs open up. GraftWiki on your phone has the lot.', done: { read: true } },
    ],
  },
  {
    id: 'dealing', num: '08', title: 'Dealing', category: 'Money and survival',
    blurb: 'Bulk from Kez or your grow, bagged up in the garage, sold to punters on the street.',
    start: { on: 'station', test: (e) => e.type === 'station' && e.id === 'prep' },
    steps: [
      { id: 'table', text: 'The prep table: bulk goes on, deals come off.', why: 'Set it up once. It bags up while you’re out, a batch at a time (faster, and two at once, with the upgrades).', done: { read: true } },
      { id: 'setup', text: 'Set up the table.', done: { poll: (c) => c.progress.save.dealing.table > 0 } },
      { id: 'bulk', text: 'Get some bulk on it: buy it off Kez on Hollins, or bring your weed up from the basement.', why: 'Bulk is cheap. Bagged up and sold on the street it’s worth a lot more, and your own weed is worth far more bagged than sold by the unit.', done: { poll: (c) => { const d = c.progress.save.dealing; return d.batches.length > 0 || Object.values(d.bulk).some((n) => n > 0) || Object.values(d.deals).some((n) => n > 0); } } },
      { id: 'bags', text: 'It needs bags: one for every deal. Buy a pack at the table.', done: { poll: (c) => { const d = c.progress.save.dealing; return d.bags > 0 || d.batches.length > 0 || Object.values(d.deals).some((n) => n > 0); } } },
      { id: 'take', text: 'When it’s bagged up, take the deals.', why: 'Check back at the table. It keeps working while you’re out.', done: { poll: (c) => c.progress.save.inventory.some((x) => x.id.startsWith('deal_')) } },
      { id: 'sell', text: 'Sell to a punter: someone on the street with a green £ over their head.', keys: ['use'], why: 'Prices go up further east, and down the more you sell in one place on one trip.', done: { on: 'deal' } },
      { id: 'heat', text: 'Every sale is police heat, and now and then a punter is plain clothes.', why: 'Get nicked carrying it and they take the lot. Keep moving, spread it about, watch your heat on the phone.', done: { read: true } },
    ],
  },
  {
    id: 'hotbar', num: '07', title: 'The hotbar', category: 'Inventory',
    blurb: 'Four slots ready to use, in a fight too: medical, food, a drink and a weapon.',
    start: { poll: (p, w) => w.player.vitals.health < w.player.vitals.maxHealth * 0.6 && canHeal(p) },
    steps: [
      { id: 'slots', text: 'Your hotbar: 1 medical, 2 food, 3 drink, 4 weapon.', keys: ['hotbar'], why: 'Each slot uses what’s in your pockets, so you don’t have to open your bag in a fight.', focus: ['.hotbar'], done: { read: true } },
      { id: 'use', text: 'You’re hurt. Use your medical, food or drink slot.', keys: ['hotbar'], why: 'There’s a short wait between heals. Weapons never wait.', focus: ['.hotbar'], done: { on: 'hotbar' } },
      { id: 'refill', text: 'When one runs out, the next suitable thing in your pockets takes its place.', why: 'Change what’s in a slot in Pockets & bag: tap its row to cycle, or “Put on the hotbar”.', keys: ['bag'], done: { read: true } },
    ],
  },
];

/** One-off cards the first time you meet something (Settings → Tutorial hints turns them off). */
export interface HintDef {
  id: string;
  title: string;
  category: Category;
  text: string;
  why?: string;
  keys?: Action[];
  focus?: string[];
  /** The event that brings it up, or a check made every so often. */
  when: { on: TutEvent['type']; test?: (e: TutEvent) => boolean } | { poll: (p: Progress, w: World) => boolean };
}

export const HINTS: readonly HintDef[] = [
  { id: 'pockets', title: 'Pockets and bag', category: 'Inventory', text: 'You picked something up. It’s in your pockets: four slots, more with a bag.', why: 'Open your bag to use, wear or drop things. Threads sells bags.', keys: ['bag'], focus: ['.bag-btn'], when: { on: 'picked' } },
  { id: 'weapons', title: 'Weapons', category: 'Inventory', text: 'You’ve picked up a weapon. Your attacks use it until it breaks.', why: 'Press grab to throw it (or drop it, if it won’t throw). The bar under its name is how much it’s got left.', keys: ['grab'], when: { on: 'held' } },
  { id: 'streets', title: 'Getting about', category: 'Exploration', text: 'The streets run on into each other. Doors with a board over them go somewhere worth going.', why: 'Maps on your phone shows where everything is. Dave’s Cabs take you anywhere you’ve been.', keys: ['map'], when: { poll: (_p, w) => !w.level.deep && w.level.id !== 'home' && w.level.id !== 'estate' } },
  { id: 'shops', title: 'Shops and the pawn', category: 'Money and survival', text: 'Shops buy and sell. Pawn & Gold, on Market Square, gives the best money for valuables.', why: 'Stolen goods fetch less, and the police take them if you’re nicked.', when: { on: 'station', test: (e) => e.type === 'station' && ['clothes_counter', 'pawn_counter', 'cash_hatch', 'bar', 'jeweller_counter', 'furniture_counter', 'bike_counter', 'car_counter'].includes(e.id) } },
  { id: 'gyms', title: 'Gyms and coaches', category: 'Gyms', text: 'Coaches teach styles and sell new moves. Drill on the pads for drill XP, then see the coach for the next rank.', why: 'Ranks cost drill XP, training points and a fee. Tired from training? Rest at home.', when: { on: 'station', test: (e) => e.type === 'station' && ['style_coach', 'style_drill', 'gym_counter'].includes(e.id) } },
  { id: 'home', title: 'Home', category: 'Money and survival', text: 'Home is where you bank your cash in the tin, eat, wash, sleep and store things.', why: 'Sleep and rest heal you and ease injuries. Cash in the tin can’t be lost.', when: { poll: (p, w) => w.level.id === 'home' && p.has('cleared:estate:lads') } },
  { id: 'needs', title: 'Needs', category: 'Money and survival', text: 'A badge next to your money is a need: hunger, a wash, sleep and so on.', why: 'Let them slide and you fight worse. Tap a badge to see what it wants.', focus: ['.needs-chips'], when: { poll: () => !!document.querySelector('.needs-chips > *') } },
  { id: 'injury', title: 'Injuries', category: 'Money and survival', text: 'You’re carrying an injury from that fight.', why: 'Me shows what’s hurt. Rest at home or use first aid, or it’ll slow you down.', keys: ['me'], when: { on: 'injury' } },
  { id: 'levelup', title: 'Levelling up', category: 'Progression', text: 'Level up: you’ve a training point to spend.', why: 'Spend it on a rank at a fighting gym’s coach.', focus: ['.story-row .lvl'], when: { on: 'levelup' } },
  { id: 'specials', title: 'Special moves', category: 'Combat', text: 'You’ve learned specials. Hold special and attack for your style’s two.', why: 'They cost more stamina and hit harder. Pause → Moves lists them.', keys: ['special', 'lp'], when: { poll: (p) => p.save.moves.includes('specials') } },
  { id: 'finishers', title: 'Finishers', category: 'Combat', text: 'You’ve learned finishers. When someone’s beaten and reeling, special and hard punch ends it.', why: 'The prompt shows when one’s ready. They recharge between uses.', keys: ['special', 'hp'], when: { poll: (p) => p.save.moves.includes('finishers') } },
  { id: 'swap', title: 'Swapping styles', category: 'Fighting styles', text: 'You know two styles now. Swap between them in a fight.', why: 'Each has its own moves and its own strengths: swap when one isn’t working.', keys: ['swap'], when: { poll: (p) => p.save.styles.learned.length > 1 } },
  { id: 'heat', title: 'Heat', category: 'Police and crime', text: 'The police know about you here. That’s heat.', why: 'High enough, they’re waiting when you arrive, and losing any fight gets you nicked. It cools as you move about. The Heat app shows it all.', focus: ['.status-chip.heat'], when: { poll: (p) => p.save.heat > 0 } },
  { id: 'police', title: 'The Old Bill', category: 'Police and crime', text: 'Get nicked and you’re booked in at the station: bail, or a night in the cells.', why: 'Some coppers can be bought. GraftWiki on your phone has the lot.', when: { on: 'police' } },
  // Jobs (src/jobs): the Jobs guide covers contacts; these are the bits you meet on your own.
  { id: 'street-job', title: 'Someone needs a hand', category: 'Money and survival', text: 'A yellow ! over someone: they’ve got a one-off job for you.', why: 'Walk up and USE. They pay when it’s done, wherever that is.', keys: ['use'], when: { poll: (_p, w) => !!w.jobGiver && Math.abs(w.jobGiver.f.pos.x - w.player.pos.x) < 8 } },
  { id: 'job-failed', title: 'A job gone wrong', category: 'Money and survival', text: 'The job’s off. Too slow, or what you were carrying is gone.', why: 'It costs standing with whoever gave it. Their board has more work: just don’t make a habit of it.', when: { on: 'job', test: (e) => e.type === 'job' && e.stage === 'failed' } },
  // Clothes and jewellery bonuses (items/gearBonus.ts): the first time something you wear gives a buff.
  { id: 'club', title: 'The Arches', category: 'Combat', text: 'Fights for money, one a night. Pay the buy-in, win the purse, climb the card.', why: 'Beat the top contender for a shot at the title and a belt you can’t get anywhere else. Then defend it every few nights for bigger purses.', keys: ['use'], when: { poll: (_p, w) => w.level.id === 'fight_club' && !w.clubBout && !w.fightOn } },
  { id: 'buffs', title: 'Dressed for it', category: 'Inventory', text: 'What you wear has stats: better labels, bigger bonuses. A whole fit, a matching set or jewellery adds a buff.', why: 'Jewellery makes you learn faster too: extra XP for every piece on. Your Me screen lists the lot.', keys: ['phone'], when: { poll: (p) => p.buffs().length > 0 } },
  // The fridge and cupboards (#88).
  { id: 'kitchen', title: 'The kitchen', category: 'Money and survival', text: 'The fridge and cupboards keep what you buy. Eat or drink it here, take one with you, or cook.', why: 'Cooking turns raw food into proper meals that fill you up more. Hunger is one of your needs.', when: { on: 'station', test: (e) => e.type === 'station' && (e.id === 'fridge' || e.id === 'cupboard') } },
  // The Red Lion's lock-in (#86) and the Snug (#87).
  { id: 'pub', title: 'The Red Lion', category: 'Crew', text: 'Ray’s bar sells food, drink and plasters. The Snug at the back has fighters for hire.', why: 'Now and then the regulars start a lock-in: a fight for some cash. Hire someone and they leave their seat and come with you.', when: { poll: (_p, w) => w.level.id === 'pub' } },
  // NeXo Cutz on the High Street (barber/barber.ts).
  { id: 'barber', title: 'The barber', category: 'Money and survival', text: 'Vinny cuts hair, shapes or shaves beards and does colour. Sit in his chair to try a look on first.', why: 'You only pay for what changes. It’s your own hair, so it stays whatever you wear.', when: { poll: (_p, w) => w.level.id === 'barber_shop' } },
  // Ink & Iron on Hollins Estate (tattoo/tattoo.ts).
  { id: 'tattoo', title: 'Tattoos', category: 'Money and survival', text: 'Shaz does tattoos on your arms, chest and neck, and lasers them off. Sit down with her to try one on first.', why: 'It’s your own skin: the ink shows wherever your clothes don’t cover it.', when: { poll: (_p, w) => w.level.id === 'tattoo_studio' } },
  // Cashpoints on the streets (money/atm.ts).
  { id: 'atm', title: 'Cashpoints', category: 'Money and survival', text: 'Pay your cash in here and it’s safe if you get battered. Take some out when you need it on you.', why: 'Free on the High Street and in town; the machines on the rough estates charge £2 a go.', when: { on: 'station', test: (e) => e.type === 'station' && e.id === 'atm' } },
  // Street dealers once you're dealing (business/streetDealers.ts).
  { id: 'dealer', title: 'The competition', category: 'Advanced', text: 'Purple £: someone else is dealing on this street. While he’s here your deals fetch less.', why: 'Buy off him at trade, tax him, or run him off: put him down and the corner’s yours for a while.', when: { poll: (_p, w) => !!w.rival && !w.rival.hostile } },
  { id: 'crew', title: 'Your crew', category: 'Crew', text: 'You’ve someone on your side now. They follow you and fight with you.', why: 'Crew on your phone: who follows you, who rests at home, and their kit.', when: { poll: (p) => p.save.companions.recruited.length > 0 } },
  { id: 'property', title: 'Property', category: 'Advanced', text: 'Keys & Co sell property: live in it, let it out for rent, or sell when prices rise.', why: 'Rent comes in while you’re out. CaliBank on your phone shows it.', when: { on: 'station', test: (e) => e.type === 'station' && (e.id === 'agent_desk' || e.id === 'agent_window') } },
  { id: 'bikes', title: 'Bikes', category: 'Advanced', text: 'You’re on a bike. Quicker than walking, but you’re off it if you take a hit.', why: 'Mudlark Moto sells your own; hire bikes and scooters wait at the kerb.', when: { poll: (p) => !!p.save.property.riding } },
  { id: 'basement', title: 'The basement', category: 'Advanced', text: 'The basement’s yours to run a business from.', why: 'It pays while you’re out, but it draws the police if your heat gets high.', when: { poll: (_p, w) => w.level.id === 'basement' } },
];

export const HINT_IDS: readonly string[] = HINTS.map((h) => h.id);
