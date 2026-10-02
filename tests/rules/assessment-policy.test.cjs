const {test}=require('node:test');
const assert=require('node:assert/strict');
const {strong,community}=require('../assessment-fixtures.cjs');
const {fields,config,assets,complete}=require('../v1-form-fixtures.cjs');
const {adapt}=require('../../js/rules/v1-form-adapter.js');
const {evaluate}=require('../../js/rules/v1-integration.js');
const {normalizeApplicantFacts}=require('../../js/rules/applicant-facts.js');
const {assessReport}=require('../../js/rules/assessment-adapter.js');
const {validateConfiguration}=require('../../js/rules/assessment.js');
function fixture(change){const a=adapt(complete(),fields,config);const f=structuredClone(strong().facts);change(f);a.model=normalizeApplicantFacts(f);const report=evaluate(a,config,assets);return {report,a:assessReport(report,community())};}
const legal=(r,id)=>r.legal.find(x=>x.rule_id===id).status;
test('normal form has exactly one profile unknown and six verification unknowns',()=>{
 const r=evaluate(adapt(complete(),fields,config),config,assets),a=assessReport(r,community());
 assert.equal(a.primary_status,'CHECK_REQUIRED');assert.deepEqual(a.official.unknowns.map(x=>x.result_id),['FRANCE_IE_IRP_POST_RETURN_VALIDITY']);
 assert.equal(a.verification.unknown,6);assert.equal(a.verification.status,'NEEDS_VERIFICATION');assert.equal(a.timing.status,'NOT_ASSESSED');assert.equal(a.community.score,78);
});
test('detailed insurance unknowns remain unknown without blocking a clear profile',()=>{
 const {report,a}=fixture(f=>{f.supporting_evidence.travel_medical_insurance={present:true};});
 assert.equal(a.primary_status,'STRONG_PROFILE');assert.equal(a.verification.unknown,5);assert.equal(a.verification.ready,1);
 assert.equal(report.legal.filter(r=>r.rule_id.includes('INSURANCE')&&r.status==='UNKNOWN').length,5);assert.equal(a.completeness,'COMPLETE_FOR_CONFIGURED_SCOPE');
});
for(const [name,change,id] of [
 ['amount',f=>f.supporting_evidence.travel_medical_insurance.coverage_amount=10000,'SCHENGEN_INSURANCE_COVERAGE_AMOUNT'],
 ['dates',f=>f.supporting_evidence.travel_medical_insurance.valid_to='2030-06-05','SCHENGEN_INSURANCE_DATE_COVERAGE'],
 ['repatriation',f=>f.supporting_evidence.travel_medical_insurance.medical_repatriation_covered=false,'SCHENGEN_INSURANCE_MEDICAL_REPATRIATION'],
 ['emergency',f=>{f.supporting_evidence.travel_medical_insurance.emergency_medical_covered=false;f.supporting_evidence.travel_medical_insurance.hospital_treatment_covered=false;},'SCHENGEN_INSURANCE_EMERGENCY_OR_HOSPITAL_COVERAGE'],
 ['passport age',f=>f.passport.issue_date='2019-01-01','SCHENGEN_TRAVEL_DOCUMENT_MAX_AGE']
])test(`explicit ${name} failure escalates while preserving community`,()=>{const {report,a}=fixture(change);assert.equal(legal(report,id),'FAIL');assert.equal(a.primary_status,'REQUIREMENT_NOT_MET');assert.equal(a.verification.status,'ACTION_REQUIRED');assert.equal(a.community.score,78);assert.ok(a.escalations.some(x=>x.result_ref.result_id===id));});
for(const [date,status,primary]of [[null,'UNKNOWN','STRONG_PROFILE'],['2030-04-01','PASS','STRONG_PROFILE'],['2029-11-01','FAIL','ATTENTION']])test(`timing ${date}: separate planning status`,()=>{
 const {report,a}=fixture(f=>f.application.intended_lodging_date=date);assert.equal(legal(report,'SCHENGEN_EARLIEST_LODGING'),status);assert.equal(a.primary_status,primary);assert.equal(a.timing.status,status==='FAIL'?'ACTION_REQUIRED':status==='UNKNOWN'?'NOT_ASSESSED':'PASS');assert.equal(a.community.score,78);
});
test('actual lodging unknown is never replaced by known intended date or trip date',()=>{
 const {report,a}=fixture(f=>f.application.lodging_date=null);assert.equal(report.facts.application.lodging_date,null);assert.equal(legal(report,'SCHENGEN_TRAVEL_DOCUMENT_MAX_AGE'),'UNKNOWN');assert.equal(a.verification.unknown,1);assert.equal(a.primary_status,'STRONG_PROFILE');
});
test('explicit compliant actual lodging retains passport-age PASS',()=>{assert.equal(legal(strong(),'SCHENGEN_TRAVEL_DOCUMENT_MAX_AGE'),'PASS');});
test('profile unknown takes precedence over explicit verification failure, which remains actionable',()=>{const {a}=fixture(f=>{f.identity.country_of_origin=null;f.supporting_evidence.travel_medical_insurance.coverage_amount=100;});assert.equal(a.primary_status,'CHECK_REQUIRED');assert.equal(a.verification.status,'ACTION_REQUIRED');assert.equal(a.escalations.length,1);});
test('new role policy is versioned and constrained; old policy remains valid',()=>{
 validateConfiguration(require('../../data/official-requirements/assessment-configurations/FRANCE_V1_ASSESSMENT/0.1.0.json'));
 for(const patch of [{on_fail:'IGNORE'},{material:true},{result_kind:'procedure'}]){const c=structuredClone(assets.assessment);Object.assign(c.results.find(x=>x.role==='VERIFICATION'),patch);assert.throws(()=>validateConfiguration(c),/INVALID_STATUS_POLICY/);}
 const c=structuredClone(assets.assessment);c.schema_version='1.0.0';assert.throws(()=>validateConfiguration(c),/INVALID_STATUS_POLICY/);
});
test('verification fail escalation can be configured as attention without country branches',()=>{
 const {report}=fixture(f=>f.supporting_evidence.travel_medical_insurance.coverage_amount=100);
 report.assessment_configuration=structuredClone(report.assessment_configuration);report.assessment_configuration.results.find(r=>r.result_id==='SCHENGEN_INSURANCE_COVERAGE_AMOUNT').on_fail='ATTENTION';assert.equal(assessReport(report,community()).primary_status,'ATTENTION');
});
