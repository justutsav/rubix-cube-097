/**
 * Prototype qualification catalogue.
 *
 * READ THIS BEFORE USING ANY ROW HERE ON A SLIDE.
 *
 * Every row carries `qpCode: null` and `source: 'PROTOTYPE_PENDING_NQR_IMPORT'`. That is not an
 * oversight — it is decisions.md, 2026-09-25: *"QP codes, NOS codes, NSQF levels, awarding
 * bodies, durations and eligibility come from the official NQR export. Fields the source does
 * not provide are NULL, not guessed. Prototype data is never labelled official."*
 *
 * The official register has 2,814 rows and is two `curl`s away — reproduced end to end in
 * `research/03-nqr-import.md`, sha256 `348bed87…`. `scripts/import_nqr.py` fetches it and
 * replaces this file's rows with real ones, at which point `qpCode` fills in and `source`
 * becomes `NQR_OFFICIAL`. Until that has run, the UI shows an amber "prototype catalogue" band
 * on every recommendation and `RecommendationResult.containsPrototypeData` is true.
 *
 * Why not just invent plausible codes to make the demo tidy? Because a wrong QP code sends a
 * real person to a centre that will not admit them. It is a defect, not a rounding error.
 *
 * What IS real here, and sourced:
 *   · the NSQF levels and the notional-hour bands come from the gazette table in nsqf.ts
 *   · the theory/practical/OJT split shape comes from the official export's own
 *     `Training Delivery Hours` JSON-in-a-cell column
 *   · the trades are all drawn from Annexure I of the PM-AJAY guidelines, which is the closed
 *     list of what GIA may actually fund
 *   · `selfEmployable` is deliberately sparse: only 25 of the 1,199 valid ≤L4 rows in the real
 *     register are entrepreneurship-shaped, and pretending otherwise would hide the single
 *     biggest mismatch between the PS's Q6 and the register (research/03-nqr-import.md §gaps)
 */

import type { Qualification } from '../types.js';

const D = '2026-09-26';

const q = (
  localId: string,
  title: string,
  sector: string,
  level: number,
  hours: number,
  concepts: string[],
  selfEmployable: boolean,
  physicalDemand: Qualification['physicalDemand'],
  delivery: [number, number, number, number],
): Qualification => ({
  localId,
  qpCode: null,
  title,
  sector,
  levelLabel: `Level ${level}`,
  level,
  notionalHours: hours,
  delivery: { theory: delivery[0], practical: delivery[1], employability: delivery[2], ojtMandatory: delivery[3] },
  validTill: null,
  awardingBody: null,
  concepts,
  selfEmployable,
  physicalDemand,
  source: 'PROTOTYPE_PENDING_NQR_IMPORT',
  sourceDate: D,
});

export const NQR_SNAPSHOT_SHA: string | null = null; // set by import_nqr.py

export const QUALIFICATIONS: Qualification[] = [
  // ---- Level 1-2: no formal education required. The door nobody read out loud.
  q('proto-tailor-helper', 'Tailoring Helper', 'Apparel, Made-ups & Home Furnishing', 2, 240, ['TRADE.TAILORING'], false, 'low', [60, 120, 40, 20]),
  q('proto-handloom-helper', 'Handloom Weaving Assistant', 'Textiles & Handloom', 2, 240, ['TRADE.HANDLOOM_WEAVING'], false, 'moderate', [50, 130, 40, 20]),
  q('proto-dairy-helper', 'Dairy Farm Worker', 'Agriculture', 2, 210, ['TRADE.DAIRY'], true, 'moderate', [50, 110, 30, 20]),
  q('proto-goat-rearer', 'Small Ruminant (Goat) Rearer', 'Agriculture', 2, 210, ['TRADE.GOAT_REARING'], true, 'moderate', [50, 110, 30, 20]),
  q('proto-poultry-worker', 'Backyard Poultry Worker', 'Agriculture', 2, 210, ['TRADE.POULTRY'], true, 'low', [50, 110, 30, 20]),
  q('proto-mushroom-grower', 'Mushroom Grower (Small Unit)', 'Agriculture', 2, 240, ['TRADE.MUSHROOM'], true, 'low', [60, 120, 40, 20]),
  q('proto-vermicompost', 'Vermicompost Producer', 'Agriculture', 2, 210, ['TRADE.VERMICOMPOST'], true, 'moderate', [50, 110, 30, 20]),
  q('proto-nursery-worker', 'Nursery Worker', 'Agriculture', 2, 210, ['TRADE.HORTICULTURE_NURSERY'], false, 'moderate', [50, 110, 30, 20]),
  q('proto-bamboo-craft', 'Bamboo and Cane Craft Artisan', 'Handicrafts & Carpets', 2, 240, ['TRADE.BAMBOO_CANE'], true, 'low', [50, 140, 30, 20]),
  q('proto-pottery', 'Terracotta and Pottery Artisan', 'Handicrafts & Carpets', 2, 240, ['TRADE.POTTERY'], true, 'moderate', [50, 140, 30, 20]),
  q('proto-mehndi', 'Mehndi Artist', 'Beauty & Wellness', 2, 210, ['TRADE.MEHNDI'], true, 'low', [40, 130, 30, 10]),
  q('proto-housekeeping-attendant', 'Housekeeping Attendant', 'Tourism & Hospitality', 2, 240, ['TRADE.HOUSEKEEPING'], false, 'moderate', [50, 130, 40, 20]),
  q('proto-construction-helper', 'Construction Helper', 'Construction', 1, 180, ['TRADE.CONSTRUCTION_LABOUR'], false, 'high', [30, 110, 20, 20]),
  q('proto-waste-sorter', 'Waste Segregation Worker', 'Green Jobs', 2, 210, ['TRADE.WASTE_MANAGEMENT'], false, 'moderate', [50, 110, 30, 20]),

  // ---- Level 2.5: 9th pass, OR 5th pass + 4 years, OR read/write + 5 years. RPL territory.
  q('proto-self-tailor', 'Self Employed Tailor', 'Apparel, Made-ups & Home Furnishing', 2.5, 280, ['TRADE.TAILORING'], true, 'low', [70, 140, 50, 20]),
  q('proto-handloom-weaver', 'Handloom Weaver', 'Textiles & Handloom', 2.5, 300, ['TRADE.HANDLOOM_WEAVING'], true, 'moderate', [70, 160, 50, 20]),
  q('proto-embroiderer', 'Hand Embroiderer', 'Handicrafts & Carpets', 2.5, 280, ['TRADE.EMBROIDERY'], true, 'low', [60, 160, 40, 20]),
  q('proto-carpet-weaver', 'Carpet Weaver', 'Handicrafts & Carpets', 2.5, 300, ['TRADE.CARPET_WEAVING'], false, 'moderate', [60, 180, 40, 20]),
  q('proto-beekeeper', 'Beekeeper', 'Agriculture', 2.5, 240, ['TRADE.BEEKEEPING'], true, 'moderate', [70, 120, 30, 20]),
  q('proto-sericulture', 'Silkworm Rearer', 'Agriculture', 2.5, 280, ['TRADE.SERICULTURE'], true, 'moderate', [70, 150, 40, 20]),
  q('proto-fish-farmer', 'Inland Fish Farmer', 'Agriculture', 2.5, 280, ['TRADE.FISHERIES'], true, 'moderate', [70, 150, 40, 20]),
  q('proto-pickle-maker', 'Pickle and Preserve Maker (Micro Unit)', 'Food Processing', 2.5, 260, ['TRADE.FOOD_PROCESSING'], true, 'low', [70, 130, 40, 20]),
  q('proto-leather-footwear', 'Footwear Maker (Hand Crafted)', 'Leather', 2.5, 280, ['TRADE.LEATHER_FOOTWEAR'], true, 'moderate', [60, 160, 40, 20]),
  q('proto-barber', 'Barber / Salon Assistant', 'Beauty & Wellness', 2.5, 260, ['TRADE.BARBER'], true, 'low', [60, 150, 40, 10]),
  q('proto-irrigation-operator', 'Irrigation Pump Operator', 'Agriculture', 2.5, 240, ['TRADE.IRRIGATION_PUMP'], false, 'moderate', [70, 120, 30, 20]),
  q('proto-security-guard', 'Unarmed Security Guard', 'Management & Entrepreneurship', 2.5, 240, ['TRADE.SECURITY_GUARD'], false, 'moderate', [60, 120, 40, 20]),

  // ---- Level 3: 10th pass, OR 8th + 2 years, OR 5th + 5 years.
  q('proto-dairy-entrepreneur', 'Dairy Micro Entrepreneur', 'Agriculture', 3, 330, ['TRADE.DAIRY'], true, 'moderate', [90, 160, 50, 30]),
  q('proto-poultry-entrepreneur', 'Poultry Farm Entrepreneur', 'Agriculture', 3, 330, ['TRADE.POULTRY'], true, 'moderate', [90, 160, 50, 30]),
  q('proto-food-processing-operator', 'Food Processing Machine Operator', 'Food Processing', 3, 360, ['TRADE.FOOD_PROCESSING'], false, 'moderate', [90, 180, 60, 30]),
  q('proto-baker', 'Baker', 'Food Processing', 3, 360, ['TRADE.BAKERY'], true, 'moderate', [90, 180, 60, 30]),
  q('proto-mason', 'Mason (General)', 'Construction', 3, 390, ['TRADE.MASONRY'], true, 'high', [90, 210, 60, 30]),
  q('proto-carpenter', 'Carpenter (Wooden Furniture)', 'Construction', 3, 390, ['TRADE.CARPENTRY'], true, 'moderate', [90, 210, 60, 30]),
  q('proto-plumber', 'Plumber (General)', 'Construction', 3, 360, ['TRADE.PLUMBING'], true, 'moderate', [90, 180, 60, 30]),
  q('proto-electrician-domestic', 'Domestic Electrician', 'Electronics & Hardware', 3, 390, ['TRADE.ELECTRICIAN'], true, 'moderate', [100, 200, 60, 30]),
  q('proto-welder', 'Gas and Arc Welder', 'Capital Goods', 3, 390, ['TRADE.WELDING'], false, 'high', [90, 210, 60, 30]),
  q('proto-two-wheeler-mech', 'Two Wheeler Service Technician', 'Automotive', 3, 390, ['TRADE.TWO_WHEELER_MECHANIC'], true, 'moderate', [100, 200, 60, 30]),
  q('proto-mobile-repair', 'Mobile Phone Repair Technician', 'Electronics & Hardware', 3, 360, ['TRADE.MOBILE_REPAIR'], true, 'low', [100, 170, 60, 30]),
  q('proto-beautician', 'Assistant Beauty Therapist', 'Beauty & Wellness', 3, 360, ['TRADE.BEAUTY_PARLOUR'], true, 'low', [90, 180, 60, 30]),
  q('proto-retail-shop-owner', 'Retail Shop Micro Entrepreneur', 'Retail', 3, 300, ['TRADE.RETAIL_SHOP'], true, 'low', [100, 130, 50, 20]),
  q('proto-food-stall', 'Food Stall Micro Entrepreneur', 'Tourism & Hospitality', 3, 300, ['TRADE.FOOD_VENDING'], true, 'moderate', [90, 140, 50, 20]),
  q('proto-gda', 'General Duty Assistant', 'Healthcare', 3, 390, ['TRADE.HEALTHCARE_GDA'], false, 'moderate', [110, 180, 60, 40]),
  q('proto-childcare-worker', 'Early Childhood Care Worker', 'Healthcare', 3, 360, ['TRADE.CHILDCARE'], false, 'low', [110, 160, 60, 30]),
  q('proto-painter-decorator', 'Painter and Decorator', 'Construction', 3, 330, ['TRADE.PAINTING'], true, 'high', [80, 170, 50, 30]),
  q('proto-tractor-operator', 'Tractor Operator', 'Agriculture', 3, 330, ['TRADE.TRACTOR_OPERATOR'], false, 'moderate', [90, 160, 50, 30]),

  // ---- Level 3.5-4: 10th + 1-2 years, or 12th. Where the register's mass actually sits (844 at L4).
  q('proto-solar-technician', 'Solar Panel Installation Technician', 'Green Jobs', 3.5, 420, ['TRADE.SOLAR_TECHNICIAN'], true, 'moderate', [110, 220, 60, 30]),
  q('proto-auto-service-tech', 'Automotive Service Technician', 'Automotive', 4, 450, ['TRADE.AUTO_REPAIR'], false, 'high', [120, 230, 70, 30]),
  q('proto-csc-operator', 'Common Service Centre Operator', 'IT-ITeS', 4, 420, ['TRADE.COMPUTER_DATA_ENTRY'], true, 'low', [140, 180, 70, 30]),
  q('proto-data-entry-operator', 'Domestic Data Entry Operator', 'IT-ITeS', 4, 390, ['TRADE.COMPUTER_DATA_ENTRY'], false, 'low', [130, 170, 60, 30]),
  q('proto-commercial-driver', 'Commercial Vehicle Driver', 'Automotive', 4, 420, ['TRADE.DRIVING'], true, 'moderate', [120, 210, 60, 30]),
  q('proto-handloom-supervisor', 'Handloom Production Supervisor', 'Textiles & Handloom', 4, 450, ['TRADE.HANDLOOM_WEAVING'], false, 'low', [140, 200, 70, 40]),
  q('proto-dairy-technician', 'Dairy Processing Technician', 'Food Processing', 4, 450, ['TRADE.DAIRY'], false, 'moderate', [140, 200, 70, 40]),
];

/** Sanity numbers the UI can show, so nobody has to trust a claim about the catalogue. */
export function catalogueStats(rows: Qualification[] = QUALIFICATIONS) {
  const byLevel = new Map<string, number>();
  for (const r of rows) byLevel.set(r.levelLabel, (byLevel.get(r.levelLabel) ?? 0) + 1);
  return {
    total: rows.length,
    official: rows.filter((r) => r.source === 'NQR_OFFICIAL').length,
    prototype: rows.filter((r) => r.source === 'PROTOTYPE_PENDING_NQR_IMPORT').length,
    withQpCode: rows.filter((r) => r.qpCode !== null).length,
    selfEmployable: rows.filter((r) => r.selfEmployable).length,
    noSchoolingNeeded: rows.filter((r) => r.level <= 2).length,
    byLevel: [...byLevel.entries()].sort(),
  };
}
