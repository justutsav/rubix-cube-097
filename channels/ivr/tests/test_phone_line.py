import array
import math

from conftest import SPEECH, frames
from ivr.vad import Endpointer
from tools.phone_line import CONDITIONS, bandpass, degrade


def _tone(freq, n=8000):
    return [8000 * math.sin(2 * math.pi * freq * i / 8000) for i in range(n)]


def _rms(x):
    return math.sqrt(sum(v * v for v in x) / len(x))


def test_bandpass_cuts_below_300_and_keeps_voice_band():
    assert _rms(bandpass(_tone(100))[800:]) < 0.3 * _rms(_tone(100))
    assert _rms(bandpass(_tone(1000))[800:]) > 0.8 * _rms(_tone(1000))


def test_codec_round_trip_is_close_but_lossy():
    pcm = array.array("h", [int(v) for v in _tone(700)]).tobytes()
    out = array.array("h", degrade(pcm, band=False))
    err = _rms([a - b for a, b in zip(array.array("h", pcm), out)])
    assert 0 < err < 0.05 * 8000 / math.sqrt(2)


def test_packet_loss_drops_whole_20ms_frames():
    pcm = array.array("h", [1000] * 16000).tobytes()
    out = array.array("h", degrade(pcm, band=False, codec=False, loss=0.5, seed=3))
    dropped = sum(1 for i in range(0, len(out), 160) if not any(out[i:i + 160]))
    assert 30 < dropped < 70                                      # ~half of 100 frames


def test_vad_still_finds_the_answer_on_a_phone_line():
    for cond in ("phone", "phone+noise20", "phone+loss5"):
        pcm = degrade(b"\x00" * 8000 + SPEECH + b"\x00" * 16000, seed=1, **CONDITIONS[cond])
        ep = Endpointer()
        got = [u for u in (ep.feed(f) for f in frames(pcm)) if u]
        assert len(got) == 1, cond
