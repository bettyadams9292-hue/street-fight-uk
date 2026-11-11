import { ASSETS, type AssetEntry, type AssetKind } from './manifest';

/**
 * Loads the files in the manifest and keeps what came back.
 *
 * The rule it enforces: loading never throws and never hangs. Each asset ends
 * up `ready`, or else `failed`, `timeout` or `off`, and in those three cases
 * the caller uses the built-in version. No Three.js in here; the code that
 * knows how to read a model or a texture registers a loader for its kind.
 */
export type AssetStatus = 'idle' | 'loading' | 'ready' | 'failed' | 'timeout' | 'off';
export type Loader = (entry: AssetEntry) => Promise<unknown>;

export interface LoadProgress {
  /** 0..1, weighted by file size. */
  fraction: number;
  done: number;
  total: number;
  /** The asset that just finished. */
  last: AssetEntry | null;
}

export interface AssetReport {
  id: string;
  kind: AssetKind;
  status: AssetStatus;
  ms: number;
  usingFallback: boolean;
  fallback: string;
  error?: string;
}

interface Slot {
  status: AssetStatus;
  value: unknown;
  promise: Promise<void> | null;
  ms: number;
  error?: string;
}

export interface AssetStoreOptions {
  /** Use the built-in version of everything (`?assets=builtin`, or the older `?classic`). */
  builtinOnly?: boolean;
  /** Ids to switch off individually (`?assets=-character_male`). */
  off?: string[];
  /** Give up on a file after this long and use the built-in version. */
  timeoutMs?: number;
  entries?: AssetEntry[];
  now?: () => number;
}

export class AssetStore {
  private readonly entries: Map<string, AssetEntry>;
  private readonly slots = new Map<string, Slot>();
  private readonly loaders = new Map<AssetKind, Loader>();
  private readonly builtinOnly: boolean;
  private readonly off: Set<string>;
  private readonly timeoutMs: number;
  private readonly now: () => number;

  constructor(opts: AssetStoreOptions = {}) {
    this.entries = new Map((opts.entries ?? ASSETS).map((e) => [e.id, e]));
    this.builtinOnly = !!opts.builtinOnly;
    this.off = new Set(opts.off ?? []);
    this.timeoutMs = opts.timeoutMs ?? 15000;
    this.now = opts.now ?? (() => Date.now());
  }

  /** How to read one kind of file. */
  register(kind: AssetKind, loader: Loader): void {
    this.loaders.set(kind, loader);
  }

  entry(id: string): AssetEntry | undefined {
    return this.entries.get(id);
  }

  status(id: string): AssetStatus {
    return this.slots.get(id)?.status ?? 'idle';
  }

  /** The loaded asset, or null if the built-in version should be used. */
  get<T>(id: string): T | null {
    const s = this.slots.get(id);
    return s && s.status === 'ready' ? (s.value as T) : null;
  }

  inGroup(group: string): AssetEntry[] {
    return [...this.entries.values()].filter((e) => e.group === group);
  }

  /** Load one asset. Resolves when it's settled either way; never rejects. */
  loadOne(id: string): Promise<void> {
    const existing = this.slots.get(id);
    if (existing?.promise) return existing.promise;
    const entry = this.entries.get(id);
    const slot: Slot = { status: 'idle', value: null, promise: null, ms: 0 };
    this.slots.set(id, slot);
    if (!entry) {
      slot.status = 'failed';
      slot.error = 'not in the manifest';
      slot.promise = Promise.resolve();
      return slot.promise;
    }
    if (this.builtinOnly || this.off.has(id)) {
      slot.status = 'off';
      slot.promise = Promise.resolve();
      return slot.promise;
    }
    const loader = this.loaders.get(entry.kind);
    if (!loader) {
      slot.status = 'failed';
      slot.error = `no loader for ${entry.kind} files`;
      slot.promise = Promise.resolve();
      return slot.promise;
    }
    slot.status = 'loading';
    const t0 = this.now();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const timeout = new Promise<'timeout'>((resolve) => {
      timer = setTimeout(() => resolve('timeout'), this.timeoutMs);
    });
    const work = Promise.resolve()
      .then(() => loader(entry))
      .then(
        (value) => ({ ok: true as const, value }),
        (e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : String(e) }),
      );
    slot.promise = Promise.race([work, timeout]).then((r) => {
      if (timer) clearTimeout(timer);
      slot.ms = this.now() - t0;
      // A file that arrives after its time is up is ignored: the game has already carried on without it.
      if (r === 'timeout') slot.status = 'timeout';
      else if (r.ok && r.value != null) {
        slot.status = 'ready';
        slot.value = r.value;
      } else {
        slot.status = 'failed';
        slot.error = r.ok ? 'loader returned nothing' : r.error;
      }
    });
    return slot.promise;
  }

  /** Load a set of assets together, reporting progress as each one settles. */
  async load(ids: string[], onProgress?: (p: LoadProgress) => void): Promise<void> {
    const list = [...new Set(ids)];
    const weight = (id: string) => Math.max(1, this.entries.get(id)?.bytes ?? 1);
    const total = list.reduce((a, id) => a + weight(id), 0);
    let done = 0;
    let bytes = 0;
    onProgress?.({ fraction: list.length ? 0 : 1, done: 0, total: list.length, last: null });
    await Promise.all(
      list.map((id) =>
        this.loadOne(id).then(() => {
          done++;
          bytes += weight(id);
          onProgress?.({ fraction: total ? bytes / total : 1, done, total: list.length, last: this.entries.get(id) ?? null });
        }),
      ),
    );
  }

  loadGroup(group: string, onProgress?: (p: LoadProgress) => void): Promise<void> {
    return this.load(this.inGroup(group).map((e) => e.id), onProgress);
  }

  /** What loaded, what didn't, and what the game is using instead. */
  report(): AssetReport[] {
    return [...this.entries.values()].map((e) => {
      const s = this.slots.get(e.id);
      const status = s?.status ?? 'idle';
      return { id: e.id, kind: e.kind, status, ms: Math.round(s?.ms ?? 0), usingFallback: status !== 'ready' && status !== 'idle' && status !== 'loading', fallback: e.fallback, ...(s?.error ? { error: s.error } : {}) };
    });
  }
}

/** Read the asset switches from a page address: `?assets=builtin`, `?assets=-id1,-id2`, or the older `?classic`. */
export function assetOptionsFromQuery(search: string): Pick<AssetStoreOptions, 'builtinOnly' | 'off'> {
  const q = new URLSearchParams(search);
  const v = q.get('assets') ?? '';
  const parts = v.split(',').map((s) => s.trim()).filter(Boolean);
  return {
    builtinOnly: q.has('classic') || parts.includes('builtin'),
    off: parts.filter((p) => p.startsWith('-')).map((p) => p.slice(1)),
  };
}
