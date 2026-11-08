import type { WeaponClass } from '../combat/Weapons';
import type { StyleId } from '../styles/StyleData';

/**
 * Who your crew are and how they fight.
 *
 * A personality changes how a companion behaves around you: how close they
 * stay, which enemy they go for, when they back off, how much they talk,
 * and what they get up to at home. A fighting style changes how they fight:
 * the move set they use (a real game style), how fast and hard they hit,
 * which buttons they favour (jabs or hooks, punches or kicks, grabs),
 * whether they counter after blocking, and how good they are with weapons.
 * Both go through the normal AI and stat modifiers, so the differences are
 * in what they actually do, not just on the profile screen.
 */

export type PersonalityId = 'aggressive' | 'veteran' | 'hothead' | 'joker' | 'loyal' | 'professional' | 'heavy' | 'fast' | 'brawler' | 'weapons';

export interface Personality {
  id: PersonalityId;
  name: string;
  text: string;
  /** How far behind you they walk. */
  followDist: number;
  /** How far from you or them an enemy can be before they go for it. */
  engageRange: number;
  /** Who they go for: the nearest enemy, whoever's on you, or the weakest. */
  targeting: 'nearest' | 'onPlayer' | 'weakest';
  /** Below this share of health they back off behind you (0 = never). */
  retreatAt: number;
  /** Go to the aid of a downed or struggling crew mate. */
  helpsCrew: boolean;
  /** How often they speak up (0..1). */
  chatty: number;
  /** Shout at enemies when a fight starts. */
  taunts: boolean;
  /** At home: what they like doing, by weight. */
  home: Partial<Record<HomeActivity, number>>;
}

export type HomeActivity = 'sit' | 'phone' | 'tv' | 'kitchen' | 'chat' | 'stand' | 'stretch' | 'pace';

export const PERSONALITIES: Record<PersonalityId, Personality> = {
  aggressive: {
    id: 'aggressive', name: 'Aggressive fighter', text: 'Confrontational. Goes straight in, prefers attacking to defending, and lets the other side know about it.',
    followDist: 1.5, engageRange: 11, targeting: 'nearest', retreatAt: 0, helpsCrew: false, chatty: 0.6, taunts: true,
    home: { sit: 2, phone: 1, tv: 2, stretch: 2, chat: 2, pace: 1 },
  },
  veteran: {
    id: 'veteran', name: 'Calm veteran', text: 'Composed and experienced. Defends first, picks his moments, steps back when it gets dangerous. Doesn’t say much.',
    followDist: 1.6, engageRange: 7, targeting: 'onPlayer', retreatAt: 0.3, helpsCrew: true, chatty: 0.25, taunts: false,
    home: { sit: 4, tv: 2, kitchen: 1, chat: 1 },
  },
  hothead: {
    id: 'hothead', name: 'Hothead', text: 'Short fuse. Wades in close, gets wound up, winds the opposition up. Can’t sit still.',
    followDist: 1.3, engageRange: 10, targeting: 'nearest', retreatAt: 0, helpsCrew: false, chatty: 0.7, taunts: true,
    home: { pace: 3, stand: 2, sit: 1, phone: 1, chat: 2 },
  },
  joker: {
    id: 'joker', name: 'Joker', text: 'Never serious for long. Cracks jokes in a fight and at home, winds the others up, relaxed about everything.',
    followDist: 1.4, engageRange: 8, targeting: 'nearest', retreatAt: 0.2, helpsCrew: false, chatty: 0.9, taunts: true,
    home: { chat: 4, sit: 2, tv: 2, kitchen: 2, phone: 1 },
  },
  loyal: {
    id: 'loyal', name: 'Loyal friend', text: 'Looks after you. Stays close, goes for whoever’s on you, helps a crew mate who’s gone down. Glad to be home.',
    followDist: 1.0, engageRange: 8, targeting: 'onPlayer', retreatAt: 0, helpsCrew: true, chatty: 0.5, taunts: false,
    home: { sit: 3, kitchen: 2, chat: 3, tv: 1 },
  },
  professional: {
    id: 'professional', name: 'Quiet professional', text: 'Says little, wastes nothing. Finishes off whoever’s weakest and keeps out of fights that aren’t hers.',
    followDist: 1.7, engageRange: 6.5, targeting: 'weakest', retreatAt: 0.25, helpsCrew: false, chatty: 0.15, taunts: false,
    home: { stretch: 3, sit: 2, phone: 2, stand: 1 },
  },
  heavy: {
    id: 'heavy', name: 'Heavy hitter', text: 'Big, confident, intimidating. Walks through people and expects them to fall over.',
    followDist: 1.5, engageRange: 9, targeting: 'nearest', retreatAt: 0, helpsCrew: false, chatty: 0.45, taunts: true,
    home: { sit: 4, tv: 3, kitchen: 2 },
  },
  fast: {
    id: 'fast', name: 'Fast fighter', text: 'Quick in everything. Darts in and out, never still for long, gets bored easily.',
    followDist: 1.4, engageRange: 9, targeting: 'weakest', retreatAt: 0.25, helpsCrew: false, chatty: 0.5, taunts: false,
    home: { stretch: 3, phone: 2, pace: 2, chat: 2, sit: 1 },
  },
  brawler: {
    id: 'brawler', name: 'Street brawler', text: 'Unpredictable. Fights dirty, mixes everything, never where you expect him.',
    followDist: 1.4, engageRange: 9, targeting: 'nearest', retreatAt: 0, helpsCrew: false, chatty: 0.55, taunts: true,
    home: { sit: 2, kitchen: 2, chat: 2, tv: 1, stand: 1 },
  },
  weapons: {
    id: 'weapons', name: 'Weapons specialist', text: 'Never comfortable empty-handed. Picks up anything useful in a fight and knows exactly how to use it.',
    followDist: 1.5, engageRange: 8, targeting: 'nearest', retreatAt: 0.25, helpsCrew: false, chatty: 0.35, taunts: false,
    home: { sit: 2, stand: 2, phone: 2, kitchen: 1 },
  },
};

// ---------------------------------------------------------------------------------------------------

export type FightStyleId = 'heavy_boxing' | 'technical_boxing' | 'kickboxing' | 'muay_thai' | 'wrestling' | 'grappling' | 'mma' | 'street' | 'counter' | 'combo' | 'weapons';

export interface FightStyle {
  id: FightStyleId;
  name: string;
  text: string;
  /** The game style whose moves they use. */
  moves: StyleId;
  /** Stat changes: speed of attacks, damage, movement, damage taken, poise (stagger resistance). */
  mods: { attackSpeed: number; damage: number; move: number; taken: number; poise: number };
  /** AI tuning on top of the companion's own. */
  ai: Partial<{ aggression: number; blockChance: number; dodgeChance: number; parryChance: number; range: number; comboLength: number; grabChance: number; specialChance: number; reactionFrames: number }>;
  /** Button habits: share of punches thrown as heavy, of attacks thrown as kicks (−1 = never kicks). */
  heavyBias: number;
  kickBias: number;
  /** Hits back straight after blocking or parrying. */
  counters: boolean;
  /** Damage with a weapon in hand; and empty-handed. */
  weaponMult: number;
  unarmedMult: number;
  /** Weapon kinds they're best with (others get half the bonus). */
  weaponClasses?: WeaponClass[];
}

const M = (attackSpeed: number, damage: number, move: number, taken: number, poise = 0) => ({ attackSpeed, damage, move, taken, poise });

export const FIGHT_STYLES: Record<FightStyleId, FightStyle> = {
  heavy_boxing: {
    id: 'heavy_boxing', name: 'Heavy boxing', text: 'Slow, heavy hooks and overhands that break guards. Hard to stagger, easy to see coming.',
    moves: 'boxing', mods: M(0.85, 1.22, 0.92, 0.92, 25), ai: { comboLength: 2, reactionFrames: 18, dodgeChance: 0.05 },
    heavyBias: 0.7, kickBias: -1, counters: false, weaponMult: 1, unarmedMult: 1,
  },
  technical_boxing: {
    id: 'technical_boxing', name: 'Technical boxing', text: 'Jab, slip, combinations. Lots of accurate shots, few big ones.',
    moves: 'boxing', mods: M(1.08, 0.95, 1.0, 1.0), ai: { comboLength: 4, dodgeChance: 0.25, parryChance: 0.1 },
    heavyBias: 0.25, kickBias: -1, counters: true, weaponMult: 1, unarmedMult: 1,
  },
  kickboxing: {
    id: 'kickboxing', name: 'Kickboxing', text: 'Long kicks and quick punches from range, always moving.',
    moves: 'kickboxing', mods: M(1.1, 0.92, 1.08, 1.05), ai: { range: 1.2, dodgeChance: 0.3, comboLength: 3 },
    heavyBias: 0.3, kickBias: 0.5, counters: false, weaponMult: 1, unarmedMult: 1,
  },
  muay_thai: {
    id: 'muay_thai', name: 'Muay Thai', text: 'Knees, elbows and the clinch. Brutal up close, punishing kicks.',
    moves: 'muay_thai', mods: M(0.98, 1.1, 1.0, 0.98, 10), ai: { grabChance: 0.18, comboLength: 3, range: 1.0 },
    heavyBias: 0.5, kickBias: 0.45, counters: false, weaponMult: 1, unarmedMult: 1,
  },
  wrestling: {
    id: 'wrestling', name: 'Wrestling', text: 'Shoots for takedowns and slams. Holds people for you. Clumsy on the feet.',
    moves: 'wrestling', mods: M(0.92, 1.05, 0.95, 0.95, 20), ai: { grabChance: 0.4, comboLength: 2, range: 0.85 },
    heavyBias: 0.4, kickBias: 0.1, counters: false, weaponMult: 0.9, unarmedMult: 1,
  },
  grappling: {
    id: 'grappling', name: 'Grappling', text: 'Takes it to the ground and finishes with submissions.',
    moves: 'bjj', mods: M(0.95, 1.0, 0.95, 0.97, 10), ai: { grabChance: 0.45, comboLength: 2 },
    heavyBias: 0.3, kickBias: 0.1, counters: false, weaponMult: 0.9, unarmedMult: 1,
  },
  mma: {
    id: 'mma', name: 'MMA', text: 'Strikes to set up takedowns, a bit of everything. No real weak spot, no real strength.',
    moves: 'kickboxing', mods: M(1.0, 1.0, 1.0, 1.0, 5), ai: { grabChance: 0.2, comboLength: 3 },
    heavyBias: 0.4, kickBias: 0.3, counters: false, weaponMult: 1, unarmedMult: 1,
  },
  street: {
    id: 'street', name: 'Street fighting', text: 'Dirty and unpredictable: punches, kicks, grabs and whatever’s to hand.',
    moves: 'street', mods: M(1.0, 1.04, 1.0, 1.02), ai: { grabChance: 0.15, comboLength: 3, aggression: 0.55 },
    heavyBias: 0.45, kickBias: 0.35, counters: false, weaponMult: 1.1, unarmedMult: 1,
  },
  counter: {
    id: 'counter', name: 'Defensive counter-fighting', text: 'Blocks, parries and makes you pay. Rarely leads, always answers.',
    moves: 'karate', mods: M(1.0, 0.95, 0.98, 0.85, 15), ai: { blockChance: 0.65, parryChance: 0.2, aggression: 0.25, comboLength: 2 },
    heavyBias: 0.35, kickBias: 0.3, counters: true, weaponMult: 1, unarmedMult: 1,
  },
  combo: {
    id: 'combo', name: 'Fast combinations', text: 'Strings of quick shots, in and out before they can answer. Each hit is light.',
    moves: 'boxing', mods: M(1.18, 0.85, 1.12, 1.1), ai: { comboLength: 5, dodgeChance: 0.35, reactionFrames: 9 },
    heavyBias: 0.15, kickBias: 0.35, counters: false, weaponMult: 1, unarmedMult: 1,
  },
  weapons: {
    id: 'weapons', name: 'Weapons', text: 'Deadly with a bat, bar or pipe in hand; ordinary without one. Picks weapons up in fights.',
    moves: 'street', mods: M(1.0, 1.0, 1.0, 1.0), ai: { comboLength: 2, range: 1.1 },
    heavyBias: 0.5, kickBias: 0.1, counters: false, weaponMult: 1.35, unarmedMult: 0.82, weaponClasses: ['blunt', 'long', 'heavy'],
  },
};

/** Damage multiplier for what's in their hands right now. */
export function weaponDamageFor(style: FightStyle, weaponClass: WeaponClass | null): number {
  if (!weaponClass) return style.unarmedMult;
  if (!style.weaponClasses || style.weaponClasses.includes(weaponClass)) return style.weaponMult;
  return 1 + (style.weaponMult - 1) / 2;
}

// ---- what they say ---------------------------------------------------------------------------------

export type LineKind = 'fight' | 'taunt' | 'hurt' | 'win' | 'down' | 'home' | 'idle' | 'joke' | 'reply_laugh' | 'reply_ignore' | 'reply_annoyed' | 'reply_join' | 'story';

const LINES: Record<PersonalityId, Partial<Record<LineKind, string[]>>> = {
  aggressive: {
    fight: ['Come on then!', 'Who’s first?', 'Let’s have it.'],
    taunt: ['That all you’ve got?', 'Get up. I’m not done.', 'You picked the wrong street.'],
    win: ['Next.', 'Easy.', 'Anyone else?'],
    hurt: ['Is that it?'],
    home: ['Could do with a proper scrap.', 'Bored already.'],
    reply_annoyed: ['Not funny.', 'Get to the point.', 'Do one.'],
    story: ['I put a doorman through a window once. He started it.'],
  },
  veteran: {
    fight: ['Easy now. Pick your moment.', 'Steady.'],
    win: ['Done.', 'That’ll do.'],
    hurt: ['I’ve had worse.'],
    home: ['Kettle on?', 'Good to sit down.'],
    reply_ignore: ['…', 'Mm.'],
    reply_laugh: ['Heh.'],
    story: ['Back in ’89 this whole street was ours.', 'Never trust a man who doesn’t sweat.'],
  },
  hothead: {
    fight: ['Right, that’s it!', 'You want some?!'],
    taunt: ['Come here!', 'Say that again!', 'Look at me when I’m hitting you!'],
    win: ['Yeah! Who else?!', 'Stay down!'],
    hurt: ['Oi!', 'You’re dead!'],
    home: ['How long are we sat here for?', 'I need to hit something.'],
    reply_annoyed: ['Shut it.', 'Is that meant to be a joke?', 'Wind your neck in.'],
    story: ['Got barred from three Wetherspoons in one night. Record.'],
  },
  joker: {
    fight: ['Ooh, party.', 'Mind the hair, lads.'],
    taunt: ['Your mum fights better.', 'Is that a punch or a wave?'],
    win: ['And the crowd goes wild.', 'Tidy.'],
    hurt: ['Ow. Rude.'],
    home: ['Who ate my Pot Noodle?', 'Anyone seen the remote?'],
    joke: ['Why did the bouncer go to school? To learn his ABCs. Allegedly.', 'I’d tell you a joke about a bin, but it’s rubbish.', 'Two pigeons walk into a Greggs…', 'My nan hits harder than that lot. She’s ninety.'],
    reply_laugh: ['Ha! Classic.', 'Stop it.'],
    story: ['I once got chased by a goose round Hollins Park. Lost.'],
  },
  loyal: {
    fight: ['I’ve got your back.', 'Stay close.'],
    win: ['You alright?', 'Good work.'],
    hurt: ['I’m fine, keep going.'],
    down: ['Hang on, I’m coming!'],
    home: ['Nice to be home.', 'Want a brew?'],
    reply_laugh: ['Ha! Go on then.', 'That’s terrible. Love it.'],
    reply_join: ['Tell them the one about the taxi.'],
    story: ['Known this lot since school. Wouldn’t swap them.'],
  },
  professional: {
    fight: ['Moving.'],
    win: ['Clear.'],
    home: ['…'],
    reply_ignore: ['…', 'No.'],
    story: ['Train every morning. Six sharp.'],
  },
  heavy: {
    fight: ['Out of the way.', 'Stand still, this won’t take long.'],
    taunt: ['I barely touched you.', 'Timber.'],
    win: ['Lights out.', 'Who’s next?'],
    hurt: ['Tickles.'],
    home: ['Where’s the biggest chair?', 'Telly on.'],
    reply_laugh: ['Hah! Good one.'],
    reply_annoyed: ['Keep it down, I’m watching this.'],
    story: ['Lifted a car off a bloke once. Well, a Micra.'],
  },
  fast: {
    fight: ['Too slow!', 'Catch me.'],
    win: ['Blink and you missed it.'],
    hurt: ['Lucky.'],
    home: ['Anyone fancy a run?', 'Can’t sit still.'],
    reply_laugh: ['Ha!'],
    reply_join: ['Wait, I’ve got a better one.'],
    story: ['Ran the Leisure Park 10k in thirty-nine minutes. In trainers from the market.'],
  },
  brawler: {
    fight: ['Let’s make a mess.', 'Here we go!'],
    taunt: ['Pick that up and I’ll hit you with it.'],
    win: ['Proper.', 'Bang.'],
    hurt: ['Dirty. I like it.'],
    home: ['What’s in the fridge?'],
    reply_laugh: ['Hahaha!', 'You’re not right, you.'],
    reply_join: ['Nah listen, listen…'],
    story: ['Fought a bloke in a chippy queue once. Over vinegar.'],
  },
  weapons: {
    fight: ['Anyone see a bat lying about?', 'Find me something heavy.'],
    win: ['Tools for the job.'],
    hurt: ['Should’ve had a bar.'],
    home: ['Someone’s left a perfectly good pipe in the garage.'],
    reply_ignore: ['Mm.'],
    reply_laugh: ['Ha.'],
    story: ['A good bat’s like a good pair of shoes. Look after it.'],
  },
};

/** A line for the moment, or null if they've nothing to say. Picks with the given random number. */
export function lineFor(p: PersonalityId, kind: LineKind, r: number): string | null {
  const list = LINES[p][kind];
  if (!list?.length) return null;
  return list[Math.floor(r * list.length) % list.length];
}

/** How someone reacts to a joke (or a story), by personality. */
export function replyKind(listener: PersonalityId): LineKind | null {
  switch (listener) {
    case 'veteran':
    case 'professional':
    case 'weapons':
      return 'reply_ignore';
    case 'aggressive':
    case 'hothead':
      return 'reply_annoyed';
    case 'loyal':
    case 'fast':
    case 'brawler':
      return 'reply_join';
    default:
      return 'reply_laugh';
  }
}
