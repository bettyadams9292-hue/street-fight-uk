import { sanitiseSave, type GameSave } from '../progress/Progress';
import { CharacterStore } from './CharacterStore';
import { newSave } from '../progress/Progress';

const MAIN = 'sfuk.save.v3';
const BACKUP = 'sfuk.save.v3.backup';
/** Stage 4 saves: migrated on first load, and left untouched so nothing is lost. */
const V2_MAIN = 'sfuk.save.v2';
const V2_BACKUP = 'sfuk.save.v2.backup';

type KV = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/**
 * Saves the game in the browser. Every write keeps the previous good save as
 * a backup first, so a crash or closed tab mid-write can't lose progress:
 * if the main save is unreadable, the backup is used.
 */
export class SaveStore {
  constructor(private readonly kv: KV | null = safeStorage()) {}

  /** Load the save. `recovered` is true if the backup had to be used; `migrated` if it came from a Stage 4 save. */
  load(): { save: GameSave; recovered: boolean; migrated?: boolean } | null {
    const main = this.read(MAIN);
    if (main) return { save: main, recovered: false };
    const backup = this.read(BACKUP);
    if (backup) return { save: backup, recovered: true };
    // Upgrading from Stage 4: convert the v2 save (gear, weapons, cosmetics become items).
    const old = this.read(V2_MAIN) ?? this.read(V2_BACKUP);
    if (old) return { save: old, recovered: false, migrated: true };
    // First run of this version: bring over a Stage 2/3 character if there is one.
    const legacy = this.kv ? new CharacterStore(this.kv).load() : null;
    if (legacy) return { save: newSave(legacy), recovered: false };
    return null;
  }

  write(save: GameSave): boolean {
    if (!this.kv) return false;
    try {
      const current = this.kv.getItem(MAIN);
      if (current && this.read(MAIN)) this.kv.setItem(BACKUP, current);
      save.savedAt = new Date().toISOString();
      this.kv.setItem(MAIN, JSON.stringify(save));
      return true;
    } catch {
      return false;
    }
  }

  clear(): void {
    try {
      this.kv?.removeItem(MAIN);
      this.kv?.removeItem(BACKUP);
      this.kv?.removeItem(V2_MAIN);
      this.kv?.removeItem(V2_BACKUP);
      this.kv?.removeItem('sfuk.character.v1');
    } catch {
      /* ignore */
    }
  }

  private read(key: string): GameSave | null {
    try {
      const raw = this.kv?.getItem(key);
      if (!raw) return null;
      return sanitiseSave(JSON.parse(raw));
    } catch {
      return null;
    }
  }
}

function safeStorage(): KV | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}
