/**
 * District architecture profiles. Every outdoor area has a theme; the profile
 * says which designs suit it and how lived-in it looks at night. Adding a
 * district means adding a line here, not changing the builder.
 */
export interface DistrictProfile {
  /** Multiplies a design's weight in this district (missing = 1). */
  bias: Readonly<Record<string, number>>;
  /** Share of windows with a light on. */
  lit: number;
}

const DEFAULT: DistrictProfile = { bias: {}, lit: 0.35 };

export const DISTRICT_PROFILES: Readonly<Record<string, DistrictProfile>> = {
  // Council estates: plain terraces, slab blocks, little ornament.
  estate: { bias: { res_bylaw_terrace: 3, res_dormer_terrace: 2, res_council_slab: 3, res_point_block: 2, res_deck_access: 2, civ_boxing_club: 3, res_stucco_terrace: 0.2, res_stucco_villa: 0.2 }, lit: 0.42 },
  residential: { bias: { res_pale_semi: 3, res_brick_semi: 2, res_point_block: 2, res_council_slab: 2, res_bylaw_terrace: 2 }, lit: 0.45 },
  // The high street: Victorian parades and pubs.
  high_street: { bias: { com_parade: 3, com_parade_dormer: 2, com_draper: 2, com_double_fronted: 2, ent_victorian_pub: 3, ent_corner_pub: 2, com_sixties_parade: 0.5 }, lit: 0.4 },
  alleys: { bias: { res_terrace_back: 5 }, lit: 0.25 },
  // Industry: brick works and steel sheds.
  industrial: { bias: { ind_mill: 2, ind_works: 2, ind_unit: 2, ind_engineering: 2, ind_printworks: 2 }, lit: 0.15 },
  territory: { bias: { ind_loading: 3, ind_unit: 2, ind_mill: 2 }, lit: 0.05 },
  ind_estate: { bias: { com_showroom: 3, com_furniture: 2, ind_unit: 3, ind_depot: 3 }, lit: 0.2 },
  docks: { bias: { ind_bonded: 4, ind_cooperage: 2, ind_brewery: 2 }, lit: 0.12 },
  // The city centre: offices, a bank, clubs and a casino.
  city: { bias: { off_glass_tower: 2, off_chambers: 2, off_insurance: 2, com_corner_bank: 2, ent_casino: 3, ent_club_brick: 2, ent_hotel: 2 }, lit: 0.55 },
  nightlife: { bias: { ent_club_box: 2, ent_club_brick: 3, ent_bar: 3, ent_takeaway: 3 }, lit: 0.6 },
  precinct: { bias: { com_precinct_block: 3, com_precinct_low: 2, com_sixties_parade: 2, civ_surgery: 1 }, lit: 0.45 },
  leisure: { bias: { civ_leisure: 4, civ_gym_unit: 2, res_pale_semi: 2 }, lit: 0.4 },
  stadium: { bias: { res_bylaw_terrace: 3, com_parade_dormer: 2 }, lit: 0.35 },
  market: { bias: { civ_market_hall: 6 }, lit: 0.35 },
};

export function districtProfile(theme: string): DistrictProfile {
  return DISTRICT_PROFILES[theme] ?? DEFAULT;
}
