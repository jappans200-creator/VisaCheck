const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { evaluate } = require('../../js/rules/evaluators.js');
const { normalizeApplicantFacts: normalize, getFact } = require('../../js/rules/applicant-facts.js');
const date = n => new Date(Date.UTC(2032, 0, 1) + n * 86400000).toISOString().slice(0, 10);
const stay = (a, b, authorization_type = 'TEST_COUNTED') => ({ entry_date: date(a), exit_date: date(b), authorization_type });
const base = () => ({ maximum_days: 4, window_amount: 8, window_unit: 'CALENDAR_DAYS', direction: 'LOOKBACK_INCLUSIVE', entry_day_counts: true, exit_day_counts: true, excluded_authorization_types: ['TEST_EXCLUDED'], history_status: 'COMPLETE', history: [], proposed_entry_date: date(10), proposed_exit_date: date(12) });
const run = overrides => evaluate('rolling_presence_window', { ...base(), ...overrides });

test('generic presence includes entry and exit, including same-day visits', () => {
  assert.equal(run({}).maximum_observed_days, 3);
  assert.equal(run({ proposed_exit_date: date(10) }).maximum_observed_days, 1);
  assert.equal(run({ proposed_exit_date: date(13) }).status, 'PASS');
  const failure = run({ proposed_exit_date: date(14) });
  assert.equal(failure.status, 'FAIL'); assert.equal(failure.first_violation_date, date(14));
  assert.equal(failure.days_in_window, 5); assert.equal(failure.window_start, date(7));
  assert.equal(failure.window_end, date(14)); assert.equal(failure.maximum_days, 4);
});
test('rolling boundaries expire dates rather than resetting a counter', () => {
  assert.equal(run({ history: [stay(2, 2)] }).maximum_observed_days, 3);
  const r = run({ history: [stay(3, 6)] });
  assert.equal(r.first_violation_date, date(10));
  assert.equal(run({ history: [stay(0, 6)], maximum_days: 5 }).status, 'PASS');
});
test('overlaps, duplicate history and overlap with proposed dates count once', () => {
  const r = run({ history: [stay(8, 10), stay(9, 11), stay(8, 10)], maximum_days: 5 });
  assert.equal(r.status, 'PASS'); assert.equal(r.maximum_observed_days, 5);
});
test('excluded authorization types come from configuration', () => {
  assert.equal(run({ history: [stay(3, 9, 'TEST_EXCLUDED')] }).status, 'PASS');
  assert.equal(run({ history: [stay(3, 9, 'TEST_EXCLUDED')], excluded_authorization_types: [] }).status, 'FAIL');
});
test('materially unresolved authorization cannot become FAIL or a invented count', () => {
  for (const authorization_type of ['UNKNOWN', null, '', false]) {
    assert.equal(run({ history: [stay(3, 9, authorization_type)] }).status, 'UNKNOWN');
  }
});
test('unknown authorization outside windows, deduplicated, or unable to change compliance is harmless', () => {
  assert.equal(run({ history: [stay(0, 2, 'UNKNOWN')] }).status, 'PASS');
  assert.equal(run({ history: [stay(10, 12, 'UNKNOWN')] }).status, 'PASS');
  const r = run({ history: [stay(9, 9, 'UNKNOWN')] });
  assert.equal(r.status, 'PASS'); assert.equal(r.maximum_observed_days, 3); assert.equal(r.maximum_possible_days, 4);
});
test('uncertain earlier breach is not reported as an exact first violation', () => {
  const r = run({ history: [stay(9, 9, 'UNKNOWN')], proposed_exit_date: date(15) });
  assert.equal(r.status, 'UNKNOWN'); assert.equal(r.first_possible_violation_date, date(13));
  assert.equal(r.first_violation_date, undefined);
});
test('missing, malformed and reversed historical dates are never discarded', () => {
  for (const s of [null, {}, { ...stay(0, 1), entry_date: null }, { ...stay(0, 1), exit_date: null }, { ...stay(0, 1), entry_date: '2031-02-29' }, { ...stay(0, 1), exit_date: 'invalid' }, stay(9, 3)]) {
    assert.equal(run({ history: [s] }).status, 'UNKNOWN');
  }
  assert.equal(run({ history: [{ ...stay(0, 1, 'TEST_EXCLUDED'), exit_date: null }] }).status, 'UNKNOWN');
});
test('missing, malformed and reversed proposed dates are UNKNOWN', () => {
  for (const dateValue of [null, '', '2031-02-29', '2032-01-01T00:00:00Z']) {
    assert.equal(run({ proposed_entry_date: dateValue }).status, 'UNKNOWN');
    assert.equal(run({ proposed_exit_date: dateValue }).status, 'UNKNOWN');
  }
  assert.equal(run({ proposed_exit_date: date(9) }).status, 'UNKNOWN');
});
test('history assertions distinguish NONE, COMPLETE, INCOMPLETE and UNKNOWN', () => {
  for (const history_status of ['UNKNOWN', 'INCOMPLETE', null, 'invalid']) assert.equal(run({ history_status }).status, 'UNKNOWN');
  assert.equal(run({ history_status: 'NONE', history: null }).status, 'PASS');
  assert.equal(run({ history_status: 'NONE', history: [] }).status, 'PASS');
  assert.equal(run({ history_status: 'NONE', history: [stay(0, 1)] }).status, 'UNKNOWN');
  assert.equal(run({ history_status: 'COMPLETE', history: null }).status, 'UNKNOWN');
});
test('configuration changes window size and threshold without legal constants', () => {
  const p = { history: [stay(3, 9)] };
  assert.equal(run(p).status, 'FAIL');
  assert.equal(run({ ...p, window_amount: 4 }).status, 'PASS');
  assert.equal(run({ ...p, maximum_days: 8 }).status, 'PASS');
  assert.equal(run({ maximum_days: 0 }).status, 'FAIL');
});
test('unsupported windows and malformed config are UNKNOWN', () => {
  for (const p of [{ window_unit: 'DAYS' }, { window_unit: 'CALENDAR_MONTHS' }, { direction: 'FORWARD' }, { entry_day_counts: false }, { exit_day_counts: false }, { maximum_days: -1 }, { maximum_days: '4' }, { window_amount: 0 }, { window_amount: 1.5 }, { excluded_authorization_types: null }, { excluded_authorization_types: ['UNKNOWN'] }]) assert.equal(run(p).status, 'UNKNOWN');
  assert.equal(run({ proposed_entry_date: '0001-01-01', proposed_exit_date: '0001-01-02' }).status, 'UNKNOWN');
});
test('fact normalization preserves unknowns and only explicit NONE supplies empty history', () => {
  const noFacts = normalize(); assert.equal(noFacts.facts.trip.stay_history_status, null); assert.equal(noFacts.facts.trip.schengen_stay_history, null);
  assert.equal(normalize({ trip: { schengen_stay_history: [] } }).facts.trip.stay_history_status, null);
  const none = normalize({ trip: { stay_history_status: 'NONE' } });
  assert.deepEqual(none.facts.trip.schengen_stay_history, []);
  const unknown = normalize({ trip: { stay_history_status: 'UNKNOWN', schengen_stay_history: [] } });
  assert.equal(unknown.facts.trip.stay_history_status, 'UNKNOWN');
  const malformed = normalize({ trip: { stay_history_status: 'COMPLETE', schengen_stay_history: [{ entry_date: 'bad', exit_date: date(1), authorization_type: 'SHORT_STAY' }] } });
  assert.equal(getFact(malformed, 'trip.schengen_stay_history').state, 'INVALID');
  assert.equal(getFact(normalize({ trip: { stay_history_status: 'NONE', schengen_stay_history: [stay(0, 1, 'SHORT_STAY')] } }), 'trip.schengen_stay_history').state, 'INVALID');
});
test('optimized interval counts match an independent daily-set oracle', () => {
  let seed = 42;
  const random = n => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % n; };
  for (let i = 0; i < 150; i++) {
    const start = 20, end = start + random(16), window = 1 + random(17), limit = random(18);
    const intervals = Array.from({ length: random(9) }, () => { const a = random(25); return [a, a + random(12), random(2) === 0]; });
    const history = intervals.map(([a, b, excluded]) => stay(a, b, excluded ? 'TEST_EXCLUDED' : 'TEST_COUNTED'));
    let first = null, max = 0, breachCount;
    for (let d = start; d <= end; d++) {
      const present = new Set();
      for (const [a, b, excluded] of [...intervals, [start, end, false]]) if (!excluded) for (let v = a; v <= b; v++) if (v >= d - window + 1 && v <= d) present.add(v);
      max = Math.max(max, present.size);
      if (present.size > limit) { first = d; breachCount = present.size; break; }
    }
    const r = run({ history, proposed_entry_date: date(start), proposed_exit_date: date(end), window_amount: window, maximum_days: limit });
    assert.equal(r.status, first === null ? 'PASS' : 'FAIL'); assert.equal(r.maximum_observed_days, max);
    if (first !== null) { assert.equal(r.first_violation_date, date(first)); assert.equal(r.days_in_window, breachCount); }
  }
});
test('generic rolling implementation contains no legal amounts or geography', () => {
  const code = fs.readFileSync(require.resolve('../../js/rules/evaluators.js'), 'utf8');
  const body = code.slice(code.indexOf('function rollingPresenceWindow'), code.indexOf('const evaluators ='));
  assert.doesNotMatch(body, /\b(?:90|180|Schengen|France|India|Ireland)\b/i);
});
