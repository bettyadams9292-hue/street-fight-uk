/**
 * Heat, district by district. Each district keeps three readings, 0–100:
 *
 * - police: how much the law wants you there. Crimes raise it (robbery, mugging, assault). It brings officers
 *   to the street when you arrive, makes a 999 call likelier and quicker, and at ARREST_HEAT losing any fight
 *   there gets you nicked.
 * - street: what the locals think of you. Muggings and putting down people who were only defending themselves
 *   raise it. The nervy cross the road (KNOWN_FACE), heroes step in, more people ring the police.
 * - gang: what the district's crew think of you. Nothing until you take on their boss (Progress.gangOn), so the
 *   streets stay passable; then beating their lads and running from them raise it, and beating the boss wipes it. Their fights hit harder (gangMods) and, high enough, lads come looking for you.
 *
 * Everything cools as you move between areas (tick), the district you're in a little slower. `save.heat`,
 * which the HUD, arrests and the rest have always read, is the police reading where you are now.
 */

export type HeatKind = 'police' | 'street' | 'gang';
export interface DistrictHeat {
  police: number;
  street: number;
  gang: number;
}
export type HeatMap = Record<string, DistrictHeat>;

export const HEAT_KINDS: readonly HeatKind[] = ['police', 'street', 'gang'];

/** How much each cools per trip (area change). */
export const HEAT_COOL: Readonly<Record<HeatKind, number>> = { police: 8, street: 4, gang: 3 };

/** Street heat at which locals know your face and the nervy keep their distance. */
export const KNOWN_FACE_HEAT = 30;
/** Gang heat at which their fights start coming at you harder. */
export const GANG_GRUDGE = 20;
/** Gang heat at which lads come looking for you on the street. */
export const GANG_HUNT = 50;

/** What things do to heat. */
export const HEAT = {
  mug: { police: 8, street: 10 },
  /** Per person who saw it. */
  witness: { police: 2, street: 3 },
  assault: { police: 6, street: 8 },
  robbery: { street: 15 },
  /** Taking on their boss: the crew are in it now. */
  provoke: { gang: 25 },
  /** Beating one of the district's fights: they're sick of you. */
  beatCrew: { gang: 6 },
  /** Running from them with cash thrown down, or with nothing. */
  bail: { gang: 10 },
  bailBroke: { gang: 45 },
  /** Turning up when they're hunting you and beating the lads they sent. */
  beatHunters: { gang: -15 },
} as const satisfies Record<string, Partial<DistrictHeat>>;

export function emptyHeat(): DistrictHeat {
  return { police: 0, street: 0, gang: 0 };
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

export function sanitiseHeatMap(r: unknown): HeatMap {
  const out: HeatMap = {};
  if (!r || typeof r !== 'object') return out;
  for (const [k, v] of Object.entries(r as Record<string, unknown>)) {
    if (!v || typeof v !== 'object') continue;
    const x = v as Record<string, unknown>;
    const h = { police: clamp(Number(x.police) || 0), street: clamp(Number(x.street) || 0), gang: clamp(Number(x.gang) || 0) };
    if (h.police || h.street || h.gang) out[k] = h;
  }
  return out;
}

/** One trip passes: everything cools, the district you're in at half the rate (people there still remember). */
export function coolHeat(map: HeatMap, here: string): void {
  for (const [k, h] of Object.entries(map)) {
    for (const kind of HEAT_KINDS) h[kind] = Math.max(0, h[kind] - (k === here ? Math.ceil(HEAT_COOL[kind] / 2) : HEAT_COOL[kind]));
    if (!h.police && !h.street && !h.gang) delete map[k];
  }
}

/**
 * The crew's grudge in a fight: from GANG_GRUDGE up they hit harder and shrug off more, up to twice as hard and
 * half the damage at 100. Below it, nothing.
 */
export function gangMods(gang: number): { dealt: number; taken: number } | null {
  if (gang < GANG_GRUDGE) return null;
  const t = gang / 100;
  return { dealt: 1 + t, taken: 1 - t / 2 };
}

/** Chance the crew send lads after you when you walk in (once a visit). */
export function huntChance(gang: number): number {
  return gang < GANG_HUNT ? 0 : Math.min(0.85, (gang - GANG_HUNT) / 60 + 0.25);
}

/** A word for a reading, for the phone. */
export function heatWord(n: number): string {
  return n >= 80 ? 'Red hot' : n >= 60 ? 'Hot' : n >= 30 ? 'Warm' : n > 0 ? 'Simmering' : 'Cold';
}
