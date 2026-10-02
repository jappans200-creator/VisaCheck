const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { normalizeApplicantFacts: normalize, getFact } = require('../../js/rules/applicant-facts.js');
const { evaluateRule } = require('../../js/rules/engine.js');
const { adapt } = require('../../js/rules/v1-form-adapter.js');
const { evaluate } = require('../../js/rules/v1-integration.js');
const { fields, config, assets, complete } = require('../v1-form-fixtures.cjs');
const validity = JSON.parse(fs.readFileSync('data/official-requirements/rules/FRANCE_IE_IRP_POST_RETURN_VALIDITY/0.1.0.json'));
const presence = JSON.parse(fs.readFileSync('data/official-requirements/rules/FRANCE_IE_IRP_DOCUMENT_PRESENCE/0.1.0.json'));
function input() {
  return {
    identity: { nationality: 'IN', country_of_origin: 'IN', applicant_conditions: ['ordinary_adult_applicant'] },
    passport: { issuing_country: 'IN', document_type: 'ordinary' },
    residence: { country: 'IE', legal_status: 'legal_resident', document: { issuing_country: 'IE', type: 'IRP', present: true, expiry_date: '2030-12-10' } },
    trip: { visa_regime: 'schengen', visa_type: 'short_stay', return_destination_country: 'IE', intended_return_date: '2030-06-10' },
    application: { competent_state: 'FR' }
  };
}
const run = raw => evaluateRule(normalize(raw), validity).status;

test('nationality, issuer, origin and residence are independent supplied facts', () => {
  const model = normalize({ identity: { nationality: 'BR', country_of_origin: 'IN' }, passport: { issuing_country: 'PT' }, residence: { country: 'IE' } });
  assert.equal(model.facts.identity.nationality, 'BR');
  assert.equal(model.facts.identity.country_of_origin, 'IN');
  assert.equal(model.facts.passport.issuing_country, 'PT');
  assert.equal(model.facts.residence.country, 'IE');
  assert.deepEqual(model.issues, []);
  assert.equal(normalize({ passport: { issuing_country: 'IN' } }).facts.identity.nationality, null);
  const onlyNationality = normalize({ identity: { nationality: 'IN' } }).facts;
  assert.equal(onlyNationality.passport.issuing_country, null);
  assert.equal(onlyNationality.identity.country_of_origin, null);
  assert.equal(onlyNationality.residence.country, null);
});

for (const country of ['AE', 'CA']) test(`synthetic ${country} residence document and return event require no jurisdiction-specific fields`, () => {
  const document = { issuing_country: country, type: 'TEST_DOCUMENT', present: false, expiry_date: '2031-01-01' };
  const model = normalize({ residence: { country, document }, trip: { return_destination_country: country, intended_return_date: '2030-06-12' } });
  assert.deepEqual(model.facts.residence.document, document);
  assert.equal(model.facts.trip.return_destination_country, country);
  assert.equal(model.facts.trip.intended_return_date, '2030-06-12');
  assert.equal(model.facts.trip.intended_return_to_ireland_date, null);
  assert.equal(model.facts.residence.irish_residence_card_expiry_date, null);
  assert.deepEqual(model.issues, []);
});

test('document presence and expiry never supply legal residence, permission expiry or renewal', () => {
  const model = normalize({ residence: { document: input().residence.document, permit_expiry_date: '2032-01-01' } });
  const r = model.facts.residence;
  assert.equal(r.country, null);
  assert.equal(r.legal_status, null);
  assert.equal(r.irish_permission_status, null);
  assert.equal(r.irish_irp_renewal_status, null);
  assert.equal(r.permit_expiry_date, '2032-01-01');
  assert.equal(r.document.expiry_date, '2030-12-10');
  assert.equal(normalize({ residence: { permit_expiry_date: '2032-01-01', legal_status: 'legal_resident' } }).facts.residence.document, null);
});

test('missing and partial generic facts remain missing, not false or inferred', () => {
  const empty = normalize().facts;
  assert.equal(empty.identity.nationality, null);
  assert.equal(empty.residence.document, null);
  assert.equal(empty.trip.return_destination_country, null);
  assert.equal(empty.trip.intended_return_date, null);
  const partial = normalize({ residence: { country: 'IE', document: { expiry_date: '2031-01-01' } }, trip: { intended_exit_date: '2030-06-10', relevant_schengen_departure_date: '2030-06-10' } }).facts;
  assert.deepEqual(partial.residence.document, { issuing_country: null, type: null, present: null, expiry_date: '2031-01-01' });
  assert.equal(partial.residence.irish_residence_card_expiry_date, null);
  assert.equal(partial.trip.intended_return_date, null);
  assert.equal(partial.trip.intended_return_to_ireland_date, null);
  assert.equal(partial.trip.return_destination_country, null);
});

test('generic country codes, document fields and dates use strict validation without coercion', () => {
  const model = normalize({ identity: { nationality: 'Indian' }, residence: { document: { issuing_country: 'Ireland', type: false, present: 'yes', expiry_date: '2030-02-30' } }, trip: { return_destination_country: 'ireland', intended_return_date: 'tomorrow' } });
  for (const path of ['identity.nationality', 'residence.document.issuing_country', 'residence.document.type', 'residence.document.present', 'residence.document.expiry_date', 'trip.return_destination_country', 'trip.intended_return_date']) assert.equal(getFact(model, path).state, 'INVALID', path);
  assert.equal(getFact(normalize({ residence: { document: [] } }), 'residence.document').state, 'INVALID');
});

for (const [expiry, expected] of [['2030-12-10', 'PASS'], ['2030-06-20', 'FAIL'], ['2030-07-10', 'PASS'], ['2030-07-09', 'FAIL']]) test(`generic IRP ${expiry} feeds unchanged one-calendar-month rule: ${expected}`, () => {
  const raw = input(); raw.residence.document.expiry_date = expiry;
  assert.equal(run(raw), expected);
  assert.equal(evaluateRule(normalize(raw), presence).status, 'PASS');
});

test('generic return uses existing CLAMP arithmetic at month end', () => {
  const raw = input(); raw.trip.intended_return_date = '2031-01-31';
  raw.residence.document.expiry_date = '2031-02-28';
  assert.equal(run(raw), 'PASS');
  raw.residence.document.expiry_date = '2031-02-27';
  assert.equal(run(raw), 'FAIL');
});

test('legacy-only, generic-only and matching dual return facts give equivalent rule outcomes', () => {
  const generic = input(), legacy = input(), dual = input();
  legacy.trip.intended_return_to_ireland_date = legacy.trip.intended_return_date;
  delete legacy.trip.intended_return_date; delete legacy.trip.return_destination_country;
  legacy.residence.irish_residence_card_present = true;
  legacy.residence.irish_residence_card_expiry_date = legacy.residence.document.expiry_date;
  delete legacy.residence.document;
  dual.trip.intended_return_to_ireland_date = dual.trip.intended_return_date;
  dual.residence.irish_residence_card_present = true;
  dual.residence.irish_residence_card_expiry_date = dual.residence.document.expiry_date;
  for (const raw of [generic, legacy, dual]) { assert.equal(run(raw), 'PASS'); assert.deepEqual(normalize(raw).issues, []); }
  assert.equal(normalize(legacy).facts.trip.intended_return_date, null);
});

test('return to another country, missing return and missing origin cannot satisfy Irish validity', () => {
  for (const country of ['AE', null]) {
    const raw = input(); raw.trip.return_destination_country = country;
    assert.equal(run(raw), 'UNKNOWN');
    assert.equal(normalize(raw).facts.trip.intended_return_to_ireland_date, null);
  }
  const raw = input(); delete raw.trip.intended_return_date;
  assert.equal(run(raw), 'UNKNOWN');
  const noOrigin = input(); delete noOrigin.identity.country_of_origin;
  assert.equal(run(noOrigin), 'UNKNOWN');
});

test('conflicting Irish return dates invalidate both bindings and evaluate UNKNOWN', () => {
  const raw = input(); raw.trip.intended_return_to_ireland_date = '2030-06-11';
  const model = normalize(raw);
  for (const path of ['trip.intended_return_date', 'trip.intended_return_to_ireland_date']) {
    assert.equal(getFact(model, path).state, 'INVALID');
    assert.ok(model.issues.some(i => i.path === path && i.code === 'CONFLICTING_FACTS'));
  }
  assert.equal(model.facts.trip.intended_return_date, '2030-06-10');
  assert.equal(model.facts.trip.intended_return_to_ireland_date, '2030-06-11');
  assert.equal(evaluateRule(model, validity).status, 'UNKNOWN');
});

test('non-Irish selected return plus legacy Irish return is flagged as conflicting, not silently selected', () => {
  const raw = input(); raw.trip.return_destination_country = 'AE'; raw.trip.intended_return_to_ireland_date = '2030-06-10';
  assert.equal(run(raw), 'UNKNOWN');
  assert.equal(getFact(normalize(raw), 'trip.return_destination_country').state, 'INVALID');
});

test('invalid return aliases cannot be overwritten or masked by a valid counterpart', () => {
  for (const field of ['intended_return_date', 'intended_return_to_ireland_date', 'return_destination_country']) {
    const raw = input(); raw.trip.intended_return_to_ireland_date = '2030-06-10'; raw.trip[field] = 'malformed';
    assert.equal(run(raw), 'UNKNOWN', field);
  }
});

test('document presence/expiry conflicts invalidate corresponding bindings and return UNKNOWN', () => {
  for (const [field, value, generic, rule] of [['irish_residence_card_present', false, 'present', presence], ['irish_residence_card_expiry_date', '2030-06-20', 'expiry_date', validity]]) {
    const raw = input(); raw.residence[field] = value;
    const model = normalize(raw);
    assert.equal(getFact(model, `residence.${field}`).state, 'INVALID');
    assert.equal(getFact(model, `residence.document.${generic}`).state, 'INVALID');
    assert.equal(evaluateRule(model, rule).status, 'UNKNOWN');
  }
});

test('malformed legacy and generic document dates cannot rescue one another', () => {
  for (const side of ['generic', 'legacy']) {
    const raw = input(); raw.residence.irish_residence_card_expiry_date = '2030-12-10';
    if (side === 'generic') raw.residence.document.expiry_date = 'malformed';
    else raw.residence.irish_residence_card_expiry_date = 'malformed';
    assert.equal(run(raw), 'UNKNOWN');
  }
});

test('foreign or unidentified documents never project into Irish bindings', () => {
  for (const changes of [{ issuing_country: 'AE' }, { issuing_country: null }, { type: 'TEST_DOCUMENT' }, { type: null }]) {
    const raw = input(); Object.assign(raw.residence.document, changes);
    assert.equal(normalize(raw).facts.residence.irish_residence_card_expiry_date, null);
    assert.equal(run(raw), 'UNKNOWN');
  }
});

test('contradictory selected-document identity and legacy card metadata are flagged', () => {
  for (const change of [{ issuing_country: 'AE' }, { type: 'TEST_DOCUMENT' }]) {
    const raw = input(); Object.assign(raw.residence.document, change);
    raw.residence.irish_residence_card_expiry_date = '2030-12-10';
    assert.equal(run(raw), 'UNKNOWN');
    assert.equal(getFact(normalize(raw), 'residence.document').state, 'INVALID');
  }
  const raw = input(); raw.residence.permit_type = 'STAMP 4 EUFAM';
  assert.equal(run(raw), 'UNKNOWN');
  assert.equal(normalize(raw).facts.residence.permit_type, 'STAMP 4 EUFAM');
});

test('adapter adds canonical nationality and document without collecting or inventing return/origin', () => {
  const adapted = adapt(complete(), fields, config), f = adapted.model.facts;
  assert.equal(f.identity.nationality, 'IN');
  assert.equal(adapted.route_input.nationality, 'IN');
  assert.equal(f.identity.country_of_origin, null);
  assert.deepEqual(f.residence.document, { issuing_country: 'IE', type: 'IRP', present: true, expiry_date: '2031-01-01' });
  assert.equal(f.trip.intended_return_date, null);
  assert.equal(f.trip.return_destination_country, null);
  assert.equal(f.trip.intended_return_to_ireland_date, null);
  assert.equal(evaluate(adapted, config, assets).legal.find(r => r.rule_id === validity.rule_id).status, 'UNKNOWN');
  for (const irp of ['no', 'unsure']) assert.equal(adapt(complete({ irp }), fields, config).model.facts.residence.document, null);
  const other = adapt(complete({ nationality: 'OTHER' }), fields, config);
  assert.equal(other.model.facts.identity.nationality, null);
  assert.equal(other.route_input.nationality, 'OTHER');
  assert.equal(evaluate(other, config, assets).route.status, 'UNSUPPORTED');
});

test('generic IRP and explicit return feed the full current integration through compatibility', () => {
  for (const [expiry, status] of [['2030-12-10', 'PASS'], ['2030-06-20', 'FAIL']]) {
    const adapted = adapt(complete(), fields, config), raw = structuredClone(adapted.model.facts);
    raw.identity.country_of_origin = 'IN';
    raw.residence.document.expiry_date = expiry;
    raw.residence.irish_residence_card_expiry_date = null;
    raw.trip.return_destination_country = 'IE'; raw.trip.intended_return_date = '2030-06-10';
    adapted.model = normalize(raw);
    const report = evaluate(adapted, config, assets);
    assert.equal(report.route.status, 'SUPPORTED');
    assert.equal(report.legal.find(r => r.rule_id === validity.rule_id).status, status);
  }
});

test('explicit generic IRP absence stays false and feeds the legacy presence rule', () => {
  const raw = input(); raw.residence.document.present = false;
  const model = normalize(raw);
  assert.equal(model.facts.residence.irish_residence_card_present, false);
  assert.equal(evaluateRule(model, presence).status, 'FAIL');
});

test('adapter mirrors malformed expiry diagnostics onto both document bindings', () => {
  const { model } = adapt(complete({ irp_expiry: '2030-02-30' }), fields, config);
  assert.equal(getFact(model, 'residence.document.expiry_date').state, 'INVALID');
  assert.equal(getFact(model, 'residence.irish_residence_card_expiry_date').state, 'INVALID');
  assert.equal(model.facts.residence.document.expiry_date, null);
});
