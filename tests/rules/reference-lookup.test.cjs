const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { classify } = require('../../js/rules/reference-lookup.js');
const fixture = () => ({ reference_id: 'TEST_REFERENCE', reference_version: 'test.1', source_version: 'synthetic', effective_from: null, effective_to: null, source_refs: ['TEST_SOURCE'], publication: { status: 'TEST_ONLY' }, key_pattern: '^TEST_[A-Z]+$', allowed_classifications: ['TEST_VALUE', 'TEST_OTHER'], coverage: { type: 'PARTIAL', supported_keys: ['TEST_A'] }, classifications: { TEST_A: { classification: 'TEST_VALUE', source_refs: ['TEST_ENTRY_SOURCE'] } } });
test('generic reference lookup resolves configured values and preserves version/source metadata', () => {
  const r = classify(fixture(), 'TEST_A');
  assert.equal(r.status, 'MATCH'); assert.equal(r.value, 'TEST_VALUE');
  assert.equal(r.reference_data_version, 'test.1'); assert.equal(r.source_version, 'synthetic');
  assert.deepEqual(r.source_refs, ['TEST_SOURCE']); assert.deepEqual(r.entry_source_refs, ['TEST_ENTRY_SOURCE']);
  assert.equal(r.effective_from, null);
});
test('partial coverage returns unsupported without an inferred default', () => {
  const r = classify(fixture(), 'TEST_B');
  assert.equal(r.status, 'UNSUPPORTED'); assert.equal(r.value, null); assert.equal(r.reason, 'UNSUPPORTED_REFERENCE_DATA');
  assert.equal(r.coverage.type, 'PARTIAL');
});
test('null and malformed keys are UNKNOWN, never coerced or aliased', () => {
  for (const key of [null, undefined, 0, {}, 'test_a', ' TEST_A ', 'TEST_A\n', '__proto__']) assert.equal(classify(fixture(), key).status, 'UNKNOWN');
});
test('generic reference data rejects mismatched coverage, unknown values and broken patterns', () => {
  const a = fixture(); a.coverage.supported_keys = [];
  const b = fixture(); b.classifications.TEST_A.classification = 'OTHER';
  const c = fixture(); c.key_pattern = '^[$';
  const d = fixture(); d.coverage.supported_keys.push('TEST_A');
  for (const data of [null, {}, a, b, c, d]) assert.equal(classify(data, 'TEST_A').reason, 'INVALID_REFERENCE_DATA');
});
test('lookup uses configuration for additional keys and classifications', () => {
  const d = fixture(); d.coverage.supported_keys.push('TEST_B'); d.classifications.TEST_B = { classification: 'TEST_OTHER', source_refs: [] };
  assert.equal(classify(d, 'TEST_B').value, 'TEST_OTHER');
});
test('lookup neither mutates input nor shares mutable result references', () => {
  const d = fixture(), before = structuredClone(d), r = classify(d, 'TEST_A');
  r.coverage.supported_keys.push('CHANGED'); r.source_refs.push('CHANGED');
  assert.deepEqual(d, before);
});
test('generic lookup contains no nationality or legal classification constants', () => {
  const code = fs.readFileSync(require.resolve('../../js/rules/reference-lookup.js'), 'utf8');
  assert.doesNotMatch(code, /\b(?:India|Schengen|ANNEX_I_VISA_REQUIRED|ANNEX_II_VISA_EXEMPT)\b|['"]IN['"]/);
});
