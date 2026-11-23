/**
 * Pause → Tutorials: every lesson by subject, with whether you've done it, and a way to go through it again.
 * Chapters replay as lessons (Learning to fight needs Mo, so it replays in the gym at home); hints show their
 * card again. Replays pay nothing and change nothing you've earned or chosen.
 */
import type { Progress } from '../progress/Progress';
import { menuButton } from '../ui/controls';
import { h } from '../ui/dom';
import { titleArt } from '../ui/titles';
import type { Screen } from '../ui/UIManager';
import { CHAPTERS, GUIDES, HINTS, type Category } from './lessons';
import { ALL_HINTS } from './state';

export interface LibraryActions {
  replay(chapter: string): void;
  hint(id: string): void;
  /** Start a guide now (or go through it again). */
  guide(id: string): void;
  resume(): void;
  skip(): void;
  back(): void;
  /** At home (Learning to fight replays there, with Mo). */
  atHome(): boolean;
}

const ORDER: Category[] = ['Getting started', 'Combat', 'Fighting styles', 'Progression', 'Inventory', 'Exploration', 'Gyms', 'Money and survival', 'Police and crime', 'Crew', 'Advanced'];

export function tutorialLibrary(p: Progress, a: LibraryActions): Screen {
  const s = p.save.tutorial;
  const status = (id: string) => (s.completed.includes(id) ? 'Done' : s.skipped.includes(id) ? 'Skipped' : s.active?.chapter === id || s.guide?.chapter === id ? 'Now' : 'To come');
  const seen = (id: string) => s.hints.includes(ALL_HINTS) || s.hints.includes(id);
  const row = (title: string, text: string, state: string, act: { label: string; go: () => void } | null, note?: string) =>
    h('div', { class: 'tut-row' },
      h('div', { class: 'tut-row-what' }, h('b', { text: title }), h('span', { text: text }), note ? h('small', { text: note }) : null),
      h('span', { class: `tut-state s-${state.toLowerCase().replace(/\s+/g, '-')}`, text: state }),
      act ? h('button', { class: 'tut-row-btn', 'data-nav': true, onclick: act.go }, act.label) : null);
  const sections: HTMLElement[] = [];
  for (const cat of ORDER) {
    const rows: HTMLElement[] = [];
    for (const ch of CHAPTERS.filter((c) => c.category === cat)) {
      const done = s.essentialDone || s.completed.includes(ch.id);
      const needsHome = ch.id === 'learning-to-fight' && !a.atHome();
      rows.push(row(`${ch.num} ${ch.title}`, ch.blurb, status(ch.id), done && !needsHome ? { label: 'Replay', go: () => a.replay(ch.id) } : null, needsHome && done ? 'Replays in the gym at home, with Mo.' : undefined));
    }
    // Guides: start one now, or go through it again. (Not while the first-run lessons are still going.)
    for (const g of GUIDES.filter((c) => c.category === cat)) {
      const done = s.completed.includes(g.id) || s.skipped.includes(g.id);
      const act = !s.essentialDone || s.guide?.chapter === g.id ? null : s.completed.includes(g.id) ? { label: 'Replay', go: () => a.replay(g.id) } : { label: 'Start', go: () => a.guide(g.id) };
      rows.push(row(`${g.num} ${g.title}`, g.blurb, status(g.id), act, done ? undefined : 'Starts on its own the first time you need it.'));
    }
    for (const hd of HINTS.filter((x) => x.category === cat)) {
      rows.push(row(hd.title, hd.text, seen(hd.id) ? 'Seen' : 'To come', seen(hd.id) ? { label: 'Show', go: () => a.hint(hd.id) } : null));
    }
    if (rows.length) sections.push(h('section', { class: 'tut-sec' }, h('h3', { text: cat }), ...rows));
  }
  const top = s.essentialDone
    ? s.skipped.some((id) => CHAPTERS.some((c) => c.id === id))
      ? menuButton('Resume tutorial', a.resume, 'Pick the lessons up where you left them', '', undefined, undefined, 'resume-tutorial')
      : null
    : menuButton('Skip tutorial', a.skip, 'You can pick it up again here', '', undefined, undefined, 'skip-tutorial');
  const el = h('div', { class: 'screen panel-screen tut-library' },
    h('h2', {}, titleArt('Tutorials', 'tutorials')),
    h('p', { class: 'hint', text: s.essentialDone ? 'Every lesson, by subject. Replay one any time: replays don’t pay out or change anything you’ve earned.' : 'You’re part way through the basics. Every lesson is here, and so is a way out.' }),
    h('div', { class: 'panel tut-list' }, ...sections),
    h('div', { class: 'panel-actions' }, ...(top ? [top] : []), menuButton('Back', a.back)),
  );
  return { el, onBack: a.back };
}
