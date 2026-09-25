// Synthetic fixtures only; no real visa requirements or source claims.
const timestamp = '2026-09-23T12:00:00Z';
const pending = () => ({ status: 'PENDING', note: null, references: [] });
const scope = () => ({ mode: 'UNDETERMINED', values: [] });
const change = { version: '0.1.0', changed_at: timestamp, actor: null, description: 'Synthetic test fixture only' };
function sourceFixture() {
  return { schema_version: '1.0.0', source_id: 'TEST-SOURCE', source_revision: '0.1.0', url: 'https://example.invalid/test', authority: null, title: null, source_type: null, language: null, official_status: 'UNCONFIRMED', official_status_basis: null, retrieved_at: timestamp, verified_at: null, source_version: null, consolidation_date: null, published_at: null, effective_from: null, effective_to: null, effective_date_known: false, effective_date_notes: null, reference_copy: null, reviewer_notes: null };
}
function evidenceFixture() {
  return { schema_version: '1.0.0', evidence_id: 'TEST-EVIDENCE', revision: '0.1.0', candidate_rule_id: null, requirement_category: 'synthetic', requirement_name: 'Synthetic test only', applicability: { purposes: scope(), passport: { issuing_countries: scope(), document_types: scope() }, residence: { countries: scope(), legal_status_conditions: scope() }, destination: { countries: scope(), territories: scope() }, visa: { regimes: scope(), types: scope() }, applicant_conditions: scope(), excluded_conditions: scope(), scope_notes: null }, citations: [], interpretation: { explicitly_establishes: null, does_not_establish: null, application_stage: null, classification: 'UNRESOLVED', required_applicant_inputs: [], reference_events: [], exceptions: [], dependencies: [], conflicts: [], reviewer_notes: null }, research_status: 'UNRESEARCHED', review: { reviewer_id: null, reviewed_at: null, checks: Object.fromEntries(['official_source_confirmed', 'scope_confirmed', 'interpretation_supported', 'version_and_dates_checked', 'exceptions_considered'].map(k => [k, pending()])), verification_basis: null, rejection_reason: null }, change_history: [change] };
}
function verifiedFixture() {
  const e = evidenceFixture();
  e.research_status = 'VERIFIED';
  function markScopeKnown(value) {
    if (value && typeof value === 'object') {
      if (value.mode === 'UNDETERMINED') value.mode = 'UNRESTRICTED';
      else Object.values(value).forEach(markScopeKnown);
    }
  }
  markScopeKnown(e.applicability);
  e.citations = [{ source_id: 'TEST-SOURCE', source_revision: '0.1.0', relationship: 'SUPPORTS', locator: { article: null, section: 'Synthetic section', heading: null, page: null, paragraph: null, other: null }, supporting_excerpt: 'Synthetic fixture; not a visa requirement.', excerpt_language: 'en', translation: null, translation_status: 'NOT_PROVIDED', applicability_notes: null, effective_from: null, effective_to: null, effective_date_known: false, effective_date_notes: 'Synthetic fixture' }];
  Object.assign(e.interpretation, { explicitly_establishes: 'Synthetic proposition', does_not_establish: 'Any real requirement', application_stage: 'future_jurisdiction_re_entry', classification: 'INFORMATIONAL_PROCEDURAL' });
  Object.assign(e.review, { reviewer_id: 'TEST-REVIEWER', reviewed_at: timestamp, verification_basis: 'Synthetic review fixture' });
  for (const c of Object.values(e.review.checks)) Object.assign(c, { status: 'CONFIRMED', note: 'Synthetic check', references: ['TEST-SOURCE@0.1.0'] });
  return e;
}


module.exports = { sourceFixture, evidenceFixture, verifiedFixture, timestamp };
