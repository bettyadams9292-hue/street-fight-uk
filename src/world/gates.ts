import { ITEMS } from '../items/items';
import type { Progress } from '../progress/Progress';
import type { ExitDef } from './LevelTypes';
import { DISTRICT_ORDER, LEVELS } from './levels';
import { stripIndex } from './strip';

/**
 * Ways through that need several things done first (Hale House needs Dunc's
 * phone and four district bosses). This says, in plain words, exactly what is
 * still outstanding and where it is, so a locked gate always tells you what
 * to do next. No Three.js here.
 */

/** One thing still to do before a gate opens. */
export interface GateNeed {
  flag: string;
  /** "Beat the firm's top boy at Kirkgate". */
  label: string;
  /** Where it is: the district to head for, if it is a place. */
  area: keyof typeof LEVELS | null;
  /** "Kirkgate Ground, west along the street". */
  where: string | null;
}

/** What `ex` still needs, in the order the story lists it. Empty when the way is open (or it has no such list). */
export function gateNeeds(ex: ExitDef, progress: Progress, from?: keyof typeof LEVELS): GateNeed[] {
  const flags = [...(ex.requires ? [ex.requires] : []), ...(ex.requiresAll ?? [])];
  return flags
    .filter((f) => !progress.has(f))
    .map((flag) => {
      const boss = DISTRICT_ORDER.find((d) => d.flag === flag);
      if (boss) {
        const here = from ? stripIndex(from) : -1;
        const there = stripIndex(boss.area);
        const dir = here >= 0 && there >= 0 && here !== there ? (there < here ? ', west along the street' : ', east along the street') : '';
        return { flag, label: boss.label, area: boss.area, where: `${LEVELS[boss.area].name}${dir}` };
      }
      const item = Object.values(ITEMS).find((d) => d.questFlag === flag);
      return { flag, label: item ? `Get hold of ${item.name}` : 'Something still to do', area: null, where: null };
    });
}

/** The message for walking into a shut gate: what is left to do, not the whole list. */
export function lockedMessage(ex: ExitDef, progress: Progress, from?: keyof typeof LEVELS): string {
  if (!ex.requiresAll) return ex.lockedText ?? 'Can’t go that way yet';
  const needs = gateNeeds(ex, progress, from);
  if (!needs.length) return ex.lockedText ?? 'Can’t go that way yet';
  const name = ex.label ?? LEVELS[ex.to]?.name ?? 'This way';
  return `${name} is locked down. Still to do: ${needs.map((n) => (n.where ? `${n.label} (${n.where})` : n.label)).join('; ')}.`;
}
