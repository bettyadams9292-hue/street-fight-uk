"""Original sound effects for Street Fight UK, designed and rendered offline.

    python3 tools/audio/make_sounds.py [out_dir]   (default: public/audio)

These replace sounds that were synthesised live in AudioManager. The live
versions were filtered noise. These are layered and shaped with modal
resonances, transients and a small room, and rendered to mono MP3. They are
original work (no samples), so no licence applies; see public/audio/CREDITS.md.

Loops (`loop_*`, `amb_*`) are made periodic. The noise is shaped in the
frequency domain, which is circular, so the loop point is seamless. Each file
is the period plus a LOOP_PAD margin either side, because MP3 encoders add
priming silence. AudioManager plays the loop between LOOP_PAD and
duration - LOOP_PAD.
"""
import os, subprocess, sys, tempfile
import numpy as np
from scipy import signal
from scipy.io import wavfile

SR = 44100
LOOP_PAD = 0.1
rng = np.random.default_rng(20261113)
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), '..', '..', 'public', 'audio')


def t_axis(dur):
    return np.arange(int(SR * dur)) / SR


def noise(dur):
    return rng.standard_normal(int(SR * dur))


def shaped_noise(n, shape):
    """Periodic noise of n samples whose spectrum follows shape(freqs) (circular, so it loops cleanly)."""
    spec = np.fft.rfft(rng.standard_normal(n))
    f = np.fft.rfftfreq(n, 1 / SR)
    x = np.fft.irfft(spec * shape(f), n)
    return x / (np.max(np.abs(x)) + 1e-9)


def band(x, lo, hi, order=2):
    if lo <= 0:
        sos = signal.butter(order, hi, 'lowpass', fs=SR, output='sos')
    elif hi >= SR / 2:
        sos = signal.butter(order, lo, 'highpass', fs=SR, output='sos')
    else:
        sos = signal.butter(order, [lo, hi], 'bandpass', fs=SR, output='sos')
    return signal.sosfilt(sos, x)


def env(n, attack, decay, sustain=0.0):
    """Attack then exponential decay (time constants in seconds)."""
    t = np.arange(n) / SR
    a = np.clip(t / max(attack, 1e-4), 0, 1)
    return a * (sustain + (1 - sustain) * np.exp(-np.maximum(t - attack, 0) / decay))


def modes(dur, freqs, decays, amps, strike=0.002):
    """A struck object: decaying sine partials plus a little contact noise."""
    t = t_axis(dur)
    x = np.zeros_like(t)
    for f, d, a in zip(freqs, decays, amps):
        x += a * np.sin(2 * np.pi * f * t + rng.uniform(0, 6.28)) * np.exp(-t / d)
    n = len(t)
    click = band(noise(dur), 1500, 9000) * env(n, 0.0002, strike)
    return x + 0.6 * click


def room(x, size=0.25, mix=0.18, damp=5000):
    """A small kitchen or bathroom: decaying, darkened noise as the impulse response."""
    n = int(SR * size)
    ir = band(rng.standard_normal(n), 0, damp) * np.exp(-np.arange(n) / SR / (size / 5))
    ir[0] = 0
    wet = np.zeros(len(x) + n)
    conv = signal.fftconvolve(x, ir)
    wet[: len(conv)] = conv[: len(x) + n]
    dry = np.concatenate([x, np.zeros(n)])
    return dry + mix * wet / (np.max(np.abs(wet)) + 1e-9) * np.max(np.abs(x))


def at(n, i, x):
    """x placed at sample i in a buffer of n samples (cut to fit)."""
    out = np.zeros(n)
    m = max(0, min(n - i, len(x)))
    out[i:i + m] = x[:m]
    return out


def fade_tail(x, ms=8):
    n = int(SR * ms / 1000)
    x = x.copy()
    x[-n:] *= np.linspace(1, 0, n)
    return x


def save(name, x, loop=False, kbps=96):
    x = np.asarray(x, dtype=np.float64)
    if loop:
        pad = int(SR * LOOP_PAD)
        x = np.concatenate([x[-pad:], x, x[:pad]])
    else:
        # Trim the silent tail, then a short fade so nothing clicks off.
        thresh = np.max(np.abs(x)) * 10 ** (-60 / 20)
        last = np.nonzero(np.abs(x) > thresh)[0]
        x = fade_tail(x[: last[-1] + 1] if len(last) else x)
    x = x / np.max(np.abs(x)) * 10 ** (-1 / 20)  # peak -1 dBFS: never clips
    with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as f:
        wavfile.write(f.name, SR, (x * 32767).astype(np.int16))
        subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', f.name, '-ac', '1',
                        '-c:a', 'libmp3lame', '-b:a', f'{kbps}k', os.path.join(OUT, name + '.mp3')], check=True)
        os.unlink(f.name)
    print(f'{name:22s} {len(x) / SR:5.2f}s')


# ---------------- fight ----------------

def swing(take):
    """A whoosh: band of air swept up then down, a little cloth flutter on top."""
    dur = 0.32 + 0.05 * take
    n = int(SR * dur)
    t = np.arange(n) / SR
    x = noise(dur)
    centre = 500 + 2200 * np.sin(np.pi * t / dur) ** 1.5 * (1 + 0.15 * take)
    out = np.zeros(n)
    step = 256
    zi = None
    for i in range(0, n, step):  # time-varying bandpass, block by block
        fc = centre[i]
        sos = signal.butter(2, [fc * 0.6, min(fc * 1.6, SR / 2 - 100)], 'bandpass', fs=SR, output='sos')
        if zi is None:
            zi = signal.sosfilt_zi(sos) * 0
        seg, zi = signal.sosfilt(sos, x[i:i + step], zi=zi)
        out[i:i + step] = seg
    shape = np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 2
    flutter = 1 + 0.25 * np.sin(2 * np.pi * (38 + 6 * take) * t)
    return out * shape * flutter


def tell():
    """A parry tell: a short metallic scrape (inharmonic partials over grit)."""
    dur = 0.22
    n = int(SR * dur)
    grit = band(noise(dur), 2500, 9000) * env(n, 0.004, 0.05)
    ring = modes(dur, [2890, 4170, 5630, 7410], [0.05, 0.04, 0.03, 0.02], [0.5, 0.35, 0.3, 0.2])
    rasp = 1 + 0.6 * np.sign(np.sin(2 * np.pi * 95 * np.arange(n) / SR))
    return 0.8 * grit * rasp + 0.5 * ring


def danger():
    """A big shot loading up: a low swell that rises in pitch and level."""
    dur = 0.6
    n = int(SR * dur)
    t = np.arange(n) / SR
    f = 70 + 90 * (t / dur) ** 1.5
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.3 * np.sin(4 * np.pi * np.cumsum(f) / SR)
    air = band(noise(dur), 250, 1200)
    shape = (t / dur) ** 2 * (1 - np.exp(-(dur - t) / 0.02))
    return (0.8 * tone + 0.5 * air) * shape


# ---------------- menu ----------------

def ui_move():
    """A crisp, dry tick."""
    dur = 0.05
    n = int(SR * dur)
    t = np.arange(n) / SR
    return np.sin(2 * np.pi * 2400 * t) * env(n, 0.0005, 0.008) + 0.4 * band(noise(dur), 3000, 12000) * env(n, 0.0002, 0.003)


def ui_confirm():
    """A punchy two-step: low knock then a bright blip a fifth above."""
    dur = 0.28
    n = int(SR * dur)
    t = np.arange(n) / SR
    knock = np.sin(2 * np.pi * 180 * t) * env(n, 0.001, 0.05)
    a = signal.square(2 * np.pi * 660 * t) * env(n, 0.002, 0.04)
    b_start = int(0.07 * SR)
    b = np.zeros(n)
    tb = t[: n - b_start]
    b[b_start:] = signal.square(2 * np.pi * 990 * tb) * env(n - b_start, 0.002, 0.07)
    return 0.9 * knock + band(0.35 * a + 0.35 * b, 0, 4500)


# ---------------- the house ----------------

def fridge_open():
    """The seal breaking, a puff of suction, bottles nudging in the door."""
    dur = 0.9
    n = int(SR * dur)
    seal = band(noise(dur), 80, 900) * env(n, 0.01, 0.09)
    pop = modes(dur, [95, 210], [0.06, 0.04], [0.6, 0.3])
    rattle = np.zeros(n)
    for k, t0 in enumerate([0.12, 0.17, 0.26]):
        i = int(t0 * SR)
        c = modes(dur - t0, [2350 + 300 * k, 5100 + 200 * k], [0.08, 0.05], [0.15, 0.1])
        rattle += at(n, i, c)
    return room(0.9 * seal + 0.7 * pop + rattle)


def fridge_close():
    """A heavy, padded thump with a bottle chink after it."""
    dur = 0.7
    n = int(SR * dur)
    thump = modes(dur, [72, 140, 260], [0.09, 0.06, 0.03], [1, 0.5, 0.25], strike=0.006)
    pad = band(noise(dur), 60, 700) * env(n, 0.002, 0.04)
    chink = np.zeros(n)
    i = int(0.05 * SR)
    chink = at(n, i, modes(dur - 0.05, [2600, 5900], [0.07, 0.04], [0.12, 0.08]))
    return room(thump + 0.6 * pad + chink)


def cupboard():
    """A wooden door shutting on its magnetic catch."""
    dur = 0.6
    n = int(SR * dur)
    knock = modes(dur, [165, 410, 870, 1490], [0.07, 0.05, 0.03, 0.02], [1, 0.6, 0.35, 0.2], strike=0.003)
    catch = np.zeros(n)
    i = int(0.012 * SR)
    c = band(noise(dur - 0.012), 2500, 9000)
    catch = at(n, i, c * env(len(c), 0.0003, 0.004))
    return room(knock + 0.8 * catch, size=0.3)


def chop(take):
    """A knife going through veg and hitting the board."""
    dur = 0.35
    n = int(SR * dur)
    slice_ = band(noise(dur), 1800, 7000) * env(n, 0.003, 0.012)
    board = np.zeros(n)
    i = int(0.014 * SR)
    f0 = 240 + 25 * take
    board = at(n, i, modes(dur - 0.014, [f0, f0 * 2.6, f0 * 5.1], [0.05, 0.03, 0.015], [1, 0.4, 0.2], strike=0.002))
    return room(0.5 * slice_ + board, size=0.2, mix=0.12)


def clink(take):
    """Glass on glass or a plate: bright inharmonic partials ringing out."""
    dur = 0.9
    base = [2140, 2380, 1960][take]
    ratios = [1, 2.32, 4.25, 6.63]
    return room(modes(dur, [base * r for r in ratios], [0.35, 0.22, 0.12, 0.07], [0.6, 0.4, 0.25, 0.15], strike=0.0008), mix=0.25)


def eat(take):
    """A few crunching bites."""
    dur = 0.45
    n = int(SR * dur)
    x = np.zeros(n)
    for k in range(3 + take % 2):
        i0 = int((0.02 + 0.11 * k + rng.uniform(0, 0.02)) * SR)
        ln = int(0.06 * SR)
        g = band(rng.standard_normal(ln), 700 + 300 * take, 4500) * env(ln, 0.002, 0.018)
        g *= 1 + 2 * (rng.random(ln) > 0.97)  # crackle grains
        x += at(n, i0, g * (1 - 0.15 * k))
    return x


def flush():
    """A toilet flush: a rush of water, gurgle, then the cistern draining down."""
    dur = 3.2
    n = int(SR * dur)
    t = np.arange(n) / SR
    rush = band(noise(dur), 300, 3500) * np.clip(t / 0.15, 0, 1) * np.exp(-np.maximum(t - 0.6, 0) / 1.0)
    swirl = 1 + 0.4 * np.sin(2 * np.pi * (3 + 2 * t) * t)
    gurgle = np.zeros(n)
    for _ in range(60):  # bubbles: short rising sines
        t0 = rng.uniform(0.3, 2.8)
        i = int(t0 * SR)
        ln = int(0.03 * SR)
        tt = np.arange(ln) / SR
        f = rng.uniform(250, 700) * (1 + 3 * tt / 0.03)
        b = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt / 0.01)
        gurgle += at(n, i, b * 0.3 * np.exp(-(t0 - 0.8) ** 2))
    refill = band(noise(dur), 1500, 6000) * 0.15 * np.clip((t - 1.5) / 0.5, 0, 1)
    handle = modes(dur, [900, 2300], [0.03, 0.02], [0.4, 0.2])
    return room(rush * swirl + gurgle + refill + handle, size=0.35, mix=0.25)


def tap_on():
    """The tap handle clicks round and the water starts."""
    dur = 0.45
    n = int(SR * dur)
    t = np.arange(n) / SR
    click = modes(dur, [1700, 3900], [0.02, 0.012], [0.5, 0.3])
    water = band(noise(dur), 1200, 6000) * np.clip((t - 0.04) / 0.12, 0, 1) * np.exp(-np.maximum(t - 0.25, 0) / 0.1)
    return room(click + 0.6 * water)


def light_switch():
    """A plastic rocker switch: press, then the snap."""
    dur = 0.12
    n = int(SR * dur)
    a = modes(dur, [2100, 4800], [0.006, 0.004], [0.4, 0.2], strike=0.001)
    b = np.zeros(n)
    i = int(0.018 * SR)
    b = at(n, i, modes(dur - 0.018, [2900, 6100], [0.01, 0.006], [0.8, 0.4], strike=0.001))
    return room(0.5 * a + b, size=0.2, mix=0.1)


# ---------------- loops ----------------

def periodic(dur, shape):
    return shaped_noise(int(SR * dur), shape)


def lfo(n, cycles, phase=0.0):
    """A sine with a whole number of cycles over n samples, so it loops."""
    return np.sin(2 * np.pi * cycles * np.arange(n) / n + phase)


def loop_oven():
    """Fan hum, UK mains buzz at 50 Hz and its harmonics, a little element tick."""
    dur = 6.0
    n = int(SR * dur)
    fan = periodic(dur, lambda f: 1 / (1 + (f / 350) ** 2) * (f > 40))
    t = np.arange(n) / SR
    hum = sum(a * np.sin(2 * np.pi * h * t) for h, a in [(50, 0.25), (100, 0.35), (150, 0.12), (200, 0.08)])
    return 0.7 * fan * (1 + 0.08 * lfo(n, 3)) + hum * 0.5


def loop_shower():
    """A broad hiss of spray with droplets spattering the tray."""
    dur = 6.0
    n = int(SR * dur)
    spray = periodic(dur, lambda f: ((f > 600) & (f < 11000)) * (1 / (1 + (f / 4500) ** 2)))
    drops = np.zeros(n)
    for _ in range(900):
        i = rng.integers(0, n)
        ln = 300
        d = band(rng.standard_normal(ln), 1500, 8000) * np.exp(-np.arange(ln) / 40)
        idx = (i + np.arange(ln)) % n  # wrap round so the loop stays seamless
        drops[idx] += d * rng.uniform(0.2, 1)
    drops /= np.max(np.abs(drops))
    return 0.8 * spray * (1 + 0.1 * lfo(n, 4)) + 0.35 * drops


def loop_tap():
    """A steady stream into a sink: a narrower band with a gurgling wobble."""
    dur = 5.0
    n = int(SR * dur)
    stream = periodic(dur, lambda f: np.exp(-((np.log(np.maximum(f, 1)) - np.log(2600)) ** 2) / 0.5))
    splash = periodic(dur, lambda f: ((f > 150) & (f < 900)) * 1.0)
    wobble = 1 + 0.2 * lfo(n, 11) + 0.1 * lfo(n, 23, 1.0)
    return stream * wobble + 0.35 * splash


def loop_sizzle():
    """Fat spitting in a pan: hiss with sharp crackles."""
    dur = 5.0
    n = int(SR * dur)
    hiss = periodic(dur, lambda f: ((f > 3000) & (f < 14000)) * 1.0)
    crackle = np.zeros(n)
    for _ in range(700):
        i = rng.integers(0, n)
        ln = 120
        c = rng.standard_normal(ln) * np.exp(-np.arange(ln) / 15)
        crackle[(i + np.arange(ln)) % n] += c * rng.uniform(0.2, 1) ** 2
    crackle = band(crackle, 1500, 16000)
    crackle /= np.max(np.abs(crackle))
    return 0.45 * hiss * (1 + 0.25 * lfo(n, 7)) + 0.8 * crackle


def amb_night():
    """Night on the estate: distant traffic swells, a low city rumble, wind, a far-off siren once a loop."""
    dur = 24.0
    n = int(SR * dur)
    rumble = periodic(dur, lambda f: (f > 25) / (1 + (f / 120) ** 2))
    traffic = periodic(dur, lambda f: np.exp(-((np.log(np.maximum(f, 1)) - np.log(500)) ** 2) / 0.6))
    swell = 0.55 + 0.45 * (0.6 * lfo(n, 3) + 0.4 * lfo(n, 5, 2.0))
    wind = periodic(dur, lambda f: ((f > 1500) & (f < 6000)) * 1.0) * (0.5 + 0.5 * lfo(n, 2, 1.0))
    t = np.arange(n) / SR
    # A far-off siren for a few seconds: two-tone, heavily muffled, fading in and out.
    s0, s1 = 9.0, 15.0
    on = np.clip(np.minimum(t - s0, s1 - t) / 1.5, 0, 1)
    f = np.where((np.floor((t - s0) / 0.9) % 2) == 0, 760, 920)
    siren = band(np.sin(2 * np.pi * np.cumsum(f) / SR), 0, 1200) * on * 0.06
    return 0.9 * rumble + 0.6 * traffic * swell + 0.12 * wind + siren


def main():
    os.makedirs(OUT, exist_ok=True)
    for k in range(3):
        save(f'swing_{k}', swing(k))
    save('tell_0', tell())
    save('danger_0', danger())
    save('ui_move_0', ui_move())
    save('ui_confirm_0', ui_confirm())
    save('house_fridge_open_0', fridge_open())
    save('house_fridge_close_0', fridge_close())
    save('house_cupboard_0', cupboard())
    for k in range(3):
        save(f'house_chop_{k}', chop(k))
        save(f'house_clink_{k}', clink(k))
        save(f'house_eat_{k}', eat(k))
    save('house_flush_0', flush(), kbps=40)  # long but soft-edged: 40 kbps keeps it under the 20 KB budget
    save('house_tap_on_0', tap_on())
    save('house_switch_0', light_switch())
    save('loop_oven_0', loop_oven(), loop=True, kbps=64)
    save('loop_shower_0', loop_shower(), loop=True, kbps=64)
    save('loop_tap_0', loop_tap(), loop=True, kbps=64)
    save('loop_sizzle_0', loop_sizzle(), loop=True, kbps=64)
    save('amb_night_0', amb_night(), loop=True, kbps=64)


if __name__ == '__main__':
    main()
