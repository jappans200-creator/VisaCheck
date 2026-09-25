const { test } = require('node:test');
const assert = require('node:assert/strict');
const { evaluate, addPeriod } = require('../../js/rules/evaluators.js');
const status = (name, p) => evaluate(name, p).status;

test('numeric boundaries are inclusive, zero is real and no close-value warning is inferred', () => {
  for (const actual of [100, 101]) assert.equal(status('minimum_numeric_value', { actual, minimum: 100 }), 'PASS');
  assert.equal(status('minimum_numeric_value', { actual: 99, minimum: 100 }), 'FAIL');
  assert.equal(status('minimum_numeric_value', { actual: 0, minimum: 0 }), 'PASS');
  assert.equal(status('maximum_numeric_value', { actual: 100, maximum: 100 }), 'PASS');
  assert.equal(status('maximum_numeric_value', { actual: 101, maximum: 100 }), 'FAIL');
});
test('numeric missing and malformed inputs or thresholds are UNKNOWN', () => {
  for (const actual of [null, undefined, '', '100', false, NaN, Infinity, {}, []]) assert.equal(status('minimum_numeric_value', { actual, minimum: 100 }), 'UNKNOWN');
  assert.equal(status('maximum_numeric_value', { actual: 100, maximum: null }), 'UNKNOWN');
});
test('presence distinguishes explicit absence, unknown, concrete identifiers and malformed evidence', () => {
  for (const actual of [0, true, 'TEST-DOC']) assert.equal(status('required_presence', { actual }), 'PASS');
  assert.equal(status('required_presence', { actual: false }), 'FAIL');
  for (const actual of [null, '', {}, [], NaN]) assert.equal(status('required_presence', { actual }), 'UNKNOWN');
});
test('boolean requirements preserve false and never coerce strings or missing data', () => {
  assert.equal(status('boolean_requirement', { actual: false, expected: false }), 'PASS');
  assert.equal(status('boolean_requirement', { actual: false, expected: true }), 'FAIL');
  for (const actual of [null, 'false', 0]) assert.equal(status('boolean_requirement', { actual, expected: false }), 'UNKNOWN');
});
test('allowed values use strict explicit membership with invalid config UNKNOWN', () => {
  assert.equal(status('allowed_value', { actual: 'TEST_A', allowed: ['TEST_A', 'TEST_B'] }), 'PASS');
  assert.equal(status('allowed_value', { actual: 'TEST_C', allowed: ['TEST_A'] }), 'FAIL');
  assert.equal(status('allowed_value', { actual: false, allowed: [false] }), 'PASS');
  for (const allowed of [null, [], [null]]) assert.equal(status('allowed_value', { actual: 'TEST_A', allowed }), 'UNKNOWN');
});
test('calendar month arithmetic differs from fixed-day arithmetic', () => {
  const p = { reference_date: '2031-02-01', expiry_date: '2031-03-01', amount: 1 };
  assert.equal(status('minimum_remaining_validity', { ...p, unit: 'CALENDAR_MONTHS' }), 'PASS');
  assert.equal(status('minimum_remaining_validity', { ...p, amount: 30, unit: 'DAYS' }), 'FAIL');
  assert.equal(addPeriod('2031-02-01', 1, 'CALENDAR_MONTHS').value, '2031-03-01');
  assert.equal(addPeriod('2031-02-01', 30, 'CALENDAR_DAYS').value, '2031-03-03');
});
test('month-end and leap-year behavior requires explicit clamping or remains UNKNOWN', () => {
  assert.equal(addPeriod('2032-01-31', 1, 'CALENDAR_MONTHS').code, 'CALENDAR_OVERFLOW');
  assert.equal(addPeriod('2032-01-31', 1, 'CALENDAR_MONTHS', 'CLAMP').value, '2032-02-29');
  assert.equal(addPeriod('2032-02-29', 1, 'YEARS').code, 'CALENDAR_OVERFLOW');
  assert.equal(addPeriod('2032-02-29', 1, 'YEARS', 'CLAMP').value, '2033-02-28');
  assert.equal(addPeriod('2032-01-10', -1, 'CALENDAR_MONTHS').value, '2031-12-10');
});
test('document age uses explicit reference date and calendar boundary', () => {
  const p = { issue_date: '2031-05-07', reference_date: '2035-05-07', amount: 4, unit: 'YEARS' };
  assert.equal(status('maximum_document_age', p), 'PASS');
  assert.equal(status('maximum_document_age', { ...p, reference_date: '2035-05-08' }), 'FAIL');
  assert.equal(status('maximum_document_age', { ...p, reference_date: '2030-01-01' }), 'UNKNOWN');
  assert.equal(status('maximum_document_age', { ...p, reference_date: null }), 'UNKNOWN');
});
test('unsupported units, malformed dates, overflow and fractional calendar amounts are UNKNOWN', () => {
  const p = { expiry_date: '2033-01-01', reference_date: '2032-01-01', amount: 1 };
  for (const unit of ['WORKING_DAYS', 'HOURS', 'months', undefined]) assert.equal(status('minimum_remaining_validity', { ...p, unit }), 'UNKNOWN');
  for (const reference_date of ['2031-02-29', '2031-01-01T00:00:00Z', null]) assert.equal(status('minimum_remaining_validity', { ...p, reference_date, unit: 'DAYS' }), 'UNKNOWN');
  assert.equal(status('minimum_remaining_validity', { ...p, amount: 1.5, unit: 'CALENDAR_MONTHS' }), 'UNKNOWN');
  assert.equal(addPeriod('9999-12-31', 1, 'DAYS').code, 'DATE_OUT_OF_RANGE');
});
test('date windows have explicit optional exclusive endpoints and reject reversed bounds', () => {
  const p = { actual_date: '2032-06-07', start_date: '2032-06-07', end_date: '2032-06-14' };
  assert.equal(status('date_window', p), 'PASS');
  assert.equal(status('date_window', { ...p, include_start: false }), 'FAIL');
  assert.equal(status('date_window', { ...p, actual_date: '2032-06-14', include_end: false }), 'FAIL');
  assert.equal(status('date_window', { ...p, start_date: '2032-06-15' }), 'UNKNOWN');
  assert.equal(status('date_window', { ...p, include_start: 'yes' }), 'UNKNOWN');
});
test('unsupported evaluators and malformed parameter containers never crash', () => {
  for (const name of ['not_implemented', '__proto__', 'constructor', null]) assert.equal(status(name, {}), 'UNKNOWN');
  for (const p of [null, [], 'bad']) assert.equal(status('minimum_numeric_value', p), 'UNKNOWN');
});
test('unsupported evaluator parameters are not silently ignored', () => {
  assert.equal(evaluate('minimum_numeric_value', { actual: 100, minimum: 100, exclusive: true }).code, 'UNSUPPORTED_PARAMETER');
  assert.equal(evaluate('date_window', { actual_date: '2032-01-07', start_date: '2032-01-01', end_date: '2032-01-10', unit: 'WORKING_DAYS' }).status, 'UNKNOWN');
});
