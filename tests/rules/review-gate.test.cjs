const { test } = require('node:test');
const assert = require('node:assert/strict');
const { normalizeApplicantFacts: normalize } = require('../../js/rules/applicant-facts.js');
const { evaluateRule } = require('../../js/rules/engine.js');
const rule = { rule_id: 'TEST_CONTEXT', rule_revision: 'test.1', requirement: 'Synthetic', applicability: { always: true }, evaluator: 'condition_match', parameters: { condition: { fact: 'passport.blank_pages', op: 'eq', value: 7 } }, source_refs: [], review_gate: { ordinary_condition: { fact: 'identity.applicant_conditions', op: 'subset', value: ['TEST_ORDINARY'] }, affirmative_triggers: [], reason_code: 'TEST_REVIEW' } };
test('generic required context blocks even a passing ordinary condition when context is unknown', () => {
  const facts = conditions => normalize({ passport: { blank_pages: 7 }, identity: { applicant_conditions: conditions } });
  assert.equal(evaluateRule(facts([]), rule).status, 'PASS'); assert.equal(evaluateRule(facts(['TEST_ORDINARY']), rule).status, 'PASS');
  assert.equal(evaluateRule(facts(['TEST_SPECIAL']), rule).code, 'TEST_REVIEW'); assert.equal(evaluateRule(facts(null), rule).status, 'UNKNOWN');
});
test('generic condition-match distinguishes a known violation from missing facts', () => {
  const facts = count => normalize({ passport: { blank_pages: count }, identity: { applicant_conditions: [] } });
  assert.equal(evaluateRule(facts(6), rule).status, 'FAIL'); assert.equal(evaluateRule(facts(null), rule).status, 'UNKNOWN');
  assert.equal(evaluateRule(facts(7), { ...rule, review_gate: {} }).status, 'UNKNOWN');
  assert.equal(evaluateRule(facts(7), { ...rule, review_gate: { ...rule.review_gate, affirmative_triggers: [{ fact: 'passport.blank_pages', op: 'eq', value: 7 }] } }).code, 'TEST_REVIEW');
});
