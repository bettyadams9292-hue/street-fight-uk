"""Original music for Street Fight UK: three looping grime-style instrumentals, rendered offline.

    python3 tools/audio/make_music.py [out_dir]   (default: public/audio)

Writes music_menu.mp3, music_street.mp3 and music_boss.mp3. Everything is synthesised here
(no samples), so no licence applies; see public/audio/CREDITS.md.

Each track is a whole number of bars at 140 bpm. Notes that ring past the end of the loop are
wrapped round onto the start, so the loop point is seamless. Like the ambience loops, each file
is the period plus a LOOP_PAD margin either side (MP3 priming), and AudioManager plays between
LOOP_PAD and duration - LOOP_PAD.
"""
import os, subprocess, sys, tempfile
import numpy as np
from scipy import signal
from scipy.io import wavfile

SR = 44100
LOOP_PAD = 0.1
BPM = 140
BEAT = 60 / BPM
BAR = BEAT * 4
STEP = BEAT / 4  # a 16th
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), '..', '..', 'public', 'audio')


def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


class Track:
    """A stereo buffer one loop long plus a tail; add() places a mono sound at a time and pan."""

    def __init__(self, bars):
        self.period = int(round(bars * BAR * SR))
        self.buf = np.zeros((2, self.period + SR * 3))

    def add(self, t, x, pan=0.0, gain=1.0):
        i = int(round(t * SR)) % self.period
        n = min(len(x), self.buf.shape[1] - i)
        l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
        self.buf[0, i:i + n] += x[:n] * gain * l * 1.4142
        self.buf[1, i:i + n] += x[:n] * gain * r * 1.4142

    def loop(self):
        out = self.buf[:, :self.period].copy()
        tail = self.buf[:, self.period:]
        # Wrap whatever rang past the end back onto the start (and again if very long).
        k = 0
        while k < tail.shape[1]:
            n = min(self.period, tail.shape[1] - k)
            out[:, :n] += tail[:, k:k + n]
            k += n
        return out


def env(n, a=0.002, d=0.2, s=0.0, r=0.05, hold=None):
    t = np.arange(n) / SR
    hold = hold if hold is not None else n / SR
    e = np.where(t < a, t / max(a, 1e-6), s + (1 - s) * np.exp(-(t - a) / max(d, 1e-6)))
    rel = np.clip(1 - (t - hold) / max(r, 1e-6), 0, 1)
    return e * np.where(t > hold, rel, 1)


def kick(punch=1.0):
    n = int(0.5 * SR)
    t = np.arange(n) / SR
    f = 45 + 110 * np.exp(-t * 38)
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = np.sin(ph) * np.exp(-t * 7)
    click = np.random.default_rng(1).standard_normal(n) * np.exp(-t * 400) * 0.3
    return np.tanh((x + click) * 1.6 * punch)


def snare(rng, tone=190):
    n = int(0.35 * SR)
    t = np.arange(n) / SR
    noise = rng.standard_normal(n)
    b, a = signal.butter(2, [1200 / (SR / 2), 9000 / (SR / 2)], 'band')
    nz = signal.lfilter(b, a, noise) * np.exp(-t * 16)
    body = np.sin(2 * np.pi * tone * t) * np.exp(-t * 30)
    # A clap's three quick hits in front.
    clap = np.zeros(n)
    for k, d in enumerate((0, 0.009, 0.018)):
        i = int(d * SR)
        clap[i:] += signal.lfilter(b, a, rng.standard_normal(n - i)) * np.exp(-np.arange(n - i) / SR * 90) * (0.6 + 0.2 * k)
    return np.tanh((nz * 0.8 + body * 0.6 + clap * 0.5) * 1.3)


def hat(rng, open_=False):
    n = int((0.25 if open_ else 0.06) * SR)
    t = np.arange(n) / SR
    b, a = signal.butter(4, 7000 / (SR / 2), 'high')
    x = signal.lfilter(b, a, rng.standard_normal(n))
    return x * np.exp(-t * (14 if open_ else 70)) * 0.5


def sub(note, dur, glide_from=None, drive=1.4):
    """808-style sub: a sine with a pitch glide in and a little drive for phone speakers."""
    n = int((dur + 0.08) * SR)
    t = np.arange(n) / SR
    f1 = midi(note)
    f = np.full(n, f1)
    if glide_from is not None:
        f = f1 + (midi(glide_from) - f1) * np.exp(-t * 30)
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = np.sin(ph) + 0.25 * np.sin(2 * ph)  # 2nd harmonic so it shows up on small speakers
    return np.tanh(x * drive) * env(n, 0.004, 0.6, 0.55, 0.06, hold=dur)


def square_lead(note, dur, bright=1.0, rng=None):
    """The grime 'eskibeat' lead: a hard square, short and plucky, through a closing lowpass."""
    n = int((dur + 0.12) * SR)
    t = np.arange(n) / SR
    f = midi(note)
    x = signal.square(2 * np.pi * f * t, 0.5) * 0.6 + signal.square(2 * np.pi * f * 1.004 * t, 0.5) * 0.4
    cutoff = 900 + 3800 * bright * np.exp(-t * 9)
    y = np.zeros(n)
    # A cheap time-varying one-pole lowpass (twice, for 12 dB/oct).
    for _ in range(2):
        acc = 0.0
        alpha = 1 - np.exp(-2 * np.pi * cutoff / SR)
        out = np.empty(n)
        for i in range(n):
            acc += alpha[i] * (x[i] - acc)
            out[i] = acc
        x = out
    return x * env(n, 0.003, 0.18, 0.35, 0.08, hold=dur)


def bell(note, dur):
    n = int((dur + 1.2) * SR)
    t = np.arange(n) / SR
    f = midi(note)
    x = np.sin(2 * np.pi * f * t + 1.8 * np.sin(2 * np.pi * f * 3.5 * t) * np.exp(-t * 3))
    return x * np.exp(-t * 2.2) * env(n, 0.002, 10, 1, 0.3, hold=dur + 0.9)


def pad(notes, dur):
    n = int((dur + 0.6) * SR)
    t = np.arange(n) / SR
    x = np.zeros(n)
    for note in notes:
        for det in (-0.12, 0.0, 0.12):
            f = midi(note + det)
            x += signal.sawtooth(2 * np.pi * f * t + np.random.default_rng(note).random() * 6)
    b, a = signal.butter(2, 1100 / (SR / 2), 'low')
    x = signal.lfilter(b, a, x) / (len(notes) * 3)
    return x * env(n, 0.5, 10, 1, 0.5, hold=dur)


def stab(notes, dur=0.18):
    n = int((dur + 0.2) * SR)
    t = np.arange(n) / SR
    x = sum(signal.sawtooth(2 * np.pi * midi(k) * t) + signal.sawtooth(2 * np.pi * midi(k) * 1.006 * t) for k in notes)
    b, a = signal.butter(2, 2600 / (SR / 2), 'low')
    return signal.lfilter(b, a, x) / (len(notes) * 2) * env(n, 0.002, 0.12, 0.2, 0.06, hold=dur)


def room(stereo, wet=0.15):
    """A small, cheap stereo reverb: a few feedback-free echo taps with lowpassed tails."""
    out = stereo.copy()
    b, a = signal.butter(1, 3000 / (SR / 2), 'low')
    for ch, taps in ((0, (0.031, 0.067, 0.113, 0.171)), (1, (0.037, 0.073, 0.127, 0.181))):
        acc = np.zeros(stereo.shape[1])
        src = signal.lfilter(b, a, stereo[ch])
        for k, d in enumerate(taps):
            i = int(d * SR)
            acc[i:] += src[:-i] * (0.6 ** (k + 1))
        out[ch] += np.roll(acc, 0) * wet
    return out


def master(x):
    # Gentle bus glue, then normalise to -1 dBFS.
    x = np.tanh(x * 1.1) / np.tanh(1.1)
    return x / np.max(np.abs(x)) * 10 ** (-1 / 20)


def save(name, stereo, kbps=128):
    pad_n = int(SR * LOOP_PAD)
    x = np.concatenate([stereo[:, -pad_n:], stereo, stereo[:, :pad_n]], axis=1)
    x = master(x)
    with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as f:
        wavfile.write(f.name, SR, (x.T * 32767).astype(np.int16))
        subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', f.name,
                        '-c:a', 'libmp3lame', '-b:a', f'{kbps}k', os.path.join(OUT, name + '.mp3')], check=True)
        os.unlink(f.name)
    print(f'{name:16s} {x.shape[1] / SR:5.2f}s')


# A minor-key world: F# minor (the "estate at night" key). 54 = F#3.
ROOT = 42  # F#2 for the sub


def drums(tr, rng, bars, kicks, snares, hats, opens=(), kick_gain=1.0, hat_gain=0.6, skip_bars=()):
    for b in range(bars):
        if b in skip_bars:
            continue
        base = b * BAR
        for s in kicks:
            tr.add(base + s * STEP, kick(), 0, kick_gain)
        for s in snares:
            tr.add(base + s * STEP, snare(rng), 0.05, 0.75)
        for s in hats:
            accent = 1.0 if s % 4 == 2 else 0.6
            tr.add(base + s * STEP + rng.uniform(-0.004, 0.004), hat(rng), 0.35, hat_gain * accent)
        for s in opens:
            tr.add(base + s * STEP, hat(rng, True), -0.3, hat_gain * 0.7)


def menu():
    """Night bus home: halftime drums, wide pads, a lonely bell riff and a sliding sub."""
    rng = np.random.default_rng(1)
    bars = 8
    tr = Track(bars)
    chords = [(54, 57, 61), (50, 54, 57), (52, 55, 59), (49, 52, 56)]  # F#m D Em C#m(ish)
    for b in range(bars):
        tr.add(b * BAR, pad(chords[b % 4], BAR - 0.05), 0, 0.5)
    roots = [42, 38, 40, 37]
    for b in range(bars):
        r = roots[b % 4]
        tr.add(b * BAR, sub(r, BEAT * 2.5, glide_from=roots[(b - 1) % 4]), 0, 0.85)
        tr.add(b * BAR + BEAT * 3, sub(r + 12 if b % 2 else r, BEAT * 0.75), 0, 0.6)
    drums(tr, rng, bars, kicks=(0, 10), snares=(8,), hats=(0, 4, 8, 12, 14), skip_bars=(0,))
    riff = [(0, 69), (3, 73), (6, 71), (10, 66), (16, 69), (19, 73), (22, 76), (26, 74)]
    for b in range(0, bars, 2):
        for s, note in riff:
            tr.add(b * BAR + s * STEP, bell(note, STEP * 2), 0.3 if note > 70 else -0.3, 0.32)
    return room(tr.loop(), 0.22)


def street():
    """The walk: a proper eskibeat bounce, square lead, rolling hats, sub on the kicks."""
    rng = np.random.default_rng(2)
    bars = 16
    tr = Track(bars)
    kick_pat = (0, 6, 10)
    drums(tr, rng, bars, kicks=kick_pat, snares=(8,), hats=tuple(range(0, 16, 2)), opens=(14,))
    # Hat rolls on the fourth bar of each phrase.
    for b in range(3, bars, 4):
        for s in range(12, 16):
            for k in range(2):
                tr.add(b * BAR + s * STEP + k * STEP / 2, hat(rng), 0.35, 0.4)
    roots = [42, 42, 38, 40]
    for b in range(bars):
        r = roots[(b // 2) % 4]
        for s in kick_pat:
            tr.add(b * BAR + s * STEP, sub(r, STEP * (6 if s == 0 else 3), glide_from=r + 5 if s == 10 else None), 0, 0.8)
    lead = [(0, 66), (2, 66), (3, 69), (6, 66), (8, 73), (10, 71), (11, 69), (14, 64)]
    answer = [(0, 66), (2, 66), (3, 69), (6, 66), (8, 61), (10, 64), (12, 66), (14, 69)]
    for b in range(bars):
        if b < 4:
            continue  # drums and bass first, then the lead comes in
        pat = lead if b % 2 == 0 else answer
        for s, note in pat:
            tr.add(b * BAR + s * STEP, square_lead(note, STEP * 1.5, 0.8), -0.15, 0.24)
    for b in range(8, bars):
        tr.add(b * BAR + 4 * STEP, stab((57, 61, 66)), 0.4, 0.22)
    return room(tr.loop(), 0.12)


def boss():
    """The Pit: double-time hats, distorted sub, stabs on every bar, a climbing lead."""
    rng = np.random.default_rng(3)
    bars = 16
    tr = Track(bars)
    kick_pat = (0, 3, 6, 10, 13)
    drums(tr, rng, bars, kicks=kick_pat, snares=(8,), hats=tuple(range(16)), opens=(6, 14), kick_gain=1.1, hat_gain=0.45)
    for b in range(1, bars, 2):
        tr.add(b * BAR + 15 * STEP, snare(rng, 230), -0.05, 0.45)  # ghost snare pickup
    roots = [42, 42, 43, 37]
    for b in range(bars):
        r = roots[(b // 2) % 4]
        for s in kick_pat:
            tr.add(b * BAR + s * STEP, sub(r, STEP * 2.5, glide_from=r - 7 if s == 0 else None, drive=2.6), 0, 0.75)
    for b in range(bars):
        r = roots[(b // 2) % 4] + 24
        tr.add(b * BAR, stab((r, r + 3, r + 7)), 0.35, 0.3)
        tr.add(b * BAR + 6 * STEP, stab((r, r + 3, r + 7)), -0.35, 0.22)
    climb = [(0, 66), (1, 67), (2, 66), (4, 69), (5, 70), (6, 69), (8, 73), (10, 72), (12, 71), (14, 70)]
    for b in range(4, bars):
        lift = 0 if b < 12 else 5
        for s, note in climb:
            tr.add(b * BAR + s * STEP, square_lead(note + lift, STEP * 0.9, 1.0), 0.1, 0.22)
    return room(tr.loop(), 0.1)


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    save('music_menu', menu())
    save('music_street', street())
    save('music_boss', boss())
