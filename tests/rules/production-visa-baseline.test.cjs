const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { normalizeApplicantFacts: normalize } = require('../../js/rules/applicant-facts.js');
const { classifyBaseline } = require('../../js/rules/baseline-classifier.js');
const root = path.resolve(__dirname, '../..');
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const rule = read('data/official-requirements/rules/SCHENGEN_SHORT_STAY_VISA_REQUIREMENT_BASELINE/0.1.0.json');
const data = read(rule.reference_data.path);
function model(overrides = {}) {
  const input = { passport: { issuing_country: 'IN', document_type: 'ordinary' }, trip: { visa_regime: 'schengen', visa_type: 'short_stay' }, identity: { applicant_conditions: ['ordinary_adult_applicant'] } };
  for (const [k, v] of Object.entries(overrides)) input[k] = { ...input[k], ...v };
  return normalize(input);
}
const run = overrides => classifyBaseline(model(overrides), rule, data);
test('ordinary Indian nationality resolves Annex-I baseline but never a final determination', () => {
  const r = run(); assert.equal(r.classification, 'ANNEX_I_VISA_REQUIRED'); assert.equal(r.normalized_country_code, 'IN'); assert.equal(r.final_determination, false); assert.equal(r.status, undefined);
});
test('residence does not alter nationality baseline, including ordinary Irish residence', () => {
  for (const country of ['IE', 'GB', 'XX', null]) assert.equal(run({ residence: { country, legal_status: 'legal_resident', permit_type: 'ordinary' } }).classification, 'ANNEX_I_VISA_REQUIRED');
});
test('unsupported nationality is UNKNOWN under explicit partial coverage', () => {
  const r = run({ passport: { issuing_country: 'BR' } });
  assert.equal(r.classification, 'UNKNOWN'); assert.equal(r.reason, 'UNSUPPORTED_REFERENCE_DATA');
  assert.equal(r.coverage.type, 'PARTIAL'); assert.deepEqual(r.coverage.supported_keys, ['IN']);
});
test('missing and malformed nationality are UNKNOWN without display-name aliasing', () => {
  for (const issuing_country of [null, undefined, 7, {}, 'India', 'Indian', 'in', 'INVALID']) assert.equal(run({ passport: { issuing_country } }).classification, 'UNKNOWN');
});
test('every configured special applicant category routes to review without granting an exemption', () => {
  for (const condition of rule.special_routing.review_condition_values) {
    const r = run({ identity: { applicant_conditions: ['ordinary_adult_applicant', condition] } });
    assert.equal(r.classification, 'UNKNOWN'); assert.equal(r.reason, 'SPECIAL_ROUTE_REQUIRES_REVIEW');
    assert.equal(r.special_condition_diagnostics[0].value, condition);
  }
});
test('nonordinary documents route to review and missing document type remains unknown', () => {
  for (const document_type of ['diplomatic', 'service', 'official', 'special', 'international_organisation']) assert.equal(run({ passport: { document_type } }).reason, 'SPECIAL_ROUTE_REQUIRES_REVIEW');
  assert.equal(run({ passport: { document_type: null } }).classification, 'UNKNOWN');
});
test('ordinary conditions and explicit absence allow baseline; unknown conditions do not', () => {
  assert.equal(run({ identity: { applicant_conditions: [] } }).classification, 'ANNEX_I_VISA_REQUIRED');
  assert.equal(run().classification, 'ANNEX_I_VISA_REQUIRED');
  assert.equal(run({ identity: { applicant_conditions: null } }).classification, 'UNKNOWN');
  assert.equal(run({ identity: { applicant_conditions: ['unrecognized_condition'] } }).reason, 'UNRESOLVED_APPLICANT_CONDITIONS');
});
test('destination country is not a classifier dependency; other regimes are not classified', () => {
  for (const destination_country of ['FR', 'ES', 'XX', null]) assert.equal(run({ trip: { destination_country } }).classification, 'ANNEX_I_VISA_REQUIRED');
  assert.equal(run({ trip: { visa_regime: 'other' } }).reason, 'NOT_APPLICABLE');
  assert.equal(run({ trip: { visa_type: 'other' } }).classification, 'UNKNOWN');
});
test('version pins and source/evidence references are preserved and resolve exactly', () => {
  const r = run(); assert.equal(r.reference_data_id, data.reference_id); assert.equal(r.reference_data_version, '2025-12-30');
  assert.deepEqual(r.source_refs, rule.source_refs); assert.deepEqual(r.reference_source_refs, data.source_refs);
  for (const ref of [...rule.source_refs, ...data.source_refs]) {
    assert.equal(read(ref.path).source_revision, ref.source_revision);
    for (const pin of ref.evidence_refs) { const e = read(pin.path); assert.equal(e.revision, pin.revision); assert.equal(e.research_status, 'NEEDS_REVIEW'); assert.ok(e.citations.some(c => c.source_id === ref.source_id && c.source_revision === ref.source_revision)); }
  }
  const changed = structuredClone(data); changed.reference_version = 'different';
  assert.equal(classifyBaseline(model(), rule, changed).reason, 'REFERENCE_VERSION_MISMATCH');
});
test('draft result remains nonpublishable and does not mutate reference or rule data', () => {
  const before = structuredClone({ rule, data }), r = run();
  assert.equal(r.publication.status, 'DRAFT_NOT_PUBLISHABLE'); assert.equal(r.release_ready, false); assert.equal(r.reference_publication.release_ready, false);
  r.coverage.supported_keys.push('ZZ'); assert.deepEqual({ rule, data }, before);
});
test('separate classifier supports configured exempt values without adding legal data', () => {
  const fixture = structuredClone(data); fixture.classifications = { ZZ: { classification: 'ANNEX_II_VISA_EXEMPT', source_refs: [] } }; fixture.coverage.supported_keys = ['ZZ'];
  assert.equal(classifyBaseline(model({ passport: { issuing_country: 'ZZ' } }), rule, fixture).classification, 'ANNEX_II_VISA_EXEMPT');
  assert.deepEqual(Object.keys(data.classifications), ['IN']);
});
test('new modules load as isolated browser scripts without application integration', () => {
  const context = vm.createContext({});
  for (const name of ['applicant-facts', 'evaluators', 'engine', 'reference-lookup', 'baseline-classifier']) vm.runInContext(fs.readFileSync(path.join(root, `js/rules/${name}.js`), 'utf8'), context);
  context.inputText = JSON.stringify({ passport: { issuing_country: 'IN', document_type: 'ordinary' }, trip: { visa_regime: 'schengen', visa_type: 'short_stay' }, identity: { applicant_conditions: [] } }); context.ruleText = JSON.stringify(rule); context.dataText = JSON.stringify(data);
  assert.equal(vm.runInContext('VisaCheckBaselineClassifier.classifyBaseline(VisaCheckApplicantFacts.normalizeApplicantFacts(JSON.parse(inputText)), JSON.parse(ruleText), JSON.parse(dataText)).classification', context), 'ANNEX_I_VISA_REQUIRED');
});
