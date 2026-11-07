import type { Progress } from '../progress/Progress';
import { BIKES, CARS, GARAGE_SPACES, MAX_CARS } from './catalogue';
import { addBike, addCar } from './state';

/**
 * The Golden Lion casino. Everything is played with the game's own pounds:
 * stakes come out of your pocket first, then the tin; winnings go in your pocket.
 * Every game takes an rng so the tests can stack the deck.
 */

export type Rng = () => number;

export const SLOT_BETS = [5, 10, 25, 50];
export const TABLE_BETS = [10, 25, 50, 100, 250];

function stake(p: Progress, amount: number): boolean {
  if (amount <= 0 || !p.pay(amount)) return false;
  const c = p.save.property.casino;
  c.staked += amount;
  c.plays++;
  return true;
}

function payout(p: Progress, amount: number): void {
  if (amount <= 0) return;
  p.save.cash.pocket += amount;
  const c = p.save.property.casino;
  c.won += amount;
  c.biggestWin = Math.max(c.biggestWin, amount);
}

// ---- slots -----------------------------------------------------------------------------------

export const SLOT_SYMBOLS = ['🍒', '🍋', '🔔', '⭐', '7', '💎'] as const;
export type SlotSymbol = (typeof SLOT_SYMBOLS)[number];
/** How often each symbol lands (out of the total). */
const SLOT_WEIGHTS: Record<SlotSymbol, number> = { '🍒': 30, '🍋': 26, '🔔': 18, '⭐': 13, '7': 8, '💎': 5 };
/** Three of a kind pays this many times the bet. */
export const SLOT_PAYS: Record<SlotSymbol, number> = { '🍒': 5, '🍋': 8, '🔔': 12, '⭐': 20, '7': 50, '💎': 100 };

function spinReel(rng: Rng): SlotSymbol {
  const total = Object.values(SLOT_WEIGHTS).reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (const s of SLOT_SYMBOLS) {
    r -= SLOT_WEIGHTS[s];
    if (r < 0) return s;
  }
  return '🍒';
}

/** What a line pays (times the bet): three of a kind, or any two cherries. */
export function slotMultiplier(reels: SlotSymbol[]): number {
  if (reels[0] === reels[1] && reels[1] === reels[2]) return SLOT_PAYS[reels[0]];
  const cherries = reels.filter((r) => r === '🍒').length;
  return cherries === 2 ? 2 : 0;
}

export type GameResult<T> = { ok: true; win: number; detail: T } | { ok: false; reason: string };

export function playSlots(p: Progress, bet: number, rng: Rng = Math.random): GameResult<{ reels: SlotSymbol[] }> {
  if (!SLOT_BETS.includes(bet)) return { ok: false, reason: 'Pick a stake' };
  if (!stake(p, bet)) return { ok: false, reason: `Need £${bet}` };
  const reels = [spinReel(rng), spinReel(rng), spinReel(rng)];
  const win = bet * slotMultiplier(reels);
  payout(p, win);
  return { ok: true, win, detail: { reels } };
}

// ---- roulette (single zero) -----------------------------------------------------------------------

const REDS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
export const rouletteColour = (n: number): 'red' | 'black' | 'green' => (n === 0 ? 'green' : REDS.has(n) ? 'red' : 'black');

export type RouletteBet =
  | { kind: 'red' | 'black' | 'odd' | 'even' | 'low' | 'high' }
  | { kind: 'dozen'; dozen: 1 | 2 | 3 }
  | { kind: 'number'; number: number };

/** Returns the total returned (stake plus winnings), 0 if it lost. */
export function rouletteReturn(bet: RouletteBet, n: number, stakeAmt: number): number {
  if (n === 0) return bet.kind === 'number' && bet.number === 0 ? stakeAmt * 36 : 0;
  switch (bet.kind) {
    case 'red':
      return REDS.has(n) ? stakeAmt * 2 : 0;
    case 'black':
      return !REDS.has(n) ? stakeAmt * 2 : 0;
    case 'odd':
      return n % 2 === 1 ? stakeAmt * 2 : 0;
    case 'even':
      return n % 2 === 0 ? stakeAmt * 2 : 0;
    case 'low':
      return n <= 18 ? stakeAmt * 2 : 0;
    case 'high':
      return n >= 19 ? stakeAmt * 2 : 0;
    case 'dozen':
      return Math.ceil(n / 12) === bet.dozen ? stakeAmt * 3 : 0;
    case 'number':
      return bet.number === n ? stakeAmt * 36 : 0;
  }
}

export function playRoulette(p: Progress, bet: RouletteBet, amount: number, rng: Rng = Math.random): GameResult<{ number: number; colour: string }> {
  if (!TABLE_BETS.includes(amount)) return { ok: false, reason: 'Pick a stake' };
  if (bet.kind === 'number' && !(Number.isInteger(bet.number) && bet.number >= 0 && bet.number <= 36)) return { ok: false, reason: 'Pick a number 0 to 36' };
  if (!stake(p, amount)) return { ok: false, reason: `Need £${amount}` };
  const n = Math.min(36, Math.floor(rng() * 37));
  const win = rouletteReturn(bet, n, amount);
  payout(p, win);
  return { ok: true, win, detail: { number: n, colour: rouletteColour(n) } };
}

// ---- blackjack ------------------------------------------------------------------------------------

export interface Card {
  rank: 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';
  suit: '♠' | '♥' | '♦' | '♣';
}
const RANKS: Card['rank'][] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SUITS: Card['suit'][] = ['♠', '♥', '♦', '♣'];

export function handValue(cards: Card[]): { total: number; soft: boolean } {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    if (c.rank === 'A') {
      aces++;
      total += 11;
    } else total += ['J', 'Q', 'K'].includes(c.rank) ? 10 : Number(c.rank);
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return { total, soft: aces > 0 };
}

export const isBlackjack = (cards: Card[]) => cards.length === 2 && handValue(cards).total === 21;

export interface BlackjackHand {
  bet: number;
  deck: Card[];
  player: Card[];
  dealer: Card[];
  doubled: boolean;
  done: boolean;
  /** What happened, once done. */
  outcome: 'blackjack' | 'win' | 'push' | 'lose' | 'bust' | null;
  win: number;
}

function shuffled(rng: Rng): Card[] {
  const deck: Card[] = [];
  for (let d = 0; d < 4; d++) for (const s of SUITS) for (const r of RANKS) deck.push({ rank: r, suit: s });
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

/** Deal a new hand. A natural blackjack settles straight away (pays 3 to 2). */
export function dealBlackjack(p: Progress, bet: number, rng: Rng = Math.random, deck?: Card[]): GameResult<BlackjackHand> {
  if (!TABLE_BETS.includes(bet)) return { ok: false, reason: 'Pick a stake' };
  if (!stake(p, bet)) return { ok: false, reason: `Need £${bet}` };
  const d = deck ? [...deck] : shuffled(rng);
  const hand: BlackjackHand = { bet, deck: d, player: [d.pop()!, d.pop()!], dealer: [d.pop()!, d.pop()!], doubled: false, done: false, outcome: null, win: 0 };
  if (isBlackjack(hand.player) || isBlackjack(hand.dealer)) settle(p, hand);
  return { ok: true, win: hand.win, detail: hand };
}

export function hit(p: Progress, hand: BlackjackHand): BlackjackHand {
  if (hand.done) return hand;
  hand.player.push(hand.deck.pop()!);
  if (handValue(hand.player).total > 21) settle(p, hand);
  return hand;
}

export function stand(p: Progress, hand: BlackjackHand): BlackjackHand {
  if (hand.done) return hand;
  // Dealer draws to 17 and stands on all 17s.
  while (handValue(hand.dealer).total < 17) hand.dealer.push(hand.deck.pop()!);
  settle(p, hand);
  return hand;
}

/** Double the stake, take exactly one more card, then stand. */
export function doubleDown(p: Progress, hand: BlackjackHand): { ok: true; hand: BlackjackHand } | { ok: false; reason: string } {
  if (hand.done || hand.player.length !== 2) return { ok: false, reason: 'You can only double on your first two cards' };
  if (!p.pay(hand.bet)) return { ok: false, reason: `Need another £${hand.bet}` };
  p.save.property.casino.staked += hand.bet;
  hand.bet *= 2;
  hand.doubled = true;
  hand.player.push(hand.deck.pop()!);
  if (handValue(hand.player).total > 21) settle(p, hand);
  else stand(p, hand);
  return { ok: true, hand };
}

function settle(p: Progress, hand: BlackjackHand): void {
  const pv = handValue(hand.player).total;
  const dv = handValue(hand.dealer).total;
  const pbj = isBlackjack(hand.player) && !hand.doubled;
  const dbj = isBlackjack(hand.dealer);
  let win = 0;
  if (pv > 21) hand.outcome = 'bust';
  else if (pbj && !dbj) {
    hand.outcome = 'blackjack';
    win = hand.bet + Math.floor(hand.bet * 1.5);
  } else if (pbj && dbj) {
    hand.outcome = 'push';
    win = hand.bet;
  } else if (dbj) hand.outcome = 'lose';
  else if (dv > 21 || pv > dv) {
    hand.outcome = 'win';
    win = hand.bet * 2;
  } else if (pv === dv) {
    hand.outcome = 'push';
    win = hand.bet;
  } else hand.outcome = 'lose';
  hand.done = true;
  hand.win = win;
  payout(p, win);
}

// ---- prize draw and vehicle competition ----------------------------------------------------------

export const DRAW_TICKET = 10;
export const COMP_TICKET = 50;
/** One in this many competition tickets wins the motor. */
export const COMP_ODDS = 40;

/** Cash prizes in the prize draw (weights out of 100; the rest is "no prize"). */
export const DRAW_PRIZES = [
  { cash: 250, weight: 2 },
  { cash: 100, weight: 5 },
  { cash: 50, weight: 9 },
  { cash: 20, weight: 18 },
  { cash: 10, weight: 20 },
];

export function playPrizeDraw(p: Progress, rng: Rng = Math.random): GameResult<{ prize: number }> {
  if (!stake(p, DRAW_TICKET)) return { ok: false, reason: `Need £${DRAW_TICKET}` };
  let r = rng() * 100;
  let prize = 0;
  for (const d of DRAW_PRIZES) {
    r -= d.weight;
    if (r < 0) {
      prize = d.cash;
      break;
    }
  }
  payout(p, prize);
  return { ok: true, win: prize, detail: { prize } };
}

/** The motor on the podium this week: changes every few trips. Alternates cars and bikes. */
export const COMP_PRIZES: { kind: 'car' | 'bike'; id: string; colour: string }[] = [
  { kind: 'car', id: 'vixen', colour: '#c82a2a' },
  { kind: 'bike', id: 'mx450f', colour: '#c82a2a' },
  { kind: 'car', id: 'sovereign', colour: '#1a1a1a' },
  { kind: 'bike', id: 'factory450', colour: '#e86a10' },
  { kind: 'car', id: 'hornet', colour: '#1f4fa8' },
  { kind: 'car', id: 'phantom', colour: '#e8c020' },
];

export function compPrize(trips: number) {
  return COMP_PRIZES[Math.floor(trips / 5) % COMP_PRIZES.length];
}

export function prizeName(pr: { kind: 'car' | 'bike'; id: string }): string {
  return pr.kind === 'car' ? CARS[pr.id].name : BIKES[pr.id].name;
}

export function prizeValue(pr: { kind: 'car' | 'bike'; id: string }): number {
  return pr.kind === 'car' ? CARS[pr.id].price : BIKES[pr.id].price;
}

/**
 * A competition ticket. Win and the motor's yours: cars park outside the
 * house, bikes go in the garage. No room? You get its value in cash instead.
 */
export function playCompetition(p: Progress, rng: Rng = Math.random): GameResult<{ won: boolean; prize: string; cashInstead: boolean }> {
  const prize = compPrize(p.save.trips);
  if (!stake(p, COMP_TICKET)) return { ok: false, reason: `Need £${COMP_TICKET}` };
  const won = Math.floor(rng() * COMP_ODDS) === 0;
  if (!won) return { ok: true, win: 0, detail: { won: false, prize: prizeName(prize), cashInstead: false } };
  const prop = p.save.property;
  const full = prize.kind === 'car' ? prop.cars.length >= MAX_CARS : prop.bikes.length >= GARAGE_SPACES;
  if (full) {
    const value = prizeValue(prize);
    payout(p, value);
    return { ok: true, win: value, detail: { won: true, prize: prizeName(prize), cashInstead: true } };
  }
  if (prize.kind === 'car') addCar(p, prize.id, prize.colour, 'won');
  else addBike(p, prize.id, prize.colour, 'won');
  prop.casino.prizes.push(prize.id);
  prop.casino.biggestWin = Math.max(prop.casino.biggestWin, prizeValue(prize));
  return { ok: true, win: 0, detail: { won: true, prize: prizeName(prize), cashInstead: false } };
}
