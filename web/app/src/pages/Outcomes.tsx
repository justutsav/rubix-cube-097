/**
 * The register, and what happened after the training.
 *
 * This used to be the mobiliser's doorstep call list. That role was removed on 2026-09-28 —
 * the assisted case is the kiosk in a CSC Village Level Entrepreneur's hands, which is the
 * problem statement's own answer to "inadequate technical and support team at ground level".
 * So the screen moved to the officer working at the kiosk centre, and kept its job.
 *
 * Its job is Basic Issue 3, "job placement issue after the skilling programme". An enrolment
 * dashboard cannot see whether anyone got work; somebody has to ask. Until the follow-up call
 * is built, that somebody is the officer, here.
 *
 * Consent is displayed but never editable. It is recorded as spoken by the beneficiary during
 * the interview; there is no button on this screen that can assert it on her behalf.
 */

import { useState } from 'react';
import { describeAnswer, type FieldNo, type OutcomeStatus } from '@rc097/core';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { AppShell, Band, Beads, OfflineBand, Stat, useMemoAsync, useTick } from '../components';
import { openStore, type BeneficiaryRow, type OutcomeRow } from '../lib/db';
import { syncOutbox } from '../lib/supabase';

/** Ordered: each is a later stage of the same journey, so `.at(-1)` is the furthest reached. */
const OUTCOMES: OutcomeStatus[] = ['RECOMMENDED', 'ENROLLED', 'CERTIFIED', 'PLACED', 'DROPPED'];

const OUTCOME_LABEL: Record<OutcomeStatus, string> = {
  RECOMMENDED: 'Told',
  ENROLLED: 'Joined',
  CERTIFIED: 'Certified',
  PLACED: 'Working',
  DROPPED: 'Dropped',
};

export default function Outcomes() {
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
      return { beneficiaries, answers, recos, outcomes, pending, sessions };
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

  if (!data) {
    return (
      <AppShell title="Outcomes">
        <div className="mx-auto w-full max-w-3xl p-4 text-sand-700">Loading…</div>
      </AppShell>
    );
  }

  const { beneficiaries, answers, recos, outcomes, pending, sessions } = data;

  const confirmedFor = (id: string) =>
    answers.filter((a) => a.beneficiaryId === id && a.confirmedAt).map((a) => a.fieldNo);
  const deferredFor = (id: string) => sessions.find((s) => s.beneficiaryId === id)?.deferred ?? [];

  const done = beneficiaries.filter((b) => confirmedFor(b.id).length === 7);
  const placed = beneficiaries.filter((b) =>
    outcomes.some((o) => o.beneficiaryId === b.id && o.status === 'PLACED'),
  );
  const joined = beneficiaries.filter((b) =>
    outcomes.some((o) => o.beneficiaryId === b.id && (o.status === 'ENROLLED' || o.status === 'CERTIFIED')),
  );
  // The scheme's own target is 70%; CAG measured the national system at 41%. Showing the rate
  // against the mandate is the point — a bare count would flatter us.
  const placementRate = joined.length > 0 ? Math.round((placed.length / joined.length) * 100) : null;

  return (
    <AppShell
      title="Outcomes"
      subtitle="Register · after the training"
      bands={
        <>
          <OfflineBand pending={pending} />
          {placementRate !== null && placementRate < 70 && (
            <Band tone="warn">
              Placement is {placementRate}% of those who joined. The guidelines set 70% for short-term
              training — this is the gap the scheme is actually measured on.
            </Band>
          )}
        </>
      }
    >
      <div className="mx-auto grid w-full max-w-3xl gap-4 p-4 pb-24">
        <Card>
          <CardHeader>
            <CardTitle>Where the register stands</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-6">
            <Stat value={beneficiaries.length} label="Interviewed" />
            <Stat value={done.length} label="Completed" tone="ok" />
            <Stat value={joined.length} label="Joined" />
            <Stat
              value={placementRate === null ? '—' : `${placementRate}%`}
              label="Working (target 70%)"
              tone={placementRate === null ? undefined : placementRate < 70 ? 'bad' : 'ok'}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Sync</CardTitle>
            <Button variant="outline" size="sm" disabled={syncing || pending === 0} onClick={() => void doSync()}>
              {syncing ? 'Syncing…' : 'Sync now'}
            </Button>
          </CardHeader>
          <CardContent>
            <p className="m-0 text-sm text-sand-700">
              {pending === 0
                ? 'Nothing waiting. Records upload themselves when there is signal — nobody has to remember.'
                : `${pending} batch(es) queued. They go on their own the moment a network appears.`}
            </p>
            {syncNote && <p className="mt-2 font-mono text-xs text-sand-700">{syncNote}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>People</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {beneficiaries.length === 0 && (
              <p className="m-0 text-sm text-sand-700">
                Nobody yet. Interviews recorded at this kiosk appear here.
              </p>
            )}
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
          </CardContent>
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
  reco: {
    result: {
      top: { qualification: { title: string; qpCode: string | null; localId: string } }[];
      nearMiss: { gate: { gap: { need: string } | null } }[];
    };
  } | null;
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
    await store.applyEvents(
      [{ type: 'outcome.upsert', beneficiaryId: b.id, qualificationRef: ref, status, at: new Date().toISOString() }],
      { queue: true },
    );
    setSaving(false);
  };

  const consentTone =
    b.consentState === 'GIVEN' ? 'default' : b.consentState === 'GUARDIAN_PENDING' ? 'secondary' : 'destructive';
  const consentLabel =
    b.consentState === 'GIVEN' ? 'Consented' : b.consentState === 'GUARDIAN_PENDING' ? 'Guardian check' : 'No consent';

  return (
    <div className="rounded-xl border border-beige-200 bg-beige-50 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <strong className="min-w-[8.75rem] flex-1">
          {b.villageName ?? 'Unknown village'}
          {b.blockName ? ` · ${b.blockName}` : ''}
        </strong>
        <Beads confirmed={confirmed} deferred={deferred} />
        <Badge variant={consentTone}>{consentLabel}</Badge>
        <Button variant="ghost" size="sm" onClick={() => setOpen((v) => !v)}>
          {open ? 'Hide' : 'Open'}
        </Button>
      </div>

      {top && (
        <div className="mt-2 text-sm">
          → {top.title}
          {!top.qpCode && <span className="ml-1.5 font-mono text-amber-600">(QP pending import)</span>}
        </div>
      )}

      {reco?.result.nearMiss[0]?.gate.gap && (
        <div className="mt-1.5 text-sm text-amber-700">Gap: {reco.result.nearMiss[0].gate.gap.need}</div>
      )}

      {open && (
        <div className="mt-3 grid gap-3">
          <Separator />
          <div>
            <h3 className="m-0 mb-1 text-xs font-semibold uppercase tracking-wider text-sand-700">What she said</h3>
            <ol className="m-0 list-decimal pl-5 text-sm">
              {answers
                .slice()
                .sort((a, x) => a.fieldNo - x.fieldNo)
                .map((a) => (
                  <li key={a.fieldNo}>
                    {describeAnswer(a.value, 'hi')}
                    <span className="ml-1.5 font-mono text-xs text-sand-700">
                      {a.method} {a.confidence.toFixed(2)}
                    </span>
                  </li>
                ))}
            </ol>
          </div>

          <div>
            <h3 className="m-0 mb-1.5 text-xs font-semibold uppercase tracking-wider text-sand-700">
              After the training
            </h3>
            {!ref && <p className="m-0 text-sm text-sand-700">No recommendation yet, so there is nothing to track.</p>}
            {ref && (
              <div className="flex flex-wrap gap-1.5">
                {OUTCOMES.map((st) => {
                  const have = outcomes.some((o) => o.status === st);
                  return (
                    <Button
                      key={st}
                      type="button"
                      size="sm"
                      variant={have ? (st === 'DROPPED' ? 'destructive' : 'default') : 'outline'}
                      disabled={saving}
                      onClick={() => void setOutcome(st)}
                    >
                      {OUTCOME_LABEL[st]}
                    </Button>
                  );
                })}
              </div>
            )}
            {latest && <p className="mb-0 mt-2 text-sm text-sand-700">Latest: {OUTCOME_LABEL[latest]}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
