import React from 'react';
import { interpolate } from 'remotion';
import { T } from '../theme';
import { Panel, Row, Tick } from '../components/Panel';
import { Phone, Waveform, FeaturePhone } from '../components/Phone';
import { CallScreen } from '../components/CallScreen';
import { WhatsAppScreen } from '../components/WhatsAppScreen';
import { KioskScreen } from '../components/KioskScreen';
import { shot } from '../screens';

const card: React.CSSProperties = {
  borderRadius: 16, border: `1px solid ${T.line}`, background: '#fff', padding: '18px 20px',
};

/* 1 ─ who she is ─────────────────────────────────────────────────────────── */
export const IntroPanel: React.FC<{ t: number }> = ({ t }) => (
  <Panel t={t} kicker="STEP 1 · WHO WALKS IN" title="Sunita, an SC beneficiary">
    <div style={{ display: 'flex', gap: 26, alignItems: 'flex-start' }}>
      <div style={{
        width: 128, height: 128, borderRadius: 24, background: T.mint, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center', font: '62px sans-serif',
      }}>👩🏽‍🌾</div>
      <div style={{ flex: 1 }}>
        <Row show={interpolate(t, [0.5, 1.0], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}>
          <div style={{
            display: 'inline-block', padding: '5px 13px', borderRadius: 999, marginBottom: 14,
            background: '#fef3c7', border: '1px solid #f59e0b', color: '#92400e',
            font: `800 16px/1 ${T.font}`, letterSpacing: 1.4,
          }}>ILLUSTRATIVE</div>
        </Row>
        <div style={{ font: `500 27px/1.45 ${T.font}`, color: T.inkSoft }}>
          Reusa · Laharpur block, Sitapur. Five years of plumbing work. A feature phone.
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 22, flexWrap: 'wrap' }}>
          {['No smartphone', 'No data', 'No app'].map((s2, i) => (
            <Row key={s2} show={interpolate(t, [1.0 + i * 0.28, 1.4 + i * 0.28], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}>
              <div style={{ ...card, padding: '12px 20px', font: `700 24px/1 ${T.font}`, color: T.ink, background: '#f8fafc' }}>{s2}</div>
            </Row>
          ))}
        </div>
      </div>
      <Row show={interpolate(t, [0.15, 0.7], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}>
        <FeaturePhone w={168} label="This handset is enough" ringing={1} />
      </Row>
    </div>
  </Panel>
);

/* 2 ─ no forms, voice only ───────────────────────────────────────────────── */
export const VoicePanel: React.FC<{ t: number }> = ({ t }) => {
  const kill = interpolate(t, [0.6, 1.8], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const rise = interpolate(t, [1.6, 2.4], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <Panel t={t} kicker="STEP 2 · THE BARRIER WE REMOVE" title="She fills in nothing. She speaks.">
      <div style={{ display: 'flex', gap: 30, height: '100%' }}>
        <div style={{ flex: 1, ...card, position: 'relative', opacity: 1 - kill * 0.55, filter: `grayscale(${kill})` }}>
          <div style={{ font: `700 20px/1 ${T.font}`, color: T.inkSoft, letterSpacing: 1.2, marginBottom: 16 }}>THE OLD WAY</div>
          {['Name', 'Caste certificate no.', 'Qualification', 'Trade preference', 'Bank / IFSC'].map((f, i) => (
            <div key={f} style={{ marginBottom: 13, position: 'relative' }}>
              <div style={{ font: `600 17px/1 ${T.font}`, color: T.inkSoft, marginBottom: 5 }}>{f}</div>
              <div style={{ height: 32, borderRadius: 8, background: '#f1f5f9', border: `1px solid ${T.line}` }} />
              <div style={{
                position: 'absolute', left: 0, top: '68%', height: 3, background: T.red, borderRadius: 2,
                width: `${Math.max(0, Math.min(1, kill * 1.5 - i * 0.12)) * 100}%`,
              }} />
            </div>
          ))}
        </div>
        <div style={{ flex: 1, ...card, background: '#f0fdf4', border: '1px solid #bbf7d0', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 20, opacity: rise, transform: `scale(${0.94 + 0.06 * rise})` }}>
          <div style={{ width: 104, height: 104, borderRadius: 999, background: T.green, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', font: '48px sans-serif' }}>🎤</div>
          <div style={{ font: `800 34px/1.25 ${T.font}`, color: T.ink, textAlign: 'center' }}>She answers by voice</div>
          <div style={{ font: `500 24px/1.4 ${T.font}`, color: T.inkSoft, textAlign: 'center' }}>in her own regional language</div>
          <Waveform energy={0.35 + 0.65 * Math.abs(Math.sin(t * 3))} color={T.green} height={52} width={330} seed={5} />
        </div>
      </div>
    </Panel>
  );
};

/* 3 ─ the interview ──────────────────────────────────────────────────────── */
const QUESTIONS = [
  { q: 'Have you been to school, and until which class?', a: 'School nahi gayi.', topic: 'Education' },
  { q: 'What work do you do now?', a: 'Nal-mistri ka kaam karti hoon.', topic: 'Skills' },
  { q: 'How many years have you done this work?', a: 'Paanch saal se.', topic: 'Work experience' },
  { q: 'What would you like to do next?', a: 'Apna kaam shuru karna hai.', topic: 'Preferences' },
];

export const InterviewPanel: React.FC<{ t: number }> = ({ t }) => {
  const i = Math.min(QUESTIONS.length - 1, Math.floor(Math.max(0, t - 0.5) / 1.75));
  const local = Math.max(0, t - 0.5) % 1.75;
  const cur = QUESTIONS[i];
  return (
    <Panel t={t} kicker="STEP 3 · VOICE BASED INTERVIEW" title="Seven questions. One at a time.">
      <div style={{ display: 'flex', gap: 30, height: '100%' }}>
        <Phone w={286}>
          <CallScreen
            s={286 / 352}
            seconds={18 + t * 1.2}
            question={cur.q}
            answer={local > 0.7 ? cur.a : undefined}
            readback={local > 1.25}
            energy={local > 0.7 && local < 1.3 ? 0.55 + 0.45 * Math.abs(Math.sin(t * 7)) : 0.12}
          />
        </Phone>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {QUESTIONS.map((q, k) => (
            <Row key={q.topic} show={k <= i ? 1 : 0.25}>
              <div style={{
                ...card, padding: '14px 18px', borderLeft: `6px solid ${k <= i ? T.green : T.line}`,
                background: k === i ? '#f0fdf4' : '#fff',
              }}>
                <div style={{ font: `800 15px/1 ${T.font}`, color: T.green, letterSpacing: 1.3 }}>{q.topic.toUpperCase()}</div>
                <div style={{ font: `600 22px/1.3 ${T.font}`, color: T.ink, marginTop: 6 }}>{q.q}</div>
              </div>
            </Row>
          ))}
          <div style={{ ...card, marginTop: 'auto', background: '#fffbeb', border: '1px solid #fde68a' }}>
            <div style={{ font: `700 22px/1.3 ${T.font}`, color: '#92400e' }}>↺ Every answer is read back for a yes</div>
            <div style={{ font: `500 19px/1.35 ${T.font}`, color: '#a16207', marginTop: 5 }}>
              Nothing is counted as her answer until she confirms it.
            </div>
          </div>
        </div>
      </div>
    </Panel>
  );
};

/* 4 ─ eligibility, not just a suggestion ─────────────────────────────────── */
export const EnginePanel: React.FC<{ t: number }> = ({ t }) => {
  const s = (n: number) => interpolate(t, [n, n + 0.5], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <Panel t={t} kicker="STEP 4 · SKILL ELIGIBILITY CHECK" title="It does not just suggest a course.">
      <div style={{ font: `500 25px/1.4 ${T.font}`, color: T.inkSoft, marginBottom: 22 }}>
        It runs the requirement analysis against the national register, then tells her where she stands.
      </div>
      <Tick show={s(0.6)} ok label="No school certificate needed" detail="इसके लिए स्कूल की डिग्री नहीं चाहिए — the build's own words for this trade" />
      <Tick show={s(1.9)} ok label="Five years of work counts" detail="आपने 5 साल नल-मिस्त्री का काम किया है — prior work, read as prior learning" />
      <Tick show={s(3.1)} ok label="Matched to a live pathway" detail="Plumber (General) · Level 3 · 2 महीने, आपके ब्लॉक में" />
      <Tick show={s(4.4)} ok={false} label="One gap worth closing — named, not cured" detail="पहले इसी काम का लेवल 3 कोर्स कर लीजिए. It names the gap; it does not invent a fix." />
      <Row show={s(6.0)}>
        <div style={{ ...card, background: '#ecfdf5', border: '1px solid #6ee7b7', marginTop: 4 }}>
          <div style={{ font: `800 27px/1.3 ${T.font}`, color: T.mintDeep }}>✓ योग्य — eligible, and told so out loud</div>
        </div>
      </Row>
    </Panel>
  );
};

/* 5 ─ NSQF mapping ───────────────────────────────────────────────────────── */
export const NsqfPanel: React.FC<{ t: number }> = ({ t }) => {
  const s = (n: number) => interpolate(t, [n, n + 0.4], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const items = [
    { name: 'Plumber (General)', level: 'Level 3', note: 'योग्य · 2 महीने · आपके ब्लॉक में · अपना काम' },
    { name: 'Option 2', level: 'Level 1', note: 'योग्य · 1 महीना — the engine ranks it lower, and says why' },
    { name: 'Option 3', level: 'ranked', note: 'same register, same rules, spread check applied' },
  ];

  return (
    <Panel t={t} kicker="STEP 5 · RECOMMENDATION GIVEN" title="Mapped to NSQF-aligned pathways">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {items.map((it, i) => (
          <Row key={it.name} show={s(0.35 + i * 0.45)}>
            <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 18, borderLeft: `6px solid ${T.blue}` }}>
              <div style={{ padding: '7px 14px', borderRadius: 999, background: T.blueSoft, color: T.blue, font: `800 20px/1 ${T.font}` }}>{it.level}</div>
              <div>
                <div style={{ font: `700 28px/1.2 ${T.font}`, color: T.ink }}>{it.name}</div>
                <div style={{ font: `500 19px/1.3 ${T.font}`, color: T.inkSoft, marginTop: 4 }}>{it.note}</div>
              </div>
            </div>
          </Row>
        ))}
      </div>
      <Row show={s(2.1)} style={{ marginTop: 20 }}>
        <div style={{ ...card, background: '#f8fafc' }}>
          <div style={{ font: `500 21px/1.4 ${T.font}`, color: T.inkSoft }}>
            Ranked from the official register — where the official record has no value, we store nothing rather than guess.
          </div>
        </div>
      </Row>
    </Panel>
  );
};

/* 6 ─ the plan she is handed ─────────────────────────────────────────────── */
export const PlanPanel: React.FC<{ t: number }> = ({ t }) => {
  const s = (n: number) => interpolate(t, [n, n + 0.45], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const my = shot('myplan.png');
  return (
    <Panel t={t} kicker="STEP 6 · CLEAR NEXT STEPS" title="Spoken back, and on the screen">
      <div style={{ display: 'flex', gap: 28, height: '100%' }}>
        {my ? <Phone w={250}><KioskScreen shot={my} /></Phone> : null}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 13 }}>
          <Row show={s(0.4)}>
            <div style={{ ...card, borderLeft: `6px solid ${T.green}` }}>
              <div style={{ font: `800 16px/1 ${T.font}`, color: T.green, letterSpacing: 1.3 }}>THE TRADE</div>
              <div style={{ font: `700 30px/1.2 ${T.font}`, color: T.ink, marginTop: 6 }}>Plumber (General)</div>
            </div>
          </Row>
          <Row show={s(1.2)}>
            <div style={{ ...card, borderLeft: `6px solid ${T.blue}` }}>
              <div style={{ font: `800 16px/1 ${T.font}`, color: T.blue, letterSpacing: 1.3 }}>TRAINING DETAILS</div>
              <div style={{ font: `700 30px/1.2 ${T.font}`, color: T.ink, marginTop: 6 }}>Level 3 · 2 महीने · आपके ब्लॉक में</div>
            </div>
          </Row>
          <Row show={s(2.0)}>
            <div style={{ ...card, borderLeft: `6px solid ${T.orange}`, background: T.orangeSoft }}>
              <div style={{ font: `800 16px/1 ${T.font}`, color: '#92400e', letterSpacing: 1.3 }}>ONE GAP WORTH CLOSING</div>
              <div style={{ font: `600 25px/1.3 ${T.font}`, color: T.ink, marginTop: 6 }}>पहले इसी काम का लेवल 3 कोर्स कर लीजिए — उससे ये रास्ता खुल जाता है</div>
            </div>
          </Row>
          <Row show={s(2.8)}>
            <div style={{ ...card, borderLeft: `6px solid ${T.mintDeep}`, background: '#ecfdf5' }}>
              <div style={{ font: `800 16px/1 ${T.font}`, color: T.mintDeep, letterSpacing: 1.3 }}>SPOKEN BACK TO HER</div>
              <div style={{ font: `600 25px/1.3 ${T.font}`, color: T.ink, marginTop: 6 }}>आप इसके लिए योग्य हैं।</div>
            </div>
          </Row>
        </div>
      </div>
    </Panel>
  );
};

/* 7 ─ three doors ────────────────────────────────────────────────────────── */
export const ChannelsPanel: React.FC<{ t: number }> = ({ t }) => {
  const s = (n: number) => interpolate(t, [n, n + 0.5], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const lift = (v: number) => ({ opacity: v, transform: `translateY(${(1 - v) * 40}px)` });
  return (
    <Panel t={t} kicker="STEP 7 · THREE DOORS" title="Three ways in. One engine.">
      <div style={{ display: 'flex', gap: 22, justifyContent: 'space-between', height: '100%', alignItems: 'flex-start' }}>
        <div style={lift(s(0.3))}>
          <Phone w={202} label="IVR call">
            <CallScreen
              s={202 / 352}
              seconds={41}
              keypad
              pressed={t > 2.6 && t < 3.0 ? '1' : null}
            />
          </Phone>
          <div style={{ font: `600 17px/1.35 ${T.font}`, color: T.inkSoft, textAlign: 'center', marginTop: 8, width: 202 }}>
            A normal call. Any handset.
          </div>
        </div>
        <div style={lift(s(1.4))}>
          <Phone w={202} label="WhatsApp voice note">
            <WhatsAppScreen step={Math.max(0, (t - 1.6) * 1.5)} recording={t > 3.1 ? (t - 3.1) : 0} />
          </Phone>
          <div style={{ font: `600 17px/1.35 ${T.font}`, color: T.inkSoft, textAlign: 'center', marginTop: 8, width: 202 }}>
            One question per message
          </div>
        </div>
        <div style={lift(s(2.5))}>
          <Phone w={202} label="Kiosk / mobile app">
            <KioskScreen shot={shot('interview.png')} syncing={t > 4.2} />
          </Phone>
          <div style={{ font: `600 17px/1.35 ${T.font}`, color: T.inkSoft, textAlign: 'center', marginTop: 8, width: 202 }}>
            Keeps working when the link drops
          </div>
        </div>
      </div>
    </Panel>
  );
};
