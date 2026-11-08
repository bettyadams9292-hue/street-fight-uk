import type { Progress, PurchaseResult } from '../progress/Progress';
import { STYLE_LESSONS } from '../progress/catalogue';
import type { AttackButton } from '../input/Commands';
import { getStyle } from '../data/styles';
import type { StyleId } from '../styles/StyleData';
import { STYLE_IDS } from '../styles/StyleData';
import { currentFatigue, FATIGUE_LIMIT } from './gym';

/**
 * Fighting gyms: where styles and their techniques are learned. Separate
 * from the home gym (which builds your body): here you learn moves.
 *
 * Each style has five ranks:
 *   1  learned: the style's moves, two-hit strings and its defence
 *   2  its special moves
 *   3  its full combo strings (three hits and more)
 *   4  +5% damage with it
 *   5  mastery: another +5%
 * Rank 3 in any style also gives +1 Technique for cross-training (up to +4),
 * so learning several disciplines pays.
 */

export interface FightGym {
  id: 'boxing_gym' | 'karate_dojo' | 'wrestling_club';
  name: string;
  coach: string;
  styles: StyleId[];
  blurb: string;
}

export const FIGHT_GYMS: FightGym[] = [
  { id: 'boxing_gym', name: 'Del’s Boxing Club', coach: 'Coach Del', styles: ['boxing', 'kickboxing'], blurb: 'Old-school amateur club behind the estate garages. Hands, feet, and no excuses.' },
  { id: 'karate_dojo', name: 'Okafor Karate & Muay Thai', coach: 'Mrs Okafor', styles: ['karate', 'muay_thai'], blurb: 'In the leisure centre. Discipline, distance, and very hard shins.' },
  { id: 'wrestling_club', name: 'Kev’s Wrestling & Grappling', coach: 'Big Kev', styles: ['wrestling', 'bjj'], blurb: 'Above the old shop unit in Kingsway Precinct. Takedowns, scrambles, submissions.' },
];
export const GYM_OF_STYLE: Partial<Record<StyleId, FightGym>> = Object.fromEntries(FIGHT_GYMS.flatMap((g) => g.styles.map((s) => [s, g])));

export const MAX_STYLE_RANK = 5;
/** Drill XP needed to be ready for each rank (index = rank being bought). */
export const STYLE_XP = [0, 0, 100, 220, 400, 650];
/** Training points (from levelling up) each rank needs. */
export const STYLE_POINTS = [0, 0, 1, 1, 2, 2];
/** Cash for ranks 2-5 (rank 1 costs the lesson price). */
export const STYLE_CASH = [0, 0, 120, 250, 450, 800];
export const DRILL_FATIGUE = 12;

export interface StyleProgress {
  rank: number;
  xp: number;
}
export type StyleTraining = Partial<Record<StyleId, StyleProgress>>;

export function sanitiseStyleTraining(raw: unknown, learned: StyleId[], hasSpecials: boolean): StyleTraining {
  const out: StyleTraining = {};
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, Partial<StyleProgress>>;
  for (const id of STYLE_IDS) {
    if (id === 'street') continue;
    const v = r[id];
    let rank = v && typeof v.rank === 'number' && Number.isFinite(v.rank) ? Math.max(0, Math.min(MAX_STYLE_RANK, Math.floor(v.rank))) : 0;
    // Styles learned before the fighting gyms existed keep what they could do then.
    if (learned.includes(id)) rank = Math.max(rank, hasSpecials ? 2 : 1);
    const xp = v && typeof v.xp === 'number' && Number.isFinite(v.xp) ? Math.max(0, Math.floor(v.xp)) : 0;
    if (rank > 0 || xp > 0) out[id] = { rank, xp };
  }
  return out;
}

export const styleRank = (p: Progress, id: StyleId) => (id === 'street' ? MAX_STYLE_RANK : p.save.styleTraining[id]?.rank ?? 0);

/** What the next rank needs, and whether you have it. */
export function nextRankNeeds(p: Progress, style: StyleId): { rank: number; cash: number; points: number; xp: number; requires?: string; requiresText?: string } | null {
  const cur = styleRank(p, style);
  if (cur >= MAX_STYLE_RANK) return null;
  const next = cur + 1;
  if (next === 1) {
    const lesson = STYLE_LESSONS.find((l) => l.style === style)!;
    return { rank: 1, cash: lesson.cost, points: 0, xp: 0, requires: lesson.requires, requiresText: lesson.requiresText };
  }
  return { rank: next, cash: STYLE_CASH[next], points: STYLE_POINTS[next], xp: STYLE_XP[next] };
}

/** Take the next rank in a style at its gym. */
export function rankUpStyle(p: Progress, style: StyleId, atGym: FightGym['id']): PurchaseResult {
  const gym = GYM_OF_STYLE[style];
  if (!gym || gym.id !== atGym) return { ok: false, reason: 'That’s taught at another gym' };
  const need = nextRankNeeds(p, style);
  if (!need) return { ok: false, reason: 'You’ve mastered it' };
  if (need.requires && !p.has(need.requires)) return { ok: false, reason: need.requiresText ?? 'Not yet' };
  const prog = p.save.styleTraining[style] ?? { rank: 0, xp: 0 };
  if (prog.xp < need.xp) return { ok: false, reason: `Drill more first (${prog.xp}/${need.xp} drill XP)` };
  if (p.save.trainingPoints < need.points) return { ok: false, reason: `Needs ${need.points} training point${need.points > 1 ? 's' : ''} (level up)` };
  if (!p.pay(need.cash)) return { ok: false, reason: `Not enough money: need £${need.cash}` };
  p.save.trainingPoints -= need.points;
  prog.xp -= need.xp;
  prog.rank = need.rank;
  p.save.styleTraining[style] = prog;
  if (need.rank === 1 && !p.save.styles.learned.includes(style)) p.save.styles.learned.push(style);
  return { ok: true };
}

/** Styles at rank 3 or more (street doesn't count): each is +1 Technique, up to 4. */
export function crossTrainingBonus(p: Progress): number {
  return Math.min(4, Object.entries(p.save.styleTraining).filter(([id, v]) => id !== 'street' && (v?.rank ?? 0) >= 3).length);
}

// ---- drills ----------------------------------------------------------------------------------------

export interface DrillCombo {
  /** Buttons in order. */
  buttons: AttackButton[];
  /** Move names, for showing. */
  names: string[];
}

/**
 * The style's real combo strings, read from its move graph: every chain from
 * a starter, two to four moves long. What you drill is what you'll throw.
 */
export function styleCombos(style: StyleId, maxLen: number): DrillCombo[] {
  const s = getStyle(style);
  const out: DrillCombo[] = [];
  const buttons: AttackButton[] = ['lp', 'hp', 'lk', 'hk'];
  const walk = (moveId: string, path: AttackButton[], names: string[]) => {
    if (path.length >= 2) out.push({ buttons: [...path], names: [...names] });
    if (path.length >= maxLen) return;
    const m = s.moves[moveId];
    for (const b of buttons) {
      const n = m?.next?.[b];
      if (n && s.moves[n]) walk(n, [...path, b], [...names, s.moves[n].name]);
    }
  };
  for (const b of buttons) {
    const st = s.starters[b];
    if (st && s.moves[st]) walk(st, [b], [s.moves[st].name]);
  }
  // Dedupe by button pattern.
  const seen = new Set<string>();
  return out.filter((c) => {
    const k = c.buttons.join(',');
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Three combos for a drill session, longer as your rank grows. Seeded so it's fair, varied by session count. */
export function drillSet(style: StyleId, rank: number, session: number): DrillCombo[] {
  const maxLen = rank >= 3 ? 4 : rank >= 2 ? 3 : 2;
  const all = styleCombos(style, maxLen);
  const pool = all.filter((c) => c.buttons.length >= Math.min(maxLen, 2));
  if (!pool.length) return [];
  const pick: DrillCombo[] = [];
  for (let i = 0; i < 3; i++) pick.push(pool[(session * 7 + i * 5) % pool.length]);
  return pick;
}

export function canDrill(p: Progress, style: StyleId): { ok: true } | { ok: false; reason: string } {
  if (styleRank(p, style) < 1) return { ok: false, reason: 'Learn the style first' };
  const f = currentFatigue(p.save.gym, p.save.playTime);
  if (f >= FATIGUE_LIMIT) return { ok: false, reason: `Too tired (${Math.round(f)}% fatigue). Rest first.` };
  return { ok: true };
}

/** Score a finished drill: XP per clean combo (longer is worth more), fatigue added. */
export function finishDrill(p: Progress, style: StyleId, results: { len: number; clean: boolean }[]): { xp: number; total: number } {
  const g = p.save.gym;
  const f = currentFatigue(g, p.save.playTime);
  const raw = results.reduce((n, r) => n + (r.clean ? 25 + 10 * (r.len - 2) : 5), 0);
  const xp = Math.round(raw * Math.max(0.1, 1 - f / 100));
  const prog = p.save.styleTraining[style] ?? { rank: 0, xp: 0 };
  prog.xp = Math.min(prog.xp + xp, 2000);
  p.save.styleTraining[style] = prog;
  g.fatigue = Math.min(100, f + DRILL_FATIGUE);
  return { xp, total: prog.xp };
}
