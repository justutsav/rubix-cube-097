/**
 * Pilot districts and the local opportunity table.
 *
 * decisions.md, 2026-09-25: *"opportunity data is two or three sourced districts, not a national
 * map. Every row carries `source` and `source_date`."*
 *
 * So every row below carries a source string, and the honest ones say
 * `PLACEHOLDER_NEEDS_SOURCING`. That string is not decoration: the officer console renders a red
 * band listing every placeholder row, and the Perspective Plan export refuses to include them.
 * A fabricated district feed loses to three honest districts the moment a jury member turns out
 * to be from one of them — and at MoSJE, one of them will be.
 *
 * The two districts were chosen because they are SC-heavy and in the dialect belt the ASR gap
 * sits in: Varanasi (UP, Bhojpuri) and Raipur (Chhattisgarh, Chhattisgarhi). Block names are
 * the real administrative blocks; LGD codes are `null` because we have not pulled the LGD
 * directory yet and will not type numbers we have not seen.
 */

import type { DistrictOpportunity } from '../types.js';

export interface DistrictSeed {
  name: string;
  stateName: string;
  lgdCode: number | null;
  isPilot: boolean;
  /** Dominant non-scheduled language, which is exactly where no ASR model exists. */
  dialect: string | null;
  blocks: { name: string; lgdCode: number | null }[];
}

export const DISTRICTS: DistrictSeed[] = [
  {
    name: 'Varanasi',
    stateName: 'Uttar Pradesh',
    lgdCode: null,
    isPilot: true,
    dialect: 'Bhojpuri',
    blocks: [
      { name: 'Arajiline', lgdCode: null },
      { name: 'Baragaon', lgdCode: null },
      { name: 'Chiraigaon', lgdCode: null },
      { name: 'Cholapur', lgdCode: null },
      { name: 'Harahua', lgdCode: null },
      { name: 'Kashi Vidyapeeth', lgdCode: null },
      { name: 'Pindra', lgdCode: null },
      { name: 'Sewapuri', lgdCode: null },
    ],
  },
  {
    name: 'Raipur',
    stateName: 'Chhattisgarh',
    lgdCode: null,
    isPilot: true,
    dialect: 'Chhattisgarhi',
    blocks: [
      { name: 'Abhanpur', lgdCode: null },
      { name: 'Arang', lgdCode: null },
      { name: 'Dharsiwa', lgdCode: null },
      { name: 'Tilda', lgdCode: null },
    ],
  },
];

/**
 * Opportunity rows. `source` is the load-bearing column.
 *
 * The two rows marked with a real source are the ones we can actually stand behind today: the
 * PM-AJAY guidelines' own Annexure I (what the scheme may fund at all, which IS an opportunity
 * statement) and the PM-DAKSH stipend, both read from primary documents in docs/references/.
 * Everything else is a placeholder that must be replaced from the District Skill Development
 * Plan PDFs, the Udyam registry and the SIDH centre locator before any number goes on a slide.
 */
export const OPPORTUNITIES: DistrictOpportunity[] = [
  // --- sourced
  {
    districtName: 'Varanasi',
    blockName: null,
    conceptId: 'TRADE.HANDLOOM_WEAVING',
    kind: 'scheme',
    title: 'Handlooms is a fundable GIA domain in this district',
    detail:
      'PM-AJAY Scheme Guidelines (Revised, May 2023), Annexure I, domain "Handicrafts and Handlooms" — a GIA project in this trade is admissible, which is a precondition for any recommendation here.',
    distanceKm: null,
    source: 'PM-AJAY Scheme Guidelines (Revised May 2023), Annexure I — docs/references/PM-AJAY-Guidelines-Revised-May2023.pdf',
    sourceDate: '2023-05-01',
  },
  {
    districtName: 'Raipur',
    blockName: null,
    conceptId: 'TRADE.SERICULTURE',
    kind: 'scheme',
    title: 'Sericulture (tasar/kosa) is a fundable GIA domain',
    detail:
      'PM-AJAY Annexure I, domain "Agriculture & Soil Conservation" explicitly lists sericulture. Chhattisgarh kosa is the local form of the trade.',
    distanceKm: null,
    source: 'PM-AJAY Scheme Guidelines (Revised May 2023), Annexure I — docs/references/PM-AJAY-Guidelines-Revised-May2023.pdf',
    sourceDate: '2023-05-01',
  },

  // --- placeholders. These are visible as placeholders everywhere they are used.
  {
    districtName: 'Varanasi',
    blockName: 'Sewapuri',
    conceptId: 'TRADE.DAIRY',
    kind: 'enterprise',
    title: 'Milk collection route — demand for trained dairy workers',
    detail: 'Needs the district dairy federation collection-centre list. Not yet obtained.',
    distanceKm: 6,
    source: 'PLACEHOLDER_NEEDS_SOURCING',
    sourceDate: null,
  },
  {
    districtName: 'Varanasi',
    blockName: 'Chiraigaon',
    conceptId: 'TRADE.TAILORING',
    kind: 'employer',
    title: 'Garment job-work cluster',
    detail: 'Needs Udyam registry extract for NIC 1410 in this block.',
    distanceKm: 9,
    source: 'PLACEHOLDER_NEEDS_SOURCING',
    sourceDate: null,
  },
  {
    districtName: 'Varanasi',
    blockName: 'Pindra',
    conceptId: 'TRADE.HANDLOOM_WEAVING',
    kind: 'centre',
    title: 'Weaver service centre (training)',
    detail: 'Needs SIDH centre-locator confirmation and a geocode.',
    distanceKm: 8,
    source: 'PLACEHOLDER_NEEDS_SOURCING',
    sourceDate: null,
  },
  {
    districtName: 'Raipur',
    blockName: 'Dharsiwa',
    conceptId: 'TRADE.WELDING',
    kind: 'employer',
    title: 'Fabrication units on the industrial belt',
    detail: 'Needs Udyam registry extract and a distance check against the block centroid.',
    distanceKm: 14,
    source: 'PLACEHOLDER_NEEDS_SOURCING',
    sourceDate: null,
  },
  {
    districtName: 'Raipur',
    blockName: 'Arang',
    conceptId: 'TRADE.FOOD_PROCESSING',
    kind: 'enterprise',
    title: 'Small food-processing units',
    detail: 'Needs District Skill Development Plan (Raipur) confirmation.',
    distanceKm: 11,
    source: 'PLACEHOLDER_NEEDS_SOURCING',
    sourceDate: null,
  },
  {
    districtName: 'Raipur',
    blockName: 'Abhanpur',
    conceptId: 'TRADE.POULTRY',
    kind: 'enterprise',
    title: 'Backyard poultry aggregation',
    detail: 'Needs animal husbandry department block data.',
    distanceKm: 7,
    source: 'PLACEHOLDER_NEEDS_SOURCING',
    sourceDate: null,
  },
];

export function isSourced(o: DistrictOpportunity): boolean {
  return o.source !== 'PLACEHOLDER_NEEDS_SOURCING' && o.sourceDate !== null;
}

export function provenanceReport(rows: DistrictOpportunity[] = OPPORTUNITIES) {
  const sourced = rows.filter(isSourced);
  return {
    total: rows.length,
    sourced: sourced.length,
    placeholder: rows.length - sourced.length,
    districts: [...new Set(rows.map((r) => r.districtName))],
    /** Shown verbatim in the officer console. Blunt on purpose. */
    warning:
      rows.length - sourced.length > 0
        ? `${rows.length - sourced.length} of ${rows.length} opportunity rows are placeholders with no source. They are excluded from the Perspective Plan export and must be replaced from the District Skill Development Plan, the Udyam registry and the SIDH centre locator.`
        : null,
  };
}

/**
 * Straight-line distance. Used only where a real geocode exists; everywhere else the distance
 * comes from the opportunity row, which is honest about being hand-entered.
 */
export function haversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)) * 10) / 10;
}
