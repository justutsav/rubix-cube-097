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
