import type { Settings } from '../save/Settings';

/**
 * Web Audio sound engine. Stage 1 sounds are synthesised in code
 * (TEMPORARY: replaced by recorded impacts, foley and ambience in Stage 7).
 * Impacts vary with move weight, so every hit sounds slightly different.
 */
export class AudioManager {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfx!: GainNode;
  private ambience!: GainNode;
  private noiseBuffer!: AudioBuffer;
  private ambienceStarted = false;
  private settings: Settings;

  constructor(settings: Settings) {
    this.settings = settings;
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

  /** Swing whoosh; heavier moves are lower and longer. */
  swing(heavy: boolean): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const f = this.noise(this.sfx, t, heavy ? 0.22 : 0.12, 'bandpass', heavy ? 700 : 1400, heavy ? 0.25 : 0.15, 1.2);
    f.frequency.setValueAtTime(heavy ? 400 : 900, t);
    f.frequency.exponentialRampToValueAtTime(heavy ? 1500 : 2600, t + (heavy ? 0.2 : 0.1));
  }

  /** Body impact; weight 0 (jab) .. 1 (heavy). */
  impact(weight: number, clean: boolean): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const pitch = 1 + (Math.random() - 0.5) * 0.15;
    this.thump(this.sfx, t, (110 - weight * 45) * pitch, 0.12 + weight * 0.18, 0.7 + weight * 0.3);
    this.noise(this.sfx, t, 0.05 + weight * 0.06, 'lowpass', 2200 - weight * 900, 0.55 + weight * 0.25);
    if (clean) this.noise(this.sfx, t, 0.08, 'highpass', 3500, 0.25);
  }

  /** Blocked hit: a sharper, duller slap on forearms. */
  block(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.noise(this.sfx, t, 0.06, 'bandpass', 1800, 0.45, 2);
    this.thump(this.sfx, t, 160, 0.08, 0.35);
  }

  guardBreak(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.noise(this.sfx, t, 0.25, 'bandpass', 900, 0.6, 0.8);
    this.thump(this.sfx, t, 90, 0.3, 0.8);
  }

  knockdown(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + 0.25;
    this.thump(this.sfx, t, 70, 0.35, 0.9);
    this.noise(this.sfx, t, 0.3, 'lowpass', 600, 0.5);
  }

  ko(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.thump(this.sfx, t, 55, 0.9, 1);
    this.noise(this.sfx, t, 0.7, 'lowpass', 400, 0.4);
  }

  step(): void {
    if (!this.ctx) return;
    this.noise(this.sfx, this.ctx.currentTime, 0.05, 'bandpass', 500 + Math.random() * 200, 0.08, 1.5);
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
