const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { normalizeApplicantFacts: normalize } = require('../../js/rules/applicant-facts.js');
const { evaluateRule } = require('../../js/rules/engine.js');
const root = path.resolve(__dirname, '../..');
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const rule = read('data/official-requirements/rules/SCHENGEN_SHORT_STAY_90_IN_180/0.1.0.json');
const date = n => new Date(Date.UTC(2026, 0, 1) + n * 86400000).toISOString().slice(0, 10);
const stay = (a, b, authorization_type = 'SHORT_STAY') => ({ entry_date: date(a), exit_date: date(b), authorization_type });
function run(start, end, history = [], status = 'COMPLETE', extra = {}) {
  return evaluateRule(normalize({ ...extra, trip: { visa_regime: 'schengen', visa_type: 'short_stay', intended_entry_date: date(start), intended_exit_date: date(end), stay_history_status: status, schengen_stay_history: history, ...extra.trip } }), rule);
}

test('production NONE: ten and ninety days PASS; ninety-one FAILs on day ninety-one', () => {
  assert.equal(run(0, 9, [], 'NONE').status, 'PASS');
  assert.equal(run(0, 89, [], 'NONE').status, 'PASS');
  const result = run(0, 90, [], 'NONE');
  assert.equal(result.status, 'FAIL'); assert.equal(result.evaluation.first_violation_date, date(90));
  assert.equal(result.evaluation.days_in_window, 91);
  assert.equal(result.evaluation.evaluated_proposed_days, 91);
});
test('production entry and exit both count, including the supplied ten-day example', () => {
  const r = run(0, 0, [], 'NONE', { trip: { intended_entry_date: '2026-06-01', intended_exit_date: '2026-06-10' } });
  assert.equal(r.evaluation.maximum_observed_days, 10);
  assert.equal(r.evaluation.evaluated_proposed_days, 10);
  assert.equal(run(0, 0, [], 'NONE').evaluation.maximum_observed_days, 1);
});
test('production combines historical presence and planned presence; reports first breach mid-trip', () => {
  const history = [stay(0, 79)];
  assert.equal(run(80, 89, history).status, 'PASS');
  const r = run(80, 94, history);
  assert.equal(r.status, 'FAIL'); assert.equal(r.evaluation.first_violation_date, date(90));
  assert.equal(r.evaluation.window_start, date(90 - 179));
  assert.equal(r.evaluation.window_end, date(90));
  assert.equal(r.evaluation.days_in_window, 91);
});
test('production combines multiple previous stays', () => {
  const history = [stay(0, 29), stay(40, 69), stay(80, 99)];
  assert.equal(run(100, 109, history).status, 'PASS');
  assert.equal(run(100, 110, history).status, 'FAIL');
});
test('production overlapping and duplicate intervals count each date once', () => {
  const history = [stay(0, 9), stay(4, 14), stay(0, 9)];
  const result = run(15, 89, history);
  assert.equal(result.status, 'PASS'); assert.equal(result.evaluation.maximum_observed_days, 90);
});
test('production excludes the two configured authorization types, but counts SHORT_STAY', () => {
  for (const type of ['RESIDENCE_PERMIT', 'LONG_STAY_VISA']) {
    const result = run(80, 169, [stay(0, 79, type)]);
    assert.equal(result.status, 'PASS'); assert.equal(result.evaluation.maximum_observed_days, 90);
  }
  assert.equal(run(80, 94, [stay(0, 79, 'SHORT_STAY')]).status, 'FAIL');
});
test('production materially unknown authorization is UNKNOWN', () => {
  for (const type of ['UNKNOWN', null, 'UNRECOGNIZED']) assert.equal(run(80, 94, [stay(0, 79, type)]).status, 'UNKNOWN');
});
test('production history confirmation is explicit; NONE needs no detailed intervals', () => {
  assert.equal(run(0, 9, [], 'NONE').status, 'PASS');
  assert.equal(run(0, 9, undefined, 'NONE', { trip: { schengen_stay_history: undefined } }).status, 'PASS');
  assert.equal(run(0, 9, [], 'UNKNOWN').status, 'UNKNOWN');
  assert.equal(run(0, 9, [], 'INCOMPLETE').status, 'UNKNOWN');
  assert.equal(run(0, 9, [], null).status, 'UNKNOWN');
  assert.equal(run(0, 9, null, 'COMPLETE').status, 'UNKNOWN');
  assert.equal(run(0, 9, [stay(-20, -10)], 'NONE').status, 'UNKNOWN');
});
test('production missing and invalid proposed dates never become FAIL', () => {
  for (const key of ['intended_entry_date', 'intended_exit_date']) for (const value of [null, 'bad', '2026-02-30']) assert.equal(run(0, 9, [], 'NONE', { trip: { [key]: value } }).status, 'UNKNOWN');
  assert.equal(run(10, 9, [], 'NONE').status, 'UNKNOWN');
});
test('production malformed historical intervals are not silently discarded', () => {
  for (const s of [{ ...stay(0, 9), entry_date: null }, { ...stay(0, 9), exit_date: null }, { ...stay(0, 9), exit_date: 'bad' }, stay(10, 9)]) assert.equal(run(80, 94, [s]).status, 'UNKNOWN');
});
test('production old days fall out daily while proposed days enter', () => {
  const r = run(180, 269, [stay(0, 89)]);
  assert.equal(r.status, 'PASS'); assert.equal(r.evaluation.maximum_observed_days, 90);
  assert.equal(r.evaluation.evaluated_proposed_days, 90);
  assert.equal(run(179, 179, [stay(0, 89)]).status, 'FAIL');
  assert.equal(run(180, 180, [stay(0, 89)]).status, 'PASS');
});
test('production has no calendar-year reset', () => {
  const history = [{ entry_date: '2025-10-03', exit_date: '2025-12-31', authorization_type: 'SHORT_STAY' }];
  assert.equal(run(0, 0, history).status, 'FAIL');
});
test('production has no new-visa reset and residence never reclassifies historical stays', () => {
  const history = [{ ...stay(0, 89), visa_id: 'OLD_VISA' }];
  const extra = { residence: { country: 'IE', permit_type: 'RESIDENCE_PERMIT' }, trip: { visa_id: 'NEW_VISA', visa_issue_date: date(89) } };
  assert.equal(run(90, 90, history, 'COMPLETE', extra).status, 'FAIL');
});
test('production has no fixed six-month or fixed-day-block reset', () => {
  assert.equal(run(180, 180, [stay(90, 179)]).status, 'FAIL');
  assert.equal(run(0, 0, [{ entry_date: '2026-04-02', exit_date: '2026-06-30', authorization_type: 'SHORT_STAY' }], 'COMPLETE', { trip: { intended_entry_date: '2026-07-01', intended_exit_date: '2026-07-01' } }).status, 'FAIL');
});
test('production audit retains facts, evaluator version, exact evidence/source pins and the evidence gap', () => {
  const result = run(0, 9, [], 'NONE');
  assert.equal(result.rule_id, rule.rule_id); assert.equal(result.rule_revision, '0.1.0');
  assert.equal(result.evaluator.identifier, 'rolling_presence_window'); assert.equal(result.evaluator.version, '1.0.0');
  assert.deepEqual(result.source_refs, rule.source_refs);
  assert.equal(result.relevant_facts['trip.stay_history_status'].value, 'NONE');
  assert.equal(result.publication.release_ready, false); assert.equal(result.publication.status, 'DRAFT_NOT_PUBLISHABLE');
  for (const ref of rule.source_refs) {
    assert.equal(read(ref.path).source_revision, ref.source_revision);
    for (const evidenceRef of ref.evidence_refs) {
      const e = read(evidenceRef.path);
      assert.equal(e.revision, evidenceRef.revision); assert.equal(e.research_status, 'NEEDS_REVIEW');
      assert.ok(e.citations.some(c => c.source_id === ref.source_id && c.source_revision === ref.source_revision));
    }
  }
  assert.equal(rule.evidence_gaps[0].status, 'EVIDENCE_GAP'); assert.deepEqual(rule.evidence_gaps[0].evidence_refs, []);
});
test('production rule remains reusable and no warning/probability/release is inferred', () => {
  for (const destination_country of ['FR', 'ES', 'XX']) assert.equal(run(0, 9, [], 'NONE', { trip: { destination_country }, passport: { issuing_country: 'YY' }, residence: { country: 'ZZ' } }).status, 'PASS');
  assert.equal(run(0, 9, [], 'NONE', { trip: { visa_regime: 'other' } }).status, 'NOT_APPLICABLE');
  assert.equal(rule.warning_condition, undefined);
  const r = run(0, 9, [], 'NONE'); assert.equal(r.probability, undefined); assert.equal(r.publication.release_ready, false);
});
