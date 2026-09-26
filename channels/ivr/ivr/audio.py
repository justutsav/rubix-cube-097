"""Outgoing audio: cut into 200 ms chunks and send at real-time pace.

Exotel's Voicebot rule: each chunk 3,200-100,000 bytes and a multiple of 320
(stream-voicebot-applet docs). Smaller chunks distort, so a clip's last chunk is padded
with silence up to 3,200 bytes.

Why pace instead of dumping the whole prompt at once: Exotel buffers whatever we send.
Sending only LEAD_FRAMES ahead of real time keeps that buffer small, and `clear`
empties it on barge-in (build step 5).
"""

import asyncio

from . import exotel

RATE = 8000
FRAME_MS = 200
FRAME_BYTES = RATE * 2 * FRAME_MS // 1000   # 3,200 bytes: Exotel's minimum chunk
LEAD_FRAMES = 1                             # 200 ms ahead of real time; tune on real calls


def frames(pcm: bytes):
    """200 ms chunks; the last one padded with silence so every chunk is exactly 3,200 bytes."""
    for i in range(0, len(pcm), FRAME_BYTES):
        chunk = pcm[i:i + FRAME_BYTES]
        yield chunk + b"\x00" * (FRAME_BYTES - len(chunk))


class Player:
    """Plays queued clips to one call, in order, paced on one continuous clock."""

    def __init__(self, send, stream_sid: str, lead_frames: int = LEAD_FRAMES):
        self._send = send                  # async fn(text) -> None
        self._sid = stream_sid
        self._lead = lead_frames * FRAME_MS / 1000
        self._q: asyncio.Queue = asyncio.Queue()
        self._clock = 0.0                  # loop time at which the next frame is due to be heard
        self._task = asyncio.create_task(self._run())

    def play(self, pcm: bytes, mark: str | None = None):
        self._q.put_nowait((pcm, mark))

    async def stop(self):
        """Barge-in: drop everything queued, stop the clip mid-frame, tell Exotel to flush."""
        while not self._q.empty():
            self._q.get_nowait()
            self._q.task_done()
        self._task.cancel()
        try:
            await self._task
        except asyncio.CancelledError:
            pass
        self._clock = 0.0
        self._task = asyncio.create_task(self._run())
        await self._send(exotel.clear(self._sid))

    async def close(self):
        self._task.cancel()
        try:
            await self._task
        except asyncio.CancelledError:
            pass

    async def _run(self):
        loop = asyncio.get_running_loop()
        while True:
            pcm, mark = await self._q.get()
            try:
                for f in frames(pcm):
                    self._clock = max(self._clock, loop.time())   # idle gap: restart clock
                    wait = self._clock - self._lead - loop.time()
                    if wait > 0:
                        await asyncio.sleep(wait)
                    await self._send(exotel.media(self._sid, f))
                    self._clock += FRAME_MS / 1000
                if mark:
                    await self._send(exotel.mark(self._sid, mark))
            finally:
                self._q.task_done()
