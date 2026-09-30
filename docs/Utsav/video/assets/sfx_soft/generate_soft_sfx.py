#!/usr/bin/env python3
"""A soft, modern UI sound set: whooshes, slides, drags, clicks — nothing sharp.

Two rules drive every sound here:

1. **Nothing bright.** The first set had clicks with a 9 kHz spectral centroid,
   which reads as a hiss/tick rather than a UI sound. Everything here is
   low-passed so the centroid lands between roughly 700 Hz and 3 kHz.
2. **Fast attack where it matters.** A sound whose envelope peaks 300 ms in
   *sounds* late even when it starts exactly on the beat. Transients here peak
   within a few ms; the whooshes still swell (that is what makes them whooshes),
   and the video compensates by placing them earlier — see peaks.json, which
   this script writes for exactly that purpose.

    python3 generate_soft_sfx.py
"""
import json
import wave

import numpy as np

SR = 48000
rng = np.random.default_rng(7)


def lowpass(x, cutoff, order=4):
    """Zero-phase-ish one-pole cascade. Cheap, and gentle, which is the point."""
    a = np.exp(-2.0 * np.pi * cutoff / SR)
    y = x.copy()
    for _ in range(order):
        out = np.empty_like(y)
        acc = 0.0
        for i in range(len(y)):
            acc = (1 - a) * y[i] + a * acc
            out[i] = acc
        y = out
    return y


def highpass(x, cutoff):
    return x - lowpass(x, cutoff, order=2)


def env_swell(n, peak=0.5, tail=2.0):
    """Raised-cosine rise to `peak`, exponential-ish fall after."""
    t = np.linspace(0, 1, n)
    up = 0.5 - 0.5 * np.cos(np.pi * np.clip(t / peak, 0, 1))
    dn = np.exp(-tail * np.clip((t - peak) / max(1e-6, 1 - peak), 0, 1) * 3)
    return up * dn


def env_hit(n, attack_ms=4.0, decay=18.0):
    t = np.arange(n) / SR
    a = np.clip(t / (attack_ms / 1000.0), 0, 1)
    return a * np.exp(-decay * t)


def edges(x, ms=4.0):
    k = int(SR * ms / 1000)
    if k * 2 >= len(x):
        return x
    w = np.hanning(k * 2)
    x[:k] *= w[:k]
    x[-k:] *= w[k:]
    return x


def norm(x, dbfs):
    peak = np.max(np.abs(x)) or 1.0
    return x / peak * (10 ** (dbfs / 20.0))


def write(name, x, dbfs):
    x = edges(norm(np.nan_to_num(x), dbfs))
    pcm = np.clip(x * 32767, -32768, 32767).astype(np.int16)
    with wave.open(name, 'w') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    return pcm


def noise(n):
    return rng.standard_normal(n)


def sweep_noise(dur, f0, f1, peak):
    n = int(SR * dur)
    x = noise(n)
    # cheap band motion: blend a moving low-pass with a moving high-pass
    lo = lowpass(x, (f0 + f1) / 2 * 1.8)
    x = lo - lowpass(lo, np.linspace(f0, f1, n).mean() * 0.4)
    return x * env_swell(n, peak=peak)


def tone(dur, freqs, attack_ms, decay, amps=None):
    n = int(SR * dur)
    t = np.arange(n) / SR
    amps = amps or [1.0] * len(freqs)
    x = sum(a * np.sin(2 * np.pi * f * t) for f, a in zip(freqs, amps))
    return x * env_hit(n, attack_ms, decay)


SPECS = {}

# --- movement -------------------------------------------------------------
SPECS['whoosh.wav']     = (lowpass(sweep_noise(0.40, 300, 1100, 0.55), 2200), -10)
SPECS['whoosh_lo.wav']  = (lowpass(sweep_noise(0.55, 140, 620, 0.58), 1400), -10)
SPECS['slide.wav']      = (lowpass(sweep_noise(0.30, 420, 900, 0.35), 2000), -11)
SPECS['drag.wav']       = (lowpass(noise(int(SR * 0.34)) * env_swell(int(SR * 0.34), 0.4, 1.6)
                                   * (1 + 0.25 * np.sin(np.linspace(0, 38, int(SR * 0.34)))), 900), -13)

# --- taps -----------------------------------------------------------------
SPECS['click.wav'] = (lowpass(noise(int(SR * 0.045)) * env_hit(int(SR * 0.045), 2.5, 120), 2600), -9)
SPECS['tick.wav']  = (lowpass(noise(int(SR * 0.035)) * env_hit(int(SR * 0.035), 2.0, 150), 1600), -13)
SPECS['pop.wav']   = (tone(0.10, [300, 600], 4.0, 34, [1.0, 0.35]), -10)

# --- confirmations --------------------------------------------------------
SPECS['chime.wav']   = (lowpass(tone(0.55, [660, 990], 12.0, 7.5, [1.0, 0.45]), 3200), -12)
SPECS['confirm.wav'] = (lowpass(tone(0.42, [523, 784], 10.0, 9, [1.0, 0.5])
                                + np.concatenate([np.zeros(int(SR * 0.16)),
                                                  tone(0.52, [784, 1046], 10.0, 8, [1.0, 0.4])])[:int(SR * 0.42)], 3200), -11)
SPECS['notify.wav']  = (lowpass(tone(0.32, [587, 880], 9.0, 12, [1.0, 0.5]), 3000), -12)
SPECS['send.wav']    = (lowpass(tone(0.34, [420, 700], 8.0, 13, [1.0, 0.4]), 2600), -12)

# --- phone ----------------------------------------------------------------
_kp = tone(0.09, [697, 1209], 3.0, 26, [1.0, 0.85])
SPECS['keypad.wav'] = (lowpass(_kp, 2000), -14)
_n = int(SR * 1.8)
_ring = np.sin(2 * np.pi * 400 * np.arange(_n) / SR)
_gate = ((np.arange(_n) / SR) % 0.6 < 0.4).astype(float)
_gate = lowpass(_gate, 60)
SPECS['ring.wav'] = (lowpass(_ring * _gate, 1200), -16)


def main():
    peaks = {}
    for name, (data, db) in SPECS.items():
        pcm = write(name, data, db)
        env = np.abs(pcm.astype(float))
        peaks[name] = round(float(np.argmax(env)) / SR, 4)
        spec = np.abs(np.fft.rfft(pcm.astype(float) * np.hanning(len(pcm))))
        fr = np.fft.rfftfreq(len(pcm), 1 / SR)
        cen = (spec * fr).sum() / max(spec.sum(), 1e-9)
        print(f"{name:14} {len(pcm)/SR*1000:6.0f} ms   peak@ {peaks[name]*1000:5.0f} ms   centroid {cen:5.0f} Hz")

    # The video reads this and places each cue earlier by its peak offset, so the
    # audible hit lands on the animation frame instead of after it.
    with open('peaks.json', 'w') as f:
        json.dump(peaks, f, indent=2, sort_keys=True)

    demo()


def demo():
    """Self-check: nothing bright, nothing that starts or ends with a step."""
    import glob
    for f in glob.glob('*.wav'):
        with wave.open(f) as w:
            a = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(float)
        spec = np.abs(np.fft.rfft(a * np.hanning(len(a))))
        fr = np.fft.rfftfreq(len(a), 1 / SR)
        cen = (spec * fr).sum() / max(spec.sum(), 1e-9)
        assert cen < 3200, f"{f} too bright: {cen:.0f} Hz"
        assert abs(a[0]) < 200 and abs(a[-1]) < 200, f"{f} has an edge step"
        assert np.max(np.abs(a)) > 3000, f"{f} is silent"
    print("demo(): all soft, no edge clicks, none silent")


if __name__ == '__main__':
    main()
