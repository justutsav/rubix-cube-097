# Contributing

## Rule: log your work in your own doc folder

Every contributor has a folder under `docs/<Name>/` (`Abhay`, `Prashant`, `Utsav`).
If you do work — code, research, an experiment, a decision — you update your folder in the
same commit or PR:

- Add or update a note in `docs/<Name>/` saying what you did, why, and where it lives
  (file paths, PR link).
- Research goes in `docs/<Name>/research/`, numbered like `01-topic.md`.
- New to the team? Create `docs/<YourName>/` first.

Work that is not reflected in its author's folder is not done.

## Other rules

- Settled decisions live in `docs/decisions.md`. If your work conflicts with one, flag it — do
  not silently change it. New decisions go at the bottom with a date.
- `channels/` and `web/` call `ai/` over HTTP. No imports across that line.
- There is exactly one interview FSM, in `ai/`. Do not copy the questions anywhere else.
- Never commit raw audio. Commit the manifest in `samples/` only.
