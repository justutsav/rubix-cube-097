/**
 * The State officer's console — SL-PACC.
 *
 * The State's mandated verb is **prioritisation**, not verification. Guidelines Ch.1 ¶6(c)(v):
 * the SL-PACC *"shall appraise and prioritize the project proposals submitted by the districts,
 * as well as those prepared at the State level, for inclusion in the AAP"*. So this screen ranks
 * districts; it does not re-check their work.
 *
 * And the Perspective Plan is the **State's** document, not a district's — Ch.1 ¶6(c): *"the
 * State/UT would submit a 'Perspective Plan'… uploaded in the online portal for PM-AJAY"*.
 * Districts move projects up; the State rolls them into the Plan and forwards by 21 April.
 *
 * Honesty, deliberately on screen: this device holds one district's rows. A real statewide
 * roll-up reads every district under a widened RLS policy on the server, and that policy is not
 * written yet — `init.sql:371` still says "Nobody sees the country." The banner says so rather
 * than letting a demo imply a national view exists.
 */

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { AppShell, Band, Stat, useMemoAsync, useTick } from '../components';
import { openStore } from '../lib/db';
import { serverConfigured } from '../lib/supabase';

/** Ch.3 ¶9 (p.26). The State's two dates, and what each one is for. */
const CALENDAR = [
  { when: '1st week April', who: 'Districts', what: 'DL-PACC appraises district projects, submits to State' },
  { when: '15 April', who: 'State (you)', what: 'SL-PACC appraises and prioritises uploaded projects' },
  { when: '21 April', who: 'State (you)', what: 'Forward approved projects to the Ministry on the portal' },
  { when: '1st week May', who: 'Ministry', what: 'PACC in DoSJE appraises' },
];

function daysUntil(month: number, day: number, now = new Date()): number {
  const year = now.getMonth() > month || (now.getMonth() === month && now.getDate() > day)
    ? now.getFullYear() + 1
    : now.getFullYear();
  return Math.ceil((Date.UTC(year, month, day) - now.getTime()) / 86_400_000);
}

interface DistrictRoll {
  name: string;
  people: number;
  confirmed: number;
  nearMiss: number;
  trades: Set<string>;
}

export default function State() {
  const tick = useTick(8000);

  const d = useMemoAsync(
    async () => {
      const store = await openStore();
      const [people, answers, recos] = await Promise.all([
        store.listBeneficiaries(),
        store.listAnswers(),
        store.listRecommendations(),
      ]);

      const byDistrict = new Map<string, DistrictRoll>();
      const roll = (name: string): DistrictRoll => {
        const key = name || 'Unassigned';
        let r = byDistrict.get(key);
        if (!r) {
          r = { name: key, people: 0, confirmed: 0, nearMiss: 0, trades: new Set() };
          byDistrict.set(key, r);
        }
        return r;
      };

      for (const b of people) {
        const r = roll(b.districtName ?? 'Unassigned');
        r.people += 1;
        if (answers.filter((a) => a.beneficiaryId === b.id && a.confirmedAt).length === 7) r.confirmed += 1;
      }
      for (const rec of recos) {
        const b = people.find((p) => p.id === rec.beneficiaryId);
        if (!b) continue;
        const r = roll(b.districtName ?? 'Unassigned');
        if (rec.result.nearMiss.length > 0) r.nearMiss += 1;
        for (const t of rec.result.top) r.trades.add(t.qualification.title);
      }
      // Confirmed demand is what a plan can be costed from, so it decides the ranking.
      const districts = [...byDistrict.values()].sort((a, b) => b.confirmed - a.confirmed);

      const hist = new Map<string, number>();
      for (const a of answers) {
        if (a.fieldNo !== 4 || !a.confirmedAt || a.value.kind !== 'concepts') continue;
        for (const c of a.value.conceptIds) hist.set(c, (hist.get(c) ?? 0) + 1);
      }

      return {
        districts,
        people: people.length,
        confirmed: districts.reduce((n, r) => n + r.confirmed, 0),
        nearMiss: districts.reduce((n, r) => n + r.nearMiss, 0),
        spread: [...hist.entries()].sort((x, y) => y[1] - x[1]),
      };
    },
    [tick],
    { districts: [] as DistrictRoll[], people: 0, confirmed: 0, nearMiss: 0, spread: [] as [string, number][] },
  );

  const toPrioritise = daysUntil(3, 15);
  const toForward = daysUntil(3, 21);
  const topShare = d.spread.length > 0 && d.confirmed > 0
    ? Math.round((d.spread.slice(0, 10).reduce((n, [, c]) => n + c, 0) / d.spread.reduce((n, [, c]) => n + c, 0)) * 100)
    : null;

  return (
    <AppShell
      title="State officer"
      subtitle="SL-PACC"
      bands={
        <Band tone="warn">
          This device holds one district. A statewide roll-up reads every district on the server —
          that policy is not written yet, so the ranking below covers local data only.
          {!serverConfigured && ' No server is configured on this build.'}
        </Band>
      }
    >
      <div className="mx-auto grid w-full max-w-3xl gap-4 p-4 pb-24">
        <Card>
          <CardHeader>
            <CardTitle>Your two deadlines</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-6">
              <Stat value={toPrioritise} label="days to prioritise (15 Apr)" tone={toPrioritise < 30 ? 'bad' : 'warn'} />
              <Stat value={toForward} label="days to forward (21 Apr)" tone={toForward < 30 ? 'bad' : 'warn'} />
            </div>
            <p className="mb-0 mt-3 text-sm text-sand-700">
              The State does not re-verify what districts sent. Its mandated verb is
              {' '}<strong>prioritisation</strong> — Ch.1 ¶6(c)(v).
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Districts, ranked by confirmed demand</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            {d.districts.length === 0 && (
              <p className="m-0 text-sm text-sand-700">No district data on this device yet.</p>
            )}
            {d.districts.map((r, i) => (
              <div key={r.name} className="flex flex-wrap items-center gap-3 rounded-lg border border-beige-200 bg-beige-50 p-3">
                <Badge variant={i === 0 ? 'default' : 'secondary'}>#{i + 1}</Badge>
                <strong className="min-w-[7rem] flex-1">{r.name}</strong>
                <span className="text-sm text-sand-700">{r.confirmed}/{r.people} complete</span>
                {r.nearMiss > 0 && <Badge variant="outline">{r.nearMiss} near miss</Badge>}
                <Badge variant="outline">{r.trades.size} trades</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Statewide</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-6">
              <Stat value={d.people} label="interviewed" />
              <Stat value={d.confirmed} label="confirmed" tone="ok" />
              <Stat value={d.nearMiss} label="near miss" tone="warn" />
              <Stat value="3.5–4×" label="projection norm" />
            </div>
            {topShare !== null && (
              <div className="mt-4">
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span>Top-10 trade concentration</span>
                  <strong className={topShare > 40 ? 'text-red-700' : ''}>{topShare}%</strong>
                </div>
                <Progress value={topShare} />
                <p className="mb-0 mt-2 text-sm text-sand-700">
                  CAG found 40% of national certifications sat in 10 job-roles. If our own demand
                  concentrates the same way, we automated the failure with better UX.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>The statutory calendar</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            {CALENDAR.map((c) => (
              <div key={c.when} className="grid grid-cols-[7.5rem_1fr] gap-3 border-b border-beige-200 pb-2 last:border-0">
                <span className="font-mono text-sm font-semibold">{c.when}</span>
                <span className="text-sm">
                  <strong>{c.who}</strong> — {c.what}
                </span>
              </div>
            ))}
            <p className="mb-0 mt-1 text-sm text-sand-700">
              One Perspective Plan whose status advances, not a new document at each hop. The annual
              window is for amendments — Ch.3 ¶9 applies <em>"once the Perspective Plan is submitted,
              appraised and approved"</em>.
            </p>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
