// GENERATED FILE — DO NOT EDIT.
// Copied from packages/core/src/prompts.ts by scripts/vendor_core.py.
// Edit the original; this copy is re-synced on every deploy.

/**
 * The prompt registry — every fixed thing the assistant ever says, addressed by id.
 *
 * Three rules this file exists to enforce:
 *
 * 1. **One id, three renderings.** The IVR adapter resolves `q4.ask.v1` to an 8 kHz WAV on
 *    local disk, the WhatsApp adapter to a pre-uploaded Meta media id, the app to a file in the
 *    APK. Authored once, so fixing a cold-sounding prompt is one edit in all four channels at
 *    once (spec §1.1). A string that is not in this file cannot be spoken.
 * 2. **Fixed prompts are pre-rendered, never TTS'd at runtime.** That removes ~0.6 s per turn
 *    and ~29% of per-call cost, and it is what makes the offline kiosk possible at all
 *    (decisions.md 2026-09-25). Only the personalised recommendation tail is synthesised live.
 * 3. **R7 is a writing problem.** "Empathetic and conversational rather than administrative" is
 *    the one subjective requirement in the PS and the entire content of the demo video. So the
 *    register here is deliberately domestic — no "kindly state your educational qualification".
 *
 * `review` is load-bearing, not decoration. Hindi is drafted; the dialects are marked DRAFT and
 * MUST go through a native speaker before any recording. 03-verdict.md §5 ranks this as the
 * third-hardest thing in the project and the first to slip. An unreviewed dialect prompt is a
 * worse failure than an English one, because it sounds like we tried and did not care.
 */

import type { Locale } from './types.ts';

export type ReviewState = 'DRAFT' | 'NATIVE_REVIEWED';

export interface Prompt {
  id: string;
  text: Partial<Record<Locale, string>>;
  review: Partial<Record<Locale, ReviewState>>;
  /** Filled in by the render script once the WAV exists. */
  durationMs?: number;
}

const P = (id: string, text: Prompt['text'], review: Prompt['review'] = {}): Prompt => ({ id, text, review });

/** Everything drafted here is DRAFT in Hindi unless a native speaker has signed it off. */
const draft: Prompt['review'] = { hi: 'DRAFT', en: 'DRAFT', mai: 'DRAFT', bho: 'DRAFT', mag: 'DRAFT', raj: 'DRAFT', cgh: 'DRAFT', ta: 'DRAFT' };

export const PROMPTS: Prompt[] = [
  // ---------------------------------------------------------------- entry
  P('lang.select.v1', {
    hi: 'हिंदी के लिए एक दबाइए। मैथिली के लिए दो। भोजपुरी के लिए तीन। मगही के लिए चार। छत्तीसगढ़ी के लिए पाँच। तमिल के लिए छह।',
    en: 'Hindi 1. Maithili 2. Bhojpuri 3. Magahi 4. Chhattisgarhi 5. Tamil 6.',
  }, draft),

  // ---------------------------------------------------------------- Q0 — registration metadata
  P('q0.ask.v1', {
    hi: 'सबसे पहले — आप किस गाँव और ब्लॉक में रहती हैं?',
    bho: 'पहिले ई बताईं — आप कवन गाँव अउर ब्लॉक में रहेलीं?',
    mag: 'पहिले ई बताबऽ — तोहर गाँव आउ ब्लॉक कवन हे?',
    mai: 'सभसँ पहिने ई कहू — अहाँ कोन गाम आ प्रखंड मे रहै छी?',
    en: 'First — which village and block do you live in?',
  }, draft),
  P('q0.reask.v1', {
    hi: 'मुझे ठीक से सुनाई नहीं दिया। अपने गाँव का नाम धीरे से बताइए।',
    bho: 'हमरा ठीक से सुनाई ना पड़ल। आपन गाँव के नाम धीरे से बताईं।',
    en: 'I did not catch that. Please say your village name slowly.',
  }, draft),
  P('q0.confirm.v1', { hi: 'आपने कहा — {value}। सही है?', en: 'You said {value}. Is that right?' }, draft),

  // ---------------------------------------------------------------- consent
  // ≤15 s, names all four surfaces (spec §9 MINOR 1), states that audio is not kept.
  P('consent.ask.v1', {
    hi: 'नमस्ते। मैं PM-AJAY योजना की तरफ़ से बात कर रही हूँ। आपके काम और हुनर पर सात छोटे सवाल हैं — चार मिनट। जवाब सिर्फ़ आपके लिए सही ट्रेनिंग ढूँढने में लगेंगे, और ये बातचीत फ़ोन, व्हाट्सएप या गाँव की दीदी के टैबलेट पर आगे बढ़ सकती है। आपकी आवाज़ हम नहीं रखते। शुरू करें? हाँ के लिए एक दबाइए।',
    bho: 'नमस्ते। हम PM-AJAY योजना से बात करत बानी। आपके काम अउर हुनर पर सात छोट सवाल बा — चार मिनट। जवाब खाली आपके लिये ठीक ट्रेनिंग खोजे में लागी। आपके आवाज हम ना रखीं। शुरू करीं? हाँ खातिर एक दबाईं।',
    en: 'Hello. I am calling on behalf of the PM-AJAY scheme. Seven short questions about your work and skills — four minutes. Your answers are used only to find the right training for you, and this conversation can continue on the phone, on WhatsApp, or on a village worker\'s tablet. We do not keep your voice. Shall we start? Press 1 for yes.',
  }, draft),
  P('consent.declined.v1', {
    hi: 'कोई बात नहीं। जब मन हो, फिर से कॉल कर लीजिए। धन्यवाद।',
    bho: 'कोई बात ना। जब मन होखे, फेर से कॉल कर लीं। धन्यवाद।',
    en: 'That is completely fine. Call back whenever you like. Thank you.',
  }, draft),
  P('consent.newchannel.v1', {
    hi: 'ये वही बातचीत है जो आपने पहले शुरू की थी, उसी काम के लिए — सही ट्रेनिंग ढूँढना।',
    en: 'This is the same conversation you started earlier, for the same purpose — finding the right training.',
  }, draft),

  // ---------------------------------------------------------------- PIN / resume
  P('pin.set.v1', {
    hi: 'एक काम कीजिए — चार अंक का कोई नंबर चुनकर दबाइए। अगर बात बीच में कट जाए, यही नंबर डालकर वहीं से आगे बढ़ सकेंगी।',
    bho: 'एगो काम करीं — चार अंक के कोई नंबर दबाईं। अगर बात बीच में कट जाव, इहे नंबर डाल के ओहीजा से आगे बढ़ सकेब।',
    en: 'One thing — choose any four digits and enter them. If the call cuts, these four digits pick it up from where you left off.',
  }, draft),
  P('pin.ask.v1', {
    hi: 'पिछली बातचीत जारी रखनी है? अपने चार अंक दबाइए। नई शुरुआत के लिए एक दबाइए।',
    bho: 'पिछला बातचीत जारी रखे के बा? आपन चार अंक दबाईं। नया शुरुआत खातिर एक दबाईं।',
    en: 'Continuing an earlier conversation? Enter your four digits. To start fresh, press 1.',
  }, draft),
  P('pin.wrong.v1', {
    hi: 'ये नंबर मेल नहीं खाया। एक बार फिर दबाइए, या नई शुरुआत के लिए एक दबाइए।',
    en: 'Those digits did not match. Try once more, or press 1 to start fresh.',
  }, draft),
  P('resume.ack.v1', {
    hi: 'ठीक है, वहीं से आगे चलते हैं।',
    bho: 'ठीक बा, ओहीजा से आगे चलल जाव।',
    en: 'Good — we will carry on from there.',
  }, draft),

  // ---------------------------------------------------------------- Q1 education
  P('q1.ask.v1', {
    hi: 'पहला सवाल। आप स्कूल कहाँ तक गई हैं? अगर नहीं गईं तो भी कोई बात नहीं — बहुत सी ट्रेनिंग के लिए स्कूल ज़रूरी नहीं है।',
    bho: 'पहिला सवाल। आप स्कूल कहाँ तक गइल बानी? अगर ना गइल बानी तब्बो कोई बात ना — बहुत ट्रेनिंग खातिर स्कूल जरूरी ना ह।',
    mag: 'पहिला सवाल। तूँ स्कूल कहाँ तक गेलऽ? नऽ गेलऽ तब्बो कोई बात नऽ।',
    mai: 'पहिल प्रश्न। अहाँ स्कूल कतेक धरि गेलहुँ? नहि गेलहुँ तँ सेहो कोनो बात नहि।',
    en: 'First question. How far did you go in school? If you did not go, that is genuinely fine — many trainings need no schooling at all.',
  }, draft),
  P('q1.reask1.v1', {
    hi: 'कोई जल्दी नहीं। कौन सी क्लास तक पढ़ी हैं — जैसे पाँचवीं, आठवीं, दसवीं?',
    en: 'No hurry. Which class did you study up to — fifth, eighth, tenth?',
  }, draft),
  P('q1.reask2.v1', {
    hi: 'चलिए आसान कर दूँ। स्कूल नहीं गईं तो एक दबाइए। पाँचवीं तक दो। आठवीं तक तीन। दसवीं तक चार। बारहवीं तक पाँच। आईटीआई या डिप्लोमा छह।',
    en: 'Let me make it easier. Never went to school, press 1. Up to class 5, press 2. Class 8, press 3. Class 10, press 4. Class 12, press 5. ITI or diploma, press 6.',
  }, draft),
  P('q1.confirm.v1', { hi: 'आपने कहा — {value}। सही है?', en: 'You said {value}. Is that right?' }, draft),

  // ---------------------------------------------------------------- Q2 family occupation
  P('q2.ask.v1', {
    hi: 'आपके घर में परंपरा से कौन सा काम होता आया है? और आपने खुद वो काम कितने साल किया है?',
    bho: 'आपके घर में परंपरा से कवन काम होखत आइल बा? आउर आप खुद ऊ काम कतना साल कइले बानी?',
    mag: 'तोहर घर में परंपरा से कवन काम होबऽ हे? आउ तूँ खुद ऊ काम कतना साल कएलऽ?',
    mai: 'अहाँक घर मे परम्परा सँ कोन काज होइत आएल अछि? आ अहाँ स्वयं ओ काज कतेक बरख कएलहुँ?',
    en: 'What work has your family traditionally done? And how many years have you done it yourself?',
  }, draft),
  P('q2.reask1.v1', {
    hi: 'जैसे बुनाई, सिलाई, खेती, मिट्टी का काम, लोहे का काम, दूध का काम — आपके घर में क्या चलता आया है?',
    en: 'For example weaving, tailoring, farming, pottery, ironwork, dairy — what has your household done?',
  }, draft),
  P('q2.reask2.v1', {
    hi: 'सिर्फ़ काम का नाम बता दीजिए, एक शब्द में। साल बाद में पूछूँगी।',
    en: 'Just the name of the work, in one word. I will ask about the years after.',
  }, draft),
  P('q2.years.ask.v1', {
    hi: 'और ये काम आपने कितने साल किया है?',
    bho: 'आउर ई काम आप कतना साल कइले बानी?',
    en: 'And how many years have you done this work?',
  }, draft),
  P('q2.confirm.v1', {
    hi: 'तो {value} — {years} साल। सही है?',
    en: '{value}, for {years} years. Is that right?',
  }, draft),
  // The single most important sentence the system can say to a person with no schooling.
  P('q2.eligibility.good.v1', {
    hi: 'ये बहुत काम की बात है। {years} साल का तजुर्बा कई कोर्सों में स्कूल की डिग्री की जगह ले लेता है।',
    bho: 'ई बहुत काम के बात ह। {years} साल के तजुरबा कई कोर्स में स्कूल के डिग्री के जगह ले लेला।',
    en: 'That matters a great deal. {years} years of experience substitutes for a school certificate in several courses.',
  }, draft),

  // ---------------------------------------------------------------- Q3 current livelihood
  P('q3.ask.v1', {
    hi: 'आज-कल आप क्या करके कमा रही हैं? मज़दूरी, अपना काम, या फ़िलहाल कुछ नहीं?',
    bho: 'अभी आप का करके कमात बानी? मजूरी, आपन काम, कि फिलहाल कुछ ना?',
    en: 'What are you earning from these days? Wage work, your own work, or nothing at the moment?',
  }, draft),
  P('q3.reask1.v1', {
    hi: 'कोई भी काम — खेत की मज़दूरी, दुकान, घर से सिलाई, कुछ भी।',
    en: 'Any work at all — farm labour, a shop, stitching from home, anything.',
  }, draft),
  P('q3.reask2.v1', {
    hi: 'किसी और के यहाँ काम करती हैं तो एक दबाइए। अपना काम है तो दो। दिहाड़ी पर तीन। अभी कुछ नहीं तो चार।',
    en: 'Working for someone else, press 1. Your own work, press 2. Daily wage, press 3. Nothing right now, press 4.',
  }, draft),
  P('q3.confirm.v1', { hi: 'आपने कहा — {value}। सही है?', en: 'You said {value}. Is that right?' }, draft),

  // ---------------------------------------------------------------- Q4 skills and interests
  P('q4.ask.v1', {
    hi: 'अब बताइए — कौन सा काम सीखने का मन है? जो आपको अच्छा लगे, वही बताइए।',
    bho: 'अब बताईं — कवन काम सीखे के मन बा? जे आपके नीमन लागे, ऊहे बताईं।',
    mag: 'अब बताबऽ — कवन काम सीखे के मन हे?',
    mai: 'आब कहू — कोन काज सिखबाक मोन अछि?',
    en: 'Now tell me — what work would you like to learn? Whatever appeals to you.',
  }, draft),
  P('q4.reask1.v1', {
    hi: 'एक या दो काम बता दीजिए जो सीखना अच्छा लगेगा।',
    en: 'Name one or two kinds of work you would enjoy learning.',
  }, draft),
  P('q4.reask2.v1', {
    hi: 'जो काम घर में होता आया है, वही आगे बढ़ाना है — तो एक दबाइए। कुछ नया सीखना है तो दो।',
    en: 'To build on the work your family already does, press 1. To learn something new, press 2.',
  }, draft),
  P('q4.confirm.v1', { hi: 'आपने कहा — {value}। सही है?', en: 'You said {value}. Is that right?' }, draft),

  // ---------------------------------------------------------------- Q5 mobility / constraints
  P('q5.ask.v1', {
    hi: 'ट्रेनिंग के लिए घर से कितनी दूर तक जा सकती हैं? और कोई ऐसी बात जो ध्यान में रखनी चाहिए — घर की ज़िम्मेदारी, या सेहत?',
    bho: 'ट्रेनिंग खातिर घर से कतना दूर तक जा सकत बानी? आउर कोई अइसन बात जे ध्यान में राखल जाव — घर के जिम्मेदारी, कि सेहत?',
    en: 'How far from home can you travel for training? And anything I should keep in mind — responsibilities at home, or your health?',
  }, draft),
  P('q5.reask1.v1', {
    hi: 'सिर्फ़ इतना बता दीजिए — कितने किलोमीटर तक जाना ठीक रहेगा?',
    en: 'Just this — how many kilometres is comfortable?',
  }, draft),
  P('q5.reask2.v1', {
    hi: 'गाँव के अंदर ही हो तो एक दबाइए। पाँच किलोमीटर तक दो। दस किलोमीटर तक तीन। उससे दूर भी चलेगा तो चार।',
    en: 'Inside the village only, press 1. Up to 5 km, press 2. Up to 10 km, press 3. Further is fine, press 4.',
  }, draft),
  P('q5.confirm.v1', { hi: 'आपने कहा — {value}। सही है?', en: 'You said {value}. Is that right?' }, draft),
  // DPDP Rule 11 — fires on decisional capacity, never on disability. §9 MAJOR 4.
  P('guardian.check.v1', {
    hi: 'एक औपचारिक सवाल पूछना है। क्या अदालत, कोई सरकारी अधिकारी, या ज़िले की स्थानीय स्तर समिति ने आपके लिए कोई अभिभावक नियुक्त किया है? हाँ के लिए एक, नहीं के लिए दो।',
    en: 'One formal question. Has a court, a designated authority, or the district local level committee appointed a guardian for you? Press 1 for yes, 2 for no.',
  }, draft),
  P('guardian.defer.v1', {
    hi: 'ठीक है। ऐसी सूरत में ये बातचीत गाँव की दीदी के साथ पूरी करनी होगी, जहाँ वो काग़ज़ देख सकें। वो आपसे मिलेंगी।',
    en: 'Understood. In that case this needs to be completed with the village worker present, where the order can be seen. She will visit you.',
  }, draft),

  // ---------------------------------------------------------------- Q6 preference
  P('q6.ask.v1', {
    hi: 'आप अपना काम शुरू करना चाहेंगी, या किसी के यहाँ नौकरी? दोनों में से जो ठीक लगे।',
    bho: 'आप आपन काम शुरू करे चाहब, कि कहीं नौकरी? दूनो में से जे ठीक लागे।',
    en: 'Would you rather start your own work, or take a job with someone? Either answer is fine.',
  }, draft),
  P('q6.reask1.v1', {
    hi: 'अपना काम के लिए एक दबाइए। नौकरी के लिए दो। दोनों चलेगा तो तीन।',
    en: 'Own work, press 1. A job, press 2. Either is fine, press 3.',
  }, draft),
  P('q6.confirm.v1', { hi: 'आपने कहा — {value}। सही है?', en: 'You said {value}. Is that right?' }, draft),

  // ---------------------------------------------------------------- Q7 local economy
  P('q7.ask.v1', {
    hi: 'आख़िरी सवाल। आपके इलाक़े में किस चीज़ की मांग है, या क्या काम चल निकलता है?',
    bho: 'आखिरी सवाल। आपके इलाका में कवन चीज के मांग बा, कि कवन काम चल निकलेला?',
    en: 'Last question. In your area, what is in demand, or what kind of work actually does well?',
  }, draft),
  P('q7.reask1.v1', {
    hi: 'जैसे — यहाँ दूध बिकता है? कपड़े की मांग है? मज़दूरी मिल जाती है?',
    en: 'For instance — does milk sell here? Is there demand for cloth? Is labour available?',
  }, draft),
  P('q7.confirm.v1', { hi: 'आपने कहा — {value}। सही है?', en: 'You said {value}. Is that right?' }, draft),

  // ---------------------------------------------------------------- readback
  P('readback.intro.v1', {
    hi: 'अब मैं आपकी सारी बातें एक बार दोहराती हूँ। कुछ ग़लत हो तो बीच में टोक दीजिए।',
    bho: 'अब हम आपके सब बात एक बार दोहरावत बानी। कुछ गलत होखे त बीच में टोक दीं।',
    en: 'Let me read all of it back once. Stop me if anything is wrong.',
  }, draft),
  P('readback.confirm.v1', {
    hi: 'ये सब ठीक है? हाँ के लिए एक, बदलने के लिए दो।',
    en: 'Is all of that right? Press 1 for yes, 2 to change something.',
  }, draft),
  P('readback.which.v1', {
    hi: 'कौन सी बात बदलनी है? उसका नंबर दबाइए — एक से सात तक।',
    en: 'Which one should we change? Press its number, 1 to 7.',
  }, draft),

  // ---------------------------------------------------------------- recommendation
  P('recommend.intro.v1', {
    hi: 'सुनिए — आपके लिए तीन रास्ते निकले हैं।',
    bho: 'सुनीं — आपके लिये तीन रस्ता निकलल बा।',
    en: 'Here is what came out — three options for you.',
  }, draft),
  P('recommend.nearmiss.intro.v1', {
    hi: 'एक और रास्ता है, जिसके लिए थोड़ी कमी रह गई — और वो कमी पूरी हो सकती है।',
    en: 'There is one more, where a small gap remains — and that gap can be closed.',
  }, draft),
  P('recommend.none.v1', {
    hi: 'अभी पक्का जवाब देने के लिए मेरे पास पूरी जानकारी नहीं है। गाँव की दीदी आपसे मिलेंगी और बाक़ी बातें पूरी करेंगी।',
    en: 'I do not have enough to give you a firm answer yet. The village worker will visit and complete the rest.',
  }, draft),
  P('recommend.pmdaksh.v1', {
    hi: 'एक और बात — इसी तरह की ट्रेनिंग PM-DAKSH योजना में भी है, और उसमें हर महीने पंद्रह सौ रुपये मिलते हैं। वो आपके लिए ज़्यादा फ़ायदे का हो सकता है।',
    en: 'One more thing — similar training exists under the PM-DAKSH scheme, which pays fifteen hundred rupees a month. That may be better for you.',
  }, draft),
  P('recommend.financial.v1', {
    hi: 'हर ट्रेनिंग के साथ पैसे-हिसाब की एक छोटी क्लास भी होती है, ताकि बैंक से क़र्ज़ लेना आसान रहे।',
    en: 'Every training includes a short financial-literacy module, so that taking a bank loan is easier.',
  }, draft),
  P('recommend.assetgrant.v1', {
    hi: 'अगर आप अपना काम शुरू करती हैं और बैंक से क़र्ज़ लेती हैं, तो योजना से पचास हज़ार रुपये तक की मदद मिल सकती है।',
    en: 'If you start your own work and take a bank loan, the scheme can add up to fifty thousand rupees.',
  }, draft),
  P('nextstep.v1', {
    hi: 'सोमवार को यही करना है — {action}। मैं ये सब आपको मैसेज पर भी भेज दूँ?',
    en: 'On Monday, do this — {action}. Shall I send all of it to you as a message too?',
  }, draft),
  P('close.v1', {
    hi: 'बस इतना ही। ये जानकारी दोबारा सुनने के लिए कभी भी कॉल कर लीजिए और नौ दबाइए। धन्यवाद।',
    bho: 'बस इतने। ई जानकारी फेर से सुने खातिर कब्बो कॉल करीं आउर नौ दबाईं। धन्यवाद।',
    en: 'That is everything. Call back any time and press 9 to hear it again. Thank you.',
  }, draft),

  // ---------------------------------------------------------------- utility
  P('ack.hmm.v1', { hi: 'हम्म…', bho: 'हम्म…', en: 'Mm-hmm…' }, draft),
  P('ack.got.v1', { hi: 'ठीक है।', bho: 'ठीक बा।', en: 'Got it.' }, draft),
  P('timeout.v1', { hi: 'सुनाई दे रहा है? कोई जल्दी नहीं।', en: 'Are you still there? No hurry.' }, draft),
  P('defer.v1', {
    hi: 'कोई बात नहीं, इसे छोड़ देते हैं — बाद में पूछ लूँगी। आगे चलें।',
    bho: 'कोई बात ना, एकरा छोड़ दीं — बाद में पूछ लेब। आगे चलल जाव।',
    en: 'Never mind, we will leave that one and come back to it. Moving on.',
  }, draft),
  P('dropped.sms.v1', {
    hi: 'आपकी बातचीत सुरक्षित है। वहीं से जारी रखने के लिए फिर कॉल कीजिए।',
    en: 'Your conversation is saved. Call again to continue from where you stopped.',
  }, draft),
];

export const PROMPT_BY_ID = new Map(PROMPTS.map((p) => [p.id, p] as const));

export const CONSENT_SCRIPT_VERSION = 'consent.ask.v1';

/**
 * Resolve a prompt id to text in the requested locale, filling `{placeholders}`.
 * Falls back locale → hi → en, because a Bhojpuri speaker understands Hindi and silence helps
 * nobody. The fallback is logged by the caller so the gap shows up in the prompt-coverage report
 * instead of hiding.
 */
export function say(
  id: string,
  locale: Locale = 'hi',
  vars: Record<string, string | number> = {},
): { id: string; text: string; usedLocale: Locale; fellBack: boolean } {
  const p = PROMPT_BY_ID.get(id);
  if (!p) throw new Error(`prompt id not in registry: ${id}`);
  const order: Locale[] = [locale, 'hi', 'en'];
  let usedLocale = locale;
  let text: string | undefined;
  for (const l of order) {
    if (p.text[l]) {
      text = p.text[l];
      usedLocale = l;
      break;
    }
  }
  if (text === undefined) throw new Error(`prompt ${id} has no text in any locale`);
  const filled = text.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
  return { id, text: filled, usedLocale, fellBack: usedLocale !== locale };
}

/** Coverage report for the officer console's readiness panel: what still needs a native pass. */
export function promptCoverage(): { locale: Locale; authored: number; reviewed: number; total: number }[] {
  const locales: Locale[] = ['hi', 'mai', 'bho', 'mag', 'raj', 'cgh', 'ta', 'en'];
  return locales.map((locale) => ({
    locale,
    authored: PROMPTS.filter((p) => p.text[locale]).length,
    reviewed: PROMPTS.filter((p) => p.review[locale] === 'NATIVE_REVIEWED').length,
    total: PROMPTS.length,
  }));
}
