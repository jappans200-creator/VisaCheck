const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../..');
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const { normalizeApplicantFacts: normalize } = require('../../js/rules/applicant-facts.js');
const { evaluateRule } = require('../../js/rules/engine.js');
const { evaluateReturnDiagnostic } = require('../../js/rules/return-diagnostic.js');
const load = id => read(`data/official-requirements/rules/${id}/0.1.0.json`);
const jurisdiction = load('FRANCE_IE_APPLICATION_JURISDICTION');
const presence = load('FRANCE_IE_IRP_DOCUMENT_PRESENCE');
const validity = load('FRANCE_IE_IRP_POST_RETURN_VALIDITY');
const config = read('data/official-requirements/diagnostics/IRELAND_RETURN_DOCUMENT_READINESS/0.1.0.json');
function model(overrides = {}) {
  const input = { passport: { issuing_country: 'IN', document_type: 'ordinary' }, identity: { country_of_origin: 'IN', applicant_conditions: ['ordinary_adult_applicant'] }, residence: { country: 'IE', legal_status: 'legal_resident', irish_permission_status: 'valid', irish_residence_card_present: true, irish_residence_card_expiry_date: '2030-08-15', irish_irp_renewal_status: 'NOT_APPLICABLE' }, trip: { visa_regime: 'schengen', visa_type: 'short_stay', intended_return_to_ireland_date: '2030-06-15' }, application: { competent_state: 'FR' }, travel: { irish_entry_visa_requirement_status: 'VISA_REQUIRED' } };
  for (const [key, value] of Object.entries(overrides)) input[key] = { ...input[key], ...value };
  return normalize(input);
}
const run = (rule, values) => evaluateRule(model(values), rule);
const back = values => evaluateReturnDiagnostic(model(values), config);

test('2A jurisdiction: confirmed IE legal residence and supplied France competence PASS', () => {
  assert.equal(run(jurisdiction).status, 'PASS');
});
test('2A jurisdiction: residence country is not proof of legal status', () => {
  for (const legal_status of [null, 'uncertain', 'pending']) assert.equal(run(jurisdiction, { residence: { legal_status } }).status, 'UNKNOWN');
});
test('2A jurisdiction: explicit nonresidence FAILs the Ireland route', () => {
  assert.equal(run(jurisdiction, { residence: { legal_status: 'not_legal_resident' } }).status, 'FAIL');
  assert.equal(run(jurisdiction, { residence: { country: 'GB' } }).status, 'FAIL');
});
test('2A competence is supplied, never inferred from a French destination or physical presence', () => {
  assert.equal(run(jurisdiction, { application: { competent_state: null }, trip: { destination_country: 'FR' }, travel: { physical_presence_country: 'IE' } }).status, 'UNKNOWN');
  assert.equal(run(jurisdiction, { application: { competent_state: 'ES' } }).status, 'NOT_APPLICABLE');
  assert.equal(run(jurisdiction, { application: { competent_state: 'uncertain' } }).status, 'UNKNOWN');
});
test('2A IRP presence: true PASS, false FAIL, missing/malformed UNKNOWN', () => {
  for (const [irish_residence_card_present, status] of [[true, 'PASS'], [false, 'FAIL'], [null, 'UNKNOWN'], ['true', 'UNKNOWN']]) assert.equal(run(presence, { residence: { irish_residence_card_present } }).status, status);
});
test('2A permission, physical presence, card presence and legal residence remain separate', () => {
  const m = model({ residence: { legal_status: null, irish_residence_card_present: false, irish_permission_status: 'valid' }, travel: { physical_presence_country: 'IE' } });
  assert.equal(m.facts.residence.legal_status, null); assert.equal(m.facts.residence.irish_residence_card_present, false);
  assert.equal(evaluateRule(m, jurisdiction).status, 'UNKNOWN');
  assert.equal(run(presence, { residence: { irish_residence_card_present: false, irish_permission_status: 'valid' } }).status, 'FAIL');
});
test('2A one calendar month: above/exact PASS; one day below FAIL', () => {
  for (const [irish_residence_card_expiry_date, status] of [['2030-07-16', 'PASS'], ['2030-07-15', 'PASS'], ['2030-07-14', 'FAIL']]) assert.equal(run(validity, { residence: { irish_residence_card_expiry_date } }).status, status);
});
test('2A month-end and leap-calendar CLAMP, not thirty fixed days', () => {
  for (const [returned, expiry] of [['2031-01-31', '2031-02-28'], ['2032-01-31', '2032-02-29'], ['2032-02-29', '2032-03-29']]) {
    const r = run(validity, { trip: { intended_return_to_ireland_date: returned }, residence: { irish_residence_card_expiry_date: expiry } });
    assert.equal(r.status, 'PASS'); assert.equal(r.evaluation.boundary, expiry);
  }
  assert.equal(run(validity, { trip: { intended_return_to_ireland_date: '2030-03-01' }, residence: { irish_residence_card_expiry_date: '2030-03-31' } }).status, 'FAIL');
});
test('2A missing/invalid return and card expiry UNKNOWN without passport/generic-permit fallback', () => {
  for (const value of [null, 'bad', '2031-02-29']) {
    assert.equal(run(validity, { trip: { intended_return_to_ireland_date: value } }).status, 'UNKNOWN');
    assert.equal(run(validity, { residence: { irish_residence_card_expiry_date: value, permit_expiry_date: '2040-01-01' }, passport: { expiry_date: '2040-01-01' } }).status, 'UNKNOWN');
  }
});
test('2A origin is explicit, not inferred from the nationality key', () => {
  assert.equal(run(validity, { identity: { country_of_origin: null } }).status, 'UNKNOWN');
  assert.equal(run(validity, { identity: { country_of_origin: 'malformed' } }).status, 'UNKNOWN');
  assert.equal(run(validity, { identity: { country_of_origin: 'IE' } }).status, 'NOT_APPLICABLE');
});
test('2A pending renewal never manufactures card evidence or a future expiry', () => {
  const m = model({ residence: { irish_irp_renewal_status: 'PENDING', irish_residence_card_expiry_date: null, irish_residence_card_present: null } });
  assert.equal(m.facts.residence.irish_residence_card_expiry_date, null); assert.equal(m.facts.residence.irish_residence_card_present, null);
  assert.equal(evaluateRule(m, validity).status, 'UNKNOWN'); assert.equal(evaluateRule(m, presence).status, 'UNKNOWN');
  assert.equal(run(validity, { residence: { irish_irp_renewal_status: 'PENDING', irish_residence_card_expiry_date: '2030-06-01' } }).status, 'FAIL');
  assert.equal(m.facts.residence.irish_irp_renewal_status, 'PENDING');
});
test('2A return: present valid card on return produces READY independently of renewal', () => {
  assert.equal(back().classification, 'RETURN_TO_IRELAND_READY');
  assert.equal(back({ residence: { irish_irp_renewal_status: 'PENDING' } }).classification, 'RETURN_TO_IRELAND_READY');
  assert.equal(back({ residence: { irish_residence_card_expiry_date: '2030-06-15' } }).classification, 'RETURN_TO_IRELAND_READY');
});
test('2A return: expired card plus pending renewal needs action and cautious D-visa guidance', () => {
  const r = back({ residence: { irish_residence_card_expiry_date: '2030-06-14', irish_irp_renewal_status: 'PENDING' } });
  assert.equal(r.classification, 'RETURN_TO_IRELAND_ACTION_REQUIRED'); assert.equal(r.reason, 'VALID_RETURN_DOCUMENT_REQUIRED');
  assert.equal(r.action_code, 'IRISH_GUIDANCE_MAY_REQUIRE_D_ENTRY_VISA_FROM_ABROAD'); assert.equal(r.final_entry_determination, false);
});
test('2A missing material Irish return facts stay UNKNOWN; completed renewal is not a new card', () => {
  for (const values of [{ travel: { irish_entry_visa_requirement_status: null } }, { travel: { irish_entry_visa_requirement_status: 'VISA_EXEMPT' } }, { residence: { irish_residence_card_expiry_date: null } }, { residence: { irish_residence_card_present: null } }, { trip: { intended_return_to_ireland_date: null } }, { residence: { irish_residence_card_expiry_date: '2030-06-14', irish_irp_renewal_status: 'COMPLETED' } }]) assert.equal(back(values).classification, 'RETURN_TO_IRELAND_UNKNOWN');
});
test('2A expiry fifteen days after return FAILs French rule but return can be READY', () => {
  const values = { residence: { irish_residence_card_expiry_date: '2030-06-30' } };
  assert.equal(run(validity, values).status, 'FAIL'); assert.equal(back(values).classification, 'RETURN_TO_IRELAND_READY');
});
test('2A diagnostic does not mutate or manufacture French failures', () => {
  const m = model({ residence: { irish_residence_card_expiry_date: '2030-06-14', irish_irp_renewal_status: 'PENDING' } });
  const before = structuredClone(m), french = evaluateRule(m, jurisdiction);
  assert.equal(french.status, 'PASS'); assert.equal(evaluateReturnDiagnostic(m, config).classification, 'RETURN_TO_IRELAND_ACTION_REQUIRED');
  assert.deepEqual(m, before); assert.deepEqual(evaluateRule(m, jurisdiction), french);
  assert.equal(back({ application: { competent_state: null }, trip: { visa_regime: null } }).classification, 'RETURN_TO_IRELAND_READY');
});
test('2A special routes require review instead of an invented determination', () => {
  for (const values of [{ passport: { document_type: 'diplomatic' } }, { residence: { permit_type: 'Stamp 4 EUFAM' } }, ...['minor', 'refugee', 'eu_family_member', 'emergency_re_entry', 'exceptional_nonresident_lodging'].map(c => ({ identity: { applicant_conditions: [c] } }))]) {
    for (const rule of [jurisdiction, presence, validity]) { const r = run(rule, values); assert.equal(r.status, 'UNKNOWN'); assert.equal(r.code, 'SPECIAL_ROUTE_REQUIRES_REVIEW'); }
    assert.equal(back(values).classification, 'RETURN_TO_IRELAND_UNKNOWN'); assert.equal(back(values).reason, 'SPECIAL_ROUTE_REQUIRES_REVIEW');
  }
  assert.equal(run(validity, { identity: { applicant_conditions: null } }).status, 'UNKNOWN');
});
test('2A metadata retains source/evidence pins and all outputs remain drafts', () => {
  for (const definition of [jurisdiction, presence, validity, config]) {
    assert.equal(definition.publication.status, 'DRAFT_NOT_PUBLISHABLE'); assert.equal(definition.publication.release_ready, false);
    for (const source of definition.source_refs) for (const pin of source.evidence_refs) {
      const e = read(pin.path); assert.equal(e.revision, pin.revision); assert.equal(e.research_status, 'NEEDS_REVIEW');
      assert.ok(e.citations.some(c => c.source_id === source.source_id && c.source_revision === source.source_revision));
    }
  }
  assert.deepEqual(back().source_refs, config.source_refs);
});
test('2A standalone return module works in the browser without UI integration', () => {
  const context = vm.createContext({});
  for (const name of ['applicant-facts', 'evaluators', 'engine', 'return-diagnostic']) vm.runInContext(fs.readFileSync(path.join(root, `js/rules/${name}.js`), 'utf8'), context);
  context.m = JSON.stringify(model()); context.c = JSON.stringify(config);
  assert.equal(vm.runInContext('VisaCheckReturnDiagnostic.evaluateReturnDiagnostic(JSON.parse(m), JSON.parse(c)).classification', context), 'RETURN_TO_IRELAND_READY');
});
