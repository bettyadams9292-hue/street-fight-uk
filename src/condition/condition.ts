import type { HitHeight } from '../combat/MoveData';
import type { Modifier } from '../stats/Stats';

/**
 * Physical condition for you and your crew: injuries from real hits, with
 * effects that go through the normal stat modifiers, and recovery over play
 * time, by resting at home, or with first aid.
 *
 * How you get hurt: during a fight, damage you take is counted per body part
 * (high hits on the head, mid on the body, low on the legs, heavy blows you
 * block on the arms; anything else adds bruising). When a fight ends, a part
 * that took more than 30% of your max health is injured; past 65% it's a
 * level worse. Being knocked out adds a level to the worst-hit part.
 */

export type InjuryPart = 'head' | 'arm' | 'leg' | 'body' | 'bruising';
export const INJURY_PARTS: InjuryPart[] = ['head', 'arm', 'leg', 'body', 'bruising'];
export type Severity = 1 | 2 | 3;

export interface Injury {
  part: InjuryPart;
  severity: Severity;
  /** Play-time seconds until it improves by a level. */
  left: number;
}

export interface ConditionSave {
  injuries: Injury[];
}

export const SEVERITY_NAMES: Record<Severity, string> = { 1: 'Minor', 2: 'Serious', 3: 'Severe' };

export const INJURY_NAMES: Record<InjuryPart, Record<Severity, string>> = {
  head: { 1: 'Bad head', 2: 'Concussion', 3: 'Bad concussion' },
  arm: { 1: 'Sore arm', 2: 'Damaged arm', 3: 'Badly damaged arm' },
  leg: { 1: 'Dead leg', 2: 'Damaged knee', 3: 'Badly damaged leg' },
  body: { 1: 'Bruised ribs', 2: 'Cracked rib', 3: 'Broken ribs' },
  bruising: { 1: 'Bruised', 2: 'Heavily bruised', 3: 'Black and blue' },
};

/** Seconds of play for one level to heal, by the level it's at. */
export const HEAL_TIME: Record<Severity, number> = { 1: 180, 2: 300, 3: 420 };

/** What each injury does, per level. All through ordinary stat modifiers. */
const EFFECTS: Record<InjuryPart, (s: Severity) => { mods: Omit<Modifier, 'id' | 'source'>[]; text: string }> = {
  head: (s) => {
    const m = [1.05, 1.1, 1.18][s - 1];
    return { mods: [{ stat: 'damageTakenMult', mul: m }], text: `Hits hurt ${Math.round((m - 1) * 100)}% more` };
  },
  arm: (s) => {
    const d = [0.93, 0.86, 0.78][s - 1];
    const a = [0.97, 0.94, 0.9][s - 1];
    return { mods: [{ stat: 'damageMult', mul: d }, { stat: 'attackSpeedMult', mul: a }], text: `${Math.round((1 - d) * 100)}% less damage, ${Math.round((1 - a) * 100)}% slower swings` };
  },
  leg: (s) => {
    const m = [0.93, 0.86, 0.78][s - 1];
    return { mods: [{ stat: 'moveSpeedMult', mul: m }], text: `${Math.round((1 - m) * 100)}% slower on your feet` };
  },
  body: (s) => {
    const st = [10, 20, 35][s - 1];
    const r = [0.92, 0.85, 0.75][s - 1];
    return { mods: [{ flat: 'maxStamina', add: -st }, { stat: 'staminaRegenMult', mul: r }], text: `−${st} max stamina, stamina back ${Math.round((1 - r) * 100)}% slower` };
  },
  bruising: (s) => {
    const hp = [8, 16, 25][s - 1];
    return { mods: [{ flat: 'maxHealth', add: -hp }], text: `−${hp} max health` };
  },
};

export function injuryName(i: Injury): string {
  return INJURY_NAMES[i.part][i.severity];
}

export function injuryEffect(i: Injury): string {
  return EFFECTS[i.part](i.severity).text;
}

/** Exhaustion from training fatigue: stamina comes back slower. */
export function exhaustionEffect(fatigue: number): { mul: number; text: string; label: string } | null {
  if (fatigue >= 75) return { mul: 0.7, text: 'Stamina back 30% slower', label: 'Exhausted' };
  if (fatigue >= 50) return { mul: 0.85, text: 'Stamina back 15% slower', label: 'Tired' };
  return null;
}

/** Stat modifiers for a set of injuries (and training fatigue). Source 'injury'. */
export function conditionModifiers(c: ConditionSave, fatigue = 0): Modifier[] {
  const out: Modifier[] = [];
  for (const i of c.injuries) EFFECTS[i.part](i.severity).mods.forEach((m, k) => out.push({ ...m, id: `injury_${i.part}_${k}`, source: 'injury' } as Modifier));
  const ex = exhaustionEffect(fatigue);
  if (ex) out.push({ id: 'exhaustion', source: 'injury', stat: 'staminaRegenMult', mul: ex.mul });
  return out;
}

export function defaultCondition(): ConditionSave {
  return { injuries: [] };
}

export function sanitiseCondition(raw: unknown): ConditionSave {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<ConditionSave>;
  const out: Injury[] = [];
  if (Array.isArray(r.injuries)) {
    for (const x of r.injuries as Partial<Injury>[]) {
      if (!x || !INJURY_PARTS.includes(x.part as InjuryPart) || out.some((o) => o.part === x.part)) continue;
      const sev = Math.max(1, Math.min(3, Math.round(Number(x.severity) || 1))) as Severity;
      const left = Number.isFinite(x.left) ? Math.max(0, Math.min(HEAL_TIME[sev], Number(x.left))) : HEAL_TIME[sev];
      out.push({ part: x.part as InjuryPart, severity: sev, left });
    }
  }
  return { injuries: out };
}

/** Make an injury worse by `levels` (or add it). Returns the injury as it now is. */
export function addInjury(c: ConditionSave, part: InjuryPart, levels = 1): Injury {
  let i = c.injuries.find((x) => x.part === part);
  if (!i) {
    i = { part, severity: Math.min(3, levels) as Severity, left: 0 };
    c.injuries.push(i);
  } else i.severity = Math.min(3, i.severity + levels) as Severity;
  i.left = HEAL_TIME[i.severity];
  return i;
}

/** Heal one level of an injury (or of the worst one). Returns what changed, or null. */
export function treatInjury(c: ConditionSave, part?: InjuryPart): { name: string; healed: boolean } | null {
  const i = part ? c.injuries.find((x) => x.part === part) : worst(c);
  if (!i) return null;
  const name = injuryName(i);
  if (i.severity === 1) {
    c.injuries.splice(c.injuries.indexOf(i), 1);
    return { name, healed: true };
  }
  i.severity = (i.severity - 1) as Severity;
  i.left = HEAL_TIME[i.severity];
  return { name, healed: false };
}

export function worst(c: ConditionSave): Injury | null {
  return c.injuries.reduce<Injury | null>((w, i) => (!w || i.severity > w.severity || (i.severity === w.severity && i.part !== 'bruising' && w.part === 'bruising') ? i : w), null);
}

/** Time passing: each injury counts down; resting at home (`rate` 3) heals three times as fast. */
export function healOverTime(c: ConditionSave, dt: number, rate = 1): string[] {
  const done: string[] = [];
  for (const i of [...c.injuries]) {
    i.left -= dt * rate;
    if (i.left > 0) continue;
    const r = treatInjury(c, i.part);
    if (r?.healed) done.push(r.name);
  }
  return done;
}

/** Seconds of play until everything's healed at normal speed. */
export function timeToHeal(c: ConditionSave): number {
  let t = 0;
  for (const i of c.injuries) {
    let s = i.left;
    for (let k = i.severity - 1; k >= 1; k--) s += HEAL_TIME[k as Severity];
    t = Math.max(t, s);
  }
  return t;
}

// ---- overall condition ------------------------------------------------------------------

export type ConditionLevel = 'excellent' | 'good' | 'tired' | 'injured' | 'badly_injured' | 'critical';

export const CONDITION_INFO: Record<ConditionLevel, { label: string; colour: string; text: string }> = {
  excellent: { label: 'Excellent', colour: '#4fc36a', text: 'Fighting fit.' },
  good: { label: 'Good', colour: '#9bd24a', text: 'A few knocks. Ready to go.' },
  tired: { label: 'Tired', colour: '#e8c23a', text: 'Running on empty. Rest before a big fight.' },
  injured: { label: 'Injured', colour: '#ef8a2a', text: 'Hurt. You’ll feel it in a fight.' },
  badly_injured: { label: 'Badly injured', colour: '#e5532e', text: 'Needs proper rest or first aid.' },
  critical: { label: 'Critical', colour: '#d2232a', text: 'In no state to fight.' },
};

/** One word for how someone is, from health (0..1), injuries and fatigue (0..100). */
export function overallCondition(healthFrac: number, c: ConditionSave, fatigue = 0): ConditionLevel {
  const sev = c.injuries.filter((i) => i.part !== 'bruising').reduce((n, i) => n + i.severity, 0);
  const maxSev = c.injuries.filter((i) => i.part !== 'bruising').reduce((n, i) => Math.max(n, i.severity), 0);
  if (healthFrac < 0.2 || maxSev >= 3 || sev >= 6) return 'critical';
  if (healthFrac < 0.4 || maxSev >= 2 || sev >= 3) return 'badly_injured';
  if (healthFrac < 0.6 || sev >= 1) return 'injured';
  if (fatigue >= 50) return 'tired';
  if (healthFrac < 0.9 || c.injuries.length || fatigue >= 25) return 'good';
  return 'excellent';
}

// ---- counting hits during a fight --------------------------------------------------------

/** Damage taken per body part during the current fight. */
export class HitLedger {
  private parts = new Map<InjuryPart, number>();
  knockedOut = false;

  /** A hit landed (or a heavy blow was blocked, which lands on the arms). */
  record(height: HitHeight | null, damage: number, blocked: boolean): void {
    if (damage <= 0) return;
    const part: InjuryPart = blocked ? 'arm' : height === 'high' ? 'head' : height === 'low' ? 'leg' : 'body';
    this.parts.set(part, (this.parts.get(part) ?? 0) + damage);
    // Every clean hit also bruises a little.
    if (!blocked) this.parts.set('bruising', (this.parts.get('bruising') ?? 0) + damage * 0.5);
  }

  get total(): number {
    let n = 0;
    for (const v of this.parts.values()) n += v;
    return n;
  }

  /** The fight's over: turn what you took into injuries. Returns the injuries that got worse. */
  settle(c: ConditionSave, maxHealth: number): Injury[] {
    const out: Injury[] = [];
    const worstPart = [...this.parts.entries()].filter(([p]) => p !== 'bruising').sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    for (const [part, dmg] of this.parts) {
      const share = dmg / Math.max(1, maxHealth);
      let levels = share >= 0.65 ? 2 : share >= 0.3 ? 1 : 0;
      if (this.knockedOut && part === worstPart) levels += 1;
      if (levels > 0) out.push(addInjury(c, part, levels));
    }
    if (this.knockedOut && !worstPart) out.push(addInjury(c, 'bruising', 1));
    this.parts.clear();
    this.knockedOut = false;
    return out;
  }
}
