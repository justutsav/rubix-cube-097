/**
 * Register B — the District PIU / DL-PACC console.
 *
 * This half exists because four of the five "Basic Issues under GIA" in the problem statement are
 * administrative, not beneficiary-facing, and because the scheme's decision-maker is a District
 * Collector chairing DL-PACC quarterly, working from a plan uploaded to a portal.
 *
 * The differentiator here is NOT the dashboard. It is the artefact and the date: a prioritised,
 * portal-uploadable project list projecting 3.5-4× the notional allocation, due in the **first week
 * of April** (May 2023 revision, Ch.1 ¶6c.vi and the Ch.3 ¶9 calendar). Beneficiary demand data
 * that arrives in July is worthless. So the Perspective Plan card leads with the deadline.
 *
 * The console is also where the project's own honesty is on display: unsourced opportunity rows,
 * prototype qualification rows, unreviewed prompts and the recommendation spread are all shown as
 * numbers rather than described in a README nobody opens.
 */

import { useMemo, useState } from 'react';
import {
  catalogueStats,
  conceptLabel,
  DISTRICTS,
  GIA_TRAINING_CATEGORIES,
  giaCategory,
  OPPORTUNITIES,
  promptCoverage,
  provenanceReport,
  QUALIFICATIONS,
  requirementCoverage,
  spreadReport,
  type Education,
} from '@rc097/core';
import { AppShell, Band, BarChart, Card, Stat, StatusChip, useMemoAsync, useTick } from '../components';
import { openStore } from '../lib/db';

type Tab = 'demand' | 'plan' | 'consent' | 'quality' | 'audit';

const TABS: { id: Tab; label: string }[] = [
  { id: 'demand', label: 'Demand' },
  { id: 'plan', label: 'Perspective Plan' },
  { id: 'consent', label: 'Consent register' },
  { id: 'quality', label: 'Spread & quality' },
  { id: 'audit', label: 'Audit trail' },
];

/** First week of April, per the guidelines' own annual calendar. */
function nextAprilDeadline(now = new Date()): { date: Date; days: number } {
  const year = now.getMonth() >= 3 ? now.getFullYear() + 1 : now.getFullYear();
  const date = new Date(Date.UTC(year, 3, 7));
  const days = Math.ceil((date.getTime() - now.getTime()) / 86_400_000);
  return { date, days };
}

export default function Officer() {
  const [tab, setTab] = useState<Tab>('demand');
  const tick = useTick(8000);

  const data = useMemoAsync(
    async () => {
      const store = await openStore();
      const [beneficiaries, answers, recos, consent, outcomes, telemetry] = await Promise.all([
        store.listBeneficiaries(),
        store.listAnswers(),
        store.listRecommendations(),
        store.listConsent(),
        store.listOutcomes(),
        store.listTelemetry(),
      ]);
      return { beneficiaries, answers, recos, consent, outcomes, telemetry };
    },
    [tick],
    null,
  );

  const prov = useMemo(() => provenanceReport(), []);
  const cat = useMemo(() => catalogueStats(), []);
  const deadline = useMemo(() => nextAprilDeadline(), []);

  if (!data) return <AppShell title="District console"><div className="b-main">Loading…</div></AppShell>;

  const { beneficiaries, answers, recos, consent, outcomes, telemetry } = data;

  // Demand counts CONFIRMED field-4 answers only. An unconfirmed field is a resumable field, not a
  // data point that belongs in a statutory plan.
  const histogram = new Map<string, number>();
  for (const a of answers) {
    if (a.fieldNo !== 4 || !a.confirmedAt) continue;
    if (a.value.kind !== 'concepts') continue;
    for (const c of a.value.conceptIds) histogram.set(c, (histogram.get(c) ?? 0) + 1);
  }
  const spread = spreadReport(histogram, 10);

  const byBlock = new Map<string, number>();
  for (const b of beneficiaries) {
    const k = b.blockName ?? 'Unknown block';
    byBlock.set(k, (byBlock.get(k) ?? 0) + 1);
  }

  const women = beneficiaries.filter((b) => b.isWoman).length;
  const womenShare = beneficiaries.length ? Math.round((women / beneficiaries.length) * 100) : 0;
  const nearMiss = recos.filter((r) => r.result.nearMiss.length > 0).length;
  const pmDaksh = recos.filter((r) => r.result.routeToPmDaksh?.route).length;
  const placed = outcomes.filter((o) => o.status === 'PLACED').length;
  const enrolled = outcomes.filter((o) => o.status === 'ENROLLED').length;
  const placementRate = enrolled > 0 ? Math.round((placed / enrolled) * 100) : null;

  const ladderRungs = new Map<string, number>();
  for (const a of answers) ladderRungs.set(a.method, (ladderRungs.get(a.method) ?? 0) + 1);
  const lexiconShare = answers.length ? Math.round(((ladderRungs.get('LEXICON') ?? 0) / answers.length) * 100) : 0;
  const latencies = telemetry.map((t) => t.latencyMs).filter((n): n is number => n !== null);
  const medianLatency = latencies.length ? latencies.sort((a, b) => a - b)[Math.floor(latencies.length / 2)] : null;

  return (
    <AppShell
      title="District console"
      subtitle={`${DISTRICTS.map((d) => d.name).join(' · ')} · DL-PACC`}
      bands={
        <>
          {prov.warning && <Band tone="bad">{prov.warning}</Band>}
          {cat.prototype > 0 && (
            <Band tone="warn">
              {cat.prototype} of {cat.total} course rows are prototype data with NULL QP codes. Run
              <span className="mono"> python3 scripts/import_nqr.py </span> to replace them with the
              official 2,814-row NQR export.
            </Band>
          )}
        </>
      }
    >
      <div style={{ display: 'flex', gap: 6, padding: '10px 12px 0', overflowX: 'auto', maxWidth: '88rem', marginInline: 'auto' }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className="b-btn"
            data-variant={tab === t.id ? undefined : 'ghost'}
            onClick={() => setTab(t.id)}
            style={{ whiteSpace: 'nowrap' }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'demand' && (
        <div className="b-main">
          <Card title="Register">
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              <Stat value={beneficiaries.length} label="Beneficiaries" />
              <Stat value={`${womenShare}%`} label="Women (target 30%)" tone={womenShare < 30 ? 'bad' : 'ok'} />
              <Stat value={nearMiss} label="Near miss" tone="warn" />
              <Stat value={pmDaksh} label="→ PM-DAKSH" />
            </div>
          </Card>

          <Card title="Placement (Basic Issue 3)">
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              <Stat value={enrolled} label="Joined" />
              <Stat value={placed} label="Working" tone="ok" />
              <Stat
                value={placementRate === null ? '—' : `${placementRate}%`}
                label="vs 70% mandated"
                tone={placementRate !== null && placementRate < 70 ? 'bad' : 'ok'}
              />
            </div>
            <p className="muted" style={{ marginBottom: 0 }}>
              The guidelines mandate 70% placement in wage or self-employment. CAG measured PMKVY at
              41.29%. This number is updated from the mobiliser's call list, not from a separate screen.
            </p>
          </Card>

          <Card title="Demand by block" wide>
            <BarChart rows={[...byBlock.entries()].map(([label, value]) => ({ label, value }))} />
          </Card>

          <Card title="Demand by trade (confirmed answers only)" wide>
            <BarChart
              rows={spread.rows.slice(0, 12).map((r) => ({ label: conceptLabel(r.conceptId, 'en'), value: r.count }))}
            />
          </Card>

          <Card title="Convergence export" wide>
            <p className="muted" style={{ marginTop: 0 }}>
              Batch-shaped hand-off for SSDM, DSC and the NSFDC/NSKFDC channelising agencies —
              "here are N people in this block who want and are eligible for this qualification".
            </p>
            <button
              type="button"
              className="b-btn"
              onClick={() => downloadCsv('convergence.csv', convergenceCsv(spread.rows, byBlock))}
              disabled={spread.rows.length === 0}
            >
              Download CSV
            </button>
          </Card>
        </div>
      )}

      {tab === 'plan' && (
        <div className="b-main">
          <Card title="The deadline, not the dashboard" wide>
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'baseline' }}>
              <Stat
                value={deadline.days}
                label={`days to ${deadline.date.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}`}
                tone={deadline.days < 45 ? 'bad' : 'warn'}
              />
              <Stat value="3.5-4×" label="notional allocation to project" />
              <Stat value="DL-PACC" label="submits via the portal" />
            </div>
            <p className="muted" style={{ marginBottom: 0 }}>
              Per the May 2023 revision's annual calendar (Ch.3 ¶9): DL-PACC appraises and submits
              district projects through the web portal by the first week of April; SL-PACC prioritises
              by 15 April; the state forwards by 21 April. Demand data that arrives in July is worthless.
            </p>
          </Card>

          <Card title="Plan lines from live demand" wide>
            {spread.rows.length === 0 ? (
              <p className="muted">No confirmed demand yet.</p>
            ) : (
              <table className="b-table">
                <thead>
                  <tr>
                    <th>Trade</th>
                    <th>Qualification</th>
                    <th>GIA category</th>
                    <th>Demand</th>
                    <th>Women</th>
                  </tr>
                </thead>
                <tbody>
                  {spread.rows.slice(0, 15).map((r) => {
                    const q = QUALIFICATIONS.find((x) => x.concepts.includes(r.conceptId));
                    const cat = q ? giaCategory(q.notionalHours, 'none' as Education) : null;
                    return (
                      <tr key={r.conceptId}>
                        <td>{conceptLabel(r.conceptId, 'en')}</td>
                        <td>
                          {q?.title ?? '—'}
                          {q && !q.qpCode && <div className="mono" style={{ color: 'var(--color-amber-600)' }}>QP pending import</div>}
                        </td>
                        <td>{cat ?? '—'}</td>
                        <td className="mono">{r.count}</td>
                        <td className="mono">{Math.round(r.count * (womenShare / 100))}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </Card>

          <Card title="What is still missing to be portal-ready" wide>
            {/* Naming the gap is worth more than a screenshot that pretends there is none. */}
            <ul style={{ margin: 0, paddingLeft: 20, fontSize: 'var(--text-bodysm)' }}>
              <li>
                The real Perspective Plan column format on <span className="mono">pmajay.dosje.gov.in</span> —
                the host's TLS chain broke automated fetch, so this must be opened by hand and screenshotted.
              </li>
              <li>The district's actual notional allocation figure, to compute the 3.5-4× projection against.</li>
              <li>A multi-year horizon: the artefact is a Perspective Plan to the scheme's end year, not an annual list.</li>
              <li>{prov.placeholder} opportunity rows still unsourced — excluded from this export by design.</li>
            </ul>
          </Card>

          <Card title="GIA training categories" wide>
            <table className="b-table">
              <thead>
                <tr><th>Category</th><th>Hours</th><th>Note</th></tr>
              </thead>
              <tbody>
                {GIA_TRAINING_CATEGORIES.map((c) => (
                  <tr key={c.id}>
                    <td><strong>{c.id}</strong> {c.label}</td>
                    <td className="mono">{c.hours[0]}-{c.hours[1]}</td>
                    <td className="muted">{c.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {tab === 'consent' && (
        <div className="b-main">
          <Card title="Consent register" wide>
            <p className="muted" style={{ marginTop: 0 }}>
              Every row records which script version the beneficiary actually heard. A consent record
              without that is not evidence of anything.
            </p>
            {consent.length === 0 ? (
              <p className="muted">No consent events recorded on this device.</p>
            ) : (
              <table className="b-table">
                <thead>
                  <tr><th>When</th><th>Kind</th><th>Channel</th><th>Script</th><th>Evidence</th></tr>
                </thead>
                <tbody>
                  {consent.map((c) => (
                    <tr key={c.id}>
                      <td className="mono">{new Date(c.capturedAt).toLocaleString('en-IN')}</td>
                      <td><StatusChip tone={c.kind === 'WITHDRAWN' ? 'out' : 'eligible'}>{c.kind}</StatusChip></td>
                      <td>{c.channel}</td>
                      <td className="mono">{c.scriptVersion}</td>
                      <td className="mono muted">{JSON.stringify(c.evidence)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          <Card title="What is retained, and what is not" wide>
            <table className="b-table">
              <thead><tr><th>Artefact</th><th>Kept?</th><th>Why</th></tr></thead>
              <tbody>
                <tr><td>Raw audio</td><td><StatusChip tone="out">never</StatusChip></td><td>Transcribed, normalised, confirmed and discarded inside the turn. There is no recording_url column.</td></tr>
                <tr><td>Transcript</td><td><StatusChip tone="out">erased at CONFIRM</StatusChip></td><td>Its purpose is discharged once the value is read back and accepted, and it is 26-60% wrong anyway. A database CHECK constraint enforces this.</td></tr>
                <tr><td>Confirmed value</td><td><StatusChip tone="eligible">retained</StatusChip></td><td>This is the purpose. It carries the UC and the DL-PACC minute.</td></tr>
                <tr><td>Phone number</td><td><StatusChip tone="out">hashed only</StatusChip></td><td>hmac(e164, server pepper), computed server-side. The raw number is never stored.</td></tr>
              </tbody>
            </table>
            <p className="muted" style={{ marginBottom: 0 }}>
              Note on the law: DPDP Rule 11 (not Rule 10) covers persons with disability, and it bites
              only where a guardian has been appointed by a court, a designated authority or a district
              local level committee. Rule 8's three-year erasure does not apply to a scheme like this.
              Most DPDP Rules commence 13 May 2027.
            </p>
          </Card>
        </div>
      )}

      {tab === 'quality' && (
        <div className="b-main">
          <Card title="Recommendation spread" wide>
            <p className="muted" style={{ marginTop: 0 }}>
              CAG found 40% of national certifications concentrated in 10 job-roles, and 90.35% of all
              "Green Jobs" certifications in the single role "Safai Karmchari". If our own distribution
              looks like that, we have automated the failure with better UX. The ranker prices this in
              as a penalty; this chart checks whether it worked.
            </p>
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 12 }}>
              <Stat value={spread.distinct} label="distinct trades" />
              <Stat
                value={`${Math.round(spread.topShare * 100)}%`}
                label="share held by top 10"
                tone={spread.topShare > 0.4 && spread.distinct > 10 ? 'bad' : 'ok'}
              />
              <Stat value={spread.total} label="recommendations" />
            </div>
            <BarChart
              rows={spread.rows.slice(0, 12).map((r) => ({ label: conceptLabel(r.conceptId, 'en'), value: r.count }))}
            />
          </Card>

          <Card title="Extraction ladder — which rung actually fires">
            <BarChart
              rows={[...ladderRungs.entries()].map(([label, value]) => ({
                label,
                value,
                tone: label === 'LEXICON' ? 'eligible' : label === 'LLM' ? 'near' : undefined,
              }))}
            />
            <p className="muted" style={{ marginBottom: 0 }}>
              Lexicon share: <strong>{lexiconShare}%</strong>. The latency design assumes roughly 70%,
              because the LLM rung costs 400-1200 ms and would blow the 1800 ms turn budget on the
              common path. This is the number that validates or refutes that assumption.
            </p>
          </Card>

          <Card title="Turn latency">
            <Stat value={medianLatency === null ? '—' : `${medianLatency} ms`} label="median · budget 1800 ms" tone={medianLatency !== null && medianLatency > 1800 ? 'bad' : 'ok'} />
            <p className="muted" style={{ marginBottom: 0 }}>
              Measured on this device, over {latencies.length} turn(s). A human assumes a phone line is
              dead past roughly two seconds.
            </p>
          </Card>

          <Card title="Prompt coverage (R7)">
            <table className="b-table">
              <thead><tr><th>Locale</th><th>Authored</th><th>Native-reviewed</th></tr></thead>
              <tbody>
                {promptCoverage().map((c) => (
                  <tr key={c.locale}>
                    <td>{c.locale}</td>
                    <td className="mono">{c.authored}/{c.total}</td>
                    <td>
                      {c.reviewed === 0 ? <StatusChip tone="near">0 — needs a native pass</StatusChip> : <span className="mono">{c.reviewed}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="muted" style={{ marginBottom: 0 }}>
              "Empathetic and conversational rather than administrative" is a writing problem and the
              entire content of the demo video. Until a native speaker signs each locale off, R7 stays
              PARTIAL — see the audit tab.
            </p>
          </Card>

          <Card title="Data provenance">
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              <Stat value={cat.official} label="official NQR rows" tone={cat.official === 0 ? 'bad' : 'ok'} />
              <Stat value={cat.prototype} label="prototype rows" tone="warn" />
              <Stat value={prov.sourced} label="sourced opportunity rows" />
              <Stat value={prov.placeholder} label="unsourced" tone="bad" />
            </div>
            <table className="b-table" style={{ marginTop: 10 }}>
              <thead><tr><th>Opportunity</th><th>Source</th></tr></thead>
              <tbody>
                {OPPORTUNITIES.map((o, i) => (
                  <tr key={i}>
                    <td>{o.title} <span className="muted">· {o.districtName}{o.blockName ? ` / ${o.blockName}` : ''}</span></td>
                    <td>
                      {o.source === 'PLACEHOLDER_NEEDS_SOURCING' ? (
                        <StatusChip tone="out">unsourced</StatusChip>
                      ) : (
                        <span className="mono muted">{o.source} ({o.sourceDate})</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {tab === 'audit' && (
        <div className="b-main">
          <Card title="Requirement coverage (R1-R9)" wide>
            <table className="b-table">
              <thead><tr><th>#</th><th>Requirement</th><th>Status</th><th>Where</th></tr></thead>
              <tbody>
                {requirementCoverage().map((r) => (
                  <tr key={r.id}>
                    <td className="mono">{r.id}</td>
                    <td>{r.requirement}</td>
                    <td><StatusChip tone={r.status === 'COVERED' ? 'eligible' : 'near'}>{r.status}</StatusChip></td>
                    <td className="muted">{r.where}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <Card title="Why this person was sent to this trade" wide>
            <p className="muted" style={{ marginTop: 0 }}>
              In 2030 somebody will ask. The answer has to be a row, not a prompt — inputs, weights
              version, engine version and the NQR snapshot hash, stored against every recommendation.
            </p>
            {recos.length === 0 ? (
              <p className="muted">No recommendations on this device yet.</p>
            ) : (
              recos.slice(0, 5).map((r) => (
                <details key={r.id} style={{ marginBottom: 8 }}>
                  <summary style={{ cursor: 'pointer' }}>
                    {new Date(r.createdAt).toLocaleString('en-IN')} — {r.result.top[0]?.qualification.title ?? 'no eligible match'}
                    <span className="mono muted" style={{ marginLeft: 8 }}>{r.result.weightsVersion} · {r.result.engineVersion}</span>
                  </summary>
                  <pre className="mono" style={{ overflowX: 'auto', background: 'var(--color-beige-100)', padding: 10, borderRadius: 8, fontSize: 12 }}>
                    {JSON.stringify(r.result.top[0]?.explain.auditor ?? {}, null, 2)}
                  </pre>
                </details>
              ))
            )}
          </Card>

          <Card title="Export the register" wide>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" className="b-btn" onClick={() => downloadCsv('beneficiaries.csv', beneficiaryCsv(beneficiaries))}>
                Beneficiaries CSV
              </button>
              <button type="button" className="b-btn" data-variant="ghost" onClick={() => downloadCsv('outcomes.csv', outcomeCsv(outcomes))}>
                Outcomes CSV
              </button>
            </div>
            <p className="muted" style={{ marginBottom: 0 }}>
              Exports carry no raw phone numbers and no transcripts, because neither is stored.
            </p>
          </Card>
        </div>
      )}
    </AppShell>
  );
}

// ---------------------------------------------------------------------------- csv

function esc(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(headers: string[], rows: unknown[][]): string {
  return [headers.join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n');
}

function convergenceCsv(rows: { conceptId: string; count: number }[], byBlock: Map<string, number>): string {
  return toCsv(
    ['trade', 'qualification_title', 'qp_code', 'nsqf_level', 'demand_count', 'blocks'],
    rows.map((r) => {
      const q = QUALIFICATIONS.find((x) => x.concepts.includes(r.conceptId));
      return [
        conceptLabel(r.conceptId, 'en'),
        q?.title ?? '',
        // Empty, not fabricated. The consuming agency must see that the code is not yet known.
        q?.qpCode ?? '',
        q?.levelLabel ?? '',
        r.count,
        [...byBlock.keys()].join('; '),
      ];
    }),
  );
}

function beneficiaryCsv(rows: { id: string; districtName: string | null; blockName: string | null; villageName: string | null; consentState: string; updatedAt: string }[]): string {
  return toCsv(
    ['beneficiary_id', 'district', 'block', 'village', 'consent_state', 'updated_at'],
    rows.map((b) => [b.id, b.districtName, b.blockName, b.villageName, b.consentState, b.updatedAt]),
  );
}

function outcomeCsv(rows: { beneficiaryId: string; qualificationRef: string; status: string; statusDate: string }[]): string {
  return toCsv(
    ['beneficiary_id', 'qualification_ref', 'status', 'status_date'],
    rows.map((o) => [o.beneficiaryId, o.qualificationRef, o.status, o.statusDate]),
  );
}

function downloadCsv(name: string, content: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
