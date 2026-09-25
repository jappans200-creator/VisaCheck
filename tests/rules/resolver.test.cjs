const { test } = require('node:test');
const assert = require('node:assert/strict');
const { normalizeApplicantFacts: normalize } = require('../../js/rules/applicant-facts.js');
const { resolveRules } = require('../../js/rules/resolver.js');
const scope = (fact, value) => ({ fact, op: 'eq', value });
const config = () => ({ config_id: 'TEST_CONFIG', config_revision: 'test.1', review_status: 'REVIEWED', bundles: [{ bundle_id: 'TEST_SHARED', bundle_revision: 'test.1', rule_refs: [{ rule_id: 'RULE_TEST_A', rule_revision: 'test.1' }] }], coverage: [{ coverage_id: 'TEST_SCOPE', applicability: { all: [scope('trip.destination_country', 'XX'), scope('trip.visa_regime', 'TEST_REGIME')] }, completeness: 'COMPLETE', bundle_ids: ['TEST_SHARED'] }] });
const facts = (country = 'XX', regime = 'TEST_REGIME') => normalize({ trip: { destination_country: country, visa_regime: regime } });

test('reviewed configuration identifies bundles and reports coverage independently of compliance', () => {
  const result = resolveRules(facts(), config());
  assert.equal(result.coverage, 'SUPPORTED');
  assert.equal(result.candidate_bundles[0].bundle_id, 'TEST_SHARED');
  assert.deepEqual(result.config_ref, { config_id: 'TEST_CONFIG', config_revision: 'test.1' });
  assert.equal(Object.hasOwn(result, 'status'), false);
});
test('unsupported route is a dimension-specific coverage diagnostic, never FAIL', () => {
  const result = resolveRules(facts('YY'), config());
  assert.equal(result.coverage, 'UNSUPPORTED');
  assert.deepEqual(result.candidate_bundles, []);
  assert.ok(result.diagnostics.some(d => d.dimension === 'trip.destination_country' && d.code === 'DIMENSION_MISMATCH'));
  assert.ok(!JSON.stringify(result).includes('FAIL'));
});
test('missing dimension gives PARTIAL coverage with uncertain candidate bundles', () => {
  const result = resolveRules(facts('XX', null), config());
  assert.equal(result.coverage, 'PARTIAL');
  assert.equal(result.candidate_bundles[0].applicability, 'UNKNOWN');
  assert.ok(result.diagnostics.some(d => d.dimension === 'trip.visa_regime'));
});
test('resolver does not infer geography or regimes, including France and Schengen', () => {
  // Names here test absence of inference only; they encode no visa requirement.
  assert.equal(resolveRules(normalize({ trip: { destination_country: 'France' } }), config()).coverage, 'UNSUPPORTED');
  const c = config(); c.coverage[0].applicability = scope('trip.visa_regime', 'Schengen');
  assert.equal(resolveRules(normalize({ trip: { destination_country: 'France' } }), c).coverage, 'PARTIAL');
  assert.equal(normalize({ trip: { destination_country: 'France' } }).facts.trip.visa_regime, null);
});
test('shared bundles are reused by adding configuration, with no specificity overrides', () => {
  const c = config();
  c.coverage.push({ ...c.coverage[0], coverage_id: 'TEST_SCOPE_Y', applicability: scope('trip.destination_country', 'YY') });
  assert.equal(resolveRules(facts('YY'), c).coverage, 'SUPPORTED');
  c.coverage.push({ ...c.coverage[0], coverage_id: 'TEST_BROAD', applicability: { always: true } });
  assert.equal(resolveRules(facts(), c).candidate_bundles.length, 1);
});
test('partial coverage, missing bundles and unresolved relationships remain visible', () => {
  const partial = config(); partial.coverage[0].completeness = 'PARTIAL';
  assert.equal(resolveRules(facts(), partial).coverage, 'PARTIAL');
  const missing = config(); missing.bundles = [];
  assert.ok(resolveRules(facts(), missing).diagnostics.some(d => d.code === 'MISSING_BUNDLE'));
  const related = config(); related.bundles[0].relationships = [{ type: 'supplements', bundle_id: 'OTHER' }];
  assert.equal(resolveRules(facts(), related).coverage, 'PARTIAL');
});
test('unreviewed, invalid and ambiguous configuration is rejected without applicant failure', () => {
  const duplicate = config(); duplicate.bundles.push(duplicate.bundles[0]);
  for (const c of [null, {}, { ...config(), review_status: 'PENDING' }, { ...config(), replaces: 'OTHER_CONFIG' }, duplicate]) {
    const result = resolveRules(facts(), c);
    assert.equal(result.coverage, 'UNSUPPORTED');
    assert.equal(result.candidate_bundles.length, 0);
    assert.ok(result.diagnostics.length);
  }
});
test('resolution is deterministic, retains rule revision pins and does not mutate configuration', () => {
  const c = config(), before = structuredClone(c), result = resolveRules(facts(), c);
  assert.equal(result.candidate_bundles[0].rule_refs[0].rule_revision, 'test.1');
  result.candidate_bundles[0].rule_refs[0].rule_revision = 'changed';
  assert.deepEqual(c, before);
  assert.deepEqual(resolveRules(facts(), c), resolveRules(facts(), c));
});
