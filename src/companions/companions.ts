import type { Progress, PurchaseResult } from '../progress/Progress';
import type { Attributes } from '../stats/Stats';
import type { StyleId } from '../styles/StyleData';
import type { CharacterAppearance } from '../character/Appearance';
import type { FightStyleId, PersonalityId } from './personality';
import { defaultCondition, overallCondition, sanitiseCondition, treatInjury, worst, type ConditionLevel, type ConditionSave } from '../condition/condition';
import { takeStack } from '../items/Inventory';
import type { ItemStack } from '../items/Inventory';
import { ITEMS } from '../items/items';

/**
 * People you can hire to fight with you. Found in the snug at the back of
 * the Red Lion. One follows you at a time; they join fights, look after
 * themselves, never touch civilians, and get back up when a fight's over.
 */

export interface CompanionDef {
  id: string;
  name: string;
  nickname: string;
  role: string;
  style: StyleId;
  attributes: Attributes;
  /** Fee to hire (0 = earned another way). */
  fee: number;
  /** Story flag needed first. */
  requires?: string;
  requiresText?: string;
  /** Must be beaten in a fight in the pub before they'll join. */
  challenge?: boolean;
  /** AI tuning (same knobs as enemies). */
  ai: { aggression: number; blockChance: number; dodgeChance: number; parryChance: number; range: number; comboLength: number; grabChance: number; specialChance: number; reactionFrames: number };
  /** Share of normal damage they deal: help, not a carry. */
  damageMult: number;
  /** Extra max health. */
  health: number;
  strengths: string;
  weaknesses: string;
  personality: PersonalityId;
  fightStyle: FightStyleId;
  look: Partial<CharacterAppearance>;
  seed: number;
  body: 'male' | 'female';
  line: string;
}

const A = (strength: number, speed: number, endurance: number, agility: number, defence: number, technique: number): Attributes => ({ strength, speed, endurance, agility, defence, technique });

export const COMPANION_LIST: CompanionDef[] = [
  {
    personality: 'joker', fightStyle: 'mma',
    id: 'shaz', name: 'Shaz Patel', nickname: 'Shaz', role: 'Street fighter', style: 'street', attributes: A(6, 6, 6, 6, 5, 4), fee: 250,
    ai: { aggression: 0.45, blockChance: 0.3, dodgeChance: 0.1, parryChance: 0.03, range: 0.95, comboLength: 3, grabChance: 0.08, specialChance: 0.1, reactionFrames: 16 },
    damageMult: 0.7, health: 0, strengths: 'Cheap, game for anything', weaknesses: 'Nothing special', look: { top: 'hoodie', topColour: '#7a1414', bottoms: 'trackies' }, seed: 9101, body: 'female',
    line: 'Two-fifty and I’ve got your back. Can’t say fairer.',
  },
  {
    personality: 'hothead', fightStyle: 'combo',
    id: 'danny', name: 'Danny Moran', nickname: '“Jabs”', role: 'Boxing specialist', style: 'boxing', attributes: A(6, 8, 6, 6, 6, 7), fee: 450,
    ai: { aggression: 0.5, blockChance: 0.45, dodgeChance: 0.2, parryChance: 0.08, range: 1.0, comboLength: 4, grabChance: 0.02, specialChance: 0.15, reactionFrames: 12 },
    damageMult: 0.75, health: 10, strengths: 'Fast hands, long strings, slips punches', weaknesses: 'Kicks and grapplers trouble him', look: { top: 'tshirt', topColour: '#1f2a44', bottoms: 'shorts' }, seed: 9102, body: 'male',
    line: 'Ex-ABA. Point me at someone and keep out of my way.',
  },
  {
    personality: 'fast', fightStyle: 'kickboxing',
    id: 'mia', name: 'Mia Chen', nickname: 'Mia', role: 'Fast and agile fighter', style: 'kickboxing', attributes: A(5, 9, 6, 9, 5, 7), fee: 650, requires: 'boss_gaffer', requiresText: 'Beat the Gaffer first',
    ai: { aggression: 0.55, blockChance: 0.25, dodgeChance: 0.35, parryChance: 0.06, range: 1.15, comboLength: 4, grabChance: 0.02, specialChance: 0.2, reactionFrames: 10 },
    damageMult: 0.75, health: 0, strengths: 'Quick, dodges a lot, long kicks', weaknesses: 'Light: big hitters hurt her', look: { top: 'vest', topColour: '#e8e4dc', bottoms: 'shorts' }, seed: 9103, body: 'female',
    line: 'Heard you took the Gaffer down. I can work with that.',
  },
  {
    personality: 'professional', fightStyle: 'counter',
    id: 'leah', name: 'Leah Grant', nickname: 'Leah', role: 'Defensive fighter', style: 'karate', attributes: A(5, 6, 8, 6, 9, 8), fee: 700, requires: 'boss_sully', requiresText: 'Beat Sully Kane first',
    ai: { aggression: 0.3, blockChance: 0.6, dodgeChance: 0.15, parryChance: 0.15, range: 1.2, comboLength: 2, grabChance: 0.02, specialChance: 0.1, reactionFrames: 10 },
    damageMult: 0.7, health: 30, strengths: 'Blocks and parries, very hard to put down', weaknesses: 'Doesn’t finish fights quickly', look: { top: 'tshirt', topColour: '#f0eee8', bottoms: 'trackies' }, seed: 9104, body: 'female',
    line: 'I don’t start fights. I just end them.',
  },
  {
    personality: 'loyal', fightStyle: 'wrestling',
    id: 'jonno', name: 'Jonno Price', nickname: 'Jonno', role: 'Wrestler', style: 'wrestling', attributes: A(8, 5, 8, 5, 6, 6), fee: 0, challenge: true,
    ai: { aggression: 0.45, blockChance: 0.3, dodgeChance: 0.05, parryChance: 0.03, range: 0.85, comboLength: 2, grabChance: 0.3, specialChance: 0.1, reactionFrames: 14 },
    damageMult: 0.75, health: 20, strengths: 'Takedowns, holds people for you', weaknesses: 'Slow on his feet', look: { top: 'vest', topColour: '#2a5a3a', bottoms: 'trackies' }, seed: 9105, body: 'male',
    line: 'Money? Nah. Put me on my back and I’m yours.',
  },
  {
    personality: 'heavy', fightStyle: 'heavy_boxing',
    id: 'tank', name: 'Lee “Tank” Riley', nickname: 'Tank', role: 'Heavyweight brawler', style: 'boxing', attributes: A(10, 4, 9, 3, 7, 4), fee: 1200, requires: 'boss_sully', requiresText: 'Beat Sully Kane first',
    ai: { aggression: 0.5, blockChance: 0.2, dodgeChance: 0.0, parryChance: 0.0, range: 1.0, comboLength: 2, grabChance: 0.15, specialChance: 0.1, reactionFrames: 18 },
    damageMult: 0.85, health: 60, strengths: 'Hits like a lorry, soaks damage', weaknesses: 'Slow, easy to dodge', look: { top: 'puffer', topColour: '#1a1a1a', bottoms: 'jeans' }, seed: 9106, body: 'male',
    line: 'Twelve hundred. I’m worth every penny and every stitch.',
  },
  {
    personality: 'veteran', fightStyle: 'technical_boxing',
    id: 'reg', name: 'Reg Abbott', nickname: 'Old Reg', role: 'Experienced street fighter', style: 'boxing', attributes: A(7, 6, 7, 6, 8, 10), fee: 1800, requires: 'boss_ratcatcher', requiresText: 'Beat the Ratcatcher first',
    ai: { aggression: 0.4, blockChance: 0.5, dodgeChance: 0.2, parryChance: 0.2, range: 1.0, comboLength: 4, grabChance: 0.08, specialChance: 0.25, reactionFrames: 8 },
    damageMult: 0.85, health: 25, strengths: 'Reads fights, counters, never panics', weaknesses: 'Costs a fortune, not young', look: { top: 'coat', topColour: '#3a2a1a', bottoms: 'jeans' }, seed: 9107, body: 'male',
    line: 'Forty years on these streets, son. You’ll want me.',
  },
  {
    personality: 'aggressive', fightStyle: 'muay_thai',
    id: 'kay', name: 'Kayleigh Marsh', nickname: 'Kay', role: 'Muay Thai scrapper', style: 'muay_thai', attributes: A(7, 7, 7, 6, 5, 6), fee: 900, requires: 'boss_gaffer', requiresText: 'Beat the Gaffer first',
    ai: { aggression: 0.7, blockChance: 0.2, dodgeChance: 0.1, parryChance: 0.04, range: 1.0, comboLength: 3, grabChance: 0.15, specialChance: 0.2, reactionFrames: 12 },
    damageMult: 0.8, health: 15, strengths: 'Knees and elbows, never takes a step back', weaknesses: 'Barely defends; walks into counters', look: { top: 'vest', topColour: '#a01818', bottoms: 'shorts' }, seed: 9108, body: 'female',
    line: 'I don’t do waiting about. Point and I’ll go.',
  },
  {
    personality: 'brawler', fightStyle: 'street',
    id: 'paddy', name: 'Paddy Doyle', nickname: 'Paddy', role: 'Dirty street brawler', style: 'street', attributes: A(7, 6, 7, 6, 5, 5), fee: 550,
    ai: { aggression: 0.55, blockChance: 0.25, dodgeChance: 0.1, parryChance: 0.03, range: 0.95, comboLength: 3, grabChance: 0.2, specialChance: 0.15, reactionFrames: 14 },
    damageMult: 0.78, health: 15, strengths: 'Mixes punches, kicks and grabs; hard to read', weaknesses: 'Sloppy defence, no real technique', look: { top: 'hoodie', topColour: '#3a4a2a', bottoms: 'trackies' }, seed: 9109, body: 'male',
    line: 'Rules? Never heard of them. Five-fifty and I’m yours.',
  },
  {
    personality: 'weapons', fightStyle: 'weapons',
    id: 'dean', name: 'Dean “Bats” Carter', nickname: 'Bats', role: 'Weapons specialist', style: 'street', attributes: A(7, 6, 6, 5, 6, 7), fee: 1000, requires: 'boss_gaffer', requiresText: 'Beat the Gaffer first',
    ai: { aggression: 0.45, blockChance: 0.35, dodgeChance: 0.1, parryChance: 0.05, range: 1.1, comboLength: 2, grabChance: 0.04, specialChance: 0.1, reactionFrames: 13 },
    damageMult: 0.75, health: 10, strengths: 'Deadly with bats, bars and pipes; picks weapons up mid-fight', weaknesses: 'Ordinary with his fists', look: { top: 'puffer', topColour: '#22324a', bottoms: 'jeans' }, seed: 9110, body: 'male',
    line: 'Give me a bat and a reason. A grand, and I bring my own reason.',
  },
];
export const COMPANIONS: Record<string, CompanionDef> = Object.fromEntries(COMPANION_LIST.map((c) => [c.id, c]));

/** How one of your crew is doing: their level, health, injuries and what they're carrying. Kept between fights. */
export interface CompanionState {
  level: number;
  xp: number;
  /** Share of max health they have (0..1). */
  health: number;
  condition: ConditionSave;
  /** A weapon you've given them (from your pockets), or none. */
  weapon: ItemStack | null;
  fights: number;
  kos: number;
  /** Tiredness from fighting (0..100): slows their stamina; goes down resting, fastest sat down at home. */
  fatigue: number;
}

export interface CompanionSave {
  /** Hired (or won over). */
  recruited: string[];
  /** Who's following you, in the order they joined. The rest relax at home. */
  following: string[];
  state: Record<string, CompanionState>;
}

/** How many can follow you at once: one, two once Sully Kane's beaten. */
export const MAX_ACTIVE_SLOTS = 2;
export function activeSlots(p: Progress): number {
  return p.has('boss_sully') ? 2 : 1;
}
export function isFollowing(p: Progress, id: string): boolean {
  return p.save.companions.following.includes(id);
}
export const COMPANION_LEVEL_CAP = 10;
export const companionXpFor = (level: number) => Math.round(100 * Math.pow(1.35, level - 1));
/** Per level above 1: damage and health. */
export const COMPANION_LEVEL_BONUS = { damage: 0.04, health: 6 };

export function defaultCompanionState(): CompanionState {
  return { level: 1, xp: 0, health: 1, condition: defaultCondition(), weapon: null, fights: 0, kos: 0, fatigue: 0 };
}

export function defaultCompanions(): CompanionSave {
  return { recruited: [], following: [], state: {} };
}

function sanitiseState(raw: unknown, sanitiseWeapon: (st: unknown) => ItemStack | null): CompanionState {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<CompanionState>;
  const n = (v: unknown, d: number, lo: number, hi: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d);
  const weapon = r.weapon ? sanitiseWeapon(r.weapon) : null;
  return {
    level: Math.round(n(r.level, 1, 1, COMPANION_LEVEL_CAP)),
    xp: Math.round(n(r.xp, 0, 0, 1e6)),
    health: n(r.health, 1, 0.05, 1),
    condition: sanitiseCondition(r.condition),
    weapon: weapon && ITEMS[weapon.id]?.weapon ? weapon : null,
    fights: Math.round(n(r.fights, 0, 0, 1e6)),
    kos: Math.round(n(r.kos, 0, 0, 1e6)),
    fatigue: n(r.fatigue, 0, 0, 100),
  };
}

export function sanitiseCompanions(raw: unknown, sanitiseWeapon: (st: unknown) => ItemStack | null = () => null): CompanionSave {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<CompanionSave> & { active?: unknown };
  const recruited = Array.isArray(r.recruited) ? [...new Set(r.recruited.filter((x): x is string => typeof x === 'string' && !!COMPANIONS[x]))] : [];
  // Saves from before crews: the one 'active' companion is now the first follower.
  const listed = Array.isArray(r.following) ? r.following : typeof r.active === 'string' ? [r.active] : [];
  const following = [...new Set(listed.filter((x): x is string => typeof x === 'string' && recruited.includes(x)))].slice(0, MAX_ACTIVE_SLOTS);
  const rs = (r.state && typeof r.state === 'object' ? r.state : {}) as Record<string, unknown>;
  // Saves from before crew condition: everyone starts fit, level 1, empty-handed.
  const state: Record<string, CompanionState> = {};
  for (const id of recruited) state[id] = sanitiseState(rs[id], sanitiseWeapon);
  return { recruited, following, state };
}

/** Someone's state (made on demand for anyone hired). */
export function crewState(p: Progress, id: string): CompanionState {
  return (p.save.companions.state[id] ??= defaultCompanionState());
}

/** Too hurt to come out: health under 25% or a severe injury. They rest at home until they're better. */
export function companionAvailable(st: CompanionState): { ok: true } | { ok: false; reason: string } {
  const w = worst(st.condition);
  if (w && w.severity >= 3) return { ok: false, reason: 'Too badly hurt to fight: resting until a level heals' };
  if (st.health < 0.25) return { ok: false, reason: 'Too beaten up to fight: resting until they’re over 25% health' };
  return { ok: true };
}

export function companionCondition(st: CompanionState): ConditionLevel {
  return overallCondition(st.health, st.condition);
}

/** XP from a fight they were in. Returns the levels gained. */
export function companionGainXp(st: CompanionState, xp: number): number {
  let gained = 0;
  if (st.level >= COMPANION_LEVEL_CAP) return 0;
  st.xp += Math.max(0, Math.round(xp));
  while (st.level < COMPANION_LEVEL_CAP && st.xp >= companionXpFor(st.level)) {
    st.xp -= companionXpFor(st.level);
    st.level++;
    gained++;
  }
  if (st.level >= COMPANION_LEVEL_CAP) st.xp = 0;
  return gained;
}

/** Time passing: health comes back (full in about five minutes of play; three times faster resting at home). */
export function companionRecover(st: CompanionState, dt: number, atHome: boolean): void {
  if (st.health < 1) st.health = Math.min(1, st.health + (dt / 300) * (atHome ? 3 : 1));
}

/** A rough 0–100 fighting rating from their real numbers: attributes, damage share, level, health and injuries. */
export function fightRating(def: CompanionDef, st: CompanionState): number {
  const a = def.attributes;
  const avg = (a.strength + a.speed + a.endurance + a.agility + a.defence + a.technique) / 6;
  const lvl = 1 + COMPANION_LEVEL_BONUS.damage * (st.level - 1);
  const injury = st.condition.injuries.filter((i) => i.part !== 'bruising').reduce((m, i) => m * [1, 0.9, 0.78, 0.62][i.severity], 1);
  const weapon = st.weapon ? 1.08 : 1;
  const raw = avg * 9 * (def.damageMult / 0.75) * lvl * (0.55 + 0.45 * st.health) * injury * weapon;
  return Math.max(1, Math.min(100, Math.round(raw)));
}

export function hireCompanion(p: Progress, id: string): PurchaseResult {
  const c = COMPANIONS[id];
  const s = p.save.companions;
  if (!c) return { ok: false, reason: 'Who?' };
  if (s.recruited.includes(id)) return { ok: false, reason: 'Already on your side' };
  if (c.requires && !p.has(c.requires)) return { ok: false, reason: c.requiresText ?? 'Not yet' };
  if (c.challenge) return { ok: false, reason: 'Beat them first' };
  if (!p.pay(c.fee)) return { ok: false, reason: `Not enough money: need £${c.fee}` };
  s.recruited.push(id);
  s.state[id] = defaultCompanionState();
  if (s.following.length < activeSlots(p)) s.following.push(id);
  return { ok: true };
}

/** Won the challenge fight: they join for free. */
export function winChallenge(p: Progress, id: string): void {
  const s = p.save.companions;
  if (!COMPANIONS[id] || s.recruited.includes(id)) return;
  s.recruited.push(id);
  // You've just beaten them: they join a bit sore.
  s.state[id] = { ...defaultCompanionState(), health: 0.6 };
  if (s.following.length < activeSlots(p)) s.following.push(id);
}

/** Bring them along. With one slot, they swap with whoever was following; with more, a free slot is needed. */
export function followMe(p: Progress, id: string): PurchaseResult {
  const s = p.save.companions;
  if (!s.recruited.includes(id)) return { ok: false, reason: 'Not hired' };
  if (s.following.includes(id)) return { ok: true };
  const ok = companionAvailable(crewState(p, id));
  if (!ok.ok) return ok;
  const slots = activeSlots(p);
  if (s.following.length >= slots) {
    if (slots > 1) return { ok: false, reason: `All ${slots} places taken: send someone home first` };
    s.following = [];
  }
  s.following.push(id);
  return { ok: true };
}

/** Send them home to relax (they stay there until you call them). */
export function relaxAtHome(p: Progress, id: string): PurchaseResult {
  const s = p.save.companions;
  if (!s.following.includes(id)) return { ok: false, reason: 'Already at home' };
  s.following = s.following.filter((x) => x !== id);
  return { ok: true };
}

/** Old single-companion call: null sends everyone home, an id brings them (swapping if there's one slot). */
export function setActiveCompanion(p: Progress, id: string | null): PurchaseResult {
  if (!id) {
    p.save.companions.following = [];
    return { ok: true };
  }
  return followMe(p, id);
}

/** Let someone go for good (no refund). */
export function dismissCompanion(p: Progress, id: string): PurchaseResult {
  const s = p.save.companions;
  const i = s.recruited.indexOf(id);
  if (i < 0) return { ok: false, reason: 'Not hired' };
  s.recruited.splice(i, 1);
  s.following = s.following.filter((x) => x !== id);
  // Anything you gave them comes back to you (stash if your pockets are full).
  const w = s.state[id]?.weapon;
  if (w) {
    const left = p.pocket(w);
    if (left) p.save.storage.push(left);
  }
  delete s.state[id];
  return { ok: true };
}

/** Areas a companion won't follow you into: they wait upstairs. (Home they come into, and make themselves comfortable.) */
export const COMPANION_WAITS_OUTSIDE = new Set(['basement']);

/** Hand them a weapon from your pockets (they hold it in fights). Anything they had comes back to you. */
export function giveWeapon(p: Progress, id: string, uid: string): PurchaseResult {
  const st = crewState(p, id);
  const i = p.save.inventory.findIndex((x) => x.uid === uid);
  if (i < 0) return { ok: false, reason: 'Not in your pockets' };
  const stack = p.save.inventory[i];
  if (!ITEMS[stack.id]?.weapon) return { ok: false, reason: 'Not a weapon' };
  if (ITEMS[stack.id].weapon && stack.qty > 1) return { ok: false, reason: 'One at a time' };
  p.save.inventory.splice(i, 1);
  const old = st.weapon;
  st.weapon = stack;
  if (old) {
    const left = p.pocket(old);
    if (left) p.save.storage.push(left);
  }
  return { ok: true };
}

/** Take their weapon back into your pockets (or the stash if they're full). */
export function takeWeapon(p: Progress, id: string): PurchaseResult {
  const st = crewState(p, id);
  if (!st.weapon) return { ok: false, reason: 'Empty-handed' };
  const w = st.weapon;
  st.weapon = null;
  const left = p.pocket(w);
  if (left) p.save.storage.push(left);
  return { ok: true };
}

/** Patch them up with a first aid kit from your pockets: worst injury down a level, +40% health. */
export function firstAidCompanion(p: Progress, id: string): PurchaseResult {
  const st = crewState(p, id);
  const kit = p.save.inventory.find((x) => x.id === 'first_aid');
  if (!kit) return { ok: false, reason: 'No first aid kit on you' };
  if (st.health >= 1 && !st.condition.injuries.length) return { ok: false, reason: 'Nothing wrong with them' };
  const w = st.condition.injuries.filter((i) => i.part !== 'bruising').sort((a, b) => b.severity - a.severity)[0] ?? st.condition.injuries[0];
  if (w) treatInjury(st.condition, w.part);
  st.health = Math.min(1, st.health + 0.4);
  takeStack(p.save.inventory, kit.uid, 1, () => p.newUid());
  return { ok: true };
}
