# IVR — real phone call, end to end (free tier)

Owner: Prashant · 2026-09-26 · Goal: a real phone rings, a real person answers the interview,
and hears a result. Everything runs on a laptop; only Exotel and a tunnel are external.

```
Your mobile ──call──▶ Exotel ExoPhone ──wss──▶ Cloudflare tunnel ──▶ laptop :8000 IVR adapter
                                                                      │
                                                                      └─▶ :8001 engine ──▶ Sarvam (speech)
```

## 0. What you need

| Thing | Cost | Account? |
|---|---|---|
| Exotel trial: ExoPhone + API key/token + Account SID | free trial credits | **yes** (you sign up) |
| Sarvam key | free credits | done (`ai/.env`) |
| `cloudflared` quick tunnel (public `wss://` URL to your laptop) | free | **no** |
| Engine + adapter | free | no |

Install cloudflared: macOS `brew install cloudflared` · Windows `winget install --id Cloudflare.cloudflared` ·
Linux: the `.deb`/binary from github.com/cloudflare/cloudflared/releases.

**Ask Exotel support when you sign up** (these decide whether the trial is enough):
1. Is **AgentStream / Voicebot (bidirectional streaming)** enabled on a trial account? If not, please enable it.
2. Can the trial ExoPhone take **incoming** calls, and call only **verified** numbers outbound?
3. Which API host is our account on (`api.in.exotel.com` or `api.exotel.com`)?

## 1. Start the two services (terminal 1 and 2)

```bash
cd ai && ASR_PROVIDER=sarvam TTS_PROVIDER=sarvam uv run --extra tts --extra vosk uvicorn engine.server:app --port 8001
```
```bash
cd channels/ivr && STREAM_TOKEN=pick-a-long-random-string ENGINE_URL=http://localhost:8001 uv run uvicorn ivr.server:app --port 8000
```

(Port 8001 busy? Use any free port and set `ENGINE_URL` to match.)
Or both at once: `ASR_PROVIDER=sarvam docker compose up --build` (needs Docker running).

## 2. Open the tunnel (terminal 3)

```bash
cloudflared tunnel --url http://localhost:8000
```

It prints `https://<random-words>.trycloudflare.com`. Your stream URL is:

```
wss://<random-words>.trycloudflare.com/stream?token=<STREAM_TOKEN>
```

The address changes every time cloudflared restarts; update Exotel when it does.
Check it: `https://<random-words>.trycloudflare.com/health` should show `{"ok":true,...}`.

## 3. Test A — call the ExoPhone, talk to the bot (simplest)

1. my.exotel.com → **App Bazaar** → **Create app** (flow).
2. Drag in **Voicebot** applet → URL = the stream URL above. Leave sample rate at 8000.
3. After it, add **Hangup**. Save.
4. **ExoPhones** → your number → set this app as its incoming flow.
5. Call the ExoPhone from your mobile. You should hear the welcome and consent.
6. Answer by voice or keypad all the way to the result.

Terminal 2 should show `start stream=… call=…`, one metrics line per turn, then `finished`.

## 4. Test B — Exotel calls you (the callback leg)

```bash
cd channels/ivr && EXOTEL_SID=… EXOTEL_API_KEY=… EXOTEL_API_TOKEN=… EXOTEL_CALLER_ID=<ExoPhone> \
  EXOTEL_STREAM_URL='wss://<random-words>.trycloudflare.com/stream?token=<STREAM_TOKEN>' \
  uv run python tools/call_me.py +91XXXXXXXXXX
```

Your phone rings from the ExoPhone and the interview starts when you pick up. On a trial,
`+91XXXXXXXXXX` must be a number verified in the Exotel dashboard.

## 5. Test C — missed call, then callback (the real product flow)

1. Restart the adapter with the Exotel settings from Test B **plus** `MISSED_CALL_SECRET=<another-random-string>`.
2. New app in App Bazaar: **Passthru** applet → URL
   `https://<random-words>.trycloudflare.com/missed-call?key=<MISSED_CALL_SECRET>` → then **Hangup**.
3. Set it as the ExoPhone's incoming flow (instead of Test A's).
4. Call the ExoPhone and hang up after the first ring. Within ~10 s it calls you back.

Check with Exotel whether a call hung up by the Passthru+Hangup flow is billed to the caller;
the product promise is that the missed call is free for them.

## 6. What to record after each test

```bash
cd channels/ivr && uv run python tools/latency.py <adapter log file>
```

Add a row to `README.md`'s log and the numbers to `05-measurements.md`: phone and network used,
did it complete, silence p50/p95, anything that sounded wrong (clipped prompts, echo, delay).

## 7. If something goes wrong

| Symptom | Likely cause | Fix |
|---|---|---|
| Call connects, silence, adapter log shows nothing | Exotel can't reach the URL | Check `/health` via the tunnel URL; URL must be `wss://…/stream?token=…` |
| Adapter log: `stream rejected: bad token` | Token in Exotel URL ≠ `STREAM_TOKEN` | Copy it again exactly |
| Adapter log shows `start` but no `media` | Streaming not enabled on the account | Ask Exotel to enable AgentStream / Voicebot |
| Bot audio distorted or choppy | Chunk size | We send 3,200-byte chunks (Exotel's minimum); report it with the log |
| Bot never hears you | VAD thresholds on a real line | Try `VAD_AGGRESSIVENESS=1`; note the phone/network |
| Engine errors → "sorry" prompt | Engine down or port wrong | `curl localhost:8001/health`; `ENGINE_URL` |
| Callback API returns 401/403 | Wrong key/token/SID or API host | Check `EXOTEL_SUBDOMAIN` (`api.in.exotel.com` vs `api.exotel.com`) |
| Callback API: number not allowed | Trial: unverified number | Verify it in the dashboard |
| Tunnel URL stopped working | cloudflared restarted | New URL → update Exotel app / `EXOTEL_STREAM_URL` |
