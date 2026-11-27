/**
 * The result card: one design for the moments a run of play stops to tell you how something came out
 * (knocked out, nicked, a job done or failed, a boss down). It replaces the old generic layout (a heading, a
 * centred list and a red pill) with a ledger: what happened in a line, then what you lost and what you kept,
 * each on its own row, and one clear way on.
 *
 * Styling: `.oc-*` in theme.css. Tones: `loss` (red tape), `win` (white on red), `info` (blue). Every card has a
 * primary action; Back takes it too, so the card can never strand you.
 */
import { h } from './dom';
import type { Screen } from './UIManager';

export type OutcomeTone = 'loss' | 'win' | 'info';

export interface OutcomeRow {
  label: string;
  value: string;
  /** lost: in red with a minus feel; kept: plain, confirmed; gain: in green. */
  mood?: 'lost' | 'kept' | 'gain';
}

export interface OutcomeAction {
  label: string;
  /** One short line under the label: what happens when you press it. */
  sub?: string;
  go: () => void;
}

export interface Outcome {
  tone: OutcomeTone;
  /** Small line above the title: where and what (e.g. the district). */
  kicker?: string;
  title: string;
  /** What happened, in a sentence. */
  lead: string;
  rows: OutcomeRow[];
  /** A closing note under the ledger (what to do next, a tip). */
  note?: string;
  actions: OutcomeAction[];
}

export function outcomeScreen(o: Outcome): Screen {
  const row = (r: OutcomeRow) => h('div', { class: `oc-row ${r.mood ?? ''}`, role: 'listitem' }, h('span', { class: 'oc-label', text: r.label }), h('span', { class: 'oc-value', text: r.value }));
  const button = (a: OutcomeAction, i: number) =>
    h(
      'button',
      { class: `oc-act${i === 0 ? ' primary' : ''}`, 'data-nav': true, onclick: () => a.go() },
      h('span', { class: 'oc-act-label', text: a.label }),
      a.sub ? h('span', { class: 'oc-act-sub', text: a.sub }) : null,
    );
  const el = h(
    'div',
    { class: `screen oc-screen oc-${o.tone}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': o.title },
    h(
      'div',
      { class: 'oc-card' },
      h('div', { class: 'oc-tape', 'aria-hidden': 'true' }),
      o.kicker ? h('p', { class: 'oc-kicker', text: o.kicker }) : null,
      h('h2', { class: 'oc-title', text: o.title }),
      h('p', { class: 'oc-lead', text: o.lead }),
      o.rows.length ? h('div', { class: 'oc-ledger', role: 'list' }, ...o.rows.map(row)) : null,
      o.note ? h('p', { class: 'oc-note', text: o.note }) : null,
      h('nav', { class: 'oc-actions' }, ...o.actions.map(button)),
    ),
  );
  return { el, onBack: o.actions[0].go };
}
