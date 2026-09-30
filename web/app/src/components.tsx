/**
 * Shared components for both registers (see docs/DESIGN.md).
 *
 * Two rules are enforced here rather than written in a style guide, because a rule in a style guide
 * is a rule somebody forgets at 1am before a submission:
 *
 *   · `<Speak>` renders text AND its replay control from one prompt id. A beneficiary-facing string
 *     that arrives without a prompt id gets a visible marker, because a string with no audio is
 *     unusable by the person this product exists for.
 *   · `<StatusChip>` always carries an icon and a word. Status is never colour alone.
 */

import { createContext, useContext, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { ClipboardList, House, Landmark, Map, Settings } from 'lucide-react';
import type { ExpectOption, Locale } from '@rc097/core';
import { speak, ttsAvailable } from './lib/speech';
import { TABS, type Role } from './lib/role';

/**
 * The active role, so navigation can differ by audience.
 *
 * It is a context rather than a prop because every shell needs it and threading it through six
 * pages is how a "temporary" default ends up hard-coded. Default `beneficiary`: if the role is
 * somehow unset, the safest thing to render is the surface that shows nobody else's data.
 */
export const RoleContext = createContext<Role>('beneficiary');
export const useRole = (): Role => useContext(RoleContext);

// ---------------------------------------------------------------------------- Speak

export function Speak({
  text,
  locale,
  promptId,
  className,
}: {
  text: string;
  locale: Locale;
  promptId?: string;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  const play = async () => {
    if (busy) return;
    setBusy(true);
    await speak(text, locale, promptId);
    setBusy(false);
  };
  return (
    <div className={`speak ${className ?? ''}`}>
      {ttsAvailable() && (
        <button
          type="button"
          className="speak-btn"
          onClick={play}
          aria-label="इसे सुनिए / Play this aloud"
          style={{ opacity: busy ? 0.55 : 1 }}
        >
          {busy ? '❙❙' : '▶'}
        </button>
      )}
      <div lang={locale} style={{ flex: 1 }}>
        {text}
        {/* Dev-only lint marker. A beneficiary-facing string with no prompt id has no
            pre-rendered audio twin and falls back to synthesis, which is a shortfall worth
            seeing while building — and noise on a real user's screen. */}
        {!promptId && import.meta.env.DEV && (
          <span
            className="mono"
            title="No prompt id: this string has no audio twin. Add it to prompts.ts."
            style={{ opacity: 0.5, marginLeft: 6 }}
          >
            ⚠no-audio
          </span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------- progress

/** Seven beads. Legible without reading, which "Question 4 of 7" is not. */
export function Beads({ confirmed, deferred, current }: { confirmed: number[]; deferred: number[]; current?: number }) {
  return (
    <div className="beads" role="img" aria-label={`${confirmed.length} of 7 answered`}>
      {[1, 2, 3, 4, 5, 6, 7].map((n) => (
        <span
          key={n}
          className="bead"
          data-state={confirmed.includes(n) ? 'done' : deferred.includes(n) ? 'deferred' : n === current ? 'current' : 'todo'}
        />
      ))}
      <span style={{ marginLeft: 8, fontSize: 'var(--text-label)', opacity: 0.85 }}>
        {confirmed.length}/7
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------- status

export type Tone = 'eligible' | 'near' | 'out' | 'info' | 'neutral';

const CHIP_ICON: Record<Tone, string> = {
  eligible: '✓',
  near: '◐',
  out: '✕',
  info: 'ℹ',
  neutral: '•',
};

export function StatusChip({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span className="chip" data-tone={tone}>
      <span aria-hidden>{CHIP_ICON[tone]}</span>
      {children}
    </span>
  );
}

export function Band({ tone, children }: { tone: 'warn' | 'bad' | 'ok'; children: ReactNode }) {
  return (
    <div className="band" data-tone={tone} role="status">
      <span aria-hidden>{tone === 'ok' ? '✓' : tone === 'warn' ? '⚠' : '⛔'}</span>
      <span>{children}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------- register A controls

export function Options({
  options,
  layout = 'stack',
  locale,
  onPick,
  selected,
}: {
  options: ExpectOption[];
  layout?: 'stack' | 'grid';
  locale: Locale;
  onPick: (id: string) => void;
  selected?: string[];
}) {
  return (
    <div className="a-actions" data-layout={layout}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          className="a-btn"
          data-selected={selected?.includes(o.id) ? 'true' : undefined}
          onClick={() => onPick(o.id)}
        >
          {o.icon && <span className="a-btn-icon" aria-hidden>{o.icon}</span>}
          <span>
            <span lang={locale} style={{ display: 'block' }}>{o.labelLocal ?? o.label}</span>
            {o.labelLocal && o.label !== o.labelLocal && (
              <span style={{ display: 'block', fontSize: 'var(--text-label)', opacity: 0.6 }}>{o.label}</span>
            )}
          </span>
        </button>
      ))}
    </div>
  );
}

export function Mic({
  state,
  onToggle,
  onCancel,
  hint,
}: {
  state: 'idle' | 'listening' | 'thinking' | 'speaking';
  onToggle: () => void;
  onCancel?: () => void;
  hint?: string;
}) {
  const label =
    state === 'listening'
      ? 'सुन रहे हैं… कह चुकें तो वापस दबाइए'
      : state === 'thinking'
        ? 'समझ रहे हैं…'
        : state === 'speaking'
          ? 'बोल रहे हैं…'
          : 'बोलने के लिए दबाइए';
  const sub =
    state === 'listening'
      ? 'चुप होते ही अपने आप भी बंद हो जाएगा'
      : state === 'idle'
        ? 'Tap to speak · tap again to stop'
        : null;
  return (
    <div style={{ display: 'grid', gap: 10, justifyItems: 'center' }}>
      <button
        type="button"
        className="a-mic"
        data-listening={state === 'listening' ? 'true' : undefined}
        // Tap to start, tap to stop. Hold-to-talk failed on a real handset: once Android's
        // recogniser takes the microphone, pointerup/pointerleave stop arriving in the WebView and
        // the button never releases. Two taps also beat a ten-second hold for a user who may be
        // holding a child in the other arm.
        onClick={onToggle}
        aria-label={label}
        aria-pressed={state === 'listening'}
        disabled={state === 'thinking'}
      >
        {state === 'thinking' ? '…' : state === 'listening' ? '■' : state === 'speaking' ? '🔊' : '🎤'}
      </button>
      <div
        lang="hi"
        style={{
          fontSize: state === 'listening' ? 'var(--text-body)' : 'var(--text-bodysm)',
          fontWeight: state === 'listening' ? 650 : 500,
          opacity: 0.95,
          textAlign: 'center',
        }}
      >
        {label}
      </div>
      {sub && <div className="muted" style={{ textAlign: 'center', marginTop: -4 }}>{sub}</div>}
      {state === 'listening' && onCancel && (
        <button type="button" className="b-btn" data-variant="ghost" onClick={onCancel}>
          रहने दीजिए
        </button>
      )}
      {hint && <div className="muted" style={{ textAlign: 'center' }}>{hint}</div>}
    </div>
  );
}

export function PinPad({ onDone, length = 4, label }: { onDone: (pin: string) => void; length?: number; label: string }) {
  const [pin, setPin] = useState('');
  const push = (d: string) => {
    const next = (pin + d).slice(0, length);
    setPin(next);
    if (next.length === length) {
      onDone(next);
      setPin('');
    }
  };
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div lang="hi" style={{ fontSize: 'var(--text-bodysm)' }}>{label}</div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }} aria-live="polite">
        {Array.from({ length }, (_, i) => (
          <span
            key={i}
            style={{
              width: 44,
              height: 52,
              borderRadius: 10,
              border: '2px solid var(--color-beige-300)',
              background: '#fff',
              display: 'grid',
              placeItems: 'center',
              fontSize: 26,
            }}
          >
            {/* Masked. The PIN exists to stop a shared handset leaking one person's interview to
                another, so it must not be readable over a shoulder. */}
            {pin[i] ? '•' : ''}
          </span>
        ))}
      </div>
      <div className="a-actions" data-layout="grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', background: 'transparent', border: 0, padding: 0 }}>
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button key={d} type="button" className="a-btn" style={{ justifyContent: 'center', fontSize: 24 }} onClick={() => push(d)}>
            {d}
          </button>
        ))}
        <button type="button" className="a-btn" style={{ justifyContent: 'center' }} onClick={() => setPin('')}>
          ⌫
        </button>
        <button type="button" className="a-btn" style={{ justifyContent: 'center', fontSize: 24 }} onClick={() => push('0')}>
          0
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------- register B chrome

export function AppShell({ title, subtitle, children, bands }: { title: string; subtitle?: string; children: ReactNode; bands?: ReactNode }) {
  return (
    <div className="b-shell">
      <header className="b-head">
        <div style={{ maxWidth: '88rem', marginInline: 'auto', display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
          <strong style={{ fontSize: 'var(--text-lead)' }}>{title}</strong>
          {subtitle && <span style={{ opacity: 0.75, fontSize: 'var(--text-bodysm)' }}>{subtitle}</span>}
        </div>
      </header>
      {bands}
      {children}
      <TabBar />
    </div>
  );
}

export function TabBar() {
  const role = useRole();
  const tabs = TABS[role];
  return (
    // `display` lives in the stylesheet, not here: the admin shell hides this bar at desk width,
    // and an inline `display: flex` would outrank any rule that tried to.
    <nav
      className="tabbar"
      style={{
        position: 'sticky',
        bottom: 0,
        background: '#fff',
        borderTop: '1px solid var(--color-beige-200)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {tabs.map((n) => (
        <NavLink
          key={n.to}
          to={n.to}
          style={({ isActive }) => ({
            flex: 1,
            minHeight: 56,
            display: 'grid',
            placeItems: 'center',
            gap: 2,
            padding: '6px 4px',
            textDecoration: 'none',
            color: isActive ? 'var(--color-plum-700)' : 'var(--color-sand-700)',
            borderTop: isActive ? '3px solid var(--color-plum-700)' : '3px solid transparent',
            fontSize: 'var(--text-label)',
            fontWeight: isActive ? 700 : 500,
          })}
        >
          <span style={{ fontSize: 20 }} aria-hidden>{n.icon}</span>
          {n.label}
        </NavLink>
      ))}
    </nav>
  );
}

/**
 * The officer console's desktop chrome.
 *
 * Register B was drawn for a tablet and then shown on a Collector's 1080p monitor, where it read
 * as a stretched phone: a wrapped strip of pill buttons, two columns of cards in the middle third,
 * and a 56px thumb-zone tab bar pinned to the bottom of a screen nobody touches. The density the
 * design system promised the officer was never actually delivered at desk width.
 *
 * So the same content gets a second chrome above 64rem — persistent left rail, one top bar, a
 * 12-column content grid — and keeps the phone chrome below it. Both are rendered; CSS picks.
 * There is no second copy of the console and no desktop-only route.
 */
/**
 * The rail's own icons. `role.ts` stores a tab's icon as an emoji because the beneficiary's tab bar
 * is drawn for someone who cannot read the label under it — a picture is the label. The officer
 * rail is read by someone who can, where a colour emoji next to 13px type just looks unfinished,
 * so the desk chrome swaps in a line icon by route and leaves the phone bar alone.
 */
const RAIL_ICON: Record<string, ReactNode> = {
  '/home': <House size={17} />,
  '/officer': <Landmark size={17} />,
  '/outcomes': <ClipboardList size={17} />,
  '/state': <Map size={17} />,
  '/settings': <Settings size={17} />,
};

export function AdminShell({
  brand,
  district,
  tabs,
  tab,
  onTab,
  meta,
  actions,
  bands,
  children,
}: {
  brand: string;
  district: string;
  tabs: { id: string; label: string; icon: ReactNode; hint?: string }[];
  tab: string;
  onTab: (id: string) => void;
  meta?: ReactNode;
  actions?: ReactNode;
  bands?: ReactNode;
  children: ReactNode;
}) {
  const role = useRole();
  const active = tabs.find((t) => t.id === tab);
  return (
    <div className="b-shell adm">
      <aside className="adm-side">
        <div className="adm-brand">
          <span className="adm-mark" aria-hidden>◆</span>
          <span>
            <strong>{brand}</strong>
            <span className="adm-brand-sub">PM-AJAY · GIA</span>
          </span>
        </div>

        <div className="adm-district">
          <span className="adm-district-label">District</span>
          <strong>{district}</strong>
        </div>

        <nav className="adm-nav" aria-label="Console sections">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              className="adm-nav-item"
              data-active={t.id === tab ? 'true' : undefined}
              onClick={() => onTab(t.id)}
            >
              <span className="adm-nav-icon" aria-hidden>{t.icon}</span>
              <span>
                <span className="adm-nav-label">{t.label}</span>
                {t.hint && <span className="adm-nav-hint">{t.hint}</span>}
              </span>
            </button>
          ))}
        </nav>

        <div className="adm-side-foot">
          {/* The rail replaces the bottom tab bar on desktop, so the role's other screens have to
              remain reachable from it — otherwise the desktop chrome quietly loses navigation. */}
          <span className="adm-district-label">Elsewhere</span>
          {TABS[role]
            .filter((n) => n.to !== '/officer')
            .map((n) => (
              <NavLink key={n.to} to={n.to} className="adm-nav-item" data-quiet="true">
                <span className="adm-nav-icon" aria-hidden>{RAIL_ICON[n.to] ?? n.icon}</span>
                <span className="adm-nav-label">{n.label}</span>
              </NavLink>
            ))}
        </div>
      </aside>

      <div className="adm-body">
        <header className="adm-top">
          <div>
            <h1>{active?.label ?? brand}</h1>
            <p className="adm-top-sub">{district} · DL-PACC</p>
          </div>
          <div className="adm-top-right">
            {meta}
            {actions}
          </div>
        </header>
        {bands}
        {children}
      </div>

      {/* Phone chrome. Hidden at desk width, where the rail is doing this job. */}
      <TabBar />
    </div>
  );
}

/** Tab strip for the phone width of the admin shell. The rail replaces it above 64rem. */
export function AdminTabs({
  tabs,
  tab,
  onTab,
}: {
  tabs: { id: string; label: string }[];
  tab: string;
  onTab: (id: string) => void;
}) {
  return (
    <div className="officer-tabs">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          className="b-btn"
          data-variant={tab === t.id ? undefined : 'ghost'}
          onClick={() => onTab(t.id)}
          style={{ whiteSpace: 'nowrap' }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

/**
 * A headline number with its own tile.
 *
 * `note` is not decoration: every number on this console is judged against a figure from the
 * guidelines or the CAG report, and a bare "40%" beside a tile that does not say "against 70%
 * mandated" is the kind of dashboard this project exists to replace.
 */
export function Kpi({
  value,
  label,
  note,
  tone,
  icon,
}: {
  value: ReactNode;
  label: string;
  note?: string;
  tone?: 'warn' | 'ok' | 'bad';
  icon?: ReactNode;
}) {
  return (
    <div className="kpi" data-tone={tone}>
      <div className="kpi-head">
        <span className="kpi-label">{label}</span>
        {icon && <span className="kpi-icon" aria-hidden>{icon}</span>}
      </div>
      <div className="kpi-value">{value}</div>
      {note && <div className="kpi-note">{note}</div>}
    </div>
  );
}

/**
 * The register as a funnel, because the scheme's failure is a funnel: CAG measured 41% placement
 * against a mandated 70%, and a stack of four equal counts hides exactly where the drop happens.
 */
export function Funnel({ steps }: { steps: { label: string; value: number; tone?: Tone }[] }) {
  const max = Math.max(1, ...steps.map((s) => s.value));
  const colourOf = (t?: Tone) =>
    t === 'near' ? 'var(--color-amber-500)' : t === 'out' ? 'var(--color-rose-600)' : t === 'eligible' ? 'var(--color-teal-600)' : 'var(--color-plum-600)';
  return (
    <div className="funnel">
      {steps.map((s, i) => (
        <div key={s.label} className="funnel-step">
          <div className="funnel-bar" style={{ height: `${Math.max(8, (s.value / max) * 100)}%`, background: colourOf(s.tone) }}>
            <span>{s.value}</span>
          </div>
          <span className="funnel-label">{s.label}</span>
          {/* Rendered even for the first step, and empty: the rows are a grid, so a step with one
              fewer child sits at a different height and the bars stop sharing a baseline. */}
          <span className="funnel-drop">
            {i === 0 ? '\u00a0' : steps[i - 1].value === 0 ? '—' : `${Math.round((s.value / steps[i - 1].value) * 100)}%`}
          </span>
        </div>
      ))}
    </div>
  );
}

export function Card({ title, children, wide, action, span }: { title: string; children: ReactNode; wide?: boolean; action?: ReactNode; span?: 3 | 4 | 5 | 6 | 8 | 9 | 12 }) {
  return (
    <section className={`b-card ${wide ? 'b-wide' : ''}`} data-span={span}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <h2>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Stat({ value, label, tone }: { value: ReactNode; label: string; tone?: 'warn' | 'ok' | 'bad' }) {
  const colour = tone === 'bad' ? 'var(--color-rose-600)' : tone === 'warn' ? 'var(--color-amber-600)' : tone === 'ok' ? 'var(--color-teal-600)' : 'var(--color-plum-800)';
  return (
    <div>
      <div style={{ fontSize: '1.875rem', fontWeight: 700, color: colour, lineHeight: 1.1 }}>{value}</div>
      <div className="muted">{label}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------- chart

/**
 * Horizontal bar chart, hand-rolled in SVG.
 *
 * No chart library: this is the only chart in the product and it is 30 lines. A charting dependency
 * would add more bytes to an APK that has to install over a village 2G connection than the entire
 * interview engine does.
 *
 * `marker` draws the CAG comparison line, because the number this chart exists to be judged
 * against is "40% of certifications in 10 job-roles".
 */
export function BarChart({
  rows,
  marker,
}: {
  rows: { label: string; value: number; tone?: Tone }[];
  marker?: { at: number; label: string };
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  const colourOf = (t?: Tone) =>
    t === 'near' ? 'var(--color-amber-500)' : t === 'out' ? 'var(--color-rose-600)' : t === 'eligible' ? 'var(--color-teal-600)' : 'var(--color-plum-600)';
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      {rows.length === 0 && <div className="muted">No data yet — run an interview.</div>}
      {rows.map((r) => (
        // The label track may shrink; the bar track may not. A fixed 12rem label in a one-third
        // card left the bar 30px wide, which turned a chart into a row of full-looking stubs.
        <div key={r.label} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 12rem) minmax(4.5rem, 1fr) auto', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 'var(--text-label)', overflowWrap: 'anywhere' }}>{r.label}</span>
          <div style={{ background: 'var(--color-beige-100)', borderRadius: 4, height: 18, position: 'relative' }}>
            <div style={{ width: `${(r.value / max) * 100}%`, height: '100%', background: colourOf(r.tone), borderRadius: 4 }} />
            {marker && (
              <div
                title={marker.label}
                style={{ position: 'absolute', left: `${Math.min(100, (marker.at / max) * 100)}%`, top: -3, bottom: -3, width: 2, background: 'var(--color-rose-600)' }}
              />
            )}
          </div>
          <span className="mono">{r.value}</span>
        </div>
      ))}
      {marker && <div className="muted">Red line: {marker.label}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------- connectivity

export function useOnline(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);
  return online;
}

/** Persistent, never a toast. A mobiliser has to know before she walks to the next house. */
export function OfflineBand({ pending }: { pending: number }) {
  const online = useOnline();
  if (online && pending === 0) return null;
  if (!online) {
    return (
      <Band tone="warn">
        Offline — the interview still works. {pending > 0 ? `${pending} batch${pending === 1 ? '' : 'es'} waiting to sync.` : 'Nothing is lost.'}
      </Band>
    );
  }
  return <Band tone="ok">Online — syncing {pending} pending batch{pending === 1 ? '' : 'es'}.</Band>;
}

export function useTick(ms = 4000): number {
  const [n, setN] = useState(0);
  const ref = useRef(0);
  useEffect(() => {
    const t = window.setInterval(() => setN((ref.current += 1)), ms);
    return () => window.clearInterval(t);
  }, [ms]);
  return n;
}

export function useMemoAsync<T>(fn: () => Promise<T>, deps: unknown[], initial: T): T {
  const [value, setValue] = useState<T>(initial);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const memo = useMemo(() => fn, deps);
  useEffect(() => {
    let alive = true;
    void memo().then((v) => {
      if (alive) setValue(v);
    });
    return () => {
      alive = false;
    };
  }, [memo]);
  return value;
}
