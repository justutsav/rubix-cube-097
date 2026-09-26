# IVR — measurements

Every number here comes from a tool in `channels/ivr/tools/` and can be re-run. Newest first
within each section. Synthetic voice = the engine's gTTS voice: good for comparing versions,
**not** real-world accuracy (that needs the dialect recordings, testing plan §6).

## Accuracy: word errors vs understood answers

`uv run --extra dev python tools/accuracy.py --engine <ai/ url>` · set `samples/synthetic.csv`
(38 answers across all fields) · speech-to-text Vosk small Hindi (offline) · line conditions from
`tools/phone_line.py` (300–3400 Hz band, G.711 mu-law, white noise, lost 20 ms packets).

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
