(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./applicant-facts.js'):root.VisaCheckApplicantFacts);if(typeof module==='object'&&module.exports)module.exports=api;else root.VisaCheckMaterialQuestions=api;})(globalThis,function(factsAPI){
'use strict';
const questions={origin:['identity.country_of_origin'],return:['trip.return_destination_country','trip.intended_return_date']};
function validate(c,pin){
 if(!c||c.schema_version!=='1.0.0'||c.configuration_id!==pin.configuration_id||c.revision!==pin.revision||!c.release||!c.assessment||!Array.isArray(c.dependencies))throw new Error('Invalid question configuration');
 const seen=new Set();
 for(const d of c.dependencies){
  const key=d.result_id+'@'+d.revision+'@'+d.observed_fact;
  if(!d.result_id||!d.revision||typeof d.observed_fact!=='string'||!['USER_INPUT','DERIVED','SYSTEM'].includes(d.source)||!questions[d.question]||JSON.stringify(d.facts)!==JSON.stringify(questions[d.question])||seen.has(key))throw new Error('Invalid question dependency');
  seen.add(key);
 }
 return c;
}
function resolve(report,c,answers={}){
 if(!c||report.route.status==='UNSUPPORTED'||report.runtime?.release_id!==c.release.release_id||report.runtime?.version!==c.release.version||report.assessment_configuration?.configuration_id!==c.assessment.configuration_id||report.assessment_configuration?.revision!==c.assessment.revision)return [];
 const selected=new Set(report.runtime.asset_refs.map(r=>r.key)),needed=new Set();
 for(const d of c.dependencies){
  if(d.source!=='USER_INPUT')continue;
  const binding=report.assessment_configuration.results.find(b=>b.result_kind==='official'&&b.result_id===d.result_id&&b.revision===d.revision&&b.role==='BLOCKING'&&b.material&&selected.has(b.asset_key));
  if(!binding)continue;
  const r=report.legal.find(r=>r.rule_id===d.result_id&&r.rule_revision===d.revision),fact=r?.relevant_facts?.[d.observed_fact];
  // Keep answered controls editable, but only while their dependency is evaluated.
  // Applicability short-circuiting prevents unnecessary evaluator questions.
  if(fact&&(r.status==='UNKNOWN'&&fact.state!=='KNOWN'||answers[d.question]))needed.add(d.question);
 }
 return [...needed];
}
function apply(adapted,answers,enabled){
 const raw=JSON.parse(JSON.stringify(adapted.model.facts));
 if(enabled.includes('origin'))raw.identity.country_of_origin=answers.origin||null;
 if(enabled.includes('return')){
  raw.trip.return_destination_country=answers.return==='yes'?raw.residence.country:answers.return==='no'?answers.return_country||null:null;
  raw.trip.intended_return_date=answers.return==='yes'||answers.return==='no'&&answers.return_country?answers.return_date||null:null;
 }
 const model=factsAPI.normalizeApplicantFacts(raw);model.issues.push(...adapted.model.issues);
 return {...adapted,model};
}
function change(answers,key,value){
 const next={...answers,[key]:value};
 if(key==='return'){delete next.return_country;delete next.return_date;}
 if(key==='return_country')delete next.return_date;
 return next;
}
return {validate,resolve,apply,change};
});
