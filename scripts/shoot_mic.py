"""
The mic screen on its own, for the deck's solution slide.

`shoot_screens.py` walks the whole interview and catches the mic *idle*; the slide wants the
state that shows the product working — the mic lit up with a live transcript under the question.
Headless chromium has no Web Speech API, so a stub recogniser is installed before the app loads:
it emits one interim result and never finalises, which parks the UI in `listening`.

    python3 scripts/shoot_mic.py

Writes to docs/Utsav/screenshots/mic/.
"""

import subprocess
import sys

from playwright.sync_api import sync_playwright

import shoot_screens as s

OUT = s.ROOT / "docs" / "Utsav" / "screenshots" / "mic"

# One interim hypothesis, then silence. `onend` never fires, so `recogniseWeb`'s promise stays
# pending and interview.ts keeps mic='listening' with the partial on screen.
FAKE_ASR = """
class FakeSR {
  constructor() { this.onresult = null; this.onerror = null; this.onend = null; }
  start() {
    setTimeout(() => {
      const alts = [{ transcript: 'बभनगावाँ गाँव, मसौढ़ी ब्लॉक', confidence: 0.92 }];
      alts.isFinal = false;
      this.onresult && this.onresult({ resultIndex: 0, results: [alts] });
    }, 500);
  }
  stop() {} abort() {}
}
window.SpeechRecognition = FakeSR;
window.webkitSpeechRecognition = FakeSR;
"""


def shoot(page, name):
    OUT.mkdir(parents=True, exist_ok=True)
    page.screenshot(path=str(OUT / name))
    print(f"  {name}")


def main():
    server = subprocess.Popen(
        ["npm", "run", "dev", "--", "--port", str(s.PORT), "--strictPort"],
        cwd=s.APP,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.STDOUT,
    )
    try:
        s.wait_for_server()
        with sync_playwright() as pw:
            browser = pw.chromium.launch(executable_path=s.CHROME)
            ctx = browser.new_context(
                viewport=s.VIEWPORT,
                device_scale_factor=s.DPR,
                is_mobile=True,
                has_touch=True,
                locale="hi-IN",
            )
            ctx.add_init_script(FAKE_ASR)
            page = ctx.new_page()
            print("shooting:")

            # Walk until a turn mounts the mic — that is the only screen this script wants.
            page.goto(f"{s.BASE}/#/interview")
            s.settle(page)
            try:
                s.click_text(page, "बिना नंबर")
                s.settle(page)
            except Exception:
                pass
            for label in ("नई शुरुआत", "शुरू कीजिए", "शुरू"):
                try:
                    s.click_text(page, label, timeout=1500)
                    s.settle(page)
                    break
                except Exception:
                    continue

            mic = page.locator("button.a-mic")
            for _ in range(40):
                if not s.wait_for_control(page):
                    break
                if mic.count() and mic.first.is_visible():
                    break
                if not s.advance_one_turn(page):
                    break
                s.settle(page)

            if not (mic.count() and mic.first.is_visible()):
                raise SystemExit("never reached a turn with the mic on screen")

            shoot(page, "mic-idle.png")
            mic.first.click()
            s.settle(page, 1200)
            shoot(page, "mic-listening.png")
            browser.close()
        print(f"\n-> {OUT}")
    finally:
        server.terminate()
        server.wait(timeout=10)


if __name__ == "__main__":
    sys.exit(main())
