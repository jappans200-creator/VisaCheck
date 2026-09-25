const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../..');
const { normalizeApplicantFacts: normalize } = require('../../js/rules/applicant-facts.js');
const { evaluateRule } = require('../../js/rules/engine.js');
const read = p => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const load = name => read(`data/official-requirements/rules/SCHENGEN_TRAVEL_DOCUMENT_${name}/0.1.0.json`);
const validity = load('REMAINING_VALIDITY'), age = load('MAX_AGE'), pages = load('BLANK_PAGES');
function input(overrides = {}) {
  const base = { identity: { applicant_conditions: [] }, passport: { document_type: 'ordinary', issue_date: '2020-01-15', expiry_date: '2035-01-01', blank_pages: 2 }, trip: { visa_regime: 'schengen', visa_type: 'short_stay', relevant_schengen_departure_date: '2030-01-15' }, application: { lodging_date: '2030-01-15' } };
  for (const [key, value] of Object.entries(overrides)) base[key] = { ...base[key], ...value };
  return base;
}
const run = (rule, overrides) => evaluateRule(normalize(input(overrides)), rule);

test('production validity: clearly sufficient, exact boundary and one day below', () => {
  assert.equal(run(validity).status, 'PASS');
  assert.equal(run(validity, { passport: { expiry_date: '2030-04-15' } }).status, 'PASS');
  assert.equal(run(validity, { passport: { expiry_date: '2030-04-14' } }).status, 'FAIL');
});
test('production validity: missing, invalid and conflicting dates stay UNKNOWN', () => {
  for (const expiry_date of [null, 'invalid', '2030-02-30']) assert.equal(run(validity, { passport: { expiry_date } }).status, 'UNKNOWN');
  for (const relevant_schengen_departure_date of [null, 'invalid']) assert.equal(run(validity, { trip: { relevant_schengen_departure_date } }).status, 'UNKNOWN');
  assert.equal(run(validity, { passport: { issue_date: '2036-01-01' } }).status, 'UNKNOWN');
  assert.equal(run(validity, { trip: { intended_entry_date: '2030-02-01', relevant_schengen_departure_date: '2030-01-15' } }).status, 'UNKNOWN');
});
test('production validity: explicit last departure overrides no other fact and no fallback is invented', () => {
  const trip = { intended_exit_date: '2030-01-01', relevant_schengen_departure_date: '2030-07-01', destinations: [{ country: 'XX', duration_days: 7 }, { country: 'YY', duration_days: 7 }] };
  assert.equal(run(validity, { trip, passport: { expiry_date: '2030-09-30' } }).status, 'FAIL');
  assert.equal(run(validity, { trip, passport: { expiry_date: '2030-10-01' } }).status, 'PASS');
  assert.equal(run(validity, { trip: { ...trip, relevant_schengen_departure_date: null } }).status, 'UNKNOWN');
});
test('production validity: month-end and leap-year CLAMP and no 90-day substitution', () => {
  for (const [departure, threshold] of [['2031-01-31', '2031-04-30'], ['2031-11-30', '2032-02-29'], ['2030-11-30', '2031-02-28'], ['2030-03-01', '2030-06-01']]) {
    const result = run(validity, { trip: { relevant_schengen_departure_date: departure }, passport: { expiry_date: threshold } });
    assert.equal(result.status, 'PASS'); assert.equal(result.evaluation.boundary, threshold);
  }
  // Ninety days after March 1 is May 30; three calendar months is June 1.
  assert.equal(run(validity, { trip: { relevant_schengen_departure_date: '2030-03-01' }, passport: { expiry_date: '2030-05-30' } }).status, 'FAIL');
});
test('production exception: absent, requested and genuinely unknown condition', () => {
  const short = { expiry_date: '2030-04-14' };
  assert.equal(run(validity, { passport: short, identity: { applicant_conditions: [] } }).status, 'FAIL');
  const requested = { applicant_conditions: ['travel_document_emergency_review_requested'] };
  const result = run(validity, { passport: short, identity: requested });
  assert.equal(result.status, 'UNKNOWN'); assert.equal(result.code, 'EXCEPTION_REQUIRES_REVIEW');
  assert.equal(run(validity, { passport: short, identity: { applicant_conditions: null } }).code, 'EXCEPTION_APPLICABILITY_UNKNOWN');
  assert.equal(run(validity, { identity: requested }).status, 'PASS');
  assert.equal(run(validity, { identity: { applicant_conditions: null } }).status, 'PASS');
});
test('production age: younger, exact anniversary and one day beyond at lodging', () => {
  assert.equal(run(age, { passport: { issue_date: '2025-01-15' } }).status, 'PASS');
  assert.equal(run(age).status, 'PASS');
  assert.equal(run(age, { application: { lodging_date: '2030-01-16' } }).status, 'FAIL');
  assert.equal(run(age, { passport: { issue_date: '2019-01-15' } }).status, 'FAIL');
});
test('production age: missing/invalid issue or lodging, future issue, and no intended-date fallback', () => {
  for (const issue_date of [null, 'invalid', '2021-02-29', '2031-01-01']) assert.equal(run(age, { passport: { issue_date } }).status, 'UNKNOWN');
  for (const lodging_date of [null, 'invalid', '2030-02-30']) assert.equal(run(age, { application: { lodging_date, intended_lodging_date: '2030-01-15' } }).status, 'UNKNOWN');
});
test('production age: leap-day anniversary CLAMP and no fixed-day conversion', () => {
  const passport = { issue_date: '2024-02-29' };
  const result = run(age, { passport, application: { lodging_date: '2034-02-28' } });
  assert.equal(result.status, 'PASS'); assert.equal(result.evaluation.boundary, '2034-02-28');
  assert.equal(run(age, { passport, application: { lodging_date: '2034-03-01' } }).status, 'FAIL');
  assert.equal(run(age, { passport: { issue_date: '2020-01-01' }, application: { lodging_date: '2030-01-01' } }).status, 'PASS');
  assert.equal((Date.parse('2030-01-01') - Date.parse('2020-01-01')) / 86400000, 3653);
  assert.equal(run(age, { passport: { issue_date: '2021-01-01' }, application: { lodging_date: '2031-01-02' } }).status, 'FAIL');
});
test('production age has no current-time dependency or entry/exit reference fallback', () => {
  class NoClockDate extends Date { constructor(...args) { if (!args.length) throw Error('Implicit clock'); super(...args); } static now() { throw Error('Implicit clock'); } }
  const context = vm.createContext({ Date: NoClockDate });
  for (const file of ['applicant-facts', 'evaluators', 'engine']) vm.runInContext(fs.readFileSync(path.join(root, `js/rules/${file}.js`), 'utf8'), context);
  context.payload = JSON.stringify(input({ trip: { intended_entry_date: '2040-01-01', intended_exit_date: '2040-02-01' } }));
  context.definition = JSON.stringify(age);
  assert.equal(vm.runInContext('VisaCheckRulesEngine.evaluateRule(VisaCheckApplicantFacts.normalizeApplicantFacts(JSON.parse(payload)), JSON.parse(definition)).status', context), 'PASS');
});
test('production blank pages: sufficient, insufficient, explicit zero, missing and malformed', () => {
  for (const [blank_pages, expected] of [[2, 'PASS'], [5, 'PASS'], [1, 'FAIL'], [0, 'FAIL'], [null, 'UNKNOWN'], ['2', 'UNKNOWN'], [-1, 'UNKNOWN'], [1.5, 'UNKNOWN'], [false, 'UNKNOWN']]) assert.equal(run(pages, { passport: { blank_pages } }).status, expected);
});
test('production rules preserve exact evidence/source pins and remain nonpublishable after PASS', () => {
  const expected = [[validity, ['EP001-04-B', 'EP001-04-C']], [age, ['EP001-04-E']], [pages, ['EP001-04-D']]];
  for (const [rule, ids] of expected) {
    const before = structuredClone(rule), result = run(rule);
    assert.deepEqual(result.source_refs, rule.source_refs);
    assert.equal(result.publication.release_ready, false);
    assert.equal(result.publication.status, 'DRAFT_NOT_PUBLISHABLE');
    assert.equal(rule.source_refs[0].source_revision, '0.2.0');
    assert.equal(read(rule.source_refs[0].path).source_id, 'EU-2009-810');
    assert.deepEqual(rule.source_refs[0].evidence_refs.map(e => e.evidence_id), ids);
    for (const ref of rule.source_refs[0].evidence_refs) {
      const evidence = read(ref.path);
      assert.equal(ref.revision, '0.1.0'); assert.equal(evidence.research_status, 'NEEDS_REVIEW');
      assert.ok(evidence.citations.some(c => c.source_id === 'EU-2009-810' && c.source_revision === '0.2.0'));
    }
    assert.deepEqual(rule, before);
    assert.equal(rule.warning_condition, undefined);
    assert.equal(result.status, 'PASS');
  }
});
test('production applicability is reusable by route, ordinary-document and application-stage scoped', () => {
  for (const rule of [validity, age, pages]) {
    assert.equal(rule.bundle_id, 'SCHENGEN_CORE'); assert.equal(rule.application_stage, 'visa_application');
    for (const destination_country of ['FR', 'ES', 'DE', 'XX']) assert.equal(run(rule, { trip: { destination_country }, passport: { issuing_country: 'YY' }, residence: { country: 'ZZ' } }).status, 'PASS');
    assert.equal(run(rule, { trip: { visa_regime: 'other' } }).status, 'NOT_APPLICABLE');
    assert.equal(run(rule, { passport: { document_type: 'other' } }).status, 'NOT_APPLICABLE');
    assert.equal(run(rule, { trip: { visa_regime: null } }).status, 'UNKNOWN');
    assert.equal(run(rule, { trip: { visa_type: 'other' } }).status, 'NOT_APPLICABLE');
  }
});
