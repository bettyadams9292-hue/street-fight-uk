/**
 * Your record: what the police have on you. Each crime is logged where heat is already added (a mugging,
 * an assault, a robbery, putting an officer down) with the district and the trip it happened on, and drops
 * off once it's spent. Getting nicked reads the charges from here and prices bail from them
 * (docs/POLICE_PLAN.md).
 */

export type Crime = 'mugging' | 'assault' | 'robbery' | 'assault_police' | 'bribery' | 'dealing';

/** How serious each crime is: the worst on the sheet sets the bail. */
export const CRIME_SEVERITY: Record<Crime, number> = { mugging: 1, assault: 2, robbery: 3, assault_police: 4, bribery: 2, dealing: 3 };

/** How the charge reads on the sheet. */
export const CRIME_NAME: Record<Crime, string> = {
  mugging: 'Robbery from the person (mugging)',
  assault: 'Assault occasioning actual bodily harm',
  robbery: 'Armed robbery of a shop',
  assault_police: 'Assault on a police officer',
  bribery: 'Attempting to bribe an officer',
  dealing: 'Possession with intent to supply',
};

export interface CrimeEntry {
  crime: Crime;
  district: string;
  /** The trip it happened on (`save.trips`). */
  trip: number;
}

/** Most entries kept: the oldest go first. */
export const RECORD_MAX = 30;
/** Trips after which a crime is spent and drops off the record. */
export const CRIME_SPENT_TRIPS = 60;

/** Bail for the worst charge on the sheet, by severity 1–4. */
export const BAIL_BASE = [0, 150, 300, 600, 1200];
/** Each charge beyond the worst adds half again. */
export const BAIL_PER_EXTRA = 0.5;
/** Each past arrest makes the bench less forgiving. */
export const BAIL_PER_ARREST = 0.25;
/** A share of what the seized goods were worth goes on top. */
export const BAIL_SEIZED_SHARE = 0.1;
/** Bail never goes past this at your level (like the arrest fine's cap). */
export const BAIL_CAP_BASE = 900;
export const BAIL_CAP_PER_LEVEL = 150;
/** A night in the cells instead: a court fine of this share of the bail, taken from what you have. */
export const COURT_FINE_SHARE = 0.4;
/** A night in the cells passes this many trips (needs drop, heat cools). */
export const CELL_NIGHT_TRIPS = 4;
/** Heat a night inside takes off the police everywhere else. */
export const CELL_NIGHT_COOL = 15;
/** Without a record, being nicked for being wanted is still "obstruction": this is its bail. */
export const BAIL_NO_CHARGE = 100;

/** Add a crime; trim to the newest RECORD_MAX. */
export function logCrime(record: CrimeEntry[], crime: Crime, district: string, trip: number): void {
  record.push({ crime, district, trip });
  if (record.length > RECORD_MAX) record.splice(0, record.length - RECORD_MAX);
}

/** Drop spent crimes. */
export function ageRecord(record: CrimeEntry[], trip: number): void {
  for (let i = record.length - 1; i >= 0; i--) if (trip - record[i].trip >= CRIME_SPENT_TRIPS) record.splice(i, 1);
}

/**
 * The charges when you're nicked in `district`: what you did there, or, if nothing, your worst recent ones
 * anywhere (the police talk to each other). At most five, worst first.
 */
export function chargesFor(record: readonly CrimeEntry[], district: string): CrimeEntry[] {
  const here = record.filter((e) => e.district === district);
  const pool = here.length ? here : record;
  return [...pool].sort((a, b) => CRIME_SEVERITY[b.crime] - CRIME_SEVERITY[a.crime] || b.trip - a.trip).slice(0, 5);
}

/** Bail for these charges: the worst sets it, the rest add half each, past arrests and seized goods on top. */
export function bailPrice(charges: readonly CrimeEntry[], pastArrests: number, seizedValue: number, level: number): number {
  const cap = BAIL_CAP_BASE + BAIL_CAP_PER_LEVEL * Math.max(1, level);
  if (!charges.length) return Math.min(cap, BAIL_NO_CHARGE);
  const worst = Math.max(...charges.map((c) => CRIME_SEVERITY[c.crime]));
  const base = BAIL_BASE[worst] * (1 + BAIL_PER_EXTRA * (charges.length - 1)) * (1 + BAIL_PER_ARREST * pastArrests);
  return Math.min(cap, Math.round((base + seizedValue * BAIL_SEIZED_SHARE) / 5) * 5);
}

/** The court fine for a night in the cells instead of bail. */
export function courtFine(bail: number): number {
  return Math.round((bail * COURT_FINE_SHARE) / 5) * 5;
}

/** Settling a district's fines early at the front counter: by its police heat and what's logged there. */
export const SETTLE_PER_HEAT = 8;
export const SETTLE_PER_SEVERITY = 60;
export function settlePrice(record: readonly CrimeEntry[], district: string, policeHeat: number): number {
  const sev = record.filter((e) => e.district === district).reduce((t, e) => t + CRIME_SEVERITY[e.crime], 0);
  return Math.max(25, Math.round((policeHeat * SETTLE_PER_HEAT + sev * SETTLE_PER_SEVERITY) / 5) * 5);
}

/** Keep only well-formed entries from a loaded save. */
export function sanitiseRecord(v: unknown): CrimeEntry[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((e): e is CrimeEntry => !!e && typeof e === 'object' && (e as CrimeEntry).crime in CRIME_SEVERITY && typeof (e as CrimeEntry).district === 'string' && Number.isFinite((e as CrimeEntry).trip))
    .slice(-RECORD_MAX);
}
