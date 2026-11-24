/**
 * What a location needs loaded before it's built, so play can start (and a door can open) as soon as
 * that location's models are in, instead of waiting for every model in the game. The lists are made by
 * building each level with the model sets recording (tools/assets/levelDeps.ts → levelAssets.generated.ts;
 * tests/levelAssets.test.ts fails if they're stale). Levels built from the save (DYNAMIC_LEVELS) wait for
 * every set, since what's in them depends on what you own.
 */
import { recorder, SETS } from '../render/props/modelSet';
import { LEVEL_MODELS } from './levelAssets.generated';
import { PRIORITY, type Priority } from './requests';

export const DYNAMIC_LEVELS: ReadonlySet<string> = new Set(['home', 'basement', 'property', 'estate']);

/** Lists recorded in the game for levels built from the save (`recordLevel`), by level id. */
const recorded = new Map<string, Record<string, readonly string[]>>();

/** The models a level needs, by set; `null` means every set (a level built from the save, or one not listed). */
export function levelModels(id: string): Record<string, readonly string[]> | null {
  const r = recorded.get(id);
  if (r) return r;
  if (DYNAMIC_LEVELS.has(id)) return null;
  return LEVEL_MODELS[id] ?? null;
}

function eachNeed(id: string, fn: (set: string, ids: readonly string[]) => void): void {
  const deps = levelModels(id);
  if (deps) {
    for (const [set, ids] of Object.entries(deps)) fn(set, ids);
  } else {
    for (const [set, s] of SETS) fn(set, s.ids);
  }
}

/** Load what a level needs, ahead of everything else at `priority`. Never rejects (failed pieces fall back). */
export function prepareLevel(id: string, priority: Priority = PRIORITY.now): Promise<void> {
  const jobs: Promise<void>[] = [];
  eachNeed(id, (set, ids) => {
    const s = SETS.get(set);
    if (s) jobs.push(s.prepare(ids, priority));
  });
  return Promise.all(jobs).then(() => undefined);
}

/** Everything the level needs has loaded or given up: building it now won't leave a piece out. */
export function levelReady(id: string): boolean {
  let ok = true;
  eachNeed(id, (set, ids) => {
    const s = SETS.get(set);
    if (!s) return;
    for (const m of ids) if (!s.settled(m)) ok = false;
  });
  return ok;
}

/** How much of what the level needs has loaded or given up, 0–1 (the loading bar). */
export function levelProgress(id: string): number {
  let all = 0, done = 0;
  eachNeed(id, (set, ids) => {
    const s = SETS.get(set);
    if (!s) return;
    for (const m of ids) {
      all++;
      if (s.settled(m)) done++;
    }
  });
  return all ? done / all : 1;
}

/** Every model in every set has loaded or given up. */
export function everySetSettled(): boolean {
  for (const s of SETS.values()) for (const id of s.ids) if (!s.settled(id)) return false;
  return true;
}

/**
 * Find what a level built from the save needs by building it once with the sets recording (`build` makes and
 * disposes a LevelView; a few tens of milliseconds, behind the loading fade), and use that list for `id` from
 * now on, until it's recorded again. Only worth it while sets are still loading (`everySetSettled`).
 */
export function recordLevel(id: string, build: () => void): void {
  recorder.used.clear();
  recorder.on = true;
  try {
    build();
  } catch (e) {
    // Couldn't tell: wait for every set, as before.
    console.warn('[assets] could not list the models for', id, e);
    recorded.delete(id);
    return;
  } finally {
    recorder.on = false;
  }
  const deps: Record<string, string[]> = {};
  for (const [set, ids] of recorder.used) deps[set] = [...ids];
  recorder.used.clear();
  recorded.set(id, deps);
}
