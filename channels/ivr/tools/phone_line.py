"""Make clean audio sound like an Indian feature-phone call. Standard library only.

What a real call does to a voice, in order:
  1. band-limit to 300-3400 Hz      (the narrowband phone channel)
  2. G.711 mu-law round trip        (the codec on most Indian voice networks)
  3. background noise at a set SNR  (fan, road, market — white noise as a stand-in)
  4. lost 20 ms packets             (weak signal; filled with silence, crude concealment)

White noise and random loss are proxies. They make comparisons honest between versions;
they do not replace recordings of real calls.

    from tools.phone_line import degrade
    phone = degrade(pcm_8k_16bit, snr_db=15, loss=0.03, seed=1)
"""

import array
import math
import random


def _biquad(samples, b0, b1, b2, a1, a2):
    out, x1, x2, y1, y2 = [], 0.0, 0.0, 0.0, 0.0
    for x in samples:
        y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
        x2, x1, y2, y1 = x1, x, y1, y
        out.append(y)
    return out


def _coeffs(kind, f, rate=8000, q=0.707):
    """RBJ audio-EQ-cookbook high/low-pass."""
    w = 2 * math.pi * f / rate
    alpha, cos = math.sin(w) / (2 * q), math.cos(w)
    if kind == "low":
        b = [(1 - cos) / 2, 1 - cos, (1 - cos) / 2]
    else:
        b = [(1 + cos) / 2, -(1 + cos), (1 + cos) / 2]
    a0 = 1 + alpha
    return [v / a0 for v in b] + [(-2 * cos) / a0, (1 - alpha) / a0]


def bandpass(samples):
    return _biquad(_biquad(samples, *_coeffs("high", 300)), *_coeffs("low", 3400))


def _mulaw(x):
    """16-bit linear -> 8-bit mu-law -> 16-bit linear (G.711 quantisation)."""
    mu, s = 255.0, max(-1.0, min(1.0, x / 32768))
    y = math.copysign(math.log1p(mu * abs(s)) / math.log1p(mu), s)
    y = round(y * 127) / 127                                       # 8-bit
    return math.copysign((math.pow(1 + mu, abs(y)) - 1) / mu, y) * 32767


def degrade(pcm: bytes, snr_db: float | None = None, loss: float = 0.0, seed: int = 0,
            codec: bool = True, band: bool = True) -> bytes:
    rng = random.Random(seed)
    x = [float(v) for v in array.array("h", pcm)]
    if band:
        x = bandpass(x)
    if snr_db is not None and x:
        rms = math.sqrt(sum(v * v for v in x) / len(x)) or 1.0
        level = rms / 10 ** (snr_db / 20)
        x = [v + rng.gauss(0, level) for v in x]
    if codec:
        x = [_mulaw(v) for v in x]
    if loss:
        for i in range(0, len(x), 160):                            # 20 ms packets
            if rng.random() < loss:
                x[i:i + 160] = [0.0] * len(x[i:i + 160])
    return array.array("h", [int(max(-32768, min(32767, v))) for v in x]).tobytes()


CONDITIONS = {
    "clean":          dict(band=False, codec=False),
    "phone":          dict(),
    "phone+noise20":  dict(snr_db=20),
    "phone+noise10":  dict(snr_db=10),
    "phone+loss5":    dict(loss=0.05),
    "phone+noise10+loss5": dict(snr_db=10, loss=0.05),
}
