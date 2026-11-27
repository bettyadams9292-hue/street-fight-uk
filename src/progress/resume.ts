import type { AreaId, Progress } from './Progress';
import { stationAt } from '../travel/metro';
import { STATIONS } from '../travel/subway';
import { ENTRANCE } from '../world/metroLevels';
import { LEVELS } from '../world/levels';

/**
 * Where a saved game picks up. Saves keep an area and a named arrival spot, never raw coordinates, so a spot that's
 * gone (a door taken out, a room rebuilt) falls back to the area's first arrival point in World. What this adds: a
 * save left in a Metro station that isn't open (an old save from before stations opened with their bosses) comes
 * back up its stairs to the street, and a missing arrival spot is swapped for the level's first.
 */
export function safeResume(p: Progress): { area: AreaId; entry: string } {
  const area = p.save.area;
  const here = stationAt(area);
  if (here) {
    const st = STATIONS.find((s) => s.id === here);
    if (!st || !p.has(st.opens)) {
      const up = ENTRANCE[here];
      if (up) return { area: up.area, entry: `metro_${here}` };
      return { area: 'home', entry: 'start' };
    }
  }
  const lv = LEVELS[area];
  if (!lv) return { area: 'home', entry: 'start' };
  const entry = lv.entries.some((e) => e.id === p.save.entry) ? p.save.entry : lv.entries[0]?.id ?? 'start';
  return { area, entry };
}
