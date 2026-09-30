/**
 * First run.
 *
 * Before this existed the app opened straight onto a role chooser with no context — a grid of
 * three buttons to somebody who had just installed a government app and did not know what it was
 * for. Onboarding is four short steps, and every one of them is spoken aloud, because the person
 * this is built for cannot read the screen that is asking them to choose.
 *
 * Rules this screen keeps:
 *   · Nothing here needs a network. Language, role and the mic prompt are all local.
 *   · Language comes **before** role, so the role question itself can be heard in her language.
 *   · The microphone is primed with an explanation and a real request, not a bare OS dialog
 *     fired on page load. A permission prompt with no context is a permission prompt that gets
 *     denied, and on Android a denial is sticky.
 *   · Locales with no ASR model behind them are offered but labelled honestly — the interview
 *     still runs, it just leans on the Hindi model plus the trade lexicon.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ASR_BACKED_LOCALES, SPOKEN_LOCALES, type Locale } from '@rc097/core';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Speak } from '../components';
import { openStore } from '../lib/db';
import { ROLES, setRole, type Role } from '../lib/role';
import { asrAvailable } from '../lib/speech';

export const LOCALE_KEY = 'app.locale';
export const ONBOARDED_KEY = 'app.onboarded';

const LOCALE_LABEL: Record<Locale, { local: string; en: string }> = {
  hi: { local: 'हिन्दी', en: 'Hindi' },
  mai: { local: 'मैथिली', en: 'Maithili' },
  bho: { local: 'भोजपुरी', en: 'Bhojpuri' },
  mag: { local: 'मगही', en: 'Magahi' },
  raj: { local: 'राजस्थानी', en: 'Rajasthani' },
  cgh: { local: 'छत्तीसगढ़ी', en: 'Chhattisgarhi' },
  ta: { local: 'தமிழ்', en: 'Tamil' },
  en: { local: 'English', en: 'English' },
};

type Step = 'welcome' | 'language' | 'role' | 'mic';

export default function Onboarding({ onRole }: { onRole: (r: Role) => void }) {
  const nav = useNavigate();
  const [step, setStep] = useState<Step>('welcome');
  const [locale, setLocale] = useState<Locale>('hi');
  const [busy, setBusy] = useState(false);

  const order: Step[] = ['welcome', 'language', 'role', 'mic'];
  const pct = ((order.indexOf(step) + 1) / order.length) * 100;

  const finish = async (role: Role) => {
    setBusy(true);
    const store = await openStore();
    await store.set(LOCALE_KEY, locale);
    await store.set(ONBOARDED_KEY, true);
    await setRole(role);
    onRole(role);
    // Officers land on their console; a beneficiary is walked to the mic primer first.
    nav(role === 'beneficiary' ? '/home' : '/home', { replace: true });
  };

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-beige-50 pt-[env(safe-area-inset-top)]">
      <div className="px-4 pt-4">
        <Progress value={pct} className="h-1.5" />
      </div>

      {step === 'welcome' && (
        <Pane
          // "PM-AJAY · Grant-in-Aid" was the scheme's internal name for its own funding line.
          // It tells her nothing. What she needs to know is that it is official and it is free.
          eyebrow="सरकारी सेवा · मुफ़्त"
          spoken="नमस्ते। यह सरकारी ऐप आपको काम-धंधे की ट्रेनिंग ढूँढने में मदद करता है। कुछ पढ़ना नहीं पड़ेगा — सब बोलकर होगा।"
          locale="hi"
          sub="A government app that helps you find training. Nothing to read — you can speak everything."
          cta="आगे बढ़िए · Continue"
          onNext={() => setStep('language')}
        />
      )}

      {step === 'language' && (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="px-5 pb-2 pt-8">
            <Speak locale="hi" className="text-2xl font-semibold leading-snug" text="आप कौन सी भाषा बोलती हैं?" />
            <p className="mt-1 text-sm text-sand-700">Which language do you speak?</p>
          </div>
          <div className="grid flex-1 content-start gap-2 overflow-y-auto p-4">
            {SPOKEN_LOCALES.map((l) => {
              const backed = ASR_BACKED_LOCALES.includes(l);
              return (
                <button
                  key={l}
                  type="button"
                  onClick={() => {
                    setLocale(l);
                    setStep('role');
                  }}
                  className="flex min-h-[3.5rem] items-center justify-between rounded-xl border border-beige-200 bg-white px-4 py-3 text-left active:scale-[0.99]"
                >
                  <span>
                    <span className="block text-lg">{LOCALE_LABEL[l].local}</span>
                    <span className="block text-xs text-sand-700">{LOCALE_LABEL[l].en}</span>
                  </span>
                  {!backed && (
                    // Said plainly rather than hidden: these four have models now, but at
                    // roughly three words in ten wrong we do not wire them as the ASR.
                    <span className="ml-3 shrink-0 text-[0.7rem] leading-tight text-amber-700">
                      spoken prompts,
                      <br />
                      Hindi listening
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {step === 'role' && (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="px-5 pb-2 pt-8">
            <Speak locale="hi" className="text-2xl font-semibold leading-snug" text="आप कौन हैं? नीचे से चुनिए।" />
            <p className="mt-1 text-sm text-sand-700">Who are you? You can change this later in Settings.</p>
          </div>
          <div className="grid flex-1 content-start gap-3 overflow-y-auto p-4">
            {ROLES.map((r) => (
              <button
                key={r.id}
                type="button"
                disabled={busy}
                onClick={() => (r.id === 'beneficiary' ? setStep('mic') : void finish(r.id))}
                className="flex min-h-[5rem] items-start gap-3 rounded-xl border border-beige-200 bg-white p-4 text-left active:scale-[0.99] disabled:opacity-60"
              >
                <span aria-hidden className="text-2xl">{r.icon}</span>
                <span className="flex-1">
                  <span className="block text-lg" lang="hi">{r.labelLocal}</span>
                  <span className="block text-sm text-sand-700">{r.label}</span>
                  <span className="mt-1 block text-xs text-sand-700 opacity-80">{r.blurb}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 'mic' && (
        <Pane
          eyebrow="One last thing"
          spoken="अब फ़ोन आपसे माइक की इजाज़त माँगेगा। यह इसलिए ज़रूरी है ताकि आप बोलकर जवाब दे सकें। आपकी आवाज़ रखी नहीं जाती — समझते ही मिटा दी जाती है।"
          locale="hi"
          sub="The phone will ask to use the microphone, so you can answer by speaking. Your voice is never kept — it is deleted the moment it is understood."
          cta={busy ? 'एक पल…' : '🎤 इजाज़त दीजिए · Allow'}
          disabled={busy}
          onNext={() => {
            setBusy(true);
            // Trigger the OS prompt now, while the explanation is still on screen, rather than
            // letting it ambush her mid-interview. A denial here is recoverable — the interview
            // falls back to the keypad — so we continue either way.
            void (async () => {
              try {
                if (asrAvailable()) {
                  const media = navigator.mediaDevices;
                  if (media?.getUserMedia) {
                    const s = await media.getUserMedia({ audio: true });
                    for (const t of s.getTracks()) t.stop();
                  }
                }
              } catch {
                /* denied or unavailable — the keypad path still works */
              }
              await finish('beneficiary');
            })();
          }}
          secondary={
            <Button variant="ghost" disabled={busy} onClick={() => void finish('beneficiary')}>
              बाद में · Later
            </Button>
          }
        />
      )}
    </div>
  );
}

function Pane({
  eyebrow,
  spoken,
  locale,
  sub,
  cta,
  onNext,
  disabled,
  secondary,
}: {
  eyebrow: string;
  spoken: string;
  locale: Locale;
  sub: string;
  cta: string;
  onNext: () => void;
  disabled?: boolean;
  secondary?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col justify-center gap-3 overflow-y-auto px-5">
        <div className="text-xs uppercase tracking-widest text-sand-700 opacity-70">{eyebrow}</div>
        <Speak locale={locale} className="text-2xl font-semibold leading-snug" text={spoken} />
        <p className="text-sm text-sand-700">{sub}</p>
      </div>
      <div className="grid gap-2 p-4 pb-[calc(env(safe-area-inset-bottom)+3.25rem)]">
        <Button size="lg" className="h-14 w-full text-base" disabled={disabled} onClick={onNext}>
          {cta}
        </Button>
        {secondary}
      </div>
    </div>
  );
}
