/**
 * Player settings, saved separately from game saves so a bad save file
 * never resets controls or audio.
 */
export type Quality = 'low' | 'medium' | 'high';
export type TouchMode = 'auto' | 'on' | 'off';
export type Difficulty = 'easy' | 'normal' | 'hard';

export interface Settings {
  version: 1;
  masterVolume: number; // 0..1
  effectsVolume: number; // 0..1
  ambienceVolume: number; // 0..1
  screenShake: boolean;
  quality: Quality;
  /** The Sodium Night look: reflections, glow and colour grade. Never used at low quality. */
  lighting: boolean;
  touchControls: TouchMode;
  showHitboxes: boolean;
  showFps: boolean;
  /** Story mode only: how hard the streets hit back. */
  difficulty: Difficulty;
}

const KEY = 'sfuk.settings.v1';

export const DEFAULT_SETTINGS: Settings = {
  version: 1,
  masterVolume: 0.8,
  effectsVolume: 0.9,
  ambienceVolume: 0.5,
  screenShake: true,
  quality: 'medium',
  lighting: true,
  touchControls: 'auto',
  showHitboxes: false,
  showFps: false,
  difficulty: 'normal',
};

type Listener = (s: Settings) => void;

export class SettingsStore {
  private value: Settings;
  private listeners = new Set<Listener>();

  constructor() {
    this.value = SettingsStore.load();
  }

  get(): Readonly<Settings> {
    return this.value;
  }

  update(patch: Partial<Omit<Settings, 'version'>>): void {
    this.value = { ...this.value, ...patch };
    try {
      localStorage.setItem(KEY, JSON.stringify(this.value));
    } catch {
      /* storage can be unavailable (private mode); settings still apply this session */
    }
    for (const fn of this.listeners) fn(this.value);
  }

  reset(): void {
    this.update({ ...DEFAULT_SETTINGS });
  }

  onChange(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private static load(): Settings {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return { ...DEFAULT_SETTINGS };
      const parsed = JSON.parse(raw) as Partial<Settings>;
      // Merge over defaults so new settings added later get sensible values.
      const merged = { ...DEFAULT_SETTINGS, ...parsed, version: 1 as const };
      if (!['easy', 'normal', 'hard'].includes(merged.difficulty)) merged.difficulty = 'normal';
      return merged;
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }
}
