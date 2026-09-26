// GENERATED FILE — DO NOT EDIT.
// Copied from packages/core/src/lexicon.ts by scripts/vendor_core.py.
// Edit the original; this copy is re-synced on every deploy.

/**
 * The vernacular trade lexicon — "the unglamorous, highest-leverage asset in the build"
 * (02-tech-landscape.md §3.2). It is what absorbs a 26.8-to-59.9 WER instead of a model we
 * cannot train.
 *
 * Scope discipline: every entry maps to a domain in **Annexure I** of the PM-AJAY guidelines,
 * because Annexure I is the closed-ish world a GIA-funded recommendation may stay inside
 * (01-the-customer.md §2.3). A trade with no Annexure I home is a trade PM-AJAY cannot fund,
 * and recommending it is the CAG's 41% being manufactured politely.
 *
 * `nqrCodes` is empty on every row. It fills in from the official NQR import and never by hand
 * (decisions.md 2026-09-25: no invented QP codes, ever).
 *
 * `nco2015` is a SIGNAL ONLY. NCVET's own audit found 156 of 2,157 qualifications mis-mapped
 * and 256 unmappable, so roughly one in five of these hops is wrong. Never route on it alone.
 */

import type { LexiconEntry } from './types.ts';

const AG = 'Agriculture & Soil Conservation';
const HORT = 'Horticulture';
const IRR = 'Minor Irrigation';
const AH = 'Animal Husbandry';
const FISH = 'Fisheries';
const FP = 'Food Processing';
const FOR = 'Forestry, Ecology and Environment';
const HH = 'Handicrafts and Handlooms';
const ISB = 'Industry, Service and Business (ISB)';

export const LEXICON: LexiconEntry[] = [
  {
    conceptId: 'TRADE.TAILORING',
    canonical: { hi: 'सिलाई', en: 'tailoring', ta: 'தையல்' },
    surface: ['सिलाई', 'सिलाई-कढ़ाई', 'silai', 'silai kadhai', 'darzi', 'दर्जी', 'kapda silai', 'कपड़ा सिलाई', 'thaiyal', 'தையல்', 'sewing', 'stitching'],
    dialect: { bho: ['सिलाई के काम', 'silai ke kaam'], mag: ['सिवाई', 'sivai'], raj: ['सिवण', 'sivan'] },
    nco2015: ['7531.0100'],
    nqrCodes: [],
    annexureDomain: HH,
    family: 'textile',
    icon: '🧵',
  },
  {
    conceptId: 'TRADE.HANDLOOM_WEAVING',
    canonical: { hi: 'बुनाई', en: 'handloom weaving', ta: 'நெசவு' },
    surface: ['बुनाई', 'बुनकर', 'bunai', 'bunkar', 'julaha', 'जुलाहा', 'karghа', 'करघा', 'handloom', 'nesavu', 'நெசவு', 'taana baana', 'ताना बाना'],
    dialect: { bho: ['बुनाई के काम'], mag: ['बुनाइ'], cgh: ['बुनई'] },
    nco2015: ['7318.0200'],
    nqrCodes: [],
    annexureDomain: HH,
    family: 'textile',
    icon: '🧶',
  },
  {
    conceptId: 'TRADE.EMBROIDERY',
    canonical: { hi: 'कढ़ाई', en: 'embroidery' },
    surface: ['कढ़ाई', 'kadhai', 'kashida', 'कशीदा', 'chikankari', 'चिकनकारी', 'zari', 'ज़री', 'zardozi', 'embroidery', 'booti'],
    dialect: { bho: ['कढ़ाइ'], raj: ['भरत काम'] },
    nqrCodes: [],
    annexureDomain: HH,
    family: 'textile',
    icon: '🪡',
  },
  {
    conceptId: 'TRADE.CARPET_WEAVING',
    canonical: { hi: 'कालीन बुनाई', en: 'carpet weaving' },
    surface: ['कालीन', 'kaleen', 'dari', 'दरी', 'galeecha', 'गलीचा', 'carpet', 'durrie'],
    nqrCodes: [],
    annexureDomain: HH,
    family: 'textile',
    icon: '🪟',
  },
  {
    conceptId: 'TRADE.DAIRY',
    canonical: { hi: 'डेरी', en: 'dairy' },
    surface: ['डेरी', 'डेयरी', 'dairy', 'dudh', 'दूध', 'doodh ka kaam', 'gaay bhains', 'गाय भैंस', 'pashupalan', 'पशुपालन', 'milk'],
    dialect: { bho: ['दूध के काम', 'गाई भँइस'], mag: ['दूध बेचे'], cgh: ['दूध के काम'] },
    nco2015: ['6121.0100'],
    nqrCodes: [],
    annexureDomain: AH,
    family: 'livestock',
    icon: '🐄',
  },
  {
    conceptId: 'TRADE.GOAT_REARING',
    canonical: { hi: 'बकरी पालन', en: 'goat rearing' },
    surface: ['बकरी', 'बकरी पालन', 'bakri', 'bakri palan', 'bakra', 'बकरा', 'goat', 'sheep', 'bhed', 'भेड़'],
    dialect: { bho: ['बकरी पालल'], raj: ['बकरा बकरी'] },
    nqrCodes: [],
    annexureDomain: AH,
    family: 'livestock',
    icon: '🐐',
  },
  {
    conceptId: 'TRADE.POULTRY',
    canonical: { hi: 'मुर्गी पालन', en: 'poultry' },
    surface: ['मुर्गी', 'मुर्गी पालन', 'murgi', 'murgi palan', 'poultry', 'anda', 'अंडा', 'chicken farm', 'kukkut', 'कुक्कुट'],
    dialect: { bho: ['मुरगी पालल'], mag: ['मुरगी'], cgh: ['मुरगी पालन'] },
    nqrCodes: [],
    annexureDomain: AH,
    family: 'livestock',
    icon: '🐔',
  },
  {
    conceptId: 'TRADE.PIGGERY',
    canonical: { hi: 'सूकर पालन', en: 'piggery' },
    surface: ['सूकर', 'सुअर', 'suar', 'sukar palan', 'piggery', 'pig'],
    nqrCodes: [],
    annexureDomain: AH,
    family: 'livestock',
    icon: '🐖',
  },
  {
    conceptId: 'TRADE.BEEKEEPING',
    canonical: { hi: 'मधुमक्खी पालन', en: 'beekeeping' },
    surface: ['मधुमक्खी', 'मधुमक्खी पालन', 'madhumakkhi', 'shahad', 'शहद', 'honey', 'beekeeping', 'madhu'],
    dialect: { bho: ['महुआ मक्खी'], cgh: ['मधु पालन'] },
    nqrCodes: [],
    annexureDomain: AG,
    family: 'agri_allied',
    icon: '🐝',
  },
  {
    conceptId: 'TRADE.SERICULTURE',
    canonical: { hi: 'रेशम कीट पालन', en: 'sericulture' },
    surface: ['रेशम', 'resham', 'sericulture', 'silkworm', 'kosa', 'कोसा', 'tasar', 'तसर', 'mulberry'],
    dialect: { cgh: ['कोसा के काम'] },
    nqrCodes: [],
    annexureDomain: AG,
    family: 'agri_allied',
    icon: '🐛',
  },
  {
    conceptId: 'TRADE.FISHERIES',
    canonical: { hi: 'मछली पालन', en: 'fisheries' },
    surface: ['मछली', 'मछली पालन', 'machhli', 'machli palan', 'fish', 'fisheries', 'matsya', 'मत्स्य', 'talab', 'तालाब'],
    dialect: { bho: ['मछरी'], mag: ['मछरी पालन'], cgh: ['मछरी'] },
    nqrCodes: [],
    annexureDomain: FISH,
    family: 'agri_allied',
    icon: '🐟',
  },
  {
    conceptId: 'TRADE.FARMING',
    canonical: { hi: 'खेती', en: 'farming' },
    surface: ['खेती', 'खेती बाड़ी', 'kheti', 'kheti baari', 'kisani', 'किसानी', 'farming', 'krishi', 'कृषि', 'fasal', 'फसल', 'majduri kheti'],
    dialect: { bho: ['खेती के काम', 'खेतीबारी'], mag: ['खेती'], raj: ['खेती'], cgh: ['खेती किसानी'] },
    nco2015: ['6111.0000'],
    nqrCodes: [],
    annexureDomain: AG,
    family: 'agri_core',
    icon: '🌾',
  },
  {
    conceptId: 'TRADE.HORTICULTURE_NURSERY',
    canonical: { hi: 'बागवानी', en: 'horticulture / nursery' },
    surface: ['बागवानी', 'नर्सरी', 'bagwani', 'nursery', 'horticulture', 'paudh', 'पौध', 'sabzi', 'सब्ज़ी', 'phal', 'फल', 'mali', 'माली'],
    dialect: { bho: ['बगइचा के काम'], cgh: ['बारी के काम'] },
    nqrCodes: [],
    annexureDomain: HORT,
    family: 'agri_core',
    icon: '🌱',
  },
  {
    conceptId: 'TRADE.MUSHROOM',
    canonical: { hi: 'मशरूम उत्पादन', en: 'mushroom growing' },
    surface: ['मशरूम', 'mushroom', 'khumbi', 'खुम्बी', 'kukurmutta', 'कुकुरमुत्ता'],
    nqrCodes: [],
    annexureDomain: HORT,
    family: 'agri_allied',
    icon: '🍄',
  },
  {
    conceptId: 'TRADE.VERMICOMPOST',
    canonical: { hi: 'केंचुआ खाद', en: 'vermicompost' },
    surface: ['केंचुआ खाद', 'vermicompost', 'kenchua', 'jaivik khad', 'जैविक खाद', 'compost', 'gobar khad', 'गोबर खाद'],
    nqrCodes: [],
    annexureDomain: AG,
    family: 'agri_allied',
    icon: '🪱',
  },
  {
    conceptId: 'TRADE.IRRIGATION_PUMP',
    canonical: { hi: 'सिंचाई पंप', en: 'irrigation pump operation' },
    surface: ['सिंचाई', 'पंप', 'sinchai', 'pump', 'tubewell', 'ट्यूबवेल', 'boring', 'बोरिंग', 'drip', 'sprinkler', 'pump operator'],
    nqrCodes: [],
    annexureDomain: IRR,
    family: 'agri_allied',
    icon: '💧',
  },
  {
    conceptId: 'TRADE.TRACTOR_OPERATOR',
    canonical: { hi: 'ट्रैक्टर चालक', en: 'tractor operator' },
    surface: ['ट्रैक्टर', 'tractor', 'tractor chalak', 'thresher', 'थ्रेशर', 'harvester', 'farm machinery'],
    nqrCodes: [],
    annexureDomain: AG,
    family: 'agri_allied',
    icon: '🚜',
  },
  {
    conceptId: 'TRADE.FOOD_PROCESSING',
    canonical: { hi: 'खाद्य प्रसंस्करण', en: 'food processing' },
    surface: ['अचार', 'achar', 'papad', 'पापड़', 'murabba', 'मुरब्बा', 'food processing', 'khadya', 'masala', 'मसाला', 'badi', 'बड़ी', 'jam'],
    dialect: { bho: ['अचार पापड़'], raj: ['पापड़ बड़ी'] },
    nqrCodes: [],
    annexureDomain: FP,
    family: 'food',
    icon: '🫙',
  },
  {
    conceptId: 'TRADE.BAKERY',
    canonical: { hi: 'बेकरी', en: 'bakery' },
    surface: ['बेकरी', 'bakery', 'biscuit', 'बिस्कुट', 'double roti', 'डबल रोटी', 'bread', 'cake'],
    nqrCodes: [],
    annexureDomain: FP,
    family: 'food',
    icon: '🍞',
  },
  {
    conceptId: 'TRADE.FOOD_VENDING',
    canonical: { hi: 'खाने की दुकान', en: 'food stall / tea shop' },
    surface: ['चाय की दुकान', 'chai', 'thela', 'ठेला', 'dhaba', 'ढाबा', 'khane ki dukaan', 'samosa', 'nashta', 'नाश्ता', 'food stall', 'canteen'],
    dialect: { bho: ['चाय के दुकान'], mag: ['चाह दुकान'] },
    nqrCodes: [],
    annexureDomain: ISB,
    family: 'food',
    icon: '🫖',
  },
  {
    conceptId: 'TRADE.MASONRY',
    canonical: { hi: 'राजगीरी', en: 'masonry' },
    surface: ['राजगीरी', 'मिस्त्री', 'mistri', 'rajgiri', 'rajmistri', 'raj mistri', 'masonry', 'mason', 'chinai', 'चिनाई', 'bricklayer', 'beldari'],
    dialect: { bho: ['मिस्तिरी', 'राजमिस्तिरी'], mag: ['मिस्तरी'], cgh: ['राजमिस्त्री'] },
    nco2015: ['7112.0100'],
    nqrCodes: [],
    annexureDomain: ISB,
    family: 'construction',
    icon: '🧱',
  },
  {
    conceptId: 'TRADE.CARPENTRY',
    canonical: { hi: 'बढ़ईगीरी', en: 'carpentry' },
    surface: ['बढ़ई', 'बढ़ईगीरी', 'badhai', 'barhai', 'carpenter', 'carpentry', 'lakdi ka kaam', 'लकड़ी का काम', 'furniture'],
    dialect: { bho: ['बढ़ई के काम'], mag: ['बढ़ई'], raj: ['सुथार', 'suthar'] },
    nqrCodes: [],
    annexureDomain: ISB,
    family: 'construction',
    icon: '🪚',
  },
  {
    conceptId: 'TRADE.PLUMBING',
    canonical: { hi: 'नल-मिस्त्री', en: 'plumbing' },
    surface: ['प्लंबर', 'plumber', 'plumbing', 'nal mistri', 'नल मिस्त्री', 'pipe fitting', 'पाइप', 'sanitary'],
    nqrCodes: [],
    annexureDomain: ISB,
    family: 'construction',
    icon: '🔧',
  },
  {
    conceptId: 'TRADE.ELECTRICIAN',
    canonical: { hi: 'बिजली मिस्त्री', en: 'electrician' },
    surface: ['बिजली', 'बिजली मिस्त्री', 'bijli', 'electrician', 'wiring', 'वायरिंग', 'bijli ka kaam', 'lineman', 'electric'],
    dialect: { bho: ['बिजली के काम'], cgh: ['बिजली मिस्त्री'] },
    nqrCodes: [],
    annexureDomain: ISB,
    family: 'construction',
    icon: '💡',
  },
  {
    conceptId: 'TRADE.WELDING',
    canonical: { hi: 'वेल्डिंग', en: 'welding' },
    surface: ['वेल्डिंग', 'welding', 'welder', 'lohar', 'लोहार', 'grill', 'ग्रिल', 'gas cutting', 'fabrication'],
    dialect: { raj: ['लुहार'] },
    nqrCodes: [],
    annexureDomain: ISB,
    family: 'metal',
    icon: '⚒️',
  },
  {
    conceptId: 'TRADE.PAINTING',
    canonical: { hi: 'पुताई', en: 'painting and decorating' },
    surface: ['पुताई', 'painter', 'putai', 'rang rogan', 'रंग रोगन', 'painting', 'whitewash', 'चूना'],
    nqrCodes: [],
    annexureDomain: ISB,
    family: 'construction',
    icon: '🖌️',
  },
  {
    conceptId: 'TRADE.AUTO_REPAIR',
    canonical: { hi: 'गाड़ी मरम्मत', en: 'automobile repair' },
    surface: ['गाड़ी मरम्मत', 'motor mechanic', 'मोटर मैकेनिक', 'garage', 'गैराज', 'gaadi banana', 'auto repair', 'denting', 'painting gaadi'],
    nqrCodes: [],
    annexureDomain: ISB,
    family: 'metal',
    icon: '🔩',
  },
  {
    conceptId: 'TRADE.TWO_WHEELER_MECHANIC',
    canonical: { hi: 'दोपहिया मैकेनिक', en: 'two-wheeler mechanic' },
    surface: ['बाइक', 'motorcycle', 'bike mechanic', 'दोपहिया', 'scooter', 'स्कूटर', 'puncture', 'पंचर', 'cycle repair', 'साइकिल'],
    dialect: { bho: ['बाइक बनावे'], mag: ['गाड़ी बनावे'] },
    nqrCodes: [],
    annexureDomain: ISB,
    family: 'metal',
    icon: '🏍️',
  },
  {
    conceptId: 'TRADE.MOBILE_REPAIR',
    canonical: { hi: 'मोबाइल मरम्मत', en: 'mobile phone repair' },
    surface: ['मोबाइल', 'mobile repair', 'phone banana', 'फोन', 'mobile mistri', 'electronics repair'],
    nqrCodes: [],
    annexureDomain: ISB,
    family: 'electronics',
    icon: '📱',
  },
  {
    conceptId: 'TRADE.SOLAR_TECHNICIAN',
    canonical: { hi: 'सोलर तकनीशियन', en: 'solar technician' },
    surface: ['सोलर', 'solar', 'solar panel', 'सोलर पैनल', 'solar pump', 'saur urja', 'सौर ऊर्जा'],
    nqrCodes: [],
    annexureDomain: ISB,
    family: 'electronics',
    icon: '☀️',
  },
  {
    conceptId: 'TRADE.COMPUTER_DATA_ENTRY',
    canonical: { hi: 'कंप्यूटर का काम', en: 'computer / data entry' },
    surface: ['कंप्यूटर', 'computer', 'data entry', 'डाटा एंट्री', 'typing', 'टाइपिंग', 'CSC', 'jan seva kendra', 'जन सेवा केंद्र', 'online form'],
    nco2015: ['4132.0100'],
    nqrCodes: [],
    annexureDomain: ISB,
    family: 'services',
    icon: '💻',
  },
  {
    conceptId: 'TRADE.RETAIL_SHOP',
    canonical: { hi: 'दुकान', en: 'retail shop' },
    surface: ['दुकान', 'dukaan', 'kirana', 'किराना', 'shop', 'retail', 'general store', 'parchun', 'परचून'],
    dialect: { bho: ['दुकनदारी'], mag: ['दुकान'], cgh: ['दुकान'] },
    nqrCodes: [],
    annexureDomain: ISB,
    family: 'services',
    icon: '🏪',
  },
  {
    conceptId: 'TRADE.BEAUTY_PARLOUR',
    canonical: { hi: 'ब्यूटी पार्लर', en: 'beauty parlour' },
    surface: ['ब्यूटी पार्लर', 'beauty parlour', 'parlour', 'singaar', 'श्रृंगार', 'beautician', 'facial', 'hair'],
    dialect: { bho: ['पारलर के काम'] },
    nqrCodes: [],
    annexureDomain: ISB,
    family: 'services',
    icon: '💅',
  },
  {
    conceptId: 'TRADE.MEHNDI',
    canonical: { hi: 'मेहंदी', en: 'mehndi art' },
    surface: ['मेहंदी', 'mehndi', 'mehandi', 'henna', 'heena'],
    nqrCodes: [],
    annexureDomain: HH,
    family: 'services',
    icon: '🤲',
  },
  {
    conceptId: 'TRADE.BARBER',
    canonical: { hi: 'नाई', en: 'barber / salon' },
    surface: ['नाई', 'nai', 'hajjam', 'हज्जाम', 'barber', 'salon', 'baal katna', 'बाल काटना'],
    dialect: { bho: ['हजाम'], mag: ['नउआ'] },
    nqrCodes: [],
    annexureDomain: ISB,
    family: 'services',
    icon: '💈',
  },
  {
    conceptId: 'TRADE.LEATHER_FOOTWEAR',
    canonical: { hi: 'चमड़े का काम', en: 'leather and footwear' },
    surface: ['चमड़ा', 'chamda', 'juta', 'जूता', 'mochi', 'मोची', 'leather', 'footwear', 'chappal', 'चप्पल', 'bag making'],
    dialect: { bho: ['चमड़ा के काम'], mag: ['मोचीगिरी'] },
    nqrCodes: [],
    annexureDomain: ISB,
    family: 'leather',
    icon: '👞',
  },
  {
    conceptId: 'TRADE.POTTERY',
    canonical: { hi: 'मिट्टी के बर्तन', en: 'pottery' },
    surface: ['कुम्हार', 'kumhar', 'mitti ke bartan', 'मिट्टी', 'pottery', 'chaak', 'चाक', 'terracotta', 'diya', 'दीया'],
    dialect: { bho: ['कोहार'], cgh: ['कुम्हार'] },
    nqrCodes: [],
    annexureDomain: HH,
    family: 'craft',
    icon: '🏺',
  },
  {
    conceptId: 'TRADE.BAMBOO_CANE',
    canonical: { hi: 'बांस का काम', en: 'bamboo and cane craft' },
    surface: ['बांस', 'baans', 'bamboo', 'cane', 'tokri', 'टोकरी', 'basket', 'jhadu', 'झाड़ू', 'chatai', 'चटाई'],
    dialect: { cgh: ['बांस के काम'], bho: ['बांस के सामान'] },
    nqrCodes: [],
    annexureDomain: HH,
    family: 'craft',
    icon: '🎍',
  },
  {
    conceptId: 'TRADE.HEALTHCARE_GDA',
    canonical: { hi: 'मरीज़ की देखभाल', en: 'general duty assistant' },
    surface: ['अस्पताल', 'aspatal', 'nursing', 'नर्सिंग', 'GDA', 'patient care', 'marij ki dekhbhal', 'ward boy', 'aaya', 'आया'],
    nqrCodes: [],
    annexureDomain: ISB,
    family: 'care',
    icon: '🩺',
  },
  {
    conceptId: 'TRADE.CHILDCARE',
    canonical: { hi: 'बच्चों की देखभाल', en: 'childcare / pre-school' },
    surface: ['आंगनवाड़ी', 'anganwadi', 'aanganbadi', 'creche', 'bachchon ki dekhbhal', 'pre school', 'बालवाड़ी'],
    nqrCodes: [],
    annexureDomain: ISB,
    family: 'care',
    icon: '🧒',
  },
  {
    conceptId: 'TRADE.HOUSEKEEPING',
    canonical: { hi: 'सफ़ाई और रखरखाव', en: 'housekeeping' },
    surface: ['housekeeping', 'safai', 'सफ़ाई', 'hotel cleaning', 'gharelu kaam', 'घरेलू काम', 'domestic work'],
    nqrCodes: [],
    annexureDomain: ISB,
    family: 'services',
    icon: '🧹',
  },
  {
    conceptId: 'TRADE.WASTE_MANAGEMENT',
    canonical: { hi: 'कचरा प्रबंधन', en: 'waste management' },
    surface: ['कचरा', 'kachra', 'waste', 'kabad', 'कबाड़', 'recycling', 'plastic binai', 'segregation', 'swachh'],
    nqrCodes: [],
    annexureDomain: FOR,
    family: 'environment',
    icon: '♻️',
  },
  {
    conceptId: 'TRADE.DRIVING',
    canonical: { hi: 'गाड़ी चलाना', en: 'commercial driving' },
    surface: ['ड्राइवर', 'driver', 'driving', 'gaadi chalana', 'गाड़ी चलाना', 'auto', 'ऑटो', 'e-rickshaw', 'tempo', 'टेम्पो'],
    dialect: { bho: ['गाड़ी चलावे'], mag: ['ड्राइवरी'] },
    nqrCodes: [],
    annexureDomain: ISB,
    family: 'transport',
    icon: '🚗',
  },
  {
    conceptId: 'TRADE.SECURITY_GUARD',
    canonical: { hi: 'सुरक्षा गार्ड', en: 'security guard' },
    surface: ['गार्ड', 'guard', 'security', 'chowkidar', 'चौकीदार', 'suraksha'],
    nqrCodes: [],
    annexureDomain: ISB,
    family: 'services',
    icon: '🛡️',
  },
  {
    conceptId: 'TRADE.CONSTRUCTION_LABOUR',
    canonical: { hi: 'निर्माण मज़दूरी', en: 'construction labour' },
    surface: ['मज़दूरी', 'majduri', 'mazdoori', 'labour', 'dihadi', 'दिहाड़ी', 'thekedari', 'construction', 'beldar', 'बेलदार'],
    dialect: { bho: ['मजूरी'], mag: ['मजदूरी'], cgh: ['मजूरी'], raj: ['मजूरी'] },
    nqrCodes: [],
    annexureDomain: ISB,
    family: 'construction',
    icon: '👷',
  },
];

export const CONCEPT_BY_ID = new Map(LEXICON.map((e) => [e.conceptId, e] as const));

export function conceptLabel(conceptId: string, locale = 'hi'): string {
  const e = CONCEPT_BY_ID.get(conceptId);
  if (!e) return conceptId;
  return e.canonical[locale] ?? e.canonical.hi ?? e.canonical.en ?? conceptId;
}

/** Concepts grouped by Annexure I domain — what the officer console aggregates by. */
export function conceptsByDomain(): Map<string, LexiconEntry[]> {
  const out = new Map<string, LexiconEntry[]>();
  for (const e of LEXICON) {
    const k = e.annexureDomain ?? 'Unclassified';
    const list = out.get(k) ?? [];
    list.push(e);
    out.set(k, list);
  }
  return out;
}
