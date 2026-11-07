import { sanitiseCharacter, type PlayerCharacter } from '../character/Character';

const KEY = 'sfuk.character.v1';

/**
 * Stores the player's fighter in the browser. Stage 4's full save system
 * (slots, autosave, inventory, missions) takes this over and migrates it.
 */
export class CharacterStore {
  constructor(private readonly storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null = safeLocalStorage()) {}

  load(): PlayerCharacter | null {
    try {
      const raw = this.storage?.getItem(KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { version?: number; character?: unknown };
      return sanitiseCharacter(parsed.character);
    } catch {
      return null;
    }
  }

  /** Returns false if the browser refused to store it (private mode, storage full). */
  save(character: PlayerCharacter): boolean {
    try {
      this.storage?.setItem(KEY, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), character }));
      return !!this.storage;
    } catch {
      return false;
    }
  }

  clear(): void {
    try {
      this.storage?.removeItem(KEY);
    } catch {
      /* ignore */
    }
  }
}

function safeLocalStorage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}
