const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { normalizeApplicantFacts: normalize } = require('../../js/rules/applicant-facts.js');
const { evaluateRule, evaluateRules, evaluateApplicability } = require('../../js/rules/engine.js');
const facts = amount => normalize({ supporting_evidence: { financial_means: { amount } }, trip: { purpose: 'TEST_PURPOSE' } });
const rule = () => ({ rule_id: 'RULE_TEST_MIN_VALUE', rule_revision: 'test.1', requirement: 'Synthetic value test; not a legal requirement', applicability: { always: true }, evaluator: 'minimum_numeric_value', parameters: { actual: { fact: 'supporting_evidence.financial_means.amount' }, minimum: 100 }, source_refs: [{ source_id: 'SYNTHETIC_ONLY', source_revision: 'test.1' }] });

test('generic discretionary exceptions preserve ordinary result and require explicit review', () => {
  const r = { ...rule(), exception_conditions: [{ condition: { fact: 'supporting_evidence.accommodation', op: 'eq', value: true }, behavior: 'REQUIRES_REVIEW', reason_code: 'SYNTHETIC_REVIEW_REQUIRED', when_statuses: ['FAIL'] }] };
  function run(amount, condition) {
    return evaluateRule(normalize({ supporting_evidence: { financial_means: { amount }, accommodation: condition } }), r);
  }
  assert.equal(run(99, false).status, 'FAIL');
  assert.equal(run(99, true).status, 'UNKNOWN');
  assert.equal(run(99, true).code, 'SYNTHETIC_REVIEW_REQUIRED');
  assert.equal(run(99, true).evaluation.status, 'FAIL');
  assert.equal(run(99, null).code, 'EXCEPTION_APPLICABILITY_UNKNOWN');
  assert.equal(run(99, 'malformed').status, 'UNKNOWN');
  for (const value of [true, false, null]) assert.equal(run(100, value).status, 'PASS');
  assert.equal(run(null, true).status, 'UNKNOWN');
  assert.equal(run(99, true).exception_evaluations[0].outcome, 'MATCH');
  r.exception_conditions[0].when_statuses = ['PASS'];
  assert.equal(run(100, true).status, 'UNKNOWN');
  assert.equal(run(100, null).status, 'PASS');
});
test('invalid exception configuration cannot silently grant or deny a requirement', () => {
  for (const exception_conditions of [null, [{}], [{ condition: { always: true }, behavior: 'GRANT', reason_code: 'TEST', when_statuses: ['FAIL'] }], [{ condition: {}, behavior: 'REQUIRES_REVIEW', reason_code: 'TEST', when_statuses: ['FAIL'] }]]) {
    assert.equal(evaluateRule(facts(99), { ...rule(), exception_conditions }).code, 'INVALID_EXCEPTION_CONFIGURATION');
  }
});

test('engine returns PASS, FAIL and UNKNOWN without coercing missing or malformed facts', () => {
  assert.equal(evaluateRule(facts(100), rule()).status, 'PASS');
  assert.equal(evaluateRule(facts(99), rule()).status, 'FAIL');
  for (const value of [null, undefined, '100', Infinity]) assert.equal(evaluateRule(facts(value), rule()).status, 'UNKNOWN');
});
test('false and zero are observable facts in engine bindings', () => {
  assert.equal(evaluateRule(facts(0), { ...rule(), parameters: { actual: { fact: 'supporting_evidence.financial_means.amount' }, minimum: 0 } }).status, 'PASS');
  assert.equal(evaluateRule(normalize({ supporting_evidence: { accommodation: false } }), { ...rule(), evaluator: 'boolean_requirement', parameters: { actual: { fact: 'supporting_evidence.accommodation' }, expected: false } }).status, 'PASS');
});
test('applicability distinguishes excluded and unknown routes with no geography inference', () => {
  const r = { ...rule(), applicability: { fact: 'trip.purpose', op: 'in', value: ['OTHER_TEST_PURPOSE'] } };
  assert.equal(evaluateRule(facts(100), r).status, 'NOT_APPLICABLE');
  assert.equal(evaluateRule(normalize(), r).status, 'UNKNOWN');
  assert.equal(evaluateRule(facts(100), { ...rule(), applicability: {} }).status, 'UNKNOWN');
});
test('composed applicability follows three-valued logic and explicit applicant conditions', () => {
  const match = { fact: 'trip.purpose', op: 'eq', value: 'TEST_PURPOSE' };
  const unknown = { fact: 'residence.country', op: 'eq', value: 'XX' };
  assert.equal(evaluateApplicability(facts(100), { all: [match, unknown] }).outcome, 'UNKNOWN');
  assert.equal(evaluateApplicability(facts(100), { any: [match, unknown] }).outcome, 'MATCH');
  assert.equal(evaluateApplicability(facts(100), { all: [{ not: match }, unknown] }).outcome, 'NO_MATCH');
  assert.equal(evaluateApplicability(facts(100), { not: unknown }).outcome, 'UNKNOWN');
  const condition = { fact: 'identity.applicant_conditions', op: 'contains', value: 'TEST_CONDITION' };
  assert.equal(evaluateApplicability(normalize({ identity: { applicant_conditions: ['TEST_CONDITION'] } }), condition).outcome, 'MATCH');
  assert.equal(evaluateApplicability(normalize({ identity: { applicant_conditions: [] } }), condition).outcome, 'NO_MATCH');
  assert.equal(evaluateApplicability(normalize(), condition).outcome, 'UNKNOWN');
});
test('warnings require explicit configured condition; they do not soften FAIL', () => {
  const r = { ...rule(), warning_condition: { evaluator: 'maximum_numeric_value', parameters: { actual: { fact: 'supporting_evidence.financial_means.amount' }, maximum: 105 }, source_refs: ['SYNTHETIC_WARNING_ONLY'] } };
  assert.equal(evaluateRule(facts(101), rule()).status, 'PASS');
  assert.equal(evaluateRule(facts(101), r).status, 'WARNING');
  assert.equal(evaluateRule(facts(106), r).status, 'PASS');
  assert.equal(evaluateRule(facts(99), r).status, 'FAIL');
  const result = evaluateRule(facts(101), r);
  assert.deepEqual(result.warning_evaluation.source_refs, ['SYNTHETIC_WARNING_ONLY']);
  r.warning_condition.parameters.actual = { fact: 'identity.age' };
  assert.equal(evaluateRule(facts(101), r).status, 'UNKNOWN');
});
test('result includes detached provenance, parameters, facts and versioned evaluator audit', () => {
  const r = rule(), model = facts(100), before = structuredClone({ r, model });
  const result = evaluateRule(model, r);
  assert.equal(result.rule_revision, 'test.1');
  assert.equal(result.evaluator.identifier, 'minimum_numeric_value');
  assert.equal(result.evaluator.version, '1.0.0');
  assert.equal(result.evaluated_parameters.actual, 100);
  assert.equal(result.relevant_facts['supporting_evidence.financial_means.amount'].value, 100);
  assert.deepEqual(result.source_refs, r.source_refs);
  result.source_refs[0].source_id = 'changed';
  assert.deepEqual({ r, model }, before);
  assert.deepEqual(evaluateRule(model, r), evaluateRule(model, r));
});
test('unsupported evaluator, malformed definition/binding and relationship resolution fail closed', () => {
  for (const r of [null, { ...rule(), evaluator: 'not_implemented' }, { ...rule(), parameters: { actual: { fact: 'identity.age', fallback: 100 }, minimum: 100 } }, { ...rule(), relationships: [{ type: 'replaces', rule_id: 'TEST_OTHER' }] }, { ...rule(), exempts: 'TEST_OTHER' }]) assert.equal(evaluateRule(facts(100), r).status, 'UNKNOWN');
  assert.throws(() => evaluateRules(facts(100), null), /rules must be an array/);
});
test('duplicate rule identities never silently choose a revision', () => {
  const results = evaluateRules(facts(100), [rule(), { ...rule(), rule_revision: 'test.2' }]);
  assert.ok(results.every(r => r.status === 'UNKNOWN' && r.code === 'AMBIGUOUS_RULE_REVISIONS'));
});
test('effective windows use a supplied assessment date; null is unresolved', () => {
  const r = { ...rule(), effective_from: '2032-01-01', effective_to: '2032-12-31' };
  assert.equal(evaluateRule(facts(100), r).status, 'UNKNOWN');
  assert.equal(evaluateRule(facts(100), r, { assessment_date: '2032-01-01' }).status, 'PASS');
  assert.equal(evaluateRule(facts(100), r, { assessment_date: '2033-01-01' }).status, 'NOT_APPLICABLE');
  assert.equal(evaluateRule(facts(100), { ...r, effective_to: null }, { assessment_date: '2032-01-01' }).status, 'UNKNOWN');
});
test('conflicting dates cannot reach a passing evaluator through valid individual values', () => {
  const model = normalize({ passport: { issue_date: '2032-06-01', expiry_date: '2031-01-01' } });
  assert.equal(evaluateRule(model, { ...rule(), evaluator: 'required_presence', parameters: { actual: { fact: 'passport.expiry_date' } } }).status, 'UNKNOWN');
});
test('isolated modules load as browser scripts without CommonJS or application changes', () => {
  const context = vm.createContext({});
  for (const name of ['applicant-facts', 'evaluators', 'engine', 'resolver']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../../js/rules', name + '.js'), 'utf8'), context);
  assert.equal(vm.runInContext("VisaCheckRulesEngine.evaluateRule(VisaCheckApplicantFacts.normalizeApplicantFacts({passport:{blank_pages:0}}), {rule_id:'TEST',rule_revision:'test.1',requirement:'Synthetic',applicability:{always:true},evaluator:'minimum_numeric_value',parameters:{actual:{fact:'passport.blank_pages'},minimum:0},source_refs:[]}).status", context), 'PASS');
  assert.equal(typeof context.VisaCheckRuleResolver.resolveRules, 'function');
});
