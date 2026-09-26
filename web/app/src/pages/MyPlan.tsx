/**
 * "My plan" — the saved recommendation, re-readable and re-hearable on demand.
 *
 * The spoken recommendation on a phone call is gone the moment the call ends, and the PS's own
 * framing is that this user cannot deal with a text document. So the plan is kept, and the primary
 * control is "hear it again" — the app equivalent of "call back and press 9".
 */

import {
  describeAnswer,
  type FieldNo,
  type ScoredQualification,
} from '@rc097/core';
import { AppShell, Band, Card, Speak, StatusChip, useMemoAsync, useTick } from '../components';
import { openStore } from '../lib/db';

export default function MyPlan() {
  const tick = useTick(6000);
  const data = useMemoAsync(
    async () => {
      const store = await openStore();
      const bens = await store.listBeneficiaries();
      const me = bens[0] ?? null;
      if (!me) return { me: null, answers: [], reco: null };
      const [answers, reco] = await Promise.all([store.answersFor(me.id), store.latestRecommendation(me.id)]);
      return { me, answers, reco };
    },
    [tick],
    { me: null as Awaited<ReturnType<Awaited<ReturnType<typeof openStore>>['getBeneficiary']>>, answers: [] as Awaited<ReturnType<Awaited<ReturnType<typeof openStore>>['answersFor']>>, reco: null as Awaited<ReturnType<Awaited<ReturnType<typeof openStore>>['latestRecommendation']>> },
  );

  const { me, answers, reco } = data;

  if (!me) {
    return (
      <AppShell title="My plan">
        <div className="b-main">
          <Card title="Nothing yet" wide>
            <p className="muted" style={{ margin: 0 }}>
              Finish the conversation on the Interview tab and the plan appears here — to hear again
              whenever you like.
            </p>
          </Card>
        </div>
      </AppShell>
    );
  }

  const r = reco?.result ?? null;
  const all: ScoredQualification[] = r ? [...r.top, ...r.nearMiss] : [];

  return (
    <AppShell
      title="My plan"
      subtitle={[me.villageName, me.blockName, me.districtName].filter(Boolean).join(' · ') || undefined}
      bands={r?.containsPrototypeData ? <Band tone="warn">Prototype course catalogue — QP codes are NULL until the official NQR import runs.</Band> : undefined}
    >
      <div className="b-main" style={{ gridTemplateColumns: '1fr', maxWidth: '52rem' }}>
        {all.length === 0 && (
          <Card title="No recommendation yet" wide>
            <p className="muted" style={{ margin: 0 }}>
              The seven questions were not all answered, so nothing has been ranked. An unanswered
              question is a resumable question — open the Interview tab to carry on.
            </p>
          </Card>
        )}

        {all.map((sq, i) => {
          const q = sq.qualification;
          const near = sq.gate.bucket === 'NEAR_MISS';
          const months = q.notionalHours ? Math.max(1, Math.round(q.notionalHours / 150)) : null;
          return (
            <Card key={q.localId} title={near ? `Option ${i + 1} — one gap` : `Option ${i + 1}`} wide>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                <StatusChip tone={near ? 'near' : 'eligible'}>{near ? 'लगभग' : 'योग्य'}</StatusChip>
                <StatusChip tone="neutral">{q.levelLabel}</StatusChip>
                {months && <StatusChip tone="neutral">{months} महीने</StatusChip>}
                {q.selfEmployable && <StatusChip tone="info">अपना काम</StatusChip>}
              </div>
              <h3 style={{ margin: '0 0 8px', fontSize: 'var(--text-lead)' }}>{q.title}</h3>
              <Speak locale="hi" text={sq.explain.beneficiary} />
              {near && sq.gate.gap && (
                <p style={{ background: 'var(--color-amber-100)', padding: 10, borderRadius: 8, fontSize: 'var(--text-bodysm)' }}>
                  <strong>क्या चाहिए: </strong>
                  {sq.gate.gap.needLocal ?? sq.gate.gap.need}
                </p>
              )}
              {q.qpCode ? (
                <div className="mono muted">QP {q.qpCode}</div>
              ) : (
                <div className="mono" style={{ color: 'var(--color-amber-600)' }}>QP code pending official NQR import</div>
              )}
            </Card>
          );
        })}

        {r?.assetGrantEligible && (
          <Card title="Money you can ask for" wide>
            <p style={{ margin: 0 }}>
              अपना काम शुरू करने पर, बैंक से क़र्ज़ लेने की सूरत में योजना ₹50,000 तक — या प्रोजेक्ट लागत का आधा, जो कम हो — दे सकती है।
            </p>
            <p className="muted" style={{ marginBottom: 0 }}>PM-AJAY Guidelines (Revised May 2023), Ch.3 ¶2a.ii</p>
          </Card>
        )}

        <Card title="What you told us" wide>
          <ol style={{ margin: 0, paddingLeft: 20 }}>
            {([1, 2, 3, 4, 5, 6, 7] as FieldNo[]).map((n) => {
              const a = answers.find((x) => x.fieldNo === n);
              return (
                <li key={n} style={{ marginBottom: 6 }}>
                  {a ? (
                    <>
                      <span lang="hi">{describeAnswer(a.value, 'hi')}</span>
                      <span className="mono muted" style={{ marginLeft: 8 }}>
                        {a.method} {a.confidence.toFixed(2)} {a.confirmedAt ? '✓' : '(unconfirmed)'}
                      </span>
                    </>
                  ) : (
                    <span className="muted">not answered yet</span>
                  )}
                </li>
              );
            })}
          </ol>
          <p className="muted" style={{ marginBottom: 0 }}>
            The recording was discarded inside the turn, and the words were erased the moment you
            confirmed each answer. Only these values remain.
          </p>
        </Card>
      </div>
    </AppShell>
  );
}
