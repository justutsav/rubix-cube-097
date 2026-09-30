# Waiting on Utsav

Things I could not do without you. Everything else is in `git status` / the task list.
Updated 2026-09-28.

## 1. Deck fixes (Canva — I have no file access)

`docs/Utsav/deck-fixes.pdf` is the full list, per page, severity-tagged. The four blockers:

- **Page 2 title is "KALA SETU"** → change to `Our Solution`
- **Page 4 logo says "SMART INDIA HACKATHON 2025"** → 2026
- **Page 6 has four artisan-project leftovers** (Ministry of Textiles / MSME-ONDC / Commerce /
  research paper [3] on SME e-commerce) → delete all four
- **Page 6 doesn't cite the CAG report** while showing its 41% figure → add it, plus the
  PM-AJAY guidelines, NSQF gazette and NQR

Plus one hard fact error: **74.6% SC rural → 76.4%** (Census 2011; looks like a transposition).

## 2. Film the IVR call

The video script's whole Section 3 runs over it, and it is the only real asset in the pack.
Two things to capture that the script depends on:

- Shoot the **missed-call → callback**, not a dial-in. That is the built flow.
- Shoot **at least one spoken-answer turn**, not keypad — keypad skips the read-back by design,
  and the read-back chip is a scripted beat.
- **Time the response gap.** It decides whether Section 2 may say "under two seconds."

## 3. Decisions I did not want to make for you

- **State Officer console is local-only.** It ranks districts from whatever is on the device and
  says so on screen. A real statewide roll-up needs a widened RLS policy on the server —
  `init.sql:371` still says *"Nobody sees the country."* Do you want me to write that policy, or
  leave State as a demo-scope screen for the pitch?
- **Follow-up call interval.** Built nothing yet; the script says "configurable per district".
  Confirm that is still the answer if a judge asks for a number.
- **Server.** You said use the laptop if needed. I have kept everything local-first so far, so
  nothing requires it yet. Say if you want Supabase wired for the demo.

## 4. Test on the real phone in the morning

The Motorola (ZA222XGRVM) is attached but I have only screenshotted via a headless browser at a
phone viewport. Not the same thing. Worth walking yourself:

- `#/welcome` — the four onboarding steps, and whether the **mic permission prompt** actually
  fires on the real handset when you tap Allow
- `#/demo` — seeds 12 beneficiaries and drops into the district console
- The interview, with real TTS/ASR, which I have deliberately not touched

Build: `cd web/app && npm run cap:apk`
