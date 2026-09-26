"""Exotel: Voicebot (AgentStream) WebSocket frames, and the Call API for callbacks.

Protocol per docs/Utsav/research/05-technical-spec.md §3.2: JSON text frames,
modelled on Twilio Media Streams. Audio is base64 16-bit PCM, 8 kHz, mono.
"""

import asyncio
import base64
import json
import logging
import os
from dataclasses import dataclass, field

import httpx

log = logging.getLogger("ivr")


@dataclass
class Event:
    kind: str                      # connected | start | media | dtmf | mark | stop | unknown
    stream_sid: str = ""
    call_sid: str = ""
    caller: str = ""               # start.from — hash it before it leaves the adapter
    called: str = ""               # start.to
    pcm: bytes = b""               # media payload, decoded
    digit: str = ""                # dtmf
    reason: str = ""               # stop
    raw: dict = field(default_factory=dict)


def parse(text: str) -> Event:
    """Parse one inbound frame. Never raises on well-formed JSON; unknown events
    come back as kind='unknown' so a new Exotel event cannot crash a call."""
    msg = json.loads(text)
    kind = msg.get("event", "")
    sid = msg.get("stream_sid", "")

    if kind == "connected":
        return Event("connected", raw=msg)
    if kind == "start":
        s = msg.get("start", {})
        return Event("start", stream_sid=sid or s.get("stream_sid", ""),
                     call_sid=s.get("call_sid", ""), caller=s.get("from", ""),
                     called=s.get("to", ""), raw=msg)
    if kind == "media":
        payload = msg.get("media", {}).get("payload", "")
        return Event("media", stream_sid=sid, pcm=base64.b64decode(payload), raw=msg)
    if kind == "dtmf":
        return Event("dtmf", stream_sid=sid, digit=msg.get("dtmf", {}).get("digit", ""), raw=msg)
    if kind == "mark":                 # Exotel echoes our mark once that audio has been played
        return Event("mark", stream_sid=sid, raw=msg)
    if kind == "stop":
        s = msg.get("stop", {})
        return Event("stop", stream_sid=sid, call_sid=s.get("call_sid", ""),
                     reason=s.get("reason", ""), raw=msg)
    return Event("unknown", stream_sid=sid, raw=msg)


def media(stream_sid: str, pcm: bytes) -> str:
    return json.dumps({"event": "media", "stream_sid": stream_sid,
                       "media": {"payload": base64.b64encode(pcm).decode()}})


def clear(stream_sid: str) -> str:
    return json.dumps({"event": "clear", "stream_sid": stream_sid})


def mark(stream_sid: str, name: str) -> str:
    return json.dumps({"event": "mark", "stream_sid": stream_sid, "mark": {"name": name}})


# --- Call API: place the callback after a missed call ---------------------------


def _cfg():
    keys = ("EXOTEL_SID", "EXOTEL_API_KEY", "EXOTEL_API_TOKEN", "EXOTEL_CALLER_ID", "EXOTEL_FLOW_URL")
    c = {k: os.environ.get(k, "") for k in keys}
    c["EXOTEL_SUBDOMAIN"] = os.environ.get("EXOTEL_SUBDOMAIN", "api.exotel.com")
    return c


RETRY_BASE_S = 0.5


async def place_call(to: str, transport: httpx.AsyncBaseTransport | None = None) -> bool:
    """Ring `to` from our number and connect it to the Voicebot flow.
    Exotel 'connect call to a flow' API. 3 tries with backoff; False if all fail."""
    c = _cfg()
    if not all(c[k] for k in ("EXOTEL_SID", "EXOTEL_API_KEY", "EXOTEL_API_TOKEN",
                              "EXOTEL_CALLER_ID", "EXOTEL_FLOW_URL")):
        log.warning("callback skipped: EXOTEL_* settings not set")
        return False
    url = f"https://{c['EXOTEL_SUBDOMAIN']}/v1/Accounts/{c['EXOTEL_SID']}/Calls/connect"
    data = {"From": to, "CallerId": c["EXOTEL_CALLER_ID"], "Url": c["EXOTEL_FLOW_URL"]}
    async with httpx.AsyncClient(auth=(c["EXOTEL_API_KEY"], c["EXOTEL_API_TOKEN"]),
                                 timeout=10, transport=transport) as client:
        for attempt in range(3):
            try:
                r = await client.post(url, data=data)
                if r.status_code < 300:
                    log.info("callback placed")
                    return True
                log.warning("callback attempt %d: HTTP %d", attempt + 1, r.status_code)
                if r.status_code < 500 and r.status_code != 429:
                    return False       # our request is wrong; retrying will not help
            except httpx.HTTPError as e:
                log.warning("callback attempt %d: %r", attempt + 1, e)
            await asyncio.sleep(RETRY_BASE_S * 2 ** attempt)
    return False
