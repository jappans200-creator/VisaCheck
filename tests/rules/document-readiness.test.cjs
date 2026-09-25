const { test } = require('node:test');
const assert = require('node:assert/strict');
const { normalizeApplicantFacts: normalize } = require('../../js/rules/applicant-facts.js');
const { evaluateReadiness } = require('../../js/rules/document-readiness.js');
const { evaluate } = require('../../js/rules/evaluators.js');
const definition = { evidence_id: 'TEST_EVIDENCE', revision: 'test.1', applicability: { always: true }, presence_alternatives: ['supporting_evidence.purpose.evidence_present'], source_refs: ['SYNTHETIC_SOURCE'], notes: ['Synthetic readiness only'] };
test('generic readiness separates present, missing, unknown and not applicable', () => {
  for (const [value, status] of [[true, 'PRESENT'], [false, 'MISSING'], [null, 'UNKNOWN'], ['true', 'UNKNOWN']]) {
    const r = evaluateReadiness(normalize({ supporting_evidence: { purpose: { evidence_present: value } } }), definition);
    assert.equal(r.status, status); assert.equal(r.assessment, 'ASSESSMENT_REQUIRED'); assert.equal(r.substantive_acceptance, 'NOT_DETERMINED'); assert.equal(r.approval_probability, undefined);
  }
  const r = evaluateReadiness(normalize({ trip: { purpose: 'TEST_A' } }), { ...definition, applicability: { fact: 'trip.purpose', op: 'eq', value: 'TEST_B' } });
  assert.equal(r.status, 'NOT_APPLICABLE');
});
test('generic alternatives use three-valued presence logic without treating unknown as absence', () => {
  const d = { ...definition, presence_alternatives: ['supporting_evidence.purpose.evidence_present', 'supporting_evidence.intention_to_leave.evidence_present'] };
  for (const [a, b, expected] of [[false, false, 'MISSING'], [false, null, 'UNKNOWN'], [true, null, 'PRESENT'], [false, true, 'PRESENT']]) {
    const m = normalize({ supporting_evidence: { purpose: { evidence_present: a }, intention_to_leave: { evidence_present: b } } });
    assert.equal(evaluateReadiness(m, d).status, expected);
  }
});
test('generic readiness preserves references without mutating input', () => {
  const m = normalize({ supporting_evidence: { purpose: { evidence_present: true } } }), before = structuredClone({ m, definition });
  const r = evaluateReadiness(m, definition); assert.deepEqual(r.source_refs, definition.source_refs);
  r.source_refs.push('CHANGED'); assert.deepEqual({ m, definition }, before);
});
test('generic unit comparison accepts matching units and refuses implicit conversion', () => {
  const p = { actual: 17, minimum: 17, actual_unit: 'TEST_UNIT', required_unit: 'TEST_UNIT' };
  assert.equal(evaluate('minimum_value_in_unit', p).status, 'PASS');
  assert.equal(evaluate('minimum_value_in_unit', { ...p, actual: 16 }).status, 'FAIL');
  for (const actual_unit of ['OTHER', null]) assert.equal(evaluate('minimum_value_in_unit', { ...p, actual_unit }).status, 'UNKNOWN');
});
test('generic interval coverage checks explicit inclusive dates, reversed and malformed inputs', () => {
  const p = { start_date: '2032-05-01', end_date: '2032-05-10', required_start_date: '2032-05-01', required_end_date: '2032-05-10' };
  assert.equal(evaluate('date_interval_coverage', p).coverage, 'COMPLETE');
  assert.equal(evaluate('date_interval_coverage', { ...p, start_date: '2032-05-02' }).coverage, 'PARTIAL');
  assert.equal(evaluate('date_interval_coverage', { ...p, start_date: '2032-06-01', end_date: '2032-06-02' }).coverage, 'NONE');
  for (const start_date of [null, 'invalid', '2032-05-11']) assert.equal(evaluate('date_interval_coverage', { ...p, start_date }).status, 'UNKNOWN');
});
