const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const read = p => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const { normalizeApplicantFacts: normalize } = require('../../js/rules/applicant-facts.js');
const { evaluateRule } = require('../../js/rules/engine.js');
const { evaluateReadiness } = require('../../js/rules/document-readiness.js');
const { evaluatePurposeRoute, evaluateBiometrics, evaluateSubmissionProcedure } = require('../../js/rules/application-procedure.js');
const config = id => read(`data/official-requirements/procedure-configurations/${id}/0.1.0.json`);
const purpose = config('FRANCE_SHORT_STAY_PURPOSES'), bio = config('SCHENGEN_BIOMETRICS_PROCEDURE'), procedure = config('FRANCE_IRELAND_SUBMISSION');
const timing = read('data/official-requirements/rules/SCHENGEN_EARLIEST_LODGING/0.1.0.json');
const files = read('data/official-requirements/document-readiness/FRANCE_APPLICATION_FILE/0.1.0.json');
const item = id => files.items.find(i => i.evidence_id === id);
function model(overrides = {}) {
  const base = { passport: { document_type: 'ordinary', issuing_country: 'IN' }, identity: { age: 30, applicant_conditions: [] }, residence: { country: 'IE' }, trip: { purpose: 'TOURISM', professional_activity_planned: false, family_settlement_planned: false, visa_regime: 'schengen', visa_type: 'short_stay', destination_country: 'FR', intended_entry_date: '2035-06-01', intended_exit_date: '2035-06-10' }, application: { lodging_date: '2034-11-30', intended_lodging_date: '2035-01-01', competent_state: 'FR' }, biometrics: { previous_schengen_biometrics_present: true, previous_biometrics_date: '2030-01-01', reuse_confirmed: false, physical_impossibility_status: 'NOT_DECLARED' } };
  for (const [k,v] of Object.entries(overrides)) base[k] = { ...base[k], ...v };
  return normalize(base);
}
const route = o => evaluatePurposeRoute(model(o), purpose);
const biometric = o => evaluateBiometrics(model(o), bio);
const process = o => evaluateSubmissionProcedure(model(o), procedure);
const ready = (id, application_file = {}, extra = {}) => evaluateReadiness(model({ ...extra, supporting_evidence: { ...extra.supporting_evidence, application_file } }), item(id));

test('3 tourism explicit purpose/no professional activity selects non-exhaustive route', () => {
  assert.equal(route().status, 'SUPPORTED'); assert.equal(route().purpose, 'TOURISM');
  assert.equal(model().facts.trip.purpose, 'tourism');
  assert.equal(route().checklist_completeness, 'NON_EXHAUSTIVE'); assert.equal(route().exact_document_list, 'VISA_ASSISTANT_DEPENDENT');
  assert.equal(route({ trip: { professional_activity_planned: true } }).reason, 'SPECIAL_OR_DIFFERENT_ROUTE_REQUIRED');
  for (const trip of [{ purpose: null }, { professional_activity_planned: null }, { family_settlement_planned: null }]) assert.equal(route({ trip }).status, 'UNKNOWN');
});
test('3 tourism duration scope remains separate from rolling short-stay eligibility', () => {
  assert.equal(route({ trip: { intended_exit_date: '2035-09-01' } }).reason, 'SPECIAL_OR_DIFFERENT_ROUTE_REQUIRED');
  assert.equal(route({ trip: { intended_exit_date: null } }).status, 'UNKNOWN');
});
test('3 existing supporting items and insurance are referenced, not duplicated', () => {
  const r = route();
  for (const ref of r.readiness_references) {
    const config = read(ref.path); assert.equal(config.revision, ref.revision); assert.ok(config.items.some(i => i.evidence_id === ref.evidence_id));
  }
  assert.equal(r.readiness_references.length, 8); assert.equal(r.rule_references.length, 6);
  for (const ref of r.rule_references) assert.equal(read(ref.path).rule_id, ref.rule_id);
});
test('3 private visit and private-host accommodation are independent', () => {
  const p = route({ trip: { purpose: 'PRIVATE_VISIT' }, supporting_evidence: { accommodation: { type: 'HOTEL' } } });
  assert.equal(p.status, 'SUPPORTED'); assert.equal(p.purpose, 'PRIVATE_VISIT'); assert.ok(p.coverage_gaps.includes('PRIVATE_VISIT_INSURANCE_SCOPE_REQUIRES_REVIEW'));
  assert.equal(route({ supporting_evidence: { accommodation: { type: 'PRIVATE_HOST' } } }).purpose, 'TOURISM');
  assert.equal(model({ trip: { purpose: 'PRIVATE_VISIT' } }).facts.supporting_evidence.accommodation, null);
});
test('3 family-settlement and special-family routes are not treated as ordinary visits', () => {
  assert.equal(route({ trip: { purpose: 'PRIVATE_VISIT', family_settlement_planned: true } }).reason, 'SPECIAL_OR_DIFFERENT_ROUTE_REQUIRED');
  for (const condition of ['family_reunification','eu_family_member','spouse_residence']) assert.equal(route({ identity: { applicant_conditions: [condition] } }).reason, 'SPECIAL_OR_DIFFERENT_ROUTE_REQUIRED');
});
test('3 private host requires original attestation as readiness only, including tourists', () => {
  for (const [original,status] of [[true,'PRESENT'],[false,'MISSING'],[null,'UNKNOWN']]) {
    const r = ready('FRANCE_PRIVATE_HOST_ORIGINAL_ATTESTATION', {}, { supporting_evidence: { accommodation: { type: 'PRIVATE_HOST', private_host_attestation_original_present: original, private_host_certificate_present: true } } });
    assert.equal(r.status,status); assert.equal(r.substantive_acceptance,'NOT_DETERMINED'); assert.equal(r.visa_approval,undefined);
  }
  assert.equal(ready('FRANCE_PRIVATE_HOST_ORIGINAL_ATTESTATION', {}, { supporting_evidence: { accommodation: { type: 'HOTEL' } } }).status,'NOT_APPLICABLE');
  assert.match(item('FRANCE_PRIVATE_HOST_ORIGINAL_ATTESTATION').notes.join(' '),/mairie/);
});
test('3 less-than-59-month window is strict and distinct from confirmation', () => {
  const potential = biometric(); assert.equal(potential.reuse_potential,true); assert.equal(potential.reuse_confirmed,false); assert.equal(potential.reason,'POTENTIAL_REUSE_REQUIRES_CONFIRMATION');
  assert.equal(potential.reuse_window.boundary,'2034-12-01'); assert.equal(potential.personal_attendance,'UNRESOLVED');
  const exact = biometric({ application: { lodging_date: '2034-12-01' } }); assert.equal(exact.reuse_potential,false); assert.equal(exact.reason,'NEW_COLLECTION_REQUIRED');
  assert.equal(biometric({ application: { lodging_date:'2034-12-02' } }).reuse_potential,false);
  assert.equal(biometric({ biometrics: { reuse_confirmed:true } }).reason,'REUSE_REPORTED_CONFIRMED');
});
test('3 biometric reuse requires explicit collection and lodging dates, not visa issuance or time', () => {
  for (const overrides of [{ biometrics: { previous_biometrics_date:null } },{ application:{ lodging_date:null } },{ biometrics:{ previous_biometrics_date:'2036-01-01' } }]) assert.equal(biometric(overrides).status,'UNKNOWN');
  assert.equal(biometric({ biometrics:{ previous_schengen_biometrics_present:false, previous_biometrics_date:null } }).personal_attendance,'GENERALLY_REQUIRED_FOR_INITIAL_COLLECTION');
});
test('3 fingerprint age exemption never implies attendance exemption; exact age boundary unresolved', () => {
  const child=biometric({identity:{age:11}});assert.equal(child.fingerprinting,'EXEMPT');assert.equal(child.personal_attendance,'UNRESOLVED');
  const boundary=biometric({identity:{age:12}});assert.equal(boundary.status,'UNKNOWN');assert.equal(boundary.reason,'AGE_BOUNDARY_REQUIRES_REVIEW');
  assert.equal(biometric({biometrics:{physical_impossibility_status:'DECLARED'}}).reason,'SPECIAL_BIOMETRIC_HANDLING_REQUIRED');
});
test('3 six calendar months earliest lodging inclusive, earlier fails and missing stays unknown', () => {
  for (const [intended_lodging_date,status] of [['2034-12-01','PASS'],['2034-11-30','FAIL'],['2035-01-01','PASS'],[null,'UNKNOWN']]) assert.equal(evaluateRule(model({application:{intended_lodging_date}}),timing).status,status);
});
test('3 earliest lodging uses calendar month ends and leap dates, not 180 days', () => {
  for (const [entry,earliest] of [['2031-08-31','2031-02-28'],['2032-08-31','2032-02-29'],['2035-10-01','2035-04-01']]) {
    const r=evaluateRule(model({trip:{intended_entry_date:entry,intended_exit_date:entry},application:{intended_lodging_date:earliest}}),timing);
    assert.equal(r.status,'PASS');assert.equal(r.evaluation.boundary,earliest);
  }
  assert.equal((Date.parse('2035-10-01')-Date.parse('2035-04-01'))/86400000,183);
});
test('3 legal latest-lodging conflict and working-day information never create timing FAIL', () => {
  assert.equal(evaluateRule(model({application:{intended_lodging_date:'2035-05-31'}}),timing).status,'PASS');
  const infos=procedure.operational_information;
  assert.equal(infos.find(i=>i.kind==='OPERATIONAL_RECOMMENDATION').amount,20);
  assert.equal(infos.find(i=>i.kind==='OPERATIONAL_RECOMMENDATION').calculated_deadline,null);
  const estimate=infos.find(i=>i.kind==='OPERATIONAL_ESTIMATE');assert.equal(estimate.minimum,10);assert.equal(estimate.maximum,15);assert.equal(estimate.guaranteed,false);
  assert.ok(infos.some(i=>i.code==='LATEST_LODGING_REQUIRES_REVIEW'));
  for (const i of infos) assert.equal(i.evaluator,undefined);
});
test('3 validation, appointment and submission are independent procedure states', () => {
  const r=process({application:{france_visas_form_validated:true,appointment_booked:false,submission_completed:true}});
  const states=Object.fromEntries(r.items.map(i=>[i.procedure_id,i]));
  assert.equal(states.ONLINE_VALIDATION.status,'READY');assert.equal(states.APPOINTMENT.status,'ACTION_REQUIRED');assert.equal(states.SUBMISSION.status,'READY');
  assert.equal(process({application:{france_visas_form_validated:false}}).items.find(i=>i.procedure_id==='ONLINE_VALIDATION').status,'ACTION_REQUIRED');
  assert.equal(process({application:{appointment_booked:true}}).items.find(i=>i.procedure_id==='APPOINTMENT').reason,'BOOKED');
  assert.equal(r.live_availability,'NOT_QUERIED');assert.match(r.decision_authority,/French/);assert.equal(r.intake_provider.name,'TLScontact');assert.match(r.intake_provider.role,/not decision authority/);
});
test('3 form, receipt and passport original/copy readiness are separate', () => {
  for (const [id,key] of [['APPLICATION_FORM','form_present'],['APPLICATION_RECEIPT','receipt_present'],['PASSPORT_ORIGINAL','passport_original_present'],['PASSPORT_COPY','passport_copy_present']]) assert.equal(ready(id,{[key]:true}).status,'PRESENT');
  assert.equal(ready('PASSPORT_COPY',{passport_original_present:true,passport_copy_present:false}).status,'MISSING');
});
test('3 two qualifying recent photographs are readiness, not image analysis', () => {
  assert.equal(ready('IDENTITY_PHOTOS',{identity_photo_count:2,identity_photos_qualifying_confirmed:true}).status,'PRESENT');
  assert.equal(ready('IDENTITY_PHOTOS',{identity_photo_count:1,identity_photos_qualifying_confirmed:true}).status,'MISSING');
  assert.equal(ready('IDENTITY_PHOTOS',{identity_photo_count:null,identity_photos_qualifying_confirmed:true}).status,'UNKNOWN');
  assert.equal(ready('IDENTITY_PHOTOS',{identity_photo_count:2,identity_photos_qualifying_confirmed:null}).status,'UNKNOWN');
});
test('3 supporting set presence does not establish exhaustive file or consular acceptance', () => {
  const r=ready('SUPPORTING_DOCUMENT_SET',{supporting_originals_present:true,supporting_copies_present:true});assert.equal(r.status,'PRESENT');assert.equal(r.substantive_acceptance,'NOT_DETERMINED');assert.equal(files.checklist_completeness,'NON_EXHAUSTIVE');
  assert.equal(ready('SUPPORTING_DOCUMENT_SET',{supporting_originals_present:true,supporting_copies_present:false}).status,'MISSING');
});
test('3 translation and passport return remain operational, not automatic refusal', () => {
  const r=process({supporting_evidence:{application_file:{document_languages:['de']}},application:{return_envelope_ready:false}});
  assert.equal(r.translation_diagnostic,'TRANSLATION_MAY_BE_REQUIRED');assert.equal(r.items.find(i=>i.procedure_id==='PASSPORT_RETURN').reason,'OPERATIONAL_ACTION_REQUIRED');
  const info=r.operational_information.find(i=>i.code==='PASSPORT_RETURN_ENVELOPE');assert.equal(info.amount,10);assert.equal(info.currency,'EUR');assert.equal(info.verified_at,null);assert.equal(info.evidence_status,'EVIDENCE_REFRESH_REQUIRED');assert.match(info.rejection_handling,/not supplied/);assert.equal(r.approval_probability,undefined);
});
test('3 exact evidence pins resolve while refresh-only claims have no fabricated citations', () => {
  for (const d of [purpose,bio,procedure,timing,...files.items]) {
    assert.equal(d.publication.status,'DRAFT_NOT_PUBLISHABLE');assert.equal(d.publication.release_ready,false);
    for (const s of d.source_refs) for (const pin of s.evidence_refs) {const e=read(pin.path);assert.equal(e.revision,pin.revision);assert.ok(e.citations.some(c=>c.source_id===s.source_id&&c.source_revision===s.source_revision));}
  }
  for (const gap of procedure.evidence_refresh_required) {assert.equal(gap.status,'EVIDENCE_REFRESH_REQUIRED');assert.deepEqual(gap.evidence_refs,[]);}
  assert.equal(procedure.intake_provider.reported_effective_from,'2026-05-12');
});
