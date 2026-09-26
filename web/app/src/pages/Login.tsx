/**
 * Phone sign-in — a real page, reachable from Settings and from Home.
 *
 * It used to be an invisible gate inside the interview that skipped itself entirely whenever no
 * server was configured, which is why it looked as though there were no login at all.
 *
 * What signing in actually buys, and it is the whole point of the channel design: somebody who
 * answered four questions on an IVR call or by WhatsApp voice note verifies the same number here
 * and continues at question five instead of starting again. One person, one profile; sessions are
 * disposable (panel 6).
 *
 * What it does NOT buy: the right to see whatever interviews exist against that number. 51.6% of
 * rural women 15+ own no phone, so the SIM is routinely a husband's or a son's. An OTP proves
 * possession of a handset, not identity — so the server returns counts and dates only, and the
 * four-digit resume PIN still stands between the holder and anyone else's answers.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell, Band, Card, StatusChip } from '../components';
import { resolveIdentity, sendOtp, serverConfigured, signOut, verifyOtp, type ResumableSummary } from '../lib/supabase';

type Step = 'phone' | 'otp' | 'picked';

export default function Login() {
  const nav = useNavigate();
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<ResumableSummary[]>([]);
  const [busy, setBusy] = useState(false);

  const send = async () => {
    setBusy(true);
    setNotice(null);
    const r = await sendOtp(phone);
    setBusy(false);
    if (r.ok) {
      setStep('otp');
      return;
    }
    if (r.reason === 'no_sms_provider') {
      setNotice(
        'SMS sign-in is not switched on for this project yet — Supabase needs an SMS provider (MSG91, Twilio) configured once in the dashboard. Everything else works without it; the interview simply will not link to an earlier IVR or WhatsApp conversation.',
      );
      return;
    }
    setNotice(r.detail);
  };

  const verify = async () => {
    setBusy(true);
    setNotice(null);
    const r = await verifyOtp(phone, otp);
    setBusy(false);
    if (!r.ok) {
      setNotice(r.detail);
      return;
    }
    const id = await resolveIdentity();
    setCandidates(id?.candidates ?? []);
    setStep('picked');
  };

  return (
    <AppShell
      title="Sign in"
      subtitle="Links your phone, WhatsApp and this app to one profile"
      bands={
        !serverConfigured ? (
          <Band tone="warn">
            This build has no server configured, so it runs kiosk-only: interviews stay on this
            device and never leave it. That is a supported mode, not a broken one.
          </Band>
        ) : undefined
      }
    >
      <div className="b-main" style={{ gridTemplateColumns: '1fr', maxWidth: '34rem' }}>
        {step === 'phone' && (
          <Card title="Your mobile number" wide>
            <p className="muted" style={{ marginTop: 0 }} lang="hi">
              अगर आपने पहले फ़ोन पर या व्हाट्सएप पर बात की थी, तो उसी नंबर से आगे बढ़ सकते हैं — शुरू से नहीं करना पड़ेगा।
            </p>
            <input
              inputMode="numeric"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="98765 43210"
              aria-label="Mobile number"
              style={{
                fontSize: 26,
                letterSpacing: 2,
                padding: '14px 16px',
                borderRadius: 12,
                border: '2px solid var(--color-beige-300)',
                width: '100%',
                marginBottom: 12,
              }}
            />
            <button
              type="button"
              className="b-btn"
              disabled={busy || !serverConfigured || phone.replace(/\D/g, '').length < 10}
              onClick={() => void send()}
            >
              {busy ? 'Sending…' : 'Send code'}
            </button>
            <p className="muted" style={{ marginBottom: 0 }}>
              The number is verified by SMS and then hashed on the server with a secret that never
              leaves it. The raw number is never stored.
            </p>
          </Card>
        )}

        {step === 'otp' && (
          <Card title="Enter the code" wide>
            <p className="muted" style={{ marginTop: 0 }}>{phone}</p>
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              aria-label="One-time code"
              style={{
                fontSize: 30,
                letterSpacing: 8,
                textAlign: 'center',
                padding: '14px 16px',
                borderRadius: 12,
                border: '2px solid var(--color-beige-300)',
                width: '100%',
                marginBottom: 12,
              }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="b-btn" disabled={busy || otp.length < 4} onClick={() => void verify()}>
                Verify
              </button>
              <button type="button" className="b-btn" data-variant="ghost" onClick={() => setStep('phone')}>
                Change number
              </button>
            </div>
          </Card>
        )}

        {step === 'picked' && (
          <Card title={candidates.length ? 'Earlier conversations on this number' : 'Signed in'} wide>
            {candidates.length === 0 && (
              <p style={{ marginTop: 0 }}>No earlier interview found. Starting fresh.</p>
            )}
            {candidates.map((c) => (
              <div
                key={c.sessionId}
                style={{ border: '1px solid var(--color-beige-200)', borderRadius: 10, padding: 10, marginBottom: 8 }}
              >
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <StatusChip tone="info">{c.channel}</StatusChip>
                  <span>{new Date(c.lastTurnAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                  <span className="mono">{c.confirmedCount} of 7 answered</span>
                  {c.pinRequired && <StatusChip tone="near">needs your 4 digits</StatusChip>}
                </div>
              </div>
            ))}
            {candidates.length > 0 && (
              <p className="muted">
                Nothing from an earlier conversation is shown or read aloud until the four digits
                match. Phones here are shared; a verified number is not a verified person.
              </p>
            )}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" className="b-btn" onClick={() => nav('/interview')}>
                Continue
              </button>
              <button type="button" className="b-btn" data-variant="ghost" onClick={() => void signOut().then(() => setStep('phone'))}>
                Sign out
              </button>
            </div>
          </Card>
        )}

        {notice && (
          <Card title="Note" wide>
            <p style={{ margin: 0 }}>{notice}</p>
          </Card>
        )}

        <Card title="You can skip this" wide>
          <p className="muted" style={{ marginTop: 0 }}>
            Signing in is optional. The interview, the recommendation and the whole offline kiosk
            path work without an account — that channel is designed to have no vendor in it at all.
          </p>
          <button type="button" className="b-btn" data-variant="ghost" onClick={() => nav('/interview')}>
            Skip and start the questions
          </button>
        </Card>
      </div>
    </AppShell>
  );
}
