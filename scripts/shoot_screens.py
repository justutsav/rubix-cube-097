"""
Phone-sized screenshots of the app, for the deck and the docs.

The earlier set in `docs/Utsav/screenshots/` was shot at a desktop window, so it showed the
two-column layout nobody on a handset ever sees. This drives the same states at a 412x915 CSS
viewport (Pixel-class, dpr 3), which is the layout the APK actually renders.

    python3 scripts/shoot_screens.py

Writes 1236x2745 PNGs to docs/Utsav/screenshots/mobile/. Needs `pip install playwright`; the
chromium build in ~/.cache/ms-playwright is already there.
"""

import os
import re
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

from playwright.sync_api import TimeoutError as PWTimeout
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
APP = ROOT / "web" / "app"
OUT = ROOT / "docs" / "Utsav" / "screenshots" / "mobile"
PORT = 5179
BASE = f"http://localhost:{PORT}"
CHROME = "/usr/bin/google-chrome"
TRACE = os.environ.get("TRACE") == "1"

# Pixel 7 / Galaxy S24 class. Not an iPhone: the build that ships is the Android APK.
VIEWPORT = {"width": 412, "height": 915}
DPR = 3

# The pathways screen's heading — how we know the interview finished.
DONE_HEADING = "आपके लिए ये रास्ते निकले"


def wait_for_server(timeout=90):
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            urllib.request.urlopen(BASE, timeout=2).read(1)
            return
        except Exception:
            time.sleep(0.5)
    raise SystemExit(f"vite never came up on {BASE}")


def settle(page, ms=900):
    """The turns are driven by a speech queue and a timer, not by network — networkidle lies."""
    page.wait_for_timeout(ms)


# Anything that can take an answer. While a turn is still speaking, none of these are mounted.
CONTROLS = (
    "div.a-actions[data-layout] button.a-btn, "
    "details, "
    "div.a-actions button.a-btn"
)


def wait_for_control(page, timeout=20000):
    """
    Wait for the turn to finish speaking and mount something answerable.

    A fixed sleep is what broke this: the app hides every control while the speech queue drains,
    and the queue's length depends on how long the prompt is, so a turn with a long line was
    still talking when the script looked and the walk gave up mid-interview.
    """
    try:
        page.wait_for_selector(CONTROLS, timeout=timeout, state="visible")
        return True
    except PWTimeout:
        return False


# A full-page capture paints a position:fixed element where it sits in the *viewport*, so the
# bottom tab bar lands stranded across the middle of a 9000px image, on top of a KPI card. Hide
# it for the tall shots only; on the viewport-sized ones it belongs there.
HIDE_FIXED = ".tabbar, .b-tabbar { visibility: hidden !important; }"


def shoot(page, name, full_page=False):
    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / name
    style = page.add_style_tag(content=HIDE_FIXED) if full_page else None
    page.screenshot(path=str(path), full_page=full_page)
    if style:
        style.evaluate("el => el.remove()")
    print(f"  {name}")


def click_text(page, text, timeout=4000):
    page.get_by_text(text, exact=False).first.click(timeout=timeout)


# Tried in order when a turn wants a free answer. Some turns are a spoken numbered choice with
# no buttons on screen ("self work press one, job press two"), others want a count of years or a
# trade in words, and nothing on the page says which. If a turn re-asks, the next one is tried.
# Words, not digits: the reask says "press 1", but that is the DTMF path. A typed answer goes
# through the same regex matcher as speech (fsm.ts Q6_EMPLOYMENT_PREF and friends), which only
# ever matches words, so a digit is rejected on every turn that is not a plain count.
TYPED_ANSWERS = {
    # "how many years have you done this work" — a count, and only a count. Answering it with a
    # trade name sends the FSM back to the trade question and the walk loops forever.
    "years": ["12", "10", "5"],
    "default": ["सिलाई", "अपना काम", "दोनों", "खेती"],
}


def typed_answer(q_text, attempt):
    kind = "years" if re.search(r"कितने साल|कितना समय", q_text) else "default"
    pool = TYPED_ANSWERS[kind]
    return pool[attempt % len(pool)]


def advance_one_turn(page, attempt=0):
    """
    Answer whatever the current turn is asking for, without knowing which turn it is.

    The interview mixes option grids, a PIN pad, free speech and turns that expect nothing back,
    so walking it by a fixed script breaks every time a question is reworded. Try each shape in
    the order the UI prefers it and return whether anything was pressed.
    """
    # A turn that expects nothing — just a continue.
    cont = page.get_by_role("button", name="आगे बढ़िए")
    if cont.count() and cont.first.is_visible():
        cont.first.click()
        return True

    # An option grid or stack. `data-layout` is set only by <Options>, which keeps this off the
    # other `.a-actions` rows (kiosk buttons, the lone continue).
    opts = page.locator("div.a-actions[data-layout] button.a-btn")
    for i in range(opts.count()):
        btn = opts.nth(i)
        if btn.is_visible() and "दोबारा" not in (btn.inner_text() or ""):
            btn.click()
            return True

    # Free answer: open the "लिखकर बताइए" fallback and type, rather than tapping the mic —
    # headless chromium has no Web Speech API and the mic would raise no_asr on screen.
    details = page.locator("details").filter(has_text="लिखकर बताइए")
    if details.count():
        # Set `open` rather than clicking the summary: a click toggles, so on the turn after a
        # typed answer it would close the thing we are about to type into.
        details.first.evaluate("d => { d.open = true; }")
        box = page.locator("details input").first
        q = page.locator(".a-question").first
        box.fill(typed_answer(q.inner_text() if q.count() else "", attempt))
        page.get_by_role("button", name="भेजें").first.click()
        return True

    return False


def run_interview(page):
    page.goto(f"{BASE}/#/interview")
    settle(page)

    # Kiosk path: no number, no OTP. Same screen a CSC operator uses.
    try:
        click_text(page, "बिना नंबर")
        settle(page)
    except PWTimeout:
        pass

    for label in ("नई शुरुआत", "शुरू कीजिए", "शुरू"):
        try:
            click_text(page, label, timeout=1500)
            settle(page)
            break
        except PWTimeout:
            continue

    shoot(page, "01-voice-interview-language.png")

    turns = 0
    shot_question = False
    last_q = None
    attempt = 0
    while turns < 40:
        if page.get_by_text(DONE_HEADING).count():
            break
        # Progress, not question text: a rejected answer comes back as a *reworded* re-ask, so
        # comparing the heading would look like a fresh turn and never escalate the answer. The
        # bead count is the only thing that moves when an answer is actually accepted.
        beads = page.locator(".beads").first
        progress = beads.get_attribute("aria-label") if beads.count() else ""
        attempt = attempt + 1 if progress == last_q else 0
        last_q = progress
        q = page.locator(".a-question").first
        q_text = q.inner_text() if q.count() else ""
        if TRACE:
            print(f"    [{progress}] {q_text[:60]!r} attempt={attempt}")
        if not wait_for_control(page):
            break

        # The deck frame: a real question with some beads already filled. Not a "सही है?"
        # read-back — that is a yes/no confirm with nothing on screen that looks like the
        # interview asking anything, which is what the first attempt at this shot caught.
        if not shot_question and "सही है" not in q_text and not progress.startswith("0 "):
            shoot(page, "02-voice-interview-question.png")
            shot_question = True

        if not advance_one_turn(page, attempt):
            break
        turns += 1
        settle(page)

    if not page.get_by_text(DONE_HEADING).count():
        print(f"  ! interview stalled after {turns} turns; shooting where it stopped")
    settle(page, 1200)
    # On a phone the spoken narration stacks *above* the recommendation cards instead of sitting
    # beside them, so the default viewport lands mid-sentence with no card in frame. Scroll to
    # the first card — the cards are the point of this screen.
    cards = page.locator("article")
    if cards.count():
        cards.first.evaluate("el => el.scrollIntoView({ block: 'start' })")
        settle(page, 400)
    shoot(page, "03-nsqf-pathways.png")


def open_officer(page):
    """#/demo seeds the district and redirects to the console."""
    page.goto(f"{BASE}/#/demo")
    page.wait_for_url("**/#/officer", timeout=30000)
    settle(page, 2500)


def run_officer(page):
    open_officer(page)
    shoot(page, "04-district-dashboard.png")
    # The console is a long scroll — one viewport shows three KPI cards and cuts the charts off.
    # The full-page capture is the one to put in a deck when the whole console has to be visible
    # at once; it comes out several thousand pixels tall.
    shoot(page, "04-district-dashboard-full.png", full_page=True)


def main():
    server = subprocess.Popen(
        ["npm", "run", "dev", "--", "--port", str(PORT), "--strictPort"],
        cwd=APP,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.STDOUT,
    )
    try:
        wait_for_server()
        with sync_playwright() as pw:
            # The system Chrome, not a playwright-managed build: the cached one here is a
            # revision behind what the driver wants, and this avoids a 150MB download to shoot
            # four PNGs.
            browser = pw.chromium.launch(executable_path=CHROME)
            ctx = browser.new_context(
                viewport=VIEWPORT,
                device_scale_factor=DPR,
                is_mobile=True,
                has_touch=True,
                locale="hi-IN",
            )
            page = ctx.new_page()
            print("shooting:")
            run_interview(page)
            run_officer(page)

            # Second pass for the dashboard at a plain 1080x1920 handset frame — 360 CSS px at
            # dpr 3, the size most decks and store listings expect. Its own context because the
            # viewport is fixed when the context is made.
            ctx2 = browser.new_context(
                viewport={"width": 360, "height": 640},
                device_scale_factor=DPR,
                is_mobile=True,
                has_touch=True,
                locale="hi-IN",
            )
            page2 = ctx2.new_page()
            open_officer(page2)
            shoot(page2, "04-district-dashboard-1080x1920.png")
            shoot(page2, "04-district-dashboard-1080-full.png", full_page=True)
            browser.close()
        print(f"\n-> {OUT}")
    finally:
        server.terminate()
        server.wait(timeout=10)


if __name__ == "__main__":
    sys.exit(main())
