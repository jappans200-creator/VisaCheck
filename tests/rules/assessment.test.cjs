const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {assess,validateConfiguration}=require('../../js/rules/assessment.js');
const {assessReport}=require('../../js/rules/assessment-adapter.js');
const runtime=require('../../js/rules/runtime-release.js');
const {adapt}=require('../../js/rules/v1-form-adapter.js');
const {evaluate,select}=require('../../js/rules/v1-integration.js');
const {fields,config,assets,complete}=require('../v1-form-fixtures.cjs');
const {strong,community}=require('../assessment-fixtures.cjs');
const copy=v=>structuredClone(v);
const normal=()=>evaluate(adapt(complete(),fields,config),config,assets);
const check=(report=strong(),score=78)=>assessReport(report,community(score));
const changed=(status,id='SCHENGEN_TRAVEL_DOCUMENT_BLANK_PAGES')=>{const r=strong();r.legal.find(x=>x.rule_id===id).status=status;return r;};

for(const [score,band]of [[78,'STRONG_PROFILE'],[75.01,'STRONG_PROFILE'],[75,'NEEDS_ATTENTION'],[50,'NEEDS_ATTENTION'],[49,'PROFILE_NEEDS_WORK'],[0,'PROFILE_NEEDS_WORK']])test(`official clear and score ${score} produces ${band}`,()=>{
 const a=check(strong(),score);assert.equal(a.primary_status,band);assert.equal(a.official.status,'CLEAR_FOR_CONFIGURED_CHECKS');assert.equal(a.profile.score,score);assert.equal(a.profile.score_source,'COMMUNITY_MODEL');
});
for(const score of [78,45])test(`blocking FAIL overrides score ${score} without changing it`,()=>{
 const a=check(changed('FAIL'),score);assert.equal(a.primary_status,'REQUIREMENT_NOT_MET');assert.equal(a.official.status,'REQUIREMENT_NOT_MET');assert.equal(a.community.score,score);assert.equal(a.profile.score,score);assert.equal(a.profile.band,null);
});
test('material UNKNOWN is CHECK_REQUIRED, never FAIL or a green profile',()=>{
 const a=check(changed('UNKNOWN'));assert.equal(a.primary_status,'CHECK_REQUIRED');assert.equal(a.official.blockers.length,0);assert.equal(a.official.unknowns.length,1);assert.equal(a.completeness,'INCOMPLETE');
});
test('WARNING is ATTENTION only after blockers and critical unknowns',()=>{
 assert.equal(check(changed('WARNING')).primary_status,'ATTENTION');
 const r=changed('WARNING');r.legal[0].status='UNKNOWN';assert.equal(check(r).primary_status,'CHECK_REQUIRED');r.legal[0].status='FAIL';assert.equal(check(r).primary_status,'REQUIREMENT_NOT_MET');
});
test('missing expected result prevents false CLEAR',()=>{const r=strong();r.legal.shift();const a=check(r);assert.equal(a.primary_status,'CHECK_REQUIRED');assert.ok(a.diagnostics.some(d=>d.code==='MISSING_EXPECTED_RESULT'&&d.material));});
test('unresolved applicability and out-of-window NA cannot establish CLEAR',()=>{
 for(const status of ['PASS','NOT_APPLICABLE']){const r=strong();r.legal[0].status=status;r.legal[0].applicability.outcome='UNKNOWN';assert.equal(check(r).primary_status,'CHECK_REQUIRED');}
 const r=strong();r.legal[0].status='NOT_APPLICABLE';assert.equal(check(r).primary_status,'CHECK_REQUIRED');r.legal[0].applicability.outcome='NO_MATCH';assert.equal(check(r).primary_status,'STRONG_PROFILE');
});
test('readiness weakness is attention, not a legal failure',()=>{
 const r=strong();r.documents.find(d=>d.evidence_id==='SCHENGEN_FINANCIAL_EVIDENCE').status='MISSING';const a=check(r);assert.equal(a.official.status,'CLEAR_FOR_CONFIGURED_CHECKS');assert.equal(a.primary_status,'ATTENTION');assert.equal(a.readiness.needs_attention,1);
});
test('procedure unknowns and missing preparation files do not create legal failures',()=>{
 const r=strong();r.procedure.items[0].status='ACTION_REQUIRED';r.documents.find(d=>d.evidence_id==='APPLICATION_FORM').status='MISSING';const a=check(r);assert.equal(a.primary_status,'STRONG_PROFILE');assert.equal(a.procedure.needs_attention,2);assert.equal(a.official.blockers.length,0);
});
test('readiness alternatives count once; overlapping funds and discretionary intention are informational',()=>{
 const a=check(strong());assert.deepEqual([a.readiness.ready,a.readiness.needs_attention,a.readiness.unknown,a.readiness.not_applicable],[6,0,0,1]);
 assert.equal(a.readiness.contributing_results.length,7);assert.ok(!a.readiness.contributing_results.some(r=>['SCHENGEN_RETURN_FUNDS_EVIDENCE','SCHENGEN_INTENTION_INFORMATION'].includes(r.result_id)));
});
test('readiness unknown limits completeness and prevents a strong primary band',()=>{
 const r=strong();r.documents.find(d=>d.evidence_id==='SCHENGEN_FINANCIAL_EVIDENCE').status='UNKNOWN';const a=check(r);assert.equal(a.completeness,'LIMITED');assert.equal(a.official.status,'CLEAR_FOR_CONFIGURED_CHECKS');assert.equal(a.primary_status,'CHECK_REQUIRED');
});
test('research verification is provenance, not applicant incompleteness',()=>{const a=check(strong());assert.equal(a.completeness,'COMPLETE_FOR_CONFIGURED_SCOPE');assert.equal(a.provenance.publication.release_ready,false);assert.equal(a.provenance.publication.evidence_review_status,'NEEDS_REVIEW');});
for(const expiry of ['2030-12-10','2030-06-20'])test(`explicit generic IRP expiry ${expiry} gates assessment`,()=>{
 const r=strong(expiry),expected=expiry==='2030-12-10'?'STRONG_PROFILE':'REQUIREMENT_NOT_MET';assert.equal(check(r).primary_status,expected);assert.equal(check(r).community.score,78);
});
test('normal simplified form stays CHECK_REQUIRED with unchanged community 78',()=>{const r=normal();assert.equal(r.facts.trip.intended_return_date,null);const a=check(r);assert.equal(a.primary_status,'CHECK_REQUIRED');assert.ok(a.official.unknowns.some(x=>x.result_id==='FRANCE_IE_IRP_POST_RETURN_VALIDITY'));assert.equal(a.community.score,78);});
for(const [name,values,id]of [['passport',{expiry:'2030-07-01'},'SCHENGEN_TRAVEL_DOCUMENT_REMAINING_VALIDITY'],['90/180',{history:'yes',history_complete:'yes',stays:[{entry_date:'2030-01-01',exit_date:'2030-03-31',authorization_type:'SHORT_STAY'}]},'SCHENGEN_SHORT_STAY_90_IN_180']])test(`${name} genuine evaluated FAIL gates a high community score`,()=>{
 const r=evaluate(adapt(complete(values),fields,config),config,assets),a=check(r);assert.equal(a.primary_status,'REQUIREMENT_NOT_MET');assert.ok(a.official.blockers.some(x=>x.result_id===id));assert.equal(a.community.score,78);
});
for(const values of [{destination:'ES'},{residence:'AE'},{destination:'GB'}])test(`unsupported route has no profile conclusion ${JSON.stringify(values)}`,()=>{
 // Use explicit canonical residence to avoid treating an unavailable form option as a real observation.
 const adapted=adapt(complete(),fields,config);if(values.residence)adapted.model.facts.residence.country=values.residence;if(values.destination)adapted.model.facts.trip.destination_country=values.destination;
 const r=evaluate(adapted,config,assets),a=check(r);assert.equal(a.primary_status,'UNSUPPORTED');assert.equal(a.profile.band,null);assert.equal(a.profile.score,null);assert.equal(a.configuration_id,null);
});
test('partial coverage cannot produce a strong profile even with supplied passing results',()=>{const r=strong();r.route.status='PARTIAL';assert.equal(check(r).primary_status,'CHECK_REQUIRED');});
test('no usable community score is never zero and has a nonnumerical primary',()=>{
 for(const stats of [null,{percent:null,sampleSize:9},{percent:78,sampleSize:2},{percent:'78',sampleSize:9}]){const a=assessReport(strong(),{statistics:stats});assert.equal(a.profile.score,null);assert.equal(a.profile.band,null);assert.equal(a.primary_status,'CLEAR_FOR_CONFIGURED_CHECKS');assert.equal(a.completeness,'LIMITED');}
});
test('PASS/FAIL assessment never mutates community or underlying official results',()=>{
 for(const status of ['PASS','FAIL','UNKNOWN']){const r=changed(status),c=community(),before=JSON.stringify({r,c});assessReport(r,c);assert.equal(JSON.stringify({r,c}),before);}
});
test('deterministic explanation names actual blocking contributors and retains provenance',()=>{
 const a=check(strong('2030-06-20'));assert.equal(a.explanation.contributors.length,1);assert.equal(a.explanation.contributors[0].result_id,'FRANCE_IE_IRP_POST_RETURN_VALIDITY');assert.match(a.explanation.community_note,/78\/100.*does not override/);assert.equal(a.provenance.release_id,'VISACHECK_FRANCE_V1');assert.ok(a.actions.some(x=>x.result_ref.result_id==='FRANCE_IE_IRP_POST_RETURN_VALIDITY'));
});
test('conflicting assessment roles are rejected',()=>{const c=copy(assets.assessment);c.results.push({...c.results[0],role:'PROCEDURAL'});assert.throws(()=>validateConfiguration(c),/DUPLICATE_OR_CONFLICTING_ROLES/);});
test('explicit SPECIAL_REVIEW concern is attention rather than an invented legal failure',()=>{
 const r=strong();const binding=r.assessment_configuration.results.find(b=>b.result_id===r.legal[0].rule_id);
 // Clone policy before changing the test-only role assignment.
 r.assessment_configuration=copy(r.assessment_configuration);
 const local=r.assessment_configuration.results.find(b=>b.result_id===binding.result_id);local.role='SPECIAL_REVIEW';local.material=false;
 r.legal[0].status='UNKNOWN';const a=check(r);assert.equal(a.primary_status,'ATTENTION');assert.equal(a.official.blockers.length,0);
});
test('assessment configuration from another release cannot be reused',()=>{
 const r=strong();r.assessment_configuration=copy(r.assessment_configuration);r.assessment_configuration.release.release_id='OTHER_RELEASE';assert.throws(()=>check(r),/RELEASE_MISMATCH/);
});
test('unknown configured result identity and wrong revision are rejected by release validation',()=>{
 for(const field of ['result_id','revision']){const bad=copy(assets);bad.assessment.results[0][field]='NOT_REAL';assert.throws(()=>runtime.validateAssets(select(adapt(complete(),fields,config),config),bad),/UNKNOWN_ASSESSMENT_RESULT/);}
});
test('missing assessment pin, file and wrong version are rejected',()=>{
 const releases=copy(config.releases);releases[0].groups=releases[0].groups.filter(g=>!g.assets.some(a=>a.role==='assessment'));assert.throws(()=>runtime.validateRegistry(releases),/MISSING_ASSESSMENT/);
 for(const mode of ['missing','wrong']){const bad=copy(assets);if(mode==='missing')delete bad.assessment;else bad.assessment.revision='9.9.9';assert.throws(()=>evaluate(adapt(complete(),fields,config),config,bad),/MISSING_ASSET|ASSET_PIN_MISMATCH/);}
 const r=strong();delete r.assessment_configuration;const a=check(r);assert.equal(a.primary_status,'CHECK_REQUIRED');assert.ok(a.diagnostics.some(d=>d.code==='MISSING_ASSESSMENT_CONFIGURATION'));
});
test('unconfigured or duplicate observed results never silently establish CLEAR',()=>{
 const r=strong();r.legal.push({...r.legal[0],rule_id:'UNREVIEWED'});assert.equal(check(r).primary_status,'CHECK_REQUIRED');
 const duplicate=strong();duplicate.legal.push(copy(duplicate.legal[0]));assert.equal(check(duplicate).primary_status,'CHECK_REQUIRED');
});
test('generic assessment source contains no country/rule-specific branches',()=>{assert.doesNotMatch(fs.readFileSync('js/rules/assessment.js','utf8'),/France|Ireland|IRP|Schengen|FRANCE_IE_|SCHENGEN_|\bFR\b|\bIE\b/);});
test('test-only arbitrary result identities aggregate without route-specific code',()=>{
 const c=copy(assets.assessment);c.configuration_id='TEST_ONLY_POLICY';c.release={release_id:'TEST_ONLY_RELEASE',version:'0.0.1'};
 c.results=[{...c.results[0],asset_key:'test',result_id:'TEST_ONLY_RESULT',revision:'0.0.1'}];
 const a=assess({assessment_configuration:c,coverage:{status:'SUPPORTED',release_id:'TEST_ONLY_RELEASE',version:'0.0.1',selected_asset_keys:['test']},community_result:community(),official_results:[{asset_key:'test',result_kind:'official',result_id:'TEST_ONLY_RESULT',revision:'0.0.1',status:'PASS',applicability:{outcome:'MATCH'}}]});
 assert.equal(a.primary_status,'STRONG_PROFILE');assert.equal(a.official.contributing_results[0].result_id,'TEST_ONLY_RESULT');
});
