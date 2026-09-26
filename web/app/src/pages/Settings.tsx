/**
 * Settings, and the "show the switch working" page.
 *
 * `02-tech-landscape.md` argues the sovereign-stack switch is the differentiator, not the model:
 * one provider interface, several implementations, chosen by a config value. This page is where
 * that claim becomes visible rather than asserted — including the honest statement of what the
 * current build actually runs, which is the browser's own speech stack and not Bhashini.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ASR_BACKED_LOCALES, CORE_VERSION, LEXICON, SPOKEN_LOCALES, catalogueStats } from '@rc097/core';
import { AppShell, Band, Card, Stat, StatusChip, useMemoAsync, useTick } from '../components';
import { openStore } from '../lib/db';
import { serverConfigured, signOut, supabase, syncOutbox } from '../lib/supabase';
import { ROLES, setRole as persistRole, type Role } from '../lib/role';
import { asrAvailable, ttsAvailable } from '../lib/speech';

const ASR_PROVIDERS = [
  { id: 'webspeech', label: 'Browser speech (this build)', note: 'Free, zero setup. Needs network on most Android handsets, and its Hindi model is roughly Google STT — 59.9 WER on dialectal telephone Hindi.', live: true },
  { id: 'bhashini', label: 'Bhashini / ULCA', note: 'The sovereign answer and the politically correct one in a MoSJE room. 22 scheduled languages, free for non-commercial use. Needs a ULCA key.', live: false },
  { id: 'sarvam', label: 'Sarvam Saarika', note: '₹30 per hour of audio, best developer experience, lowest latency. Cloud only.', live: false },
  { id: 'indicconformer', label: 'IndicConformer-600M self-hosted', note: 'MIT licence, the provable sovereign path. Costs ₹4.29 lakh/year idle on an always-on L4 and only beats metered API above ~47,700 four-minute interviews a month — so it is the switch you demonstrate, not the default.', live: false },
  { id: 'vosk', label: 'Vosk on-device', note: '~50 MB per language, Apache-2.0, genuinely offline. The real answer for the kiosk channel; needs a small Capacitor plugin, which is the one remaining native piece.', live: false },
];

export default function Settings({ role, onRole }: { role: Role | null; onRole: (r: Role) => void }) {
  const nav = useNavigate();
  const tick = useTick(6000);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const cat = catalogueStats();

  const state = useMemoAsync(
    async () => {
      const store = await openStore();
      const [pending, bens, answers, sessions] = await Promise.all([
        store.outboxSize(),
        store.listBeneficiaries(),
        store.listAnswers(),
        store.listSessions(),
      ]);
      const { data } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
      return { kind: store.kind, pending, bens: bens.length, answers: answers.length, sessions: sessions.length, phone: data.session?.user.phone ?? null };
    },
    [tick],
    { kind: 'idb' as 'idb' | 'sqlite', pending: 0, bens: 0, answers: 0, sessions: 0, phone: null as string | null },
  );

  const wipe = async () => {
    if (!confirm('Delete every interview, answer, consent record and recommendation stored on this device? This cannot be undone.')) return;
    setBusy(true);
    const store = await openStore();
    await store.wipe();
    setNote('Local data cleared.');
    setBusy(false);
  };

  return (
    <AppShell
      title="Settings"
      subtitle={`core ${CORE_VERSION}`}
      bands={!serverConfigured ? <Band tone="warn">No server configured — this build is kiosk-only. Interviews are stored on the device and never leave it.</Band> : undefined}
    >
      <div className="b-main">
        <Card title="Who is using this phone" wide>
          <p className="muted" style={{ marginTop: 0 }}>
            The three audiences get different navigation on purpose. A beneficiary's phone must not
            be two taps from a console listing other people's answers.
          </p>
          <div style={{ display: 'grid', gap: 8 }}>
            {ROLES.map((r) => (
              <button
                key={r.id}
                type="button"
                className="b-btn"
                data-variant={role === r.id ? undefined : 'ghost'}
                style={{ textAlign: 'left' }}
                onClick={async () => {
                  await persistRole(r.id);
                  onRole(r.id);
                  nav('/home');
                }}
              >
                {r.icon} {r.label}
              </button>
            ))}
          </div>
        </Card>

        <Card title="Account">
          <p className="muted" style={{ marginTop: 0 }}>
            {state.phone
              ? 'Signed in. An earlier IVR or WhatsApp conversation on this number will be picked up.'
              : 'Not signed in. Everything works without an account; signing in is what links this app to an earlier phone or WhatsApp conversation.'}
          </p>
          <button type="button" className="b-btn" onClick={() => nav('/login')}>
            {state.phone ? 'Manage sign-in' : 'Sign in with a phone number'}
          </button>
        </Card>

        <Card title="This device">
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <Stat value={state.bens} label="beneficiaries" />
            <Stat value={state.answers} label="answers" />
            <Stat value={state.pending} label="queued to sync" tone={state.pending > 0 ? 'warn' : 'ok'} />
          </div>
          <table className="b-table" style={{ marginTop: 10 }}>
            <tbody>
              <tr>
                <td>Storage</td>
                <td>
                  <StatusChip tone={state.kind === 'sqlite' ? 'eligible' : 'near'}>{state.kind === 'sqlite' ? 'SQLite (native)' : 'IndexedDB'}</StatusChip>
                </td>
              </tr>
              <tr><td>Speech in</td><td><StatusChip tone={asrAvailable() ? 'eligible' : 'out'}>{asrAvailable() ? 'available' : 'unavailable'}</StatusChip></td></tr>
              <tr><td>Speech out</td><td><StatusChip tone={ttsAvailable() ? 'eligible' : 'out'}>{ttsAvailable() ? 'available' : 'unavailable'}</StatusChip></td></tr>
              <tr><td>Signed in</td><td>{state.phone ? <span className="mono">{state.phone}</span> : <span className="muted">no</span>}</td></tr>
            </tbody>
          </table>
          {state.kind === 'idb' && (
            <p className="muted" style={{ marginBottom: 0 }}>
              IndexedDB is evictable — Android can reclaim WebView storage under pressure. Install
              <span className="mono"> @capacitor-community/sqlite </span>and re-sync to switch to a real
              SQLite file, which also lets a district pull the data off a device when a number is disputed.
            </p>
          )}
        </Card>

        <Card title="Speech provider">
          <p className="muted" style={{ marginTop: 0 }}>
            One provider interface, several implementations, chosen by a config value. Only one is
            wired in this build, and saying which is the point.
          </p>
          <table className="b-table">
            <tbody>
              {ASR_PROVIDERS.map((p) => (
                <tr key={p.id}>
                  <td>
                    <strong>{p.label}</strong>
                    <div className="muted">{p.note}</div>
                  </td>
                  <td>{p.live ? <StatusChip tone="eligible">in use</StatusChip> : <StatusChip tone="neutral">seam ready</StatusChip>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card title="Languages">
          <p className="muted" style={{ marginTop: 0 }}>
            Prompts are authored for {SPOKEN_LOCALES.length} locales. Only {ASR_BACKED_LOCALES.length} of
            them have any speech model at all.
          </p>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {SPOKEN_LOCALES.map((l) => (
              <StatusChip key={l} tone={ASR_BACKED_LOCALES.includes(l) ? 'eligible' : 'near'}>
                {l}
                {ASR_BACKED_LOCALES.includes(l) ? '' : ' — no model'}
              </StatusChip>
            ))}
          </div>
          <p className="muted" style={{ marginBottom: 0 }}>
            Bhojpuri (5.05 cr speakers), Rajasthani (2.58 cr), Chhattisgarhi (1.62 cr) and Magahi
            (1.27 cr) have zero coverage in Bhashini, Sarvam or Google, and about 18 hours of published
            corpus between four of them. We do not claim a model for them. The error is absorbed by a
            {' '}{LEXICON.length}-entry vernacular trade lexicon with phonetic matching, and the accuracy
            is measured and published rather than asserted.
          </p>
        </Card>

        <Card title="Catalogue">
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <Stat value={cat.total} label="rows" />
            <Stat value={cat.withQpCode} label="with a real QP code" tone={cat.withQpCode === 0 ? 'bad' : 'ok'} />
            <Stat value={cat.noSchoolingNeeded} label="need no schooling" tone="ok" />
            <Stat value={cat.selfEmployable} label="self-employable" />
          </div>
          <p className="muted" style={{ marginBottom: 0 }}>
            The official register has 2,814 rows, 1,934 of them currently valid, and is two
            authenticated <span className="mono">curl</span>s away — reproduced in
            <span className="mono"> research/03-nqr-import.md</span>, sha256 <span className="mono">348bed87…</span>.
            Run <span className="mono">python3 scripts/import_nqr.py</span> to replace the prototype rows.
          </p>
        </Card>

        <Card title="Sync and data" wide>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="b-btn"
              disabled={busy || !serverConfigured}
              onClick={async () => {
                setBusy(true);
                const r = await syncOutbox();
                setNote(r.failed ? `Sync failed: ${r.errors[0]}` : `Pushed ${r.pushed}.`);
                setBusy(false);
              }}
            >
              Sync now
            </button>
            {state.phone && (
              <button type="button" className="b-btn" data-variant="ghost" onClick={() => void signOut()}>
                Sign out
              </button>
            )}
            <button type="button" className="b-btn" data-variant="ghost" style={{ borderColor: 'var(--color-rose-600)', color: 'var(--color-rose-600)' }} disabled={busy} onClick={() => void wipe()}>
              Delete local data
            </button>
          </div>
          {note && <p className="mono muted">{note}</p>}
          <p className="muted" style={{ marginBottom: 0 }}>
            Deleting local data is also how a withdrawal of consent is honoured on this device. There is
            no audio to delete, because none was ever kept.
          </p>
        </Card>
      </div>
    </AppShell>
  );
}
