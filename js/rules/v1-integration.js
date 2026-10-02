(function(root,factory){
  const c=typeof module==='object'&&module.exports;
  const api=factory(...(c?[require('./engine.js'),require('./baseline-classifier.js'),require('./document-readiness.js'),require('./application-procedure.js'),require('./return-diagnostic.js'),require('./runtime-release.js')]:[root.VisaCheckRulesEngine,root.VisaCheckBaselineClassifier,root.VisaCheckDocumentReadiness,root.VisaCheckApplicationProcedure,root.VisaCheckReturnDiagnostic,root.VisaCheckRuntimeRelease]));
  if(c)module.exports=api;else root.VisaCheckV1Integration=api;
})(globalThis,function(engine,baseline,readiness,procedure,returnAPI,runtime){
  'use strict';
  function select(adapted,config){return runtime.resolve(adapted,config.releases);}
  function resolve(adapted,config){return select(adapted,config).route;}
  function evaluate(adapted,config,assets,context={}){
    const model=adapted.model,selection=select(adapted,config),route=selection.route;
    const evaluationContext=runtime.evaluationContext(selection,context);
    const report={preview:true,route,readiness_declarations:adapted.readiness_declarations||{},facts:model.facts,issues:model.issues,legal:[],documents:[],procedure:null,biometrics:null,irish_return:null,baseline:null,purpose:null,attention:[],source_refs:[]};
    report.runtime={release_id:selection.release?.release_id??null,version:selection.release?.version??null,publication:selection.release?.publication??null,evaluation_context:evaluationContext,asset_refs:selection.asset_refs};
    if(!selection.release)return report;
    runtime.validateAssets(selection,assets);
    const role=name=>selection.asset_refs.filter(ref=>ref.role===name);
    const one=name=>{const ref=role(name)[0];return ref?assets[ref.key]:null;};
    const purpose=one('purpose');
    if(purpose){
      report.purpose=procedure.evaluatePurposeRoute(model,purpose);
      if(report.purpose.status!=='SUPPORTED'&&route.status==='SUPPORTED'){route.status='PARTIAL';route.reason='Purpose or trip duration needs review; full configured scope is not established.';}
    }
    const baselineRule=one('baseline');
    if(baselineRule)report.baseline=baseline.classifyBaseline(model,baselineRule,one('reference'));
    const rules=role('rule').map(ref=>assets[ref.key]);
    report.legal=engine.evaluateRules(model,rules,evaluationContext).map((result,i)=>({...result,label:rules[i].requirement_name||rules[i].rule_id,requirement:rules[i].requirement||null,configured_parameters:rules[i].parameters}));
    for(const ref of role('readiness'))for(const d of assets[ref.key].items)report.documents.push({...readiness.evaluateReadiness(model,d),notes:d.notes,minimum_count:d.minimum_count||null,evidence_status:d.evidence_status,label:d.evidence_id});
    const biometrics=one('biometrics'),submission=one('submission'),returnConfig=one('return_diagnostic');
    if(biometrics)report.biometrics=procedure.evaluateBiometrics(model,biometrics);
    if(submission)report.procedure=procedure.evaluateSubmissionProcedure(model,submission);
    if(returnConfig){
      // Legacy report key retained; the selected diagnostic is configuration-driven.
      report.irish_return=returnAPI.evaluateReturnDiagnostic(model,returnConfig);
      report.irish_return.status=Object.entries(returnConfig.results).find(([,value])=>value===report.irish_return.classification)?.[0].toUpperCase()||'UNKNOWN';
    }
    const reporting=selection.release.report;
    report.assessment_configuration=one('assessment');
    const add=(items,priority,section,predicate)=>items.filter(predicate).forEach(r=>report.attention.push({priority,section,result:r}));
    add(report.legal,1,'Official check',r=>r.status==='FAIL');add(report.legal,2,'Official check',r=>r.status==='UNKNOWN');
    add(report.documents.filter(r=>reporting.document_attention_ids.includes(r.evidence_id)),3,'Document',r=>r.status==='MISSING');add(report.documents.filter(r=>reporting.document_attention_ids.includes(r.evidence_id)),4,'Document',r=>r.status==='UNKNOWN');
    // Preparation tasks are checklist guidance, not missing-answer penalties.
    // Irish return remains in the internal model; it is outside the initial assessment UX.
    add(report.documents,6,'Assessment',r=>reporting.assessment_ids.includes(r.evidence_id));
    report.attention.sort((a,b)=>a.priority-b.priority);
    return report;
  }
  return {select,resolve,evaluate};
});
