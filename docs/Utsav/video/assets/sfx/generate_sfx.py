#!/usr/bin/env python3
"""Procedural UI sound effects for the demo video. No downloads, no scipy.

Run:  python3 generate_sfx.py
Writes every .wav next to this file. Re-runnable, overwrites in place.
"""
import wave
from pathlib import Path

import numpy as np

SR = 48000
PEAK_DBFS = -3.0
OUT = Path(__file__).resolve().parent
rng = np.random.default_rng(20260929)  # fixed seed => identical files every run


# ---------- primitives ----------

def t(dur):
    return np.arange(int(SR * dur)) / SR


def noise(dur):
    return rng.standard_normal(int(SR * dur))


def sine(freq, dur, phase=0.0):
    """freq may be a scalar or a per-sample array (for glides)."""
    n = int(SR * dur)
    f = np.full(n, freq, float) if np.isscalar(freq) else np.asarray(freq, float)[:n]
    return np.sin(2 * np.pi * np.cumsum(f) / SR + phase)


def decay(dur, tau):
    return np.exp(-t(dur) / tau)


def bell(dur, skew=0.5):
    """Amplitude bell, peak at `skew` through the sound."""
    x = np.linspace(0, 1, int(SR * dur))
    return np.exp(-((x - skew) ** 2) / (2 * 0.22 ** 2))


def svf(x, fc, q=1.0, mode="band"):
    """Chamberlin state-variable filter. fc scalar or per-sample array => sweeps.

    ponytail: pure-python sample loop, ~1s of audio per 0.2s of CPU. Fine at
    this scale; vectorise or use scipy.sosfilt if the library ever gets big.
    """
    n = len(x)
    fc = np.full(n, fc, float) if np.isscalar(fc) else np.asarray(fc, float)[:n]
    f = 2 * np.sin(np.pi * np.clip(fc, 20, SR / 4) / SR)
    damp = 1.0 / q
    low = band = 0.0
    out = np.empty(n)
    for i in range(n):
        high = x[i] - low - damp * band
        band += f[i] * high
        low += f[i] * band
        out[i] = {"low": low, "band": band, "high": high}[mode]
    return out


def env(sig, fade=0.004):
    """Fade in/out so the edges never click."""
    k = min(int(SR * fade), len(sig) // 2)
    if k:
        ramp = np.linspace(0, 1, k)
        sig[:k] *= ramp
        sig[-k:] *= ramp[::-1]
    return sig


def write(name, sig):
    sig = np.nan_to_num(np.asarray(sig, float))
    peak = np.max(np.abs(sig))
    if peak == 0:
        raise ValueError(f"{name} is silent")
    sig = sig / peak * 10 ** (PEAK_DBFS / 20)
    pcm = np.clip(sig * 32767, -32768, 32767).astype("<i2")
    with wave.open(str(OUT / name), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    print(f"{name:18s} {len(sig)/SR:6.3f}s  peak {PEAK_DBFS:+.1f} dBFS")


# ---------- the library ----------

def click():
    d = 0.070
    n = svf(noise(d) * decay(d, 0.008), 3000, q=1.4)
    n += 0.35 * sine(2600, d) * decay(d, 0.004)
    return env(n, 0.002)


def tap():
    d = 0.090
    n = svf(noise(d) * decay(d, 0.014), 1100, q=1.1)
    n += 0.5 * sine(420, d) * decay(d, 0.020)
    return env(n, 0.003)


def swipe():
    d = 0.260
    sweep = np.geomspace(500, 5200, int(SR * d))
    return env(svf(noise(d), sweep, q=1.8) * bell(d, 0.45), 0.005)


def whoosh_big():
    d = 0.500
    sweep = np.concatenate([
        np.geomspace(250, 2600, int(SR * d * 0.6)),
        np.geomspace(2600, 700, int(SR * d) - int(SR * d * 0.6)),
    ])
    s = svf(noise(d), sweep, q=2.2) * bell(d, 0.5)
    s += 0.4 * svf(noise(d), 180, q=0.8, mode="low") * bell(d, 0.55)
    return env(s, 0.005)


def chime(dur, partials, tau):
    s = sum(a * sine(f, dur) for f, a in partials)
    return env(s * decay(dur, tau), 0.004)


def ding():
    # E6 + B6, slightly detuned upper partial
    return chime(0.700, [(1318.5, 1.0), (1976.0, 0.55), (1979.5, 0.35),
                         (2637.0, 0.12)], 0.20)


def ding_soft():
    return chime(0.500, [(1046.5, 1.0), (2093.0, 0.18)], 0.16)


def pop():
    d = 0.120
    rise = np.geomspace(180, 900, int(SR * d))
    s = sine(rise, d) * decay(d, 0.030)
    s += 0.25 * svf(noise(d) * decay(d, 0.003), 2500, q=1.2)
    return env(s, 0.002)


def keypad():
    d = 0.120
    s = sine(697, d) + sine(1209, d)
    hold = np.ones(int(SR * d))
    return env(s * hold, 0.005)


def ring():
    d = 2.5
    n = int(SR * d)
    tone = sine(400, d) * (1 + 0.25 * np.sin(2 * np.pi * 25 * t(d)))  # 25Hz AM burr
    # 0.4s on / 0.2s off, with soft 8ms edges on each burst
    gate = np.zeros(n)
    k = int(SR * 0.008)
    for start in np.arange(0, d, 0.6):
        a = int(SR * start)
        b = min(a + int(SR * 0.4), n)
        if a >= n:
            break
        gate[a:b] = 1.0
        gate[a:a + k] = np.linspace(0, 1, k)[:b - a]
        if b - a > k:
            gate[b - k:b] = np.linspace(1, 0, k)
    return env(tone * gate, 0.005)


def notify():
    d = 0.400
    half = d / 2
    lo = sine(880, half) * decay(half, 0.14)
    hi = sine(1046.5, half) * decay(half, 0.16)  # rising minor third A5 -> C6
    s = np.pad(lo, (0, len(hi)))
    s[len(lo):] += hi
    s[len(lo):] += 0.2 * sine(1760, half) * decay(half, 0.08)  # airy top on note 2
    return env(s, 0.004)


def voice_note():
    d = 0.600
    rise = np.geomspace(330, 880, int(SR * d))
    s = sine(rise, d) * bell(d, 0.4)
    s += 0.3 * sine(rise * 2, d) * bell(d, 0.5)
    s += 0.12 * svf(noise(d), 3000, q=1.0) * bell(d, 0.65)
    return env(s, 0.005)


def type_tick():
    d = 0.040
    s = svf(noise(d) * decay(d, 0.005), 2200, q=1.6)
    return env(s, 0.002)


def success():
    d = 1.2
    n = int(SR * d)
    s = np.zeros(n)
    # C6, E6, G6 arpeggio resolving
    for i, f in enumerate([1046.5, 1318.5, 1568.0]):
        start = int(SR * 0.16 * i)
        seg = min(n - start, int(SR * (d - 0.16 * i)))
        note = (sine(f, seg / SR) + 0.3 * sine(f * 2, seg / SR)) * decay(seg / SR, 0.28)
        s[start:start + len(note)] += note * (0.8 + 0.2 * i)
    return env(s, 0.005)


def paper_slide():
    """A sheet of paper sliding over another and creasing once: a soft, wide
    swoosh with a little crinkle on top. Smoother than swipe/whoosh because the
    noise stays low-passed and the envelope has no sharp attack."""
    d = 0.520
    n = int(SR * d)
    # body: broadband noise pushed through a low-pass that opens then closes
    sweep = np.concatenate([
        np.geomspace(700, 2300, int(n * 0.45)),
        np.geomspace(2300, 600, n - int(n * 0.45)),
    ])
    s = svf(noise(d), sweep, q=0.7, mode="low") * bell(d, 0.42)
    # crinkle: sparse high ticks, the fibres letting go, kept well under the body
    ticks = np.zeros(n)
    for pos in rng.uniform(0.12, 0.85, 14):
        i = int(pos * n)
        ticks[i] = rng.uniform(0.4, 1.0)
    crinkle = svf(ticks, 4200, q=2.0) * bell(d, 0.5)
    s += 0.18 * crinkle
    # a touch of air under it so the slide has weight
    s += 0.25 * svf(noise(d), 260, q=0.6, mode="low") * bell(d, 0.5)
    return env(s, 0.020)


def transition():
    d = 0.350
    sweep = np.geomspace(300, 4000, int(SR * d))
    s = svf(noise(d), sweep, q=2.5) * np.linspace(0, 1, int(SR * d)) ** 2
    s += 0.3 * sine(np.geomspace(200, 700, int(SR * d)), d) * np.linspace(0, 1, int(SR * d)) ** 3
    s[-int(SR * 0.05):] *= np.linspace(1, 0, int(SR * 0.05))
    return env(s, 0.004)


LIB = [
    ("click.wav", click),
    ("tap.wav", tap),
    ("swipe.wav", swipe),
    ("whoosh_big.wav", whoosh_big),
    ("ding.wav", ding),
    ("ding_soft.wav", ding_soft),
    ("pop.wav", pop),
    ("keypad.wav", keypad),
    ("ring.wav", ring),
    ("notify.wav", notify),
    ("voice_note.wav", voice_note),
    ("type.wav", type_tick),
    ("success.wav", success),
    ("transition.wav", transition),
    ("paper_slide.wav", paper_slide),
]


def demo():
    """Self-check: filters and envelopes behave, files land on disk."""
    # band-pass actually rejects out-of-band energy
    lo = svf(sine(200, 0.2), 3000, q=1.4, mode="band")
    mid = svf(sine(3000, 0.2), 3000, q=1.4, mode="band")
    assert np.max(np.abs(mid)) > 5 * np.max(np.abs(lo)), "band-pass not filtering"
    # fades reach zero at both edges
    e = env(np.ones(SR // 10))
    assert e[0] == 0 and e[-1] == 0, "fade did not reach zero"
    # every file exists, is 48k mono 16-bit, and peaks where we asked
    for name, _ in LIB:
        with wave.open(str(OUT / name), "rb") as w:
            assert (w.getframerate(), w.getnchannels(), w.getsampwidth()) == (SR, 1, 2), name
            a = np.frombuffer(w.readframes(w.getnframes()), "<i2").astype(float) / 32768
        peak_db = 20 * np.log10(np.max(np.abs(a)))
        assert abs(peak_db - PEAK_DBFS) < 0.3, f"{name} peak {peak_db:.2f}"
        assert abs(a[0]) < 1e-3 and abs(a[-1]) < 1e-3, f"{name} has an edge click"
    print("self-check ok")


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    for name, fn in LIB:
        write(name, fn())
    demo()
