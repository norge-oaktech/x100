// Maps the short/cryptic keys used by the external "company" onboarding
// form (the one exported as onboard-company.json, built in a different
// form tool than this app's own wizard) onto this app's existing
// onboardingSchema.ts field ids.
//
// Why an alias map instead of renaming or duplicating fields: every
// marketing-asset prompt consumes the knowledge base as prose text (see
// buildKnowledgeBase in config/knowledgeBase.ts) -- it reads field LABELS,
// never field ids directly. So renaming an id was never actually a risk to
// any prompt; the real reason to keep this as a separate mapping layer
// (rather than just renaming 39 existing ids to match the company form) is
// that the two questionnaires aren't guaranteed to stay in lockstep, and a
// mapping is easy to extend or correct without touching the canonical
// schema at all.
//
// Coverage: 39 of the company form's 54 keys have a clear semantic match
// to an existing field and are mapped below. `email` and `full_name`
// already match existing field ids exactly, so they need no entry here.
// The remaining 12 keys have no confident match -- see UNMATCHED_COMPANY_FORM_KEYS.
// These were inferred from the field's short key name and the *shape* of
// its sample answer, without the company form's own question text (which
// wasn't available) -- worth a quick human sanity check against a couple
// of real submissions before this is trusted for anything client-facing.
export const COMPANY_FORM_ALIASES: Record<string, string> = {
  advisory_board: "will_the_fund_have_an_advisory_board",
  background: "what_experiences_or_background_most_strongly_influence_the_f",
  believe_narratives: "what_viewpoints_or_beliefs_does_the_fund_strongly_agree_or_d",
  carry: "revenue_fee_structure_what_carried_interest_structure_should",
  coinvest: "will_the_fund_allow_co_investments",
  comm_feel: "what_communication_style_resonates_best_with_your_target_inv",
  comm_freq: "preferred_communication_frequency",
  comm_method: "preferred_communication_method",
  confidence: "what_qualities_or_characteristics_tend_to_build_investor_con",
  core_values: "what_core_values_define_the_fund_and_its_leadership",
  differentiators: "what_are_the_top_key_differentiators_of_your_fund",
  emotions: "what_emotions_should_the_brand_evoke",
  entities_est: "have_any_fund_entities_already_been_established",
  business_conducted: "has_any_business_already_been_conducted_through_fund_entitie",
  expert_subjects: "what_subjects_position_the_fund_as_a_category_expert",
  formality: "what_tone_best_represents_the_fund",
  founder_personality: "how_would_you_describe_the_foundermanaging_partners_personal",
  fr_objections: "what_concerns_or_objections_most_commonly_arise_during_fundr",
  highlight_diff: "what_differentiators_should_consistently_be_highlighted",
  inefficiency: "what_problem_or_market_inefficiency_does_the_fund_aim_to_sol",
  inst_vs_conv: "how_institutional_versus_conversational_should_communication",
  mgmt_fee: "revenue_fee_structure_what_management_fee_structure_should_b",
  pain_points: "what_pain_points_does_your_fund_solve_for_investors",
  perception: "how_would_you_like_the_fund_to_be_perceived_within_the_marke",
  philosophy: "how_would_you_describe_your_investment_philosophy",
  public_image: "what_public_image_should_the_fund_maintain",
  raise_outside_us: "are_you_expecting_to_raise_capital_outside_of_the_us",
  registration: "will_the_fund_require_registration_with_regulatory_bodies",
  reporting_freq: "what_reporting_frequency_will_be_provided",
  slow_factors: "what_factors_have_historically_slowed_or_complicated_fundrai",
  strategy_summary: "summary_of_fund_strategy",
  target_investors: "what_channels_best_reach_your_target_investors",
  target_irr: "return_assumptions_what_target_irr_is_being_modeled",
  target_moic: "return_assumptions_what_target_moic_is_being_modeled",
  target_raise: "capital_formation_what_is_the_target_raise_amount",
  term_type: "is_the_fund_evergreen_or_term_based_if_term_based_what_is_th",
  tl_type: "what_type_of_thought_leadership_should_the_fund_establish",
  transcripts: "are_there_existing_recordings_transcripts_or_interviews_avai",
  visual_style: "are_there_visual_styles_brands_or_firms_that_best_represent_",
};

// No confident existing-field match found. Either a genuinely new concept
// (add to onboardingSchema.ts) or a near-duplicate this mapping missed
// (add to COMPANY_FORM_ALIASES above once confirmed) -- needs a human call
// either way since guessing wrong here would silently misfile an answer
// under the wrong question.
export const UNMATCHED_COMPANY_FORM_KEYS = [
  "always_emphasize",
  "best_approaches",
  "best_fit",
  "brand_guidelines",
  "build_trust",
  "common_q",
  "desired_identity",
  "fr_timeline",
  "leadership_style",
  "motivation",
  "qoe",
  "speak_topics",
  "visual_feel",
] as const;

// Translates a raw answers object keyed by the company form's short keys
// into this app's field-id namespace. Unmapped keys (including anything in
// UNMATCHED_COMPANY_FORM_KEYS) pass through unchanged rather than being
// dropped, so nothing is silently lost -- they just won't line up with an
// onboardingSchema field/section until a human resolves them above.
export function applyCompanyFormAliases(
  rawAnswers: Record<string, string | string[]>
): Record<string, string | string[]> {
  const result: Record<string, string | string[]> = {};
  for (const [key, value] of Object.entries(rawAnswers)) {
    result[COMPANY_FORM_ALIASES[key] ?? key] = value;
  }
  return result;
}
