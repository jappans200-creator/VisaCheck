const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../..');
const read = p => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const { normalizeApplicantFacts: normalize } = require('../../js/rules/applicant-facts.js');
const { evaluateRule } = require('../../js/rules/engine.js');
const { evaluateReadiness } = require('../../js/rules/document-readiness.js');
const config = read('data/official-requirements/document-readiness/SCHENGEN_SUPPORTING_EVIDENCE/0.1.0.json');
const border = read('data/official-requirements/reference-data/france-border-financial-reference/0.1.0.json');
const items = Object.fromEntries(config.items.map(i => [i.evidence_id, i]));
const insurance = Object.fromEntries(['PRESENCE','COVERAGE_AMOUNT','DATE_COVERAGE','TERRITORY','MEDICAL_REPATRIATION','EMERGENCY_OR_HOSPITAL_COVERAGE'].map(s => [s, read(`data/official-requirements/rules/SCHENGEN_INSURANCE_${s}/0.1.0.json`)]));
function model(evidence = {}, overrides = {}) {
  const base = { passport: { document_type: 'ordinary' }, identity: { applicant_conditions: [] }, trip: { visa_regime: 'schengen', visa_type: 'short_stay', purpose: 'tourism', intended_entry_date: '2032-05-01', intended_exit_date: '2032-05-10' }, supporting_evidence: evidence };
  for (const [k, v] of Object.entries(overrides)) base[k] = { ...base[k], ...v };
  return normalize(base);
}
const policy = changes => ({ present: true, coverage_amount: 30000, currency: 'EUR', valid_from: '2032-05-01', valid_to: '2032-05-10', territorial_scope: 'SCHENGEN', medical_repatriation_covered: true, emergency_medical_covered: true, hospital_treatment_covered: true, ...changes });
const legal = (name, changes = {}, overrides = {}) => evaluateRule(model({ travel_medical_insurance: policy(changes) }, overrides), insurance[name]);
const ready = (name, evidence, overrides) => evaluateReadiness(model(evidence, overrides), items[name]);

test('2B insurance complete supplied coverage satisfies each configured deterministic check', () => {
  for (const name of Object.keys(insurance)) assert.equal(legal(name).status, 'PASS', name);
});
test('2B insurance amount: threshold inclusive, below fails, no currency conversion', () => {
  assert.equal(legal('COVERAGE_AMOUNT', { coverage_amount: 29999 }).status, 'FAIL');
  assert.equal(legal('COVERAGE_AMOUNT', { coverage_amount: 30000 }).status, 'PASS');
  for (const currency of ['USD', null]) assert.equal(legal('COVERAGE_AMOUNT', { currency }).status, 'UNKNOWN');
  assert.equal(legal('COVERAGE_AMOUNT', { coverage_amount: '30000' }).status, 'UNKNOWN');
});
test('2B insurance absence has distinct readiness MISSING and mandatory-presence FAIL', () => {
  assert.equal(legal('PRESENCE', { present: false }).status, 'FAIL');
  const r = ready('SCHENGEN_INSURANCE_EVIDENCE', { travel_medical_insurance: policy({ present: false }) });
  assert.equal(r.status, 'MISSING'); assert.equal(r.substantive_acceptance, 'NOT_DETERMINED');
  assert.equal(legal('PRESENCE', { present: null }).status, 'UNKNOWN');
});
test('2B insurance dates: exact coverage passes; late start or early end fails', () => {
  assert.equal(legal('DATE_COVERAGE').status, 'PASS');
  assert.equal(legal('DATE_COVERAGE', { valid_from: '2032-05-02' }).status, 'FAIL');
  assert.equal(legal('DATE_COVERAGE', { valid_to: '2032-05-09' }).status, 'FAIL');
  for (const valid_from of [null, 'invalid', '2032-05-11']) assert.equal(legal('DATE_COVERAGE', { valid_from }).status, 'UNKNOWN');
  assert.equal(legal('DATE_COVERAGE', {}, { trip: { intended_entry_date: null } }).status, 'UNKNOWN');
});
test('2B insurance territory, repatriation and emergency/hospital coverage stay distinct', () => {
  assert.equal(legal('TERRITORY', { territorial_scope: 'OTHER' }).status, 'FAIL');
  assert.equal(legal('TERRITORY', { territorial_scope: null }).status, 'UNKNOWN');
  assert.equal(legal('MEDICAL_REPATRIATION', { medical_repatriation_covered: false }).status, 'FAIL');
  assert.equal(legal('EMERGENCY_OR_HOSPITAL_COVERAGE', { emergency_medical_covered: false, hospital_treatment_covered: false }).status, 'FAIL');
  assert.equal(legal('EMERGENCY_OR_HOSPITAL_COVERAGE', { emergency_medical_covered: null, hospital_treatment_covered: null }).status, 'UNKNOWN');
  assert.equal(legal('EMERGENCY_OR_HOSPITAL_COVERAGE', { emergency_medical_covered: true, hospital_treatment_covered: null }).status, 'PASS');
  assert.equal(legal('EMERGENCY_OR_HOSPITAL_COVERAGE', { emergency_medical_covered: 'true', hospital_treatment_covered: false }).status, 'UNKNOWN');
});
test('2B insurance special/exempt routes need review, not an invented exemption', () => {
  const override = { identity: { applicant_conditions: ['insurance_exempt'] } };
  for (const name of Object.keys(insurance)) { const r = legal(name, {}, override); assert.equal(r.status, 'UNKNOWN'); assert.equal(r.code, 'SPECIAL_ROUTE_REQUIRES_REVIEW'); }
  assert.equal(ready('SCHENGEN_INSURANCE_EVIDENCE', { travel_medical_insurance: policy() }, override).status, 'UNKNOWN');
});
test('2B accommodation presence and date coverage are distinct, including partial coverage', () => {
  const a = { type: 'HOTEL', evidence_present: true, means_to_cover_evidence_present: false, coverage_start: '2032-05-01', coverage_end: '2032-05-10' };
  const full = ready('SCHENGEN_ACCOMMODATION_EVIDENCE', { accommodation: a });
  assert.equal(full.status, 'PRESENT'); assert.equal(full.diagnostics[0].coverage, 'COMPLETE');
  const partial = ready('SCHENGEN_ACCOMMODATION_EVIDENCE', { accommodation: { ...a, coverage_end: '2032-05-05' } });
  assert.equal(partial.status, 'PRESENT'); assert.equal(partial.diagnostics[0].coverage, 'PARTIAL');
  assert.equal(partial.assessment, 'ASSESSMENT_REQUIRED');
});
test('2B accommodation absence is readiness only; unknown alternatives stay unknown', () => {
  const absent = ready('SCHENGEN_ACCOMMODATION_EVIDENCE', { accommodation: { evidence_present: false, means_to_cover_evidence_present: false } });
  assert.equal(absent.status, 'MISSING'); assert.equal(absent.visa_application_result, undefined);
  assert.equal(ready('SCHENGEN_ACCOMMODATION_EVIDENCE', {}).status, 'UNKNOWN');
  assert.equal(ready('SCHENGEN_ACCOMMODATION_EVIDENCE', { accommodation: { evidence_present: false } }).status, 'UNKNOWN');
});
test('2B alternative accommodation means do not require a hotel booking', () => {
  const r = ready('SCHENGEN_ACCOMMODATION_EVIDENCE', { accommodation: { evidence_present: false, means_to_cover_evidence_present: true } });
  assert.equal(r.status, 'PRESENT'); assert.ok(r.diagnostics.some(d => d.code === 'ALTERNATIVE_ACCOMMODATION_MEANS_REQUIRES_ASSESSMENT'));
});
test('2B private-host certificate presence is not a completed attestation determination', () => {
  const r = ready('SCHENGEN_ACCOMMODATION_EVIDENCE', { accommodation: { type: 'PRIVATE_HOST', evidence_present: true, private_host_certificate_present: true } });
  assert.equal(r.status, 'PRESENT'); assert.ok(r.diagnostics.some(d => d.code === 'PRIVATE_HOST_ATTESTATION_ASSESSMENT_NOT_IMPLEMENTED'));
  assert.equal(r.substantive_acceptance, 'NOT_DETERMINED');
});
test('2B financial presence, missing, unknown and sponsorship never determine sufficiency', () => {
  for (const [financial_means, expected] of [[{ evidence_present: true, available_amount: 0 }, 'PRESENT'], [{ evidence_present: false, sponsorship_present: false }, 'MISSING'], [{}, 'UNKNOWN'], [{ evidence_present: false, sponsorship_present: true }, 'PRESENT']]) {
    const r = ready('SCHENGEN_FINANCIAL_EVIDENCE', { financial_means });
    assert.equal(r.status, expected); assert.equal(r.assessment, 'ASSESSMENT_REQUIRED'); assert.equal(r.financially_sufficient, undefined); assert.equal(r.visa_application_result, undefined);
  }
  for (const available_amount of [0, 30000, 999999]) assert.equal(ready('SCHENGEN_FINANCIAL_EVIDENCE', { financial_means: { evidence_present: true, available_amount, currency: 'EUR' } }).status, 'PRESENT');
});
test('2B border amounts are reference data only, stage-separated and not executable failure thresholds', () => {
  assert.deepEqual(border.daily_reference_amounts, { HOTEL: 65, NO_HOTEL: 120, QUALIFYING_PRIVATE_HOST_WITH_ATTESTATION: 32.5 });
  assert.equal(border.partial_hotel_basis.hotel_covered_days_rate, 'HOTEL'); assert.equal(border.partial_hotel_basis.uncovered_days_rate, 'NO_HOTEL');
  assert.equal(border.stage, 'BORDER_ENTRY_REFERENCE'); assert.equal(border.non_determinative_for_visa_application, true);
  assert.equal(border.evaluator, undefined); assert.equal(border.rule_id, undefined);
  assert.equal(evaluateRule(model(), border).status, 'UNKNOWN');
  assert.ok(config.items.every(i => i.evaluator === undefined));
});
test('2B return evidence accepts reservations and configured alternatives without buying tickets', () => {
  const no = { return_or_onward_evidence_present: false, reservation_present: false, funds_to_acquire_return_present: false };
  for (const key of Object.keys(no)) assert.equal(ready('SCHENGEN_RETURN_ONWARD_EVIDENCE', { return_or_onward_evidence: { ...no, [key]: true } }).status, 'PRESENT');
  assert.equal(ready('SCHENGEN_RETURN_ONWARD_EVIDENCE', { return_or_onward_evidence: no }).status, 'MISSING');
  assert.equal(ready('SCHENGEN_RETURN_ONWARD_EVIDENCE', {}).status, 'UNKNOWN');
  assert.equal(ready('SCHENGEN_RETURN_ONWARD_EVIDENCE', { return_or_onward_evidence: { ...no, itinerary_present: true } }).status, 'MISSING');
});
test('2B purpose and intention information report evidence only, not subjective legal findings', () => {
  for (const [id, group] of [['SCHENGEN_PURPOSE_EVIDENCE','purpose'], ['SCHENGEN_INTENTION_INFORMATION','intention_to_leave']]) {
    for (const [evidence_present, expected] of [[true,'PRESENT'],[false,'MISSING'],[null,'UNKNOWN']]) {
      const r = ready(id, { [group]: { evidence_present } }); assert.equal(r.status, expected); assert.equal(r.assessment, 'ASSESSMENT_REQUIRED'); assert.equal(r.intention_to_leave_score, undefined); assert.equal(r.substantive_acceptance, 'NOT_DETERMINED');
    }
  }
});
test('2B source pins resolve and everything remains nonpublishable', () => {
  for (const d of [...Object.values(insurance), ...config.items, border]) {
    assert.equal(d.publication.status, 'DRAFT_NOT_PUBLISHABLE'); assert.equal(d.publication.release_ready, false);
    for (const s of d.source_refs) for (const pin of s.evidence_refs) { const e = read(pin.path); assert.equal(e.revision, pin.revision); assert.equal(e.research_status, 'NEEDS_REVIEW'); assert.ok(e.citations.some(c => c.source_id === s.source_id && c.source_revision === s.source_revision)); }
  }
  const r = ready('SCHENGEN_PURPOSE_EVIDENCE', { purpose: { evidence_present: true } }); assert.deepEqual(r.source_refs, items.SCHENGEN_PURPOSE_EVIDENCE.source_refs);
});
test('2B readiness module loads in browser without current-time or UI dependencies', () => {
  class NoClockDate extends Date { constructor(...args) { if (!args.length) throw Error('No implicit clock'); super(...args); } }
  const context = vm.createContext({ Date: NoClockDate });
  for (const n of ['applicant-facts','evaluators','engine','document-readiness']) vm.runInContext(fs.readFileSync(path.join(root, `js/rules/${n}.js`), 'utf8'), context);
  context.m = JSON.stringify(model({ purpose: { evidence_present: true } })); context.d = JSON.stringify(items.SCHENGEN_PURPOSE_EVIDENCE);
  assert.equal(vm.runInContext('VisaCheckDocumentReadiness.evaluateReadiness(JSON.parse(m),JSON.parse(d)).status', context), 'PRESENT');
});
