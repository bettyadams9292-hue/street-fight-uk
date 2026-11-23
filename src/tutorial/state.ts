/**
 * The tutorial's place in the save (`save.tutorial`): which lessons are done or skipped, which hints have shown,
 * and where an unfinished one stands. A save from before the tutorial counts as having done it all, so nobody
 * who already plays is marched back through it.
 */

/** Bump when the essential lessons change enough that the version matters (nothing replays on its own). */
export const TUTORIAL_VERSION = 1;

export interface TutorialSave {
  version: number;
  /** The essential lessons (chapters 1–5) have run their course: finished or skipped. */
  essentialDone: boolean;
  /** Lesson ids finished. */
  completed: string[];
  /** Lesson ids skipped. */
  skipped: string[];
  /** Contextual hint ids already shown. */
  hints: string[];
  /** An essential lesson in progress (chapter id) and the step it's on, or null. */
  active: { chapter: string; step: number } | null;
  /** A guide in progress (tutorial/lessons.ts GUIDES: jobs, the hotbar), or null. */
  guide: { chapter: string; step: number } | null;
}

/** The essential chapters, in order (tutorial/lessons.ts; a test keeps the two in step). */
export const ESSENTIAL_CHAPTERS = ['first-steps', 'learning-to-fight', 'styles', 'first-scrap', 'building'] as const;

/** The guides, started the first time you meet their thing (tutorial/lessons.ts; a test keeps the two in step). */
export const GUIDE_CHAPTERS = ['jobs', 'dealing', 'hotbar'] as const;

/** In `hints`: every hint counts as shown (saves from before the tutorial). */
export const ALL_HINTS = '*';

/** A new game: the essential lessons start straight away. */
export function newTutorial(): TutorialSave {
  return { version: TUTORIAL_VERSION, essentialDone: false, completed: [], skipped: [], hints: [], active: { chapter: 'first-steps', step: 0 }, guide: null };
}

/** An old save, or junk: everything counts as done and seen (`allHints`), nothing runs by itself. */
export function sanitiseTutorial(raw: unknown): TutorialSave {
  const chapters: readonly string[] = ESSENTIAL_CHAPTERS;
  if (!raw || typeof raw !== 'object') return { version: TUTORIAL_VERSION, essentialDone: true, completed: [], skipped: [], hints: [ALL_HINTS], active: null, guide: null };
  const r = raw as Partial<TutorialSave>;
  const ids = (v: unknown) => (Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === 'string'))].slice(0, 200) : []);
  const a = r.active as { chapter?: unknown; step?: unknown } | null | undefined;
  const g = r.guide as { chapter?: unknown; step?: unknown } | null | undefined;
  const guides: readonly string[] = GUIDE_CHAPTERS;
  const guide = g && typeof g.chapter === 'string' && guides.includes(g.chapter) && typeof g.step === 'number' && Number.isFinite(g.step) && g.step >= 0 ? { chapter: g.chapter, step: Math.floor(g.step) } : null;
  const active = a && typeof a.chapter === 'string' && chapters.includes(a.chapter) && typeof a.step === 'number' && Number.isFinite(a.step) && a.step >= 0 ? { chapter: a.chapter, step: Math.floor(a.step) } : null;
  return {
    version: typeof r.version === 'number' ? r.version : TUTORIAL_VERSION,
    essentialDone: r.essentialDone === true || !active,
    completed: ids(r.completed),
    skipped: ids(r.skipped),
    hints: ids(r.hints),
    active: r.essentialDone === true ? null : active,
    guide,
  };
}
