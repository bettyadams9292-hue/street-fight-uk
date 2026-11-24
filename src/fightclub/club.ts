/**
 * The Arches: an unlicensed fight club in the cellar under Kane's Boxing, Canal Side Works.
 *
 * Opens once you've beaten Sully Kane (`CLUB_FLAG`): the old champ tells you where the real money is.
 *
 * - **The ladder.** Six ranked fighters (`LADDER`), bottom to top. You fight the one above you: a buy-in on the
 *   way in (lost if you lose), the purse if you win, and you take their place. One fight a night (`NIGHT_SECONDS`
 *   of play), win or lose (`foughtTonight`).
 * - **The title.** Beat the top contender and you get a shot at the champion (`CHAMPION`). Win it and you're the
 *   champ: a big purse and the belt (`BELT`), yours to keep, the only one in the game.
 * - **Defending it.** Every `DEFENCE_TRIPS` nights a challenger is ready (`challenger`), harder each time and keeping
 *   up with you, for a bigger purse each defence (`defencePurse`). Lose and the challenger takes the title: win it
 *   back off them (a rematch). Leave a challenger waiting `STRIP_TRIPS` nights past the date and they strip you
 *   (`clubTick`).
 *
 * Fights are to the stoppage, one on one in the pit: no weapons, nobody jumps in, and the doctor patches you up
 * after. Numbers and save state only; World runs the fight, ui/fightClubUI.ts the screen.
 */
import type { ArchetypeId } from '../ai/archetypes';
import type { Progress } from '../progress/Progress';
import type { StyleId } from '../styles/StyleData';

export const CLUB_FLAG = 'boss_sully';
/**
 * The club's clock: a night is this much play time (`save.playTime`, seconds actually played), not a trip, so
 * walking out and back in doesn't bring the next fight round.
 */
export const NIGHT_SECONDS = 600;
/** A defence is due this many nights after the last title fight. */
export const DEFENCE_TRIPS = 3;
/** Left waiting this many nights past the date, the challenger gets the belt by default. */
export const STRIP_TRIPS = 6;

/** Which night it is. */
export function nightOf(p: Progress): number {
  return Math.floor((p.save.playTime ?? 0) / NIGHT_SECONDS);
}
/** The buy-in, as a share of the purse. */
export const BUY_IN = 0.2;

export interface ClubFighter {
  id: string;
  /** "First \"Nick\" Last". */
  name: string;
  /** What goes over their head. */
  nick: string;
  arch: ArchetypeId;
  style: StyleId;
  body: 'male' | 'female';
  /** Every attribute, flat (the player starts about 5–7 and Sully Kane is about 10–11). */
  attr: number;
  /** Health over the archetype's. */
  health: number;
  purse: number;
  /** What the promoter says about them. */
  blurb: string;
  /** What they say as they square up. */
  line: string;
}

const F = (id: string, first: string, nick: string, last: string, arch: ArchetypeId, style: StyleId, body: 'male' | 'female', attr: number, health: number, purse: number, blurb: string, line: string): ClubFighter => ({
  id, name: `${first} “${nick}” ${last}`, nick, arch, style, body, attr, health, purse, blurb, line,
});

/** Bottom of the card first. */
export const LADDER: readonly ClubFighter[] = [
  F('moss', 'Dean', 'Dazzler', 'Moss', 'thug', 'street', 'male', 8, 40, 150, 'Big mouth, wild swings. Everybody’s first fight down here.', 'Fresh meat!'),
  F('price', 'Tommo', 'The Tank', 'Price', 'bruiser', 'street', 'male', 9, 70, 220, 'Twenty stone off a building site. Hits like a skip falling on you.', 'I’ll fold you in half.'),
  F('chan', 'Lee', 'Lightning', 'Chan', 'kickboxer', 'kickboxing', 'male', 9, 70, 320, 'Fast feet, faster legs. Keep him off the end of them or go to sleep.', 'You won’t see it coming.'),
  F('byrne', 'Kelly', 'The Sister', 'Byrne', 'boxer', 'boxing', 'female', 10, 90, 450, 'Southpaw out of Moss Side. Nobody’s laughed at her twice.', 'Go on then, big man.'),
  F('riley', 'Gaz', 'Two Dogs', 'Riley', 'grappler', 'wrestling', 'male', 10, 110, 600, 'Ex-army, all clinch and floor. He’ll have you on the concrete.', 'Floor’s cold, this.'),
  F('dragan', 'Viktor', 'The Butcher', 'Dragan', 'rival', 'muay_thai', 'male', 11, 130, 800, 'Number one contender. Elbows and knees, and he never stops coming.', 'Is your last night.'),
];

/** The man with the belt when you walk in. */
export const CHAMPION: ClubFighter = F('doherty', 'Mick', 'Iron', 'Doherty', 'elite', 'boxing', 'male', 12, 180, 3000, 'The champion. Eleven defences, never been put down. Sully trained him, before the drink.', 'Eleven of you I’ve sent home. You’re twelve.');

/** The title fight's purse, and a rematch's when someone's taken it off you. */
export const TITLE_PURSE = CHAMPION.purse;
export const REMATCH_PURSE = 2500;
/** A defence pays this, and more every time you keep it. */
export const DEFENCE_BASE = 1000;
export const DEFENCE_STEP = 400;
export const DEFENCE_MAX = 5000;

/** The champion's belt: only ever won here, the first time you take the title. */
export const BELT = 'title_belt';

/** Who comes for your belt, in turn (and round again, harder). */
const CHALLENGERS: readonly [string, string, string, ArchetypeId, StyleId, 'male' | 'female', string][] = [
  ['Ricky', 'The Rocket', 'Shaw', 'boxer', 'boxing', 'male', 'You’ve had it easy. That stops tonight.'],
  ['Shona', 'Hurricane', 'McBride', 'kickboxer', 'kickboxing', 'female', 'Glasgow says hello.'],
  ['Ade', 'The Wall', 'Okoro', 'bruiser', 'street', 'male', 'Hit me. Go on. Hit me.'],
  ['Bartosz', 'The Bear', 'Wozniak', 'grappler', 'wrestling', 'male', 'I take belt home to Gdańsk.'],
  ['Jamal', 'Smooth', 'Reid', 'rival', 'muay_thai', 'male', 'Nice belt. Mine now.'],
  ['Connor', 'Mad Dog', 'Flynn', 'elite', 'kickboxing', 'male', 'I’ve been waiting a year for this.'],
  ['Tasha', 'Venom', 'Grant', 'boxer', 'boxing', 'female', 'They told me you were good.'],
  ['Kofi', 'The Hammer', 'Mensah', 'elite', 'boxing', 'male', 'One punch. That’s all it takes.'],
];

export interface ClubSave {
  /** Rungs climbed: 0 to LADDER.length (then the title shot). */
  rank: number;
  /** You hold the belt now. */
  champion: boolean;
  /** You've won the title at least once (the belt's been given). */
  everChamp: boolean;
  /** Title fights won since you first took it. */
  defences: number;
  /** The night the next defence is due (null when you're not the champ; `nightOf`). */
  due: number | null;
  /** Who has the title when it isn't you, after you've held it: a challenger who beat you (or was given it). */
  holder: number | null;
  /** The night of your last fight here: one a night (`nightOf`). */
  lastTrip: number;
  wins: number;
  losses: number;
  earned: number;
  /** Sully's told you about the place. */
  told: boolean;
}

export function newClub(): ClubSave {
  return { rank: 0, champion: false, everChamp: false, defences: 0, due: null, holder: null, lastTrip: -1, wins: 0, losses: 0, earned: 0, told: false };
}

const num = (v: unknown, d = 0, lo = 0, hi = 1e9) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d);

export function sanitiseClub(r: unknown): ClubSave {
  const out = newClub();
  if (!r || typeof r !== 'object') return out;
  const x = r as Partial<ClubSave>;
  out.rank = Math.floor(num(x.rank, 0, 0, LADDER.length));
  out.champion = x.champion === true;
  out.everChamp = x.everChamp === true || out.champion;
  out.defences = Math.floor(num(x.defences));
  out.due = out.champion ? Math.floor(num(x.due, 0, -1)) : null;
  out.holder = out.champion || x.holder === null || x.holder === undefined ? null : Math.floor(num(x.holder, 0, 0, 1e6));
  out.lastTrip = Math.floor(num(x.lastTrip, -1, -1));
  out.wins = Math.floor(num(x.wins));
  out.losses = Math.floor(num(x.losses));
  out.earned = Math.floor(num(x.earned));
  out.told = x.told === true;
  return out;
}

export function clubOpen(p: Progress): boolean {
  return p.has(CLUB_FLAG);
}

/** A challenger, by number (they come round again, a bit harder each lap). */
export function challenger(n: number, level: number): ClubFighter {
  const [first, nick, last, arch, style, body, line] = CHALLENGERS[n % CHALLENGERS.length];
  const lap = Math.floor(n / CHALLENGERS.length);
  // Harder every defence, and never far behind you as you level up.
  const attr = Math.min(22, Math.max(12 + Math.min(6, n) + lap, 8 + Math.floor(level / 3)));
  const health = Math.min(420, 180 + n * 20 + lap * 40);
  return F(`challenger${n}`, first, nick, last, arch, style, body, attr, health, defencePurse(n), `Challenger number ${n + 1}. ${body === 'female' ? 'She' : 'He'}’s come a long way for your belt.`, line);
}

export function defencePurse(defences: number): number {
  return Math.min(DEFENCE_MAX, DEFENCE_BASE + DEFENCE_STEP * defences);
}

/** Time passing: a champion who keeps a challenger waiting too long is stripped. Call on reading the club. */
export function clubTick(p: Progress): { stripped: boolean } {
  const c = p.save.club;
  if (c.champion && c.due !== null && nightOf(p) > c.due + STRIP_TRIPS) {
    c.champion = false;
    c.holder = c.defences;
    c.due = null;
    return { stripped: true };
  }
  return { stripped: false };
}

export type Bout =
  | { kind: 'ladder'; rank: number; who: ClubFighter }
  | { kind: 'title'; who: ClubFighter; rematch: boolean }
  | { kind: 'defence'; who: ClubFighter; n: number };

/** The next fight on your card, or null when there's nothing for you (a champ between defences). */
export function nextBout(p: Progress): Bout | null {
  const c = p.save.club;
  if (c.champion) {
    if (c.due !== null && nightOf(p) >= c.due) return { kind: 'defence', who: challenger(c.defences, p.save.level), n: c.defences };
    return null;
  }
  if (c.rank < LADDER.length) return { kind: 'ladder', rank: c.rank, who: LADDER[c.rank] };
  // Title shot: the champion, or whoever took the belt off you.
  if (c.holder !== null) {
    const who = challenger(c.holder, p.save.level);
    return { kind: 'title', who: { ...who, purse: REMATCH_PURSE, blurb: `${who.name} took your belt. Get it back.` }, rematch: true };
  }
  return { kind: 'title', who: CHAMPION, rematch: false };
}

export function purseOf(b: Bout): number {
  return b.kind === 'title' ? b.who.purse : b.kind === 'defence' ? defencePurse(b.n) : b.who.purse;
}

/** The buy-in for a fight: the champ doesn't pay to defend. */
export function buyInOf(b: Bout): number {
  return b.kind === 'defence' ? 0 : Math.round(purseOf(b) * BUY_IN);
}

/** One fight a night. */
export function foughtTonight(p: Progress): boolean {
  return p.save.club.lastTrip === nightOf(p);
}

/** Can you take this fight now? A reason if not. */
export function canFight(p: Progress, b: Bout): { ok: true } | { ok: false; reason: string } {
  if (foughtTonight(p)) return { ok: false, reason: `You’ve had your fight tonight. Come back in about ${Math.ceil((NIGHT_SECONDS - ((p.save.playTime ?? 0) % NIGHT_SECONDS)) / 60)} minutes.` };
  const buy = buyInOf(b);
  if (buy > 0 && p.save.cash.pocket + p.save.cash.bank < buy) return { ok: false, reason: `The buy-in’s £${buy}. You haven’t got it.` };
  return { ok: true };
}

/** Pay in (the buy-in) and mark tonight's fight taken. False if you can't. */
export function enterBout(p: Progress, b: Bout): boolean {
  if (!canFight(p, b).ok) return false;
  const buy = buyInOf(b);
  if (buy > 0 && !p.pay(buy)) return false;
  p.save.club.lastTrip = nightOf(p);
  return true;
}

export interface BoutResult {
  won: boolean;
  /** The purse paid (0 on a loss). */
  purse: number;
  xp: number;
  /** Took the title tonight. */
  crowned: boolean;
  /** The belt was given (the first title win only). */
  belt: boolean;
  /** Lost the title tonight. */
  lostTitle: boolean;
  /** What to tell the player. */
  text: string;
}

/** XP for a fight here, win or lose (a loss still teaches you something). */
export function boutXp(b: Bout, won: boolean): number {
  const base = b.kind === 'ladder' ? 120 + b.rank * 40 : b.kind === 'title' ? 600 : 400 + Math.min(10, b.n) * 40;
  return won ? base : Math.round(base * 0.25);
}

/**
 * The result of a fight: pay out, move up, take or lose the title, give the belt. Cash goes in your pocket
 * (`Progress.addCash`); XP is left to the caller (it levels the fighter up). The belt goes in your pockets, or
 * the stash at home if they're full.
 */
export function settleBout(p: Progress, b: Bout, won: boolean): BoutResult {
  const c = p.save.club;
  const xp = boutXp(b, won);
  const out: BoutResult = { won, purse: 0, xp, crowned: false, belt: false, lostTitle: false, text: '' };
  if (won) c.wins++;
  else c.losses++;
  if (!won) {
    if (b.kind === 'defence') {
      c.champion = false;
      c.holder = b.n;
      c.due = null;
      out.lostTitle = true;
      out.text = `${b.who.name} takes your belt. Win it back off ${b.who.body === 'female' ? 'her' : 'him'}: there’s a rematch whenever you want it.`;
    } else out.text = b.kind === 'ladder' ? `${b.who.nick} beat you. The buy-in’s gone. Come back another night.` : `Not tonight. ${b.who.name} keeps the belt.`;
    return out;
  }
  out.purse = purseOf(b);
  c.earned += out.purse;
  p.addCash(out.purse);
  if (b.kind === 'ladder') {
    c.rank = Math.max(c.rank, b.rank + 1);
    out.text = c.rank >= LADDER.length
      ? `${b.who.nick} is down. You’re the number one contender: next time it’s for the title.`
      : `${b.who.nick} is down. £${out.purse} purse, and you’re up to number ${LADDER.length - c.rank} on the card.`;
    return out;
  }
  if (b.kind === 'title') {
    c.champion = true;
    c.holder = null;
    c.due = nightOf(p) + DEFENCE_TRIPS;
    out.crowned = true;
    if (!c.everChamp) {
      c.everChamp = true;
      out.belt = true;
      const left = p.giveItem(BELT);
      if (left) p.save.storage.push(left);
    }
    out.text = out.belt
      ? `CHAMPION. £${out.purse} and the Arches belt: nobody else has one. Defend it every few nights for the big purses.`
      : `The belt’s back where it belongs. £${out.purse}. Defend it every few nights.`;
    return out;
  }
  c.defences++;
  c.due = nightOf(p) + DEFENCE_TRIPS;
  out.text = `Still the champ: defence number ${c.defences}. £${out.purse}. The next challenger wants it in ${DEFENCE_TRIPS} nights, for £${defencePurse(c.defences)}.`;
  return out;
}

/** Where you stand, in a line. */
export function standing(p: Progress): string {
  const c = p.save.club;
  if (c.champion) {
    const left = (c.due ?? 0) - nightOf(p);
    return `Champion · ${c.defences} defence${c.defences === 1 ? '' : 's'} · ${left > 0 ? `next challenger in ${left} night${left === 1 ? '' : 's'}` : 'a challenger is waiting'}`;
  }
  if (c.rank >= LADDER.length) return 'Number one contender: a title shot is yours';
  if (c.rank === 0) return 'Unranked';
  return `Number ${LADDER.length - c.rank + 1} on the card`;
}
