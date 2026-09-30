/**
 * "Ask anything" — the chat surface, voice-first, and deliberately NOT an LLM.
 *
 * It answers from three local sources: the NSQF entry table, the qualification catalogue, and the
 * PM-AJAY guideline facts already cited in docs/. Retrieval is the same lexicon + phonetic matcher
 * the interview uses, so a question asked in Bhojpuri about "silai" finds the tailoring answers.
 *
 * Why rules and not a model:
 *   · it works in aeroplane mode, which is the whole point of this channel;
 *   · every answer can carry the clause it came from, and a beneficiary asking "am I eligible" is
 *     asking a legal question about a published table — a fluent guess is worse than useless here;
 *   · no per-message cost, no round trip, no 1200 ms wait on a 2G link.
 *
 * Where a real LLM belongs is the same narrow job it has in the interview: mapping a messy question
 * to one of these intents. `classify()` is that seam — swap its body for a constrained model call
 * and nothing else changes.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  eligibleLevels,
  gate,
  GIA_TRAINING_CATEGORIES,
  matchConcepts,
  NSQF_LEVELS,
  OPPORTUNITIES,
  QUALIFICATIONS,
  conceptLabel,
  profileFrom,
  romanize,
  startSession,
  type Answer,
  type FieldNo,
  type Locale,
  type Profile,
} from '@rc097/core';
import { AppShell, Speak, StatusChip, useMemoAsync, useRole } from '../components';
import { isOfficer } from '../lib/role';
import { openStore } from '../lib/db';
import { ASR_LOCALE, asrAvailable, recognise } from '../lib/speech';

type Msg = { who: 'them' | 'us'; text: string; cite?: string; chips?: string[] };

type Intent =
  | { kind: 'eligibility' }
  | { kind: 'courses'; conceptId: string | null }
  | { kind: 'no_school' }
  | { kind: 'money' }
  | { kind: 'duration'; conceptId: string | null }
  | { kind: 'nearby' }
  | { kind: 'women' }
  | { kind: 'pmdaksh' }
  | { kind: 'privacy' }
  | { kind: 'what_is_nsqf' }
  | { kind: 'unknown' };

/** Intent classification, rung-1 style: keyword and concept match over the romanised question. */
function classify(q: string): Intent {
  const r = romanize(q);
  const concept = matchConcepts([q]).find((m) => m.confidence >= 0.7)?.conceptId ?? null;

  if (/yogya|eligib|kar sakti|kar sakta|mil sakta|मैं कर|पात्र/.test(r) || /yogy/.test(r)) return { kind: 'eligibility' };
  if (/skul nahi|school nahi|nahi padh|anpadh|nirakshar|padhi nahi|बिना पढ़/.test(r)) return { kind: 'no_school' };
  if (/paisa|paise|rupay|rupee|kharch|fees|fis|stipend|wajifa|money|kitna milega|anudan|grant|loan|karz/.test(r)) return { kind: 'money' };
  if (/kitne din|kitna samay|mahina|mahine|duration|kitne ghante|hours|kab tak/.test(r)) return { kind: 'duration', conceptId: concept };
  if (/kahan|pas me|nazdik|near|centre|center|kendra|dur/.test(r)) return { kind: 'nearby' };
  if (/mahila|aurat|ladki|women|beti|30/.test(r)) return { kind: 'women' };
  if (/daksh|pm daksh|pmdaksh/.test(r)) return { kind: 'pmdaksh' };
  if (/awaz|recording|privacy|data|record|suraksh|delete|mitana/.test(r)) return { kind: 'privacy' };
  if (/nsqf|level|star|framework/.test(r)) return { kind: 'what_is_nsqf' };
  if (concept || /kaun sa kors|course|training|sikhna|seekhna|traning|कोर्स/.test(r)) return { kind: 'courses', conceptId: concept };
  return { kind: 'unknown' };
}

function answer(intent: Intent, profile: Profile | null): Omit<Msg, 'who'> {
  const levels = profile ? eligibleLevels(profile) : [];

  switch (intent.kind) {
    case 'no_school':
      return {
        text:
          'स्कूल न जाने से रास्ता बंद नहीं होता। NSQF के लेवल 1 और लेवल 2 के लिए कोई स्कूली पढ़ाई ज़रूरी नहीं है — बिलकुल नहीं। और लेवल 2.5 से ऊपर, काम का तजुर्बा पढ़ाई की जगह ले लेता है, बस पढ़ना-लिखना आना चाहिए।',
        cite: 'NSQF Gazette Notification, NCVET, 6 June 2023 — entry requirement table',
        chips: ['लेवल 1-2: कोई पढ़ाई नहीं', 'लेवल 2.5+: तजुर्बा गिना जाता है'],
      };

    case 'eligibility': {
      if (!profile || levels.length === 0) {
        return {
          text: 'ये बताने के लिए मुझे आपकी पढ़ाई और तजुर्बे की बात जाननी होगी। सात सवालों की बातचीत कर लीजिए, फिर मैं ठीक-ठीक बता सकूँगी।',
          cite: 'Eligibility is a hard gate over the NSQF table, not a guess',
        };
      }
      const okCount = QUALIFICATIONS.filter((q) => gate(q, profile, { eligibleLevels: levels }).bucket === 'ELIGIBLE').length;
      const nearCount = QUALIFICATIONS.filter((q) => gate(q, profile, { eligibleLevels: levels }).bucket === 'NEAR_MISS').length;
      return {
        text: `आपकी बातों के हिसाब से आप NSQF लेवल ${levels.join(', ')} तक के कोर्स कर सकती हैं। इस सूची में ${okCount} कोर्स आपके लिए खुले हैं, और ${nearCount} में थोड़ी कमी रह जाती है — वो कमी मैं बता सकती हूँ।`,
        cite: `NSQF entry routes satisfied: ${levels.length} level(s)`,
        chips: [`${okCount} खुले`, `${nearCount} लगभग`],
      };
    }

    case 'courses': {
      const pool = intent.conceptId ? QUALIFICATIONS.filter((q) => q.concepts.includes(intent.conceptId!)) : QUALIFICATIONS;
      const usable = profile ? pool.filter((q) => gate(q, profile, { eligibleLevels: levels }).bucket !== 'INELIGIBLE') : pool;
      const names = usable.slice(0, 4).map((q) => `${q.title} (${q.levelLabel})`);
      const what = intent.conceptId ? conceptLabel(intent.conceptId, 'hi') : 'इस सूची';
      if (names.length === 0) {
        return {
          text: `${what} के लिए इस सूची में अभी आपके लेवल का कोई कोर्स नहीं मिला। गाँव की दीदी से बात कीजिए — वो और विकल्प देख सकती हैं।`,
          cite: 'Prototype catalogue; the official NQR has 1,934 valid qualifications',
        };
      }
      return {
        text: `${what} के लिए ये रास्ते हैं: ${names.join('; ')}.`,
        cite: 'Prototype catalogue — QP codes NULL until the official NQR import runs',
        chips: names.slice(0, 3),
      };
    }

    case 'duration': {
      const q = intent.conceptId ? QUALIFICATIONS.find((x) => x.concepts.includes(intent.conceptId!)) : null;
      if (q?.delivery && q.notionalHours) {
        const months = Math.max(1, Math.round(q.notionalHours / 150));
        return {
          text: `${q.title} — कुल ${q.notionalHours} घंटे, यानी करीब ${months} महीने। उसमें ${q.delivery.practical} घंटे हाथ से काम, ${q.delivery.theory} घंटे पढ़ाई${q.delivery.ojtMandatory > 0 ? `, और ${q.delivery.ojtMandatory} घंटे असली काम की जगह पर` : ''}।`,
          cite: "Training Delivery Hours — the JSON-in-a-cell column of the official NQR export",
        };
      }
      const cats = GIA_TRAINING_CATEGORIES.map((c) => `${c.label}: ${c.hours[0]}-${c.hours[1]} घंटे`).join('; ');
      return {
        text: `PM-AJAY में चार तरह की ट्रेनिंग होती है — ${cats}.`,
        cite: 'PM-AJAY Guidelines (Revised May 2023), Ch.3 ¶7A.a.ii',
      };
    }

    case 'money':
      return {
        text:
          'ट्रेनिंग के पैसे योजना देती है, आपसे फ़ीस नहीं ली जाती। अपना काम शुरू करने के लिए बैंक से क़र्ज़ लेने पर योजना ₹50,000 तक — या प्रोजेक्ट की आधी लागत, जो कम हो — जोड़ सकती है। और हर कोर्स के साथ पैसे-हिसाब की एक छोटी क्लास ज़रूरी है।',
        cite: 'PM-AJAY Guidelines (Revised May 2023), Ch.3 ¶2a.ii and ¶7A.a.iv',
        chips: ['₹50,000 तक', 'बैंक क़र्ज़ ज़रूरी', 'फ़ाइनेंशियल क्लास साथ में'],
      };

    case 'nearby': {
      const sourced = OPPORTUNITIES.filter((o) => o.source !== 'PLACEHOLDER_NEEDS_SOURCING');
      return {
        text:
          sourced.length > 0
            ? `अभी हमारे पास ${[...new Set(OPPORTUNITIES.map((o) => o.districtName))].join(' और ')} ज़िले की जानकारी है। पक्की जानकारी सिर्फ़ ${sourced.length} बातों की है; बाक़ी की पुष्टि होना बाक़ी है — मैं वो पक्का बताकर नहीं गुमराह करूँगी।`
            : 'आपके इलाक़े की पक्की जानकारी अभी हमारे पास नहीं है।',
        cite: 'decisions.md — two or three sourced districts, never a fabricated national map',
      };
    }

    case 'women':
      return {
        text:
          'योजना में हर स्किल प्रोग्राम में कम से कम 30% महिलाएँ होनी चाहिए, और राज्यों को मिलने वाले अनुदान का कम से कम 15% सिर्फ़ महिलाओं के कमाई वाले कामों पर ख़र्च होना है। अगर फ़ोन आपका नहीं है, तो गाँव की दीदी घर आकर भी ये बातचीत कर सकती हैं।',
        cite: 'PM-AJAY Guidelines (Revised May 2023), Ch.3 ¶4a and ¶4d',
        chips: ['30% महिलाएँ', '15% अलग रखा फंड', 'घर पर बातचीत'],
      };

    case 'pmdaksh':
      return {
        text:
          'PM-DAKSH इसी मंत्रालय की दूसरी योजना है, 18 से 45 साल के लिए, और उसमें SC उम्मीदवार को हर महीने ₹1,500 मिलते हैं। जहाँ वो बेहतर बैठती है, हम आपको वहीं भेजते हैं — PM-AJAY के नियम में ही लिखा है कि जो PM-DAKSH में आता है उसे यहाँ से नहीं देना।',
        cite: 'PM-AJAY Guidelines Ch.3 ¶7A.a.i; PM-DAKSH — DoSJE',
      };

    case 'privacy':
      return {
        text:
          'आपकी आवाज़ हम रखते ही नहीं — जैसे ही बात समझ में आ गई, रिकॉर्डिंग मिटा दी जाती है। जो शब्द निकले थे वो भी उसी वक़्त मिट जाते हैं जब आप "हाँ, सही है" कहती हैं। सिर्फ़ आपका पक्का किया हुआ जवाब बचता है। नंबर भी सीधे नहीं रखा जाता।',
        cite: 'DPDP Act 2023; decisions.md 2026-09-25 — audio discarded, transcript erased at CONFIRM',
        chips: ['आवाज़ नहीं रखी जाती', 'शब्द भी मिट जाते हैं', 'नंबर सीधा नहीं रखा जाता'],
      };

    case 'what_is_nsqf': {
      const noSchool = NSQF_LEVELS.filter((l) => l.entryRoutes?.some((r) => r.minGrade === 0)).map((l) => l.levelLabel);
      return {
        text: `NSQF सरकार की एक सीढ़ी है — नीचे से ऊपर, 13 पायदान। ${noSchool.join(' और ')} के लिए कोई स्कूली पढ़ाई नहीं चाहिए। ऊपर के पायदान पर जाने के लिए या पढ़ाई चाहिए, या उतने साल का काम का तजुर्बा।`,
        cite: 'NSQF Gazette Notification, NCVET, 6 June 2023, ¶5.1.1',
      };
    }

    default:
      return {
        text:
          'ये मैं पक्का नहीं बता सकती, और अंदाज़े से बताना ठीक नहीं होगा। आप पूछ सकती हैं: कौन सा कोर्स कर सकती हूँ, कितने दिन का है, पैसे कितने लगेंगे, स्कूल नहीं गई तो क्या, या मेरी आवाज़ का क्या होता है।',
        cite: 'No guessing: an unknown question gets an honest "I do not know"',
      };
  }
}

export default function Chat() {
  // Citations are audit provenance. Useful to an officer, noise to the person being helped.
  const showCite = isOfficer(useRole());
  const [msgs, setMsgs] = useState<Msg[]>([
    {
      who: 'them',
      text: 'पूछिए — कोई भी सवाल। बोलकर भी पूछ सकती हैं।',
      cite: 'Answers come from the NSQF table, the course list and the PM-AJAY guidelines on this device. Nothing is sent anywhere.',
      chips: ['स्कूल नहीं गई तो?', 'कितने दिन का कोर्स?', 'पैसे कितने लगेंगे?', 'मेरी आवाज़ का क्या होता है?'],
    },
  ]);
  const [text, setText] = useState('');
  const [listening, setListening] = useState(false);
  const locale: Locale = 'hi';
  const endRef = useRef<HTMLDivElement>(null);

  // The chat knows what the interview already established, so "am I eligible" is answerable
  // instead of being bounced back as a question.
  const profile = useMemoAsync<Profile | null>(
    async () => {
      const store = await openStore();
      const bens = await store.listBeneficiaries();
      if (bens.length === 0) return null;
      const answers = await store.answersFor(bens[0].id);
      if (answers.length === 0) return null;
      const map: Partial<Record<FieldNo, Answer>> = {};
      for (const a of answers) map[a.fieldNo] = a;
      const s = startSession({ channel: 'app', beneficiaryId: bens[0].id });
      return profileFrom({ ...s, answers: map });
    },
    [],
    null,
  );

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [msgs]);

  const ask = (q: string) => {
    if (!q.trim()) return;
    const reply = answer(classify(q), profile);
    setMsgs((m) => [...m, { who: 'us', text: q }, { ...reply, who: 'them' }]);
    setText('');
  };

  const askByVoice = async () => {
    if (!asrAvailable() || listening) return;
    setListening(true);
    try {
      const r = await recognise({ locale: ASR_LOCALE[locale].tag, maxAlternatives: 3 });
      if (r.transcripts[0]) ask(r.transcripts[0]);
    } catch {
      /* silence is not an error here either */
    } finally {
      setListening(false);
    }
  };

  const catalogueNote = useMemo(() => QUALIFICATIONS.filter((q) => q.qpCode === null).length, []);

  return (
    <AppShell title="पूछिए" subtitle="बिना इंटरनेट भी चलता है · कोई संदेश कहीं नहीं जाता">
      <div className="b-main" style={{ gridTemplateColumns: '1fr', maxWidth: '48rem' }}>
        <div style={{ display: 'grid', gap: 12 }}>
          {msgs.map((m, i) => (
            <div
              key={i}
              style={{
                justifySelf: m.who === 'us' ? 'end' : 'start',
                maxWidth: '92%',
                background: m.who === 'us' ? 'var(--color-plum-700)' : '#fff',
                color: m.who === 'us' ? '#fff' : 'var(--color-plum-900)',
                border: m.who === 'us' ? 'none' : '1px solid var(--color-beige-200)',
                borderRadius: 14,
                padding: '12px 14px',
                display: 'grid',
                gap: 8,
              }}
            >
              {m.who === 'them' ? <Speak locale={locale} text={m.text} /> : <span lang={locale}>{m.text}</span>}
              {m.chips && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {m.chips.map((c) => (
                    <button key={c} type="button" className="chip" data-tone="info" style={{ cursor: 'pointer' }} onClick={() => ask(c)}>
                      {c}
                    </button>
                  ))}
                </div>
              )}
              {/* The citation is the product. An answer about eligibility without its clause is a
                  rumour, and this is the jury's first question. */}
              {m.cite && showCite && <div className="mono muted" style={{ fontSize: 12 }}>↳ {m.cite}</div>}
            </div>
          ))}
          <div ref={endRef} />
        </div>
      </div>

      <div
        style={{
          position: 'sticky',
          bottom: 56,
          background: 'var(--color-beige-100)',
          borderTop: '1px solid var(--color-beige-200)',
          padding: 12,
          display: 'flex',
          gap: 8,
          alignItems: 'center',
        }}
      >
        <button type="button" className="b-btn" onClick={() => void askByVoice()} aria-label="Ask by voice" style={{ minWidth: 52, fontSize: 20 }}>
          {listening ? '●' : '🎤'}
        </button>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask(text);
          }}
          style={{ display: 'flex', gap: 8, flex: 1 }}
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            lang={locale}
            placeholder="सवाल लिखिए…"
            style={{ flex: 1, fontSize: 17, padding: '12px 14px', borderRadius: 10, border: '1px solid var(--color-beige-300)' }}
          />
          <button type="submit" className="b-btn">
            भेजें
          </button>
        </form>
      </div>

      {/* Catalogue provenance is ours to worry about, not hers. An officer reviewing the same
          screen still needs it, so it is gated rather than deleted. */}
      <div style={{ padding: '0 12px 12px', display: showCite ? undefined : 'none' }}>
        <StatusChip tone="near">{catalogueNote} course rows are prototype data pending the NQR import</StatusChip>
      </div>
    </AppShell>
  );
}
