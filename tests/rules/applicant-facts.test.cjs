const { test } = require('node:test');
const assert = require('node:assert/strict');
const { normalizeApplicantFacts: normalize, getFact } = require('../../js/rules/applicant-facts.js');

test('no profile, purpose, document type, residence or observation defaults are invented', () => {
  const model = normalize();
  assert.deepEqual(model.issues, []);
  for (const group of Object.values(model.facts)) for (const value of Object.values(group)) assert.equal(value, null);
});
test('zero, false and explicit empty condition lists survive normalization', () => {
  const model = normalize({ identity: { age: 0, applicant_conditions: [] }, passport: { blank_pages: 0 }, supporting_evidence: { accommodation: false, financial_means: { amount: 0, confirmed: false } } });
  assert.equal(getFact(model, 'passport.blank_pages').value, 0);
  assert.equal(getFact(model, 'supporting_evidence.accommodation').value, false);
  assert.equal(getFact(model, 'supporting_evidence.financial_means.amount').value, 0);
  assert.deepEqual(model.facts.identity.applicant_conditions, []);
  assert.deepEqual(model.issues, []);
});
test('known missing markers stay null and country tokens are not guessed or mapped', () => {
  const model = normalize({ passport: { issuing_country: ' XX ', document_type: 'unknown' }, residence: { country: ' n/a ' }, trip: { purpose: ' ' } });
  assert.equal(model.facts.passport.issuing_country, 'XX');
  assert.equal(model.facts.passport.document_type, null);
  assert.equal(model.facts.residence.country, null);
  assert.equal(model.facts.trip.purpose, null);
});
test('invalid numbers, dates and malformed containers are reported and unavailable', () => {
  for (const value of [-1, '0', false, Infinity, NaN, 1.5]) {
    const model = normalize({ passport: { blank_pages: value } });
    assert.equal(getFact(model, 'passport.blank_pages').state, 'INVALID');
  }
  const model = normalize({ passport: { issue_date: '2031-02-29' }, residence: [], biometrics: { previous_biometrics_date: 'yesterday' } });
  assert.equal(model.facts.passport.issue_date, null);
  assert.equal(getFact(model, 'residence.country').state, 'INVALID');
  assert.equal(model.issues.length, 3);
  assert.equal(getFact(normalize(null), 'identity.age').state, 'INVALID');
});
test('conflicting chronological observations remain unavailable to rules', () => {
  const model = normalize({ passport: { issue_date: '2032-07-01', expiry_date: '2032-06-01' }, trip: { intended_entry_date: '2032-09-01', intended_exit_date: '2032-08-01' } });
  assert.equal(model.issues.length, 4);
  assert.equal(getFact(model, 'passport.expiry_date').state, 'INVALID');
  assert.equal(getFact(model, 'trip.intended_entry_date').state, 'INVALID');
});
test('multi-destination and evidence details are retained without choosing a jurisdiction', () => {
  const input = { trip: { destinations: [{ country: 'XX', duration_days: 7, purpose: 'test_a' }, { country: 'YY', purpose: 'test_b' }], intended_first_external_entry: 'YY' }, supporting_evidence: { itinerary: { confirmed: true, segments: [{ label: 'synthetic' }] } } };
  const before = structuredClone(input), model = normalize(input);
  assert.equal(model.facts.trip.destination_country, null);
  assert.equal(model.facts.trip.destinations[1].duration_days, null);
  assert.equal(getFact(model, 'trip.destinations.0.duration_days').value, 7);
  model.facts.supporting_evidence.itinerary.segments[0].label = 'changed';
  assert.deepEqual(input, before);
});
test('all requested applicant groups can hold explicit supplied facts', () => {
  const model = normalize({ identity: { date_of_birth: '2000-02-29', applicant_conditions: ['test_condition'] }, residence: { legal_status: 'test_status', permit_type: 'test_permit', permit_expiry_date: '2032-05-12' }, application: { intended_lodging_date: '2032-01-07' }, biometrics: { previous_biometrics_date: '2030-05-01', fingerprint_condition: 'test_condition' } });
  assert.deepEqual(model.issues, []);
  assert.equal(model.facts.identity.age, null);
  assert.equal(model.facts.application.intended_lodging_date, '2032-01-07');
});
test('fact lookup rejects unsafe paths and propagates nested malformed evidence', () => {
  const model = normalize({ supporting_evidence: { financial_means: { amount: Infinity } } });
  assert.equal(getFact(model, '__proto__.x').state, 'INVALID');
  assert.equal(getFact(model, 'supporting_evidence.financial_means').state, 'INVALID');
  assert.equal(getFact(model, 'supporting_evidence.financial_means.amount').state, 'INVALID');
});
