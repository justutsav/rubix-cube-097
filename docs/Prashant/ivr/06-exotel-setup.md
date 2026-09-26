# IVR — real phone call, end to end (free tier)

Owner: Prashant · Updated 2026-09-26 after the first real calls. Everything here was done on
the trial account `self6743` and worked; the screens described are what Exotel showed.

```
Mobile ──call──▶ Exotel ExoPhone ──Voicebot applet, wss──▶ Cloudflare quick tunnel ──▶ laptop :8765 IVR adapter
                                                                                     └─▶ :8011 engine ──▶ Sarvam
```

## 0. Rules for testing

1. **Softphone first, Exotel last.** Engine changes are tested on the browser softphone
   (`http://localhost:8765/softphone?token=<STREAM_TOKEN>`, started with `SOFTPHONE=1`): same
   adapter, same engine, no Exotel credits. Use a real call only for line behaviour.
2. **Stop the tunnel when not testing.** While it is up, *anyone* who dials the ExoPhone
   reaches the bot (it happened: four calls from other people on 2026-09-26).
3. **Never restart the engine or adapter during a call.** Check first: count of
   `start stream` lines = count of `finished|stop|disconnect` lines in the adapter log.

## 1. What the trial gives (2026-09-26)

| Thing | Value |
|---|---|
| Credits | 150 at sign-up, 500 after verifying the mobile |
| Cost of calls *to* the ExoPhone | 0 so far: 4 calls (~8 min) left credits at 500. Re-check after each session |
| Cost of calls *from* Exotel (callback tests) | Not tried yet; assume per-minute |
| ExoPhone | `08047289281`, attached to "self6743 Landing Flow" |
| Shared trial number | `09513886363` + the account PIN, same flow |
| Voicebot applet | Available on the trial, no activation needed |
| Recording | Trial announces "this call is now being recorded" and keeps recordings (▶ in Inbox) even with "Record this?" off; delete them from the dashboard |
| Inbox outcome | Shows "Client hung-up before connecting to…" for bot calls: normal, the bot is not a "connect" |

## 2. Start the services

Settings live in gitignored files: `ai/.env` (`SARVAM_API_KEY`) and `channels/ivr/.env`
(`STREAM_TOKEN`, `ENGINE_URL=http://localhost:8011`, later `EXOTEL_*`). Ports 8000/8001 may be
taken by other projects on this laptop; we use 8765 and 8011.

```bash
cd ai && ASR_PROVIDER=sarvam TTS_PROVIDER=sarvam uv run --extra tts --extra vosk uvicorn engine.server:app --port 8011
```
```bash
cd channels/ivr && uv run uvicorn ivr.server:app --port 8765
```
```bash
cloudflared tunnel --url http://localhost:8765
```

Wait ~1 minute after cloudflared prints `https://<words>.trycloudflare.com`, then check
`https://<words>.trycloudflare.com/health`. Keep the default protocol (QUIC); `--protocol
http2` gave HTTP 530. The address changes every time cloudflared restarts.

Stream URL for Exotel: `wss://<words>.trycloudflare.com/stream?token=<STREAM_TOKEN>`.
Exotel moves `?token=` into the call's custom parameters; the adapter accepts it there.

## 3. Test A — call the ExoPhone (done, works)

1. my.exotel.com → Installed Apps → **edit (pencil) on "self6743 Landing Flow"**.
   Original content: Call Start → Greeting (for restoring later).
2. Remove the Greeting (⊖). Drag **Voicebot** (not "Stream": that one is one-way) into Call Start.
3. Voicebot panel: paste the stream URL. **Record this?** off. **Encrypt DTMF?** off (on would
   scramble the menu keys). **Next → drag Hangup** into "Drop applet here". **SAVE**.
4. From the verified mobile, call `08047289281`. Ear to the phone, not speaker.

## 4. Test B — Exotel calls you (not done yet; costs credits)

Add to `channels/ivr/.env`: `EXOTEL_SID=self6743`, `EXOTEL_API_KEY`, `EXOTEL_API_TOKEN`
(Exotel → API Credentials), `EXOTEL_SUBDOMAIN` (`api.in.exotel.com` or `api.exotel.com`),
`EXOTEL_CALLER_ID=08047289281`, `EXOTEL_STREAM_URL=<stream URL>`. Then:

```bash
cd channels/ivr && uv run python tools/call_me.py +91XXXXXXXXXX
```

## 5. Test C — missed call, then callback (not done yet; costs credits)

1. Add `MISSED_CALL_SECRET=<random>` to `channels/ivr/.env`, restart the adapter.
2. New app: **Passthru** → `https://<words>.trycloudflare.com/missed-call?key=<MISSED_CALL_SECRET>`
   → **Hangup**. Make it the ExoPhone's flow instead of Test A's.
3. Ring the ExoPhone, hang up; it calls back in ~10 s. Check whether the caller is billed.

## 6. Debugging a real call

Start with the debug switches (test calls only: they keep what the caller said):

```bash
cd ai && ENGINE_LOG_TRANSCRIPTS=1 ASR_PROVIDER=sarvam ... uvicorn engine.server:app --port 8011
```
```bash
cd channels/ivr && IVR_DEBUG_DIR=/some/tmp/dir uv run uvicorn ivr.server:app --port 8765
```

The engine log then shows `debug: heard [...]` per answer; the adapter saves each utterance
as a WAV and logs one metrics line per turn (`uv run python tools/latency.py <log>`).
Delete the WAVs afterwards.

## 7. What broke on the first real calls, and why

| Symptom | Cause | Fix (commit) |
|---|---|---|
| Silence; adapter log `stream rejected: bad token` | Exotel strips `?token=`; sends it as a custom parameter | Accept it there (`8c37682`) |
| Prompts cut into fragments ("hum hum") | Barge-in on line noise/echo at 120 ms | 400 ms (`85d8d42`), then 900 ms (`94093f8`) |
| Welcome cut at the very start | Exotel's recording announcement heard as speech | No barge-in in the first 4 s (`0bf6394`) |
| Short answers ("गया") never understood | Sarvam ends every transcript with "।" | Strip "।" (`85d8d42`) |
| Questions answered "हाँ जी" blind | Backchannel while listening cut the question | 900 ms barge-in; bare yes/no → menu (`94093f8`, `6612969`) |
| Call ended with "sorry" after a long answer | Adapter waited 1.5 s; Sarvam 2 s + Vosk fallback is longer | Wait 4 s (`94093f8`) |
| "कोई परेशानी है?" → "नहीं" → read-back → "नहीं" | Double negative | Accept plain "नहीं" there (`6612969`) |

## 8. If something goes wrong

| Symptom | Likely cause | Fix |
|---|---|---|
| Call connects, silence, adapter log empty | Exotel can't reach the URL | `/health` through the tunnel; URL is `wss://…/stream?token=…` |
| `stream rejected: bad token` | Token in Exotel ≠ `STREAM_TOKEN` | Copy it again |
| `start` but no `media` | Streaming not enabled on the account | Ask Exotel support |
| Bot audio distorted | Chunk size | We send 3,200-byte chunks; report with the log |
| Many `barge_in: true` in metrics | Echo / speakerphone / backchannel | Handset at the ear; raise `BARGE_IN_SPEECH_MS` |
| Engine errors → "sorry" | Engine down, wrong port, or slow | `curl localhost:8011/health`; `ENGINE_TIMEOUT_MS` |
| Tunnel slow or resets in the first minutes | New quick tunnel settling | Wait a minute; restart cloudflared |
| HTTP 530 from the tunnel | `--protocol http2` | Default protocol |
| Callback API 401/403 | Key/token/SID or API host | `EXOTEL_SUBDOMAIN` |
