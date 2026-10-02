(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./assessment.js'):root.VisaCheckAssessment);if(typeof module==='object'&&module.exports)module.exports=api;else root.VisaCheckAssessmentAdapter=api;})(globalThis,function(engine){
  'use strict';
  // Report compatibility boundary; aggregation itself sees only typed identities.
  function assessReport(report,community){
    const refs=report.runtime?.asset_refs||[];
    const assetFor=(role,id)=>refs.find(r=>r.role===role&&(id===undefined||r.id===id));
    const wrap=(r,asset,kind,id,revision,status)=>({asset_key:asset?.key??null,result_kind:kind,result_id:id,revision,status:status??r?.status??'UNKNOWN',applicability:r?.applicability,code:r?.code??r?.reason??null});
    const official=report.legal.map(r=>wrap(r,assetFor('rule',r.rule_id),'official',r.rule_id,r.rule_revision));
    if(report.baseline)official.push(wrap(report.baseline,assetFor('baseline'),'official',report.baseline.rule_id,report.baseline.rule_revision,'INFORMATIONAL'));
    const config=report.assessment_configuration??null;
    const readiness=report.documents.map(r=>{const binding=config?.results.find(b=>b.result_kind==='readiness'&&b.result_id===r.evidence_id&&b.revision===r.revision);return wrap(r,{key:binding?.asset_key},'readiness',r.evidence_id,r.revision);});
    const procedure=[];
    if(report.procedure)for(const r of report.procedure.items)procedure.push(wrap(r,assetFor('submission'),'procedure',r.procedure_id,report.procedure.revision));
    for(const [property,role]of [['purpose','purpose'],['biometrics','biometrics'],['irish_return','return_diagnostic']]){
      const r=report[property],asset=assetFor(role);if(r&&asset)procedure.push(wrap(r,asset,'procedure',asset.id,asset.revision));
    }
    return engine.assess({official_results:official,readiness_results:readiness,procedure_results:procedure,community_result:community,coverage:{status:report.route.status,release_id:report.runtime?.release_id,version:report.runtime?.version,publication:report.runtime?.publication,selected_asset_keys:refs.map(r=>r.key)},assessment_configuration:config});
  }
  return {assessReport};
});
