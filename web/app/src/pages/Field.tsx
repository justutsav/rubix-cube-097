/**
 * Assisted mode — the ASHA / Anganwadi / VLCC worker's call list.
 *
 * The fourth door the PS does not name and reality demands: 51.6% of rural women aged 15+ own no
 * mobile phone, and the guidelines mandate at least 30% women in every skill programme with a 15%
 * ring-fenced fund. A system reachable only by phone or WhatsApp cannot hit that target — not
 * "will struggle to", *arithmetically cannot*, because half the target group has no device.
 *
 * Two things this screen is careful about:
 *   · Consent is always recorded as spoken BY the beneficiary, with the worker's id alongside as
 *     evidence — never as the worker's assertion on her behalf.
 *   · Outcome tracking lives here, on the call list she already works from, and not as a new
 *     officer screen. Basic Issue 3 is "job placement after the skilling programme", and the fifth
 *     Basic Issue is that there is nobody at ground level to operate another screen.
 */

import { useState } from 'react';
import { describeAnswer, type FieldNo, type OutcomeStatus } from '@rc097/core';
import { AppShell, Band, Beads, Card, OfflineBand, Stat, StatusChip, useMemoAsync, useTick } from '../components';
import { openStore, type BeneficiaryRow, type OutcomeRow } from '../lib/db';
import { syncOutbox } from '../lib/supabase';

const OUTCOMES: OutcomeStatus[] = ['RECOMMENDED', 'ENROLLED', 'CERTIFIED', 'PLACED', 'DROPPED'];

const OUTCOME_LABEL: Record<OutcomeStatus, string> = {
  RECOMMENDED: 'Told',
  ENROLLED: 'Joined',
  CERTIFIED: 'Certified',
  PLACED: 'Working',
  DROPPED: 'Dropped',
};

export default function Field() {
  const tick = useTick(5000);
  const [syncing, setSyncing] = useState(false);
  const [syncNote, setSyncNote] = useState<string | null>(null);

  const data = useMemoAsync(
    async () => {
      const store = await openStore();
      const [beneficiaries, answers, recos, outcomes, pending, sessions] = await Promise.all([
        store.listBeneficiaries(),
        store.listAnswers(),
        store.listRecommendations(),
        store.listOutcomes(),
        store.outboxSize(),
        store.listSessions(),
      ]);
      return { store, beneficiaries, answers, recos, outcomes, pending, sessions };
    },
    [tick],
    null,
  );

  const doSync = async () => {
    setSyncing(true);
    const r = await syncOutbox();
    setSyncNote(r.failed > 0 ? `Sync failed: ${r.errors[0] ?? 'unknown'}` : `Pushed ${r.pushed} batch(es).`);
    setSyncing(false);
  };

  if (!data) return <AppShell title="Call list"><div className="b-main">Loading…</div></AppShell>;

  const { beneficiaries, answers, recos, outcomes, pending, sessions } = data;

  const confirmedFor = (id: string) => answers.filter((a) => a.beneficiaryId === id && a.confirmedAt).map((a) => a.fieldNo);
  const deferredFor = (id: string) => sessions.find((s) => s.beneficiaryId === id)?.deferred ?? [];

  const done = beneficiaries.filter((b) => confirmedFor(b.id).length === 7);
  const partial = beneficiaries.filter((b) => {
    const n = confirmedFor(b.id).length;
    return n > 0 && n < 7;
  });
  const nearMissCount = recos.filter((r) => r.result.nearMiss.length > 0).length;
  const women = beneficiaries.filter((b) => b.isWoman).length;
  const womenShare = beneficiaries.length > 0 ? Math.round((women / beneficiaries.length) * 100) : 0;

  return (
    <AppShell
      title="Call list"
      subtitle="Assisted mode · doorstep"
      bands={
        <>
          <OfflineBand pending={pending} />
          {beneficiaries.length > 0 && womenShare < 30 && (
            <Band tone="warn">
              Women are {womenShare}% of interviews here. The guidelines require at least 30% in every
              skill programme, so this number is a target, not a statistic.
            </Band>
          )}
        </>
      }
    >
      <div className="b-main">
        <Card title="Today">
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <Stat value={done.length} label="Completed" tone="ok" />
            <Stat value={partial.length} label="To finish" tone="warn" />
            <Stat value={nearMissCount} label="Near miss" tone="warn" />
            <Stat value={`${womenShare}%`} label="Women" tone={womenShare < 30 ? 'bad' : 'ok'} />
          </div>
        </Card>

        <Card
          title="Sync"
          action={
            <button type="button" className="b-btn" data-variant="ghost" onClick={() => void doSync()} disabled={syncing || pending === 0}>
              {syncing ? 'Syncing…' : 'Sync now'}
            </button>
          }
        >
          <p className="muted" style={{ margin: 0 }}>
            {pending === 0
              ? 'Nothing waiting. Interviews upload themselves when there is signal — you never have to remember.'
              : `${pending} batch(es) queued. They will go on their own the moment a network appears.`}
          </p>
          {syncNote && <p className="mono muted">{syncNote}</p>}
        </Card>

        <Card title="Consent rule" wide>
          <p style={{ margin: 0, fontSize: 'var(--text-bodysm)' }}>
            Hand the phone over for the consent line. Consent must be <strong>spoken by the
            beneficiary</strong>; your worker id is logged next to it as evidence. You may not consent
            on her behalf, and there is no button that lets you.
          </p>
        </Card>

        <Card title="People" wide>
          {beneficiaries.length === 0 && <p className="muted">Nobody yet. Start an interview from the Interview tab.</p>}
          <div style={{ display: 'grid', gap: 10 }}>
            {beneficiaries.map((b) => (
              <Person
                key={b.id}
                b={b}
                confirmed={confirmedFor(b.id)}
                deferred={deferredFor(b.id) as number[]}
                answers={answers.filter((a) => a.beneficiaryId === b.id)}
                outcomes={outcomes.filter((o) => o.beneficiaryId === b.id)}
                reco={recos.find((r) => r.beneficiaryId === b.id) ?? null}
              />
            ))}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}

function Person({
  b,
  confirmed,
  deferred,
  answers,
  outcomes,
  reco,
}: {
  b: BeneficiaryRow;
  confirmed: number[];
  deferred: number[];
  answers: { fieldNo: FieldNo; value: Parameters<typeof describeAnswer>[0]; method: string; confidence: number }[];
  outcomes: OutcomeRow[];
  reco: { result: { top: { qualification: { title: string; qpCode: string | null; localId: string } }[]; nearMiss: { gate: { gap: { need: string } | null } }[] } } | null;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const top = reco?.result.top[0]?.qualification ?? null;
  const ref = top ? (top.qpCode ?? top.localId) : null;
  const latest = OUTCOMES.filter((s) => outcomes.some((o) => o.status === s)).at(-1) ?? null;

  const setOutcome = async (status: OutcomeStatus) => {
    if (!ref) return;
    setSaving(true);
    const store = await openStore();
    await store.putOutcome({
      id: `${b.id}:${ref}:${status}`,
      beneficiaryId: b.id,
      qualificationRef: ref,
      status,
      statusDate: new Date().toISOString().slice(0, 10),
      note: null,
    });
    // Queue for the server too, so the district report is demand AND delivery.
    await store.applyEvents([{ type: 'outcome.upsert', beneficiaryId: b.id, qualificationRef: ref, status, at: new Date().toISOString() }], { queue: true });
    setSaving(false);
  };

  return (
    <div style={{ border: '1px solid var(--color-beige-200)', borderRadius: 12, padding: 12, background: 'var(--color-beige-50)' }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <strong style={{ flex: 1, minWidth: 140 }}>
          {b.villageName ?? 'Unknown village'}
          {b.blockName ? ` · ${b.blockName}` : ''}
        </strong>
        <Beads confirmed={confirmed} deferred={deferred} />
        <StatusChip tone={b.consentState === 'GIVEN' ? 'eligible' : b.consentState === 'GUARDIAN_PENDING' ? 'near' : 'out'}>
          {b.consentState === 'GIVEN' ? 'Consented' : b.consentState === 'GUARDIAN_PENDING' ? 'Guardian check' : 'No consent'}
        </StatusChip>
        <button type="button" className="b-btn" data-variant="ghost" onClick={() => setOpen((v) => !v)}>
          {open ? 'Hide' : 'Open'}
        </button>
      </div>

      {top && (
        <div style={{ marginTop: 8, fontSize: 'var(--text-bodysm)' }}>
          → {top.title}
          {!top.qpCode && <span className="mono" style={{ color: 'var(--color-amber-600)', marginLeft: 6 }}>(QP pending import)</span>}
        </div>
      )}

      {reco?.result.nearMiss[0]?.gate.gap && (
        <div style={{ marginTop: 6, fontSize: 'var(--text-bodysm)', color: '#8a5010' }}>
          Gap: {reco.result.nearMiss[0].gate.gap.need}
        </div>
      )}

      {open && (
        <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
          <div>
            <h3 style={{ fontSize: 'var(--text-label)', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-sand-700)', margin: '0 0 4px' }}>
              What she said
            </h3>
            <ol style={{ margin: 0, paddingLeft: 20, fontSize: 'var(--text-bodysm)' }}>
              {answers
                .slice()
                .sort((a, x) => a.fieldNo - x.fieldNo)
                .map((a) => (
                  <li key={a.fieldNo}>
                    {describeAnswer(a.value, 'hi')}
                    <span className="mono muted" style={{ marginLeft: 6 }}>
                      {a.method} {a.confidence.toFixed(2)}
                    </span>
                  </li>
                ))}
            </ol>
          </div>

          <div>
            <h3 style={{ fontSize: 'var(--text-label)', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-sand-700)', margin: '0 0 6px' }}>
              After the training
            </h3>
            {!ref && <p className="muted" style={{ margin: 0 }}>No recommendation yet, so there is nothing to track.</p>}
            {ref && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {OUTCOMES.map((st) => {
                  const have = outcomes.some((o) => o.status === st);
                  return (
                    <button
                      key={st}
                      type="button"
                      className="chip"
                      data-tone={have ? (st === 'DROPPED' ? 'out' : 'eligible') : 'neutral'}
                      style={{ cursor: 'pointer' }}
                      disabled={saving}
                      onClick={() => void setOutcome(st)}
                    >
                      {OUTCOME_LABEL[st]}
                    </button>
                  );
                })}
              </div>
            )}
            {latest && <p className="muted" style={{ marginBottom: 0 }}>Latest: {OUTCOME_LABEL[latest]}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
