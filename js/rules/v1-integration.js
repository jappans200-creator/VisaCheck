(function(root,factory){
  const c=typeof module==='object'&&module.exports;
  const api=factory(...(c?[require('./engine.js'),require('./baseline-classifier.js'),require('./document-readiness.js'),require('./application-procedure.js'),require('./return-diagnostic.js')]:[root.VisaCheckRulesEngine,root.VisaCheckBaselineClassifier,root.VisaCheckDocumentReadiness,root.VisaCheckApplicationProcedure,root.VisaCheckReturnDiagnostic]));
  if(c)module.exports=api;else root.VisaCheckV1Integration=api;
})(globalThis,function(engine,baseline,readiness,procedure,returnAPI){
  'use strict';
  // Narrow preview coverage selection. Existing rule applicability remains authoritative.
  function resolve(adapted,config){
    const f=adapted.model.facts,s=config.supported;
    const dimensions=[[adapted.route_input.nationality,s.nationality],[f.passport.issuing_country,s.issuer],[f.passport.document_type,s.document],[f.residence.country,s.residence],[f.trip.destination_country,s.destination],[f.trip.destination_territory,s.territory],[f.trip.visa_regime,s.regime],[f.trip.visa_type,s.visa_type]];
    const route={status:'SUPPORTED',reason:'Tourism preview coverage',assumptions:adapted.assumptions,route_id:dimensions.map(d=>d[0]||'unknown').concat(f.trip.purpose||'unknown').join(':')};
    if(dimensions.some(([v,w])=>v!==null&&v!==w)||f.identity.age!==null&&f.identity.age<config.adult_minimum_age||f.identity.applicant_conditions?.some(v=>v!=='ordinary_adult_applicant')||f.trip.professional_activity_planned===true||f.trip.family_settlement_planned===true||f.residence.permit_type==='STAMP 4 EUFAM')return {...route,status:'UNSUPPORTED',reason:'This profile needs a different or special route.'};
    if(f.trip.purpose!==null&&!['tourism','private_visit'].includes(f.trip.purpose))return {...route,status:'UNSUPPORTED',reason:'This purpose is outside V1 coverage.'};
    if(dimensions.some(([v])=>v===null)||adapted.route_input.single_trip!==true||f.identity.age===null||!f.identity.applicant_conditions||f.residence.legal_status!=='legal_resident'||f.trip.professional_activity_planned===null||f.trip.family_settlement_planned===null||f.trip.purpose===null)return {...route,status:'PARTIAL',reason:'Route facts are incomplete, or a single-country ordinary route is not established.'};
    if(f.trip.purpose==='private_visit')return {...route,status:'PARTIAL',reason:'Some private-visit requirements are still under review, including insurance coverage.'};
    return route;
  }
  function evaluate(adapted,config,assets){
    const model=adapted.model,route=resolve(adapted,config);
    const report={preview:true,route,facts:model.facts,issues:model.issues,legal:[],documents:[],procedure:null,biometrics:null,irish_return:null,baseline:null,purpose:null,attention:[],source_refs:[]};
    if(route.status==='UNSUPPORTED')return report;
    const asset=id=>{if(!assets[id])throw new Error('Missing preview configuration: '+id);return assets[id];};
    report.purpose=procedure.evaluatePurposeRoute(model,asset('FRANCE_SHORT_STAY_PURPOSES'));
    if(report.purpose.status!=='SUPPORTED'&&route.status==='SUPPORTED'){route.status='PARTIAL';route.reason='Purpose or trip duration needs review; full tourism scope is not established.';}
    report.baseline=baseline.classifyBaseline(model,asset('SCHENGEN_SHORT_STAY_VISA_REQUIREMENT_BASELINE'),asset('nationality_reference'));
    for(const [id,d] of Object.entries(assets))if(d.rule_id&&d.evaluator!=='reference_classification')report.legal.push({...engine.evaluateRule(model,d),label:d.requirement_name||id,requirement:d.requirement||null});
    // Do not run France-specific conclusions when competence is unresolved.
    if(adapted.route_input.single_trip!==true)report.legal=report.legal.filter(r=>!r.rule_id.startsWith('FRANCE_'));
    const franceEstablished=adapted.route_input.single_trip===true&&model.facts.trip.destination_country===config.supported.destination;
    for(const id of ['SCHENGEN_SUPPORTING_EVIDENCE',...(franceEstablished?['FRANCE_APPLICATION_FILE']:[])])for(const d of asset(id).items)report.documents.push({...readiness.evaluateReadiness(model,d),notes:d.notes,evidence_status:d.evidence_status, label:d.evidence_id});
    report.biometrics=procedure.evaluateBiometrics(model,asset('SCHENGEN_BIOMETRICS_PROCEDURE'));
    if(franceEstablished)report.procedure=procedure.evaluateSubmissionProcedure(model,asset('FRANCE_IRELAND_SUBMISSION'));
    const returnConfig=asset('IRELAND_RETURN_DOCUMENT_READINESS');
    report.irish_return=returnAPI.evaluateReturnDiagnostic(model,returnConfig);
    report.irish_return.status=Object.entries(returnConfig.results).find(([,value])=>value===report.irish_return.classification)?.[0].toUpperCase()||'UNKNOWN';
    const add=(items,priority,section,predicate)=>items.filter(predicate).forEach(r=>report.attention.push({priority,section,result:r}));
    add(report.legal,1,'Official check',r=>r.status==='FAIL');add(report.legal,2,'Official check',r=>r.status==='UNKNOWN');
    add(report.documents,3,'Document',r=>r.status==='MISSING');add(report.documents,4,'Document',r=>r.status==='UNKNOWN');
    add([report.biometrics,...(report.procedure?.items||[])],5,'Procedure',r=>r.status==='ACTION_REQUIRED'||r.status==='UNKNOWN');
    if(report.irish_return.status!=='READY')report.attention.push({priority:5,section:'Return to Ireland',result:report.irish_return});
    add(report.documents,6,'Assessment',r=>r.evidence_id==='SCHENGEN_INTENTION_INFORMATION');
    report.attention.sort((a,b)=>a.priority-b.priority);
    return report;
  }
  return {resolve,evaluate};
});
