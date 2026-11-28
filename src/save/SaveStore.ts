import { sanitiseSave, type GameSave } from '../progress/Progress';
import { CharacterStore } from './CharacterStore';
import { newSave } from '../progress/Progress';

/**
 * Saves in the browser, in three slots, protected against the ways a save gets lost:
 *
 * - **Slots.** Slot 1 is the save every older version wrote (`sfuk.save.v3`), so existing players are already in
 *   it with nothing to migrate; slots 2 and 3 are new keys. The slot in use is remembered (`hg.save.slot`).
 * - **Never overwrite good with bad.** Before writing, the save is round-tripped through `sanitiseSave`; if that
 *   fails, or the JSON is suspiciously small, nothing is written and the write reports failure.
 * - **Backups.** Every write first keeps the previous good save as the slot's backup; every ten minutes of saving
 *   the slot also keeps a snapshot (`.snap`), a second, older copy for when a bad state was saved twice.
 * - **Corruption detection.** Each write stores a checksum beside the data (`.sum`); a save that doesn't match it,
 *   doesn't parse or doesn't sanitise is skipped for the backup, then the snapshot (`recovered` says which).
 * - **Export and import.** `exportSlot` gives a file's text (a `.hgsave`: game tag, format, checksum, the save);
 *   `parseImport` checks one fully (tag, checksum, sanitise) before anything can be written with `importInto`.
 *
 * The storage is a small key-value interface (`KV`), so another backend (a cloud one, with approval) can sit behind
 * the same calls later without changing the game.
 */
export type KV = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export const SLOTS = [1, 2, 3] as const;
export type Slot = (typeof SLOTS)[number];

const SLOT_KEY = 'hg.save.slot';
const base = (slot: Slot): string => (slot === 1 ? 'sfuk.save.v3' : `sfuk.save.v3.s${slot}`);
const MAIN = (s: Slot) => base(s);
const BACKUP = (s: Slot) => `${base(s)}.backup`;
const SNAP = (s: Slot) => `${base(s)}.snap`;
const SUM = (key: string) => `${key}.sum`;
/** Stage 4 saves: migrated on first load, and left untouched so nothing is lost. */
const V2_MAIN = 'sfuk.save.v2';
const V2_BACKUP = 'sfuk.save.v2.backup';
/** Snapshot at most this often (ms). */
const SNAP_EVERY = 10 * 60 * 1000;
/** A real save is several kilobytes; anything smaller than this isn't one. */
const MIN_SAVE_BYTES = 400;

export const EXPORT_TAG = 'hard-graft-save';
export const EXPORT_FORMAT = 1;

/** FNV-1a over the text: enough to tell a damaged save from a good one. */
export function checksum(text: string): string {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0).toString(16).padStart(8, '0');
}

/** What a slot holds, for the saves screen. */
export interface SlotInfo {
  slot: Slot;
  name: string;
  level: number;
  area: string;
  savedAt: string | null;
  /** The slot's main save was damaged and a backup would be used. */
  damaged: boolean;
}

export type LoadResult = { save: GameSave; recovered: boolean; migrated?: boolean; from?: 'backup' | 'snapshot' };

export class SaveStore {
  /** Why the last write failed, for the notice ('storage' full or blocked, or 'invalid' data refused). */
  lastError: 'storage' | 'invalid' | null = null;

  constructor(private readonly kv: KV | null = safeStorage()) {}

  get slot(): Slot {
    try {
      const n = Number(this.kv?.getItem(SLOT_KEY));
      return (SLOTS as readonly number[]).includes(n) ? (n as Slot) : 1;
    } catch {
      return 1;
    }
  }

  set slot(s: Slot) {
    try {
      this.kv?.setItem(SLOT_KEY, String(s));
    } catch {
      /* the slot stays where it was */
    }
  }

  /** Load the slot in use. `recovered` if a backup or snapshot had to be used; `migrated` if from a Stage 4 save. */
  load(slot: Slot = this.slot): LoadResult | null {
    const main = this.read(MAIN(slot));
    if (main) return { save: main, recovered: false };
    const backup = this.read(BACKUP(slot));
    if (backup) return { save: backup, recovered: true, from: 'backup' };
    const snap = this.read(SNAP(slot));
    if (snap) return { save: snap, recovered: true, from: 'snapshot' };
    if (slot !== 1) return null;
    // Upgrading from Stage 4: convert the v2 save (gear, weapons, cosmetics become items).
    const old = this.read(V2_MAIN) ?? this.read(V2_BACKUP);
    if (old) return { save: old, recovered: false, migrated: true };
    // First run of this version: bring over a Stage 2/3 character if there is one.
    const legacy = this.kv ? new CharacterStore(this.kv).load() : null;
    if (legacy) return { save: newSave(legacy), recovered: false };
    return null;
  }

  /** Write the slot in use (or `slot`). Refuses, and keeps what's there, if the save doesn't check out. */
  write(save: GameSave, slot: Slot = this.slot): boolean {
    this.lastError = null;
    if (!this.kv) {
      this.lastError = 'storage';
      return false;
    }
    save.savedAt = new Date().toISOString();
    let text: string;
    try {
      text = JSON.stringify(save);
    } catch {
      this.lastError = 'invalid';
      return false;
    }
    if (text.length < MIN_SAVE_BYTES || !sanitiseSave(JSON.parse(text))) {
      this.lastError = 'invalid';
      return false;
    }
    try {
      const current = this.kv.getItem(MAIN(slot));
      if (current && this.valid(MAIN(slot), current)) {
        this.kv.setItem(BACKUP(slot), current);
        this.kv.setItem(SUM(BACKUP(slot)), checksum(current));
        // An older copy every ten minutes or so, for a bad state saved twice over.
        const snapAt = Date.parse(this.readSaved(SNAP(slot)) ?? '') || 0;
        if (Date.now() - snapAt > SNAP_EVERY) {
          this.kv.setItem(SNAP(slot), current);
          this.kv.setItem(SUM(SNAP(slot)), checksum(current));
        }
      }
      this.kv.setItem(MAIN(slot), text);
      this.kv.setItem(SUM(MAIN(slot)), checksum(text));
      return true;
    } catch {
      this.lastError = 'storage';
      return false;
    }
  }

  /** Every slot's summary, for the saves screen. */
  slots(): SlotInfo[] {
    return SLOTS.map((slot) => {
      const main = this.read(MAIN(slot));
      const any = main ?? this.read(BACKUP(slot)) ?? this.read(SNAP(slot)) ?? (slot === 1 ? this.load(1)?.save ?? null : null);
      return {
        slot,
        name: any?.character.name ?? '',
        level: any?.level ?? 0,
        area: any?.area ?? '',
        savedAt: any?.savedAt ?? null,
        damaged: !main && !!any && !!this.kv?.getItem(MAIN(slot)),
      };
    });
  }

  /** Empty a slot (main, backup, snapshot). Slot 1 also loses the old-version saves it was made from. */
  clearSlot(slot: Slot): void {
    try {
      for (const k of [MAIN(slot), BACKUP(slot), SNAP(slot)]) {
        this.kv?.removeItem(k);
        this.kv?.removeItem(SUM(k));
      }
      if (slot === 1) {
        this.kv?.removeItem(V2_MAIN);
        this.kv?.removeItem(V2_BACKUP);
        this.kv?.removeItem('sfuk.character.v1');
      }
    } catch {
      /* ignore */
    }
  }

  /** Clear the slot in use (a new game in it). */
  clear(): void {
    this.clearSlot(this.slot);
  }

  /** The text of a `.hgsave` file for a slot, or null if it's empty. */
  exportSlot(slot: Slot = this.slot): string | null {
    const save = this.load(slot)?.save;
    if (!save) return null;
    const data = JSON.stringify(save);
    return JSON.stringify({ game: EXPORT_TAG, format: EXPORT_FORMAT, exportedAt: new Date().toISOString(), sum: checksum(data), save: data });
  }

  /** Write an already-checked save into a slot (keeping what was there as its backup). */
  importInto(save: GameSave, slot: Slot): boolean {
    return this.write(save, slot);
  }

  private valid(key: string, raw: string): boolean {
    const sum = this.kv?.getItem(SUM(key));
    if (sum && sum !== checksum(raw)) return false;
    try {
      return !!sanitiseSave(JSON.parse(raw));
    } catch {
      return false;
    }
  }

  private read(key: string): GameSave | null {
    try {
      const raw = this.kv?.getItem(key);
      if (!raw || !this.valid(key, raw)) return null;
      return sanitiseSave(JSON.parse(raw));
    } catch {
      return null;
    }
  }

  private readSaved(key: string): string | null {
    try {
      const raw = this.kv?.getItem(key);
      return raw ? ((JSON.parse(raw) as { savedAt?: string }).savedAt ?? null) : null;
    } catch {
      return null;
    }
  }
}

/** Check a `.hgsave` file (or a raw save from an old export) before anything is written. */
export function parseImport(text: string): { ok: true; save: GameSave } | { ok: false; why: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, why: 'That file isn’t a Hard Graft save (it isn’t readable).' };
  }
  const env = raw as { game?: unknown; format?: unknown; sum?: unknown; save?: unknown };
  let data: unknown = raw;
  if (env && typeof env === 'object' && env.game !== undefined) {
    if (env.game !== EXPORT_TAG) return { ok: false, why: 'That file is from something else, not Hard Graft.' };
    if (typeof env.format !== 'number' || env.format > EXPORT_FORMAT) return { ok: false, why: 'That save is from a newer version of the game.' };
    if (typeof env.save !== 'string') return { ok: false, why: 'That save file is incomplete.' };
    if (typeof env.sum === 'string' && checksum(env.save) !== env.sum) return { ok: false, why: 'That save file is damaged (its check doesn’t match).' };
    try {
      data = JSON.parse(env.save);
    } catch {
      return { ok: false, why: 'That save file is damaged.' };
    }
  }
  const save = sanitiseSave(data);
  if (!save) return { ok: false, why: 'That file doesn’t hold a fighter the game can load.' };
  return { ok: true, save };
}

function safeStorage(): KV | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}
