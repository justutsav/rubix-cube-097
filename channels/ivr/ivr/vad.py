"""End-of-speech detection over 20 ms frames with webrtcvad.

Feed every caller frame; `feed` returns the finished utterance (PCM bytes) when the
caller stops talking, else None. Thresholds come from config and get tuned on real
calls (build step 4, testing plan §7).
"""

import os

import webrtcvad

FRAME_BYTES = 320                  # 20 ms at 8 kHz 16-bit


def _env(name, default):
    return int(os.environ.get(name, default))


class Endpointer:
    def __init__(self):
        self.vad = webrtcvad.Vad(_env("VAD_AGGRESSIVENESS", 2))
        self.silence_frames = _env("ENDPOINT_SILENCE_MS", 800) // 20   # 240 cut callers mid-sentence when they paused to think
        self.min_frames = _env("MIN_UTTERANCE_MS", 250) // 20
        self.max_frames = _env("MAX_UTTERANCE_MS", 15000) // 20
        self.reset()

    def reset(self):
        self.recent = []           # last 5 speech flags, to detect a start
        self.buf = []              # frames of the current utterance
        self.pre = []              # frames just before the start, kept so the first syllable is not clipped
        self.speaking = False
        self.silent_run = 0
        self.voiced = 0            # speech frames in the current utterance

    def feed(self, frame: bytes) -> bytes | None:
        if len(frame) != FRAME_BYTES:
            return None            # Exotel should always send 20 ms; ignore odd sizes
        is_speech = self.vad.is_speech(frame, 8000)

        if not self.speaking:
            self.pre = (self.pre + [frame])[-5:]
            self.recent = (self.recent + [is_speech])[-5:]
            if sum(self.recent) >= 3:
                self.speaking, self.buf, self.silent_run = True, list(self.pre), 0
                self.voiced = sum(self.recent)
            return None

        self.buf.append(frame)
        self.voiced += is_speech
        self.silent_run = 0 if is_speech else self.silent_run + 1
        if self.silent_run >= self.silence_frames or len(self.buf) >= self.max_frames:
            voiced = len(self.buf) - self.silent_run
            pcm = b"".join(self.buf)
            self.reset()
            return pcm if voiced >= self.min_frames else None   # cough / click: dropped
        return None

    @property
    def in_speech(self) -> bool:
        return self.speaking

    @property
    def speech_ms(self) -> int:
        return self.voiced * 20 if self.speaking else 0
