/**
 * The front door: a role chooser on first run, then that role's home.
 *
 * What was wrong before: `/` was the interview itself, so the app opened mid-consent-script with no
 * context, no account, no way back, and a tab bar that offered a District Collector's console to a
 * beneficiary. It was an engine with one screen bolted on, not an application.
 *
 * Each role's home answers one question and nothing else:
 *   beneficiary — "where had I got to, and what do I do next?"
 *   mobiliser   — "who is left in this village today?"
 *   officer     — "how close is the April deadline and what is the register telling me?"
 */

import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { conceptLabel } from '@rc097/core';
import { AppShell, Band, Beads, Card, OfflineBand, Speak, Stat, StatusChip, useMemoAsync, useTick } from '../components';
import { openStore } from '../lib/db';
import { ROLES, setRole, type Role } from '../lib/role';
import { serverConfigured, supabase } from '../lib/supabase';

export default function Home({ role, onRole }: { role: Role | null; onRole: (r: Role) => void }) {
  if (!role) return <RoleChooser onRole={onRole} />;
  if (role === 'beneficiary') return <BeneficiaryHome />;
  if (role === 'mobiliser') return <MobiliserHome />;
  return <OfficerHome />;
}

// ---------------------------------------------------------------------------- first run

function RoleChooser({ onRole }: { onRole: (r: Role) => void }) {
  const [busy, setBusy] = useState(false);
  const pick = async (r: Role) => {
    setBusy(true);
    await setRole(r);
    onRole(r);
  };
  return (
    <div className="a-screen">
      <div className="a-stage">
        <div style={{ fontSize: 'var(--text-label)', letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.7 }}>
          PM-AJAY · Grant-in-Aid
        </div>
        <Speak
          locale="hi"
          className="a-question"
          text="नमस्ते। आप कौन हैं? नीचे से चुनिए।"
        />
        <p className="muted" style={{ color: 'var(--color-plum-300)', marginTop: -4 }}>
          Choose once. You can change it later in Settings.
        </p>
      </div>
      <div className="a-actions">
        {ROLES.map((r) => (
          <button key={r.id} type="button" className="a-btn" disabled={busy} onClick={() => void pick(r.id)}>
            <span className="a-btn-icon" aria-hidden>{r.icon}</span>
            <span>
              <span lang="hi" style={{ display: 'block' }}>{r.labelLocal}</span>
              <span style={{ display: 'block', fontSize: 'var(--text-label)', opacity: 0.65 }}>{r.label}</span>
              <span style={{ display: 'block', fontSize: 'var(--text-label)', opacity: 0.5, marginTop: 2 }}>{r.blurb}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------- beneficiary

function BeneficiaryHome() {
  const nav = useNavigate();
  const tick = useTick(5000);

  const me = useMemoAsync(
    async () => {
      const store = await openStore();
      const people = await store.listBeneficiaries();
      const b = people[0] ?? null;
      if (!b) return { b: null, confirmed: [] as number[], deferred: [] as number[], reco: null, pending: 0 };
      const [answers, reco, pending, sessions] = await Promise.all([
        store.answersFor(b.id),
        store.latestRecommendation(b.id),
        store.outboxSize(),
        store.listSessions(),
      ]);
      return {
        b,
        confirmed: answers.filter((a) => a.confirmedAt).map((a) => a.fieldNo as number),
        deferred: (sessions.find((s) => s.beneficiaryId === b.id)?.deferred ?? []) as number[],
        reco,
        pending,
      };
    },
    [tick],
    { b: null as null | { villageName: string | null; blockName: string | null }, confirmed: [] as number[], deferred: [] as number[], reco: null as any, pending: 0 },
  );

  const done = me.confirmed.length;
  const started = done > 0;
  const finished = done === 7;
  const top = me.reco?.result?.top?.[0]?.qualification ?? null;

  return (
    <AppShell
      title="PM-AJAY Livelihood"
      subtitle={me.b ? [me.b.villageName, me.b.blockName].filter(Boolean).join(' · ') || undefined : undefined}
      bands={<OfflineBand pending={me.pending} />}
    >
      <div className="b-main" style={{ gridTemplateColumns: '1fr', maxWidth: '44rem' }}>
        {/* One primary action, and it changes with where you actually are. */}
        <Card title={finished ? 'Your plan is ready' : started ? 'Carry on where you stopped' : 'Start here'} wide>
          {!started && (
            <Speak
              locale="hi"
              text="सात छोटे सवाल हैं — आपकी पढ़ाई, आपके घर का काम, और आप क्या सीखना चाहती हैं। चार मिनट लगेंगे। बीच में रुक भी सकती हैं।"
            />
          )}
          {started && !finished && (
            <>
              <Beads confirmed={me.confirmed} deferred={me.deferred} />
              <p lang="hi" style={{ marginTop: 10 }}>
                {done} सवालों के जवाब हो चुके हैं। बाक़ी {7 - done} कभी भी पूरे कर सकती हैं — कुछ खोएगा नहीं।
              </p>
            </>
          )}
          {finished && top && (
            <p lang="hi" style={{ marginTop: 0 }}>
              आपके लिए <strong>{top.title}</strong> निकला है।
            </p>
          )}

          <button
            type="button"
            className="a-btn"
            data-variant="primary"
            style={{ marginTop: 12, width: '100%' }}
            onClick={() => nav(finished ? '/me' : '/interview')}
          >
            {finished ? '📄 अपनी योजना देखिए' : started ? '▶ आगे बढ़ाइए' : '🎤 शुरू कीजिए'}
          </button>
        </Card>

        <Card title="Anything you want to ask" wide>
          <p className="muted" style={{ marginTop: 0 }}>
            स्कूल नहीं गईं तो क्या? कितने दिन का कोर्स? पैसे कितने लगेंगे? बोलकर पूछ सकती हैं।
          </p>
          <button type="button" className="b-btn" data-variant="ghost" onClick={() => nav('/chat')}>
            💬 पूछिए
          </button>
        </Card>

        {finished && me.reco?.result?.nearMiss?.length > 0 && (
          <Card title="One gap worth closing" wide>
            <StatusChip tone="near">
              {me.reco.result.nearMiss[0].gate.gap?.needLocal ?? me.reco.result.nearMiss[0].gate.gap?.need}
            </StatusChip>
          </Card>
        )}

        <Card title="What happens to what you say" wide>
          <p className="muted" style={{ margin: 0 }}>
            आपकी आवाज़ रखी नहीं जाती — समझते ही मिटा दी जाती है। जो शब्द निकले वो भी तब मिट जाते हैं जब आप
            "हाँ, सही है" कहती हैं। सिर्फ़ आपका पक्का किया हुआ जवाब बचता है।
          </p>
        </Card>
      </div>
    </AppShell>
  );
}

// ---------------------------------------------------------------------------- mobiliser

function MobiliserHome() {
  const nav = useNavigate();
  const tick = useTick(6000);
  const d = useMemoAsync(
    async () => {
      const store = await openStore();
      const [people, answers, pending] = await Promise.all([
        store.listBeneficiaries(),
        store.listAnswers(),
        store.outboxSize(),
      ]);
      const doneIds = new Set(
        people
          .filter((b) => answers.filter((a) => a.beneficiaryId === b.id && a.confirmedAt).length === 7)
          .map((b) => b.id),
      );
      const women = people.filter((b) => b.isWoman).length;
      return {
        total: people.length,
        done: doneIds.size,
        pendingPeople: people.length - doneIds.size,
        womenShare: people.length ? Math.round((women / people.length) * 100) : 0,
        pending,
      };
    },
    [tick],
    { total: 0, done: 0, pendingPeople: 0, womenShare: 0, pending: 0 },
  );

  return (
    <AppShell
      title="Village worker"
      subtitle="Assisted mode"
      bands={
        <>
          <OfflineBand pending={d.pending} />
          {d.total > 0 && d.womenShare < 30 && (
            <Band tone="warn">
              Women are {d.womenShare}% here. The guidelines require at least 30% in every skill
              programme — that is a target to work towards, not a statistic to report.
            </Band>
          )}
        </>
      }
    >
      <div className="b-main">
        <Card title="Today" wide>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <Stat value={d.done} label="Completed" tone="ok" />
            <Stat value={d.pendingPeople} label="To finish" tone="warn" />
            <Stat value={`${d.womenShare}%`} label="Women" tone={d.womenShare < 30 ? 'bad' : 'ok'} />
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <button type="button" className="b-btn" onClick={() => nav('/interview')}>
              🎤 Start an interview
            </button>
            <button type="button" className="b-btn" data-variant="ghost" onClick={() => nav('/field')}>
              📋 Open the call list
            </button>
          </div>
        </Card>

        <Card title="Before you hand the phone over" wide>
          <p style={{ margin: 0, fontSize: 'var(--text-bodysm)' }}>
            Consent must be <strong>spoken by her</strong>. Your worker id is logged beside it as
            evidence. You cannot consent on her behalf and there is no button that lets you.
          </p>
        </Card>

        <Card title="Offline" wide>
          <p className="muted" style={{ margin: 0 }}>
            Everything works with the radio off. Interviews upload themselves when signal returns —
            you never have to remember to sync.
          </p>
        </Card>
      </div>
    </AppShell>
  );
}

// ---------------------------------------------------------------------------- officer

function nextAprilDays(now = new Date()): number {
  const year = now.getMonth() >= 3 ? now.getFullYear() + 1 : now.getFullYear();
  return Math.ceil((Date.UTC(year, 3, 7) - now.getTime()) / 86_400_000);
}

function OfficerHome() {
  const nav = useNavigate();
  const tick = useTick(8000);
  const d = useMemoAsync(
    async () => {
      const store = await openStore();
      const [people, answers, recos] = await Promise.all([
        store.listBeneficiaries(),
        store.listAnswers(),
        store.listRecommendations(),
      ]);
      const hist = new Map<string, number>();
      for (const a of answers) {
        if (a.fieldNo !== 4 || !a.confirmedAt || a.value.kind !== 'concepts') continue;
        for (const c of a.value.conceptIds) hist.set(c, (hist.get(c) ?? 0) + 1);
      }
      const topTrade = [...hist.entries()].sort((x, y) => y[1] - x[1])[0] ?? null;
      return {
        people: people.length,
        recos: recos.length,
        nearMiss: recos.filter((r) => r.result.nearMiss.length > 0).length,
        topTrade,
        distinct: hist.size,
      };
    },
    [tick],
    { people: 0, recos: 0, nearMiss: 0, topTrade: null as null | [string, number], distinct: 0 },
  );
  const days = nextAprilDays();

  return (
    <AppShell title="District officer" subtitle="DL-PACC">
      <div className="b-main">
        <Card title="The deadline" wide>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <Stat value={days} label="days to the first week of April" tone={days < 45 ? 'bad' : 'warn'} />
            <Stat value="3.5-4×" label="notional allocation to project" />
          </div>
          <p className="muted" style={{ marginBottom: 0 }}>
            DL-PACC submits district projects through the portal by the first week of April.
            Beneficiary demand that arrives in July is worthless.
          </p>
          <button type="button" className="b-btn" style={{ marginTop: 10 }} onClick={() => nav('/officer')}>
            🏛️ Open the console
          </button>
        </Card>

        <Card title="Register">
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <Stat value={d.people} label="beneficiaries" />
            <Stat value={d.nearMiss} label="near miss" tone="warn" />
            <Stat value={d.distinct} label="distinct trades" />
          </div>
        </Card>

        <Card title="Most-asked trade">
          {d.topTrade ? (
            <>
              <Stat value={conceptLabel(d.topTrade[0], 'en')} label={`${d.topTrade[1]} beneficiaries`} />
              <p className="muted" style={{ marginBottom: 0 }}>
                Watch this number. CAG found 40% of national certifications in 10 job-roles; if our
                own demand concentrates the same way, we automated the failure with better UX.
              </p>
            </>
          ) : (
            <p className="muted" style={{ margin: 0 }}>No confirmed demand yet.</p>
          )}
        </Card>
      </div>
    </AppShell>
  );
}

// ---------------------------------------------------------------------------- account strip

export function AccountLine() {
  const state = useMemoAsync(
    async () => {
      if (!supabase) return { phone: null as string | null };
      const { data } = await supabase.auth.getSession();
      return { phone: data.session?.user.phone ?? null };
    },
    [],
    { phone: null as string | null },
  );
  if (!serverConfigured) return <StatusChip tone="neutral">Kiosk — no account</StatusChip>;
  return state.phone ? <StatusChip tone="eligible">{state.phone}</StatusChip> : <StatusChip tone="near">Not signed in</StatusChip>;
}
