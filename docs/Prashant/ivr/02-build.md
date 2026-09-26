# IVR channel — build document

Owner: Prashant · 2026-09-26 · Read [01-master-plan.md](01-master-plan.md) first for the why.
This file is the how: code layout, contracts, each module, setup, run, deploy.

---

## 1. Boundaries

| Lives in `channels/ivr/` (this doc) | Lives in `ai/` (AI/ML teammate) |
|---|---|
| Exotel webhook + WebSocket | Question flow (FSM), resume, consent |
| End-of-speech detection, interruption | Speech-to-text providers |
| Audio framing, pacing, format conversion | Word-list matching, AI helpers |
| Prompt WAV lookup and playback | Eligibility, recommendation |
| Callback placement | Database: people, answers, consent |
| Per-turn latency log | — |

Rules: the adapter never imports from `ai/`, never holds a question, never stores audio on
disk, never stores a raw phone number. It talks to `ai/` only over HTTP.

---

## 2. Folder layout

```
channels/ivr/
├── README.md             how to run it (short)
├── pyproject.toml
├── .env.example
├── ivr/
│   ├── server.py         FastAPI app: /missed-call, /stream (WebSocket), /health
│   ├── exotel.py         parse/emit Exotel frames; Call API client (callback)
│   ├── call.py           one live call: the turn loop, state, timers
│   ├── vad.py            end-of-speech + barge-in detection
│   ├── audio.py          base64 ⇄ PCM, 20 ms framing, paced sender
│   ├── prompts.py        prompt id → PCM bytes, loaded at startup
│   ├── engine.py         HTTP client for ai/ POST /v1/turn (timeouts, retry)
│   ├── fallback.py       canned audio + keypad-only mode when ai/ is unreachable
│   └── metrics.py        per-turn timing log (JSON lines)
├── prompts/<lang>/<id>.wav   8 kHz, 16-bit, mono (gitignored if large; manifest committed)
├── tools/
│   ├── fake_exotel.py    plays WAV "callers" into /stream like Exotel does
│   └── stub_engine.py    fixed-script /v1/turn for building before ai/ exists
└── tests/
```

Nine small modules, no framework beyond FastAPI. Add a module only when one of these grows
past ~300 lines.

---

## 3. Dependencies

| Package | For |
|---|---|
| `fastapi`, `uvicorn[standard]` | HTTP + WebSocket server |
| `httpx` | Async calls to `ai/` and Exotel API, with connection pooling |
| `webrtcvad` | End-of-speech detection (swap to Silero only if tests show webrtcvad fails on noise) |
| `numpy` | PCM math (energy, frame slicing) |
| `pytest`, `pytest-asyncio` | Tests |

Also `python-multipart` (Exotel's webhook may POST a form). Prompt generation only:
`gtts` + `miniaudio` (optional extra).

Python 3.11+, run through `uv`, identical on Linux, Windows and macOS. No OS-specific
tools anywhere. Resampling is **not** here — `ai/` owns it with speech-to-text.

---

## 4. Configuration (`channels/ivr/.env`, gitignored, read at start-up)

```
# Security
STREAM_TOKEN=            # required on the public stream (§5.1); unset = open, local only
PHONE_PEPPER=            # HMAC secret for phone numbers; same value as ai/
MISSED_CALL_SECRET=      # ?key= on the missed-call webhook
# Engine
ENGINE_URL=http://localhost:8001
ENGINE_TIMEOUT_MS=4000   # > engine worst case (Sarvam 2 s + Vosk fallback); was 1500, ended calls
TTS_TIMEOUT_MS=6000
# Listening — tuned on real Exotel calls (05-measurements.md)
VAD_AGGRESSIVENESS=2
ENDPOINT_SILENCE_MS=800  # 240 cut callers mid-sentence when they paused to think
MIN_UTTERANCE_MS=250
MAX_UTTERANCE_MS=15000
BARGE_IN_SPEECH_MS=900   # 120 cut every prompt on line noise; 400 still cut questions on "हाँ जी"
BARGE_IN_GRACE_MS=4000   # no barge-in at call start: Exotel's "this call is being recorded"
BARGE_IN_ECHO_RATIO=2.5  # speakerphone: interrupt only if 2.5x louder than our own echo (300 ms average)
BARGE_IN_MIN_RMS=300
ECHO_LEARN_MS=300        # first 300 ms of each prompt only measure the echo level
POST_PROMPT_GUARD_MS=250 # ignore the echo tail right after a prompt ends
NO_INPUT_TIMEOUT_MS=8000
FILLER_AFTER_MS=1000     # "hmm" only after 1 s; Sarvam often takes 0.7-0.8 s
MAX_CALL_SECONDS=600
# Callback (Exotel calls the user)
EXOTEL_SID= / EXOTEL_API_KEY= / EXOTEL_API_TOKEN=
EXOTEL_SUBDOMAIN=api.in.exotel.com
EXOTEL_CALLER_ID=        # our ExoPhone
EXOTEL_STREAM_URL=       # wss://<public host>/stream?token=<STREAM_TOKEN>
# Test calls only — never in production (they store audio / what was said)
SOFTPHONE=1              # serve /softphone
IVR_DEBUG_DIR=           # save each caller utterance as WAV
```

Every threshold is config, because the right numbers only come out of real calls.

---

## 5. Contracts

### 5.1 Exotel → us (WebSocket `/stream`)

We handle: `connected`, `start` (stream_sid, call_sid, from, to, media_format,
custom_parameters), `media` (base64 16-bit PCM), `dtmf` (digit), `mark`, `stop`. Unknown
events are logged and ignored, never crash the call.

Confirmed on real calls (2026-09-26): `media_format` = `{'encoding': 'base64', 'sample_rate':
'8000'}`; incoming chunks can be any multiple of 320 bytes (re-cut into 20 ms frames).
**Exotel strips query values from the Voicebot URL** and delivers them as
`start.custom_parameters`, so `STREAM_TOKEN` is accepted from `?token=` (softphone, fake
Exotel), Basic auth in the URL, or the `token` custom parameter on `start`.

### 5.2 Us → Exotel

`media` (base64 PCM, **3,200-byte chunks, Exotel's minimum**; a clip's last chunk padded
with silence), `clear` (flush playback = barge-in), `mark` (tells us when a prompt finished
playing).

### 5.3 Us → `ai/` — `POST /v1/turn`

As in spec §1.1, with one proposed change to agree with the AI/ML owner:

- **Audio inline, not by reference, for the demo.** `utterance: {"kind":"audio",
  "format":"l16","rate":8000,"data":"<base64>"}`. About 20–60 KB per answer; avoids a shared
  blob store. Move to `ref` only if the payload becomes a problem.
- Adapter sends `identity.value = HMAC-SHA256(phone_e164, PHONE_PEPPER)`. Raw number
  never leaves the adapter.
- **Two extra utterance kinds**, also to agree: `{"kind":"timeout"}` when the caller says
  nothing for `NO_INPUT_TIMEOUT_MS` (the engine picks the nudge or ends the call), and
  `{"kind":"hangup"}` when the call drops before the engine ended it.

Response fields the adapter uses: `say[]` (prompt ids / tts text), `expect` (enum options,
`dtmf_map`, `timeout_ms`), `terminal`, `state` (for logs only).

### 5.4 Exotel → us — `POST /missed-call`

Exotel passthru webhook with `CallFrom`, `CallTo`, `CallSid`. We respond 200 immediately,
then place the callback in a background task (§6.7).

---

## 6. Modules — what each one must do

### 6.1 `server.py`
- `POST /missed-call` → validate it came from Exotel (shared secret in URL or IP allow-list)
  → enqueue callback → 200.
- `WS /stream` → token check (§5.1), then one `Call` object per connection; all exceptions
  caught and turned into a graceful goodbye prompt + close.
- `GET /softphone` (only with `SOFTPHONE=1`) → browser phone speaking the Exotel protocol.
- `GET /health` → checks `ai/` reachable and prompts loaded.

### 6.2 `exotel.py`
- `parse(frame: str) -> Event` and `media(stream_sid, pcm) / clear() / mark(name)` builders.
- `place_call(to)` via Exotel's direct-stream API (`POST /v1/Accounts/{sid}/Calls/connect`
  with `StreamUrl`, `StreamType=bidirectional`), 3 tries, retries only 5xx/429.

### 6.3 `call.py` — the turn loop
State per call: `stream_sid, call_sid, phone_hash, lang, speaking(bool), buffer, expect,
timers`.

```
on start      → engine.turn(kind="opened") → play(say)
on media      → vad.feed(frame)
                 if speaking and vad.speech_started → barge_in()
                 if not speaking and vad.endpoint    → send buffer as audio turn
on dtmf       → if speaking: barge_in(); engine.turn(kind="dtmf", digits)
on no-input   → engine.turn(kind="timeout") ; engine decides the nudge
on mark(end)  → speaking = False; start no-input timer
on stop/close → engine.turn(kind="hangup")  (best effort) ; drop buffers
```

- One turn in flight at a time; audio arriving meanwhile is buffered, not lost.
- While waiting on the engine > 1 s, play the "hmm" filler prompt.
- Barge-in needs `BARGE_IN_SPEECH_MS` (900) of speech and never fires in the first
  `BARGE_IN_GRACE_MS` (4 s) of the call.
- If the engine errors or times out → `fallback.py`.

### 6.4 `vad.py`
- 20 ms frames (160 samples). `webrtcvad` decides speech/non-speech per frame.
- Speech starts: 3 of 5 recent frames are speech. Endpoint: `ENDPOINT_SILENCE_MS` of
  non-speech after speech. Discard utterances < 250 ms (coughs, clicks).
- Hard cap of 15 s per utterance → force endpoint.
- Barge-in mode during playback uses `BARGE_IN_SPEECH_MS` so the line echo of our own
  prompt does not trigger it.

### 6.5 `audio.py`
- Decode base64 → `int16` array; encode back.
- Chunk outgoing audio into 20 ms frames, send in small batches paced to real time
  (a few frames ahead), so `clear` actually stops audio fast.

### 6.6 `prompts.py`
- At startup, load every `prompts/<lang>/*.wav` into memory as raw PCM. Fail startup if a
  prompt referenced by the manifest is missing.
- `tts` items in `say[]`: request audio from `ai/` (it owns the TTS provider), cache by
  text hash for the call.

### 6.7 Callback (in `exotel.py` + `server.py`)
- Dedupe: ignore a second missed call from the same number within 60 s.
- Rate limit: max N concurrent calls (plan limit from Exotel).
- Target: callback dialled < 10 s after the missed call.

### 6.8 `fallback.py`
- Engine down: play "technical problem, we will call you back", log a callback request,
  hang up. Never leave the caller in silence.
- Engine slow repeatedly in one call: switch that call to keypad-only prompts.

### 6.9 `metrics.py`
One JSON line per turn:
`call_id, turn, state, speech_ms, endpoint_ms, engine_ms, first_audio_ms, total_silence_ms,
barge_in, fallback`. No audio, no transcript text, no phone number.

---

## 7. Build steps (in order, each ends testable)

| # | Build | Done when |
|---|---|---|
| 1 | Skeleton: `server.py`, `exotel.py` parser, `fake_exotel.py` | Fake client connects, sends `start/media/stop`, server logs them |
| 2 | `audio.py` + echo | Fake client hears its own audio back, paced correctly |
| 3 | `prompts.py` + `stub_engine.py` + `call.py` basic loop | Fake caller hears question 1, answers, hears question 2 |
| 4 | `vad.py` endpointing | Endpoint fires 240 ms after speech ends on clean + noisy WAVs |
| 5 | Barge-in + `clear` | Playback stops < 200 ms after caller speaks over it |
| 6 | DTMF + no-input timers | Keypad confirm works; silence gets a nudge |
| 7 | `fallback.py` + `metrics.py` | Killing the stub engine gives a spoken goodbye, not silence |
| 8 | Swap stub for real `ai/` | Full interview with typed-audio fixtures end to end |
| 9 | Exotel trial: expose via ngrok, attach Voicebot applet | Real phone call hears question 1 |
| 10 | Missed-call webhook + callback | Missed call → phone rings back < 10 s |
| 11 | Deploy to host (§9) | Same, without the laptop |

Steps 1–7 need no Exotel account and no `ai/`.

---

## 8. Exotel setup

Moved to the step-by-step runbook: [06-exotel-setup.md](06-exotel-setup.md). Two things
learned from Exotel's docs on 2026-09-26 and already built in: outgoing audio goes in
3,200-byte (200 ms) chunks, Exotel's minimum; incoming chunks of any size are re-cut
into 20 ms frames. The callback uses Exotel's direct-stream API (`StreamUrl`,
`StreamType=bidirectional`), so no second flow is needed.

## 9. Run and deploy

**Local:**
```bash
cd channels/ivr && pip install -e . && cp .env.example .env
```
```bash
uvicorn ivr.server:app --port 8000
```
```bash
python tools/fake_exotel.py --wav samples/fixtures/hi_q1_tailoring.wav
```

**Demo host:** one small VM or a free tier that allows long-lived WebSockets (Railway / Fly
in Mumbai if available). Adapter and `ai/` on the same box → engine call is localhost. TLS
via the platform (Exotel needs `wss://`). One process per box, `uvicorn --workers 1` —
each call holds a WebSocket; scale by boxes, not workers, until load tests say otherwise.

**Final:** Mumbai-region VM, systemd or Docker, health-check restart, logs shipped off-box,
secrets in env not repo.

---

## 10. Definition of done (demo)

- All 11 build steps done.
- All tests in [03-testing.md](03-testing.md) marked "demo" pass.
- Latency targets in [04-optimization.md](04-optimization.md) met on 20 real calls.
- `channels/ivr/README.md` lets a teammate run it in 10 minutes.
