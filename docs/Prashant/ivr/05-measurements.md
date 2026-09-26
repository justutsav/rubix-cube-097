# IVR — measurements

Every number here comes from a tool in `channels/ivr/tools/` and can be re-run. Newest first
within each section. Synthetic voice = the engine's gTTS voice: good for comparing versions,
**not** real-world accuracy (that needs the dialect recordings, testing plan §6).

## Accuracy: word errors vs understood answers

`uv run --extra dev python tools/accuracy.py --engine <ai/ url>` · set `samples/synthetic.csv`
(38 answers across all fields) · speech-to-text Vosk small Hindi (offline) · line conditions from
`tools/phone_line.py` (300–3400 Hz band, G.711 mu-law, white noise, lost 20 ms packets).

### 2026-09-26, Vosk vs Sarvam on the same audio (lexicon 2026-09-26.2)

Same 38 answers, same noise (seeded per answer, reproducible), same word list; only
`ASR_PROVIDER` changes. "Time" = one answer through `/v1/extract` (speech-to-text + understanding).

**Vosk small Hindi (offline, free, on the laptop)**

| Line condition | Word error rate | Answer understood | Time p50 / p95 | VAD missed | Transcribed by |
|---|---|---|---|---|---|
| clean | 2% | 100% (38/38) | 169 / 302 ms | 0 | vosk 38 |
| phone | 3% | 97% (37/38) | 180 / 284 ms | 0 | vosk 38 |
| phone+noise20 | 5% | 95% (36/38) | 211 / 354 ms | 0 | vosk 38 |
| phone+noise10 | 25% | 82% (31/38) | 314 / 465 ms | 0 | vosk 38 |
| phone+loss5 | 4% | 100% (38/38) | 192 / 285 ms | 0 | vosk 38 |
| phone+noise10+loss5 | 36% | 68% (26/38) | 354 / 489 ms | 0 | vosk 38 |

**Sarvam `saarika:v2.5` (cloud), paced 1 request/s**

| Line condition | Word error rate | Answer understood | Time p50 / p95 | VAD missed | Transcribed by |
|---|---|---|---|---|---|
| clean | 3% | 100% (38/38) | 325 / 613 ms | 0 | sarvam 38 |
| phone | 4% | 97% (37/38) | 304 / 573 ms | 0 | sarvam 38 |
| phone+noise20 | 4% | 100% (38/38) | 319 / 414 ms | 0 | sarvam 38 |
| phone+noise10 | 8% | 92% (35/38) | 308 / 431 ms | 0 | sarvam 38 |
| phone+loss5 | 4% | 97% (37/38) | 329 / 404 ms | 0 | sarvam 38 |
| phone+noise10+loss5 | 11% | 89% (34/38) | 302 / 408 ms | 0 | sarvam 38 |

**Reading it:** on a clean line both understand every answer. As the line degrades, Vosk's
word errors climb to 36% and answers to 68%; Sarvam stays at 11% and 89%. Vosk is faster
(~200 ms on the laptop, no network) and free; Sarvam costs ~300 ms more per turn and money,
and is the one that survives a bad village line. Both stay well inside the 1.8 s budget.

**Rate limit found.** Unpaced (back-to-back requests) Sarvam answered `429 Too Many Requests`
on 50 of 228 answers, plus 6 timeouts over 2 s. Every one fell back to Vosk and the call went
on, which is the designed behaviour, but it caps simultaneous calls on this key's plan. Unpaced
run, for the record:

| Line condition | Word error rate | Answer understood | Time p50 / p95 | VAD missed | Transcribed by |
|---|---|---|---|---|---|
| clean | 3% | 100% (38/38) | 367 / 481 ms | 0 | sarvam 35, vosk 3 |
| phone | 4% | 100% (38/38) | 414 / 587 ms | 0 | sarvam 28, vosk 10 |
| phone+noise20 | 4% | 100% (38/38) | 400 / 691 ms | 0 | sarvam 27, vosk 11 |
| phone+noise10 | 12% | 89% (34/38) | 409 / 641 ms | 0 | sarvam 29, vosk 9 |
| phone+loss5 | 3% | 97% (37/38) | 380 / 503 ms | 0 | sarvam 32, vosk 6 |
| phone+noise10+loss5 | 17% | 89% (34/38) | 414 / 703 ms | 0 | sarvam 28, vosk 10 |

### 2026-09-26, after fixing what the first run found (lexicon 2026-09-26.2)

| Line condition | Word error rate | Answer understood | VAD missed the answer |
|---|---|---|---|
| clean | 2% | 100% (38/38) | 0 |
| phone | 3% | 97% (37/38) | 0 |
| phone+noise20 | 10% | 95% (36/38) | 0 |
| phone+noise10 | 24% | 74% (28/38) | 0 |
| phone+loss5 | 4% | 97% (37/38) | 0 |
| phone+noise10+loss5 | 40% | 71% (27/38) | 0 |

### 2026-09-26, first run (lexicon 2026-09-26.1)

| Line condition | Word error rate | Answer understood |
|---|---|---|
| clean | 2% | 89% (34/38) |
| phone | 3% | 87% (33/38) |
| phone+noise20 | 9% | 84% (32/38) |
| phone+noise10 | 22% | 66% (25/38) |
| phone+loss5 | 3% | 89% (34/38) |
| phone+noise10+loss5 | 31% | 63% (24/38) |

Fixes between the two runs: "जी" alone no longer means yes; filler words ("का काम") no
longer make phrases look alike; a bare "नहीं" is "no difficulty" only when it is all the
caller said; added राजगीर, रिक्शा; measurement endpoint returns the stored shape. Each
fix has a regression test in `ai/tests/test_extract.py`.

**Reading it:** at 10 dB noise one word in four is wrong yet three answers in four are
still understood before read-back; the read-back and keypad fallback catch the rest.

## Load: simultaneous calls on one box

`uv run --extra dev python tools/load_test.py --calls N` · each caller runs a full interview
(6 spoken answers + keys) from a fresh number · adapter + engine + Vosk on one laptop (Apple
silicon), engine timeout 1.5 s. "Finished" = reached the result, not ended by "sorry".

### 2026-09-26, speech-to-text moved outside the engine lock

| Simultaneous calls | Finished | Silence after spoken answer p50 | p95 | max |
|---|---|---|---|---|
| 1 | 1/1 | 310 ms | 398 ms | 398 ms |
| 10 | 10/10 | 388 ms | 644 ms | 724 ms |
| 25 | 25/25 | 538 ms | 843 ms | 859 ms |
| 35 | 5/35 | — | — | — |
| 50 | 2/50 | — | — | — |

Before the lock fix, 10 calls: p50 285 ms, p95 865 ms (speech-to-text for all calls queued on
one lock). **Ceiling: ~25 simultaneous calls per box with on-box Vosk**; past that the CPU
cannot transcribe fast enough and turns hit the 1.5 s engine timeout (callers hear the
apology, progress is saved). Cloud speech-to-text moves that load off the box.

## Latency by turn type (adapter metrics, all load-test calls above)

`uv run python tools/latency.py adapter.log` · perceived silence = 240 ms end-of-speech wait + engine time.

| Turn kind | Turns | Engine p50 | Engine p95 | Perceived silence p50 | p95 | max |
|---|---|---|---|---|---|---|
| audio | 506 | 455 ms | 1216 ms | 695 ms | 1456 ms | 1832 ms |
| dtmf | 1016 | 26 ms | 80 ms | 26 ms | 80 ms | 123 ms |
| opened | 170 | 28 ms | 51 ms | 28 ms | 51 ms | 67 ms |

Calls: 1 · turns: 1822 · 'hmm' filler played: 337 · barge-ins: 0 · engine failures: 130

## Public tunnel (Cloudflare quick tunnel, no account)

### 2026-09-26, fake Exotel over the internet: laptop → Cloudflare edge → tunnel → adapter

| Check | Result |
|---|---|
| `GET /health` through the tunnel (QUIC, after DNS settled) | 6/6 OK, 0.2–0.9 s |
| Wrong `?token=` | rejected, HTTP 403, logged |
| Full interview (2 spoken answers + keys) | completed, 17 turns, result spoken |
| Silence after a spoken answer | p50 609 ms (local was ~330 ms: the tunnel adds ~280 ms round trip) |

Flakiness seen, all on the tunnel side, none in our code: the first minutes after start saw
0.5–12 s responses and resets; `--protocol http2` gave HTTP 530 (edge could not reach the
tunnel) — stay on the default QUIC; one call early on dropped at ~30 s. A quick tunnel is fine
for the first Exotel test; for demos use a named tunnel or ngrok's free static domain.

## Real calls through Exotel (trial account, ExoPhone 080…, Cloudflare quick tunnel, Sarvam)

### 2026-09-26, first real calls from a mobile

| Call | What happened | Cause | Fixed in |
|---|---|---|---|
| 1 | Silence | Exotel strips `?token=` from the Voicebot URL and sends it as `start.custom_parameters`; every connection was rejected | `8c37682` |
| 2 | Prompts cut to fragments ("hum hum"), answers not understood | Barge-in at 120 ms fired on line noise/echo on 22 of 23 turns | `85d8d42` (400 ms) |
| 3 | 27 turns, reached the last question; short answers failed | Sarvam ends every transcript with "।", which the matcher kept, so `गया।` ≠ `गया`; "bachelors" unknown; my engine restart ended the call on the last key | `85d8d42` + this commit |

Call 3, per turn: engine 400–840 ms after a spoken answer (Sarvam + understanding), 2–11 ms
after a key. Exotel's format: `{'encoding': 'base64', 'sample_rate': '8000'}`. Sarvam heard every
answer correctly; every miss was in our matching.

Replaying call 3's saved clips through the fixed engine: 9 of 10 real answers understood
(`गया।`, `बैचलर्स`, `खेती।`, `5 साल।`, `ट्रैक्टर`, `नौकरी`, `हाँ।` …); the miss, "आने जाने में
दिक्कत है", is fixed in this commit, as are: a plain "हाँ" to the difficulty question opening
the menu, no barge-in in the first 4 s (Exotel's "this call is being recorded" cut the
welcome), and the "hmm" filler only after 1 s (Sarvam often takes 0.7–0.8 s).
