/**
 * Your jewellery box: every piece you've bought, what you've got on, and the
 * rules for buying, wearing and selling back. Kept out of the inventory on
 * purpose, so jewellery never takes a slot, can't be dropped and isn't lost
 * when you get battered. It survives area changes, saves and reloads.
 */
import type { CharacterAppearance } from '../character/Appearance';
import type { GameSave, Progress, PurchaseResult } from '../progress/Progress';
import { record } from '../progress/finance';
import type { WearSlot } from './items';
import { FINISHES, JEWEL_CATS, JEWEL_CAT_ONE, JEWEL_SLOT, JEWELS, LEGACY_LOOKS, jewelBuyback, jewelPrice, type FinishId, type JewelCat, type JewelLook } from './jewellery';

export interface OwnedJewel {
  uid: string;
  id: string;
  finish: FinishId;
  /** What you paid. */
  paid: number;
  /** Play-time seconds when bought. */
  at: number;
}

export interface JewellerySave {
  owned: OwnedJewel[];
  /** What's on, by kind (one of each). */
  worn: Partial<Record<JewelCat, string>>;
  /** Pieces bought but not yet looked at in the jewellery box (the "new" badge). */
  unseen: string[];
  seq: number;
}

export const MAX_JEWELS = 200;

export function defaultJewellery(): JewellerySave {
  return { owned: [], worn: {}, unseen: [], seq: 1 };
}

export function sanitiseJewellery(raw: unknown): JewellerySave {
  const out = defaultJewellery();
  if (!raw || typeof raw !== 'object') return out;
  const r = raw as Partial<JewellerySave>;
  const uids = new Set<string>();
  if (Array.isArray(r.owned))
    for (const o of r.owned.slice(0, MAX_JEWELS)) {
      if (!o || typeof o.uid !== 'string' || !o.uid || o.uid.length > 32 || uids.has(o.uid)) continue;
      const d = JEWELS[o.id];
      if (!d || !d.finishes.includes(o.finish)) continue;
      uids.add(o.uid);
      const paid = typeof o.paid === 'number' && Number.isFinite(o.paid) && o.paid >= 0 ? Math.round(o.paid) : jewelPrice(d, o.finish);
      const at = typeof o.at === 'number' && Number.isFinite(o.at) && o.at >= 0 ? o.at : 0;
      out.owned.push({ uid: o.uid, id: o.id, finish: o.finish, paid, at });
    }
  if (r.worn && typeof r.worn === 'object')
    for (const c of JEWEL_CATS) {
      const uid = (r.worn as Record<string, unknown>)[c];
      const piece = typeof uid === 'string' ? out.owned.find((o) => o.uid === uid) : undefined;
      if (piece && JEWELS[piece.id].cat === c) out.worn[c] = piece.uid;
    }
  if (Array.isArray(r.unseen)) out.unseen = r.unseen.filter((u) => typeof u === 'string' && uids.has(u));
  const highest = out.owned.reduce((m, o) => Math.max(m, Number(o.uid.replace(/^j/, '')) || 0), 0);
  out.seq = Math.max(typeof r.seq === 'number' && Number.isFinite(r.seq) ? Math.floor(r.seq) : 1, highest + 1);
  return out;
}

const fail = (reason: string): PurchaseResult => ({ ok: false, reason });

export function piece(save: GameSave, uid: string): OwnedJewel | undefined {
  return save.jewellery.owned.find((o) => o.uid === uid);
}

/** How many of this design in this finish you own. */
export function ownedCount(save: GameSave, id: string, finish?: FinishId): number {
  return save.jewellery.owned.filter((o) => o.id === id && (!finish || o.finish === finish)).length;
}

export function isWorn(save: GameSave, uid: string): boolean {
  return Object.values(save.jewellery.worn).includes(uid);
}

/** Buy one: pocket money first, then the bank. It goes straight in the jewellery box. */
export function buyJewel(p: Progress, id: string, finish: FinishId, priceMult = 1): PurchaseResult & { uid?: string } {
  const d = JEWELS[id];
  if (!d) return fail('They don’t sell that.');
  if (!d.finishes.includes(finish)) return fail(`It doesn’t come in ${FINISHES[finish]?.name.toLowerCase() ?? 'that'}.`);
  const box = p.save.jewellery;
  if (box.owned.length >= MAX_JEWELS) return fail('Your jewellery box is full. Sell something back first.');
  const price = Math.round(jewelPrice(d, finish) * priceMult);
  if (!p.pay(price)) return fail(`You need £${price.toLocaleString('en-GB')}. Pocket money first, then the bank.`);
  const uid = `j${box.seq++}`;
  box.owned.push({ uid, id, finish, paid: price, at: Math.floor(p.save.playTime) });
  box.unseen.push(uid);
  record(p.save.finance, p.save.playTime, 'jewellery', `Bought ${d.name} (${FINISHES[finish].name.toLowerCase()})`, -price);
  return { ok: true, uid };
}

/**
 * Put a piece on. Whatever was in that spot comes off: another piece goes back in the box, and a plain item
 * from the shops (a Threads chain, the gumshield) goes back in your pockets, or the stash if they're full.
 */
export function wearJewel(p: Progress, uid: string): PurchaseResult {
  const s = p.save;
  const o = piece(s, uid);
  if (!o) return fail('You don’t own that.');
  const cat = JEWELS[o.id].cat;
  const slot = JEWEL_SLOT[cat];
  if (s.worn[slot]) {
    const off = p.unwear(slot);
    if (!off.ok && !p.unwear(slot, true).ok) return fail(`Take off your ${slot === 'mouth' ? 'gumshield' : 'other piece'} first: your pockets and the stash are full.`);
  }
  s.jewellery.worn[cat] = uid;
  s.jewellery.unseen = s.jewellery.unseen.filter((u) => u !== uid);
  return { ok: true };
}

export function removeJewel(p: Progress, cat: JewelCat): PurchaseResult {
  if (!p.save.jewellery.worn[cat]) return fail('Nothing on.');
  delete p.save.jewellery.worn[cat];
  return { ok: true };
}

/** Wearing a plain item in a jewellery spot takes the jewellery off (one thing per finger, wrist, neck and mouth). */
export function clearJewelForSlot(save: GameSave, slot: WearSlot): void {
  for (const c of JEWEL_CATS) if (JEWEL_SLOT[c] === slot) delete save.jewellery.worn[c];
}

/** Sell a piece back to the jeweller for 45% of today's price. Not while you're wearing it. */
export function sellJewel(p: Progress, uid: string): { ok: true; amount: number } | { ok: false; reason: string } {
  const s = p.save;
  const o = piece(s, uid);
  if (!o) return { ok: false, reason: 'You don’t own that.' };
  if (isWorn(s, uid)) return { ok: false, reason: 'Take it off first.' };
  const d = JEWELS[o.id];
  const amount = jewelBuyback(d, o.finish);
  s.jewellery.owned = s.jewellery.owned.filter((x) => x.uid !== uid);
  s.jewellery.unseen = s.jewellery.unseen.filter((u) => u !== uid);
  s.cash.pocket += amount;
  record(s.finance, s.playTime, 'jewellery', `Sold ${d.name} back to the jeweller`, amount);
  return { ok: true, amount };
}

export function markSeen(save: GameSave): void {
  save.jewellery.unseen = [];
}

/** What's on, for drawing: jewellery box pieces first, then plain items from the shops worn in the same spots. */
export function wornLooks(save: GameSave): Partial<Record<JewelCat, JewelLook>> {
  const out: Partial<Record<JewelCat, JewelLook>> = {};
  for (const c of JEWEL_CATS) {
    const uid = save.jewellery.worn[c];
    const o = uid ? piece(save, uid) : undefined;
    if (o) out[c] = { id: o.id, finish: o.finish };
    else {
      const st = save.worn[JEWEL_SLOT[c]];
      const legacy = st ? LEGACY_LOOKS[st.id] : undefined;
      if (legacy && JEWELS[legacy.id].cat === c) out[c] = legacy;
    }
  }
  return out;
}

/** Fold what you're wearing into how you look. The lighter character models get the nearest plain accessory. */
export function applyJewellery(a: CharacterAppearance, save: GameSave): void {
  const looks = wornLooks(save);
  a.jewellery = looks;
  const flag = (x: CharacterAppearance['accessories'][number]) => {
    if (!a.accessories.includes(x)) a.accessories.push(x);
  };
  if (looks.ring) flag('ring');
  if (looks.watch) flag('watch');
  if (looks.necklace) {
    flag('chain');
    // Yellow and rose metals draw as the gold chain on the classic rigs.
    a.chainColour = ['gold9', 'gold18', 'rose', 'twotone'].includes(looks.necklace.finish) ? 'gold' : 'silver';
  }
}

export function describe(o: OwnedJewel): string {
  const d = JEWELS[o.id];
  return `${d.name}, ${FINISHES[o.finish].quality}`;
}

export function catOf(o: OwnedJewel): JewelCat {
  return JEWELS[o.id].cat;
}

export { JEWEL_CAT_ONE };
