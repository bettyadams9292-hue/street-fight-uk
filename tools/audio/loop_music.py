"""
Turn a finished song into a game music loop that never clicks or jumps.

    python3 tools/audio/loop_music.py in.mp3 out.mp3 LOOP_START LOOP_END

The song plays from the top once, then loops LOOP_START..LOOP_END forever. The two points are a whole number of
bars apart, chosen where the music either side sounds the same (found by comparing the spectrum around every
pair of candidate points). This script nudges the end to the closest waveform match (within 15 ms), then blends
the last LOOP_XFADE seconds of the loop into the music that leads up to the loop start, so the jump back is
seamless whatever the decoder does at the edges. It prints the exact loop points to put in AudioManager's
MUSIC_LOOPS.
"""
import subprocess, sys, wave
import numpy as np

SR = 48000
LOOP_XFADE = 0.6
PAD = 0.5

def load(p):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', p, '-f', 's16le', '-ac', '2', '-ar', str(SR), '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.int16).reshape(-1, 2).astype(np.float64) / 32768

def main(src, dst, a, b):
    x = load(src)
    m = x.mean(1)
    A = int(round(a * SR)); B = int(round(b * SR))
    # Nudge B so the waveform just before it lines up with the waveform just before A.
    w = int(0.05 * SR); r = int(0.015 * SR)
    ref = m[A - w:A]
    best = max(range(-r, r + 1), key=lambda d: float(np.dot(ref, m[B + d - w:B + d]) / (np.linalg.norm(m[B + d - w:B + d]) + 1e-9)))
    B += best
    body = x[A:B].copy()
    n = int(LOOP_XFADE * SR)
    t = np.linspace(0, np.pi / 2, n)[:, None]
    body[-n:] = body[-n:] * np.cos(t) + x[A - n:A] * np.sin(t)
    out = np.concatenate([x[:A], body, body[:int(PAD * SR)]])
    out = np.clip(out, -1, 1)
    pcm = (out * 32767).astype(np.int16).tobytes()
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 's16le', '-ac', '2', '-ar', str(SR), '-i', '-', '-c:a', 'libmp3lame', '-b:a', '192k', dst], input=pcm, check=True)
    print(f'{dst}: loopStart {A / SR:.5f}  loopEnd {B / SR:.5f}  (loop {(B - A) / SR:.3f} s, nudged {best / SR * 1000:+.1f} ms)')

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2], float(sys.argv[3]), float(sys.argv[4]))
