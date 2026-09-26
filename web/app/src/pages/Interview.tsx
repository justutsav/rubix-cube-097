/**
 * Register A — the beneficiary interview. The screen IS the card; one decision at a time.
 *
 * Three states share this file because they are one continuous experience and splitting them would
 * mean re-deriving the session in each: the phone-number gate, the interview itself, and the spoken
 * recommendation.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  describeAnswer,
  SPOKEN_LOCALES,
  type ExpectOption,
  type FieldNo,
  type Locale,
  type ScoredQualification,
  type SessionState,
} from '@rc097/core';
import { Band, Beads, Mic, Options, PinPad, Speak, StatusChip, useMemoAsync } from '../components';
import { useInterview } from '../lib/interview';
import { openStore } from '../lib/db';
import { resolveIdentity, sendOtp, serverConfigured, verifyOtp, type ResumableSummary } from '../lib/supabase';

type Gate = 'phone' | 'otp' | 'pick' | 'interview';

const LOCALE_LABEL: Record<Locale, string> = {
  hi: 'हिंदी',
  bho: 'भोजपुरी',
  mag: 'मगही',
  raj: 'राजस्थानी',
  cgh: 'छत्तीसगढ़ी',
  ta: 'தமிழ்',
  en: 'English',
};

export default function Interview() {
  const iv = useInterview('app');
  const [gate, setGate] = useState<Gate>(serverConfigured ? 'phone' : 'interview');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<ResumableSummary[]>([]);

  // No server configured means the kiosk case: start straight into the interview with no sign-in.
  // That is not a degraded mode, it is the ₹0 channel working as designed.
  useEffect(() => {
    if (gate === 'interview' && !iv.session) void iv.begin();
  }, [gate, iv]);

  const doSendOtp = async () => {
    setNotice(null);
    const r = await sendOtp(phone);
    if (r.ok) {
      setGate('otp');
      return;
    }
    if (r.reason === 'no_sms_provider') {
      setNotice(
        'SMS sign-in is not switched on for this project yet (Supabase needs an SMS provider such as MSG91 configured). Continuing without sign-in — the interview works, it just will not link to an earlier IVR or WhatsApp conversation.',
      );
      setGate('interview');
      return;
    }
    setNotice(r.detail);
  };

  const doVerify = async () => {
    setNotice(null);
    const r = await verifyOtp(phone, otp);
    if (!r.ok) {
      setNotice(r.detail);
      return;
    }
    const id = await resolveIdentity();
    if (id && id.candidates.length > 0) {
      // Shared handset, or a genuine earlier conversation. Either way: reveal nothing yet.
      setCandidates(id.candidates);
      setGate('pick');
      return;
    }
    setGate('interview');
    await iv.begin({ beneficiaryId: id?.beneficiaryId ?? undefined });
  };

  if (gate === 'phone') return <PhoneGate phone={phone} setPhone={setPhone} onSend={doSendOtp} onSkip={() => setGate('interview')} notice={notice} />;
  if (gate === 'otp') return <OtpGate phone={phone} otp={otp} setOtp={setOtp} onVerify={doVerify} notice={notice} />;
  if (gate === 'pick')
    return (
      <PickConversation
        candidates={candidates}
        onNew={async () => {
          setGate('interview');
          await iv.begin();
        }}
        onResume={async (sessionId) => {
          const store = await openStore();
          const s = await store.getSession(sessionId);
          setGate('interview');
          // The PIN gate is an FSM state, not a screen: routing through RESUME_GATE means the app
          // and the phone channel apply exactly the same rule about what may be said before it
          // clears.
          await iv.begin({ resume: s ? ({ ...s, state: 'RESUME_GATE', phase: 'LISTEN' } as SessionState) : undefined });
        }}
      />
    );

  return <Stage iv={iv} />;
}

// ---------------------------------------------------------------------------- gates

function Screen({ children, actions }: { children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="a-screen">
      <div className="a-stage">{children}</div>
      {actions}
    </div>
  );
}

function PhoneGate({
  phone,
  setPhone,
  onSend,
  onSkip,
  notice,
}: {
  phone: string;
  setPhone: (v: string) => void;
  onSend: () => void;
  onSkip: () => void;
  notice: string | null;
}) {
  return (
    <Screen
      actions={
        <div className="a-actions">
          <button type="button" className="a-btn" data-variant="primary" onClick={onSend} disabled={phone.replace(/\D/g, '').length < 10}>
            आगे बढ़ें
          </button>
          <button type="button" className="a-btn" onClick={onSkip}>
            <span className="a-btn-icon" aria-hidden>🏛️</span>
            <span>
              <span style={{ display: 'block' }} lang="hi">बिना नंबर, यहीं पर (कियोस्क)</span>
              <span style={{ display: 'block', fontSize: 'var(--text-label)', opacity: 0.6 }}>Kiosk mode — no sign-in</span>
            </span>
          </button>
        </div>
      }
    >
      <Beads confirmed={[]} deferred={[]} />
      <h1 className="a-question" lang="hi">अपना मोबाइल नंबर बताइए</h1>
      <Speak
        locale="hi"
        promptId="consent.ask.v1"
        text="अगर आपने पहले फ़ोन पर या व्हाट्सएप पर बात की थी, तो उसी नंबर से आगे बढ़ सकते हैं — शुरू से नहीं करना पड़ेगा।"
      />
      <input
        inputMode="numeric"
        autoComplete="tel"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="98765 43210"
        aria-label="Mobile number"
        style={{
          fontSize: 28,
          letterSpacing: 2,
          padding: '14px 16px',
          borderRadius: 12,
          border: '2px solid var(--color-plum-300)',
          background: '#fff',
          color: 'var(--color-plum-900)',
          width: '100%',
        }}
      />
      {notice && <div style={{ background: 'var(--color-amber-100)', color: '#7a4510', padding: 12, borderRadius: 10, fontSize: 'var(--text-bodysm)' }}>{notice}</div>}
      <p className="muted" style={{ color: 'var(--color-plum-300)' }}>
        The number is verified by SMS and hashed on the server — the raw number is never stored.
      </p>
    </Screen>
  );
}

function OtpGate({
  phone,
  otp,
  setOtp,
  onVerify,
  notice,
}: {
  phone: string;
  otp: string;
  setOtp: (v: string) => void;
  onVerify: () => void;
  notice: string | null;
}) {
  return (
    <Screen
      actions={
        <div className="a-actions">
          <button type="button" className="a-btn" data-variant="primary" onClick={onVerify} disabled={otp.length < 4}>
            पक्का कीजिए
          </button>
        </div>
      }
    >
      <h1 className="a-question" lang="hi">SMS का कोड डालिए</h1>
      <p className="muted" style={{ color: 'var(--color-plum-300)' }}>{phone}</p>
      <input
        inputMode="numeric"
        autoComplete="one-time-code"
        value={otp}
        onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
        style={{ fontSize: 32, letterSpacing: 8, textAlign: 'center', padding: '14px 16px', borderRadius: 12, border: '2px solid var(--color-plum-300)', width: '100%' }}
        aria-label="OTP"
      />
      {notice && <div style={{ background: 'var(--color-rose-100)', color: '#8c1d17', padding: 12, borderRadius: 10 }}>{notice}</div>}
    </Screen>
  );
}

/**
 * The shared-handset disambiguation.
 *
 * Everything here is a count and a date. No name, no trade, no district, no answer — because an
 * OTP proves possession of a SIM and nothing more, and on this phone the SIM's owner is statistically
 * likely to be someone other than the beneficiary (spec §9 BLOCKER 1).
 */
function PickConversation({
  candidates,
  onResume,
  onNew,
}: {
  candidates: ResumableSummary[];
  onResume: (sessionId: string) => void;
  onNew: () => void;
}) {
  return (
    <Screen
      actions={
        <div className="a-actions">
          <button type="button" className="a-btn" data-variant="primary" onClick={onNew}>
            नई शुरुआत
          </button>
        </div>
      }
    >
      <h1 className="a-question" lang="hi">इस नंबर पर पहले भी बातचीत हुई है</h1>
      <Speak
        locale="hi"
        promptId="pin.ask.v1"
        text="जारी रखनी है तो अपने चार अंक डालने होंगे। नई शुरुआत भी कर सकते हैं।"
      />
      <div style={{ display: 'grid', gap: 10 }}>
        {candidates.map((c) => (
          <button
            key={c.sessionId}
            type="button"
            className="a-btn"
            onClick={() => onResume(c.sessionId)}
            style={{ background: '#fff' }}
          >
            <span className="a-btn-icon" aria-hidden>{c.channel === 'ivr' ? '📞' : c.channel === 'whatsapp' ? '💬' : '📱'}</span>
            <span>
              <span style={{ display: 'block' }}>
                {new Date(c.lastTurnAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · {c.confirmedCount} of 7 answered
              </span>
              <span style={{ display: 'block', fontSize: 'var(--text-label)', opacity: 0.6 }}>
                {c.pinRequired ? 'Needs your 4 digits' : 'Continue'}
              </span>
            </span>
          </button>
        ))}
      </div>
      <p className="muted" style={{ color: 'var(--color-plum-300)' }}>
        Nothing from an earlier conversation is shown or read out until the four digits match. Phones
        are shared; a verified number is not a verified person.
      </p>
    </Screen>
  );
}

// ---------------------------------------------------------------------------- the interview

const FIELD_OF_STATE: Record<string, FieldNo> = {
  Q1_EDUCATION: 1,
  Q2_FAMILY_OCCUPATION: 2,
  Q2_YEARS: 2,
  Q3_CURRENT_LIVELIHOOD: 3,
  Q4_SKILLS_INTERESTS: 4,
  Q5_MOBILITY_CONSTRAINT: 5,
  Q6_EMPLOYMENT_PREF: 6,
  Q7_LOCAL_ECONOMY: 7,
};

function Stage({ iv }: { iv: ReturnType<typeof useInterview> }) {
  const s = iv.session;
  const [typed, setTyped] = useState('');
  const pending = useMemoAsync(async () => (iv.store ? iv.store.outboxSize() : 0), [iv.store, iv.session?.lastTurnAt], 0);

  const headline = useMemo(() => {
    const first = iv.say.find((x) => 'text' in x && x.text);
    return first && 'text' in first ? first : null;
  }, [iv.say]);

  if (!s) {
    return (
      <Screen>
        <h1 className="a-question">…</h1>
      </Screen>
    );
  }

  if (s.state === 'RECOMMEND' || s.state === 'NEXT_STEP' || (s.state === 'CLOSE' && iv.recommendation)) {
    return <Result iv={iv} />;
  }

  const langPick = s.state === 'LANG_SELECT';
  const options: ExpectOption[] = langPick
    ? SPOKEN_LOCALES.map((l, i) => ({ id: l, label: LOCALE_LABEL[l], labelLocal: LOCALE_LABEL[l], dtmf: String(i + 1), icon: '🗣️' }))
    : (iv.expect.options ?? []);

  const wantsPin = iv.expect.kind === 'pin';
  const wantsOpen = iv.expect.kind === 'open' || iv.expect.kind === 'number';

  return (
    <div className="a-screen">
      {!navigator.onLine && <Band tone="warn">Offline — this interview still works. {pending > 0 ? `${pending} waiting to sync.` : 'Nothing is lost.'}</Band>}
      {iv.asrDegraded && (
        <Band tone="warn">
          No speech model exists for {LOCALE_LABEL[s.locale]}. Recognition runs on the Hindi model and
          the error is absorbed by the trade lexicon — accuracy is measured, not claimed.
        </Band>
      )}

      <div className="a-stage">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Beads confirmed={iv.progress.confirmed} deferred={iv.progress.deferred} current={FIELD_OF_STATE[s.state]} />
          {iv.lastTurnMs !== null && (
            <span className="mono" style={{ opacity: 0.6, fontSize: 13 }} title="Turn latency. Budget is 1800 ms.">
              {iv.lastTurnMs} ms
            </span>
          )}
        </div>

        {headline && (
          <Speak
            locale={s.locale}
            promptId={headline.kind === 'prerendered' ? headline.id : undefined}
            text={headline.text}
            className="a-question"
          />
        )}

        {/* Any remaining lines (the readback list, the eligibility remark) as a spoken block. */}
        {iv.say.length > 1 && (
          <div style={{ display: 'grid', gap: 8, background: 'rgb(255 255 255 / 8%)', padding: 12, borderRadius: 12 }}>
            {iv.say.slice(1).map((line, i) =>
              'text' in line && line.text ? (
                <Speak key={i} locale={s.locale} promptId={line.kind === 'prerendered' ? line.id : undefined} text={line.text} />
              ) : null,
            )}
          </div>
        )}

        {iv.partial && (
          <div lang={s.locale} style={{ opacity: 0.7, fontStyle: 'italic' }}>
            “{iv.partial}”
          </div>
        )}

        {iv.error === 'no_asr' && (
          <Band tone="bad">
            This browser has no speech recognition. Use the buttons below, or open in Chrome / the
            Android build.
          </Band>
        )}

        {wantsPin && <PinPad label="चार अंक दबाइए" onDone={(pin) => void iv.sendDtmf(pin)} />}

        {wantsOpen && !wantsPin && (
          <div style={{ marginTop: 'auto', display: 'grid', gap: 12 }}>
            <Mic
              state={iv.mic}
              onToggle={() => void iv.listen()}
              onCancel={iv.stopListening}
              hint={iv.expect.kind === 'number' ? 'या नीचे लिखकर भी बता सकते हैं' : undefined}
            />
            <details>
              <summary style={{ cursor: 'pointer', fontSize: 'var(--text-bodysm)', opacity: 0.8 }}>लिखकर बताइए</summary>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!typed.trim()) return;
                  void iv.sendText(typed.trim());
                  setTyped('');
                }}
                style={{ display: 'flex', gap: 8, marginTop: 8 }}
              >
                <input
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  lang={s.locale}
                  style={{ flex: 1, fontSize: 18, padding: '12px 14px', borderRadius: 10, border: '2px solid var(--color-plum-300)' }}
                  inputMode={iv.expect.kind === 'number' ? 'numeric' : 'text'}
                />
                <button type="submit" className="a-btn" data-variant="primary" style={{ minWidth: 88 }}>
                  भेजें
                </button>
              </form>
            </details>
          </div>
        )}
      </div>

      {options.length > 0 && !wantsPin && (
        <Options options={options} layout={iv.expect.layout ?? (options.length > 3 ? 'grid' : 'stack')} locale={s.locale} onPick={(id) => void iv.choose(id)} />
      )}

      {iv.say.length > 0 && (
        <div style={{ padding: '8px 16px 16px', background: 'var(--color-beige-100)', display: 'flex', gap: 8, justifyContent: 'center' }}>
          <button type="button" className="b-btn" data-variant="ghost" onClick={iv.repeat}>
            🔁 दोबारा सुनिए
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------- result

function RecoCard({ r, locale, rank }: { r: ScoredQualification; locale: Locale; rank: number }) {
  const q = r.qualification;
  const near = r.gate.bucket === 'NEAR_MISS';
  const months = q.notionalHours ? Math.max(1, Math.round(q.notionalHours / 150)) : null;
  return (
    <article
      style={{
        background: '#fff',
        borderRadius: 14,
        padding: 16,
        border: `2px solid ${near ? 'var(--color-amber-500)' : 'var(--color-teal-600)'}`,
        display: 'grid',
        gap: 10,
        color: 'var(--color-plum-900)',
      }}
    >
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <StatusChip tone={near ? 'near' : 'eligible'}>{near ? 'लगभग — एक कमी' : 'आप योग्य हैं'}</StatusChip>
        <StatusChip tone="neutral">{q.levelLabel}</StatusChip>
        {months && <StatusChip tone="neutral">{months} महीने</StatusChip>}
        {q.selfEmployable && <StatusChip tone="info">अपना काम</StatusChip>}
      </div>

      <h3 style={{ margin: 0, fontSize: 'var(--text-lead)' }}>
        {rank}. {q.title}
      </h3>

      <Speak locale={locale} text={r.explain.beneficiary} />

      {near && r.gate.gap && (
        <div style={{ background: 'var(--color-amber-100)', padding: 12, borderRadius: 10, fontSize: 'var(--text-bodysm)' }}>
          <strong>क्या चाहिए: </strong>
          {r.gate.gap.needLocal ?? r.gate.gap.need}
        </div>
      )}

      {q.delivery && (
        <div className="muted">
          {q.notionalHours} घंटे — {q.delivery.theory} पढ़ाई, {q.delivery.practical} हाथ का काम
          {q.delivery.ojtMandatory > 0 ? `, ${q.delivery.ojtMandatory} असली काम की जगह पर` : ''}
        </div>
      )}

      {/* Provenance, on the card, not in a footnote. A prototype row must never look official. */}
      {q.qpCode ? (
        <div className="mono muted">QP {q.qpCode}</div>
      ) : (
        <div className="mono" style={{ color: 'var(--color-amber-600)' }} title="decisions.md: no invented QP codes, ever.">
          QP code pending official NQR import
        </div>
      )}

      <details>
        <summary style={{ cursor: 'pointer', fontSize: 'var(--text-label)' }}>Why this one? (officer view)</summary>
        <p className="muted" style={{ marginTop: 6 }}>{r.explain.officer}</p>
      </details>
    </article>
  );
}

function Result({ iv }: { iv: ReturnType<typeof useInterview> }) {
  const s = iv.session!;
  const reco = iv.recommendation;
  const answers = ([1, 2, 3, 4, 5, 6, 7] as FieldNo[]).map((n) => s.answers[n]).filter(Boolean);

  return (
    <div className="a-screen">
      {reco?.containsPrototypeData && (
        <Band tone="warn">
          Prototype course catalogue — QP codes are NULL until the official NQR import runs. Nothing
          here is labelled as an official qualification.
        </Band>
      )}

      <div className="a-stage">
        <h1 className="a-question" lang={s.locale}>
          {reco && reco.top.length > 0 ? 'आपके लिए ये रास्ते निकले' : 'अभी पूरी जानकारी नहीं है'}
        </h1>

        {iv.say.map((line, i) =>
          'text' in line && line.text ? (
            <Speak key={i} locale={s.locale} promptId={line.kind === 'prerendered' ? line.id : undefined} text={line.text} />
          ) : null,
        )}

        <div style={{ display: 'grid', gap: 12 }}>
          {reco?.top.map((r, i) => (
            <RecoCard key={r.qualification.localId} r={r} locale={s.locale} rank={i + 1} />
          ))}
          {reco?.nearMiss.map((r) => (
            <RecoCard key={r.qualification.localId} r={r} locale={s.locale} rank={(reco.top.length ?? 0) + 1} />
          ))}
        </div>

        {reco?.routeToPmDaksh?.route && (
          <div style={{ background: 'var(--color-amber-100)', color: '#7a4510', padding: 14, borderRadius: 12 }}>
            <strong>PM-DAKSH</strong> — इसी तरह की ट्रेनिंग वहाँ भी है, और हर महीने ₹
            {reco.routeToPmDaksh.stipendPerMonth} मिलते हैं.
            <div className="muted" style={{ marginTop: 6 }}>{reco.routeToPmDaksh.reason}</div>
          </div>
        )}

        {reco?.assetGrantEligible && (
          <div style={{ background: 'var(--color-teal-100)', color: '#0b5b55', padding: 14, borderRadius: 12 }}>
            अपना काम शुरू करने पर, बैंक से क़र्ज़ लेने की सूरत में योजना से <strong>₹50,000 तक</strong> की मदद मिल सकती है।
          </div>
        )}

        {reco && reco.opportunities.length > 0 && (
          <div style={{ background: 'rgb(255 255 255 / 8%)', padding: 12, borderRadius: 12 }}>
            <strong style={{ fontSize: 'var(--text-bodysm)' }}>आपके इलाक़े में</strong>
            <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
              {reco.opportunities.map((o, i) => (
                <li key={i} style={{ fontSize: 'var(--text-bodysm)' }}>
                  {o.title}
                  {o.distanceKm !== null ? ` — ${o.distanceKm} किमी` : ''}
                  <span className="mono" style={{ opacity: 0.6, marginLeft: 6 }}>
                    {o.source === 'PLACEHOLDER_NEEDS_SOURCING' ? '(unsourced)' : `(${o.sourceDate})`}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <details>
          <summary style={{ cursor: 'pointer' }}>आपने जो बताया (सातों बातें)</summary>
          <ol style={{ paddingLeft: 20 }}>
            {answers.map((a) => (
              <li key={a!.fieldNo} lang={s.locale} style={{ marginBottom: 4 }}>
                {describeAnswer(a!.value, s.locale)}
                <span className="mono" style={{ opacity: 0.55, marginLeft: 6 }}>
                  {a!.method} {a!.confidence.toFixed(2)}
                </span>
              </li>
            ))}
          </ol>
          <p className="muted">
            Audio was discarded within the turn; the transcript was erased when you confirmed each
            answer. Only the confirmed values remain.
          </p>
        </details>
      </div>

      <div className="a-actions">
        <button type="button" className="a-btn" data-variant="confirm" onClick={iv.repeat}>
          🔊 दोबारा सुनिए
        </button>
        <button type="button" className="a-btn" onClick={() => void iv.begin()}>
          <span className="a-btn-icon" aria-hidden>↩</span>
          <span>नई बातचीत</span>
        </button>
      </div>
    </div>
  );
}
