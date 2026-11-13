import type { Settings } from '../save/Settings';

/** Recorded sets: `sfx_<set>_<n>` in the asset manifest (see public/audio/CREDITS.md). */
type SoundSet = 'punch_medium' | 'punch_heavy' | 'body_medium' | 'body_heavy' | 'step' | 'glass' | 'metal' | 'cloth' | 'coins' | 'door_open' | 'door_close';

/**
 * Web Audio sound engine. Fights use recorded impacts, body falls, cloth and
 * footsteps (Kenney, CC0), layered with a little synthesis for weight. Each
 * play picks a different take than last time, nudges the pitch and level, so
 * a flurry never sounds like one sample on repeat. Whooshes, the parry tell
 * and the street's ambience are synthesised, and every recorded sound falls
 * back to its synthesised version if its file hasn't loaded.
 */
export class AudioManager {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfx!: GainNode;
  private ambience!: GainNode;
  private noiseBuffer!: AudioBuffer;
  private ambienceStarted = false;
  private settings: Settings;

  /** Recorded sounds: raw bytes as they arrive, decoded once audio is unlocked. */
  private raw = new Map<string, ArrayBuffer>();
  private decoded = new Map<string, AudioBuffer>();
  private lastTake = new Map<string, number>();

  constructor(settings: Settings) {
    this.settings = settings;
  }

  /** Hand over a recorded sound's file (id like `sfx_punch_heavy_2`); it's decoded when audio is allowed. */
  addRecorded(id: string, data: ArrayBuffer): void {
    this.raw.set(id, data);
    if (this.ctx) this.decode(id);
  }

  private decode(id: string): void {
    const data = this.raw.get(id);
    if (!data || !this.ctx || this.decoded.has(id)) return;
    // decodeAudioData takes ownership of the buffer: give it a copy.
    this.ctx.decodeAudioData(data.slice(0)).then(
      (b) => this.decoded.set(id, b),
      () => this.raw.delete(id),
    );
  }

  /** A take from a recorded set, never the same one twice running; null while none are ready. */
  private take(set: SoundSet): AudioBuffer | null {
    const ready: number[] = [];
    for (let i = 0; i < 6; i++) if (this.decoded.has(`sfx_${set}_${i}`)) ready.push(i);
    if (!ready.length) return null;
    const last = this.lastTake.get(set);
    const pool = ready.length > 1 ? ready.filter((i) => i !== last) : ready;
    const i = pool[Math.floor(Math.random() * pool.length)];
    this.lastTake.set(set, i);
    return this.decoded.get(`sfx_${set}_${i}`)!;
  }

  /** Play a take with a little random pitch and level. Returns false if the set isn't loaded (use the synth). */
  private play(set: SoundSet, gain: number, rate = 1, delay = 0, spread = 0.06): boolean {
    const buf = this.take(set);
    if (!buf || !this.ctx) return false;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate * (1 + (Math.random() * 2 - 1) * spread);
    const g = this.ctx.createGain();
    g.gain.value = gain * (0.9 + Math.random() * 0.2);
    src.connect(g).connect(this.sfx);
    src.start(this.ctx.currentTime + delay);
    return true;
  }

  /** Browsers only allow audio after a user gesture; call from the first click/tap/key. */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.sfx = this.ctx.createGain();
    this.ambience = this.ctx.createGain();
    this.sfx.connect(this.master);
    this.ambience.connect(this.master);
    this.master.connect(this.ctx.destination);
    this.noiseBuffer = this.makeNoise(2);
    this.applySettings(this.settings);
    for (const id of this.raw.keys()) this.decode(id);
  }

  applySettings(s: Settings): void {
    this.settings = s;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(s.masterVolume, t, 0.05);
    this.sfx.gain.setTargetAtTime(s.effectsVolume, t, 0.05);
    this.ambience.gain.setTargetAtTime(s.ambienceVolume * 0.6, t, 0.2);
  }

  private makeNoise(seconds: number): AudioBuffer {
    const ctx = this.ctx!;
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  private noise(dest: AudioNode, start: number, dur: number, filterType: BiquadFilterType, freq: number, gain: number, q = 1): BiquadFilterNode {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, start);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    src.connect(filter).connect(g).connect(dest);
    src.start(start, Math.random() * 1.5);
    src.stop(start + dur + 0.02);
    return filter;
  }

  private thump(dest: AudioNode, start: number, freq: number, dur: number, gain: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, start);
    osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq * 0.4), start + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, start);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(g).connect(dest);
    osc.start(start);
    osc.stop(start + dur + 0.02);
  }

  /** Swing: a whoosh, with the rustle of clothes behind it; heavier moves are lower and longer. */
  swing(heavy: boolean): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const cloth = this.play('cloth', heavy ? 0.32 : 0.2, heavy ? 0.85 : 1.15, 0, 0.1);
    const f = this.noise(this.sfx, t, heavy ? 0.22 : 0.12, 'bandpass', heavy ? 700 : 1400, (heavy ? 0.25 : 0.15) * (cloth ? 0.75 : 1), 1.2);
    f.frequency.setValueAtTime(heavy ? 400 : 900, t);
    f.frequency.exponentialRampToValueAtTime(heavy ? 1500 : 2600, t + (heavy ? 0.2 : 0.1));
  }

  /**
   * Body impact; weight 0 (jab) .. 1 (heavy). A recorded punch (lighter takes pitched up for jabs), a
   * body thud under the heavy ones, and a short synthesised low end so it lands in the chest.
   */
  impact(weight: number, clean: boolean): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const pitch = 1 + (Math.random() - 0.5) * 0.15;
    const heavy = weight >= 0.7;
    const recorded = heavy ? this.play('punch_heavy', 0.95, 0.95) : this.play('punch_medium', 0.5 + weight * 0.5, 1.12 - weight * 0.15);
    if (recorded) {
      if (heavy) this.play('body_heavy', 0.35, 1.05, 0.01);
      if (clean) this.play('punch_heavy', 0.3, 1.25, 0.012);
      this.thump(this.sfx, t, (100 - weight * 40) * pitch, 0.08 + weight * 0.12, 0.25 + weight * 0.25);
      return;
    }
    this.thump(this.sfx, t, (110 - weight * 45) * pitch, 0.12 + weight * 0.18, 0.7 + weight * 0.3);
    this.noise(this.sfx, t, 0.05 + weight * 0.06, 'lowpass', 2200 - weight * 900, 0.55 + weight * 0.25);
    if (clean) this.noise(this.sfx, t, 0.08, 'highpass', 3500, 0.25);
  }

  /** Blocked hit: a dull, padded thud on the forearms with a slap on top. */
  block(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const recorded = this.play('body_medium', 0.6, 1.15);
    this.noise(this.sfx, t, 0.06, 'bandpass', 1800, recorded ? 0.22 : 0.45, 2);
    if (!recorded) this.thump(this.sfx, t, 160, 0.08, 0.35);
  }

  /** An enemy squaring up to parry: a short, bright scrape you learn to listen for. */
  tell(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.noise(this.sfx, t, 0.07, 'bandpass', 5200, 0.22, 6);
  }

  /** A big shot being loaded up at you: a low swell you learn to block or move on. */
  danger(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const f = this.noise(this.sfx, t, 0.18, 'bandpass', 300, 0.2, 2);
    f.frequency.setValueAtTime(220, t);
    f.frequency.exponentialRampToValueAtTime(520, t + 0.16);
  }

  guardBreak(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const recorded = this.play('punch_heavy', 1, 0.82);
    if (recorded) this.play('body_heavy', 0.6, 0.9, 0.02);
    this.noise(this.sfx, t, 0.25, 'bandpass', 900, recorded ? 0.3 : 0.6, 0.8);
    this.thump(this.sfx, t, 90, 0.3, recorded ? 0.5 : 0.8);
  }

  /** Hitting the floor: the body lands a beat after the blow. */
  knockdown(): void {
    if (!this.ctx) return;
    if (this.play('body_heavy', 1, 0.88, 0.25)) {
      this.play('step', 0.35, 0.8, 0.32);
      this.thump(this.sfx, this.ctx.currentTime + 0.25, 65, 0.25, 0.45);
      return;
    }
    const t = this.ctx.currentTime + 0.25;
    this.thump(this.sfx, t, 70, 0.35, 0.9);
    this.noise(this.sfx, t, 0.3, 'lowpass', 600, 0.5);
  }

  /** Out cold: the big shot, then the body going down. */
  ko(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (this.play('punch_heavy', 1, 0.82)) {
      this.play('body_heavy', 1, 0.8, 0.38);
      this.thump(this.sfx, t, 55, 0.6, 0.6);
      return;
    }
    this.thump(this.sfx, t, 55, 0.9, 1);
    this.noise(this.sfx, t, 0.7, 'lowpass', 400, 0.4);
  }

  step(): void {
    if (!this.ctx) return;
    if (this.play('step', 0.16, 1, 0, 0.08)) return;
    this.noise(this.sfx, this.ctx.currentTime, 0.05, 'bandpass', 500 + Math.random() * 200, 0.08, 1.5);
  }

  /** A bottle smashing (or another weapon breaking). */
  smash(glass: boolean): void {
    if (!this.ctx) return;
    if (glass ? this.play('glass', 0.8) : this.play('metal', 0.5, 0.8)) return;
    this.noise(this.sfx, this.ctx.currentTime, 0.25, 'highpass', glass ? 4000 : 1500, 0.35);
  }

  /** Picking up cash. */
  coins(): void {
    if (!this.ctx) return;
    if (!this.play('coins', 0.55)) this.uiConfirm();
  }

  /** Going in or out of a building. */
  door(): void {
    if (!this.ctx) return;
    if (this.play('door_open', 0.5)) this.play('door_close', 0.45, 1, 0.55);
  }

  uiMove(): void {
    if (!this.ctx) return;
    this.noise(this.sfx, this.ctx.currentTime, 0.03, 'highpass', 4000, 0.08);
  }

  uiConfirm(): void {
    if (!this.ctx) return;
    this.thump(this.sfx, this.ctx.currentTime, 220, 0.12, 0.3);
  }

  // ---- the house (Stage 12) ----

  private loops = new Map<string, { stop: () => void }>();

  /** A filtered-noise loop that fades in and out: running water, the shower, a sizzling pan. */
  loop(id: 'shower' | 'tap' | 'sizzle' | 'oven', on: boolean): void {
    const cur = this.loops.get(id);
    if (!on) {
      cur?.stop();
      this.loops.delete(id);
      return;
    }
    if (!this.ctx || cur) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    const g = ctx.createGain();
    const t = ctx.currentTime;
    const spec = { shower: ['bandpass', 2600, 0.5, 0.22], tap: ['bandpass', 3200, 0.8, 0.12], sizzle: ['highpass', 5000, 0.7, 0.1], oven: ['lowpass', 180, 0.7, 0.12] } as const;
    const [type, freq, q, vol] = spec[id];
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.3);
    // Crackle on the pan: the level wobbles.
    let lfo: OscillatorNode | null = null;
    if (id === 'sizzle' || id === 'shower') {
      lfo = ctx.createOscillator();
      lfo.frequency.value = id === 'sizzle' ? 13 : 3;
      const lg = ctx.createGain();
      lg.gain.value = vol * 0.35;
      lfo.connect(lg).connect(g.gain);
      lfo.start();
    }
    src.connect(f).connect(g).connect(this.sfx);
    src.start();
    this.loops.set(id, {
      stop: () => {
        const now = ctx.currentTime;
        g.gain.cancelScheduledValues(now);
        g.gain.setValueAtTime(Math.max(0.0001, g.gain.value), now);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
        src.stop(now + 0.4);
        lfo?.stop(now + 0.4);
      },
    });
  }

  stopLoops(): void {
    for (const id of [...this.loops.keys()]) this.loop(id as 'shower', false);
  }

  /** One-off household sounds. */
  house(kind: 'fridge_open' | 'fridge_close' | 'cupboard' | 'chop' | 'clink' | 'eat' | 'flush' | 'tap_on' | 'switch' | 'bed' | 'brush'): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    switch (kind) {
      case 'fridge_open':
        this.noise(this.sfx, t, 0.12, 'lowpass', 700, 0.35);
        this.thump(this.sfx, t + 0.02, 120, 0.1, 0.2);
        break;
      case 'fridge_close':
        this.thump(this.sfx, t, 90, 0.18, 0.5);
        this.noise(this.sfx, t, 0.08, 'lowpass', 900, 0.3);
        break;
      case 'cupboard':
        this.thump(this.sfx, t, 180, 0.08, 0.35);
        this.noise(this.sfx, t, 0.05, 'bandpass', 1500, 0.2, 2);
        break;
      case 'chop':
        this.thump(this.sfx, t, 240 + Math.random() * 40, 0.05, 0.3);
        this.noise(this.sfx, t, 0.03, 'highpass', 2500, 0.15);
        break;
      case 'clink':
        this.noise(this.sfx, t, 0.12, 'bandpass', 4200 + Math.random() * 800, 0.18, 12);
        break;
      case 'eat':
        for (let i = 0; i < 3; i++) this.noise(this.sfx, t + i * 0.07, 0.05, 'bandpass', 1200 + Math.random() * 600, 0.1, 2);
        break;
      case 'flush': {
        const f = this.noise(this.sfx, t, 2.2, 'bandpass', 900, 0.35, 0.6);
        f.frequency.setValueAtTime(600, t);
        f.frequency.exponentialRampToValueAtTime(1800, t + 0.6);
        f.frequency.exponentialRampToValueAtTime(400, t + 2.2);
        this.noise(this.sfx, t, 0.1, 'highpass', 3000, 0.15);
        break;
      }
      case 'tap_on':
        this.noise(this.sfx, t, 0.06, 'highpass', 3000, 0.12);
        break;
      case 'switch':
        this.noise(this.sfx, t, 0.03, 'highpass', 5000, 0.2);
        this.thump(this.sfx, t, 300, 0.04, 0.15);
        break;
      case 'bed':
        this.noise(this.sfx, t, 0.4, 'lowpass', 500, 0.25);
        break;
      case 'brush':
        for (let i = 0; i < 4; i++) this.noise(this.sfx, t + i * 0.09, 0.07, 'bandpass', 5000, 0.08, 3);
        break;
    }
  }

  /** Night-time city bed: distant traffic rumble and wind. */
  startAmbience(): void {
    if (!this.ctx || this.ambienceStarted) return;
    this.ambienceStarted = true;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.makeNoise(4);
    src.loop = true;
    const low = ctx.createBiquadFilter();
    low.type = 'lowpass';
    low.frequency.value = 260;
    const g = ctx.createGain();
    g.gain.value = 0.5;
    // Slow swell like passing traffic.
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.25;
    lfo.connect(lfoGain).connect(g.gain);
    src.connect(low).connect(g).connect(this.ambience);
    src.start();
    lfo.start();
  }
}
